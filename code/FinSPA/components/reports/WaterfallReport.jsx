const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getTotalWealthAtDate } = safeRequire('../../../data/DataEngine.jsx') || window.DataEngine || {};

const WaterfallReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';

  const startVal = getTotalWealthAtDate(activeAssets, dateRange.from);
  const endVal = getTotalWealthAtDate(activeAssets, dateRange.to);
  
  let sumInc = 0, sumExp = 0;
  const flowBreakdown = { positive: {}, negative: {} };
  
  const allBookings = [];
  activeAssets.forEach(asset => {
      const rate = parseFloat(String(asset.exchangeRate || '1').replace(',', '.'));
      (asset.bookings || []).forEach(bk => {
          allBookings.push({
              ...bk,
              _baseValue: Number(bk.amount) * rate,
              assetName: asset.name
          });
      });
  });

  allBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      // WICHTIG: Hier sichern wir uns jetzt ab, dass wir wirklich ALLE möglichen Kategorie-Felder abgreifen
      const originalType = bk.normType || bk.type || '';
      const originalCategory = bk.category || bk.subCategory || bk.normCategory || '';
      
      const rawType = String(originalType).toLowerCase();
      const rawCat = String(originalCategory).toLowerCase();

      // Markteffekte rigoros aus dem Cashflow ausschließen
      const isMarketEffect = ['wertanpassung', 'dividende', 'ausschüttung', 'zinszahlung'].includes(rawType) ||
                             ['dividenden', 'zinsen', 'mieteinnahmen'].includes(rawCat);

      if (isMarketEffect) return;

      // Flussrichtung bestimmen
      let isPos = ['einzahlung', 'kauf', 'abzahlung'].includes(rawType);
      let isNeg = ['auszahlung', 'verkauf', 'schulderhöhung', 'gebühr', 'steuern'].includes(rawType);

      if (!isPos && !isNeg) {
          isPos = Number(bk.amount) >= 0;
      }

      // Die saubere Kategorie für den Tabellen-Breakdown (Kategorie > Typ > Sonstiges)
      const displayCategory = originalCategory || originalType || (t ? t('catOthers') || 'Sonstiges' : 'Sonstiges');
      const absValue = Math.abs(bk._baseValue);

      if (isPos) {
          sumInc += absValue;
          flowBreakdown.positive[displayCategory] = (flowBreakdown.positive[displayCategory] || 0) + absValue;
      } else {
          sumExp += absValue;
          flowBreakdown.negative[displayCategory] = (flowBreakdown.negative[displayCategory] || 0) + absValue;
      }
  });
  
  const marketPerf = endVal - startVal - sumInc + sumExp; 
  const netCashflow = sumInc - sumExp;
  
  const investedCapital = startVal + (sumInc / 2); 
  const marketPerfPercent = investedCapital > 0 ? (marketPerf / investedCapital) * 100 : 0;
  
  const repTitle = t ? t('repWaterfallTitle') || "Wasserfall-Analyse" : "Wasserfall-Analyse";
  const repSub = t ? t('repWaterfallSub') || "Brücke zwischen Start- und Endvermögen" : "Brücke zwischen Start- und Endvermögen";
  const lblStart = t ? t('labelWaterfallStart') || 'Startvermögen' : 'Startvermögen';
  const lblIn = t ? t('labelWaterfallInflows') || 'Einzahlungen' : 'Einzahlungen';
  const lblOut = t ? t('labelWaterfallOutflows') || 'Auszahlungen' : 'Auszahlungen';
  const lblMarket = t ? t('labelMarketEffect') || 'Markteffekt' : 'Markteffekt';
  const lblEnd = t ? t('labelWaterfallEnd') || 'Endvermögen' : 'Endvermögen';

  const chartLabels = [lblStart, lblIn, lblOut, lblMarket, lblEnd];
  const chartData = [startVal, sumInc, -sumExp, marketPerf, endVal];
  const chartColors = [
      '#64748b', 
      '#10b981', 
      '#f43f5e', 
      marketPerf >= 0 ? '#10b981' : '#f43f5e', 
      '#3b82f6'  
  ];

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

        const kpiBlock = document.querySelector('.kpi-waterfall-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        const chartBlock = document.querySelector('.chart-waterfall-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: repTitle, image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        
        const tableHeaders = [
            capitalize(t ? t('labelPosition') || 'Position' : 'Position'),
            capitalize(t ? t('amount') || 'Betrag' : 'Betrag')
        ];

        const tableBody = [
            [{ text: lblStart.toUpperCase(), bold: true }, fCur(startVal)],
            ['   + ' + lblIn, fCur(sumInc)],
            ['   - ' + lblOut, `-${fCur(sumExp)}`],
            [`   ${marketPerf >= 0 ? '+' : '-'} ` + lblMarket, `${marketPerf >= 0 ? '+' : ''}${fCur(marketPerf)}`],
            ['', ''],
            [{ text: lblEnd.toUpperCase(), bold: true }, fCur(endVal)]
        ];

        return { chartsData, tableHeaders, tableBody };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} bis ${new Date(dateRange.to).toLocaleDateString('de-CH')})`,
          tableHeaders,
          tableBody,
          chartsData,
          data: activeAssets 
        });
      } catch (err) { 
          console.error("[FinSPA] PDF Export Error im WaterfallReport:", err); 
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 15, 
                    title: repTitle,
                    subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} bis ${new Date(dateRange.to).toLocaleDateString('de-CH')})`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im WaterfallReport:", err);
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
  }, [startVal, sumInc, sumExp, marketPerf, endVal, dateRange, fCur, t, repTitle, repSub, lblStart, lblIn, lblOut, lblMarket, lblEnd, activeAssets]);

  return (
   <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
  

      <div className="w-full bg-white dark:bg-transparent">
          
          <div className="kpi-waterfall-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} className="text-slate-500"/>
                    {lblStart}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {fCur(startVal)}
                </div>
             </div>
             
             <div className={`p-6 border rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 netCashflow >= 0 
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                    : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
             }`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="Activity" size={48} className={netCashflow >= 0 ? "text-emerald-500" : "text-rose-500"} />
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 ${netCashflow >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                    <Icon name={netCashflow >= 0 ? "TrendingUp" : "TrendingDown"} size={14} />
                    {t ? t('labelNetCashflow') || 'Netto Cashflow' : 'Netto Cashflow'}
                </div>
                <div className={`text-3xl font-black relative z-10 ${netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {netCashflow >= 0 ? '+' : ''}{fCur(netCashflow)}
                </div>
                <div className={`text-xs font-medium mt-2 relative z-10 ${netCashflow >= 0 ? 'text-emerald-700/70 dark:text-emerald-500/70' : 'text-rose-700/70 dark:text-rose-500/70'}`}>
                    {fCur(sumInc)} In / {fCur(sumExp)} Out
                </div>
             </div>

             <div className={`p-6 border rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 marketPerf >= 0 
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                    : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
             }`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="BarChart2" size={48} className={marketPerf >= 0 ? "text-emerald-500" : "text-rose-500"} />
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 ${marketPerf >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                    <Icon name={marketPerf >= 0 ? "TrendingUp" : "TrendingDown"} size={14} />
                    {lblMarket}
                </div>
                <div className={`text-3xl font-black relative z-10 ${marketPerf >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {marketPerf >= 0 ? '+' : ''}{fCur(marketPerf)}
                </div>
                <div className={`text-xs font-medium mt-2 relative z-10 ${marketPerf >= 0 ? 'text-emerald-700/70 dark:text-emerald-500/70' : 'text-rose-700/70 dark:text-rose-500/70'}`}>
                    {marketPerfPercent >= 0 ? '+' : ''}{marketPerfPercent.toFixed(2)}% {t ? t('labelReturn') || 'Rendite' : 'Rendite'}
                </div>
             </div>

             <div className="bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="Database" size={48} className="text-blue-600" />
                </div>
                <div className="text-blue-800 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="CheckCircle" size={14} />
                    {lblEnd}
                </div>
                <div className="text-3xl font-black text-blue-700 dark:text-blue-400 relative z-10">
                    {fCur(endVal)}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-waterfall-export-block self-start sticky top-8">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart" className="text-indigo-500" /> {repTitle}
                </h3>
                <div ref={chartRef} style={{ width: '100%', height: '400px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={chartLabels}
                        datasets={[{
                            label: t ? t('amount') || 'Betrag' : 'Betrag',
                            data: chartData,
                            backgroundColor: chartColors,
                            valueFormatter: (val) => {
                                const isDeltaCol = chartData.indexOf(val) !== 0 && chartData.indexOf(val) !== 4;
                                return `${isDeltaCol && val > 0 ? '+' : ''}${fCur(val)}`;
                            }
                        }]}
                        height="100%"
                    />
                </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2 ml-1">
                    <Icon name="List" className="text-slate-500" />
                    {t ? t('titleCashflowComposition') || 'Zusammensetzung Cashflow' : 'Zusammensetzung Cashflow'}
                </h3>
                
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-emerald-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            {lblIn}
                        </div>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{fCur(sumInc)}
                        </div>
                    </div>
                    <div className="p-0">
                        {Object.keys(flowBreakdown.positive).length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {Object.keys(flowBreakdown.positive)
                                        .sort((a,b) => flowBreakdown.positive[b] - flowBreakdown.positive[a])
                                        .map((type, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-3 pl-5 text-gray-600 dark:text-gray-300">{t ? t(type) || type : type}</td>
                                            <td className="p-3 pr-5 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
                                                {fCur(flowBreakdown.positive[type])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 text-sm text-center text-gray-400">{t ? t('noPositiveInflowsFound') || 'Keine positiven Zuflüsse gefunden' : 'Keine positiven Zuflüsse gefunden'}</div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-rose-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            {lblOut}
                        </div>
                        <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{fCur(sumExp)}
                        </div>
                    </div>
                    <div className="p-0">
                        {Object.keys(flowBreakdown.negative).length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {Object.keys(flowBreakdown.negative)
                                        .sort((a,b) => flowBreakdown.negative[b] - flowBreakdown.negative[a])
                                        .map((type, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-3 pl-5 text-gray-600 dark:text-gray-300">{t ? t(type) || type : type}</td>
                                            <td className="p-3 pr-5 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
                                                {fCur(flowBreakdown.negative[type])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 text-sm text-center text-gray-400">{t ? t('noOutflowsFound') || 'Keine Abflüsse gefunden' : 'Keine Abflüsse gefunden'}</div>
                        )}
                    </div>
                </div>

                <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/30 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex gap-3 items-start">
                    <Icon name="Info" className="text-blue-400 mt-0.5 shrink-0" />
                    <p>
                        {t ? t('infoMarketEffect1') || 'Der ' : 'Der '}
                        <strong>{lblMarket}</strong> ({fCur(marketPerf)}) 
                        {t ? t('infoMarketEffect2') || ' ergibt sich aus der Differenz zwischen Start- und Endvermögen abzüglich des Netto-Cashflows (' : ' ergibt sich aus der Differenz zwischen Start- und Endvermögen abzüglich des Netto-Cashflows ('}
                        {fCur(netCashflow)}
                        {t ? t('infoMarketEffect3') || '). Er beinhaltet Kursgewinne, Währungsschwankungen sowie erhaltene Dividenden/Zinsen (sofern diese nicht explizit als Einzahlung erfasst wurden).' : '). Er beinhaltet Kursgewinne, Währungsschwankungen sowie erhaltene Dividenden/Zinsen (sofern diese nicht explizit als Einzahlung erfasst wurden).'}
                    </p>
                </div>

            </div>
          </div>
      </div>
    </div>
  );
};

module.exports = WaterfallReport;