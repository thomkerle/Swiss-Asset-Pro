const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { BarChartSVG } = require('../Charts.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const TopFlowReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const flows = activeAssets.map(a => {
      const s = getAssetValueAtDate(a, dateRange.from);
      const e = getAssetValueAtDate(a, dateRange.to);
      return { label: a.name, value: e - s, valLabel: fCur(e-s), color: (e-s)>=0?'#22c55e':'#ef4444' };
  }).sort((a,b)=>b.value - a.value);
  return (
    <div>
      <ReportHeader title="Top Flow Assets" subtitle="Wertzuwachs/Verlust pro einzelnem Asset im gewählten Zeitraum." isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <BarChartSVG data={flows} fCur={fCur} />
    </div>
  );
};
module.exports = TopFlowReport;