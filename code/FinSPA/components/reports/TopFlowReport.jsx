const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;

const TopFlowReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';

  // 1. Alle Flows berechnen
  let flows = activeAssets.map(a => {
      const s = getAssetValueAtDate(a, dateRange?.from || '2000-01-01');
      const e = getAssetValueAtDate(a, dateRange?.to || new Date().toISOString().split('T')[0]);
      const diff = e - s;
      return { 
          label: a.name, 
          value: diff, 
          valLabel: `${diff > 0 ? '+' : ''}${fCur(diff)}`, 
          isPos: diff >= 0 
      };
  });
  
  // 2. Filtere Null-Werte heraus und sortiere: Grösster Gewinn oben, grösster Verlust unten
  flows = flows.filter(f => Math.abs(f.value) > 0.01).sort((a,b) => b.value - a.value);

  // Text-Fallbacks
  const repTitle = t ? t('repTopFlowTitle') || "Top Gewinner & Verlierer" : "Top Gewinner & Verlierer";
  const repSub = t ? t('repTopFlowSub') || "Absolute Wertveränderung pro Asset" : "Absolute Wertveränderung pro Asset";
  const wordTo = t ? t('wordTo') || "bis" : "bis";

  // 3. Event-Listener für den PDF-Export
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
            capitalize(t ? t('labelAsset') || 'Asset' : 'Asset'),
            capitalize(t ? t('change') || 'Veränderung' : 'Veränderung')
        ];

        const tableBody = flows.map(f => [
            f.label, 
            f.valLabel
        ]);

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${dateRange.from} ${wordTo} ${dateRange.to})`,
          tableHeaders,
          tableBody,
          chartBase64,
	  data: data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im TopFlowReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [flows, dateRange, fCur, t, repTitle, repSub, wordTo]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={repTitle} 
        subtitle={`${repSub} (${dateRange.from} ${wordTo} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
         {flows.length === 0 ? (
             <div className="text-center text-gray-500 py-10 flex flex-col items-center">
                 <Icon name="Activity" size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                 {t ? t('noFlowsFound') || 'Keine Wertveränderungen im gewählten Zeitraum.' : 'Keine Wertveränderungen im gewählten Zeitraum.'}
             </div>
         ) : (
             <>
                 <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                     {/* FIX: "BarChart" statt "BarChart2", passend zur Definition in Icons.jsx */}
                     <Icon name="BarChart" className="text-blue-500" /> {t ? t('labelWaterfallMovements') || 'Wasserfall-Bewegungen' : 'Wasserfall-Bewegungen'}
                 </h3>
                 
                 {/* Dynamische Höhe basierend auf der Anzahl der Assets für perfekte Darstellung */}
                 <div ref={chartRef} style={{ width: '100%', height: `${Math.max(300, flows.length * 40)}px` }}>
                     <UniversalChart 
                         engine={activeChartEngine}
                         type="bar"
                         horizontal={true}
                         labels={flows.map(f => f.label)}
                         datasets={[{
                             label: t ? t('change') || 'Wertveränderung' : 'Wertveränderung',
                             data: flows.map(f => f.value),
                             // Positiv = Grün, Negativ = Rot
                             backgroundColor: flows.map(f => f.isPos ? '#22c55e' : '#ef4444'),
                             valueFormatter: (val) => `${val > 0 ? '+' : ''}${fCur(val)}`
                         }]}
                         height="100%"
                     />
                 </div>
             </>
         )}
      </div>
    </div>
  );
};

module.exports = TopFlowReport;