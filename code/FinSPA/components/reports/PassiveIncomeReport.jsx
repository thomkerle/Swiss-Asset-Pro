const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');

const PassiveIncomeReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur }) => {
  let passiveSum = 0;
  activeAssets.forEach(a => {
      (a.bookings||[]).filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to && ['Dividende','Zinsen','Mieteinnahmen'].includes(bk.type)).forEach(bk => {
          passiveSum += Number(bk.amount)*(a.exchangeRate||1);
      });
  });
  return (
    <div>
      <ReportHeader title="Passives Einkommen" subtitle={`Alle Dividenden, Zinsen & Mieten zwischen ${dateRange.from} und ${dateRange.to}.`} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      <div className="p-8 bg-green-50 border border-green-200 rounded-xl flex flex-col items-center justify-center">
         <div className="text-sm font-bold uppercase text-green-800 tracking-wider mb-2">Total Passives Einkommen</div>
         <div className="text-5xl font-black text-green-600">{fCur(passiveSum)}</div>
      </div>
    </div>
  );
};
module.exports = PassiveIncomeReport;