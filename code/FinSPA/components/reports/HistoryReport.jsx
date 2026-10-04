const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);
const { getAssetValueAtDate, generateMonthEnds } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const HistoryReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

  const lblTotal = safeT(t, 'labelTotalWealth', 'Gesamtvermögen');
  const lblCash = safeT(t, 'catCashAccounts', 'Cash & Konten');
  const lblSec = safeT(t, 'catSecuritiesCrypto', 'Wertpapiere & Krypto');
  const lblPen = safeT(t, 'catPensionProvident', 'Vorsorge (Pensionskasse, 3a)');
  const lblRE = safeT(t, 'catRealEstateNet', 'Immobilien (Netto)');

  const { 
    rawData, 
    finalDates, 
    formattedLabels,
    startValue, 
    endValue, 
    diff, 
    percentChange, 
    peakValue, 
    peakDate,
    monthsCount, 
    avgMonthlyGrowth,
    isPositive 
  } = useMemo(() => {
    let dates = generateMonthEnds ? generateMonthEnds(dateRange.from, dateRange.to) : [];
    if (dates.length === 0 || dates[0] > dateRange.from) dates = [dateRange.from, ...dates];
    if (dates[dates.length - 1] < dateRange.to) dates = [...dates, dateRange.to];
    dates = [...new Set(dates)].sort();

    let prevTotal = null;
    let peak = { val: 0, date: '-' };

    const dataList = dates.map(d => {
        let tTotal = 0, tCash = 0, tSec = 0, tPen = 0, tRE = 0;
        
        if (activeAssets && getAssetValueAtDate) {
            activeAssets.forEach(a => {
                const val = getAssetValueAtDate(a, d, activeAssets);
                if (val === 0) return;
                
                tTotal += val;
                if (a.assetClass === 'cash') tCash += val;
                else if (['stock', 'fund', 'crypto', 'managed_fund'].includes(a.assetClass)) tSec += val;
                else if (a.assetClass?.includes('pension')) tPen += val;
                else if (['realestate', 'mortgage'].includes(a.assetClass)) tRE += val;
            });
        }

        if (tTotal > peak.val) {
          peak = { val: tTotal, date: d };
        }

        const momDelta = prevTotal !== null ? tTotal - prevTotal : 0;
        const momPct = (prevTotal !== null && prevTotal > 0) ? (momDelta / prevTotal) * 100 : 0;
        prevTotal = tTotal;

        return { 
          date: d, 
          total: tTotal, 
          cash: tCash, 
          securities: tSec, 
          pension: tPen, 
          realestate: tRE,
          momDelta,
          momPct
        };
    });

    const startVal = dataList[0]?.total || 0;
    const endVal = dataList[dataList.length - 1]?.total || 0;
    const totalDiff = endVal - startVal;
    const pct = startVal !== 0 ? (totalDiff / startVal) * 100 : 0;
    const mCount = dataList.length > 1 ? dataList.length - 1 : 1;

    const labels = dataList.map(item => {
      const parts = item.date.split('-');
      return `${parts[1]}.${parts[0].slice(-2)}`;
    });

    return {
      rawData: dataList,
      finalDates: dates,
      formattedLabels: labels,
      startValue: startVal,
      endValue: endVal,
      diff: totalDiff,
      percentChange: pct,
      peakValue: peak.val,
      peakDate: peak.date,
      monthsCount: mCount,
      avgMonthlyGrowth: totalDiff / mCount,
      isPositive: totalDiff >= 0
    };
  }, [activeAssets, dateRange]);

  useEffect(() => {
    const buildReportData = async () => {
        const startDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const endDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');

        const kpis = [
            { label: safeT(t, 'labelStartWealth', 'Startvermögen'), value: fCur(startValue), sub: startDateStr, color: '#94a3b8' },
            { label: safeT(t, 'currentVolume', 'Aktuelles Volumen'), value: fCur(endValue), sub: endDateStr, color: '#2563eb' },
            { label: safeT(t, 'kpiTotalPerformance', 'Gesamtperformance'), value: `${isPositive ? '+' : ''}${fCur(diff)}`, sub: `${isPositive ? '+' : ''}${percentChange.toFixed(2)}% ${safeT(t, 'descNoWinnersPeriod', 'im Zeitraum')}`, color: isPositive ? '#10b981' : '#ef4444' },
            { label: safeT(t, 'kpiPeakAllTime', 'Höchststand (Peak)'), value: fCur(peakValue), sub: safeT(t, 'descReachedOnDate', `Erreicht am ${new Date(peakDate).toLocaleDateString('de-CH')}`).replace('{date}', new Date(peakDate).toLocaleDateString('de-CH')), color: '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
          safeT(t, 'colDateOnly', 'Datum'),
          safeT(t, 'colTotalVal', 'Gesamtwert'),
          safeT(t, 'colMomDelta', 'MoM Delta'),
          safeT(t, 'catCashShort', 'Cash'),
          safeT(t, 'catSecuritiesShort', 'Wertpapiere'),
          safeT(t, 'catPensionShort', 'Vorsorge'),
          safeT(t, 'catRealEstateShort', 'Immobilien')
        ];

        const tableBody = [...rawData].reverse().map((d) => [
          new Date(d.date).toLocaleDateString('de-CH'),
          fCur(d.total),
          `${d.momDelta >= 0 ? '+' : ''}${fCur(d.momDelta)} (${d.momPct.toFixed(1)}%)`,
          fCur(d.cash),
          fCur(d.securities),
          fCur(d.pension),
          fCur(d.realestate)
        ]);

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        const pdfStartDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const pdfEndDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');
        const pdfSubtitle = safeT(t, 'pdfSubHistoryReport', `${pdfStartDateStr} bis ${pdfEndDateStr} | Dynamik & Entwicklung`)
          .replace('{start}', pdfStartDateStr)
          .replace('{end}', pdfEndDateStr);

        await PdfToolkit.exportReport({
          title: safeT(t, 'repHistTitleLong', 'Historische Vermögensentwicklung'),
          subtitle: pdfSubtitle,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.14, 0.16, 0.18, 0.13, 0.13, 0.13, 0.13],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im HistoryReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                const pdfStartDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
                const pdfEndDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');

                resolve({
                    order: 4, 
                    title: safeT(t, 'repHistTitleLong', 'Historische Vermögensentwicklung'),
                    subtitle: `${pdfStartDateStr} ${safeT(t, 'wordTo', 'bis')} ${pdfEndDateStr}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.14, 0.16, 0.18, 0.13, 0.13, 0.13, 0.13],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
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
  }, [rawData, startValue, endValue, diff, percentChange, peakValue, peakDate, isPositive, dateRange, fCur, t, data]);

  if (rawData.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'noDataForPeriod', 'Keine Daten für den gewählten Zeitraum gefunden.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      <div className="w-full bg-white dark:bg-transparent">
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400 overflow-hidden">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} className="text-slate-500"/>
                    <span>{safeT(t, 'labelStartVolumeHeader', 'STARTVERMÖGEN')}</span>
                 </div>
                 <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
                    {fCur(startValue)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 font-medium">
                    {new Date(dateRange.from).toLocaleDateString('de-CH')}
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Target" size={14} className="text-blue-500"/>
                    <span>{safeT(t, 'labelEndVolumeHeader', 'ENDVERMÖGEN')}</span>
                 </div>
                 <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
                    {fCur(endValue)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 font-medium">
                    {new Date(dateRange.to).toLocaleDateString('de-CH')}
                 </div>
             </div>
             
             <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 overflow-hidden ${isPositive ? 'border-b-emerald-500' : 'border-b-rose-500'}`}>
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Icon name={isPositive ? 'TrendingUp' : 'TrendingDown'} size={14} className={isPositive ? 'text-emerald-500' : 'text-rose-500'}/>
                        <span>{safeT(t, 'titlePerformance', 'PERFORMANCE')}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
                        {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
                    </span>
                 </div>
                 <div className={`font-black text-2xl truncate ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isPositive ? '+' : ''}{fCur(diff)}
                 </div>
                 <div className="mt-2 text-xs text-gray-400 truncate">
                    {safeT(t, 'descAvgPerMonth', 'Ø {amount} / Monat').replace('{amount}', `${avgMonthlyGrowth >= 0 ? '+' : ''}${fCur(avgMonthlyGrowth)}`)}
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 overflow-hidden">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Activity" size={14} className="text-amber-500"/>
                    <span>{safeT(t, 'labelPeakAllTimeHeader', 'ALL-TIME HIGH (PEAK)')}</span>
                 </div>
                 <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
                    {fCur(peakValue)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 truncate">
                    {safeT(t, 'descReachedOnDate', `Erreicht am ${new Date(peakDate).toLocaleDateString('de-CH')}`).replace('{date}', new Date(peakDate).toLocaleDateString('de-CH'))}
                 </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
               data-pdf-title={safeT(t, 'titleWealthCurvePdf', 'Gesamtvermögensverlauf')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="TrendingUp" className="text-blue-500" /> {safeT(t, 'titleWealthCurveTrack', 'Verlauf des Gesamtvermögens')}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="line"
                        labels={formattedLabels}
                        datasets={[{
                            label: lblTotal,
                            data: rawData.map(d => d.total),
                            backgroundColor: '#2563eb',
                            valueFormatter: fCur
                        }]} 
                        height="100%"
                    />
                </div>
            </div>

            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
               data-pdf-title={safeT(t, 'titleCompHistPdf', 'Historische Zusammensetzung')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="Layers" className="text-indigo-500" /> {safeT(t, 'titleCompByCategories', 'Zusammensetzung nach Kategorien')}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={formattedLabels}
                        datasets={[
                            {
                                label: lblCash,
                                data: rawData.map(d => d.cash),
                                backgroundColor: '#10b981',
                                valueFormatter: fCur,
                                stack: 'classes'
                            },
                            {
                                label: lblSec,
                                data: rawData.map(d => d.securities),
                                backgroundColor: '#3b82f6',
                                valueFormatter: fCur,
                                stack: 'classes'
                            },
                            {
                                label: lblPen,
                                data: rawData.map(d => d.pension),
                                backgroundColor: '#8b5cf6',
                                valueFormatter: fCur,
                                stack: 'classes'
                            },
                            {
                                label: lblRE,
                                data: rawData.map(d => d.realestate),
                                backgroundColor: '#f59e0b',
                                valueFormatter: fCur,
                                stack: 'classes'
                            }
                        ]} 
                        height="100%"
                    />
                </div>
            </div>

            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block xl:col-span-2" 
               data-pdf-title={safeT(t, 'titleMonthlyDeltaPdf', 'Monatliche Wertveränderung')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart" className="text-emerald-500" /> {safeT(t, 'titleMonthlyDeltaDynamics', 'Monatliche Dynamik (Nettoveränderung vs. Vormonat)')}
                </h3>
                <div style={{ width: '100%', height: '260px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={formattedLabels}
                        datasets={[{
                            label: safeT(t, 'labelMoMChange', 'MoM Veränderung'),
                            data: rawData.map(d => d.momDelta),
                            backgroundColor: rawData.map(d => d.momDelta >= 0 ? '#10b981' : '#ef4444'),
                            valueFormatter: (val) => `${val >= 0 ? '+' : ''}${fCur(val)}`
                        }]} 
                        height="100%"
                    />
                </div>
            </div>

          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Icon name="Calendar" className="text-slate-500" /> {safeT(t, 'titleMonthlyHistClassTable', 'Monatliche Historie & Klassenaufschlüsselung')}
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                      {safeT(t, 'descDaysInPeriodCount', '{count} Stichtage im Analysezeitraum').replace('{count}', rawData.length)}
                  </span>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="p-4">{safeT(t, 'labelDateAt', 'Stichtag')}</th>
                              <th className="p-4 text-right">{safeT(t, 'labelTotalWealth', 'Gesamtvermögen')}</th>
                              <th className="p-4 text-right">{safeT(t, 'colMomDelta', 'MoM Delta')}</th>
                              <th className="p-4 text-right">{safeT(t, 'catCashShort', 'Cash')}</th>
                              <th className="p-4 text-right">{safeT(t, 'catSecuritiesShort', 'Wertpapiere')}</th>
                              <th className="p-4 text-right">{safeT(t, 'catPensionShort', 'Vorsorge')}</th>
                              <th className="p-4 text-right">{safeT(t, 'catRealEstateShort', 'Immobilien')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                          {[...rawData].reverse().map((d, idx) => {
                              const isPositiveMoM = d.momDelta >= 0;
                              return (
                                  <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="p-4 font-bold font-sans text-slate-800 dark:text-slate-200">
                                          {new Date(d.date).toLocaleDateString('de-CH')}
                                      </td>
                                      <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                                          {fCur(d.total)}
                                      </td>
                                      <td className={`p-4 text-right font-bold ${isPositiveMoM ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                          {isPositiveMoM ? '+' : ''}{fCur(d.momDelta)} <span className="text-xs opacity-75 font-normal">({isPositiveMoM ? '+' : ''}{d.momPct.toFixed(1)}%)</span>
                                      </td>
                                      <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                          {fCur(d.cash)}
                                      </td>
                                      <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                          {fCur(d.securities)}
                                      </td>
                                      <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                          {fCur(d.pension)}
                                      </td>
                                      <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                          {fCur(d.realestate)}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};

module.exports = HistoryReport;