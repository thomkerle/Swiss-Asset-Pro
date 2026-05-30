const exportCSV = (data, t) => {
   let csv = t ? t('csvHeader') : "Datum;Typ;Kategorie;Asset;Betrag;Waehrung;Wechselkurs\n";
   const traverse = (nodes) => {
      nodes.forEach(n => {
         if (n.type === 'asset') {
             if (n.bookings) n.bookings.forEach(b => { csv += `${b.date};${b.type};${b.subCategory || ''};${n.name};${b.amount};${n.currency};${b.bookingExchangeRate || 1}\n`; });
             if (n.balances) n.balances.forEach(b => { 
                csv += `${b.date};${t ? t('csvBalanceDate') : 'Stichtag-Saldo'};${t ? t('csvSystem') : 'System'};${n.name};${b.amount};${n.currency};${b.bookingExchangeRate || 1}\n`; 
             });
         }
         if (n.children) traverse(n.children);
      });
   };
   if(data && data.banks) traverse(data.banks);
   return csv;
};
module.exports = { exportCSV };