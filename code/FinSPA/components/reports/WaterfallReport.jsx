const React = require('react');
const { useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getTotalWealthAtDate } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const WaterfallReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  // 1. Berechnung der Vermögensbrücke & Buchungsflüsse
  const {
      startVal,
      endVal,
      sumInc,
      sumExp,
      netCashflow,
      marketPerf,
      marketPerfPercent,
      flowBreakdown,
      categoryLabels,
      categoryValues,
      categoryColors
  } = useMemo(() => {
      const safeAssets = activeAssets || [];
      const sVal = getTotalWealthAtDate ? getTotalWealthAtDate(safeAssets, dateRange.from) : 0;
      const eVal = getTotalWealthAtDate ? getTotalWealthAtDate(safeAssets, dateRange.to) : 0;

      let inc = 0;
      let exp = 0;
      const breakdown = { positive: {}, negative: {} };

      const allBookings = [];
      safeAssets.forEach(asset => {
          const rate = parseFloat(String(asset.exchangeRate || '1').replace(',', '.'));
          (asset.bookings || []).forEach(bk => {
              allBookings.push({
                  ...bk,
                  _baseValue: Number(bk.amount || 0) * rate,
                  assetName: asset.name
              });
          });
      });

      allBookings.filter(bk => bk.date && bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
          const originalType = bk.normType || bk.type || '';
          const originalCategory = bk.category || bk.subCategory || bk.normCategory || '';
          
          const rawType = String(originalType).toLowerCase();
          const rawCat = String(originalCategory).toLowerCase();

          // Markteffekte (Kursanpassungen, Dividenden, Zinsen) nicht als externen Cashflow werten
          const isMarketEffect = ['wertanpassung', 'dividende', 'ausschüttung', 'zinszahlung'].includes(rawType) ||
                                 ['dividenden', 'zinsen', 'mieteinnahmen'].includes(rawCat);

          if (isMarketEffect) return;

          // Flussrichtung ermitteln
          let isPos = ['einzahlung', 'kauf', 'abzahlung'].includes(rawType);
          let isNeg = ['auszahlung', 'verkauf', 'schulderhöhung', 'gebühr', 'steuern'].includes(rawType);

          if (!isPos && !isNeg) {
              isPos = Number(bk.amount) >= 0;
          }

          const displayCategory = originalCategory || originalType || (t ? (t('catOthers') || 'Sonstiges') : 'Sonstiges');
          const absValue = Math.abs(bk._baseValue);

          if (isPos) {
              inc += absValue;
              breakdown.positive[displayCategory] = (breakdown.positive[displayCategory] || 0) + absValue;
          } else {
              exp += absValue;
              breakdown.negative[displayCategory] = (breakdown.negative[displayCategory] || 0) + absValue;
          }
      });

      // Markteffekt = Differenz End- zu Startwert abzüglich Netto-Einzahlungen
      const mPerf = eVal - sVal - inc + exp;
      const nCashflow = inc - exp;

      // Berechnungsbasis für prozentuale Performance (Durchschnittlich investiertes Kapital)
      const investedCap = sVal + (inc / 2);
      const mPerfPct = investedCap > 0 ? (mPerf / investedCap) * 100 : 0;

      // Kategorien-Treiber für Chart 2 aufbereiten
      const cLabels = [];
      const cValues = [];
      const cColors = [];

      Object.keys(breakdown.positive)
          .sort((a, b) => breakdown.positive[b] - breakdown.positive[a])
          .slice(0, 5)
          .forEach(k => {
              cLabels.push(`+ ${k}`);
              cValues.push(breakdown.positive[k]);
              cColors.push('#10b981');
          });

      Object.keys(breakdown.negative)
          .sort((a, b) => breakdown.negative[b] - breakdown.negative[a])
          .slice(0, 5)
          .forEach(k => {
              cLabels.push(`- ${k}`);
              cValues.push(-breakdown.negative[k]);
              cColors.push('#ef4444');
          });

      return {
          startVal: sVal,
          endVal: eVal,
          sumInc: inc,
          sumExp: exp,
          netCashflow: nCashflow,
          marketPerf: mPerf,
          marketPerfPercent: mPerfPct,
          flowBreakdown: breakdown,
          categoryLabels: cLabels,
          categoryValues: cValues,
          categoryColors: cColors
      };
  }, [activeAssets, dateRange, t]);

  const repTitle = t ? (t('repWaterfallTitle') || "Wasserfall-Analyse (Brückenrechnung)") : "Wasserfall-Analyse (Brückenrechnung)";
  const repSub = `${new Date(dateRange.from).toLocaleDateString('de-CH')} bis ${new Date(dateRange.to).toLocaleDateString('de-CH')} | Vermögensüberleitung & Cashflow`;

  const lblStart = t ? (t('labelWaterfallStart') || 'Startvermögen') : 'Startvermögen';
  const lblIn = t ? (t('labelWaterfallInflows') || 'Einzahlungen (+)') : 'Einzahlungen (+)';
  const lblOut = t ? (t('labelWaterfallOutflows') || 'Auszahlungen (-)') : 'Auszahlungen (-)';
  const lblMarket = t ? (t('labelMarketEffect') || 'Markteffekt (+/-)') : 'Markteffekt (+/-)';
  const lblEnd = t ? (t('labelWaterfallEnd') || 'Endvermögen') : 'Endvermögen';

  const chartLabels = [lblStart, lblIn, lblOut, lblMarket, lblEnd];
  const chartData = [startVal, sumInc, -sumExp, marketPerf, endVal];
  const chartColors = [
      '#64748b', 
      '#10b981', 
      '#ef4444', 
      marketPerf >= 0 ? '#10b981' : '#ef4444', 
      '#2563eb'  
  ];

  // 2. PdfToolkit Export
  useEffect(() => {
    const buildReportData = async () => {
        const startDateStr = new Date(dateRange.from).toLocaleDateString('de-CH');
        const endDateStr = new Date(dateRange.to).toLocaleDateString('de-CH');

        const kpis = [
            { label: 'Startvermögen', value: fCur(startVal), sub: `Stichtag: ${startDateStr}`, color: '#64748b' },
            { label: 'Netto-Cashflow', value: `${netCashflow >= 0 ? '+' : ''}${fCur(netCashflow)}`, sub: `+${fCur(sumInc)} In / -${fCur(sumExp)} Out`, color: netCashflow >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Markteffekt (Rendite)', value: `${marketPerf >= 0 ? '+' : ''}${fCur(marketPerf)}`, sub: `${marketPerfPercent >= 0 ? '+' : ''}${marketPerfPercent.toFixed(2)}% Marktwachstum`, color: marketPerf >= 0 ? '#2563eb' : '#f59e0b' },
            { label: 'Endvermögen', value: fCur(endVal), sub: `Stichtag: ${endDateStr}`, color: '#1e3a8a' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
            chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            'Überleitungs-Position',
            'Detail / Kategorie',
            'Zufluss (+)',
            'Abfluss (-)',
            'Effekt auf Portfolio'
        ];

        const tableBody = [];

        // 1. Startwert
        tableBody.push([
            { text: lblStart.toUpperCase(), bold: true },
            `Bestand per ${startDateStr}`,
            '-',
            '-',
            { text: fCur(startVal), bold: true }
        ]);

        // 2. Zuflüsse
        if (sumInc > 0) {
            tableBody.push([{ text: 'EXTERNE ZUFLÜSSE (TOTAL)', bold: true }, '', fCur(sumInc), '-', `+${fCur(sumInc)}`]);
            Object.keys(flowBreakdown.positive).forEach(cat => {
                tableBody.push([`   + ${cat}`, 'Einzahlung / Ersparnis', fCur(flowBreakdown.positive[cat]), '-', `+${fCur(flowBreakdown.positive[cat])}`]);
            });
        }

        // 3. Abflüsse
        if (sumExp > 0) {
            tableBody.push([{ text: 'EXTERNE ABFLÜSSE (TOTAL)', bold: true }, '', '-', fCur(sumExp), `-${fCur(sumExp)}`]);
            Object.keys(flowBreakdown.negative).forEach(cat => {
                tableBody.push([`   - ${cat}`, 'Auszahlung / Entnahme', '-', fCur(flowBreakdown.negative[cat]), `-${fCur(flowBreakdown.negative[cat])}`]);
            });
        }

        // 4. Netto Cashflow Zwischenergebnis
        tableBody.push([
            { text: 'NETTO CASHFLOW (SALDO)', bold: true },
            'Kapitalveränderung aus eigener Kraft',
            fCur(sumInc),
            fCur(sumExp),
            { text: `${netCashflow >= 0 ? '+' : ''}${fCur(netCashflow)}`, bold: true, color: netCashflow >= 0 ? '#10b981' : '#ef4444' }
        ]);

        // 5. Markteffekt
        tableBody.push([
            { text: 'MARKTEFFEKT & WERTANPASSUNG', bold: true },
            'Kursgewinne, Zinsen, Dividenden & FX',
            '-',
            '-',
            { text: `${marketPerf >= 0 ? '+' : ''}${fCur(marketPerf)} (${marketPerfPercent.toFixed(2)}%)`, bold: true, color: marketPerf >= 0 ? '#10b981' : '#ef4444' }
        ]);

        // 6. Endstand
        tableBody.push([
            { text: lblEnd.toUpperCase(), bold: true },
            `Endbestand per ${endDateStr}`,
            '-',
            '-',
            { text: fCur(endVal), bold: true, color: '#1e3a8a' }
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
          colWidthsPct: [0.32, 0.28, 0.13, 0.13, 0.14],
          colAligns: ['left', 'left', 'right', 'right', 'right'],
          kpis,
          chartsData,
          data
        });
      } catch (err) { 
          console.error("[FinBundle Pro] PDF Export Error im WaterfallReport:", err); 
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 15, 
                    title: repTitle,
                    subtitle: repSub,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.32, 0.28, 0.13, 0.13, 0.14],
                    colAligns: ['left', 'left', 'right', 'right', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im WaterfallReport:", err);
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
  }, [startVal, sumInc, sumExp, marketPerf, marketPerfPercent, netCashflow, endVal, dateRange, fCur, t, repTitle, repSub, lblStart, lblIn, lblOut, lblMarket, lblEnd, flowBreakdown, data]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12 relative" ref={reportRef}>
      
      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         {/* KPI 1: Startwert */}
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-slate-400 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Calendar" size={14} className="text-slate-500"/>
                <span>{lblStart}</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                {fCur(startVal)}
            </div>
            <div className="text-xs text-gray-400 mt-2">
                am {new Date(dateRange.from).toLocaleDateString('de-CH')}
            </div>
         </div>
         
         {/* KPI 2: Netto-Cashflow */}
         <div className={`p-6 border rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
             netCashflow >= 0 
                ? 'bg-emerald-50/50 dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/50 border-b-emerald-500' 
                : 'bg-rose-50/50 dark:bg-slate-900 border-rose-200 dark:border-rose-800/50 border-b-rose-500'
         }`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                    <Icon name={netCashflow >= 0 ? "TrendingUp" : "TrendingDown"} size={14} className={netCashflow >= 0 ? "text-emerald-500" : "text-rose-500"} />
                    <span>NETTO-CASHFLOW</span>
                </span>
            </div>
            <div className={`text-2xl font-black truncate ${netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {netCashflow >= 0 ? '+' : ''}{fCur(netCashflow)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                +{fCur(sumInc)} In / -{fCur(sumExp)} Out
            </div>
         </div>

         {/* KPI 3: Markteffekt */}
         <div className={`p-6 border rounded-2xl shadow-sm border-b-4 relative overflow-hidden ${
             marketPerf >= 0 
                ? 'bg-blue-50/50 dark:bg-slate-900 border-blue-200 dark:border-blue-800/50 border-b-blue-500' 
                : 'bg-amber-50/50 dark:bg-slate-900 border-amber-200 dark:border-amber-800/50 border-b-amber-500'
         }`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                    <Icon name="Activity" size={14} className={marketPerf >= 0 ? "text-blue-500" : "text-amber-500"} />
                    <span>{lblMarket}</span>
                </span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${marketPerf >= 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                    {marketPerfPercent >= 0 ? '+' : ''}{marketPerfPercent.toFixed(2)}%
                </span>
            </div>
            <div className={`text-2xl font-black truncate ${marketPerf >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {marketPerf >= 0 ? '+' : ''}{fCur(marketPerf)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                Rendite auf arbeitendes Kapital
            </div>
         </div>

         {/* KPI 4: Endwert */}
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-600 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="CheckCircle" size={14} className="text-blue-600"/>
                <span>{lblEnd}</span>
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 truncate">
                {fCur(endVal)}
            </div>
            <div className="text-xs text-gray-400 mt-2">
                am {new Date(dateRange.to).toLocaleDateString('de-CH')}
            </div>
         </div>
      </div>

      {/* Diagramm-Sektion (2 Diagramme) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
        
        {/* Chart 1: Wasserfall-Überleitung */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block self-start sticky top-8" data-pdf-title="Wasserfall Vermögensbrücke">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="BarChart" className="text-blue-500" /> Vermögensbrücke (Überleitung)
            </h3>
            <div style={{ width: '100%', height: '360px' }}>
                <UniversalChart 
                    engine={activeChartEngine}
                    type="bar"
                    labels={chartLabels}
                    datasets={[{
                        label: 'Betrag',
                        data: chartData,
                        backgroundColor: chartColors,
                        valueFormatter: (val) => {
                            const isDeltaCol = chartData.indexOf(val) !== 0 && chartData.indexOf(val) !== 4;
                            return `${isDeltaCol && val > 0 ? '+' : ''}${fCur(val)}`;
                        }
                    }]}
                    height="100%"
                />
            </div>
        </div>

        {/* Chart 2: Cashflow-Treiber & Kategorien */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block" data-pdf-title="Grösste Cashflow-Treiber">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Icon name="List" className="text-emerald-500" /> Grösste Cashflow-Treiber
            </h3>
            {categoryLabels.length > 0 ? (
                <div style={{ width: '100%', height: '360px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        horizontal={true}
                        labels={categoryLabels}
                        datasets={[{
                            label: 'Effekt auf Cashflow',
                            data: categoryValues,
                            backgroundColor: categoryColors,
                            valueFormatter: (val) => `${val > 0 ? '+' : ''}${fCur(val)}`
                        }]}
                        height="100%"
                    />
                </div>
            ) : (
                <div className="h-[360px] flex items-center justify-center text-gray-400 text-sm">
                    Keine Buchungsbewegungen im Zeitraum
                </div>
            )}
        </div>

      </div>

      {/* Detaillierte Überleitungstabelle */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Icon name="Layers" className="text-slate-500" /> Detaillierte Brückenrechnung (Überleitungs-Tabelle)
              </h3>
              <span className="text-xs text-gray-500 font-medium">
                  Differenz: {endVal - startVal >= 0 ? '+' : ''}{fCur(endVal - startVal)}
              </span>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold">
                      <tr>
                          <th className="p-4">Überleitungs-Position</th>
                          <th className="p-4">Kategorie / Treiber</th>
                          <th className="p-4 text-right">Zufluss (+)</th>
                          <th className="p-4 text-right">Abfluss (-)</th>
                          <th className="p-4 text-right">Effekt auf Vermögen</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                      
                      {/* Startvermögen */}
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20 font-bold">
                          <td className="p-4 font-sans text-slate-900 dark:text-white uppercase">{lblStart}</td>
                          <td className="p-4 font-sans text-gray-500 font-normal">Stand am {new Date(dateRange.from).toLocaleDateString('de-CH')}</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className="p-4 text-right font-black text-slate-900 dark:text-white">{fCur(startVal)}</td>
                      </tr>

                      {/* Zuflüsse */}
                      {Object.keys(flowBreakdown.positive).map((cat, i) => (
                          <tr key={`pos-${i}`} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                              <td className="p-4 pl-8 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                  {cat}
                              </td>
                              <td className="p-4 font-sans text-xs text-gray-400">Einzahlung / Ersparnis</td>
                              <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">+{fCur(flowBreakdown.positive[cat])}</td>
                              <td className="p-4 text-right text-gray-400">-</td>
                              <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">+{fCur(flowBreakdown.positive[cat])}</td>
                          </tr>
                      ))}

                      {/* Abflüsse */}
                      {Object.keys(flowBreakdown.negative).map((cat, i) => (
                          <tr key={`neg-${i}`} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                              <td className="p-4 pl-8 font-sans text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                  {cat}
                              </td>
                              <td className="p-4 font-sans text-xs text-gray-400">Entnahme / Aufwand</td>
                              <td className="p-4 text-right text-gray-400">-</td>
                              <td className="p-4 text-right text-rose-600 dark:text-rose-400">-{fCur(flowBreakdown.negative[cat])}</td>
                              <td className="p-4 text-right text-rose-600 dark:text-rose-400">-{fCur(flowBreakdown.negative[cat])}</td>
                          </tr>
                      ))}

                      {/* Netto Cashflow Zwischenzeile */}
                      <tr className="bg-slate-100/60 dark:bg-slate-800/60 font-bold border-t border-b border-slate-200 dark:border-slate-700">
                          <td className="p-4 font-sans text-slate-800 dark:text-slate-200">SALDO NETTO-CASHFLOW</td>
                          <td className="p-4 font-sans text-xs text-gray-500 font-normal">Kapitalveränderung aus eigener Kraft</td>
                          <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">+{fCur(sumInc)}</td>
                          <td className="p-4 text-right text-rose-600 dark:text-rose-400">-{fCur(sumExp)}</td>
                          <td className={`p-4 text-right font-black ${netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                              {netCashflow >= 0 ? '+' : ''}{fCur(netCashflow)}
                          </td>
                      </tr>

                      {/* Markteffekt */}
                      <tr className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                          <td className="p-4 font-sans font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <Icon name="Activity" size={14} className={marketPerf >= 0 ? "text-blue-500" : "text-amber-500"} />
                              {lblMarket}
                          </td>
                          <td className="p-4 font-sans text-xs text-gray-400">Kursgewinne, Zinsen, Dividenden & FX</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className={`p-4 text-right font-black ${marketPerf >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600'}`}>
                              {marketPerf >= 0 ? '+' : ''}{fCur(marketPerf)} <span className="text-xs font-normal opacity-75">({marketPerfPercent.toFixed(2)}%)</span>
                          </td>
                      </tr>

                      {/* Endvermögen */}
                      <tr className="bg-blue-50/60 dark:bg-slate-800/80 font-bold border-t-2 border-blue-500">
                          <td className="p-4 font-sans text-blue-900 dark:text-white uppercase">{lblEnd}</td>
                          <td className="p-4 font-sans text-gray-500 font-normal">Stand am {new Date(dateRange.to).toLocaleDateString('de-CH')}</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className="p-4 text-right text-gray-400">-</td>
                          <td className="p-4 text-right font-black text-xl text-blue-700 dark:text-blue-400">{fCur(endVal)}</td>
                      </tr>

                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

module.exports = WaterfallReport;