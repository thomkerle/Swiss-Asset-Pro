const React = require('react');
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};

const { getAssetValueAtDate = () => 0, getAssetRawValueAtDate = () => 0 } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);

const DividendCalendarReport = ({ data, activeAssets, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const todayStr = new Date().toISOString().split('T')[0];
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  const safeT = useCallback((key, fallback) => {
      if (!t) return fallback;
      const res = t(key);
      return (res && res !== key) ? res : fallback;
  }, [t]);

  const yieldAssets = (activeAssets || []).filter(a => 
      ['stock', 'fund', 'managed_fund'].includes(a.assetClass) && 
      parseFloat(a.forwardYield || 0) > 0
  );

  const { monthlyData, totalAnnual, topPayer, bestMonth } = useMemo(() => {
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
      let highestPayer = { name: '-', amount: 0 };

      yieldAssets.forEach(asset => {
          const yieldPct = parseFloat(asset.forwardYield || 0);
          const taxPct = parseFloat(asset.totalTaxes || 0); 
          
          if (yieldPct <= 0) return;

          // --- SAUBERE WERTERMITTLUNG ÜBER DIE FINSPA ENGINE ---
          let currentValueNative = getAssetRawValueAtDate(asset, todayStr);
          
          // Fallback, falls die Originalwährung nicht erfasst werden konnte
          if (!currentValueNative || currentValueNative === 0) {
              const bVal = getAssetValueAtDate(asset, todayStr, activeAssets);
              const fx = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
              currentValueNative = fx !== 0 ? bVal / fx : bVal;
          }

          // Abbruch, wenn das Asset wirklich leer ist
          if (currentValueNative <= 0) return; 

          // Mathematik: Brutto -> Netto -> Umrechnung in CHF
          const grossAnnualNative = currentValueNative * (yieldPct / 100);
          const netAnnualNative = grossAnnualNative * (1 - (taxPct / 100));
          const exchangeRate = parseFloat(String(asset.exchangeRate || 1).replace(',', '.'));
          const netAnnualBase = netAnnualNative * exchangeRate;

          annualSumBase += netAnnualBase;

          if (netAnnualBase > highestPayer.amount) {
              highestPayer = { name: asset.name, amount: netAnnualBase };
          }

          let monthsRaw = (asset.payoutMonths || '').split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m) && m >= 1 && m <= 12);
          if (monthsRaw.length === 0) monthsRaw = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

          const perPayoutBase = netAnnualBase / monthsRaw.length;
          const perPayoutNative = netAnnualNative / monthsRaw.length;

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

      let maxMonth = { label: '-', amount: 0 };
      next12Months.forEach(m => {
          if (m.expectedAmount > maxMonth.amount) {
              maxMonth = { label: m.label, amount: m.expectedAmount };
          }
      });

      return { monthlyData: next12Months, totalAnnual: annualSumBase, topPayer: highestPayer, bestMonth: maxMonth };
  }, [yieldAssets, todayStr, activeAssets, baseCurrency]);

  const { uniqueAssets, stackedDatasets } = useMemo(() => {
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

      return { uniqueAssets: uniqueNamesArray, stackedDatasets: datasets };
  }, [monthlyData, fCur]);

  const repTitle = safeT('repDividendCalendarTitle', "Dividenden-Prognose (Forward Yield)");
  const repSub = safeT('repDividendCalendarSub', "Erwartetes passives Einkommen der nächsten 12 Monate");

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
    // Helfer-Funktion für die Datenextraktion (Single & Batch Export)
    const buildReportData = async () => {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        // 1. KPI Block
        const kpiBlock = document.querySelector('.kpi-dividend-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        // 2. Chart Block
        const chartBlock = document.querySelector('.chart-dividend-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ 
                title: safeT('labelExpectedCashflows', `Voraussichtliche Zahlungsströme (Netto in ${baseCurrency})`), 
                image: canvas.toDataURL('image/png', 1.0) 
            }); 
        }

        // 3. Tabellendaten generieren
        const tableHeaders = [
            safeT('colMonth', 'Monat'),
            safeT('colSumExpected', 'Summe Erwartet'),
            safeT('colPayingAssets', 'Zahlende Assets & Originalwährung')
        ];
        
        const tableBody = monthlyData.map(d => {
            const assetsText = d.details.map(detail => {
                const baseText = fCur ? fCur(detail.amountBase, baseCurrency) : detail.amountBase;
                const nativeText = (detail.currency !== baseCurrency) ? ` (${fCur ? fCur(detail.amountNative, detail.currency) : detail.amountNative} @ ${detail.exchangeRate})` : '';
                return `${detail.assetName}: +${baseText}${nativeText}`;
            }).join('\n');

            return [
                d.label,
                `+${fCur ? fCur(d.expectedAmount, baseCurrency) : d.expectedAmount}`,
                assetsText || safeT('labelNoPayoutsExpected', 'Keine Auszahlungen erwartet')
            ];
        });

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast("PDF wird generiert...", "info");
        }
        
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: repSub,
          tableHeaders,
          tableBody,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error:", err);
        if (typeof window !== 'undefined' && window.showToast) window.showToast("Fehler beim PDF Export.", "error");
      }
    };

    // --- NEU: BATCH EXPORT (ORCHESTRATOR) ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 8, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im DividendCalendarReport:", err);
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
  }, [monthlyData, fCur, safeT, repTitle, repSub, data, baseCurrency]);

  if (yieldAssets.length === 0) {
    return (
      <div className="max-w-[1400px] px-4 md:px-8 pb-12 mx-auto">
                <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Calendar" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT('noForwardYieldData', 'Es wurden noch keine "Erw. Rendite" Werte in deinen Aktien/Fonds hinterlegt.')}</p>
          <p className="text-xs mt-2 opacity-70">Wähle links im Baum ein Wertpapier aus und trage im Editor unten die Dividenden-Prognose ein.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] px-4 md:px-8 pb-12 mx-auto animate-fade-in">

      <div className="kpi-dividend-export-block w-full bg-white dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} /> {safeT('labelExpectedNetIncome', 'Erwartetes Netto-Einkommen (12M)')}
                </div>
                <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                    +{fCur ? fCur(totalAnnual, baseCurrency) : totalAnnual}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-2">{safeT('labelSumNetPayouts', 'Summe der Netto-Ausschüttungen')}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT('labelAvgMonthlyCashflow', 'Ø Monatlicher Cashflow')}</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {fCur ? fCur(totalAnnual / 12, baseCurrency) : totalAnnual / 12}
                </div>
                <div className="text-xs text-gray-400 mt-2">{safeT('labelSmoothingYear', 'Glättung über das gesamte Jahr')}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT('labelStrongestMonth', 'Stärkster Monat')}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-200 flex items-baseline gap-2">
                   <span className="truncate">{bestMonth.label}</span>
                </div>
                <div className="text-sm font-bold text-indigo-500 mt-1">{fCur ? fCur(bestMonth.amount, baseCurrency) : bestMonth.amount}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{safeT('labelTopPayer', 'Top Zahler')}</div>
                <div className="text-xl font-black text-slate-800 dark:text-slate-200 truncate" title={topPayer.name}>
                   {topPayer.name}
                </div>
                <div className="text-sm font-bold text-orange-500 mt-1">{fCur ? fCur(topPayer.amount, baseCurrency) : topPayer.amount} p.a.</div>
             </div>
          </div>
      </div>

      <div className="chart-dividend-export-block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8" ref={chartRef}>
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Icon name="BarChart" className="text-blue-500" /> {safeT('labelExpectedCashflows', `Voraussichtliche Zahlungsströme (Netto in ${baseCurrency})`)}
          </h3>
          <div style={{ width: '100%', height: '320px' }}>
              <UniversalChart 
                  engine={activeChartEngine}
                  type="bar"
                  stacked={true}
                  labels={monthlyData.map(d => d.label)}
                  datasets={stackedDatasets.length > 0 ? stackedDatasets : [{
                      name: `Erwartete Dividende (${baseCurrency})`,
                      data: monthlyData.map(d => d.expectedAmount),
                      backgroundColor: '#3b82f6', 
                      valueFormatter: fCur
                  }]} 
                  height="100%"
              />
          </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mt-8">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             {safeT('labelMonthlyBreakdown', 'Monatliche Aufschlüsselung')}
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left relative">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                     <th className="px-6 py-4 bg-gray-50/50 dark:bg-slate-900/50 w-1/4">{safeT('colMonth', 'Monat')}</th>
                     <th className="px-4 py-4 w-1/4 text-right">{safeT('colSumExpected', 'Summe Erwartet')}</th>
                     <th className="px-6 py-4 w-1/2">{safeT('colPayingAssets', 'Zahlende Assets & Originalwährung')}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {monthlyData.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 bg-gray-50/20 dark:bg-slate-900/10">
                              {d.label}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
                              {d.expectedAmount > 0 ? '+' : ''}{fCur ? fCur(d.expectedAmount, baseCurrency) : d.expectedAmount}
                          </td>
                          <td className="px-6 py-3">
                              {d.details.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                      {d.details.map((detail, i) => (
                                          <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                                              <div className="flex items-center gap-2 truncate pr-4">
                                                  <Icon name={detail.assetClass === 'stock' ? 'TrendingUp' : (detail.assetClass === 'managed_fund' ? 'Activity' : 'PieChart')} size={12} className="text-gray-400 shrink-0" />
                                                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{detail.assetName}</span>
                                              </div>
                                              
                                              <div className="flex flex-col items-end shrink-0">
                                                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                                                      +{fCur ? fCur(detail.amountBase, baseCurrency) : detail.amountBase}
                                                  </span>
                                                  {detail.currency !== baseCurrency && (
                                                      <span className="text-[10px] text-gray-400 font-mono mt-0.5" title={`Angewandter Wechselkurs: ${detail.exchangeRate}`}>
                                                          {fCur ? fCur(detail.amountNative, detail.currency) : detail.amountNative} @ {detail.exchangeRate}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <span className="text-gray-400 italic text-xs">{safeT('labelNoPayoutsExpected', 'Keine Auszahlungen erwartet')}</span>
                              )}
                          </td>
                      </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

module.exports = DividendCalendarReport;