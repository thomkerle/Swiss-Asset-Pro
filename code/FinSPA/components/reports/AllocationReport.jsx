const React = require('react');
const { useEffect, useRef, useState } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const { getAllAssets, getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const AllocationReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];

  // Vertiefte Datenaufbereitung & KPI-Extraktion
  let grandTotal = 0;
  let totalAssetsCount = 0;
  
  const allocData = data.banks.map(b => {
    const assets = getAllAssets([b]).filter(a => !a?.isArchived);
    const val = assets.reduce((s, a) => s + getAssetValueAtDate(a, targetDate), 0);
    grandTotal += val;
    totalAssetsCount += assets.length;
    return { 
        label: b.name || 'Unbekannt', 
        value: val,
        assetCount: assets.length
    };
  })
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value);

  const topBank = allocData.length > 0 ? allocData[0] : null;
  const topBankPercent = (grandTotal > 0 && topBank) ? ((topBank.value / grandTotal) * 100).toFixed(1) : 0;
  const uniqueBanksCount = allocData.length;

  const loadHtml2Canvas = () => {
    return new Promise((resolve) => {
        if (window.html2canvas) return resolve(window.html2canvas);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve(window.html2canvas);
        document.head.appendChild(script);
    });
  };

  // PDF-Export Logik (inkl. modernisiertem KPI & Chart Capture)
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const html2canvas = await loadHtml2Canvas();
        let chartsData = [];
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        const kpiBlock = document.querySelector('.kpi-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        const chartBlock = document.querySelector('.chart-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            const titleFallback = t ? (t('distribution') || 'Verteilung') : 'Verteilung';
            chartsData.push({ title: titleFallback, image: canvas.toDataURL('image/png', 1.0), fit: [360, 260] });
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
          capitalize(t ? (t('bank') || 'Bank / Institut') : 'Bank / Institut'), 
          t ? (t('share') || 'Anteil') : 'Anteil',
          capitalize(t ? (t('amount') || 'Betrag') : 'Betrag')
        ];
        
        const tableBody = allocData.map(d => [
            d.label, 
            `${((d.value / grandTotal) * 100).toFixed(1)}%`,
            fCur(d.value)
        ]);

        const subtitleText = `${t ? (t('reportDate') || 'Stichtag:') : 'Stichtag:'} ${new Date(targetDate).toLocaleDateString('de-CH')} | ${t ? (t('totalVolume') || 'Gesamtvolumen') : 'Gesamtvolumen'}: ${fCur(grandTotal)}`;

        await PdfExportEngine.exportReport({
          title: t ? (t('repAlloc') || 'Allokation nach Banken') : 'Allokation nach Banken',
          subtitle: subtitleText,
          tableHeaders,
          tableBody,
          chartsData,
          data: data 
        });
      } catch (err) { console.error("[FinSPA] PDF-Export Fehler:", err); }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [allocData, grandTotal, targetDate, data, fCur, t]);

  if (grandTotal === 0) {
    return (
      <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
        <ReportHeader 
          title={t ? (t('repAlloc') || 'Allokation nach Banken') : 'Allokation nach Banken'} 
          subtitle={`${t ? (t('reportDate') || 'Stichtag:') : 'Stichtag:'} ${new Date(targetDate).toLocaleDateString('de-CH')}`} 
          isTreeVisible={isTreeVisible} 
          setIsTreeVisible={setIsTreeVisible} 
        />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>{t ? (t('noAssetsFoundDate') || 'Keine Vermögenswerte zum gewählten Stichtag gefunden.') : 'Keine Vermögenswerte zum gewählten Stichtag gefunden.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
        title={t ? (t('repAlloc') || 'Allokation nach Banken') : 'Allokation nach Banken'} 
        subtitle={`${t ? (t('reportDate') || 'Stichtag:') : 'Stichtag:'} ${new Date(targetDate).toLocaleDateString('de-CH')}`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="w-full bg-white dark:bg-transparent">
          
          {/* KPI DASHBOARD ROW */}
          <div className="kpi-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             
             {/* KPI 1: Gesamtkapital */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-blue-500"/>
                    {t ? (t('totalWealth') || 'Gesamtkapital') : 'Gesamtkapital'}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {fCur(grandTotal)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? (t('statusAsOf') || 'Stichtag:') : 'Stichtag:'} {new Date(targetDate).toLocaleDateString('de-CH')}
                </div>
             </div>

             {/* KPI 2: Stärkstes Institut */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="Building" size={14} className="text-emerald-500"/>
                      {t ? (t('topInstitution') || 'Größte Position') : 'Größte Position'}
                    </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white truncate" title={topBank?.label}>
                    {topBank ? topBank.label : '-'}
                </div>
                <div className="text-xs font-bold text-gray-500 mt-2">
                    {topBank ? fCur(topBank.value) : ''} <span className="text-emerald-600 dark:text-emerald-400">({topBankPercent}%)</span>
                </div>
             </div>

             {/* KPI 3: Diversifikation */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-indigo-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Layers" size={14} className="text-indigo-500"/>
                    {t ? (t('diversification') || 'Diversifikation') : 'Diversifikation'}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                    {uniqueBanksCount} 
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? (t('connectedInstitutions') || 'Verbundene Banken/Institute') : 'Verbundene Banken/Institute'}
                </div>
             </div>

             {/* KPI 4: Anzahl Assets */}
             <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500">
                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="Database" size={14} className="text-amber-500"/>
                    {t ? (t('totalAssets') || 'Verwaltete Assets') : 'Verwaltete Assets'}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                    {totalAssetsCount} 
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {t ? (t('activePositions') || 'Aktive Anlagepositionen gesamt') : 'Aktive Anlagepositionen gesamt'}
                </div>
             </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            
            {/* CHART SEITE */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-indigo-500" /> {t ? (t('distribution') || 'Verteilung') : 'Verteilung'}
                </h3>
                <div ref={chartRef} style={{ width: '100%', height: '350px' }}>
                    <UniversalChart
                        engine={activeChartEngine}
                        type="doughnut"
                        height="100%"
                        labels={allocData.map(d => d.label)}
                        datasets={[{
                            label: t ? (t('allocation') || 'Allokation') : 'Allokation',
                            data: allocData.map(d => d.value),
                            valueFormatter: fCur
                        }]}
                    />
                </div>
            </div>

            {/* DETAILS SEITE */}
            <div className="lg:col-span-7 space-y-5">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2 ml-1">
                    <Icon name="List" className="text-slate-500" />
                    {t ? (t('institutionsWeighting') || 'Institute & Gewichtung') : 'Institute & Gewichtung'}
                </h3>
                
                <div className="grid gap-4">
                    {allocData.map((bank, idx) => {
                        const percentage = grandTotal > 0 ? (bank.value / grandTotal) * 100 : 0;
                        return (
                            <div key={idx} className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                            <Icon name="Building" size={16} className="text-gray-400 group-hover:text-blue-500"/>
                                            {bank.label}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 mt-1.5 bg-gray-100 dark:bg-slate-800 w-max px-2 py-0.5 rounded">
                                            <Icon name="Database" size={10}/> {bank.assetCount} {t ? (t('assets') || 'Assets') : 'Assets'}
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="text-lg font-black text-slate-900 dark:text-white font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg">
                                            {fCur(bank.value)}
                                        </div>
                                        <div className="text-blue-600 dark:text-blue-400 text-xs font-bold mt-1">
                                            {percentage.toFixed(1)}% {t ? (t('share') || 'Anteil') : 'Anteil'}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Progress Bar für Gewichtung */}
                                <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                                    <div 
                                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-1000 group-hover:bg-blue-600 dark:group-hover:bg-blue-300" 
                                        style={{ width: `${percentage}%` }}
                                    ></div>
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

module.exports = AllocationReport;