const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
// NEU: Importiere die benötigten Helfer direkt
const { getAssetValueAtDate = () => 0 } = DataEngine;

const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);

const SecuritiesPerformanceReport = ({ data, activeAssets, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const securitiesAssets = (activeAssets || []).filter(a => ['stock', 'fund'].includes(a.assetClass));

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
          <p className="text-sm mt-2">{t ? t('addSecuritiesPrompt') || 'Lege ein Asset mit der Anlageklasse "Aktie" oder "Fonds / ETF" an.' : 'Lege ein Asset mit der Anlageklasse "Aktie" oder "Fonds / ETF" an.'}</p>
        </div>
      </div>
    );
  }

  let earliestDate = new Date().toISOString().split('T')[0];
  securitiesAssets.forEach(asset => {
      (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
  });

  const currentYear = new Date().getFullYear();
  let startYear = new Date(earliestDate).getFullYear();

  if (startYear === currentYear) {
      startYear -= 1;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const dataPoints = [];
  
  // FIX: Nutzt jetzt intern getAssetValueAtDate für garantierte UI/Engine Synchronität!
  const calculateHistoricalStats = (asset, targetDate) => {
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

      // Zieht den korrekten aktuellen CHF Wert direkt aus der zentralen DataEngine!
      const actualCHF = getAssetValueAtDate(asset, targetDate, activeAssets);
      
      return { 
          invested: totalInvestedCHF, 
          dividends: totalDividendsCHF, 
          actual: actualCHF 
      };
  };

  for (let y = startYear; y <= currentYear; y++) {
      const isCurrentYear = y === currentYear;
      const targetDate = isCurrentYear ? todayStr : `${y}-12-31`;
      
      let totalInvested = 0;
      let totalActual = 0;
      let totalDividends = 0;

      securitiesAssets.forEach(asset => {
          const stats = calculateHistoricalStats(asset, targetDate);
          totalInvested += stats.invested;
          totalDividends += stats.dividends;
          totalActual += stats.actual; 
      });

      const priceProfit = totalActual - totalInvested;
      const priceRoi = totalInvested > 0 ? (priceProfit / totalInvested) * 100 : 0;
      
      const totalProfit = priceProfit + totalDividends;
      const totalRoi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      dataPoints.push({
          year: y,
          dateStr: targetDate,
          invested: totalInvested,
          actual: totalActual,
          dividends: totalDividends,
          priceProfit: priceProfit,
          priceRoi: priceRoi,
          profit: totalProfit,
          roi: totalRoi
      });
  }

  const latestData = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : { invested: 0, actual: 0, profit: 0, roi: 0, dividends: 0, priceProfit: 0, priceRoi: 0 };
  
  const repTitle = t ? t('repSecuritiesTitle') || "Aktien & Fonds Performance" : "Aktien & Fonds Performance";
  const repSub = t ? t('repSecuritiesSub') || "Rendite-Analyse des freien Markt-Portfolios (ohne Säule 3a)" : "Rendite-Analyse des freien Markt-Portfolios (ohne Säule 3a)";

  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const tableHeaders = [
            t ? t('labelYearDate') || 'Jahr' : 'Jahr', 
            t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert', 
            t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert', 
            t ? t('labelPriceProfit') || 'Kursgewinn' : 'Kursgewinn', 
            t ? t('labelDividends') || 'Dividenden' : 'Dividenden', 
            t ? t('labelTotalReturn') || 'Total Return' : 'Total Return'
        ];
        const tableBody = dataPoints.map(d => [
          d.year === currentYear ? `${d.year} (${t ? t('labelToday') || 'Heute' : 'Heute'})` : `${d.year}`,
          fCur(d.invested),
          fCur(d.actual),
          `${d.priceProfit > 0 ? '+' : ''}${fCur(d.priceProfit)}`,
          `+${fCur(d.dividends)}`,
          `${d.roi > 0 ? '+' : ''}${d.roi.toFixed(2)} %`
        ]);

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: repSub,
          tableHeaders,
          tableBody,
          chartBase64,
	  data: data
        });
      } catch (err) {
        console.error("[FinSPA Pro] PDF Export Error im SecuritiesPerformanceReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [dataPoints, fCur, t, repTitle, repSub, currentYear]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-6">
         <ReportHeader title={repTitle} subtitle={repSub} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert'}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{fCur ? fCur(latestData.invested, 'CHF') : latestData.invested}</div>
            <div className="text-xs text-gray-400 mt-2">{t ? t('descSecuritiesInvested') || 'Summe aller Käufe minus Verkäufe' : 'Summe aller Käufe minus Verkäufe'}</div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t ? t('labelMarketValueToday') || 'Marktwert Heute' : 'Marktwert Heute'}</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur ? fCur(latestData.actual, 'CHF') : latestData.actual}</div>
         </div>
         
         <div className={`border p-6 rounded-2xl shadow-sm ${latestData.priceProfit >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{t ? t('labelPriceReturn') || 'Kursgewinn (Price Return)' : 'Kursgewinn (Price Return)'}</div>
            <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
               {latestData.priceProfit > 0 ? '+' : ''}{fCur ? fCur(latestData.priceProfit, 'CHF') : latestData.priceProfit}
               <span className="text-sm font-medium opacity-70">({latestData.priceRoi > 0 ? '+' : ''}{latestData.priceRoi.toFixed(2)}%)</span>
            </div>
         </div>
         
         <div className={`border p-6 rounded-2xl shadow-sm ${latestData.profit >= 0 ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>{t ? t('labelTotalReturnDiv') || 'Total Return (inkl. Div)' : 'Total Return (inkl. Div)'}</div>
            <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>
               {latestData.profit > 0 ? '+' : ''}{fCur ? fCur(latestData.profit, 'CHF') : latestData.profit}
               <span className="text-sm font-medium opacity-70">({latestData.roi > 0 ? '+' : ''}{latestData.roi.toFixed(2)}%)</span>
            </div>
         </div>
      </div>

      {dataPoints.length > 1 && (
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Icon name="TrendingUp" className="text-blue-500" /> {t ? t('labelValueDevelopmentCurve') || 'Wertentwicklung (Kurve)' : 'Wertentwicklung (Kurve)'}
            </h3>
            
            <div ref={chartRef} style={{ width: '100%', height: '350px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="line"
                    labels={dataPoints.map(d => String(d.year))}
                    datasets={[
                        {
                            label: t ? t('labelNetInvested') || 'Netto Investiert' : 'Netto Investiert',
                            data: dataPoints.map(d => d.invested),
                            backgroundColor: '#94a3b8', 
                            valueFormatter: fCur
                        },
                        {
                            label: t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert',
                            data: dataPoints.map(d => d.actual),
                            backgroundColor: latestData.priceProfit >= 0 ? '#10b981' : '#3b82f6', 
                            valueFormatter: fCur
                        },
                        {
                            label: t ? t('labelTotalValueDiv') || 'Total Value (inkl. Div)' : 'Total Value (inkl. Div)',
                            data: dataPoints.map(d => d.actual + d.dividends),
                            backgroundColor: '#6366f1', 
                            valueFormatter: fCur
                        }
                    ]} 
                    height="100%"
                />
            </div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             {t ? t('labelHistoricalDataReturns') || 'Historische Datenpunkte & Renditen' : 'Historische Datenpunkte & Renditen'}
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                     <th className="px-6 py-4">{t ? t('labelYearDate') || 'Jahr (Stichtag)' : 'Jahr (Stichtag)'}</th>
                     <th className="px-6 py-4 text-right">{t ? t('labelInvestedHeader') || 'Investiert' : 'Investiert'}</th>
                     <th className="px-6 py-4 text-right">{t ? t('labelMarketValueHeader') || 'Marktwert' : 'Marktwert'}</th>
                     <th className="px-6 py-4 text-right">{t ? t('labelPriceProfit') || 'Kursgewinn' : 'Kursgewinn'}</th>
                     <th className="px-6 py-4 text-right text-blue-600 dark:text-blue-400">{t ? t('labelDividends') || 'Dividenden' : 'Dividenden'}</th>
                     <th className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 font-bold">{t ? t('labelTotalReturn') || 'Total Return' : 'Total Return'}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {dataPoints.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200">{d.year === currentYear ? `${d.year} (${t ? t('labelToday') || 'Heute' : 'Heute'})` : `${d.year} ${t ? t('labelDec31') || '(31.12)' : '(31.12)'}`}</td>
                          <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fCur ? fCur(d.invested, 'CHF') : d.invested}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur ? fCur(d.actual, 'CHF') : d.actual}</td>
                          
                          <td className={`px-6 py-3 text-right font-mono ${d.priceProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {d.priceProfit > 0 ? '+' : ''}{fCur ? fCur(d.priceProfit, 'CHF') : d.priceProfit} <span className="text-[10px]">({d.priceRoi > 0 ? '+' : ''}{d.priceRoi.toFixed(1)}%)</span>
                          </td>
                          
                          <td className="px-6 py-3 text-right font-mono text-blue-600 dark:text-blue-400">+{fCur ? fCur(d.dividends, 'CHF') : d.dividends}</td>
                          
                          <td className={`px-6 py-3 text-right font-bold ${d.profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                             {d.roi > 0 ? '+' : ''}{d.roi.toFixed(2)} %
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

module.exports = SecuritiesPerformanceReport;