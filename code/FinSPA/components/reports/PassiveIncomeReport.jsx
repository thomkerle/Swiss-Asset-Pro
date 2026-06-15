const React = require('react');
const { useState, useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getNormalizedBookings } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);

const PassiveIncomeReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  // Interaktiver UI-State für das Top-Assets Dashboard
  const [activeTab, setActiveTab] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('desc'); 

  // --- DATEN-AGGREGATION ---
  const { totalPassive, monthlyDataPoints, categoryMap, assetMap, rawMonthsCount } = useMemo(() => {
    let total = 0;
    const mData = {};
    const cMap = { 'Dividenden': 0, 'Zinsen': 0, 'Mieteinnahmen': 0 };
    const aMap = {};

    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    start.setDate(1); end.setDate(1);
    
    let monthsCount = 0;
    while (start <= end) {
      const mStr = start.toISOString().substring(0, 7);
      mData[mStr] = { dateStr: mStr, dividends: 0, interests: 0, rents: 0, total: 0 };
      start.setMonth(start.getMonth() + 1);
      monthsCount++;
    }

    const normBookings = getNormalizedBookings ? getNormalizedBookings(activeAssets) : [];
    const isSecurity = (ac) => ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

    normBookings.filter(bk => {
        if (bk.date < dateRange.from || bk.date > dateRange.to) return false;
        if (bk.normType !== 'Einzahlung') return false;
        if (!['Dividenden', 'Zinsen', 'Mieteinnahmen'].includes(bk.normCategory)) return false;

        // BUGFIX: Cash-Konto-Doppelzählung strikt ausschließen
        if (bk.normCategory === 'Dividenden' && !isSecurity(bk._assetClass)) {
            return false;
        }
        return true;
    }).forEach(bk => {
        const val = bk._baseValue;
        const monthStr = bk.date.substring(0, 7);
        const cat = bk.normCategory;
        
        // KORREKTUR: Nutzt hier direkt bk.assetName für die echte Anzeige des Assets!
        const assetName = bk.assetName || (t ? t('unknown') || 'Unbekannt' : 'Unbekannt');

        total += val;
        cMap[cat] = (cMap[cat] || 0) + val;
        
        if (mData[monthStr]) {
            mData[monthStr].total += val;
            if (cat === 'Dividenden') mData[monthStr].dividends += val;
            if (cat === 'Zinsen') mData[monthStr].interests += val;
            if (cat === 'Mieteinnahmen') mData[monthStr].rents += val;
        }
        
        if (!aMap[assetName]) aMap[assetName] = { val: 0, cat: cat, count: 0 };
        aMap[assetName].val += val;
        aMap[assetName].count += 1;
    });

    const sortedMonths = Object.keys(mData).sort().map(k => mData[k]);

    return { 
        totalPassive: total, 
        monthlyDataPoints: sortedMonths, 
        categoryMap: cMap, 
        assetMap: aMap,
        rawMonthsCount: Math.max(monthsCount, 1)
    };
  }, [activeAssets, dateRange, t]);

  // --- STATISTIKEN & KPI BERECHNUNG ---
  const monthlyAverage = totalPassive / rawMonthsCount;
  const annualizedRunRate = monthlyAverage * 12;
  
  let bestMonth = '-';
  let bestMonthVal = 0;
  monthlyDataPoints.forEach(m => {
      if (m.total > bestMonthVal) {
          bestMonthVal = m.total;
          bestMonth = m.dateStr;
      }
  });

  const processedAssets = useMemo(() => {
    return Object.keys(assetMap)
      .map(name => ({
          name,
          val: assetMap[name].val,
          cat: assetMap[name].cat,
          count: assetMap[name].count,
          percentage: totalPassive > 0 ? (assetMap[name].val / totalPassive) * 100 : 0
      }))
      .filter(item => {
          const matchesTab = activeTab === 'all' || item.cat === activeTab;
          const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesTab && matchesSearch;
      })
      .sort((a, b) => {
          if (sortBy === 'desc') return b.val - a.val;
          if (sortBy === 'asc') return a.val - b.val;
          if (sortBy === 'alpha') return a.name.localeCompare(b.name);
          return b.val - a.val;
      });
  }, [assetMap, activeTab, searchQuery, sortBy, totalPassive]);

  const repTitle = t ? t('repPassiveTitle') || "Passives Einkommen" : "Passives Einkommen";
  const repSub = t ? t('descCashflowDividends') || "Cashflow durch Dividenden, Zinsen & Mieten" : "Cashflow durch Dividenden, Zinsen & Mieten";

  // --- NEUER PROFESSIONELLER PDF EXPORT (html2canvas) ---
  useEffect(() => {
    const loadHtml2Canvas = () => {
        return new Promise((resolve) => {
            if (window.html2canvas) return resolve(window.html2canvas);
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = () => resolve(window.html2canvas);
            document.head.appendChild(script);
        });
    };

    const handlePdfExport = async () => {
      try {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        const captureBlock = async (selector, titleFallback = '') => {
            const el = document.querySelector(selector);
            if (el) {
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0) });
            }
        };

        await captureBlock('.dashboard-top-export-block', ''); 

        if (chartRef.current) {
            const containers = chartRef.current.querySelectorAll('.chart-export-block');
            for (let i = 0; i < containers.length; i++) {
                const canvas = await html2canvas(containers[i], { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0) }); 
            }
        }

        const safeT = (key, fallback) => (t && t(key) && t(key) !== key) ? t(key) : fallback;

        const customHeaderRows = [
            [
                { text: safeT('colMonth', 'Monat'), style: 'tableHeader', alignment: 'left' },
                { text: safeT('labelDividends', 'Dividenden'), style: 'tableHeader', alignment: 'right' },
                { text: safeT('labelInterests', 'Zinsen'), style: 'tableHeader', alignment: 'right' },
                { text: safeT('labelRents', 'Mieten'), style: 'tableHeader', alignment: 'right' },
                { text: safeT('labelTotalReturn', 'Gesamtertrag'), style: 'tableHeader', alignment: 'right' }
            ]
        ];
        
        const tableBody = monthlyDataPoints.slice().reverse().map(d => {
            const [y, m] = d.dateStr.split('-');
            const dateObj = new Date(y, m - 1);
            const formattedDate = dateObj.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' }); 
            return [
              formattedDate, 
              `+${fCur(d.dividends)}`, 
              `+${fCur(d.interests)}`, 
              `+${fCur(d.rents)}`, 
              { text: `+${fCur(d.total)}`, bold: true }
            ];
        });

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to})`,
          customHeaderRows, 
          tableBody, 
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im PassiveIncomeReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [monthlyDataPoints, fCur, t, repTitle, repSub, data, dateRange]);

  const chartLabels = monthlyDataPoints.map(d => {
      const [y, m] = d.dateStr.split('-');
      const dateObj = new Date(y, m - 1);
      return `${('0'+(dateObj.getMonth()+1)).slice(-2)}.${dateObj.getFullYear().toString().slice(-2)}`;
  });

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12">
      <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-6">
         <ReportHeader title={repTitle} subtitle={repSub} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      </div>

      {/* DASHBOARD BLOCK FÜR EXPORT */}
      <div className="dashboard-top-export-block w-full bg-white dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('totalNetIncome') || 'Gesamtertrag (Netto)' : 'Gesamtertrag (Netto)'}</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fCur(totalPassive)}</div>
                <div className="text-xs text-gray-400 mt-2">{t ? t('sumPassiveInflows') || 'Summe aller passiven Zuflüsse' : 'Summe aller passiven Zuflüsse'}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('monthlyAverage') || 'Monatlicher Schnitt' : 'Monatlicher Schnitt'}</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{fCur(monthlyAverage)}</div>
                <div className="text-xs text-gray-400 mt-2">{t ? t('labelBasedOn') || 'Bezogen auf' : 'Bezogen auf'} {rawMonthsCount} {t ? t('labelMonths') || 'Monate' : 'Monate'}</div>
             </div>
             
             <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50 p-6 rounded-2xl shadow-sm">
                <div className="text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('annualProjection') || 'Hochrechnung (p.a.)' : 'Hochrechnung (p.a.)'}</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{fCur(annualizedRunRate)}</div>
                <div className="text-xs text-indigo-500/70 dark:text-indigo-400/70 mt-2">{t ? t('annualizedRunRate') || 'Annualisierte Run-Rate' : 'Annualisierte Run-Rate'}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('labelBestMonth') || 'Stärkster Monat' : 'Stärkster Monat'}</div>
                 <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {bestMonth !== '-' ? (() => {
                        const [y, m] = bestMonth.split('-');
                        return new Date(y, m - 1).toLocaleDateString('de-CH', { month: 'short', year: 'numeric' });
                    })() : '-'}
                 </div>
                 <div className="text-sm font-bold text-emerald-600 dark:text-emerald-500 mt-1.5">{bestMonthVal > 0 ? `+${fCur(bestMonthVal)}` : ''}</div>
             </div>
          </div>
      </div>

      {totalPassive > 0 ? (
          <div className="space-y-8" ref={chartRef}>
            
            {/* Chart: Ertragsverlauf */}
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
               data-pdf-title={t ? t('titleCashflowComposition') || "Zusammensetzung des Cashflows im Zeitverlauf" : "Zusammensetzung des Cashflows im Zeitverlauf"}
               data-pdf-legend={JSON.stringify([
                   { name: t ? t('labelDividends') || 'Dividenden' : 'Dividenden', color: '#10b981' },
                   { name: t ? t('labelInterests') || 'Zinsen' : 'Zinsen', color: '#3b82f6' },
                   { name: t ? t('labelRents') || 'Mieten' : 'Mieten', color: '#f59e0b' }
               ])}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Icon name="BarChart2" className="text-emerald-500" /> {t ? t('titleCashflowDistribution') || 'Cashflow Verteilung (Zeitverlauf)' : 'Cashflow Verteilung (Zeitverlauf)'}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={chartLabels}
                        datasets={[
                            {
                                name: t ? t('labelDividends') || 'Dividenden' : 'Dividenden',
                                data: monthlyDataPoints.map(d => d.dividends),
                                backgroundColor: '#10b981', 
                                valueFormatter: fCur,
                                stack: 'total'
                            },
                            {
                                name: t ? t('labelInterests') || 'Zinsen' : 'Zinsen',
                                data: monthlyDataPoints.map(d => d.interests),
                                backgroundColor: '#3b82f6', 
                                valueFormatter: fCur,
                                stack: 'total'
                            },
                            {
                                name: t ? t('labelRents') || 'Mieten' : 'Mieten',
                                data: monthlyDataPoints.map(d => d.rents),
                                backgroundColor: '#f59e0b',
                                valueFormatter: fCur,
                                stack: 'total'
                            }
                        ]} 
                        height="100%"
                    />
                </div>
            </div>

            {/* Interaktives Top-Assets Dashboard */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden chart-export-block" data-pdf-title={t ? t('topIncomeSources') || "Top Ertragsquellen" : "Top Ertragsquellen"}>
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 space-y-4 bg-gray-50/50 dark:bg-slate-800/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Icon name="Star" className="text-amber-500"/> {t ? t('detailAnalysisTopSources') || 'Detailanalyse & Top Quellen' : 'Detailanalyse & Top Quellen'}
                        </h3>
                        <div className="print-hide relative w-full sm:w-64">
                            <input 
                                type="text" placeholder={t ? t('searchAsset') || 'Anlage suchen...' : 'Anlage suchen...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full p-2 pl-8 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                            />
                            <div className="absolute left-2.5 top-2.5 text-gray-400"><Icon name="Search" size={14} /></div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 print-hide">
                        <div className="flex gap-1.5 bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                            <button onClick={() => setActiveTab('all')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{t ? t('tabAll') || 'Alle' : 'Alle'}</button>
                            <button onClick={() => setActiveTab('Dividenden')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Dividenden' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{t ? t('labelDividends') || 'Dividenden' : 'Dividenden'}</button>
                            <button onClick={() => setActiveTab('Zinsen')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Zinsen' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{t ? t('labelInterests') || 'Zinsen' : 'Zinsen'}</button>
                            <button onClick={() => setActiveTab('Mieteinnahmen')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Mieteinnahmen' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{t ? t('labelRents') || 'Mieten' : 'Mieten'}</button>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <span>{t ? t('labelSorting') || 'Sortierung:' : 'Sortierung:'}</span>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border border-gray-300 dark:border-slate-600 rounded-md p-1.5 outline-none text-slate-700 dark:text-slate-300">
                                <option value="desc">{t ? t('sortHighestYield') || 'Höchster Ertrag' : 'Höchster Ertrag'}</option>
                                <option value="asc">{t ? t('sortLowestYield') || 'Niedrigster Ertrag' : 'Niedrigster Ertrag'}</option>
                                <option value="alpha">{t ? t('sortAlphabetical') || 'Alphabetisch' : 'Alphabetisch'}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                        <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 font-bold uppercase text-xs">{t ? t('colAssetPosition') || 'Asset / Position' : 'Asset / Position'}</th>
                                <th className="p-4 font-bold uppercase text-xs">{t ? t('category') || 'Kategorie' : 'Kategorie'}</th>
                                <th className="p-4 font-bold uppercase text-xs text-center">{t ? t('colFrequency') || 'Frequenz' : 'Frequenz'}</th>
                                <th className="p-4 font-bold uppercase text-xs w-1/3">{t ? t('colWeightingContribution') || 'Gewichtung / Beitrag' : 'Gewichtung / Beitrag'}</th>
                                <th className="p-4 font-bold uppercase text-xs text-right">{t ? t('labelTotalReturn') || 'Gesamtertrag' : 'Gesamtertrag'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                            {processedAssets.length > 0 ? (
                                processedAssets.map((asset, idx) => {
                                    let badgeStyle = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
                                    let progressStyle = 'bg-emerald-500';
                                    if (asset.cat === 'Zinsen') {
                                        badgeStyle = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
                                        progressStyle = 'bg-blue-500';
                                    }
                                    if (asset.cat === 'Mieteinnahmen') {
                                        badgeStyle = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
                                        progressStyle = 'bg-amber-500';
                                    }

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{asset.name}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${badgeStyle}`}>
                                                    {t ? t(asset.cat) || asset.cat : asset.cat}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-medium font-mono text-gray-400">
                                                {asset.count}x {t ? t('labelPaid') || 'bezahlt' : 'bezahlt'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-xs text-gray-500 w-10 text-right">{asset.percentage.toFixed(1)}%</span>
                                                    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full ${progressStyle} rounded-full`} style={{ width: `${asset.percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-black text-slate-900 dark:text-white font-mono">
                                                {fCur(asset.val)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">
                                        {t ? t('noPositionsMatchFilters') || 'Keine Positionen entsprechen den aktuellen Filterkriterien.' : 'Keine Positionen entsprechen den aktuellen Filterkriterien.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Monatliche Historie */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
                    {t ? t('monthlyHistoryBreakdown') || 'Monatliche Historie & Aufschlüsselung' : 'Monatliche Historie & Aufschlüsselung'}
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 font-medium">{t ? t('colMonth') || 'Monat' : 'Monat'}</th>
                            <th className="px-6 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{t ? t('labelDividends') || 'Dividenden' : 'Dividenden'}</th>
                            <th className="px-6 py-4 text-right font-medium text-blue-600 dark:text-blue-400">{t ? t('labelInterests') || 'Zinsen' : 'Zinsen'}</th>
                            <th className="px-6 py-4 text-right font-medium text-amber-600 dark:text-amber-400">{t ? t('labelRents') || 'Mieten' : 'Mieten'}</th>
                            <th className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">{t ? t('totalIncome') || 'Total Ertrag' : 'Total Ertrag'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {monthlyDataPoints.slice().reverse().map((d, i) => {
                            const [y, m] = d.dateStr.split('-');
                            const dateObj = new Date(y, m - 1);
                            const displayDate = dateObj.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

                            return (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                    <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10">
                                        {displayDate}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{d.dividends > 0 ? `+${fCur(d.dividends)}` : '-'}</td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{d.interests > 0 ? `+${fCur(d.interests)}` : '-'}</td>
                                    <td className="px-6 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{d.rents > 0 ? `+${fCur(d.rents)}` : '-'}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">{d.total > 0 ? `+${fCur(d.total)}` : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    </table>
                </div>
            </div>

          </div>
      ) : (
          <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-12 text-center text-gray-500 mt-6">
             <Icon name="Coffee" size={48} className="mx-auto mb-4 opacity-20 text-emerald-500" />
             <p className="font-medium">{t ? t('noPassiveIncome') || 'Kein passives Einkommen im gewählten Zeitraum verzeichnet.' : 'Kein passives Einkommen im gewählten Zeitraum verzeichnet.'}</p>
             <p className="text-xs text-gray-400 mt-1">{t ? t('recordDividendInterestRent') || 'Erfasse Dividenden-, Zins- oder Mietbuchungen auf deinen aktiven Assets.' : 'Erfasse Dividenden-, Zins- oder Mietbuchungen auf deinen aktiven Assets.'}</p>
          </div>
      )}
    </div>
  );
};

module.exports = PassiveIncomeReport;