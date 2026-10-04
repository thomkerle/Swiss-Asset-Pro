const React = require('react');
const { useState, useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);
const { getAllAssets, getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const AllocationReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  const [isDark, setIsDark] = useState(typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);

  useEffect(() => {
      if (typeof document === 'undefined') return;
      const observer = new MutationObserver(() => {
          setIsDark(document.documentElement.classList.contains('dark'));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
  }, []);

  const formatCurrency = (val) => fCur ? fCur(val) : val;

  const { 
    allocData, 
    currencyData,
    macroClasses,
    grandTotal, 
    totalAssetsCount, 
    topBank, 
    topBankPercent, 
    top3Percent,
    uniqueBanksCount 
  } = useMemo(() => {
    let gt = 0;
    let tac = 0;
    
    if (!data?.banks) {
      return { 
        allocData: [], currencyData: [], macroClasses: [], 
        grandTotal: 0, totalAssetsCount: 0, topBank: null, 
        topBankPercent: 0, top3Percent: 0, uniqueBanksCount: 0 
      };
    }

    const curMap = {};
    const macroMap = {
      cash: { label: safeT(t, 'catMacroCash', safeT(t, 'catCashShort', 'Liquidität & Cash')), value: 0, color: '#10b981' },
      securities: { label: safeT(t, 'catMacroSecurities', safeT(t, 'catSecuritiesShort', 'Wertpapiere & Krypto')), value: 0, color: '#3b82f6' },
      pension: { label: safeT(t, 'catMacroPension', safeT(t, 'catPensionShort', 'Vorsorge & Säule 3a')), value: 0, color: '#8b5cf6' },
      realestate: { label: safeT(t, 'catMacroRealEstate', safeT(t, 'catRealEstateShort', 'Immobilien & Sachwerte')), value: 0, color: '#f59e0b' }
    };

    const mappedData = data.banks.map(b => {
      const assets = getAllAssets([b]).filter(a => !a?.isArchived);
      let bankVal = 0;
      const bankCurrencies = {};

      assets.forEach(a => {
        const val = getAssetValueAtDate(a, targetDate);
        bankVal += val;
        gt += val;
        tac++;

        const cur = a.currency || baseCurrency;
        curMap[cur] = (curMap[cur] || 0) + val;
        bankCurrencies[cur] = (bankCurrencies[cur] || 0) + val;

        const ac = (a.assetClass || '').toLowerCase();
        if (ac === 'cash') macroMap.cash.value += val;
        else if (['stock', 'fund', 'crypto', 'managed_fund'].includes(ac)) macroMap.securities.value += val;
        else if (ac.includes('pension')) macroMap.pension.value += val;
        else if (['realestate', 'mortgage'].includes(ac)) macroMap.realestate.value += val;
        else macroMap.cash.value += val;
      });

      const primaryCur = Object.keys(bankCurrencies).sort((x, y) => bankCurrencies[y] - bankCurrencies[x])[0] || baseCurrency;

      return { 
          label: b.name || safeT(t, 'unknown', 'Unbekannt'), 
          value: bankVal,
          assetCount: assets.length,
          primaryCurrency: primaryCur
      };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

    let runningSum = 0;
    mappedData.forEach(item => {
      runningSum += item.value;
      item.cumPercentage = gt > 0 ? (runningSum / gt) * 100 : 0;
      item.percentage = gt > 0 ? (item.value / gt) * 100 : 0;
    });

    const top = mappedData.length > 0 ? mappedData[0] : null;
    const topPercent = (gt > 0 && top) ? Number(top.percentage.toFixed(1)) : 0;
    
    const top3Sum = mappedData.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
    const top3Pct = gt > 0 ? Number(((top3Sum / gt) * 100).toFixed(1)) : 0;

    const curArray = Object.keys(curMap).map(cur => ({
      currency: cur,
      value: curMap[cur],
      percentage: gt > 0 ? (curMap[cur] / gt) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const macroArray = Object.values(macroMap).filter(m => m.value > 0);

    return { 
      allocData: mappedData, 
      currencyData: curArray,
      macroClasses: macroArray,
      grandTotal: gt, 
      totalAssetsCount: tac, 
      topBank: top, 
      topBankPercent: topPercent,
      top3Percent: top3Pct,
      uniqueBanksCount: mappedData.length 
    };
  }, [data, targetDate, baseCurrency, t]);

  useEffect(() => {
    const buildReportData = async () => {
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(safeT(t, 'bank', 'Institut / Bank')), 
          safeT(t, 'assets', 'Assets'),
          safeT(t, 'colPrimaryCurrency', 'Hauptwährung'),
          capitalize(safeT(t, 'amount', 'Volumen')),
          safeT(t, 'share', 'Anteil'),
          safeT(t, 'colCumulative', 'Kumuliert')
        ];
        
        const posSuffix = safeT(t, 'labelPosSuffix', 'Pos.');

        const tableBody = allocData.map(d => [
            d.label,
            `${d.assetCount} ${posSuffix}`,
            d.primaryCurrency,
            formatCurrency(d.value),
            `${d.percentage.toFixed(1)}%`,
            `${d.cumPercentage.toFixed(1)}%`
        ]);

        tableBody.push([
            safeT(t, 'labelTotalPortfolioUpper', 'TOTAL PORTFOLIO'),
            `${totalAssetsCount} ${posSuffix}`,
            baseCurrency,
            formatCurrency(grandTotal),
            '100.0%',
            '100.0%'
        ]);

        const exposureSuffix = safeT(t, 'descExposureSuffix', 'Exposure');

        const kpis = [
            { label: safeT(t, 'totalWealth', 'Gesamtkapital'), value: formatCurrency(grandTotal), sub: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${new Date(targetDate).toLocaleDateString('de-CH')}`, color: '#2563eb' },
            { label: safeT(t, 'topInstitution', 'Grösstes Institut'), value: topBank ? topBank.label : '-', sub: `${topBankPercent}% ${safeT(t, 'ofPortfolio', 'vom Portfolio')}`, color: '#10b981' },
            { label: safeT(t, 'labelTop3Concentration', 'Top-3 Konzentration'), value: `${top3Percent}%`, sub: `${Math.min(3, uniqueBanksCount)} / ${uniqueBanksCount} ${safeT(t, 'banks', 'Banken/Institute')}`, color: '#f59e0b' },
            { label: safeT(t, 'colPrimaryCurrency', 'Hauptwährung'), value: currencyData[0]?.currency || baseCurrency, sub: `${(currencyData[0]?.percentage || 0).toFixed(1)}% ${exposureSuffix}`, color: '#8b5cf6' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
        const subtitleText = `${safeT(t, 'reportDate', 'Stichtag:')} ${new Date(targetDate).toLocaleDateString('de-CH')} | ${uniqueBanksCount} ${safeT(t, 'banks', 'Banken/Institute')}`;

        await PdfToolkit.exportReport({
          title: safeT(t, 'repAlloc', 'Asset Allokation nach Instituten'),
          subtitle: subtitleText,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.30, 0.12, 0.14, 0.22, 0.11, 0.11],
          colAligns: ['left', 'center', 'center', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF-Export Fehler:", err);
      }
    };

    const handleBatchExport = (e) => {
      const exportPromise = new Promise(async (resolve) => {
        try {
          const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
          resolve({
            order: 2, 
            title: safeT(t, 'repAlloc', 'Asset Allokation nach Instituten'),
            subtitle: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${new Date(targetDate).toLocaleDateString('de-CH')}`,
            tableHeaders,
            tableBody,
            colWidthsPct: [0.30, 0.12, 0.14, 0.22, 0.11, 0.11],
            colAligns: ['left', 'center', 'center', 'right', 'right', 'right'],
            kpis,
            chartsData
          });
        } catch (err) {
          console.error("[FinBundle Pro] Batch Export Fehler Allocation:", err);
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
  }, [allocData, currencyData, grandTotal, targetDate, data, t, topBank, topBankPercent, top3Percent, uniqueBanksCount, totalAssetsCount, baseCurrency]); 

  if (grandTotal === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'noAssetsFoundDate', 'Keine Vermögenswerte zum gewählten Stichtag gefunden.')}</p>
        </div>
      </div>
    );
  }

  const curDistTitle = safeT(t, 'titleCurrencyDistBase', 'Währungsverteilung ({cur} Basis)').replace('{cur}', baseCurrency);
  const activeCurCountDesc = safeT(t, 'descActiveCurrenciesCount', '{count} Währungen aktiv im Depot').replace('{count}', currencyData.length);
  const activePosCountDesc = safeT(t, 'descActivePositionsCount', '{count} aktive Positionen').replace('{count}', totalAssetsCount);
  const volInCurLabel = safeT(t, 'labelVolumeInCurrency', 'Volumen in {cur}').replace('{cur}', baseCurrency);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      <div className="w-full bg-white dark:bg-transparent">
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-blue-500"/>
                    <span>{String(safeT(t, 'totalWealth', 'Gesamtkapital')).toUpperCase()}</span>
                </div>
                <div className="font-black text-2xl text-slate-900 dark:text-white truncate" title={formatCurrency(grandTotal)}>
                    {formatCurrency(grandTotal)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {safeT(t, 'statusAsOf', 'Stichtag:')} {new Date(targetDate).toLocaleDateString('de-CH')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Building" size={14} className="text-emerald-500"/>
                      {String(safeT(t, 'topInstitution', 'Grösstes Institut')).toUpperCase()}
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                      {topBankPercent}%
                    </span>
                </div>
                <div className="font-black text-xl text-slate-900 dark:text-white truncate" title={topBank?.label}>
                    {topBank ? topBank.label : '-'}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {topBank ? formatCurrency(topBank.value) : '-'}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Layers" size={14} className="text-amber-500"/>
                      <span>{safeT(t, 'labelTop3ClusterRisk', 'KLUMPENRISIKO (TOP 3)')}</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${top3Percent > 75 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                      {top3Percent > 75 ? safeT(t, 'labelClusterHigh', 'Hoch') : safeT(t, 'labelClusterModerate', 'Moderat')}
                    </span>
                </div>
                <div className="font-black text-2xl text-slate-900 dark:text-white">
                    {top3Percent}%
                </div>
                <div className="text-xs text-gray-400 mt-2 truncate">
                    {safeT(t, 'descBoundInTop3', 'Gebunden in den 3 grössten Instituten')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Globe" size={14} className="text-purple-500"/>
                    <span>{safeT(t, 'labelMainCurrency', 'HAUPTWÄHRUNG')}</span>
                </div>
                <div className="font-black text-2xl text-slate-900 dark:text-white">
                    {currencyData[0]?.currency || baseCurrency} <span className="text-sm font-medium text-purple-600 dark:text-purple-400">({currencyData[0]?.percentage.toFixed(1)}%)</span>
                </div>
                <div className="text-xs text-gray-400 mt-2 truncate">
                    {activeCurCountDesc}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
            
            <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'titleAllocByInst', 'Allokation nach Instituten')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-blue-500" /> {safeT(t, 'titleAllocByInst', 'Allokation nach Instituten')}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart
                        key={`alloc-bank-${isDark ? 'dark' : 'light'}`} 
                        engine={activeChartEngine}
                        type="doughnut"
                        height="100%"
                        labels={allocData.map(d => d.label)}
                        datasets={[{
                            label: safeT(t, 'amount', 'Volumen'),
                            data: allocData.map(d => d.value),
                            valueFormatter: formatCurrency
                        }]}
                    />
                </div>
            </div>

            <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'titleCurrencyExposure', 'Währungs-Exposure')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="Globe" className="text-purple-500" /> {curDistTitle}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart
                        key={`alloc-cur-${isDark ? 'dark' : 'light'}`} 
                        engine={activeChartEngine}
                        type="bar"
                        horizontal={true}
                        height="100%"
                        labels={currencyData.map(d => d.currency)}
                        datasets={[{
                            label: volInCurLabel,
                            data: currencyData.map(d => d.value),
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
                            valueFormatter: formatCurrency
                        }]}
                    />
                </div>
            </div>

          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Icon name="List" className="text-slate-500"/> {safeT(t, 'titleDetailedInstOverview', 'Detaillierte Instituts-Übersicht')}
                  </h3>
                  <span className="text-xs font-medium text-gray-500">
                      {uniqueBanksCount} {safeT(t, 'banks', 'Banken/Institute')} | {activePosCountDesc}
                  </span>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold">
                          <tr>
                              <th className="p-4">{safeT(t, 'bank', 'Institut / Bank')}</th>
                              <th className="p-4 text-center">{safeT(t, 'assets', 'Assets')}</th>
                              <th className="p-4 text-center">{safeT(t, 'colPrimaryCurrency', 'Hauptwährung')}</th>
                              <th className="p-4 text-right">{safeT(t, 'amount', 'Volumen')}</th>
                              <th className="p-4 text-right">{safeT(t, 'share', 'Anteil')}</th>
                              <th className="p-4 text-right">{safeT(t, 'colCumulative', 'Kumuliert')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                          {allocData.map((bank, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <Icon name="Building" size={14} className="text-gray-400"/>
                                      {bank.label}
                                  </td>
                                  <td className="p-4 text-center text-gray-500 font-mono">
                                      {bank.assetCount} {safeT(t, 'labelPosSuffix', 'Pos.')}
                                  </td>
                                  <td className="p-4 text-center">
                                      <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                                          {bank.primaryCurrency}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right font-black font-mono text-slate-900 dark:text-white">
                                      {formatCurrency(bank.value)}
                                  </td>
                                  <td className="p-4 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">
                                      {bank.percentage.toFixed(1)}%
                                  </td>
                                  <td className="p-4 text-right text-gray-400 font-mono text-xs">
                                      {bank.cumPercentage.toFixed(1)}%
                                  </td>
                              </tr>
                          ))}
                          <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                              <td className="p-4 uppercase text-slate-900 dark:text-white">{safeT(t, 'totalPortfolioCombined', 'Gesamtportfolio')}</td>
                              <td className="p-4 text-center text-slate-700 dark:text-slate-300">{totalAssetsCount} {safeT(t, 'labelPosSuffix', 'Pos.')}</td>
                              <td className="p-4 text-center text-slate-700 dark:text-slate-300">{baseCurrency}</td>
                              <td className="p-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</td>
                              <td className="p-4 text-right font-mono text-blue-600 dark:text-blue-400">100.0%</td>
                              <td className="p-4 text-right font-mono text-gray-500">100.0%</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};

module.exports = AllocationReport;