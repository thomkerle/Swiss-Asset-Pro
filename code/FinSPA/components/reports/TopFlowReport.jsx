const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;

const TopFlowReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  // 1. Alle Flows berechnen
  let flows = activeAssets.map(a => {
      const s = getAssetValueAtDate(a, dateRange?.from || '2000-01-01');
      const e = getAssetValueAtDate(a, dateRange?.to || new Date().toISOString().split('T')[0]);
      return { label: a.name, value: e - s, valLabel: fCur(e-s), isPos: (e-s) >= 0 };
  });
  
  // 2. Filtere Null-Werte heraus (uninteressant für Flow) und sortiere: Grösster Gewinn oben, tiefster Verlust unten
  flows = flows.filter(f => Math.abs(f.value) > 0.01).sort((a,b) => b.value - a.value);

  // 3. Finde den absoluten Maximalwert für die prozentuale Skalierung der Balkenbreite
  const maxAbs = Math.max(...flows.map(f => Math.abs(f.value)), 1); // 1 verhindert Division durch 0

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t('repTopFlowTitle')} 
        subtitle={t('repTopFlowSub')} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
         {flows.length === 0 ? (
             <div className="text-center text-gray-500 py-10">{t('noFlowsFound')}</div>
         ) : (
             <div className="flex flex-col gap-1">
                {/* Tabellen-Kopf */}
                <div className="flex text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-slate-700 pb-2">
                    <div className="w-1/3 pr-4 text-right">{t('labelAsset')}</div>
                    <div className="w-2/3 flex">
                        <div className="w-1/2 text-right pr-2">{t('labelLoss')}</div>
                        <div className="w-1/2 text-left pl-2">{t('labelProfit')}</div>
                    </div>
                </div>
                
                {/* Dynamische Zeilen */}
                {flows.map((f, idx) => {
                    // Breite des Balkens in Prozent (relativ zum absolut stärksten Wert)
                    const widthPct = (Math.abs(f.value) / maxAbs) * 100;
                    
                    return (
                        <div key={idx} className="flex items-center group hover:bg-gray-50 dark:hover:bg-slate-800/50 p-1.5 rounded transition-colors">
                            {/* Asset Name */}
                            <div className="w-1/3 text-right pr-4 truncate font-medium text-sm text-gray-700 dark:text-gray-300" title={f.label}>
                                {f.label}
                            </div>
                            
                            {/* Balken-Bereich mit Mittelachse */}
                            <div className="w-2/3 flex items-center h-6">
                                {/* Negative Seite (Links) */}
                                <div className="w-1/2 h-full border-r border-gray-300 dark:border-slate-600 flex justify-end items-center pr-1">
                                    {!f.isPos && (
                                        <div className="flex items-center justify-end w-full">
                                            <span className="text-xs text-red-600 dark:text-red-400 font-mono mr-2 opacity-80 group-hover:opacity-100">{f.valLabel}</span>
                                            <div className="bg-red-500 dark:bg-red-600 h-4 rounded-l-sm" style={{width: `${widthPct}%`}}></div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Positive Seite (Rechts) */}
                                <div className="w-1/2 h-full flex justify-start items-center pl-1">
                                    {f.isPos && (
                                        <div className="flex items-center justify-start w-full">
                                            {/* Balken-Grün abgedunkelt auf bg-green-700 für besseren Kontrast im Print */}
                                            <div className="bg-green-700 dark:bg-green-600 h-4 rounded-r-sm" style={{width: `${widthPct}%`}}></div>
                                            {/* Text-Grün abgedunkelt auf text-green-800 */}
                                            <span className="text-xs text-green-800 dark:text-green-400 font-mono ml-2 opacity-80 group-hover:opacity-100">{f.valLabel}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
             </div>
         )}
      </div>
    </div>
  );
};

module.exports = TopFlowReport;