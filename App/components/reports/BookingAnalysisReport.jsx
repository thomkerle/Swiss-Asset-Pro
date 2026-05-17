const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { BarChartSVG } = require('../Charts.jsx');

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const expenses = {};
  activeAssets.forEach(a => {
     (a.bookings||[]).forEach(bk => {
         if (bk.date >= dateRange.from && bk.date <= dateRange.to) {
             const isNegative = ['Auszahlung', 'Gebühr', 'Zinszahlung'].includes(bk.type);
             const cat = bk.subCategory || bk.type;
             const val = Number(bk.amount) * (a.exchangeRate || 1);
             if (isNegative) { expenses[cat] = (expenses[cat] || 0) + val; }
         }
     });
  });
  const chartData = Object.keys(expenses).map(k => ({ label: k, value: -expenses[k], valLabel: `-${fCur(expenses[k])}`, color: '#ef4444' })).sort((a,b)=>a.value - b.value);

  return (
    <div>
      <ReportHeader title="Buchungsanalyse" subtitle={`Negative Flüsse (Ausgaben, Kosten, Zinsen) pro Detail-Kategorie (${dateRange.from} bis ${dateRange.to}).`} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <BarChartSVG data={chartData} fCur={fCur} />
    </div>
  );
};
module.exports = BookingAnalysisReport;