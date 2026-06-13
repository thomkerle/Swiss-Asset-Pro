const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader;
const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart;
const { getTotalWealthAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const ScenariosReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, setModalObj, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  // 1. Aktueller Stand
  const currentWealth = getTotalWealthAtDate(activeAssets, dateRange.to);
  const fireTarget = data.goals?.fire?.target || 1;
  const fireProg = Math.min(100, (currentWealth / fireTarget) * 100);

  // 2. Szenarien auswerten (Impact-Berechnung)
  const scenarios = data.scenarios || [];
  const totalImpact = scenarios.reduce((sum, sc) => sum + (Number(sc.impact) || 0), 0);
  
  // 3. Projizierter Stand (Aktuell + Impact)
  const projectedWealth = currentWealth + totalImpact;
  const projectedProg = Math.min(100, (projectedWealth / fireTarget) * 100);
  const isProjectedPositive = totalImpact >= 0;

  // Text-Variablen
  const titleText = t ? (t('repScenFireTitle') || "Szenarien & FIRE Ziel") : "Szenarien & FIRE Ziel";
  const subText = t ? (t('repScenFireSub') || "Auswirkungsanalyse und Projektion") : "Auswirkungsanalyse und Projektion";

  // PDF Export Listener
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(t ? t('scenarioName') || 'Szenario' : 'Szenario'),
          capitalize(t ? t('date') || 'Datum' : 'Datum'),
          capitalize(t ? t('scenarioImpact') || 'Auswirkung' : 'Auswirkung')
        ];

        // Alle Szenarien in die Tabelle
        const tableBody = scenarios.map(sc => [
          sc.name,
          sc.date,
          `${sc.impact >= 0 ? '+' : ''}${fCur(sc.impact)}`
        ]);

        // Eine Total-Zeile unten anhängen
        tableBody.push([
            (t ? t('labelProjectedWealth') || 'TOTAL PROJEKTION' : 'TOTAL PROJEKTION').toUpperCase(), 
            '---', 
            fCur(projectedWealth)
        ]);

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subText} | ${t ? t('labelFireGoal') || 'Ziel' : 'Ziel'}: ${fCur(fireTarget)}`,
          tableHeaders,
          tableBody,
          chartBase64,
	  data: data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im ScenariosReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [scenarios, projectedWealth, fireTarget, fCur, t, titleText, subText]);

  return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
          <ReportHeader 
            title={titleText} 
            subtitle={subText} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
          />
          
          {/* Grid: 3 Spalten für KPI und Listen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Spalte 1: Aktueller FIRE Status */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm relative flex flex-col">
                  <Icon 
                    name="Edit" 
                    size={16}
                    className="absolute top-4 right-4 text-gray-400 hover:text-blue-500 cursor-pointer" 
                    onClick={() => setModalObj({type:'editGoal'})}
                  />
                  <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">{t ? t('labelFireGoal') || 'FIRE Ziel' : 'FIRE Ziel'}</h3>
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-500">{fCur(data.goals?.fire?.target || 0)}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t ? t('labelTargetYear') || 'Zieljahr:' : 'Zieljahr:'} {data.goals?.fire?.year || 2040}</div>
                  
                  <div className="flex-grow"></div>
                  
                  <div className="mt-6">
                      <div className="w-full bg-gray-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden">
                          <div className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500" style={{width: `${fireProg}%`}}></div>
                      </div>
                      <div className="text-xs text-right mt-1 text-gray-600 dark:text-gray-400">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{fireProg.toFixed(1)}%</span> {t ? t('labelAchieved') || 'Erreicht' : 'Erreicht'} ({fCur(currentWealth)})
                      </div>
                  </div>
              </div>
              
              {/* Spalte 2: Liste der Szenarien */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm relative">
                  <h3 className="font-bold text-lg mb-4 flex justify-between items-center text-slate-800 dark:text-slate-100">
                      {t ? t('labelFutureScenarios') || 'Szenarien' : 'Szenarien'} 
                      <button 
                          className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" 
                          onClick={() => setModalObj({type:'addScenario'})}
                      >
                          {t ? t('labelBtnNew') || '+ Neu' : '+ Neu'}
                      </button>
                  </h3>
                  {scenarios.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic py-4 text-center">{t ? t('noScenariosFound') || 'Keine Szenarien erfasst.' : 'Keine Szenarien erfasst.'}</div>
                  ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {scenarios.map(sc => (
                              <div key={sc.id} className="flex justify-between items-center p-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-lg text-sm">
                                  <div>
                                      <strong className="text-slate-700 dark:text-slate-200">{sc.name}</strong> 
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{sc.date}</div>
                                  </div>
                                  <div className={`font-bold ${sc.impact >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {sc.impact >= 0 ? '+' : ''}{fCur(sc.impact)}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {/* Spalte 3: Auswirkungsanalyse */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm relative flex flex-col">
                  <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">{t ? t('labelImpactAnalysis') || 'Impact Analyse' : 'Impact Analyse'}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t ? t('labelProjectedWealth') || 'Prognostiziertes Vermögen' : 'Prognostiziertes Vermögen'}: <br/>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{fCur(projectedWealth)}</span>
                  </div>
                  
                  <div className="flex-grow"></div>
                  
                  {/* Visueller Vergleich der Fortschrittsbalken */}
                  <div className="mt-4">
                      <div className="w-full bg-gray-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden flex">
                          <div className="bg-blue-600 dark:bg-blue-500 h-full" style={{width: `${fireProg}%`}}></div>
                          {isProjectedPositive && totalImpact > 0 && (
                              <div className="bg-green-500 dark:bg-green-400 h-full opacity-80" style={{width: `${projectedProg - fireProg}%`}}></div>
                          )}
                      </div>
                      <div className="text-xs mt-2 flex justify-between">
                          <div className="text-gray-500 dark:text-gray-400">
                              {t ? t('labelStatusQuo') || 'Status Quo:' : 'Status Quo:'} {fireProg.toFixed(1)}%
                          </div>
                          <div className={`font-bold ${isProjectedPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {t ? t('labelProjection') || 'Projektion:' : 'Projektion:'} {projectedProg.toFixed(1)}%
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* NEU: Horizontales Balkendiagramm für PDF und visuelle Übersicht */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mt-8">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                 <Icon name="Activity" className="text-blue-500" /> {t ? t('labelVisualComparison') || 'Visueller Abgleich' : 'Visueller Abgleich'}
              </h3>
              <div ref={chartRef} style={{ width: '100%', height: '220px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="bar"
                      horizontal={true} // Das macht es zu einem super übersichtlichen Progress-Chart
                      labels={[
                          t ? t('labelCurrent') || 'Aktuell' : 'Aktuell', 
                          t ? t('labelProjectedWealth') || 'Projektion' : 'Projektion', 
                          t ? t('labelFireGoal') || 'Ziel (FIRE)' : 'Ziel (FIRE)'
                      ]}
                      datasets={[{
                          label: t ? t('amount') || 'Betrag' : 'Betrag',
                          data: [currentWealth, projectedWealth, fireTarget],
                          // Blau (Aktuell) -> Indigo (Projektion) -> Orange (Ziel)
                          backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b'],
                          valueFormatter: fCur
                      }]}
                      height="100%"
                  />
              </div>
          </div>

      </div>
  );
};

module.exports = ScenariosReport;