const React = require('react');
const { useState, useEffect, useRef } = React; 

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
const DividendCalendarReport = safeRequire('./reports/DividendCalendarReport.jsx') || (() => <div>DividendCalendarReport</div>);
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || safeRequire('../api/UniversalChart.jsx') || window.UniversalChart || (() => null);
const ApiSyncEngine = safeRequire('../../api/ApiSyncEngine.jsx') || safeRequire('../api/ApiSyncEngine.jsx') || { fetchAssetPrice: async () => null };
const ApiLiveEditorDashboard = safeRequire('./ApiLiveEditorDashboard.jsx') || (() => <div className="p-8">ApiLiveEditorDashboard.jsx fehlt</div>);
const ReportHeader = safeRequire('./ReportHeader.jsx') || (() => null);

const { getFinSpaApiScript } = safeRequire('../../api/FinSpaApiInject.js') || safeRequire('../api/FinSpaApiInject.js') || require('../../api/FinSpaApiInject.js');

// --- ROBUSTER PDFTOOLKIT RESOLVER ---
const resolvePdfToolkit = () => {
  try { 
    const mod = require('./print/PdfToolkit.jsx'); 
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod; 
  } catch(e) {}
  try { 
    const mod = require('../print/PdfToolkit.jsx'); 
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod; 
  } catch(e) {}

  if (typeof window !== 'undefined') {
    if (window.PdfToolkit && typeof window.PdfToolkit.exportReport === 'function') return window.PdfToolkit;
    if (window.PdfExportEngine && typeof window.PdfExportEngine.exportReport === 'function') return window.PdfExportEngine;
    if (window.__FinSPAModules) {
      const keys = Object.keys(window.__FinSPAModules);
      const foundKey = keys.find(k => k.includes('PdfToolkit') || k.includes('PdfExportEngine'));
      if (foundKey) {
        if (typeof window.require === 'function') {
          try { const mod = window.require(foundKey); if (mod) return mod.default || mod; } catch(e) {}
        }
        const m = window.__FinSPAModules[foundKey];
        if (m) return m.exports?.default || m.exports || m;
      }
    }
  }
  return null;
};

const activePdfToolkit = resolvePdfToolkit();
if (typeof window !== 'undefined' && activePdfToolkit) {
    window.PdfToolkit = activePdfToolkit;
    window.PdfExportEngine = activePdfToolkit;
}

const parseRate = (val) => parseFloat(String(val || '1').replace(',', '.'));

const safeT = (t, key, fallback) => {
    if (!t) return fallback;
    const res = t(key);
    return (res && res !== key) ? res : fallback;
};

const JsonNode = ({ label, data, depth = 0, t }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isObject = data !== null && typeof data === 'object';
    
    const handleCopy = (payload) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgCopied', "In Zwischenablage kopiert"), "success");
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
                    {label} <span className="text-[10px] text-gray-400 font-normal">({childCount} {isArray ? safeT(t, 'labelEntries', 'Einträge') : safeT(t, 'labelFields', 'Felder')})</span>
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleCopy(data); }}
                    className="opacity-0 group-hover:opacity-100 bg-gray-100 dark:bg-slate-800 p-1 rounded hover:bg-blue-100 transition-all"
                    title={safeT(t, 'titleCopyBlock', "Diesen Block kopieren")}
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

const Sparkline = ({ dataSeries, dateSeries, title }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    if (!dataSeries || dataSeries.length < 2) return null;
    
    let startIndex = 0;
    while (startIndex < dataSeries.length - 1 && dataSeries[startIndex] === 0) {
        startIndex++;
    }
    let plotData = dataSeries.slice(startIndex);
    let plotDates = dateSeries ? dateSeries.slice(startIndex) : [];
    if (plotData.length < 2) {
        plotData = dataSeries;
        plotDates = dateSeries || [];
    }

    const min = Math.min(...plotData);
    const max = Math.max(...plotData);
    const range = max - min || 1;
    
    const timestamps = plotDates.map(dateStr => new Date(dateStr).getTime());
    const minTime = timestamps.length > 0 ? timestamps[0] : 0;
    const maxTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    const timeRange = maxTime - minTime || 1; 
    
    const paddingX = 6;
    const paddingY = 8;
    const bottomPadding = 18; 
    const width = 160;   
    const height = 70; 

    const chartHeight = height - bottomPadding;

    const getCoords = (d, i) => {
        let xPct;
        if (timestamps.length === plotData.length && timeRange > 0) {
            xPct = (timestamps[i] - minTime) / timeRange;
        } else {
            xPct = plotData.length > 1 ? i / (plotData.length - 1) : 0;
        }
        
        const x = paddingX + xPct * (width - paddingX * 2);
        const y = chartHeight - paddingY - ((d - min) / range) * (chartHeight - paddingY * 2);
        return { x, y };
    };

    const points = plotData.map((d, i) => `${getCoords(d, i).x},${getCoords(d, i).y}`).join(' L ');
    const firstPt = getCoords(plotData[0], 0);
    const lastPt = getCoords(plotData[plotData.length - 1], plotData.length - 1);
    const areaPath = `M ${firstPt.x},${chartHeight} L ${points} L ${lastPt.x},${chartHeight} Z`;

    const isPositive = plotData[plotData.length - 1] >= plotData[0];
    const strokeColor = isPositive ? '#10b981' : '#ef4444'; 
    const gradientId = `sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        let closestIdx = 0;
        let minDiff = Infinity;
        
        for (let i = 0; i < plotData.length; i++) {
            const ptX = getCoords(plotData[i], i).x;
            const diff = Math.abs(mouseX - ptX);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        
        setHoveredIdx(closestIdx);
        const coords = getCoords(plotData[closestIdx], closestIdx);
        setTooltipPos({ x: coords.x, y: coords.y });
    };

    return (
        <div className="flex flex-col items-end justify-center shrink-0 group relative" title={title}>
            <div className="bg-gray-50/80 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/60 rounded-xl p-2 pb-1 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:border-gray-300 dark:group-hover:border-slate-600 relative">
                <svg 
                    width={width} 
                    height={height} 
                    className="overflow-visible cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredIdx(null)}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                        </linearGradient>
                    </defs>
                    
                    <line x1={paddingX} y1={firstPt.y} x2={width - paddingX} y2={firstPt.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" className="dark:stroke-slate-600" />
                    <line x1={paddingX} y1={chartHeight} x2={width - paddingX} y2={chartHeight} stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" className="dark:stroke-slate-700" />
                    <line x1={paddingX} y1={paddingY - 4} x2={paddingX} y2={chartHeight} stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" className="dark:stroke-slate-700" />

                    {(() => {
                        const ticks = [];
                        let lastMonth = -1;
                        let lastYear = -1;
                        plotDates.forEach((dateStr, i) => {
                            if (!dateStr) return;
                            const [yyyy, mm] = dateStr.split('-');
                            const year = parseInt(yyyy, 10);
                            const month = parseInt(mm, 10);
                            if (month !== lastMonth || year !== lastYear || i === 0) {
                                ticks.push({ i, year, month, dateStr });
                                lastMonth = month;
                                lastYear = year;
                            }
                        });
                        
                        const renderTicks = [];
                        let lastX = -50;
                        ticks.forEach(t => {
                            const x = getCoords(plotData[t.i], t.i).x;
                            if (x - lastX > 16) { 
                                renderTicks.push({ ...t, x });
                                lastX = x;
                            }
                        });

                        const monthNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
                        
                        return renderTicks.map((t, idx) => {
                            const isJan = t.month === 1;
                            const showYear = isJan || (idx === 0 && renderTicks.length < 5);
                            const label = showYear ? `'${t.year.toString().slice(-2)}` : monthNames[t.month - 1];
                            
                            return (
                                <g key={idx}>
                                    <line x1={t.x} y1={chartHeight} x2={t.x} y2={chartHeight + 3} stroke="#cbd5e1" className="dark:stroke-slate-600" strokeWidth="1" />
                                    <text x={t.x} y={chartHeight + 12} fontSize={showYear ? "9" : "8"} fontWeight={showYear ? "bold" : "normal"} fill="#94a3b8" className="dark:fill-slate-500" textAnchor="middle">
                                        {label}
                                    </text>
                                </g>
                            );
                        });
                    })()}

                    <path d={areaPath} fill={`url(#${gradientId})`} />
                    <path d={`M ${points}`} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {plotData.map((d, i) => {
                        const { x, y } = getCoords(d, i);
                        const isLast = i === plotData.length - 1;
                        const isCurrentHovered = hoveredIdx === i;
                        return (
                            <circle 
                                key={i} 
                                cx={x} 
                                cy={y} 
                                r={isCurrentHovered ? "4" : (isLast ? "2.5" : "1.5")} 
                                className="fill-white dark:fill-slate-900 transition-all pointer-events-none" 
                                stroke={strokeColor} 
                                strokeWidth={isCurrentHovered ? "2" : (isLast ? "1.5" : "1")} 
                            />
                        );
                    })}

                    {hoveredIdx !== null && (
                        <line 
                            x1={getCoords(plotData[hoveredIdx], hoveredIdx).x} 
                            y1={paddingY - 4} 
                            x2={getCoords(plotData[hoveredIdx], hoveredIdx).x} 
                            y2={chartHeight} 
                            stroke={strokeColor} 
                            strokeWidth="1" 
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                        />
                    )}
                </svg>

                {hoveredIdx !== null && (
                    <div 
                        className="absolute bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-sm text-white text-[10px] py-1 px-2 rounded shadow-xl pointer-events-none z-50 transition-all duration-75 font-mono border border-slate-700"
                        style={{
                            left: `${Math.min(Math.max(tooltipPos.x - 40, 0), width - 75)}px`,
                            bottom: `${height + 8}px`
                        }}
                    >
                        <div className="font-semibold text-slate-300 text-center text-[9px]">{plotDates[hoveredIdx] || ''}</div>
                        <div className="font-bold text-center">{plotData[hoveredIdx].toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                )}
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 mr-1">{title}</span>
        </div>
    );
};

const EditorArea = ({ data, lang, viewMode, setViewMode, activeReport, setActiveReport, selectedNode, setSelectedNode, isTreeVisible, setIsTreeVisible, showArchived, dateRange, setDateRange, modalObj, setModalObj, updateTreeData, fCur, t, showToast }) => {
  const allAssets = getAllAssets(data?.banks || []) || [];
  const activeAssets = showArchived ? allAssets : allAssets.filter(a => !a?.isArchived);
  const activeChartEngine = data?.settings?.chartEngine || 'echarts';
  
  const detectLanguage = () => {
    if (lang) return lang;
    if (typeof t === 'function') {
      const p = t('filePrint');
      if (p === 'Print') return 'en';
      if (p === 'Imprimer') return 'fr';
      if (p === 'Stampa') return 'it';
      if (p === 'Drucken') return 'de';
    }
    return data?.settings?.language || 'de';
  };
  const activeLang = detectLanguage();
  
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

  // States für Plugin-Manager & Import/Export
  const [editingPlugin, setEditingPlugin] = useState(null);
  const [pluginSearch, setPluginSearch] = useState('');
  const [pluginCategoryFilter, setPluginCategoryFilter] = useState('ALL');
  const pluginFileInputRef = useRef(null);

  // States für das Fly-In (Rechte Seitenleiste)
  const [isFlyInOpen, setIsFlyInOpen] = useState(false);
  const [flyInActivePluginId, setFlyInActivePluginId] = useState(null);
  const [flyInSearch, setFlyInSearch] = useState('');
  const flyInSearchInputRef = useRef(null);

  // Verlauf der zuletzt aufgerufenen Assets
  const [recentAssetIds, setRecentAssetIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('finbundle_recent_assets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    if (selectedNode && selectedNode.type === 'asset' && selectedNode.id) {
      setRecentAssetIds(prev => {
        const next = [selectedNode.id, ...prev.filter(id => id !== selectedNode.id)].slice(0, 4);
        try { localStorage.setItem('finbundle_recent_assets', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    }
  }, [selectedNode?.id]);

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

  useEffect(() => {
    if (isFlyInOpen && !flyInActivePluginId) {
      const plugins = data?.plugins || [];
      const firstPinned = plugins.find(p => p.isPinned) || plugins[0];
      if (firstPinned) setFlyInActivePluginId(firstPinned.id);
    }
  }, [isFlyInOpen, data?.plugins]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFlyInOpen) {
        setIsFlyInOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsFlyInOpen(prev => {
          const next = !prev;
          if (next) {
            setTimeout(() => flyInSearchInputRef.current?.focus(), 100);
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlyInOpen]);

  useEffect(() => {
    if (isFlyInOpen) {
      setTimeout(() => flyInSearchInputRef.current?.focus(), 80);
    } else {
      setFlyInSearch('');
    }
  }, [isFlyInOpen]);

  useEffect(() => {
    const handlePdfMessage = async (e) => {
      if (e.data && e.data.type === 'FINSPA_PDF_EXPORT') {
        const config = e.data.config;
        const engine = resolvePdfToolkit();
        if (engine && typeof engine.exportReport === 'function') {
          await engine.exportReport({
            ...config,
            data: config.data || data
          });
          if (showToast) showToast(safeT(t, 'msgExportSuccess', "PDF erfolgreich generiert"), "success");
        } else {
          alert(safeT(t, 'errPdfLibs', "PDF-Bibliotheken nicht initialisiert."));
        }
      }
    };
    window.addEventListener('message', handlePdfMessage);
    return () => window.removeEventListener('message', handlePdfMessage);
  }, [data, showToast, t]);

  const navigate = (targetViewMode, targetActiveReport = null) => {
    if (typeof setViewMode === 'function') setViewMode(targetViewMode);
    if (typeof setActiveReport === 'function') setActiveReport(targetActiveReport);
    if (typeof setSelectedNode === 'function') setSelectedNode(null);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('finspa-navigate', {
        detail: { viewMode: targetViewMode, activeReport: targetActiveReport }
      }));
    }
  };

  const applyAutoValuation = (assetNode) => {
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(assetNode.assetClass);
      if (!isSecurities || !assetNode.bookings) return assetNode;

      let copy = { ...assetNode, bookings: [...assetNode.bookings] };
      const localizedAutoString = safeT(t, 'autoAdjustment', 'Auto-Anpassung');
      
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
          if (bPrice > 0) latestPrice = bPrice;

          if (totalShares > 0 && latestPrice > 0) {
              const expectedMarketValue = totalShares * latestPrice;
              const diff = expectedMarketValue - runningPrincipalRaw;

              if (Math.abs(diff) > 0.01) {
                  const adjAmount = Number(diff.toFixed(2));
                  finalBookings.push({
                      id: Math.random().toString(36).substr(2, 9), 
                      date: b.date, 
                      type: 'Wertanpassung',
                      subCategory: `${localizedAutoString} (Kurs)`,
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
                  subCategory: `${localizedAutoString} (Aktueller Kurs)`,
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

  const buildPluginHtml = (rawHtml) => {
    const injectedScripts = `
    <style>
        html, body {
            margin: 0;
            padding: 16px;
            box-sizing: border-box;
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #ffffff;
        }
        * { box-sizing: inherit; }
        canvas { max-width: 100% !important; background-color: #ffffff; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script>
        window.__finspaLang = "${activeLang}";
        window.PdfToolkit = window.parent.PdfToolkit || window.parent.PdfExportEngine || window.PdfToolkit;
        window.PdfExportEngine = window.PdfToolkit;
    </script>
    ${getFinSpaApiScript(activeLang)}
    <script>
        if (window.FinSPA_API) {
            window.FinSPA_API.getLanguage = function() { return "${activeLang}"; };
        }
        window.finspaData = ${JSON.stringify(data).replace(/</g, '\\u003c')};
    </script>
    `;

    if (rawHtml.includes('</head>')) return rawHtml.replace('</head>', injectedScripts + '\n</head>');
    return injectedScripts + rawHtml;
  };

  const togglePinPlugin = (pluginId) => {
    const plugins = data?.plugins || [];
    const updated = plugins.map(p => p.id === pluginId ? { ...p, isPinned: !p.isPinned } : p);
    if (updateTreeData) updateTreeData({ plugins: updated });
    const target = updated.find(p => p.id === pluginId);
    if (showToast) {
      showToast(target.isPinned ? `${safeT(t, 'msgPluginPinned', 'Plugin an Schnellzugriff angepinnt')}: "${target.title}"` : `${safeT(t, 'msgPluginUnpinned', 'Plugin gelöst')}: "${target.title}"`, "info");
    }
  };

  const getCategoryBadgeClass = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('perform') || cat.includes('rendite') || cat.includes('chart')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60';
    }
    if (cat.includes('vorsorge') || cat.includes('pension') || cat.includes('fire') || cat.includes('3a')) {
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60';
    }
    if (cat.includes('divid') || cat.includes('cash') || cat.includes('ertrag')) {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60';
    }
    if (cat.includes('steuer') || cat.includes('risk') || cat.includes('recht')) {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60';
    }
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60';
  };

  // =========================================================================
  // RECHTER FLY-IN DRAWER
  // =========================================================================
  const renderFlyInDrawer = () => {
    const allPlugins = data?.plugins || [];
    const pinnedPlugins = allPlugins.filter(p => p.isPinned);
    const displayPlugins = pinnedPlugins.length > 0 ? pinnedPlugins : allPlugins.slice(0, 4);

    const isAssetSelected = selectedNode && selectedNode.type === 'asset';

    const recentAssets = recentAssetIds
      .map(id => allAssets.find(a => a.id === id))
      .filter(Boolean);

    const quickReports = [
      { id: 'allocation', title: safeT(t, 'repAllocTitle', 'Asset Allokation'), icon: 'Layers', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
      { id: 'dividendCalendar', title: safeT(t, 'repDivCalTitle', 'Dividendenkalender'), icon: 'Calendar', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' },
      { id: 'securities', title: safeT(t, 'repSecTitle', 'Wertschriften'), icon: 'TrendingUp', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
      { id: 'categoryFlow', title: safeT(t, 'repCatFlowTitle', 'Kategorienfluss'), icon: 'GitMerge', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' }
    ];

    const query = flyInSearch.trim().toLowerCase();
    const searchResults = {
      assets: query ? allAssets.filter(a => (a.name || '').toLowerCase().includes(query) || (a.assetClass || '').toLowerCase().includes(query)).slice(0, 5) : [],
      plugins: query ? allPlugins.filter(p => (p.title || p.name || '').toLowerCase().includes(query) || (p.category || '').toLowerCase().includes(query)).slice(0, 4) : [],
      reports: query ? quickReports.filter(r => r.title.toLowerCase().includes(query)) : []
    };

    const hasSearchResults = query && (searchResults.assets.length > 0 || searchResults.plugins.length > 0 || searchResults.reports.length > 0);

    return (
      <>
        <div 
          onClick={() => setIsFlyInOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 group cursor-pointer transition-all duration-300"
          title={safeT(t, 'flyInOpenTooltip', 'Schnellzugriff & Command-Center öffnen (Strg + K)')}
        >
          <div className="bg-slate-900/90 hover:bg-blue-600 text-white backdrop-blur-md py-4 px-2.5 rounded-l-2xl shadow-2xl flex flex-col items-center gap-2 border-y border-l border-slate-700/80 hover:border-blue-400/80 transition-all hover:pr-3.5">
            <div className="relative">
              <Icon name="Zap" size={16} className="text-amber-400 group-hover:scale-110 transition-transform duration-300" />
              {pinnedPlugins.length > 0 && (
                <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-slate-900 group-hover:ring-blue-600">
                  {pinnedPlugins.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-1.5 opacity-90 group-hover:opacity-100">
              {safeT(t, 'flyInTitleTab', 'Schnell-Zugriff')}
            </span>
            <Icon name="ChevronLeft" size={12} className="text-slate-400 group-hover:text-white transition-colors" />
          </div>
        </div>

        {isFlyInOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div 
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
              onClick={() => setIsFlyInOpen(false)}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-xl bg-white dark:bg-slate-950 shadow-2xl border-l border-gray-200 dark:border-slate-800 flex flex-col animate-slide-left">
                
                <div className="p-5 px-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
                      <Icon name="Zap" size={18} className="text-amber-300" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {safeT(t, 'flyInHeaderTitle', 'FinBundle Schnellzugriff')}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{safeT(t, 'flyInHeaderSubtitle', 'Aktionen, Favoriten & benutzerdefinierte Plugins')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-800 text-gray-500 font-semibold">
                      ESC
                    </span>
                    <button 
                      onClick={() => setIsFlyInOpen(false)}
                      className="p-2 rounded-xl text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Icon name="X" size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-4 px-6 border-b border-gray-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 shrink-0">
                  <div className="relative">
                    <Icon name="Search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      ref={flyInSearchInputRef}
                      type="text"
                      value={flyInSearch}
                      onChange={e => setFlyInSearch(e.target.value)}
                      placeholder={safeT(t, 'flyInSearchPlaceholder', 'Asset, Plugin oder Bericht suchen...')}
                      className="w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    {flyInSearch && (
                      <button 
                        onClick={() => setFlyInSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <Icon name="X" size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto finspa-scrollbar p-6 space-y-6">

                  {query ? (
                    <div className="space-y-4 animate-fade-in">
                      {searchResults.assets.length > 0 && (
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <Icon name="PieChart" size={12} /> {safeT(t, 'flyInFoundAssets', 'Gefundene Assets')} ({searchResults.assets.length})
                          </div>
                          <div className="space-y-1.5">
                            {searchResults.assets.map(asset => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              const val = getAssetValueAtDate(asset, todayStr, allAssets);
                              return (
                                <div
                                  key={asset.id}
                                  onClick={() => {
                                    setIsFlyInOpen(false);
                                    setSelectedNode(asset);
                                    setActiveReport(null);
                                    setViewMode('vermoegen');
                                  }}
                                  className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-gray-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/70 dark:border-slate-800 hover:border-blue-400 cursor-pointer transition-all"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <Icon name="CheckCircle" size={13} className="text-blue-500 shrink-0" />
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{asset.name}</span>
                                    <span className="text-[10px] text-gray-400 uppercase">({asset.assetClass})</span>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                                    {fCur ? fCur(val, data?.settings?.baseCurrency || 'CHF') : val}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {searchResults.plugins.length > 0 && (
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <Icon name="Box" size={12} /> {safeT(t, 'flyInFoundPlugins', 'Gefundene Plugins')} ({searchResults.plugins.length})
                          </div>
                          <div className="space-y-1.5">
                            {searchResults.plugins.map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setIsFlyInOpen(false);
                                  navigate('plugin', p.id);
                                }}
                                className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-gray-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/70 dark:border-slate-800 hover:border-blue-400 cursor-pointer transition-all"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Icon name="Sparkles" size={13} className="text-amber-500 shrink-0" />
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{p.title || p.name}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getCategoryBadgeClass(p.category)}`}>
                                  {p.category || 'Allgemein'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchResults.reports.length > 0 && (
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <Icon name="FileText" size={12} /> {safeT(t, 'flyInFoundReports', 'Gefundene Berichte')} ({searchResults.reports.length})
                          </div>
                          <div className="space-y-1.5">
                            {searchResults.reports.map(rep => (
                              <div
                                key={rep.id}
                                onClick={() => {
                                  setIsFlyInOpen(false);
                                  navigate('vermoegen', rep.id);
                                }}
                                className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-gray-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/70 dark:border-slate-800 hover:border-blue-400 cursor-pointer transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  <Icon name={rep.icon} size={14} className="text-blue-500" />
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{rep.title}</span>
                                </div>
                                <Icon name="ArrowRight" size={12} className="text-gray-400" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!hasSearchResults && (
                        <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                          <Icon name="Search" size={24} className="mx-auto mb-2 opacity-40 text-blue-500" />
                          <p className="text-xs font-bold">{safeT(t, 'flyInNoResultsTitle', 'Keine Treffer für')} "{flyInSearch}"</p>
                          <p className="text-[11px] text-gray-400 mt-1">{safeT(t, 'flyInNoResultsDesc', 'Überprüfen Sie die Eingabe oder leeren Sie das Suchfeld.')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2">
                          <Icon name="Activity" size={13} /> {safeT(t, 'flyInFrequentActions', 'Häufige Aktionen')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          
                          {isAssetSelected ? (
                            <button
                              onClick={() => {
                                setIsFlyInOpen(false);
                                const ac = selectedNode.assetClass;
                                let defType = 'Einzahlung';
                                if (ac === 'realestate') defType = 'Wertanpassung';
                                else if (ac === 'mortgage') defType = 'Abzahlung';
                                else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) defType = 'Kauf';
                                setModalObj({ type: 'addBooking', assetId: selectedNode.id, defaultType: defType });
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/80 dark:border-slate-800 hover:border-blue-400 text-left transition-all cursor-pointer group shadow-xs"
                            >
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                                <Icon name="PlusCircle" size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{safeT(t, 'flyInNewBooking', 'Neue Buchung')}</span>
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded">{safeT(t, 'flyInActiveBadge', 'Aktiv')}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{safeT(t, 'flyInForAsset', 'Für:')} {selectedNode.name}</div>
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (showToast) {
                                  showToast(safeT(t, 'msgSelectAssetFirst', 'Bitte wähle zuerst links ein konkretes Asset aus, um eine Buchung zu erfassen.'), 'error');
                                }
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 dark:bg-slate-900/40 border border-dashed border-gray-300 dark:border-slate-800 text-left transition-all cursor-not-allowed group opacity-60 hover:opacity-80"
                              title={safeT(t, 'flyInSelectAssetPrompt', 'Bitte zuerst ein Asset im Navigationsbaum links auswählen')}
                            >
                              <div className="p-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-400 group-hover:scale-105 transition-transform shrink-0">
                                <Icon name="PlusCircle" size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate">{safeT(t, 'flyInNewBooking', 'Neue Buchung')}</span>
                                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">{safeT(t, 'flyInSelectAssetBadge', 'Asset wählen')}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 truncate">{safeT(t, 'flyInNoActiveAsset', 'Kein Asset aktiv')}</div>
                              </div>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setIsFlyInOpen(false);
                              if (isAssetSelected && ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(selectedNode.assetClass)) {
                                const fetchBtn = document.querySelector('button[title*="Alpha Vantage"]');
                                if (fetchBtn) fetchBtn.click();
                                else if (showToast) showToast(`${safeT(t, 'msgSyncingPriceFor', 'Aktualisiere Kurs für')} ${selectedNode.name}...`, 'info');
                              } else {
                                if (showToast) showToast(safeT(t, 'msgSyncAllSecuritiesStarted', "Marktdaten-Sync für alle aktiven Wertschriften gestartet..."), "info");
                              }
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/80 dark:border-slate-800 hover:border-indigo-300 text-left transition-all cursor-pointer group"
                          >
                            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                              <Icon name="Cloud" size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{safeT(t, 'flyInLiveRates', 'Live-Kurse')}</div>
                              <div className="text-[10px] text-gray-400 truncate">{safeT(t, 'flyInFetchMarketData', 'Marktdaten abrufen')}</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setIsFlyInOpen(false);
                              setModalObj({ type: 'pdfImport' });
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/80 dark:border-slate-800 hover:border-emerald-300 text-left transition-all cursor-pointer group"
                          >
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                              <Icon name="FileText" size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{safeT(t, 'flyInPdfScanner', 'PDF Scanner')}</div>
                              <div className="text-[10px] text-gray-400 truncate">{safeT(t, 'flyInParseBankDoc', 'Bankbeleg parsen')}</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setIsFlyInOpen(false);
                              setModalObj({ type: 'csvImport' });
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-gray-200/80 dark:border-slate-800 hover:border-purple-300 text-left transition-all cursor-pointer group"
                          >
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                              <Icon name="Upload" size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{safeT(t, 'flyInCsvImport', 'CSV Import')}</div>
                              <div className="text-[10px] text-gray-400 truncate">{safeT(t, 'flyInStartWizard', 'Assistent starten')}</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                            <Icon name="Box" size={13} /> {safeT(t, 'flyInPinnedPlugins', 'Angepinnte Plugins')} ({displayPlugins.length})
                          </h4>
                          <button 
                            onClick={() => {
                              setIsFlyInOpen(false);
                              navigate('managePlugins', null);
                            }}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                          >
                            {safeT(t, 'flyInManageAll', 'Alle verwalten →')}
                          </button>
                        </div>

                        {displayPlugins.length === 0 ? (
                          <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-gray-50 dark:bg-slate-900/40">
                            <Icon name="Bookmark" size={24} className="mx-auto text-amber-500/40 mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{safeT(t, 'flyInNoPluginsPinned', 'Keine Plugins angeheftet')}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{safeT(t, 'flyInNoPluginsPinnedDesc', 'Erstellen Sie Add-Ins mit dem KI Copilot oder importieren Sie fertige Vorlagen.')}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {displayPlugins.map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setIsFlyInOpen(false);
                                  navigate('plugin', p.id);
                                }}
                                className="group relative p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getCategoryBadgeClass(p.category)}`}>
                                      {p.category || 'Allgemein'}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePinPlugin(p.id);
                                      }}
                                      className="text-amber-500 hover:scale-110 p-0.5 transition-transform cursor-pointer"
                                      title={p.isPinned ? safeT(t, 'flyInActionUnpin', "Vom Schnellzugriff lösen") : safeT(t, 'flyInActionPin', "Anpinnen")}
                                    >
                                      <Icon name="Bookmark" size={14} className={p.isPinned ? "fill-amber-500" : ""} />
                                    </button>
                                  </div>
                                  <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {p.title || p.name}
                                  </h5>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 text-[10px] text-gray-400 font-medium">
                                  <span>{safeT(t, 'flyInActionOpen', 'Öffnen')}</span>
                                  <Icon name="ArrowRight" size={12} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {recentAssets.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5 flex items-center gap-2">
                            <Icon name="Clock" size={13} /> {safeT(t, 'flyInRecentAssets', 'Zuletzt geöffnete Assets')}
                          </h4>
                          <div className="space-y-1.5">
                            {recentAssets.map(asset => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              const val = getAssetValueAtDate(asset, todayStr, allAssets);
                              const isSelected = selectedNode?.id === asset.id;
                              return (
                                <div
                                  key={asset.id}
                                  onClick={() => {
                                    setIsFlyInOpen(false);
                                    setSelectedNode(asset);
                                    setActiveReport(null);
                                    setViewMode('vermoegen');
                                  }}
                                  className={`flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all cursor-pointer group ${
                                    isSelected 
                                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs' 
                                      : 'bg-white dark:bg-slate-900 border-gray-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                                      <Icon name={asset.assetClass === 'realestate' ? 'Home' : (['stock', 'fund', 'crypto'].includes(asset.assetClass) ? 'TrendingUp' : 'DollarSign')} size={13} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {asset.name}
                                      </div>
                                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                        {asset.assetClass || 'Asset'} • {asset.currency || 'CHF'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 block">
                                      {fCur ? fCur(val, data?.settings?.baseCurrency || 'CHF') : val}
                                    </span>
                                    {isSelected && (
                                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{safeT(t, 'flyInSelectedBadge', 'Ausgewählt')}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2">
                          <Icon name="PieChart" size={13} /> {safeT(t, 'flyInKeyReports', 'Wichtigste Berichte')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {quickReports.map(rep => {
                            const isCurrentReport = activeReport === rep.id && viewMode === 'vermoegen';
                            return (
                              <button
                                key={rep.id}
                                onClick={() => {
                                  setIsFlyInOpen(false);
                                  navigate('vermoegen', rep.id);
                                }}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                                  isCurrentReport
                                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-1 ring-blue-400 dark:ring-blue-600'
                                    : 'border-gray-200/80 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`p-1.5 rounded-lg ${rep.color} shrink-0`}>
                                    <Icon name={rep.icon} size={14} />
                                  </div>
                                  <span className={`text-xs font-semibold truncate ${isCurrentReport ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                                    {rep.title}
                                  </span>
                                </div>
                                {isCurrentReport && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white shrink-0 ml-1">
                                    {safeT(t, 'flyInActiveBadge', 'Aktiv')}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                </div>

                <div className="p-4 px-6 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    {safeT(t, 'flyInCockpitFooter', 'FinBundle Cockpit')}
                  </span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setIsFlyInOpen(false);
                        navigate('ai', null);
                      }}
                      className="hover:text-blue-500 flex items-center gap-1 transition-colors cursor-pointer font-medium"
                    >
                      <Icon name="Sparkles" size={12} className="text-amber-400" /> {safeT(t, 'flyInCopilotFooter', 'Copilot')}
                    </button>
                    <button 
                      onClick={() => {
                        setIsFlyInOpen(false);
                        setModalObj({ type: 'settings' });
                      }}
                      className="hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                    >
                      <Icon name="Settings" size={13} /> {safeT(t, 'fileSettings', 'Einstellungen')}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // 1. PLUGINS VERWALTEN
  // =========================================================================
  if (viewMode === 'managePlugins') {
    const plugins = data?.plugins || [];
    const allCategories = Array.from(new Set(plugins.map(p => p.category || 'Allgemein')));

    const filteredPlugins = plugins.filter(p => {
      if (pluginCategoryFilter !== 'ALL' && (p.category || 'Allgemein') !== pluginCategoryFilter) return false;
      if (pluginSearch.trim()) {
        const q = pluginSearch.toLowerCase();
        return (p.title || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
      }
      return true;
    });

    const handleSavePluginEdit = () => {
      if (!editingPlugin || !editingPlugin.title.trim()) return alert(safeT(t, 'msgPluginNameRequired', "Bitte einen Namen angeben."));
      const updated = plugins.map(p => p.id === editingPlugin.id ? editingPlugin : p);
      if (updateTreeData) updateTreeData({ plugins: updated });
      if (showToast) showToast(safeT(t, 'msgPluginUpdated', "Plugin erfolgreich aktualisiert"), "success");
      setEditingPlugin(null);
    };

    const handleDeletePlugin = (id, title) => {
      if (window.confirm(`${safeT(t, 'msgConfirmDeletePlugin', 'Möchten Sie das Plugin wirklich löschen?')} (${title})`)) {
        const updated = plugins.filter(p => p.id !== id);
        if (updateTreeData) updateTreeData({ plugins: updated });
        if (activeReport === id) navigate('vermoegen', 'overview');
        if (showToast) showToast(safeT(t, 'msgPluginDeleted', "Plugin gelöscht"), "info");
      }
    };

    const handleExportSinglePlugin = (plugin) => {
      const exportData = {
        type: 'FINBUNDLE_PLUGIN',
        version: '1.2',
        exportedAt: new Date().toISOString(),
        plugin: {
          title: plugin.title || plugin.name,
          category: plugin.category || 'Allgemein',
          code: plugin.code || '',
          isPinned: !!plugin.isPinned,
          createdAt: plugin.createdAt || new Date().toISOString()
        }
      };
      const cleanName = (plugin.title || 'plugin').replace(/[^\w\d-_]/g, '_');
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanName}.finplugin.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const handleExportAllPlugins = () => {
      if (plugins.length === 0) return alert(safeT(t, 'msgNoPluginsToExport', "Keine Plugins vorhanden."));
      const bundleData = {
        type: 'FINBUNDLE_PLUGIN_BUNDLE',
        version: '1.2',
        exportedAt: new Date().toISOString(),
        plugins: plugins.map(p => ({
          title: p.title || p.name,
          category: p.category || 'Allgemein',
          code: p.code || '',
          isPinned: !!p.isPinned,
          createdAt: p.createdAt || new Date().toISOString()
        }))
      };
      const blob = new Blob([JSON.stringify(bundleData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FinBundle_Plugins_Bundle_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const handleImportFile = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          let importedList = [];
          if (content.type === 'FINBUNDLE_PLUGIN' && content.plugin) importedList.push(content.plugin);
          else if (content.type === 'FINBUNDLE_PLUGIN_BUNDLE' && Array.isArray(content.plugins)) importedList = content.plugins;
          else if (Array.isArray(content)) importedList = content;
          else if (content.title && content.code) importedList.push(content);
          else throw new Error(safeT(t, 'msgInvalidPluginFormat', "Ungültiges Plugin-Format."));

          const existingTitles = new Set(plugins.map(p => (p.title || p.name).toLowerCase()));
          const newPluginsToAdd = importedList.map(raw => {
            let finalTitle = (raw.title || 'Neues Plugin').trim();
            if (existingTitles.has(finalTitle.toLowerCase())) finalTitle = `${finalTitle} (Importiert)`;
            existingTitles.add(finalTitle.toLowerCase());
            return {
              id: 'plug_' + Math.random().toString(36).substr(2, 9),
              title: finalTitle,
              category: raw.category?.trim() || 'Allgemein',
              code: raw.code,
              isPinned: !!raw.isPinned,
              createdAt: raw.createdAt || new Date().toISOString()
            };
          });

          const updated = [...plugins, ...newPluginsToAdd];
          if (updateTreeData) updateTreeData({ plugins: updated });
          if (showToast) showToast(`${newPluginsToAdd.length} ${safeT(t, 'msgPluginsImportSuccess', 'Plugin(s) erfolgreich importiert')}`, "success");
        } catch (err) {
          alert(`${safeT(t, 'msgPluginImportFailed', 'Import fehlgeschlagen: ')}${err.message}`);
        } finally {
          if (pluginFileInputRef.current) pluginFileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar">
        <input type="file" ref={pluginFileInputRef} onChange={handleImportFile} accept=".json,.finplugin" className="hidden" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-slate-800 pb-6 mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <Icon name="Folder" className="text-blue-500" />
              {safeT(t, 'pluginsManagerTitle', 'Plugins & Add-Ins verwalten')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {safeT(t, 'pluginsManagerSubtitle', 'Exportiere Vorlagen, pinne wichtige Widgets an dein Fly-In-Cockpit oder importiere Add-Ins von anderen Nutzern.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => pluginFileInputRef.current?.click()} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer">
              <Icon name="Upload" size={16} /> <span>{safeT(t, 'btnImportPlugin', 'Plugin importieren')}</span>
            </button>
            {plugins.length > 0 && (
              <button onClick={handleExportAllPlugins} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer">
                <Icon name="Download" size={16} /> <span>{safeT(t, 'btnExportAllPlugins', 'Alle exportieren')}</span>
              </button>
            )}
            <button onClick={() => navigate('ai', null)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer">
              <Icon name="PlusCircle" size={16} /> <span>{safeT(t, 'btnNewPluginCopilot', 'Neues Plugin (Copilot)')}</span>
            </button>
            <button onClick={() => navigate('vermoegen', 'overview')} className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer">
              {safeT(t, 'btnBack', 'Zurück')}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setPluginCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${pluginCategoryFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}
            >
              {safeT(t, 'filterCategoryAll', 'Alle')} ({plugins.length})
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => setPluginCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${pluginCategoryFilter === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}
              >
                {cat} ({plugins.filter(p => (p.category || 'Allgemein') === cat).length})
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <input 
              type="text"
              placeholder={safeT(t, 'searchPluginsPlaceholder', 'Plugin suchen...')}
              value={pluginSearch}
              onChange={e => setPluginSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Icon name="Search" size={13} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>

        {filteredPlugins.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl p-16 text-center text-gray-400">
            <Icon name="Box" size={48} className="mx-auto mb-4 opacity-30 text-blue-500" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">{safeT(t, 'pluginsEmptyTitle', 'Keine Plugins gefunden')}</h3>
            <p className="text-xs text-gray-400 mb-6">{safeT(t, 'pluginsEmptyDesc', 'Erstelle individuelle Analysen im AI Copilot oder importiere eine fertige .finplugin.json-Datei.')}</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => pluginFileInputRef.current?.click()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {safeT(t, 'btnImportFile', 'Datei importieren')}
              </button>
              <button 
                onClick={() => navigate('ai', null)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {safeT(t, 'btnToAiCopilot', 'Zum AI Copilot')}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-xs uppercase font-bold text-gray-500">
                <tr>
                  <th className="p-4 w-12 text-center">{safeT(t, 'colPin', 'Pin')}</th>
                  <th className="p-4">{safeT(t, 'colReportName', 'Name des Reports')}</th>
                  <th className="p-4">{safeT(t, 'colCategory', 'Kategorie')}</th>
                  <th className="p-4 text-center">{safeT(t, 'colCreatedAt', 'Erstellt am')}</th>
                  <th className="p-4 text-right">{safeT(t, 'colActions', 'Aktionen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {filteredPlugins.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => togglePinPlugin(p.id)} 
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${p.isPinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 font-bold' : 'text-gray-300 hover:text-gray-500'}`}
                        title={p.isPinned ? safeT(t, 'flyInActionUnpin', "Vom Fly-In lösen") : safeT(t, 'flyInActionPin', "An Fly-In anpinnen")}
                      >
                        <Icon name="Bookmark" size={16} />
                      </button>
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                      <span className="truncate">{p.title || p.name}</span>
                      {p.isPinned && <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">{safeT(t, 'badgeFlyInPinned', 'Fly-In')}</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getCategoryBadgeClass(p.category)}`}>
                        {p.category || 'Allgemein'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono text-xs text-gray-400">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('de-CH') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => navigate('plugin', p.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer">
                          {safeT(t, 'flyInActionOpen', 'Öffnen')}
                        </button>
                        <button onClick={() => handleExportSinglePlugin(p)} className="p-1.5 text-gray-500 hover:text-emerald-600 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer" title={safeT(t, 'fileExportTitle', "Exportieren")}>
                          <Icon name="Download" size={14} />
                        </button>
                        <button onClick={() => setEditingPlugin({ ...p })} className="p-1.5 text-gray-500 hover:text-blue-600 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer" title={safeT(t, 'btnEdit', "Bearbeiten")}>
                          <Icon name="Edit" size={14} />
                        </button>
                        <button onClick={() => handleDeletePlugin(p.id, p.title || p.name)} className="p-1.5 text-gray-400 hover:text-red-600 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer" title={safeT(t, 'btnDelete', "Löschen")}>
                          <Icon name="Trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingPlugin && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{safeT(t, 'modalEditPluginTitle', 'Plugin bearbeiten')}</h3>
                <button onClick={() => setEditingPlugin(null)} className="cursor-pointer"><Icon name="X" size={18} /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto finspa-scrollbar flex-1">
                <input type="text" value={editingPlugin.title} onChange={e => setEditingPlugin({ ...editingPlugin, title: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm font-semibold mb-2" />
                <textarea value={editingPlugin.code || ''} onChange={e => setEditingPlugin({ ...editingPlugin, code: e.target.value })} rows={12} className="w-full p-3 font-mono text-xs border rounded-xl bg-slate-950 text-slate-200" />
              </div>
              <div className="p-4 border-t flex justify-end gap-3">
                <button onClick={() => setEditingPlugin(null)} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer">{safeT(t, 'btnCancel', 'Abbrechen')}</button>
                <button onClick={handleSavePluginEdit} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer">{safeT(t, 'btnSave', 'Speichern')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. VIEW-MODE: PLUGINS ANZEIGEN & DRUCKEN
  // =========================================================================
  if (viewMode === 'plugin' || (data?.plugins && data.plugins.some(p => p.id === activeReport))) {
    const activePlugin = (data?.plugins || []).find(p => p.id === activeReport) || (data?.plugins || [])[0];
    if (!activePlugin) return null;

    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar flex flex-col">
        <ReportHeader 
            title={activePlugin.title} 
            subtitle={`${activePlugin.category} • ${safeT(t, 'pluginCreatedWithCopilot', 'Erstellt mit FinBundle AI Copilot')}`} 
            iconName="Sparkles"
            iconColor="text-indigo-600"
            iconBg="bg-indigo-100"
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible}
        >
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => togglePinPlugin(activePlugin.id)} 
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer shadow-xs ${
                    activePlugin.isPinned 
                      ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'
                  }`}
                >
                    <Icon name="Bookmark" size={13} /> 
                    <span>{activePlugin.isPinned ? safeT(t, 'pluginInQuickAccess', 'Im Schnellzugriff') : safeT(t, 'pluginPinAction', 'Anheften')}</span>
                </button>
            </div>
        </ReportHeader>

        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[650px] relative">
            <iframe 
                key={`${activePlugin.id}_${activeLang}`}
                id="active-plugin-iframe"
                srcDoc={buildPluginHtml(activePlugin.code)}
                sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-modals"
                className="w-full h-full min-h-[650px] border-none bg-white"
                title={activePlugin.title}
            />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. DATENSICHT
  // =========================================================================
  if (viewMode === 'datensicht') {
    const handleCopy = (payload) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgCopied', "In Zwischenablage kopiert"), "success");
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
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{safeT(t, 'viewData', 'Innere Datenhaltung')}</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{safeT(t, 'descSystemExplorer', 'System-Explorer & JSON-Inspector')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleCopy(data)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer">
                        <Icon name="Copy" className="text-white" /> {safeT(t, 'btnCopyProject', 'Gesamtes Projekt kopieren')}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-64 border-r bg-white dark:bg-slate-900/50 p-4 space-y-2 shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{safeT(t, 'labelAreas', 'Bereiche')}</p>
                    {[
                        { id: 'root', label: safeT(t, 'labelFullObject', 'Komplettes Objekt'), icon: 'Box' },
                        { id: 'banks', label: safeT(t, 'labelBanksAssets', 'Banken & Assets'), icon: 'Shield' },
                        { id: 'budget', label: safeT(t, 'labelBudgetPlanning', 'Budget-Planung'), icon: 'List' },
                        { id: 'settings', label: safeT(t, 'labelConfig', 'Konfiguration'), icon: 'Settings' },
                        { id: 'scenarios', label: safeT(t, 'labelScenarios', 'Szenarien'), icon: 'TrendingUp' }
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setSelectedDataPath(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDataPath === item.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm ring-1 ring-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        >
                            <Icon name={item.icon} size={14} /> {item.label}
                        </button>
                    ))}
                    
                    <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">
                            <Icon name="Info" size={10} className="mb-1" /><br/>
                            {safeT(t, 'descExpertCopy', 'Du kannst einzelne Blöcke per "Copy" Icon extrahieren und in anderen Assets wieder einfügen (Expert Mode).')}
                        </p>
                    </div>
                </div>

                <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
                    <div className="p-2 border-b bg-gray-50/50 dark:bg-slate-800/50 flex items-center gap-2">
                         <div className="bg-white dark:bg-slate-800 border rounded-lg px-2 py-1 flex items-center gap-2 w-full max-w-sm shadow-sm">
                            <Icon name="Search" size={12} className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder={safeT(t, 'placeholderSearchKeys', 'Suche in Schlüsseln/Werten...')} 
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

  // =========================================================================
  // 4. KI-DASHBOARD & LIVE-EDITOR
  // =========================================================================
  if (viewMode === 'ai') {
      const AiDashboard = safeRequire('./ai/AiDashboard.jsx') || (() => <div className="p-8 text-center">{safeT(t, 'errAiDashboardMissing', 'AiDashboard.jsx fehlt')}</div>);
      return <AiDashboard data={data} fCur={fCur} t={t} setModalObj={setModalObj} updateTreeData={updateTreeData} />;
  }

  if (viewMode === 'liveEditor') {
      return (
          <ApiLiveEditorDashboard 
              data={data} 
              updateTreeData={updateTreeData} 
              fCur={fCur} 
              t={t} 
              showToast={showToast} 
          />
      );
  }

  // =========================================================================
  // 5. STANDARD REPORTS
  // =========================================================================
  if (activeReport) {
    const getReportConfig = (reportId) => {
        const configs = {
            'overview': { title: safeT(t, 'repOverviewTitle', 'Vermögensübersicht'), subtitle: safeT(t, 'repOverviewSub', 'Zusammenfassung der finanziellen Situation'), iconName: 'PieChart', iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
            'allocation': { title: safeT(t, 'repAllocTitle', 'Asset Allokation'), subtitle: safeT(t, 'repAllocSub', 'Verteilung über Anlageklassen'), iconName: 'Layers', iconColor: 'text-purple-600', iconBg: 'bg-purple-100' },
            'liquidity': { title: safeT(t, 'repLiqTitle', 'Liquiditätsplanung'), subtitle: safeT(t, 'repLiqSub', 'Verfügbares Kapital'), iconName: 'Droplet', iconColor: 'text-cyan-600', iconBg: 'bg-cyan-100' },
            'history': { title: safeT(t, 'repHistTitle', 'Historische Entwicklung'), subtitle: safeT(t, 'repHistSub', 'Wertverlauf über die Zeit'), iconName: 'TrendingUp', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
            'tax': { title: safeT(t, 'repTaxTitle', 'Steuer-Report'), subtitle: safeT(t, 'repTaxSub', 'Steuerrelevante Daten'), iconName: 'FileText', iconColor: 'text-rose-600', iconBg: 'bg-rose-100' },
            'categoryFlow': { title: safeT(t, 'repCatFlowTitle', 'Kategorie-Flow'), subtitle: safeT(t, 'repCatFlowSub', 'Ein- und Ausgänge nach Kategorien'), iconName: 'GitMerge', iconColor: 'text-amber-600', iconBg: 'bg-amber-100' },
            'waterfall': { title: safeT(t, 'repWaterTitle', 'Wasserfall-Analyse'), subtitle: safeT(t, 'repWaterSub', 'Veränderungsfaktoren'), iconName: 'BarChart2', iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100' },
            'passive': { title: safeT(t, 'repPassiveTitle', 'Passives Einkommen'), subtitle: safeT(t, 'repPassiveSub', 'Dividenden & Zinsen'), iconName: 'DollarSign', iconColor: 'text-green-600', iconBg: 'bg-green-100' },
            'topFlow': { title: safeT(t, 'repTopFlowTitle', 'Top Transaktionen'), subtitle: safeT(t, 'repTopFlowSub', 'Grösste Bewegungen'), iconName: 'ArrowUpRight', iconColor: 'text-orange-600', iconBg: 'bg-orange-100' },
            'bookingAnalysis': { title: safeT(t, 'repBookAnaTitle', 'Buchungsanalyse'), subtitle: safeT(t, 'repBookAnaSub', 'Auswertung der Transaktionen'), iconName: 'Activity', iconColor: 'text-fuchsia-600', iconBg: 'bg-fuchsia-100' },
            'future': { title: safeT(t, 'repFutureTitle', 'Zukunftsprognose'), subtitle: safeT(t, 'repFutureSub', 'Projektion der Entwicklung'), iconName: 'FastForward', iconColor: 'text-violet-600', iconBg: 'bg-violet-100' },
            'scenarios': { title: safeT(t, 'repScenTitle', 'Szenarien'), subtitle: safeT(t, 'repScenSub', 'Auswirkungen von Ereignissen'), iconName: 'Shuffle', iconColor: 'text-pink-600', iconBg: 'bg-pink-100' },
            'pension3a': { title: safeT(t, 'repPenTitle', 'Vorsorge Performance'), subtitle: safeT(t, 'repPenSub', 'Säule 3a & PK'), iconName: 'Shield', iconColor: 'text-teal-600', iconBg: 'bg-teal-100' },
            'securities': { title: safeT(t, 'repSecTitle', 'Wertschriften Performance'), subtitle: safeT(t, 'repSecSub', 'Aktien, Fonds & Krypto'), iconName: 'TrendingUp', iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
            'dividendCalendar': { title: safeT(t, 'repDivCalTitle', 'Dividendenkalender'), subtitle: safeT(t, 'repDivCalSub', 'Zukünftige Erträge'), iconName: 'Calendar', iconColor: 'text-yellow-600', iconBg: 'bg-yellow-100' }
        };
        return configs[reportId] || { title: 'Report', subtitle: '', iconName: 'FileText', iconColor: 'text-gray-600', iconBg: 'bg-gray-100' };
    };

    const headerConfig = getReportConfig(activeReport);

    const viewContent = () => {
      switch(activeReport) {
        case 'overview': return <AssetOverviewReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'allocation': return <AllocationReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'liquidity': return <LiquidityReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'history': return <HistoryReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'tax': return <TaxReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;        
        case 'categoryFlow': return <CategoryFlowReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'waterfall': return <WaterfallReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'passive': return <PassiveIncomeReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'topFlow': return <TopFlowReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'bookingAnalysis': return <BookingAnalysisReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'future': return <FutureReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'scenarios': return <ScenariosReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} setModalObj={setModalObj} updateTreeData={updateTreeData} fCur={fCur} t={t} />;
        case 'pension3a': return <PensionPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'securities': return <SecuritiesPerformanceReport data={data} activeAssets={activeAssets} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        case 'dividendCalendar': return <DividendCalendarReport data={data} activeAssets={activeAssets} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />;
        default: return <div className="text-gray-500">{safeT(t, 'reportLoading', 'Report wird geladen...')}</div>;
      }
    };
    
    return (
      <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar relative">
        {renderFlyInDrawer()}
        <ReportHeader 
            title={headerConfig.title} 
            subtitle={headerConfig.subtitle} 
            iconName={headerConfig.iconName}
            iconColor={headerConfig.iconColor}
            iconBg={headerConfig.iconBg}
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible}
        >
            <div className="flex items-center gap-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-gray-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all hover:shadow-md">
                <Icon name="Calendar" className="text-blue-500" size={18}/>
                <span className="text-gray-600 dark:text-gray-300 font-semibold hidden sm:inline">{safeT(t, 'dateRangeTitle', 'Zeitraum:')}</span>
                <div className="flex items-center gap-2">
                    <input type="date" value={dateRange?.from || ''} onChange={e=>setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 outline-none text-gray-700 dark:text-gray-200 transition-colors font-mono tabular-nums cursor-pointer" />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="date" value={dateRange?.to || ''} onChange={e=>setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 outline-none text-gray-700 dark:text-gray-200 transition-colors font-mono tabular-nums cursor-pointer" />
                </div>
            </div>
        </ReportHeader>

        <div className="report-content-wrapper">
            {viewContent()}
        </div>
      </div>
    );
  }
  
  if (viewMode === 'budget' && !selectedNode && !activeReport) {
      return (
        <div className="h-full relative overflow-hidden">
          {renderFlyInDrawer()}
          <BudgetDashboard data={data} fCur={fCur} t={t} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
        </div>
      );
  }

  if (viewMode === 'vermoegen' && !selectedNode && !activeReport) {
      return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar relative">
          {renderFlyInDrawer()}
          <AllocationReport data={data} dateRange={dateRange} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} fCur={fCur} t={t} />
        </div>
      );
  }
  
  // =========================================================================
  // 6. ASSET & BANK/KATEGORIEDETAILS
  // =========================================================================
  if (selectedNode) {
    if (selectedNode.budgetType) {
        return <BudgetEditor selectedNode={selectedNode} setSelectedNode={setSelectedNode} fCur={fCur} t={t} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />;
    }
    if (selectedNode.type === 'bank' || selectedNode.type === 'category') {
      const analyzeStructure = (node, currentCategory = safeT(t, 'mainPortfolio', 'Hauptportfolio')) => {
        let items = [];
        if (node.type === 'category') currentCategory = node.name;
        if (node.type === 'asset') {
          if (node.isArchived && !showArchived) return [];
          const todayStr = new Date().toISOString().split('T')[0];
          const origVal = getAssetRawValueAtDate(node, todayStr);
          const baseVal = getAssetValueAtDate(node, todayStr, allAssets);
          const subCatKey = node.assetClass || 'cash';
          const subCategoryName = safeT(t, `ac${subCatKey.charAt(0).toUpperCase() + subCatKey.slice(1)}`, subCatKey.toUpperCase());

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
      const headerSubtitle = isBank ? safeT(t, 'consWealthOverview', 'Konsolidierte Vermögensübersicht') : safeT(t, 'allocByCatSub', 'Kategorie-Übersicht');

      const todayStr = new Date().toISOString().split('T')[0];
      let datesSet = new Set();
      const extractDates = (node) => {
         if (node.type === 'asset') {
             (node.bookings || []).forEach(b => datesSet.add(b.date));
             (node.balances || []).forEach(b => datesSet.add(b.date));
         }
         if (node.children) node.children.forEach(extractDates);
      };
      extractDates(selectedNode);
      datesSet.add(todayStr);
      let sortedDates = Array.from(datesSet).sort();
      
      if (sortedDates.length === 1) {
          const d = new Date(sortedDates[0]);
          d.setMonth(d.getMonth() - 1);
          sortedDates.unshift(d.toISOString().split('T')[0]);
      } else if (sortedDates.length === 0) {
          sortedDates = ['2000-01-01', todayStr];
      }

      const calcNodeHist = (n, d) => {
          if (n.type === 'asset') return getAssetValueAtDate(n, d, allAssets);
          let sum = 0;
          if (n.children) n.children.forEach(c => sum += calcNodeHist(c, d));
          return sum;
      };

      const historyData = sortedDates.map(d => calcNodeHist(selectedNode, d));

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar relative">
          {renderFlyInDrawer()}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-slate-800 pb-6 mb-6 gap-4">
            <div>
              <h2 className="text-3xl font-black flex items-center gap-3">
                {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                <Icon name={headerIcon} className={isBank ? "text-slate-500" : "text-yellow-500"} />
                {selectedNode.name}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{headerSubtitle}</p>
            </div>
            
            <div className="flex items-end gap-10">
                {historyData && historyData.length > 1 && (
                    <Sparkline 
                        dataSeries={historyData} 
                        dateSeries={sortedDates} 
                        title={`${safeT(t, 'titleValueDevelopment', 'Wertentwicklung')} (${data?.settings?.baseCurrency || 'CHF'})`} 
                    />
                )}
                
                <div className="text-left sm:text-right flex flex-col justify-center items-start sm:items-end shrink-0 min-w-[180px]">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 block">{safeT(t, 'totalValue', 'Gesamtwert')}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl block shadow-sm whitespace-nowrap">
                    {fCur ? fCur(totalBankValue, 'CHF') : totalBankValue}
                  </span>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 print:grid-cols-3 xl:grid-cols-3 gap-8 items-start">
            <div className="print:col-span-2 xl:col-span-2 space-y-6">
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

            <div className="space-y-6 print:col-span-1 print:break-inside-avoid">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 flex flex-col items-center">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 self-start mb-6 flex items-center gap-2"><Icon name="PieChart" /> {safeT(t, 'allocByCat', 'Aufteilung nach Kategorien')}</h3>
                {chartDataCategories.length > 0 ? (
                  <UniversalChart 
                    engine={activeChartEngine} 
                    type="doughnut" 
                    height="280px" 
                    labels={chartDataCategories.map(d => d.label)} 
                    datasets={[{ 
                        label: safeT(t, 'totalValue', 'Gesamtwert'), 
                        data: chartDataCategories.map(d => d.value),
                        valueFormatter: (val) => fCur ? fCur(val, 'CHF') : Number(val).toFixed(2)
                    }]} 
                  />
                ) : <div className="text-gray-400 py-12 text-center text-sm">{safeT(t, 'noValuedAssets', 'Keine bewerteten Assets vorhanden.')}</div>}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
                <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-1"><Icon name="List" size={12} /> {safeT(t, 'subcatTotals', 'Subkategorien-Summen')}</h4>
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
      const currentShares = typeof getAssetSharesAtDate === 'function' ? getAssetSharesAtDate(adjustedNode, todayStr) : 0;

      const handleFetchLivePrice = async () => {
          const finKeys = data?.settings?.finApiKeys || {};

          const result = await ApiSyncEngine.fetchAssetPrice({
              assetNode: adjustedNode,
              finKeys,
              baseCurrency,
              showToast,
              safeT,
              t
          });

          if (result && result.price > 0) {
              const { price, provider, apiDate, currentFxRate } = result;
              const fromCurrency = adjustedNode.currency;
              const isForeignCurrencyCheck = fromCurrency && fromCurrency !== baseCurrency;
              
              let updatedNode = { ...selectedNode, exchangeRate: currentFxRate };
              let bookings = [...(updatedNode.bookings || [])];
              
              const existingSyncIdx = bookings.findIndex(b => b.date === apiDate && b.type === 'Wertanpassung' && b.subCategory === 'API Kurs-Sync');
              
              const newBooking = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: apiDate,
                  type: 'Wertanpassung',
                  subCategory: 'API Kurs-Sync',
                  price: price,
                  amount: 0,
                  bookingExchangeRate: currentFxRate,
                  comment: `#${provider.replace(/\s+/g, '')} EOD-Kurs (FX: 1 ${fromCurrency} = ${currentFxRate} ${baseCurrency})`
              };

              if (existingSyncIdx >= 0) bookings[existingSyncIdx] = newBooking;
              else bookings.push(newBooking);

              updatedNode.bookings = bookings;
              const finalNode = applyAutoValuation(updatedNode);

              const updateRecursive = (nodes) => nodes.map(n => {
                  if (n.id === selectedNode.id) return finalNode;
                  if (n.children) return { ...n, children: updateRecursive(n.children) };
                  return n;
              });
              
              updateTreeData({ banks: updateRecursive(data.banks) });
              setSelectedNode(finalNode);
              
              const fxNotice = isForeignCurrencyCheck ? ` | FX: ${currentFxRate}` : '';
              if (showToast) showToast(safeT(t, 'msgPriceUpdated', `EOD Kurs (${apiDate}) via ${provider} synchronisiert: ${price} ${fromCurrency}${fxNotice}`), 'success');
          } else if (result !== null) {
              if (showToast) showToast(safeT(t, 'msgPriceFetchFailed', 'Kursabruf fehlgeschlagen. Ticker/ISIN überprüfen oder API-Limit erreicht.'), 'error');
          }
      };

      const handleRowDrop = (draggedId, targetId) => {
          if (draggedId === targetId) return;

          let updatedNode = { ...selectedNode };
          let bookings = [...(updatedNode.bookings || [])];

          const draggedIdx = bookings.findIndex(b => b.id === draggedId);
          const targetIdx = bookings.findIndex(b => b.id === targetId);

          if (draggedIdx === -1 || targetIdx === -1) return;

          if (bookings[draggedIdx].date !== bookings[targetIdx].date) {
              if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgSameDateOnly', "Verschieben nur am gleichen Datum möglich."), "error");
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
          
          if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgBookingDeletedSingle', "Eintrag gelöscht"), "success");
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

      const netFlowVal = totalInRaw - totalOutRaw;
      const pClass = isCompactMode ? 'p-2' : 'p-4';

      return (
        <div className="p-8 flex flex-col h-full bg-white dark:bg-slate-950 overflow-auto finspa-scrollbar relative">
          {renderFlyInDrawer()}
          <div className="flex justify-between items-stretch border-b border-gray-200 dark:border-slate-800 pb-6 mb-4">
             <div className="flex flex-col justify-between">
               <h2 className="text-3xl font-black flex items-center gap-3">
                 {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 print-hide" onClick={() => setIsTreeVisible(true)} />}
                 <Icon name="DollarSign" className="text-green-500"/>
                 {adjustedNode.name} {adjustedNode.isArchived && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{safeT(t, 'isArchived', 'Archiviert')}</span>}
               </h2>
               <div className="flex gap-6 mt-3 text-sm items-center">
                 <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">{safeT(t, 'assetClassLabel', 'Klasse:')} <span className="uppercase">{adjustedNode.assetClass}</span></span>
                 
                 {isSecurities && (
                     <span className="bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium tabular-nums">
                         {currentShares.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {safeT(t, 'labelPcs', 'Stk.')}
                     </span>
                 )}

                 <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 px-3 py-1 rounded-full font-bold flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 tabular-nums">
                    <div>{safeT(t, 'valueToday', 'Wert (Heute):')} {fCur ? fCur(currentVal, baseCurrency) : currentVal}</div>
                    {isForeignCurrency && <span className="text-xs font-normal opacity-70">({fCur ? fCur(rawSum, adjustedNode.currency) : rawSum})</span>}
                 </span>
               </div>
             </div>

             <div className="flex items-end gap-10 ml-4 h-full pt-2">
                <Sparkline dataSeries={dataBase} dateSeries={sortedDates} title={isSecurities ? `${safeT(t, 'titlePerformance', 'Performance')} (${baseCurrency})` : `${safeT(t, 'titleValueDevelopment', 'Wertentwicklung')} (${baseCurrency})`} />
                {isForeignCurrency && <Sparkline dataSeries={dataRaw} dateSeries={sortedDates} title={isSecurities ? `${safeT(t, 'titlePerformance', 'Performance')} (${adjustedNode.currency})` : `${safeT(t, 'titleValueDevelopment', 'Wertentwicklung')} (${adjustedNode.currency})`} />}
             </div>
          </div>

          {isSecurities && (
            <div className="print-hide flex border-b border-gray-200 dark:border-slate-800 mb-4 gap-2">
              <button onClick={() => setActiveTab('transactions')} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all duration-150 ${activeTab === 'transactions' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Icon name="List" size={16}/> {safeT(t, 'tabTransactions', 'Transaktionen')}
              </button>
              <button onClick={() => setActiveTab('marketData')} className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all duration-150 ${activeTab === 'marketData' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Icon name="TrendingUp" size={16}/> {safeT(t, 'tabMarketData', 'Marktdaten')}
              </button>
            </div>
          )}

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-[300px]">
            <div className="print-hide bg-gray-50 dark:bg-slate-800 p-4 border-b flex gap-3 flex-wrap items-center">
              
              {(!isSecurities || activeTab === 'transactions') ? (
                <button onClick={()=>setModalObj({type:'addBooking', assetId: adjustedNode.id, defaultType})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer">
                    <Icon name="Plus"/> {isSecurities ? safeT(t, 'addTransactionBtn', 'Transaktion erfassen') : safeT(t, 'addBookingBtn', 'Buchung erfassen')}
                </button>
              ) : (
                <button onClick={()=>setModalObj({type:'addBooking', assetId: adjustedNode.id, defaultType: 'Wertanpassung'})} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer">
                    <Icon name="TrendingUp"/> {safeT(t, 'btnAddMarketValue', 'Kurs / Marktwert erfassen')}
                </button>
              )}

              <button onClick={()=>setModalObj({type:'addBalance', assetId: adjustedNode.id})} className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                  <Icon name="Calendar"/> {safeT(t, 'addBalanceBtn', 'Stichtags-Saldo setzen')}
              </button>
              
              {selectedBookingIds.size > 0 && (
                  <button onClick={() => setModalObj({type:'bulkAction', assetId: adjustedNode.id, selectedIds: Array.from(selectedBookingIds)})} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-all animate-fade-in cursor-pointer">
                      <Icon name="CheckSquare" className="text-white stroke-white" /> {selectedBookingIds.size} {safeT(t, 'btnEditEntries', 'Einträge bearbeiten')}
                  </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${showFilters || filterQuery || filterType || filterDateFrom || filterDateTo ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    title={safeT(t, 'titleToggleFilter', 'Filter umschalten')}
                >
                    <Icon name="Filter" size={18}/>
                </button>
                <button 
                    onClick={() => setIsCompactMode(!isCompactMode)} 
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${isCompactMode ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-blue-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    title={safeT(t, 'titleToggleCompact', 'Kompaktansicht umschalten')}
                >
                    <Icon name={isCompactMode ? "EyeOff" : "Eye"} size={18}/>
                </button>
                <button 
                    onClick={() => setModalObj({type:'printAssetBookings', assetId: adjustedNode.id, filteredIds: sortedItems.map(i=>i.id)})} 
                    className="flex items-center gap-2 bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 shadow-sm transition-colors cursor-pointer"
                    title={safeT(t, 'titlePrintView', 'Aktuelle Ansicht drucken/exportieren')}
                >
                    <Icon name="Printer"/> {safeT(t, 'filePrint', 'Drucken')}
                </button>

                {isSecurities && (
                    <>
                        <button 
                            onClick={handleFetchLivePrice}
                            className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                            title={safeT(t, 'titleCloudSync', 'Aktuellen Kurs via Alpha Vantage oder EODHD abrufen')}
                        >
                            <Icon name="Cloud" size={16}/> <span className="hidden sm:inline">{safeT(t, 'btnCloudSync', 'Live-Kurs abrufen')}</span>
                        </button>
                        
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
                                            subCategory: safeT(t, 'catPriceFromTransaction', 'Kurs aus Transaktion'),
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
                                        window.showToast(safeT(t, 'msgPricesExtracted', "Kurs(e) aus Transaktionen in Marktdaten übernommen."), "success");
                                    } else {
                                        window.showToast(safeT(t, 'msgMarketValuesUpToDate', "Marktwerte sind bereits auf dem neuesten Stand."), "info");
                                    }
                                }
                            }} 
                            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 transition-colors shadow-sm cursor-pointer"
                            title={safeT(t, 'titleSyncMarketValues', 'Extrahiert Kurse aus Transaktionen und ergänzt die Kurshistorie.')}
                        >
                            <Icon name="RefreshCw" size={16}/> <span className="hidden sm:inline">{safeT(t, 'btnSyncMarketValues', 'Lokale Daten synchronisieren')}</span>
                        </button>
                    </>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="print-hide bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex flex-wrap gap-4 items-center text-sm shadow-inner animate-fade-in">
                  <div className="flex items-center gap-2">
                      <Icon name="Search" size={16} className="text-gray-400" />
                      <input 
                          type="text" placeholder={safeT(t, 'placeholderSearchBookings', "Suche (Betrag, Kategorie, Tags)...")} 
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
                          <option value="">{safeT(t, 'filterAllTypes', 'Alle Typen')}</option>
                          <option value="Einzahlung">{safeT(t, 'Einzahlung', 'Einzahlung')}</option>
                          <option value="Auszahlung">{safeT(t, 'Auszahlung', 'Auszahlung')}</option>
                          <option value="Kauf">{safeT(t, 'Kauf', 'Kauf')}</option>
                          <option value="Verkauf">{safeT(t, 'Verkauf', 'Verkauf')}</option>
                          <option value="Dividende">{safeT(t, 'Dividende', 'Dividende')}</option>
                          <option value="Zinszahlung">{safeT(t, 'Zinszahlung', 'Zinszahlung')}</option>
                          <option value="Gebühr">{safeT(t, 'Gebühr', 'Gebühr')}</option>
                      </select>
                  </div>
                  <div className="flex items-center gap-2">
                      <Icon name="Calendar" size={16} className="text-gray-400" />
                      <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none" />
                      <span>-</span>
                      <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 outline-none" />
                  </div>
                  {(filterQuery || filterType || filterDateFrom || filterDateTo) && (
                      <button onClick={() => { setFilterQuery(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="ml-auto text-red-500 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer">
                          <Icon name="X" size={14} /> {safeT(t, 'btnResetFilter', 'Filter zurücksetzen')}
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
                            title={safeT(t, 'titleSelectAllVisible', 'Alle sichtbaren auswählen')} 
                        />
                    </th>
                    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                        {safeT(t, 'date', 'Datum')}
                    </th>
                    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                        {safeT(t, 'entryType', 'Eintrag')}
                    </th>
                    <th className="p-4 text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                        {isSecurities && activeTab === 'marketData' 
                            ? safeT(t, 'colMarketPriceDetails', 'Börsenkurs / Details') 
                            : safeT(t, 'entryDetail', 'Detail')}
                    </th>
                    <th className="p-4 text-right text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                        {isSecurities && activeTab === 'marketData' 
                            ? safeT(t, 'colAssetValueAtDate', 'Asset-Wert am Stichtag') 
                            : safeT(t, 'amount', 'Betrag')}
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
                        safeT(t, 'month01', "Januar"), safeT(t, 'month02', "Februar"), safeT(t, 'month03', "März"), safeT(t, 'month04', "April"), 
                        safeT(t, 'month05', "Mai"), safeT(t, 'month06', "Juni"), safeT(t, 'month07', "Juli"), safeT(t, 'month08', "August"), 
                        safeT(t, 'month09', "September"), safeT(t, 'month10', "Oktober"), safeT(t, 'month11', "November"), safeT(t, 'month12', "Dezember")
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
                                              <span><span className="hidden sm:inline">{safeT(t, 'labelStart', 'Start:')}</span> {fCur ? fCur(startBal, adjustedNode.currency) : startBal}</span>
                                              {isForeignCurrency && <span className="text-[10px] opacity-60">≈ {fCur ? fCur(startBalBase, baseCurrency) : startBalBase}</span>}
                                          </span>
                                          {(!isSecurities || activeTab === 'transactions') && (
                                            <>
                                              <span className="text-emerald-600 font-medium flex flex-col items-start">
                                                  <span><span className="hidden sm:inline">{safeT(t, 'labelIn', 'In:')}</span> +{fCur ? fCur(flowIn, adjustedNode.currency) : flowIn}</span>
                                                  {isForeignCurrency && <span className="text-[10px] opacity-60">≈ +{fCur ? fCur(flowInBase, baseCurrency) : flowInBase}</span>}
                                              </span>
                                              <span className="text-rose-600 font-medium flex flex-col items-start">
                                                  <span><span className="hidden sm:inline">{safeT(t, 'labelOut', 'Out:')}</span> -{fCur ? fCur(flowOut, adjustedNode.currency) : flowOut}</span>
                                                  {isForeignCurrency && <span className="text-[10px] opacity-60">≈ -{fCur ? fCur(flowOutBase, baseCurrency) : flowOutBase}</span>}
                                              </span>
                                            </>
                                          )}
                                          <span className="font-bold text-slate-800 dark:text-slate-200 flex flex-col items-start">
                                              <span><span className="hidden sm:inline">{safeT(t, 'labelEnd', 'Ende:')}</span> {fCur ? fCur(endBal, adjustedNode.currency) : endBal}</span>
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
                            
                            let hoverText = `${safeT(t, 'balanceAt', 'Bestand am')} ${item.date}: ${fCur ? fCur(runningTotal, adjustedNode.currency) : runningTotal}`;
                            if (isSecurities) {
                                hoverText = `${safeT(t, 'labelDateAt', 'Stichtag')}: ${item.date}\n${safeT(t, 'labelSharesAtDate', 'Stücke am Tag')}: ${runningShares} ${safeT(t, 'labelPcs', 'Stk.')}\n${safeT(t, 'labelMarketPrice', 'Börsenkurs')}: ${runningPrice} ${adjustedNode.currency}\n${safeT(t, 'labelValue', 'Wert')} (${adjustedNode.currency}): ${fCur ? fCur(runningTotal, adjustedNode.currency) : runningTotal}`;
                            }
                            if (isForeignCurrency) {
                                hoverText += `\n${safeT(t, 'labelExchangeRate', 'Wechselkurs')}: ${usedRate}`;
                                hoverText += `\n${safeT(t, 'inBaseCurrency', 'In Basiswährung')} (${baseCurrency}): ${fCur ? fCur(runningTotalBase, baseCurrency) : runningTotalBase}`;
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
                              if (typeMap[item.type]) typeLabel = safeT(t, typeMap[item.type], item.type);
                            }

                            let categoryDisplay = item._isBal ? safeT(t, 'systemManual', 'System/Manuell') : (item.subCategory || '-');
                            if (isSecurities && item.type === 'Wertanpassung') {
                                categoryDisplay = `${safeT(t, 'typeReval', 'Wertanpassung')}: ${item.price ? `${item.price} ${adjustedNode.currency}` : safeT(t, 'catManualAdjustment', 'Manuelle Anpassung')}`;
                            }
                            
                            let bonusInfo = '';
                            if (!item._isBal && ['Kauf', 'Verkauf'].includes(item.type) && item.shares) bonusInfo += ` (${item.shares} ${safeT(t, 'pcsAt', 'Stk. à')} ${item.price})`;
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
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'} font-semibold rounded-full shadow-sm ${badgeColor}`}><Icon name="Activity" size={10}/> {safeT(t, 'balanceLabel', 'SALDO')}</span>
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
                                                  placeholder={safeT(t, 'placeholderNoteTag', 'Notiz/Tag eingeben...')}
                                              />
                                          ) : (
                                              <span 
                                                  className="text-xs text-gray-500 cursor-text hover:text-blue-500 transition-colors py-0.5 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 rounded px-1 -ml-1"
                                                  onClick={(e) => { e.stopPropagation(); setTempComment(item.comment || ''); setEditingCommentId(item.id); }}
                                                  title={safeT(t, 'titleClickToEdit', 'Klicken zum Bearbeiten')}
                                              >
                                                  {item.comment ? renderSmartTags(item.comment) : <span className="opacity-40 italic flex items-center gap-1"><Icon name="Edit3" size={10}/> {safeT(t, 'labelAddNote', 'Notiz hinzufügen...')}</span>}
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
                                       title={safeT(t, 'btnDelete', 'Löschen')}
                                    >
                                       <Icon name="Trash" size={16}/>
                                    </span>
                                  ) : (
                                    <span className="inline-flex p-1.5 rounded-md text-gray-300 dark:text-slate-700 cursor-not-allowed" title={safeT(t, 'titleSystemEntry', 'System-Eintrag (wird bei Bereinigung automatisch entfernt)')}>
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
                          {safeT(t, 'labelSumDisplayedEntries', 'Summe der angezeigten Einträge')} ({sortedItems.filter(i=>!i._isBal && i.type !== 'Wertanpassung').length})
                      </div>
                      <div className="flex gap-6 text-sm tabular-nums">
                          <div className="flex flex-col items-end">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{safeT(t, 'labelInflows', 'Eingänge')}</span>
                              <span className="font-bold text-emerald-600">+{fCur ? fCur(totalInRaw, adjustedNode.currency) : totalInRaw}</span>
                          </div>
                          <div className="flex flex-col items-end">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{safeT(t, 'labelOutflows', 'Ausgänge')}</span>
                              <span className="font-bold text-rose-600">-{fCur ? fCur(totalOutRaw, adjustedNode.currency) : totalOutRaw}</span>
                          </div>
                          <div className="flex flex-col items-end border-l border-gray-200 dark:border-slate-700 pl-6 ml-2">
                              <span className="text-xs text-gray-400 uppercase tracking-wider">{safeT(t, 'labelNet', 'Netto')}</span>
                              <span className={`font-black ${netFlowVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {netFlowVal >= 0 ? '+' : ''}{fCur ? fCur(netFlowVal, adjustedNode.currency) : netFlowVal}
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
      <div className="p-8 h-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-center relative">
        {renderFlyInDrawer()}
        <h2 className="text-2xl font-bold mb-2">{safeT(t, 'viewTitle', 'Ansicht:')} {selectedNode?.name}</h2>
        <p className="text-gray-500 max-w-md">{safeT(t, 'selectAssetPrompt', 'Wähle auf der linken Seite ein Asset aus, um die detaillierten Buchungen zu sehen.')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950 finspa-scrollbar overflow-auto relative">
      {renderFlyInDrawer()}
      <div className="text-center text-gray-400">
        <Icon name="PieChart" size={64} className="mx-auto mb-6 opacity-20 text-blue-500" />
        <h2 className="text-2xl font-bold mb-2 text-gray-600 dark:text-gray-300">{safeT(t, 'welcomeTitle', 'Willkommen in FinBundle Pro')}</h2>
        <p>{safeT(t, 'welcomePrompt', 'Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.')}</p>
      </div>
    </div>
  );
};

module.exports = EditorArea;