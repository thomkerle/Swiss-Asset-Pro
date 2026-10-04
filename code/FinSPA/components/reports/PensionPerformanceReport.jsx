const React = require('react');
const { useState, useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || {};

const { getAssetValueAtDate = () => 0, generateMonthEnds = (s,e) => [s,e] } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const PensionPerformanceReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const [calcMethod, setCalcMethod] = useState('cumulative');
  const [activeTableTab, setActiveTableTab] = useState('yearly');

  const todayStr = dateRange?.to || new Date().toISOString().split('T')[0];
  const currentCalendarYear = new Date(todayStr).getFullYear();

  const maxPillar3aLimit = Number(data?.settings?.pillar3aMaxLimit) || 7258;

  const pensionClasses = ['pension_cash', 'pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'];
  const pensionAssets = useMemo(() => {
    return (activeAssets || []).filter(a => pensionClasses.includes(a.assetClass));
  }, [activeAssets]);
  
  const pillar2Assets = useMemo(() => pensionAssets.filter(a => a.assetClass === 'pension_cash'), [pensionAssets]);
  const pillar3Assets = useMemo(() => pensionAssets.filter(a => ['pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(a.assetClass)), [pensionAssets]);

  const { pillar3aNewMoneyYTD, remaining3aRoom, pct3aUsed } = useMemo(() => {
      let ytdDeposits = 0;
      const yearPrefix = `${currentCalendarYear}`;

      pillar3Assets.forEach(asset => {
          (asset.bookings || []).forEach(bk => {
              if (!bk.date || !bk.date.startsWith(yearPrefix)) return;

              const bType = String(bk.type || '');
              const sub = String(bk.subCategory || bk.category || '').toLowerCase();
              const comment = String(bk.comment || '').toLowerCase();

              const isInternalShift = 
                  sub.includes('zins') || 
                  sub.includes('dividende') || 
                  sub.includes('umbuchung') || 
                  sub.includes('übertrag') || 
                  sub.includes('transfer');

              if (isInternalShift) return;

              const isRegularDeposit = (bType === 'Einzahlung');

              const isDirectFundDeposit = (bType === 'Kauf') && (
                  sub.includes('direkteinzahlung') || 
                  sub.includes('neugeld') || 
                  comment.includes('#neugeld')
              );

              if (isRegularDeposit || isDirectFundDeposit) {
                  const amt = Number(bk.amount || 0);
                  const rate = parseFloat(String(bk.bookingExchangeRate || asset.exchangeRate || 1).replace(',', '.'));
                  ytdDeposits += amt * rate;
              }
          });
      });

      const remaining = Math.max(0, maxPillar3aLimit - ytdDeposits);
      const pct = maxPillar3aLimit > 0 ? Math.min(100, (ytdDeposits / maxPillar3aLimit) * 100) : 0;

      return {
          pillar3aNewMoneyYTD: ytdDeposits,
          remaining3aRoom: remaining,
          pct3aUsed: pct
      };
  }, [pillar3Assets, currentCalendarYear, maxPillar3aLimit]);

  let earliestDate = dateRange?.from;
  if (!earliestDate) {
      earliestDate = new Date().toISOString().split('T')[0];
      pensionAssets.forEach(asset => {
          (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
          (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      });
  }

  const calculateCumulativeStats = (asset, targetDate) => {
      const investedInBase = DataEngine.getInvestedCapitalAtDate ? DataEngine.getInvestedCapitalAtDate(asset, targetDate, activeAssets) : 0;
      
      let yields = 0;
      (asset.bookings || []).forEach(bk => {
          if (bk.date <= targetDate) {
              if (bk.type === 'Dividende') yields += Number(bk.amount || 0);
              if (bk.type === 'Einzahlung' && bk.subCategory === 'Zinsen') yields += Number(bk.amount || 0);
              if (bk.type === 'Zinszahlung' && Number(bk.amount || 0) > 0) yields += Number(bk.amount || 0);
          }
      });
      
      const rate = asset.exchangeRate || 1;
      return { 
          invested: investedInBase, 
          yields: yields * rate, 
          delta: investedInBase 
      };
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
  const latestP3 = monthlyDataPoints[monthlyDataPoints.length - 1]?.p3 || { invested: 0, actual: 0 };
  const latestP2 = monthlyDataPoints[monthlyDataPoints.length - 1]?.p2 || { invested: 0, actual: 0 };

  const yearlyPerformance = useMemo(() => {
      const yearsSet = new Set();
      monthlyDataPoints.forEach(dp => {
          yearsSet.add(dp.dateStr.substring(0, 4));
      });
      const years = Array.from(yearsSet).sort();

      return years.map(yr => {
          const yNum = Number(yr);
          const startD = yNum === Number(years[0]) ? earliestDate : `${yNum - 1}-12-31`;
          const endD = (yr === `${currentCalendarYear}`) ? todayStr : `${yr}-12-31`;

          let startVal = 0;
          let endVal = 0;
          let yearDeposits = 0;
          let yearYields = 0;

          pensionAssets.forEach(a => {
              startVal += getAssetValueAtDate(a, startD, activeAssets);
              endVal += getAssetValueAtDate(a, endD, activeAssets);

              (a.bookings || []).forEach(bk => {
                  if (bk.date && bk.date.startsWith(yr)) {
                      const sub = String(bk.subCategory || bk.category || '').toLowerCase();
                      const bType = String(bk.type || '');
                      const isYield = bType === 'Dividende' || sub.includes('zins');
                      
                      const rate = parseFloat(String(bk.bookingExchangeRate || a.exchangeRate || 1).replace(',', '.'));
                      const amt = Number(bk.amount || 0) * rate;

                      if (isYield) {
                          yearYields += amt;
                      } else if (bType === 'Einzahlung' || (bType === 'Kauf' && sub.includes('direkteinzahlung'))) {
                          yearDeposits += amt;
                      } else if (bType === 'Auszahlung') {
                          yearDeposits -= amt;
                      }
                  }
              });
          });

          const netGain = endVal - startVal - yearDeposits;
          const totalAnnualReturn = netGain + yearYields;
          
          const baseCap = startVal + (yearDeposits / 2);
          const annualPerformancePct = baseCap > 0 ? (totalAnnualReturn / baseCap) * 100 : 0;

          return {
              year: yr,
              startVal,
              endVal,
              deposits: yearDeposits,
              yields: yearYields,
              netGain,
              totalAnnualReturn,
              performancePct: annualPerformancePct
          };
      });
  }, [monthlyDataPoints, earliestDate, todayStr, currentCalendarYear, pensionAssets, activeAssets]);

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

  const repTitle = safeT(t, 'repPensionTitle', "Vorsorge & Pensionskasse");
  const repSub = `${safeT(t, 'statusAsOf', 'Stichtag:')} ${new Date(todayStr).toLocaleDateString('de-CH')} | ${safeT(t, 'kpiPillar3aNewMoneyYear', 'Säule 3a Neugeld {year}').replace('{year}', currentCalendarYear)}: ${fCur(pillar3aNewMoneyYTD, 'CHF')} / max. ${fCur(maxPillar3aLimit, 'CHF')}`;

  useEffect(() => {
    const buildReportData = async () => {
        const transCalcMethod = calcMethod === 'cumulative' ? safeT(t, 'calcCumulative', 'Kumuliert') : safeT(t, 'calcPeriodic', 'Zeitraum-isoliert');
        
        const kpis = [
            { label: safeT(t, 'kpiPensionWealthTotal', 'Vorsorgevermögen Gesamt'), value: fCur(latestData.actual, 'CHF'), sub: `PK: ${fCur(latestP2.actual, 'CHF')} | 3a: ${fCur(latestP3.actual, 'CHF')}`, color: '#2563eb' },
            { label: safeT(t, 'kpiPillar3aNewMoneyYear', `Säule 3a Neugeld ${currentCalendarYear}`).replace('{year}', currentCalendarYear), value: fCur(pillar3aNewMoneyYTD, 'CHF'), sub: `${pct3aUsed.toFixed(1)}% / max. ${fCur(maxPillar3aLimit, 'CHF')}`, color: '#10b981' },
            { label: safeT(t, 'kpiPillar3aRemaining', 'Verbleibend Säule 3a'), value: fCur(remaining3aRoom, 'CHF'), sub: safeT(t, 'descRemainingRoomYear', `Restlicher Spielraum ${currentCalendarYear}`).replace('{year}', currentCalendarYear), color: remaining3aRoom > 0 ? '#f59e0b' : '#10b981' },
            { label: `${safeT(t, 'labelTotalReturn', 'Total Return')} (${transCalcMethod})`, value: `${latestData.profit >= 0 ? '+' : ''}${fCur(latestData.profit, 'CHF')}`, sub: `ROI: ${latestData.roi.toFixed(2)}%`, color: latestData.profit >= 0 ? '#6366f1' : '#ef4444' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
            chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colMonth', 'Jahr'),
            safeT(t, 'startValue', 'Startwert'),
            safeT(t, 'inflows', 'Einzahlungen'),
            safeT(t, 'endValue', 'Endwert'),
            safeT(t, 'colNetValueGain', 'Wertzuwachs (Netto)'),
            safeT(t, 'colPerformanceAnnual', 'Performance p.a.')
        ];
        
        const tableBody = yearlyPerformance.slice().reverse().map(yp => [
            yp.year,
            fCur(yp.startVal, 'CHF'),
            `+${fCur(yp.deposits, 'CHF')}`,
            fCur(yp.endVal, 'CHF'),
            `${yp.totalAnnualReturn >= 0 ? '+' : ''}${fCur(yp.totalAnnualReturn, 'CHF')}`,
            `${yp.performancePct >= 0 ? '+' : ''}${yp.performancePct.toFixed(2)} %`
        ]);

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
          colWidthsPct: [0.12, 0.18, 0.18, 0.18, 0.18, 0.16],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im PensionPerformanceReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 10, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.12, 0.18, 0.18, 0.18, 0.18, 0.16],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
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
  }, [monthlyDataPoints, yearlyPerformance, fCur, t, repTitle, repSub, data, calcMethod, pillar3aNewMoneyYTD, remaining3aRoom, pct3aUsed, currentCalendarYear, maxPillar3aLimit, latestData, latestP2, latestP3]);

  const chartLabelsMonths = monthlyDataPoints.map(d => {
      const dateObj = new Date(d.dateStr);
      return `${('0'+(dateObj.getMonth()+1)).slice(-2)}.${dateObj.getFullYear().toString().slice(-2)}`;
  });

  if (pensionAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'msgNoPensionAssetsFound', 'Keine Pensionskassen oder Säule 3a Konten im Portfolio gefunden.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12" ref={reportRef}>
      
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
               <Icon name="Shield" size={14} className="text-blue-500"/>
               {safeT(t, 'labelPensionWealthTotalHeader', 'GESAMTVERMÖGEN VORSORGE')}
            </div>
            <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
               {fCur(latestData.actual, 'CHF')}
            </div>
            <div className="text-xs text-gray-400 mt-2">
               PK: {fCur(latestP2.actual, 'CHF')} | 3a: {fCur(latestP3.actual, 'CHF')}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
               <span className="flex items-center gap-1.5">
                  <Icon name="Calendar" size={14} className="text-emerald-500"/>
                  {safeT(t, 'labelPillar3aNewMoneyHeader', '3A NEUGELD {year}').replace('{year}', currentCalendarYear)}
               </span>
               <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                  {pct3aUsed.toFixed(1)}%
               </span>
            </div>
            <div className="font-black text-2xl text-emerald-600 dark:text-emerald-400 truncate">
               {fCur(pillar3aNewMoneyYTD, 'CHF')}
            </div>
            
            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
               <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct3aUsed}%` }}></div>
            </div>
            <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
               <span>{safeT(t, 'labelPillar3aRoomMax', 'Max: {val}').replace('{val}', fCur(maxPillar3aLimit, 'CHF'))}</span>
               <span className="font-medium text-slate-600 dark:text-slate-300">{safeT(t, 'labelPillar3aRoomRest', 'Rest: {val}').replace('{val}', fCur(remaining3aRoom, 'CHF'))}</span>
            </div>
         </div>

         <div className={`border p-6 rounded-2xl shadow-sm overflow-hidden ${latestData.priceProfit >= 0 ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50/50 border-red-200 dark:bg-red-900/20'}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-green-800 dark:text-green-300 flex items-center gap-2">
               <Icon name="TrendingUp" size={14}/>
               {safeT(t, 'labelPriceEffectProfitHeader', 'KURSEFFEKT / GEWINN')}
            </div>
            <div className="font-black text-2xl text-green-700 dark:text-green-400 truncate">
               {latestData.priceProfit > 0 ? '+' : ''}{fCur(latestData.priceProfit, 'CHF')}
            </div>
            <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">
               ({latestData.priceRoi > 0 ? '+' : ''}{safeT(t, 'descPriceRoiPercent', '{roi}% Kurs-Rendite').replace('{roi}', latestData.priceRoi.toFixed(2))})
            </div>
         </div>

         <div className={`border p-6 rounded-2xl shadow-sm overflow-hidden ${latestData.profit >= 0 ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-orange-50/50 border-orange-200 dark:bg-orange-900/20'}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
               <Icon name="Activity" size={14}/>
               {safeT(t, 'labelTotalReturnWithYieldsHeader', 'TOTAL RETURN (INKL. ERTRÄGE)')}
            </div>
            <div className="font-black text-2xl text-indigo-700 dark:text-indigo-400 truncate">
               {latestData.profit > 0 ? '+' : ''}{fCur(latestData.profit, 'CHF')}
            </div>
            <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-2">
               {safeT(t, 'descTotalRoiPercent', 'Gesamtrendite: {roi}%').replace('{roi}', `${latestData.roi > 0 ? '+' : ''}${latestData.roi.toFixed(2)}`)}
            </div>
         </div>
      </div>

      <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">{safeT(t, 'titlePensionCatBreakdown', 'Gliederung nach Vorsorge-Kategorien')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                'pension_cash': safeT(t, 'acPensionCash', 'Pensionskasse (2. Säule)'), 
                'pension_3a_cash': safeT(t, 'acPension3aCash', '3a Sparkonto'), 
                'pension_3a_fund': safeT(t, 'acPension3aFund', '3a Wertschriftenfonds'),
                'pension_3a_managed': safeT(t, 'acPension3aManaged', '3a Verwaltetes Depot')
            };
            const iconMap = { 'pension_cash': 'Building', 'pension_3a_cash': 'Lock', 'pension_3a_fund': 'TrendingUp', 'pension_3a_managed': 'Activity' };

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
                            <span className="text-gray-500">{safeT(t, 'labelYields', 'Erträge')}:</span>
                            <span className="font-mono text-indigo-500">+{fCur(stats.yields, 'CHF')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">{safeT(t, 'labelMarketValueHeader', 'Marktwert')}:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(stats.actual, 'CHF')}</span>
                        </div>
                    </div>
                    <div className={`mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between font-bold text-xs ${isPos ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        <span>{safeT(t, 'labelReturnShort', 'Ertrag:')} {isPos ? '+' : ''}{fCur(totalProfit, 'CHF')}</span>
                        <span>{isPos ? '+' : ''}{roi.toFixed(1)}%</span>
                    </div>
                </div>
            );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8" ref={reportRef}>
         
         <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
            data-pdf-title={safeT(t, 'titleHistTrackPillar2And3', 'Historischer Verlauf 2. und 3. Säule')}
         >
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                 <Icon name="TrendingUp" className="text-blue-500" /> {safeT(t, 'titleHistTrackPillar2And3', 'Historischer Verlauf 2. und 3. Säule')}
             </h3>
             <div style={{ width: '100%', height: '300px' }}>
                 <UniversalChart 
                     engine={activeChartEngine}
                     type="line"
                     labels={chartLabelsMonths}
                     datasets={[
                         {
                             name: safeT(t, 'colPillar2', 'Pensionskasse (2. Säule)'),
                             data: monthlyDataPoints.map(d => d.p2.actual),
                             backgroundColor: '#2563eb', 
                             valueFormatter: fCur
                         },
                         {
                             name: safeT(t, 'colPillar3a', 'Säule 3a (Vorsorge)'),
                             data: monthlyDataPoints.map(d => d.p3.actual),
                             backgroundColor: '#10b981', 
                             valueFormatter: fCur
                         }
                     ]} 
                     height="100%"
                 />
             </div>
         </div>

         <div 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
            data-pdf-title={safeT(t, 'titleAnnualDepositsVsYieldsPdf', 'Jährliche Einzahlungen vs. Ertrag')}
         >
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                 <Icon name="Calendar" className="text-purple-500" /> {safeT(t, 'titleAnnualDepositsVsYields', 'Jährliche Einzahlungen vs. Wertzuwachs')}
             </h3>
             <div style={{ width: '100%', height: '300px' }}>
                 <UniversalChart 
                     engine={activeChartEngine}
                     type="bar"
                     labels={yearlyPerformance.map(y => y.year)}
                     datasets={[
                         {
                             name: safeT(t, 'labelNetDeposits', 'Netto-Einzahlungen'),
                             data: yearlyPerformance.map(y => y.deposits),
                             backgroundColor: '#3b82f6',
                             valueFormatter: fCur
                         },
                         {
                             name: safeT(t, 'labelPureValueGrowthNet', 'Reiner Wertzuwachs (Gewinn)'),
                             data: yearlyPerformance.map(y => y.totalAnnualReturn),
                             backgroundColor: '#10b981',
                             valueFormatter: fCur
                         }
                     ]} 
                     height="100%"
                 />
             </div>
         </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center">
             <div className="font-bold text-gray-700 dark:text-gray-300">
                 {safeT(t, 'titleHistEvalPerformance', 'Historische Auswertung & Performance')}
             </div>
             <div className="flex gap-2">
                 <button 
                     onClick={() => setActiveTableTab('yearly')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTableTab === 'yearly' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                 >
                     {safeT(t, 'btnYearlyOverview', 'Jahresübersicht')}
                 </button>
                 <button 
                     onClick={() => setActiveTableTab('monthly')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTableTab === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                 >
                     {safeT(t, 'btnMonthlyDetail', 'Monatsdetail')}
                 </button>
             </div>
         </div>

         {activeTableTab === 'yearly' && (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                      <tr>
                         <th className="px-6 py-4">{safeT(t, 'colMonth', 'Jahr')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'startValue', 'Startwert')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'inflows', 'Einzahlungen')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'endValue', 'Endwert')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colNetValueGain', 'Wertzuwachs (Netto)')}</th>
                         <th className="px-6 py-4 text-right">{safeT(t, 'colPerformanceAnnual', 'Performance p.a.')}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      {yearlyPerformance.slice().reverse().map((yp, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-3.5 font-bold font-sans text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10">
                                  {yp.year} {yp.year === `${currentCalendarYear}` ? '(YTD)' : ''}
                              </td>
                              <td className="px-4 py-3.5 text-right text-gray-500">{fCur(yp.startVal, 'CHF')}</td>
                              <td className="px-4 py-3.5 text-right text-blue-600 dark:text-blue-400">+{fCur(yp.deposits, 'CHF')}</td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">{fCur(yp.endVal, 'CHF')}</td>
                              <td className={`px-4 py-3.5 text-right font-bold ${yp.totalAnnualReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                  {yp.totalAnnualReturn >= 0 ? '+' : ''}{fCur(yp.totalAnnualReturn, 'CHF')}
                              </td>
                              <td className={`px-6 py-3.5 text-right font-bold ${yp.performancePct >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                                  {yp.performancePct >= 0 ? '+' : ''}{yp.performancePct.toFixed(2)} %
                              </td>
                          </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         )}

         {activeTableTab === 'monthly' && (
             <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left relative">
                   <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                      <tr>
                         <th className="px-6 py-4">{safeT(t, 'colMonth', 'Monat')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colPillar2Invested', 'PK Inv.')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colPillar2Value', 'PK Wert')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colPillar3Invested', '3a Inv.')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colPillar3Value', '3a Wert')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colTotalInvested', 'Total Inv.')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'colTotalValue', 'Total Wert')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'labelPriceProfit', 'Kursgewinn')}</th>
                         <th className="px-4 py-4 text-right">{safeT(t, 'labelYields', 'Erträge')}</th>
                         <th className="px-6 py-4 text-right">{safeT(t, 'labelTotalReturn', 'Total Return')}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      {monthlyDataPoints.slice().reverse().map((d, i) => {
                          const dateObj = new Date(d.dateStr);
                          const displayDate = dateObj.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' });

                          return (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                  <td className="px-6 py-3 font-bold font-sans text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10 whitespace-nowrap">
                                      {displayDate}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-400">{fCur(d.p2.invested, 'CHF')}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fCur(d.p2.actual, 'CHF')}</td>
                                  <td className="px-4 py-3 text-right text-slate-400">{fCur(d.p3.invested, 'CHF')}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fCur(d.p3.actual, 'CHF')}</td>
                                  <td className="px-4 py-3 text-right text-slate-500">{fCur(d.total.invested, 'CHF')}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{fCur(d.total.actual, 'CHF')}</td>
                                  <td className={`px-4 py-3 text-right ${d.total.priceProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                                     {d.total.priceProfit > 0 ? '+' : ''}{fCur(d.total.priceProfit, 'CHF')}
                                  </td>
                                  <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">+{fCur(d.total.yields, 'CHF')}</td>
                                  <td className={`px-6 py-3 text-right font-bold ${d.total.profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600'}`}>
                                     {d.total.roi > 0 ? '+' : ''}{d.total.roi.toFixed(2)} %
                                  </td>
                              </tr>
                          );
                      })}
                   </tbody>
                </table>
             </div>
         )}
      </div>
    </div>
  );
};

module.exports = PensionPerformanceReport;