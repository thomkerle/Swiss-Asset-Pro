const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { WaterfallChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate } = require('../../data/DataEngine.jsx');

const WaterfallReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const startVal = getTotalWealthAtDate(activeAssets, dateRange.from);
  const endVal = getTotalWealthAtDate(activeAssets, dateRange.to);
  let sumInc = 0, sumExp = 0;
  activeAssets.forEach(a => {
      (a.bookings||[]).filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
          const isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(bk.type);
          const isNegative = ['Auszahlung', 'Verkauf', 'Gebühr', 'Zinszahlung', 'Schulderhöhung'].includes(bk.type);
          if(isPositive) sumInc += Number(bk.amount)*(a.exchangeRate||1); 
          else if (isNegative) sumExp += Number(bk.amount)*(a.exchangeRate||1);
      });
  });
  const marketPerf = endVal - startVal - sumInc + sumExp; 
  const wfData = [
      { label: 'Startwert', start: 0, end: startVal, valLabel: fCur(startVal) },
      { label: 'Zuflüsse', start: startVal, end: startVal + sumInc, valLabel: `+${fCur(sumInc)}` },
      { label: 'Abflüsse', start: startVal + sumInc, end: startVal + sumInc - sumExp, valLabel: `-${fCur(sumExp)}` },
      { label: 'Markt / Anpassung', start: startVal + sumInc - sumExp, end: endVal, valLabel: `${marketPerf>=0?'+':''}${fCur(marketPerf)}` },
      { label: 'Endwert', start: 0, end: endVal, valLabel: fCur(endVal) }
  ];
  return (
    <div>
      <ReportHeader title="Wasserfallfluss" subtitle="Treiber der Vermögensveränderung." isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <WaterfallChartSVG data={wfData} fCur={fCur} />
    </div>
  );
};
module.exports = WaterfallReport;