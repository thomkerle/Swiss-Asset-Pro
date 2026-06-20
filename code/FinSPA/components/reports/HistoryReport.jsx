const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const { getAssetValueAtDate, generateMonthEnds } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const HistoryReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

  const lblTotal = t ? (t('labelTotalWealth') || 'Gesamtvermögen') : 'Gesamtvermögen';
  const lblCash = t ? (t('catCashAccounts') || 'Cash & Konten') : 'Cash & Konten';
  const lblSec = t ? (t('catSecuritiesCrypto') || 'Wertpapiere & Krypto') : 'Wertpapiere & Krypto';
  const lblPen = t ? (t('catPensionProvident') || 'Vorsorge (Pensionskasse, 3a)') : 'Vorsorge (Pensionskasse, 3a)';
  const lblRE = t ? (t('catRealEstateNet') || 'Immobilien (Netto)') : 'Immobilien (Netto)';

  let dates = generateMonthEnds ? generateMonthEnds(dateRange.from, dateRange.to) : [];
  if (dates.length === 0 || dates[0] > dateRange.from) dates = [dateRange.from, ...dates];
  if (dates[dates.length - 1] < dateRange.to) dates = [...dates, dateRange.to];
  dates = [...new Set(dates)];

  let rawData = dates.map(d => {
      let tTotal = 0, tCash = 0, tSecurities = 0, tPension = 0, tRealEstate = 0;
      
      if (activeAssets && getAssetValueAtDate) {
          activeAssets.forEach(a => {
              const val = getAssetValueAtDate(a, d, activeAssets);
              if (val === 0) return;
              
              tTotal += val;
              if (a.assetClass === 'cash') tCash += val;
              else if (['stock', 'fund', 'crypto'].includes(a.assetClass)) tSecurities += val;
              else if (a.assetClass?.includes('pension')) tPension += val;
              else if (['realestate', 'mortgage'].includes(a.assetClass)) tRealEstate += val;
          });
      }
      return { date: d, total: tTotal, cash: tCash, securities: tSecurities, pension: tPension, realestate: tRealEstate };
  });

  const finalDates = rawData.map(item => item.date);
  const finalTotal = rawData.map(item => item.total);
  const finalCash = rawData.map(item => item.cash);
  const finalSecurities = rawData.map(item => item.securities);
  const finalPension = rawData.map(item => item.pension);
  const finalRealEstate = rawData.map(item => item.realestate);
  
  const startValue = finalTotal[0] || 0;
  const endValue = finalTotal[finalTotal.length - 1] || 0;
  const diff = endValue - startValue;
  const percentChange = startValue !== 0 ? (diff / startValue) * 100 : 0;
  const isPositive = diff >= 0;
  
  const monthsCount = finalDates.length > 1 ? finalDates.length - 1 : 1;
  const avgMonthlyGrowth = diff / monthsCount;

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
    const buildReportData = async () => {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        const kpiBlock = document.querySelector('.kpi-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        if (reportRef.current) {
            const chartBlocks = reportRef.current.querySelectorAll('.chart-export-block');
            for (let i = 0; i < chartBlocks.length; i++) {
                const canvas = await html2canvas(chartBlocks[i], { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                const titleFallback = chartBlocks[i].getAttribute('data-pdf-title') || '';
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
            }
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(t ? (t('date') || 'Datum') : 'Datum'),
          capitalize(t ? (t('labelTotalShort') || 'Gesamt') : 'Gesamt'),
          t ? (t('catCashShort') || 'Cash') : 'Cash',
          t ? (t('catSecuritiesShort') || 'Wertpapiere') : 'Wertpapiere',
          t ? (t('catPensionShort') || 'Vorsorge') : 'Vorsorge',
          t ? (t('catRealEstateShort') || 'Immobilien') : 'Immobilien'
        ];

        const tableBody = [...rawData].reverse().map((d) => [
          new Date(d.date).toLocaleDateString('de-CH'),
          fCur(d.total),
          fCur(d.cash),
          fCur(d.securities),
          fCur(d.pension),
          fCur(d.realestate)
        ]);

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        const pdfStartDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const pdfEndDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');
        const pdfSubtitle = `${t ? (t('labelPeriod') || 'Zeitraum:') : 'Zeitraum:'} ${pdfStartDateStr} ${t ? (t('wordTo') || 'bis') : 'bis'} ${pdfEndDateStr} | ${t ? (t('labelPerformance') || 'Performance:') : 'Performance:'} ${isPositive ? '+' : ''}${fCur(diff)}`;

        await PdfExportEngine.exportReport({
          title: t ? (t('repHistTitleLong') || 'Historische Vermögensentwicklung') : 'Historische Vermögensentwicklung',
          subtitle: pdfSubtitle,
          tableHeaders,
          tableBody,
          chartsData,
          data: data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im HistoryReport:", err);
      }
    };

    // --- NEU: BATCH EXPORT (ORCHESTRATOR) ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                const pdfStartDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
                const pdfEndDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');
                const pdfSubtitle = `${t ? (t('labelPeriod') || 'Zeitraum:') : 'Zeitraum:'} ${pdfStartDateStr} ${t ? (t('wordTo') || 'bis') : 'bis'} ${pdfEndDateStr} | ${t ? (t('labelPerformance') || 'Performance:') : 'Performance:'} ${isPositive ? '+' : ''}${fCur(diff)}`;

                resolve({
                    order: 4, 
                    title: t ? (t('repHistTitleLong') || 'Historische Vermögensentwicklung') : 'Historische Vermögensentwicklung',
                    subtitle: pdfSubtitle,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im HistoryReport:", err);
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
  }, [rawData, finalDates, diff, dateRange, fCur, t, data, isPositive]);

  const startDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
  const endDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');
  
  if (finalDates.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <ReportHeader 
          title={t ? (t('repHistTitle') || 'Historischer Verlauf') : 'Historischer Verlauf'} 
          subtitle={`${t ? (t('repHistSubDev') || 'Entwicklung') : 'Entwicklung'} (${startDateStr} - ${endDateStr})`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? (t('noDataForPeriod') || 'Keine Daten für den gewählten Zeitraum gefunden.') : 'Keine Daten für den gewählten Zeitraum gefunden.'}</p>
        </div>
      </div>
    );
  }

  const formattedLabels = finalDates.map(d => new Date(d).toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }));

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      <ReportHeader 
        title={t ? (t('repHistTitleLong') || 'Historische Vermögensentwicklung') : 'Historische Vermögensentwicklung'} 
        subtitle={`${t ? (t('detailedAnalysis') || 'Detaillierte Analyse') : 'Detaillierte Analyse'} (${startDateStr} ${t ? (t('wordTo') || 'bis') : 'bis'} ${endDateStr})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="w-full bg-white dark:bg-transparent">
          {/* KPI DASHBOARD ROW */}
          <div className="kpi-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} className="text-slate-500"/>
                    {t ? (t('labelStartWealth') || 'Startvermögen') : 'Startvermögen'}
                 </div>
                 <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {fCur(startValue)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 font-medium">
                    {startDateStr}
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Target" size={14} className="text-blue-500"/>
                    {t ? (t('currentVolume') || 'Aktuelles Volumen') : 'Aktuelles Volumen'}
                 </div>
                 <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {fCur(endValue)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 font-medium">
                    {endDateStr}
                 </div>
             </div>
             
             <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 ${isPositive ? 'border-b-emerald-500' : 'border-b-rose-500'}`}>
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Icon name={isPositive ? 'TrendingUp' : 'TrendingDown'} size={14} className={isPositive ? 'text-emerald-500' : 'text-rose-500'}/>
                        {t ? (t('performanceKPI') || 'Performance') : 'Performance'}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isPositive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                        {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
                    </span>
                 </div>
                 <div className="flex items-baseline gap-2">
                    <div className={`text-3xl font-black ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isPositive ? '+' : ''}{fCur(diff)}
                    </div>
                 </div>
                 <div className="mt-2 text-xs text-gray-400 font-medium">
                    {t ? (t('valueGrowthOverPeriod') || 'Wertzuwachs im Gesamtzeitraum') : 'Wertzuwachs im Gesamtzeitraum'}
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-indigo-500">
                 <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Activity" size={14} className="text-indigo-500"/>
                    {t ? (t('avgMonthlyGrowth') || 'Ø Monatliches Wachstum') : 'Ø Monatliches Wachstum'}
                 </div>
                 <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {avgMonthlyGrowth > 0 ? '+' : ''}{fCur(avgMonthlyGrowth)}
                 </div>
                 <div className="text-xs text-gray-400 mt-2 font-medium">
                    {t ? (t('averageOverMonths_1') || 'Durchschnitt über') : 'Durchschnitt über'} {monthsCount} {t ? (t('averageOverMonths_2') || 'Monate') : 'Monate'}
                 </div>
             </div>
          </div>

          {/* CHARTS BEREICH */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
            
            {/* Chart 1: Area Chart (Gesamtvermögen) */}
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
               data-pdf-title={t ? (t('totalTrend') || 'Gesamtentwicklung') : 'Gesamtentwicklung'}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="TrendingUp" className="text-blue-500" /> {t ? (t('totalTrend') || 'Gesamtentwicklung') : 'Gesamtentwicklung'}
                </h3>
                <div style={{ width: '100%', height: '350px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="line"
                    labels={formattedLabels}
                    datasets={[{
                        label: lblTotal,
                        data: finalTotal,
                        backgroundColor: '#3b82f6',
                        valueFormatter: fCur
                    }]} 
                    height="100%"
                />
                </div>
            </div>

            {/* Chart 2: Bar Chart (Asset Klassen) */}
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" 
               data-pdf-title={t ? (t('historicalComposition') || 'Historische Zusammensetzung') : 'Historische Zusammensetzung'}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="Layers" className="text-indigo-500" /> {t ? (t('historicalComposition') || 'Historische Zusammensetzung') : 'Historische Zusammensetzung'}
                </h3>
                <div style={{ width: '100%', height: '350px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    labels={formattedLabels}
                    datasets={[
                        {
                            label: lblCash,
                            data: finalCash,
                            backgroundColor: '#10b981',
                            valueFormatter: fCur
                        },
                        {
                            label: lblSec,
                            data: finalSecurities,
                            backgroundColor: '#3b82f6',
                            valueFormatter: fCur
                        },
                        {
                            label: lblPen,
                            data: finalPension,
                            backgroundColor: '#a855f7',
                            valueFormatter: fCur
                        },
                        {
                            label: lblRE,
                            data: finalRealEstate,
                            backgroundColor: '#f59e0b',
                            valueFormatter: fCur
                        }
                    ]} 
                    height="100%"
                />
                </div>
            </div>

          </div>
      </div>
    </div>
  );
};

module.exports = HistoryReport;