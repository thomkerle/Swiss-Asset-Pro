const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const Icon = require('../Icons.jsx');
const { getTotalWealthAtDate } = require('../../data/DataEngine.jsx');

// WICHTIG: 't' zu den Props hinzugefügt
const ScenariosReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, setModalObj, fCur, t }) => {
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

  return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
          <ReportHeader 
            title={t('repScenFireTitle')} 
            subtitle={t('repScenFireSub')} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
          />
          
          {/* Grid auf 3 Spalten erweitert für die Auswirkungsanalyse */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Spalte 1: Aktueller FIRE Status */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm relative flex flex-col">
                  <Icon 
                    name="Edit" 
                    className="absolute top-4 right-4 text-gray-400 hover:text-blue-500 cursor-pointer" 
                    onClick={() => setModalObj({type:'editGoal'})}
                  />
                  <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">{t('labelFireGoal')}</h3>
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-500">{fCur(data.goals?.fire?.target || 0)}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('labelTargetYear')} {data.goals?.fire?.year || 2040}</div>
                  
                  <div className="flex-grow"></div>
                  
                  <div className="mt-6">
                      <div className="w-full bg-gray-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden">
                          <div className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500" style={{width: `${fireProg}%`}}></div>
                      </div>
                      <div className="text-xs text-right mt-1 text-gray-600 dark:text-gray-400">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{fireProg.toFixed(1)}%</span> {t('labelAchieved')} ({fCur(currentWealth)})
                      </div>
                  </div>
              </div>
              
              {/* Spalte 2: Liste der Szenarien */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm relative">
                  <h3 className="font-bold text-lg mb-4 flex justify-between items-center text-slate-800 dark:text-slate-100">
                      {t('labelFutureScenarios')} 
                      <button 
                          className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" 
                          onClick={() => setModalObj({type:'addScenario'})}
                      >
                          {t('labelBtnNew')}
                      </button>
                  </h3>
                  {scenarios.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic py-4 text-center">Keine Szenarien erfasst.</div>
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

              {/* Spalte 3: Auswirkungsanalyse (Neu) */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm relative flex flex-col">
                  <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">{t('labelImpactAnalysis')}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t('labelProjectedWealth')}: <br/>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{fCur(projectedWealth)}</span>
                  </div>
                  
                  <div className="flex-grow"></div>
                  
                  {/* Visueller Vergleich: Alter Balken + Neue Auswirkungen */}
                  <div className="mt-4">
                      <div className="w-full bg-gray-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden flex">
                          <div className="bg-blue-600 dark:bg-blue-500 h-full" style={{width: `${fireProg}%`}}></div>
                          {isProjectedPositive && totalImpact > 0 && (
                              <div className="bg-green-500 dark:bg-green-400 h-full opacity-80" style={{width: `${projectedProg - fireProg}%`}}></div>
                          )}
                      </div>
                      <div className="text-xs mt-2 flex justify-between">
                          <div className="text-gray-500 dark:text-gray-400">
                              Status Quo: {fireProg.toFixed(1)}%
                          </div>
                          <div className={`font-bold ${isProjectedPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              Projektion: {projectedProg.toFixed(1)}%
                          </div>
                      </div>
                  </div>
              </div>

          </div>
      </div>
  );
};

module.exports = ScenariosReport;