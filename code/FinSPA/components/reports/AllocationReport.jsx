const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { PieChartSVG } = require('../Charts.jsx');
const { getAllAssets, getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const AllocationReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const allocData = data.banks.map((b, i) => {
    const val = getAllAssets([b]).filter(a=>!a.isArchived).reduce((s, a) => s + getAssetValueAtDate(a, dateRange.to), 0);
    return { label: b.name, value: val, color: `hsl(${i * 80 + 200}, 70%, 55%)` };
  });
  return (
    <div>
      <ReportHeader title="Allokation nach Banken" subtitle={`Stichtag: ${dateRange.to}`} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <div className="p-8 flex justify-center bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl"><PieChartSVG data={allocData} fCur={fCur} /></div>
    </div>
  );
};
module.exports = AllocationReport;