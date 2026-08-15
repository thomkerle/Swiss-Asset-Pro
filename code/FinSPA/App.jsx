const React = require('react');
const { useState, useEffect } = React;

const getModule = (name, fallback) => {
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k === name || k.endsWith('/' + name) || k.endsWith(name));
    if (foundKey) {
      if (typeof window.require === 'function') {
        try { return window.require(foundKey); } catch (e) { console.error("Fehler beim Laden:", e); }
      }
      return window.__FinSPAModules[foundKey].exports;
    }
  }
  try { return typeof fallback === 'function' ? fallback() : fallback; } catch (e) { return {}; }
};

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const i18n = getModule('Translations.jsx', () => safeRequire('./internationalisation/Translations.jsx'));
const DataEngine = getModule('DataEngine.jsx', () => safeRequire('./data/DataEngine.jsx'));
const { initialData, generateId, getAllAssets, getAssetValueAtDate, getTotalWealthAtDate, generateMonthEnds, calcLinearRegression, calcExpRegression, formatCurrency, defaultBookingCategories, ensureDefaultAssetClasses } = DataEngine;
const MenuBar = getModule('MenuBar.jsx', () => safeRequire('./components/MenuBar.jsx'));
const TreeView = getModule('TreeView.jsx', () => safeRequire('./components/TreeView.jsx'));
const EditorArea = getModule('EditorArea.jsx', () => safeRequire('./components/EditorArea.jsx'));
const PropertyEditor = getModule('PropertyEditor.jsx', () => safeRequire('./components/PropertyEditor.jsx'));
const SettingsModal = getModule('SettingsModal.jsx', () => safeRequire('./components/SettingsModal.jsx'));
const HelpViewer = getModule('HelpViewer.jsx', () => safeRequire('./components/HelpViewer.jsx'));
const CsvEngine = getModule('CsvEngine.jsx', () => safeRequire('./components/CsvEngine.jsx'));
const ParqetModule = getModule('ParqetCsvImport.jsx', () => safeRequire('./components/ParqetCsvImport.jsx')) || {};
const Icon = getModule('Icons.jsx', () => safeRequire('./components/Icons.jsx'));
const PdfScanner = getModule('PdfScanner.jsx', () => safeRequire('./components/pdf/PdfScanner.jsx'));
const FormModal = getModule('FormModal.jsx', () => safeRequire('./components/FormModal.jsx'));
const FullPdfOrchestrator = getModule('FullPdfOrchestrator.jsx', () => safeRequire('./components/reports/FullPdfOrchestrator.jsx')) || (() => null);
const PdfExportEngine = getModule('PdfExportEngine.js', () => safeRequire('./components/print/PdfExportEngine.jsx'));
const CsvImportWizard = getModule('CsvImportWizard.jsx', () => safeRequire('./components/CsvImportWizard.jsx'));

window.PdfExportEngine = PdfExportEngine; 

const importParqetCSV = ParqetModule.importParqetCSV || ParqetModule;

// --- HYBRID ENVIRONMENT CHECK ---
const Env = {
    isCapacitor: () => typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform(),
    isWebView: () => typeof window !== 'undefined' && window.chrome && window.chrome.webview,
    isWeb: () => typeof window !== 'undefined' && !window.Capacitor?.isNativePlatform() && !(window.chrome && window.chrome.webview)
};

const FinBundleLogo = ({ className = "h-24 w-24" }) => (
  <svg viewBox="0 0 100 100" className={`overflow-visible ${className}`}>
    <circle cx="50" cy="50" r="44" stroke="#2563eb" strokeWidth="5" fill="none" className="logo-pulse-circle origin-center" />
    <path d="M 28 62 L 42 72 L 68 42" stroke="#10b981" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <path d="M 54 42 L 68 42 L 68 56" stroke="#10b981" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" className="logo-glow-path" />
    <rect x="36" y="32" width="7" height="7" rx="2" fill="#10b981" className="logo-float-rect1" />
    <rect x="52" y="22" width="7" height="7" rx="2" fill="#10b981" className="logo-float-rect2" />
  </svg>
);

const AboutDialog = ({ setModalObj, t }) => {
    const [activeTab, setActiveTab] = React.useState('about');

    const licenses = [
        { name: "React / React-DOM", license: "MIT" },
        { name: "Apache ECharts", license: "Apache 2.0" },
        { name: "Plotly.js", license: "MIT" },
        { name: "Chart.js", license: "MIT" },
        { name: "pdfmake", license: "MIT" },
        { name: "Tailwind CSS", license: "MIT" },
        { name: "crypto-js", license: "MIT" },
        { name: "exceljs", license: "MIT" },
        { name: "Capacitor", license: "MIT" }
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.15)] w-full max-w-lg border border-gray-200 dark:border-slate-700/60 overflow-hidden transform transition-all flex flex-col">

                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800/80 dark:to-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl shadow-inner border border-blue-200 dark:border-blue-800/50">
                            <Icon name="Shield" className="text-blue-600 dark:text-blue-400" size={18} />
                        </div>
                        <h3 className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
                            {t('helpAbout') || 'Über FinBundle'}
                        </h3>
                    </div>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 hover:rotate-90">
                        <Icon name="X" size={20}/>
                    </button>
                </div>

                {/* Logo Section */}
                <div className="relative pt-8 pb-5 flex justify-center bg-white dark:bg-slate-900">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 dark:bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>
                    <div className="relative p-5 bg-white dark:bg-slate-800/60 rounded-[2rem] shadow-xl border border-gray-100 dark:border-slate-700/50 backdrop-blur-md">
                        <FinBundleLogo className="h-20 w-20" />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-6 pt-2 mb-3 relative z-10">
                    {['about', 'licenses', 'legal'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-100' : 'text-gray-500 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 scale-95 hover:scale-100 border border-transparent dark:hover:border-slate-700'}`}>
                            {tab === 'about' ? (t('tabAbout') || 'Über') : tab === 'licenses' ? (t('tabLicenses') || 'Lizenzen') : (t('tabLegal') || 'Rechtliches')}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="px-6 pb-6 h-[260px] overflow-y-auto finspa-scrollbar relative z-10">
                    
                    {/* Ansicht: Über */}
                    {activeTab === 'about' && (
                        <div className="text-center space-y-4 mt-2 flex flex-col items-center h-full justify-center animate-fade-in">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">FinBundle <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-400">Pro</span></h2>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 py-1 px-4 rounded-full inline-block mt-3 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                    Version 1.0.0 RC1
                                </p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 px-4 leading-relaxed mt-2">
                                {t('aboutDesc') || 'Ganzheitliche Finanzplanung für moderne Nutzer. Optimiert für Desktop & Tablet mit einem konsequenten Privacy-First Ansatz.'}
                            </p>
                            <div className="pt-4 mt-auto w-full border-t border-gray-100 dark:border-slate-800/50 flex flex-col items-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">© {new Date().getFullYear()} {t('legalImprintTextName') || 'Thomas Kerle'}</p>
                            </div>
                        </div>
                    )}

                    {/* Ansicht: Lizenzen */}
                    {activeTab === 'licenses' && (
                        <div className="space-y-2 pr-1 animate-fade-in">
                            {licenses.map((lib, i) => (
                                <div key={i} className="flex justify-between items-center py-2.5 px-3 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent dark:hover:border-slate-700">
                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Icon name="Box" size={12} className="text-gray-400 dark:text-gray-500" />
                                        {lib.name}
                                    </span>
                                    <span className="text-[10px] bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md font-mono font-bold shadow-sm border border-gray-100 dark:border-slate-800">{lib.license}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ansicht: Rechtliches (Haftungsausschluss & Co.) */}
                    {activeTab === 'legal' && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-4 pr-2 text-justify animate-fade-in leading-relaxed">
                            
                            {/* General Disclaimer */}
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl shadow-sm">
                                <h4 className="font-bold text-amber-800 dark:text-amber-500 mb-1 flex items-center gap-2">
                                    <Icon name="AlertTriangle" size={14} /> {t('legalDisclaimerTitle') || 'Haftungsausschluss / Disclaimer'}
                                </h4>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                    {t('legalDisclaimerIntro') || 'Diese Software stellt explizit keine Finanzberatung dar...'}
                                </p>
                            </div>
                            
                            {/* Swiss & EU Law */}
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('legalSwissEuTitle') || 'Schweizerisches & Europäisches Recht'}</h4>
                                <p className="text-[11px]">
                                    {t('legalSwissEuText') || 'Die Nutzung von FinBundle Pro erfolgt ausschliesslich auf eigenes Risiko...'}
                                </p>
                            </div>

                            {/* US Law */}
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('legalUsComplianceTitle') || 'US Law Compliance'}</h4>
                                <p className="text-[10px] font-mono opacity-80 uppercase leading-tight bg-gray-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800">
                                    {t('legalUsComplianceText') || 'THE SOFTWARE IS PROVIDED "AS IS"...'}
                                </p>
                            </div>

                            {/* Data Privacy & APIs */}
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('legalDataPrivacyTitle') || 'Datenschutz & Externe APIs'}</h4>
                                <p className="text-[11px]">
                                    {t('legalDataPrivacyText1') || 'FinBundle Pro ist als lokale Anwendung konzipiert...'} <br/><br/>
                                    <strong>{t('legalLiveRatesNote') || 'Hinweis zu Live-Kursen:'}</strong> {t('legalDataPrivacyText2') || 'Um aktuelle Währungskurse...'}
                                </p>
                            </div>

                            {/* Market Data */}
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('legalMarketDataTitle') || 'Marktdaten & Quellen'}</h4>
                                <p className="text-[11px]">
                                    {t('legalMarketDataText') || 'Die bereitgestellten Markt- und Wechselkurse stammen von Drittanbietern...'}
                                </p>
                            </div>

                            {/* Imprint */}
                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('legalImprintTitle') || 'Impressum / Kontakt'}</h4>
                                <p className="text-[11px]">
                                    {t('legalImprintTextName') || 'Thomas Kerle'}<br/>
                                    {t('legalImprintTextStreet') || 'Schlossmatten 15'}<br/>
                                    {t('legalImprintTextCity') || '3150 Schwarzenburg'}<br/>
                                    {t('legalImprintTextCountry') || 'Schweiz'}<br/>
                                    {t('legalImprintTextEmail') || 'E-Mail: thomkerle@gmail.com'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const App = () => {
  const [fileHandle, setFileHandle] = useState(null);
  
  const [data, setData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const localData = localStorage.getItem('finbundle_pro_autosave') || localStorage.getItem('finspa_pro_autosave');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed && parsed.version) {
            return parsed;
          }
        }
      } catch (e) {
        console.error("[FinBundle] Autosave konnte nicht geladen werden:", e);
      }
    }
    return initialData;
  });

  const [lang, setLang] = useState('de');
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('vermoegen');
  const [activeReport, setActiveReport] = useState('allocation');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeVisible, setIsTreeVisible] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({'root': true, 'bank_ubs': true, 'cat_ubs_alltag': true, 'cat_ubs_immo': true, 'broker_ibkr': true});
  const [toasts, setToasts] = useState([]);
  
  const [lastAutoSave, setLastAutoSave] = useState(new Date());

  const [dateRange, setDateRange] = useState({ 
    from: `${new Date().getFullYear() - 1}-01-01`, 
    to: new Date().toISOString().split('T')[0] 
  });
  const [modalObj, setModalObj] = useState(null);

  const t = (key) => i18n[lang]?.[key] || i18n['de']?.[key] || key;
  
  const fCur = (val, cur = data.settings?.baseCurrency || 'CHF') => {
    if (val === null || val === undefined || isNaN(Number(val))) return val;
    return new Intl.NumberFormat(lang === 'de' ? 'de-CH' : 'en-CH', { 
      style: 'currency', 
      currency: cur,
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2  
    }).format(Number(val));
  };

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadScript = (url) => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) { resolve(); return; }
        
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Fehler: ${url}`));
        document.head.appendChild(script);
      });
    };

     const initializeCdns = async () => {
      try {
        if (!window.echarts) {
          const tempModule = window.module;
          const tempExports = window.exports;
          const tempDefine = window.define;
          window.module = undefined; window.exports = undefined; window.define = undefined;
          
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js');
          
          window.module = tempModule; window.exports = tempExports; window.define = tempDefine;
        }
        
        if (!window.pdfMake || typeof window.pdfMake.createPdf !== 'function') {
          if (window.pdfMake) window.pdfMake = undefined;

          const tempModule = window.module;
          const tempExports = window.exports;
          const tempDefine = window.define;
          window.module = undefined; window.exports = undefined; window.define = undefined;

          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');
          
          window.module = tempModule; window.exports = tempExports; window.define = tempDefine;
        }

        if (window.pdfMake && window.pdfMake.vfs) {
          window.pdfMake.fonts = {
            Roboto: {
              normal: 'Roboto-Regular.ttf',
              bold: 'Roboto-Medium.ttf',
              italics: 'Roboto-Italic.ttf',
              bolditalics: 'Roboto-MediumItalic.ttf' 
            }
          };
        }
      } catch (err) {
        console.error("[FinBundle Core] Fehler beim Laden der externen Kernbibliotheken:", err);
      }
    };

    initializeCdns();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const timer1 = setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
    const timer2 = setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 350);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isTreeVisible, activeReport, viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('finbundle_pro_autosave', JSON.stringify(data));
      setLastAutoSave(new Date());
    } catch (e) {
      console.error("[FinBundle] Fehler beim localStorage-Autosave:", e);
    }

    const writeToDisk = async () => {
      if (fileHandle && fileHandle.name && fileHandle.name.endsWith('.json')) {
        try {
          const opts = { mode: 'readwrite' };
          if ((await fileHandle.queryPermission(opts)) === 'granted' || (await fileHandle.requestPermission(opts)) === 'granted') {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            setLastAutoSave(new Date());
          }
        } catch (err) {
          console.error("[FinBundle] Direktes Dateisichern fehlgeschlagen:", err);
        }
      }
    };

    const timer = setTimeout(writeToDisk, 500);
    return () => clearTimeout(timer);
  }, [data, fileHandle]);

  const showToast = (message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, {id, message, type}]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // --- FIX: DRUCKEN WURDE FÜR APP-ISOLATION & VORSCHAU OPTIMIERT ---
  const handlePrint = () => {
      if (typeof window !== 'undefined') {
          // Versuchen wir das Print-Event direkt an den Host-Container weiterzugeben
          if (window.finspaHostAPI && typeof window.finspaHostAPI.send === 'function') {
              window.finspaHostAPI.send('window-control', 'print');
          } else if (window.chrome && window.chrome.webview) {
              window.chrome.webview.postMessage({ command: 'print' });
          } else {
              // Standard Browser-Print, wenn keine Host-API gefunden wurde
              window.print();
          }
      }
  };

  const handleExportPDF = () => {
      if (!activeReport) {
          showToast(t('msgNoActiveReport') || "Bitte öffnen Sie einen Report für den PDF-Export.", "error");
          return;
      }
      showToast(t('msgExportingPdf') || "PDF-Generierung gestartet...", "success");
      window.dispatchEvent(new CustomEvent('triggerPdfExport'));
  };

const handleNewProject = () => {
      if (window.confirm(t('msgNewProjectWarning') || 'Achtung: Alle nicht gespeicherten Änderungen gehen verloren. Neues Projekt starten?')) {
          setFileHandle(null);
          setData({
              version: "Version 1.0.0 RC1", lastModified: new Date().toISOString(), settings: data.settings, 
              banks: [], budget: { incomeSources: [], expenses: [], subscriptions: [] },
              goals: { fire: { target: 0, year: new Date().getFullYear() } }, scenarios: []          
          });
          // Hier ändern wir den State auf "allocation" und stellen sicher, dass der Modus "vermoegen" aktiv ist
          setSelectedNode(null); 
          setActiveReport('allocation'); 
          setViewMode('vermoegen'); 
          showToast(t('msgNewProjectSuccess') || 'Neues Projekt erstellt', "success");
      }
  };


  const handleOpenProject = async (e) => {
    if (typeof window.showOpenFilePicker === 'function' && (!e || !e.target || !e.target.files)) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'FinBundle Projekt', accept: { 'application/json': ['.json'], 'application/zip': ['.zip'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const isZip = file.name.endsWith('.zip');

        if (isZip) {
            const buffer = await file.arrayBuffer();
            setModalObj({
                type: 'pinPrompt',
                action: 'open',
                onConfirm: async (pin) => {
                    try {
                        if (typeof window.CryptoJS === 'undefined') throw new Error(t('msgCryptoNotLoaded') || "CryptoJS ist nicht geladen.");
                        if (typeof window.JSZip === 'undefined') throw new Error(t('msgZipNotLoaded') || "JSZip ist nicht geladen.");

                        const zip = await window.JSZip.loadAsync(buffer);
                        const encryptedData = await zip.file("project.data.enc").async("string");
                        const bytes = window.CryptoJS.AES.decrypt(encryptedData, pin);
                        const content = bytes.toString(window.CryptoJS.enc.Utf8);
                        
                        if (!content) throw new Error(t('msgWrongPin') || "Falscher PIN oder beschädigte Datei.");
                        
                        const imported = JSON.parse(content);
                        if (imported && imported.version) {
                            const safeBudget = {
                                incomeSources: imported.budget?.incomeSources || [],
                                expenses: imported.budget?.expenses || [],
                                subscriptions: imported.budget?.subscriptions || []
                            };
                            imported.budget = safeBudget;
                            setFileHandle(handle); 
                            setData(ensureDefaultAssetClasses(imported));
                            showToast(t('msgOpenSuccess') || "Erfolgreich geöffnet", "success");
                        }
                    } catch (err) {
                        showToast((t('msgOpenError') || "Fehler beim Öffnen: ") + err.message, "error");
                    }
                }
            });
            return;
        } else {
            const content = await file.text();
            const imported = JSON.parse(content);
            if (imported && imported.version) {
              const safeBudget = {
                  incomeSources: imported.budget?.incomeSources || [],
                  expenses: imported.budget?.expenses || [],
                  subscriptions: imported.budget?.subscriptions || []
              };
              imported.budget = safeBudget;
              setFileHandle(handle); 
              setData(imported);
              showToast(t('msgOpenSuccess') || "Erfolgreich geöffnet", "success");
            }
        }
      } catch (err) {
        if (err.name !== 'AbortError') showToast((t('msgOpenError') || "Fehler beim Öffnen: ") + err.message, "error");
      }
      return;
    }

    const file = e?.target?.files?.[0];
    if (!file) return;
    
    const isZip = file.name.endsWith('.zip');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        if (isZip) {
            setModalObj({
                type: 'pinPrompt',
                action: 'open',
                onConfirm: async (pin) => {
                    try {
                        if (typeof window.CryptoJS === 'undefined') throw new Error(t('msgCryptoNotLoaded') || "CryptoJS ist nicht geladen.");
                        if (typeof window.JSZip === 'undefined') throw new Error(t('msgZipNotLoaded') || "JSZip ist nicht geladen.");

                        const zip = await window.JSZip.loadAsync(event.target.result);
                        const encryptedData = await zip.file("project.data.enc").async("string");
                        const bytes = window.CryptoJS.AES.decrypt(encryptedData, pin);
                        const content = bytes.toString(window.CryptoJS.enc.Utf8);
                        
                        if (!content) throw new Error(t('msgWrongPin') || "Falscher PIN o. beschädigte Datei.");
                        
                        const imported = JSON.parse(content);
                        if (imported.version) {
                            const safeBudget = {
                                incomeSources: imported.budget?.incomeSources || [],
                                expenses: imported.budget?.expenses || [],
                                subscriptions: imported.budget?.subscriptions || []
                            };
                            imported.budget = safeBudget;
                            setFileHandle(null);
                            setData(imported);
                            showToast(t('msgOpenSuccess') || "Erfolgreich geöffnet", "success");
                        } else {
                            throw new Error(t('msgInvalidVersion') || "Ungültige Version.");
                        }
                    } catch (err) {
                        showToast((t('msgOpenError') || "Fehler beim Öffnen: ") + err.message, "error");
                    }
                }
            });
            return;
        } else {
            const content = event.target.result;
            const imported = JSON.parse(content);
            if (imported.version) {
              const safeBudget = {
                  incomeSources: imported.budget?.incomeSources || [],
                  expenses: imported.budget?.expenses || [],
                  subscriptions: imported.budget?.subscriptions || []
              };
              imported.budget = safeBudget;
              setFileHandle(null);
              setData(imported);
              showToast(t('msgOpenSuccess') || "Erfolgreich geöffnet", "success");
            } else {
                throw new Error(t('msgInvalidVersion') || "Ungültige Version.");
            }
        }
      } catch (err) { 
        showToast((t('msgError') || "Fehler: ") + err.message, "error"); 
      }
    };
    
    if (isZip) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file); 
    }
    
    if (e?.target) e.target.value = null; 
  };

  const handleSaveProject = async (saveAs = false) => {
    let isZip = false;
    if (!saveAs && fileHandle) {
        isZip = fileHandle.name.endsWith('.zip');
    } else {
        isZip = data.settings?.saveMethod === 'zip';
    }

    let targetHandle = saveAs ? null : fileHandle;

    if ((saveAs || !targetHandle) && window.showSaveFilePicker) {
        try {
            targetHandle = await window.showSaveFilePicker({
                suggestedName: targetHandle ? targetHandle.name : `FinBundle_Projekt_${new Date().toISOString().split('T')[0]}.${isZip ? 'zip' : 'json'}`,
                types: isZip
                    ? [{ description: 'FinBundle Verschlüsselt', accept: { 'application/zip': ['.zip'] } }]
                    : [{ description: 'FinBundle Projekt', accept: { 'application/json': ['.json'] } }]
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("[FinBundle Diagnose] FilePicker Fehler:", err);
                showToast((t('msgSaveError') || "Fehler beim Dateidialog: ") + err.message, "error");
            }
            return;
        }
    }

    const jsonStr = JSON.stringify(data, null, 2);

    const triggerBrowserDownload = (content, zipped) => {
        const blob = new Blob([content], { type: zipped ? "application/zip" : "application/json" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `FinBundle_Projekt_${new Date().toISOString().split('T')[0]}.${zipped ? 'zip' : 'json'}`;
        a.click();
        showToast(zipped ? (t('msgZipExportSuccess') || "Projekt verschlüsselt exportiert") : (t('msgSaveSuccess2') || "Projekt erfolgreich exportiert"), "success");
        setLastAutoSave(new Date());
    };

    const executeWrite = async (pin) => {
        try {
            let finalContent;
            if (isZip) {
                if (typeof window.CryptoJS === 'undefined') throw new Error(t('msgCryptoNotLoaded') || "CryptoJS ist nicht geladen.");
                if (typeof window.JSZip === 'undefined') throw new Error(t('msgZipNotLoaded') || "JSZip ist nicht geladen.");
                
                const encrypted = window.CryptoJS.AES.encrypt(jsonStr, pin).toString();
                const zip = new window.JSZip();
                zip.file("project.data.enc", encrypted);
                finalContent = await zip.generateAsync({ type: "uint8array" });
            } else {
                finalContent = jsonStr;
            }

            if (Env.isCapacitor()) {
                try {
                    const { Filesystem, Directory } = await import('@capacitor/filesystem');
                    const fileName = targetHandle ? targetHandle.name : `FinBundle_Projekt_${new Date().toISOString().split('T')[0]}.${isZip ? 'zip' : 'json'}`;
                    
                    let dataToWrite = finalContent;
                    if (isZip) {
                       const base64String = btoa(String.fromCharCode.apply(null, finalContent));
                       dataToWrite = base64String;
                    }

                    await Filesystem.writeFile({
                        path: fileName,
                        data: dataToWrite,
                        directory: Directory.Documents,
                        encoding: isZip ? undefined : 'utf8' 
                    });
                    
                    showToast(isZip ? "Projekt verschlüsselt auf Gerät gespeichert" : "Projekt auf Gerät gespeichert", "success");
                    setLastAutoSave(new Date());
                } catch (capErr) {
                    console.warn("Capacitor Filesystem nicht verfügbar. Nutze Fallback.", capErr);
                    triggerBrowserDownload(finalContent, isZip);
                }
            } 
            else if (targetHandle && window.showSaveFilePicker) {
                const opts = { mode: 'readwrite' };
                if ((await targetHandle.queryPermission(opts)) !== 'granted') {
                    if ((await targetHandle.requestPermission(opts)) !== 'granted') {
                        throw new Error(t('msgPermissionDenied') || "Keine Schreibberechtigung für die Datei.");
                    }
                }
                const writable = await targetHandle.createWritable();
                await writable.write(isZip ? finalContent : jsonStr);
                await writable.close();
                
                setFileHandle(targetHandle);
                showToast(isZip ? (t('msgZipExportSuccess') || "Projekt verschlüsselt gespeichert") : (t('msgSaveSuccess2') || "Projekt erfolgreich gespeichert"), "success");
                setLastAutoSave(new Date());
            } 
            else {
                triggerBrowserDownload(finalContent, isZip);
            }
        } catch (error) {
            console.error("[FinBundle Diagnose] Speicherfehler:", error);
            showToast((t('msgSaveError') || "Fehler beim Speichern: ") + error.message, "error");
        }
    };

    if (isZip) {
        setModalObj({
            type: 'pinPrompt',
            action: 'save',
            onConfirm: (pin) => {
                showToast(t('msgEncrypting') || "Verschlüsselung wird durchgeführt...", "success");
                executeWrite(pin);
            }
        });
    } else {
        executeWrite(null);
    }
  };

  const handleExportCSV = () => {
      try {
          const csvStr = CsvEngine.exportCSV(data);
          const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `FinBundle_Buchungen_${new Date().toISOString().split('T')[0]}.csv`;
          a.click(); showToast(t('msgCsvSuccess') || 'Export erfolgreich', "success");
       } catch (e) { showToast(t('msgCsvError') || 'Export Fehler', "error"); }
  };

  const handleImportParqetCSV = (e) => {
    const target = e.target;
    const file = target.files[0];
    if (!file) {
      console.warn("[FinBundle Diagnose] Keine Datei ausgewählt.");
      return;
    }

    if (typeof importParqetCSV !== 'function') {
      showToast(t('msgImportModuleError') || 'Import Modul Fehler', "error");
      target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target.result;
        if (!csvContent) {
          showToast(t('msgFileEmpty') || 'Datei leer', "error");
          target.value = null;
          return;
        }
        
        const importedBanks = importParqetCSV(csvContent);
        if (importedBanks && importedBanks.length > 0) {
          setData(prev => ({
            ...prev,
            lastModified: new Date().toISOString(),
            banks: [...prev.banks, ...importedBanks]
          }));
          showToast(t('msgParqetSuccess') || 'Import erfolgreich', "success");
        } else {
          showToast(t('msgNoValidAssets') || 'Keine Daten gefunden', "error");
        }
      } catch (err) {
        showToast(`${t('msgProcessErrorPrefix') || 'Fehler: '}${err.message}`, "error");
      }
      target.value = null;
    };
    reader.onerror = () => showToast(t('msgFileReadError') || 'Lese-Fehler', "error");
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportCSV = (e) => { e.target.value = null; alert(t('msgCsvNotSupported') || 'Noch nicht unterstützt'); };

  const updateTreeData = (newData) => setData(prev => ({ 
      ...prev, 
      lastModified: new Date().toISOString(), 
      ...newData 
  }));

  const handlePropChangeTree = (id, key, val) => {
      const updateRecursive = (nodes) => nodes.map(n => {
          if (n.id === id) return { ...n, [key]: val };
          if (n.children) return { ...n, children: updateRecursive(n.children) };
          return n;
      });
      updateTreeData({ banks: updateRecursive(data.banks) });
      if (selectedNode && selectedNode.id === id) setSelectedNode(prev => ({ ...prev, [key]: val }));
  };

  const toggleExpand = (id, e) => { e.stopPropagation(); setExpandedNodes(prev => ({...prev, [id]: !prev[id]})); };
  const requestDeleteNode = (node) => { setModalObj({ type: 'deleteNode', node }); };

  const actuallyDeleteNode = (nodeOrId) => {
       const idToDelete = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
       if (typeof nodeOrId === 'string' || nodeOrId.type) {
           const recursiveFilter = (nodes) => nodes.filter(n => n.id !== idToDelete).map(n => ({
             ...n, children: n.children ? recursiveFilter(n.children) : undefined
           }));
           updateTreeData({ banks: recursiveFilter(data.banks) });
       } else if (nodeOrId.budgetType) {
           const newBudget = { ...data.budget };
           ['incomeSources', 'expenses', 'subscriptions'].forEach(grp => { newBudget[grp] = newBudget[grp].filter(i => i.id !== idToDelete); });
           updateTreeData({ budget: newBudget });
       }
       if (selectedNode && selectedNode.id === idToDelete) setSelectedNode(null);
  };

  const syncExchangeRates = (currency, rate) => {
    const recursiveUpdate = (nodes) => nodes.map(n => {
      if (n.type === 'asset' && n.currency === currency) return { ...n, exchangeRate: rate };
      if (n.children) return { ...n, children: recursiveUpdate(n.children) };
      return n;
    });
    updateTreeData({ banks: recursiveUpdate(data.banks) }); showToast(t('msgRatesSynced') || 'Kurse synchronisiert', "success");
  };

  const ModalHandler = () => {
      if (!modalObj || typeof modalObj !== 'object' || !modalObj.type) return null;

      if (modalObj.type === 'pinPrompt') {
          return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                          <Icon name="Lock" className="text-blue-500" />
                          <h3 className="font-bold text-lg">
                              {modalObj.action === 'save' ? (t('titleZipEncrypt') || 'Projekt verschlüsseln') : (t('titleZipDecrypt') || 'Projekt entschlüsseln')}
                          </h3>
                      </div>
                      <div className="p-6">
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{t('labelEnterPin') || 'Bitte PIN eingeben:'}</p>
                          <input 
                              type="password" 
                              id="zip-pin-input"
                              autoFocus
                              className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" 
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') document.getElementById('btn-submit-pin').click();
                              }}
                          />
                      </div>
                      <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-2">
                          <button onClick={() => setModalObj(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors">
                              {t('btnCancel') || 'Abbrechen'}
                          </button>
                          <button 
                              id="btn-submit-pin"
                              onClick={() => {
                                  const pin = document.getElementById('zip-pin-input').value;
                                  if (pin) {
                                      setModalObj(null);
                                      modalObj.onConfirm(pin); 
                                  }
                              }} 
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">
                              {t('btnConfirm') || 'Bestätigen'}
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

      if (modalObj.type === 'pdfImport') {
          return <PdfScanner setModalObj={setModalObj} data={data} updateTreeData={updateTreeData} selectedNode={selectedNode} setSelectedNode={setSelectedNode} fCur={fCur} t={t} />;
      }

if (modalObj.type === 'csvImport') {
    return <CsvImportWizard data={data} updateTreeData={updateTreeData} setModalObj={setModalObj} showToast={showToast} t={t} />;
}

      if (modalObj.type === 'settings') {
          return <SettingsModal data={data} updateTreeData={updateTreeData} setModalObj={setModalObj} showToast={showToast} defaultBookingCategories={defaultBookingCategories} t={t} />;
      }
      
      if (modalObj.type === 'help') {
          return <HelpViewer setModalObj={setModalObj} lang={lang} />;
      }

      if (modalObj.type === 'about') {
          return <AboutDialog setModalObj={setModalObj} t={t} />;
      }

      if (modalObj.type === 'deleteNode') {
          const node = modalObj.node;
          return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                          <Icon name="Trash" className="text-red-500" />
                          <h3 className="font-bold text-lg">{t('deleteNodeTitle') || 'Löschen'}</h3>
                      </div>
                      <div className="p-6 text-sm text-gray-700 dark:text-gray-300">
                          <p>{t('deleteNodeConfirmPrefix') || 'Möchten Sie'} <strong>{node.name}</strong> {t('deleteNodeConfirmSuffix') || 'wirklich löschen?'}</p>
                      </div>
                      <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-col gap-2">
                          {!node.isArchived && !node.budgetType && (
                              <button onClick={() => { handlePropChangeTree(node.id, 'isArchived', true); setModalObj(null); showToast(t('msgArchived') || 'Archiviert', "success"); }} className="w-full py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-lg transition-colors">
                                  {t('btnArchiveOnly') || 'Archivieren'}
                              </button>
                          )}
                          <button onClick={() => { actuallyDeleteNode(node); setModalObj(null); showToast(t('msgDeletedPermanent') || 'Gelöscht', "success"); }} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">
                              {t('btnDeletePermanent') || 'Löschen'}
                          </button>
                          <button onClick={() => setModalObj(null)} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors">
                                  {t('btnCancel') || 'Abbrechen'}
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

      return <FormModal 
          data={data} 
          modalObj={modalObj} 
          setModalObj={setModalObj} 
          selectedNode={selectedNode} 
          setSelectedNode={setSelectedNode} 
          updateTreeData={updateTreeData} 
          t={t} 
          defaultBookingCategories={defaultBookingCategories} 
      />;
  };

  const baseCur = data?.settings?.baseCurrency || 'CHF';
  
  const flatAssets = typeof getAllAssets === 'function' ? getAllAssets(data?.banks || []) : [];
  const allAssetsCount = flatAssets.filter(a => !a.isArchived).length;
  const banksCount = data?.banks?.length || 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const totalWealth = flatAssets.reduce((sum, asset) => {
      if (asset.isArchived) return sum; 
      const val = typeof getAssetValueAtDate === 'function' ? getAssetValueAtDate(asset, todayStr, flatAssets) : 0;
      return sum + (Number(val) || 0);
  }, 0);

  const getMonthlyBudget = (item) => {
      const amt = Number(item.amount) || 0;
      const freq = String(item.frequency || 'monthly').toLowerCase();
      if (freq === 'yearly' || freq === 'jährlich') return amt / 12;
      if (freq === 'semi-annually' || freq === 'halbjährlich') return amt / 6;
      if (freq === 'quarterly' || freq === 'vierteljährlich') return amt / 3;
      return amt;
  };
  const budgetIn = data?.budget?.incomeSources?.reduce((s, i) => s + getMonthlyBudget(i), 0) || 0;
  const budgetOut = [...(data?.budget?.expenses || []), ...(data?.budget?.subscriptions || [])].reduce((s, i) => s + getMonthlyBudget(i), 0) || 0;
  const budgetNet = budgetIn - budgetOut;

  const lastModTime = lastAutoSave ? lastAutoSave.toLocaleTimeString(lang === 'de' ? 'de-CH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col font-sans bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <style>{`
        .finspa-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .dark .finspa-scrollbar {
          scrollbar-color: #475569 transparent;
        }
        .finspa-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .finspa-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .finspa-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .dark .finspa-scrollbar::-webkit-scrollbar-thumb {
          background-color: #475569;
        }
        .finspa-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
        .dark .finspa-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }

        @keyframes pulseCircle {
          0%, 100% { transform: scale(1); stroke: #2563eb; filter: drop-shadow(0 0 2px rgba(37,99,235,0.2)); }
          50% { transform: scale(1.03); stroke: #3b82f6; filter: drop-shadow(0 0 8px rgba(37,99,235,0.6)); }
        }
        @keyframes glowPath {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(16,185,129,0.3)); stroke: #10b981; }
          50% { filter: drop-shadow(0 0 8px rgba(16,185,129,0.8)); stroke: #34d399; }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .logo-pulse-circle { animation: pulseCircle 3s ease-in-out infinite; }
        .logo-glow-path { animation: glowPath 2.5s ease-in-out infinite; }
        .logo-float-rect1 { animation: float1 4s ease-in-out infinite; }
        .logo-float-rect2 { animation: float2 3.5s ease-in-out infinite; animation-delay: 0.5s; }

        /* --- FIX: GLOBALE PRINT STYLES FÜR DEN DRUCK-DIALOG --- */
        @media print {
          @page { margin: 1cm; }
          body, html, #app-container, #app-container > div, #printable-editor {
            height: auto !important;
            min-height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            background: white !important;
          }
          /* Rigoroses Ausblenden alles unerwünschten */
          .print-hide, .print-hide * {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      <MenuBar 
        data={data} 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        setActiveReport={setActiveReport} 
        setSelectedNode={setSelectedNode} 
        theme={theme} 
        setTheme={setTheme} 
        lang={lang} 
        setLang={setLang} 
        setModalObj={setModalObj} 
        t={t} 
        handleNewProject={handleNewProject} 
        handleOpenProject={handleOpenProject} 
        handleSaveProject={handleSaveProject} 
        handleExportCSV={handleExportCSV} 
        handleImportCSV={handleImportCSV} 
        handleImportParqetCSV={handleImportParqetCSV} 
        handlePrint={handlePrint} 
        handleExportPDF={handleExportPDF} 
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        <TreeView 
            data={data} 
            viewMode={viewMode} 
            selectedNode={selectedNode} 
            setSelectedNode={setSelectedNode} 
            setActiveReport={setActiveReport} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
            showArchived={showArchived} 
            setShowArchived={setShowArchived} 
            expandedNodes={expandedNodes} 
            toggleExpand={toggleExpand} 
            deleteNode={requestDeleteNode} 
            setModalObj={setModalObj} 
            updateTreeData={updateTreeData}
            t={t} 
        />

        <div className="flex-1 relative overflow-auto" id="printable-editor">
          <EditorArea 
            data={data} 
            viewMode={viewMode} 
            activeReport={activeReport} 
            selectedNode={selectedNode} 
            setSelectedNode={setSelectedNode} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
            showArchived={showArchived} 
            dateRange={dateRange} 
            setDateRange={setDateRange} 
            setModalObj={setModalObj} 
            updateTreeData={updateTreeData} 
            fCur={fCur} 
            t={t} 
            showToast={showToast} 
          />
        </div>

        {!activeReport && selectedNode && viewMode !== 'liveEditor' && (
          <PropertyEditor 
              data={data} 
              activeReport={activeReport} 
              selectedNode={selectedNode} 
              setSelectedNode={setSelectedNode} 
              updateTreeData={updateTreeData} 
              syncExchangeRates={syncExchangeRates} 
              t={t} 
          />
        )}
      </div>

      <div className="print-hide flex justify-between items-center bg-gray-100 dark:bg-slate-900 border-t border-gray-300 dark:border-slate-800 px-4 py-1.5 text-[11px] md:text-xs text-gray-600 dark:text-gray-400 z-50 select-none">
          <div className="flex items-center gap-4 md:gap-6">
              <span className="flex items-center gap-1.5" title={t('titleReadySaveActive') || "System ist bereit & Auto-Save aktiv"}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {t('statusReady') || 'Bereit'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1" title={t('titleLastSaveTime') || "Uhrzeit des letzten Auto-Saves"}>
                  <Icon name="Save" size={10} className="opacity-70" /> {lastModTime}
              </span>
              <span className="hidden md:inline">
                  {t('statusBarMode') || 'Modus'}: <strong className="uppercase">{t(viewMode) || viewMode}</strong>
              </span>
          </div>

          <div className="hidden lg:flex items-center gap-4 opacity-80">
              <span className="flex items-center gap-1" title={t('titleBankCatCount') || "Anzahl Banken / Hauptkategorien"}><Icon name="Shield" size={10} /> {banksCount}</span>
              <span className="flex items-center gap-1" title={t('titleAssetCount') || "Anzahl verwalteter Assets"}><Icon name="PieChart" size={10} /> {allAssetsCount} Assets</span>
              <span className="flex items-center gap-1" title={t('titleBaseCurrency') || "Basiswährung der Anwendung"}><Icon name="Globe" size={10} /> {baseCur}</span>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
              {viewMode === 'vermoegen' && (
                  <span className="flex items-center gap-2 bg-gray-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200" title={`${t('titleNetWealth') || "Aktuelles Nettovermögen in"} ${baseCur}`}>
                      <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 mt-0.5">{t('labelTotalShort') || 'Total'}</span>
                      <strong className="font-mono tracking-tight text-sm">{fCur ? fCur(totalWealth, baseCur) : totalWealth}</strong>
                  </span>
              )}
              {viewMode === 'budget' && (
                  <span className={`flex items-center gap-2 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200 ${budgetNet >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`} title={`${t('titleNetCashflow') || "Monatlicher Net Cashflow in"} ${baseCur}`}>
                      <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 mt-0.5">{t('labelCashflow') || 'Cashflow'}</span>
                      <strong className={`font-mono tracking-tight text-sm ${budgetNet >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                          {budgetNet >= 0 ? '+' : ''}{fCur ? fCur(budgetNet, baseCur) : budgetNet}
                      </strong>
                  </span>
              )}
              <span className="opacity-70">{t('version') || 'Version'}: 1.0.0 RC1</span>
          </div>
      </div>

     
      <FullPdfOrchestrator 
          data={data} 
          activeAssets={showArchived ? flatAssets : flatAssets.filter(a => !a?.isArchived)}
          dateRange={dateRange} 
          fCur={fCur} 
          t={t} 
      />
      
      {ModalHandler()}
      
      <div className="fixed bottom-4 right-4 z-[200] space-y-2 pointer-events-none">
          {toasts.map(toast => (
              <div key={toast.id} className="px-4 py-3 rounded-lg shadow-xl border bg-slate-800 text-white border-slate-700">
                  {toast.message}
              </div>
          ))}
      </div>
    </div>
  );
};

module.exports = App;