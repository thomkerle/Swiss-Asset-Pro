const React = require('react');
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || window.DataEngine || {};

const { getAssetValueAtDate = () => 0, getAssetRawValueAtDate = () => 0 } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const DividendCalendarReport = ({ data, activeAssets, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const todayStr = new Date().toISOString().split('T')[0];
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  const [activeTab, setActiveTab] = useState('calendar');

  const yieldAssets = useMemo(() => {
      return (activeAssets || []).filter(a => 
          ['stock', 'fund', 'managed_fund'].includes(a.assetClass) && 
          parseFloat(a.forwardYield || 0) > 0
      );
  }, [activeAssets]);

  const totalYieldAssetsValue = useMemo(() => {
      return yieldAssets.reduce((sum, a) => sum + getAssetValueAtDate(a, todayStr, activeAssets), 0);
  }, [yieldAssets, todayStr, activeAssets]);

  const { 
      monthlyData, 
      assetDividendList,
      totalAnnual, 
      topPayer, 
      topPayerShare,
      bestMonth, 
      weightedYieldPct 
  } = useMemo(() => {
      const today = new Date();
      const next12Months = [];
      
      for (let i = 0; i < 12; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
          next12Months.push({
              id: `${d.getFullYear()}-${d.getMonth() + 1}`,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              label: d.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }),
              expectedAmount: 0,
              details: []
          });
      }

      let annualSumBase = 0;
      let highestPayer = { name: '-', amount: 0, share: 0 };
      const assetList = [];

      yieldAssets.forEach(asset => {
          const yieldPct = parseFloat(asset.forwardYield || 0);
          const taxPct = parseFloat(asset.totalTaxes || 0); 
          
          if (yieldPct <= 0) return;

          let currentValueNative = getAssetRawValueAtDate(asset, todayStr);
          
          if (!currentValueNative || currentValueNative === 0) {
              const bVal = getAssetValueAtDate(asset, todayStr, activeAssets);
              const fx = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
              currentValueNative = fx !== 0 ? bVal / fx : bVal;
          }

          if (currentValueNative <= 0) return; 

          const grossAnnualNative = currentValueNative * (yieldPct / 100);
          const netAnnualNative = grossAnnualNative * (1 - (taxPct / 100));
          const exchangeRate = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
          const netAnnualBase = netAnnualNative * exchangeRate;
          const currentValBase = currentValueNative * exchangeRate;

          annualSumBase += netAnnualBase;

          let monthsRaw = (asset.payoutMonths || '').split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m) && m >= 1 && m <= 12);
          if (monthsRaw.length === 0) monthsRaw = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

          const perPayoutBase = netAnnualBase / monthsRaw.length;
          const perPayoutNative = netAnnualNative / monthsRaw.length;

          assetList.push({
              name: asset.name,
              class: asset.assetClass,
              currency: asset.currency || baseCurrency,
              currentValue: currentValBase,
              forwardYield: yieldPct,
              taxPct: taxPct,
              annualNet: netAnnualBase,
              annualNetNative: netAnnualNative,
              payoutCount: monthsRaw.length,
              payoutMonths: monthsRaw.sort((a,b) => a - b).join(', ')
          });

          if (netAnnualBase > highestPayer.amount) {
              highestPayer = { name: asset.name, amount: netAnnualBase, share: 0 };
          }

          next12Months.forEach(m => {
              if (monthsRaw.includes(m.month)) {
                  m.expectedAmount += perPayoutBase;
                  m.details.push({
                      assetName: asset.name,
                      assetClass: asset.assetClass,
                      amountBase: perPayoutBase,
                      amountNative: perPayoutNative,
                      currency: asset.currency || baseCurrency,
                      exchangeRate: exchangeRate
                  });
              }
          });
      });

      next12Months.forEach(m => m.details.sort((a, b) => b.amountBase - a.amountBase));
      assetList.sort((a, b) => b.annualNet - a.annualNet);

      let maxMonth = { label: '-', amount: 0 };
      next12Months.forEach(m => {
          if (m.expectedAmount > maxMonth.amount) {
              maxMonth = { label: m.label, amount: m.expectedAmount };
          }
      });

      const topShare = annualSumBase > 0 ? (highestPayer.amount / annualSumBase) * 100 : 0;
      highestPayer.share = topShare;

      const weightedYield = totalYieldAssetsValue > 0 ? (annualSumBase / totalYieldAssetsValue) * 100 : 0;

      return { 
          monthlyData: next12Months, 
          assetDividendList: assetList,
          totalAnnual: annualSumBase, 
          topPayer: highestPayer, 
          topPayerShare: topShare,
          bestMonth: maxMonth,
          weightedYieldPct: weightedYield
      };
  }, [yieldAssets, todayStr, activeAssets, baseCurrency, totalYieldAssetsValue]);

  const topPayersChartData = useMemo(() => {
      const topList = assetDividendList.slice(0, 8);
      return {
          labels: topList.map(a => a.name.length > 20 ? a.name.substring(0, 18) + '...' : a.name),
          values: topList.map(a => a.annualNet)
      };
  }, [assetDividendList]);

  const { stackedDatasets } = useMemo(() => {
      const assetNames = new Set();
      monthlyData.forEach(m => {
          m.details.forEach(d => assetNames.add(d.assetName));
      });
      const uniqueNamesArray = Array.from(assetNames).sort();

      const chartColors = [
          '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
          '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6', 
          '#f97316', '#a855f7', '#0ea5e9', '#22c55e', '#64748b'
      ];

      const datasets = uniqueNamesArray.map((assetName, idx) => {
          return {
              name: assetName,
              data: monthlyData.map(m => {
                  const detail = m.details.find(d => d.assetName === assetName);
                  return detail ? detail.amountBase : 0;
              }),
              backgroundColor: chartColors[idx % chartColors.length],
              valueFormatter: fCur,
              stack: 'total'
          };
      });

      return { stackedDatasets: datasets };
  }, [monthlyData, fCur]);

  const repTitle = safeT(t, 'repDividendCalendarTitle', "Dividenden-Prognose (Forward Yield)");
  const repSub = safeT(t, 'repDividendCalendarSub', `Erwartetes passives Einkommen über die nächsten 12 Monate (${baseCurrency})`);

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'kpiExpectedNet12M', 'Erwartetes Netto (12M)'), value: fCur(totalAnnual, baseCurrency), sub: safeT(t, 'descTotalYieldNext12M', 'Gesamtertrag der nächsten 12 Monate'), color: '#10b981' },
            { label: safeT(t, 'labelAvgMonthlyCashflow', 'Ø Monatlicher Cashflow'), value: fCur(totalAnnual / 12, baseCurrency), sub: safeT(t, 'labelSmoothingYear', 'Gleichmäßig geglättet'), color: '#2563eb' },
            { label: safeT(t, 'kpiAvgDivYield', 'Ø Dividendenrendite'), value: `${weightedYieldPct.toFixed(2)}%`, sub: safeT(t, 'descOnActiveYieldAssets', `Auf ${fCur(totalYieldAssetsValue, baseCurrency)} Depotwert`).replace('{val}', fCur(totalYieldAssetsValue, baseCurrency)), color: '#8b5cf6' },
            { label: safeT(t, 'labelTopPayer', 'Top Zahler'), value: topPayer.name, sub: `${fCur(topPayer.amount, baseCurrency)} (${topPayerShare.toFixed(1)}% Anteil)`, color: '#f59e0b' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colMonth', 'Monat'),
            safeT(t, 'colSumNet', 'Summe Netto'),
            safeT(t, 'colPayerCount', 'Anzahl Zahler'),
            safeT(t, 'colPayingPositionsAmounts', 'Zahlende Positionen & Beträge')
        ];
        
        const tableBody = monthlyData.map(d => {
            const payersOverview = d.details.map(detail => {
                return `${detail.assetName} (+${fCur(detail.amountBase, baseCurrency)})`;
            }).slice(0, 4).join(', ') + (d.details.length > 4 ? ` ... (+${d.details.length - 4} weitere)` : '');

            return [
                d.label,
                `+${fCur(d.expectedAmount, baseCurrency)}`,
                `${d.details.length} ${safeT(t, 'labelSecuritiesCount', 'Titel').replace('{count}', '')}`.trim(),
                payersOverview || safeT(t, 'labelNoPayoutsExpected', 'Keine Ausschüttungen erwartet')
            ];
        });

        tableBody.push([
            { text: safeT(t, 'labelTotal12MForecast', 'TOTAL 12 MONATE (PROGNOSE)'), bold: true },
            { text: `+${fCur(totalAnnual, baseCurrency)}`, bold: true, color: '#10b981' },
            { text: `${assetDividendList.length} ${safeT(t, 'labelSecuritiesCount', 'Titel').replace('{count}', '')}`.trim(), bold: true },
            { text: `${safeT(t, 'labelTopMonthDetail', `Top Monat: ${bestMonth.label}`).replace('{month}', bestMonth.label)} (+${fCur(bestMonth.amount, baseCurrency)})`, bold: true, color: '#2563eb' }
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
          colWidthsPct: [0.16, 0.18, 0.14, 0.52],
          colAligns: ['left', 'right', 'center', 'left'],
          kpis,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im DividendCalendarReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 8, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.16, 0.18, 0.14, 0.52],
                    colAligns: ['left', 'right', 'center', 'left'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im DividendCalendarReport:", err);
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
  }, [monthlyData, assetDividendList, fCur, t, repTitle, repSub, data, baseCurrency, totalAnnual, weightedYieldPct, topPayer, topPayerShare, bestMonth, totalYieldAssetsValue]);

  if (yieldAssets.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 mx-auto">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Calendar" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'noForwardYieldData', 'Es wurden noch keine "Erw. Rendite" Werte in deinen Aktien/Fonds hinterlegt.')}</p>
          <p className="text-xs mt-2 opacity-70">{safeT(t, 'hintEnterForwardYieldInEditor', 'Wähle ein Wertpapier aus und trage im Editor unten die Dividenden-Prognose (Forward Yield in %) ein.')}</p>
        </div>
      </div>
    );
  }

  const predictedPayoutsTitle = safeT(t, 'titlePredictedPayoutsCurrency', 'Prognostizierte Monatsausschüttungen ({cur})').replace('{cur}', baseCurrency);
  const activeAssetsDesc = safeT(t, 'descOnActiveYieldAssets', 'Auf {val} dividendenaktive Assets').replace('{val}', fCur(totalYieldAssetsValue, baseCurrency));
  const topPayerAnnualNetDesc = safeT(t, 'descTopPayerAnnualNet', '+{val} p.a. Netto').replace('{val}', fCur(topPayer.amount, baseCurrency));

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 mx-auto" ref={reportRef}>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-emerald-50/60 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-600 overflow-hidden">
            <div className="text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Calendar" size={14} /> 
                {safeT(t, 'labelExpectedNetIncome', 'ERWARTETES NETTO (12M)')}
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 truncate">
                +{fCur(totalAnnual, baseCurrency)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'labelSumNetPayouts', 'Summe der prognostizierten Netto-Ausschüttungen')}
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Activity" size={14} className="text-blue-500" />
                {safeT(t, 'kpiAvgMonthlyCashflow', 'Ø MONATL. CASHFLOW')}
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 truncate">
                {fCur(totalAnnual / 12, baseCurrency)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descSmoothing12M', 'Gleichmäßige Glättung über 12 Monate')}
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Percent" size={14} className="text-purple-500" />
                {safeT(t, 'kpiAvgDivYield', 'Ø DIVIDENDENRENDITE')}
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 truncate">
                {weightedYieldPct.toFixed(2)} %
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {activeAssetsDesc}
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-orange-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                    <Icon name="Star" size={14} className="text-orange-500" />
                    {safeT(t, 'kpiTopYieldPayer', 'TOP ERTRAGSBRINGER')}
                </span>
                <span className="text-[10px] font-bold bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded">
                    {topPayerShare.toFixed(1)}% Anteil
                </span>
            </div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-200 truncate" title={topPayer.name}>
               {topPayer.name}
            </div>
            <div className="text-xs font-bold text-orange-500 mt-2 truncate">
                {topPayerAnnualNetDesc}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
          
          <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleExpectedCashflows12M', 'Voraussichtliche Zahlungsströme (12M)')}>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Icon name="BarChart" className="text-blue-500" /> {predictedPayoutsTitle}
              </h3>
              <div style={{ width: '100%', height: '340px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="bar"
                      labels={monthlyData.map(d => d.label)}
                      datasets={stackedDatasets.length > 0 ? stackedDatasets : [{
                          name: `${safeT(t, 'labelExpectedDividend', 'Erwartete Dividende')} (${baseCurrency})`,
                          data: monthlyData.map(d => d.expectedAmount),
                          backgroundColor: '#3b82f6', 
                          valueFormatter: fCur
                      }]} 
                      height="100%"
                  />
              </div>
          </div>

          <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleTopDivPayersAnnual', 'Top Dividendenzahler (p.a.)')}>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Icon name="PieChart" className="text-emerald-500" /> {safeT(t, 'titleStrongestDivPayersNet', 'Stärkste Dividendenzahler (p.a. Netto)')}
              </h3>
              <div style={{ width: '100%', height: '340px' }}>
                  <UniversalChart 
                      engine={activeChartEngine}
                      type="bar"
                      horizontal={true}
                      labels={topPayersChartData.labels}
                      datasets={[{
                          label: safeT(t, 'labelAnnualDivNet', 'Jahresdividende Netto'),
                          data: topPayersChartData.values,
                          backgroundColor: '#10b981',
                          valueFormatter: fCur
                      }]}
                      height="100%"
                  />
              </div>
          </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
             <div className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                 <Icon name="List" className="text-slate-500" />
                 {activeTab === 'calendar' 
                    ? safeT(t, 'tabMonthlyCalendarFlows', 'Monatskalender (Zahlungsströme)') 
                    : safeT(t, 'tabAssetOverviewPositions', `Asset-Übersicht (${assetDividendList.length} Positionen)`).replace('{count}', assetDividendList.length)}
             </div>
             <div className="flex gap-2">
                 <button 
                     onClick={() => setActiveTab('calendar')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'calendar' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                 >
                     {safeT(t, 'btn12MonthCalendar', '12-Monats-Kalender')}
                 </button>
                 <button 
                     onClick={() => setActiveTab('assets')}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'assets' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                 >
                     {safeT(t, 'btnAssetYields', 'Asset-Renditen')}
                 </button>
             </div>
         </div>

         {activeTab === 'calendar' && (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                      <tr>
                         <th className="px-6 py-4 w-1/5">{safeT(t, 'colMonth', 'Monat')}</th>
                         <th className="px-4 py-4 w-1/5 text-right">{safeT(t, 'colSumNet', 'Summe Netto')}</th>
                         <th className="px-6 py-4 w-3/5">{safeT(t, 'colPayingAssetsSingleAmounts', 'Zahlende Assets & Einzelbeträge')}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {monthlyData.map((d) => (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10 whitespace-nowrap">
                                  {d.label}
                              </td>
                              <td className="px-4 py-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
                                  {d.expectedAmount > 0 ? '+' : ''}{fCur(d.expectedAmount, baseCurrency)}
                              </td>
                              <td className="px-6 py-3">
                                  {d.details.length > 0 ? (
                                      <div className="flex flex-col gap-1.5">
                                          {d.details.map((detail, i) => (
                                              <div key={i} className="flex justify-between items-center text-xs py-0.5 border-b border-gray-50 dark:border-slate-800/40 last:border-0">
                                                  <div className="flex items-center gap-2 truncate pr-4">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{detail.assetName}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                                                          +{fCur(detail.amountBase, baseCurrency)}
                                                      </span>
                                                      {detail.currency !== baseCurrency && (
                                                          <span className="text-[10px] text-gray-400 font-mono">
                                                              ({fCur(detail.amountNative, detail.currency)})
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <span className="text-gray-400 italic text-xs">{safeT(t, 'msgNoPayoutsThisMonth', 'Keine Auszahlungen in diesem Monat')}</span>
                                  )}
                              </td>
                          </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         )}

         {activeTab === 'assets' && (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                      <tr>
                         <th className="p-4">{safeT(t, 'colSecurityAsset', 'Wertpapier / Asset')}</th>
                         <th className="p-4 text-right">{safeT(t, 'colPortfolioValue', 'Depotwert')}</th>
                         <th className="p-4 text-right">{safeT(t, 'colForwardYield', 'Forward Yield')}</th>
                         <th className="p-4 text-right">{safeT(t, 'colWithholdingTax', 'Quellensteuer')}</th>
                         <th className="p-4 text-center">{safeT(t, 'colPayoutFrequency', 'Frequenz')}</th>
                         <th className="p-4 text-right">{safeT(t, 'colAnnualYieldNet', 'Jahresertrag Netto')}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      {assetDividendList.map((a, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-4 font-sans font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                  <span className="truncate">{a.name}</span>
                              </td>
                              <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                                  {fCur(a.currentValue, baseCurrency)}
                              </td>
                              <td className="p-4 text-right text-blue-600 dark:text-blue-400 font-bold">
                                  {a.forwardYield.toFixed(2)} %
                              </td>
                              <td className="p-4 text-right text-gray-400 text-xs">
                                  {a.taxPct > 0 ? `${a.taxPct.toFixed(1)}%` : '0%'}
                              </td>
                              <td className="p-4 text-center font-sans text-xs text-gray-500">
                                  {safeT(t, 'labelTimesPerYear', '{count}x / Jahr').replace('{count}', a.payoutCount)}
                              </td>
                              <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                                  +{fCur(a.annualNet, baseCurrency)}
                              </td>
                          </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         )}

      </div>
    </div>
  );
};

module.exports = DividendCalendarReport;