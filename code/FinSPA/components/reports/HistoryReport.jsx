const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const UniversalChart = require('../../api/UniversalChart.jsx');
const { getTotalWealthAtDate, generateMonthEnds } = require('../../data/DataEngine.jsx');

const HistoryReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';

  // 1. Basis-Daten generieren (Monatsenden)
  let dates = generateMonthEnds(dateRange.from, dateRange.to);
  
  // 2. Sicherstellen, dass das genaue Startdatum VORNE dabei ist
  if (dates.length === 0 || dates[0] > dateRange.from) {
      dates = [dateRange.from, ...dates];
  }
  
  // 3. Sicherstellen, dass das genaue Enddatum HINTEN dabei ist
  if (dates[dates.length - 1] < dateRange.to) {
      dates = [...dates, dateRange.to];
  }
  
  // 4. Duplikate entfernen
  dates = [...new Set(dates)];

  // Vermögenswerte für jeden Zeitpunkt berechnen
  const historyVals = dates.map(d => getTotalWealthAtDate(activeAssets, d));

  // ◄ HIER NEU: Führende Null-Werte wegschneiden, falls der Berichtszeitraum vor den ersten Buchungen startet
  let combinedData = dates.map((d, i) => ({ date: d, value: historyVals[i] }));
  const firstNonZeroIdx = combinedData.findIndex(item => item.value !== 0);
  
  // Wenn wir einen späteren Startpunkt mit echten Buchungen finden, schneiden wir die Nullen davor ab
  if (firstNonZeroIdx > 0) {
      combinedData = combinedData.slice(firstNonZeroIdx);
  }

  const finalDates = combinedData.map(item => item.date);
  const finalVals = combinedData.map(item => item.value);
  
  // Metadaten für die Info-Cards berechnen (auf den bereinigten Realdaten)
  const startValue = finalVals[0] || 0;
  const endValue = finalVals[finalVals.length - 1] || 0;
  const diff = endValue - startValue;
  const percentChange = startValue !== 0 ? (diff / startValue) * 100 : 0;
  const isPositive = diff >= 0;

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
          capitalize(t ? t('date') || 'Datum' : 'Datum'),
          capitalize(t ? t('labelTotalWealth') || 'Gesamtvermögen' : 'Gesamtvermögen')
        ];

        const tableBody = finalDates.map((d, i) => [
          d,
          fCur(finalVals[i])
        ]);

        await PdfExportEngine.exportReport({
          title: t ? t('repHistTitle') || 'Historischer Verlauf' : 'Historischer Verlauf',
          subtitle: `${t ? t('repHistSub') || 'Vermögensentwicklung' : 'Vermögensentwicklung'} (${finalDates[0] || dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to}).`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im HistoryReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [finalDates, finalVals, dateRange, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repHistTitle') : 'Historie'} 
        subtitle={`${t ? t('repHistSub') : 'Verlauf'} (${finalDates[0] || dateRange.from} ${t ? t('wordTo') : 'bis'} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* Sektion: Startvermögen, Endvermögen & Performance anhand realer Startwerte */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t ? t('labelStartWealth') : 'Startvermögen'}</div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(startValue)}</div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t ? t('labelEndWealth') : 'Endvermögen'}</div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(endValue)}</div>
         </div>
         
         <div className={`p-6 border rounded-xl shadow-sm ${isPositive ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-sm font-bold uppercase mb-1 ${isPositive ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {t ? t('labelAbsoluteChange') : 'Absolute Veränderung'}
             </div>
             <div className="flex items-end gap-2">
                <div className={`text-2xl font-black ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    {isPositive ? '+' : ''}{fCur(diff)}
                </div>
                <div className={`text-sm font-bold pb-1 ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    ({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)
                </div>
             </div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div ref={chartRef} style={{ width: '100%', height: '350px' }}>
          <UniversalChart 
            engine={activeChartEngine}
            type="line"
            labels={finalDates}
            datasets={[{
              label: t ? t('labelTotalWealth') : 'Gesamtvermögen',
              data: finalVals,
              backgroundColor: '#3b82f6',
              valueFormatter: fCur
            }]} 
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};

module.exports = HistoryReport;