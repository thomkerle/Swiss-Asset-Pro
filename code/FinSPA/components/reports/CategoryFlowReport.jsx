const React = require('react');
const { useEffect, useRef, useMemo, useState } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);
const { getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  const labelUncategorized = safeT(t, 'catUncategorized', "Unkategorisiert");
  const titleText = safeT(t, 'repCatFlow', "Kategorienfluss");
  const subtitlePrefix = safeT(t, 'repCatFlowSub', "Vermögensentwicklung & Kapitalverschiebung nach Kategorien");

  const [expandedCats, setExpandedCats] = useState({});

  const toggleCat = (catName) => {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  const { 
    catData, 
    totalStart, 
    totalEnd, 
    totalDelta, 
    totalGrowthPct,
    bestCat, 
    mostDynamicCat 
  } = useMemo(() => {
    const catDataMap = {};
    let tStart = 0;
    let tEnd = 0;

    const traverse = (nodes, currentCatName = labelUncategorized) => {
       (nodes || []).forEach(n => {
          let catName = currentCatName;
          if (n.type === 'category') catName = n.name;
          
          if (n.type === 'asset' && !n.isArchived) {
              const startVal = getAssetValueAtDate(n, dateRange.from);
              const endVal = getAssetValueAtDate(n, dateRange.to);
              const deltaVal = endVal - startVal;

              if (!catDataMap[catName]) {
                  catDataMap[catName] = { name: catName, start: 0, end: 0, delta: 0, assets: [] };
              }

              catDataMap[catName].start += startVal;
              catDataMap[catName].end += endVal;
              catDataMap[catName].delta += deltaVal;
              
              tStart += startVal;
              tEnd += endVal;

              if (startVal !== 0 || endVal !== 0) {
                  catDataMap[catName].assets.push({ 
                      name: n.name, 
                      start: startVal, 
                      end: endVal, 
                      delta: deltaVal,
                      class: n.assetClass
                  });
              }
          }
          if (n.children) traverse(n.children, catName);
       });
    };
    
    (data?.banks || []).forEach(b => traverse(b.children || [], b.name));

    const tDelta = tEnd - tStart;
    const tGrowth = tStart > 0 ? (tDelta / tStart) * 100 : 0;

    const calculatedCats = Object.values(catDataMap)
      .filter(c => c.start !== 0 || c.end !== 0)
      .map(c => {
          const pct = c.start > 0 ? ((c.delta / c.start) * 100) : (c.end > 0 ? 100 : 0);
          const startShare = tStart > 0 ? (c.start / tStart) * 100 : 0;
          const endShare = tEnd > 0 ? (c.end / tEnd) * 100 : 0;
          c.assets.sort((a, b) => b.delta - a.delta); 
          return {
              ...c,
              pctChange: pct,
              startShare,
              endShare,
              shareShift: endShare - startShare
          };
      })
      .sort((a, b) => b.delta - a.delta); 

    const topGain = calculatedCats.length > 0 && calculatedCats[0].delta > 0 ? calculatedCats[0] : null;
    const topPct = [...calculatedCats].sort((a,b) => b.pctChange - a.pctChange)[0] || null;

    return {
      catData: calculatedCats,
      totalStart: tStart,
      totalEnd: tEnd,
      totalDelta: tDelta,
      totalGrowthPct: tGrowth,
      bestCat: topGain,
      mostDynamicCat: topPct
    };
  }, [data, dateRange, labelUncategorized]);

  useEffect(() => {
    const buildReportData = async () => {
        const startDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const endDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');

        const kpis = [
            { label: safeT(t, 'kpiStartVolumeTotal', 'Startwert Gesamt'), value: fCur(totalStart), sub: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${startDateStr}`, color: '#64748b' },
            { label: safeT(t, 'kpiEndVolumeTotal', 'Endwert Gesamt'), value: fCur(totalEnd), sub: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${endDateStr}`, color: '#2563eb' },
            { label: safeT(t, 'labelAbsoluteChange', 'Netto-Veränderung'), value: `${totalDelta >= 0 ? '+' : ''}${fCur(totalDelta)}`, sub: `${totalGrowthPct >= 0 ? '+' : ''}${safeT(t, 'kpiNetGrowthPeriod', '{pct}% im Zeitraum').replace('{pct}', totalGrowthPct.toFixed(2))}`, color: totalDelta >= 0 ? '#10b981' : '#ef4444' },
            { label: safeT(t, 'kpiTopGain', 'Top Zuwachs'), value: bestCat ? bestCat.name : '-', sub: bestCat ? `+${fCur(bestCat.delta)} (+${bestCat.pctChange.toFixed(1)}%)` : '-', color: '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colCategoryAsset', 'Kategorie / Asset'),
            safeT(t, 'startValue', 'Startwert'),
            safeT(t, 'endValue', 'Endwert'),
            safeT(t, 'colChangeCurrency', `Veränderung (${baseCurrency})`).replace('{cur}', baseCurrency),
            safeT(t, 'colGrowthPercent', 'Wachstum (%)'),
            safeT(t, 'colFinalShare', 'Endanteil')
        ];
        
        const tableBody = [];
        
        catData.forEach(cat => {
            tableBody.push([
                { text: cat.name.toUpperCase(), bold: true },
                fCur(cat.start),
                fCur(cat.end),
                `${cat.delta >= 0 ? '+' : ''}${fCur(cat.delta)}`,
                `${cat.pctChange >= 0 ? '+' : ''}${cat.pctChange.toFixed(1)}%`,
                `${cat.endShare.toFixed(1)}%`
            ]);
            cat.assets.forEach(a => {
                const aPct = a.start > 0 ? ((a.delta / a.start) * 100) : 0;
                tableBody.push([
                    `   - ${a.name} ${a.class ? `[${a.class}]` : ''}`,
                    fCur(a.start),
                    fCur(a.end),
                    `${a.delta >= 0 ? '+' : ''}${fCur(a.delta)}`,
                    a.start > 0 ? `${aPct >= 0 ? '+' : ''}${aPct.toFixed(1)}%` : '-',
                    '-'
                ]);
            });
        });

        tableBody.push([
            { text: safeT(t, 'labelTotalPortfolioUpper', 'TOTAL PORTFOLIO'), bold: true },
            { text: fCur(totalStart), bold: true },
            { text: fCur(totalEnd), bold: true },
            { text: `${totalDelta >= 0 ? '+' : ''}${fCur(totalDelta)}`, bold: true },
            { text: `${totalGrowthPct >= 0 ? '+' : ''}${totalGrowthPct.toFixed(1)}%`, bold: true },
            { text: '100.0%', bold: true }
        ]);

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
        const subtitleText = `${new Date(dateRange.from).toLocaleDateString('de-CH')} ${safeT(t, 'wordTo', 'bis')} ${new Date(dateRange.to).toLocaleDateString('de-CH')} | ${catData.length} ${safeT(t, 'tabCategories', 'Kategorien')}`;

        await PdfToolkit.exportReport({
          title: titleText, 
          subtitle: subtitleText, 
          tableHeaders,
          tableBody,
          colWidthsPct: [0.32, 0.15, 0.15, 0.15, 0.11, 0.12],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) { 
        console.error("[FinBundle Pro] PDF Export Error im CategoryFlowReport:", err); 
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 5, 
                    title: titleText,
                    subtitle: `${new Date(dateRange.from).toLocaleDateString('de-CH')} ${safeT(t, 'wordTo', 'bis')} ${new Date(dateRange.to).toLocaleDateString('de-CH')}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.32, 0.15, 0.15, 0.15, 0.11, 0.12],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im CategoryFlowReport:", err);
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
  }, [catData, dateRange, fCur, t, titleText, totalStart, totalEnd, totalDelta, totalGrowthPct, bestCat, data, baseCurrency]);

  if (catData.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'catNoMovements', 'Keine Bewegungen in den Kategorien im gewählten Zeitraum gefunden.')}</p>
        </div>
      </div>
    );
  }

  const deltaColors = catData.map(d => d.delta >= 0 ? '#10b981' : '#ef4444');
  const deltaCurrencyTitle = safeT(t, 'titleNetValChangeCurrency', 'Netto-Wertveränderung ({cur})').replace('{cur}', baseCurrency);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      
      <div className="w-full bg-white dark:bg-transparent">
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} className="text-slate-500"/>
                    <span>{safeT(t, 'labelStartVolumeHeader', 'STARTVOLUMEN')}</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                    {fCur(totalStart)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {safeT(t, 'atDate', 'am')} {new Date(dateRange.from).toLocaleDateString('de-CH')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Database" size={14} className="text-blue-500"/>
                    <span>{safeT(t, 'labelEndVolumeHeader', 'ENDVOLUMEN')}</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                    {fCur(totalEnd)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {safeT(t, 'atDate', 'am')} {new Date(dateRange.to).toLocaleDateString('de-CH')}
                </div>
             </div>

             <div className={`p-6 rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 totalDelta >= 0 
                    ? 'bg-emerald-50/50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                    : 'bg-rose-50/50 dark:bg-slate-900 border border-rose-200 dark:border-rose-800/50 border-b-rose-500'
             }`}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-2">
                        <Icon name={totalDelta >= 0 ? "TrendingUp" : "TrendingDown"} size={14} className={totalDelta >= 0 ? "text-emerald-500" : "text-rose-500"} />
                        <span>{safeT(t, 'labelNetDevHeader', 'NETTO-ENTWICKLUNG')}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${totalDelta >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                        {totalGrowthPct >= 0 ? '+' : ''}{totalGrowthPct.toFixed(2)}%
                    </span>
                </div>
                <div className={`text-2xl font-black truncate ${totalDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {totalDelta > 0 ? '+' : ''}{fCur(totalDelta)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {totalDelta >= 0 ? safeT(t, 'descPositiveGrowth', 'Positiver Portfolio-Zuwachs') : safeT(t, 'descNegativeDecline', 'Negativer Portfolio-Rückgang')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Star" size={14} className="text-amber-500"/>
                      <span>{safeT(t, 'labelTopWinner', 'TOP GEWINNER')}</span>
                    </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white truncate" title={bestCat ? bestCat.name : '-'}>
                    {bestCat ? bestCat.name : '-'}
                </div>
                <div className="text-xs font-bold mt-2 truncate">
                    {bestCat ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                            +{fCur(bestCat.delta)} <span className="opacity-75 font-normal">(+{bestCat.pctChange.toFixed(1)}%)</span>
                        </span>
                    ) : (
                        <span className="text-gray-400">{safeT(t, 'descNoGains', 'Keine Zuwächse')}</span>
                    )}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
            
            <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'titleStartVsEndCategory', 'Start- vs. Endwert je Kategorie')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart2" className="text-blue-500" /> {safeT(t, 'titleStartVsEndInventory', 'Start- vs. Endbestand je Kategorie')}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={catData.map(d => d.name)}
                        datasets={[
                            {
                                label: safeT(t, 'startValue', 'Startwert'),
                                data: catData.map(d => d.start),
                                backgroundColor: '#94a3b8',
                                valueFormatter: fCur
                            },
                            {
                                label: safeT(t, 'endValue', 'Endwert'),
                                data: catData.map(d => d.end),
                                backgroundColor: '#2563eb',
                                valueFormatter: fCur
                            }
                        ]}
                        height="100%"
                    />
                </div>
            </div>

            <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'titleNetValChangeCategory', 'Netto-Wertveränderung je Kategorie')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="TrendingUp" className="text-emerald-500" /> {deltaCurrencyTitle}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        horizontal={true}
                        labels={catData.map(d => d.name)}
                        datasets={[{
                            label: safeT(t, 'change', 'Veränderung'),
                            data: catData.map(d => d.delta),
                            backgroundColor: deltaColors,
                            valueFormatter: (val) => `${val >= 0 ? '+' : ''}${fCur(val)}`
                        }]}
                        height="100%"
                    />
                </div>
            </div>

          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-10">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Icon name="Layers" className="text-slate-500" /> {safeT(t, 'titleCategoryDetailsDrilldown', 'Kategorie-Details & Portfolio-Verschiebungen')}
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                      {safeT(t, 'descClickToDrilldown', 'Klick auf eine Kategorie öffnet den Asset-Drilldown')}
                  </span>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold">
                          <tr>
                              <th className="p-4">{safeT(t, 'colCategoryArea', 'Kategorie / Bereich')}</th>
                              <th className="p-4 text-right">{safeT(t, 'startValue', 'Startwert')}</th>
                              <th className="p-4 text-right">{safeT(t, 'endValue', 'Endwert')}</th>
                              <th className="p-4 text-right">{deltaCurrencyTitle}</th>
                              <th className="p-4 text-right">{safeT(t, 'colGrowthPercent', 'Wachstum (%)')}</th>
                              <th className="p-4 text-right">{safeT(t, 'colPortfolioShare', 'Portfolio-Anteil')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                          {catData.map((cat, idx) => {
                              const isPositive = cat.delta >= 0;
                              const isExpanded = !!expandedCats[cat.name];

                              return (
                                  <React.Fragment key={idx}>
                                      <tr 
                                          onClick={() => toggleCat(cat.name)}
                                          className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                                      >
                                          <td className="p-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5">
                                              <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={13} className="text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                              <Icon name="Folder" className="text-amber-500 shrink-0" size={15}/>
                                              <span>{cat.name}</span>
                                              <span className="text-[10px] text-gray-400 font-normal">({cat.assets.length})</span>
                                          </td>
                                          <td className="p-4 text-right font-mono text-gray-500">{fCur(cat.start)}</td>
                                          <td className="p-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(cat.end)}</td>
                                          <td className={`p-4 text-right font-mono font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                              {isPositive ? '+' : ''}{fCur(cat.delta)}
                                          </td>
                                          <td className={`p-4 text-right font-mono text-xs font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                              {isPositive ? '+' : ''}{cat.pctChange.toFixed(1)}%
                                          </td>
                                          <td className="p-4 text-right font-mono text-xs text-gray-500">
                                              <span>{cat.endShare.toFixed(1)}%</span>
                                              <span className={`ml-1.5 text-[10px] ${cat.shareShift >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                  ({cat.shareShift >= 0 ? '+' : ''}{cat.shareShift.toFixed(1)}%)
                                              </span>
                                          </td>
                                      </tr>

                                      {isExpanded && cat.assets.map((a, aIdx) => {
                                          const aPos = a.delta >= 0;
                                          const aPct = a.start > 0 ? ((a.delta / a.start) * 100) : (a.end > 0 ? 100 : 0);

                                          return (
                                              <tr key={`asset-${idx}-${aIdx}`} className="bg-slate-50/60 dark:bg-slate-900/40 text-xs">
                                                  <td className="py-2.5 pl-12 pr-4 text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${aPos ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                      <span className="truncate">{a.name}</span>
                                                      {a.class && (
                                                          <span className="text-[9px] bg-gray-200 dark:bg-slate-800 text-gray-500 px-1.5 py-0.5 rounded uppercase">
                                                              {a.class}
                                                          </span>
                                                      )}
                                                  </td>
                                                  <td className="py-2.5 px-4 text-right font-mono text-gray-400">{fCur(a.start)}</td>
                                                  <td className="py-2.5 px-4 text-right font-mono text-gray-700 dark:text-gray-200">{fCur(a.end)}</td>
                                                  <td className={`py-2.5 px-4 text-right font-mono font-medium ${aPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                      {aPos ? '+' : ''}{fCur(a.delta)}
                                                  </td>
                                                  <td className={`py-2.5 px-4 text-right font-mono ${aPos ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                      {a.start > 0 ? `${aPos ? '+' : ''}${aPct.toFixed(1)}%` : '-'}
                                                  </td>
                                                  <td className="py-2.5 px-4 text-right text-gray-400 font-mono">-</td>
                                              </tr>
                                          );
                                      })}
                                  </React.Fragment>
                              );
                          })}

                          <tr className="bg-slate-100/80 dark:bg-slate-800/70 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                              <td className="p-4 text-slate-900 dark:text-white uppercase">{safeT(t, 'totalPortfolioCombined', 'Gesamtportfolio')}</td>
                              <td className="p-4 text-right font-mono text-gray-600 dark:text-gray-300">{fCur(totalStart)}</td>
                              <td className="p-4 text-right font-mono text-slate-900 dark:text-white">{fCur(totalEnd)}</td>
                              <td className={`p-4 text-right font-mono ${totalDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                  {totalDelta >= 0 ? '+' : ''}{fCur(totalDelta)}
                              </td>
                              <td className={`p-4 text-right font-mono ${totalGrowthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                  {totalGrowthPct >= 0 ? '+' : ''}{totalGrowthPct.toFixed(1)}%
                              </td>
                              <td className="p-4 text-right font-mono text-slate-900 dark:text-white">100.0%</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};

module.exports = CategoryFlowReport;