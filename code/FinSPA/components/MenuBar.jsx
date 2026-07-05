const React = require('react');
const Icon = require('./Icons.jsx');

// --- HILFSFUNKTION ZUM LADEN DER DATAENGINE ---
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

// --- EIGENE LOGO KOMPONENTE FÜR DIE MENÜLEISTE ---
const MenuBarLogo = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 100 100" className={`overflow-visible ${className}`}>
    <circle cx="50" cy="50" r="44" stroke="#ffffff" strokeWidth="5" fill="none" className="logo-pulse-circle origin-center" />
    <path d="M 28 62 L 42 72 L 68 42" stroke="#10b981" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <path d="M 54 42 L 68 42 L 68 56" stroke="#10b981" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <rect x="36" y="32" width="8" height="8" rx="2" fill="#10b981" className="logo-float-rect1" />
    <rect x="52" y="22" width="8" height="8" rx="2" fill="#10b981" className="logo-float-rect2" />
  </svg>
);

// --- INTERAKTIVE MINI-SPARKLINE (MODERN TRADING APP STYLE) ---
const MiniSparkline = ({ id, label, history, dates, formatValue }) => {
  const [hoverIdx, setHoverIdx] = React.useState(null);

  if (!history || history.length === 0 || history.every(v => v === 0)) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const overallUp = last >= first;

  // Berechnung der prozentualen Veränderung seit dem ersten Wert (vor 6 Monaten)
  const pctChange = first !== 0 ? ((last - first) / first) * 100 : 0;

  // Moderne Finanz-App Farben (Trade Republic / Robinhood Style)
  const colorUp = '#4ade80'; // Neon Grün
  const colorDown = '#fb7185'; // Neon Pink/Rot
  const activeColor = overallUp ? colorUp : colorDown;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = (max - min) || 0.0001; 

  const width = 60; // Leicht schmaler für kompakteren Look
  const height = 24;

  const ptsObj = history.map((val, i) => {
      const x = (i / (history.length - 1)) * width;
      // Kurve vom Rand fernhalten, um Platz für Linie und Dot zu lassen
      const y = (height - 3) - ((val - min) / range) * (height - 6); 
      return { x, y, val, date: dates ? dates[i] : '' };
  });

  const linePath = `M ${ptsObj.map(p => `${p.x},${p.y}`).join(' L ')}`;
  // Pfad für den Gradient-Fill: Geht von der Kurve nach unten rechts, dann nach unten links und schliesst den Kreis.
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
    // Reduziertes Gap auf gap-1.5 für kompakteren Aufbau
    <div 
        className="flex items-center gap-1.5 opacity-95 hover:opacity-100 transition-opacity relative group"
        onMouseLeave={() => setHoverIdx(null)}
    >
      {/* 1. Label auf der linken Seite */}
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        {label} 
      </span>

      {/* 2. Graphik in der Mitte */}
      <svg 
          width={width} 
          height={height} 
          className="overflow-visible cursor-crosshair ml-1 mr-1"
          onMouseMove={handleMouseMove}
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Gepunktete Base-Linie */}
        <line 
            x1="0" y1={height} 
            x2={width} y2={height} 
            stroke="#475569" strokeWidth="1.5" strokeDasharray="1,4" strokeLinecap="round" opacity="0.8" 
        />
        
        {/* Flächenfüllung (Gradient) */}
        <path 
            d={areaPath} 
            fill={`url(#grad-${id})`} 
            className="pointer-events-none"
        />

        {/* Die eigentliche Kurve */}
        <path 
            d={linePath} 
            fill="none" 
            stroke={activeColor} 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="pointer-events-none"
        />

        {/* Pulsierender Punkt am Ende der Kurve */}
        {!isHovered && (
            <circle 
                cx={endPoint.x} cy={endPoint.y} r="2.5" 
                fill={activeColor} 
                filter={`url(#glow-${id})`}
                className="pointer-events-none animate-pulse" 
            />
        )}

        {/* Hover-Punkt und gestrichelte Indikator-Linie */}
        {isHovered && (
            <g className="pointer-events-none">
                <line 
                    x1={ptsObj[hoverIdx].x} y1={0} 
                    x2={ptsObj[hoverIdx].x} y2={height} 
                    stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" 
                />
                <circle 
                    cx={ptsObj[hoverIdx].x} cy={ptsObj[hoverIdx].y} r="3" 
                    fill="#0f172a" stroke={activeColor} strokeWidth="1.5" 
                />
            </g>
        )}
      </svg>

      {/* 3. Wert und Prozent-Veränderung auf der rechten Seite */}
      <div className="flex flex-col justify-center items-end">
          <span className="font-mono text-[13px] font-bold text-slate-100 leading-tight tracking-tight">
              {formatValue(displayVal)}
          </span>
          <span className={`text-[9px] font-black px-1.5 py-[2px] rounded flex items-center gap-0.5 mt-0.5 leading-none tracking-wider ${overallUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
             <Icon name={overallUp ? "ArrowUpRight" : "ArrowDownRight"} size={10} />
             {Math.abs(pctChange).toFixed(2)}%
          </span>
      </div>

      {/* Tooltip für das exakte Datum beim Hovern */}
      {isHovered && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-xl rounded-lg px-2.5 py-1 z-50 pointer-events-none animate-fade-in">
              <span className="text-[9px] text-slate-300 font-bold uppercase">{ptsObj[hoverIdx].date}</span>
          </div>
      )}
    </div>
  );
};

// --- SPARKLINES CONTAINER ---
const BankSparklines = ({ data }) => {
  const banks = data?.banks || [];
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';
  
  const [fxData, setFxData] = React.useState(null);
  const [fxCurrency, setFxCurrency] = React.useState('EUR');

  if (!banks.length || typeof getAllAssets !== 'function') return null;

  const allAssets = React.useMemo(() => getAllAssets(banks), [banks]);

  // 1. Datenpunkte für die Zeitachse ermitteln (letzte 6 Monate)
  const dates = React.useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    const startStr = sixMonthsAgo.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    
    let d = typeof generateMonthEnds === 'function' ? generateMonthEnds(startStr, endStr) : [startStr, endStr];
    if (d[d.length - 1] !== endStr) d.push(endStr);
    return d;
  }, []);

  // 2. Gesamtvermögen Historie berechnen
  const wealthHistory = React.useMemo(() => {
    return dates.map(date => 
      allAssets.reduce((sum, asset) => sum + (getAssetValueAtDate ? getAssetValueAtDate(asset, date, allAssets) : 0), 0)
    );
  }, [dates, allAssets]);

  // 3. Fremdwährung automatisch erkennen
  React.useEffect(() => {
     const currencies = allAssets.map(a => a.currency).filter(c => c && c !== baseCurrency);
     const counts = currencies.reduce((acc, c) => { acc[c] = (acc[c]||0)+1; return acc; }, {});
     const mostCommon = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
     
     if (mostCommon) {
         setFxCurrency(mostCommon);
     } else if (data?.settings?.exchangeRates) {
         const available = Object.keys(data.settings.exchangeRates).filter(c => c !== baseCurrency);
         if (available.length > 0) setFxCurrency(available[0]);
     }
  }, [allAssets, baseCurrency, data]);

  // 4. Historie des FX-KURSES über die Frankfurter API
  React.useEffect(() => {
    if (!fxCurrency || fxCurrency === baseCurrency) return;
    
    const startStr = dates[0];
    const endStr = dates[dates.length - 1];

    const fetchHistory = async () => {
      let resData = null;

      // Versuch 1: Frankfurter V2 (dev)
      try {
          const res = await fetch(`https://api.frankfurter.dev/v1/${startStr}..${endStr}?base=${fxCurrency}&symbols=${baseCurrency}`);
          if (res.ok) {
              resData = await res.json();
          }
      } catch(e) { console.warn("[FinBundle] Frankfurter V2 fetch failed", e); }

      // Versuch 2: Frankfurter V1 (app) Fallback
      if (!resData) {
          try {
              const res2 = await fetch(`https://api.frankfurter.app/${startStr}..${endStr}?base=${fxCurrency}&symbols=${baseCurrency}`);
              if (res2.ok) {
                  resData = await res2.json();
              }
          } catch(e) { console.warn("[FinBundle] Frankfurter V1 fetch failed", e); }
      }

      // Daten verarbeiten
      if (resData && resData.rates) {
          const history = dates.map(d => {
              let rate = null;
              let checkDate = new Date(d);
              // Gehe bis zu 10 Tage zurück, falls Feiertag/Wochenende ist
              for(let i=0; i<10; i++) { 
                  const dStr = checkDate.toISOString().split('T')[0];
                  if (resData.rates[dStr]) {
                      rate = resData.rates[dStr][baseCurrency];
                      break;
                  }
                  checkDate.setDate(checkDate.getDate() - 1);
              }
              return rate || (data?.settings?.exchangeRates?.[fxCurrency] || 1);
          });
          setFxData(history);
      }
    };

    fetchHistory();
  }, [fxCurrency, baseCurrency, dates, data]);

  // Fallback, solange die API lädt
  const finalFxHistory = fxData || dates.map(() => data?.settings?.exchangeRates?.[fxCurrency] || 1);

  return (
    // Reduziertes Gap auf gap-4 und Padding auf px-3
    <div className="hidden xl:flex items-center gap-4 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-full shadow-inner mr-2 relative z-10" style={{ WebkitAppRegion: 'no-drag' }}>
      
      {/* Sparkline 1: GESAMTVERMÖGEN */}
      <MiniSparkline
        id="total-wealth"
        label="GESAMT"
        history={wealthHistory}
        dates={dates}
        formatValue={(val) => `${val.toLocaleString('de-CH', { maximumFractionDigits: 0 })} ${baseCurrency}`}
      />

      {/* Trenner */}
      <div className="w-px h-5 bg-slate-800"></div>

      {/* Sparkline 2: FX RATE AUS DATAENGINE MIT TEXT-ANZEIGE */}
      <MiniSparkline
        id="fx-rate"
        label={`${fxCurrency}/${baseCurrency}`}
        history={finalFxHistory}
        dates={dates}
        formatValue={(val) => val.toFixed(4)}
      />

    </div>
  );
};

const MenuBar = ({ 
  data, viewMode, setViewMode, setActiveReport, setSelectedNode, 
  theme, setTheme, lang, setLang, setModalObj, t, 
  handleNewProject, handleOpenProject, handleSaveProject, 
  handleImportCSV, handleImportParqetCSV, handleExportCSV, handlePrint, handleExportPDF
}) => {
  
  const isStandalone = typeof window !== 'undefined' && 
    (window.chrome?.webview || window.navigator?.userAgent.includes('Electron'));
  
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const handleWindowAction = (action) => {
    if (typeof window === 'undefined') return;

    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ command: action });
    } 
    else if (window.finspaHostAPI && typeof window.finspaHostAPI.send === 'function') {
      window.finspaHostAPI.send('window-control', action);
    }
    else {
      if (action === 'close') window.close();
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
      <div className="absolute left-[98%] top-0 opacity-0 pointer-events-none translate-x-2 group-hover/nested:opacity-100 group-hover/nested:pointer-events-auto group-hover/nested:translate-x-0 transition-all duration-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl border border-slate-200/60 dark:border-slate-800 w-[250px] rounded-xl p-1.5 z-[9999]" style={{ WebkitAppRegion: 'no-drag', cursor: 'default' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div 
      className={`print-hide flex bg-slate-900 text-slate-200 select-none items-center shadow-md border-b border-slate-800/80 relative z-50 h-11 ${isStandalone && isMac ? 'pl-[70px]' : ''}`}
      style={{ WebkitAppRegion: isStandalone ? 'drag' : 'auto' }}
    >
      <style>{`
        @keyframes textGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(56,189,248,0.4), 0 0 16px rgba(56,189,248,0.2); }
          50% { text-shadow: 0 0 16px rgba(56,189,248,0.8), 0 0 32px rgba(56,189,248,0.4); }
        }
        .glow-title { animation: textGlow 4s ease-in-out infinite; }
        @keyframes sparkleShimmer {
          0%, 100% { opacity: 0.7; text-shadow: 0 0 5px rgba(255, 255, 255, 0.4), 0 0 10px rgba(56, 189, 248, 0.2); }
          50% { opacity: 1; text-shadow: 0 0 15px rgba(255, 255, 255, 0.8), 0 0 25px rgba(56, 189, 248, 0.4); }
        }
        .sparkle-letter {
          animation: sparkleShimmer 2s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>

      {/* 1. VERGRÖSSERTES LOGO GANZ LINKS */}
      <div className="w-16 h-full bg-blue-600 flex items-center justify-center z-30 shadow-lg relative shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <MenuBarLogo className="h-14 w-14 absolute top-1/2 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none" />
      </div>
      
      {/* 2. MENÜPUNKTE */}
      <div className="flex items-center h-full ml-1 pr-4 relative z-20 bg-slate-900">
          <MenuItem title={t ? t('menuFile') : 'Datei'}>
            <MenuSubItem label={t ? t('fileNew') : 'Neu (Leeres Projekt)'} iconName="FilePlus" onClick={handleNewProject} />
            <label className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100" style={{ WebkitAppRegion: 'no-drag' }}>
              <Icon name="FolderOpen" size={14} className="w-4"/> 
              <span className="text-sm font-medium tracking-wide">{t ? t('fileOpen') : 'Öffnen'}</span>
              <input type="file" accept=".json,.zip" className="hidden" onChange={handleOpenProject} />
            </label>
            <MenuSubItem label={t ? t('fileSave') : 'Speichern'} iconName="Save" onClick={() => handleSaveProject(false)} />
            <MenuSubItem label={t ? t('fileSaveAs') : 'Speichern unter...'} iconName="Copy" onClick={() => handleSaveProject(true)} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuNestedItem label={t ? t('fileImport') : 'Importieren'} iconName="Download">
              <label className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100" style={{ WebkitAppRegion: 'no-drag' }}>
                <Icon name="List" size={14} className="w-4"/> 
                <span className="text-sm font-medium tracking-wide">{t ? t('fileImportStandard') : 'Buchungen importieren'}</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              </label>
              <label className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100" style={{ WebkitAppRegion: 'no-drag' }}>
                <Icon name="TrendingUp" size={14} className="w-4"/> 
                <span className="text-sm font-medium tracking-wide">{t ? t('fileImportParqet') : 'Parqet Daten importieren'}</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportParqetCSV} />
              </label>
              {data?.settings?.aiEnabled !== false && (
                  <MenuSubItem label={t ? t('fileImportPdfKI') : 'PDF Rechnung scannen (KI)'} iconName="FileText" onClick={() => setModalObj({type: 'pdfImport'})} />
              )}
            </MenuNestedItem>
            
            <MenuNestedItem label={t ? t('fileExportTitle') : 'Exportieren'} iconName="Upload">
                <MenuSubItem label={t ? t('fileExportCsv') : 'Buchungen exportieren'} iconName="List" onClick={handleExportCSV} />
                <MenuSubItem label={t ? t('filePrintPdf') : 'Als PDF exportieren'} iconName="FileText" onClick={handleExportPDF} />
                
                <MenuSubItem 
                  label={(t && t('fileExportFullPdf') !== 'fileExportFullPdf') ? t('fileExportFullPdf') : 'Gesamtreport als PDF'} 
                  iconName="Layers" 
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.showToast) {
                      window.showToast(t ? t('msgExportFullPdfStarted') || "Generiere Gesamtreport im Hintergrund..." : "Generiere Gesamtreport im Hintergrund...", "info");
                    }
                    window.dispatchEvent(new Event('triggerFullPdfBatch'));
                  }} 
                />
                
                <MenuSubItem 
                  label={t ? t('fileExportExcel') || 'Als Excel (.xlsx) exportieren' : 'Als Excel (.xlsx) exportieren'} 
                  iconName="FileExcel" 
                  onClick={async () => {
                    try {
                      if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast(t ? t('msgExportingExcel') || "Excel-Export gestartet..." : "Excel-Export gestartet...", "info");
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
                        window.showToast(t ? t('msgExportExcelSuccess') || "Excel-Export erfolgreich!" : "Excel-Export erfolgreich!", "success");
                      }
                    } catch (err) {
                      console.error("[FinBundle] Excel Export Error:", err);
                      if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast((t ? t('msgExportExcelError') : "Fehler beim Excel-Export: ") + err.message, "error");
                      } else {
                        alert("Fehler beim Excel-Export: " + err.message);
                      }
                    }
                  }} 
                />
            </MenuNestedItem>
            
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={t ? t('filePrint') : 'Drucken'} iconName="Printer" onClick={handlePrint} rightText={isMac ? "⌘P" : "Ctrl+P"} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={t ? t('fileSettings') : 'Einstellungen'} iconName="Settings" onClick={() => setModalObj({type: 'settings'})} />
          </MenuItem>

          <MenuItem title={t ? t('menuViews') : 'Ansichten'}>
            <MenuSubItem label={t ? t('viewWealth') : 'Vermögensverwaltung'} iconName="Shield" onClick={() => { setViewMode('vermoegen'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'vermoegen' ? '✓' : ''} />
            <MenuSubItem label={t ? t('viewBudget') : 'Budgetverwaltung'} iconName="DollarSign" onClick={() => { setViewMode('budget'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'budget' ? '✓' : ''} />
            <hr className="border-slate-100 dark:border-slate-800 my-1"/>
            <MenuSubItem label={t ? t('viewData') : 'Datensicht'} iconName="Settings" onClick={() => { setViewMode('datensicht'); setActiveReport(null); }} rightText={viewMode === 'datensicht' ? '✓' : ''} />

            {data?.settings?.aiEnabled !== false && (
              <>
                <hr className="border-slate-100 dark:border-slate-800 my-1"/>
                <MenuSubItem label={t ? t('menuAiAssistant') : 'KI-Assistent (Ollama)'} iconName="Cpu" onClick={() => { setViewMode('ai'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'ai' ? '✓' : ''} />
              </>
            )}
          </MenuItem>

          <MenuItem title={t ? t('menuReports') : 'Reports'}>
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 mx-1">{t ? t('repStock') : 'Bestandesreports'}</div>
            <MenuSubItem label={t ? t('repOverview') : "Banken & Kategorien"} iconName="List" onClick={() => setActiveReport('overview')} />
            <MenuSubItem label={t ? t('repAlloc') : 'Allokation nach Banken'} iconName="PieChart" onClick={() => setActiveReport('allocation')} />
            <MenuSubItem label={t ? t('repLiq') : 'Liquiditätsrisiko'} iconName="PieChart" onClick={() => setActiveReport('liquidity')} />
            <MenuSubItem label={t ? t('repHist') : 'Historischer Verlauf'} iconName="TrendingUp" onClick={() => setActiveReport('history')} />
            <MenuSubItem label={t ? t('repTax') : 'Steuerreport (31.12)'} iconName="List" onClick={() => setActiveReport('tax')} />
            <MenuSubItem label={t ? t('repPension3a') : 'Säule 3a Performance'} iconName="Lock" onClick={() => setActiveReport('pension3a')} />
            <MenuSubItem label={t ? t('repSecurities') : 'Aktien & Fonds Performance'} iconName="TrendingUp" onClick={() => setActiveReport('securities')} />
            
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 mt-2 mx-1">{t ? t('repFlow') : 'Bewegungsreports'}</div>
            <MenuSubItem label={t ? t('repCatFlow') : 'Kategorienfluss'} iconName="BarChart" onClick={() => setActiveReport('categoryFlow')} />
            <MenuSubItem label={t ? t('repWaterfall') : 'Wasserfallfluss'} iconName="BarChart" onClick={() => setActiveReport('waterfall')} />
            <MenuSubItem label={t ? t('repPassive') : 'Passives Einkommen'} iconName="DollarSign" onClick={() => setActiveReport('passive')} />
            <MenuSubItem label={t ? t('repTopFlow') : 'Top Flow Assets'} iconName="BarChart" onClick={() => setActiveReport('topFlow')} />
            <MenuSubItem label={t ? t('repBookAna') : 'Buchungsanalyse'} iconName="PieChart" onClick={() => setActiveReport('bookingAnalysis')} />
            
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 mt-2 mx-1">{t ? t('repFuture') : 'Zukunftsreports'}</div>

            <MenuSubItem label={t ? t('repDividendCalendar') || 'Dividenden-Kalender' : 'Dividenden-Kalender'} iconName="Calendar" onClick={() => setActiveReport('dividendCalendar')} />
            <MenuSubItem label={t ? t('repSimReg') : 'Simulation & Regression'} iconName="TrendingUp" onClick={() => setActiveReport('future')} />
            <MenuSubItem label={t ? t('repScenFire') : 'Szenarien & FIRE'} iconName="Target" onClick={() => setActiveReport('scenarios')} />
          </MenuItem>
          
          <MenuItem title={t ? t('menuHelp') : 'Hilfe'}>
             <MenuSubItem label={t ? t('helpManual') : 'Benutzerhandbuch'} iconName="Info" onClick={() => setModalObj({type: 'help'})} />
             <hr className="border-slate-100 dark:border-slate-800 my-1"/>
             <MenuSubItem label={t ? t('helpAbout') : 'Über FinBundle'} iconName="Star" onClick={() => setModalObj({type: 'about'})} />
          </MenuItem>
      </div>

      {/* 3. ZENTRIERTER TITEL */}
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

      {/* 4. RECHTER BEREICH */}
      <div className="ml-auto flex items-center h-full relative z-20 bg-slate-900 pl-4" style={{ WebkitAppRegion: 'no-drag' }}>      
         
         <BankSparklines data={data} />

         <MenuItem title={lang.toUpperCase()}>
          <MenuSubItem label="Deutsch" onClick={() => setLang('de')} rightText={lang === 'de' ? '✓' : ''} />
          <MenuSubItem label="English" onClick={() => setLang('en')} rightText={lang === 'en' ? '✓' : ''} />
          <MenuSubItem label="Français" onClick={() => setLang('fr')} rightText={lang === 'fr' ? '✓' : ''} />
          <MenuSubItem label="Italiano" onClick={() => setLang('it')} rightText={lang === 'it' ? '✓' : ''} />
        </MenuItem>

        <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 border-l border-slate-800/60 transition-all" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={t ? t('themeToggle') : 'Design umschalten'}>
          <Icon name={theme === 'light' ? "Moon" : "Sun"} size={15} />
        </div>

        {isStandalone && !isMac && (
          <div className="flex items-center border-l border-slate-800/60 h-full">
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all" onClick={() => handleWindowAction('minimize')} title={t ? t('titleMinimize') : 'Minimieren'}>
              <Icon name="Minus" size={15} />
            </div>
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all" onClick={() => handleWindowAction('maximize')} title={t ? t('titleMaximize') : 'Maximieren/Wiederherstellen'}>
              <Icon name="Square" size={13} />
            </div>
            <div className="px-3.5 h-full flex items-center cursor-pointer text-slate-400 hover:text-white hover:bg-red-500 transition-all" onClick={() => handleWindowAction('close')} title={t ? t('titleCloseWindow') : 'Schließen'}>
              <Icon name="X" size={15} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

module.exports = MenuBar;