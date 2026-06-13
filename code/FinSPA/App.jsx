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
const { initialData, generateId, getAllAssets, getAssetValueAtDate, getTotalWealthAtDate, generateMonthEnds, calcLinearRegression, calcExpRegression, formatCurrency, defaultBookingCategories } = DataEngine;

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

const PdfExportEngine = getModule('PdfExportEngine.js', () => safeRequire('./components/print/PdfExportEngine.jsx'));
window.PdfExportEngine = PdfExportEngine; 

const importParqetCSV = ParqetModule.importParqetCSV || ParqetModule;

const App = () => {
  const [fileHandle, setFileHandle] = useState(null);
  
  const [data, setData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const localData = localStorage.getItem('finspa_pro_autosave');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed && parsed.version) {
            return parsed;
          }
        }
      } catch (e) {
        console.error("[FinSPA] Autosave konnte nicht geladen werden:", e);
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
        console.error("[FinSPA Core] Fehler beim Laden der externen Kernbibliotheken:", err);
      }
    };

    initializeCdns();
  }, []);

  useEffect(() => { setIsTreeVisible(!activeReport); }, [activeReport]);

  useEffect(() => {
    try {
      localStorage.setItem('finspa_pro_autosave', JSON.stringify(data));
    } catch (e) {
      console.error("[FinSPA] Fehler beim localStorage-Autosave:", e);
    }

    const writeToDisk = async () => {
      if (fileHandle && fileHandle.name && fileHandle.name.endsWith('.json')) {
        try {
          const opts = { mode: 'readwrite' };
          if ((await fileHandle.queryPermission(opts)) === 'granted' || (await fileHandle.requestPermission(opts)) === 'granted') {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
          }
        } catch (err) {
          console.error("[FinSPA] Direktes Dateisichern fehlgeschlagen:", err);
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

  const handlePrint = () => window.print();

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
              version: "Beta - 0.9.4", lastModified: new Date().toISOString(), settings: data.settings, 
              banks: [], budget: { incomeSources: [], expenses: [], subscriptions: [] },
              goals: { fire: { target: 500000, year: 2040 } }, scenarios: []
          });
          setSelectedNode(null); setActiveReport(null); showToast(t('msgNewProjectSuccess') || 'Neues Projekt erstellt', "success");
      }
  };

  const handleOpenProject = async (e) => {
    if (typeof window.showOpenFilePicker === 'function' && (!e || !e.target || !e.target.files)) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'FinSPA Projekt', accept: { 'application/json': ['.json'], 'application/zip': ['.zip'] } }],
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
                            setData(imported);
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
                        
                        if (!content) throw new Error(t('msgWrongPin') || "Falscher PIN oder beschädigte Datei.");
                        
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
                suggestedName: targetHandle ? targetHandle.name : `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.${isZip ? 'zip' : 'json'}`,
                types: isZip
                    ? [{ description: 'FinSPA Verschlüsselt', accept: { 'application/zip': ['.zip'] } }]
                    : [{ description: 'FinSPA Projekt', accept: { 'application/json': ['.json'] } }]
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("[FinSPA Diagnose] FilePicker Fehler:", err);
                showToast((t('msgSaveError') || "Fehler beim Dateidialog: ") + err.message, "error");
            }
            return;
        }
    }

    const jsonStr = JSON.stringify(data, null, 2);

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

            if (targetHandle && window.showSaveFilePicker) {
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
            } else {
                const blob = new Blob([finalContent], { type: isZip ? "application/zip" : "application/json" });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.${isZip ? 'zip' : 'json'}`;
                a.click();
                showToast(isZip ? (t('msgZipExportSuccess') || "Projekt verschlüsselt exportiert") : (t('msgSaveSuccess2') || "Projekt erfolgreich exportiert"), "success");
            }
        } catch (error) {
            console.error("[FinSPA Diagnose] Speicherfehler:", error);
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
          a.download = `FinSPA_Buchungen_${new Date().toISOString().split('T')[0]}.csv`;
          a.click(); showToast(t('msgCsvSuccess') || 'Export erfolgreich', "success");
       } catch (e) { showToast(t('msgCsvError') || 'Export Fehler', "error"); }
  };

  const handleImportParqetCSV = (e) => {
    const target = e.target;
    const file = target.files[0];
    if (!file) {
      console.warn("[FinSPA Diagnose] Keine Datei ausgewählt.");
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

      if (modalObj.type === 'settings') {
          return <SettingsModal data={data} updateTreeData={updateTreeData} setModalObj={setModalObj} showToast={showToast} defaultBookingCategories={defaultBookingCategories} t={t} />;
      }
      
      if (modalObj.type === 'help') {
          return <HelpViewer setModalObj={setModalObj} lang={lang} />;
      }

      if (modalObj.type === 'about') return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden transform transition-all">
                  <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <Icon name="Info" className="text-blue-500" />
                          <h3 className="font-bold text-lg">{t('helpAbout') || 'Über FinSPA'}</h3>
                      </div>
                      <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                          <Icon name="X" size={20}/>
                      </button>
                  </div>
                  
                  <div className="p-6 text-center space-y-4">
                      <div className="flex justify-center mb-2">
                          <div className="bg-blue-700 text-white p-4 rounded-full shadow-lg">
                          <Icon name="PieChart" size={40} />
                          </div>
                      </div>
                      
                      <div>
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-wide">Fin SPA Pro</h2>
                          <p className="text-md font-bold text-blue-600 dark:text-blue-400 mt-1">Version Beta - 0.9.4</p>
                      </div>
                      
                      <hr className="border-gray-200 dark:border-slate-700 my-4" />
                      
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                          <p>{t('aboutDesc') || 'Ganzheitliche Finanzplanung.'}</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{t('aboutDev') || 'Entwickelt von Thomas Kerle'}</p>
                          <p>&copy; {new Date().getFullYear()} Thomas Kerle. {t('aboutRights') || 'Alle Rechte vorbehalten.'}</p>
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-center">
                      <button onClick={() => setModalObj(null)} className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                          {t('btnClose') || 'Schließen'}
                      </button>
                  </div>
              </div>
          </div>
      );		

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
          />
        </div>

        {!activeReport && selectedNode && (
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

      <div className="print-hide flex justify-between items-center bg-gray-100 dark:bg-slate-900 border-t border-gray-300 dark:border-slate-800 px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400 z-50">
          <div className="flex gap-6">
              <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div> {t('statusReady') || 'Bereit'}
              </span>
              <span>{t('statusBarMode') || 'Modus'}: <strong className="uppercase">{t(viewMode) || viewMode}</strong></span>
          </div>
          <div className="flex gap-6">
              <span>{t('version') || 'Version'}: Beta - 0.9.4</span>
          </div>
      </div>
      
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