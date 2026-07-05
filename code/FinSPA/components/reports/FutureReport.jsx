const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getTotalWealthAtDate, generateMonthEnds, calcLinearRegression } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const FutureReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const histDates = generateMonthEnds(dateRange.from, dateRange.to);
  const histData = histDates.map(d => ({y: getTotalWealthAtDate(activeAssets, d)}));
  
  if(histData.length < 2) {
      return (
          <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
         
             <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
                <Icon name="AlertCircle" size={32} className="mx-auto mb-3 opacity-50"/>
                <p>{t ? t('msgNotEnoughHistory') || 'Nicht genügend Historie vorhanden, um eine verlässliche Projektion zu berechnen.' : 'Nicht genügend Historie vorhanden, um eine verlässliche Projektion zu berechnen.'}</p>
             </div>
          </div>
      );
  }
  
  // Lineare Regression für den reinen Trend (historischer Durchschnitt)
  const linReg = calcLinearRegression(histData);
  
  // Berechnung der durchschnittlichen monatlichen Sparquote/Cashflows anhand der Steigung
  const monthlyCashflow = linReg(1) - linReg(0);
  const currentWealth = histData[histData.length - 1].y;
  
  const futureMonths = [0, 3, 12, 36, 60]; 
  const startX = histData.length - 1; 
  const futureLabels = [
      t ? t('labelToday') || 'Heute' : 'Heute', 
      t ? t('labelIn3Months') || 'In 3 Monaten' : 'In 3 Monaten', 
      t ? t('labelIn1Year') || 'In 1 Jahr' : 'In 1 Jahr', 
      t ? t('labelIn3Years') || 'In 3 Jahren' : 'In 3 Jahren', 
      t ? t('labelIn5Years') || 'In 5 Jahren' : 'In 5 Jahren'
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
  const topValue = Math.max(finalLinear, ...marketCurves.map(c => c.data[4]));

  const titleText = t ? t('repSimRegTitle') || 'Zukunftssimulation' : 'Zukunftssimulation';
  const subText = t ? t('repSimRegSubProj') || 'Projektion der Vermögensentwicklung' : 'Projektion der Vermögensentwicklung';

  const loadHtml2Canvas = () => {
    return new Promise((resolve) => {
        if (window.html2canvas) return resolve(window.html2canvas);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve(window.html2canvas);
        document.head.appendChild(script);
    });
  };

  useEffect(() => {
    // Helfer-Funktion für die Datenextraktion
    const buildReportData = async () => {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        // 1. KPI Block
        const kpiBlock = document.querySelector('.kpi-future-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        // 2. Chart Block
        const chartBlock = document.querySelector('.chart-future-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: t ? t('chartDevelopmentOverTime') || 'Entwicklung über Zeit' : 'Entwicklung über Zeit', image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
        }

        // 3. Tabellendaten generieren
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        
        const tableHeaders = [
          capitalize(t ? t('labelDate') || 'Zeitpunkt' : 'Zeitpunkt'),
          capitalize(t ? t('labelLinearZero') || 'Linear (0%)' : 'Linear (0%)'),
          ...marketCurves.map(c => c.label)
        ];

        const tableBody = futureLabels.map((label, idx) => {
            const row = [label, fCur(linD[idx])];
            marketCurves.forEach(curve => {
                row.push(fCur(curve.data[idx]));
            });
            return row;
        });

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subText} (${t ? t('basisMonthlyCashflow') || 'Basis' : 'Basis'}: ${fCur(monthlyCashflow)}${t ? t('perMonthCashflow') || '/Mt. Cashflow' : '/Mt. Cashflow'})`,
          tableHeaders,
          tableBody,
          chartsData,
          data: data
        });
      } catch (err) { console.error("[FinSPA] PDF Export Error im FutureReport:", err); }
    };

    // --- NEU: BATCH EXPORT (ORCHESTRATOR) ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 9, // Letzter Report im Master-PDF
                    title: titleText,
                    subtitle: `${subText} (${t ? t('basisMonthlyCashflow') || 'Basis' : 'Basis'}: ${fCur(monthlyCashflow)}${t ? t('perMonthCashflow') || '/Mt. Cashflow' : '/Mt. Cashflow'})`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im FutureReport:", err);
                resolve(null);
            }
        });

        if (e.detail && typeof e.detail.registerPromise === 'function') {
            e.detail.registerPromise(exportPromise);
        }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    window.addEventListener('triggerPdfBatchExport', handleBatchExport);
    
    return () => {
        window.removeEventListener('triggerPdfExport', handlePdfExport);
        window.removeEventListener('triggerPdfBatchExport', handleBatchExport);
    };
  }, [futureLabels, linD, marketCurves, fCur, t, monthlyCashflow, titleText, subText, data]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">


      <div className="w-full bg-white dark:bg-transparent">
          
          {/* KPI DASHBOARD ROW */}
          <div className="kpi-future-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             {/* KPI 1: Status Quo */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Icon name="Database" size={64} className="text-blue-500" />
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="Target" size={14} className="text-blue-500"/>
                    {t ? t('labelToday') || 'Heute' : 'Heute'}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white relative z-10">
                    {fCur(currentWealth)}
                </div>
                <div className="text-xs text-gray-400 mt-2 relative z-10">
                    {t ? t('currentStartWealth') || 'Aktuelles Startvermögen' : 'Aktuelles Startvermögen'}
                </div>
             </div>

             {/* KPI 2: Linear */}
             <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400 relative overflow-hidden">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between relative z-10">
                    <span className="flex items-center gap-2">
                        <Icon name="TrendingUp" size={14} />
                        {t ? t('labelLinearZero') || 'Linear (0%)' : 'Linear (0%)'}
                    </span>
                    <span>{t ? t('fiveYearsShort') || '5 J.' : '5 J.'}</span>
                </div>
                <div className="text-2xl font-black text-slate-700 dark:text-slate-300 relative z-10">
                    {fCur(finalLinear)}
                </div>
                <div className="text-xs text-slate-500 mt-2 relative z-10">
                    {t ? t('onlyDepositsNoReturn') || 'Nur Einzahlungen, keine Rendite' : 'Nur Einzahlungen, keine Rendite'}
                </div>
             </div>

             {/* KPI 3: Konservativ */}
             <div className="bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Icon name="Activity" size={48} className="text-amber-500" />
                </div>
                <div className="text-amber-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between relative z-10">
                    <span className="flex items-center gap-2">
                        <Icon name="TrendingUp" size={14} />
                        {t ? t('cardModerate') || 'Konservativ (3%)' : 'Konservativ (3%)'}
                    </span>
                    <span>{t ? t('fiveYearsShort') || '5 J.' : '5 J.'}</span>
                </div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-400 relative z-10">
                    {fCur(finalModerate)}
                </div>
                <div className="text-xs font-medium text-amber-700/70 dark:text-amber-500/70 mt-2 relative z-10">
                    {t ? t('moderateMarketGrowth') || 'Moderates Marktwachstum' : 'Moderates Marktwachstum'}
                </div>
             </div>

             {/* KPI 4: Optimistisch */}
             <div className="bg-rose-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Icon name="Zap" size={48} className="text-rose-500" />
                </div>
                <div className="text-rose-800 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between relative z-10">
                    <span className="flex items-center gap-2">
                        <Icon name="TrendingUp" size={14} />
                        {t ? t('cardOptimistic') || 'Optimistisch (7%)' : 'Optimistisch (7%)'}
                    </span>
                    <span>{t ? t('fiveYearsShort') || '5 J.' : '5 J.'}</span>
                </div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-400 relative z-10">
                    {fCur(finalOptimistic)}
                </div>
                <div className="text-xs font-medium text-rose-700/70 dark:text-rose-500/70 mt-2 relative z-10">
                    {t ? t('historicalEtfAverage') || 'Historischer ETF-Durchschnitt' : 'Historischer ETF-Durchschnitt'}
                </div>
             </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            
            {/* CHART SEITE */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-future-export-block self-start sticky top-8">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="TrendingUp" className="text-blue-500" /> {t ? t('growthCurves') || 'Wachstumskurven' : 'Wachstumskurven'}
                </h3>
                <div ref={chartRef} style={{ width: '100%', height: '400px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="line"
                        labels={futureLabels}
                        datasets={[
                            { 
                                label: t ? t('labelLinearZero') || 'Linear (0%)' : 'Linear (0%)', 
                                data: linD,
                                backgroundColor: '#94a3b8', 
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

            {/* DETAILS SEITE (Ergebnisse nach 5 Jahren) */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* Info Panel Cashflow */}
                <div className="bg-blue-50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                    <h4 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-2 text-sm">
                        <Icon name="Info" className="text-blue-500" /> 
                        {t ? t('dataBasis') || 'Datengrundlage' : 'Datengrundlage'}
                    </h4>
                    <p className="text-xs leading-relaxed text-blue-800/80 dark:text-slate-300 mb-3">
                        {t ? t('futureCalcBasisDesc') || 'Die Zukunftsberechnung basiert auf deinem aktuellen Vermögen und extrapoliert dein bisheriges historisches Sparverhalten als fixen monatlichen Cashflow. Zukünftige Szenarien (z.B. geplante Ausgaben) sind eingerechnet.' : 'Die Zukunftsberechnung basiert auf deinem aktuellen Vermögen und extrapoliert dein bisheriges historisches Sparverhalten als fixen monatlichen Cashflow. Zukünftige Szenarien (z.B. geplante Ausgaben) sind eingerechnet.'}
                    </p>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-blue-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">{t ? t('assumedSavingsAmount') || 'Angenommener Sparbetrag' : 'Angenommener Sparbetrag'}</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">~{fCur(monthlyCashflow)} {t ? t('perMonthCashflow') || '/Mt. Cashflow' : '/Mt. Cashflow'}</span>
                    </div>
                </div>

                {/* Ranking Liste */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="Calendar" className="text-slate-500" />
                            {t ? t('forecast5Years') || 'Prognose in 5 Jahren' : 'Prognose in 5 Jahren'}
                        </div>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                
                                {/* Optimistisch */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-rose-600 dark:text-rose-400">7% p.a.</span>
                                            <span className="text-xs text-rose-500/70 font-medium">{t ? t('optimistic') || 'Optimistisch' : 'Optimistisch'}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(finalOptimistic / topValue) * 100}%` }}></div>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1">{t ? t('compoundInterestEffect') || 'Zinseszins-Effekt' : 'Zinseszins-Effekt'}: +{fCur(finalOptimistic - finalLinear)}</div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {fCur(finalOptimistic)}
                                        </span>
                                    </td>
                                </tr>

                                {/* 5% */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-orange-500">5% p.a.</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(marketCurves.find(c => c.rate === 0.05)?.data[4] / topValue) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {fCur(marketCurves.find(c => c.rate === 0.05)?.data[4])}
                                        </span>
                                    </td>
                                </tr>

                                {/* Moderat (3%) */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-amber-500">3% p.a.</span>
                                            <span className="text-xs text-amber-600/70 font-medium">{t ? t('conservative') || 'Konservativ' : 'Konservativ'}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(finalModerate / topValue) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {fCur(finalModerate)}
                                        </span>
                                    </td>
                                </tr>

                                {/* 2% */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-emerald-500">2% p.a.</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(marketCurves.find(c => c.rate === 0.02)?.data[4] / topValue) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {fCur(marketCurves.find(c => c.rate === 0.02)?.data[4])}
                                        </span>
                                    </td>
                                </tr>

                                {/* 1% */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-sky-500">1% p.a.</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(marketCurves.find(c => c.rate === 0.01)?.data[4] / topValue) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {fCur(marketCurves.find(c => c.rate === 0.01)?.data[4])}
                                        </span>
                                    </td>
                                </tr>

                                {/* Linear 0% */}
                                <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group bg-slate-50/50 dark:bg-slate-800/20">
                                    <td className="p-4 pl-5 w-full">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-slate-500">0% p.a.</span>
                                            <span className="text-xs text-slate-400 font-medium">{t ? t('linearBase') || 'Linear / Base' : 'Linear / Base'}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(finalLinear / topValue) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-5 text-right align-middle">
                                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                                            {fCur(finalLinear)}
                                        </span>
                                    </td>
                                </tr>

                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
          </div>
      </div>
    </div>
  );
};

module.exports = FutureReport;