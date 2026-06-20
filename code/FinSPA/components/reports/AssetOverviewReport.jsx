const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const AssetOverviewReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const overview = {};
  
  let grandTotal = 0;
  let totalAssetsCount = 0;
  let uniqueBanks = new Set();

  const repTitle = t ? (t('repOverviewTitle') || 'Banken & Kategorien') : 'Banken & Kategorien';
  const repSub = t ? (t('repOverviewSub') || 'Konsolidierte Übersicht der Assets per') : 'Konsolidierte Übersicht der Assets per';

  const processNode = (node, bankName) => {
    if (node.isArchived) return;
    
    if (node.type === 'asset') {
      const val = getAssetValueAtDate(node, targetDate);
      if (val === 0) return;
      
      const ac = node.assetClass || 'cash';
      
      if (!overview[ac]) overview[ac] = { total: 0, banks: {} };
      if (!overview[ac].banks[bankName]) overview[ac].banks[bankName] = { total: 0, assets: [] };
      
      overview[ac].total += val;
      overview[ac].banks[bankName].total += val;
      overview[ac].banks[bankName].assets.push({ name: node.name || 'Unbenannt', val });
      
      grandTotal += val; 
      totalAssetsCount++;
      uniqueBanks.add(bankName);
    }
    
    if (node.children) {
      node.children.forEach(child => processNode(child, bankName));
    }
  };

  data?.banks?.forEach(bank => {
    processNode(bank, bank.name || 'Unbekannte Bank');
  });

  const getAcName = (ac) => {
    if (!ac) return 'Unbekannt';
    
    if (data?.settings?.assetClasses) {
        const foundClass = data.settings.assetClasses.find(a => a.id === ac);
        if (foundClass && foundClass.name) return foundClass.name;
    }
    const key = `ac${ac.charAt(0).toUpperCase() + ac.slice(1)}`;
    if (t) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    const map = { 
      cash: 'Bargeld / Konto', 
      fund: 'Fonds / ETFs', 
      stock: 'Aktien', 
      crypto: 'Krypto', 
      realestate: 'Immobilien', 
      mortgage: 'Hypotheken', 
      pension_cash: 'Pensionskasse', 
      pension_fund: 'Vorsorgefonds (alt)',
      pension_3a_cash: '3a Vorsorgekonto', 
      pension_3a_fund: '3a Vorsorgefonds'
    };
    return map[ac] || ac;
  };

  const getAcIcon = (ac) => {
    if (ac === 'realestate') return 'Home';
    if (ac === 'mortgage') return 'Building';
    if (ac?.includes('pension')) return 'Lock'; 
    if (ac === 'crypto') return 'Coins';
    if (ac === 'fund' || ac === 'stock') return 'TrendingUp';
    if (ac === 'cash') return 'DollarSign';
    return 'PieChart';
  };

  const formatBarChartLabel = (name) => {
      if (!name) return '';
      
      const breaks = {
          '3a Vorsorgefonds': '3a\nVorsorge-\nfonds',
          '3a Vorsorgekonto': '3a\nVorsorge-\nkonto',
          'Bargeld / Konto': 'Bargeld /\nKonto',
          'Pensionskasse': 'Pensions-\nkasse',
          'Vorsorgefonds (alt)': 'Vorsorge-\nfonds\n(alt)',
          'Fonds / ETFs': 'Fonds /\nETFs'
      };
      if (breaks[name]) return breaks[name];
      
      const words = name.split(' ');
      let result = '';
      let currentLineLen = 0;

      for (let i = 0; i < words.length; i++) {
          const word = words[i];
          if (currentLineLen + word.length > 8 && currentLineLen > 0) {
              result += '\n' + word;
              currentLineLen = word.length;
          } else {
              result += (currentLineLen === 0 ? '' : ' ') + word;
              currentLineLen += (currentLineLen === 0 ? 0 : 1) + word.length;
          }
      }
      return result;
  };

  const sortedClasses = Object.keys(overview).sort((a,b) => overview[b].total - overview[a].total);

  const topClass = sortedClasses.length > 0 ? sortedClasses[0] : null;
  const topClassVal = topClass ? overview[topClass].total : 0;
  const topClassPercent = grandTotal > 0 ? ((topClassVal / grandTotal) * 100).toFixed(1) : 0;

  useEffect(() => {
    const loadHtml2Canvas = () => {
        return new Promise((resolve) => {
            if (window.html2canvas) return resolve(window.html2canvas);
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = () => resolve(window.html2canvas);
            document.head.appendChild(script);
        });
    };

    // Helfer-Funktion, die die Extraktion bündelt (für Einzel- und Batch-Export nutzbar)
    const buildReportData = async () => {
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        // 1. KPI Block extrahieren
        const kpiBlock = document.querySelector('.kpi-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        // 2. Charts extrahieren inkl. der speziellen ECharts-Legenden-Manipulation
        if (chartRef.current) {
            const containers = chartRef.current.querySelectorAll('.chart-export-block');
            for (let i = 0; i < containers.length; i++) {
                const titleFallback = containers[i].getAttribute('data-pdf-title') || '';
                const chartDiv = containers[i].querySelector('.universal-chart-wrapper > div');
                
                if (chartDiv && window.echarts) {
                    const chartInstance = window.echarts.getInstanceByDom(chartDiv);
                    if (chartInstance) {
                        const currentOption = chartInstance.getOption();
                        const hasLegend = currentOption.legend && currentOption.legend.length > 0;
                        const isPie = currentOption.series && currentOption.series.length > 0 && currentOption.series[0].type === 'pie';
                        
                        let isDoughnut = false;
                        if (isPie && currentOption.series[0].radius) {
                            isDoughnut = Array.isArray(currentOption.series[0].radius);
                        } else if (isPie) {
                            isDoughnut = true; 
                        }
                        
                        // Optionen für den Snapshot anpassen
                        chartInstance.setOption({
                            legend: hasLegend ? { 
                                type: 'plain',
                                bottom: 0,
                                top: 'auto',
                                left: 'center',
                                icon: 'circle',
                                itemGap: 12,
                                itemWidth: 10,
                                itemHeight: 10,
                                textStyle: { fontSize: 11 }
                            } : undefined,
                            series: isPie ? [{
                                center: ['50%', '35%'], 
                                radius: isDoughnut ? ['30%', '55%'] : '55%' 
                            }] : undefined,
                            grid: (!isPie && currentOption.grid) ? { bottom: '26%' } : undefined 
                        });
                        
                        const imgData = chartInstance.getDataURL({
                            type: 'png',
                            pixelRatio: 2.5,
                            backgroundColor: bgColor
                        });
                        
                        // Original-Optionen wiederherstellen
                        chartInstance.setOption({
                            legend: hasLegend ? { 
                                type: 'scroll',
                                bottom: 0,
                                top: 'auto',
                                left: 'center',
                                icon: 'circle',
                                itemGap: 24,
                                textStyle: { fontSize: 13 }
                            } : undefined,
                            series: isPie ? [{
                                center: ['50%', '50%'], 
                                radius: isDoughnut ? ['45%', '75%'] : '70%' 
                            }] : undefined,
                            grid: (!isPie && currentOption.grid) ? { bottom: '18%' } : undefined 
                        });
                        
                        chartsData.push({ title: titleFallback, image: imgData, fit: [360, 260] });
                        continue;
                    }
                }
                
                // Fallback, falls es kein EChart ist
                const canvas = await html2canvas(containers[i], { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
            }
        }

        // 3. Tabellendaten generieren
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

        const tableHeaders = [
          capitalize(t ? t('assetClass') || 'Anlageklasse' : 'Anlageklasse'),
          capitalize(t ? t('bank') || 'Bank / Institut' : 'Bank / Institut'),
          capitalize(t ? t('name') || 'Anlage / Asset' : 'Anlage / Asset'),
          capitalize(t ? t('amount') || 'Wert' : 'Wert')
        ];

        const tableBody = [];
        sortedClasses.forEach(ac => {
          Object.keys(overview[ac].banks)
            .sort((a,b) => overview[ac].banks[b].total - overview[ac].banks[a].total)
            .forEach(bankName => {
              overview[ac].banks[bankName].assets
                .sort((a,b) => b.val - a.val)
                .forEach(asset => {
                  tableBody.push([
                    getAcName(ac),
                    bankName,
                    asset.name,
                    fCur ? fCur(asset.val) : asset.val
                  ]);
                });
            });
        });

        return { chartsData, tableHeaders, tableBody };
    };

    // --- STANDARD EINZEL-EXPORT ---
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) {
            console.error("[FinSPA Diagnose] PdfExportEngine nicht verfügbar.");
            return;
        }

        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')} | Gesamtvolumen: ${fCur ? fCur(grandTotal) : grandTotal}`,
          tableHeaders,
          tableBody,
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im AssetOverviewReport:", err);
      }
    };

    // --- NEU: BATCH EXPORT FÜR DEN ORCHESTRATOR ---
    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 1, // Priorität 1 im PDF-Dokument (nach dem Deckblatt)
                    title: repTitle,
                    subtitle: `${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')} | Gesamtvolumen: ${fCur ? fCur(grandTotal) : grandTotal}`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im AssetOverviewReport:", err);
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
  }, [sortedClasses, overview, targetDate, grandTotal, fCur, t, data, repTitle, repSub]);

  if (sortedClasses.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12">
        <ReportHeader 
            title={repTitle} 
            subtitle={`${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')}`} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('noActiveAssets') || 'Keine aktiven Anlagen gefunden.' : 'Keine aktiven Anlagen gefunden.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
          title={repTitle} 
          subtitle={`${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')}`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="w-full bg-white dark:bg-transparent">
          <div className="kpi-export-block grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-1">
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-blue-500"/>
                    {t ? t('totalWealth') || 'Gesamtvermögen' : 'Gesamtvermögen'}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {fCur ? fCur(grandTotal) : grandTotal}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? t('statusAsOf') || 'Stichtag:' : 'Stichtag:'} {new Date(targetDate).toLocaleDateString('de-CH')}
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Star" size={14} className="text-emerald-500"/>
                    {t ? t('topAssetClass') || 'Stärkste Anlageklasse' : 'Stärkste Anlageklasse'}
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 pb-1 leading-tight break-words">
                    {getAcName(topClass)}
                </div>
                <div className="text-sm font-bold text-gray-500 mt-2">
                    {fCur ? fCur(topClassVal) : topClassVal} <span className="opacity-70">({topClassPercent}%)</span>
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Layers" size={14} className="text-indigo-500"/>
                    {t ? t('diversification') || 'Diversifikation' : 'Diversifikation'}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                    {totalAssetsCount} <span className="text-sm font-medium text-gray-400 uppercase">Assets</span>
                </div>
                <div className="text-sm font-bold text-indigo-500 dark:text-indigo-400 mt-2">
                    {t ? t('distributedOver') || 'Verteilt auf' : 'Verteilt auf'} {uniqueBanks.size} {t ? t('banks') || 'Banken/Institute' : 'Banken/Institute'}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10" ref={chartRef}>
             <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={t ? t('distributionByAssetClass') || 'Verteilung nach Anlageklasse' : 'Verteilung nach Anlageklasse'}
             >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-indigo-500" /> {t ? t('distributionByAssetClass') || 'Verteilung nach Anlageklasse' : 'Verteilung nach Anlageklasse'}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart
                        engine={activeChartEngine}
                        type="doughnut"
                        height="100%"
                        labels={sortedClasses.map(ac => getAcName(ac))}
                        datasets={[{
                            label: t ? t('repOverviewTitle') || 'Anlageklassen' : 'Anlageklassen',
                            data: sortedClasses.map(ac => overview[ac].total),
                            valueFormatter: fCur
                        }]}
                    />
                </div>
             </div>

             <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={t ? t('volumeComparisonAbsolute') || 'Volumenvergleich (Absolut)' : 'Volumenvergleich (Absolut)'}
             >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart2" className="text-blue-500" /> {t ? t('volumeComparison') || 'Volumenvergleich' : 'Volumenvergleich'}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart
                        engine={activeChartEngine}
                        type="bar"
                        height="100%"
                        labels={sortedClasses.map(ac => formatBarChartLabel(getAcName(ac)))}
                        datasets={[{
                            label: t ? t('amount') || 'Volumen' : 'Volumen',
                            data: sortedClasses.map(ac => overview[ac].total),
                            backgroundColor: '#3b82f6',
                            valueFormatter: fCur
                        }]}
                        options={{
                            xAxis: {
                                axisLabel: {
                                    interval: 0
                                }
                            }
                        }}
                    />
                </div>
             </div>
          </div>

          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">
              {t ? t('labelBreakdownByAssetClass') || 'Detaillierte Aufschlüsselung' : 'Detaillierte Aufschlüsselung'}
          </h3>
          
          <div className="space-y-8">
            {sortedClasses.map(ac => {
              const acTotal = overview[ac].total;
              const acPercent = grandTotal > 0 ? ((acTotal / grandTotal) * 100).toFixed(1) : 0;
              
              return (
              <div key={ac} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                
                <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
                  <h4 className="font-extrabold text-xl text-gray-800 dark:text-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Icon name={getAcIcon(ac)} size={20} />
                    </div>
                    {getAcName(ac)}
                  </h4>
                  <div className="flex flex-col items-end">
                    <span className="font-black text-2xl text-gray-900 dark:text-white">{fCur ? fCur(acTotal) : acTotal}</span>
                    <span className="text-xs font-bold text-gray-500 uppercase bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded mt-1">
                        {acPercent}% {t ? t('ofPortfolio') || 'vom Portfolio' : 'vom Portfolio'}
                    </span>
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.keys(overview[ac].banks)
                    .sort((a,b) => overview[ac].banks[b].total - overview[ac].banks[a].total)
                    .map(bankName => {
                      const bankData = overview[ac].banks[bankName];
                      return (
                      <div key={bankName} className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-shadow duration-200 flex flex-col group">
                        
                        <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
                           <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                             <Icon name="Building" size={14} className="text-gray-400"/> {bankName}
                           </span>
                           <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg text-sm">
                             {fCur ? fCur(bankData.total) : bankData.total}
                           </span>
                        </div>
                        
                        <ul className="text-sm space-y-3 text-gray-600 dark:text-gray-400 flex-1">
                          {bankData.assets
                            .sort((a,b) => b.val - a.val)
                            .map((asset, idx) => (
                             <li key={idx} className="flex justify-between items-center group/item">
                               <span className="truncate pr-4 font-medium flex items-center gap-2" title={asset.name}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 group-hover/item:bg-blue-400 transition-colors"></span>
                                  {asset.name}
                               </span>
                               <span className="font-mono text-gray-900 dark:text-gray-300 whitespace-nowrap">{fCur ? fCur(asset.val) : asset.val}</span>
                             </li>
                          ))}
                        </ul>

                      </div>
                    )})}
                </div>
              </div>
            )})}
          </div>
      </div>
    </div>
  );
};

module.exports = AssetOverviewReport;