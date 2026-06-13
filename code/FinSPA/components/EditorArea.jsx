const React = require('react');
const { useState } = React; 

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);

const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const { 
  getAllAssets = (banks) => [], 
  getAssetValueAtDate = () => 0, 
  getAssetRawValueAtDate = () => 0, 
  getAssetSharesAtDate = () => 0, 
  getAssetPriceAtDate = () => 0,
  generateId = () => Math.random().toString(36).substr(2, 9) 
} = DataEngine;

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
const UniversalChart = require('../../api/UniversalChart.jsx');

const EditorArea = ({ data, viewMode, activeReport, selectedNode, setSelectedNode, isTreeVisible, setIsTreeVisible, showArchived, dateRange, setDateRange, modalObj, setModalObj, updateTreeData, fCur, t }) => {
  const allAssets = getAllAssets(data?.banks || []) || [];
  const activeAssets = showArchived ? allAssets : allAssets.filter(a => !a?.isArchived);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';

  const applyAutoValuation = (assetNode) => {
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(assetNode.assetClass);
      if (!isSecurities || !assetNode.bookings) return assetNode;

      let copy = { ...assetNode, bookings: [...assetNode.bookings] };
      
      const localizedAutoString = t ? (t('autoAdjustment') || '') : '';
      copy.bookings = copy.bookings.filter(b => {
          if (b.type !== 'Wertanpassung') return true;
          const sub = b.subCategory || '';
          const isLegacyAuto = sub.includes('Auto-Anpassung') || (localizedAutoString && sub.includes(localizedAutoString));
          return !(b._isAutoValuation || isLegacyAuto);
      });

      copy.bookings.sort((a,b) => new Date(a.date) - new Date(b.date));

      let totalShares = 0;
      let runningInvestedRaw = 0; 
      let finalBookings = [];
      let lastBookingDate = new Date().toISOString().split('T')[0];

      copy.bookings.forEach(b => {
          finalBookings.push(b);
          lastBookingDate = b.date;
          
          const isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(b.type);
          const isNegative = ['Auszahlung', 'Verkauf', 'Gebühr', 'Zinszahlung', 'Schulderhöhung', 'Umbuchung'].includes(b.type);

          if (isPositive) runningInvestedRaw += Number(b.amount);
          else if (isNegative) runningInvestedRaw -= Number(b.amount);

          if (['Kauf', 'Einzahlung', 'Dividende'].includes(b.type) && b.shares) totalShares += Number(b.shares);
          if (['Verkauf', 'Auszahlung'].includes(b.type) && b.shares) totalShares -= Number(b.shares);

          if (['Kauf', 'Verkauf', 'Dividende'].includes(b.type) && Number(b.price) > 0 && totalShares > 0) {
              const expectedMarketValue = totalShares * Number(b.price);
              const diff = expectedMarketValue - runningInvestedRaw;

              if (Math.abs(diff) > 0.01) {
                  const adjAmount = Number(diff.toFixed(2));
                  finalBookings.push({
                      id: Math.random().toString(36).substr(2, 9),
                      date: b.date,
                      type: 'Wertanpassung',
                      subCategory: t ? t('autoAdjustment') || 'Auto-Anpassung (Kurs)' : 'Auto-Anpassung (Kurs)',
                      amount: adjAmount,
                      bookingExchangeRate: b.bookingExchangeRate || assetNode.exchangeRate || 1,
                      _isAutoValuation: true 
                  });
                  runningInvestedRaw += adjAmount; 
              }
          }
      });

      if (totalShares > 0 && Number(assetNode.price) > 0) {
          const expectedCurrentValue = totalShares * Number(assetNode.price);
          const diff = expectedCurrentValue - runningInvestedRaw;

          if (Math.abs(diff) > 0.01) {
              const todayStr = new Date().toISOString().split('T')[0];
              finalBookings.push({
                  id: Math.random().toString(36).substr(2, 9),
                  date: todayStr > lastBookingDate ? todayStr : lastBookingDate,
                  type: 'Wertanpassung',
                  subCategory: t ? t('autoAdjustment') || 'Auto-Anpassung (Aktueller Kurs)' : 'Auto-Anpassung (Aktueller Kurs)',
                  amount: Number(diff.toFixed(2)),
                  bookingExchangeRate: assetNode.exchangeRate || 1,
                  _isAutoValuation: true 
              });
          }
      }

      copy.bookings = finalBookings.sort((a,b) => new Date(b.date) - new Date(a.date));
      return copy;
  };

  if (viewMode === 'datensicht') {
    return (
      <div className="p-6 h-full flex flex-col bg-white dark:bg-slate-950">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Icon name="Settings" className="text-gray-400"/> {t ? t('viewData') : 'Datensicht'}
        </h2>
        <div className="flex-1 overflow-auto finspa-scrollbar bg-gray-50 dark:bg-slate-900 rounded-lg border dark:border-slate-800 p-4 font-mono text-xs text-gray-800 dark:text-gray-300 shadow-inner">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    );
  }

 if (viewMode === 'ai') {
      const AiDashboard = safeRequire('./ai/AiDashboard.jsx') || (() => <div className="p-8 text-center">{t ? t('errAiDashboardMissing') : 'AiDashboard.jsx fehlt'}</div>);
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
        case 'pension3a': return <PensionPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'securities': return <SecuritiesPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;

        default: return <div className="text-gray-500">{t ? t('reportLoading') : 'Report wird geladen...'}</div>;
      }
    };
    
    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar">
        <div className="print-hide flex justify-end mb-4">
           <div className="flex items-center gap-3 bg-gray-50 border px-4 py-2 rounded-lg text-sm shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <Icon name="Calendar" className="text-gray-400"/>
             <span className="text-gray-500 font-medium">{t ? t('dateRangeTitle') : 'Zeitraum:'}</span>
             <input 
                type="date" 
                value={dateRange?.from || ''} 
                onChange={e=>setDateRange({...dateRange, from: e.target.value})} 
                className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"
             />
             <span>-</span>
             <input 
                type="date" 
                value={dateRange?.to || ''} 
                onChange={e=>setDateRange({...dateRange, to: e.target.value})} 
                className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300"
             />
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

          const todayStr = new Date().toISOString().split('T')[0];
          const origVal = getAssetRawValueAtDate(node, todayStr);
          const baseVal = getAssetValueAtDate(node, todayStr, allAssets);

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
        : (t ? t('allocByCatSub') : 'Kategorie-Übersicht und enthaltene Assets');

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar">
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
                            <div className="font-black font-mono text-slate-900 dark:text-white">
                                {fCur ? fCur(asset.valueInBase, 'CHF') : asset.valueInBase}
                            </div>
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
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {fCur ? fCur(subCategoryMap[subKey], 'CHF') : subCategoryMap[subKey]}
                      </span>
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
      
      const todayStr = new Date().toISOString().split('T')[0];
      const rawSum = getAssetRawValueAtDate(selectedNode, todayStr);
      const currentVal = getAssetValueAtDate(selectedNode, todayStr, allAssets);

      let defaultType = 'Einzahlung'; 
      const ac = selectedNode.assetClass;
      
      if (ac === 'realestate') defaultType = 'Wertanpassung';
      else if (ac === 'mortgage') defaultType = 'Abzahlung';
      else if (ac === 'stock' || ac === 'fund' || ac === 'crypto' || ac === 'pension_fund' || ac === 'pension_3a_fund') defaultType = 'Kauf';

      const handleDeleteEntry = (itemToDelete, e) => {
          e.stopPropagation(); 

          const isBal = itemToDelete._isBal;
          
          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) {
                  let copy = { ...n };
                  if (isBal) {
                      copy.balances = (copy.balances || []).filter(b => b.id !== itemToDelete.id);
                  } else {
                      copy.bookings = (copy.bookings || []).filter(b => b.id !== itemToDelete.id);
                      copy = applyAutoValuation(copy); 
                  }
                  return copy;
              }
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });
          
          updateTreeData({ banks: updateRecursive(data.banks) });

          const updatedNode = applyAutoValuation({ ...selectedNode });
          if (isBal) {
              updatedNode.balances = (updatedNode.balances || []).filter(b => b.id !== itemToDelete.id);
          } else {
              updatedNode.bookings = (updatedNode.bookings || []).filter(b => b.id !== itemToDelete.id);
          }
          
          if (updatedNode.selectedBooking?.id === itemToDelete.id) {
              updatedNode.selectedBooking = null;
          }
          
          setSelectedNode(updatedNode);
      };

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar">
          <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-6 mb-6">
             <div>
               <h2 className="text-3xl font-black flex items-center gap-3">
                 {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                 <Icon name="DollarSign" className="text-green-500"/>
                 {selectedNode.name} {selectedNode.isArchived && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{t ? t('isArchived') : 'Archiviert'}</span>}
               </h2>
               <div className="flex gap-6 mt-3 text-sm items-center">
                 <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                     {t ? t('assetClassLabel') : 'Klasse:'} <span className="uppercase">{selectedNode.assetClass}</span>
                 </span>
                 
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
            <div className="print-hide bg-gray-50 dark:bg-slate-800 p-4 border-b flex gap-3 flex-wrap">
              <button onClick={()=>setModalObj({type:'addBooking', assetId: selectedNode.id, defaultType})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm">
                  <Icon name="Plus"/> {t ? t('addBookingBtn') : 'Buchung erfassen'}
              </button>
              <button onClick={()=>setModalObj({type:'addBalance', assetId: selectedNode.id})} className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600">
                  <Icon name="Calendar"/> {t ? t('addBalanceBtn') : 'Stichtags-Saldo setzen'}
              </button>
              
              {['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(selectedNode.assetClass) && (
                  <button 
                      onClick={() => {
                          const updatedNode = applyAutoValuation({...selectedNode});
                          const updateRecursive = (nodes) => nodes.map(n => {
                              if (n.id === selectedNode.id) return updatedNode;
                              if (n.children) return { ...n, children: updateRecursive(n.children) };
                              return n;
                          });
                          updateTreeData({ banks: updateRecursive(data.banks) });
                          setSelectedNode(updatedNode);
                      }} 
                      className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 transition-colors ml-auto shadow-sm"
                      title="Berechnet die Historie der Marktwerte komplett neu."
                  >
                      <Icon name="RefreshCw" size={16}/> Marktwerte synchronisieren
                  </button>
              )}

            </div>
            <div className="overflow-auto finspa-scrollbar flex-1">
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
                    
                    let displayAmount = Number(item.amount);
                    let isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
                    
                    if (item.type === 'Wertanpassung' && displayAmount < 0) {
                        isPositiveType = false;
                        displayAmount = Math.abs(displayAmount);
                    }

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
                    
                    const bookingRate = item.bookingExchangeRate ? parseFloat(String(item.bookingExchangeRate).replace(',', '.')) : 0;
                    const nodeRate = selectedNode.exchangeRate ? parseFloat(String(selectedNode.exchangeRate).replace(',', '.')) : 1;
                    
                    let usedRate = bookingRate;
                    if ((!usedRate || usedRate === 1) && isForeignCurrency) usedRate = nodeRate;
                    if (!usedRate) usedRate = 1;
                    
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
                      <td className="p-4">
                          {item._isBal ? (
                              <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}>
                                  <Icon name="Activity" size={10}/> {t ? t('balanceLabel') : 'SALDO'}
                              </span>
                          ) : (
                              <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}>
                                  {typeLabel}
                              </span>
                          )}
                      </td>
                      <td className="p-4 font-medium text-gray-600 dark:text-gray-400">{details}</td>
                      
                      <td className={`p-4 text-right font-black flex flex-col items-end ${amountColor}`}>
                        <span>{prefix}{fCur ? fCur(displayAmount, selectedNode.currency) : displayAmount}</span>
                        {isForeignCurrency && (
                            <span className="text-[10px] opacity-50 font-medium tracking-wide mt-0.5">
                                ≈ {fCur ? fCur(displayAmount * usedRate, baseCurrency) : (displayAmount * usedRate)}
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

  if (selectedNode?.selectedBooking) {
    const booking = selectedNode.selectedBooking;
    const isBal = booking._isBal;
    
    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const isForeignCurrency = selectedNode.currency && selectedNode.currency !== baseCurrency;

    const todayStr = new Date().toISOString().split('T')[0];
    const actualShares = getAssetSharesAtDate(selectedNode, todayStr);
    const actualPrice = getAssetPriceAtDate(selectedNode, todayStr);

    const handleBookingPropChange = (keyOrObj, val) => {
      const changes = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: val };
      
      if (booking.type === 'Wertanpassung' || changes.type === 'Wertanpassung') {
          changes.shares = undefined;
      }

      const updatedBooking = { ...booking, ...changes };
      
      setSelectedNode(prev => ({ ...prev, selectedBooking: updatedBooking }));
      
      const updateRecursive = (nodes) => nodes.map(n => {
        if (n.id === selectedNode.id) {
          let copy = {...n};
          if (isBal) {
            copy.balances = (copy.balances || []).map(b => b.id === booking.id ? updatedBooking : b);
          } else {
            copy.bookings = (copy.bookings || []).map(b => b.id === booking.id ? updatedBooking : b);
            copy = applyAutoValuation(copy); 
          }
          return copy;
        }
        if (n.children) return { ...n, children: updateRecursive(n.children) };
        return n;
      });
      
      updateTreeData({ banks: updateRecursive(data.banks) });
    };

    const handleDeleteBooking = () => {
      if (window.confirm(t ? t('msgConfirmDelete') : 'Eintrag wirklich löschen?')) {
        const updateRecursive = (nodes) => nodes.map(n => {
          if (n.id === selectedNode.id) {
            let copy = {...n};
            if (isBal) {
              copy.balances = (copy.balances || []).filter(b => b.id !== booking.id);
            } else {
              copy.bookings = (copy.bookings || []).filter(b => b.id !== booking.id);
              copy = applyAutoValuation(copy);
            }
            return copy;
          }
          if (n.children) return { ...n, children: updateRecursive(n.children) };
          return n;
        });
        updateTreeData({ banks: updateRecursive(data.banks) });
        setSelectedNode(prev => ({ ...prev, selectedBooking: null }));
      }
    };

    return (
      <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-inner">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="Edit" className="text-gray-500" />
            <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">
              {isBal ? (t ? t('editBalance') : 'Saldo') : (t ? t('editBooking') : 'Buchung')}
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <Icon 
              name="Trash" 
              size={16}
              className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors" 
              onClick={handleDeleteBooking} 
              title={t ? t('btnDelete') || 'Löschen' : 'Löschen'}
            />
            <Icon 
              name="X" 
              size={18}
              className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
              onClick={() => setSelectedNode({ ...selectedNode, selectedBooking: null })} 
              title="Zurück zum Asset"
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('date') : 'Datum'}</label>
            <input type="date" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.date || ''} onChange={e => handleBookingPropChange('date', e.target.value)} />
          </div>
          
          <div>
            <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('amount') : 'Betrag'} ({selectedNode.currency || baseCurrency})</label>
            <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm" value={booking.amount || ''} onChange={e => handleBookingPropChange('amount', Number(e.target.value))} />
          </div>

          {isForeignCurrency && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">
                {t ? t('labelExchangeRateDate') : 'Wechselkurs'} ({selectedNode.currency} → {baseCurrency})
              </label>
              <input 
                type="number" 
                step="0.0001" 
                className="w-full p-2 border border-yellow-300/70 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm" 
                value={booking.bookingExchangeRate ?? ''} 
                onChange={e => handleBookingPropChange('bookingExchangeRate', Number(e.target.value))} 
              />
            </div>
          )}

          {!isBal && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('entryType') : 'Typ'}</label>
              <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.type || ''} onChange={e => handleBookingPropChange('type', e.target.value)}>
                <option value="Einzahlung">Einzahlung</option>
                <option value="Auszahlung">Auszahlung</option>
                <option value="Kauf">Kauf</option>
                <option value="Verkauf">Verkauf</option>
                <option value="Dividende">Dividende</option>
                <option value="Zinszahlung">Zinszahlung</option>
                <option value="Gebühr">Gebühr</option>
                <option value="Wertanpassung">Wertanpassung</option>
                <option value="Abzahlung">Abzahlung</option>
                <option value="Schulderhöhung">Schulderhöhung</option>
                <option value="Umbuchung">Umbuchung</option>
              </select>
            </div>
          )}

          {!isBal && ['Kauf', 'Verkauf', 'Dividende'].includes(booking.type) && (
            <div className="grid grid-cols-2 gap-3 bg-yellow-50/50 dark:bg-slate-800/40 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('shares') : 'Stücke'}</label>
                <input 
                  type="number" 
                  step="any" 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" 
                  value={booking.shares || ''} 
                  onChange={e => {
                    const sh = Number(e.target.value);
                    const pr = booking.price || 0;
                    handleBookingPropChange({
                      shares: sh,
                      amount: sh && pr ? Number((sh * pr).toFixed(2)) : booking.amount
                    });
                  }} 
                />
              </div>
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('price') : 'Preis'}</label>
                <input 
                  type="number" 
                  step="any" 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" 
                  value={booking.price || ''} 
                  onChange={e => {
                    const pr = Number(e.target.value);
                    const sh = booking.shares || 0;
                    handleBookingPropChange({
                      price: pr,
                      amount: sh && pr ? Number((sh * pr).toFixed(2)) : booking.amount
                    });
                  }} 
                />
              </div>
            </div>
          )}

          {!isBal && booking.type === 'Wertanpassung' && ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(selectedNode?.assetClass) && (
              <div className="grid grid-cols-2 gap-3 bg-blue-50/50 dark:bg-slate-800/40 p-3 rounded-lg border border-blue-200 dark:border-slate-700 mt-2">
                <div>
                  <label className="block text-blue-600 dark:text-blue-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('currentShares') : 'Aktuelle Stücke'}</label>
                  <input 
                    type="number" step="any" 
                    className="w-full p-2 border border-blue-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-800/50 text-gray-500 shadow-sm text-sm cursor-not-allowed" 
                    value={actualShares} 
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-blue-600 dark:text-blue-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('newPrice') : 'Neuer Kurs'} (Bisher: {actualPrice})</label>
                  <input 
                    type="number" step="any" 
                    className="w-full p-2 border border-blue-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" 
                    placeholder={actualShares > 0 ? "Tippen = Berechnen" : "Betrag manuell eintippen"}
                    value={booking.price ?? ''} 
                    onChange={e => {
                      const pr = e.target.value;
                      if (pr !== '' && actualShares > 0) {
                        handleBookingPropChange({
                          price: Number(pr),
                          amount: Number(((Number(pr) - Number(actualPrice)) * actualShares).toFixed(2))
                        });
                      } else {
                        handleBookingPropChange({ price: pr === '' ? undefined : Number(pr) });
                      }
                    }} 
                  />
                </div>
              </div>
          )}

          {!isBal && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('entryDetail') : 'Detail / Notiz'}</label>
              <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.subCategory || ''} onChange={e => handleBookingPropChange('subCategory', e.target.value)} />
            </div>
          )}
        </div>

        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-slate-700">
           <button onClick={() => setSelectedNode({ ...selectedNode, selectedBooking: null })} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-md">
               <Icon name="Save" size={16}/> {t ? t('btnApply') : 'Übernehmen'}
           </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950 finspa-scrollbar overflow-auto">
        <div className="text-center text-gray-400">
          <Icon name="PieChart" size={64} className="mx-auto mb-6 opacity-20 text-blue-500" />
          <h2 className="text-2xl font-bold mb-2 text-gray-600 dark:text-gray-300">{t ? t('welcomeTitle') : 'Willkommen in FinSPA Pro'}</h2>
          <p>{t ? t('welcomePrompt') : 'Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.'}</p>
        </div>
      </div>
    </>
  );
};

module.exports = EditorArea;