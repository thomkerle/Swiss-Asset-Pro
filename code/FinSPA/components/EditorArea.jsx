const React = require('react');

// Umgehung für den statischen Bundler, damit die Imports nicht fehlschlagen
const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const { getAllAssets = (banks) => [], getAssetValueAtDate = () => 0 } = DataEngine;

const AllocationReport = safeRequire('./reports/AllocationReport.jsx') || (() => <div>AllocationReport</div>);
const LiquidityReport = safeRequire('./reports/LiquidityReport.jsx') || (() => <div>LiquidityReport</div>);
const HistoryReport = safeRequire('./reports/HistoryReport.jsx') || (() => <div>HistoryReport</div>);
const TaxReport = safeRequire('./reports/TaxReport.jsx') || (() => <div>TaxReport</div>);
const CategoryFlowReport = safeRequire('./reports/CategoryFlowReport.jsx') || (() => <div>CategoryFlowReport</div>);
const WaterfallReport = safeRequire('./reports/WaterfallReport.jsx') || (() => <div>WaterfallReport</div>);
const PassiveIncomeReport = safeRequire('./reports/PassiveIncomeReport.jsx') || (() => <div>PassiveIncomeReport</div>);
const TopFlowReport = safeRequire('./reports/TopFlowReport.jsx') || (() => <div>TopFlowReport</div>);
const BookingAnalysisReport = safeRequire('./reports/BookingAnalysisReport.jsx') || (() => <div>BookingAnalysisReport</div>);
const FutureReport = safeRequire('./reports/FutureReport.jsx') || (() => <div>FutureReport</div>);
const ScenariosReport = safeRequire('./reports/ScenariosReport.jsx') || (() => <div>ScenariosReport</div>);
const BudgetDashboard = safeRequire('./budget/BudgetDashboard.jsx') || (() => <div>BudgetDashboard</div>);
const BudgetEditor = safeRequire('./budget/BudgetEditor.jsx') || (() => <div>BudgetEditor</div>);

const EditorArea = ({ data, viewMode, activeReport, selectedNode, isTreeVisible, setIsTreeVisible, showArchived, dateRange, setDateRange, setModalObj, fCur, t }) => {
  // Sicherheits-Check: data.banks absichern, falls es noch nicht existiert
  const allAssets = getAllAssets(data?.banks || []) || [];
  const activeAssets = showArchived ? allAssets : allAssets.filter(a => !a?.isArchived);

  if (viewMode === 'datensicht') {
    return (
      <div className="p-6 h-full flex flex-col bg-white dark:bg-slate-950">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Icon name="Settings" className="text-gray-400"/> {t ? t('viewData') : 'Datensicht'}</h2>
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-900 rounded-lg border dark:border-slate-800 p-4 font-mono text-xs text-gray-800 dark:text-gray-300 shadow-inner">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (activeReport) {
    const viewContent = () => {
      switch(activeReport) {
        case 'allocation': return <AllocationReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'liquidity': return <LiquidityReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'history': return <HistoryReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'tax': return <TaxReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'categoryFlow': return <CategoryFlowReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'waterfall': return <WaterfallReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'passive': return <PassiveIncomeReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'topFlow': return <TopFlowReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'bookingAnalysis': return <BookingAnalysisReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'future': return <FutureReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} />;
        case 'scenarios': return <ScenariosReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} setModalObj={setModalObj} fCur={fCur} />;
        default: return <div className="text-gray-500">Report wird geladen...</div>;
      }
    };
    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
        <div className="print-hide flex justify-end mb-4">
           <div className="flex items-center gap-3 bg-gray-50 border px-4 py-2 rounded-lg text-sm shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <Icon name="Calendar" className="text-gray-400"/>
             <span className="text-gray-500 font-medium">Zeitraum:</span>
             <input type="date" value={dateRange?.from || ''} onChange={e=>setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"/>
             <span>-</span>
             <input type="date" value={dateRange?.to || ''} onChange={e=>setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"/>
           </div>
        </div>
        {viewContent()}
      </div>
    );
  }
  
  if (viewMode === 'budget' && !selectedNode && !activeReport) return <BudgetDashboard data={data} fCur={fCur} />;
  
  if (selectedNode) {
    if (selectedNode.budgetType) return <BudgetEditor selectedNode={selectedNode} fCur={fCur} />;
  
    if (selectedNode.type === 'asset') {
      const currentVal = getAssetValueAtDate(selectedNode, new Date().toISOString().split('T')[0]);
      let defaultType = 'Einzahlung'; 
      const ac = selectedNode.assetClass;
      
      if (ac === 'realestate') defaultType = 'Wertanpassung';
      else if (ac === 'mortgage') defaultType = 'Abzahlung';
      else if (ac === 'stock' || ac === 'fund' || ac === 'crypto' || ac === 'pension_fund') defaultType = 'Kauf';

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto">
          <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-6 mb-6">
             <div>
               <h2 className="text-3xl font-black flex items-center gap-3">
                 {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                 <Icon name="DollarSign" className="text-green-500"/>
                 {selectedNode.name} {selectedNode.isArchived && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Archiviert</span>}
               </h2>
               <div className="flex gap-6 mt-3 text-sm">
                 <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">Klasse: <span className="uppercase">{selectedNode.assetClass}</span></span>
                 <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 px-3 py-1 rounded-full font-bold">Wert (Heute): {fCur ? fCur(currentVal, selectedNode.currency) : currentVal}</span>
               </div>
             </div>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-[300px]">
            <div className="print-hide bg-gray-50 dark:bg-slate-800 p-4 border-b flex gap-3">
              <button onClick={()=>setModalObj({type:'addBooking', assetId: selectedNode.id, defaultType})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm"><Icon name="Plus"/> Buchung erfassen</button>
              <button onClick={()=>setModalObj({type:'addBalance', assetId: selectedNode.id})} className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"><Icon name="Calendar"/> Stichtags-Saldo setzen</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 border-b">
                  <tr><th className="p-4 border-b">Datum</th><th className="p-4 border-b">Eintrag</th><th className="p-4 border-b">Detail</th><th className="p-4 text-right border-b">Betrag</th><th className="p-4 border-b print-hide w-10"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {/* Sicherer Aufruf von balances und bookings */}
                  {[...(selectedNode.balances || []).map(b=>({...b, _isBal:true})), ...(selectedNode.bookings || [])]
                    .sort((a,b)=>new Date(b.date)-new Date(a.date))
                    .map(item => {
                    const isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
                    const badgeColor = item._isBal ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : (isPositiveType ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300');
                    const amountColor = item._isBal ? 'text-blue-600' : (isPositiveType ? 'text-green-600' : 'text-red-600');
                    const prefix = !item._isBal ? (isPositiveType ? '+' : '-') : '';
                    let details = item._isBal ? 'System/Manuell' : (item.subCategory || '');
                    if (!item._isBal && ['Kauf', 'Verkauf', 'Dividende'].includes(item.type) && item.shares) details += ` (${item.shares} Stk. à ${item.price})`;
                    if (item.bookingExchangeRate && item.bookingExchangeRate !== 1) details += ` [Kurs: ${item.bookingExchangeRate}]`;
                    
                    return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={()=>setModalObj({type: item._isBal ? 'editBalance' : 'editBooking', assetId: selectedNode.id, item})}>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{item.date}</td>
                      <td className="p-4">{item._isBal ? <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}><Icon name="Activity" size={10}/> SALDO</span> : <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}>{item.type}</span>}</td>
                      <td className="p-4 font-medium text-gray-600 dark:text-gray-400">{details}</td>
                      <td className={`p-4 text-right font-black ${amountColor}`}>{prefix}{fCur ? fCur(item.amount, selectedNode.currency) : item.amount}</td>
                      <td className="p-4 text-center print-hide text-gray-400 hover:text-blue-500"><Icon name="Edit" size={14}/></td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-center">
        <h2 className="text-2xl font-bold mb-2">Ansicht: {selectedNode?.name}</h2>
        <p className="text-gray-500 max-w-md">Wähle auf der linken Seite ein Asset aus, um die detaillierten Buchungen zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="text-center text-gray-400"><Icon name="PieChart" size={64} className="mx-auto mb-6 opacity-20 text-blue-500" /><h2 className="text-2xl font-bold mb-2 text-gray-600 dark:text-gray-300">Willkommen in FinSPA</h2><p>Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.</p></div>
    </div>
  );
};
module.exports = EditorArea;