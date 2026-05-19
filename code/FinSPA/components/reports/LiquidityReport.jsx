const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { PieChartSVG } = require('../Charts.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

// WICHTIG: 't' zu den Props hinzugefügt
const LiquidityReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const liquid = activeAssets.filter(a => a.isLiquid).reduce((sum, a) => sum + getAssetValueAtDate(a, dateRange.to), 0);
  const illiquid = activeAssets.filter(a => !a.isLiquid).reduce((sum, a) => sum + getAssetValueAtDate(a, dateRange.to), 0);
  
  // Neue Zusatzinfo: Berechnung der Liquiditätsquote
  const total = liquid + illiquid;
  const ratio = total > 0 ? ((liquid / total) * 100).toFixed(1) : 0;

  const chartData = [
      { label: t('labelLiquid'), value: Math.max(0, liquid), color: '#3b82f6' }, 
      { label: t('labelIlliquid'), value: Math.max(0, illiquid), color: '#f59e0b' }
  ];

  return (
   <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t('repLiqTitle')} 
        subtitle={`${t('repLiqSub')} (${t('labelTargetDate')} ${dateRange.to})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      {/* Grid wurde auf 3 Spalten erweitert (md:grid-cols-3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl shadow-sm">
             <div className="text-sm text-blue-800 dark:text-blue-400 font-bold uppercase mb-1">{t('labelAvailable')}</div>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-500">{fCur(liquid)}</div>
         </div>
         <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl shadow-sm">
             <div className="text-sm text-yellow-800 dark:text-yellow-400 font-bold uppercase mb-1">{t('labelTiedUp')}</div>
             <div className="text-2xl font-black text-yellow-600 dark:text-yellow-500">{fCur(illiquid)}</div>
         </div>
         {/* Neue Infokarte für die Liquiditätsquote */}
         <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl shadow-sm">
             <div className="text-sm text-green-800 dark:text-green-400 font-bold uppercase mb-1">{t('labelRatio')}</div>
             <div className="text-2xl font-black text-green-600 dark:text-green-500">{ratio}%</div>
         </div>
      </div>
      
      <div className="p-8 flex justify-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
          <PieChartSVG data={chartData} fCur={fCur} />
      </div>
    </div>
  );
};

module.exports = LiquidityReport;