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
              version: "Beta - 0.9.1", lastModified: new Date().toISOString(), settings: data.settings, 
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
    const saveMethod = data.settings?.saveMethod || 'plaintext';
    const jsonStr = JSON.stringify(data, null, 2);

    if (saveMethod === 'zip') {
        setModalObj({ 
            type: 'pinPrompt', 
            action: 'save',
            onConfirm: async (pin) => {
                showToast(t('msgEncrypting') || "Verschlüsselung wird durchgeführt...", "success");
                
                try {
                    if (typeof window.CryptoJS === 'undefined') {
                        throw new Error(t('msgCryptoNotLoaded') || "CryptoJS ist nicht geladen.");
                    }
                    if (typeof window.JSZip === 'undefined') {
                        throw new Error(t('msgZipNotLoaded') || "JSZip ist nicht geladen.");
                    }

                    const encrypted = window.CryptoJS.AES.encrypt(jsonStr, pin).toString();
                    const zip = new window.JSZip();
                    zip.file("project.data.enc", encrypted);
                    
                    const zipContent = await zip.generateAsync({type: "uint8array"});
                    
                    if (window.showSaveFilePicker) {
                        let handle = saveAs ? null : fileHandle;
                        if (!handle || !handle.name.endsWith('.zip')) {
                            handle = await window.showSaveFilePicker({
                                suggestedName: `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.zip`,
                                types: [{ description: 'FinSPA Verschlüsselt', accept: { 'application/zip': ['.zip'] } }]
                            });
                            setFileHandle(handle);
                        }
                        const writable = await handle.createWritable();
                        await writable.write(zipContent);
                        await writable.close();
                        showToast(t('msgZipExportSuccess') || "Projekt erfolgreich verschlüsselt gespeichert", "success");
                    } else {
                        const blob = new Blob([zipContent], { type: "application/zip" });
                        const a = document.createElement('a'); 
                        a.href = URL.createObjectURL(blob);
                        a.download = `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.zip`;
                        a.click(); 
                        showToast(t('msgExportSuccess') || "Projekt exportiert", "success");
                    }
                } catch(err) {
                    if (err.name !== 'AbortError') {
                        console.error("[FinSPA Diagnose] Fehler bei ZIP-Export:", err);
                        showToast((t('msgEncryptError') || "Fehler bei der Verschlüsselung: ") + err.message, "error");
                    }
                }
            }
        });
    } else {
        try {
            if (window.showSaveFilePicker) {
                let handle = saveAs ? null : fileHandle;
                if (!handle || !handle.name.endsWith('.json')) {
                    handle = await window.showSaveFilePicker({
                        suggestedName: `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.json`,
                        types: [{ description: 'FinSPA Projekt', accept: { 'application/json': ['.json'] } }]
                    });
                    setFileHandle(handle);
                }
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                showToast(t('msgSaveSuccess2') || "Projekt erfolgreich gespeichert", "success");
            } else {
                const blob = new Blob([jsonStr], { type: "application/json" });
                const a = document.createElement('a'); 
                a.href = URL.createObjectURL(blob);
                a.download = `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.json`;
                a.click(); 
                showToast(t('msgExportSuccess') || "Projekt exportiert", "success");
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("[FinSPA] Fehler beim Speichern:", err);
                showToast((t('msgSaveError') || "Fehler beim Speichern: ") + err.message, "error");
            }
        }
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

  const FormModal = () => {
      const baseCurrency = data.settings?.baseCurrency || 'CHF';
      const isForeignCurrency = selectedNode?.currency && selectedNode.currency !== baseCurrency;

      const getActualShares = (node) => {
          if (!node) return 0;
          let sh = 0;
          if (node.bookings) {
              node.bookings.forEach(b => {
                  if (['Kauf', 'Einzahlung', 'Dividende'].includes(b.type) && b.shares) sh += Number(b.shares);
                  if (['Verkauf', 'Auszahlung'].includes(b.type) && b.shares) sh -= Number(b.shares);
              });
          }
          return sh > 0 ? sh : (node.shares || 0);
      };

      const getActualPrice = (node) => {
          if (!node) return 0;
          let p = 0;
          if (node.bookings) {
              const sorted = [...node.bookings].sort((a,b) => new Date(b.date) - new Date(a.date));
              const lastWithPrice = sorted.find(b => ['Kauf', 'Verkauf', 'Wertanpassung'].includes(b.type) && Number(b.price) > 0);
              if (lastWithPrice) p = Number(lastWithPrice.price);
          }
          return p > 0 ? p : (node.price || 0);
      };

      const [form, setForm] = useState(modalObj.item || { 
          date: new Date().toISOString().split('T')[0], 
          type: modalObj.defaultType || 'Einzahlung', 
          amount: '', subCategory: '', shares: '', price: '', fees: '', taxes: '', 
          bookingExchangeRate: isForeignCurrency ? (selectedNode?.exchangeRate || 1) : 1,
          targetAssetId: ''
      });

      const handleSave = () => {
          let newData = {...data};
          if (modalObj.type === 'editGoal') { 
              newData.goals.fire = { target: Number(form.target||0), year: Number(form.year||2040) }; 
          } 
          else if (modalObj.type === 'addScenario') { 
              newData.scenarios.push({ id: generateId(), name: form.name||(t('newTargetName')||'Neu'), date: form.date, impact: Number(form.impact||0) }); 
          } 
          else if (modalObj.type === 'addBank') { 
              newData.banks.push({ id: generateId(), name: form.name || (t('newBankName')||'Neue Bank'), type: 'bank', isArchived: false, children: [] }); 
          } 
          else if (modalObj.type === 'addBudget' || modalObj.type === 'editBudget') {
              const group = modalObj.budgetGroup;
              if (!newData.budget) newData.budget = { incomeSources: [], expenses: [], subscriptions: [] };
              if (!newData.budget[group]) newData.budget[group] = [];
              
              if (modalObj.type === 'editBudget') {
                  newData.budget[group] = newData.budget[group].map(item => 
                      item.id === modalObj.item.id 
                          ? { ...item, name: form.name, amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' }
                          : item
                  );
              } else {
                  newData.budget[group] = [...newData.budget[group], { id: generateId(), name: form.name || (t('newBudgetItem')||'Neuer Posten'), amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' }];
              }
          } 
          else if (['addBooking', 'editBooking', 'addBalance', 'editBalance'].includes(modalObj.type)) {
              const updateRecursive = (nodes) => nodes.map(n => {
                  let copy = {...n};

                  if (form.targetAssetId && n.id === form.targetAssetId && modalObj.type === 'addBooking') {
                      if (!copy.bookings) copy.bookings = [];
                      
                      const isTargetSecurity = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(copy.assetClass);
                      
                      copy.bookings.push({
                          id: generateId(),
                          date: form.date,
                          type: isTargetSecurity ? 'Kauf' : 'Einzahlung', 
                          subCategory: form.type === 'Dividende' ? (t('divIn')||'Dividenden Eingang') : (t('transferIn')||'Umbuchung Eingang'),
                          amount: Number(form.amount),
                          bookingExchangeRate: 1
                      });
                  }

                  if (n.id === modalObj.assetId) {
                      if (modalObj.type.includes('Booking')) {
                          if (!copy.bookings) copy.bookings = [];
                          if (modalObj.item) copy.bookings = copy.bookings.filter(b=>b.id !== modalObj.item.id);
                          
                          let saveType = form.type;
                          let saveCat = form.subCategory;
                          if (form.type === 'Umbuchung') {
                              saveType = 'Auszahlung';
                              saveCat = t('transferOut') || 'Umbuchung Ausgang';
                          }

                          copy.bookings.push({ 
                              id: modalObj.item?.id || generateId(), 
                              date: form.date, 
                              type: saveType, 
                              subCategory: saveCat, 
                              amount: Number(form.amount), 
                              shares: saveType === 'Wertanpassung' ? undefined : (form.shares ? Number(form.shares) : undefined), 
                              price: form.price ? Number(form.price) : undefined, 
                              fees: form.fees ? Number(form.fees) : undefined, 
                              taxes: form.taxes ? Number(form.taxes) : undefined, 
                              bookingExchangeRate: form.bookingExchangeRate ? Number(form.bookingExchangeRate) : 1 
                          });
                      } else {
                          if (!copy.balances) copy.balances = [];
                          if (modalObj.item) copy.balances = copy.balances.filter(b=>b.id !== modalObj.item.id);
                          copy.balances.push({ id: modalObj.item?.id || generateId(), date: form.date, amount: Number(form.amount), bookingExchangeRate: Number(form.bookingExchangeRate||1) });
                      }
                  }
                  if (n.children) copy.children = updateRecursive(n.children);
                  return copy;
              });
              newData.banks = updateRecursive(newData.banks);
              if (selectedNode && selectedNode.id === modalObj.assetId) {
                  const getUpdatedNode = (nodes) => { for(let i=0; i<nodes.length; i++) { if(nodes[i].id === selectedNode.id) return nodes[i]; if(nodes[i].children) { let r = getUpdatedNode(nodes[i].children); if(r) return r; } } };
                  setSelectedNode(getUpdatedNode(newData.banks));
              }
          } 
          else if (modalObj.type === 'addCategory' || modalObj.type === 'addAsset') {
              const updateRecursive = (nodes) => nodes.map(n => {
                  if (n.id === modalObj.parentId) {
                      let copy = {...n};
                      if (!copy.children) copy.children = [];
                      if (modalObj.type === 'addCategory') {
                          copy.children.push({ id: generateId(), name: form.name || (t('newCategoryName')||'Neue Kategorie'), type: 'category', isArchived: false, children: [] });
                      } else {
                          const ac = form.assetClass || 'cash';
                          const isLiq = !['pension_cash', 'pension_fund', 'realestate', 'mortgage'].includes(ac);
                          copy.children.push({ id: generateId(), name: form.name || (t('newAssetName')||'Neues Asset'), type: 'asset', currency: 'CHF', exchangeRate: 1.0, isLiquid: isLiq, isArchived: false, assetClass: ac, balances: [], bookings: [] });
                      }
                      return copy;
                  }
                  if (n.children) return { ...n, children: updateRecursive(n.children) };
                  return n;
              });
              newData.banks = updateRecursive(newData.banks);
          }
          if (typeof window !== 'undefined' && window.showToast) window.showToast(t('msgSaveSuccess2') || "Erfolgreich gespeichert", "success");
          updateTreeData(newData); 
          setModalObj(null);
      };
	
      const handleItemDelete = () => {
          if (!modalObj.item || !modalObj.assetId) return;
          let newData = {...data};
          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === modalObj.assetId) {
                  let copy = {...n};
                  if (modalObj.type.includes('Booking') && copy.bookings) {
                      copy.bookings = copy.bookings.filter(b => b.id !== modalObj.item.id);
                  } else if (modalObj.type.includes('Balance') && copy.balances) {
                      copy.balances = copy.balances.filter(b => b.id !== modalObj.item.id);
                  }
                  return copy;
              }
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
              });
          newData.banks = updateRecursive(newData.banks);
          updateTreeData(newData);
          if (selectedNode && selectedNode.id === modalObj.assetId) {
              const getUpdatedNode = (nodes) => { for(let i=0; i<nodes.length; i++) { if(nodes[i].id === selectedNode.id) return nodes[i]; if(nodes[i].children) { let r = getUpdatedNode(nodes[i].children); if(r) return r; } } };
              setSelectedNode(getUpdatedNode(newData.banks));
          }
          if (typeof window !== 'undefined' && window.showToast) window.showToast(t('msgDeleted') || "Gelöscht", "success");
          setModalObj(null);
      };

      let availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung'];
      const ac = selectedNode?.assetClass;
      if (modalObj.type?.includes('Booking') && selectedNode?.type === 'asset') {
          if (ac === 'realestate') availableBookingTypes = ['Wertanpassung'];
          else if (ac === 'mortgage') availableBookingTypes = ['Abzahlung', 'Zinszahlung', 'Schulderhöhung'];
          else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) availableBookingTypes = ['Kauf', 'Verkauf', 'Dividende', 'Gebühr', 'Wertanpassung'];
          else if (['pension_cash', 'pension_3a_cash'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Zinszahlung', 'Gebühr'];
      }

      const activeBookingCategories = data.settings?.bookingCategories || defaultBookingCategories || {};
      const availableSubCategories = activeBookingCategories[form.type] || [];
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

      const currentSh = getActualShares(selectedNode);
      const currentPr = getActualPrice(selectedNode);

      return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="font-bold text-lg">{modalObj.type.includes('edit') ? (t ? t('modalEdit') : 'Bearbeiten') : (t ? t('modalNew') : 'Neu')}</h3>
              <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto">

                {modalObj.type === 'editGoal' && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('goalTarget') : 'Zielwert'}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.target || ''} onChange={e=>setForm({...form, target: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('goalYear') : 'Zieljahr'}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})}/>
                        </div>
                    </>
                )}

                {modalObj.type === 'addScenario' && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('scenarioName') : 'Name'}</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('scenarioDate') : 'Datum'}</label>
                            <input type="date" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.date || ''} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('scenarioImpact') : 'Auswirkung'}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.impact || ''} onChange={e=>setForm({...form, impact: e.target.value})}/>
                        </div>
                    </>
                )}

                {(modalObj.type === 'addCategory' || modalObj.type === 'addAsset' || modalObj.type === 'addBank' || modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t ? t('propName') : 'Name'}</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/>
                        </div>
                        {(modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                            <>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t ? t('amount') : 'Betrag'}</label>
                                    <input type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.amount || ''} onChange={e=>setForm({...form, amount: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t ? t('budgetFreq') : 'Frequenz'}</label>
                                    <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.frequency || 'monthly'} onChange={e=>setForm({...form, frequency: e.target.value})}>
                                        <option value="monthly">{t ? t('freqMonthly') : 'Monatlich'}</option>
                                        <option value="yearly">{t ? t('freqYearly') : 'Jährlich'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t ? t('budgetRuleCat') : 'Regelwerk'}</label>
                                    <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.ruleCategory || 'needs'} onChange={e=>setForm({...form, ruleCategory: e.target.value})}>
                                        <option value="needs">{t ? t('ruleNeeds') : 'Bedürfnisse'}</option>
                                        <option value="wants">{t ? t('ruleWants') : 'Wünsche'}</option>
                                        <option value="savings">{t ? t('ruleSavings') : 'Sparen/Investieren'}</option>
                                    </select>
                                </div>
                            </>
                        )}
                        {modalObj.type === 'addAsset' && (
                            <div className="mt-3">
                                <label className="block font-bold mb-1">{t ? t('assetClass') : 'Asset-Klasse'}</label>
                                <select className="w-full p-2 border rounded dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" value={form.assetClass || 'cash'} onChange={e => setForm({...form, assetClass: e.target.value})}>
                                    <option value="cash">{t ? t('acCash') : 'Bargeld'}</option>
                                    <option value="fund">{t ? t('acFund') : 'Fonds'}</option>
                                    <option value="stock">{t ? t('acStock') : 'Aktien'}</option>
                                    <option value="crypto">{t ? t('acCrypto') : 'Krypto'}</option>
                                    <option value="realestate">{t ? t('acRealEstate') : 'Immobilien'}</option>
                                    <option value="mortgage">{t ? t('acMortgage') : 'Hypothek'}</option>
                                    <option value="pension_cash">{t ? t('acPensionCash') : 'Pensionskasse'}</option>
                                    <option value="pension_fund">{t ? t('acPensionFund') : 'Vorsorge Fonds'}</option>
                                    <option value="pension_3a_cash">{t ? t('acPension3aCash') : '3a Cash'}</option>
                                    <option value="pension_3a_fund">{t ? t('acPension3aFund') : '3a Fonds'}</option>
                                </select>
                            </div>
                        )}
                    </>
                )}

                {modalObj.type.includes('Balance') && (
                    <>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 mb-4 text-xs font-medium">{t ? t('balanceNotice') : 'Stichtags-Salden überschreiben historische Buchungen.'}</div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('labelBalanceDate') : 'Datum'}</label>
                            <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('labelAbsoluteBalance') : 'Saldo'} ({selectedNode?.currency || baseCurrency})</label>
                            <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                        </div>
                        {isForeignCurrency && (
                            <div>
                                <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t ? t('labelExchangeRateDate') : 'Kurs'} ({selectedNode?.currency} -> {baseCurrency})</label>
                                <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                            </div>
                        )}
                    </>
                )}

                {modalObj.type.includes('Booking') && (
                    <>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('date') : 'Datum'}</label>
                            <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('entryType') : 'Typ'}</label>
                            <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.type} onChange={e=>setForm({...form, type: e.target.value, subCategory: ''})}>
                                {availableBookingTypes.map(tOption => {
                                    const typeMap = {
                                        'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 
                                        'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 
                                        'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee',
                                        'Umbuchung': 'typeTransfer'
                                    };
                                    const translationKey = typeMap[tOption] || tOption;
                                    return (
                                        <option key={tOption} value={tOption}>
                                            {t ? t(translationKey) : tOption}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('amount') : 'Betrag'} ({selectedNode?.currency || baseCurrency})</label>
                            <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                        </div>
                        
                        {isSecurities && form.type === 'Wertanpassung' && (
                            <div className="grid grid-cols-2 gap-3 mt-3 bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50">
                                <div>
                                    <label className="block font-bold mb-1 text-xs uppercase text-blue-700 dark:text-blue-400">{t ? t('currentShares') : 'Aktuelle Stücke'}</label>
                                    <input type="number" className="w-full p-2.5 border border-blue-300 dark:border-blue-700 rounded-lg bg-gray-100 dark:bg-slate-800/50 text-gray-500 cursor-not-allowed" 
                                        value={currentSh} 
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 text-xs uppercase text-blue-700 dark:text-blue-400">{t ? t('newPrice') : 'Neuer Kurs'} (Bisher: {currentPr})</label>
                                    <input type="number" step="any" className="w-full p-2.5 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-slate-800 bg-transparent" 
                                        placeholder={currentSh > 0 ? (t('placeholderCalcPrice') || "Tippen = Berechnen") : (t('placeholderManualAmount') || "Betrag manuell eintippen")}
                                        value={form.price || ''}
                                        onChange={e => {
                                            const newPr = e.target.value;
                                            setForm(prev => {
                                                let newAmt = prev.amount;
                                                if (newPr !== '' && currentSh > 0) {
                                                    newAmt = ((Number(newPr) - Number(currentPr)) * currentSh).toFixed(2);
                                                }
                                                return {...prev, price: newPr, amount: newAmt};
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {['Dividende', 'Umbuchung'].includes(form.type) && !modalObj.item && (
                            <div>
                                <label className="block font-bold mb-1 mt-3 text-xs uppercase text-gray-500">{t ? t('targetAccount') : 'Zielkonto'}</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.targetAssetId || ''} onChange={e=>setForm({...form, targetAssetId: e.target.value})}>
                                    <option value="">{t('optTargetAccount') || '-- Optional: Zielkonto wählen --'}</option>
                                    {data.banks.map(bank => {
                                        const eligibleAssets = getAllAssets([bank]).filter(a => 
                                            a.id !== selectedNode?.id && 
                                            ['cash', 'pension_cash', 'pension_3a_cash', 'stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(a.assetClass)
                                        );                
                                        if (eligibleAssets.length === 0) return null;
                                        
                                        return (
                                            <optgroup key={bank.id} label={bank.name}>
                                                {eligibleAssets.map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.name} ({a.currency})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            </div>
                        )}
                        
                        {availableSubCategories.length > 0 && (
                            <div>
                                <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('category') : 'Kategorie'}</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.subCategory || ''} onChange={e=>setForm({...form, subCategory: e.target.value})}>
                                    <option value="">{t('optOptional') || '-- Optional --'}</option>
                                    {availableSubCategories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t ? t(cat) : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isSecurities && ['Kauf', 'Verkauf', 'Dividende'].includes(form.type) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('shares') : 'Stücke'}</label>
                                    <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.shares || ''} onChange={e => {
                                        const sh = e.target.value;
                                        const pr = form.price || 0;
                                        setForm({
                                            ...form, 
                                            shares: sh, 
                                            amount: sh && pr ? (Number(sh) * Number(pr)).toFixed(2) : form.amount
                                        });
                                    }}/>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('price') : 'Preis'}</label>
                                    <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.price || ''} onChange={e => {
                                        const pr = e.target.value;
                                        const sh = form.shares || 0;
                                        setForm({
                                            ...form, 
                                            price: pr, 
                                            amount: sh && pr ? (Number(sh) * Number(pr)).toFixed(2) : form.amount
                                        });
                                    }}/>
                                </div>
                            </div>
                        )}

                        {isForeignCurrency && (
                            <div>
                                <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t ? t('labelExchangeRateDate') : 'Kurs'} ({selectedNode?.currency} -> {baseCurrency})</label>
                                <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                            </div>
                        )}
                    </>
                )}

            </div>
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0">
              {modalObj.item ? (
                  <button onClick={handleItemDelete} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors">
                      {t ? t('btnDelete') : 'Löschen'}
                  </button>
              ) : <div></div>}
              <div className="flex gap-2">
                  <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 transition-colors">
                      {t ? t('btnCancel') : 'Abbrechen'}
                  </button>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                      {t ? t('btnSave') : 'Speichern'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      );
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
                          <p className="text-md font-bold text-blue-600 dark:text-blue-400 mt-1">Version Beta - 0.9.1</p>
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

      // HIER IST DIE RETTUNG: FormModal nur aufrufen, wenn es wirklich eins der Formulare ist
      return <FormModal />;
  };

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col font-sans bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
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
              <span>{t('version') || 'Version'}: Beta - 0.9.2</span>
          </div>
      </div>
      
      {/* UND HIER WURDE SIE ALS FIXE KOMPONENTE ENTFERNT, UM DEN ABSTURZ ZU VERHINDERN */}
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