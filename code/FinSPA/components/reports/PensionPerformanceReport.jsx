const React = require('react');
const { useState, useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};

const { getAssetValueAtDate = () => 0, generateMonthEnds = (s,e) => [s,e] } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);

const PensionPerformanceReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const [calcMethod, setCalcMethod] = useState('cumulative');

  const pensionClasses = ['pension_cash', 'pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'];
  const pensionAssets = (activeAssets || []).filter(a => pensionClasses.includes(a.assetClass));
  
  const pillar2Assets = pensionAssets.filter(a => a.assetClass === 'pension_cash');
  const pillar3Assets = pensionAssets.filter(a => ['pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(a.assetClass));

  if (pensionAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <ReportHeader title={t ? t('repPensionTitle') || "Vorsorge & Pensionskasse" : "Vorsorge & Pensionskasse"} subtitle={t ? t('repPensionSub') || "Performance der 2. und 3. Säule" : "Performance der 2. und 3. Säule"} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('noPensionData') || 'Keine Pensionskassen oder Säule 3a Konten/Depots gefunden.' : 'Keine Pensionskassen oder Säule 3a Konten/Depots gefunden.'}</p>
        </div>
      </div>
    );
  }

  let earliestDate = dateRange?.from;
  if (!earliestDate) {
      earliestDate = new Date().toISOString().split('T')[0];
      pensionAssets.forEach(asset => {
          (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
          (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      });
  }

  const todayStr = dateRange?.to || new Date().toISOString().split('T')[0];

  const calculateCumulativeStats = (asset, targetDate) => {
      let invested = 0;
      let yields = 0;
      
      let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
      let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
      let baseDate = '1970-01-01';

      if (applicableBalance) {
          invested = applicableBalance.amount;
          baseDate = applicableBalance.date;
      }

      (asset.bookings || []).forEach(bk => {
          if (bk.date <= targetDate) {
              if (bk.type === 'Dividende') yields += Number(bk.amount);
              if (bk.type === 'Einzahlung' && bk.subCategory === 'Zinsen') yields += Number(bk.amount);
              if (bk.type === 'Zinszahlung' && Number(bk.amount) > 0) yields += Number(bk.amount);
          }

          if (applicableBalance) {
              if (bk.date > baseDate && bk.date <= targetDate) {
                  if (['Kauf'].includes(bk.type)) invested += Number(bk.amount);
                  if (['Einzahlung'].includes(bk.type) && bk.subCategory !== 'Zinsen') invested += Number(bk.amount);
                  if (['Verkauf', 'Auszahlung'].includes(bk.type)) invested -= Number(bk.amount);
              }
          } else {
              if (bk.date <= targetDate) {
                  if (['Kauf'].includes(bk.type)) invested += Number(bk.amount);
                  if (['Einzahlung'].includes(bk.type) && bk.subCategory !== 'Zinsen') invested += Number(bk.amount);
                  if (['Verkauf', 'Auszahlung'].includes(bk.type)) invested -= Number(bk.amount);
              }
          }
      });
      
      const rate = applicableBalance?.bookingExchangeRate || asset.exchangeRate || 1;
      return { invested: invested * rate, yields: yields * rate, delta: invested * rate };
  };

  const calculatePeriodicStats = (asset, startDate, targetDate) => {
      const hasHistoryBeforeStart = (asset.balances || []).some(b => b.date <= startDate) || 
                                    (asset.bookings || []).some(b => b.date <= startDate);
      
      const actualStart = hasHistoryBeforeStart ? (getAssetValueAtDate(asset, startDate, activeAssets) || 0) : 0;
      
      const cumStart = calculateCumulativeStats(asset, startDate);
      const cumTarget = calculateCumulativeStats(asset, targetDate);

      return { 
          invested: actualStart + (cumTarget.invested - cumStart.invested), 
          yields: cumTarget.yields - cumStart.yields,
          delta: cumTarget.invested - cumStart.invested 
      };
  };

  let monthlyDates = generateMonthEnds(earliestDate, todayStr);
  if (!monthlyDates.includes(earliestDate)) monthlyDates.push(earliestDate);
  if (!monthlyDates.includes(todayStr)) monthlyDates.push(todayStr);
  
  monthlyDates.sort((a, b) => new Date(a) - new Date(b));
  monthlyDates = [...new Set(monthlyDates)];

  if (monthlyDates.length < 2) {
      const lastMonth = new Date(todayStr);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const prev = lastMonth.toISOString().split('T')[0];
      monthlyDates.unshift(prev);
  }

  let monthlyDataPoints = monthlyDates.map(targetDate => {
      let p2Invested = 0, p2Actual = 0, p2Yields = 0, p2Delta = 0, p2PriceProfit = 0;
      let p3Invested = 0, p3Actual = 0, p3Yields = 0, p3Delta = 0, p3PriceProfit = 0;

      pillar2Assets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          let pp = act - stats.invested;
          if (['pension_cash', 'pension_3a_cash', 'pension_3a_managed'].includes(asset.assetClass)) pp -= stats.yields;

          p2Invested += stats.invested;
          p2Yields += stats.yields;
          p2Delta += stats.delta || 0;
          p2Actual += act;
          p2PriceProfit += pp;
      });

      pillar3Assets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          let pp = act - stats.invested;
          if (['pension_cash', 'pension_3a_cash', 'pension_3a_managed'].includes(asset.assetClass)) pp -= stats.yields;

          p3Invested += stats.invested;
          p3Yields += stats.yields;
          p3Delta += stats.delta || 0;
          p3Actual += act;
          p3PriceProfit += pp;
      });

      const totalInvested = p2Invested + p3Invested;
      const totalActual = p2Actual + p3Actual;
      const totalYields = p2Yields + p3Yields;
      const totalDelta = p2Delta + p3Delta;
      
      const priceProfit = p2PriceProfit + p3PriceProfit;
      const profit = priceProfit + totalYields;

      return {
          dateStr: targetDate,
          p2: { invested: p2Invested, actual: p2Actual, yields: p2Yields, delta: p2Delta },
          p3: { invested: p3Invested, actual: p3Actual, yields: p3Yields, delta: p3Delta },
          total: {
              invested: totalInvested,
              actual: totalActual,
              yields: totalYields,
              delta: totalDelta,
              priceProfit: priceProfit,
              priceRoi: totalInvested > 0 ? (priceProfit / totalInvested) * 100 : 0,
              profit: profit,
              roi: totalInvested > 0 ? (profit / totalInvested) * 100 : 0
          }
      };
  });

  const firstValidIndex = monthlyDataPoints.findIndex(d => d.total.invested > 0 || d.total.actual > 0 || d.total.yields !== 0);
  if (firstValidIndex > 0) {
      monthlyDataPoints = monthlyDataPoints.slice(firstValidIndex);
  }

  const latestData = monthlyDataPoints[monthlyDataPoints.length - 1]?.total || { invested: 0, actual: 0, delta: 0, priceProfit: 0, profit: 0, priceRoi: 0, roi: 0 };

  const currentStats = {
      pension_cash: { invested: 0, actual: 0, yields: 0, delta: 0 },
      pension_3a_cash: { invested: 0, actual: 0, yields: 0, delta: 0 },
      pension_3a_fund: { invested: 0, actual: 0, yields: 0, delta: 0 },
      pension_3a_managed: { invested: 0, actual: 0, yields: 0, delta: 0 }
  };

  pensionAssets.forEach(asset => {
      const stats = calcMethod === 'cumulative'
          ? calculateCumulativeStats(asset, todayStr)
          : calculatePeriodicStats(asset, earliestDate, todayStr);
      const act = getAssetValueAtDate(asset, todayStr, activeAssets);
      if (currentStats[asset.assetClass]) {
          currentStats[asset.assetClass].invested += stats.invested;
          currentStats[asset.assetClass].yields += stats.yields;
          currentStats[asset.assetClass].delta += stats.delta || 0;
          currentStats[asset.assetClass].actual += act;
      }
  });

  const repTitle = t ? t('repPensionTitle') || "Vorsorge & Pensionskasse" : "Vorsorge & Pensionskasse";
  const repSub = t ? t('repPensionSub') || "Rendite-Analyse der 2. und 3. Säule" : "Rendite-Analyse der 2. und 3. Säule";

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

        const captureBlock = async (selector, titleFallback = '') => {
            const el = document.querySelector(selector);
            if (el) {
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0) });
            }
        };

        await captureBlock('.dashboard-top-export-block', ''); 

        if (chartRef.current) {
            const containers = chartRef.current.querySelectorAll('.chart-export-block');
            for (let i = 0; i < containers.length; i++) {
                const titleFallback = containers[i].getAttribute('data-pdf-title') || '';
                const canvas = await html2canvas(containers[i], { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0) }); 
            }
        }

        // Flache Tabellen-Struktur, die von der Batch-Engine perfekt verarbeitet werden kann
        const tableHeaders = [
            t ? t('colMonth') || 'Monat' : 'Monat',
            t ? t('colPill2Inv') || 'Säule 2 (Inv.)' : 'Säule 2 (Inv.)',
            t ? t('colPill2Val') || 'Säule 2 (Wert)' : 'Säule 2 (Wert)',
            t ? t('colPill3Inv') || 'Säule 3a (Inv.)' : 'Säule 3a (Inv.)',
            t ? t('colPill3Val') || 'Säule 3a (Wert)' : 'Säule 3a (Wert)',
            t ? t('colTotalInv') || 'Total (Inv.)' : 'Total (Inv.)',
            t ? t('colTotalVal') || 'Total (Wert)' : 'Total (Wert)',
            t ? t('labelPriceProfit') || 'Kursgewinn' : 'Kursgewinn',
            t ? t('labelYields') || 'Erträge' : 'Erträge',
            t ? t('labelTotalReturn') || 'Total Return' : 'Total Return'
        ];
        
        const tableBody = monthlyDataPoints.slice().reverse().map(d => {
            const dateObj = new Date(d.dateStr);
            const formattedDate = dateObj.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }); 
            return [
              formattedDate, 
              fCur(d.p2.invested), fCur(d.p2.actual), 
              fCur(d.p3.invested), fCur(d.p3.actual), 
              fCur(d.total.invested), fCur(d.total.actual),
              `${d.total.priceProfit > 0 ? '+' : ''}${fCur(d.total.priceProfit)}`, 
              `+${fCur(d.total.yields)}`, 
              `${d.total.roi > 0 ? '+' : ''}${d.total.roi.toFixed(2)} %`
            ];
        });

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const transCalcMethod = calcMethod === 'cumulative' ? (t ? t('calcCumulative') || 'Kumuliert' : 'Kumuliert') : (t ? t('calcPeriodic') || 'Zeitraum' : 'Zeitraum');
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: `${repTitle} (${transCalcMethod})`,
          subtitle: repSub,
          tableHeaders, 
          tableBody, 
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im PensionPerformanceReport:", err);
      }
    };

    // --- NEU: BATCH EXPORT (ORCHESTRATOR) ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const transCalcMethod = calcMethod === 'cumulative' ? (t ? t('calcCumulative') || 'Kumuliert' : 'Kumuliert') : (t ? t('calcPeriodic') || 'Zeitraum' : 'Zeitraum');
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 10, 
                    title: `${repTitle} (${transCalcMethod})`,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im PensionPerformanceReport:", err);
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
  }, [monthlyDataPoints, fCur, t, repTitle, repSub, data, calcMethod]);

  const chartLabels = monthlyDataPoints.map(d => {
      const dateObj = new Date(d.dateStr);
      const isLastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate() === dateObj.getDate();
      if (!isLastDay) return `${('0'+dateObj.getDate()).slice(-2)}.${('0'+(dateObj.getMonth()+1)).slice(-2)}.${dateObj.getFullYear().toString().slice(-2)}`;
      return `${('0'+(dateObj.getMonth()+1)).slice(-2)}.${dateObj.getFullYear().toString().slice(-2)}`;
  });

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12">
      <ReportHeader title={repTitle} subtitle={repSub} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />

      <div className="print-hide flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 mb-8 gap-3 shadow-sm">
         <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Icon name="Activity" size={14} className="text-blue-500"/>
            {t ? t('methodDashMetrics') || 'Berechnungsmethode für Dashboard-Metriken:' : 'Berechnungsmethode für Dashboard-Metriken:'}
         </div>
         <div className="flex bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 text-xs font-semibold self-stretch sm:self-auto justify-between sm:justify-start">
            <button 
                onClick={() => setCalcMethod('cumulative')}
                className={`px-4 py-1.5 rounded-md transition-all ${calcMethod === 'cumulative' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                {t ? t('methodCumLong') || 'Kumuliert (Gesamthistorie)' : 'Kumuliert (Gesamthistorie)'}
            </button>
            <button 
                onClick={() => setCalcMethod('periodic')}
                className={`px-4 py-1.5 rounded-md transition-all ${calcMethod === 'periodic' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                {t ? t('methodPerLong') || 'Perioden-isoliert (Zeitraum-Delta)' : 'Perioden-isoliert (Zeitraum-Delta)'}
            </button>
         </div>
      </div>

      <div className="dashboard-top-export-block w-full bg-white dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                    {calcMethod === 'cumulative' ? (t ? t('netInvestedTotal') || 'Netto Investiert (Total)' : 'Netto Investiert (Total)') : (t ? t('workingCapital') || 'Arbeitendes Kapital' : 'Arbeitendes Kapital')}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {fCur ? fCur(latestData.invested, 'CHF') : latestData.invested}
                </div>
                
                {calcMethod === 'periodic' && (
                    <div className={`text-sm font-bold mt-2 flex items-center gap-1.5 ${latestData.delta >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>
                        <Icon name={latestData.delta >= 0 ? "TrendingUp" : "TrendingDown"} size={14} prefix="" /> 
                        {latestData.delta > 0 ? '+' : ''}{fCur ? fCur(latestData.delta, 'CHF') : latestData.delta} {t ? t('netInflow') || 'Netto-Zufluss' : 'Netto-Zufluss'}
                    </div>
                )}
                
                <div className="text-xs text-gray-400 mt-2">
                    {calcMethod === 'cumulative' 
                        ? (t ? t('histDeposits') || 'Historische Einzahlungen' : 'Historische Einzahlungen') 
                        : `${t ? t('baseValuePlusInflows') || 'Basiswert' : 'Basiswert'} (${new Date(earliestDate).toLocaleDateString('de-CH')}) + ${t ? t('inflows') || 'Zuflüsse' : 'Zuflüsse'}`
                    }
                </div>
             </div>
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('marketValueEnd') || 'Marktwert per Ende' : 'Marktwert per Ende'}</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur ? fCur(latestData.actual, 'CHF') : latestData.actual}</div>
                <div className="text-xs text-gray-400 mt-2">{t ? t('statusAsOf') || 'Stand per' : 'Stand per'} {new Date(todayStr).toLocaleDateString('de-CH')}</div>
             </div>
             
             <div className={`border p-6 rounded-2xl shadow-sm ${latestData.priceProfit >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-green-400'}`}>
                    {t ? t('priceProfitInterval') || 'Kursgewinn im Intervall' : 'Kursgewinn im Intervall'}
                </div>
                <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-green-400'}`}>
                   {latestData.priceProfit > 0 ? '+' : ''}{fCur ? fCur(latestData.priceProfit, 'CHF') : latestData.priceProfit}
                   <span className="text-sm font-medium opacity-70">({latestData.priceRoi > 0 ? '+' : ''}{latestData.priceRoi.toFixed(2)}%)</span>
                </div>
             </div>
             
             <div className={`border p-6 rounded-2xl shadow-sm ${latestData.profit >= 0 ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'}`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {t ? t('labelTotalReturnYields') || 'Total Return (inkl. Erträge)' : 'Total Return (inkl. Erträge)'}
                </div>
                <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>
                   {latestData.profit > 0 ? '+' : ''}{fCur ? fCur(latestData.profit, 'CHF') : latestData.profit}
                   <span className="text-sm font-medium opacity-70">({latestData.roi > 0 ? '+' : ''}{latestData.roi.toFixed(2)}%)</span>
                </div>
             </div>
          </div>

          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">{t ? t('labelBreakdownByAssetClass') || 'Aufschlüsselung nach Anlageklasse' : 'Aufschlüsselung nach Anlageklasse'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {pensionClasses.map(cls => {
                const stats = currentStats[cls];
                if (stats.invested === 0 && stats.actual === 0 && stats.yields === 0) return null;
                
                let priceProfit = stats.actual - stats.invested;
                if (['pension_cash', 'pension_3a_cash', 'pension_3a_managed'].includes(cls)) {
                    priceProfit -= stats.yields;
                }
                
                const totalProfit = priceProfit + stats.yields;
                const roi = stats.invested > 0 ? (totalProfit / stats.invested) * 100 : 0;
                const isPos = totalProfit >= 0;
                
                const titleMap = { 
                    'pension_cash': t ? t('titlePensionCash') || 'Pensionskasse' : 'Pensionskasse', 
                    'pension_3a_cash': t ? t('titlePension3aCash') || '3a Vorsorgekonto' : '3a Vorsorgekonto', 
                    'pension_3a_fund': t ? t('titlePension3aFund') || '3a Vorsorgefonds' : '3a Vorsorgefonds',
                    'pension_3a_managed': t ? t('titlePension3aManaged') || '3a Fondslösung (Gesamtwert)' : '3a Fondslösung (Gesamtwert)'
                };
                const iconMap = { 'pension_cash': 'Building', 'pension_3a_cash': 'Lock', 'pension_3a_fund': 'TrendingUp', 'pension_3a_managed': 'Activity' };

                return (
                    <div key={cls} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold border-b border-gray-100 dark:border-slate-800 pb-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                               <Icon name={iconMap[cls]} size={16} />
                            </div>
                            {titleMap[cls]}
                        </div>
                        <div className="space-y-3 text-sm flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">
                                    {calcMethod === 'cumulative' 
                                        ? (t ? t('labelInvested') || 'Investiert:' : 'Investiert:') 
                                        : (t ? t('labelBasePlusInflows') || 'Basis + Zuflüsse:' : 'Basis + Zuflüsse:')}
                                </span>
                                <span className="font-mono">{fCur ? fCur(stats.invested, 'CHF') : stats.invested}</span>
                            </div>
                            
                            {calcMethod === 'periodic' && (
                                <div className="flex justify-between items-center text-xs mt-1 border-b border-dashed border-gray-100 dark:border-slate-800 pb-1 mb-1">
                                    <span className="text-gray-400 pl-2">{t ? t('labelNetInflowPeriod') || '↳ Netto-Zufluss (Periode):' : '↳ Netto-Zufluss (Periode):'}</span>
                                    <span className={`font-mono font-bold ${stats.delta >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                        {stats.delta > 0 ? '+' : ''}{fCur ? fCur(stats.delta, 'CHF') : stats.delta}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t ? t('labelYieldsInterestDiv') || 'Erträge (Zinsen/Div):' : 'Erträge (Zinsen/Div):'}</span>
                                <span className="font-mono text-indigo-500">+{fCur ? fCur(stats.yields, 'CHF') : stats.yields}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t ? t('labelEndMarketValue') || 'End-Marktwert:' : 'End-Marktwert:'}</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fCur ? fCur(stats.actual, 'CHF') : stats.actual}</span>
                            </div>
                        </div>
                        <div className={`mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between font-bold ${isPos ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            <span>{t ? t('labelResult') || 'Ergebnis:' : 'Ergebnis:'} {isPos ? '+' : ''}{fCur ? fCur(totalProfit, 'CHF') : totalProfit}</span>
                            <span>{isPos ? '+' : ''}{roi.toFixed(2)}%</span>
                        </div>
                    </div>
                );
            })}
          </div>
      </div>

      {monthlyDataPoints.length > 1 && (
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8" ref={chartRef}>
            
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
               data-pdf-title={`${t ? t('devPension2') || 'Entwicklung Pensionskasse (2. Säule)' : 'Entwicklung Pensionskasse (2. Säule)'} - ${calcMethod === 'cumulative' ? (t ? t('labelAbsolute') || 'Absolut' : 'Absolut') : (t ? t('labelInterval') || 'Intervall' : 'Intervall')}`}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Icon name="Building" className="text-blue-500" /> {t ? t('devPension2') || 'Entwicklung Pensionskasse (2. Säule)' : 'Entwicklung Pensionskasse (2. Säule)'}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="line"
                        showDataLabels={false}
                        labels={chartLabels}
                        datasets={[
                            {
                                name: calcMethod === 'cumulative' ? (t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert') : (t ? t('workingCapital') || 'Arbeitendes Kapital' : 'Arbeitendes Kapital'),
                                data: monthlyDataPoints.map(d => d.p2.invested),
                                backgroundColor: '#475569', 
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert',
                                data: monthlyDataPoints.map(d => d.p2.actual),
                                backgroundColor: '#2563eb', 
                                valueFormatter: fCur,
                                label: { show: false }
                            }
                        ]} 
                        height="100%"
                    />
                </div>
            </div>

            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
               data-pdf-title={`${t ? t('devPension3a') || 'Entwicklung Säule 3a' : 'Entwicklung Säule 3a'} - ${calcMethod === 'cumulative' ? (t ? t('labelAbsolute') || 'Absolut' : 'Absolut') : (t ? t('labelInterval') || 'Intervall' : 'Intervall')}`}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Icon name="Lock" className="text-indigo-500" /> {t ? t('devPension3a') || 'Entwicklung Säule 3a' : 'Entwicklung Säule 3a'}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="line"
                        showDataLabels={false}
                        labels={chartLabels}
                        datasets={[
                            {
                                name: calcMethod === 'cumulative' ? (t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert') : (t ? t('workingCapital') || 'Arbeitendes Kapital' : 'Arbeitendes Kapital'),
                                data: monthlyDataPoints.map(d => d.p3.invested),
                                backgroundColor: '#475569',
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert',
                                data: monthlyDataPoints.map(d => d.p3.actual),
                                backgroundColor: '#059669',
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelTotalReturnYields') || 'Total Return (inkl. Erträge)' : 'Total Return (inkl. Erträge)',
                                data: monthlyDataPoints.map(d => d.p3.actual + d.p3.yields),
                                backgroundColor: '#d97706',
                                valueFormatter: fCur,
                                label: { show: false }
                            }
                        ]} 
                        height="100%"
                    />
                </div>
            </div>

         </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             {t ? t('monthlyHistoryTotal') || 'Monatliche Historie & Renditen (Total)' : 'Monatliche Historie & Renditen (Total)'}
         </div>
         <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm text-left relative">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                     <th rowSpan="2" className="px-6 py-4 align-middle text-left bg-gray-50/50 dark:bg-slate-900/50">{t ? t('colMonthTarget') || 'Monat / Stichtag' : 'Monat / Stichtag'}</th>
                     <th colSpan="2" className="px-4 py-2 text-center text-blue-600 dark:text-blue-400 bg-blue-50/10 border-r border-gray-100 dark:border-slate-800">{t ? t('colPillar2') || 'Säule 2 (Pension)' : 'Säule 2 (Pension)'}</th>
                     <th colSpan="2" className="px-4 py-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/10 border-r border-gray-100 dark:border-slate-800">{t ? t('colPillar3a') || 'Säule 3a (Vorsorge)' : 'Säule 3a (Vorsorge)'}</th>
                     <th colSpan="5" className="px-4 py-2 text-center text-slate-700 dark:text-slate-300 bg-slate-50/30">{t ? t('colOverallTotal') || 'Gesamtübersicht (Total)' : 'Gesamtübersicht (Total)'}</th>
                  </tr>
                  <tr>
                     <th className="px-4 py-3 text-right font-medium">{t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert'}</th>
                     <th className="px-4 py-3 text-right font-medium border-r border-gray-100 dark:border-slate-800">{t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert'}</th>
                     <th className="px-4 py-3 text-right font-medium">{t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert'}</th>
                     <th className="px-4 py-3 text-right font-medium border-r border-gray-100 dark:border-slate-800">{t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert'}</th>
                     <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">{t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert'}</th>
                     <th className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert'}</th>
                     <th className="px-4 py-3 text-right font-medium">{t ? t('labelPriceProfit') || 'Kursgewinn' : 'Kursgewinn'}</th>
                     <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-medium">{t ? t('labelYields') || 'Erträge' : 'Erträge'}</th>
                     <th className="px-6 py-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">{t ? t('labelTotalReturn') || 'Total Return' : 'Total Return'}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {monthlyDataPoints.slice().reverse().map((d, i) => {
                      const dateObj = new Date(d.dateStr);
                      const isCurrentMonth = d.dateStr === todayStr;
                      const monthLabel = dateObj.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
                      const exactLabel = dateObj.toLocaleDateString('de-CH');
                      const isLastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate() === dateObj.getDate();
                      const displayDate = isLastDay ? monthLabel : exactLabel;

                      return (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10">
                                  {isCurrentMonth ? `${displayDate} ${t ? t('todayBracket') || '(Heute)' : '(Heute)'}` : displayDate}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400 dark:text-slate-500">{fCur ? fCur(d.p2.invested, 'CHF') : d.p2.invested}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-gray-100 dark:border-slate-800">{fCur ? fCur(d.p2.actual, 'CHF') : d.p2.actual}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400 dark:text-slate-500">{fCur ? fCur(d.p3.invested, 'CHF') : d.p3.invested}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-gray-100 dark:border-slate-800">{fCur ? fCur(d.p3.actual, 'CHF') : d.p3.actual}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fCur ? fCur(d.total.invested, 'CHF') : d.total.invested}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur ? fCur(d.total.actual, 'CHF') : d.total.actual}</td>
                              <td className={`px-4 py-3 text-right font-mono ${d.total.priceProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                 {d.total.priceProfit > 0 ? '+' : ''}{fCur ? fCur(d.total.priceProfit, 'CHF') : d.total.priceProfit} 
                                 <span className="text-[10px] ml-1">({d.total.priceRoi > 0 ? '+' : ''}{d.total.priceRoi.toFixed(1)}%)</span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">+{fCur ? fCur(d.total.yields, 'CHF') : d.total.yields}</td>
                              <td className={`px-6 py-3 text-right font-bold ${d.total.profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                 {d.total.roi > 0 ? '+' : ''}{d.total.roi.toFixed(2)} %
                              </td>
                          </tr>
                      );
                  })}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

module.exports = PensionPerformanceReport;