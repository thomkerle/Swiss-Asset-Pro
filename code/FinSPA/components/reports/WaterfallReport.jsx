const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { WaterfallChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate, getNormalizedBookings } = require('../../../data/DataEngine.jsx');  // Normalizer importiert

const WaterfallReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const startVal = getTotalWealthAtDate(activeAssets, dateRange.from);
  const endVal = getTotalWealthAtDate(activeAssets, dateRange.to);
  
  let sumInc = 0, sumExp = 0;
  
  // 1. Alle Buchungen normalisiert holen
  const normBookings = getNormalizedBookings(activeAssets);

  // 2. Filter und Berechnung
  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      // Dank Normalizer viel kürzer, da Alt-Typen umgewandelt wurden
      const isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Abzahlung'].includes(bk.normType);
      const isNegative = ['Auszahlung', 'Verkauf', 'Schulderhöhung'].includes(bk.normType);
      
      if(isPositive) sumInc += bk._baseValue; 
      else if (isNegative) sumExp += bk._baseValue;
  });
  
  const marketPerf = endVal - startVal - sumInc + sumExp; 
  const netCashflow = sumInc - sumExp;
  
  const wfData = [
      { label: t('labelWaterfallStart'), start: 0, end: startVal, valLabel: fCur(startVal), color: '#3b82f6' },
      { label: t('labelWaterfallInflows'), start: startVal, end: startVal + sumInc, valLabel: `+${fCur(sumInc)}`, color: '#15803d' },
      { label: t('labelWaterfallOutflows'), start: startVal + sumInc, end: startVal + sumInc - sumExp, valLabel: `-${fCur(sumExp)}`, color: '#b91c1c' },
      { label: t('labelWaterfallMarket'), start: startVal + sumInc - sumExp, end: endVal, valLabel: `${marketPerf>=0?'+':''}${fCur(marketPerf)}`, color: marketPerf >= 0 ? '#15803d' : '#b91c1c' },
      { label: t('labelWaterfallEnd'), start: 0, end: endVal, valLabel: fCur(endVal), color: '#3b82f6' }
  ];

  return (
   <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t('repWaterfallTitle')} 
        subtitle={`${t('repWaterfallSub')} (${dateRange.from} - ${dateRange.to})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
         <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t('labelWaterfallStart')}</div>
             <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fCur(startVal)}</div>
         </div>
         
         <div className={`p-5 border rounded-xl shadow-sm ${netCashflow >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-xs font-bold uppercase mb-1 ${netCashflow >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {t('labelNetCashflow')}
             </div>
             <div className={`text-xl font-black ${netCashflow >= 0 ? 'text-green-800 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                 {netCashflow >= 0 ? '+' : ''}{fCur(netCashflow)}
             </div>
         </div>

         <div className={`p-5 border rounded-xl shadow-sm ${marketPerf >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-xs font-bold uppercase mb-1 ${marketPerf >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {t('labelMarketEffect')}
             </div>
             <div className={`text-xl font-black ${marketPerf >= 0 ? 'text-green-800 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                 {marketPerf >= 0 ? '+' : ''}{fCur(marketPerf)}
             </div>
         </div>

         <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t('labelWaterfallEnd')}</div>
             <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fCur(endVal)}</div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <WaterfallChartSVG data={wfData} fCur={fCur} />
      </div>
    </div>
  );
};

module.exports = WaterfallReport;