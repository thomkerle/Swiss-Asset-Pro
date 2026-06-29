const React = require('react');
const { useEffect, useRef } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getNormalizedBookings } = safeRequire('../../../data/DataEngine.jsx') || window.DataEngine || {};

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t, data }) => {
  const chartRef = useRef(null);
  
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  
  const expenses = {};
  const incomes = {};
  
  let totalExpenses = 0;
  let totalIncomes = 0;
  let wealthShiftsOut = 0; 
  let wealthShiftsIn = 0;  

  const normBookings = getNormalizedBookings ? getNormalizedBookings(activeAssets) : [];
  const validBookings = normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to);

  validBookings.forEach(bk => {
      const val = bk._baseValue; 
      let cat = bk.category || (t ? t('catUncategorized') || 'Unkategorisiert' : 'Unkategorisiert');

      // Komplett ignorieren (illiquide Bewegungen ohne Cashflow-Relevanz)
      if (bk.type === 'ignore') return; 

      // GELD KOMMT REIN
      if (bk.type === 'income') {
          // Verkäufe gelten als Einnahmen / Kapitalrückfluss und werden sauber umbenannt
          const isSell = bk.normType === 'Verkauf' || (bk.subCategory || '').toLowerCase() === 'verkauf';
          if (isSell && (cat === 'Unkategorisiert' || cat === 'Verkauf')) {
              cat = t ? t('catDivestment') || 'Kapitalrückfluss (Verkauf)' : 'Kapitalrückfluss (Verkauf)';
          }
          incomes[cat] = (incomes[cat] || 0) + val;
          totalIncomes += val;
      } 
      // GELD GEHT RAUS
      else if (bk.type === 'expense') {
          // Käufe als Investitionen deklarieren
          const isBuy = bk.normType === 'Kauf' || (bk.subCategory || '').toLowerCase() === 'kauf';
          if (isBuy && (cat === 'Unkategorisiert' || cat === 'Kauf')) {
              cat = t ? t('catInvestment') || 'Investitionen (Kauf)' : 'Investitionen (Kauf)';
          }
          expenses[cat] = (expenses[cat] || 0) + val; 
          totalExpenses += val;
      }
      // VERMÖGENSVERSCHIEBUNG (Umbuchungen & Dividenden-Gegenbuchungen auf dem Cash-Konto)
      else if (bk.type === 'shift') {
          const isExpenseType = ['Auszahlung', 'Kauf', 'Abzahlung'].includes(bk.normType);
          if (isExpenseType) {
              wealthShiftsOut += val;
          } else {
              wealthShiftsIn += val;
          }
      }
  });
  
  const sortedExpCategories = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);
  const sortedIncCategories = Object.keys(incomes).sort((a, b) => incomes[b] - incomes[a]);

  const cashflow = totalIncomes - totalExpenses;
  const savingsRate = totalIncomes > 0 ? (cashflow / totalIncomes) * 100 : 0;

  const chartColors = [
      '#4f46e5', '#7c3aed', '#c026d3', '#e11d48', '#ea580c', '#d97706', 
      '#65a30d', '#059669', '#0d9488', '#0284c7', '#2563eb', '#475569'
  ];

  const repTitle = t ? t('repBookAnaTitle') || 'Buchungsanalyse & Cashflow' : 'Buchungsanalyse & Cashflow';
  const repSub = t ? t('repBookAnaSub') || 'Gegenüberstellung von echten Einnahmen und Ausgaben' : 'Gegenüberstellung von echten Einnahmen und Ausgaben';

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

        const kpiBlock = document.querySelector('.kpi-booking-export-block');
        if (kpiBlock) {
            const canvas = await html2canvas(kpiBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ title: '', image: canvas.toDataURL('image/png', 1.0), width: 760 });
        }

        const chartBlock = document.querySelector('.chart-booking-export-block');
        if (chartBlock) {
            const canvas = await html2canvas(chartBlock, { scale: 2, backgroundColor: bgColor, useCORS: true, logging: false });
            chartsData.push({ 
                title: t ? t('expenseDistribution') || 'Ausgabenverteilung' : 'Ausgabenverteilung', 
                image: canvas.toDataURL('image/png', 1.0), 
                fit: [360, 260] 
            });
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
            capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'), 
            capitalize(t ? t('amount') || 'Betrag' : 'Betrag')
        ];
        
        const tableBody = [];
        
        if (sortedIncCategories.length > 0) {
            tableBody.push([t ? t('incomesUppercase') || 'EINNAHMEN' : 'EINNAHMEN', fCur(totalIncomes)]);
            sortedIncCategories.forEach(cat => tableBody.push([`   - ${cat}`, fCur(incomes[cat])]));
            tableBody.push(['', '']);
        }

        if (sortedExpCategories.length > 0) {
            tableBody.push([t ? t('expensesUppercase') || 'AUSGABEN' : 'AUSGABEN', fCur(totalExpenses)]);
            sortedExpCategories.forEach(cat => tableBody.push([`   - ${cat}`, fCur(expenses[cat])]));
        }

        return { chartsData, tableHeaders, tableBody };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfExportEngine) return;
        const { chartsData, tableHeaders, tableBody } = await buildReportData();

        await PdfExportEngine.exportReport({
          title: repTitle,
          subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} bis ${new Date(dateRange.to).toLocaleDateString('de-CH')}) | ${t ? t('labelSavingsRate') || 'Sparquote' : 'Sparquote'}: ${savingsRate.toFixed(1)}%`,
          tableHeaders,
          tableBody,
          chartsData,
          data: data || activeAssets
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im BookingAnalysisReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody } = await buildReportData();
                resolve({
                    order: 7, 
                    title: repTitle,
                    subtitle: `${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} bis ${new Date(dateRange.to).toLocaleDateString('de-CH')}) | ${t ? t('labelSavingsRate') || 'Sparquote' : 'Sparquote'}: ${savingsRate.toFixed(1)}%`,
                    tableHeaders,
                    tableBody,
                    chartsData
                });
            } catch (err) {
                console.error("[FinSPA] Batch Export Error im BookingAnalysisReport:", err);
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
  }, [sortedExpCategories, sortedIncCategories, expenses, incomes, dateRange, fCur, t, totalIncomes, totalExpenses, savingsRate, repTitle, repSub, data, activeAssets]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
      <ReportHeader 
        title={repTitle} 
        subtitle={`${repSub} (${new Date(dateRange.from).toLocaleDateString('de-CH')} - ${new Date(dateRange.to).toLocaleDateString('de-CH')})`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      <div className="w-full bg-white dark:bg-transparent">

          <div className="kpi-booking-export-block grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
             <div className="bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="TrendingUp" size={48} className="text-emerald-600" />
                </div>
                <div className="text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="PlusCircle" size={14} />
                    {t ? t('labelIncomesReal') || 'Echte Einnahmen' : 'Echte Einnahmen'}
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 relative z-10">
                    {fCur(totalIncomes)}
                </div>
             </div>

             <div className="bg-rose-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="TrendingDown" size={48} className="text-rose-600" />
                </div>
                <div className="text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <Icon name="Trash2" size={14} />
                    {t ? t('labelExpensesReal') || 'Echte Ausgaben' : 'Echte Ausgaben'}
                </div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-400 relative z-10">
                    {fCur(totalExpenses)}
                </div>
             </div>

             <div className={`p-6 rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 cashflow >= 0 
                    ? 'bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 border-b-blue-600' 
                    : 'bg-orange-50 dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50 border-b-orange-500'
             }`}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 text-slate-500 dark:text-slate-400">
                    <Icon name="Activity" size={14} />
                    {t ? t('labelNetCashflow') || 'Netto Cashflow' : 'Netto Cashflow'}
                </div>
                <div className={`text-2xl font-black relative z-10 ${cashflow >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {cashflow > 0 ? '+' : ''}{fCur(cashflow)}
                </div>
             </div>

             <div className={`p-6 rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
                 savingsRate >= 0 
                    ? 'bg-purple-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 border-b-purple-600' 
                    : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 border-b-gray-400'
             }`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="PieChart" size={48} className={savingsRate >= 0 ? "text-purple-600" : "text-gray-500"} />
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10 ${savingsRate >= 0 ? 'text-purple-800 dark:text-purple-300' : 'text-gray-500'}`}>
                    <Icon name="Target" size={14} />
                    {t ? t('labelSavingsRate') || 'Sparquote' : 'Sparquote'}
                </div>
                <div className={`text-2xl font-black relative z-10 ${savingsRate >= 0 ? 'text-purple-700 dark:text-purple-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {savingsRate.toFixed(1)} %
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-booking-export-block self-start sticky top-8">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-rose-500" /> {t ? t('expenseBreakdown') || 'Ausgabenverteilung' : 'Ausgabenverteilung'}
                </h3>
                {sortedExpCategories.length > 0 ? (
                    <div ref={chartRef} style={{ width: '100%', height: '350px' }}>
                        <UniversalChart 
                            engine={activeChartEngine}
                            type="doughnut"
                            labels={sortedExpCategories}
                            datasets={[{
                                label: t ? t('amount') || 'Betrag' : 'Betrag',
                                data: sortedExpCategories.map(cat => expenses[cat]),
                                backgroundColor: chartColors,
                                valueFormatter: fCur
                            }]}
                            height="100%"
                        />
                    </div>
                ) : (
                    <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 text-sm">
                        <Icon name="Activity" size={32} className="mb-3 opacity-30"/>
                        {t ? t('noExpensesPresent') || 'Keine Ausgaben vorhanden' : 'Keine Ausgaben vorhanden'}
                    </div>
                )}
            </div>

            <div className="lg:col-span-7 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-emerald-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="TrendingUp" className="text-emerald-500" />
                            {t ? t('labelIncomesReal') || 'Einnahmen' : 'Einnahmen'}
                        </div>
                    </div>
                    <div className="p-0">
                        {sortedIncCategories.length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {sortedIncCategories.map((cat, i) => {
                                        const percentage = totalIncomes > 0 ? (incomes[cat] / totalIncomes) * 100 : 0;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-4 pl-5 text-gray-700 dark:text-gray-200 w-full">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="font-medium">{cat}</span>
                                                        <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                </td>
                                                <td className="p-4 pr-5 text-right align-middle">
                                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                        {fCur(incomes[cat])}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {t ? t('noIncomesPeriod') || 'Keine Einnahmen in dieser Periode.' : 'Keine Einnahmen in dieser Periode.'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-rose-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Icon name="TrendingDown" className="text-rose-500" />
                            {t ? t('labelExpensesReal') || 'Ausgaben' : 'Ausgaben'}
                        </div>
                    </div>
                    <div className="p-0">
                        {sortedExpCategories.length > 0 ? (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {sortedExpCategories.map((cat, i) => {
                                        const percentage = totalExpenses > 0 ? (expenses[cat] / totalExpenses) * 100 : 0;
                                        const barColor = chartColors[i % chartColors.length] || '#ef4444';
                                        
                                        return (
                                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-4 pl-5 text-gray-700 dark:text-gray-200 w-full">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="font-medium">{cat}</span>
                                                        <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: barColor }}></div>
                                                    </div>
                                                </td>
                                                <td className="p-4 pr-5 text-right align-middle">
                                                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                                        {fCur(expenses[cat])}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {t ? t('noExpensesPeriod') || 'Keine Ausgaben in dieser Periode.' : 'Keine Ausgaben in dieser Periode.'}
                            </div>
                        )}
                    </div>
                </div>

                {(wealthShiftsIn > 0 || wealthShiftsOut > 0) && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-inner mt-4">
                        <div className="max-w-xl">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2 text-sm">
                                <Icon name="RefreshCw" className="text-blue-500" /> 
                                {t ? t('labelWealthShifts') || 'Vermögensverschiebungen' : 'Vermögensverschiebungen'}
                            </h4>
                            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                {t ? t('descWealthShifts') || 'Reine Umbuchungen zwischen Konten verändern dein Nettovermögen nicht und sind aus dem Cashflow ausgeklammert.' : 'Reine Umbuchungen zwischen Konten verändern dein Nettovermögen nicht und sind aus dem Cashflow ausgeklammert.'}
                            </p>
                        </div>
                        <div className="flex gap-4 shrink-0 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                            <div className="text-right flex-1 md:flex-none">
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                                    {t ? t('investedShort') || 'Verschoben' : 'Verschoben'}
                                </div>
                                <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{fCur(wealthShiftsOut)}</div>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div className="text-right flex-1 md:flex-none">
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                                    {t ? t('liquidatedShort') || 'Erhalten' : 'Erhalten'}
                                </div>
                                <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{fCur(wealthShiftsIn)}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

module.exports = BookingAnalysisReport;