const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);

const PensionPerformanceReport = ({ data, activeAssets, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  // Filtern auf reine Säule 3a Assets
  const pensionAssets = (activeAssets || []).filter(a => ['pension_cash', 'pension_fund'].includes(a.assetClass));

  if (pensionAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <ReportHeader title="Säule 3a Performance" subtitle="Entwicklung der Vorsorgegelder" isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>Keine Säule 3a Konten oder Depots gefunden.</p>
          <p className="text-sm mt-2">Lege ein Asset mit der Anlageklasse "Vorsorgekonto 3a" oder "Vorsorgedepot 3a" an.</p>
        </div>
      </div>
    );
  }

  // 1. Frühestes Datum finden
  let earliestDate = new Date().toISOString().split('T')[0];
  pensionAssets.forEach(asset => {
      (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
  });

  const startYear = new Date(earliestDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Messpunkte generieren (Jedes Jahresende + Heute)
  const dataPoints = [];
  
  const calculateInvested = (asset, targetDate) => {
      let invested = 0;
      let baseDate = '1970-01-01';
      let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
      let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
      
      if (applicableBalance) {
          invested = applicableBalance.amount;
          baseDate = applicableBalance.date;
      }

      (asset.bookings || []).forEach(bk => {
          if (bk.date > baseDate && bk.date <= targetDate) {
              // Nur externes Geld rein/raus berücksichtigen (Zinsen/Dividenden = Performance)
              if (['Einzahlung', 'Kauf'].includes(bk.type)) invested += Number(bk.amount);
              if (['Auszahlung', 'Verkauf'].includes(bk.type)) invested -= Number(bk.amount);
          }
      });
      const rate = applicableBalance?.bookingExchangeRate || asset.exchangeRate || 1;
      return invested * rate;
  };

  for (let y = startYear; y <= currentYear; y++) {
      const isCurrentYear = y === currentYear;
      const targetDate = isCurrentYear ? todayStr : `${y}-12-31`;
      
      let totalInvested = 0;
      let totalActual = 0;

      pensionAssets.forEach(asset => {
          totalInvested += calculateInvested(asset, targetDate);
          totalActual += getAssetValueAtDate(asset, targetDate, activeAssets);
      });

      // Nur Punkte aufzeichnen, an denen bereits Geld investiert war
      if (totalInvested > 0 || totalActual > 0) {
          dataPoints.push({
              year: y,
              dateStr: targetDate,
              invested: totalInvested,
              actual: totalActual,
              profit: totalActual - totalInvested,
              roi: totalInvested > 0 ? ((totalActual / totalInvested) - 1) * 100 : 0
          });
      }
  }

  const latestData = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : { invested: 0, actual: 0, profit: 0, roi: 0 };
  const isPositive = latestData.profit >= 0;

  // 3. Simples, responsives SVG-Liniendiagramm berechnen
  const chartHeight = 300;
  const padding = 20;
  const minVal = Math.min(0, ...dataPoints.map(d => Math.min(d.invested, d.actual)));
  const maxVal = Math.max(...dataPoints.map(d => Math.max(d.invested, d.actual))) * 1.1; // 10% Headroom
  const range = maxVal - minVal || 1;

  const getY = (val) => chartHeight - padding - ((val - minVal) / range) * (chartHeight - padding * 2);
  const getX = (index) => padding + (index * ((1000 - padding * 2) / Math.max(1, dataPoints.length - 1)));

  const investedPath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.invested)}`).join(' ');
  const actualPath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.actual)}`).join(' ');

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-6">
         <ReportHeader title="Säule 3a Performance" subtitle="Einzahlungen im Vergleich zum echten Marktwert" isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Total Investiert</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{fCur ? fCur(latestData.invested, 'CHF') : latestData.invested}</div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Aktueller Wert</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur ? fCur(latestData.actual, 'CHF') : latestData.actual}</div>
         </div>
         <div className={`border p-6 rounded-2xl shadow-sm ${isPositive ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Gewinn / Verlust</div>
            <div className={`text-2xl font-black ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
               {latestData.profit > 0 ? '+' : ''}{fCur ? fCur(latestData.profit, 'CHF') : latestData.profit}
            </div>
         </div>
         <div className={`border p-6 rounded-2xl shadow-sm ${isPositive ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Rendite (ROI)</div>
            <div className={`text-2xl font-black ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
               {latestData.roi > 0 ? '+' : ''}{latestData.roi.toFixed(2)} %
            </div>
         </div>
      </div>

      {dataPoints.length > 1 && (
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Icon name="TrendingUp" className="text-blue-500" /> Wertentwicklung (Kurve)</h3>
            <div className="w-full overflow-x-auto">
               <svg viewBox={`0 0 1000 ${chartHeight}`} className="w-full min-w-[600px] h-auto drop-shadow-sm">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                      <line key={pct} x1={padding} y1={padding + pct * (chartHeight - padding*2)} x2={1000 - padding} y2={padding + pct * (chartHeight - padding*2)} stroke="currentColor" strokeDasharray="4 4" className="text-gray-200 dark:text-slate-700" strokeWidth="1" />
                  ))}
                  
                  {/* Investiert Line */}
                  <path d={investedPath} fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="6 6" />
                  {dataPoints.map((d, i) => <circle key={`inv-${i}`} cx={getX(i)} cy={getY(d.invested)} r="4" fill="#94a3b8" />)}

                  {/* Actual Line */}
                  <path d={actualPath} fill="none" stroke={isPositive ? "#10b981" : "#3b82f6"} strokeWidth="4" />
                  {dataPoints.map((d, i) => <circle key={`act-${i}`} cx={getX(i)} cy={getY(d.actual)} r="5" fill={isPositive ? "#10b981" : "#3b82f6"} className="drop-shadow-md" />)}
                  
                  {/* X-Axis Labels */}
                  {dataPoints.map((d, i) => (
                      <text key={`lbl-${i}`} x={getX(i)} y={chartHeight - 2} fontSize="12" fill="currentColor" textAnchor="middle" className="text-gray-500 dark:text-gray-400 font-medium">
                          {d.year}
                      </text>
                  ))}
               </svg>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm font-medium">
                <div className="flex items-center gap-2"><div className="w-4 h-1 border-t-2 border-dashed border-slate-400"></div> <span className="text-slate-600 dark:text-slate-400">Kumulierte Einzahlungen</span></div>
                <div className="flex items-center gap-2"><div className={`w-4 h-1 border-t-2 ${isPositive ? 'border-emerald-500' : 'border-blue-500'}`}></div> <span className="text-slate-600 dark:text-slate-400">Tatsächlicher Wert</span></div>
            </div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             Historische Datenpunkte
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                     <th className="px-6 py-4">Jahr (Stichtag)</th>
                     <th className="px-6 py-4 text-right">Investiert (Einzahlungen)</th>
                     <th className="px-6 py-4 text-right">Marktwert</th>
                     <th className="px-6 py-4 text-right">Differenz</th>
                     <th className="px-6 py-4 text-right">Rendite</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {dataPoints.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200">{d.year === currentYear ? `${d.year} (Heute)` : `${d.year} (31.12)`}</td>
                          <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fCur ? fCur(d.invested, 'CHF') : d.invested}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur ? fCur(d.actual, 'CHF') : d.actual}</td>
                          <td className={`px-6 py-3 text-right font-mono font-bold ${d.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {d.profit > 0 ? '+' : ''}{fCur ? fCur(d.profit, 'CHF') : d.profit}
                          </td>
                          <td className={`px-6 py-3 text-right font-bold ${d.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {d.roi > 0 ? '+' : ''}{d.roi.toFixed(2)} %
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

module.exports = PensionPerformanceReport;