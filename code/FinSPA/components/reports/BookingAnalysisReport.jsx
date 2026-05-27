const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const UniversalChart = require('../../api/UniversalChart.jsx');
const { getNormalizedBookings } = require('../../../data/DataEngine.jsx');

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  
  // Da dieser Report data nicht direkt injiziert bekommt, greifen wir via window darauf zu oder nutzen 'echarts' als Standard
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';
  
  const expenses = {};
  let totalExpenses = 0;
  let bookingCount = 0;

  const normBookings = getNormalizedBookings(activeAssets);

  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      if (bk.normType === 'Auszahlung') { 
          const cat = bk.normCategory || (t ? t('catUncategorized') || 'Unkategorisiert' : 'Unkategorisiert');
          const val = bk._baseValue; 
          
          expenses[cat] = (expenses[cat] || 0) + val; 
          totalExpenses += val;
          bookingCount++;
      }
  });
  
  const sortedCategories = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);

  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'), capitalize(t ? t('amount') || 'Betrag' : 'Betrag')];
        const tableBody = sortedCategories.map(cat => [cat, fCur(expenses[cat])]);

        await PdfExportEngine.exportReport({
          title: t ? t('repBookAnaTitle') || 'Buchungsanalyse' : 'Buchungsanalyse',
          subtitle: `${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to} | ${t ? t('labelBookingCount') || 'Anzahl Buchungen' : 'Anzahl Buchungen'}: ${bookingCount}`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im BookingAnalysisReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [sortedCategories, expenses, bookingCount, dateRange, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repBookAnaTitle') : 'Buchungsanalyse'} 
        subtitle={`${t ? t('repBookAnaSub') : 'Ausgabenanalyse'} (${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">{t ? t('labelTotalExpenses') || 'Gesamtausgaben' : 'Gesamtausgaben'}</div>
                <div className="text-2xl font-black text-red-600 dark:text-red-400">-{fCur(totalExpenses)}</div>
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">{t ? t('labelBookingCount') || 'Anzahl Buchungen' : 'Anzahl Buchungen'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bookingCount}</div>
            </div>
         </div>
      </div>

      {sortedCategories.length > 0 ? (
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6">
          <div ref={chartRef} style={{ width: '100%', height: `${Math.max(300, sortedCategories.length * 45)}px` }}>
            <UniversalChart 
              engine={activeChartEngine}
              type="bar"
              horizontal={true}
              labels={sortedCategories}
              datasets={[{
                label: t ? t('amount') || 'Betrag' : 'Betrag',
                data: sortedCategories.map(cat => expenses[cat]),
                backgroundColor: sortedCategories.map(() => '#ef4444'),
                valueFormatter: fCur
              }]}
              height="100%"
            />
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
           {t ? t('noDataAvailable') || 'Keine Daten vorhanden.' : 'Keine Daten vorhanden.'}
        </div>
      )}
    </div>
  );
};

module.exports = BookingAnalysisReport;