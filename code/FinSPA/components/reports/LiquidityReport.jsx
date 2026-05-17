const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { PieChartSVG } = require('../Charts.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const LiquidityReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const liquid = activeAssets.filter(a => a.isLiquid).reduce((sum, a) => sum + getAssetValueAtDate(a, dateRange.to), 0);
  const illiquid = activeAssets.filter(a => !a.isLiquid).reduce((sum, a) => sum + getAssetValueAtDate(a, dateRange.to), 0);
  const chartData = [{ label: 'Liquide Mittel', value: Math.max(0, liquid), color: '#3b82f6' }, { label: 'Gebundenes Vermögen', value: Math.max(0, illiquid), color: '#f59e0b' }];

  return (
    <div>
      <ReportHeader title="Liquiditätsrisiko" subtitle={`Sicht auf gebundenes vs. verfügbares Vermögen (Stichtag: ${dateRange.to})`} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <div className="grid grid-cols-2 gap-6 mb-8">
         <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl"><div className="text-sm text-blue-800 font-bold uppercase mb-1">Verfügbar (Liquide)</div><div className="text-2xl font-black text-blue-600">{fCur(liquid)}</div></div>
         <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl"><div className="text-sm text-yellow-800 font-bold uppercase mb-1">Gebunden (Illiquide)</div><div className="text-2xl font-black text-yellow-600">{fCur(illiquid)}</div></div>
      </div>
      <div className="p-8 flex justify-center bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl"><PieChartSVG data={chartData} fCur={fCur} /></div>
    </div>
  );
};
module.exports = LiquidityReport;