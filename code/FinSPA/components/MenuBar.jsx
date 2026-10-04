const React = require('react');
const Icon = require('./Icons.jsx');

const getModule = (name) => {
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k === name || k.endsWith('/' + name) || k.endsWith(name));
    if (foundKey && typeof window.require === 'function') return window.require(foundKey);
  }
  try { return require('./data/' + name); } catch(e) { return {}; }
};

const DataEngine = getModule('DataEngine.jsx');
const { getAllAssets, getAssetValueAtDate, generateMonthEnds } = DataEngine;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const MenuBarLogo = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 100 100" className={`overflow-visible ${className}`}>
    <circle cx="50" cy="50" r="44" stroke="#ffffff" strokeWidth="5" fill="none" className="logo-pulse-circle origin-center" />
    <path d="M 28 62 L 42 72 L 68 42" stroke="#10b981" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <path d="M 54 42 L 68 42 L 68 56" stroke="#10b981" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <rect x="36" y="32" width="8" height="8" rx="2" fill="#10b981" className="logo-float-rect1" />
    <rect x="52" y="22" width="8" height="8" rx="2" fill="#10b981" className="logo-float-rect2" />
  </svg>
);

const MiniSparkline = ({ id, label, history, dates, formatValue, t }) => {
  const [hoverIdx, setHoverIdx] = React.useState(null);

  if (!history || history.length === 0 || history.every(v => v === 0)) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const overallUp = last >= first;
  const pctChange = first !== 0 ? ((last - first) / first) * 100 : 0;
  const activeColor = overallUp ? '#4ade80' : '#fb7185';

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = (max - min) || 0.0001; 

  const width = 60;
  const height = 24;

  const ptsObj = history.map((val, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = (height - 3) - ((val - min) / range) * (height - 6); 
      return { x, y, val, date: dates ? dates[i] : '' };
  });

  const linePath = `M ${ptsObj.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const handleMouseMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = x / rect.width;
      const MathIdx = Math.round(pct * (history.length - 1));
      const idx = Math.min(Math.max(MathIdx, 0), history.length - 1);
      setHoverIdx(idx);
  };

  const displayVal = hoverIdx !== null ? history[hoverIdx] : last;
  const isHovered = hoverIdx !== null;
  const endPoint = ptsObj[ptsObj.length - 1];

  return (
    <div className="flex items-center gap-1.5 opacity-95 hover:opacity-100 transition-opacity relative group" onMouseLeave={() => setHoverIdx(null)}>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
      <svg width={width} height={height} className="overflow-visible cursor-crosshair ml-1 mr-1" onMouseMove={handleMouseMove}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={height} x2={width} y2={height} stroke="#475569" strokeWidth="1.5" strokeDasharray="1,4" strokeLinecap="round" opacity="0.8" />
        <path d={areaPath} fill={`url(#grad-${id})`} className="pointer-events-none" />
        <path d={linePath} fill="none" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
        {!isHovered && <circle cx={endPoint.x} cy={endPoint.y} r="2.5" fill={activeColor} className="pointer-events-none animate-pulse" />}
        {isHovered && (
            <g className="pointer-events-none">
                <line x1={ptsObj[hoverIdx].x} y1={0} x2={ptsObj[hoverIdx].x} y2={height} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
                <circle cx={ptsObj[hoverIdx].x} cy={ptsObj[hoverIdx].y} r="3" fill="#0f172a" stroke={activeColor} strokeWidth="1.5" />
            </g>
        )}
      </svg>
      <div className="flex flex-col justify-center items-end">
          <span className="font-mono text-[13px] font-bold text-slate-100 leading-tight tracking-tight">{formatValue(displayVal)}</span>
          <span className={`text-[9px] font-black px-1.5 py-[2px] rounded flex items-center gap-0.5 mt-0.5 leading-none tracking-wider ${overallUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
             <Icon name={overallUp ? "ArrowUpRight" : "ArrowDownRight"} size={10} />
             {Math.abs(pctChange).toFixed(2)}%
          </span>
      </div>
      {isHovered && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-xl rounded-lg px-2.5 py-1 z-50 pointer-events-none animate-fade-in">
              <span className="text-[9px] text-slate-300 font-bold uppercase">{ptsObj[hoverIdx].date}</span>
          </div>
      )}
    </div>
  );
};

const BankSparklines = ({ data, t }) => {
  const banks = data?.banks || [];
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';
  const [fxData, setFxData] = React.useState(null);
  const [fxCurrency, setFxCurrency] = React.useState('EUR');
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setTick(prev => prev + 1), 15 * 60 * 1000); 
    return () => clearInterval(timer);
  }, []);

  const allAssets = React.useMemo(() => {
      return (banks.length > 0 && typeof getAllAssets === 'function') ? getAllAssets(banks) : [];
  }, [banks, tick]);

  const dates = React.useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    const startStr = sixMonthsAgo.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    let d = typeof generateMonthEnds === 'function' ? generateMonthEnds(startStr, endStr) : [startStr, endStr];
    if (d[d.length - 1] !== endStr) d.push(endStr);
    return d;
  }, [tick]);

  const wealthHistory = React.useMemo(() => {
    if (!allAssets.length) return [];
    return dates.map(date => 
      allAssets.reduce((sum, asset) => sum + (getAssetValueAtDate ? getAssetValueAtDate(asset, date, allAssets) : 0), 0)
    );
  }, [dates, allAssets, tick]);

  React.useEffect(() => {
     if (!allAssets.length) return;
     const currencies = allAssets.map(a => a.currency).filter(c => c && c !== baseCurrency);
     const counts = currencies.reduce((acc, c) => { acc[c] = (acc[c]||0)+1; return acc; }, {});
     const mostCommon = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
     if (mostCommon) setFxCurrency(mostCommon);
  }, [allAssets, baseCurrency]);

  React.useEffect(() => {
    if (!allAssets.length || !fxCurrency || fxCurrency === baseCurrency) return;
    const startStr = dates[0];
    const endStr = dates[dates.length - 1];

    const fetchHistory = async () => {
      let resData = null;
      try {
          const res = await fetch(`https://api.frankfurter.dev/v1/${startStr}..${endStr}?base=${fxCurrency}&symbols=${baseCurrency}`);
          if (res.ok) resData = await res.json();
      } catch(e) {}

      if (resData && resData.rates) {
          const history = dates.map(d => {
              let rate = null;
              let checkDate = new Date(d);
              for(let i=0; i<10; i++) { 
                  const dStr = checkDate.toISOString().split('T')[0];
                  if (resData.rates[dStr]) { rate = resData.rates[dStr][baseCurrency]; break; }
                  checkDate.setDate(checkDate.getDate() - 1);
              }
              return rate || (data?.settings?.exchangeRates?.[fxCurrency] || 1);
          });
          setFxData(history);
      }
    };
    fetchHistory();
  }, [fxCurrency, baseCurrency, dates, data, allAssets.length, tick]);

  if (!banks.length || !allAssets.length || typeof getAllAssets !== 'function') return null;
  const finalFxHistory = fxData || dates.map(() => data?.settings?.exchangeRates?.[fxCurrency] || 1);

  return (
    <div className="hidden xl:flex items-center gap-4 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-full shadow-inner mr-2 relative z-10" style={{ WebkitAppRegion: 'no-drag' }}>
      <MiniSparkline id="total-wealth" label={safeT(t, 'sparklineTotal', 'GESAMT')} history={wealthHistory} dates={dates} formatValue={(val) => `${val.toLocaleString('de-CH', { maximumFractionDigits: 0 })} ${baseCurrency}`} t={t} />
      <div className="w-px h-5 bg-slate-800"></div>
      <MiniSparkline id="fx-rate" label={`${fxCurrency}/${baseCurrency}`} history={finalFxHistory} dates={dates} formatValue={(val) => val.toFixed(4)} t={t} />
    </div>
  );
};

const MenuBar = ({ 
  data, viewMode, setViewMode, activeReport, setActiveReport, setSelectedNode, 
  theme, setTheme, lang, setLang, setModalObj, updateTreeData, t, 
  handleNewProject, handleOpenProject, handleSaveProject, 
  handleImportCSV, handleImportParqetCSV, handleExportCSV, handlePrint, handleExportPDF
}) => {
  const isStandalone = typeof window !== 'undefined' && 
    (window.chrome?.webview || window.navigator?.userAgent.includes('Electron'));
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__finspaSetViewMode = setViewMode;
      window.__finspaSetActiveReport = setActiveReport;
      window.__finspaSetSelectedNode = setSelectedNode;
    }
    const handleNavigate = (e) => {
      if (e.detail) {
        const { viewMode: vMode, activeReport: aRep } = e.detail;
        if (vMode && typeof setViewMode === 'function') setViewMode(vMode);
        if (typeof setActiveReport === 'function') setActiveReport(aRep || null);
        if (typeof setSelectedNode === 'function') setSelectedNode(null);
      }
    };
    window.addEventListener('finspa-navigate', handleNavigate);
    return () => {
      window.removeEventListener('finspa-navigate', handleNavigate);
      if (typeof window !== 'undefined') {
        delete window.__finspaSetViewMode;
        delete window.__finspaSetActiveReport;
        delete window.__finspaSetSelectedNode;
      }
    };
  }, [setViewMode, setActiveReport, setSelectedNode]);

  const handleWindowAction = (action) => {
    if (typeof window === 'undefined') return;
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ command: action });
    } else if (window.finspaHostAPI && typeof window.finspaHostAPI.send === 'function') {
      window.finspaHostAPI.send('window-control', action);
    } else if (action === 'close') {
      window.close();
    }
  };

  const MenuItem = ({ title, children }) => (
    <div className="relative group px-3.5 h-full flex items-center cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800/60 text-sm font-medium transition-all duration-150" style={{ WebkitAppRegion: 'no-drag' }}>
      <span className="relative py-1">{title}</span>
      <div className="absolute left-0 top-[95%] opacity-0 pointer-events-none translate-y-2 scale-[0.98] group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl border border-slate-200/60 dark:border-slate-800 w-[260px] rounded-xl p-1.5 z-[9999]" style={{ WebkitAppRegion: 'no-drag', cursor: 'default' }}>
        {children}
      </div>
    </div>
  );
  
  const MenuSubItem = ({ label, onClick, iconName, rightText }) => (
    <div className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-100" onClick={onClick} style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="flex items-center gap-3">
        {iconName && <Icon name={iconName} size={14} className="w-4" />} 
        <span className="text-sm font-medium tracking-wide">{label}</span>
      </div>
      {rightText && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{rightText}</span>}
    </div>
  );

  const MenuNestedItem = ({ label, iconName, children }) => (
    <div className="relative group/nested px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-100" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="flex items-center gap-3">
        {iconName && <Icon name={iconName} size={14} className="w-4" />} 
        <span className="text-sm font-medium tracking-wide">{label}</span>
      </div>
      <Icon name="ChevronRight" size={12} className="text-slate-400" />
      <div className="absolute left-[98%] top-0 opacity-0 pointer-events-none translate-x-2 group-hover/nested:opacity-100 group-hover/nested:pointer-events-auto group-hover/nested:translate-x-0 transition-all duration-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl border border-slate-200/60 dark:border-slate-800 w-[260px] rounded-xl p-1.5 z-[9999]" style={{ WebkitAppRegion: 'no-drag', cursor: 'default' }}>
        {children}
      </div>
    </div>
  );

  const plugins = data?.plugins || [];
  const groupedPlugins = React.useMemo(() => {
    const map = {};
    plugins.forEach(p => {
      const cat = p.category || 'Allgemein';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return map;
  }, [plugins]);

  return (
    <div 
      className={`print-hide flex bg-slate-900 text-slate-200 select-none items-center shadow-md border-b border-slate-800/80 relative z-50 h-11 ${isStandalone && isMac ? 'pl-[70px]' : ''}`}
      style={{ WebkitAppRegion: isStandalone ? 'drag' : 'auto' }}
    >
      <div className="w-16 h-full bg-blue-600 flex items-center justify-center z-30 shadow-lg relative shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <MenuBarLogo className="h-14 w-14 absolute top-1/2 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none" />
      </div>
      
      <div className="flex items-center h-full ml-1 pr-4 relative z-20 bg-slate-900">
          
          {/* 1. DATEI */}
          <MenuItem title={safeT(t, 'menuFile', 'Datei')}>
            <MenuSubItem label={safeT(t, 'fileNew', 'Neu (Leeres Projekt)')} iconName="FilePlus" onClick={handleNewProject} />
            <label className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100" style={{ WebkitAppRegion: 'no-drag' }}>
              <Icon name="FolderOpen" size={14} className="w-4"/> 
              <span className="text-sm font-medium tracking-wide">{safeT(t, 'fileOpen', 'Öffnen')}</span>
              <input type="file" accept=".json,.zip" className="hidden" onChange={handleOpenProject} />
            </label>
            <MenuSubItem label={safeT(t, 'fileSave', 'Speichern')} iconName="Save" onClick={() => handleSaveProject(false)} />
            <MenuSubItem label={safeT(t, 'fileSaveAs', 'Speichern unter...')} iconName="Copy" onClick={() => handleSaveProject(true)} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            
            <MenuNestedItem label={safeT(t, 'fileImport', 'Importieren')} iconName="Download">
              <MenuSubItem label={safeT(t, 'fileImportStandard', 'Buchungen importieren (CSV Wizard)')} iconName="List" onClick={() => setModalObj({type: 'csvImport'})} />
              <label className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100">
                <Icon name="TrendingUp" size={14} className="w-4"/> 
                <span className="text-sm font-medium tracking-wide">{safeT(t, 'fileImportParqet', 'Parqet Daten importieren')}</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportParqetCSV} />
              </label>
              {data?.settings?.aiEnabled !== false && (
                  <MenuSubItem label={safeT(t, 'fileImportPdfKI', 'PDF Rechnung scannen (KI)')} iconName="FileText" onClick={() => setModalObj({type: 'pdfImport'})} />
              )}
            </MenuNestedItem>
            
            <MenuNestedItem label={safeT(t, 'fileExportTitle', 'Exportieren')} iconName="Upload">
                <MenuSubItem label={safeT(t, 'fileExportCsv', 'Buchungen exportieren')} iconName="List" onClick={handleExportCSV} />
                <MenuSubItem label={safeT(t, 'filePrintPdf', 'Als PDF exportieren')} iconName="FileText" onClick={handleExportPDF} />
                <MenuSubItem 
                  label={safeT(t, 'fileExportFullPdf', 'Gesamtreport als PDF')} 
                  iconName="Layers" 
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.showToast) {
                      window.showToast(safeT(t, 'msgExportFullPdfStarted', "Generiere Gesamtreport im Hintergrund..."), "info");
                    }
                    window.dispatchEvent(new Event('triggerFullPdfBatch'));
                  }} 
                />
                <MenuSubItem 
                  label={safeT(t, 'fileExportExcel', 'Als Excel (.xlsx) exportieren')} 
                  iconName="FileExcel" 
                  onClick={async () => {
                    try {
                      if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast(safeT(t, 'msgExportingExcel', "Excel-Export gestartet..."), "info");
                      }
                      let ExcelExportEngine;
                      if (typeof window !== 'undefined' && window.__FinSPAModules) {
                        const keys = Object.keys(window.__FinSPAModules);
                        const foundKey = keys.find(k => k.endsWith('ExcelExportEngine.jsx'));
                        if (foundKey && typeof window.require === 'function') ExcelExportEngine = window.require(foundKey);
                      }
                      if (!ExcelExportEngine) {
                        try { ExcelExportEngine = require('./print/ExcelExportEngine.jsx'); } 
                        catch(err) { ExcelExportEngine = require('../print/ExcelExportEngine.jsx'); }
                      }
                      if (!ExcelExportEngine || typeof ExcelExportEngine.exportPortfolio !== 'function') {
                        throw new Error("ExcelExportEngine.jsx konnte nicht gefunden oder geladen werden.");
                      }
                      const blob = await ExcelExportEngine.exportPortfolio(data, DataEngine, t);
                      const fileName = `FinBundle_Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast(safeT(t, 'msgExportExcelSuccess', "Excel-Export erfolgreich!"), "success");
                      }
                    } catch (err) {
                      console.error("[FinBundle] Excel Export Error:", err);
                      if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast(safeT(t, 'msgExportExcelError', "Fehler beim Excel-Export: ") + err.message, "error");
                      }
                    }
                  }} 
                />
            </MenuNestedItem>
            
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={safeT(t, 'filePrint', 'Drucken')} iconName="Printer" onClick={handlePrint} rightText={isMac ? "⌘P" : "Ctrl+P"} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={safeT(t, 'fileSettings', 'Einstellungen')} iconName="Settings" onClick={() => setModalObj({type: 'settings'})} />
          </MenuItem>

          {/* 2. ANSICHTEN */}
          <MenuItem title={safeT(t, 'menuViews', 'Ansichten')}>
            <MenuSubItem label={safeT(t, 'viewWealth', 'Vermögensverwaltung')} iconName="Shield" onClick={() => { setViewMode('vermoegen'); setActiveReport('allocation'); setSelectedNode(null); }} rightText={viewMode === 'vermoegen' ? '✓' : ''} />
            <MenuSubItem label={safeT(t, 'viewBudget', 'Budgetverwaltung')} iconName="DollarSign" onClick={() => { setViewMode('budget'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'budget' ? '✓' : ''} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={safeT(t, 'viewLiveEditor', 'API LiveEditor')} iconName="Cloud" onClick={() => { setViewMode('liveEditor'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'liveEditor' ? '✓' : ''} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={safeT(t, 'viewData', 'Datensicht')} iconName="Settings" onClick={() => { setViewMode('datensicht'); setActiveReport(null); }} rightText={viewMode === 'datensicht' ? '✓' : ''} />
            {data?.settings?.aiEnabled !== false && (
              <>
                <hr className="border-slate-100 dark:border-slate-800 my-1"/>
                <MenuSubItem label={safeT(t, 'menuAiAssistant', 'KI-Assistent (Copilot)')} iconName="Cpu" onClick={() => { setViewMode('ai'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'ai' ? '✓' : ''} />
              </>
            )}
          </MenuItem>

          {/* 3. REPORTS */}
          <MenuItem title={safeT(t, 'menuReports', 'Reports')}>
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 mx-1">
              {safeT(t, 'menuHeaderStockReports', 'Bestandesreports')}
            </div>
            <MenuSubItem label={safeT(t, 'repOverview', 'Banken & Kategorien')} iconName="List" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('overview'); }} />
            <MenuSubItem label={safeT(t, 'repAlloc', 'Allokation nach Banken')} iconName="PieChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('allocation'); }} />
            <MenuSubItem label={safeT(t, 'repLiq', 'Liquiditätsrisiko')} iconName="PieChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('liquidity'); }} />
            <MenuSubItem label={safeT(t, 'repHist', 'Historischer Verlauf')} iconName="TrendingUp" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('history'); }} />
            <MenuSubItem label={safeT(t, 'repTax', 'Steuerreport (31.12)')} iconName="List" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('tax'); }} />
            <MenuSubItem label={safeT(t, 'repPension3a', 'Säule 3a Performance')} iconName="Lock" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('pension3a'); }} />
            <MenuSubItem label={safeT(t, 'repSecurities', 'Aktien & Fonds Performance')} iconName="TrendingUp" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('securities'); }} />
            
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 mt-2 mx-1">
              {safeT(t, 'menuHeaderFlowReports', 'Bewegungsreports')}
            </div>
            <MenuSubItem label={safeT(t, 'repCatFlow', 'Kategorienfluss')} iconName="BarChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('categoryFlow'); }} />
            <MenuSubItem label={safeT(t, 'repWaterfall', 'Wasserfallfluss')} iconName="BarChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('waterfall'); }} />
            <MenuSubItem label={safeT(t, 'repPassive', 'Passives Einkommen')} iconName="DollarSign" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('passive'); }} />
            <MenuSubItem label={safeT(t, 'repTopFlow', 'Top Flow Assets')} iconName="BarChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('topFlow'); }} />
            <MenuSubItem label={safeT(t, 'repBookAna', 'Buchungsanalyse')} iconName="PieChart" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('bookingAnalysis'); }} />
            
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 mt-2 mx-1">
              {safeT(t, 'menuHeaderFutureReports', 'Zukunftsreports')}
            </div>
            <MenuSubItem label={safeT(t, 'repDividendCalendar', 'Dividenden-Kalender')} iconName="Calendar" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('dividendCalendar'); }} />
            <MenuSubItem label={safeT(t, 'repSimReg', 'Simulation & Regression')} iconName="TrendingUp" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('future'); }} />
            <MenuSubItem label={safeT(t, 'repScenFire', 'Szenarien & FIRE')} iconName="Target" onClick={() => { setViewMode('vermoegen'); setSelectedNode(null); setActiveReport('scenarios'); }} />
          </MenuItem>

          {/* 4. PLUGINS */}
          <MenuItem title="Plugins">
            {plugins.length === 0 ? (
              <>
                <div className="px-3 py-2 text-xs text-gray-400 italic">
                  {safeT(t, 'menuNoPluginsPresent', 'Keine Plugins vorhanden')}
                </div>
                <hr className="border-slate-100 dark:border-slate-800 my-1"/>
                <MenuSubItem 
                  label={safeT(t, 'menuCreateInAiCopilot', 'Im AI Copilot erstellen...')} 
                  iconName="Cpu" 
                  onClick={() => { setViewMode('ai'); setSelectedNode(null); setActiveReport(null); }} 
                />
              </>
            ) : (
              <>
                <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 mx-1">
                  {safeT(t, 'menuHeaderAiReports', 'Eigene AI Reports')}
                </div>
                
                {Object.entries(groupedPlugins).map(([category, catPlugins]) => (
                  <MenuNestedItem key={category} label={category} iconName="Folder">
                    {catPlugins.map(plugin => (
                      <MenuSubItem 
                        key={plugin.id} 
                        label={plugin.title || plugin.name} 
                        iconName="FileText" 
                        onClick={() => {
                          setViewMode('plugin');
                          setActiveReport(plugin.id);
                          setSelectedNode(null);
                        }}
                        rightText={(viewMode === 'plugin' && activeReport === plugin.id) ? '✓' : ''}
                      />
                    ))}
                  </MenuNestedItem>
                ))}

                <hr className="border-slate-100 dark:border-slate-800 my-1"/>
                <MenuSubItem 
                  label={safeT(t, 'menuNewPluginCopilot', 'Neues Plugin (AI Copilot)...')} 
                  iconName="PlusCircle" 
                  onClick={() => { setViewMode('ai'); setSelectedNode(null); setActiveReport(null); }} 
                />
                <MenuSubItem 
                  label={safeT(t, 'menuManagePlugins', 'Plugins verwalten...')} 
                  iconName="Settings" 
                  onClick={() => {
                    setViewMode('managePlugins');
                    setActiveReport(null);
                    setSelectedNode(null);
                  }} 
                  rightText={viewMode === 'managePlugins' ? '✓' : ''}
                />
              </>
            )}
          </MenuItem>
          
          {/* 5. HILFE */}
          <MenuItem title={safeT(t, 'menuHelp', 'Hilfe')}>
             <MenuSubItem label={safeT(t, 'helpManual', 'Benutzerhandbuch')} iconName="Info" onClick={() => setModalObj({type: 'help'})} />
             <hr className="border-slate-100 dark:border-slate-800 my-1"/>
             <MenuSubItem label={safeT(t, 'helpAbout', 'Über FinBundle')} iconName="Star" onClick={() => setModalObj({type: 'about'})} />
          </MenuItem>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <span className="text-sm font-black tracking-[0.2em] uppercase glow-title drop-shadow-md whitespace-nowrap">
              {Array.from("FinBundle PRO").map((char, index) => (
                <span
                  key={index}
                  className="sparkle-letter"
                  style={{
                    color: index < 9 ? 'white' : index === 9 ? 'transparent' : '#38bdf8',
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  {char}
                </span>
              ))}
          </span>
      </div>

      <div className="ml-auto flex items-center h-full relative z-20 bg-slate-900 pl-4" style={{ WebkitAppRegion: 'no-drag' }}>      
         <BankSparklines data={data} t={t} />

         <MenuItem title={lang.toUpperCase()}>
          <MenuSubItem label="Deutsch" onClick={() => setLang('de')} rightText={lang === 'de' ? '✓' : ''} />
          <MenuSubItem label="English" onClick={() => setLang('en')} rightText={lang === 'en' ? '✓' : ''} />
          <MenuSubItem label="Français" onClick={() => setLang('fr')} rightText={lang === 'fr' ? '✓' : ''} />
          <MenuSubItem label="Italiano" onClick={() => setLang('it')} rightText={lang === 'it' ? '✓' : ''} />
        </MenuItem>

        <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 border-l border-slate-800/60 transition-all" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          <Icon name={theme === 'light' ? "Moon" : "Sun"} size={15} />
        </div>

        {isStandalone && !isMac && (
          <div className="flex items-center border-l border-slate-800/60 h-full">
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all" onClick={() => handleWindowAction('minimize')} title={safeT(t, 'titleMinimize', "Minimieren")}>
              <Icon name="Minus" size={15} />
            </div>
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all" onClick={() => handleWindowAction('maximize')} title={safeT(t, 'titleMaximize', "Maximieren/Wiederherstellen")}>
              <Icon name="Square" size={13} />
            </div>
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-red-500 transition-all" onClick={() => handleWindowAction('close')} title={safeT(t, 'titleCloseWindow', "Schließen")}>
              <Icon name="X" size={15} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

module.exports = MenuBar;