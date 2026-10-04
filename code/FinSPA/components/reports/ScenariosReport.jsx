const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader;
const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart;
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const { getTotalWealthAtDate = () => 0 } = DataEngine;

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const ScenariosReport = ({ data, updateTreeData, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const [editGoalModal, setEditGoalModal] = useState(false);
  const [goalTarget, setGoalTarget] = useState(data?.goals?.fire?.target || 0);
  const [goalYear, setGoalYear] = useState(data?.goals?.fire?.year || new Date().getFullYear());

  const [scenarioModal, setScenarioModal] = useState(null);

  const reportDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const currentWealth = getTotalWealthAtDate(activeAssets, reportDate);
  const fireTarget = data?.goals?.fire?.target || 0;
  const targetYear = data?.goals?.fire?.year || '-';

  const fireProg = fireTarget > 0 ? Math.min(100, (currentWealth / fireTarget) * 100) : 0;

  const { 
    sortedScenarios, 
    totalImpact, 
    projectedWealth, 
    projectedProg, 
    remainingGap,
    isProjectedPositive,
    timelineLabels,
    timelineWealthData,
    timelineTargetData
  } = useMemo(() => {
    const rawScenarios = [...(data?.scenarios || [])];
    
    rawScenarios.sort((a, b) => new Date(a.date) - new Date(b.date));

    let impactSum = 0;
    let runningWealth = currentWealth;

    const tLabels = [safeT(t, 'labelCurrent', 'Heute')];
    const tWealth = [currentWealth];
    const tTarget = [fireTarget];

    const processed = rawScenarios.map((sc, idx) => {
        const val = Number(sc.impact || 0);
        impactSum += val;
        runningWealth += val;
        const prog = fireTarget > 0 ? (runningWealth / fireTarget) * 100 : 0;

        tLabels.push(sc.name.length > 18 ? sc.name.substring(0, 16) + '...' : sc.name);
        tWealth.push(runningWealth);
        tTarget.push(fireTarget);

        return {
            ...sc,
            index: idx,
            numericImpact: val,
            cumulativeWealth: runningWealth,
            progress: prog
        };
    });

    const pWealth = currentWealth + impactSum;
    const pProg = fireTarget > 0 ? (pWealth / fireTarget) * 100 : 0;
    const gap = Math.max(0, fireTarget - pWealth);

    return {
        sortedScenarios: processed,
        totalImpact: impactSum,
        projectedWealth: pWealth,
        projectedProg: pProg,
        remainingGap: gap,
        isProjectedPositive: impactSum >= 0,
        timelineLabels: tLabels,
        timelineWealthData: tWealth,
        timelineTargetData: tTarget
    };
  }, [data?.scenarios, currentWealth, fireTarget, t]);

  const repTitle = safeT(t, 'repScenFireTitle', "Szenarien & FIRE");
  const repSub = `${safeT(t, 'labelStatusQuo', 'Status Quo:')} ${fCur(currentWealth)} | ${safeT(t, 'labelFireGoal', 'Ziel:')} ${fCur(fireTarget)} (${safeT(t, 'labelTargetYear', 'Zieljahr:')} ${targetYear})`;

  const saveGoal = () => {
      const valTarget = Number(goalTarget);
      const valYear = Number(goalYear);
      if (!isNaN(valTarget) && valTarget >= 0) {
          const newGoals = {
              ...data.goals,
              fire: { ...data.goals?.fire, target: valTarget, year: valYear }
          };
          if (updateTreeData) updateTreeData({ goals: newGoals });
      }
      setEditGoalModal(false);
  };

  const saveScenario = () => {
      const currentList = [...(data?.scenarios || [])];
      const scData = {
          name: scenarioModal.name,
          date: scenarioModal.date,
          impact: Number(scenarioModal.impact) || 0
      };
      
      if (scenarioModal.isNew) {
          currentList.push(scData);
      } else {
          currentList[scenarioModal.index] = scData;
      }
      
      if (updateTreeData) updateTreeData({ scenarios: currentList });
      setScenarioModal(null);
  };

  const handleDeleteScenario = (index) => {
      if (window.confirm(safeT(t, 'confirmDeleteScenario', 'Möchten Sie dieses Szenario wirklich löschen?'))) {
          const currentList = [...(data?.scenarios || [])];
          currentList.splice(index, 1);
          if (updateTreeData) updateTreeData({ scenarios: currentList });
      }
  };

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'labelStatusQuoTodayHeader', 'Status Quo (Heute)'), value: fCur(currentWealth), sub: safeT(t, 'descFireGoalPct', `${fireProg.toFixed(1)}% des FIRE-Ziels`).replace('%', `${fireProg.toFixed(1)}%`), color: '#2563eb' },
            { label: safeT(t, 'labelFireGoal', 'FIRE Sparziel'), value: fCur(fireTarget), sub: `${safeT(t, 'labelTargetYear', 'Zieljahr:')} ${targetYear}`, color: '#f59e0b' },
            { label: safeT(t, 'kpiNetScenarioEffect', 'Netto-Szenarieneffekt'), value: `${totalImpact >= 0 ? '+' : ''}${fCur(totalImpact)}`, sub: safeT(t, 'descPlannedEventsCountKpi', `${sortedScenarios.length} Ereignisse geplant`).replace('{count}', sortedScenarios.length), color: totalImpact >= 0 ? '#10b981' : '#ef4444' },
            { label: safeT(t, 'kpiProjectedStand', 'Projizierter Stand'), value: fCur(projectedWealth), sub: safeT(t, 'descTargetAchievedWithGap', `Zielerreichung: ${projectedProg.toFixed(1)}% (Rest: ${fCur(remainingGap)})`).replace('{pct}', projectedProg.toFixed(1)).replace('{val}', fCur(remainingGap)), color: '#8b5cf6' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'scenarioName', 'Szenario Name'),
            safeT(t, 'scenarioDate', 'Datum'),
            safeT(t, 'scenarioImpactAmount', 'Auswirkung (+/-)'),
            safeT(t, 'labelProjectedWealth', 'Projiziertes Vermögen'),
            safeT(t, 'titleGoalAchievementImpact', 'Zielerreichung')
        ];

        const tableBody = sortedScenarios.map(sc => [
            sc.name,
            new Date(sc.date).toLocaleDateString('de-CH'),
            `${sc.numericImpact >= 0 ? '+' : ''}${fCur(sc.numericImpact)}`,
            fCur(sc.cumulativeWealth),
            `${sc.progress.toFixed(1)}%`
        ]);

        tableBody.push([
            { text: safeT(t, 'labelTotalProjAfterScenariosPdf', 'TOTAL PROJEKTION NACH SZENARIEN'), bold: true },
            '---',
            { text: `${totalImpact >= 0 ? '+' : ''}${fCur(totalImpact)}`, bold: true, color: totalImpact >= 0 ? '#10b981' : '#ef4444' },
            { text: fCur(projectedWealth), bold: true, color: '#2563eb' },
            { text: `${projectedProg.toFixed(1)}%`, bold: true, color: '#8b5cf6' }
        ]);

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: `${repSub} | ${safeT(t, 'statusAsOf', 'Stand per')} ${new Date(reportDate).toLocaleDateString('de-CH')}`,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.32, 0.16, 0.18, 0.20, 0.14],
          colAligns: ['left', 'center', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im ScenariosReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 11, 
                    title: repTitle,
                    subtitle: `${repSub} | ${safeT(t, 'statusAsOf', 'Stand per')} ${new Date(reportDate).toLocaleDateString('de-CH')}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.32, 0.16, 0.18, 0.20, 0.14],
                    colAligns: ['left', 'center', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im ScenariosReport:", err);
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
  }, [sortedScenarios, projectedWealth, fireTarget, currentWealth, totalImpact, projectedProg, remainingGap, reportDate, fCur, data, repTitle, repSub, t]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
           
           <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Icon name="Database" size={14} className="text-blue-500"/>
                  {safeT(t, 'labelStatusQuoTodayHeader', 'STATUS QUO (HEUTE)')}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                  {fCur(currentWealth)}
              </div>
              <div className="text-xs text-gray-400 mt-2 truncate">
                  {safeT(t, 'descFireGoalReachedPercent', `${fireProg.toFixed(1)}% des Ziels erreicht`).replace('{pct}', fireProg.toFixed(1))}
              </div>
           </div>

           <div className="bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-2">
                  <div className="text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <Icon name="Target" size={14} className="text-amber-500" />
                      {safeT(t, 'labelFireGoalHeader', 'FIRE ZIEL')}
                  </div>
                  <button 
                      onClick={() => {
                          setGoalTarget(data?.goals?.fire?.target || 0);
                          setGoalYear(data?.goals?.fire?.year || new Date().getFullYear());
                          setEditGoalModal(true);
                      }}
                      className="p-1 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors"
                      title={safeT(t, 'tooltipAdjustGoal', 'Ziel anpassen')}
                  >
                      <Icon name="Edit" size={14} />
                  </button>
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 truncate">
                  {fCur(fireTarget)}
              </div>
              <div className="text-xs font-medium text-amber-700/70 dark:text-amber-500/70 mt-2 truncate">
                  {safeT(t, 'labelTargetYear', 'Zieljahr:')} {targetYear}
              </div>
           </div>

           <div className={`p-6 border rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
               isProjectedPositive 
                  ? 'bg-emerald-50/50 dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                  : 'bg-rose-50/50 dark:bg-slate-900 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
           }`}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Icon name={isProjectedPositive ? "TrendingUp" : "TrendingDown"} size={14} className={isProjectedPositive ? "text-emerald-500" : "text-rose-500"} />
                  {safeT(t, 'labelNetScenarioEffectHeader', 'NETTO-SZENARIENEFFEKT')}
              </div>
              <div className={`text-2xl font-black truncate ${isProjectedPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {totalImpact > 0 ? '+' : ''}{fCur(totalImpact)}
              </div>
              <div className="text-xs text-gray-400 mt-2 truncate">
                  {safeT(t, 'descPlannedEventsCount', `Aus ${sortedScenarios.length} geplanten Ereignissen`).replace('{count}', sortedScenarios.length)}
              </div>
           </div>

           <div className="bg-indigo-50/50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-indigo-600 overflow-hidden">
              <div className="text-indigo-800 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Icon name="Layers" size={14} className="text-indigo-600"/>
                  {safeT(t, 'labelProjectedWealthHeader', 'PROJIZIERTER ENDSTAND')}
              </div>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 truncate">
                  {fCur(projectedWealth)}
              </div>
              <div className="text-xs font-medium text-indigo-600/70 dark:text-indigo-400/70 mt-2 truncate">
                  {safeT(t, 'descTargetAchievedWithGap', `Zielerreichung: ${projectedProg.toFixed(1)}% (Rest: ${fCur(remainingGap)})`).replace('{pct}', projectedProg.toFixed(1)).replace('{val}', fCur(remainingGap))}
              </div>
           </div>

        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-10">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Icon name="Target" className="text-amber-500" />
                    {safeT(t, 'titleFireGoalProgress', `Fortschritt zum FIRE-Ziel (${fCur(fireTarget)})`).replace('{val}', fCur(fireTarget))}
                </span>
                <span className="text-sm font-mono text-gray-500">
                    {safeT(t, 'labelTargetYear', 'Zieljahr:')} {targetYear}
                </span>
            </h3>
            
            <div className="mt-6 mb-3 relative">
                <div className="w-full bg-gray-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden flex relative z-10 shadow-inner">
                    <div 
                        className="bg-blue-500 h-full transition-all duration-700" 
                        style={{ width: `${Math.min(100, fireProg)}%` }} 
                        title={`${safeT(t, 'labelStatusQuo', 'Status Quo:')} ${fireProg.toFixed(1)}%`}
                    ></div>
                    
                    {isProjectedPositive && totalImpact > 0 && (
                        <div 
                            className="bg-emerald-500 h-full transition-all duration-700 opacity-90" 
                            style={{ width: `${Math.min(100 - fireProg, Math.max(0, projectedProg - fireProg))}%` }} 
                            title={safeT(t, 'tooltipScenarioGain', `Szenarien-Zuwachs: +${(projectedProg - fireProg).toFixed(1)}%`).replace('{pct}', (projectedProg - fireProg).toFixed(1))}
                        ></div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center text-xs mt-3 gap-3">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span>{safeT(t, 'labelStatusQuo', 'Status Quo:')} <strong>{fCur(currentWealth)}</strong> ({fireProg.toFixed(1)}%)</span>
                </div>
                {totalImpact !== 0 && (
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${isProjectedPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className={isProjectedPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                            {safeT(t, 'labelAfterScenarios', 'Nach Szenarien:')} <strong>{fCur(projectedWealth)}</strong> ({projectedProg.toFixed(1)}%)
                        </span>
                    </div>
                )}
                <div className="font-mono text-slate-500">
                    {safeT(t, 'labelRemainingGapAmount', 'Fehlbetrag:')} <strong>{fCur(remainingGap)}</strong>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
          
          <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8" data-pdf-title={safeT(t, 'titleComparisonWealthGoal', 'Abgleich Vermögen & Ziel')}>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Icon name="BarChart" className="text-blue-500" /> {safeT(t, 'titleComparisonWealthGoal', 'Abgleich Vermögen & Ziel')}
              </h3>
              <div style={{ width: '100%', height: '320px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="bar"
                      horizontal={true} 
                      labels={[safeT(t, 'labelCurrentToday', 'Aktuell (Heute)'), safeT(t, 'labelAfterScenariosBar', 'Nach Szenarien'), safeT(t, 'labelFireGoalBar', 'FIRE-Ziel')]}
                      datasets={[{
                          label: safeT(t, 'amount', 'Betrag'),
                          data: [currentWealth, projectedWealth, fireTarget],
                          backgroundColor: ['#2563eb', '#8b5cf6', '#f59e0b'],
                          valueFormatter: fCur
                      }]}
                      height="100%"
                  />
              </div>
          </div>

          <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleWealthPathScenariosPdf', 'Vermögenspfad über Szenarien')}>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Icon name="TrendingUp" className="text-emerald-500" /> {safeT(t, 'titleWealthPathPlannedEvents', 'Vermögenspfad über geplante Ereignisse')}
              </h3>
              <div style={{ width: '100%', height: '320px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="line"
                      labels={timelineLabels}
                      datasets={[
                          {
                              name: safeT(t, 'kpiProjectedStand', 'Projizierter Stand'),
                              data: timelineWealthData,
                              backgroundColor: '#2563eb',
                              valueFormatter: fCur
                          },
                          {
                              name: safeT(t, 'labelFireGoal', 'FIRE Zielvorgabe'),
                              data: timelineTargetData,
                              backgroundColor: '#f59e0b',
                              valueFormatter: fCur
                          }
                      ]}
                      height="100%"
                  />
              </div>
          </div>

        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                <div className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Icon name="List" className="text-slate-500" />
                    {safeT(t, 'titlePlannedEventsAndScenarios', `Geplante Ereignisse & Szenarien (${sortedScenarios.length})`).replace('{count}', sortedScenarios.length)}
                </div>
                <button 
                    className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm" 
                    onClick={() => setScenarioModal({ isNew: true, name: '', date: new Date().toISOString().split('T')[0], impact: 0 })}
                >
                    <Icon name="Plus" size={14} /> {safeT(t, 'btnNewScenario', 'Neues Szenario')}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold">
                        <tr>
                            <th className="p-4">{safeT(t, 'scenarioName', 'Szenario / Ereignis')}</th>
                            <th className="p-4 text-center">{safeT(t, 'scenarioDate', 'Stichtag')}</th>
                            <th className="p-4 text-right">{safeT(t, 'scenarioImpactAmount', 'Cashflow (+/-)')}</th>
                            <th className="p-4 text-right">{safeT(t, 'labelProjectedWealth', 'Projiziertes Vermögen')}</th>
                            <th className="p-4 text-right">{safeT(t, 'titleGoalAchievementImpact', 'Zielerreichung')}</th>
                            <th className="p-4 text-center print-hide">{safeT(t, 'colActions', 'Aktionen')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                        
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20 font-bold">
                            <td className="p-4 font-sans text-slate-900 dark:text-white flex items-center gap-2">
                                <Icon name="Database" size={14} className="text-blue-500"/>
                                {safeT(t, 'msTodayStatusQuo', 'Status Quo (Heute)')}
                            </td>
                            <td className="p-4 text-center text-gray-500">{new Date(reportDate).toLocaleDateString('de-CH')}</td>
                            <td className="p-4 text-right text-gray-400">-</td>
                            <td className="p-4 text-right font-black text-slate-900 dark:text-white">{fCur(currentWealth)}</td>
                            <td className="p-4 text-right text-blue-600 dark:text-blue-400">{fireProg.toFixed(1)}%</td>
                            <td className="p-4 text-center text-gray-400 print-hide">-</td>
                        </tr>

                        {sortedScenarios.map((sc) => {
                            const isPos = sc.numericImpact >= 0;
                            return (
                                <tr key={sc.index} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-sans font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                        {sc.name}
                                    </td>
                                    <td className="p-4 text-center text-gray-500 font-sans text-xs">
                                        {new Date(sc.date).toLocaleDateString('de-CH')}
                                    </td>
                                    <td className={`p-4 text-right font-bold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {isPos ? '+' : ''}{fCur(sc.numericImpact)}
                                    </td>
                                    <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                                        {fCur(sc.cumulativeWealth)}
                                    </td>
                                    <td className="p-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                        {sc.progress.toFixed(1)}%
                                    </td>
                                    <td className="p-4 text-center font-sans print-hide">
                                        <div className="flex justify-center items-center gap-2">
                                            <button 
                                                onClick={() => setScenarioModal({ isNew: false, index: sc.index, name: sc.name, date: sc.date, impact: sc.numericImpact })} 
                                                className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                title={safeT(t, 'btnEdit', 'Bearbeiten')}
                                            >
                                                <Icon name="Edit" size={15} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteScenario(sc.index)} 
                                                className="text-gray-400 hover:text-rose-500 transition-colors p-1"
                                                title={safeT(t, 'btnDelete', 'Löschen')}
                                            >
                                                <Icon name="Trash" size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        <tr className="bg-indigo-50/60 dark:bg-slate-800/80 font-bold border-t-2 border-indigo-500">
                            <td className="p-4 font-sans text-indigo-900 dark:text-white uppercase">
                                {safeT(t, 'labelProjectedEndWealthRow', 'PROJIZIERTES ENDVERMÖGEN')}
                            </td>
                            <td className="p-4 text-center font-sans text-xs text-gray-500">{safeT(t, 'descAfterAllScenarios', 'Nach allen Szenarien')}</td>
                            <td className={`p-4 text-right font-black ${totalImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                {totalImpact >= 0 ? '+' : ''}{fCur(totalImpact)}
                            </td>
                            <td className="p-4 text-right font-black text-lg text-indigo-700 dark:text-indigo-400">
                                {fCur(projectedWealth)}
                            </td>
                            <td className="p-4 text-right font-black text-indigo-700 dark:text-indigo-400">
                                {projectedProg.toFixed(1)}%
                            </td>
                            <td className="p-4 text-center print-hide">-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {editGoalModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="Target" className="text-blue-500" />
                            {safeT(t, 'modalEditFireGoalTitle', 'FIRE Ziel anpassen')}
                        </h3>
                        <button onClick={() => setEditGoalModal(false)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                            <Icon name="X" size={20}/>
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{safeT(t, 'labelTargetAmountInput', 'Ziel-Betrag')}</label>
                            <input 
                                type="number" 
                                value={goalTarget} 
                                onChange={e => setGoalTarget(e.target.value)} 
                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-mono" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{safeT(t, 'labelTargetYearInput', 'Ziel-Jahr')}</label>
                            <input 
                                type="number" 
                                value={goalYear} 
                                onChange={e => setGoalYear(e.target.value)} 
                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-mono" 
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 flex justify-end gap-3">
                        <button onClick={() => setEditGoalModal(false)} className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors">
                            {safeT(t, 'btnCancel', 'Abbrechen')}
                        </button>
                        <button onClick={saveGoal} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm">
                            {safeT(t, 'btnSave', 'Speichern')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {scenarioModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="Activity" className="text-emerald-500" />
                            {scenarioModal.isNew ? safeT(t, 'btnNewScenario', 'Neues Szenario') : safeT(t, 'modalScenarioEditTitle', 'Szenario bearbeiten')}
                        </h3>
                        <button onClick={() => setScenarioModal(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                            <Icon name="X" size={20}/>
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{safeT(t, 'labelScenarioDesignationInput', 'Bezeichnung')}</label>
                            <input 
                                type="text" 
                                value={scenarioModal.name} 
                                onChange={e => setScenarioModal({...scenarioModal, name: e.target.value})} 
                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100" 
                                placeholder={safeT(t, 'placeholderScenarioExample', 'z.B. Erbschaft oder Liegenschaftskauf')} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{safeT(t, 'scenarioDate', 'Datum / Stichtag')}</label>
                            <input 
                                type="date" 
                                value={scenarioModal.date} 
                                onChange={e => setScenarioModal({...scenarioModal, date: e.target.value})} 
                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-mono" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{safeT(t, 'labelScenarioImpactAmountInput', 'Auswirkung (+ oder -)')}</label>
                            <input 
                                type="number" 
                                value={scenarioModal.impact} 
                                onChange={e => setScenarioModal({...scenarioModal, impact: e.target.value})} 
                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-mono" 
                                placeholder={safeT(t, 'placeholderScenarioAmountExample', 'z.B. 50000 oder -25000')} 
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 flex justify-end gap-3">
                        <button onClick={() => setScenarioModal(null)} className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors">
                            {safeT(t, 'btnCancel', 'Abbrechen')}
                        </button>
                        <button onClick={saveScenario} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm">
                            {safeT(t, 'btnSave', 'Speichern')}
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

module.exports = ScenariosReport;