const React = require('react');
const { useState, useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header</div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getNormalizedBookings, getAllAssets, getAssetRawValueAtDate, getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const PassiveIncomeReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);

  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';
  const todayStr = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('desc'); 

  const { totalPassive, monthlyDataPoints, categoryMap, assetMap, yearlyData, accumulatedData } = useMemo(() => {
    let total = 0;
    const mData = {};
    const yMap = {};
    const cMap = { 'Dividenden': 0, 'Zinsen': 0, 'Mieteinnahmen': 0 };
    const aMap = {};

    const startStr = (dateRange?.from || `${new Date().getFullYear()}-01-01`).substring(0, 7);
    const endStr = (dateRange?.to || todayStr).substring(0, 7);

    let [startYear, startMonth] = startStr.split('-').map(Number);
    const [endYear, endMonth] = endStr.split('-').map(Number);

    while (startYear < endYear || (startYear === endYear && startMonth <= endMonth)) {
      const mKey = `${startYear}-${String(startMonth).padStart(2, '0')}`;
      mData[mKey] = { dateStr: mKey, dividends: 0, interests: 0, rents: 0, total: 0 };
      
      startMonth++;
      if (startMonth > 12) {
        startMonth = 1;
        startYear++;
      }
    }

    const allHistoricalAssets = getAllAssets ? getAllAssets(data?.banks || []) : activeAssets;
    const normBookings = getNormalizedBookings ? getNormalizedBookings(allHistoricalAssets) : [];
    
    normBookings.filter(bk => {
        if (!bk.date || bk.date < dateRange.from || bk.date > dateRange.to) return false;
        const isPassiveCat = ['Dividenden', 'Zinsen', 'Mieteinnahmen'].includes(bk.category);
        return bk.type === 'income' && isPassiveCat;
    }).forEach(bk => {
        const val = Number(bk._baseValue || 0);
        const mKey = bk.date.substring(0, 7);
        const yKey = bk.date.substring(0, 4);
        const cat = bk.category;
        const assetName = bk.assetName || safeT(t, 'unknown', 'Unbekannt');

        total += val;
        cMap[cat] = (cMap[cat] || 0) + val;
        
        if (mData[mKey]) {
            mData[mKey].total += val;
            if (cat === 'Dividenden') mData[mKey].dividends += val;
            if (cat === 'Zinsen') mData[mKey].interests += val;
            if (cat === 'Mieteinnahmen') mData[mKey].rents += val;
        }

        if (!yMap[yKey]) yMap[yKey] = { year: yKey, dividends: 0, interests: 0, rents: 0, total: 0 };
        yMap[yKey].total += val;
        if (cat === 'Dividenden') yMap[yKey].dividends += val;
        if (cat === 'Zinsen') yMap[yKey].interests += val;
        if (cat === 'Mieteinnahmen') yMap[yKey].rents += val;
        
        if (!aMap[assetName]) aMap[assetName] = { val: 0, cat: cat, count: 0 };
        aMap[assetName].val += val;
        aMap[assetName].count += 1;
    });

    const sortedMonths = Object.keys(mData).sort().map(k => mData[k]);
    const sortedYears = Object.keys(yMap).sort().map(k => yMap[k]);

    let runningTotal = 0;
    const accList = sortedMonths.map(m => {
        runningTotal += m.total;
        return { dateStr: m.dateStr, accumulated: runningTotal };
    });

    return { 
        totalPassive: total, 
        monthlyDataPoints: sortedMonths, 
        categoryMap: cMap, 
        assetMap: aMap,
        yearlyData: sortedYears,
        accumulatedData: accList
    };
  }, [data?.banks, activeAssets, dateRange, todayStr, t]);

  const forecast12m = useMemo(() => {
      let annualSumBase = 0;
      const allHistoricalAssets = getAllAssets ? getAllAssets(data?.banks || []) : (activeAssets || []);
      
      allHistoricalAssets.forEach(asset => {
          if (!['stock', 'fund', 'managed_fund'].includes(asset.assetClass)) return;
          const yieldPct = parseFloat(asset.forwardYield || 0);
          if (yieldPct <= 0) return;

          const taxPct = parseFloat(asset.totalTaxes || 0);
          let currentValueNative = getAssetRawValueAtDate ? getAssetRawValueAtDate(asset, todayStr) : 0;
          
          if (!currentValueNative || currentValueNative === 0) {
              const bVal = getAssetValueAtDate ? getAssetValueAtDate(asset, todayStr, allHistoricalAssets) : 0;
              const fx = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
              currentValueNative = fx !== 0 ? bVal / fx : bVal;
          }

          if (currentValueNative <= 0) return;

          const grossNative = currentValueNative * (yieldPct / 100);
          const netNative = grossNative * (1 - (taxPct / 100));
          const fxRate = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
          annualSumBase += netNative * fxRate;
      });

      return annualSumBase;
  }, [data?.banks, activeAssets, todayStr]);

  const rawMonthsCount = Math.max(monthlyDataPoints.length, 1);
  const monthlyAverage = totalPassive / rawMonthsCount;
  
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

  const repTitle = safeT(t, 'repPassiveTitle', "Passives Einkommen");
  const repSub = `${dateRange?.from} ${safeT(t, 'wordTo', 'bis')} ${dateRange?.to} | Cashflow, Akkumulation & Prognose`;

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'totalNetIncome', 'Gesamtertrag'), value: fCur(totalPassive), sub: safeT(t, 'descCumulatedMonthsCount', `Über ${rawMonthsCount} Monate`).replace('{count}', rawMonthsCount), color: '#10b981' },
            { label: safeT(t, 'monthlyAverage', 'Monatlicher Schnitt'), value: fCur(monthlyAverage), sub: safeT(t, 'descHistoricalAverage', 'Historischer Schnitt'), color: '#3b82f6' },
            { label: safeT(t, 'kpiForecast12mYield', '12M Prognose (Forward Yield)'), value: fCur(forecast12m), sub: safeT(t, 'descExpectedYieldAnnual', 'Erwarteter Cashflow p.a.'), color: '#8b5cf6' },
            { label: safeT(t, 'labelBestMonth', 'Stärkster Monat'), value: bestMonth !== '-' ? bestMonth : '-', sub: fCur(bestMonthVal), color: '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
            chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colMonth', 'Monat'),
            safeT(t, 'labelDividends', 'Dividenden'),
            safeT(t, 'labelInterests', 'Zinsen'),
            safeT(t, 'labelRents', 'Mieten'),
            safeT(t, 'colMonthTotal', 'Monatstotal'),
            safeT(t, 'colCumulative', 'Kumuliert')
        ];
        
        let runAcc = 0;
        const tableBody = monthlyDataPoints.map(d => {
            runAcc += d.total;
            const [y, m] = d.dateStr.split('-');
            const formattedDate = new Date(Number(y), Number(m) - 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
            return [
                formattedDate,
                `+${fCur(d.dividends)}`,
                `+${fCur(d.interests)}`,
                `+${fCur(d.rents)}`,
                { text: `+${fCur(d.total)}`, bold: true },
                { text: fCur(runAcc), bold: true }
            ];
        }).reverse();

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: repSub,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.24, 0.15, 0.15, 0.15, 0.16, 0.15],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im PassiveIncomeReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 6,
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.24, 0.15, 0.15, 0.15, 0.16, 0.15],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error:", err);
                resolve(null);
            }
        });

        if (e.detail && typeof e.detail.registerPromise === 'function') {
            e.detail.registerPromise(exportPromise);
        }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    window.addEventListener('triggerPdfBatchExport', handleBatchExport);
    return () => {
        window.removeEventListener('triggerPdfExport', handlePdfExport);
        window.removeEventListener('triggerPdfBatchExport', handleBatchExport);
    };
  }, [monthlyDataPoints, fCur, t, repTitle, repSub, data, totalPassive, monthlyAverage, forecast12m, bestMonth, bestMonthVal, rawMonthsCount]);

  const chartLabels = monthlyDataPoints.map(d => {
      const [y, m] = d.dateStr.split('-');
      return `${m}.${y.slice(-2)}`;
  });

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12" ref={reportRef}>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT(t, 'totalNetIncome', 'Gesamtertrag')}</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fCur(totalPassive)}</div>
            <div className="text-xs text-gray-400 mt-2">{safeT(t, 'descCumulatedMonthsCount', `Kumuliert über ${rawMonthsCount} Monate`).replace('{count}', rawMonthsCount)}</div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT(t, 'monthlyAverage', 'Monatlicher Schnitt')}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{fCur(monthlyAverage)}</div>
            <div className="text-xs text-gray-400 mt-2">{safeT(t, 'descHistoricalAverage', 'Bisheriger historischer Schnitt')}</div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-500">
            <div className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">{safeT(t, 'kpiForecast12mYield', '12M Prognose (Forward Yield)')}</div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">{fCur(forecast12m)}</div>
            <div className="text-xs text-gray-400 mt-2">{safeT(t, 'descExpectedYieldAnnual', 'Erwartete Netto-Erträge p.a.')}</div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500">
             <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT(t, 'labelBestMonth', 'Stärkster Monat')}</div>
             <div className="text-2xl font-black text-slate-900 dark:text-white">
                {bestMonth !== '-' ? bestMonth : '-'}
             </div>
             <div className="text-sm font-bold text-amber-600 dark:text-amber-500 mt-1">{bestMonthVal > 0 ? `+${fCur(bestMonthVal)}` : ''}</div>
         </div>
      </div>

      {totalPassive > 0 ? (
          <div className="space-y-8">
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8" ref={chartRef}>
                
                <div 
                   className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                   data-pdf-title={safeT(t, 'titleMonthlyCashflowByCat', 'Monatlicher Cashflow nach Kategorie')}
                >
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Icon name="BarChart2" className="text-emerald-500" /> {safeT(t, 'titleMonthlyCashflowTrend', 'Monatlicher Cashflow')}
                    </h3>
                    <div style={{ width: '100%', height: '320px' }}>
                        <UniversalChart 
                            engine={activeChartEngine}
                            type="bar"
                            labels={chartLabels}
                            datasets={[
                                {
                                    name: safeT(t, 'labelDividends', 'Dividenden'),
                                    data: monthlyDataPoints.map(d => d.dividends),
                                    backgroundColor: '#10b981', 
                                    valueFormatter: fCur,
                                    stack: 'total'
                                },
                                {
                                    name: safeT(t, 'labelInterests', 'Zinsen'),
                                    data: monthlyDataPoints.map(d => d.interests),
                                    backgroundColor: '#3b82f6', 
                                    valueFormatter: fCur,
                                    stack: 'total'
                                },
                                {
                                    name: safeT(t, 'labelRents', 'Mieten'),
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

                <div 
                   className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                   data-pdf-title={safeT(t, 'titleAccumulatedPassiveCashflow', 'Akkumulierter Vermögenszufluss')}
                >
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Icon name="TrendingUp" className="text-blue-500" /> {safeT(t, 'titleAccumulatedPassiveCashflow', 'Akkumulierter Vermögenszufluss')}
                    </h3>
                    <div style={{ width: '100%', height: '320px' }}>
                        <UniversalChart 
                            engine={activeChartEngine}
                            type="line"
                            labels={chartLabels}
                            datasets={[
                                {
                                    name: safeT(t, 'labelAccumulatedReturn', 'Kumulierter Ertrag'),
                                    data: accumulatedData.map(d => d.accumulated),
                                    backgroundColor: '#2563eb', 
                                    valueFormatter: fCur
                                }
                            ]} 
                            height="100%"
                        />
                    </div>
                </div>

                <div 
                   className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block xl:col-span-2"
                   data-pdf-title={safeT(t, 'titleAnnualReturnDev', 'Jährliche Ertragsentwicklung')}
                >
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Icon name="Calendar" className="text-purple-500" /> {safeT(t, 'titleAnnualReturnDev', 'Jährliche Ertragsentwicklung')}
                    </h3>
                    <div style={{ width: '100%', height: '280px' }}>
                        <UniversalChart 
                            engine={activeChartEngine}
                            type="bar"
                            labels={yearlyData.map(y => y.year)}
                            datasets={[
                                {
                                    name: safeT(t, 'labelDividends', 'Dividenden'),
                                    data: yearlyData.map(y => y.dividends),
                                    backgroundColor: '#10b981',
                                    valueFormatter: fCur,
                                    stack: 'year'
                                },
                                {
                                    name: safeT(t, 'labelInterests', 'Zinsen'),
                                    data: yearlyData.map(y => y.interests),
                                    backgroundColor: '#3b82f6',
                                    valueFormatter: fCur,
                                    stack: 'year'
                                },
                                {
                                    name: safeT(t, 'labelRents', 'Mieten'),
                                    data: yearlyData.map(y => y.rents),
                                    backgroundColor: '#f59e0b',
                                    valueFormatter: fCur,
                                    stack: 'year'
                                }
                            ]} 
                            height="100%"
                        />
                    </div>
                </div>

            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 space-y-4 bg-gray-50/50 dark:bg-slate-800/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Icon name="Star" className="text-amber-500"/> {safeT(t, 'detailAnalysisTopSources', 'Detailanalyse & Top Quellen')}
                        </h3>
                        <div className="print-hide relative w-full sm:w-64">
                            <input 
                                type="text" placeholder={safeT(t, 'searchAsset', 'Anlage suchen...')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full p-2 pl-8 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                            />
                            <div className="absolute left-2.5 top-2.5 text-gray-400"><Icon name="Search" size={14} /></div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 print-hide">
                        <div className="flex gap-1.5 bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                            <button onClick={() => setActiveTab('all')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{safeT(t, 'tabAll', 'Alle')}</button>
                            <button onClick={() => setActiveTab('Dividenden')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Dividenden' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{safeT(t, 'labelDividends', 'Dividenden')}</button>
                            <button onClick={() => setActiveTab('Zinsen')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Zinsen' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{safeT(t, 'labelInterests', 'Zinsen')}</button>
                            <button onClick={() => setActiveTab('Mieteinnahmen')} className={`px-4 py-1.5 rounded-md transition-all ${activeTab === 'Mieteinnahmen' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{safeT(t, 'labelRents', 'Mieten')}</button>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <span>{safeT(t, 'labelSorting', 'Sortierung:')}</span>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border border-gray-300 dark:border-slate-600 rounded-md p-1.5 outline-none text-slate-700 dark:text-slate-300">
                                <option value="desc">{safeT(t, 'sortHighestYield', 'Höchster Ertrag')}</option>
                                <option value="asc">{safeT(t, 'sortLowestYield', 'Niedrigster Ertrag')}</option>
                                <option value="alpha">{safeT(t, 'sortAlphabetical', 'Alphabetisch')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                        <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 font-bold uppercase text-xs">{safeT(t, 'colAssetPosition', 'Asset / Position')}</th>
                                <th className="p-4 font-bold uppercase text-xs">{safeT(t, 'category', 'Kategorie')}</th>
                                <th className="p-4 font-bold uppercase text-xs text-center">{safeT(t, 'colFrequency', 'Frequenz')}</th>
                                <th className="p-4 font-bold uppercase text-xs w-1/3">{safeT(t, 'colWeightingContribution', 'Gewichtung')}</th>
                                <th className="p-4 font-bold uppercase text-xs text-right">{safeT(t, 'totalIncome', 'Gesamtertrag')}</th>
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
                                                    {safeT(t, asset.cat, asset.cat)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-medium font-mono text-gray-400">
                                                {safeT(t, 'labelPaidCountSuffix', `${asset.count}x bezahlt`).replace('{count}', asset.count)}
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
                                        {safeT(t, 'msgNoMatchingPositionsFilter', 'Keine Positionen entsprechen den aktuellen Filterkriterien.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
                    {safeT(t, 'titleMonthlyHistoryBreakdown', 'Monatliche Historie & Aufschlüsselung')}
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 font-medium">{safeT(t, 'colMonth', 'Monat')}</th>
                            <th className="px-6 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{safeT(t, 'labelDividends', 'Dividenden')}</th>
                            <th className="px-6 py-4 text-right font-medium text-blue-600 dark:text-blue-400">{safeT(t, 'labelInterests', 'Zinsen')}</th>
                            <th className="px-6 py-4 text-right font-medium text-amber-600 dark:text-amber-400">{safeT(t, 'labelRents', 'Mieten')}</th>
                            <th className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">{safeT(t, 'colMonthTotal', 'Monatstotal')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {monthlyDataPoints.slice().reverse().map((d, i) => {
                            const [y, m] = d.dateStr.split('-');
                            const displayDate = new Date(Number(y), Number(m) - 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

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
             <Icon name="Coins" size={48} className="mx-auto mb-4 opacity-20 text-emerald-500" />
             <p className="font-medium">{safeT(t, 'msgNoPassiveIncomeRecorded', 'Kein passives Einkommen im gewählten Zeitraum verzeichnet.')}</p>
             <p className="text-xs text-gray-400 mt-1">{safeT(t, 'descRecordPassiveIncomeHint', 'Erfasse Dividenden-, Zins- oder Mietbuchungen auf deinen aktiven Assets.')}</p>
          </div>
      )}
    </div>
  );
};

module.exports = PassiveIncomeReport;