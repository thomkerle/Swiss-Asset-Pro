const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { LineChartSVG } = require('../Charts.jsx');
const { getTotalWealthAtDate, generateMonthEnds, calcLinearRegression, calcExpRegression } = require('../../data/DataEngine.jsx');

const FutureReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  const histDates = generateMonthEnds(dateRange.from, dateRange.to);
  const histData = histDates.map(d => ({y: getTotalWealthAtDate(activeAssets, d)}));
  if(histData.length < 2) return <div>Zu wenig Historie für Regression. (Mind. 2 Monate nötig)</div>;
  
  const linReg = calcLinearRegression(histData);
  const expReg = calcExpRegression(histData);
  
  const futureMonths = [0, 3, 12, 36, 60]; 
  const startX = histData.length - 1; 
  const futureLabels = ['Heute', '+3 Monate', '+1 Jahr', '+3 Jahre', '+5 Jahre'];
  
  const linD = futureMonths.map(m => {
     let val = linReg(startX + m);
     const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
     data.scenarios.forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
     return val;
  });
  
  const expD = futureMonths.map(m => {
     let val = expReg(startX + m);
     const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
     data.scenarios.forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
     return val;
  });

  return (
    <div>
      <ReportHeader title="Zukunfts-Simulation (Regression)" subtitle="Basierend auf historischer Performance inkl. definierter Zukunftsszenarien." isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <LineChartSVG datasets={[{label:'Linear', color:'#3b82f6', dashed:true, data:linD}, {label:'Exponentiell', color:'#10b981', dashed:true, data:expD}]} labels={futureLabels} fCur={fCur} />
    </div>
  );
};
module.exports = FutureReport;