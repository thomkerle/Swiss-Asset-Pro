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
const Icon = getModule('Icons.jsx', () => safeRequire('./components/Icons.jsx'));

const App = () => {
  const [data, setData] = useState(initialData);
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

  useEffect(() => { setIsTreeVisible(!activeReport); }, [activeReport]);

  const showToast = (message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, {id, message, type}]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const handlePrint = () => window.print();

  const handleNewProject = () => {
      if (window.confirm("Achtung: Alle nicht gespeicherten Änderungen gehen verloren. Neues, leeres Projekt starten?")) {
          setData({
              version: "4.7", lastModified: new Date().toISOString(), settings: data.settings, 
              banks: [], budget: { incomeSources: [], expenses: [], subscriptions: [] },
              goals: { fire: { target: 500000, year: 2040 } }, scenarios: []
          });
          setSelectedNode(null); setActiveReport(null); showToast("Neues Projekt gestartet", "success");
      }
  };

  const handleOpenProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.version) { setData(imported); showToast("Projekt erfolgreich geöffnet!", "success"); } 
        else throw new Error("Keine gültige Version.");
      } catch (err) { showToast("Fehler beim Öffnen: Ungültiges JSON.", "error"); }
    };
    reader.readAsText(file); e.target.value = null; 
  };

  const handleSaveProject = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `FinSPA_Projekt_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); showToast("Projekt gesichert", "success");
  };

  const handleExportCSV = () => {
      try {
          const csvStr = CsvEngine.exportCSV(data);
          const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `FinSPA_Buchungen_${new Date().toISOString().split('T')[0]}.csv`;
          a.click(); showToast("CSV Export erfolgreich", "success");
      } catch (e) { showToast("Fehler beim CSV Export", "error"); }
  };

  const handleImportCSV = (e) => { e.target.value = null; alert("CSV Import wird im nächsten Release unterstützt."); };

  const updateTreeData = (newData) => setData({ ...data, lastModified: new Date().toISOString(), ...newData });

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
    updateTreeData({ banks: recursiveUpdate(data.banks) }); showToast("Wechselkurse synchronisiert", "success");
  };

  // Diese neue Komponente kapselt die Formulare, damit sie sauber rendern (behebt den weißen Bildschirm)
  const FormModal = () => {
      const [form, setForm] = useState(modalObj.item || { date: new Date().toISOString().split('T')[0], type: modalObj.defaultType || 'Einzahlung', amount: '', subCategory: '', shares: '', price: '', fees: '', taxes: '', bookingExchangeRate: selectedNode?.exchangeRate || 1 });

      const handleSave = () => {
          let newData = {...data};
          if (modalObj.type === 'editGoal') { newData.goals.fire = { target: Number(form.target||0), year: Number(form.year||2040) }; } 
          else if (modalObj.type === 'addScenario') { newData.scenarios.push({ id: generateId(), name: form.name||'Neu', date: form.date, impact: Number(form.impact||0) }); } 
          else if (modalObj.type === 'addBank') { newData.banks.push({ id: generateId(), name: form.name || 'Neue Bank', type: 'bank', isArchived: false, children: [] }); } 
          else if (modalObj.type === 'addBudget') {
              const group = modalObj.budgetGroup;
              newData.budget[group] = [...newData.budget[group], { id: generateId(), name: form.name || 'Neuer Posten', amount: Number(form.amount || 0), frequency: 'monthly' }];
          } else if (['addBooking', 'editBooking', 'addBalance', 'editBalance'].includes(modalObj.type)) {
              const updateRecursive = (nodes) => nodes.map(n => {
                  if (n.id === modalObj.assetId) {
                      let copy = {...n};
                      if (modalObj.type.includes('Booking')) {
                          if (!copy.bookings) copy.bookings = [];
                          if (modalObj.item) copy.bookings = copy.bookings.filter(b=>b.id !== modalObj.item.id);
                          copy.bookings.push({ id: modalObj.item?.id || generateId(), date: form.date, type: form.type, subCategory: form.subCategory, amount: Number(form.amount), shares: Number(form.shares||0), price: Number(form.price||0), fees: Number(form.fees||0), taxes: Number(form.taxes||0), bookingExchangeRate: Number(form.bookingExchangeRate||1) });
                      } else {
                          if (!copy.balances) copy.balances = [];
                          if (modalObj.item) copy.balances = copy.balances.filter(b=>b.id !== modalObj.item.id);
                          copy.balances.push({ id: modalObj.item?.id || generateId(), date: form.date, amount: Number(form.amount), bookingExchangeRate: Number(form.bookingExchangeRate||1) });
                      }
                      return copy;
                  }
                  if (n.children) return { ...n, children: updateRecursive(n.children) };
                  return n;
              });
              newData.banks = updateRecursive(newData.banks);
              if (selectedNode && selectedNode.id === modalObj.assetId) {
                  const getUpdatedNode = (nodes) => { for(let i=0; i<nodes.length; i++) { if(nodes[i].id === selectedNode.id) return nodes[i]; if(nodes[i].children) { let r = getUpdatedNode(nodes[i].children); if(r) return r; } } };
                  setSelectedNode(getUpdatedNode(newData.banks));
              }
          } else if (modalObj.type === 'addCategory' || modalObj.type === 'addAsset') {
              const updateRecursive = (nodes) => nodes.map(n => {
                  if (n.id === modalObj.parentId) {
                      let copy = {...n};
                      if (!copy.children) copy.children = [];
                      if (modalObj.type === 'addCategory') copy.children.push({ id: generateId(), name: form.name || 'Neue Kategorie', type: 'category', isArchived: false, children: [] });
                      else {
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
          updateTreeData(newData); showToast("Gespeichert!", "success"); setModalObj(null);
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
          showToast("Gelöscht!", "success"); setModalObj(null);
      };

      let availableBookingTypes = ['Einzahlung', 'Auszahlung'];
      if (modalObj.type?.includes('Booking') && selectedNode?.type === 'asset') {
          const ac = selectedNode.assetClass;
          if (ac === 'realestate') availableBookingTypes = ['Wertanpassung'];
          else if (ac === 'mortgage') availableBookingTypes = ['Abzahlung', 'Zinszahlung', 'Schulderhöhung'];
          else if (ac === 'stock' || ac === 'fund' || ac === 'crypto' || ac === 'pension_fund') availableBookingTypes = ['Kauf', 'Verkauf', 'Dividende', 'Gebühr'];
          else if (ac === 'pension_cash') availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Zinszahlung', 'Gebühr'];
      }

      const activeBookingCategories = data.settings?.bookingCategories || defaultBookingCategories;
      const availableSubCategories = activeBookingCategories[form.type] || [];
      const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund'].includes(selectedNode?.assetClass);

      return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="font-bold text-lg">{modalObj.type.includes('edit') ? 'Bearbeiten' : 'Neu erfassen'}</h3>
              <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
            </div>
            <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto">
                {modalObj.type === 'editGoal' && (
                    <>
                        <div><label className="block font-bold mb-1">Zielbetrag (FIRE)</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.target || ''} onChange={e=>setForm({...form, target: e.target.value})}/></div>
                        <div><label className="block font-bold mb-1">Zieljahr</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})}/></div>
                    </>
                )}
                {modalObj.type === 'addScenario' && (
                    <>
                        <div><label className="block font-bold mb-1">Szenario Name</label><input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/></div>
                        <div><label className="block font-bold mb-1">Datum (Eintritt)</label><input type="date" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.date || ''} onChange={e=>setForm({...form, date: e.target.value})}/></div>
                        <div><label className="block font-bold mb-1">Impact (positiv oder negativ)</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.impact || ''} onChange={e=>setForm({...form, impact: e.target.value})}/></div>
                    </>
                )}
                {(modalObj.type === 'addCategory' || modalObj.type === 'addAsset' || modalObj.type === 'addBank' || modalObj.type === 'addBudget') && (
                    <>
                        <div><label className="block font-bold mb-1">Bezeichnung</label><input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/></div>
                        {modalObj.type === 'addBudget' && <div><label className="block font-bold mb-1 mt-3">Betrag</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.amount || ''} onChange={e=>setForm({...form, amount: e.target.value})}/></div>}
                        {modalObj.type === 'addAsset' && (
                            <div className="mt-3">
                                <label className="block font-bold mb-1">Anlageklasse</label>
                                <select className="w-full p-2 border rounded dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" value={form.assetClass || 'cash'} onChange={e=>setForm({...form, assetClass: e.target.value})}>
                                    <option value="cash">{t('acCash')}</option><option value="fund">{t('acFund')}</option><option value="stock">{t('acStock')}</option><option value="crypto">{t('acCrypto')}</option><option value="realestate">{t('acRealEstate')}</option><option value="mortgage">{t('acMortgage')}</option><option value="pension_cash">{t('acPensionCash')}</option><option value="pension_fund">{t('acPensionFund')}</option>
                                </select>
                            </div>
                        )}
                    </>
                )}
                {modalObj.type.includes('Booking') && (
                    <>
                        <div><label className="block font-bold mb-1 text-xs uppercase text-gray-500">Datum</label><input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold mb-1 text-xs uppercase text-gray-500">Transaktionstyp</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
                                    {availableBookingTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold mb-1 text-xs uppercase text-gray-500">Detail-Kategorie</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" value={form.subCategory} onChange={e=>setForm({...form, subCategory: e.target.value})}>
                                    <option value="">-- Wählen --</option>
                                    {availableSubCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        {isSecurities && (
                            <div className="bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700 p-4 rounded-xl space-y-4">
                                <div className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2"><Icon name="List" size={12}/> Transaktionsdetails</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Stückzahl</label><input type="number" step="0.0001" className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.shares} onChange={e=>setForm({...form, shares: e.target.value})}/></div>
                                    <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Preis pro Stück</label><input type="number" step="0.01" className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.price} onChange={e=>setForm({...form, price: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Gebühren</label><input type="number" step="0.01" className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.fees} onChange={e=>setForm({...form, fees: e.target.value})}/></div>
                                    <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Steuern</label><input type="number" step="0.01" className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.taxes} onChange={e=>setForm({...form, taxes: e.target.value})}/></div>
                                </div>
                                <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Wechselkurs (zum Transaktionszeitpunkt)</label><input type="number" step="0.0001" className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/></div>
                            </div>
                        )}
                        <div><label className="block font-bold mb-1 text-xs uppercase text-gray-500">Totalbetrag (Gesamt in {selectedNode?.currency})</label><input type="number" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/></div>
                    </>
                )}
                {modalObj.type.includes('Balance') && (
                    <>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 mb-4 text-xs font-medium">Setzt den absoluten Stichtags-Saldo des gesamten Assets.</div>
                        <div><label className="block font-bold mb-1 text-xs uppercase text-gray-500">Stichtag</label><input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/></div>
                        <div><label className="block font-bold mb-1 text-xs uppercase text-gray-500">Absoluter Saldo</label><input type="number" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/></div>
                        <div><label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">Wechselkurs (zum Stichtag - Optional)</label><input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/></div>
                    </>
                )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0">
              {modalObj.item ? <button onClick={handleItemDelete} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors">Löschen</button> : <div></div>}
              <div className="flex gap-2">
                  <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 transition-colors">Abbrechen</button>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">Speichern</button>
              </div>
            </div>
          </div>
        </div>
      );
  };

  const ModalHandler = () => {
      if (!modalObj) return null;
      if (modalObj.type === 'settings') return <SettingsModal data={data} updateTreeData={updateTreeData} setModalObj={setModalObj} showToast={showToast} defaultBookingCategories={defaultBookingCategories} t={t} />;
      if (modalObj.type === 'help') return <HelpViewer setModalObj={setModalObj} lang={lang} />;
      
      if (modalObj.type === 'deleteNode') {
          const node = modalObj.node;
          return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2"><Icon name="Trash" className="text-red-500" /><h3 className="font-bold text-lg">Element entfernen</h3></div>
                      <div className="p-6 text-sm text-gray-700 dark:text-gray-300">
                          <p>Möchten Sie <strong>{node.name}</strong> wirklich löschen?</p>
                          {!node.budgetType && <p className="mt-2 text-xs text-gray-500">Tipp: Durch das Archivieren bleibt das Element erhalten, wird aber ausgeblendet.</p>}
                      </div>
                      <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-col gap-2">
                          {!node.isArchived && !node.budgetType && (
                              <button onClick={() => { handlePropChangeTree(node.id, 'isArchived', true); setModalObj(null); showToast("Element archiviert", "success"); }} className="w-full py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-lg transition-colors">Nur Archivieren</button>
                          )}
                          <button onClick={() => { actuallyDeleteNode(node); setModalObj(null); showToast("Endgültig gelöscht", "success"); }} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Endgültig löschen</button>
                          <button onClick={() => setModalObj(null)} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-bold rounded-lg transition-colors">Abbrechen</button>
                      </div>
                  </div>
              </div>
          );
      }

      // Alle Buchungs- und Asset-Formulare laufen jetzt über eine dedizierte Komponente!
      return <FormModal />;
  };

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col font-sans bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <MenuBar viewMode={viewMode} setViewMode={setViewMode} setActiveReport={setActiveReport} setSelectedNode={setSelectedNode} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} setModalObj={setModalObj} t={t} handleNewProject={handleNewProject} handleOpenProject={handleOpenProject} handleSaveProject={handleSaveProject} handleExportCSV={handleExportCSV} handleImportCSV={handleImportCSV} handlePrint={handlePrint} />
      <div className="flex-1 flex overflow-hidden relative">
        <TreeView data={data} viewMode={viewMode} selectedNode={selectedNode} setSelectedNode={setSelectedNode} setActiveReport={setActiveReport} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} showArchived={showArchived} setShowArchived={setShowArchived} expandedNodes={expandedNodes} toggleExpand={toggleExpand} deleteNode={requestDeleteNode} setModalObj={setModalObj} t={t} />
        <div className="flex-1 relative overflow-auto" id="printable-editor">
          <EditorArea data={data} viewMode={viewMode} activeReport={activeReport} selectedNode={selectedNode} isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} showArchived={showArchived} dateRange={dateRange} setDateRange={setDateRange} setModalObj={setModalObj} fCur={fCur} t={t} />
        </div>
        <PropertyEditor data={data} activeReport={activeReport} selectedNode={selectedNode} setSelectedNode={setSelectedNode} updateTreeData={updateTreeData} syncExchangeRates={syncExchangeRates} t={t} />
      </div>
      <div className="print-hide flex justify-between items-center bg-gray-100 dark:bg-slate-900 border-t border-gray-300 dark:border-slate-800 px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400 z-50">
          <div className="flex gap-6"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('statusReady')}</span><span>Modus: <strong className="uppercase">{viewMode}</strong></span></div>
          <div className="flex gap-6"><span>{t('version')}: {data.version}</span></div>
      </div>
      <ModalHandler />
      <div className="fixed bottom-4 right-4 z-[200] space-y-2 pointer-events-none">
          {toasts.map(toast => (<div key={toast.id} className="px-4 py-3 rounded-lg shadow-xl border bg-slate-800 text-white border-slate-700">{toast.message}</div>))}
      </div>
    </div>
  );
};
module.exports = App;