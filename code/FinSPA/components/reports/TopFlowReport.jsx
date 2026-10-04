const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || window.DataEngine || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const TopFlowReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const repTitle = safeT(t, 'repTopFlowTitle', "Top Gewinner & Verlierer");
  const repSub = safeT(t, 'repTopFlowSub', "Absolute und relative Wertveränderung je Asset");

  const getAcName = (ac) => {
    const map = { 
      cash: safeT(t, 'acCashLong', 'Konto / Liquidität'), 
      fund: safeT(t, 'acFundLong', 'Fonds / ETFs'), 
      stock: safeT(t, 'acStockLong', 'Aktie'), 
      crypto: safeT(t, 'acCryptoLong', 'Krypto'), 
      realestate: safeT(t, 'acRealEstateLong', 'Immobilie'), 
      mortgage: safeT(t, 'acMortgageLong', 'Hypothek'), 
      pension_cash: safeT(t, 'acPensionCashLong', 'Pensionskasse'), 
      pension_3a_cash: safeT(t, 'acPension3aCashLong', '3a Sparkonto'), 
      pension_3a_fund: safeT(t, 'acPension3aFundLong', '3a Fonds'),
      pension_3a_managed: safeT(t, 'acPension3aManagedLong', '3a Verwaltet'),
      managed_fund: safeT(t, 'acManagedFundLong', 'Verwaltetes Depot')
    };
    return map[ac] || ac || safeT(t, 'acOtherLong', 'Sonstige');
  };

  const { 
    flows, 
    winners, 
    losers, 
    topWinner, 
    topLoser, 
    totalGained, 
    totalLost,
    netFlow,
    profitFactor,
    classFlows
  } = useMemo(() => {
      let tGained = 0;
      let tLost = 0;
      const classMap = {};

      let calcFlows = (activeAssets || []).map(a => {
          const s = getAssetValueAtDate(a, dateRange?.from || '2000-01-01');
          const e = getAssetValueAtDate(a, dateRange?.to || new Date().toISOString().split('T')[0]);
          const diff = e - s;
          const pct = s > 0 ? (diff / s) * 100 : (e > 0 ? 100 : 0);
          
          if (diff > 0) tGained += diff;
          if (diff < 0) tLost += Math.abs(diff);

          const ac = a.assetClass || 'cash';
          classMap[ac] = (classMap[ac] || 0) + diff;

          return { 
              name: a.name || safeT(t, 'unknown', 'Unbenannt'), 
              class: a.assetClass,
              start: s,
              end: e,
              diff: diff,
              pct: pct,
              isPos: diff >= 0 
          };
      });
      
      calcFlows = calcFlows.filter(f => Math.abs(f.diff) > 0.01).sort((a,b) => b.diff - a.diff);

      const win = calcFlows.filter(f => f.isPos);
      const lose = calcFlows.filter(f => !f.isPos);
      const net = tGained - tLost;
      const pf = tLost > 0 ? (tGained / tLost) : (tGained > 0 ? 99.9 : 0);

      const cFlowsArray = Object.keys(classMap)
          .map(ac => ({
              classKey: ac,
              label: getAcName(ac),
              value: classMap[ac]
          }))
          .filter(c => Math.abs(c.value) > 0.01)
          .sort((a, b) => b.value - a.value);

      return {
          flows: calcFlows,
          winners: win,
          losers: lose,
          topWinner: win.length > 0 ? win[0] : null,
          topLoser: lose.length > 0 ? lose[lose.length - 1] : null,
          totalGained: tGained,
          totalLost: tLost,
          netFlow: net,
          profitFactor: pf,
          classFlows: cFlowsArray
      };
  }, [activeAssets, dateRange, t]);

  const topSplitFlows = useMemo(() => {
      const topWins = winners.slice(0, 5);
      const topLoses = losers.slice(-5);
      return [...topWins, ...topLoses];
  }, [winners, losers]);

  const filteredList = useMemo(() => {
      let list = flows;
      if (activeTab === 'winners') list = winners;
      if (activeTab === 'losers') list = losers;

      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          list = list.filter(f => f.name.toLowerCase().includes(q) || getAcName(f.class).toLowerCase().includes(q));
      }
      return list;
  }, [flows, winners, losers, activeTab, searchQuery]);

  useEffect(() => {
    const buildReportData = async () => {
        const startDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const endDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');

        const kpis = [
            { label: safeT(t, 'kpiTopPerformerGain', 'Top Performer (Gewinn)'), value: topWinner ? topWinner.name : '-', sub: topWinner ? `+${fCur(topWinner.diff)} (+${topWinner.pct.toFixed(1)}%)` : '-', color: '#10b981' },
            { label: safeT(t, 'kpiWeakestPosition', 'Schwächster Posten'), value: topLoser ? topLoser.name : '-', sub: topLoser ? `${fCur(topLoser.diff)} (${topLoser.pct.toFixed(1)}%)` : '-', color: '#ef4444' },
            { label: safeT(t, 'kpiSumGainsVsLosses', 'Summe Gewinne vs. Verluste'), value: `+${fCur(totalGained)}`, sub: safeT(t, 'descLossesSub', 'Verluste: -{val}').replace('{val}', fCur(totalLost)), color: '#3b82f6' },
            { label: safeT(t, 'kpiNetFlowChange', 'Netto-Saldo (Wertveränderung)'), value: `${netFlow >= 0 ? '+' : ''}${fCur(netFlow)}`, sub: safeT(t, 'descProfitFactorShort', 'PF: {pf}').replace('{pf}', profitFactor.toFixed(2)), color: netFlow >= 0 ? '#10b981' : '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colAssetPosition', 'Anlage / Asset'),
            safeT(t, 'category', 'Kategorie'),
            safeT(t, 'startValue', 'Startwert'),
            safeT(t, 'endValue', 'Endwert'),
            safeT(t, 'colChangeCurrency', 'Delta (CHF)').replace('{cur}', 'CHF'),
            safeT(t, 'kpiSavingsRate', 'Performance (%)')
        ];

        const tableBody = flows.map(f => [
            f.name,
            getAcName(f.class),
            fCur(f.start),
            fCur(f.end),
            `${f.diff >= 0 ? '+' : ''}${fCur(f.diff)}`,
            `${f.pct >= 0 ? '+' : ''}${f.pct.toFixed(2)} %`
        ]);

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${safeT(t, 'wordTo', 'bis')} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.30, 0.18, 0.13, 0.13, 0.13, 0.13],
          colAligns: ['left', 'left', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) { 
          console.error("[FinBundle Pro] PDF Export Error im TopFlowReport:", err); 
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 14, 
                    title: repTitle,
                    subtitle: `${new Date(dateRange.from).toLocaleDateString('de-CH')} ${safeT(t, 'wordTo', 'bis')} ${new Date(dateRange.to).toLocaleDateString('de-CH')}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.30, 0.18, 0.13, 0.13, 0.13, 0.13],
                    colAligns: ['left', 'left', 'right', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im TopFlowReport:", err);
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
  }, [flows, dateRange, fCur, t, repTitle, repSub, data, topWinner, topLoser, totalGained, totalLost, netFlow, profitFactor]);

  if (flows.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Activity" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'msgNoMovementsFoundPeriod', 'Keine messbaren Wertveränderungen im gewählten Zeitraum gefunden.')}</p>
        </div>
      </div>
    );
  }

  const baseCur = data?.settings?.baseCurrency || 'CHF';
  const topWinnersChartTitle = safeT(t, 'titleTopWinnersVsLosersChart', 'Top Gewinner & Verlierer ({cur})').replace('{cur}', baseCur);
  const topWinnersPdfTitle = safeT(t, 'titleTopWinnersVsLosersPdf', 'Top Gewinner vs. Verlierer ({cur})').replace('{cur}', baseCur);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="TrendingUp" size={14} className="text-emerald-500"/>
                {safeT(t, 'labelTopPerformerHeader', 'TOP PERFORMER')}
            </div>
            <div className="text-xl xl:text-2xl font-black text-slate-900 dark:text-white truncate" title={topWinner?.name}>
                {topWinner ? topWinner.name : '-'}
            </div>
            <div className="text-xs font-bold mt-2 truncate">
                {topWinner ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                        +{fCur(topWinner.diff)} <span className="opacity-75 font-normal">(+{topWinner.pct.toFixed(1)}%)</span>
                    </span>
                ) : (
                    <span className="text-gray-400">{safeT(t, 'noGains', 'Keine Gewinner')}</span>
                )}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="TrendingDown" size={14} className="text-rose-500"/>
                {safeT(t, 'labelWeakestPositionHeader', 'SCHWÄCHSTER POSTEN')}
            </div>
            <div className="text-xl xl:text-2xl font-black text-slate-900 dark:text-white truncate" title={topLoser?.name}>
                {topLoser ? topLoser.name : '-'}
            </div>
            <div className="text-xs font-bold mt-2 truncate">
                {topLoser ? (
                    <span className="text-rose-600 dark:text-rose-400">
                        {fCur(topLoser.diff)} <span className="opacity-75 font-normal">({topLoser.pct.toFixed(1)}%)</span>
                    </span>
                ) : (
                    <span className="text-gray-400">{safeT(t, 'noLosses', 'Keine Verluste')}</span>
                )}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Activity" size={14} className="text-blue-500" />
                {safeT(t, 'labelGainLossSumHeader', 'GEWINN- / VERLUSTSUMME')}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                +{fCur(totalGained)}
            </div>
            <div className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium">
                {safeT(t, 'descLossesSub', 'Verluste: -{val}').replace('{val}', fCur(totalLost))}
            </div>
         </div>

         <div className={`p-6 border rounded-2xl shadow-sm border-b-4 overflow-hidden ${
             netFlow >= 0 
                ? 'bg-emerald-50/50 dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                : 'bg-rose-50/50 dark:bg-slate-900 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
         }`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                    <Icon name={netFlow >= 0 ? "CheckCircle" : "AlertTriangle"} size={14} className={netFlow >= 0 ? "text-emerald-500" : "text-rose-500"} />
                    <span>{safeT(t, 'labelNetBalanceHeader', 'NETTO-SALDO')}</span>
                </span>
                <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-xs">
                    {safeT(t, 'descProfitFactorShort', 'PF: {pf}').replace('{pf}', profitFactor.toFixed(2))}
                </span>
            </div>
            <div className={`text-2xl font-black truncate ${netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {netFlow >= 0 ? '+' : ''}{fCur(netFlow)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descProfitFactorLong', 'Profit Factor: {pf} (Gewinne/Verluste)').replace('{pf}', profitFactor.toFixed(2))}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        
        <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
            data-pdf-title={topWinnersPdfTitle}
        >
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="BarChart" className="text-blue-500" /> {topWinnersChartTitle}
            </h3>
            <div style={{ width: '100%', height: '340px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    horizontal={true}
                    labels={topSplitFlows.map(f => f.name.length > 22 ? f.name.substring(0, 20) + '...' : f.name)}
                    datasets={[{
                        label: safeT(t, 'valueChange', 'Wertveränderung'),
                        data: topSplitFlows.map(f => f.diff),
                        backgroundColor: topSplitFlows.map(f => f.isPos ? '#10b981' : '#ef4444'),
                        valueFormatter: (val) => `${val > 0 ? '+' : ''}${fCur(val)}`
                    }]}
                    height="100%" 
                />
            </div>
        </div>

        <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
            data-pdf-title={safeT(t, 'titleClassFlowsPdf', 'Wertveränderung nach Anlageklassen')}
        >
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="Layers" className="text-indigo-500" /> {safeT(t, 'titleClassFlowsChart', 'Wertveränderung nach Anlageklasse')}
            </h3>
            <div style={{ width: '100%', height: '340px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    horizontal={true}
                    labels={classFlows.map(c => c.label)}
                    datasets={[{
                        label: safeT(t, 'labelClassBalance', 'Klassen-Saldo'),
                        data: classFlows.map(c => c.value),
                        backgroundColor: classFlows.map(c => c.value >= 0 ? '#3b82f6' : '#f59e0b'),
                        valueFormatter: (val) => `${val > 0 ? '+' : ''}${fCur(val)}`
                    }]}
                    height="100%" 
                />
            </div>
        </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              
              <div className="flex items-center gap-2">
                  <Icon name="List" className="text-slate-500" />
                  <span className="font-bold text-lg text-slate-800 dark:text-slate-200">
                      {safeT(t, 'titleAssetFlowsCount', `Asset-Bewegungen (${filteredList.length} von ${flows.length})`).replace('{filtered}', filteredList.length).replace('{total}', flows.length)}
                  </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                      <button 
                          onClick={() => setActiveTab('all')} 
                          className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-gray-500'}`}
                      >
                          {safeT(t, 'tabAll', 'Alle')} ({flows.length})
                      </button>
                      <button 
                          onClick={() => setActiveTab('winners')} 
                          className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'winners' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-gray-500'}`}
                      >
                          {safeT(t, 'topWinners', 'Gewinner')} ({winners.length})
                      </button>
                      <button 
                          onClick={() => setActiveTab('losers')} 
                          className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'losers' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm font-bold' : 'text-gray-500'}`}
                      >
                          {safeT(t, 'topLosers', 'Verlierer')} ({losers.length})
                      </button>
                  </div>

                  <div className="relative w-full sm:w-48">
                      <input 
                          type="text" 
                          placeholder={safeT(t, 'placeholderFilterAsset', 'Asset filtern...')} 
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full py-1.5 pl-7 pr-3 text-xs border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                      />
                      <div className="absolute left-2 top-2 text-gray-400">
                          <Icon name="Search" size={12} />
                      </div>
                  </div>
              </div>

          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="p-4">{safeT(t, 'colAssetPosition', 'Anlage / Asset')}</th>
                          <th className="p-4">{safeT(t, 'assetClass', 'Anlageklasse')}</th>
                          <th className="p-4 text-right">{safeT(t, 'startValue', 'Startwert')}</th>
                          <th className="p-4 text-right">{safeT(t, 'endValue', 'Endwert')}</th>
                          <th className="p-4 text-right">{safeT(t, 'colChangeCurrency', `Delta (${baseCur})`).replace('{cur}', baseCur)}</th>
                          <th className="p-4 text-right">{safeT(t, 'performanceKPI', 'Performance (%)')}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      {filteredList.map((f, i) => (
                          <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-sans font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${f.isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                  <span className="truncate">{f.name}</span>
                              </td>
                              <td className="p-4 font-sans text-xs text-gray-500 dark:text-gray-400">
                                  <span className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700 uppercase text-[10px]">
                                      {getAcName(f.class)}
                                  </span>
                              </td>
                              <td className="p-4 text-right text-gray-500">{fCur(f.start)}</td>
                              <td className="p-4 text-right font-bold text-slate-800 dark:text-slate-200">{fCur(f.end)}</td>
                              <td className={`p-4 text-right font-bold ${f.isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {f.diff >= 0 ? '+' : ''}{fCur(f.diff)}
                              </td>
                              <td className={`p-4 text-right font-bold ${f.isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {f.pct >= 0 ? '+' : ''}{f.pct.toFixed(2)} %
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

module.exports = TopFlowReport;