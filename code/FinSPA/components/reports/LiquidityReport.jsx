const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name}) => <span className="text-xs">[{name}]</span>);
const { getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const LiquidityReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange.to;

  const [viewTab, setViewTab] = useState('overview');

  // PERFORMANCE FIX: useMemo berechnet die Assets nur neu, wenn sie sich wirklich ändern.
  // Das verhindert die Endlosschleifen, weswegen wir data wieder sicher ins useEffect packen können.
  const {
      liquidAssets, illiquidAssets, liquidTotal, illiquidTotal, pureCashTotal,
      catCash, catSecurities, catPension, catRealEstate, grandTotal,
      liquidPercent, illiquidPercent, cashPercentOfLiquid
  } = useMemo(() => {
      let lTot = 0, ilTot = 0, pCashTot = 0;
      let cCash = 0, cSec = 0, cPen = 0, cRE = 0;
      const lAssets = [];
      const ilAssets = [];
      const safeAssets = activeAssets || [];

      safeAssets.forEach(a => {
        const val = getAssetValueAtDate(a, targetDate, safeAssets);
        if (val === 0) return;

        const isIlliquidClass = ['pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'realestate', 'mortgage'].includes(a.assetClass);
        const isLiquid = a.isLiquid !== undefined ? a.isLiquid : !isIlliquidClass;
        
        if (a.assetClass === 'cash') { cCash += val; pCashTot += val; }
        else if (['stock', 'fund', 'crypto'].includes(a.assetClass)) cSec += val;
        else if (a.assetClass?.includes('pension')) cPen += val;
        else if (['realestate', 'mortgage'].includes(a.assetClass)) cRE += val;

        if (isLiquid) {
          lTot += val;
          lAssets.push({ name: a.name, val, class: a.assetClass });
        } else {
          ilTot += val;
          ilAssets.push({ name: a.name, val, class: a.assetClass });
        }
      });

      const gTot = lTot + ilTot;
      return {
          liquidAssets: lAssets,
          illiquidAssets: ilAssets,
          liquidTotal: lTot,
          illiquidTotal: ilTot,
          pureCashTotal: pCashTot,
          catCash: cCash,
          catSecurities: cSec,
          catPension: cPen,
          catRealEstate: cRE,
          grandTotal: gTot,
          liquidPercent: gTot > 0 ? (lTot / gTot) * 100 : 0,
          illiquidPercent: gTot > 0 ? (ilTot / gTot) * 100 : 0,
          cashPercentOfLiquid: lTot > 0 ? (pCashTot / lTot) * 100 : 0
      };
  }, [activeAssets, targetDate]);

  const labelLiquid = t ? (t('labelAvailable') || 'Verfügbar (Liquid)') : 'Verfügbar (Liquid)';
  const labelIlliquid = t ? (t('labelTiedUp') || 'Gebunden (Illiquid)') : 'Gebunden (Illiquid)';

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

        const captureBlock = async (selector, titleFallback = '') => {
            if (!reportRef.current) return;
            const el = reportRef.current.querySelector(selector);
            if (el) {
                await new Promise(resolve => setTimeout(resolve, 50));
                const canvas = await html2canvas(el, { 
                    scale: 2, 
                    backgroundColor: bgColor, 
                    useCORS: true, 
                    logging: false,
                    ignoreElements: (element) => {
                        return element.tagName === 'IFRAME' || element.tagName === 'NOSCRIPT' || element.tagName === 'FONT';
                    }
                });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0), width: 760 });
            }
        };

        await captureBlock('.pdf-combined-export-block', ''); 

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

        const tableHeaders = [
          capitalize(t ? (t('labelLiqType') || 'Kategorie') : 'Kategorie'), 
          capitalize(t ? (t('name') || 'Anlage / Asset') : 'Anlage / Asset'),
          capitalize(t ? (t('amount') || 'Wert') : 'Wert')
        ];
        
        const tableBody = [];
        liquidAssets.sort((a,b) => b.val - a.val).forEach(a => { tableBody.push([labelLiquid, a.name, fCur(a.val)]); });
        illiquidAssets.sort((a,b) => b.val - a.val).forEach(a => { tableBody.push([labelIlliquid, a.name, fCur(a.val)]); });

        return { chartsData, tableHeaders, tableBody };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        const subtitleText = `${t ? (t('repLiqSubTied') || 'Verfügbare vs. gebundene Mittel per') : 'Verfügbare vs. gebundene Mittel per'} ${new Date(targetDate).toLocaleDateString('de-CH')}`;

        await PdfExportEngine.exportReport({
          title: t ? (t('repLiqTitle') || 'Liquiditäts-Analyse') : 'Liquiditäts-Analyse',
          subtitle: subtitleText,
          tableHeaders,
          tableBody,
          chartsData,
          data: data // FIX: Direkte Daten-Referenz ohne Umwege
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im LiquidityReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                const subtitleText = `${t ? (t('repLiqSubTied') || 'Verfügbare vs. gebundene Mittel per') : 'Verfügbare vs. gebundene Mittel per'} ${new Date(targetDate).toLocaleDateString('de-CH')}`;

                resolve({
                    order: 3, 
                    title: t ? (t('repLiqTitle') || 'Liquiditäts-Analyse') : 'Liquiditäts-Analyse',
                    subtitle: subtitleText,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im LiquidityReport:", err);
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
  // FIX: data ist nun Teil der Dependency-Liste. Sobald du den Namen änderst, baut sich der EventListener mit dem neuen Namen neu auf!
  }, [liquidAssets, illiquidAssets, grandTotal, fCur, t, targetDate, labelLiquid, labelIlliquid, data]);

  const renderMiniBar = (value, max, colorClass) => {
      const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
      return (
          <div className="w-24 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0 mt-1">
              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
          </div>
      );
  };

  if (grandTotal === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? (t('noAssetsFoundDate') || 'Keine Vermögenswerte zum gewählten Stichtag gefunden.') : 'Keine Vermögenswerte zum gewählten Stichtag gefunden.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      {/* GEMEINSAMER UMSCHLAG FÜR PDF EXPORT */}
      <div className="pdf-combined-export-block w-full bg-white dark:bg-transparent">
          
          <div className="kpi-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="PieChart" size={14} className="text-blue-500"/>
                    <span>{t ? (t('totalWealth') || 'Gesamtkapital') : 'Gesamtkapital'}</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white break-words">
                    <span>{fCur(grandTotal)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2 flex gap-1">
                    <span>{t ? (t('statusAsOf') || 'Stichtag:') : 'Stichtag:'}</span> 
                    <span>{new Date(targetDate).toLocaleDateString('de-CH')}</span>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-sky-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Droplet" size={14} className="text-sky-500"/>
                      <span>{labelLiquid}</span>
                    </span>
                    <span className="bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded font-bold text-[10px]">
                      <span>{liquidPercent.toFixed(1)}%</span>
                    </span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white break-words">
                    <span>{fCur(liquidTotal)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <span>{t ? (t('descLiquidFunds') || 'Flexibel abrufbares Vermögen') : 'Flexibel abrufbares Vermögen'}</span>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Lock" size={14} className="text-amber-500"/>
                      <span>{labelIlliquid}</span>
                    </span>
                    <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded font-bold text-[10px]">
                      <span>{illiquidPercent.toFixed(1)}%</span>
                    </span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white break-words">
                    <span>{fCur(illiquidTotal)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <span>{t ? (t('descIlliquidFunds') || 'Langfristig gebundenes Kapital') : 'Langfristig gebundenes Kapital'}</span>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between" title={t ? (t('tooltipCashShare') || "Anteil des Cashs am liquiden Vermögen") : "Anteil"}>
                    <span className="flex items-center gap-2">
                      <Icon name="DollarSign" size={14} className="text-emerald-500"/>
                      <span>{t ? (t('labelHardLiquidity') || 'Harte Liquidität') : 'Harte Liquidität'}</span>
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px] flex gap-0.5">
                      <span>{cashPercentOfLiquid.toFixed(0)}</span>
                      <span>{t ? (t('labelPctOfLiq') || '% d. Liq.') : '% d. Liq.'}</span>
                    </span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white break-words">
                    <span>{fCur(pureCashTotal)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <span>{t ? (t('descCashFunds') || 'Sofort verfügbare Geldmittel') : 'Sofort verfügbare Geldmittel'}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-indigo-500"/> <span>{t ? (t('titleStructureOverview') || 'Struktur-Übersicht') : 'Struktur-Übersicht'}</span>
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                  <UniversalChart
                    engine={activeChartEngine}
                    type="doughnut"
                    height="100%"
                    labels={[labelLiquid, labelIlliquid]}
                    datasets={[{
                      data: [liquidTotal, illiquidTotal],
                      backgroundColor: ['#0ea5e9', '#f59e0b'],
                      valueFormatter: fCur 
                    }]}
                  />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block flex flex-col">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart2" className="text-blue-500"/> <span>{t ? (t('titleCompByClass') || 'Zusammensetzung nach Klassen') : 'Zusammensetzung nach Klassen'}</span>
                </h3>
                
                <div className="flex-1 space-y-6 flex flex-col justify-center px-2">
                    <div>
                        <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>{t ? (t('catCashAccounts') || 'Cash & Konten') : 'Cash & Konten'}</span></span>
                            <span className="text-slate-900 dark:text-white"><span>{fCur(catCash)}</span></span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(catCash/grandTotal)*100}%` }}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span>{t ? (t('catSecuritiesCrypto') || 'Wertpapiere & Krypto') : 'Wertpapiere & Krypto'}</span></span>
                            <span className="text-slate-900 dark:text-white"><span>{fCur(catSecurities)}</span></span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(catSecurities/grandTotal)*100}%` }}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span>{t ? (t('catPensionProvident') || 'Vorsorge (Pensionskasse, 3a)') : 'Vorsorge (Pensionskasse, 3a)'}</span></span>
                            <span className="text-slate-900 dark:text-white"><span>{fCur(catPension)}</span></span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${(catPension/grandTotal)*100}%` }}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span>{t ? (t('catRealEstateNet') || 'Immobilien (Netto)') : 'Immobilien (Netto)'}</span></span>
                            <span className="text-slate-900 dark:text-white"><span>{fCur(catRealEstate)}</span></span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${(catRealEstate/grandTotal)*100}%` }}></div></div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">
          {t ? (t('labelBreakdownDetails') || 'Detaillierte Aufschlüsselung') : 'Detaillierte Aufschlüsselung'}
      </h3>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-10">
         <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 p-2 gap-2">
             <button onClick={() => setViewTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewTab === 'overview' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t ? (t('tabTopPositions') || 'Top Positionen') : 'Top Positionen'}</button>
             <button onClick={() => setViewTab('details')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewTab === 'details' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t ? (t('tabAllAssets') || 'Alle Assets anzeigen') : 'Alle Assets anzeigen'}</button>
         </div>

         <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                    <h4 className="font-extrabold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="p-2 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-lg">
                            <Icon name="Droplet" size={18}/> 
                        </div>
                        {labelLiquid}
                    </h4>
                    <ul className="space-y-1">
                        {liquidAssets.sort((a,b) => b.val - a.val).slice(0, viewTab === 'overview' ? 5 : 999).map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center group/item p-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <div className="truncate pr-4 flex-1">
                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 group-hover/item:bg-sky-400 transition-colors"></span>
                                        <span>{item.name}</span>
                                    </div>
                                    <div className="ml-3.5">
                                        {renderMiniBar(item.val, liquidAssets[0]?.val || 1, 'bg-sky-500')}
                                    </div>
                                </div>
                                <div className="text-sm font-black font-mono text-slate-900 dark:text-white shrink-0"><span>{fCur(item.val)}</span></div>
                            </li>
                        ))}
                        {viewTab === 'overview' && liquidAssets.length > 5 && (
                            <div className="text-xs text-center text-gray-400 pt-3 pb-1 italic font-medium flex justify-center gap-1">
                                <span>{t ? (t('textAnd') || '... und') : '... und'}</span> 
                                <span>{liquidAssets.length - 5}</span> 
                                <span>{t ? (t('textMore') || 'weitere') : 'weitere'}</span>
                            </div>
                        )}
                    </ul>
                </div>

                <div>
                    <h4 className="font-extrabold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 rounded-lg">
                            <Icon name="Lock" size={18}/> 
                        </div>
                        {labelIlliquid}
                    </h4>
                    <ul className="space-y-1">
                        {illiquidAssets.sort((a,b) => b.val - a.val).slice(0, viewTab === 'overview' ? 5 : 999).map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center group/item p-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <div className="truncate pr-4 flex-1">
                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 group-hover/item:bg-amber-400 transition-colors"></span>
                                        <span>{item.name}</span>
                                    </div>
                                    <div className="ml-3.5">
                                        {renderMiniBar(item.val, illiquidAssets[0]?.val || 1, 'bg-amber-500')}
                                    </div>
                                </div>
                                <div className="text-sm font-black font-mono text-slate-900 dark:text-white shrink-0"><span>{fCur(item.val)}</span></div>
                            </li>
                        ))}
                        {viewTab === 'overview' && illiquidAssets.length > 5 && (
                            <div className="text-xs text-center text-gray-400 pt-3 pb-1 italic font-medium flex justify-center gap-1">
                                <span>{t ? (t('textAnd') || '... und') : '... und'}</span> 
                                <span>{illiquidAssets.length - 5}</span> 
                                <span>{t ? (t('textMore') || 'weitere') : 'weitere'}</span>
                            </div>
                        )}
                    </ul>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

module.exports = LiquidityReport;