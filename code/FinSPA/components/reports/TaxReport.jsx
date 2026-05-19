const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const TaxReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const year = new Date(dateRange.to).getFullYear();
  const taxDate = `${year}-12-31`;
  
  let totalWealth = 0; let totalDebts = 0; const rows = [];
  
  data.banks.forEach(bank => {
      if (bank.isArchived) return;
      let bankTotal = 0; const bankAssets = [];
      const traverse = (nodes) => {
         nodes.forEach(n => {
            if (n.type === 'asset' && !n.isArchived) {
                const val = getAssetValueAtDate(n, taxDate);
                if (val !== 0) { 
                    bankAssets.push({ name: n.name, class: n.assetClass, val }); 
                    if (val > 0) totalWealth += val; 
                    else totalDebts += Math.abs(val); 
                    bankTotal += val; 
                }
            }
            if (n.children) traverse(n.children);
         });
      };
      traverse(bank.children || []);
      if (bankAssets.length > 0) {
          rows.push({ isBank: true, name: bank.name, val: bankTotal });
          bankAssets.forEach(a => rows.push({ isBank: false, ...a }));
      }
  });

  // String Fallbacks
  const title = t ? (t('repTax') || "Steuerreport (Vermögen)") : "Steuerreport (Vermögen)";
  const taxDateLabel = t ? (t('labelTaxDate') || "Stichtag für Steuererklärung:") : "Stichtag für Steuererklärung:";
  const grossWealthLabel = t ? (t('labelGrossWealth') || "Bruttovermögen") : "Bruttovermögen";
  const debtsLabel = t ? (t('labelDebts') || "Schulden") : "Schulden";
  const taxableWealthLabel = t ? (t('labelTaxableWealth') || "Steuerbares Reinvermögen") : "Steuerbares Reinvermögen";
  const positionLabel = t ? (t('labelPosition') || "Position") : "Position";
  const taxValueAtLabel = t ? (t('labelTaxValueAt') || "Steuerwert am") : "Steuerwert am";

  return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={title} 
        subtitle={`${taxDateLabel} ${taxDate}`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      <div className="grid grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
             <div className="text-sm font-bold uppercase mb-1 text-gray-500">{grossWealthLabel}</div>
             <div className="text-2xl font-black text-green-600">{fCur(totalWealth)}</div>
         </div>
         <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
             <div className="text-sm font-bold uppercase mb-1 text-gray-500">{debtsLabel}</div>
             <div className="text-2xl font-black text-red-600">-{fCur(totalDebts)}</div>
         </div>
         <div className="p-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900 rounded-xl shadow-sm">
             <div className="text-sm font-bold uppercase mb-1 text-blue-800 dark:text-blue-300">{taxableWealthLabel}</div>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur(totalWealth - totalDebts)}</div>
         </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr>
                    <th className="p-4">{positionLabel}</th>
                    <th className="p-4 text-right">{taxValueAtLabel} {taxDate}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
               {rows.map((r, i) => (
                  <tr key={i} className={r.isBank ? "bg-gray-50 dark:bg-slate-800/50 font-bold" : ""}>
                     <td className={`p-4 ${!r.isBank ? 'pl-8 text-gray-600 dark:text-gray-300' : ''}`}>
                         {r.name} 
                         {r.class ? <span className="text-[10px] bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded ml-2 uppercase">{r.class}</span> : ''}
                     </td>
                     <td className={`p-4 text-right ${r.val < 0 ? 'text-red-500' : ''}`}>{fCur(r.val)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};
module.exports = TaxReport;