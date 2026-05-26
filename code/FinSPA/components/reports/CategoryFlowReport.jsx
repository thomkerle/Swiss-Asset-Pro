const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  const catPerformance = {};
  const labelUncategorized = t ? (t('catUncategorized') || "Unkategorisiert") : "Unkategorisiert";

  // SAUBERE TEXT-VARIABLEN (verhindert Syntax-Fehler bei Übersetzungen)
  const titleText = t ? (t('repCatFlow') || "Kategorienfluss") : "Kategorienfluss";
  const subtitlePrefix = t ? (t('repCatFlowSub') || "Wertzunahme/-abnahme aggregiert nach Kategorien") : "Wertzunahme/-abnahme aggregiert nach Kategorien";
  const wordToText = t ? (t('wordTo') || "bis") : "bis";

  // 1. Datenaggregation: Differenz zwischen Start- und Enddatum pro Kategorie
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

  // 2. Apache ECharts Initialisierung
  useEffect(() => {
    let isMounted = true;
    let myChart = null;

    const renderChart = async () => {
      await PdfExportEngine.initLibraries();
      if (!isMounted || !chartRef.current || !window.echarts || chartData.length === 0) return;

      myChart = window.echarts.init(chartRef.current);
      chartInstanceRef.current = myChart;

      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const item = params[0];
            const isPos = item.value >= 0;
            const color = isPos ? '#22c55e' : '#ef4444';
            const prefix = isPos ? '+' : '';
            return `<div style="font-weight:bold;">${item.name}</div><span style="color:${color}; font-weight:bold;">${prefix}${fCur(item.value)}</span>`;
          }
        },
        grid: { top: '10%', left: '3%', right: '4%', bottom: '5%', containLabel: true },
        xAxis: {
          type: 'category',
          data: chartData.map(d => d.label),
          axisLabel: {
            color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155',
            interval: 0,
            rotate: chartData.length > 5 ? 30 : 0 // Leicht rotieren bei vielen Kategorien
          },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: document.documentElement.classList.contains('dark') ? '#475569' : '#cbd5e1' } }
        },
        yAxis: {
          type: 'value',
          splitLine: { 
            lineStyle: { 
              type: 'dashed', 
              color: document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0' 
            } 
          },
          axisLabel: {
            color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'
          }
        },
        series: [
          {
            type: 'bar',
            data: chartData.map(d => ({
              value: d.value,
              itemStyle: {
                color: d.value >= 0 ? '#22c55e' : '#ef4444',
                borderRadius: d.value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]
              }
            })),
            label: {
              show: true,
              position: 'top',
              formatter: (params) => {
                if (params.value === 0) return '';
                return params.value > 0 ? `+${fCur(params.value)}` : fCur(params.value);
              },
              textStyle: {
                color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155',
                fontSize: 10,
                fontWeight: 'bold'
              }
            }
          }
        ]
      };

      myChart.setOption(option);
    };

    renderChart();

    const handleResize = () => { if (myChart) myChart.resize(); };
    window.addEventListener('resize', handleResize);
    
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (myChart) myChart.dispose();
    };
  }, [chartData, fCur]);

  // 3. Event-Listener für den globalen PDF Export aus dem Menü
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        const chartBase64 = chartInstanceRef.current 
          ? chartInstanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
          : null;

        const tableHeaders = [
          t ? t('category') || 'Kategorie' : 'Kategorie', 
          t ? t('change') || 'Veränderung' : 'Veränderung'
        ];
        
        const tableBody = chartData.map(d => [d.label, `${d.value >= 0 ? '+' : ''}${fCur(d.value)}`]);

        await PdfExportEngine.exportReport({
          title: titleText, // <--- Nutzt die saubere Variable
          subtitle: `${subtitlePrefix} (${dateRange.from} ${wordToText} ${dateRange.to}).`, // <--- Kein Syntax-Fehler mehr
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
          <div ref={chartRef} style={{ width: '100%', height: '400px' }}></div>
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