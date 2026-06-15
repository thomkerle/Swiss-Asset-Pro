const React = require('react');
const { useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const TaxReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const year = new Date(dateRange.to).getFullYear();
  const taxDate = `${year}-12-31`;

  const titleText = t ? (t('repTaxTitle') || "Steuerwerte & Vermögensdeklaration") : "Steuerwerte & Vermögensdeklaration";
  const subText = t ? (t('repTaxSub') || "Stichtagsbezogene Auswertung für die Steuererklärung") : "Stichtagsbezogene Auswertung für die Steuererklärung";

  const { grandTotal, catCash, catSecurities, catCrypto, catRealEstate, categories } = useMemo(() => {
      let tTotal = 0;
      let cCash = 0;
      let cSecurities = 0;
      let cCrypto = 0;
      let cRealEstate = 0;

      const cats = {
          cash: { name: t ? t('taxCatCash') || 'Konten & Bargeld' : 'Konten & Bargeld', assets: [], total: 0 },
          securities: { name: t ? t('taxCatSecurities') || 'Wertschriften & Anlagen' : 'Wertschriften & Anlagen', assets: [], total: 0 },
          crypto: { name: t ? t('taxCatCrypto') || 'Krypto-Assets' : 'Krypto-Assets', assets: [], total: 0 },
          realestate: { name: t ? t('taxCatRealEstate') || 'Immobilien & Hypotheken' : 'Immobilien & Hypotheken', assets: [], total: 0 }
      };

      // KUGELSICHERE EXTRAKTION: Wir suchen uns die Assets selbst aus dem Baum, 
      // falls sie nicht als fertiges Array ("activeAssets") reinkommen.
      let assetsToProcess = [];
      if (Array.isArray(activeAssets) && activeAssets.length > 0) {
          assetsToProcess = activeAssets;
      } else if (data && Array.isArray(data.banks)) {
          const extract = (nodes) => {
              nodes.forEach(n => {
                  if (n.type === 'asset' && !n.isArchived) assetsToProcess.push(n);
                  if (Array.isArray(n.children)) extract(n.children);
              });
          };
          extract(data.banks);
      }

      assetsToProcess.forEach(a => {
          if (a.isArchived) return;
          // Pensionen komplett ignorieren (nicht steuerbar vor Bezug)
          if (a.assetClass?.includes('pension')) return;

          const val = getAssetValueAtDate(a, taxDate, assetsToProcess);
          if (val === 0) return;

          tTotal += val;

          let catKey = 'cash';
          if (['stock', 'fund'].includes(a.assetClass)) catKey = 'securities';
          if (a.assetClass === 'crypto') catKey = 'crypto';
          if (['realestate', 'mortgage'].includes(a.assetClass)) catKey = 'realestate';

          cats[catKey].total += val;
          cats[catKey].assets.push({
              name: a.name,
              class: a.assetClass,
              val: val
          });

          if (catKey === 'cash') cCash += val;
          if (catKey === 'securities') cSecurities += val;
          if (catKey === 'crypto') cCrypto += val;
          if (catKey === 'realestate') cRealEstate += val;
      });

      // Sortiere Assets innerhalb der Kategorien
      Object.keys(cats).forEach(k => {
          cats[k].assets.sort((a,b) => b.val - a.val);
      });

      return { 
          grandTotal: tTotal, 
          catCash: cCash, 
          catSecurities: cSecurities, 
          catCrypto: cCrypto, 
          catRealEstate: cRealEstate,
          categories: cats
      };
  }, [activeAssets, data, taxDate, t]);

  const summaryItems = [
      { id: 'cash', title: t ? t('taxCatCash') || 'Konten & Bargeld' : 'Konten & Bargeld', icon: 'DollarSign', color: 'emerald', value: catCash, desc: t ? t('taxDescCash') || 'Steuerwert der Cash-Bestände' : 'Steuerwert der Cash-Bestände' },
      { id: 'sec', title: t ? t('taxCatSecurities') || 'Wertschriften & Anlagen' : 'Wertschriften & Anlagen', icon: 'TrendingUp', color: 'blue', value: catSecurities, desc: t ? t('taxDescSecurities') || 'Steuerwert Depotbestände' : 'Steuerwert Depotbestände' },
      { id: 'crypto', title: t ? t('taxCatCrypto') || 'Krypto-Assets' : 'Krypto-Assets', icon: 'Bitcoin', color: 'purple', value: catCrypto, desc: t ? t('taxDescCrypto') || 'Steuerwert der Wallets' : 'Steuerwert der Wallets' }
  ];

  if (catRealEstate !== 0) {
      summaryItems.push({ id: 're', title: t ? t('taxCatRealEstate') || 'Immobilien & Hypotheken' : 'Immobilien & Hypotheken', icon: 'Home', color: 'amber', value: catRealEstate, desc: t ? t('taxDescRealEstate') || 'Steuerwert abzüglich Schulden' : 'Steuerwert abzüglich Schulden' });
  }

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
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        const captureBlock = async (selector, titleFallback = '') => {
            const el = document.querySelector(selector);
            if (el) {
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0) });
            }
        };

        await captureBlock('.kpi-tax-export-block', ''); 
        
        if (chartRef.current) {
            const chartDiv = chartRef.current.querySelector('.chart-export-block');
            if (chartDiv) {
                const canvas = await html2canvas(chartDiv, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
                chartsData.push({ title: t ? t('taxTitleComposition') || 'Zusammensetzung der Steuerwerte' : 'Zusammensetzung der Steuerwerte', image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
            }
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
            capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'), 
            capitalize(t ? t('colAssetPosition') || 'Asset / Position' : 'Asset / Position'), 
            t ? t('taxValue') || 'Steuerwert' : 'Steuerwert'
        ];
        
        const tableBody = [];
        
        Object.keys(categories).forEach(catKey => {
            const catData = categories[catKey];
            if (catData.total !== 0) {
                tableBody.push([
                    { text: catData.name.toUpperCase(), bold: true }, 
                    '', 
                    { text: fCur(catData.total), bold: true }
                ]);
                
                catData.assets.forEach(a => {
                    tableBody.push(['', a.name, fCur(a.val)]);
                });
                tableBody.push(['', '', '']);
            }
        });

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subText} | Stichtag: 31.12.${year}`,
          tableHeaders,
          tableBody,
          chartsData,
          data: data
        });
      } catch (err) { console.error("[FinSPA] PDF Export Error im TaxReport:", err); }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [categories, year, fCur, t, titleText, subText, data]);

  if (grandTotal === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <ReportHeader 
          title={titleText} 
          subtitle={`${subText} (31.12.${year})`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? t('noTaxableAssetsFound') || 'Keine steuerbaren Vermögenswerte am gewählten Stichtag gefunden.' : 'Keine steuerbaren Vermögenswerte am gewählten Stichtag gefunden.'}</p>
        </div>
      </div>
    );
  }

  const chartLabels = summaryItems.filter(item => item.value !== 0).map(item => item.title);
  const chartData = summaryItems.filter(item => item.value !== 0).map(item => item.value);
  const chartColors = summaryItems.filter(item => item.value !== 0).map(item => {
      if (item.color === 'emerald') return '#10b981';
      if (item.color === 'blue') return '#3b82f6';
      if (item.color === 'purple') return '#a855f7';
      if (item.color === 'amber') return '#f59e0b';
      return '#64748b';
  });

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
        title={titleText} 
        subtitle={`${subText} (31.12.${year})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      
      <div className="w-full bg-white dark:bg-transparent">

          <div className="kpi-tax-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             {/* MAIN KPI */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 xl:col-span-4 flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
                 <div>
                     <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Landmark" size={14} className="text-blue-500"/>
                        {t ? t('taxableTotalValue') || 'Steuerbarer Gesamtwert' : 'Steuerbarer Gesamtwert'}
                     </div>
                     <div className="text-4xl font-black text-slate-900 dark:text-white">
                        {fCur(grandTotal)}
                     </div>
                 </div>
                 <div className="mt-4 md:mt-0 bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 px-6 py-3 rounded-xl shadow-sm text-center">
                     <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t ? t('declarationDate') || 'Deklarations-Stichtag' : 'Deklarations-Stichtag'}</div>
                     <div className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono mt-1">31.12.{year}</div>
                 </div>
             </div>

             {/* SUB KPIs */}
             {summaryItems.map(item => (
                 <div key={item.id} className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-${item.color}-500 relative overflow-hidden`}>
                     <div className="absolute top-0 right-0 p-4 opacity-5">
                         <Icon name={item.icon} size={64} className={`text-${item.color}-500`} />
                     </div>
                     <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                         <Icon name={item.icon} size={14} className={`text-${item.color}-500`}/>
                         {item.title}
                     </div>
                     <div className="text-2xl font-black text-slate-900 dark:text-white relative z-10">
                         {fCur(item.value)}
                     </div>
                     <div className="text-xs text-gray-400 mt-2 relative z-10 font-medium">
                         {item.desc}
                     </div>
                 </div>
             ))}
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
             <Icon name="Info" size={14} className="text-blue-500" />
             {t ? t('taxDisclaimerPension') || 'Die 3. Säule (3a) und die Pensionskasse (2. Säule) sind in der Regel vom steuerbaren Vermögen ausgenommen und werden hier nicht aufgeführt.' : 'Die 3. Säule (3a) und die Pensionskasse (2. Säule) sind in der Regel vom steuerbaren Vermögen ausgenommen und werden hier nicht aufgeführt.'}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10" ref={chartRef}>
            
            {/* CHART */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8" data-pdf-title={t ? t('taxTitleDistribution') || 'Steuerwert-Verteilung' : 'Steuerwert-Verteilung'}>
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-indigo-500" /> {t ? t('taxTitleComposition') || 'Zusammensetzung der Steuerwerte' : 'Zusammensetzung der Steuerwerte'}
                </h3>
                <div style={{ width: '100%', height: '350px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="doughnut"
                        labels={chartLabels}
                        datasets={[{
                            label: t ? t('taxValue') || 'Steuerwert' : 'Steuerwert',
                            data: chartData,
                            backgroundColor: chartColors,
                            valueFormatter: fCur
                        }]}
                        height="100%"
                    />
                </div>
            </div>

            {/* DETAILS SEITE */}
            <div className="lg:col-span-7 space-y-5">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2 ml-1">
                    <Icon name="List" className="text-slate-500" />
                    {t ? t('taxDetailedBreakdown') || 'Detaillierte Steueraufstellung nach Kategorie' : 'Detaillierte Steueraufstellung nach Kategorie'}
                </h3>
                
                <div className="grid gap-4">
                    {Object.keys(categories).map((catKey) => {
                        const cat = categories[catKey];
                        if (cat.total === 0) return null;
                        
                        let iconName = 'DollarSign';
                        let badgeColor = 'emerald';
                        if (catKey === 'securities') { iconName = 'TrendingUp'; badgeColor = 'blue'; }
                        if (catKey === 'crypto') { iconName = 'Bitcoin'; badgeColor = 'purple'; }
                        if (catKey === 'realestate') { iconName = 'Home'; badgeColor = 'amber'; }

                        return (
                            <div key={catKey} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Header */}
                                <div className="p-4 md:p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                                    <div className="flex justify-between items-center">
                                        <div className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                            <div className={`p-2 bg-${badgeColor}-100 dark:bg-${badgeColor}-900/30 text-${badgeColor}-600 dark:text-${badgeColor}-400 rounded-lg`}>
                                                <Icon name={iconName} size={18}/>
                                            </div>
                                            {cat.name}
                                        </div>
                                        <div className="font-mono text-lg font-black text-slate-800 dark:text-slate-200">
                                            {fCur(cat.total)}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Asset Detail-Liste */}
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {cat.assets.map((a, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3 pl-5 text-gray-700 dark:text-gray-300 w-full">
                                                        <div className="flex items-center font-medium">
                                                            <div className={`w-1.5 h-1.5 rounded-full mr-3 bg-${badgeColor}-400`}></div>
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
    </div>
  );
};

module.exports = TaxReport;