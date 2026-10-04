const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || window.DataEngine || {};

const { getNormalizedBookings = () => [], getAllAssets = () => [] } = DataEngine;
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t, data }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const targetAssets = useMemo(() => {
      if (activeAssets && activeAssets.length > 0) return activeAssets;
      return getAllAssets && data?.banks ? getAllAssets(data.banks) : [];
  }, [activeAssets, data?.banks]);

  const {
      expenses,
      incomes,
      totalExpenses,
      totalIncomes,
      wealthShiftsOut,
      wealthShiftsIn,
      sortedExpCategories,
      sortedIncCategories,
      cashflow,
      savingsRate,
      monthlyTimeline
  } = useMemo(() => {
      const expMap = {};
      const incMap = {};
      let totExp = 0;
      let totInc = 0;
      let shiftsOut = 0;
      let shiftsIn = 0;

      const normBookings = getNormalizedBookings ? getNormalizedBookings(targetAssets) : [];
      const valid = normBookings.filter(bk => bk.date && bk.date >= dateRange.from && bk.date <= dateRange.to);

      valid.forEach(bk => {
          const val = Number(bk._baseValue || 0);
          let cat = bk.category || safeT(t, 'catUncategorized', 'Unkategorisiert');

          if (bk.type === 'ignore') return;

          if (bk.type === 'income') {
              const isSell = bk.normType === 'Verkauf' || (bk.subCategory || '').toLowerCase() === 'verkauf';
              if (isSell && (cat === 'Unkategorisiert' || cat === 'Verkauf')) {
                  cat = safeT(t, 'catDivestment', 'Kapitalrückfluss (Verkauf)');
              }
              incMap[cat] = (incMap[cat] || 0) + val;
              totInc += val;
          } 
          else if (bk.type === 'expense') {
              const isBuy = bk.normType === 'Kauf' || (bk.subCategory || '').toLowerCase() === 'kauf';
              if (isBuy && (cat === 'Unkategorisiert' || cat === 'Kauf')) {
                  cat = safeT(t, 'catInvestment', 'Investitionen (Kauf)');
              }
              expMap[cat] = (expMap[cat] || 0) + val; 
              totExp += val;
          }
          else if (bk.type === 'shift') {
              const isExpenseType = ['Auszahlung', 'Kauf', 'Abzahlung'].includes(bk.normType);
              if (isExpenseType) {
                  shiftsOut += val;
              } else {
                  shiftsIn += val;
              }
          }
      });

      const sortedExp = Object.keys(expMap).sort((a, b) => expMap[b] - expMap[a]);
      const sortedInc = Object.keys(incMap).sort((a, b) => incMap[b] - incMap[a]);

      const net = totInc - totExp;
      const rate = totInc > 0 ? (net / totInc) * 100 : 0;

      const startStr = (dateRange?.from || `${new Date().getFullYear()}-01-01`).substring(0, 7);
      const endStr = (dateRange?.to || new Date().toISOString().split('T')[0]).substring(0, 7);

      let [sY, sM] = startStr.split('-').map(Number);
      const [eY, eM] = endStr.split('-').map(Number);

      const mData = {};
      while (sY < eY || (sY === eY && sM <= eM)) {
          const mKey = `${sY}-${String(sM).padStart(2, '0')}`;
          mData[mKey] = { key: mKey, income: 0, expense: 0, net: 0 };
          sM++;
          if (sM > 12) {
              sM = 1;
              sY++;
          }
      }

      valid.forEach(bk => {
          if (!bk.date || bk.type === 'ignore' || bk.type === 'shift') return;
          const mKey = bk.date.substring(0, 7);
          if (!mData[mKey]) return;

          const val = Number(bk._baseValue || 0);
          if (bk.type === 'income') {
              mData[mKey].income += val;
          } else if (bk.type === 'expense') {
              mData[mKey].expense += val;
          }
      });

      const timelineList = Object.keys(mData).sort().map(k => {
          const item = mData[k];
          item.net = item.income - item.expense;
          const [y, m] = k.split('-');
          item.label = `${m}.${y.slice(-2)}`;
          return item;
      });

      return {
          expenses: expMap,
          incomes: incMap,
          totalExpenses: totExp,
          totalIncomes: totInc,
          wealthShiftsOut: shiftsOut,
          wealthShiftsIn: shiftsIn,
          sortedExpCategories: sortedExp,
          sortedIncCategories: sortedInc,
          cashflow: net,
          savingsRate: rate,
          monthlyTimeline: timelineList
      };
  }, [targetAssets, dateRange, t]);

  const repTitle = safeT(t, 'repBookAnaTitle', 'Buchungsanalyse & Cashflow');
  const repSub = `${new Date(dateRange.from).toLocaleDateString('de-CH')} ${safeT(t, 'wordTo', 'bis')} ${new Date(dateRange.to).toLocaleDateString('de-CH')} | ${safeT(t, 'labelIncomesReal', 'Echte Einnahmen')} vs. ${safeT(t, 'labelExpensesReal', 'Echte Ausgaben')}`;

  const chartColors = [
      '#4f46e5', '#7c3aed', '#c026d3', '#e11d48', '#ea580c', '#d97706', 
      '#65a30d', '#059669', '#0d9488', '#0284c7', '#2563eb', '#475569'
  ];

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'kpiRealIncomes', 'Echte Einnahmen'), value: fCur(totalIncomes), sub: `${sortedIncCategories.length} ${safeT(t, 'tabCategories', 'Kategorien')}`, color: '#10b981' },
            { label: safeT(t, 'kpiRealExpenses', 'Echte Ausgaben'), value: fCur(totalExpenses), sub: `${sortedExpCategories.length} ${safeT(t, 'tabCategories', 'Kategorien')}`, color: '#ef4444' },
            { label: safeT(t, 'kpiNetCashflowBalance', 'Netto-Cashflow (Saldo)'), value: `${cashflow >= 0 ? '+' : ''}${fCur(cashflow)}`, sub: cashflow >= 0 ? safeT(t, 'kpiSurplusSavings', 'Überschuss / Ersparnis') : safeT(t, 'kpiDeficitWithdrawal', 'Defizit / Entnahme'), color: cashflow >= 0 ? '#2563eb' : '#f59e0b' },
            { label: safeT(t, 'kpiSavingsRate', 'Sparquote'), value: `${savingsRate.toFixed(1)}%`, sub: safeT(t, 'kpiSavingsAmount', '{amount} Ersparnis').replace('{amount}', fCur(Math.max(0, cashflow))), color: '#8b5cf6' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colTypeCategory', 'Art / Kategorie'),
            safeT(t, 'colClassification', 'Klassifizierung'),
            safeT(t, 'colIncomesPlus', 'Einnahmen (+)'),
            safeT(t, 'colExpensesMinus', 'Ausgaben (-)'),
            safeT(t, 'share', 'Anteil')
        ];
        
        const tableBody = [];

        if (sortedIncCategories.length > 0) {
            tableBody.push([{ text: safeT(t, 'pdfSectionIncomes', 'A. EINNAHMEN'), bold: true }, safeT(t, 'pdfTypeCashInflow', 'Geldzufluss'), fCur(totalIncomes), '-', '100.0%']);
            sortedIncCategories.forEach(cat => {
                const pct = totalIncomes > 0 ? (incomes[cat] / totalIncomes) * 100 : 0;
                tableBody.push([`   + ${cat}`, safeT(t, 'pdfTypeSingleIncome', 'Einnahme'), fCur(incomes[cat]), '-', `${pct.toFixed(1)}%`]);
            });
        }

        if (sortedExpCategories.length > 0) {
            tableBody.push([{ text: safeT(t, 'pdfSectionExpenses', 'B. AUSGABEN'), bold: true }, safeT(t, 'pdfTypeCashOutflow', 'Geldabfluss'), '-', fCur(totalExpenses), '100.0%']);
            sortedExpCategories.forEach(cat => {
                const pct = totalExpenses > 0 ? (expenses[cat] / totalExpenses) * 100 : 0;
                tableBody.push([`   - ${cat}`, safeT(t, 'pdfTypeSingleExpense', 'Ausgabe'), '-', fCur(expenses[cat]), `${pct.toFixed(1)}%`]);
            });
        }

        tableBody.push([
            { text: safeT(t, 'pdfSectionNetCashflow', 'TOTAL NETTO-CASHFLOW'), bold: true },
            cashflow >= 0 ? safeT(t, 'kpiSurplusSavings', 'Überschuss') : safeT(t, 'kpiDeficitWithdrawal', 'Defizit'),
            fCur(totalIncomes),
            fCur(totalExpenses),
            { text: `${cashflow >= 0 ? '+' : ''}${fCur(cashflow)} (${savingsRate.toFixed(1)}%)`, bold: true, color: cashflow >= 0 ? '#10b981' : '#ef4444' }
        ]);

        if (wealthShiftsIn > 0 || wealthShiftsOut > 0) {
            tableBody.push(['', '', '', '', '']);
            tableBody.push([
                { text: safeT(t, 'pdfSectionShiftsNeutral', 'C. VERMÖGENSVERSCHIEBUNGEN (NEUTRAL)'), bold: true },
                safeT(t, 'pdfTypeInternalShift', 'Interne Umbuchung'),
                fCur(wealthShiftsIn),
                fCur(wealthShiftsOut),
                safeT(t, 'pdfTypeNeutral', 'Neutral')
            ]);
        }

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: `${repSub} | ${safeT(t, 'kpiSavingsRate', 'Sparquote')}: ${savingsRate.toFixed(1)}%`,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.32, 0.20, 0.16, 0.16, 0.16],
          colAligns: ['left', 'left', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data: data || targetAssets
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im BookingAnalysisReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 7, 
                    title: repTitle,
                    subtitle: `${repSub} | ${safeT(t, 'kpiSavingsRate', 'Sparquote')}: ${savingsRate.toFixed(1)}%`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.32, 0.20, 0.16, 0.16, 0.16],
                    colAligns: ['left', 'left', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im BookingAnalysisReport:", err);
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
  }, [sortedExpCategories, sortedIncCategories, expenses, incomes, dateRange, fCur, t, totalIncomes, totalExpenses, savingsRate, cashflow, wealthShiftsIn, wealthShiftsOut, repTitle, repSub, data, targetAssets]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-emerald-50/60 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-600 overflow-hidden">
            <div className="text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="PlusCircle" size={14} className="text-emerald-600" />
                {safeT(t, 'kpiRealIncomes', 'ECHTE EINNAHMEN')}
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 truncate">
                {fCur(totalIncomes)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {sortedIncCategories.length} {safeT(t, 'tabCategories', 'Kategorien')}
            </div>
         </div>

         <div className="bg-rose-50/60 dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-rose-600 overflow-hidden">
            <div className="text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Trash2" size={14} className="text-rose-600" />
                {safeT(t, 'kpiRealExpenses', 'ECHTE AUSGABEN')}
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 truncate">
                {fCur(totalExpenses)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {sortedExpCategories.length} {safeT(t, 'tabCategories', 'Kategorien')}
            </div>
         </div>

         <div className={`p-6 border rounded-2xl shadow-sm border-b-4 overflow-hidden ${
             cashflow >= 0 
                ? 'bg-blue-50/60 dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 border-b-blue-600' 
                : 'bg-amber-50/60 dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 border-b-amber-500'
         }`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Icon name="Activity" size={14} className={cashflow >= 0 ? "text-blue-500" : "text-amber-500"} />
                {safeT(t, 'labelNetCashflow', 'NETTO CASHFLOW')}
            </div>
            <div className={`text-2xl font-black truncate ${cashflow >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {cashflow >= 0 ? '+' : ''}{fCur(cashflow)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {cashflow >= 0 ? safeT(t, 'descMonthlySurplus', 'Monatlicher Überschuss') : safeT(t, 'descMonthlyDeficit', 'Monatliches Defizit')}
            </div>
         </div>

         <div className="bg-purple-50/60 dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-600 overflow-hidden">
            <div className="text-purple-800 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Target" size={14} className="text-purple-600" />
                {safeT(t, 'labelSavingsRate', 'SPARQUOTE')}
            </div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-400 truncate">
                {savingsRate.toFixed(1)} %
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {savingsRate >= 20 ? safeT(t, 'descSavingsRateExcellent', 'Exzellente Sparquote') : safeT(t, 'descSavingsRatePotential', 'Sparpotenzial vorhanden')}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
        
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8" data-pdf-title={safeT(t, 'titleExpenseDistByCat', 'Ausgabenverteilung nach Kategorien')}>
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="PieChart" className="text-rose-500" /> {safeT(t, 'titleExpensesByCat', 'Ausgaben nach Kategorien')}
            </h3>
            {sortedExpCategories.length > 0 ? (
                <div style={{ width: '100%', height: '320px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="doughnut"
                        labels={sortedExpCategories}
                        datasets={[{
                            label: safeT(t, 'amount', 'Betrag'),
                            data: sortedExpCategories.map(cat => expenses[cat]),
                            backgroundColor: chartColors,
                            valueFormatter: fCur
                        }]}
                        height="100%"
                    />
                </div>
            ) : (
                <div className="h-[320px] flex flex-col items-center justify-center text-gray-400 text-sm">
                    <Icon name="Activity" size={32} className="mb-3 opacity-30"/>
                    {safeT(t, 'msgNoExpensesInPeriod', 'Keine Ausgaben im gewählten Zeitraum')}
                </div>
            )}
        </div>

        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleMonthlyCashflowTrend', 'Monatlicher Cashflow-Trend')}>
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="BarChart" className="text-blue-500" /> {safeT(t, 'titleMonthlyCashflowTrend', 'Monatlicher Cashflow-Trend')}
            </h3>
            <div style={{ width: '100%', height: '320px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    labels={monthlyTimeline.map(m => m.label)}
                    datasets={[
                        {
                            name: safeT(t, 'incomesUppercase', 'Einnahmen'),
                            data: monthlyTimeline.map(m => m.income),
                            backgroundColor: '#10b981',
                            valueFormatter: fCur
                        },
                        {
                            name: safeT(t, 'expensesUppercase', 'Ausgaben'),
                            data: monthlyTimeline.map(m => m.expense),
                            backgroundColor: '#ef4444',
                            valueFormatter: fCur
                        },
                        {
                            name: safeT(t, 'labelNetCashflow', 'Netto-Cashflow'),
                            data: monthlyTimeline.map(m => m.net),
                            backgroundColor: '#2563eb',
                            valueFormatter: fCur
                        }
                    ]}
                    height="100%"
                />
            </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-emerald-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Icon name="TrendingUp" className="text-emerald-500" />
                      {safeT(t, 'incomesUppercase', 'Einnahmen')} ({sortedIncCategories.length})
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{fCur(totalIncomes)}
                  </span>
              </div>
              <div className="p-0">
                  {sortedIncCategories.length > 0 ? (
                      <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {sortedIncCategories.map((cat, i) => {
                                  const percentage = totalIncomes > 0 ? (incomes[cat] / totalIncomes) * 100 : 0;
                                  return (
                                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                          <td className="p-4 pl-5 text-gray-700 dark:text-gray-200 w-full">
                                              <div className="flex justify-between items-center mb-1.5">
                                                  <span className="font-medium">{cat}</span>
                                                  <span className="text-xs text-gray-400 font-mono">{percentage.toFixed(1)}%</span>
                                              </div>
                                              <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                              </div>
                                          </td>
                                          <td className="p-4 pr-5 text-right align-middle">
                                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                  +{fCur(incomes[cat])}
                                              </span>
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  ) : (
                      <div className="p-6 text-center text-gray-400 text-sm">
                          {safeT(t, 'msgNoIncomesInPeriod', 'Keine Einnahmen in dieser Periode erfasst.')}
                      </div>
                  )}
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-rose-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Icon name="TrendingDown" className="text-rose-500" />
                      {safeT(t, 'expensesUppercase', 'Ausgaben')} ({sortedExpCategories.length})
                  </div>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{fCur(totalExpenses)}
                  </span>
              </div>
              <div className="p-0">
                  {sortedExpCategories.length > 0 ? (
                      <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {sortedExpCategories.map((cat, i) => {
                                  const percentage = totalExpenses > 0 ? (expenses[cat] / totalExpenses) * 100 : 0;
                                  const barColor = chartColors[i % chartColors.length] || '#ef4444';
                                  
                                  return (
                                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                          <td className="p-4 pl-5 text-gray-700 dark:text-gray-200 w-full">
                                              <div className="flex justify-between items-center mb-1.5">
                                                  <span className="font-medium">{cat}</span>
                                                  <span className="text-xs text-gray-400 font-mono">{percentage.toFixed(1)}%</span>
                                              </div>
                                              <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: barColor }}></div>
                                              </div>
                                          </td>
                                          <td className="p-4 pr-5 text-right align-middle">
                                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                                  -{fCur(expenses[cat])}
                                              </span>
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  ) : (
                      <div className="p-6 text-center text-gray-400 text-sm">
                          {safeT(t, 'noExpensesPeriod', 'Keine Ausgaben in dieser Periode.')}
                      </div>
                  )}
              </div>
          </div>

      </div>

      {(wealthShiftsIn > 0 || wealthShiftsOut > 0) && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-inner">
              <div className="max-w-xl">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1.5 text-sm">
                      <Icon name="RefreshCw" className="text-blue-500" /> 
                      {safeT(t, 'titleWealthShiftsInternal', 'Vermögensverschiebungen (Interne Transfers)')}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {safeT(t, 'descWealthShiftsNotice', 'Reine Umbuchungen zwischen Konten verändern das Nettovermögen nicht und sind aus der Sparquote ausgeklammert.')}
                  </p>
              </div>
              <div className="flex gap-4 shrink-0 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto font-mono text-sm">
                  <div className="text-right flex-1 md:flex-none">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">{safeT(t, 'labelShiftedOut', 'Verschoben')}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-300">-{fCur(wealthShiftsOut)}</div>
                  </div>
                  <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                  <div className="text-right flex-1 md:flex-none">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">{safeT(t, 'labelShiftedIn', 'Erhalten')}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-300">+{fCur(wealthShiftsIn)}</div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

module.exports = BookingAnalysisReport;