const React = require('react');
const { useState, useEffect } = React; 

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
  generateId = () => Math.random().toString(36).substr(2, 9),
  defaultBookingCategories = {},
  getBookingFlow = (bk) => {
      let amt = Number(bk?.amount || 0);
      let isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(bk?.type);
      if (bk?.type === 'Wertanpassung' && amt < 0) { isPositive = false; amt = Math.abs(amt); }
      return { isPositive, amount: amt };
  }
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
const DividendCalendarReport = safeRequire('./reports/DividendCalendarReport.jsx') || (() => <div>{t ? t('errDivCalendarMissing') : 'DividendCalendarReport fehlt'}</div>);
const UniversalChart = require('../../api/UniversalChart.jsx');

const parseRate = (val) => parseFloat(String(val || '1').replace(',', '.'));

const JsonNode = ({ label, data, depth = 0, t }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isObject = data !== null && typeof data === 'object';
    
    const handleCopy = (payload) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        if (typeof window !== 'undefined' && window.showToast) window.showToast(t ? t('msgCopied') || "In Zwischenablage kopiert" : "In Zwischenablage kopiert", "success");
    };

    const renderJsonValue = (val) => {
        if (typeof val === 'number') return <span className="text-orange-500 font-bold">{val}</span>;
        if (typeof val === 'boolean') return <span className="text-purple-500 font-bold">{val ? 'true' : 'false'}</span>;
        if (val === null) return <span className="text-gray-400 italic">null</span>;
        return <span className="text-emerald-600 dark:text-emerald-400">"{String(val)}"</span>;
    };

    if (!isObject) {
        return (
            <div className="flex gap-2 py-0.5 ml-4 text-xs">
                <span className="text-blue-500 font-medium">"{label}":</span>
                {renderJsonValue(data)}
            </div>
        );
    }

    const isArray = Array.isArray(data);
    const childCount = isArray ? data.length : Object.keys(data).length;

    return (
        <div className="ml-4 border-l border-gray-200 dark:border-slate-800 pl-2 my-1">
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <Icon name={isOpen ? "ChevronDown" : "ChevronRight"} size={10} className="text-gray-400" />
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-tighter italic">
                    {label} <span className="text-[10px] text-gray-400 font-normal">({childCount} {isArray ? (t ? t('labelEntries') || 'Einträge' : 'Einträge') : (t ? t('labelFields') || 'Felder' : 'Felder')})</span>
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleCopy(data); }}
                    className="opacity-0 group-hover:opacity-100 bg-gray-100 dark:bg-slate-800 p-1 rounded hover:bg-blue-100 transition-all"
                    title={t ? t('titleCopyBlock') || "Diesen Block kopieren" : "Diesen Block kopieren"}
                >
                    <Icon name="Copy" size={10} className="text-blue-500" />
                </button>
            </div>
            {isOpen && (
                <div className="mt-1">
                    {Object.entries(data).map(([key, value]) => (
                        <JsonNode key={key} label={key} data={value} depth={depth + 1} t={t} />
                    ))}
                </div>
            )}
        </div>
    );
};

const EditorArea = ({ data, viewMode, activeReport, selectedNode, setSelectedNode, isTreeVisible, setIsTreeVisible, showArchived, dateRange, setDateRange, modalObj, setModalObj, updateTreeData, fCur, t }) => {
  const allAssets = getAllAssets(data?.banks || []) || [];
  const activeAssets = showArchived ? allAssets : allAssets.filter(a => !a?.isArchived);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('transactions');

  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draggedRowId, setDraggedRowId] = useState(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempComment, setTempComment] = useState('');

  const [selectedDataPath, setSelectedDataPath] = useState('root');
  const [dataSearch, setDataSearch] = useState('');

  const [transferTargetId, setTransferTargetId] = useState('');

const safeT = (key, fallback) => {
      if (!t) return fallback;
      const res = t(key);
      return (res && res !== key) ? res : fallback;
  };

  useEffect(() => {
    setSelectedBookingIds(new Set());
    setFilterQuery('');
    setFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }, [selectedNode?.id, activeTab]);

  useEffect(() => {
    setTransferTargetId('');
  }, [selectedNode?.selectedBooking?.id]);

  const applyAutoValuation = (assetNode) => {
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(assetNode.assetClass);
      if (!isSecurities || !assetNode.bookings) return assetNode;

      let copy = { ...assetNode, bookings: [...assetNode.bookings] };
      const localizedAutoString = t ? (t('autoAdjustment') || '') : '';
      
      copy.bookings = copy.bookings.filter(b => {
          if (b.type !== 'Wertanpassung') return true;
          const sub = b.subCategory || '';
          const isLegacyAuto = sub.toLowerCase().includes('auto') || sub.includes('Auto-Anpassung') || (localizedAutoString && sub.includes(localizedAutoString));
          return !(b._isAutoValuation || isLegacyAuto);
      });

      copy.bookings.sort((a,b) => new Date(a.date) - new Date(b.date));

      let totalShares = 0; 
      let runningPrincipalRaw = 0; 
      let finalBookings = []; 
      let lastBookingDate = new Date().toISOString().split('T')[0];
      
      const safePrice = (val) => parseFloat(String(val || '0').replace(',', '.'));
      let latestPrice = 0;

      copy.bookings.forEach(b => {
          finalBookings.push(b); 
          if (b.date > lastBookingDate) lastBookingDate = b.date;

          const isCapitalAddition = ['Kauf', 'Einzahlung'].includes(b.type);
          const isCapitalReduction = ['Verkauf', 'Auszahlung'].includes(b.type);

          if (isCapitalAddition) {
              if (b.shares) totalShares += Number(b.shares);
              runningPrincipalRaw += Number(b.amount || 0);
          } else if (isCapitalReduction) {
              if (b.shares) totalShares -= Number(b.shares);
              runningPrincipalRaw -= Number(b.amount || 0);
          } else if (b.type === 'Wertanpassung') {
              runningPrincipalRaw += Number(b.amount || 0);
          }

          const bPrice = safePrice(b.price);
          
          if (bPrice > 0) {
              latestPrice = bPrice;
          }

          if (totalShares > 0 && latestPrice > 0) {
              const expectedMarketValue = totalShares * latestPrice;
              const diff = expectedMarketValue - runningPrincipalRaw;

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
                  
                  runningPrincipalRaw += adjAmount; 
              }
          }
      });

      const nodePrice = safePrice(assetNode.price);
      const currentPriceToUse = nodePrice > 0 ? nodePrice : latestPrice;

      if (totalShares > 0 && currentPriceToUse > 0) {
          const expectedCurrentValue = totalShares * currentPriceToUse;
          const diff = expectedCurrentValue - runningPrincipalRaw;

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

  const renderSmartTags = (text) => {
    if (!text) return null;
    return text.split(/(#\w+)/g).map((part, index) => {
      if (part.startsWith('#')) {
        return <span key={index} className="inline-block px-1.5 py-0.5 mx-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold tracking-wider">{part}</span>;
      }
      return part;
    });
  };

  if (viewMode === 'datensicht') {
    const handleCopy = (payload) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        if (typeof window !== 'undefined' && window.showToast) window.showToast(t ? t('msgCopied') || "In Zwischenablage kopiert" : "In Zwischenablage kopiert", "success");
    };

    const getActiveData = () => {
        if (selectedDataPath === 'banks') return data.banks;
        if (selectedDataPath === 'budget') return data.budget;
        if (selectedDataPath === 'settings') return data.settings;
        if (selectedDataPath === 'scenarios') return data.scenarios;
        return data;
    };

    return (
        <div className="p-0 h-full flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b p-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 text-white p-2 rounded-lg"><Icon name="Code" size={20} /></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{t ? t('viewData') || 'Innere Datenhaltung' : 'Innere Datenhaltung'}</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t ? t('descSystemExplorer') || 'System-Explorer & JSON-Inspector' : 'System-Explorer & JSON-Inspector'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleCopy(data)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md">
                        <Icon name="Copy" className="text-white" /> {t ? t('btnCopyProject') || 'Gesamtes Projekt kopieren' : 'Gesamtes Projekt kopieren'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-64 border-r bg-white dark:bg-slate-900/50 p-4 space-y-2 shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{t ? t('labelAreas') || 'Bereiche' : 'Bereiche'}</p>
                    {[
                        { id: 'root', label: t ? t('labelFullObject') || 'Komplettes Objekt' : 'Komplettes Objekt', icon: 'Box' },
                        { id: 'banks', label: t ? t('labelBanksAssets') || 'Banken & Assets' : 'Banken & Assets', icon: 'Shield' },
                        { id: 'budget', label: t ? t('labelBudgetPlanning') || 'Budget-Planung' : 'Budget-Planung', icon: 'List' },
                        { id: 'settings', label: t ? t('labelConfig') || 'Konfiguration' : 'Konfiguration', icon: 'Settings' },
                        { id: 'scenarios', label: t ? t('labelScenarios') || 'Szenarien' : 'Szenarien', icon: 'TrendingUp' }
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setSelectedDataPath(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedDataPath === item.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm ring-1 ring-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Icon name={item.icon} size={14} /> {item.label}
                        </button>
                    ))}
                    
                    <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">
                            <Icon name="Info" size={10} className="mb-1" /><br/>
                            {t ? t('descExpertCopy') || 'Du kannst einzelne Blöcke per "Copy" Icon extrahieren und in anderen Assets wieder einfügen (Expert Mode).' : 'Du kannst einzelne Blöcke per "Copy" Icon extrahieren und in anderen Assets wieder einfügen (Expert Mode).'}
                        </p>
                    </div>
                </div>

                <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
                    <div className="p-2 border-b bg-gray-50/50 dark:bg-slate-800/50 flex items-center gap-2">
                         <div className="bg-white dark:bg-slate-800 border rounded-lg px-2 py-1 flex items-center gap-2 w-full max-w-sm shadow-sm">
                            <Icon name="Search" size={12} className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder={t ? t('placeholderSearchKeys') || 'Suche in Schlüsseln/Werten...' : 'Suche in Schlüsseln/Werten...'} 
                                value={dataSearch}
                                onChange={e => setDataSearch(e.target.value)}
                                className="bg-transparent border-none outline-none text-xs w-full text-gray-700 dark:text-gray-200"
                            />
                         </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 finspa-scrollbar font-mono">
                        <div className="bg-gray-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800 p-6 min-h-full">
                            <JsonNode label={selectedDataPath.toUpperCase()} data={getActiveData()} t={t} />
                        </div>
                    </div>
                </div>
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
        case 'tax': return <TaxReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;        
        case 'categoryFlow': return <CategoryFlowReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'waterfall': return <WaterfallReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'passive': return <PassiveIncomeReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'topFlow': return <TopFlowReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'bookingAnalysis': return <BookingAnalysisReport activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'future': return <FutureReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'scenarios': return <ScenariosReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} setModalObj={setModalObj} fCur={fCur} t={t} />;
        case 'pension3a': return <PensionPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'securities': return <SecuritiesPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
	      case 'dividendCalendar': return <DividendCalendarReport data={data} activeAssets={activeAssets} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        default: return <div className="text-gray-500">{t ? t('reportLoading') : 'Report wird geladen...'}</div>;
      }
    };
    
    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar">
        <div className="print-hide flex justify-end mb-4">
           <div className="flex items-center gap-3 bg-gray-50 border px-4 py-2 rounded-lg text-sm shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <Icon name="Calendar" className="text-gray-400"/>
             <span className="text-gray-500 font-medium">{t ? t('dateRangeTitle') : 'Zeitraum:'}</span>
             <input type="date" value={dateRange?.from || ''} onChange={e=>setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300" />
             <span>-</span>
             <input type="date" value={dateRange?.to || ''} onChange={e=>setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-b outline-none text-gray-700 dark:text-gray-300" />
           </div>
        </div>
        {viewContent()}
      </div>
    );
  }
  
  if (viewMode === 'budget' && !selectedNode && !activeReport) return <BudgetDashboard data={data} fCur={fCur} t={t} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />;

  if (viewMode === 'vermoegen' && !selectedNode && !activeReport) {
      return <AssetOverviewReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
  }
  
  if (selectedNode) {
    
    if (selectedNode.budgetType) {
        return <BudgetEditor selectedNode={selectedNode} setSelectedNode={setSelectedNode} fCur={fCur} t={t} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />;
    }
    if (selectedNode.type === 'bank' || selectedNode.type === 'category') {
      const analyzeStructure = (node, currentCategory = (t ? t('mainPortfolio') : 'Hauptportfolio')) => {
        let items = [];
        if (node.type === 'category') currentCategory = node.name;
        if (node.type === 'asset') {
          if (node.isArchived && !showArchived) return [];
          const todayStr = new Date().toISOString().split('T')[0];
          const origVal = getAssetRawValueAtDate(node, todayStr);
          const baseVal = getAssetValueAtDate(node, todayStr, allAssets);
          const subCatKey = node.assetClass || 'cash';
          const subCategoryName = t ? (t(`ac${subCatKey.charAt(0).toUpperCase() + subCatKey.slice(1)}`) || subCatKey.toUpperCase()) : subCatKey.toUpperCase();

          items.push({ id: node.id, name: node.name, category: currentCategory, subCategory: subCategoryName, valueInBase: baseVal, originalValue: origVal, currency: node.currency });
        }
        if (node.children) node.children.forEach(child => { items = items.concat(analyzeStructure(child, currentCategory)); });
        return items;
      };

      const allBankAssets = analyzeStructure(selectedNode, selectedNode.name);
      const totalBankValue = allBankAssets.reduce((sum, item) => sum + item.valueInBase, 0);
      const categoryMap = {}; const subCategoryMap = {};

      allBankAssets.forEach(item => {
        if (!categoryMap[item.category]) categoryMap[item.category] = 0;
        categoryMap[item.category] += item.valueInBase;
        const subKey = `${item.category} → ${item.subCategory}`;
        if (!subCategoryMap[subKey]) subCategoryMap[subKey] = 0;
        subCategoryMap[subKey] += item.valueInBase;
      });

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4'];
      const chartDataCategories = Object.keys(categoryMap).map((key, idx) => ({ label: key, value: categoryMap[key], color: colors[idx % colors.length] })).filter(d => d.value > 0);

      const isBank = selectedNode.type === 'bank';
      const headerIcon = isBank ? "Shield" : "FolderOpen";
      const headerSubtitle = isBank ? (t ? t('consWealthOverview') : 'Konsolidierte Vermögensübersicht') : (t ? t('allocByCatSub') : 'Kategorie-Übersicht');

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
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 block">{t ? t('totalValue') : 'Gesamtwert'}</span>
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
                        <Icon name="FolderOpen" className="text-yellow-500" size={18} /> {categoryName}
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
                            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5"><span className="uppercase font-semibold tracking-wider px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px]">{asset.subCategory}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="font-black font-mono text-slate-900 dark:text-white">{fCur ? fCur(asset.valueInBase, 'CHF') : asset.valueInBase}</div>
                            {asset.currency !== 'CHF' && <div className="text-xs text-gray-400 font-mono">{fCur ? fCur(asset.originalValue, asset.currency) : `${asset.originalValue} ${asset.currency}`}</div>}
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
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 self-start mb-6 flex items-center gap-2"><Icon name="PieChart" /> {t ? t('allocByCat') : 'Aufteilung nach Kategorien'}</h3>
                {chartDataCategories.length > 0 ? (
                  <UniversalChart 
                    engine={activeChartEngine} 
                    type="doughnut" 
                    height="280px" 
                    labels={chartDataCategories.map(d => d.label)} 
                    datasets={[{ 
                        label: t ? t('totalValue') : 'Gesamtwert', 
                        data: chartDataCategories.map(d => d.value),
                        valueFormatter: (val) => fCur ? fCur(val, 'CHF') : Number(val).toFixed(2)
                    }]} 
                  />
                ) : <div className="text-gray-400 py-12 text-center text-sm">{t ? t('noValuedAssets') : 'Keine bewerteten Assets vorhanden.'}</div>}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
                <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-1"><Icon name="List" size={12} /> {t ? t('subcatTotals') : 'Subkategorien-Summen'}</h4>
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
      const adjustedNode = applyAutoValuation(selectedNode);
      const baseCurrency = data?.settings?.baseCurrency || 'CHF';
      const isForeignCurrency = adjustedNode.currency && adjustedNode.currency !== baseCurrency;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const rawSum = getAssetRawValueAtDate(adjustedNode, todayStr);
      const currentVal = getAssetValueAtDate(adjustedNode, todayStr, allAssets);

      let defaultType = 'Einzahlung'; 
      const ac = adjustedNode.assetClass;
      if (ac === 'realestate') defaultType = 'Wertanpassung';
      else if (ac === 'mortgage') defaultType = 'Abzahlung';
      else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) defaultType = 'Kauf';

      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

      const handleRowDrop = (draggedId, targetId) => {
          if (draggedId === targetId) return;

          let updatedNode = { ...selectedNode };
          let bookings = [...(updatedNode.bookings || [])];

          const draggedIdx = bookings.findIndex(b => b.id === draggedId);
          const targetIdx = bookings.findIndex(b => b.id === targetId);

          if (draggedIdx === -1 || targetIdx === -1) return;

          if (bookings[draggedIdx].date !== bookings[targetIdx].date) {
              if (typeof window !== 'undefined' && window.showToast) window.showToast(t ? t('msgSameDateOnly') || "Verschieben nur am gleichen Datum möglich." : "Verschieben nur am gleichen Datum möglich.", "error");
              return;
          }

          const [moved] = bookings.splice(draggedIdx, 1);
          bookings.splice(targetIdx, 0, moved);

          const dateGroup = bookings.filter(b => b.date === moved.date);
          dateGroup.forEach((b, index) => {
              const idx = bookings.findIndex(x => x.id === b.id);
              if (idx > -1) bookings[idx].customOrder = index;
          });

          updatedNode.bookings = bookings;
          
          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) return applyAutoValuation(updatedNode);
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });

          updateTreeData({ banks: updateRecursive(data.banks) });
          setSelectedNode(applyAutoValuation(updatedNode));
      };

      const saveInlineComment = (item) => {
          let updatedNode = { ...selectedNode };
          let isBal = item._isBal;

          const updatedBooking = { ...item, comment: tempComment };
          if (isBal) {
              updatedNode.balances = (updatedNode.balances || []).map(b => b.id === item.id ? updatedBooking : b);
          } else {
              updatedNode.bookings = (updatedNode.bookings || []).map(b => b.id === item.id ? updatedBooking : b);
              updatedNode = applyAutoValuation(updatedNode);
          }

          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) return updatedNode;
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });
          
          updateTreeData({ banks: updateRecursive(data.banks) });
          setSelectedNode(updatedNode);
          setEditingCommentId(null);
      };

      let dates = new Set();
      (adjustedNode.bookings || []).forEach(b => dates.add(b.date));
      (adjustedNode.balances || []).forEach(b => dates.add(b.date));
      dates.add(todayStr);
      let sortedDates = Array.from(dates).sort();
      
      if (sortedDates.length === 1) {
          const d = new Date(sortedDates[0]);
          d.setMonth(d.getMonth() - 1);
          sortedDates.unshift(d.toISOString().split('T')[0]);
      } else if (sortedDates.length === 0) {
          sortedDates = ['2000-01-01', todayStr];
      }

      let dataRaw = [];
      let dataBase = [];

      sortedDates.forEach(d => {
          if (isSecurities) {
              const shares = getAssetSharesAtDate(adjustedNode, d);
              const price = getAssetPriceAtDate(adjustedNode, d);
              const positionValueRaw = shares * price;
              
              let accDivRaw = 0;
              let accDivBase = 0;
              (adjustedNode.bookings || []).forEach(b => {
                  if (b.type === 'Dividende' && b.date <= d) {
                      accDivRaw += Number(b.amount || 0);
                      const bRate = b.bookingExchangeRate ? parseRate(b.bookingExchangeRate) : (parseRate(adjustedNode.exchangeRate) || 1);
                      accDivBase += Number(b.amount || 0) * bRate;
                  }
              });

              const rVal = getAssetRawValueAtDate(adjustedNode, d);
              const bVal = getAssetValueAtDate(adjustedNode, d, allAssets);
              const fxRate = (rVal && rVal !== 0) ? (bVal / rVal) : (parseRate(adjustedNode.exchangeRate) || 1);
              
              const positionValueBase = positionValueRaw * fxRate;

              dataRaw.push(positionValueRaw + accDivRaw);
              dataBase.push(positionValueBase + accDivBase);
          } else {
              dataRaw.push(getAssetRawValueAtDate(adjustedNode, d));
              dataBase.push(getAssetValueAtDate(adjustedNode, d, allAssets));
          }
      });

      const Sparkline = ({ dataSeries, title }) => {
          if (!dataSeries || dataSeries.length < 2) return null;
          
          let startIndex = 0;
          while (startIndex < dataSeries.length - 1 && dataSeries[startIndex] === 0) {
              startIndex++;
          }
          let plotData = dataSeries.slice(startIndex);
          if (plotData.length < 2) plotData = dataSeries; 

          const min = Math.min(...plotData);
          const max = Math.max(...plotData);
          const range = max - min || 1;
          
          const paddingX = 6;
          const paddingY = 8;
          const width = 160;   
          const height = 56;   

          const getCoords = (d, i) => {
              const x = paddingX + (i / (plotData.length - 1)) * (width - paddingX * 2);
              const y = height - paddingY - ((d - min) / range) * (height - paddingY * 2);
              return { x, y };
          };

          const points = plotData.map((d, i) => {
              const { x, y } = getCoords(d, i);
              return `${x},${y}`;
          }).join(' L ');

          const firstPt = getCoords(plotData[0], 0);
          const lastPt = getCoords(plotData[plotData.length - 1], plotData.length - 1);
          const areaPath = `M ${firstPt.x},${height} L ${points} L ${lastPt.x},${height} Z`;

          const isPositive = plotData[plotData.length - 1] >= plotData[0];
          const strokeColor = isPositive ? '#10b981' : '#ef4444'; 
          const gradientId = `sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

          return (
              <div className="flex flex-col items-end justify-center shrink-0 group" title={title}>
                  <div className="bg-gray-50/80 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/60 rounded-xl p-2 pb-1 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:border-gray-300 dark:group-hover:border-slate-600">
                      <svg width={width} height={height} className="overflow-visible">
                          <defs>
                              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
                                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                              </linearGradient>
                          </defs>
                          
                          <line x1={paddingX} y1={firstPt.y} x2={width - paddingX} y2={firstPt.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" className="dark:stroke-slate-600" />
                          <line x1={paddingX} y1={height - 2} x2={width - paddingX} y2={height - 2} stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" className="dark:stroke-slate-700" />
                          <line x1={paddingX} y1={paddingY - 4} x2={paddingX} y2={height - 2} stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" className="dark:stroke-slate-700" />

                          <path d={areaPath} fill={`url(#${gradientId})`} />
                          <path d={`M ${points}`} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          
                          {plotData.map((d, i) => {
                              const { x, y } = getCoords(d, i);
                              const isLast = i === plotData.length - 1;
                              return (
                                  <circle 
                                      key={i} 
                                      cx={x} 
                                      cy={y} 
                                      r={isLast ? "2.5" : "1.5"} 
                                      className="fill-white dark:fill-slate-900 transition-all" 
                                      stroke={strokeColor} 
                                      strokeWidth={isLast ? "1.5" : "1"} 
                                  />
                              );
                          })}
                      </svg>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 mr-1">{title}</span>
              </div>
          );
      };

      const handleDeleteEntry = (itemToDelete, e) => {
          e.stopPropagation(); 
          if (itemToDelete._isAutoValuation) return; 

          const isBal = itemToDelete._isBal;
          
          let updatedNode = { ...selectedNode };
          if (isBal) {
              updatedNode.balances = (updatedNode.balances || []).filter(b => b.id !== itemToDelete.id);
          } else {
              updatedNode.bookings = (updatedNode.bookings || []).filter(b => b.id !== itemToDelete.id);
              updatedNode = applyAutoValuation(updatedNode);
          }
          
          if (updatedNode.selectedBooking?.id === itemToDelete.id) {
              updatedNode.selectedBooking = null;
          }

          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) return updatedNode;
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });
          
          updateTreeData({ banks: updateRecursive(data.banks) });
          setSelectedNode(updatedNode);
          
          if (typeof window !== 'undefined' && window.showToast) window.showToast(t ? t('msgDeleted') || "Eintrag gelöscht" : "Eintrag gelöscht", "success");
      };

      const toggleBookingSelection = (id) => {
          const newSet = new Set(selectedBookingIds);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          setSelectedBookingIds(newSet);
      };

      const rawItems = [...(adjustedNode.balances || []).map(b=>({...b, _isBal:true})), ...(adjustedNode.bookings || [])];
      let filteredItems = rawItems.filter(item => {
          if (isSecurities) {
              if (activeTab === 'marketData') {
                  if (!item._isBal && item.type !== 'Wertanpassung') return false;
              } else {
                  if (item._isBal || item.type === 'Wertanpassung') return false;
              }
          }

          if (filterType && item.type !== filterType && !item._isBal) return false;
          if (filterDateFrom && item.date < filterDateFrom) return false;
          if (filterDateTo && item.date > filterDateTo) return false;
          
          if (filterQuery) {
              const q = filterQuery.toLowerCase();
              const subCatStr = (item.subCategory || '').toLowerCase();
              const commentStr = (item.comment || '').toLowerCase();
              const amtStr = String(item.amount || '').toLowerCase();
              const typeStr = (item.type || '').toLowerCase();
              
              if (!subCatStr.includes(q) && !commentStr.includes(q) && !amtStr.includes(q) && !typeStr.includes(q)) {
                  return false;
              }
          }
          return true;
      });

      const sortedItems = filteredItems.sort((a,b) => {
          const dateDiff = new Date(b.date) - new Date(a.date);
          if (dateDiff === 0) {
              return (a.customOrder || 0) - (b.customOrder || 0); 
          }
          return dateDiff;
      });

      const isAllSelected = sortedItems.length > 0 && sortedItems.every(i => selectedBookingIds.has(i.id));
      const handleSelectAll = (e) => {
          if (e.target.checked) {
              const newSet = new Set(selectedBookingIds);
              sortedItems.forEach(i => newSet.add(i.id));
              setSelectedBookingIds(newSet);
          } else {
              const newSet = new Set(selectedBookingIds);
              sortedItems.forEach(i => newSet.delete(i.id));
              setSelectedBookingIds(newSet);
          }
      };

      let totalInRaw = 0, totalOutRaw = 0, totalInBase = 0, totalOutBase = 0;
      sortedItems.forEach(item => {
          if (!item._isBal && item.type !== 'Wertanpassung') {
              const flow = getBookingFlow(item);
              const bRate = item.bookingExchangeRate ? parseRate(item.bookingExchangeRate) : (parseRate(adjustedNode.exchangeRate) || 1);
              if (flow.isPositive) {
                  totalInRaw += flow.amount;
                  totalInBase += flow.amount * bRate;
              } else {
                  totalOutRaw += flow.amount;
                  totalOutBase += flow.amount * bRate;
              }
          }
      });

      const pClass = isCompactMode ? 'p-2' : 'p-4';

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar relative">
          <div className="flex justify-between items-stretch border-b border-gray-200 dark:border-slate-800 pb-6 mb-4">
             <div className="flex flex-col justify-between">
               <h2 className="text-3xl font-black flex items-center gap-3">
                 {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                 <Icon name="DollarSign" className="text-green-500"/>
                 {adjustedNode.name} {adjustedNode.isArchived && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{t ? t('isArchived') : 'Archiviert'}</span>}
               </h2>
               <div className="flex gap-6 mt-3 text-sm items-center">
                 <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">{t ? t('assetClassLabel') : 'Klasse:'} <span className="uppercase">{adjustedNode.assetClass}</span></span>
                 <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 px-3 py-1 rounded-full font-bold flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 tabular-nums">
                    <div>{t ? t('valueToday') : 'Wert (Heute):'} {fCur ? fCur(currentVal, baseCurrency) : currentVal}</div>
                    {isForeignCurrency && <span className="text-xs font-normal opacity-70">({fCur ? fCur(rawSum, adjustedNode.currency) : rawSum})</span>}
                 </span>
               </div>
             </div>

             <div className="flex items-end gap-10 print-hide ml-4 h-full pt-2">
    <Sparkline dataSeries={dataBase} title={isSecurities ? `${t ? t('titlePerformance') || 'Performance' : 'Performance'} (${baseCurrency})` : `${t ? t('titleValueDevelopment') || 'Wertentwicklung' : 'Wertentwicklung'} (${baseCurrency})`} />
    {isForeignCurrency && <Sparkline dataSeries={dataRaw} title={isSecurities ? `${t ? t('titlePerformance') || 'Performance' : 'Performance'} (${adjustedNode.currency})` : `${t ? t('titleValueDevelopment') || 'Wertentwicklung' : 'Wertentwicklung'} (${adjustedNode.currency})`} />}
</div>
          </div>

          {isSecurities && (
            <div className="print-hide flex border-b border-gray-200 dark:border-slate-800 mb-4 gap-2">
              <button onClick={() => setActiveTab('transactions')} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all duration-150 ${activeTab === 'transactions' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Icon name="List" size={16}/> {t ? t('tabTransactions') || 'Transaktionen' : 'Transaktionen'}
              </button>
              <button onClick={() => setActiveTab('marketData')} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all duration-150 ${activeTab === 'marketData' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Icon name="TrendingUp" size={16}/> {t ? t('tabMarketData') || 'Kurshistorie & Marktdaten' : 'Kurshistorie & Marktdaten'}
              </button>
            </div>
          )}
        

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-[300px]">
            <div className="print-hide bg-gray-50 dark:bg-slate-800 p-4 border-b flex gap-3 flex-wrap items-center">
              
              {(!isSecurities || activeTab === 'transactions') ? (
                <button onClick={()=>setModalObj({type:'addBooking', assetId: adjustedNode.id, defaultType})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-colors">
    <Icon name="Plus"/> {isSecurities ? (t ? t('addTransactionBtn') : 'Transaktion erfassen') : (t ? t('addBookingBtn') : 'Buchung erfassen')}
</button>
              ) : (
                <button onClick={()=>setModalObj({type:'addBooking', assetId: adjustedNode.id, defaultType: 'Wertanpassung'})} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-colors">
                    <Icon name="TrendingUp"/> {t ? t('btnAddMarketValue') || 'Kurs / Marktwert erfassen' : 'Kurs / Marktwert erfassen'}
                </button>
              )}

              <button onClick={()=>setModalObj({type:'addBalance', assetId: adjustedNode.id})} className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors">
                  <Icon name="Calendar"/> {t ? t('addBalanceBtn') : 'Stichtags-Saldo setzen'}
              </button>
              
              {selectedBookingIds.size > 0 && (
                  <button onClick={() => setModalObj({type:'bulkAction', assetId: adjustedNode.id, selectedIds: Array.from(selectedBookingIds)})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-all animate-fade-in">
                      <Icon name="CheckSquare" className="text-white stroke-white" /> {selectedBookingIds.size} {t ? t('btnEditEntries') || 'Einträge bearbeiten' : 'Einträge bearbeiten'}
                  </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`p-2 rounded-lg border transition-colors ${showFilters || filterQuery || filterType || filterDateFrom || filterDateTo ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    title={t ? t('titleToggleFilter') || "Filter umschalten" : "Filter umschalten"}
                >
                    <Icon name="Filter" size={18}/>
                </button>
                <button 
                    onClick={() => setIsCompactMode(!isCompactMode)} 
                    className={`p-2 rounded-lg border transition-colors ${isCompactMode ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-blue-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    title={t ? t('titleToggleCompact') || "Kompaktansicht umschalten" : "Kompaktansicht umschalten"}
                >
                    <Icon name={isCompactMode ? "EyeOff" : "Eye"} size={18}/>
                </button>
<button 
    onClick={() => setModalObj({type:'printAssetBookings', assetId: adjustedNode.id, filteredIds: sortedItems.map(i=>i.id)})} 
    className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 shadow-sm transition-colors"
    title={t ? t('titlePrintView') : "Aktuelle Ansicht drucken/exportieren"}
>
    <Icon name="Printer"/> {t ? t('filePrint') : 'Drucken'}
</button>

                {isSecurities && (
    <button 
        onClick={() => {
            let updatedNode = { ...selectedNode };
            let bookings = [...(updatedNode.bookings || [])];
            let addedCount = 0;

            const txWithPrice = bookings.filter(b => 
                ['Kauf', 'Verkauf', 'Dividende'].includes(b.type) && Number(b.price) > 0
            );

            txWithPrice.forEach(tx => {
                const existingReval = bookings.find(b => 
                    b.type === 'Wertanpassung' && b.date === tx.date && !b._isAutoValuation
                );

                if (!existingReval) {
                    bookings.push({
                        id: Math.random().toString(36).substr(2, 9),
                        date: tx.date,
                        type: 'Wertanpassung',
                        subCategory: t ? t('catPriceFromTransaction') || 'Kurs aus Transaktion' : 'Kurs aus Transaktion',
                        price: Number(tx.price),
                        amount: 0,
                        bookingExchangeRate: tx.bookingExchangeRate || updatedNode.exchangeRate || 1
                    });
                    addedCount++;
                }
            });

            updatedNode.bookings = bookings;
            const finalNode = applyAutoValuation(updatedNode);

            const updateRecursive = (nodes) => nodes.map(n => {
                if (n.id === selectedNode.id) return finalNode;
                if (n.children) return { ...n, children: updateRecursive(n.children) };
                return n;
            });
            
            updateTreeData({ banks: updateRecursive(data.banks) });
            setSelectedNode(finalNode);
            
            if (typeof window !== 'undefined' && window.showToast) {
                if (addedCount > 0) {
                    window.showToast(t ? t('msgPricesExtracted') || "Kurs(e) aus Transaktionen in Marktdaten übernommen." : "Kurs(e) aus Transaktionen in Marktdaten übernommen.", "success");
                } else {
                    window.showToast(t ? t('msgMarketValuesUpToDate') || "Marktwerte sind bereits auf dem neuesten Stand." : "Marktwerte sind bereits auf dem neuesten Stand.", "info");
                }
            }
        }} 
        className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 transition-colors shadow-sm"
        title={t ? t('titleSyncMarketValues') || "Extrahiert Kurse aus Transaktionen und ergänzt die Kurshistorie." : "Extrahiert Kurse aus Transaktionen und ergänzt die Kurshistorie."}
    >
        <Icon name="RefreshCw" size={16}/> {t ? t('btnSyncMarketValues') || 'Marktwerte synchronisieren' : 'Marktwerte synchronisieren'}
    </button>
)}
              </div>
            </div>

            {showFilters && (
              <div className="print-hide bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex flex-wrap gap-4 items-center text-sm shadow-inner animate-fade-in">
                  <div className="flex items-center gap-2">
                      <Icon name="Search" size={16} className="text-gray-400" />
                      <input 
                          type="text" placeholder={t ? t('placeholderSearchBookings') || "Suche (Betrag, Kategorie, Tags)..." : "Suche (Betrag, Kategorie, Tags)..."} 
                          value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
                          className="w-64 p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <div className="flex items-center gap-2">
                      <Icon name="Filter" size={16} className="text-gray-400" />
                      <select 
                          value={filterType} onChange={e => setFilterType(e.target.value)}
                          className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none"
                      >
                          <option value="">{t ? t('filterAllTypes') || "Alle Typen" : "Alle Typen"}</option>
                          <option value="Einzahlung">{t ? t('Einzahlung') || "Einzahlung" : "Einzahlung"}</option>
                          <option value="Auszahlung">{t ? t('Auszahlung') || "Auszahlung" : "Auszahlung"}</option>
                          <option value="Kauf">{t ? t('Kauf') || "Kauf" : "Kauf"}</option>
                          <option value="Verkauf">{t ? t('Verkauf') || "Verkauf" : "Verkauf"}</option>
                          <option value="Dividende">{t ? t('Dividende') || "Dividende" : "Dividende"}</option>
                          <option value="Zinszahlung">{t ? t('Zinszahlung') || "Zinszahlung" : "Zinszahlung"}</option>
                          <option value="Gebühr">{t ? t('Gebühr') || "Gebühr" : "Gebühr"}</option>
                      </select>
                  </div>
                  <div className="flex items-center gap-2">
                      <Icon name="Calendar" size={16} className="text-gray-400" />
                      <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none" />
                      <span>-</span>
                      <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none" />
                  </div>
                  {(filterQuery || filterType || filterDateFrom || filterDateTo) && (
                      <button onClick={() => { setFilterQuery(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="ml-auto text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                          <Icon name="X" size={14} /> {t ? t('btnResetFilter') || "Filter zurücksetzen" : "Filter zurücksetzen"}
                      </button>
                  )}
              </div>
            )}

            <div className="overflow-auto finspa-scrollbar flex-1 relative">
              <table className="w-full text-left text-sm border-collapse">
<thead className="bg-gray-50/90 dark:bg-slate-800/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
  <tr>
    <th className="w-10 p-4 border-b border-gray-200 dark:border-slate-700 print-hide">
        <input 
            type="checkbox" 
            checked={isAllSelected} 
            onChange={handleSelectAll} 
            className="w-4 h-4 text-indigo-600 rounded cursor-pointer" 
            title={t ? t('titleSelectAllVisible') : "Alle sichtbaren auswählen"} 
        />
    </th>
    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
        {t ? t('date') : 'Datum'}
    </th>
    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
        {t ? t('entryType') : 'Eintrag'}
    </th>
    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
        {isSecurities && activeTab === 'marketData' 
            ? (t ? t('colMarketPriceDetails') : 'Börsenkurs / Details') 
            : (t ? t('entryDetail') : 'Detail')}
    </th>
    <th className="p-4 text-right text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
        {isSecurities && activeTab === 'marketData' 
            ? (t ? t('colAssetValueAtDate') : 'Asset-Wert am Stichtag') 
            : (t ? t('amount') : 'Betrag')}
    </th>
    <th className="p-4 border-b border-gray-200 dark:border-slate-700 print-hide w-12"></th>
  </tr>
</thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                  {(() => {
                    const groupedByMonth = {};
                    sortedItems.forEach(item => {
                      const monthYear = item.date.substring(0, 7);
                      if (!groupedByMonth[monthYear]) groupedByMonth[monthYear] = [];
                      groupedByMonth[monthYear].push(item);
                    });

                    const getEndDayStr = (y, m) => {
                      const d = new Date(y, m, 0); 
                      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    };

                    const monthNames = [
                        t ? t('month01') || "Januar" : "Januar", t ? t('month02') || "Februar" : "Februar", t ? t('month03') || "März" : "März", t ? t('month04') || "April" : "April", 
                        t ? t('month05') || "Mai" : "Mai", t ? t('month06') || "Juni" : "Juni", t ? t('month07') || "Juli" : "Juli", t ? t('month08') || "August" : "August", 
                        t ? t('month09') || "September" : "September", t ? t('month10') || "Oktober" : "Oktober", t ? t('month11') || "November" : "November", t ? t('month12') || "Dezember" : "Dezember"
                    ];

                    return Object.keys(groupedByMonth).sort((a,b) => b.localeCompare(a)).map(monthYear => {
                      const items = groupedByMonth[monthYear];
                      const [year, month] = monthYear.split('-');
                      
                      let flowIn = 0; let flowOut = 0;
                      let flowInBase = 0; let flowOutBase = 0;
                      
                      items.forEach(item => {
                        if (!item._isBal) {
                          const flow = getBookingFlow(item);
                          const bRate = item.bookingExchangeRate ? parseRate(item.bookingExchangeRate) : (parseRate(adjustedNode.exchangeRate) || 1);
                          if (flow.isPositive) {
                              flowIn += flow.amount;
                              flowInBase += flow.amount * bRate;
                          } else {
                              flowOut += flow.amount;
                              flowOutBase += flow.amount * bRate;
                          }
                        }
                      });

                      const endOfMonthStr = getEndDayStr(year, parseInt(month));
                      const endOfPrevMonthStr = getEndDayStr(year, parseInt(month) - 1);
                      
                      const startBal = getAssetRawValueAtDate(adjustedNode, endOfPrevMonthStr);
                      const endBal = getAssetRawValueAtDate(adjustedNode, endOfMonthStr);
                      const startBalBase = getAssetValueAtDate(adjustedNode, endOfPrevMonthStr, allAssets);
                      const endBalBase = getAssetValueAtDate(adjustedNode, endOfMonthStr, allAssets);

                      return (
                        <React.Fragment key={`group-${monthYear}`}>
                          <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-y border-gray-200 dark:border-slate-700 shadow-sm">
                              <td colSpan="6" className="px-4 py-2">
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                      <span className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{`${monthNames[parseInt(month)-1]} ${year}`}</span>
                                      <div className="flex flex-wrap gap-4 sm:gap-6 text-[11px] md:text-xs tabular-nums">
                                          <span className="text-gray-500 flex flex-col items-start">
                                              <span><span className="hidden sm:inline">{t ? t('labelStart') || 'Start:' : 'Start:'}</span> {fCur ? fCur(startBal, adjustedNode.currency) : startBal}</span>
                                              {isForeignCurrency && <span className="text-[10px] opacity-60">≈ {fCur ? fCur(startBalBase, baseCurrency) : startBalBase}</span>}
                                          </span>
                                          {(!isSecurities || activeTab === 'transactions') && (
                                            <>
                                              <span className="text-emerald-600 font-medium flex flex-col items-start">
                                                  <span><span className="hidden sm:inline">{t ? t('labelIn') || 'In:' : 'In:'}</span> +{fCur ? fCur(flowIn, adjustedNode.currency) : flowIn}</span>
                                                  {isForeignCurrency && <span className="text-[10px] opacity-60">≈ +{fCur ? fCur(flowInBase, baseCurrency) : flowInBase}</span>}
                                              </span>
                                              <span className="text-rose-600 font-medium flex flex-col items-start">
                                                  <span><span className="hidden sm:inline">{t ? t('labelOut') || 'Out:' : 'Out:'}</span> -{fCur ? fCur(flowOut, adjustedNode.currency) : flowOut}</span>
                                                  {isForeignCurrency && <span className="text-[10px] opacity-60">≈ -{fCur ? fCur(flowOutBase, baseCurrency) : flowOutBase}</span>}
                                              </span>
                                            </>
                                          )}
                                          <span className="font-bold text-slate-800 dark:text-slate-200 flex flex-col items-start">
                                              <span><span className="hidden sm:inline">{t ? t('labelEnd') || 'Ende:' : 'Ende:'}</span> {fCur ? fCur(endBal, adjustedNode.currency) : endBal}</span>
                                              {isForeignCurrency && <span className="text-[10px] opacity-60">≈ {fCur ? fCur(endBalBase, baseCurrency) : endBalBase}</span>}
                                          </span>
                                      </div>
                                  </div>
                              </td>
                          </tr>
                          
                 {items.map(item => {
                            const flow = getBookingFlow(item);
                            let displayAmount = flow.amount;
                            let isPositiveType = flow.isPositive;

                            const bookingRate = item.bookingExchangeRate ? parseFloat(String(item.bookingExchangeRate).replace(',', '.')) : 0;
                            const nodeRate = adjustedNode.exchangeRate ? parseFloat(String(adjustedNode.exchangeRate).replace(',', '.')) : 1;
                            let usedRate = bookingRate;
                            if ((!usedRate || usedRate === 1) && (adjustedNode.currency && adjustedNode.currency !== (data?.settings?.baseCurrency || 'CHF'))) usedRate = nodeRate;
                            if (!usedRate) usedRate = 1;

                            const runningShares = getAssetSharesAtDate(adjustedNode, item.date);
                            const runningPrice = getAssetPriceAtDate(adjustedNode, item.date);
                            const runningTotal = getAssetRawValueAtDate(adjustedNode, item.date);
                            const runningTotalBase = runningTotal * usedRate; 
                            
                            let hoverText = `${t ? t('balanceAt') || 'Bestand am' : 'Bestand am'} ${item.date}: ${fCur ? fCur(runningTotal, adjustedNode.currency) : runningTotal}`;
if (isSecurities) {
    hoverText = `${t ? t('labelDateAt') || 'Stichtag' : 'Stichtag'}: ${item.date}\n${t ? t('labelSharesAtDate') || 'Stücke am Tag' : 'Stücke am Tag'}: ${runningShares} ${t ? t('labelPcs') || 'Stk.' : 'Stk.'}\n${t ? t('labelMarketPrice') || 'Börsenkurs' : 'Börsenkurs'}: ${runningPrice} ${adjustedNode.currency}\n${t ? t('labelValue') || 'Wert' : 'Wert'} (${adjustedNode.currency}): ${fCur ? fCur(runningTotal, adjustedNode.currency) : runningTotal}`;
}
                        if (isForeignCurrency) {
    hoverText += `\n${safeT('labelExchangeRate', 'Wechselkurs')}: ${usedRate}`;
    hoverText += `\n${safeT('inBaseCurrency', 'In Basiswährung')} (${baseCurrency}): ${fCur ? fCur(runningTotalBase, baseCurrency) : runningTotalBase}`;
}

                            const badgeColor = item._isBal 
                                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' 
                                : (isPositiveType 
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' 
                                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20');
                            
                            const amountColor = item._isBal ? 'text-blue-600 dark:text-blue-400' : (isPositiveType ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
                            const prefix = !item._isBal ? (isPositiveType ? '+' : '-') : '';
                            
                            let typeLabel = item.type;
                            if (!item._isBal) {
                              const typeMap = { 'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee', 'Umbuchung': 'typeTransfer' };
                              if (typeMap[item.type] && t) typeLabel = t(typeMap[item.type]);
                            }

                            let categoryDisplay = item._isBal ? (t ? t('systemManual') : 'System/Manuell') : (item.subCategory || '-');
                            if (isSecurities && item.type === 'Wertanpassung') {
                                categoryDisplay = `${t ? t('typeReval') : 'Kursupdate'}: ${item.price ? `${item.price} ${adjustedNode.currency}` : (t ? t('systemManual') : 'Manuelle Anpassung')}`;
                            }
                            
                            let bonusInfo = '';
                            if (!item._isBal && ['Kauf', 'Verkauf'].includes(item.type) && item.shares) bonusInfo += ` (${item.shares} ${t ? t('pcsAt') : 'Stk. à'} ${item.price})`;
                            if (item.bookingExchangeRate && item.bookingExchangeRate !== 1) bonusInfo += ` [FX-Kurs: ${item.bookingExchangeRate}]`;
                            if (isSecurities && item.type === 'Wertanpassung' && item.bookingExchangeRate && item.bookingExchangeRate !== 1) {
                                bonusInfo += ` [Wechselkurs: ${item.bookingExchangeRate}]`;
                            }
                            
                            const isSelected = selectedBookingIds.has(item.id);

                            return (
                            <tr 
                              key={item.id} 
                              title={hoverText}
                              draggable={!item._isBal && !item._isAutoValuation && !filterQuery && !filterType && !filterDateFrom && !filterDateTo}
                              onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedRowId(item.id);
                                  e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (draggedRowId && draggedRowId !== item.id && !item._isBal) {
                                      setDragOverRowId(item.id);
                                  }
                              }}
                              onDragLeave={() => setDragOverRowId(null)}
                              onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (draggedRowId && draggedRowId !== item.id) {
                                      handleRowDrop(draggedRowId, item.id);
                                  }
                                  setDragOverRowId(null);
                                  setDraggedRowId(null);
                              }}
                              onDragEnd={() => {
                                  setDragOverRowId(null);
                                  setDraggedRowId(null);
                              }}
                              className={`cursor-pointer transition-colors duration-150 group 
                                          ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'even:bg-gray-50/50 dark:even:bg-slate-800/20 hover:bg-gray-100 dark:hover:bg-slate-800/60'} 
                                          ${adjustedNode?.selectedBooking?.id === item.id ? '!bg-blue-100 dark:!bg-blue-900/40' : ''}
                                          ${dragOverRowId === item.id ? 'border-t-2 border-t-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''} 
                                          ${draggedRowId === item.id ? 'opacity-40' : ''}`} 
                              onClick={() => { if (setSelectedNode) setSelectedNode({ ...adjustedNode, selectedBooking: item }); }}
                            >
                              <td className={`${pClass} print-hide relative`} onClick={(e) => { e.stopPropagation(); toggleBookingSelection(item.id); }}>
                                  <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                                  {!item._isBal && !item._isAutoValuation && !filterQuery && !filterType && !filterDateFrom && !filterDateTo && (
                                      <Icon name="Menu" size={14} className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                                  )}
                              </td>
                              <td className={`${pClass} whitespace-nowrap tabular-nums`}>
                                  <span className={`font-medium ${isCompactMode ? 'text-xs' : 'text-sm'} text-gray-700 dark:text-gray-300`}>{item.date}</span>
                              </td>
                              <td className={`${pClass} whitespace-nowrap`}>
                                  {item._isBal ? (
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'} font-semibold rounded-full shadow-sm ${badgeColor}`}><Icon name="Activity" size={10}/> {t ? t('balanceLabel') : 'SALDO'}</span>
                                  ) : (
                                      <span className={`inline-flex items-center px-2.5 py-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'} font-semibold rounded-full shadow-sm ${badgeColor}`}>{typeLabel}</span>
                                  )}
                              </td>
                              
                              <td className={`${pClass} w-full`}>
                                  <div className="flex flex-col gap-0.5">
                                      <span className={`text-gray-700 dark:text-gray-300 font-medium ${isCompactMode ? 'text-xs' : 'text-sm'}`}>
                                          {categoryDisplay} {bonusInfo && <span className="text-gray-400 font-normal">{bonusInfo}</span>}
                                      </span>
                                      {!item._isBal && (
                                          editingCommentId === item.id ? (
                                              <input
                                                  type="text"
                                                  autoFocus
                                                  value={tempComment}
                                                  onChange={e => setTempComment(e.target.value)}
                                                  onBlur={() => saveInlineComment(item)}
                                                  onKeyDown={e => { if(e.key === 'Enter') saveInlineComment(item); if(e.key === 'Escape') setEditingCommentId(null); }}
                                                  onClick={e => e.stopPropagation()}
                                                  className="w-full text-xs p-1 mt-1 border border-blue-300 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-500"
                                                  placeholder={t ? t('placeholderNoteTag') || "Notiz/Tag eingeben..." : "Notiz/Tag eingeben..."}
                                              />
                                          ) : (
                                              <span 
                                                  className="text-xs text-gray-500 cursor-text hover:text-blue-500 transition-colors py-0.5 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 rounded px-1 -ml-1"
                                                  onClick={(e) => { e.stopPropagation(); setTempComment(item.comment || ''); setEditingCommentId(item.id); }}
                                                  title={t ? t('titleClickToEdit') || "Klicken zum Bearbeiten" : "Klicken zum Bearbeiten"}
                                              >
                                                  {item.comment ? renderSmartTags(item.comment) : <span className="opacity-40 italic flex items-center gap-1"><Icon name="Edit3" size={10}/> {t ? t('labelAddNote') || 'Notiz hinzufügen...' : 'Notiz hinzufügen...'}</span>}
                                              </span>
                                          )
                                      )}
                                  </div>
                              </td>
                              
                              <td className={`${pClass} text-right font-bold whitespace-nowrap flex flex-col items-end ${amountColor} tabular-nums`}>
                                {isSecurities && activeTab === 'marketData' ? (
                                  <>
                                    <span className="tracking-tight">{fCur ? fCur(runningTotal, adjustedNode.currency) : runningTotal}</span>
                                    {isForeignCurrency && !isCompactMode && (
                                        <span className="text-[10px] opacity-60 font-medium tracking-wider mt-0.5 text-gray-500 tabular-nums">
                                            ≈ {fCur ? fCur(runningTotalBase, baseCurrency) : runningTotalBase}
                                        </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="tracking-tight">{prefix}{fCur ? fCur(displayAmount, adjustedNode.currency) : displayAmount}</span>
                                    {(adjustedNode.currency && adjustedNode.currency !== (data?.settings?.baseCurrency || 'CHF')) && !isCompactMode && (
                                        <span className="text-[10px] opacity-60 font-medium tracking-wider mt-0.5 text-gray-500 tabular-nums">
                                            ≈ {fCur ? fCur(displayAmount * usedRate, data?.settings?.baseCurrency || 'CHF') : (displayAmount * usedRate)}
                                        </span>
                                    )}
                                  </>
                                )}
                              </td>
                              
                              <td className={`${pClass} text-center print-hide opacity-0 group-hover:opacity-100 transition-all duration-200`}>
                                  {!item._isAutoValuation ? (
                                    <span 
                                       className="inline-flex p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors cursor-pointer" 
                                       onClick={(e) => handleDeleteEntry(item, e)} 
                                       title={t ? t('btnDelete') : 'Löschen'}
                                    >
                                       <Icon name="Trash" size={16}/>
                                    </span>
                                  ) : (
                                    <span className="inline-flex p-1.5 rounded-md text-gray-300 dark:text-slate-700 cursor-not-allowed" title={t ? t('titleSystemEntry') || "System-Eintrag (wird bei Bereinigung automatisch entfernt)" : "System-Eintrag (wird bei Bereinigung automatisch entfernt)"}>
                                       <Icon name="Lock" size={16}/>
                                    </span>
                                  )}
                              </td>
                            </tr>
                          )})}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {sortedItems.length > 0 && (!isSecurities || activeTab === 'transactions') && (
                  <div className="sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 print-hide">
                      <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                          {t ? t('labelSumDisplayedEntries') || 'Summe der angezeigten Einträge' : 'Summe der angezeigten Einträge'} ({sortedItems.filter(i=>!i._isBal && i.type !== 'Wertanpassung').length})
                      </div>
                      <div className="flex gap-6 text-sm tabular-nums">
                          <div className="flex flex-col items-end">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{t ? t('labelInflows') || 'Eingänge' : 'Eingänge'}</span>
                              <span className="font-bold text-emerald-600">+{fCur ? fCur(totalInRaw, adjustedNode.currency) : totalInRaw}</span>
                          </div>
                          <div className="flex flex-col items-end">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{t ? t('labelOutflows') || 'Ausgänge' : 'Ausgänge'}</span>
                              <span className="font-bold text-rose-600">-{fCur ? fCur(totalOutRaw, adjustedNode.currency) : totalOutRaw}</span>
                          </div>
                          <div className="flex flex-col items-end border-l border-gray-200 dark:border-slate-700 pl-6 ml-2">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{t ? t('labelNet') || 'Netto' : 'Netto'}</span>
                              <span className={`font-black ${totalInRaw - totalOutRaw >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {totalInRaw - totalOutRaw >= 0 ? '+' : ''}{fCur ? fCur(totalInRaw - totalOutRaw, adjustedNode.currency) : (totalInRaw - totalOutRaw)}
                              </span>
                          </div>
                      </div>
                  </div>
              )}
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
    <>
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950 finspa-scrollbar overflow-auto">
        <div className="text-center text-gray-400">
          <Icon name="PieChart" size={64} className="mx-auto mb-6 opacity-20 text-blue-500" />
          <h2 className="text-2xl font-bold mb-2 text-gray-600 dark:text-gray-300">{t ? t('welcomeTitle') : 'Willkommen in FinBundle Pro'}</h2>
          <p>{t ? t('welcomePrompt') : 'Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.'}</p>
        </div>
      </div>
    </>
  );
};

module.exports = EditorArea;