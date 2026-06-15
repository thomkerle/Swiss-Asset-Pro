const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;

const TopFlowReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';

  const [showAllChartItems, setShowAllChartItems] = useState(false);

  const repTitle = t ? t('repTopFlowTitle') || "Top Gewinner & Verlierer" : "Top Gewinner & Verlierer";
  const repSub = t ? t('repTopFlowSub') || "Absolute Wertveränderung pro Asset" : "Absolute Wertveränderung pro Asset";
  const wordTo = t ? t('wordTo') || "bis" : "bis";

  const formatLabel = (name) => {
      if (!name) return 'Unbenannt';
      if (name.length > 25) return name.substring(0, 22) + '...';
      return name;
  };

  const { flows, winners, losers, topWinner, topLoser, totalGained, totalLost } = useMemo(() => {
      let tGained = 0;
      let tLost = 0;

      let calcFlows = (activeAssets || []).map(a => {
          const s = getAssetValueAtDate(a, dateRange?.from || '2000-01-01');
          const e = getAssetValueAtDate(a, dateRange?.to || new Date().toISOString().split('T')[0]);
          const diff = e - s;
          
          if (diff > 0) tGained += diff;
          if (diff < 0) tLost += Math.abs(diff);

          return { 
              label: a.name || 'Unbenannt', 
              class: a.assetClass,
              start: s,
              end: e,
              value: diff, 
              valLabel: `${diff > 0 ? '+' : ''}${fCur ? fCur(diff) : diff}`, 
              isPos: diff >= 0 
          };
      });
      
      calcFlows = calcFlows.filter(f => Math.abs(f.value) > 0.01).sort((a,b) => b.value - a.value);

      const win = calcFlows.filter(f => f.isPos);
      const lose = calcFlows.filter(f => !f.isPos);
      
      return {
          flows: calcFlows,
          winners: win,
          losers: lose,
          topWinner: win.length > 0 ? win[0] : null,
          topLoser: lose.length > 0 ? lose[lose.length - 1] : null,
          totalGained: tGained,
          totalLost: tLost
      };
  }, [activeAssets, dateRange, fCur]);

  const chartFlows = useMemo(() => {
      if (showAllChartItems || flows.length <= 10) return flows;
      return [...flows.slice(0, 5), ...flows.slice(-5)];
  }, [flows, showAllChartItems]);

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
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        
        let chartsData = [];
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        const exportKpis = [
            { 
                label: t ? t('bestPerformer') || 'Bester Performer' : 'Bester Performer', 
                value: topWinner ? `${topWinner.valLabel} | ${topWinner.label}` : (t ? t('noGains') || 'Keine Gewinne' : 'Keine Gewinne'), 
                color: '#10b981' 
            },
            { 
                label: t ? t('weakestItem') || 'Schwächster Posten' : 'Schwächster Posten', 
                value: topLoser ? `${topLoser.valLabel} | ${topLoser.label}` : (t ? t('noLosses') || 'Keine Verluste' : 'Keine Verluste'), 
                color: '#e11d48' 
            },
            { 
                label: t ? t('totalGains') || 'Summe Gewinne' : 'Summe Gewinne', 
                value: `+${fCur(totalGained)}`, 
                color: '#047857' 
            },
            { 
                label: t ? t('totalLosses') || 'Summe Verluste' : 'Summe Verluste', 
                value: `-${fCur(totalLost)}`, 
                color: '#be123c' 
            }
        ];

        if (chartRef.current) {
            const chartDiv = chartRef.current.querySelector('.universal-chart-wrapper > div') || chartRef.current.querySelector('div');
            
            if (chartDiv && window.echarts) {
                const chartInstance = window.echarts.getInstanceByDom(chartDiv);
                if (chartInstance) {
                    const imgData = chartInstance.getDataURL({ type: 'png', pixelRatio: 2.5, backgroundColor: bgColor });
                    chartsData.push({ title: t ? t('overviewValueChange') || 'Übersicht Wertveränderung' : 'Übersicht Wertveränderung', image: imgData, fit: [760, 360] });
                }
            } else {
                try {
                    const html2canvas = await loadHtml2Canvas();
                    const chartBlock = document.querySelector('.chart-topflow-export-block');
                    if (chartBlock) {
                        const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                        chartsData.push({ title: t ? t('overviewValueChange') || 'Übersicht Wertveränderung' : 'Übersicht Wertveränderung', image: canvas.toDataURL('image/png', 1.0), fit: [760, 360] });
                    }
                } catch (e) {
                    console.warn("Chart-Fallback Fehler:", e);
                }
            }
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
            capitalize(t ? t('labelAsset') || 'Asset' : 'Asset'),
            t ? t('startValue') || 'Startwert' : 'Startwert',
            t ? t('endValue') || 'Endwert' : 'Endwert',
            capitalize(t ? t('change') || 'Veränderung' : 'Veränderung')
        ];

        const tableBody = flows.map(f => [
            f.label, 
            fCur(f.start),
            fCur(f.end),
            f.valLabel
        ]);

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${wordTo} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`,
          tableHeaders,
          tableBody,
          chartsData,
          kpis: exportKpis,
          data: data || activeAssets 
        });
      } catch (err) { console.error("[FinSPA] PDF Export Error im TopFlowReport:", err); }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [flows, dateRange, fCur, t, repTitle, repSub, wordTo, data, activeAssets, topWinner, topLoser, totalGained, totalLost]);

  if (flows.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <ReportHeader 
          title={repTitle} 
          subtitle={`${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} ${wordTo} ${new Date(dateRange.to).toLocaleDateString('de-CH')})`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Activity" size={32} className="mx-auto mb-3 opacity-50"/>
          <p><span>{t ? t('noFlowsFound') || 'Keine Wertveränderungen im gewählten Zeitraum.' : 'Keine Wertveränderungen im gewählten Zeitraum.'}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
        title={repTitle} 
        subtitle={`${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} - ${new Date(dateRange.to).toLocaleDateString('de-CH')})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="w-full bg-white dark:bg-transparent">
          
          <div className="kpi-topflow-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="TrendingUp" size={14} className="text-emerald-500"/>
                    <span>{t ? t('bestPerformer') || 'Bester Performer' : 'Bester Performer'}</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white truncate" title={topWinner?.label}>
                    <span>{topWinner ? topWinner.label : '-'}</span>
                </div>
                <div className="text-xs font-bold mt-2">
                    {topWinner ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex gap-0.5">
                            <span>+</span>
                            <span>{fCur(topWinner.value)}</span>
                        </span>
                    ) : (
                        <span className="text-gray-400"><span>{t ? t('noGains') || 'Keine Gewinne' : 'Keine Gewinne'}</span></span>
                    )}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="TrendingDown" size={14} className="text-rose-500"/>
                    <span>{t ? t('weakestItem') || 'Schwächster Posten' : 'Schwächster Posten'}</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white truncate" title={topLoser?.label}>
                    <span>{topLoser ? topLoser.label : '-'}</span>
                </div>
                <div className="text-xs font-bold mt-2 flex gap-0.5">
                    {topLoser ? (
                        <span className="text-rose-600 dark:text-rose-400"><span>{fCur(topLoser.value)}</span></span>
                    ) : (
                        <span className="text-gray-400"><span>{t ? t('noLosses') || 'Keine Verluste' : 'Keine Verluste'}</span></span>
                    )}
                </div>
             </div>

             <div className="bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="PlusCircle" size={48} className="text-emerald-600" />
                </div>
                <div className="text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="Plus" size={14} />
                    <span>{t ? t('totalGains') || 'Summe Gewinne' : 'Summe Gewinne'}</span>
                </div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 relative z-10 flex gap-0.5">
                    <span>+</span>
                    <span>{fCur(totalGained)}</span>
                </div>
             </div>

             <div className="bg-rose-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="Trash2" size={48} className="text-rose-600" />
                </div>
                <div className="text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="ArrowUp" size={14} className="transform rotate-180" />
                    <span>{t ? t('totalLosses') || 'Summe Verluste' : 'Summe Verluste'}</span>
                </div>
                <div className="text-3xl font-black text-rose-700 dark:text-rose-400 relative z-10 flex gap-0.5">
                    <span>-</span>
                    <span>{fCur(totalLost)}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            
            <div className={`lg:col-span-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-topflow-export-block self-start transition-all duration-300 ${showAllChartItems ? '' : 'sticky top-8'}`}>
                <h3 className="font-bold text-lg mb-6 flex items-center justify-between text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-2">
                        <Icon name="BarChart" className="text-blue-500" /> <span>{t ? t('overviewValueChange') || 'Übersicht Wertveränderung' : 'Übersicht Wertveränderung'}</span>
                    </span>
                    
                    {flows.length > 10 && (
                        <button 
                            onClick={() => setShowAllChartItems(!showAllChartItems)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors focus:outline-none ${
                                showAllChartItems 
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50' 
                                : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            {showAllChartItems ? (
                                <><Icon name="ChevronUp" size={14} /> <span>{t ? t('reduceToTop10') || 'Auf Top 10 reduzieren' : 'Auf Top 10 reduzieren'}</span></>
                            ) : (
                                <><Icon name="ChevronDown" size={14} /> <span>{t ? t('btnShowAll') || 'Alle' : 'Alle'} {flows.length} {t ? t('btnShowAllSuffix') || 'anzeigen' : 'anzeigen'}</span></>
                            )}
                        </button>
                    )}
                </h3>
                
                <div ref={chartRef} style={{ width: '100%', height: `${Math.max(450, chartFlows.length * 40)}px` }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        horizontal={true}
                        xAxisName={t ? t('change') || 'Veränderung' : 'Veränderung'}
                        labels={chartFlows.map((f, i) => formatLabel(f.label) + '\u200B'.repeat(i))}
                        datasets={[{
                            label: t ? t('change') || 'Veränderung' : 'Veränderung',
                            data: chartFlows.map(f => f.value),
                            backgroundColor: chartFlows.map(f => f.isPos ? '#10b981' : '#f43f5e'),
                            valueFormatter: (val) => `${val > 0 ? '+' : ''}${fCur(val)}`
                        }]}
                        height="100%" 
                    />
                </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
                
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-emerald-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="TrendingUp" className="text-emerald-500" />
                            <span>{t ? t('topWinners') || 'Top Gewinner' : 'Top Gewinner'}</span>
                        </div>
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full font-bold flex gap-1">
                            <span>{winners.length}</span>
                            <span>{t ? t('assets') || 'Assets' : 'Assets'}</span>
                        </span>
                    </div>
                    <div className="p-0">
                        {winners.length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {winners.map((f, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="p-3 pl-5 text-gray-700 dark:text-gray-200">
                                                <div className="font-medium"><span>{f.label}</span></div>
                                                <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                                                    <span>{fCur(f.start)}</span> 
                                                    <span className="text-gray-300 dark:text-gray-600">→</span> 
                                                    <span>{fCur(f.end)}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 pr-5 text-right align-middle">
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                                                    <span>{f.valLabel}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center text-gray-400 text-sm"><span>{t ? t('noWinnersPeriod') || 'Keine Gewinner in dieser Periode.' : 'Keine Gewinner in dieser Periode.'}</span></div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-rose-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="TrendingDown" className="text-rose-500" />
                            <span>{t ? t('topLosers') || 'Verlierer' : 'Verlierer'}</span>
                        </div>
                        <span className="text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full font-bold flex gap-1">
                            <span>{losers.length}</span>
                            <span>{t ? t('assets') || 'Assets' : 'Assets'}</span>
                        </span>
                    </div>
                    <div className="p-0">
                        {losers.length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {losers.map((f, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="p-3 pl-5 text-gray-700 dark:text-gray-200">
                                                <div className="font-medium"><span>{f.label}</span></div>
                                                <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                                                    <span>{fCur(f.start)}</span> 
                                                    <span className="text-gray-300 dark:text-gray-600">→</span> 
                                                    <span>{fCur(f.end)}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 pr-5 text-right align-middle">
                                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
                                                    <span>{f.valLabel}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center text-gray-400 text-sm"><span>{t ? t('noLosersPeriod') || 'Keine Verlierer in dieser Periode.' : 'Keine Verlierer in dieser Periode.'}</span></div>
                        )}
                    </div>
                </div>

            </div>
          </div>
      </div>
    </div>
  );
};

module.exports = TopFlowReport;