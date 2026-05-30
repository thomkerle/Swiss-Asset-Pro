const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const { getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

// KORREKTUR: activeAssets in die Props aufgenommen
const LiquidityReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange.to;

  let liquidTotal = 0;
  let illiquidTotal = 0;

  // KORREKTUR: Wir greifen direkt auf das übergebene activeAssets Array zu!
  const assets = activeAssets || [];
  const liquidAssets = [];
  const illiquidAssets = [];

  assets.forEach(a => {
    const val = getAssetValueAtDate(a, targetDate);
    if (val === 0) return; // Leere Positionen ignorieren

    // Prüfung auf Liquidität: Entweder explizites Flag aus dem Stammdaten-Editor 
    // oder Fallback anhand der Anlageklasse
    const isIlliquidClass = ['pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'realestate'].includes(a.assetClass);
    const isLiquid = a.isLiquid !== undefined ? a.isLiquid : !isIlliquidClass;
    
    if (isLiquid) {
      liquidTotal += val;
      liquidAssets.push({ name: a.name, val });
    } else {
      illiquidTotal += val;
      illiquidAssets.push({ name: a.name, val });
    }
  });

  const grandTotal = liquidTotal + illiquidTotal;
  const liquidPercent = grandTotal > 0 ? (liquidTotal / grandTotal) * 100 : 0;
  const illiquidPercent = grandTotal > 0 ? (illiquidTotal / grandTotal) * 100 : 0;

  // Chart Labels & Daten
  const labelLiquid = t ? t('labelLiquid') || 'Verfügbar (Liquid)' : 'Verfügbar (Liquid)';
  const labelIlliquid = t ? t('labelIlliquid') || 'Gebunden (Illiquid)' : 'Gebunden (Illiquid)';
  
  const chartLabels = [labelLiquid, labelIlliquid];
  const chartValues = [liquidTotal, illiquidTotal];

  // Event-Listener für den PDF-Export
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
          capitalize(t ? t('labelLiqType') || 'Liquiditäts-Typ' : 'Liquiditäts-Typ'), 
          capitalize(t ? t('name') || 'Anlage / Asset' : 'Anlage / Asset'),
          capitalize(t ? t('amount') || 'Wert' : 'Wert')
        ];
        
        const tableBody = [];
        
        liquidAssets.sort((a,b) => b.val - a.val).forEach(a => {
            tableBody.push([labelLiquid, a.name, fCur(a.val)]);
        });
        
        illiquidAssets.sort((a,b) => b.val - a.val).forEach(a => {
            tableBody.push([labelIlliquid, a.name, fCur(a.val)]);
        });

        const subtitleText = `${t ? t('repLiqSubTied') || 'Verfügbare vs. gebundene Mittel per' : 'Verfügbare vs. gebundene Mittel per'} ${targetDate} | Gesamtvolumen: ${fCur(grandTotal)}`;

        await PdfExportEngine.exportReport({
          title: t ? t('repLiqTitle') || 'Liquiditätsrisiko' : 'Liquiditätsrisiko',
          subtitle: subtitleText,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im LiquidityReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [liquidAssets, illiquidAssets, grandTotal, fCur, t, chartLabels, targetDate]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repLiqTitle') || 'Liquiditätsrisiko' : 'Liquiditätsrisiko'} 
        subtitle={`${t ? t('repLiqSubTied') || 'Verfügbare vs. gebundene Mittel per' : 'Verfügbare vs. gebundene Mittel per'} ${targetDate} | Gesamtvolumen: ${fCur(grandTotal)}`}
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-4">
         <div className="p-6 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase mb-1 flex justify-between">
                 <span>{labelLiquid}</span>
                 <span>{liquidPercent.toFixed(1)}%</span>
             </div>
             <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fCur(liquidTotal)}</div>
             <div className="text-xs text-gray-500 mt-2">{t ? t('descLiquid') || 'Jederzeit kündbares oder handelbares Vermögen (Bargeld, freie Aktien).' : 'Jederzeit kündbares oder handelbares Vermögen (Bargeld, freie Aktien).'}</div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-amber-600 dark:text-amber-500 font-bold uppercase mb-1 flex justify-between">
                 <span>{labelIlliquid}</span>
                 <span>{illiquidPercent.toFixed(1)}%</span>
             </div>
             <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fCur(illiquidTotal)}</div>
             <div className="text-xs text-gray-500 mt-2">{t ? t('descIlliquid') || 'Gebundenes Kapital (z.B. Säule 3a, Pensionskasse, Immobilienwerte).' : 'Gebundenes Kapital (z.B. Säule 3a, Pensionskasse, Immobilienwerte).'}</div>
         </div>
      </div>

      {grandTotal > 0 ? (
          <div className="p-8 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div ref={chartRef} style={{ width: '100%', minHeight: '400px' }}>
              <UniversalChart
                engine={activeChartEngine}
                type="doughnut"
                height="400px"
                labels={chartLabels}
                datasets={[{
                  label: t ? t('repLiqTitle') || 'Liquiditätsrisiko' : 'Liquiditätsrisiko',
                  data: chartValues,
                  backgroundColor: ['#3b82f6', '#f59e0b']
                }]}
              />
            </div>
          </div>
      ) : (
          <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500 mt-6">
             {t ? t('noAssetsFoundDate') || 'Keine Vermögenswerte zum gewählten Stichtag gefunden.' : 'Keine Vermögenswerte zum gewählten Stichtag gefunden.'}
          </div>
      )}
    </div>
  );
};

module.exports = LiquidityReport;