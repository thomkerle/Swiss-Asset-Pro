const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { BarChartSVG } = require('../Charts.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const catPerformance = {};
  const traverse = (nodes, currentCatName = "Unkategorisiert") => {
     nodes.forEach(n => {
        let catName = currentCatName;
        if (n.type === 'category') catName = n.name;
        if (n.type === 'asset' && !n.isArchived) {
            const s = getAssetValueAtDate(n, dateRange.from);
            const e = getAssetValueAtDate(n, dateRange.to);
            catPerformance[catName] = (catPerformance[catName] || 0) + (e - s);
        }
        if (n.children) traverse(n.children, catName);
     });
  };
  data.banks.forEach(b => traverse(b.children || [], b.name));
  const chartData = Object.keys(catPerformance).map(k => ({ label: k, value: catPerformance[k], valLabel: fCur(catPerformance[k]), color: catPerformance[k] >= 0 ? '#22c55e' : '#ef4444' })).sort((a,b) => b.value - a.value);

  return (
    <div>
      <ReportHeader title="Kategorienfluss" subtitle={`Wertzunahme/-abnahme aggregiert nach Asset-Kategorien (${dateRange.from} bis ${dateRange.to}).`} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <BarChartSVG data={chartData} fCur={fCur} />
    </div>
  );
};
module.exports = CategoryFlowReport;