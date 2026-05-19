const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { LineChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate, generateMonthEnds, calcLinearRegression, calcExpRegression } = require('../../data/DataEngine.jsx');

const FutureReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const histDates = generateMonthEnds(dateRange.from, dateRange.to);
  const histData = histDates.map(d => ({y: getTotalWealthAtDate(activeAssets, d)}));
  
  if(histData.length < 2) {
      return <div className="p-10 text-center text-gray-500 font-medium">{t('msgNotEnoughHistory')}</div>;
  }
  
  const linReg = calcLinearRegression(histData);
  const expReg = calcExpRegression(histData);
  
  const futureMonths = [0, 3, 12, 36, 60]; 
  const startX = histData.length - 1; 
  const futureLabels = [t('labelToday'), t('label3Months'), t('label1Year'), t('label3Years'), t('label5Years')];
  
  const linD = futureMonths.map(m => {
     let val = linReg(startX + m);
     const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
     (data.scenarios || []).forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
     return val;
  });
  
  const expD = futureMonths.map(m => {
     let val = expReg(startX + m);
     const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
     (data.scenarios || []).forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
     return val;
  });

  // Endwerte nach 5 Jahren (Index 4 im Array)
  const finalLinear = linD[4] || 0;
  const finalExp = expD[4] || 0;

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      
      {/* CSS Hack um die Beschriftungen des LineChartSVG zu verbessern */}
      <style>{`
        .chart-axis-fix svg text {
           fill: #475569 !important; /* Dunkleres Grau für bessere Lesbarkeit */
           font-weight: 600;
           font-size: 11px;
           transform: translateX(-8px); /* Schiebt die Labels nach links, weg vom Raster */
        }
        html.dark .chart-axis-fix svg text {
           fill: #94a3b8 !important; /* Helles Grau für den Dark Mode */
        }
      `}</style>

      <ReportHeader 
        title={t('repSimRegTitle')} 
        subtitle={t('repSimRegSub')} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* Summary Cards für die Ziel-Projektionen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         <div className="p-6 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">
                 {t('labelLinear')} {t('labelProj5Years')}
             </div>
             <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fCur(finalLinear)}</div>
             <div className="text-xs text-gray-500 mt-2">Gleichmäßiges Wachstum anhand der Durchschnittswerte.</div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-green-700 dark:text-green-500 font-bold uppercase mb-1">
                 {t('labelExponential')} {t('labelProj5Years')}
             </div>
             <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fCur(finalExp)}</div>
             <div className="text-xs text-gray-500 mt-2">Wachstum inkl. Zinseszins-Effekt (Trendverstärkung).</div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm chart-axis-fix">
        <LineChartSVG 
            datasets={[
                { label: t('labelLinear'), color: '#3b82f6', dashed: true, data: linD }, 
                // Dunkleres Grün (#15803d) für die exponentielle Kurve für besseren Ausdruck
                { label: t('labelExponential'), color: '#15803d', dashed: true, data: expD } 
            ]} 
            labels={futureLabels} 
            fCur={fCur} 
        />
      </div>
    </div>
  );
};

module.exports = FutureReport;