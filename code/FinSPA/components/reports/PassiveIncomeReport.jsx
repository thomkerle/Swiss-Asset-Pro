const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');

const PassiveIncomeReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  let passiveSum = 0;
  
  activeAssets.forEach(a => {
      (a.bookings||[]).filter(bk => 
          bk.date >= dateRange.from && 
          bk.date <= dateRange.to && 
          ['Dividende','Zinsen','Mieteinnahmen'].includes(bk.type) // Interne Datentypen bleiben unangetastet
      ).forEach(bk => {
          passiveSum += Number(bk.amount)*(a.exchangeRate||1);
      });
  });

  // Fallbacks für Strings
  const title = t ? (t('repPassive') || "Passives Einkommen") : "Passives Einkommen";
  const subtitlePrefix = t ? (t('repPassiveSub') || "Alle Dividenden, Zinsen & Mieten zwischen") : "Alle Dividenden, Zinsen & Mieten zwischen";
  const wordAnd = t ? (t('wordAnd') || "und") : "und";
  const totalLabel = t ? (t('labelTotalPassive') || "Total Passives Einkommen") : "Total Passives Einkommen";

  return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={title} 
        subtitle={`${subtitlePrefix} ${dateRange.from} ${wordAnd} ${dateRange.to}.`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      <div className="p-8 bg-green-50 border border-green-200 rounded-xl flex flex-col items-center justify-center">
         <div className="text-sm font-bold uppercase text-green-800 tracking-wider mb-2">
           {totalLabel}
         </div>
         <div className="text-5xl font-black text-green-600">{fCur(passiveSum)}</div>
      </div>
    </div>
  );
};
module.exports = PassiveIncomeReport;