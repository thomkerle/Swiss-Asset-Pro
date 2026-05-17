const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { LineChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate, generateMonthEnds } = require('../../data/DataEngine.jsx');

const HistoryReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const dates = generateMonthEnds(dateRange.from, dateRange.to);
  const historyVals = dates.map(d => getTotalWealthAtDate(activeAssets, d));
  return (
    <div>
      <ReportHeader title="Historischer Verlauf" subtitle="Reale Berechnung basierend auf Salden & Buchungen." isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <LineChartSVG datasets={[{label:'Gesamtvermögen', color:'#3b82f6', data: historyVals}]} labels={dates} fCur={fCur} />
    </div>
  );
};
module.exports = HistoryReport;