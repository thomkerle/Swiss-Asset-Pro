const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader;
const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart;
const { getTotalWealthAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const ScenariosReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, setModalObj, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  // 1. Aktueller Stand
  const currentWealth = getTotalWealthAtDate(activeAssets, dateRange.to);
  const fireTarget = data.goals?.fire?.target || 0;
  const safeFireTarget = Math.max(1, fireTarget); // Verhindert Division durch Null
  const fireProg = Math.min(100, (currentWealth / safeFireTarget) * 100);

  // 2. Szenarien auswerten (Impact-Berechnung)
  const scenarios = data.scenarios || [];
  const totalImpact = scenarios.reduce((sum, sc) => sum + (Number(sc.impact) || 0), 0);
  
  // 3. Projizierter Stand (Aktuell + Impact)
  const projectedWealth = currentWealth + totalImpact;
  const projectedProg = Math.min(100, (projectedWealth / safeFireTarget) * 100);
  const isProjectedPositive = totalImpact >= 0;

  // Text-Variablen
  const titleText = t ? (t('repScenFireTitle') || "Szenarien & FIRE Ziel") : "Szenarien & FIRE Ziel";
  const subText = t ? (t('repScenFireSub') || "Auswirkungsanalyse und Projektion") : "Auswirkungsanalyse und Projektion";

  const loadHtml2Canvas = () => {
    return new Promise((resolve) => {
        if (window.html2canvas) return resolve(window.html2canvas);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve(window.html2canvas);
        document.head.appendChild(script);
    });
  };

  useEffect(() => {
    // Helfer-Funktion für die Datenextraktion
    const buildReportData = async () => {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        // 1. KPI Block
        const kpiBlock = document.querySelector('.kpi-scenarios-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        // 2. Chart Block
        const chartBlock = document.querySelector('.chart-scenarios-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: t ? t('titleProgressProjection') || 'Fortschritt & Projektion' : 'Fortschritt & Projektion', image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
        }

        // 3. Tabellendaten generieren
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(t ? t('scenarioName') || 'Szenario / Ereignis' : 'Szenario / Ereignis'),
          capitalize(t ? t('date') || 'Stichtag' : 'Stichtag'),
          capitalize(t ? t('scenarioImpact') || 'Auswirkung auf Vermögen' : 'Auswirkung auf Vermögen')
        ];

        const tableBody = scenarios.map(sc => [
          sc.name,
          new Date(sc.date).toLocaleDateString('de-CH'),
          `${sc.impact >= 0 ? '+' : ''}${fCur(sc.impact)}`
        ]);

        if (scenarios.length > 0) {
            tableBody.push(['', '', '']);
        }
        
        tableBody.push([
            (t ? t('labelProjectedWealth') || 'TOTAL PROJEKTION' : 'TOTAL PROJEKTION').toUpperCase(), 
            '---', 
            fCur(projectedWealth)
        ]);

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subText} | ${t ? t('labelFireGoal') || 'Ziel' : 'Ziel'}: ${fCur(fireTarget)}`,
          tableHeaders,
          tableBody,
          chartsData,
          data: data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im ScenariosReport:", err);
      }
    };

    // --- NEU: BATCH EXPORT (ORCHESTRATOR) ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 11, // Passende Reihenfolge im Gesamtreport
                    title: titleText,
                    subtitle: `${subText} | ${t ? t('labelFireGoal') || 'Ziel' : 'Ziel'}: ${fCur(fireTarget)}`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im ScenariosReport:", err);
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
  }, [scenarios, projectedWealth, fireTarget, fCur, t, titleText, subText, data]);

  return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
          <ReportHeader 
            title={titleText} 
            subtitle={subText} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
          />

          <div className="w-full bg-white dark:bg-transparent">
              
              {/* KPI DASHBOARD ROW */}
              <div className="kpi-scenarios-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
                 
                 {/* KPI 1: Aktueller Stand */}
                 <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Database" size={14} className="text-slate-500"/>
                        {t ? t('labelStatusQuo') || 'Status Quo' : 'Status Quo'}
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {fCur(currentWealth)}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                        {t ? t('descCurrentTotalWealth') || 'Aktuelles Gesamtvermögen' : 'Aktuelles Gesamtvermögen'}
                    </div>
                 </div>

                 {/* KPI 2: FIRE Ziel */}
                 <div className="bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Icon name="Target" size={48} className="text-amber-500" />
                    </div>
                    <Icon 
                        name="Edit" 
                        size={14}
                        className="absolute top-4 right-4 text-amber-600/50 hover:text-amber-600 dark:text-amber-400/50 dark:hover:text-amber-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => setModalObj({type:'editGoal'})}
                        title={t ? t('tooltipEditGoal') || 'Ziel bearbeiten' : 'Ziel bearbeiten'}
                    />
                    <div className="text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                        <Icon name="Star" size={14} />
                        {t ? t('labelFireGoal') || 'FIRE Ziel' : 'FIRE Ziel'}
                    </div>
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-400 relative z-10">
                        {fCur(fireTarget)}
                    </div>
                    <div className="text-xs font-medium mt-2 relative z-10 text-amber-700/70 dark:text-amber-500/70">
                        {t ? t('labelTargetYear') || 'Zieljahr:' : 'Zieljahr:'} {data.goals?.fire?.year || '-'}
                    </div>
                 </div>

                 {/* KPI 3: Szenarien Impact */}
                 <div className={`p-6 rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                     isProjectedPositive 
                        ? 'bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 border-b-emerald-500' 
                        : 'bg-rose-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 border-b-rose-500'
                 }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Icon name="Activity" size={48} className={isProjectedPositive ? "text-emerald-500" : "text-rose-500"} />
                    </div>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 ${isProjectedPositive ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                        <Icon name={isProjectedPositive ? "TrendingUp" : "TrendingDown"} size={14} />
                        {t ? t('labelTotalImpact') || 'Gesamtauswirkung' : 'Gesamtauswirkung'}
                    </div>
                    <div className={`text-2xl font-black relative z-10 ${isProjectedPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {totalImpact > 0 ? '+' : ''}{fCur(totalImpact)}
                    </div>
                    <div className={`text-xs font-medium mt-2 relative z-10 ${isProjectedPositive ? 'text-emerald-700/70 dark:text-emerald-500/70' : 'text-rose-700/70 dark:text-rose-500/70'}`}>
                        {t ? t('descScenariosCount_1') || 'Aus ' : 'Aus '}{scenarios.length}{t ? t('descScenariosCount_2') || ' geplanten Szenarien' : ' geplanten Szenarien'}
                    </div>
                 </div>

                 {/* KPI 4: Projektion */}
                 <div className="bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-indigo-600 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Icon name="Layers" size={48} className="text-indigo-600" />
                    </div>
                    <div className="text-indigo-800 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                        <Icon name="Wind" size={14} />
                        {t ? t('labelProjectedWealth') || 'Projektion' : 'Projektion'}
                    </div>
                    <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 relative z-10">
                        {fCur(projectedWealth)}
                    </div>
                    <div className="text-xs font-medium mt-2 relative z-10 text-indigo-700/70 dark:text-indigo-500/70">
                        {projectedProg.toFixed(1)}{t ? t('descFireGoalPct') || '% des FIRE Ziels' : '% des FIRE Ziels'}
                    </div>
                 </div>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                
                {/* LINKE SEITE: Visualisierung & Chart */}
                <div className="lg:col-span-7 space-y-6">
                    
                    {/* Fortschrittsvisualisierung */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Icon name="Target" className="text-amber-500" />
                                {t ? t('titleGoalAchievementImpact') || 'Zielerreichung & Impact' : 'Zielerreichung & Impact'}
                            </span>
                            <span className="text-sm font-mono text-gray-500">{t ? t('labelFireGoal') || 'Ziel' : 'Ziel'}: {fCur(fireTarget)}</span>
                        </h3>
                        
                        <div className="mt-8 mb-4 relative">
                            {/* Marker für 100% */}
                            <div className="absolute right-0 top -top-6 bottom-0 border-r-2 border-dashed border-amber-300 dark:border-amber-700/50 z-0"></div>
                            
                            <div className="w-full bg-gray-100 dark:bg-slate-800 h-6 rounded-full overflow-hidden flex relative z-10 shadow-inner">
                                <div className="bg-blue-500 h-full transition-all duration-1000" style={{width: `${fireProg}%`}} title={`${t ? t('labelCurrentStatus') || 'Aktuell:' : 'Aktuell:'} ${fireProg.toFixed(1)}%`}></div>
                                
                                {isProjectedPositive && totalImpact > 0 && (
                                    <div className="bg-emerald-400 dark:bg-emerald-500 h-full transition-all duration-1000 opacity-90 striped-bg" style={{width: `${projectedProg - fireProg}%`}} title={`${t ? t('labelProjection') || 'Projektion:' : 'Projektion:'} +${(projectedProg - fireProg).toFixed(1)}%`}></div>
                                )}
                                {!isProjectedPositive && totalImpact < 0 && (
                                    <div className="bg-rose-500 h-full transition-all duration-1000 opacity-90 striped-bg" style={{width: `${fireProg - projectedProg}%`, marginLeft: `-${fireProg - projectedProg}%`}} title={`${t ? t('labelSetback') || 'Rückschlag:' : 'Rückschlag:'} -${(fireProg - projectedProg).toFixed(1)}%`}></div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-sm mt-4">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <div className="w-3 h-3 rounded bg-blue-500"></div>
                                <span>{t ? t('labelStatusQuo') || 'Status Quo:' : 'Status Quo:'} <strong>{fireProg.toFixed(1)}%</strong></span>
                            </div>
                            {totalImpact !== 0 && (
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded ${isProjectedPositive ? 'bg-emerald-400' : 'bg-rose-500'}`}></div>
                                    <span className={isProjectedPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                        {t ? t('labelProjection') || 'Projektion:' : 'Projektion:'} <strong>{projectedProg.toFixed(1)}%</strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-scenarios-export-block">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Icon name="BarChart" className="text-indigo-500" /> {t ? t('labelVisualComparison') || 'Visueller Abgleich' : 'Visueller Abgleich'}
                        </h3>
                        <div ref={chartRef} style={{ width: '100%', height: '280px' }}>
                            <UniversalChart 
                                engine={activeChartEngine}
                                type="bar"
                                horizontal={true} 
                                labels={[
                                    t ? t('labelCurrent') || 'Aktuell' : 'Aktuell', 
                                    t ? t('labelProjectedWealth') || 'Projektion' : 'Projektion', 
                                    t ? t('labelFireGoal') || 'FIRE Ziel' : 'FIRE Ziel'
                                ]}
                                datasets={[{
                                    label: t ? t('amount') || 'Betrag' : 'Betrag',
                                    data: [currentWealth, projectedWealth, fireTarget],
                                    backgroundColor: ['#3b82f6', '#6366f1', '#f59e0b'],
                                    valueFormatter: fCur
                                }]}
                                height="100%"
                            />
                        </div>
                    </div>

                </div>

                {/* RECHTE SEITE: Szenarien Liste */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Icon name="List" className="text-slate-500" />
                                {t ? t('labelFutureScenarios') || 'Geplante Szenarien' : 'Geplante Szenarien'}
                            </div>
                            <button 
                                className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors flex items-center gap-1" 
                                onClick={() => setModalObj({type:'addScenario'})}
                            >
                                <Icon name="Plus" size={12} /> {t ? t('labelBtnNew') || 'Neu' : 'Neu'}
                            </button>
                        </div>
                        
                        <div className="p-0 flex-1">
                            {scenarios.length === 0 ? (
                                <div className="p-10 flex flex-col items-center justify-center text-center text-gray-400 h-full">
                                    <Icon name="Wind" size={48} className="mb-4 opacity-30"/>
                                    <p>{t ? t('noScenariosFound') || 'Noch keine zukünftigen Ereignisse geplant.' : 'Noch keine zukünftigen Ereignisse geplant.'}</p>
                                    <p className="text-xs mt-2">{t ? t('descNoScenariosHint') || 'Füge Erbschaften, Immobilienkäufe oder Auszahlungen hinzu, um deren Impact zu testen.' : 'Füge Erbschaften, Immobilienkäufe oder Auszahlungen hinzu, um deren Impact zu testen.'}</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {scenarios.map((sc, i) => {
                                            const isPos = sc.impact >= 0;
                                            return (
                                                <tr key={sc.id || i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="p-4 pl-5 w-full">
                                                        <div className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${isPos ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                            {sc.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4 flex items-center gap-1">
                                                            <Icon name="Calendar" size={10}/> {new Date(sc.date).toLocaleDateString('de-CH')}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 pr-5 text-right align-middle">
                                                        <span className={`font-mono font-bold px-2 py-1 rounded ${isPos ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20'}`}>
                                                            {isPos ? '+' : ''}{fCur(sc.impact)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        {/* Summary Footer */}
                        {scenarios.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">
                                    {t ? t('labelTotalImpactEnglish') || 'Total Impact' : 'Total Impact'}
                                </span>
                                <span className={`font-mono font-black ${isProjectedPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {isProjectedPositive ? '+' : ''}{fCur(totalImpact)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

              </div>
          </div>
          
          {/* CSS für die gestreifte Progress-Bar */}
          <style dangerouslySetInnerHTML={{__html: `
            .striped-bg {
                background-image: linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent);
                background-size: 1rem 1rem;
            }
          `}} />
      </div>
  );
};

module.exports = ScenariosReport;