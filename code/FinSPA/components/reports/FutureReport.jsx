const React = require('react');
const { useEffect, useRef, useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const { getTotalWealthAtDate = () => 0, generateMonthEnds = () => [] } = DataEngine;
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const FutureReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  const safeAssets = activeAssets || [];
  const reportEndDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const reportTodayDate = new Date(reportEndDate);

  const { histDates, currentWealth, monthlySavingsRate } = useMemo(() => {
      const dates = generateMonthEnds(dateRange?.from || '2020-01-01', reportEndDate);
      const safeDates = dates.length >= 2 ? dates : [dateRange?.from || '2020-01-01', reportEndDate];
      const cWealth = getTotalWealthAtDate(safeAssets, reportEndDate);

      let netDeposits = 0;
      let monthsCount = Math.max(1, safeDates.length - 1);

      safeAssets.forEach(a => {
          (a.bookings || []).forEach(bk => {
              if (bk.date && bk.date >= dateRange?.from && bk.date <= reportEndDate) {
                  const bType = String(bk.type || '').toLowerCase();
                  const sub = String(bk.subCategory || bk.category || '').toLowerCase();
                  const rate = parseFloat(String(bk.bookingExchangeRate || a.exchangeRate || 1).replace(',', '.'));
                  const amt = Number(bk.amount || 0) * rate;

                  if (['einzahlung', 'kauf'].includes(bType) && !sub.includes('zins') && !sub.includes('dividende')) {
                      netDeposits += amt;
                  } else if (['auszahlung', 'verkauf'].includes(bType) && !sub.includes('zins')) {
                      netDeposits -= amt;
                  }
              }
          });
      });

      let calcMonthlyRate = netDeposits / monthsCount;
      if (isNaN(calcMonthlyRate) || calcMonthlyRate < 0) calcMonthlyRate = 0;

      return {
          histDates: safeDates,
          currentWealth: cWealth,
          monthlySavingsRate: calcMonthlyRate
      };
  }, [safeAssets, dateRange, reportEndDate]);

  const scenarios = useMemo(() => [
      { rate: 0.00, label: safeT(t, 'scen0Percent', '0% (Nur Sparen)'), key: '0%', color: '#94a3b8' },
      { rate: 0.02, label: safeT(t, 'scen2Percent', '2% p.a. (Defensiv)'), key: '2%', color: '#0ea5e9' },
      { rate: 0.04, label: safeT(t, 'scen4Percent', '4% p.a. (Moderat)'), key: '4%', color: '#10b981' },
      { rate: 0.06, label: safeT(t, 'scen6Percent', '6% p.a. (Realistisch)'), key: '6%', color: '#f59e0b' },
      { rate: 0.08, label: safeT(t, 'scen8Percent', '8% p.a. (Optimistisch)'), key: '8%', color: '#ef4444' }
  ], [t]);

  const { 
      chartMonthLabels, 
      projectionCurves, 
      milestonesTable, 
      endResults5Years
  } = useMemo(() => {
      const months = Array.from({ length: 61 }, (_, i) => i);

      const labels = months.map(m => {
          const d = new Date(reportTodayDate);
          d.setMonth(d.getMonth() + m);
          return `${('0' + (d.getMonth() + 1)).slice(-2)}.${d.getFullYear().toString().slice(-2)}`;
      });

      const futureScenarios = (data?.scenarios || []).filter(sc => {
          const scDate = new Date(sc.date);
          return scDate > reportTodayDate;
      });

      const curves = scenarios.map(sc => {
          const dataPoints = months.map(m => {
              if (m === 0) return currentWealth;

              let val = 0;
              const futureDate = new Date(reportTodayDate);
              futureDate.setMonth(futureDate.getMonth() + m);

              if (sc.rate === 0) {
                  val = currentWealth + (monthlySavingsRate * m);
              } else {
                  const monthlyRate = sc.rate / 12;
                  const compoundFactor = Math.pow(1 + monthlyRate, m);
                  const startCapitalGrowth = currentWealth * compoundFactor;
                  const savingsGrowth = monthlySavingsRate * ((compoundFactor - 1) / monthlyRate);
                  val = startCapitalGrowth + savingsGrowth;
              }

              futureScenarios.forEach(s => {
                  const sDate = new Date(s.date);
                  if (sDate <= futureDate) {
                      val += Number(s.impact || 0);
                  }
              });

              return Math.max(0, val);
          });

          return {
              ...sc,
              data: dataPoints
          };
      });

      const milestoneSteps = [
          { m: 0, label: safeT(t, 'msTodayStatusQuo', 'Heute (Status Quo)') },
          { m: 12, label: safeT(t, 'msIn1Year', 'In 1 Jahr') },
          { m: 24, label: safeT(t, 'msIn2Years', 'In 2 Jahren') },
          { m: 36, label: safeT(t, 'msIn3Years', 'In 3 Jahren') },
          { m: 60, label: safeT(t, 'msIn5Years', 'In 5 Jahren') }
      ];

      const tableRows = milestoneSteps.map(step => {
          const rowObj = { label: step.label, months: step.m };
          curves.forEach(c => {
              rowObj[c.key] = c.data[step.m] || 0;
          });
          rowObj.compoundGain6 = (rowObj['6%'] || 0) - (rowObj['0%'] || 0);
          return rowObj;
      });

      const final0 = curves.find(c => c.key === '0%')?.data[60] || 0;
      const final4 = curves.find(c => c.key === '4%')?.data[60] || 0;
      const final6 = curves.find(c => c.key === '6%')?.data[60] || 0;
      const final8 = curves.find(c => c.key === '8%')?.data[60] || 0;

      return {
          chartMonthLabels: labels,
          projectionCurves: curves,
          milestonesTable: tableRows,
          endResults5Years: {
              final0,
              final4,
              final6,
              final8,
              compoundLeverage6: final6 - final0,
              totalDeposits5Y: monthlySavingsRate * 60
          }
      };
  }, [currentWealth, monthlySavingsRate, scenarios, data?.scenarios, reportTodayDate, t]);

  const repTitle = safeT(t, 'titleFutureAnalysisReport', "Zukunftsanalyse & Vermögensprojektion");
  const repSub = safeT(t, 'subFutureAnalysisReport', `Extrapolation ab {date} | Angenommener Sparbetrag: ~{amount}/Mt.`)
    .replace('{date}', new Date(reportEndDate).toLocaleDateString('de-CH'))
    .replace('{amount}', fCur(monthlySavingsRate));

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'kpiStartCapitalToday', 'Startvermögen (Heute)'), value: fCur(currentWealth), sub: `${safeT(t, 'statusAsOf', 'Stichtag:')} ${new Date(reportEndDate).toLocaleDateString('de-CH')}`, color: '#2563eb' },
            { label: safeT(t, 'kpiSavingsRateBasis', 'Ø Sparquote (Basis)'), value: `${fCur(monthlySavingsRate)}/Mt.`, sub: safeT(t, 'descDeposits5Y', '+{amount} in 5 Jahren').replace('{amount}', fCur(endResults5Years.totalDeposits5Y)), color: '#10b981' },
            { label: safeT(t, 'kpiProj5Y6Pct', 'Projektion 5J (6% p.a.)'), value: fCur(endResults5Years.final6), sub: safeT(t, 'descRealisticMarketScen', 'Realistisches Marktszenario'), color: '#f59e0b' },
            { label: safeT(t, 'kpiCompoundLeverage6Pct', 'Zinseszins-Hebel (6%)'), value: `+${fCur(endResults5Years.compoundLeverage6)}`, sub: safeT(t, 'descCompoundLeverageSub', 'Reiner Ertragsgewinn vs. Sparen'), color: '#8b5cf6' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colTimeHorizon', 'Zeithorizont'),
            safeT(t, 'scen0Percent', '0% (Nur Sparen)'),
            '2% p.a.',
            '4% p.a.',
            '6% p.a.',
            '8% p.a.',
            safeT(t, 'colCompound6Pct', 'Zinseszins (6%)')
        ];

        const tableBody = milestonesTable.map(row => [
            row.label,
            fCur(row['0%']),
            fCur(row['2%']),
            fCur(row['4%']),
            fCur(row['6%']),
            fCur(row['8%']),
            row.months > 0 ? `+${fCur(row.compoundGain6)}` : '-'
        ]);

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: repTitle,
          subtitle: repSub,
          tableHeaders,
          tableBody,
          colWidthsPct: [0.22, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13],
          colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) { 
          console.error("[FinBundle Pro] PDF Export Error im FutureReport:", err); 
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 9, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.22, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13],
                    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im FutureReport:", err);
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
  }, [milestonesTable, currentWealth, monthlySavingsRate, endResults5Years, reportEndDate, fCur, data, repTitle, repSub, t]);

  if (currentWealth === 0) {
      return (
          <div className="max-w-7xl px-4 md:px-8 pb-12 relative">
             <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
                <Icon name="AlertCircle" size={32} className="mx-auto mb-3 opacity-50"/>
                <p>{safeT(t, 'msgNotEnoughAssetsForProj', 'Nicht genügend Vermögenswerte zum Stichtag vorhanden, um eine Projektion zu berechnen.')}</p>
             </div>
          </div>
      );
  }

  const stackedComponentLabels = [
      safeT(t, 'scenShort0', '0% Sparen'),
      safeT(t, 'scenShort2', '2% Defensiv'),
      safeT(t, 'scenShort4', '4% Moderat'),
      safeT(t, 'scenShort6', '6% Realist.'),
      safeT(t, 'scenShort8', '8% Optimist.')
  ];
  const startCapitalFixed = Array(5).fill(currentWealth);
  const savingsFixed = Array(5).fill(endResults5Years.totalDeposits5Y);
  const compoundYields = [
      0,
      Math.max(0, (projectionCurves.find(c => c.key === '2%')?.data[60] || 0) - currentWealth - endResults5Years.totalDeposits5Y),
      Math.max(0, (projectionCurves.find(c => c.key === '4%')?.data[60] || 0) - currentWealth - endResults5Years.totalDeposits5Y),
      Math.max(0, (projectionCurves.find(c => c.key === '6%')?.data[60] || 0) - currentWealth - endResults5Years.totalDeposits5Y),
      Math.max(0, (projectionCurves.find(c => c.key === '8%')?.data[60] || 0) - currentWealth - endResults5Years.totalDeposits5Y)
  ];

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Target" size={14} className="text-blue-500"/>
                {safeT(t, 'labelStartCapitalHeader', 'STARTKAPITAL (HEUTE)')}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                {fCur(currentWealth)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descBasisForCompoundCurves', 'Basis für alle Zinseszins-Kurven')}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Activity" size={14} className="text-emerald-500"/>
                {safeT(t, 'labelAssumedSavingsRateHeader', 'ANGENOMMENE SPARQUOTE')}
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 truncate">
                ~{fCur(monthlySavingsRate)}/Mt.
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descSavings5YEigen', '+{amount} Eigenersparnis in 5 Jahren').replace('{amount}', fCur(endResults5Years.totalDeposits5Y))}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="TrendingUp" size={14} className="text-amber-500"/>
                {safeT(t, 'labelProj5Y6PctHeader', 'PROGNOSE 5J (6% P.A.)')}
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 truncate">
                {fCur(endResults5Years.final6)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descRealisticLongTrend', 'Realistischer langfristiger Markttrend')}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Zap" size={14} className="text-purple-500"/>
                {safeT(t, 'labelCompoundLeverageHeader', 'ZINSESZINS-HEBEL (6%)')}
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 truncate">
                +{fCur(endResults5Years.compoundLeverage6)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descExtraCompoundYield', 'Zusätzlicher Ertrag durch Zinseszins')}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
        
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleProj5YPdf', 'Vermögensprojektion 5 Jahre')}>
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="TrendingUp" className="text-blue-500" /> {safeT(t, 'titleGrowthCurves5Y', 'Wachstumskurven (5-Jahres-Projektion)')}
            </h3>
            <div style={{ width: '100%', height: '360px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="line"
                    labels={chartMonthLabels}
                    datasets={projectionCurves.map(c => ({
                        name: c.label,
                        data: c.data,
                        backgroundColor: c.color,
                        valueFormatter: fCur
                    }))}
                    options={{
                        legend: {
                            type: 'plain',
                            bottom: 0,
                            itemGap: 12,
                            textStyle: { fontSize: 11 }
                        }
                    }}
                    height="100%"
                />
            </div>
        </div>

        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title={safeT(t, 'titleComp5YPdf', 'Zusammensetzung nach 5 Jahren')}>
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="Layers" className="text-emerald-500" /> {safeT(t, 'titleEndWealth5YBuilding', 'Endvermögens-Aufbau nach 5 Jahren')}
            </h3>
            <div style={{ width: '100%', height: '360px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    labels={stackedComponentLabels}
                    datasets={[
                        {
                            name: safeT(t, 'labelStartCapitalComponent', 'Startkapital'),
                            data: startCapitalFixed,
                            backgroundColor: '#64748b',
                            stack: 'total',
                            valueFormatter: fCur
                        },
                        {
                            name: safeT(t, 'labelSavings5YComponent', 'Sparleistung (5J)'),
                            data: savingsFixed,
                            backgroundColor: '#3b82f6',
                            stack: 'total',
                            valueFormatter: fCur
                        },
                        {
                            name: safeT(t, 'labelCompoundYieldComponent', 'Zinseszins'),
                            data: compoundYields,
                            backgroundColor: '#10b981',
                            stack: 'total',
                            valueFormatter: fCur
                        }
                    ]}
                    options={{
                        grid: {
                            top: 25,
                            bottom: 65,
                            left: '12%',
                            right: '4%'
                        },
                        legend: {
                            type: 'plain',
                            bottom: 0,
                            itemGap: 14,
                            itemWidth: 10,
                            itemHeight: 10,
                            textStyle: { fontSize: 11 }
                        },
                        xAxis: {
                            axisLabel: {
                                interval: 0,
                                rotate: 20,
                                fontSize: 10.5,
                                margin: 10
                            }
                        }
                    }}
                    height="100%"
                />
            </div>
        </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Icon name="Calendar" className="text-slate-500" /> {safeT(t, 'titleMilestoneProjTable', 'Meilenstein-Projektion & Zinseszins-Hebel')}
              </h3>
              <span className="text-xs text-gray-500 font-medium">
                  {safeT(t, 'descMilestoneBasis', 'Basis: {amount}/Monat Sparbetrag').replace('{amount}', fCur(monthlySavingsRate))}
              </span>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold">
                      <tr>
                          <th className="p-4">{safeT(t, 'colTimeHorizon', 'Zeithorizont')}</th>
                          <th className="p-4 text-right">{safeT(t, 'scen0Percent', '0% (Nur Sparen)')}</th>
                          <th className="p-4 text-right">2% p.a.</th>
                          <th className="p-4 text-right">4% p.a.</th>
                          <th className="p-4 text-right">6% p.a.</th>
                          <th className="p-4 text-right">8% p.a.</th>
                          <th className="p-4 text-right text-purple-600 dark:text-purple-400">{safeT(t, 'colCompound6Pct', 'Zinseszins (6%)')}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      {milestonesTable.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-bold font-sans text-slate-800 dark:text-slate-200">
                                  {row.label}
                              </td>
                              <td className="p-4 text-right text-gray-500">{fCur(row['0%'])}</td>
                              <td className="p-4 text-right text-sky-600 dark:text-sky-400">{fCur(row['2%'])}</td>
                              <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">{fCur(row['4%'])}</td>
                              <td className="p-4 text-right font-bold text-amber-600 dark:text-amber-400">{fCur(row['6%'])}</td>
                              <td className="p-4 text-right text-rose-600 dark:text-rose-400">{fCur(row['8%'])}</td>
                              <td className="p-4 text-right font-bold text-purple-600 dark:text-purple-400">
                                  {row.months > 0 ? `+${fCur(row.compoundGain6)}` : '-'}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

module.exports = FutureReport;