const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const UniversalChart = require('../../api/UniversalChart.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  
  const catPerformance = {};
  const labelUncategorized = t ? (t('catUncategorized') || "Unkategorisiert") : "Unkategorisiert";

  const titleText = t ? (t('repCatFlow') || "Kategorienfluss") : "Kategorienfluss";
  const subtitlePrefix = t ? (t('repCatFlowSub') || "Wertzunahme/-abnahme aggregiert nach Kategorien") : "Wertzunahme/-abnahme aggregiert nach Kategorien";
  const wordToText = t ? (t('wordTo') || "bis") : "bis";

  const traverse = (nodes, currentCatName = labelUncategorized) => {
     nodes.forEach(n => {
        let catName = currentCatName;
        if (n.type === 'category') catName = n.name;
        if (n.type === 'asset' && !n.isArchived) {
            const s = getAssetValueAtDate(n, dateRange.from);
            const e = getAssetValueAtDate(n, dateRange.to);
            catPerformance[catName] = (catPerformance[catName] || 0) + (e - s);
        }
        if (n.children) traverse(n.children, catName);
     });
  };
  
  data.banks.forEach(b => traverse(b.children || [], b.name));
  
  const chartData = Object.keys(catPerformance).map(k => ({ 
      label: k, 
      value: catPerformance[k]
  })).sort((a,b) => b.value - a.value);

  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'), capitalize(t ? t('change') || 'Veränderung' : 'Veränderung')];
        const tableBody = chartData.map(d => [d.label, `${d.value >= 0 ? '+' : ''}${fCur(d.value)}`]);

        await PdfExportEngine.exportReport({
          title: titleText, 
          subtitle: `${subtitlePrefix} (${dateRange.from} ${wordToText} ${dateRange.to}).`, 
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im CategoryFlowReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [chartData, dateRange, fCur, t, titleText, subtitlePrefix, wordToText]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={titleText} 
        subtitle={`${subtitlePrefix} (${dateRange.from} ${wordToText} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      {chartData.length > 0 ? (
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm mt-6">
          <div ref={chartRef} style={{ width: '100%', height: '400px' }}>
            <UniversalChart 
              engine={activeChartEngine}
              type="bar"
              labels={chartData.map(d => d.label)}
              datasets={[{
                label: titleText,
                data: chartData.map(d => d.value),
                // Dynamisches Farb-Array basierend auf positivem/negativem Fluss
                backgroundColor: chartData.map(d => d.value >= 0 ? '#22c55e' : '#ef4444'),
                valueFormatter: (val) => val > 0 ? `+${fCur(val)}` : fCur(val)
              }]}
              height="100%"
            />
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500 mt-6">
           Keine Bewegungen in den Kategorien im gewählten Zeitraum gefunden.
        </div>
      )}
    </div>
  );
};

module.exports = CategoryFlowReport;