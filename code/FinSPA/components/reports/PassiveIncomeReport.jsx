const React = require('react');
const { useEffect, useRef, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (() => <div>Header fehlt</div>);
const PdfExportEngine = safeRequire('../print/PdfExportEngine.jsx') || window.PdfExportEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center">Chart fehlt</div>);
const { getNormalizedBookings } = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};
const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);

const PassiveIncomeReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';

  // --- DATEN-AGGREGATION ---
  const { totalPassive, monthlyData, categoryMap, assetMap } = useMemo(() => {
    let total = 0;
    const mData = {};
    const cMap = {};
    const aMap = {};

    // Hilfsfunktion: Alle Monate im Zeitraum als YYYY-MM generieren, um Lücken im Chart zu vermeiden
    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    start.setDate(1); end.setDate(1);
    while (start <= end) {
      mData[start.toISOString().substring(0, 7)] = 0;
      start.setMonth(start.getMonth() + 1);
    }

    const normBookings = getNormalizedBookings ? getNormalizedBookings(activeAssets) : [];

    normBookings.filter(bk => 
        bk.date >= dateRange.from && 
        bk.date <= dateRange.to &&
        bk.normType === 'Einzahlung' && 
        ['Dividenden', 'Zinsen', 'Mieteinnahmen'].includes(bk.normCategory) 
    ).forEach(bk => {
        const val = bk._baseValue;
        const monthStr = bk.date.substring(0, 7);
        const cat = bk.normCategory;
        const assetName = bk.assetName || (t ? t('unknown') || 'Unbekannt' : 'Unbekannt');

        total += val;
        
        if (mData[monthStr] !== undefined) {
            mData[monthStr] += val;
        }

        cMap[cat] = (cMap[cat] || 0) + val;
        
        if (!aMap[assetName]) aMap[assetName] = { val: 0, cat: cat };
        aMap[assetName].val += val;
    });

    return { totalPassive: total, monthlyData: mData, categoryMap: cMap, assetMap: aMap };
  }, [activeAssets, dateRange, t]);

  // --- KPI BERECHNUNG ---
  const months = Object.keys(monthlyData).sort();
  const monthValues = months.map(m => monthlyData[m]);
  
  let bestMonth = '-';
  let bestMonthVal = 0;
  months.forEach(m => {
      if (monthlyData[m] > bestMonthVal) {
          bestMonthVal = monthlyData[m];
          bestMonth = m;
      }
  });

  let bestCat = '-';
  let bestCatVal = 0;
  Object.keys(categoryMap).forEach(c => {
      if (categoryMap[c] > bestCatVal) {
          bestCatVal = categoryMap[c];
          bestCat = c;
      }
  });

  const topAssets = Object.keys(assetMap)
    .map(name => ({ name, val: assetMap[name].val, cat: assetMap[name].cat }))
    .sort((a, b) => b.val - a.val);

  // --- TEXT-FALLBACKS ---
  const titleText = t ? (t('repPassiveTitle') || "Passives Einkommen") : "Passives Einkommen";
  const subtitlePrefix = t ? (t('repPassiveSub') || "Dividenden, Zinsen & Mieten von") : "Dividenden, Zinsen & Mieten von";
  const wordTo = t ? (t('wordTo') || "bis") : "bis";

  // --- PDF EXPORT ---
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        let chartBase64 = null;
        if (chartRef.current) {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) chartBase64 = canvas.toDataURL('image/png', 1.0);
        }

        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const tableHeaders = [
            capitalize(t ? t('name') || 'Anlage / Asset' : 'Anlage / Asset'),
            capitalize(t ? t('category') || 'Kategorie' : 'Kategorie'),
            capitalize(t ? t('labelYield') || 'Ertrag' : 'Ertrag')
        ];

        const tableBody = topAssets.map(a => [a.name, a.cat, fCur(a.val)]);

        await PdfExportEngine.exportReport({
          title: titleText,
          subtitle: `${subtitlePrefix} ${dateRange.from} ${wordTo} ${dateRange.to} | Gesamt: ${fCur(totalPassive)}`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im PassiveIncomeReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [topAssets, totalPassive, dateRange, fCur, t, titleText, subtitlePrefix, wordTo]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={titleText} 
        subtitle={`${subtitlePrefix} ${dateRange.from} ${wordTo} ${dateRange.to}.`}
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* KPI Kacheln */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 bg-gradient-to-br from-green-500 to-green-600 border border-green-600 rounded-xl shadow-md text-white flex flex-col justify-between relative overflow-hidden">
             <Icon name="TrendingUp" size={80} className="absolute -right-4 -bottom-4 opacity-10" />
             <div className="text-sm font-bold uppercase tracking-wider mb-2 opacity-80">
               {t ? t('labelTotalPassive') || 'Gesamtertrag' : 'Gesamtertrag'}
             </div>
             <div className="text-4xl font-black">{fCur(totalPassive)}</div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">
                 {t ? t('labelBestMonth') || 'Stärkster Monat' : 'Stärkster Monat'}
             </div>
             <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bestMonth !== '-' ? bestMonth : '-'}</div>
                <div className="text-sm font-bold text-green-600 dark:text-green-500 mt-1">{bestMonthVal > 0 ? fCur(bestMonthVal) : ''}</div>
             </div>
         </div>
         
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
             <div className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">
                 {t ? t('labelTopCategory') || 'Beste Kategorie' : 'Beste Kategorie'}
             </div>
             <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bestCat}</div>
                <div className="text-sm font-bold text-green-600 dark:text-green-500 mt-1">{bestCatVal > 0 ? fCur(bestCatVal) : ''}</div>
             </div>
         </div>
      </div>

      {totalPassive > 0 ? (
          <>
            {/* Balkendiagramm: Erträge im Zeitverlauf */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm mb-8">
              <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
                 <Icon name="Calendar" size={16}/> {t ? t('incomeOverTime') || 'Ertragsverlauf' : 'Ertragsverlauf'}
              </h3>
              <div ref={chartRef} style={{ width: '100%', height: '320px' }}>
                <UniversalChart 
                  engine={activeChartEngine}
                  type="bar"
                  labels={months}
                  datasets={[{
                    label: titleText,
                    data: monthValues,
                    backgroundColor: '#22c55e', 
                    valueFormatter: fCur
                  }]} 
                  height="100%"
                />
              </div>
            </div>

            {/* Top Ertragsquellen (Listenansicht) */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                    <Icon name="Star" size={16}/> {t ? t('topIncomeSources') || 'Top Ertragsquellen' : 'Top Ertragsquellen'}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                            <tr>
                                <th className="p-3 font-bold rounded-tl-lg">{t ? t('name') || 'Asset' : 'Asset'}</th>
                                <th className="p-3 font-bold">{t ? t('category') || 'Kategorie' : 'Kategorie'}</th>
                                <th className="p-3 font-bold text-right rounded-tr-lg">{t ? t('labelYield') || 'Ertrag' : 'Ertrag'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                            {topAssets.map((asset, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{asset.name}</td>
                                    <td className="p-3 text-gray-500 dark:text-gray-400">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-300">
                                            {asset.cat}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-black text-green-600 dark:text-green-500">{fCur(asset.val)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      ) : (
          <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500 mt-6">
             <Icon name="Coffee" size={48} className="mx-auto mb-4 opacity-20" />
             <p>{t ? t('noPassiveIncome') || 'Kein passives Einkommen im gewählten Zeitraum verzeichnet.' : 'Kein passives Einkommen im gewählten Zeitraum verzeichnet.'}</p>
          </div>
      )}
    </div>
  );
};

module.exports = PassiveIncomeReport;