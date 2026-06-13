const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const UniversalChart = require('../../api/UniversalChart.jsx');
const { getNormalizedBookings } = require('../../../data/DataEngine.jsx');
const Icon = require('../Icons.jsx');

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  
  // Da dieser Report data nicht direkt injiziert bekommt, greifen wir via window darauf zu oder nutzen 'echarts' als Standard
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || 'echarts';
  
  const expenses = {};
  const incomes = {};
  
  let totalExpenses = 0;
  let totalIncomes = 0;
  let wealthShiftsOut = 0; // Käufe, Umbuchungen (Ausgang), Abzahlungen
  let wealthShiftsIn = 0;  // Verkäufe, Umbuchungen (Eingang), Schulderhöhung
  let bookingCount = 0;

  const normBookings = getNormalizedBookings(activeAssets);

  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      bookingCount++;
      const val = bk._baseValue; 
      const cat = bk.normCategory || (t ? t('catUncategorized') || 'Unkategorisiert' : 'Unkategorisiert');
      
      // Prüfen, ob es sich um eine Umbuchung handelt (per Name oder Kategorie)
      const isTransfer = cat.toLowerCase().includes('umbuchung') || cat.toLowerCase().includes('transfer');

      if (bk.normType === 'Auszahlung') { 
          if (isTransfer) {
              wealthShiftsOut += val;
          } else {
              expenses[cat] = (expenses[cat] || 0) + val; 
              totalExpenses += val;
          }
      } else if (bk.normType === 'Einzahlung') {
          if (isTransfer) {
              wealthShiftsIn += val;
          } else {
              incomes[cat] = (incomes[cat] || 0) + val;
              totalIncomes += val;
          }
      } else if (['Kauf', 'Abzahlung'].includes(bk.normType)) {
          // Investitionen und Amortisationen sind keine Ausgaben, sondern Vermögensverschiebungen
          wealthShiftsOut += val;
      } else if (['Verkauf', 'Schulderhöhung'].includes(bk.normType)) {
          // Liquidierungen sind keine echten Einnahmen, sondern Verschiebungen
          wealthShiftsIn += val;
      }
  });
  
  const sortedExpCategories = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);
  const sortedIncCategories = Object.keys(incomes).sort((a, b) => incomes[b] - incomes[a]);

  const cashflow = totalIncomes - totalExpenses;
  const savingsRate = totalIncomes > 0 ? (cashflow / totalIncomes) * 100 : 0;

  // Modernes Farb-Array für die Diagramme
  const chartColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'), capitalize(t ? t('amount') || 'Betrag' : 'Betrag')];
        const tableBody = sortedExpCategories.map(cat => [cat, fCur(expenses[cat])]);

        await PdfExportEngine.exportReport({
          title: t ? t('repBookAnaTitle') || 'Buchungsanalyse' : 'Buchungsanalyse',
          subtitle: `${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to} | Einnahmen: ${fCur(totalIncomes)} | Ausgaben: ${fCur(totalExpenses)} | Sparquote: ${savingsRate.toFixed(1)}%`,
          tableHeaders,
          tableBody,
          chartBase64,
	  data: data
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im BookingAnalysisReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [sortedExpCategories, expenses, bookingCount, dateRange, fCur, t, totalIncomes, totalExpenses, savingsRate]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repBookAnaTitle') : 'Buchungsanalyse & Cashflow'} 
        subtitle={`${t ? t('repBookAnaSub') : 'Gegenüberstellung von echten Einnahmen und Ausgaben'} (${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
         {/* Einnahmen */}
         <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                   <Icon name="TrendingUp" size={20} />
               </div>
               <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t ? t('labelIncomesReal') || 'Echte Einnahmen' : 'Echte Einnahmen'}</div>
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(totalIncomes)}</div>
         </div>
         
         {/* Ausgaben */}
         <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400">
                   <Icon name="TrendingDown" size={20} />
               </div>
               <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t ? t('labelExpensesReal') || 'Echte Ausgaben' : 'Echte Ausgaben'}</div>
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{fCur(totalExpenses)}</div>
         </div>

         {/* Cashflow */}
         <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                   <Icon name="Activity" size={20} />
               </div>
               <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t ? t('labelNetCashflow') || 'Netto Cashflow' : 'Netto Cashflow'}</div>
            </div>
            <div className={`text-2xl font-black ${cashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
               {cashflow > 0 ? '+' : ''}{fCur(cashflow)}
            </div>
         </div>

         {/* Sparquote */}
         <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><Icon name="PieChart" size={80} /></div>
            <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                   <Icon name="PieChart" size={20} />
               </div>
               <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t ? t('labelSavingsRate') || 'Sparquote' : 'Sparquote'}</div>
            </div>
            <div className={`text-2xl font-black relative z-10 ${savingsRate > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-slate-100'}`}>
               {savingsRate.toFixed(1)} %
            </div>
         </div>
      </div>

      {sortedExpCategories.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* DOUGHNUT CHART (Verteilung) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 self-start mb-4 flex items-center gap-2">
                <Icon name="PieChart" className="text-indigo-500" /> {t ? t('expenseBreakdown') || 'Ausgabenverteilung' : 'Ausgabenverteilung'}
            </h3>
            <div className="w-full h-[320px]">
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
          </div>

          {/* BAR CHART (Rangliste) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 self-start mb-4 flex items-center gap-2">
                <Icon name="BarChart" className="text-blue-500" /> {t ? t('topExpenses') || 'Top Ausgabenkategorien' : 'Top Ausgabenkategorien'}
            </h3>
            <div ref={chartRef} className="w-full flex-1" style={{ minHeight: `${Math.max(320, sortedExpCategories.length * 40)}px` }}>
              <UniversalChart 
                engine={activeChartEngine}
                type="bar"
                horizontal={true}
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
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-500 mb-6">
           <Icon name="Activity" size={48} className="mx-auto mb-4 opacity-30" />
           {t ? t('noDataAvailable') || 'Keine echten Ausgaben im gewählten Zeitraum vorhanden.' : 'Keine echten Ausgaben im gewählten Zeitraum vorhanden.'}
        </div>
      )}

      {/* INFO: VERMÖGENSVERSCHIEBUNGEN */}
      {(wealthShiftsIn > 0 || wealthShiftsOut > 0) && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-inner">
              <div className="max-w-xl">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2 text-sm">
                      <Icon name="RefreshCw" className="text-blue-500" /> 
                      {t ? t('labelWealthShifts') || 'Vermögensverschiebungen (Geld-Transfers & Investitionen)' : 'Vermögensverschiebungen'}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {t ? t('descWealthShifts') || 'Umbuchungen zwischen eigenen Konten, Investitionen (z.B. Säule 3a, Aktienkäufe) und Amortisationen sind hier ausgeklammert. Sie verändern dein Nettovermögen nicht, sondern verschieben es lediglich.' : 'Umbuchungen zwischen eigenen Konten, Investitionen (z.B. Säule 3a, Aktienkäufe) und Amortisationen sind hier ausgeklammert.'}
                  </p>
              </div>
              <div className="flex gap-4 sm:gap-6 shrink-0 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                  <div className="text-right flex-1 md:flex-none">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t ? t('shiftsOut') || 'Investiert / Überwiesen' : 'Investiert / Überwiesen'}</div>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{fCur(wealthShiftsOut)}</div>
                  </div>
                  <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                  <div className="text-right flex-1 md:flex-none">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t ? t('shiftsIn') || 'Liquidation / Eingang' : 'Liquidation / Eingang'}</div>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{fCur(wealthShiftsIn)}</div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

module.exports = BookingAnalysisReport;