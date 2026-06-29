const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);
const { getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const labelUncategorized = t ? (t('catUncategorized') || "Unkategorisiert") : "Unkategorisiert";
  const titleText = t ? (t('repCatFlow') || "Kategorienfluss") : "Kategorienfluss";
  const subtitlePrefix = t ? (t('repCatFlowSub') || "Vermögensentwicklung nach Kategorien") : "Vermögensentwicklung nach Kategorien";
  const wordToText = t ? (t('wordTo') || "bis") : "bis";

  const catDataMap = {};
  let totalStart = 0;
  let totalEnd = 0;

  const traverse = (nodes, currentCatName = labelUncategorized) => {
     nodes.forEach(n => {
        let catName = currentCatName;
        if (n.type === 'category') catName = n.name;
        
        if (n.type === 'asset' && !n.isArchived) {
            const startVal = getAssetValueAtDate(n, dateRange.from);
            const endVal = getAssetValueAtDate(n, dateRange.to);
            const deltaVal = endVal - startVal;

            if (!catDataMap[catName]) {
                catDataMap[catName] = { name: catName, start: 0, end: 0, delta: 0, assets: [] };
            }

            catDataMap[catName].start += startVal;
            catDataMap[catName].end += endVal;
            catDataMap[catName].delta += deltaVal;
            
            totalStart += startVal;
            totalEnd += endVal;

            if (startVal !== 0 || endVal !== 0) {
                catDataMap[catName].assets.push({ 
                    name: n.name, 
                    start: startVal, 
                    end: endVal, 
                    delta: deltaVal,
                    class: n.assetClass
                });
            }
        }
        if (n.children) traverse(n.children, catName);
     });
  };
  
  data.banks.forEach(b => traverse(b.children || [], b.name));
  
  const catData = Object.values(catDataMap)
    .filter(c => c.start !== 0 || c.end !== 0)
    .map(c => {
        c.assets.sort((a, b) => b.delta - a.delta); 
        return c;
    })
    .sort((a, b) => b.delta - a.delta); 

  const totalDelta = totalEnd - totalStart;
  const bestCat = catData.length > 0 && catData[0].delta > 0 ? catData[0] : null;

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

        const kpiBlock = document.querySelector('.kpi-cat-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        const chartBlock = document.querySelector('.chart-cat-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: t ? t('performanceByCategory') || 'Performance nach Kategorien' : 'Performance nach Kategorien', image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
            capitalize(t ? t('category') || 'Kategorie / Asset' : 'Kategorie / Asset'), 
            t ? t('startValue') || 'Startwert' : 'Startwert',
            t ? t('endValue') || 'Endwert' : 'Endwert',
            capitalize(t ? t('change') || 'Entwicklung' : 'Entwicklung')
        ];
        
        const tableBody = [];
        
        catData.forEach(cat => {
            tableBody.push([
                cat.name.toUpperCase(), 
                fCur(cat.start), 
                fCur(cat.end), 
                `${cat.delta >= 0 ? '+' : ''}${fCur(cat.delta)}`
            ]);
            cat.assets.forEach(a => {
                tableBody.push([
                    `   - ${a.name}`, 
                    fCur(a.start), 
                    fCur(a.end), 
                    `${a.delta >= 0 ? '+' : ''}${fCur(a.delta)}`
                ]);
            });
        });

        tableBody.push(['', '', '', '']);
        tableBody.push([t ? t('totalPortfolio') || 'GESAMTPORTFOLIO' : 'GESAMTPORTFOLIO', fCur(totalStart), fCur(totalEnd), `${totalDelta >= 0 ? '+' : ''}${fCur(totalDelta)}`]);

        return { chartsData, tableHeaders, tableBody };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: titleText, 
          subtitle: `${subtitlePrefix} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${wordToText} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`, 
          tableHeaders,
          tableBody,
          chartsData,
          data: data
        });
      } catch (err) { console.error("[FinSPA] PDF Export Error im CategoryFlowReport:", err); }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 5, 
                    title: titleText,
                    subtitle: `${subtitlePrefix} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${wordToText} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im CategoryFlowReport:", err);
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
  }, [catData, dateRange, fCur, t, titleText, subtitlePrefix, wordToText, totalStart, totalEnd, totalDelta, data]);

  if (catData.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <ReportHeader 
          title={titleText} 
          subtitle={`${subtitlePrefix} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${wordToText} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('catNoMovements') || 'Keine Bewegungen in den Kategorien im gewählten Zeitraum gefunden.' : 'Keine Bewegungen in den Kategorien im gewählten Zeitraum gefunden.'}</p>
        </div>
      </div>
    );
  }

  const chartColors = catData.map(d => d.delta >= 0 ? '#10b981' : '#f43f5e');

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
        title={titleText} 
        subtitle={`${subtitlePrefix} (${new Date(dateRange.from).toLocaleDateString('de-CH')} - ${new Date(dateRange.to).toLocaleDateString('de-CH')})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="w-full bg-white dark:bg-transparent">
          <div className="kpi-cat-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Calendar" size={14} className="text-slate-500"/>
                    {t ? t('startValue') || 'Startwert' : 'Startwert'}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {fCur(totalStart)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? t('atDate') || 'am' : 'am'} {new Date(dateRange.from).toLocaleDateString('de-CH')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Database" size={14} className="text-blue-500"/>
                    {t ? t('endValue') || 'Endwert' : 'Endwert'}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {fCur(totalEnd)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? t('atDate') || 'am' : 'am'} {new Date(dateRange.to).toLocaleDateString('de-CH')}
                </div>
             </div>

             <div className={`border p-6 rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 totalDelta >= 0 
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                    : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
             }`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name={totalDelta >= 0 ? "TrendingUp" : "TrendingDown"} size={48} className={totalDelta >= 0 ? "text-emerald-500" : "text-rose-500"} />
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 ${totalDelta >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                    <Icon name="Activity" size={14} />
                    {t ? t('totalDevelopment') || 'Gesamtentwicklung' : 'Gesamtentwicklung'}
                </div>
                <div className={`text-3xl font-black relative z-10 ${totalDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {totalDelta > 0 ? '+' : ''}{fCur(totalDelta)}
                </div>
                <div className={`text-xs font-medium mt-2 relative z-10 ${totalDelta >= 0 ? 'text-emerald-700/70 dark:text-emerald-500/70' : 'text-rose-700/70 dark:text-rose-500/70'}`}>
                    {totalDelta >= 0 ? (t ? t('positiveGrowth') || 'Positiver Zuwachs' : 'Positiver Zuwachs') : (t ? t('negativeDecline') || 'Negativer Rückgang' : 'Negativer Rückgang')}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Star" size={14} className="text-amber-500"/>
                      {t ? t('strongestArea') || 'Stärkster Bereich' : 'Stärkster Bereich'}
                    </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white truncate" title={bestCat ? bestCat.name : '-'}>
                    {bestCat ? bestCat.name : '-'}
                </div>
                <div className="text-xs font-bold mt-2">
                    {bestCat ? (
                        <span className="text-emerald-600 dark:text-emerald-400">+{fCur(bestCat.delta)}</span>
                    ) : (
                        <span className="text-gray-400">{t ? t('noPositiveValues') || 'Keine positiven Werte' : 'Keine positiven Werte'}</span>
                    )}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-cat-export-block self-start sticky top-8">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart" className="text-indigo-500" /> {t ? t('valueChange') || 'Wertveränderung' : 'Wertveränderung'}
                </h3>
                <div ref={chartRef} style={{ width: '100%', height: `${Math.max(350, catData.length * 40)}px` }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        horizontal={true}
                        labels={catData.map(d => d.name)}
                        datasets={[{
                            label: t ? t('change') || 'Entwicklung' : 'Entwicklung',
                            data: catData.map(d => d.delta),
                            backgroundColor: chartColors,
                            valueFormatter: (val) => val > 0 ? `+${fCur(val)}` : fCur(val)
                        }]}
                        height="100%"
                    />
                </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2 ml-1">
                    <Icon name="Layers" className="text-slate-500" />
                    {t ? t('categoryDetailsAndAssets') || 'Kategoriedetails & Assets' : 'Kategoriedetails & Assets'}
                </h3>
                
                <div className="grid gap-4">
                    {catData.map((cat, idx) => {
                        const isPositive = cat.delta >= 0;
                        return (
                            <div key={idx} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className="p-4 md:p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <Icon name="Folder" className="text-yellow-500"/>
                                            {cat.name}
                                        </div>
                                        <div className={`font-mono text-lg font-black bg-opacity-10 px-2 py-0.5 rounded-lg ${isPositive ? 'text-emerald-600 bg-emerald-500 dark:text-emerald-400 dark:bg-emerald-900/30' : 'text-rose-600 bg-rose-500 dark:text-rose-400 dark:bg-rose-900/30'}`}>
                                            {isPositive ? '+' : ''}{fCur(cat.delta)}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-sm mt-3">
                                        <div>
                                            <span className="text-gray-400 text-xs uppercase tracking-wider block">{t ? t('startShort') || 'Start' : 'Start'}</span>
                                            <span className="font-mono text-slate-600 dark:text-slate-300">{fCur(cat.start)}</span>
                                        </div>
                                        <div className="flex items-center text-gray-300 dark:text-slate-600">
                                            <Icon name="ChevronRight" size={14} />
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs uppercase tracking-wider block">{t ? t('endShort') || 'Ende' : 'Ende'}</span>
                                            <span className="font-mono text-slate-600 dark:text-slate-300">{fCur(cat.end)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {cat.assets.map((a, i) => {
                                                const aPos = a.delta >= 0;
                                                return (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 pl-5 text-gray-600 dark:text-gray-300">
                                                            <div className="flex items-center">
                                                                <div className={`w-1.5 h-1.5 rounded-full mr-3 ${aPos ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                                {a.name}
                                                                {a.class && (
                                                                    <span className="ml-2 text-[10px] bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 px-1.5 py-0.5 rounded tracking-wider uppercase">
                                                                        {a.class}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className={`p-3 pr-5 text-right font-mono text-xs font-medium ${aPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                            {aPos ? '+' : ''}{fCur(a.delta)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

module.exports = CategoryFlowReport;