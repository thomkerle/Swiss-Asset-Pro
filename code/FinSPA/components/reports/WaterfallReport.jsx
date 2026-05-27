const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getTotalWealthAtDate, getNormalizedBookings } = safeRequire('../../../data/DataEngine.jsx') || window.DataEngine || {};

const WaterfallReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';

  const startVal = getTotalWealthAtDate(activeAssets, dateRange.from);
  const endVal = getTotalWealthAtDate(activeAssets, dateRange.to);
  
  let sumInc = 0, sumExp = 0;
  
  // 1. Alle Buchungen normalisiert holen
  const normBookings = getNormalizedBookings ? getNormalizedBookings(activeAssets) : [];

  // 2. Filter und Berechnung
  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      const isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Abzahlung'].includes(bk.normType);
      const isNegative = ['Auszahlung', 'Verkauf', 'Schulderhöhung'].includes(bk.normType);
      
      if(isPositive) sumInc += bk._baseValue; 
      else if (isNegative) sumExp += bk._baseValue;
  });
  
  const marketPerf = endVal - startVal - sumInc + sumExp; 
  const netCashflow = sumInc - sumExp;
  
  // Text-Fallbacks
  const repTitle = t ? t('repWaterfallTitle') || "Wasserfall-Analyse" : "Wasserfall-Analyse";
  const repSub = t ? t('repWaterfallSub') || "Brücke zwischen Start- und Endvermögen" : "Brücke zwischen Start- und Endvermögen";
  
  const lblStart = t ? t('labelWaterfallStart') || 'Startvermögen' : 'Startvermögen';
  const lblIn = t ? t('labelWaterfallInflows') || 'Einzahlungen' : 'Einzahlungen';
  const lblOut = t ? t('labelWaterfallOutflows') || 'Auszahlungen' : 'Auszahlungen';
  const lblMarket = t ? t('labelMarketEffect') || 'Markteffekt' : 'Markteffekt';
  const lblEnd = t ? t('labelWaterfallEnd') || 'Endvermögen' : 'Endvermögen';

  // Chart-Daten (Wir nutzen ein Standard-Balkendiagramm zur Visualisierung der Treiber)
  const chartLabels = [lblStart, lblIn, lblOut, lblMarket, lblEnd];
  const chartData = [startVal, sumInc, -sumExp, marketPerf, endVal];
  const chartColors = [
      '#3b82f6', // Start (Blau)
      '#22c55e', // Inflows (Grün)
      '#ef4444', // Outflows (Rot)
      marketPerf >= 0 ? '#22c55e' : '#ef4444', // Market (Grün oder Rot)
      '#3b82f6'  // End (Blau)
  ];

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
            capitalize(t ? t('labelPosition') || 'Position' : 'Position'),
            capitalize(t ? t('amount') || 'Betrag' : 'Betrag')
        ];

        // Die Brücken-Tabelle
        const tableBody = [
            [lblStart, fCur(startVal)],
            [lblIn, `+${fCur(sumInc)}`],
            [lblOut, `-${fCur(sumExp)}`],
            [lblMarket, `${marketPerf >= 0 ? '+' : ''}${fCur(marketPerf)}`],
            [lblEnd.toUpperCase(), fCur(endVal)]
        ];

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${dateRange.from} bis ${dateRange.to})`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im WaterfallReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [startVal, sumInc, sumExp, marketPerf, endVal, dateRange, fCur, t, repTitle, repSub, lblStart, lblIn, lblOut, lblMarket, lblEnd]);

  return (
   <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={repTitle} 
        subtitle={`${repSub} (${dateRange.from} - ${dateRange.to})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* KPI Kacheln */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
         <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{lblStart}</div>
             <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fCur(startVal)}</div>
         </div>
         
         <div className={`p-5 border rounded-xl shadow-sm ${netCashflow >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-xs font-bold uppercase mb-1 ${netCashflow >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {t ? t('labelNetCashflow') || 'Netto Cashflow' : 'Netto Cashflow'}
             </div>
             <div className={`text-xl font-black ${netCashflow >= 0 ? 'text-green-800 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                 {netCashflow >= 0 ? '+' : ''}{fCur(netCashflow)}
             </div>
         </div>

         <div className={`p-5 border rounded-xl shadow-sm ${marketPerf >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-xs font-bold uppercase mb-1 ${marketPerf >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {lblMarket}
             </div>
             <div className={`text-xl font-black ${marketPerf >= 0 ? 'text-green-800 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                 {marketPerf >= 0 ? '+' : ''}{fCur(marketPerf)}
             </div>
         </div>

         <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{lblEnd}</div>
             <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fCur(endVal)}</div>
         </div>
      </div>

      {/* Universelles Diagramm als Ersatz für das SVG */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-6">{repTitle}</h3>
        <div ref={chartRef} style={{ width: '100%', height: '350px' }}>
            <UniversalChart 
                engine={activeChartEngine}
                type="bar"
                labels={chartLabels}
                datasets={[{
                    label: t ? t('amount') || 'Betrag' : 'Betrag',
                    data: chartData,
                    backgroundColor: chartColors,
                    valueFormatter: (val) => `${val > 0 && chartData.indexOf(val) !== 0 && chartData.indexOf(val) !== 4 ? '+' : ''}${fCur(val)}`
                }]}
                height="100%"
            />
        </div>
      </div>
    </div>
  );
};

module.exports = WaterfallReport;