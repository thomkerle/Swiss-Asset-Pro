const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);

const SecuritiesPerformanceReport = ({ data, activeAssets, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  // Filtern auf reine Aktien und Fonds (Säule 3a, Krypto, Immos etc. explizit ausgeschlossen)
  const securitiesAssets = (activeAssets || []).filter(a => ['stock', 'fund'].includes(a.assetClass));

  if (securitiesAssets.length === 0) {
    return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
        <ReportHeader title="Aktien & Fonds Performance" subtitle="Entwicklung des freien Portfolios" isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
        <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
          <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
          <p>Keine Aktien oder Fonds gefunden.</p>
          <p className="text-sm mt-2">Lege ein Asset mit der Anlageklasse "Aktie" oder "Fonds / ETF" an.</p>
        </div>
      </div>
    );
  }

  // 1. Frühestes Datum finden
  let earliestDate = new Date().toISOString().split('T')[0];
  securitiesAssets.forEach(asset => {
      (asset.balances || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
      (asset.bookings || []).forEach(b => { if (b.date < earliestDate) earliestDate = b.date; });
  });

  const startYear = new Date(earliestDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Messpunkte generieren (Jedes Jahresende + Heute)
  const dataPoints = [];
  
  const calculateInvestedAndDividends = (asset, targetDate) => {
      let invested = 0;
      let dividends = 0;
      let baseDate = '1970-01-01';
      let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
      let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
      
      if (applicableBalance) {
          invested = applicableBalance.amount;
          baseDate = applicableBalance.date;
      }

      (asset.bookings || []).forEach(bk => {
          if (bk.date <= targetDate) {
              // Dividenden kumulieren (unabhängig vom Balance-Reset, um die Total Return zu sehen)
              if (bk.type === 'Dividende') dividends += Number(bk.amount);
          }

          if (bk.date > baseDate && bk.date <= targetDate) {
              // Kapitalflüsse (Käufe erhöhen das investierte Kapital, Verkäufe senken es)
              if (['Kauf', 'Einzahlung'].includes(bk.type)) invested += Number(bk.amount);
              if (['Verkauf', 'Auszahlung'].includes(bk.type)) invested -= Number(bk.amount);
          }
      });
      
      // Globaler Fallback für Währung
      let applicableRate = applicableBalance?.bookingExchangeRate || asset.exchangeRate || 1;
      
      // Rückwärts-Suchlauf für den Kurs analog zur DataEngine
      if (applicableRate === 1 && asset.currency && asset.currency !== 'CHF') {
           activeAssets.forEach(other => {
                if (other.currency === asset.currency && other.exchangeRate && other.exchangeRate !== 1) {
                    applicableRate = other.exchangeRate;
                }
           });
      }

      return { invested: invested * applicableRate, dividends: dividends * applicableRate };
  };

  for (let y = startYear; y <= currentYear; y++) {
      const isCurrentYear = y === currentYear;
      const targetDate = isCurrentYear ? todayStr : `${y}-12-31`;
      
      let totalInvested = 0;
      let totalActual = 0;
      let totalDividends = 0;

      securitiesAssets.forEach(asset => {
          const stats = calculateInvestedAndDividends(asset, targetDate);
          totalInvested += stats.invested;
          totalDividends += stats.dividends;
          totalActual += getAssetValueAtDate(asset, targetDate, activeAssets);
      });

      if (totalInvested > 0 || totalActual > 0) {
          // Reiner Kursgewinn (Price Return)
          const priceProfit = totalActual - totalInvested;
          const priceRoi = totalInvested > 0 ? (priceProfit / totalInvested) * 100 : 0;
          
          // Gesamtrendite (Total Return = Kursgewinn + Dividenden)
          const totalProfit = priceProfit + totalDividends;
          const totalRoi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

          dataPoints.push({
              year: y,
              dateStr: targetDate,
              invested: totalInvested,
              actual: totalActual,
              dividends: totalDividends,
              priceProfit: priceProfit,
              priceRoi: priceRoi,
              profit: totalProfit,
              roi: totalRoi
          });
      }
  }

  const latestData = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : { invested: 0, actual: 0, profit: 0, roi: 0, dividends: 0, priceProfit: 0, priceRoi: 0 };

  // 3. SVG Chart-Berechnung
  const chartHeight = 320;
  const padding = 20;
  const minVal = Math.min(0, ...dataPoints.map(d => Math.min(d.invested, d.actual)));
  // Max-Wert berücksichtigt nun auch die neue Total Return Linie (Marktwert + Dividenden)
  const maxVal = Math.max(...dataPoints.map(d => Math.max(d.invested, d.actual, d.actual + d.dividends))) * 1.1; 
  const range = maxVal - minVal || 1;

  const getY = (val) => chartHeight - padding - ((val - minVal) / range) * (chartHeight - padding * 2);
  const getX = (index) => padding + (index * ((1000 - padding * 2) / Math.max(1, dataPoints.length - 1)));

  const investedPath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.invested)}`).join(' ');
  const actualPath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.actual)}`).join(' ');
  const totalReturnPath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.actual + d.dividends)}`).join(' ');

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-6">
         <ReportHeader title="Aktien & Fonds Performance" subtitle="Rendite-Analyse des freien Markt-Portfolios (ohne Säule 3a)" isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Netto Investiert</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{fCur ? fCur(latestData.invested, 'CHF') : latestData.invested}</div>
            <div className="text-xs text-gray-400 mt-2">Summe aller Käufe minus Verkäufe</div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Marktwert Heute</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{fCur ? fCur(latestData.actual, 'CHF') : latestData.actual}</div>
         </div>
         
         {/* Kachel 3: Reiner Kursgewinn (Price Return) */}
         <div className={`border p-6 rounded-2xl shadow-sm ${latestData.priceProfit >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Kursgewinn (Price Return)</div>
            <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.priceProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
               {latestData.priceProfit > 0 ? '+' : ''}{fCur ? fCur(latestData.priceProfit, 'CHF') : latestData.priceProfit}
               <span className="text-sm font-medium opacity-70">({latestData.priceRoi > 0 ? '+' : ''}{latestData.priceRoi.toFixed(2)}%)</span>
            </div>
         </div>
         
         {/* Kachel 4: Gesamtrendite (Total Return) */}
         <div className={`border p-6 rounded-2xl shadow-sm ${latestData.profit >= 0 ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>Total Return (inkl. Div)</div>
            <div className={`text-2xl font-black flex items-baseline gap-2 ${latestData.profit >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-orange-700 dark:text-orange-400'}`}>
               {latestData.profit > 0 ? '+' : ''}{fCur ? fCur(latestData.profit, 'CHF') : latestData.profit}
               <span className="text-sm font-medium opacity-70">({latestData.roi > 0 ? '+' : ''}{latestData.roi.toFixed(2)}%)</span>
            </div>
         </div>
      </div>

      {dataPoints.length > 1 && (
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2"><Icon name="TrendingUp" className="text-blue-500" /> Wertentwicklung (Kurve)</h3>
            </div>
            
            <div className="w-full overflow-x-auto">
               <svg viewBox={`0 0 1000 ${chartHeight}`} className="w-full min-w-[600px] h-auto drop-shadow-sm">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                      <line key={pct} x1={padding} y1={padding + pct * (chartHeight - padding*2)} x2={1000 - padding} y2={padding + pct * (chartHeight - padding*2)} stroke="currentColor" strokeDasharray="4 4" className="text-gray-200 dark:text-slate-700" strokeWidth="1" />
                  ))}
                  
                  {/* Investiert Line */}
                  <path d={investedPath} fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="6 6" />
                  {dataPoints.map((d, i) => <circle key={`inv-${i}`} cx={getX(i)} cy={getY(d.invested)} r="4" fill="#94a3b8" />)}

                  {/* Total Return Line (Marktwert + Dividenden) */}
                  <path d={totalReturnPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="4 4" />
                  {dataPoints.map((d, i) => <circle key={`tot-${i}`} cx={getX(i)} cy={getY(d.actual + d.dividends)} r="3" fill="#6366f1" />)}

                  {/* Actual Line (Reiner Marktwert) */}
                  <path d={actualPath} fill="none" stroke={latestData.priceProfit >= 0 ? "#10b981" : "#3b82f6"} strokeWidth="4" />
                  {dataPoints.map((d, i) => <circle key={`act-${i}`} cx={getX(i)} cy={getY(d.actual)} r="5" fill={latestData.priceProfit >= 0 ? "#10b981" : "#3b82f6"} className="drop-shadow-md" />)}
                  
                  {/* X-Axis Labels */}
                  {dataPoints.map((d, i) => (
                      <text key={`lbl-${i}`} x={getX(i)} y={chartHeight - 2} fontSize="12" fill="currentColor" textAnchor="middle" className="text-gray-500 dark:text-gray-400 font-medium">
                          {d.year}
                      </text>
                  ))}
               </svg>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm font-medium">
                <div className="flex items-center gap-2"><div className="w-4 h-1 border-t-2 border-dashed border-slate-400"></div> <span className="text-slate-600 dark:text-slate-400">Netto Investiert</span></div>
                <div className="flex items-center gap-2"><div className={`w-4 h-1 border-t-2 ${latestData.priceProfit >= 0 ? 'border-emerald-500' : 'border-blue-500'}`}></div> <span className="text-slate-600 dark:text-slate-400">Marktwert</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-1 border-t-2 border-dashed border-indigo-500"></div> <span className="text-slate-600 dark:text-slate-400">Total Value (inkl. Div)</span></div>
            </div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 font-bold text-gray-700 dark:text-gray-300">
             Historische Datenpunkte & Renditen
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                     <th className="px-6 py-4">Jahr (Stichtag)</th>
                     <th className="px-6 py-4 text-right">Investiert</th>
                     <th className="px-6 py-4 text-right">Marktwert</th>
                     <th className="px-6 py-4 text-right">Kursgewinn</th>
                     <th className="px-6 py-4 text-right text-blue-600 dark:text-blue-400">Dividenden</th>
                     <th className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 font-bold">Total Return</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {dataPoints.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200">{d.year === currentYear ? `${d.year} (Heute)` : `${d.year} (31.12)`}</td>
                          <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fCur ? fCur(d.invested, 'CHF') : d.invested}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur ? fCur(d.actual, 'CHF') : d.actual}</td>
                          
                          <td className={`px-6 py-3 text-right font-mono ${d.priceProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {d.priceProfit > 0 ? '+' : ''}{fCur ? fCur(d.priceProfit, 'CHF') : d.priceProfit} <span className="text-[10px]">({d.priceRoi > 0 ? '+' : ''}{d.priceRoi.toFixed(1)}%)</span>
                          </td>
                          
                          <td className="px-6 py-3 text-right font-mono text-blue-600 dark:text-blue-400">+{fCur ? fCur(d.dividends, 'CHF') : d.dividends}</td>
                          
                          <td className={`px-6 py-3 text-right font-bold ${d.profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
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

module.exports = SecuritiesPerformanceReport;