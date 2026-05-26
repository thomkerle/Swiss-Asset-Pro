const React = require('react');
const { useEffect, useRef } = React;

// Sicheres Require-Setup für FinSPA Pro Module
const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

// Modul-Imports mit Fallbacks für höchste Stabilität
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const { getAllAssets, getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const AllocationReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);

  // Aktive Chart-Engine dynamisch aus den Settings auslesen (Fallback auf 'echarts')
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

  // Datenaufbereitung für das Chart
  const allocData = data.banks.map((b, i) => {
    const val = getAllAssets([b]).filter(a => !a.isArchived).reduce((s, a) => s + getAssetValueAtDate(a, dateRange.to), 0);
    return { label: b.name, value: val, color: `hsl(${i * 80 + 200}, 70%, 55%)` };
  }).filter(d => d.value > 0);

  // Event-Listener für den PDF-Export (unterstützt Plotly, Chart.js und ECharts)
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) {
            console.error("[FinSPA Diagnose] PdfExportEngine nicht verfügbar.");
            return;
        }

        let chartBase64 = null;
        if (chartRef.current) {
            // 1. Prüfen, ob ein Plotly-Chart gerendert wurde (Plotly nutzt SVGs)
            const plotlyNode = chartRef.current.querySelector('.js-plotly-plot');
            
            if (plotlyNode && window.Plotly) {
                // Plotly-eigener Export
                try {
                    chartBase64 = await window.Plotly.toImage(plotlyNode, { 
                        format: 'png', 
                        width: 800, 
                        height: 400 
                    });
                } catch (e) {
                    console.error("[FinSPA Diagnose] Plotly Bild-Export fehlgeschlagen:", e);
                }
            } else {
                // 2. Fallback auf Canvas-Export (für ECharts und Chart.js)
                const canvas = chartRef.current.querySelector('canvas');
                if (canvas) {
                    chartBase64 = canvas.toDataURL('image/png', 1.0);
                }
            }
        }

        const tableHeaders = [t ? t('bank') || 'Bank / Institut' : 'Bank / Institut', t ? t('amount') || 'Betrag' : 'Betrag'];
        const tableBody = [...allocData].sort((a, b) => b.value - a.value).map(d => [d.label, fCur(d.value)]);

        // PDF-Generierung anstossen
        await PdfExportEngine.exportReport({
          title: t ? t('repAlloc') || 'Allokation nach Banken' : 'Allokation nach Banken',
          subtitle: `${t ? t('reportDate') || 'Stichtag:' : 'Stichtag:'} ${dateRange.to}`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) { 
          console.error("[FinSPA Diagnose] Fehler beim PDF-Export:", err); 
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [allocData, dateRange, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repAlloc') : 'Allokation nach Banken'} 
        subtitle={`${t ? t('reportDate') : 'Stichtag:'} ${dateRange.to}`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="p-8 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm mt-6">
        {/* Der Wrapper liefert das Ref für den generischen Bild-Export */}
        <div ref={chartRef} style={{ width: '100%', minHeight: '400px' }}>
          <UniversalChart
            engine={activeChartEngine}
            type="doughnut"
            height="400px"
            labels={allocData.map(d => d.label)}
            datasets={[{
              label: t ? t('repAlloc') : 'Allokation',
              data: allocData.map(d => d.value),
              backgroundColor: allocData.map(d => d.color)
            }]}
          />
        </div>
      </div>
    </div>
  );
};

module.exports = AllocationReport;