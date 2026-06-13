const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const { getAllAssets, getAssetValueAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const AllocationReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];

  // Vertiefte Datenaufbereitung
  let grandTotal = 0;
  const allocData = data.banks.map(b => {
    const assets = getAllAssets([b]).filter(a => !a?.isArchived);
    const val = assets.reduce((s, a) => s + getAssetValueAtDate(a, targetDate), 0);
    grandTotal += val;
    return { 
        label: b.name, 
        value: val,
        assetCount: assets.length
    };
  })
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value);

  // PDF-Export Logik (inkl. Fix für Schablonen)
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;

        let chartBase64 = null;
        if (chartRef.current) {
            const plotlyNode = chartRef.current.querySelector('.js-plotly-plot');
            if (plotlyNode && window.Plotly) {
                chartBase64 = await window.Plotly.toImage(plotlyNode, { format: 'png', width: 800, height: 400 });
            } else {
                const canvas = chartRef.current.querySelector('canvas');
                if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
            }
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

        await PdfExportEngine.exportReport({
          title: t ? (t('repAlloc') || 'Allokation nach Banken') : 'Allokation nach Banken',
          subtitle: `${t ? (t('reportDate') || 'Stichtag:') : 'Stichtag:'} ${targetDate} | ${t ? (t('totalVolume') || 'Gesamtvolumen') : 'Gesamtvolumen'}: ${fCur(grandTotal)}`,
          tableHeaders,
          tableBody,
          chartBase64,
          data: data // Übergabe für PDF-Schablonen
        });
      } catch (err) { console.error("[FinSPA] PDF-Export Fehler:", err); }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [allocData, grandTotal, targetDate, data, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      {/* HEADER BEREICH */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-gray-200 dark:border-slate-800 pb-6 gap-4">
        <div className="flex-1">
          <ReportHeader 
            title={t ? t('repAlloc') : 'Allokation nach Banken'} 
            subtitle={`${t ? t('reportDate') : 'Stichtag:'} ${targetDate}`} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
          />
        </div>
        
        <div className="bg-slate-900 dark:bg-blue-600 text-white p-5 rounded-2xl shadow-xl shrink-0 min-w-[250px] border border-slate-700 dark:border-blue-500">
           <div className="text-slate-400 dark:text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
             <Icon name="Shield" size={12}/> {t ? t('totalWealth') : 'Gesamtvermögen'}
           </div>
           <div className="text-3xl font-black font-mono">{fCur(grandTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CHART SEITE */}
        <div className="lg:col-span-5">
            <div className="sticky top-8 p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Icon name="PieChart" /> {t ? t('distribution') : 'Verteilung'}
                </h3>
                <div ref={chartRef} className="w-full">
                <UniversalChart
                    engine={activeChartEngine}
                    type="doughnut"
                    height="350px"
                    labels={allocData.map(d => d.label)}
                    datasets={[{
                    label: t ? t('allocation') : 'Allokation',
                    data: allocData.map(d => d.value)
                    }]}
                />
                </div>
            </div>
        </div>

        {/* DETAILS SEITE */}
        <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 ml-2">
                {t ? t('institutionsWeighting') : 'Institute & Gewichtung'}
            </h3>
            {allocData.map((bank, idx) => {
                const percentage = grandTotal > 0 ? (bank.value / grandTotal) * 100 : 0;
                return (
                    <div key={idx} className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                                    {bank.label}
                                </div>
                                <div className="text-xs text-gray-400 font-medium flex items-center gap-2 mt-1">
                                    <Icon name="Layers" size={12}/> {bank.assetCount} {t ? t('assets') : 'Assets'}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                    {fCur(bank.value)}
                                </div>
                                <div className="text-blue-600 dark:text-blue-400 text-xs font-black">
                                    {percentage.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                        
                        {/* Progress Bar für Klumpenrisiko-Check */}
                        <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-1000" 
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

module.exports = AllocationReport;