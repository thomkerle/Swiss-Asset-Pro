const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const AssetOverviewReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const overview = {};
  
  let grandTotal = 0;
  let totalAssetsCount = 0;
  let uniqueBanks = new Set();

  const repTitle = safeT(t, 'repOverviewTitle', 'Banken & Kategorien');
  const repSub = safeT(t, 'repOverviewSub', 'Konsolidierte Übersicht der Assets per');

  const processNode = (node, bankName) => {
    if (node.isArchived) return;
    
    if (node.type === 'asset') {
      const val = getAssetValueAtDate(node, targetDate);
      const ac = node.assetClass || 'cash';
      
      if (!overview[ac]) overview[ac] = { total: 0, banks: {} };
      if (!overview[ac].banks[bankName]) overview[ac].banks[bankName] = { total: 0, assets: [] };
      
      overview[ac].total += val;
      overview[ac].banks[bankName].total += val;
      overview[ac].banks[bankName].assets.push({ name: node.name || safeT(t, 'unknown', 'Unbenannt'), val });
      
      grandTotal += val; 
      totalAssetsCount++;
      uniqueBanks.add(bankName);
    }
    
    if (node.children) {
      node.children.forEach(child => processNode(child, bankName));
    }
  };

  data?.banks?.forEach(bank => {
    processNode(bank, bank.name || safeT(t, 'unknown', 'Unbekannte Bank'));
  });

  const getAcName = (ac) => {
    if (!ac) return safeT(t, 'unknown', 'Unbekannt');
    
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
      cash: safeT(t, 'acCash', 'Bargeld / Konto'), 
      fund: safeT(t, 'acFund', 'Fonds / ETFs'), 
      stock: safeT(t, 'acStock', 'Aktien'), 
      crypto: safeT(t, 'acCrypto', 'Krypto'), 
      realestate: safeT(t, 'acRealEstate', 'Immobilien'), 
      mortgage: safeT(t, 'acMortgage', 'Hypotheken'), 
      pension_cash: safeT(t, 'acPensionCash', 'Pensionskasse'), 
      pension_fund: safeT(t, 'acPensionFund', 'Vorsorgefonds (alt)'),
      pension_3a_cash: safeT(t, 'acPension3aCash', '3a Vorsorgekonto'), 
      pension_3a_fund: safeT(t, 'acPension3aFund', '3a Vorsorgefonds')
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

  const sortedClasses = Object.keys(overview).sort((a,b) => overview[b].total - overview[a].total);

  const topClass = sortedClasses.length > 0 ? sortedClasses[0] : null;
  const topClassVal = topClass ? overview[topClass].total : 0;
  const topClassPercent = grandTotal > 0 ? ((topClassVal / grandTotal) * 100).toFixed(1) : 0;

  useEffect(() => {
    const buildReportData = async () => {
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

        const tableHeaders = [
          capitalize(safeT(t, 'assetClass', 'Anlageklasse')),
          capitalize(safeT(t, 'bank', 'Bank / Institut')),
          capitalize(safeT(t, 'name', 'Anlage / Asset')),
          capitalize(safeT(t, 'amount', 'Wert'))
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

        const kpis = [
            { label: safeT(t, 'totalWealth', 'Gesamtvermögen'), value: fCur ? fCur(grandTotal) : grandTotal, sub: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${new Date(targetDate).toLocaleDateString('de-CH')}`, color: '#3b82f6' },
            { label: safeT(t, 'topAssetClass', 'Stärkste Anlageklasse'), value: getAcName(topClass), sub: `${fCur ? fCur(topClassVal) : topClassVal} (${topClassPercent}%)`, color: '#10b981' },
            { label: safeT(t, 'diversification', 'Diversifikation'), value: `${totalAssetsCount} ${safeT(t, 'assets', 'Assets')}`, sub: `${uniqueBanks.size} ${safeT(t, 'banks', 'Banken/Institute')}`, color: '#6366f1' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(chartRef.current, document.documentElement.classList.contains('dark'));
        }

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: `${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')} | ${safeT(t, 'totalVolume', 'Gesamtvolumen')}: ${fCur ? fCur(grandTotal) : grandTotal}`,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.25, 0.30, 0.30, 0.15],
          colAligns: ['left', 'left', 'left', 'right'],
          kpis,
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im AssetOverviewReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 1,
                    title: repTitle,
                    subtitle: `${repSub} ${new Date(targetDate).toLocaleDateString('de-CH')} | ${safeT(t, 'totalVolume', 'Gesamtvolumen')}: ${fCur ? fCur(grandTotal) : grandTotal}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.25, 0.30, 0.30, 0.15],
                    colAligns: ['left', 'left', 'left', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im AssetOverviewReport:", err);
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
  }, [sortedClasses, overview, targetDate, grandTotal, fCur, t, data, repTitle, repSub, topClass, topClassVal, topClassPercent, totalAssetsCount, uniqueBanks.size]);

  if (sortedClasses.length === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12">
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{safeT(t, 'noActiveAssets', 'Keine aktiven Anlagen gefunden.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={chartRef}>
     
      <div className="w-full bg-white dark:bg-transparent">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-1">
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-blue-500"/>
                    {safeT(t, 'totalWealth', 'Gesamtvermögen')}
                </div>
                <div className="w-full" style={{ containerType: 'inline-size' }}>
                    <div className="font-black text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis pb-1" style={{ fontSize: 'clamp(1.125rem, 12cqw, 1.875rem)' }} title={fCur ? fCur(grandTotal) : grandTotal}>
                        {fCur ? fCur(grandTotal) : grandTotal}
                    </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {safeT(t, 'statusAsOf', 'Stichtag:')} {new Date(targetDate).toLocaleDateString('de-CH')}
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Star" size={14} className="text-emerald-500"/>
                    {safeT(t, 'topAssetClass', 'Stärkste Anlageklasse')}
                </div>
                <div className="w-full" style={{ containerType: 'inline-size' }}>
                    <div className="font-black text-emerald-600 dark:text-emerald-400 pb-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 'clamp(1.125rem, 10cqw, 1.5rem)' }} title={getAcName(topClass)}>
                        {getAcName(topClass)}
                    </div>
                </div>
                <div className="text-sm font-bold text-gray-500 mt-1 truncate">
                    {fCur ? fCur(topClassVal) : topClassVal} <span className="opacity-70">({topClassPercent}%)</span>
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-indigo-500 overflow-hidden">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Layers" size={14} className="text-indigo-500"/>
                    {safeT(t, 'diversification', 'Diversifikation')}
                </div>
                <div className="w-full" style={{ containerType: 'inline-size' }}>
                    <div className="font-black text-slate-900 dark:text-white flex items-baseline gap-2 whitespace-nowrap overflow-hidden text-ellipsis pb-1" style={{ fontSize: 'clamp(1.125rem, 12cqw, 1.5rem)' }}>
                        {totalAssetsCount} <span className="text-sm font-medium text-gray-400 uppercase">{safeT(t, 'assets', 'Assets')}</span>
                    </div>
                </div>
                <div className="text-sm font-bold text-indigo-500 dark:text-indigo-400 mt-1 truncate">
                    {safeT(t, 'distributedOver', 'Verteilt auf')} {uniqueBanks.size} {safeT(t, 'banks', 'Banken/Institute')}
                </div>
             </div>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
             <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'distributionByAssetClass', 'Verteilung nach Anlageklasse')}
             >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-indigo-500" /> {safeT(t, 'distributionByAssetClass', 'Verteilung nach Anlageklasse')}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart
                        engine={activeChartEngine}
                        type="doughnut"
                        height="100%"
                        labels={sortedClasses.map(ac => getAcName(ac))}
                        datasets={[{
                            label: safeT(t, 'repOverviewTitle', 'Anlageklassen'),
                            data: sortedClasses.map(ac => overview[ac].total),
                            valueFormatter: fCur
                        }]}
                    />
                </div>
             </div>

             <div 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
                data-pdf-title={safeT(t, 'volumeComparisonAbsolute', 'Volumenvergleich (Absolut)')}
             >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart2" className="text-blue-500" /> {safeT(t, 'volumeComparison', 'Volumenvergleich')}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart
                        engine={activeChartEngine}
                        type="bar"
                        height="100%"
                        labels={sortedClasses.map(ac => getAcName(ac))}
                        datasets={[{
                            label: safeT(t, 'amount', 'Volumen'),
                            data: sortedClasses.map(ac => overview[ac].total),
                            backgroundColor: '#3b82f6',
                            valueFormatter: fCur
                        }]}
                        options={{
                            grid: {
                                bottom: '25%' 
                            },
                            xAxis: {
                                axisLabel: {
                                    interval: 0,
                                    rotate: 45, 
                                    margin: 12
                                }
                            }
                        }}
                    />
                </div>
             </div>
          </div>

          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">
              {safeT(t, 'labelBreakdownByAssetClass', 'Detaillierte Aufschlüsselung')}
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
                        {acPercent}% {safeT(t, 'ofPortfolio', 'vom Portfolio')}
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
                           <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate pr-2">
                             <Icon name="Building" size={14} className="text-gray-400 shrink-0"/> 
                             <span className="truncate" title={bankName}>{bankName}</span>
                           </span>
                           <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg text-sm shrink-0">
                             {fCur ? fCur(bankData.total) : bankData.total}
                           </span>
                        </div>
                        
                        <ul className="text-sm space-y-3 text-gray-600 dark:text-gray-400 flex-1">
                          {bankData.assets
                            .sort((a,b) => b.val - a.val)
                            .map((asset, idx) => (
                             <li key={idx} className="flex justify-between items-center group/item">
                               <span className="truncate pr-4 font-medium flex items-center gap-2" title={asset.name}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 group-hover/item:bg-blue-400 transition-colors shrink-0"></span>
                                  <span className="truncate">{asset.name}</span>
                               </span>
                               <span className="font-mono text-gray-900 dark:text-gray-300 whitespace-nowrap shrink-0">{fCur ? fCur(asset.val) : asset.val}</span>
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