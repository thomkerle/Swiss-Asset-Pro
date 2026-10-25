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

// Stellt sicher, dass PdfToolkit.jsx Vorrang vor einer älteren PdfExportEngine hat
const PdfToolkitModule = getModule('PdfToolkit.jsx', () => safeRequire('./components/print/PdfToolkit.jsx'));
const PdfExportEngineModule = getModule('PdfExportEngine.js', () => safeRequire('./components/print/PdfExportEngine.jsx'));
const PdfExportEngine = (PdfToolkitModule && typeof PdfToolkitModule.exportReport === 'function') ? PdfToolkitModule : PdfExportEngineModule;
const CsvImportWizard = getModule('CsvImportWizard.jsx', () => safeRequire('./components/CsvImportWizard.jsx'));

if (typeof window !== 'undefined') {
  window.PdfToolkit = PdfExportEngine;
  window.PdfExportEngine = PdfExportEngine;
}

const importParqetCSV = ParqetModule.importParqetCSV || ParqetModule;

// --- HYBRID ENVIRONMENT & ANDROID CHECK ---
const Env = {
    isCapacitor: () => typeof window !== 'undefined' && Boolean(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.Plugins)),
    isAndroid: () => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        const capAndroid = window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'android';
        const urlForce = new URLSearchParams(window.location.search).get('android') === 'true';
        return /android/i.test(ua) || Boolean(capAndroid) || urlForce;
    },
    isWebView: () => typeof window !== 'undefined' && Boolean(window.chrome && window.chrome.webview),
    isElectron: () => typeof window !== 'undefined' && Boolean(window.finspaHostAPI || (window.navigator && window.navigator.userAgent.includes('Electron'))),
    isWeb: () => typeof window !== 'undefined' && !window.Capacitor?.isNativePlatform?.() && !(window.chrome && window.chrome.webview)
};

// --- GLOBALE DATEI-EXPORT & SHARE ENGINE FÜR ANDROID, CAPACITOR & DESKTOP ---
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const res = String(reader.result || '');
        resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

// Zeigt auf Android ein direktes Touch-Modal, damit navigator.share() / Öffnen garantiert einen frischen User-Gesture-Token hat
const showAndroidExportModal = (blob, fileName, mimeType, savedUri = null) => {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('finbundle-android-export-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'finbundle-android-export-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff;color:#0f172a;border-radius:20px;max-width:400px;width:100%;padding:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);text-align:center;';

    const curLang = (typeof window !== 'undefined' && window.__finbundleLang) || 'de';
    const tr = (k, fb) => i18n?.[curLang]?.[k] || i18n?.['de']?.[k] || fb;
    card.innerHTML = `
        <div style="width:52px;height:52px;border-radius:14px;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;margin:0 auto 14px auto;font-size:24px;font-weight:bold;">📄</div>
        <h3 style="margin:0 0 6px 0;font-size:18px;font-weight:800;color:#0f172a;">${tr('androidFileReady', 'Datei bereit!')}</h3>
        <p style="margin:0 0 16px 0;font-size:12px;color:#64748b;word-break:break-all;font-family:monospace;background:#f1f5f9;padding:8px;border-radius:8px;">${fileName}</p>
        ${savedUri ? `<p style="margin:0 0 16px 0;font-size:11px;color:#10b981;font-weight:700;">${tr('androidPreparedOnDevice', '✓ Auf Gerät vorbereitet')}</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="fb-btn-share-now" style="width:100%;padding:14px;border:none;border-radius:12px;background:#2563eb;color:white;font-weight:700;font-size:14px;cursor:pointer;">
                ${tr('androidShareOrOpen', '📤 Jetzt Teilen / Mit App öffnen')}
            </button>
            <button id="fb-btn-close-modal" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:12px;background:transparent;color:#475569;font-weight:700;font-size:13px;cursor:pointer;">
                ${tr('btnClose', 'Schließen')}
            </button>
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('fb-btn-close-modal').onclick = () => overlay.remove();
    document.getElementById('fb-btn-share-now').onclick = async () => {
        try {
            const capShare = window.Capacitor?.Plugins?.Share;
            if (capShare && typeof capShare.share === 'function' && savedUri) {
                await capShare.share({ title: fileName, url: savedUri, dialogTitle: fileName });
                overlay.remove();
                return;
            }
            if (navigator.share) {
                const file = new File([blob], fileName, { type: mimeType });
                if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                    await navigator.share({ title: fileName, files: [file] });
                    overlay.remove();
                    return;
                }
            }
            const base64Data = await blobToBase64(blob);
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            overlay.remove();
        } catch (err) {
            if (err?.name !== 'AbortError') {
                alert(tr('androidOpenNotice', 'Hinweis beim Öffnen: ') + (err?.message || err));
            }
        }
    };
};

if (typeof window !== 'undefined') {
    window.finbundleSaveOrShare = async (blobOrData, fileName, mimeType = 'application/pdf') => {
        const blob = blobOrData instanceof Blob ? blobOrData : new Blob([blobOrData], { type: mimeType });
        let savedUri = null;

        if (Env.isCapacitor() || Env.isAndroid()) {
            try {
                let Filesystem = window.Capacitor?.Plugins?.Filesystem;
                if (!Filesystem) {
                    try {
                        const mod = await import('@capacitor/filesystem');
                        Filesystem = mod.Filesystem;
                    } catch (e) {}
                }

                if (Filesystem && typeof Filesystem.writeFile === 'function') {
                    const base64Data = await blobToBase64(blob);
                    try {
                        const res = await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: 'DOCUMENTS'
                        });
                        savedUri = res?.uri || null;
                    } catch (docErr) {
                        const resCache = await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: 'CACHE'
                        });
                        savedUri = resCache?.uri || null;
                    }

                    let Share = window.Capacitor?.Plugins?.Share;
                    if (!Share) {
                        try {
                            const sMod = await import('@capacitor/share');
                            Share = sMod.Share;
                        } catch (e) {}
                    }
                    if (Share && typeof Share.share === 'function' && savedUri) {
                        await Share.share({ title: fileName, url: savedUri, dialogTitle: fileName });
                        return true;
                    }
                }
            } catch (capErr) {
                console.warn('[FinBundle Android Export] Capacitor Plugin Fehler:', capErr);
            }
        }

        if (Env.isAndroid()) {
            try {
                if (navigator.share && navigator.canShare) {
                    const file = new File([blob], fileName, { type: mimeType });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: fileName, files: [file] });
                        return true;
                    }
                }
            } catch (shareErr) {
                if (shareErr && shareErr.name === 'AbortError') return false;
                console.warn('[FinBundle Android] Direktes Share blockiert, öffne Touch-Dialog:', shareErr);
            }

            showAndroidExportModal(blob, fileName, mimeType, savedUri);
            return true;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return true;
    };
}

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
        { name: "chartjs-adapter-date-fns", license: "MIT" },
        { name: "html2canvas", license: "MIT" },
        { name: "pdfmake", license: "MIT" },
        { name: "Tailwind CSS", license: "MIT" },
        { name: "crypto-js", license: "MIT" },
        { name: "exceljs", license: "MIT" },
        { name: "Capacitor", license: "MIT" }
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-3 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_0_50px_rgba(37,99,235,0.15)] w-full max-w-md border border-gray-200 dark:border-slate-700/60 overflow-hidden transform transition-all flex flex-col">

                <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800/80 dark:to-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg shadow-inner border border-blue-200 dark:border-blue-800/50">
                            <Icon name="Shield" className="text-blue-600 dark:text-blue-400" size={16} />
                        </div>
                        <h3 className="font-black text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
                            {t('helpAbout') || 'Über FinBundle'}
                        </h3>
                    </div>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                        <Icon name="X" size={18}/>
                    </button>
                </div>

                <div className="relative pt-4 pb-3 flex justify-center bg-white dark:bg-slate-900">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 bg-blue-500/10 dark:bg-emerald-500/10 blur-2xl rounded-full pointer-events-none"></div>
                    <div className="relative p-3.5 bg-white dark:bg-slate-800/60 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700/50 backdrop-blur-md">
                        <FinBundleLogo className="h-14 w-14" />
                    </div>
                </div>

                <div className="flex gap-1.5 px-4 pt-1 mb-2 relative z-10">
                    {['about', 'licenses', 'legal'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === tab ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent dark:hover:border-slate-700'}`}>
                            {tab === 'about' ? (t('tabAbout') || 'Über') : tab === 'licenses' ? (t('tabLicenses') || 'Lizenzen') : (t('tabLegal') || 'Rechtliches')}
                        </button>
                    ))}
                </div>

                <div className="px-4 pb-4 h-[230px] overflow-y-auto finspa-scrollbar relative z-10">
                    {activeTab === 'about' && (
                        <div className="text-center space-y-3 mt-1 flex flex-col items-center h-full justify-center animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">FinBundle <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-400">Pro</span></h2>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 py-0.5 px-3 rounded-full inline-block mt-2 border border-emerald-100 dark:border-emerald-800/50 shadow-xs">
                                    Version 1.0.0 RC4
                                </p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 px-3 leading-relaxed">
                                {t('aboutDesc') || 'Ganzheitliche Finanzplanung für moderne Nutzer. Optimiert für Desktop, Tablet & Android mit einem konsequenten Privacy-First Ansatz.'}
                            </p>
                            <div className="pt-3 mt-auto w-full border-t border-gray-100 dark:border-slate-800/50 flex flex-col items-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">© {new Date().getFullYear()} {t('legalImprintTextName') || 'Thomas Kerle'}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'licenses' && (
                        <div className="space-y-1.5 pr-1 animate-fade-in">
                            {licenses.map((lib, i) => (
                                <div key={i} className="flex justify-between items-center py-2 px-2.5 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent dark:hover:border-slate-700">
                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Icon name="Box" size={11} className="text-gray-400 dark:text-gray-500" />
                                        {lib.name}
                                    </span>
                                    <span className="text-[10px] bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-mono font-bold shadow-xs border border-gray-100 dark:border-slate-800">{lib.license}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'legal' && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-3 pr-2 text-justify animate-fade-in leading-relaxed">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg shadow-xs">
                                <h4 className="font-bold text-amber-800 dark:text-amber-500 mb-1 flex items-center gap-1.5">
                                    <Icon name="AlertTriangle" size={13} /> {t('legalDisclaimerTitle') || 'Haftungsausschluss / Disclaimer'}
                                </h4>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                    {t('legalDisclaimerIntro') || 'Diese Software stellt explizit keine Finanzberatung dar...'}
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('legalSwissEuTitle') || 'Schweizerisches & Europäisches Recht'}</h4>
                                <p className="text-[11px]">
                                    {t('legalSwissEuText') || 'Die Nutzung von FinBundle Pro erfolgt ausschliesslich auf eigenes Risiko...'}
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('legalUsComplianceTitle') || 'US Law Compliance'}</h4>
                                <p className="text-[10px] font-mono opacity-80 uppercase leading-tight bg-gray-50 dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-800">
                                    {t('legalUsComplianceText') || 'THE SOFTWARE IS PROVIDED "AS IS"...'}
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('legalDataPrivacyTitle') || 'Datenschutz & Externe APIs'}</h4>
                                <p className="text-[11px]">
                                    {t('legalDataPrivacyText1') || 'FinBundle Pro ist als lokale Anwendung konzipiert...'} <br/><br/>
                                    <strong>{t('legalLiveRatesNote') || 'Hinweis zu Live-Kursen:'}</strong> {t('legalDataPrivacyText2') || 'Um aktuelle Währungskurse...'}
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('legalMarketDataTitle') || 'Marktdaten & Quellen'}</h4>
                                <p className="text-[11px]">
                                    {t('legalMarketDataText') || 'Die bereitgestellten Markt- und Wechselkurse stammen von Drittanbietern...'}
                                </p>
                            </div>
                            <div className="pt-3 border-t border-gray-200 dark:border-slate-800/50">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('legalImprintTitle') || 'Impressum / Kontakt'}</h4>
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

  // --- RESPONSIVE & ANDROID RUNTIME DETECTION ---
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Env.isAndroid() || window.innerWidth < 768;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileReportsOpen, setIsMobileReportsOpen] = useState(false);
  const [isMobilePropsOpen, setIsMobilePropsOpen] = useState(false);
  const [mobileMenuSection, setMobileMenuSection] = useState('main'); // 'main', 'file', 'reports', 'plugins'

  const [lang, setLang] = useState(() => data?.settings?.language || 'de');
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('vermoegen');
  const [activeReport, setActiveReport] = useState('allocation');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeVisible, setIsTreeVisible] = useState(() => {
    if (typeof window !== 'undefined' && (Env.isAndroid() || window.innerWidth < 768)) {
      return false; // Auf Android standardmäßig eingeklappt für freien Blick aufs Dashboard
    }
    return true;
  });
  const [showArchived, setShowArchived] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({'root': true, 'bank_ubs': true, 'cat_ubs_alltag': true, 'cat_ubs_immo': true, 'broker_ibkr': true});
  const [toasts, setToasts] = useState([]);
  
  const [lastAutoSave, setLastAutoSave] = useState(new Date());

  const [dateRange, setDateRange] = useState({ 
    from: `${new Date().getFullYear() - 1}-01-01`, 
    to: new Date().toISOString().split('T')[0] 
  });
  const [modalObj, setModalObj] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const mobileDetected = Env.isAndroid() || window.innerWidth < 768;
      setIsMobile(prev => {
        if (!prev && mobileDetected) {
          setIsTreeVisible(false);
        } else if (prev && !mobileDetected) {
          setIsTreeVisible(true);
          setIsMobileMenuOpen(false);
          setIsMobileReportsOpen(false);
          setIsMobilePropsOpen(false);
        }
        return mobileDetected;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    if (isMobile && node) {
      setIsTreeVisible(false);
      if (node.selectedBooking) {
        setIsMobilePropsOpen(true);
      }
    }
  };

  const handleSelectReport = (rep) => {
    setActiveReport(rep);
    if (isMobile && rep) {
      setIsTreeVisible(false);
      setIsMobileReportsOpen(false);
      setIsMobileMenuOpen(false);
    }
  };

  const handleSetLang = (newLang) => {
    setLang(newLang);
    setData(prev => ({
      ...prev,
      lastModified: new Date().toISOString(),
      settings: {
        ...(prev.settings || {}),
        language: newLang
      }
    }));
  };

  if (typeof window !== 'undefined') window.__finbundleLang = lang;
  const t = (key) => i18n[lang]?.[key] || i18n['de']?.[key] || key;
  const safeT = (key, fallback) => {
    const res = t(key);
    return (res && res !== key) ? res : fallback;
  };
  
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

          if (!window.pdfMake.__finbundleAndroidPatched) {
            const origCreatePdf = window.pdfMake.createPdf.bind(window.pdfMake);
            window.pdfMake.createPdf = function(...args) {
              const pdfInstance = origCreatePdf(...args);
              const origDownload = pdfInstance.download.bind(pdfInstance);
              pdfInstance.download = function(defaultFileName = 'FinBundle_Export.pdf', cb, options) {
                if (Env.isAndroid() && typeof window.finbundleSaveOrShare === 'function' && typeof pdfInstance.getBlob === 'function') {
                  pdfInstance.getBlob(async (blob) => {
                    const finalName = String(defaultFileName).endsWith('.pdf') ? defaultFileName : `${defaultFileName}.pdf`;
                    await window.finbundleSaveOrShare(blob, finalName, 'application/pdf');
                    if (typeof cb === 'function') cb();
                  }, options);
                } else {
                  origDownload(defaultFileName, cb, options);
                }
              };
              return pdfInstance;
            };
            window.pdfMake.__finbundleAndroidPatched = true;
          }
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
  }, [isTreeVisible, activeReport, viewMode, isMobile]);

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

  useEffect(() => {
      if (typeof window !== 'undefined') {
          window.showToast = showToast;
      }
  }, []);

  const handlePrint = () => {
      if (typeof window !== 'undefined') {
          if (Env.isAndroid()) {
              handleExportPDF();
          } else if (window.finspaHostAPI && typeof window.finspaHostAPI.send === 'function') {
              window.finspaHostAPI.send('window-control', 'print');
          } else if (window.chrome && window.chrome.webview) {
              window.chrome.webview.postMessage({ command: 'print' });
          } else {
              window.print();
          }
      }
  };

  const handleExportPDF = () => {
      if (!activeReport && selectedNode && selectedNode.type === 'asset') {
          const allIds = [
              ...(selectedNode.balances || []).map(b => b.id),
              ...(selectedNode.bookings || []).map(b => b.id)
          ];
          setModalObj({ type: 'printAssetBookings', assetId: selectedNode.id, filteredIds: allIds });
          return;
      }
      if (viewMode === 'plugin') {
          const iframe = document.getElementById('active-plugin-iframe');
          if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'TRIGGER_PLUGIN_PDF' }, '*');
              showToast(t('msgExportingPdf') || "PDF-Generierung gestartet...", "success");
              return;
          }
      }
      if (!activeReport) {
          showToast(t('msgExportingPdf') || "PDF-Generierung gestartet...", "success");
          window.dispatchEvent(new CustomEvent('triggerPdfExport'));
          return;
      }
      showToast(t('msgExportingPdf') || "PDF-Generierung gestartet...", "success");
      window.dispatchEvent(new CustomEvent('triggerPdfExport'));
  };

  const handleExportExcel = async () => {
      try {
          showToast(safeT('msgExportingExcel', "Excel-Export gestartet..."), "info");
          let ExcelExportEngine;
          if (typeof window !== 'undefined' && window.__FinSPAModules) {
              const keys = Object.keys(window.__FinSPAModules);
              const foundKey = keys.find(k => k.endsWith('ExcelExportEngine.jsx'));
              if (foundKey && typeof window.require === 'function') ExcelExportEngine = window.require(foundKey);
          }
          if (!ExcelExportEngine) {
              try { ExcelExportEngine = safeRequire('./components/print/ExcelExportEngine.jsx'); } 
              catch(err) { ExcelExportEngine = safeRequire('./print/ExcelExportEngine.jsx'); }
          }
          if (!ExcelExportEngine || typeof ExcelExportEngine.exportPortfolio !== 'function') {
              throw new Error(safeT('errExcelEngineMissing', "ExcelExportEngine.jsx konnte nicht gefunden oder geladen werden."));
          }
          const blob = await ExcelExportEngine.exportPortfolio(data, DataEngine, t);
          const fileName = `FinBundle_Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`;
          if (typeof window !== 'undefined' && typeof window.finbundleSaveOrShare === 'function') {
              await window.finbundleSaveOrShare(blob, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          }
          showToast(safeT('msgExportExcelSuccess', "Excel-Export erfolgreich!"), "success");
      } catch (err) {
          console.error("[FinBundle] Excel Export Error:", err);
          showToast(safeT('msgExportExcelError', "Fehler beim Excel-Export: ") + err.message, "error");
      }
  };

  const handleNewProject = () => {
      if (window.confirm(t('msgNewProjectWarning') || 'Achtung: Alle nicht gespeicherten Änderungen gehen verloren. Neues Projekt starten?')) {
          setFileHandle(null);
          setData({
              version: "Version 1.0.0 RC4", lastModified: new Date().toISOString(), settings: data.settings, 
              banks: [], budget: { incomeSources: [], expenses: [], subscriptions: [] },
              goals: { fire: { target: 0, year: new Date().getFullYear() } }, scenarios: []          
          });
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
          types: [{ description: safeT('fileDescProject', 'FinBundle Projekt'), accept: { 'application/json': ['.json'], 'application/zip': ['.zip'] } }],
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
                            if (imported.settings?.language) setLang(imported.settings.language);
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
              if (imported.settings?.language) setLang(imported.settings.language);
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
                            if (imported.settings?.language) setLang(imported.settings.language);
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
              if (imported.settings?.language) setLang(imported.settings.language);
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

    if ((saveAs || !targetHandle) && window.showSaveFilePicker && !Env.isAndroid()) {
        try {
            targetHandle = await window.showSaveFilePicker({
                suggestedName: targetHandle ? targetHandle.name : `FinBundle_Projekt_${new Date().toISOString().split('T')[0]}.${isZip ? 'zip' : 'json'}`,
                types: isZip
                    ? [{ description: safeT('fileDescEncrypted', 'FinBundle Verschlüsselt'), accept: { 'application/zip': ['.zip'] } }]
                    : [{ description: safeT('fileDescProject', 'FinBundle Projekt'), accept: { 'application/json': ['.json'] } }]
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

    const triggerBrowserDownload = async (content, zipped) => {
        const mime = zipped ? "application/zip" : "application/json";
        const fileName = `FinBundle_Projekt_${new Date().toISOString().split('T')[0]}.${zipped ? 'zip' : 'json'}`;
        const blob = new Blob([content], { type: mime });
        if (typeof window !== 'undefined' && typeof window.finbundleSaveOrShare === 'function') {
            await window.finbundleSaveOrShare(blob, fileName, mime);
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        }
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

            if (Env.isCapacitor() || Env.isAndroid()) {
                await triggerBrowserDownload(finalContent, isZip);
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
                await triggerBrowserDownload(finalContent, isZip);
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

  const handleExportCSV = async () => {
      try {
          const csvStr = CsvEngine.exportCSV(data);
          const fileName = `FinBundle_Buchungen_${new Date().toISOString().split('T')[0]}.csv`;
          const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
          if (typeof window !== 'undefined' && typeof window.finbundleSaveOrShare === 'function') {
              await window.finbundleSaveOrShare(blob, fileName, "text/csv;charset=utf-8;");
          } else {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = fileName;
              a.click();
          }
          showToast(t('msgCsvSuccess') || 'Export erfolgreich', "success");
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
                      <div className="p-3.5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                          <Icon name="Lock" className="text-blue-500" />
                          <h3 className="font-bold text-base">
                              {modalObj.action === 'save' ? (t('titleZipEncrypt') || 'Projekt verschlüsseln') : (t('titleZipDecrypt') || 'Projekt entschlüsseln')}
                          </h3>
                      </div>
                      <div className="p-5">
                          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2.5">{t('labelEnterPin') || 'Bitte PIN eingeben:'}</p>
                          <input 
                              type="password" 
                              id="zip-pin-input"
                              autoFocus
                              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-sm" 
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') document.getElementById('btn-submit-pin').click();
                              }}
                          />
                      </div>
                      <div className="p-3.5 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-2">
                          <button onClick={() => setModalObj(null)} className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors text-xs">
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
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-xs">
                              {t('btnConfirm') || 'Bestätigen'}
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

      if (modalObj.type === 'pdfImport') {
          return <PdfScanner setModalObj={setModalObj} data={data} updateTreeData={updateTreeData} selectedNode={selectedNode} setSelectedNode={handleSelectNode} fCur={fCur} t={t} />;
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
                      <div className="p-3.5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                          <Icon name="Trash" className="text-red-500" />
                          <h3 className="font-bold text-base">{t('deleteNodeTitle') || 'Löschen'}</h3>
                      </div>
                      <div className="p-5 text-xs text-gray-700 dark:text-gray-300">
                          <p>{t('deleteNodeConfirmPrefix') || 'Möchten Sie'} <strong>{node.name}</strong> {t('deleteNodeConfirmSuffix') || 'wirklich löschen?'}</p>
                      </div>
                      <div className="p-3.5 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-col gap-1.5">
                          {!node.isArchived && !node.budgetType && (
                              <button onClick={() => { handlePropChangeTree(node.id, 'isArchived', true); setModalObj(null); showToast(t('msgArchived') || 'Archiviert', "success"); }} className="w-full py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-lg transition-colors text-xs">
                                  {t('btnArchiveOnly') || 'Archivieren'}
                              </button>
                          )}
                          <button onClick={() => { actuallyDeleteNode(node); setModalObj(null); showToast(t('msgDeletedPermanent') || 'Gelöscht', "success"); }} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-xs">
                              {t('btnDeletePermanent') || 'Löschen'}
                          </button>
                          <button onClick={() => setModalObj(null)} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors text-xs">
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
          setSelectedNode={handleSelectNode} 
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

  const reportCategories = [
    {
      title: safeT('menuHeaderStockReports', 'Bestandesreports'),
      items: [
        { id: 'overview', label: safeT('repOverview', 'Banken & Kategorien'), icon: 'List' },
        { id: 'allocation', label: safeT('repAlloc', 'Allokation nach Banken'), icon: 'PieChart' },
        { id: 'liquidity', label: safeT('repLiq', 'Liquiditätsrisiko'), icon: 'Droplet' },
        { id: 'history', label: safeT('repHist', 'Historischer Verlauf'), icon: 'TrendingUp' },
        { id: 'tax', label: safeT('repTax', 'Steuerreport (31.12)'), icon: 'FileText' },
        { id: 'pension3a', label: safeT('repPension3a', 'Säule 3a Performance'), icon: 'Lock' },
        { id: 'securities', label: safeT('repSecurities', 'Aktien & Fonds Performance'), icon: 'TrendingUp' }
      ]
    },
    {
      title: safeT('menuHeaderFlowReports', 'Bewegungsreports'),
      items: [
        { id: 'categoryFlow', label: safeT('repCatFlow', 'Kategorienfluss'), icon: 'BarChart' },
        { id: 'waterfall', label: safeT('repWaterfall', 'Wasserfallfluss'), icon: 'BarChart2' },
        { id: 'passive', label: safeT('repPassive', 'Passives Einkommen'), icon: 'DollarSign' },
        { id: 'topFlow', label: safeT('repTopFlow', 'Top Flow Assets'), icon: 'ArrowUpRight' },
        { id: 'bookingAnalysis', label: safeT('repBookAna', 'Buchungsanalyse'), icon: 'Activity' }
      ]
    },
    {
      title: safeT('menuHeaderFutureReports', 'Zukunftsreports'),
      items: [
        { id: 'dividendCalendar', label: safeT('repDividendCalendar', 'Dividenden-Kalender'), icon: 'Calendar' },
        { id: 'future', label: safeT('repSimReg', 'Simulation & Regression'), icon: 'FastForward' },
        { id: 'scenarios', label: safeT('repScenFire', 'Szenarien & FIRE'), icon: 'Target' }
      ]
    }
  ];

  // --- KOMPAKTE ANDROID / TABLET TOP BAR (h-10 statt h-14) ---
  const renderMobileTopBar = () => {
    if (!isMobile) return null;
    const showPropsBtn = !activeReport && selectedNode && viewMode !== 'liveEditor';

    return (
      <div className="print-hide flex items-center justify-between bg-slate-900 text-white px-2.5 h-10 border-b border-slate-800 shrink-0 z-50 select-none">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setMobileMenuSection('main');
              setIsMobileMenuOpen(true);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 active:bg-blue-600 text-slate-200 transition-colors cursor-pointer"
            title={safeT('menuTitle', 'Menü')}
          >
            <Icon name="Menu" size={16} />
          </button>

          {viewMode !== 'liveEditor' && (
            <button
              onClick={() => setIsTreeVisible(!isTreeVisible)}
              className={`h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                isTreeVisible
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800/90 border-slate-700 text-slate-200'
              }`}
            >
              <Icon name="FolderOpen" size={13} className={isTreeVisible ? "text-white" : "text-yellow-400"} />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">
                {selectedNode ? selectedNode.name : (viewMode === 'budget' ? safeT('menuBudget', 'Budget') : safeT('tree', 'Strukturbaum'))}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => { setViewMode('vermoegen'); handleSelectReport('allocation'); handleSelectNode(null); }}>
          <span className="text-xs font-black tracking-wider uppercase text-white">
            FinBundle <span className="text-sky-400">PRO</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 rounded-lg">
            <span className="text-[9px] uppercase font-bold text-slate-400">
              {viewMode === 'budget' ? safeT('labelCashflow', 'Cashflow') : safeT('labelTotalShort', 'Total')}
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              {viewMode === 'budget'
                ? `${budgetNet >= 0 ? '+' : ''}${fCur(budgetNet, baseCur)}`
                : fCur(totalWealth, baseCur)}
            </span>
          </div>

          {showPropsBtn && (
            <button
              onClick={() => setIsMobilePropsOpen(true)}
              className="h-7 px-2.5 flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-xs cursor-pointer"
              title={selectedNode.selectedBooking ? safeT('btnEdit', 'Buchung bearbeiten') : safeT('fileSettings', 'Eigenschaften')}
            >
              <Icon name="Edit" size={12} />
              <span className="hidden xs:inline">{selectedNode.selectedBooking ? safeT('btnEdit', 'Buchung') : safeT('fileSettings', 'Details')}</span>
            </button>
          )}

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 text-slate-300 active:bg-slate-700 cursor-pointer"
          >
            <Icon name={theme === 'light' ? "Moon" : "Sun"} size={14} />
          </button>
        </div>
      </div>
    );
  };

  // --- KOMPAKTER ANDROID / TABLET VOLLMENÜ DRAWER ---
  const renderMobileMenuDrawer = () => {
    if (!isMobile || !isMobileMenuOpen) return null;
    const plugins = data?.plugins || [];

    return (
      <div className="fixed inset-0 z-[150] flex">
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div className="relative w-[82vw] max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl border-r border-gray-200 dark:border-slate-800 flex flex-col z-10 overflow-hidden">
          
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                <FinBundleLogo className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-sm tracking-wide leading-none">FinBundle <span className="text-sky-400">PRO</span></div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">{fCur(totalWealth, baseCur)}</div>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300"
            >
              <Icon name="X" size={15} />
            </button>
          </div>

          <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 p-1 gap-1 shrink-0">
            {[
              { id: 'main', label: safeT('menuViews', 'Ansichten'), icon: 'Layers' },
              { id: 'file', label: safeT('menuFile', 'Datei'), icon: 'FolderOpen' },
              { id: 'reports', label: safeT('menuReports', 'Reports'), icon: 'PieChart' },
              { id: 'plugins', label: safeT('menuPlugins', 'Plugins'), icon: 'Box' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMobileMenuSection(tab.id)}
                className={`flex-1 py-1.5 px-1 rounded-md text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                  mobileMenuSection === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon name={tab.icon} size={13} />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 finspa-scrollbar">
            {mobileMenuSection === 'main' && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                  {safeT('menuViews', 'Ansichten')}
                </div>
                {[
                  { id: 'vermoegen', rep: 'allocation', label: safeT('viewWealth', 'Vermögensverwaltung'), icon: 'Shield' },
                  { id: 'budget', rep: null, label: safeT('viewBudget', 'Budgetverwaltung'), icon: 'DollarSign' },
                  { id: 'liveEditor', rep: null, label: safeT('viewLiveEditor', 'API LiveEditor'), icon: 'Cloud' },
                  { id: 'datensicht', rep: null, label: safeT('viewData', 'Datensicht'), icon: 'Code' },
                  ...(data?.settings?.aiEnabled !== false ? [{ id: 'ai', rep: null, label: safeT('menuAiAssistant', 'KI-Assistent (Copilot)'), icon: 'Cpu' }] : [])
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setViewMode(item.id);
                      handleSelectReport(item.rep);
                      handleSelectNode(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg font-bold text-xs transition-colors ${
                      viewMode === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name={item.icon} size={15} />
                      <span>{item.label}</span>
                    </div>
                    {viewMode === item.id && <Icon name="CheckCircle" size={14} className="text-blue-500" />}
                  </button>
                ))}

                <hr className="border-gray-200 dark:border-slate-800 my-2" />

                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                  {safeT('labelLanguageSelect', 'Sprache / Language')}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['de', 'en', 'fr', 'it'].map(l => (
                    <button
                      key={l}
                      onClick={() => handleSetLang(l)}
                      className={`py-1.5 rounded-lg font-bold text-[11px] uppercase border ${
                        lang === l
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <hr className="border-gray-200 dark:border-slate-800 my-2" />

                <button
                  onClick={() => { setIsMobileMenuOpen(false); setModalObj({ type: 'settings' }); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Settings" size={15} className="text-slate-500" />
                  <span>{safeT('fileSettings', 'Einstellungen')}</span>
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setModalObj({ type: 'help' }); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Info" size={15} className="text-blue-500" />
                  <span>{safeT('helpManual', 'Benutzerhandbuch')}</span>
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setModalObj({ type: 'about' }); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Star" size={15} className="text-amber-500" />
                  <span>{safeT('helpAbout', 'Über FinBundle')}</span>
                </button>
              </div>
            )}

            {mobileMenuSection === 'file' && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                  {safeT('labelProjectManagement', 'Projektverwaltung')}
                </div>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleNewProject(); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="FilePlus" size={15} className="text-blue-500" />
                  <span>{safeT('fileNew', 'Neu (Leeres Projekt)')}</span>
                </button>

                <label className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer">
                  <Icon name="FolderOpen" size={15} className="text-amber-500" />
                  <span>{safeT('fileOpen', 'Projekt öffnen (.json / .zip)')}</span>
                  <input type="file" accept=".json,.zip" className="hidden" onChange={(e) => { setIsMobileMenuOpen(false); handleOpenProject(e); }} />
                </label>

                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleSaveProject(false); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs"
                >
                  <Icon name="Save" size={15} />
                  <span>{safeT('fileSave', 'Speichern')}</span>
                </button>

                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleSaveProject(true); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Copy" size={15} className="text-indigo-500" />
                  <span>{safeT('fileSaveAs', 'Speichern unter...')}</span>
                </button>

                <hr className="border-gray-200 dark:border-slate-800 my-2" />

                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                  {safeT('fileImport', 'Importieren')}
                </div>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setModalObj({ type: 'csvImport' }); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="List" size={15} className="text-emerald-500" />
                  <span>{safeT('fileImportStandard', 'Buchungen (CSV Wizard)')}</span>
                </button>

                <label className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer">
                  <Icon name="TrendingUp" size={15} className="text-purple-500" />
                  <span>{safeT('fileImportParqet', 'Parqet CSV importieren')}</span>
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => { setIsMobileMenuOpen(false); handleImportParqetCSV(e); }} />
                </label>

                {data?.settings?.aiEnabled !== false && (
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); setModalObj({ type: 'pdfImport' }); }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                  >
                    <Icon name="FileText" size={15} className="text-rose-500" />
                    <span>{safeT('fileImportPdfKI', 'PDF Rechnung scannen (KI)')}</span>
                  </button>
                )}

                <hr className="border-gray-200 dark:border-slate-800 my-2" />

                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                  {safeT('fileExportTitle', 'Exportieren & Drucken')}
                </div>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleExportCSV(); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="List" size={15} className="text-blue-500" />
                  <span>{safeT('fileExportCsv', 'Buchungen als CSV')}</span>
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleExportPDF(); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="FileText" size={15} className="text-rose-500" />
                  <span>{safeT('filePrintPdf', 'Aktueller Report als PDF')}</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    showToast(safeT('msgExportFullPdfStarted', "Generiere Gesamtreport im Hintergrund..."), "info");
                    window.dispatchEvent(new Event('triggerFullPdfBatch'));
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Layers" size={15} className="text-indigo-500" />
                  <span>{safeT('fileExportFullPdf', 'Gesamtreport als PDF')}</span>
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleExportExcel(); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="FileExcel" size={15} className="text-emerald-600" />
                  <span>{safeT('fileExportExcel', 'Als Excel (.xlsx) exportieren')}</span>
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handlePrint(); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Printer" size={15} className="text-slate-500" />
                  <span>{safeT('filePrint', 'Drucken')}</span>
                </button>
              </div>
            )}

            {mobileMenuSection === 'reports' && (
              <div className="space-y-3">
                {reportCategories.map((group, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-1.5">
                      {group.title}
                    </div>
                    {group.items.map(rep => (
                      <button
                        key={rep.id}
                        onClick={() => {
                          setViewMode('vermoegen');
                          handleSelectNode(null);
                          handleSelectReport(rep.id);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-bold transition-colors ${
                          activeReport === rep.id && viewMode === 'vermoegen'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon name={rep.icon} size={14} />
                          <span>{rep.label}</span>
                        </div>
                        <Icon name="ChevronRight" size={13} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {mobileMenuSection === 'plugins' && (
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setViewMode('ai');
                    handleSelectNode(null);
                    handleSelectReport(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs"
                >
                  <Icon name="PlusCircle" size={15} />
                  <span>{safeT('menuNewPluginCopilot', 'Neues Plugin (AI Copilot)...')}</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode('managePlugins');
                    handleSelectNode(null);
                    handleSelectReport(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  <Icon name="Settings" size={15} />
                  <span>{safeT('menuManagePlugins', 'Plugins verwalten...')}</span>
                </button>

                <hr className="border-gray-200 dark:border-slate-800 my-2" />

                {plugins.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 italic">
                    {safeT('menuNoPluginsPresent', 'Keine Plugins vorhanden')}
                  </div>
                ) : (
                  plugins.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setViewMode('plugin');
                        handleSelectReport(p.id);
                        handleSelectNode(null);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-bold ${
                        viewMode === 'plugin' && activeReport === p.id
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200'
                          : 'bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon name="Sparkles" size={14} className="text-amber-500 shrink-0" />
                        <span className="truncate">{p.title || p.name}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 shrink-0 ml-2">
                        {p.category || safeT('catGeneral', 'Allgemein')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {safeT('labelAutoSave', 'Auto-Save')}: {lastModTime}
            </span>
            <span>v1.0.0 RC4</span>
          </div>
        </div>
      </div>
    );
  };

  // --- KOMPAKTES ANDROID BOTTOM SHEET FÜR SCHNELLE REPORT-AUSWAHL ---
  const renderMobileReportsSheet = () => {
    if (!isMobile || !isMobileReportsOpen) return null;
    return (
      <div className="fixed inset-0 z-[140] flex flex-col justify-end">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setIsMobileReportsOpen(false)}
        />
        <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl max-h-[82vh] flex flex-col z-10 shadow-2xl border-t border-gray-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-sm flex items-center gap-2">
              <Icon name="PieChart" className="text-blue-500" size={16} />
              <span>{safeT('menuReports', 'Reports & Analysen')}</span>
            </h3>
            <button
              onClick={() => setIsMobileReportsOpen(false)}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500"
            >
              <Icon name="X" size={14} />
            </button>
          </div>
          <div className="p-3 overflow-y-auto space-y-3 finspa-scrollbar pb-5">
            {reportCategories.map((group, idx) => (
              <div key={idx}>
                <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1.5 px-1">
                  {group.title}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {group.items.map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => {
                        setViewMode('vermoegen');
                        handleSelectNode(null);
                        handleSelectReport(rep.id);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-xs font-bold border transition-all ${
                        activeReport === rep.id && viewMode === 'vermoegen'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-gray-200/60 dark:border-slate-700'
                      }`}
                    >
                      <Icon name={rep.icon} size={14} className="shrink-0" />
                      <span className="truncate">{rep.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- KOMPAKTE ANDROID BOTTOM NAVIGATION BAR (h-11 statt h-16) ---
  const renderMobileBottomNav = () => {
    if (!isMobile) return null;
    return (
      <div className="print-hide bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-around items-center h-11 px-1 shrink-0 z-50 select-none shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => setIsTreeVisible(!isTreeVisible)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer ${
            isTreeVisible ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon name="FolderOpen" size={15} />
          <span className="text-[9px] tracking-tight leading-none">{safeT('tree', 'Strukturbaum')}</span>
        </button>

        <button
          onClick={() => {
            setViewMode('vermoegen');
            setIsTreeVisible(false);
            if (!selectedNode && !activeReport) handleSelectReport('allocation');
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer ${
            viewMode === 'vermoegen' && !isTreeVisible && !isMobileReportsOpen ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon name="Shield" size={15} />
          <span className="text-[9px] tracking-tight leading-none">{safeT('menuWealth', 'Vermögen')}</span>
        </button>

        <button
          onClick={() => {
            setViewMode('budget');
            handleSelectReport(null);
            handleSelectNode(null);
            setIsTreeVisible(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer ${
            viewMode === 'budget' && !isTreeVisible ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon name="DollarSign" size={15} />
          <span className="text-[9px] tracking-tight leading-none">{safeT('menuBudget', 'Budget')}</span>
        </button>

        <button
          onClick={() => setIsMobileReportsOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer ${
            isMobileReportsOpen || (viewMode === 'vermoegen' && activeReport && !selectedNode) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon name="PieChart" size={15} />
          <span className="text-[9px] tracking-tight leading-none">{safeT('menuReports', 'Reports')}</span>
        </button>

        {data?.settings?.aiEnabled !== false && (
          <button
            onClick={() => {
              setViewMode('ai');
              handleSelectReport(null);
              handleSelectNode(null);
              setIsTreeVisible(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 cursor-pointer ${
              viewMode === 'ai' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon name="Sparkles" size={15} />
            <span className="text-[9px] tracking-tight leading-none">{safeT('flyInCopilotFooter', 'Copilot')}</span>
          </button>
        )}
      </div>
    );
  };

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
          width: 6px;
          height: 6px;
        }
        .finspa-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .finspa-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 9999px;
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

      {/* Desktop MenuBar bleibt immer gemountet (für globale Event-Listener), wird auf Android aber ausgeblendet */}
      <div className={isMobile ? "hidden" : "block w-full shrink-0"}>
        <MenuBar 
          data={data} 
          lang={lang} 
          setLang={handleSetLang} 
          viewMode={viewMode} 
          setViewMode={setViewMode} 
          activeReport={activeReport}
          setActiveReport={handleSelectReport} 
          setSelectedNode={handleSelectNode} 
          theme={theme} 
          setTheme={setTheme} 
          setModalObj={setModalObj} 
          updateTreeData={updateTreeData} 
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
      </div>

      {/* Mobile Top App Bar */}
      {renderMobileTopBar()}
      {renderMobileMenuDrawer()}
      {renderMobileReportsSheet()}
      
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* TreeView: Auf Desktop normal links angedockt, auf Android als Slide-Over Overlay */}
        {isMobile ? (
          isTreeVisible && viewMode !== 'liveEditor' && (
            <div className="fixed inset-0 z-[120] flex">
              <div
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                onClick={() => setIsTreeVisible(false)}
              />
              <div className="relative z-10 h-full bg-white dark:bg-slate-900 shadow-2xl flex">
                <TreeView 
                  data={data} 
                  viewMode={viewMode} 
                  selectedNode={selectedNode} 
                  setSelectedNode={handleSelectNode} 
                  setActiveReport={handleSelectReport} 
                  isTreeVisible={true} 
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
              </div>
            </div>
          )
        ) : (
          <TreeView 
            data={data} 
            viewMode={viewMode} 
            selectedNode={selectedNode} 
            setSelectedNode={handleSelectNode} 
            setActiveReport={handleSelectReport} 
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
        )}

        <div className="flex-1 relative overflow-auto" id="printable-editor">
          <EditorArea 
            data={data} 
            lang={lang} 
            viewMode={viewMode} 
            setViewMode={setViewMode} 
            activeReport={activeReport} 
            setActiveReport={handleSelectReport} 
            selectedNode={selectedNode} 
            setSelectedNode={handleSelectNode} 
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

        {/* PropertyEditor: Auf Desktop rechts angedockt, auf Android als zentrierter kompakter Pill-Button + Slide-Over-Sheet (verdeckt niemals die Netto-Summe rechts!) */}
        {!activeReport && selectedNode && viewMode !== 'liveEditor' && (
          isMobile ? (
            <>
              <button
                onClick={() => setIsMobilePropsOpen(true)}
                className="print-hide fixed bottom-12 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600/95 hover:bg-blue-700 text-white font-bold text-[11px] shadow-lg shadow-blue-600/30 active:scale-95 transition-transform cursor-pointer border border-blue-400/40 backdrop-blur-xs"
              >
                <Icon name="Edit" size={13} />
                <span>{selectedNode.selectedBooking ? safeT('btnEdit', 'Buchung bearbeiten') : safeT('fileSettings', 'Eigenschaften')}</span>
              </button>

              {isMobilePropsOpen && (
                <div className="fixed inset-0 z-[130] flex justify-end">
                  <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                    onClick={() => setIsMobilePropsOpen(false)}
                  />
                  <div className="relative z-10 h-full w-[88vw] max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate pr-2">
                        {selectedNode.name} – {safeT('labelDetails', 'Details')}
                      </span>
                      <button
                        onClick={() => setIsMobilePropsOpen(false)}
                        className="p-1 rounded-lg bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <Icon name="X" size={15} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto flex">
                      <PropertyEditor 
                        data={data} 
                        activeReport={activeReport} 
                        selectedNode={selectedNode} 
                        setSelectedNode={handleSelectNode} 
                        updateTreeData={updateTreeData} 
                        syncExchangeRates={syncExchangeRates} 
                        t={t} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <PropertyEditor 
              data={data} 
              activeReport={activeReport} 
              selectedNode={selectedNode} 
              setSelectedNode={handleSelectNode} 
              updateTreeData={updateTreeData} 
              syncExchangeRates={syncExchangeRates} 
              t={t} 
            />
          )
        )}
      </div>

      {/* Android Bottom Navigation vs. Desktop Status Bar */}
      {isMobile ? (
        renderMobileBottomNav()
      ) : (
        <div className="print-hide flex justify-between items-center bg-gray-100 dark:bg-slate-900 border-t border-gray-300 dark:border-slate-800 px-4 py-1 text-[11px] text-gray-600 dark:text-gray-400 z-50 select-none">
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
                <span className="flex items-center gap-1" title={t('titleAssetCount') || "Anzahl verwalteter Assets"}><Icon name="PieChart" size={10} /> {allAssetsCount} {safeT('assets', 'Assets')}</span>
                <span className="flex items-center gap-1" title={t('titleBaseCurrency') || "Basiswährung der Anwendung"}><Icon name="Globe" size={10} /> {baseCur}</span>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                {viewMode === 'vermoegen' && (
                    <span className="flex items-center gap-2 bg-gray-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200" title={`${t('titleNetWealth') || "Aktuelles Nettovermögen in"} ${baseCur}`}>
                        <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 mt-0.5">{t('labelTotalShort') || 'Total'}</span>
                        <strong className="font-mono tracking-tight text-xs">{fCur ? fCur(totalWealth, baseCur) : totalWealth}</strong>
                    </span>
                )}
                {viewMode === 'budget' && (
                    <span className={`flex items-center gap-2 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200 ${budgetNet >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`} title={`${t('titleNetCashflow') || "Monatlicher Net Cashflow in"} ${baseCur}`}>
                        <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 mt-0.5">{t('labelCashflow') || 'Cashflow'}</span>
                        <strong className={`font-mono tracking-tight text-xs ${budgetNet >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                            {budgetNet >= 0 ? '+' : ''}{fCur ? fCur(budgetNet, baseCur) : budgetNet}
                        </strong>
                    </span>
                )}
                <span className="opacity-70">{t('version') || 'Version'}: 1.0.0 RC4</span>
            </div>
        </div>
      )}

      <FullPdfOrchestrator 
          data={data} 
          activeAssets={showArchived ? flatAssets : flatAssets.filter(a => !a?.isArchived)}
          dateRange={dateRange} 
          fCur={fCur} 
          t={t} 
      />
      
      {ModalHandler()}
      
      <div className={`fixed ${isMobile ? 'bottom-14' : 'bottom-4'} right-4 z-[200] space-y-1.5 pointer-events-none`}>
          {toasts.map(toast => (
              <div key={toast.id} className="px-3.5 py-2 rounded-lg shadow-xl border bg-slate-800 text-white border-slate-700 text-xs font-medium">
                  {toast.message}
              </div>
          ))}
      </div>
    </div>
  );
};

module.exports = App;