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

// --- NEU: Hilfsfunktion zum Laden der Sicherheits-Bibliotheken ---
const loadSecurityLibs = async () => {
    const loadScript = (url) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };
    if (!window.CryptoJS) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');
    if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
};

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
  const fCur = (val, cur = data.settings?.baseCurrency || 'CHF') => formatCurrency(val, lang, cur);

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
      if (window.confirm(t('msgNewProjectWarning'))) {
          setFileHandle(null);
          setData({
              version: "Alpha-2", lastModified: new Date().toISOString(), settings: data.settings, 
              banks: [], budget: { incomeSources: [], expenses: [], subscriptions: [] },
              goals: { fire: { target: 500000, year: 2040 } }, scenarios: []
          });
          setSelectedNode(null); setActiveReport(null); showToast(t('msgNewProjectSuccess'), "success");
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
        let content;

        if (isZip) {
            const buffer = await file.arrayBuffer();
            const pin = window.prompt("Diese Datei ist verschlüsselt. Bitte PIN eingeben:");
            if (!pin) return;
            
            await loadSecurityLibs();
            const zip = await window.JSZip.loadAsync(buffer);
            const encryptedData = await zip.file("project.data.enc").async("string");
            const bytes = window.CryptoJS.AES.decrypt(encryptedData, pin);
            content = bytes.toString(window.CryptoJS.enc.Utf8);
            
            if (!content) throw new Error("Falscher PIN oder beschädigte Datei.");
        } else {
            content = await file.text();
        }

        const imported = JSON.parse(content);
        
        if (imported && imported.version) {
          const safeBudget = {
              incomeSources: imported.budget?.incomeSources || [],
              expenses: imported.budget?.expenses || [],
              subscriptions: imported.budget?.subscriptions || []
          };
          imported.budget = safeBudget;
          setFileHandle(isZip ? null : handle);
          setData(imported);
          showToast(t('msgOpenSuccess'), "success");
        }
      } catch (err) {
        if (err.name !== 'AbortError') showToast("Fehler beim Öffnen: " + err.message, "error");
      }
      return;
    }

    const file = e?.target?.files?.[0];
    if (!file) return;
    
    const isZip = file.name.endsWith('.zip');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        let content;
        
        if (isZip) {
            const pin = window.prompt("Diese Datei ist verschlüsselt. Bitte PIN eingeben:");
            if (!pin) return;
            
            await loadSecurityLibs();
            const zip = await window.JSZip.loadAsync(event.target.result);
            const encryptedData = await zip.file("project.data.enc").async("string");
            const bytes = window.CryptoJS.AES.decrypt(encryptedData, pin);
            content = bytes.toString(window.CryptoJS.enc.Utf8);
            
            if (!content) throw new Error("Falscher PIN oder beschädigte Datei.");
        } else {
            content = event.target.result;
        }

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
          showToast(t('msgOpenSuccess'), "success");
        } else {
            throw new Error(t('msgInvalidVersion'));
        }
      } catch (err) { 
        showToast("Fehler: " + err.message, "error"); 
      }
    };
    
    if (isZip) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file); 
    }
    
    if (e?.target) e.target.value = null; 
  };

  const handleSaveProject = async () => {
    const saveMethod = data.settings?.saveMethod || 'plaintext';
    const jsonStr = JSON.stringify(data, null, 2);
    let blob;
    let extension = 'json';

    if (saveMethod === 'zip') {
        const pin = window.prompt("Bitte einen PIN vergeben, um das Projekt zu verschlüsseln:");
        if (!pin) return;
        
        showToast("Verschlüsselung wird durchgeführt...", "success");
        await loadSecurityLibs();
        
        try {
            const encrypted = window.CryptoJS.AES.encrypt(jsonStr, pin).toString();
            const zip = new window.JSZip();
            zip.file("project.data.enc", encrypted);
            const zipContent = await zip.generateAsync({type: "blob"});
            blob = zipContent;
            extension = 'zip';
        } catch(err) {
            showToast("Fehler bei der Verschlüsselung: " + err.message, "error");
            return;
        }
    } else {
        blob = new Blob([jsonStr], { type: "application/json" });
    }

    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob);
    a.download = `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.${extension}`;
    a.click(); 
    showToast("Projekt erfolgreich exportiert", "success");
  };

  const handleExportCSV = () => {
      try {
          const csvStr = CsvEngine.exportCSV(data);
          const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `FinSPA_Buchungen_${new Date().toISOString().split('T')[0]}.csv`;
          a.click(); showToast(t('msgCsvSuccess'), "success");
      } catch (e) { showToast(t('msgCsvError'), "error"); }
  };

  const handleImportParqetCSV = (e) => {
    const target = e.target;
    const file = target.files[0];
    if (!file) {
      console.warn("[FinSPA Diagnose] Keine Datei ausgewählt.");
      return;
    }

    if (typeof importParqetCSV !== 'function') {
      console.error("[FinSPA Diagnose] KRITISCHER FEHLER: 'importParqetCSV' ist keine ausführbare Funktion!");
      showToast(t('msgImportModuleError'), "error");
      target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target.result;
        if (!csvContent) {
          showToast(t('msgFileEmpty'), "error");
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
          showToast(t('msgParqetSuccess'), "success");
        } else {
          showToast(t('msgNoValidAssets'), "error");
        }
      } catch (err) {
        showToast(`${t('msgProcessErrorPrefix')}${err.message}`, "error");
      }
      target.value = null;
    };
    reader.onerror = () => showToast(t('msgFileReadError'), "error");
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportCSV = (e) => { e.target.value = null; alert(t('msgCsvNotSupported')); };

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
    updateTreeData({ banks: recursiveUpdate(data.banks) }); showToast(t('msgRatesSynced'), "success");
  };

  const FormModal = () => {
      const baseCurrency = data.settings?.baseCurrency || 'CHF';
      const isForeignCurrency = selectedNode?.currency && selectedNode.currency !== baseCurrency;

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
              newData.scenarios.push({ id: generateId(), name: form.name||'Neu', date: form.date, impact: Number(form.impact||0) }); 
          } 
          else if (modalObj.type === 'addBank') { 
              newData.banks.push({ id: generateId(), name: form.name || 'Neue Bank', type: 'bank', isArchived: false, children: [] }); 
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
                  newData.budget[group] = [...newData.budget[group], { id: generateId(), name: form.name || 'Neuer Posten', amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' }];
              }
          } 
          else if (['addBooking', 'editBooking', 'addBalance', 'editBalance'].includes(modalObj.type)) {
              const updateRecursive = (nodes) => nodes.map(n => {
                  let copy = {...n};

                  if (form.targetAssetId && n.id === form.targetAssetId && modalObj.type === 'addBooking') {
                      if (!copy.bookings) copy.bookings = [];
                      copy.bookings.push({
                          id: generateId(),
                          date: form.date,
                          type: 'Einzahlung',
                          subCategory: form.type === 'Dividende' ? 'Dividenden' : 'Umbuchung Eingang',
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
                              saveCat = 'Umbuchung Ausgang';
                          }

                          copy.bookings.push({ 
                              id: modalObj.item?.id || generateId(), 
                              date: form.date, 
                              type: saveType, 
                              subCategory: saveCat, 
                              amount: Number(form.amount), 
                              shares: Number(form.shares||0), 
                              price: Number(form.price||0), 
                              fees: Number(form.fees||0), 
                              taxes: Number(form.taxes||0), 
                              bookingExchangeRate: Number(form.bookingExchangeRate||1) 
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
                          copy.children.push({ id: generateId(), name: form.name || 'Neue Kategorie', type: 'category', isArchived: false, children: [] });
                      } else {
                          const ac = form.assetClass || 'cash';
                          const isLiq = !['pension_cash', 'pension_fund', 'realestate', 'mortgage'].includes(ac);
                          copy.children.push({ id: generateId(), name: form.name || 'Neues Asset', type: 'asset', currency: 'CHF', exchangeRate: 1.0, isLiquid: isLiq, isArchived: false, assetClass: ac, balances: [], bookings: [] });
                      }
                      return copy;
                  }
                  if (n.children) return { ...n, children: updateRecursive(n.children) };
                  return n;
              });
              newData.banks = updateRecursive(newData.banks);
          }
          updateTreeData(newData); showToast(t('msgSaved'), "success"); setModalObj(null);
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
          showToast(t('msgDeleted'), "success"); setModalObj(null);
      };

      let availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung'];
      const ac = selectedNode?.assetClass;
      if (modalObj.type?.includes('Booking') && selectedNode?.type === 'asset') {
          if (ac === 'realestate') availableBookingTypes = ['Wertanpassung'];
          else if (ac === 'mortgage') availableBookingTypes = ['Abzahlung', 'Zinszahlung', 'Schulderhöhung'];
          else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) availableBookingTypes = ['Kauf', 'Verkauf', 'Dividende', 'Gebühr', 'Wertanpassung'];
          else if (['pension_cash', 'pension_3a_cash'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Zinszahlung', 'Gebühr'];
      }

      const activeBookingCategories = data.settings?.bookingCategories || defaultBookingCategories;
      const availableSubCategories = activeBookingCategories[form.type] || [];
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

      return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="font-bold text-lg">{modalObj.type.includes('edit') ? t('modalEdit') : t('modalNew')}</h3>
              <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto">

                {modalObj.type === 'editGoal' && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t('goalTarget')}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.target || ''} onChange={e=>setForm({...form, target: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t('goalYear')}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})}/>
                        </div>
                    </>
                )}

                {modalObj.type === 'addScenario' && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t('scenarioName')}</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t('scenarioDate')}</label>
                            <input type="date" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.date || ''} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">{t('scenarioImpact')}</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.impact || ''} onChange={e=>setForm({...form, impact: e.target.value})}/>
                        </div>
                    </>
                )}

                {(modalObj.type === 'addCategory' || modalObj.type === 'addAsset' || modalObj.type === 'addBank' || modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                    <>
                        <div>
                            <label className="block font-bold mb-1">{t('propName')}</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/>
                        </div>
                        {(modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                            <>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t('amount')}</label>
                                    <input type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.amount || ''} onChange={e=>setForm({...form, amount: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t('budgetFreq')}</label>
                                    <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.frequency || 'monthly'} onChange={e=>setForm({...form, frequency: e.target.value})}>
                                        <option value="monthly">{t('freqMonthly')}</option>
                                        <option value="yearly">{t('freqYearly')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold mb-1 mt-3">{t('budgetRuleCat')}</label>
                                    <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.ruleCategory || 'needs'} onChange={e=>setForm({...form, ruleCategory: e.target.value})}>
                                        <option value="needs">{t('ruleNeeds')}</option>
                                        <option value="wants">{t('ruleWants')}</option>
                                        <option value="savings">{t('ruleSavings')}</option>
                                    </select>
                                </div>
                            </>
                        )}
                        {modalObj.type === 'addAsset' && (
                            <div className="mt-3">
                                <label className="block font-bold mb-1">{t('assetClass')}</label>
                                <select className="w-full p-2 border rounded dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" value={form.assetClass || 'cash'} onChange={e => setForm({...form, assetClass: e.target.value})}>
                                    <option value="cash">{t('acCash')}</option>
                                    <option value="fund">{t('acFund')}</option>
                                    <option value="stock">{t('acStock')}</option>
                                    <option value="crypto">{t('acCrypto')}</option>
                                    <option value="realestate">{t('acRealEstate')}</option>
                                    <option value="mortgage">{t('acMortgage')}</option>
                                    <option value="pension_cash">{t('acPensionCash')}</option>
                                    <option value="pension_fund">{t('acPensionFund')}</option>
                                </select>
                            </div>
                        )}
                    </>
                )}

                {modalObj.type.includes('Balance') && (
                    <>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 mb-4 text-xs font-medium">{t('balanceNotice')}</div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('labelBalanceDate')}</label>
                            <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('labelAbsoluteBalance')} ({selectedNode?.currency || baseCurrency})</label>
                            <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                        </div>
                        {isForeignCurrency && (
                            <div>
                                <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t('labelExchangeRateDate')} ({selectedNode?.currency} -> {baseCurrency})</label>
                                <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                            </div>
                        )}
                    </>
                )}

                {modalObj.type.includes('Booking') && (
                    <>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('date') || 'Datum'}</label>
                            <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('entryType') || 'Typ'}</label>
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
                                            {t(translationKey)}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('amount') || 'Betrag'} ({selectedNode?.currency || baseCurrency})</label>
                            <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                        </div>
                        
                        {['Dividende', 'Umbuchung'].includes(form.type) && !modalObj.item && (
                            <div>
                                <label className="block font-bold mb-1 mt-3 text-xs uppercase text-gray-500">{t('targetAccount') || 'Zielkonto für Gutschrift'}</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.targetAssetId || ''} onChange={e=>setForm({...form, targetAssetId: e.target.value})}>
                                    <option value="">-- Optional: Zielkonto wählen --</option>
                                    {data.banks.map(bank => {
                                        const eligibleAssets = getAllAssets([bank]).filter(a => a.id !== selectedNode?.id && ['cash', 'pension_cash', 'pension_3a_cash'].includes(a.assetClass));                
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
                                <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('category') || 'Kategorie'}</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.subCategory || ''} onChange={e=>setForm({...form, subCategory: e.target.value})}>
                                    <option value="">-- Optional --</option>
                                    {availableSubCategories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t(cat)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isSecurities && ['Kauf', 'Verkauf', 'Dividende'].includes(form.type) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('shares') || 'Stücke'}</label>
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
                                    <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t('price') || 'Preis'}</label>
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
                                <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t('labelExchangeRateDate') || 'Wechselkurs'} ({selectedNode?.currency} -> {baseCurrency})</label>
                                <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                            </div>
                        )}
                    </>
                )}

            </div>
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0">
              {modalObj.item ? (
                  <button onClick={handleItemDelete} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors">
                      {t('btnDelete')}
                  </button>
              ) : <div></div>}
              <div className="flex gap-2">
                  <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 transition-colors">
                      {t('btnCancel')}
                  </button>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                      {t('btnSave')}
                  </button>
              </div>
            </div>
          </div>
        </div>
      );
  };

  const ModalHandler = () => {
      if (!modalObj || typeof modalObj !== 'object' || !modalObj.type) return null;

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
                          <h3 className="font-bold text-lg">{t('helpAbout')}</h3>
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
                          <p className="text-md font-bold text-blue-600 dark:text-blue-400 mt-1">Version Alpha-2</p>
                      </div>
                      
                      <hr className="border-gray-200 dark:border-slate-700 my-4" />
                      
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                          <p>{t('aboutDesc')}</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{t('aboutDev')}</p>
                          <p>&copy; {new Date().getFullYear()} Thomas Kerle. {t('aboutRights')}</p>
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-center">
                      <button onClick={() => setModalObj(null)} className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                          {t('btnClose')}
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
                          <h3 className="font-bold text-lg">{t('deleteNodeTitle')}</h3>
                      </div>
                      <div className="p-6 text-sm text-gray-700 dark:text-gray-300">
                          <p>{t('deleteNodeConfirmPrefix')} <strong>{node.name}</strong> {t('deleteNodeConfirmSuffix')}</p>
                          {!node.budgetType && <p className="mt-2 text-xs text-gray-500">{t('deleteNodeArchiveTip')}</p>}
                      </div>
                      <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-col gap-2">
                          {!node.isArchived && !node.budgetType && (
                              <button onClick={() => { handlePropChangeTree(node.id, 'isArchived', true); setModalObj(null); showToast(t('msgArchived'), "success"); }} className="w-full py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-lg transition-colors">
                                  {t('btnArchiveOnly')}
                              </button>
                          )}
                          <button onClick={() => { actuallyDeleteNode(node); setModalObj(null); showToast(t('msgDeletedPermanent'), "success"); }} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">
                              {t('btnDeletePermanent')}
                          </button>
                          <button onClick={() => setModalObj(null)} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors">
                              {t('btnCancel')}
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

      return <FormModal />;
  };

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col font-sans bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #printable-editor { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; overflow: visible !important; background: white !important; z-index: 9999; }
          body, html { background: white !important; color: black !important; margin: 0; padding: 0; }
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
                  <div className="w-2 h-2 rounded-full bg-green-500"></div> {t('statusReady')}
              </span>
              <span>Modus: <strong className="uppercase">{viewMode}</strong></span>
          </div>
          <div className="flex gap-6">
              <span>{t('version')}: {data.version}</span>
          </div>
      </div>
      
      <ModalHandler />
      
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