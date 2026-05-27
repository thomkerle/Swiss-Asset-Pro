const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const TaxReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const year = new Date(dateRange.to).getFullYear();
  const taxDate = `${year}-12-31`;
  
  let totalWealth = 0; 
  let totalDebts = 0; 
  const rows = [];
  
  data.banks.forEach(bank => {
      if (bank.isArchived) return;
      let bankTotal = 0; 
      const bankAssets = [];
      const traverse = (nodes) => {
         nodes.forEach(n => {
            if (n.type === 'asset' && !n.isArchived) {
                // Bei Steuern ist der Stichtag immer der 31.12. des gewählten Jahres
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
          // Zuerst den Bank-Header einfügen
          rows.push({ isBank: true, name: bank.name, val: bankTotal });
          // Dann die zugehörigen Assets
          bankAssets.forEach(a => rows.push({ isBank: false, ...a }));
      }
  });

  // Chart-Daten für Bruttovermögensverteilung (nur positive Bank-Salden)
  const chartLabels = [];
  const chartData = [];
  rows.filter(r => r.isBank && r.val > 0).forEach(b => {
      chartLabels.push(b.name);
      chartData.push(b.val);
  });

  // String Fallbacks für Lokalisierung
  const title = t ? (t('repTax') || "Steuerreport (Vermögen)") : "Steuerreport (Vermögen)";
  const taxDateLabel = t ? (t('labelTaxDate') || "Stichtag für Steuererklärung:") : "Stichtag für Steuererklärung:";
  const grossWealthLabel = t ? (t('labelGrossWealth') || "Bruttovermögen") : "Bruttovermögen";
  const debtsLabel = t ? (t('labelDebts') || "Schulden") : "Schulden";
  const taxableWealthLabel = t ? (t('labelTaxableWealth') || "Steuerbares Reinvermögen") : "Steuerbares Reinvermögen";
  const positionLabel = t ? (t('labelPosition') || "Position") : "Position";
  const taxValueAtLabel = t ? (t('labelTaxValueAt') || "Steuerwert am") : "Steuerwert am";

  // PDF Export Listener
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(positionLabel),
          capitalize(`${taxValueAtLabel} ${taxDate}`)
        ];

        // Die Banken als Header-Reihen behandeln (Einrückung für Unterelemente simulieren)
        const tableBody = rows.map(r => [
          r.isBank ? r.name.toUpperCase() : `   ${r.name}`,
          fCur(r.val)
        ]);

        // Leerzeile und dann die Summen unten an die PDF-Tabelle anhängen
        tableBody.push(['', '']);
        tableBody.push([grossWealthLabel.toUpperCase(), fCur(totalWealth)]);
        tableBody.push([debtsLabel.toUpperCase(), `-${fCur(totalDebts)}`]);
        tableBody.push([taxableWealthLabel.toUpperCase(), fCur(totalWealth - totalDebts)]);

        await PdfExportEngine.exportReport({
          title: title,
          subtitle: `${taxDateLabel} ${taxDate} | Netto: ${fCur(totalWealth - totalDebts)}`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im TaxReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [rows, totalWealth, totalDebts, taxDate, fCur, title, taxDateLabel, grossWealthLabel, debtsLabel, taxableWealthLabel, positionLabel, taxValueAtLabel]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={title} 
        subtitle={`${taxDateLabel} ${taxDate}`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm font-bold uppercase mb-1 text-gray-500">{grossWealthLabel}</div>
             <div className="text-2xl font-black text-green-600 dark:text-green-500">{fCur(totalWealth)}</div>
         </div>
         <div className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm font-bold uppercase mb-1 text-gray-500">{debtsLabel}</div>
             <div className="text-2xl font-black text-red-600 dark:text-red-500">-{fCur(totalDebts)}</div>
         </div>
         <div className="p-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-sm">
             <div className="text-sm font-bold uppercase mb-1 text-blue-800 dark:text-blue-300">{taxableWealthLabel}</div>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur(totalWealth - totalDebts)}</div>
         </div>
      </div>

      {/* NEU: Visuelle Aufbereitung der Vermögensverteilung für das PDF und UI */}
      {chartData.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm mb-8">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                 <Icon name="PieChart" className="text-blue-500" /> Vermögensverteilung (Brutto)
              </h3>
              <div ref={chartRef} style={{ width: '100%', height: '300px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="doughnut"
                      labels={chartLabels}
                      datasets={[{
                          label: grossWealthLabel,
                          data: chartData
                      }]}
                      height="100%"
                  />
              </div>
          </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 text-gray-700 dark:text-gray-300 font-bold">{positionLabel}</th>
                    <th className="p-4 text-right text-gray-700 dark:text-gray-300 font-bold">{taxValueAtLabel} {taxDate}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
               {rows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 ${r.isBank ? "bg-gray-50 dark:bg-slate-800/50 font-bold text-slate-800 dark:text-slate-200" : ""}`}>
                     <td className={`p-4 ${!r.isBank ? 'pl-8 text-gray-600 dark:text-gray-300' : ''}`}>
                         {r.name} 
                         {r.class ? <span className="text-[10px] bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 font-medium px-2 py-0.5 rounded ml-2 uppercase tracking-wider">{r.class}</span> : ''}
                     </td>
                     <td className={`p-4 text-right ${r.val < 0 ? 'text-red-500 font-medium' : ''}`}>{fCur(r.val)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};
module.exports = TaxReport;