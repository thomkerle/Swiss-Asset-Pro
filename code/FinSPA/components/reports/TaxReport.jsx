const React = require('react');
const { useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const { getAssetValueAtDate = () => 0, getAllAssets = () => [] } = DataEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const TaxReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const year = new Date(dateRange.to).getFullYear();
  const taxDate = `${year}-12-31`;

  const titleText = t ? (t('repTaxTitle') || 'Steuer-Report') : 'Steuer-Report';
  const subText = t ? (t('repTaxSub') || 'Vermögenswerte für die Steuererklärung') : 'Vermögenswerte für die Steuererklärung';

  const safeAssets = useMemo(() => {
      if (activeAssets && activeAssets.length > 0) return activeAssets;
      return getAllAssets(data?.banks || []).filter(a => !a.isArchived);
  }, [activeAssets, data]);

  const { taxableAssets, taxFreeAssets, totalWealth, taxableTotal, taxFreeTotal } = useMemo(() => {
      let tWealth = 0;
      let tTaxable = 0;
      let tTaxFree = 0;
      const taxAssets = [];
      const freeAssets = [];

      (safeAssets || []).forEach(a => {
          const val = getAssetValueAtDate(a, taxDate, safeAssets);
          if (val === 0) return;

          const isTaxFree = ['pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(a.assetClass);

          if (isTaxFree) {
              tTaxFree += val;
              freeAssets.push({ name: a.name, val, class: a.assetClass });
          } else {
              tTaxable += val;
              tWealth += val; 
              taxAssets.push({ name: a.name, val, class: a.assetClass });
          }
      });

      return { 
          taxableAssets: taxAssets.sort((a,b) => b.val - a.val), 
          taxFreeAssets: freeAssets.sort((a,b) => b.val - a.val),
          totalWealth: tWealth,
          taxableTotal: tTaxable,
          taxFreeTotal: tTaxFree
      };
  }, [safeAssets, taxDate]);

  const labelTaxable = t ? (t('labelTaxableWealth') || 'Steuerbares Vermögen') : 'Steuerbares Vermögen';
  const labelTaxFree = t ? (t('labelTaxFreeWealth') || 'Steuerbefreites Vermögen') : 'Steuerbefreites Vermögen';

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

        // 1. Snapshot KPIs (Full-Width)
        const kpiBlock = document.querySelector('.kpi-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        // 2. Snapshot Charts (Moderne Extraktion via QuerySelector All & fit-Attribut)
        if (chartRef.current) {
            const containers = chartRef.current.querySelectorAll('.chart-export-block');
            for (let i = 0; i < containers.length; i++) {
                const titleFallback = containers[i].getAttribute('data-pdf-title') || '';
                const chartDiv = containers[i].querySelector('.universal-chart-wrapper > div') || containers[i].querySelector('div');
                
                if (chartDiv && window.echarts) {
                    const chartInstance = window.echarts.getInstanceByDom(chartDiv);
                    if (chartInstance) {
                        const currentOption = chartInstance.getOption();
                        const hasLegend = currentOption.legend && currentOption.legend.length > 0;
                        
                        chartInstance.setOption({
                            legend: hasLegend ? { 
                                type: 'plain', bottom: 0, top: 'auto', left: 'center',
                                icon: 'circle', itemGap: 12, itemWidth: 10, itemHeight: 10,
                                textStyle: { fontSize: 11 }
                            } : undefined,
                            series: [{ center: ['50%', '35%'], radius: ['30%', '55%'] }] 
                        });
                        
                        const imgData = chartInstance.getDataURL({ type: 'png', pixelRatio: 2.5, backgroundColor: bgColor });
                        
                        chartInstance.setOption({
                            legend: hasLegend ? { 
                                type: 'scroll', bottom: 0, top: 'auto', left: 'center',
                                icon: 'circle', itemGap: 24, textStyle: { fontSize: 13 }
                            } : undefined,
                            series: [{ center: ['50%', '50%'], radius: ['45%', '75%'] }] 
                        });
                        
                        chartsData.push({ title: titleFallback, image: imgData, fit: [360, 260] });
                        continue;
                    }
                }
                
                const canvas = await html2canvas(containers[i], { 
                    scale: 2, backgroundColor: bgColor, useCORS: true, logging: false,
                    ignoreElements: (element) => {
                        if (element.classList && element.classList.contains('echarts-tooltip')) return true;
                        if (element.tagName === 'DIV' && element.style && element.style.position === 'absolute' && element.style.top === '0px') return true;
                        return element.tagName === 'IFRAME' || element.tagName === 'NOSCRIPT' || element.tagName === 'FONT';
                    }
                });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] }); 
            }
        }

        // Flache Tabellen-Struktur
        const tableHeaders = [
            t ? t('category') || 'Kategorie' : 'Kategorie',
            t ? t('name') || 'Anlage / Asset' : 'Anlage / Asset',
            t ? t('taxValue') || 'Steuerwert' : 'Steuerwert'
        ];
        
        const tableBody = [];
        
        if (taxableAssets.length > 0) {
            tableBody.push([{ text: labelTaxable.toUpperCase(), bold: true }, '', { text: fCur(taxableTotal), bold: true }]);
            taxableAssets.forEach(a => {
                tableBody.push([`   - ${a.class || 'Asset'}`, a.name, fCur(a.val)]);
            });
        }
        
        if (taxFreeAssets.length > 0) {
            tableBody.push(['', '', '']);
            tableBody.push([{ text: labelTaxFree.toUpperCase(), bold: true }, '', { text: fCur(taxFreeTotal), bold: true }]);
            taxFreeAssets.forEach(a => {
                tableBody.push([`   - ${a.class || 'Asset'}`, a.name, fCur(a.val)]);
            });
        }

        tableBody.push(['', '', '']);
        tableBody.push([
            { text: (t ? t('labelTotalTaxable') || 'TOTAL STEUERBAR' : 'TOTAL STEUERBAR').toUpperCase(), bold: true }, 
            '', 
            { text: fCur(totalWealth), bold: true }
        ]);

        return { chartsData, tableHeaders, tableBody };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subText} (Stichtag: 31.12.${year})`,
          tableHeaders, 
          tableBody, 
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im TaxReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 13, 
                    title: titleText,
                    subtitle: `${subText} (Stichtag: 31.12.${year})`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im TaxReport:", err);
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
  }, [taxableAssets, taxFreeAssets, taxableTotal, taxFreeTotal, totalWealth, taxDate, fCur, t, titleText, subText, data, year, labelTaxable, labelTaxFree]);

  if (!safeAssets || safeAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('noAssetsFound') || 'Keine Assets für den Steuer-Report gefunden.' : 'Keine Assets für den Steuer-Report gefunden.'}</p>
        </div>
      </div>
    );
  }

  const taxablePct = (taxableTotal + taxFreeTotal) > 0 ? (taxableTotal / (taxableTotal + taxFreeTotal)) * 100 : 0;
  const taxFreePct = (taxableTotal + taxFreeTotal) > 0 ? (taxFreeTotal / (taxableTotal + taxFreeTotal)) * 100 : 0;

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12">

      <div className="dashboard-top-export-block w-full bg-white dark:bg-slate-950">
          {/* KPI EXPORT BLOCK */}
          <div className="kpi-export-block grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-1">
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Landmark" size={14} className="text-blue-500" />
                    <span>{String(labelTaxable).toUpperCase()}</span>
                </div>
                <div className="text-2xl xl:text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2 break-words">
                    <span>{fCur(taxableTotal)}</span>
                    <span className="text-sm text-gray-400 font-medium ml-1">({taxablePct.toFixed(1)}%)</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <span>{t ? t('descTaxableWealth') || 'Unterliegt der regulären Vermögenssteuer' : 'Unterliegt der regulären Vermögenssteuer'}</span>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-gray-500 text-xs font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-emerald-500" />
                    <span>{String(labelTaxFree).toUpperCase()}</span>
                </div>
                <div className="text-2xl xl:text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2 break-words">
                    <span>{fCur(taxFreeTotal)}</span>
                    <span className="text-sm text-gray-400 font-medium ml-1">({taxFreePct.toFixed(1)}%)</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <span>{t ? t('descTaxFreeWealth') || 'Säule 3a & PK (Während Ansparphase)' : 'Säule 3a & PK (Während Ansparphase)'}</span>
                </div>
             </div>
             
             <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl shadow-sm">
                <div className="text-blue-700 dark:text-blue-400 text-xs font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="FileText" size={14} />
                    <span>{String(t ? t('labelTotalTaxValue') || 'Total Deklarationswert' : 'Total Deklarationswert').toUpperCase()}</span>
                </div>
                <div className="text-2xl xl:text-3xl font-black text-blue-800 dark:text-blue-300 break-words">
                    <span>{fCur(totalWealth)}</span>
                </div>
                <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-2">
                    <span>{t ? t('descTotalTaxValue') || 'Dieser Wert wird im Wertschriftenverzeichnis deklariert.' : 'Dieser Wert wird im Wertschriftenverzeichnis deklariert.'}</span>
                </div>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10" ref={chartRef}>
            
            <div 
               className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8"
               data-pdf-title={t ? t('titleTaxStructure') || "Steuerliche Struktur" : "Steuerliche Struktur"}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-blue-500" /> {t ? t('titleTaxStructure') || "Steuerliche Struktur" : "Steuerliche Struktur"}
                </h3>
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="doughnut"
                        labels={[labelTaxable, labelTaxFree]}
                        datasets={[{
                            data: [taxableTotal, taxFreeTotal],
                            backgroundColor: ['#3b82f6', '#10b981'],
                            valueFormatter: fCur
                        }]} 
                        height="100%"
                    />
                </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
                
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Icon name="List" className="text-slate-500" />
                    {t ? t('labelAssetListing') || 'Wertschriften- und Anlagenverzeichnis' : 'Wertschriften- und Anlagenverzeichnis'}
                </h3>
                
                <div className="grid gap-6">
                    {[
                        { title: labelTaxable, assets: taxableAssets, isTaxable: true },
                        { title: labelTaxFree, assets: taxFreeAssets, isTaxable: false }
                    ].map((group, idx) => {
                        if (group.assets.length === 0) return null;
                        
                        return (
                            <div key={idx} className={`border rounded-2xl overflow-hidden shadow-sm ${group.isTaxable ? 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800' : 'bg-gray-50/50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 border-dashed'}`}>
                                <div className={`p-4 border-b flex justify-between items-center ${group.isTaxable ? 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30' : 'border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-800/50'}`}>
                                    <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <Icon name={group.isTaxable ? 'Landmark' : 'Shield'} className={group.isTaxable ? 'text-blue-500' : 'text-emerald-500'} />
                                        {group.title}
                                    </div>
                                    <div className={`font-mono text-base font-black px-2 py-0.5 rounded-lg ${group.isTaxable ? 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30' : 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30'}`}>
                                        {fCur(group.assets.reduce((sum, a) => sum + a.val, 0))}
                                    </div>
                                </div>
                                
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                            {group.assets.map((a, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3 pl-5 text-gray-700 dark:text-gray-200 font-medium">
                                                        <div className="flex items-center">
                                                            <div className={`w-1.5 h-1.5 rounded-full mr-3 ${group.isTaxable ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                                                            <span>{a.name}</span>
                                                            {a.class && (
                                                                <span className="ml-2 text-[10px] bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 px-1.5 py-0.5 rounded tracking-wider uppercase">
                                                                    {a.class}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`p-3 pr-5 text-right font-mono text-xs ${a.val < 0 ? 'text-red-500 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                                        <span>{fCur(a.val)}</span>
                                                    </td>
                                                </tr>
                                            ))}
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
  );
};

module.exports = TaxReport;