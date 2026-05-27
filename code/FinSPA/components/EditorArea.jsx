const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const { getAllAssets = (banks) => [], getAssetValueAtDate = () => 0, getAssetRawValueAtDate = () => 0 } = DataEngine;

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
const AssetOverviewReport = safeRequire('./reports/AssetOverviewReport.jsx') || (() => <div>AssetOverviewReport</div>);
const PensionPerformanceReport = safeRequire('./reports/PensionPerformanceReport.jsx') || (() => <div>PensionPerformanceReport</div>);
const SecuritiesPerformanceReport = safeRequire('./reports/SecuritiesPerformanceReport.jsx') || (() => <div>SecuritiesPerformanceReport</div>);
const AiDashboard = safeRequire('./ai/AiDashboard.jsx') || (() => <div className="p-8 text-center">AiDashboard.jsx fehlt</div>);
const UniversalChart = require('../../api/UniversalChart.jsx');


const EditorArea = ({ data, viewMode, activeReport, selectedNode, setSelectedNode, isTreeVisible, setIsTreeVisible, showArchived, dateRange, setDateRange, setModalObj, updateTreeData, fCur, t }) => {
  const allAssets = getAllAssets(data?.banks || []) || [];
  const activeAssets = showArchived ? allAssets : allAssets.filter(a => !a?.isArchived);

  // Aktive Chart-Engine aus den Einstellungen auslesen (Fallback auf 'echarts')
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

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

 if (viewMode === 'ai') {
      const AiDashboard = safeRequire('./ai/AiDashboard.jsx') || (() => <div className="p-8 text-center">AiDashboard.jsx fehlt</div>);
      return <AiDashboard data={data} fCur={fCur} t={t} setModalObj={setModalObj} updateTreeData={updateTreeData} />;
  }

  if (activeReport) {
    const viewContent = () => {
      switch(activeReport) {
        case 'overview': return <AssetOverviewReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'allocation': return <AllocationReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'liquidity': return <LiquidityReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'history': return <HistoryReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'tax': return <TaxReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'categoryFlow': return <CategoryFlowReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'waterfall': return <WaterfallReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'passive': return <PassiveIncomeReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'topFlow': return <TopFlowReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'bookingAnalysis': return <BookingAnalysisReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'future': return <FutureReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'scenarios': return <ScenariosReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} setModalObj={setModalObj} fCur={fCur} t={t} />;
        case 'pension3a': return <PensionPerformanceReport data={data} activeAssets={activeAssets} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'securities': return <SecuritiesPerformanceReport data={data} activeAssets={activeAssets} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;

        default: return <div className="text-gray-500">{t ? t('reportLoading') : 'Report wird geladen...'}</div>;
      }
    };
    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
        <div className="print-hide flex justify-end mb-4">
           <div className="flex items-center gap-3 bg-gray-50 border px-4 py-2 rounded-lg text-sm shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <Icon name="Calendar" className="text-gray-400"/>
             <span className="text-gray-500 font-medium">{t ? t('dateRangeTitle') : 'Zeitraum:'}</span>
             <input type="date" value={dateRange?.from || ''} onChange={e=>setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"/>
             <span>-</span>
             <input type="date" value={dateRange?.to || ''} onChange={e=>setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"/>
           </div>
        </div>
        {viewContent()}
      </div>
    );
  }
  
  if (viewMode === 'budget' && !selectedNode && !activeReport) return <BudgetDashboard data={data} fCur={fCur} t={t} />;

  if (viewMode === 'vermoegen' && !selectedNode && !activeReport) {
      return <AssetOverviewReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
  }
  
  if (selectedNode) {
    if (selectedNode.budgetType) return <BudgetEditor selectedNode={selectedNode} fCur={fCur} t={t} />;
  
    if (selectedNode.type === 'bank' || selectedNode.type === 'category') {
      const analyzeStructure = (node, currentCategory = (t ? t('mainPortfolio') : 'Hauptportfolio')) => {
        let items = [];
        
        if (node.type === 'category') {
          currentCategory = node.name;
        }
        
        if (node.type === 'asset') {
          if (node.isArchived && !showArchived) return [];

          const baseVal = getAssetValueAtDate(node, new Date().toISOString().split('T')[0], activeAssets) || 0;
          const origVal = getAssetRawValueAtDate(node, new Date().toISOString().split('T')[0]);

          const subCatKey = node.assetClass || 'cash';
          const subCategoryName = t ? (t(`ac${subCatKey.charAt(0).toUpperCase() + subCatKey.slice(1)}`) || subCatKey.toUpperCase()) : subCatKey.toUpperCase();

          items.push({
            id: node.id,
            name: node.name,
            category: currentCategory,
            subCategory: subCategoryName,
            valueInBase: baseVal,
            originalValue: origVal,
            currency: node.currency
          });
        }
        
        if (node.children) {
          node.children.forEach(child => {
            items = items.concat(analyzeStructure(child, currentCategory));
          });
        }
        return items;
      };

      const allBankAssets = analyzeStructure(selectedNode, selectedNode.name);
      const totalBankValue = allBankAssets.reduce((sum, item) => sum + item.valueInBase, 0);

      const categoryMap = {};
      const subCategoryMap = {};

      allBankAssets.forEach(item => {
        if (!categoryMap[item.category]) categoryMap[item.category] = 0;
        categoryMap[item.category] += item.valueInBase;

        const subKey = `${item.category} → ${item.subCategory}`;
        if (!subCategoryMap[subKey]) subCategoryMap[subKey] = 0;
        subCategoryMap[subKey] += item.valueInBase;
      });

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4'];
      const chartDataCategories = Object.keys(categoryMap).map((key, idx) => ({
        label: key,
        value: categoryMap[key],
        color: colors[idx % colors.length]
      })).filter(d => d.value > 0);

      const isBank = selectedNode.type === 'bank';
      const headerIcon = isBank ? "Shield" : "FolderOpen";
      const headerSubtitle = isBank 
        ? (t ? t('consWealthOverview') : 'Konsolidierte Vermögensübersicht (Währungsbereinigt)')
        : (t ? t('allocByCat') || 'Kategorie-Übersicht und enthaltene Assets' : 'Kategorie-Übersicht und enthaltene Assets');

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-slate-800 pb-6 mb-6 gap-4">
            <div>
              <h2 className="text-3xl font-black flex items-center gap-3">
                {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                <Icon name={headerIcon} className={isBank ? "text-slate-500" : "text-yellow-500"} />
                {selectedNode.name}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{headerSubtitle}</p>
            </div>
            <div className="text-left sm:text-right flex flex-col justify-center items-start sm:items-end shrink-0 min-w-[180px]">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                {t ? t('totalValue') : 'Gesamtwert'}
              </span>
              <span className="text-3xl font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl block shadow-sm whitespace-nowrap">
                {fCur ? fCur(totalBankValue, 'CHF') : totalBankValue}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="xl:col-span-2 space-y-6">
              {Object.keys(categoryMap).map(categoryName => {
                const categoryItems = allBankAssets.filter(a => a.category === categoryName);
                const categoryTotal = categoryMap[categoryName];
                
                return (
                  <div key={categoryName} className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-800/80 p-5 shadow-sm">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800 pb-3 mb-4">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Icon name="FolderOpen" className="text-yellow-500" size={18} />
                        {categoryName}
                      </h3>
                      <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-3 py-1 rounded-md border text-sm shadow-sm">
                        {fCur ? fCur(categoryTotal, 'CHF') : categoryTotal} ({totalBankValue > 0 ? ((categoryTotal / totalBankValue) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {categoryItems.map(asset => (
                        <div key={asset.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-100 dark:border-slate-800 flex justify-between items-center hover:shadow-sm transition-shadow">
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">{asset.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                              <span className="uppercase font-semibold tracking-wider px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px]">
                                {asset.subCategory}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black font-mono text-slate-900 dark:text-white">{fCur ? fCur(asset.valueInBase, 'CHF') : asset.valueInBase}</div>
                            {asset.currency !== 'CHF' && (
                              <div className="text-xs text-gray-400 font-mono">
                                {fCur ? fCur(asset.originalValue, asset.currency) : `${asset.originalValue} ${asset.currency}`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 flex flex-col items-center">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 self-start mb-6 flex items-center gap-2">
                  <Icon name="PieChart" /> {t ? t('allocByCat') : 'Aufteilung nach Kategorien'}
                </h3>
                {chartDataCategories.length > 0 ? (
                  <UniversalChart 
                    engine={activeChartEngine}
                    type="doughnut" 
                    height="280px"
                    labels={chartDataCategories.map(d => d.label)}
                    datasets={[{
                      label: t ? t('totalValue') : 'Gesamtwert',
                      data: chartDataCategories.map(d => d.value)
                    }]}
                  />
                ) : (
                  <div className="text-gray-400 py-12 text-center text-sm">{t ? t('noValuedAssets') : 'Keine bewerteten Assets vorhanden.'}</div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
                <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-1">
                  <Icon name="List" size={12} /> {t ? t('subcatTotals') : 'Subkategorien-Summen'}
                </h4>
                <div className="space-y-2 divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                  {Object.keys(subCategoryMap).sort((a,b) => subCategoryMap[b] - subCategoryMap[a]).map(subKey => (
                    <div key={subKey} className="flex justify-between items-center pt-2 first:pt-0">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{subKey}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{fCur ? fCur(subCategoryMap[subKey], 'CHF') : subCategoryMap[subKey]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'asset') {
      const baseCurrency = data?.settings?.baseCurrency || 'CHF';
      const isForeignCurrency = selectedNode.currency && selectedNode.currency !== baseCurrency;
      
      const currentVal = getAssetValueAtDate(selectedNode, new Date().toISOString().split('T')[0], activeAssets);
      const rawSum = getAssetRawValueAtDate(selectedNode, new Date().toISOString().split('T')[0]);

      let defaultType = 'Einzahlung'; 
      const ac = selectedNode.assetClass;
      
      if (ac === 'realestate') defaultType = 'Wertanpassung';
      else if (ac === 'mortgage') defaultType = 'Abzahlung';
      else if (ac === 'stock' || ac === 'fund' || ac === 'crypto' || ac === 'pension_fund' || ac === 'pension_3a_fund') defaultType = 'Kauf';

      // NEU: Schnelles Löschen ohne Nachfrage direkt aus der Tabelle
      const handleDeleteEntry = (itemToDelete, e) => {
          e.stopPropagation(); // Verhindert, dass die Zeile angewählt wird und der PropertyEditor öffnet

          const isBal = itemToDelete._isBal;
          
          // 1. Globalen State aktualisieren
          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) {
                  if (isBal) {
                      return { ...n, balances: (n.balances || []).filter(b => b.id !== itemToDelete.id) };
                  } else {
                      return { ...n, bookings: (n.bookings || []).filter(b => b.id !== itemToDelete.id) };
                  }
              }
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });
          
          updateTreeData({ banks: updateRecursive(data.banks) });

          // 2. Lokalen selectedNode State sofort aktualisieren für direktes UI-Feedback
          const updatedNode = { ...selectedNode };
          if (isBal) {
              updatedNode.balances = (updatedNode.balances || []).filter(b => b.id !== itemToDelete.id);
          } else {
              updatedNode.bookings = (updatedNode.bookings || []).filter(b => b.id !== itemToDelete.id);
          }
          
          // Falls die gelöschte Buchung gerade offen war, schließen wir sie im Editor
          if (updatedNode.selectedBooking?.id === itemToDelete.id) {
              updatedNode.selectedBooking = null;
          }
          
          setSelectedNode(updatedNode);
      };

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto">
          <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-6 mb-6">
             <div>
               <h2 className="text-3xl font-black flex items-center gap-3">
                 {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                 <Icon name="DollarSign" className="text-green-500"/>
                 {selectedNode.name} {selectedNode.isArchived && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{t ? t('isArchived') : 'Archiviert'}</span>}
               </h2>
               <div className="flex gap-6 mt-3 text-sm items-center">
                 <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">{t ? t('assetClassLabel') : 'Klasse:'} <span className="uppercase">{selectedNode.assetClass}</span></span>
                 
                 <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 px-3 py-1 rounded-full font-bold flex items-center gap-2">
                    {t ? t('valueToday') : 'Wert (Heute):'} {fCur ? fCur(currentVal, baseCurrency) : currentVal}
                    {isForeignCurrency && (
                        <span className="text-xs font-medium opacity-60">
                            ({fCur ? fCur(rawSum, selectedNode.currency) : rawSum})
                        </span>
                    )}
                 </span>
               </div>
             </div>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-[300px]">
            <div className="print-hide bg-gray-50 dark:bg-slate-800 p-4 border-b flex gap-3">
              <button onClick={()=>setModalObj({type:'addBooking', assetId: selectedNode.id, defaultType})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm"><Icon name="Plus"/> {t ? t('addBookingBtn') : 'Buchung erfassen'}</button>
              <button onClick={()=>setModalObj({type:'addBalance', assetId: selectedNode.id})} className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"><Icon name="Calendar"/> {t ? t('addBalanceBtn') : 'Stichtags-Saldo setzen'}</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 border-b">
                  <tr>
                    <th className="p-4 border-b">{t ? t('date') : 'Datum'}</th>
                    <th className="p-4 border-b">{t ? t('entryType') : 'Eintrag'}</th>
                    <th className="p-4 border-b">{t ? t('entryDetail') : 'Detail'}</th>
                    <th className="p-4 text-right border-b">{t ? t('amount') : 'Betrag'}</th>
                    <th className="p-4 border-b print-hide w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {[...(selectedNode.balances || []).map(b=>({...b, _isBal:true})), ...(selectedNode.bookings || [])]
                    .sort((a,b)=>new Date(b.date)-new Date(a.date))
                    .map(item => {
                    const isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
                    const badgeColor = item._isBal ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : (isPositiveType ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300');
                    const amountColor = item._isBal ? 'text-blue-600' : (isPositiveType ? 'text-green-600' : 'text-red-600');
                    const prefix = !item._isBal ? (isPositiveType ? '+' : '-') : '';
                    let details = item._isBal ? (t ? t('systemManual') : 'System/Manuell') : (item.subCategory || '');
                    
                    let typeLabel = item.type;
                    if (!item._isBal) {
                     const typeMap = {
                      'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 
                      'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 
                      'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee',
                      'Umbuchung': 'typeTransfer'
                    };
                      if (typeMap[item.type] && t) {
                        typeLabel = t(typeMap[item.type]);
                      }
                    }

                    if (!item._isBal && ['Kauf', 'Verkauf', 'Dividende'].includes(item.type) && item.shares) {
                      details += ` (${item.shares} ${t ? t('pcsAt') : 'Stk. à'} ${item.price})`;
                    }
                    if (item.bookingExchangeRate && item.bookingExchangeRate !== 1) {
                      details += ` [${t ? t('rateLabel') : 'Kurs:'} ${item.bookingExchangeRate}]`;
                    }
                    
                    const usedRate = item.bookingExchangeRate || selectedNode.exchangeRate || 1;
                    
                    return (
                    <tr 
                      key={item.id} 
                      className={`cursor-pointer ${selectedNode?.selectedBooking?.id === item.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`} 
                      onClick={() => {
                        if (setSelectedNode) {
                          setSelectedNode({ ...selectedNode, selectedBooking: item });
                        }
                      }}
                    >
                      <td className="p-4 text-gray-600 dark:text-gray-400">{item.date}</td>
                      <td className="p-4">{item._isBal ? <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}><Icon name="Activity" size={10}/> {t ? t('balanceLabel') : 'SALDO'}</span> : <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}>{typeLabel}</span>}</td>
                      <td className="p-4 font-medium text-gray-600 dark:text-gray-400">{details}</td>
                      
                      <td className={`p-4 text-right font-black flex flex-col items-end ${amountColor}`}>
                        <span>{prefix}{fCur ? fCur(item.amount, selectedNode.currency) : item.amount}</span>
                        {isForeignCurrency && (
                            <span className="text-[10px] opacity-50 font-medium tracking-wide mt-0.5">
                                ≈ {fCur ? fCur(item.amount * usedRate, baseCurrency) : (item.amount * usedRate)}
                            </span>
                        )}
                      </td>
                      
                      <td 
                        className="p-4 text-center print-hide text-gray-400 hover:text-red-500 transition-colors" 
                        onClick={(e) => handleDeleteEntry(item, e)}
                        title={t ? t('btnDelete') : 'Löschen'}
                      >
                        <Icon name="Trash" size={14}/>
                      </td>
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
        <h2 className="text-2xl font-bold mb-2">{t ? t('viewTitle') : 'Ansicht:'} {selectedNode?.name}</h2>
        <p className="text-gray-500 max-w-md">{t ? t('selectAssetPrompt') : 'Wähle auf der linken Seite ein Asset aus, um die detaillierten Buchungen zu sehen.'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="text-center text-gray-400">
        <Icon name="PieChart" size={64} className="mx-auto mb-6 opacity-20 text-blue-500" />
        <h2 className="text-2xl font-bold mb-2 text-gray-600 dark:text-gray-300">{t ? t('welcomeTitle') : 'Willkommen in FinSPA'}</h2>
        <p>{t ? t('welcomePrompt') : 'Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.'}</p>
      </div>
    </div>
  );
};

module.exports = EditorArea;