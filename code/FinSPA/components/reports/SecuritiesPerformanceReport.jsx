const React = require('react');
const { useState, useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || window.DataEngine || {};

const { getAssetValueAtDate = () => 0, generateMonthEnds = (s,e) => [s,e] } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const SecuritiesPerformanceReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const [calcMethod, setCalcMethod] = useState('cumulative');
  const todayStr = dateRange?.to || new Date().toISOString().split('T')[0];

  const securitiesClasses = ['stock', 'fund', 'managed_fund'];
  const securitiesAssets = useMemo(() => {
    return (activeAssets || []).filter(a => securitiesClasses.includes(a.assetClass));
  }, [activeAssets]);
  
  const stockAssets = useMemo(() => securitiesAssets.filter(a => a.assetClass === 'stock'), [securitiesAssets]);
  const fundAssets = useMemo(() => securitiesAssets.filter(a => a.assetClass === 'fund'), [securitiesAssets]);
  const managedAssets = useMemo(() => securitiesAssets.filter(a => a.assetClass === 'managed_fund'), [securitiesAssets]);

  let earliestDate = dateRange?.from;
  if (!earliestDate) {
      earliestDate = new Date().toISOString().split('T')[0];
      securitiesAssets.forEach(asset => {
          (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
          (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      });
  }

  const calculateCumulativeStats = (asset, targetDate) => {
      const investedInBase = DataEngine.getInvestedCapitalAtDate ? DataEngine.getInvestedCapitalAtDate(asset, targetDate, activeAssets) : 0;
      let totalDividendsCHF = 0;

      const sortedBookings = [...(asset.bookings || [])].sort((a,b) => new Date(a.date) - new Date(b.date));

      sortedBookings.forEach(bk => {
          if (bk.date <= targetDate) {
              const bkRate = parseFloat(String(bk.bookingExchangeRate || '1').replace(',', '.'));
              const assetRate = parseFloat(String(asset.exchangeRate || '1').replace(',', '.'));
              const rate = (bkRate !== 1 && bkRate !== 0) ? bkRate : assetRate;
              
              const rawType = String(bk.type || '').toLowerCase();
              const catStr = String(bk.subCategory || bk.category || '').toLowerCase();
              
              if (['dividende', 'ausschüttung'].includes(rawType) || catStr.includes('dividende')) {
                  totalDividendsCHF += Number(bk.amount || 0) * rate;
              }
          }
      });
      
      return { invested: investedInBase, yields: totalDividendsCHF, delta: investedInBase };
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
      let stockInvested = 0, stockActual = 0, stockYields = 0, stockDelta = 0, stockPriceProfit = 0;
      let fundInvested = 0, fundActual = 0, fundYields = 0, fundDelta = 0, fundPriceProfit = 0;
      let managedInvested = 0, managedActual = 0, managedYields = 0, managedDelta = 0, managedPriceProfit = 0;

      stockAssets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          stockInvested += stats.invested;
          stockYields += stats.yields;
          stockDelta += stats.delta || 0;
          stockActual += act;
          stockPriceProfit += (act - stats.invested);
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
          fundPriceProfit += (act - stats.invested);
      });

      managedAssets.forEach(asset => {
          const stats = calcMethod === 'cumulative' 
              ? calculateCumulativeStats(asset, targetDate)
              : calculatePeriodicStats(asset, earliestDate, targetDate);
          const act = getAssetValueAtDate(asset, targetDate, activeAssets);
          
          let pp = act - stats.invested;
          pp -= stats.yields;

          managedInvested += stats.invested;
          managedYields += stats.yields;
          managedDelta += stats.delta || 0;
          managedActual += act;
          managedPriceProfit += pp;
      });

      const totalInvested = stockInvested + fundInvested + managedInvested;
      const totalActual = stockActual + fundActual + managedActual;
      const totalYields = stockYields + fundYields + managedYields;
      const totalDelta = stockDelta + fundDelta + managedDelta;
      
      const priceProfit = stockPriceProfit + fundPriceProfit + managedPriceProfit;
      const profit = priceProfit + totalYields;

      return {
          dateStr: targetDate,
          stocks: { invested: stockInvested, actual: stockActual, yields: stockYields, delta: stockDelta },
          funds: { invested: fundInvested, actual: fundActual, yields: fundYields, delta: fundDelta },
          managed: { invested: managedInvested, actual: managedActual, yields: managedYields, delta: managedDelta },
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
      fund: { invested: 0, actual: 0, yields: 0, delta: 0 },
      managed_fund: { invested: 0, actual: 0, yields: 0, delta: 0 }
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

  const repTitle = safeT(t, 'titleSecuritiesReport', "Wertschriften & Portfolio Performance");
  const repSub = safeT(t, 'subSecuritiesReport', `Aktien, Fonds/ETFs & Managed Accounts per {date}`).replace('{date}', new Date(todayStr).toLocaleDateString('de-CH'));

  useEffect(() => {
    const buildReportData = async () => {
        const transCalcMethod = calcMethod === 'cumulative' ? safeT(t, 'calcCumulative', 'Kumuliert') : safeT(t, 'calcPeriodic', 'Zeitraum-isoliert');
        
        const kpis = [
            { label: safeT(t, 'marketValueEnd', 'Marktwert Gesamt'), value: fCur(latestData.actual, 'CHF'), sub: safeT(t, 'descActivePositionsTotal', `{count} Positionen aktiv`).replace('{count}', securitiesAssets.length), color: '#2563eb' },
            { label: safeT(t, 'labelNetInvested', 'Netto Investiert'), value: fCur(latestData.invested, 'CHF'), sub: safeT(t, 'descCalcMethodSub', `{method} berechnet`).replace('{method}', transCalcMethod), color: '#64748b' },
            { label: safeT(t, 'labelPriceProfit', 'Kursgewinn'), value: `${latestData.priceProfit >= 0 ? '+' : ''}${fCur(latestData.priceProfit, 'CHF')}`, sub: `${latestData.priceRoi >= 0 ? '+' : ''}${safeT(t, 'descPriceRoiSub', `{roi}% Kurs-ROI`).replace('{roi}', latestData.priceRoi.toFixed(2))}`, color: latestData.priceProfit >= 0 ? '#10b981' : '#ef4444' },
            { label: safeT(t, 'labelTotalReturnDiv', 'Total Return (inkl. Div)'), value: `${latestData.profit >= 0 ? '+' : ''}${fCur(latestData.profit, 'CHF')}`, sub: `ROI: ${latestData.roi.toFixed(2)}% (+${fCur(latestData.yields, 'CHF')} Div)`, color: latestData.profit >= 0 ? '#6366f1' : '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
            chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colMonth', 'Monat'),
            safeT(t, 'colStocksInv', 'Aktien Inv.'),
            safeT(t, 'colStocksVal', 'Aktien Wert'),
            safeT(t, 'colFundsInv', 'Fonds Inv.'),
            safeT(t, 'colFundsVal', 'Fonds Wert'),
            safeT(t, 'colManagedInv', 'Verwaltet Inv.'),
            safeT(t, 'colManagedVal', 'Verwaltet Wert'),
            safeT(t, 'colTotalInvested', 'Total Inv.'),
            safeT(t, 'colTotalValue', 'Total Wert'),
            safeT(t, 'labelPriceProfit', 'Kursgewinn'),
            safeT(t, 'labelDividends', 'Dividenden'),
            safeT(t, 'labelTotalReturn', 'Total Return')
        ];
        
        const tableBody = monthlyDataPoints.slice().reverse().map(d => {
            const dateObj = new Date(d.dateStr);
            const formattedDate = dateObj.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }); 
            return [
              formattedDate, 
              fCur(d.stocks.invested, 'CHF'), fCur(d.stocks.actual, 'CHF'), 
              fCur(d.funds.invested, 'CHF'), fCur(d.funds.actual, 'CHF'), 
              fCur(d.managed.invested, 'CHF'), fCur(d.managed.actual, 'CHF'), 
              fCur(d.total.invested, 'CHF'), fCur(d.total.actual, 'CHF'),
              `${d.total.priceProfit > 0 ? '+' : ''}${fCur(d.total.priceProfit, 'CHF')}`, 
              `+${fCur(d.total.yields, 'CHF')}`, 
              `${d.total.roi > 0 ? '+' : ''}${d.total.roi.toFixed(2)} %`
            ];
        });

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: repSub, 
          tableHeaders, 
          tableBody, 
          colWidthsPct: [0.10, 0.08, 0.09, 0.08, 0.09, 0.08, 0.09, 0.09, 0.10, 0.08, 0.06, 0.06],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im SecuritiesPerformanceReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 12, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.10, 0.08, 0.09, 0.08, 0.09, 0.08, 0.09, 0.09, 0.10, 0.08, 0.06, 0.06],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error:", err);
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
  }, [monthlyDataPoints, fCur, t, repTitle, repSub, data, calcMethod, latestData, securitiesAssets.length]);

  const chartLabels = monthlyDataPoints.map(d => {
      const dateObj = new Date(d.dateStr);
      return `${('0'+(dateObj.getMonth()+1)).slice(-2)}.${dateObj.getFullYear().toString().slice(-2)}`;
  });

  if (securitiesAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'msgNoSecuritiesAssetsFound', 'Keine Aktien, Fonds oder verwaltete Vermögen im Portfolio gefunden.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12" ref={reportRef}>

      {/* Steuerungsleiste */}
      <div className="print-hide flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 mb-8 gap-3 shadow-sm">
         <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Icon name="Activity" size={14} className="text-blue-500"/>
            {safeT(t, 'labelCalcMethodDashMetrics', 'Berechnungsmethode für Dashboard-Metriken:')}
         </div>
         <div className="flex bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 text-xs font-semibold self-stretch sm:self-auto justify-between sm:justify-start">
            <button 
                onClick={() => setCalcMethod('cumulative')}
                className={`px-4 py-1.5 rounded-md transition-all ${calcMethod === 'cumulative' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                {safeT(t, 'labelCalcCumulativeFull', 'Kumuliert (Gesamthistorie)')}
            </button>
            <button 
                onClick={() => setCalcMethod('periodic')}
                className={`px-4 py-1.5 rounded-md transition-all ${calcMethod === 'periodic' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                {safeT(t, 'labelCalcPeriodicInterval', 'Perioden-isoliert (Intervall)')}
            </button>
         </div>
      </div>

      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                {safeT(t, 'labelNetInvested', 'NETTO INVESTIERT')}
            </div>
            <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
                {fCur(latestData.invested, 'CHF')}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {calcMethod === 'cumulative' ? safeT(t, 'descSecuritiesInvested', 'Summe aller Käufe minus Verkäufe') : safeT(t, 'descWorkingCapitalPeriod', 'Arbeitendes Kapital im Zeitraum')}
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT(t, 'labelMarketValueToday', 'MARKTWERT AKTUELL')}</div>
            <div className="font-black text-2xl text-emerald-600 dark:text-emerald-400 truncate">
                {fCur(latestData.actual, 'CHF')}
            </div>
            <div className="text-xs text-gray-400 mt-2">{safeT(t, 'statusAsOf', 'Stand per')} {new Date(todayStr).toLocaleDateString('de-CH')}</div>
         </div>
         
         <div className={`border p-6 rounded-2xl shadow-sm overflow-hidden ${latestData.priceProfit >= 0 ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50/50 border-red-200 dark:bg-red-900/20'}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-green-700 dark:text-green-300">
                {safeT(t, 'labelPriceEffectProfitHeader', 'KURSGEWINN (UNREALISIERT)')}
            </div>
            <div className="font-black text-2xl text-green-700 dark:text-green-400 truncate">
                {latestData.priceProfit > 0 ? '+' : ''}{fCur(latestData.priceProfit, 'CHF')}
            </div>
            <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">
                {safeT(t, 'descPriceRoiShort', `Kurs-ROI: ${latestData.priceRoi > 0 ? '+' : ''}${latestData.priceRoi.toFixed(2)}%`).replace('{roi}', `${latestData.priceRoi > 0 ? '+' : ''}${latestData.priceRoi.toFixed(2)}`)}
            </div>
         </div>
         
         <div className={`border p-6 rounded-2xl shadow-sm overflow-hidden ${latestData.profit >= 0 ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-orange-50/50 border-orange-200 dark:border-orange-900/20'}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-indigo-700 dark:text-indigo-300">
                {safeT(t, 'labelTotalReturnWithYieldsHeader', 'TOTAL RETURN (INKL. DIV.)')}
            </div>
            <div className="font-black text-2xl text-indigo-700 dark:text-indigo-400 truncate">
                {latestData.profit > 0 ? '+' : ''}{fCur(latestData.profit, 'CHF')}
            </div>
            <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-2">
                {safeT(t, 'descDividendsRoiSub', `Dividenden: +${fCur(latestData.yields, 'CHF')} (${latestData.roi.toFixed(2)}% ROI)`).replace('{val}', fCur(latestData.yields, 'CHF')).replace('{roi}', latestData.roi.toFixed(2))}
            </div>
         </div>
      </div>

      {/* Assetklassen Aufschlüsselung */}
      <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">{safeT(t, 'titleSecuritiesClassesBreakdown', 'Klassenaufschlüsselung (Aktien, Fonds & Verwaltet)')}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {securitiesClasses.map(cls => {
            const stats = currentStats[cls];
            if (stats.invested === 0 && stats.actual === 0 && stats.yields === 0) return null;
            
            let priceProfit = stats.actual - stats.invested;
            if (cls === 'managed_fund') priceProfit -= stats.yields; 

            const totalProfit = priceProfit + stats.yields;
            const roi = stats.invested > 0 ? (totalProfit / stats.invested) * 100 : 0;
            const isPos = totalProfit >= 0;
            
            const titleMap = { 
                'stock': safeT(t, 'labelStocksDirect', 'Aktien (Direktinvestments)'), 
                'fund': safeT(t, 'acFundLong', 'Fonds / ETFs'),
                'managed_fund': safeT(t, 'acManagedFundLong', 'Verwaltetes Depot')
            };
            const iconMap = { 'stock': 'TrendingUp', 'fund': 'PieChart', 'managed_fund': 'Activity' };

            return (
                <div key={cls} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold border-b border-gray-100 dark:border-slate-800 pb-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                           <Icon name={iconMap[cls]} size={16} />
                        </div>
                        <span className="truncate text-sm">{titleMap[cls]}</span>
                    </div>
                    <div className="space-y-2.5 text-xs flex-1">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">{safeT(t, 'labelInvestedHeader', 'Investiert')}:</span>
                            <span className="font-mono">{fCur(stats.invested, 'CHF')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">{safeT(t, 'labelDividends', 'Dividenden')}:</span>
                            <span className="font-mono text-indigo-500">+{fCur(stats.yields, 'CHF')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">{safeT(t, 'labelMarketValueHeader', 'Marktwert')}:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(stats.actual, 'CHF')}</span>
                        </div>
                    </div>
                    <div className={`mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between font-bold text-xs ${isPos ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        <span>{safeT(t, 'labelResult', 'Ergebnis:')} {isPos ? '+' : ''}{fCur(totalProfit, 'CHF')}</span>
                        <span>{isPos ? '+' : ''}{roi.toFixed(1)}%</span>
                    </div>
                </div>
            );
        })}
      </div>

      {/* Diagramme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" ref={reportRef}>
         
         <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
            data-pdf-title={safeT(t, 'titleDevStocksPdf', 'Performance Aktien Portfolio')}
         >
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                 <Icon name="TrendingUp" className="text-blue-500" /> {safeT(t, 'titleDevStocksChart', 'Entwicklung Aktien')}
             </h3>
             <div style={{ width: '100%', height: '300px' }}>
                 <UniversalChart 
                     engine={activeChartEngine}
                     type="line"
                     labels={chartLabels}
                     datasets={[
                         {
                             name: safeT(t, 'labelInvestedHeader', 'Investiert'),
                             data: monthlyDataPoints.map(d => d.stocks.invested),
                             backgroundColor: '#475569', 
                             valueFormatter: fCur
                         },
                         {
                             name: safeT(t, 'labelMarketValueHeader', 'Marktwert'),
                             data: monthlyDataPoints.map(d => d.stocks.actual),
                             backgroundColor: '#10b981', 
                             valueFormatter: fCur
                         },
                         {
                             name: safeT(t, 'labelTotalReturn', 'Total Return'),
                             data: monthlyDataPoints.map(d => d.stocks.actual + d.stocks.yields),
                             backgroundColor: '#6366f1',
                             valueFormatter: fCur
                         }
                     ]} 
                     height="100%"
                 />
             </div>
         </div>

         <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
            data-pdf-title={safeT(t, 'titleDevFundsManagedPdf', 'Performance Fonds & Managed Accounts')}
         >
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                 <Icon name="PieChart" className="text-indigo-500" /> {safeT(t, 'titleDevFundsManagedChart', 'Entwicklung Fonds & Managed Accounts')}
             </h3>
             <div style={{ width: '100%', height: '300px' }}>
                 <UniversalChart 
                     engine={activeChartEngine}
                     type="line"
                     labels={chartLabels}
                     datasets={[
                         {
                             name: safeT(t, 'colFundsVal', 'Fonds Wert'),
                             data: monthlyDataPoints.map(d => d.funds.actual),
                             backgroundColor: '#0ea5e9', 
                             valueFormatter: fCur
                         },
                         {
                             name: safeT(t, 'labelManagedValue', 'Verwaltet Wert'),
                             data: monthlyDataPoints.map(d => d.managed.actual),
                             backgroundColor: '#8b5cf6', 
                             valueFormatter: fCur
                         }
                     ]} 
                     height="100%"
                 />
             </div>
         </div>

      </div>

      {/* Monatliche Historie */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             {safeT(t, 'titleMonthlySecuritiesHistory', 'Monatliche Wertschriften-Historie & Performance')}
         </div>
         <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm text-left relative">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                  <tr>
                     <th className="px-6 py-4">{safeT(t, 'colMonth', 'Monat')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colStocksInv', 'Aktien Inv.')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colStocksVal', 'Aktien Wert')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colFundsInv', 'Fonds Inv.')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colFundsVal', 'Fonds Wert')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colManagedInv', 'Verwaltet Inv.')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colManagedVal', 'Verwaltet Wert')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colTotalInvested', 'Total Inv.')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'colTotalValue', 'Total Wert')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'labelPriceProfit', 'Kursgewinn')}</th>
                     <th className="px-4 py-4 text-right">{safeT(t, 'labelDividends', 'Dividenden')}</th>
                     <th className="px-6 py-4 text-right">{safeT(t, 'labelTotalReturn', 'Total Return')}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {monthlyDataPoints.slice().reverse().map((d, i) => {
                      const dateObj = new Date(d.dateStr);
                      const displayDate = dateObj.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' });

                      return (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10 whitespace-nowrap">
                                  {displayDate}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400">{fCur(d.stocks.invested, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{fCur(d.stocks.actual, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400">{fCur(d.funds.invested, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{fCur(d.funds.actual, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-400">{fCur(d.managed.invested, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{fCur(d.managed.actual, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-500">{fCur(d.total.invested, 'CHF')}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(d.total.actual, 'CHF')}</td>
                              <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${d.total.priceProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                                 {d.total.priceProfit > 0 ? '+' : ''}{fCur(d.total.priceProfit, 'CHF')}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">+{fCur(d.total.yields, 'CHF')}</td>
                              <td className={`px-6 py-3 text-right font-bold whitespace-nowrap ${d.total.profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600'}`}>
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