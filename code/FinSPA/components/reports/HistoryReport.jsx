const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { LineChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate, generateMonthEnds } = require('../../data/DataEngine.jsx');

const HistoryReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  // 1. Basis-Daten generieren (Monatsenden)
  let dates = generateMonthEnds(dateRange.from, dateRange.to);
  
  // 2. WICHTIG: Sicherstellen, dass das genaue Startdatum VORNE dabei ist
  if (dates.length === 0 || dates[0] > dateRange.from) {
      dates = [dateRange.from, ...dates];
  }
  
  // 3. WICHTIG: Sicherstellen, dass das genaue Enddatum HINTEN dabei ist
  if (dates[dates.length - 1] < dateRange.to) {
      dates = [...dates, dateRange.to];
  }
  
  // 4. Duplikate entfernen (falls das Start/Enddatum zufällig ein Monatsende war)
  dates = [...new Set(dates)];

  // Vermögenswerte für jeden Zeitpunkt berechnen
  const historyVals = dates.map(d => getTotalWealthAtDate(activeAssets, d));
  
  // Metadaten für die neuen Info-Cards berechnen
  const startValue = historyVals[0] || 0;
  const endValue = historyVals[historyVals.length - 1] || 0;
  const diff = endValue - startValue;
  const percentChange = startValue !== 0 ? (diff / startValue) * 100 : 0;
  const isPositive = diff >= 0;

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t('repHistTitle')} 
        // Falls du in der Buchungsanalyse `wordTo` definiert hattest, kannst du es hier wiederverwenden:
        subtitle={`${t('repHistSub')} (${dateRange.from} ${t('wordTo')} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* Neue Sektion: Startvermögen, Endvermögen & Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t('labelStartWealth')}</div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(startValue)}</div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t('labelEndWealth')}</div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(endValue)}</div>
         </div>
         
         {/* Farbcodierte Card für die Veränderung */}
         <div className={`p-6 border rounded-xl shadow-sm ${isPositive ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
             <div className={`text-sm font-bold uppercase mb-1 ${isPositive ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                 {t('labelAbsoluteChange')}
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

      {/* Die Kurve selbst in einer Card, damit sie visuell gefasst ist */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <LineChartSVG 
            datasets={[{label: t('labelTotalWealth'), color:'#3b82f6', data: historyVals}]} 
            labels={dates} 
            fCur={fCur} 
        />
      </div>
    </div>
  );
};

module.exports = HistoryReport;