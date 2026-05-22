const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { BarChartSVG } = require('../Charts.jsx');
const { getNormalizedBookings } = require('../../../data/DataEngine.jsx'); // Neu importiert

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const expenses = {};
  let totalExpenses = 0;
  let bookingCount = 0;

  // 1. Alle Buchungen normalisiert holen
  const normBookings = getNormalizedBookings(activeAssets);

  // 2. Nur auf den definierten Datumsbereich filtern
  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      // 3. Jede "Auszahlung" ist eine Ausgabe (Gebühren & Zinsen sind dank Normalizer schon inkludiert!)
      if (bk.normType === 'Auszahlung') { 
          const cat = bk.normCategory || 'Unkategorisiert';
          const val = bk._baseValue; // Währungsbereinigter Wert direkt aus dem Normalizer
          
          expenses[cat] = (expenses[cat] || 0) + val; 
          totalExpenses += val;
          bookingCount++;
      }
  });
  
  const chartData = Object.keys(expenses).map(k => ({ 
      label: k, 
      value: -expenses[k], 
      valLabel: `-${fCur(expenses[k])}`, 
      color: '#ef4444' 
  })).sort((a,b) => a.value - b.value);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t('repBookAnaTitle')} 
        subtitle={`${t('repBookAnaSub')} (${dateRange.from} ${t('wordTo')} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 flex-1 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">{t('labelTotalExpenses')}</div>
                <div className="text-2xl font-black text-red-600 dark:text-red-400">-{fCur(totalExpenses)}</div>
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 flex-1 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">{t('labelBookingCount')}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bookingCount}</div>
            </div>
         </div>
      </div>

      <BarChartSVG data={chartData} fCur={fCur} />
    </div>
  );
};

module.exports = BookingAnalysisReport;