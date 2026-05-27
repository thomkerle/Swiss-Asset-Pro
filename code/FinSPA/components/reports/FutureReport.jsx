const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const UniversalChart = require('../../api/UniversalChart.jsx');
const { getTotalWealthAtDate, generateMonthEnds, calcLinearRegression } = require('../../data/DataEngine.jsx');

const FutureReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

  const histDates = generateMonthEnds(dateRange.from, dateRange.to);
  const histData = histDates.map(d => ({y: getTotalWealthAtDate(activeAssets, d)}));
  
  if(histData.length < 2) {
      return <div className="p-10 text-center text-gray-500 font-medium">{t ? t('msgNotEnoughHistory') : 'Nicht genügend Historie vorhanden'}</div>;
  }
  
  // Lineare Regression für den reinen Trend (historischer Durchschnitt)
  const linReg = calcLinearRegression(histData);
  
  // Berechnung der durchschnittlichen monatlichen Sparquote/Cashflows anhand der Steigung
  const monthlyCashflow = linReg(1) - linReg(0);
  const currentWealth = histData[histData.length - 1].y;
  
  const futureMonths = [0, 3, 12, 36, 60]; 
  const startX = histData.length - 1; 
  const futureLabels = [
      t ? t('labelToday') : 'Heute', 
      t ? t('label3Months') : 'In 3 Monaten', 
      t ? t('label1Year') : 'In 1 Jahr', 
      t ? t('label3Years') : 'In 3 Jahren', 
      t ? t('label5Years') : 'In 5 Jahren'
  ];
  
  // 1. Modell: Stumpf Linear (Ohne Rendite, nur Sparquote)
  const linD = futureMonths.map(m => {
     let val = linReg(startX + m);
     const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
     (data.scenarios || []).forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
     return val;
  });

  // Definition der gewünschten Rendite-Szenarien inkl. Farben
  const rates = [
      { rate: 0.01, label: '1% p.a.', color: '#0ea5e9' }, // Sky Blue
      { rate: 0.02, label: '2% p.a.', color: '#10b981' }, // Emerald
      { rate: 0.03, label: '3% p.a.', color: '#eab308' }, // Yellow
      { rate: 0.05, label: '5% p.a.', color: '#f97316' }, // Orange
      { rate: 0.07, label: '7% p.a.', color: '#ef4444' }  // Red
  ];

  // 2. Berechnung der verschiedenen Marktrendite-Kurven
  const marketCurves = rates.map(r => ({
      ...r,
      data: futureMonths.map(m => {
         let val;
         if (m === 0) {
             val = currentWealth;
         } else {
             const q = 1 + (r.rate / 12);
             const compoundInterest = currentWealth * Math.pow(q, m);
             
             // Rentenrechnung: Zinseszins auf die laufenden monatlichen Einzahlungen
             const savingsGrowth = monthlyCashflow > 0 
                ? monthlyCashflow * ((Math.pow(q, m) - 1) / (r.rate / 12))
                : monthlyCashflow * m; 

             val = compoundInterest + savingsGrowth;
         }

         const futureDate = new Date(); futureDate.setMonth(futureDate.getMonth() + m);
         (data.scenarios || []).forEach(sc => { if (new Date(sc.date) <= futureDate) val += Number(sc.impact); });
         return val;
      })
  }));

  // Endwerte nach 5 Jahren (Index 4 im Array) für die Summary-Cards
  const finalLinear = linD[4] || 0;
  const finalModerate = marketCurves.find(c => c.rate === 0.03)?.data[4] || 0;
  const finalOptimistic = marketCurves.find(c => c.rate === 0.07)?.data[4] || 0;

  // Event-Listener für den PDF-Export
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        
        // Dynamische Tabellen-Header erstellen
        const tableHeaders = [
          capitalize(t ? t('labelDate') || 'Zeitpunkt' : 'Zeitpunkt'),
          capitalize(t ? t('labelLinear') || 'Linear (0%)' : 'Linear (0%)'),
          ...marketCurves.map(c => c.label)
        ];

        // Dynamische Tabellen-Zeilen erstellen
        const tableBody = futureLabels.map((label, idx) => {
            const row = [label, fCur(linD[idx])];
            marketCurves.forEach(curve => {
                row.push(fCur(curve.data[idx]));
            });
            return row;
        });

        await PdfExportEngine.exportReport({
          title: t ? t('repSimRegTitle') || 'Zukunftssimulation' : 'Zukunftssimulation',
          subtitle: t ? t('repSimRegSub') || 'Projektion der Vermögensentwicklung' : 'Projektion der Vermögensentwicklung',
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im FutureReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [futureLabels, linD, marketCurves, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repSimRegTitle') : 'Zukunftssimulation'} 
        subtitle={t ? t('repSimRegSub') : 'Projektion der Vermögensentwicklung'} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-4">
         <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
             <div className="text-sm text-slate-500 font-bold uppercase mb-1 flex justify-between">
                 <span>Linear (0%)</span>
                 <span>(5 Jahre)</span>
             </div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(finalLinear)}</div>
             <div className="text-xs text-gray-500 mt-2">
                 Nur Einzahlungen ({fCur(monthlyCashflow)}/Mt.), ohne Rendite.
             </div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-yellow-600 dark:text-yellow-500 font-bold uppercase mb-1 flex justify-between">
                 <span>Konservativ (3%)</span>
                 <span>(5 Jahre)</span>
             </div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(finalModerate)}</div>
             <div className="text-xs text-gray-500 mt-2">
                 Moderates Marktwachstum inkl. Zinseszins.
             </div>
         </div>

         <div className="p-6 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl shadow-sm">
             <div className="text-sm text-red-600 dark:text-red-500 font-bold uppercase mb-1 flex justify-between">
                 <span>Optimistisch (7%)</span>
                 <span>(5 Jahre)</span>
             </div>
             <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(finalOptimistic)}</div>
             <div className="text-xs text-gray-500 mt-2">
                 Starke Marktentwicklung (historischer ETF-Durchschnitt).
             </div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div ref={chartRef} style={{ width: '100%', height: '400px' }}>
          <UniversalChart 
            engine={activeChartEngine}
            type="line"
            labels={futureLabels}
            datasets={[
              { 
                label: t ? t('labelLinear') || 'Linear (0%)' : 'Linear (0%)', 
                data: linD,
                backgroundColor: '#94a3b8', // Dezentes Grau für die Basislinie
                valueFormatter: fCur
              }, 
              ...marketCurves.map(curve => ({
                  label: curve.label,
                  data: curve.data,
                  backgroundColor: curve.color,
                  valueFormatter: fCur
              }))
            ]} 
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};

module.exports = FutureReport;