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

const SecuritiesPerformanceReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const [calcMethod, setCalcMethod] = useState('cumulative');

  const securitiesClasses = ['stock', 'fund'];
  const securitiesAssets = (activeAssets || []).filter(a => securitiesClasses.includes(a.assetClass));
  
  const stockAssets = securitiesAssets.filter(a => a.assetClass === 'stock');
  const fundAssets = securitiesAssets.filter(a => a.assetClass === 'fund');

  if (securitiesAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <ReportHeader 
            title={t ? t('repSecuritiesTitle') || "Aktien & Fonds Performance" : "Aktien & Fonds Performance"} 
            subtitle={t ? t('repSecuritiesSub') || "Entwicklung des freien Portfolios" : "Entwicklung des freien Portfolios"} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('noSecuritiesData') || 'Keine Aktien oder Fonds gefunden.' : 'Keine Aktien oder Fonds gefunden.'}</p>
        </div>
      </div>
    );
  }

  let earliestDate = dateRange?.from;
  if (!earliestDate) {
      earliestDate = new Date().toISOString().split('T')[0];
      securitiesAssets.forEach(asset => {
          (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
          (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      });
  }

  const todayStr = dateRange?.to || new Date().toISOString().split('T')[0];

  const calculateCumulativeStats = (asset, targetDate) => {
      let totalInvestedCHF = 0;
      let totalDividendsCHF = 0;

      const sortedBookings = [...(asset.bookings || [])].sort((a,b) => new Date(a.date) - new Date(b.date));

      sortedBookings.forEach(bk => {
          if (bk.date <= targetDate) {
              const bkRate = parseFloat(String(bk.bookingExchangeRate || '1').replace(',', '.'));
              const assetRate = parseFloat(String(asset.exchangeRate || '1').replace(',', '.'));
              const rate = (bkRate !== 1 && bkRate !== 0) ? bkRate : assetRate;
              
              if (['Kauf', 'Einzahlung'].includes(bk.type)) {
                  totalInvestedCHF += Number(bk.amount) * rate;
              }
              if (['Verkauf', 'Auszahlung'].includes(bk.type)) {
                  totalInvestedCHF -= Number(bk.amount) * rate;
              }
              if (bk.type === 'Dividende') {
                  totalDividendsCHF += Number(bk.amount) * rate;
              }
          }
      });
      
      return { invested: totalInvestedCHF, yields: totalDividendsCHF, delta: totalInvestedCHF };
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
      let stockInvested = 0, stockActual = 0, stockYields = 0, stockDelta = 0;
      let fundInvested = 0, fundActual = 0, fundYields = 0, fundDelta = 0;

      stockAssets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          stockInvested += stats.invested;
          stockYields += stats.yields;
          stockDelta += stats.delta || 0;
          stockActual += act;
      });

      fundAssets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          fundInvested += stats.invested;
          fundYields += stats.yields;
          fundDelta += stats.delta || 0;
          fundActual += act;
      });

      const totalInvested = stockInvested + fundInvested;
      const totalActual = stockActual + fundActual;
      const totalYields = stockYields + fundYields;
      const totalDelta = stockDelta + fundDelta;
      
      const priceProfit = totalActual - totalInvested;
      const profit = priceProfit + totalYields;

      return {
          dateStr: targetDate,
          stocks: { invested: stockInvested, actual: stockActual, yields: stockYields, delta: stockDelta },
          funds: { invested: fundInvested, actual: fundActual, yields: fundYields, delta: fundDelta },
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
      stock: { invested: 0, actual: 0, yields: 0, delta: 0 },
      fund: { invested: 0, actual: 0, yields: 0, delta: 0 }
  };

  securitiesAssets.forEach(asset => {
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

  const repTitle = t ? t('repSecuritiesTitle') || "Aktien & Fonds Performance" : "Aktien & Fonds Performance";
  const repSub = t ? t('repSecuritiesSub') || "Rendite-Analyse des freien Markt-Portfolios (ohne Säule 3a)" : "Rendite-Analyse des freien Markt-Portfolios (ohne Säule 3a)";

  // --- HTML2CANVAS DRUCK SYNCHRONISATION ---
  useEffect(() => {
    const loadHtml2Canvas = () => {
        return new Promise((resolve) => {
            if (window.html2canvas) return resolve(window.html2canvas);
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = () => resolve(window.html2canvas);
            document.head.appendChild(script);
        });
    };

    const handlePdfExport = async () => {
      try {
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
                const canvas = await html2canvas(containers[i], { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0) }); 
            }
        }

        const transCalcMethod = calcMethod === 'cumulative' ? (t ? t('calcCumulative') || 'Kumuliert' : 'Kumuliert') : (t ? t('calcPeriodic') || 'Zeitraum' : 'Zeitraum');

        const customHeaderRows = [
            [
                { text: t ? t('colMonth') || 'Monat' : 'Monat', rowSpan: 2, style: 'tableHeader', alignment: 'left' },
                { text: t ? t('colStocks') || 'Aktien' : 'Aktien', colSpan: 2, style: 'tableHeader', alignment: 'center' },
                '', 
                { text: t ? t('colFunds') || 'Fonds / ETFs' : 'Fonds / ETFs', colSpan: 2, style: 'tableHeader', alignment: 'center' },
                '', 
                { text: `${t ? t('overallSummary') || 'Gesamtübersicht' : 'Gesamtübersicht'} (${transCalcMethod})`, colSpan: 5, style: 'tableHeader', alignment: 'center' },
                '', '', '', '' 
            ],
            [
                '', 
                { text: t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelPriceProfit') || 'Kursgewinn' : 'Kursgewinn', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelDividends') || 'Dividenden' : 'Dividenden', style: 'tableHeader', alignment: 'right' },
                { text: t ? t('labelTotalReturn') || 'Total Return' : 'Total Return', style: 'tableHeader', alignment: 'right' }
            ]
        ];
        
        const tableBody = monthlyDataPoints.slice().reverse().map(d => {
            const dateObj = new Date(d.dateStr);
            const formattedDate = dateObj.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }); 
            return [
              formattedDate, fCur(d.stocks.invested), fCur(d.stocks.actual), fCur(d.funds.invested), fCur(d.funds.actual), fCur(d.total.invested), fCur(d.total.actual),
              `${d.total.priceProfit > 0 ? '+' : ''}${fCur(d.total.priceProfit)}`, `+${fCur(d.total.yields)}`, `${d.total.roi > 0 ? '+' : ''}${d.total.roi.toFixed(2)} %`
            ];
        });

        await PdfExportEngine.exportReport({
          title: `${repTitle} (${transCalcMethod})`,
          subtitle: repSub, customHeaderRows, tableBody, chartsData, data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im SecuritiesPerformanceReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
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
                        ? (t ? t('descSecuritiesInvested') || 'Summe aller Käufe minus Verkäufe' : 'Summe aller Käufe minus Verkäufe') 
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
                    {t ? t('labelTotalReturnDiv') || 'Total Return (inkl. Dividenden)' : 'Total Return (inkl. Dividenden)'}
                </div>
                <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>
                   {latestData.profit > 0 ? '+' : ''}{fCur ? fCur(latestData.profit, 'CHF') : latestData.profit}
                   <span className="text-sm font-medium opacity-70">({latestData.roi > 0 ? '+' : ''}{latestData.roi.toFixed(2)}%)</span>
                </div>
             </div>
          </div>

          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">{t ? t('labelBreakdownByAssetClass') || 'Aufschlüsselung nach Anlageklasse' : 'Aufschlüsselung nach Anlageklasse'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {securitiesClasses.map(cls => {
                const stats = currentStats[cls];
                if (stats.invested === 0 && stats.actual === 0 && stats.yields === 0) return null;
                
                const priceProfit = stats.actual - stats.invested;
                const totalProfit = priceProfit + stats.yields;
                const roi = stats.invested > 0 ? (totalProfit / stats.invested) * 100 : 0;
                const isPos = totalProfit >= 0;
                
                const titleMap = { 
                    'stock': t ? t('acStock') || 'Aktien (Direktinvestments)' : 'Aktien (Direktinvestments)', 
                    'fund': t ? t('acFund') || 'Fonds / ETFs' : 'Fonds / ETFs'
                };
                const iconMap = { 'stock': 'TrendingUp', 'fund': 'PieChart' };

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
                                <span className="text-gray-500">{t ? t('labelYieldsDiv') || 'Erträge (Dividenden):' : 'Erträge (Dividenden):'}</span>
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
               data-pdf-title={t ? t('devStocksPortfolio') || "Entwicklung Aktien Portfolio" : "Entwicklung Aktien Portfolio"}
               data-pdf-legend={JSON.stringify([
                   { name: calcMethod === 'cumulative' ? (t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert') : (t ? t('workingCapital') || 'Arbeitendes Kapital' : 'Arbeitendes Kapital'), color: '#475569' },
                   { name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert', color: '#10b981' },
                   { name: t ? t('labelTotalReturnYields') || 'Total Return (inkl. Div)' : 'Total Return (inkl. Div)', color: '#6366f1' }
               ])}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Icon name="TrendingUp" className="text-blue-500" /> {t ? t('devStocks') || "Entwicklung Aktien" : "Entwicklung Aktien"}
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
                                data: monthlyDataPoints.map(d => d.stocks.invested),
                                backgroundColor: '#475569', 
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert',
                                data: monthlyDataPoints.map(d => d.stocks.actual),
                                backgroundColor: '#10b981', 
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelTotalReturnYields') || 'Total Return (inkl. Div)' : 'Total Return (inkl. Div)',
                                data: monthlyDataPoints.map(d => d.stocks.actual + d.stocks.yields),
                                backgroundColor: '#6366f1',
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
               data-pdf-title={t ? t('devFundsPortfolio') || "Entwicklung Fonds / ETFs Portfolio" : "Entwicklung Fonds / ETFs Portfolio"}
               data-pdf-legend={JSON.stringify([
                   { name: calcMethod === 'cumulative' ? (t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert') : (t ? t('workingCapital') || 'Arbeitendes Kapital' : 'Arbeitendes Kapital'), color: '#475569' },
                   { name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert', color: '#10b981' },
                   { name: t ? t('labelTotalReturnYields') || 'Total Return (inkl. Div)' : 'Total Return (inkl. Div)', color: '#6366f1' }
               ])}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Icon name="PieChart" className="text-indigo-500" /> {t ? t('devFunds') || "Entwicklung Fonds / ETFs" : "Entwicklung Fonds / ETFs"}
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
                                data: monthlyDataPoints.map(d => d.funds.invested),
                                backgroundColor: '#475569',
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelMarketValue') || 'Marktwert' : 'Marktwert',
                                data: monthlyDataPoints.map(d => d.funds.actual),
                                backgroundColor: '#10b981',
                                valueFormatter: fCur,
                                label: { show: false }
                            },
                            {
                                name: t ? t('labelTotalReturnYields') || 'Total Return (inkl. Div)' : 'Total Return (inkl. Div)',
                                data: monthlyDataPoints.map(d => d.funds.actual + d.funds.yields),
                                backgroundColor: '#6366f1',
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
                     <th colSpan="2" className="px-4 py-2 text-center text-blue-600 dark:text-blue-400 bg-blue-50/10 border-r border-gray-100 dark:border-slate-800">{t ? t('colStocks') || 'Aktien' : 'Aktien'}</th>
                     <th colSpan="2" className="px-4 py-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/10 border-r border-gray-100 dark:border-slate-800">{t ? t('colFunds') || 'Fonds / ETFs' : 'Fonds / ETFs'}</th>
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
                     <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-medium">{t ? t('labelDividends') || 'Dividenden' : 'Dividenden'}</th>
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
                              <td className="px-4 py-3 text-right font-mono text-slate-400 dark:text-slate-500">{fCur ? fCur(d.stocks.invested, 'CHF') : d.stocks.invested}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-gray-100 dark:border-slate-800">{fCur ? fCur(d.stocks.actual, 'CHF') : d.stocks.actual}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400 dark:text-slate-500">{fCur ? fCur(d.funds.invested, 'CHF') : d.funds.invested}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-gray-100 dark:border-slate-800">{fCur ? fCur(d.funds.actual, 'CHF') : d.funds.actual}</td>
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

module.exports = SecuritiesPerformanceReport;