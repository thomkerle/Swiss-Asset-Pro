const React = require('react');
const { useState } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const { 
  generateId = () => Math.random().toString(36).substr(2, 9),
  getAllAssets = (banks) => []
} = DataEngine;

const PdfExportEngine = safeRequire('./print/PdfExportEngine.jsx') || safeRequire('../print/PdfExportEngine.jsx') || { 
  exportReport: () => alert('PdfExportEngine konnte nicht geladen werden.') 
};

const FormModal = ({ data, modalObj, setModalObj, selectedNode, setSelectedNode, updateTreeData, t, defaultBookingCategories }) => {
    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const isForeignCurrency = selectedNode?.currency && selectedNode.currency !== baseCurrency;

    const getActualShares = (node) => {
        if (!node) return 0;
        let sh = 0;
        if (node.bookings) {
            node.bookings.forEach(b => {
                if (['Kauf', 'Einzahlung'].includes(b.type) && b.shares) sh += Number(b.shares);
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
        fromDate: `${new Date().getFullYear()}-01-01`, 
        toDate: new Date().toISOString().split('T')[0],
        filterType: 'all', 
        type: modalObj.defaultType || 'Einzahlung', 
        amount: '', subCategory: '', comment: '', shares: '', price: '', fees: '', taxes: '', 
        bookingExchangeRate: isForeignCurrency ? (selectedNode?.exchangeRate || 1) : 1,
        targetAssetId: '',
        bulkOperation: 'delete'
    });

    // --- NEU: Globale Hilfsfunktion um das UI sofort neu zu zeichnen ---
    const refreshActiveNode = (newBanks) => {
        if (!selectedNode) return;
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.id === selectedNode.id) return n;
                if (n.children) {
                    let r = findNode(n.children);
                    if (r) return r;
                }
            }
            return null;
        };
        const updatedNode = findNode(newBanks);
        if (updatedNode) setSelectedNode(updatedNode);
    };

    const handlePrintAssetBookings = () => {
        const { fromDate, toDate, filterType } = form;
        const items = [...(selectedNode.balances || []).map(b => ({ ...b, _isBal: true })), ...(selectedNode.bookings || [])];

        const filtered = items.filter(item => {
            if (fromDate && item.date < fromDate) return false;
            if (toDate && item.date > toDate) return false;
            if (filterType !== 'all') {
                if (item._isBal) return false; 
                const isFlowIn = ['Einzahlung', 'Kauf', 'Dividende', 'Zinszahlung'].includes(item.type);
                const isFlowOut = ['Auszahlung', 'Verkauf', 'Gebühr', 'Abzahlung', 'Schulderhöhung', 'Umbuchung'].includes(item.type);
                const isReval = item.type === 'Wertanpassung';
                if (filterType === 'in' && !isFlowIn) return false;
                if (filterType === 'out' && !isFlowOut) return false;
                if (filterType === 'reval' && !isReval) return false;
            }
            return true;
        });

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tableHeaders = [t ? t('date') || 'Datum' : 'Datum', t ? t('entryType') || 'Eintrag' : 'Eintrag', t ? t('entryDetail') || 'Detail' : 'Detail', t ? t('amount') || 'Betrag' : 'Betrag'];

        const tableBody = filtered.map(item => {
            let typeLabel = item.type;
            if (item._isBal) typeLabel = t ? t('balanceLabel') || 'SALDO' : 'SALDO';
            else {
                const typeMap = { 'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee', 'Umbuchung': 'typeTransfer' };
                if (typeMap[item.type] && t) typeLabel = t(typeMap[item.type]);
            }

            let details = item._isBal ? (t ? t('systemManual') || 'System/Manuell' : 'System/Manuell') : (item.subCategory || '');
            if (item.comment) details += ` | ${item.comment}`; 
            if (!item._isBal && ['Kauf', 'Verkauf'].includes(item.type) && item.shares) details += ` (${item.shares} ${t ? t('pcsAt') || 'Stk. à' : 'Stk. à'} ${item.price})`;

            let displayAmount = Number(item.amount);
            let isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
            if (item.type === 'Wertanpassung' && displayAmount < 0) { isPositiveType = false; displayAmount = Math.abs(displayAmount); }

            const prefix = !item._isBal ? (isPositiveType ? '+' : '-') : '';
            const currency = selectedNode?.currency || baseCurrency;
            const formattedAmount = `${prefix}${displayAmount.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`;

            return [item.date, typeLabel, details, formattedAmount];
        });

        if (tableBody.length === 0) {
            tableBody.push([{ text: t ? t('noEntries') || 'Keine Einträge.' : 'Keine Einträge.', colSpan: 4, alignment: 'center' }, {}, {}, {}]);
        } else {
            let totalIn = 0; let totalOut = 0; const currency = selectedNode?.currency || baseCurrency;
            filtered.forEach(item => {
                if (item._isBal) return;
                let amt = Number(item.amount || 0);
                let isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
                if (item.type === 'Wertanpassung' && amt < 0) { isPositiveType = false; amt = Math.abs(amt); }
                if (isPositiveType) totalIn += amt; else totalOut += amt;
            });

            tableBody.push(["", "", "", ""]);
            tableBody.push([{ text: t ? t('totalIn') || 'Total Ein (+)' : 'Total Ein (+)', bold: true }, "", "", { text: `+${totalIn.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
            tableBody.push([{ text: t ? t('totalOut') || 'Total Aus (-)' : 'Total Aus (-)', bold: true }, "", "", { text: `-${totalOut.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
            const netFlow = totalIn - totalOut; const netPrefix = netFlow >= 0 ? '+' : '';
            tableBody.push([{ text: t ? t('totalNet') || 'Total Netto' : 'Total Netto', bold: true }, "", "", { text: `${netPrefix}${netFlow.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
        }

        let filterLabel = t ? t('filterAll') || "Alle Buchungen" : "Alle Buchungen";
        if (filterType === 'in') filterLabel = t ? t('filterIn') || "Nur Zuflüsse/Einzahlungen" : "Nur Zuflüsse/Einzahlungen";
        if (filterType === 'out') filterLabel = t ? t('filterOut') || "Nur Abflüsse/Auszahlungen" : "Nur Abflüsse/Auszahlungen";
        if (filterType === 'reval') filterLabel = t ? t('filterReval') || "Nur Wertanpassungen" : "Nur Wertanpassungen";

        PdfExportEngine.exportReport({ title: `${t ? t('bookingJournal') || 'Buchungsjournal' : 'Buchungsjournal'} - ${selectedNode.name}`, subtitle: `${t ? t('dateRangeTitle') || 'Zeitraum:' : 'Zeitraum:'} ${fromDate || 'Anfang'} ${t ? t('wordTo') || 'bis' : 'bis'} ${toDate || 'Heute'} | Filter: ${filterLabel} | Währung: ${selectedNode.currency || baseCurrency}`, tableHeaders, tableBody, data });
        setModalObj(null);
    };

    const handleSave = () => {
        let newData = {...data};

        if (modalObj.type === 'bulkAction') {
            const updateRecursive = (nodes) => nodes.map(n => {
                if (n.id === modalObj.assetId) {
                    let copy = {...n};
                    if (form.bulkOperation === 'delete') {
                        if (copy.bookings) copy.bookings = copy.bookings.filter(b => !modalObj.selectedIds.includes(b.id));
                        if (copy.balances) copy.balances = copy.balances.filter(b => !modalObj.selectedIds.includes(b.id));
                    } else if (form.bulkOperation === 'changeCategory' && form.subCategory) {
                        if (copy.bookings) copy.bookings = copy.bookings.map(b => modalObj.selectedIds.includes(b.id) ? { ...b, subCategory: form.subCategory } : b);
                    } else if (form.bulkOperation === 'changeComment' && form.comment) {
                        if (copy.bookings) copy.bookings = copy.bookings.map(b => modalObj.selectedIds.includes(b.id) ? { ...b, comment: form.comment } : b);
                    } else if (form.bulkOperation === 'changeDate' && form.date) {
                        if (copy.bookings) copy.bookings = copy.bookings.map(b => modalObj.selectedIds.includes(b.id) ? { ...b, date: form.date } : b);
                        if (copy.balances) copy.balances = copy.balances.map(b => modalObj.selectedIds.includes(b.id) ? { ...b, date: form.date } : b);
                    }
                    return copy;
                }
                if (n.children) return { ...n, children: updateRecursive(n.children) };
                return n;
            });
            newData.banks = updateRecursive(newData.banks);
            if (typeof window !== 'undefined' && window.showToast) window.showToast(`${modalObj.selectedIds.length} ${t ? t('msgEntriesEdited') || 'Einträge bearbeitet' : 'Einträge bearbeitet'}`, "success");
            
            updateTreeData(newData);
            refreshActiveNode(newData.banks); // --- NEU: Erzwingt sofortiges Neuladen bei Bulk-Actions ---
            setModalObj(null);
            return;
        }

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
                    item.id === modalObj.item.id ? { ...item, name: form.name, amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' } : item
                );
            } else {
                newData.budget[group] = [...newData.budget[group], { id: generateId(), name: form.name || (t('newBudgetItem')||'Neuer Posten'), amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' }];
            }
        } 
        else if (['addBooking', 'editBooking', 'addBalance', 'editBalance'].includes(modalObj.type)) {
            const bookingRate = form.bookingExchangeRate ? parseFloat(String(form.bookingExchangeRate).replace(',', '.')) : 0;
            const nodeRate = selectedNode?.exchangeRate ? parseFloat(String(selectedNode.exchangeRate).replace(',', '.')) : 1;
            const sourceRate = isForeignCurrency ? (bookingRate || nodeRate || 1) : 1;
            const amountInBaseCurrency = (Number(form.amount) || 0) * sourceRate;

            const updateRecursive = (nodes) => nodes.map(n => {
                let copy = {...n};

                if (form.targetAssetId && n.id === form.targetAssetId && modalObj.type === 'addBooking') {
                    if (!copy.bookings) copy.bookings = [];
                    const isTargetSecurity = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(copy.assetClass);
                    const isTargetForeign = copy.currency && copy.currency !== baseCurrency;
                    let targetRate = copy.exchangeRate ? parseFloat(String(copy.exchangeRate).replace(',', '.')) : 1;
                    if (!isTargetForeign) targetRate = 1;
                    const finalTargetAmount = targetRate !== 0 ? (amountInBaseCurrency / targetRate) : amountInBaseCurrency;

                    copy.bookings.push({
                        id: generateId(), date: form.date, type: isTargetSecurity ? 'Kauf' : 'Einzahlung', 
                        subCategory: form.type === 'Dividende' ? (t('divIn')||'Dividenden Eingang') : (t('transferIn')||'Umbuchung Eingang'),
                        amount: Number(finalTargetAmount.toFixed(2)), bookingExchangeRate: isTargetForeign ? targetRate : 1
                    });
                }

                if (n.id === modalObj.assetId) {
                    if (modalObj.type.includes('Booking')) {
                        if (!copy.bookings) copy.bookings = [];
                        if (modalObj.item) copy.bookings = copy.bookings.filter(b=>b.id !== modalObj.item.id);
                        
                        let saveType = form.type; let saveCat = form.subCategory;
                        if (form.type === 'Umbuchung') { saveType = 'Auszahlung'; saveCat = t('transferOut') || 'Umbuchung Ausgang'; }

                        copy.bookings.push({ 
                            id: modalObj.item?.id || generateId(), date: form.date, type: saveType, subCategory: saveCat, 
                            comment: form.comment, 
                            amount: Number(form.amount || 0), shares: saveType === 'Wertanpassung' ? undefined : (form.shares ? Number(form.shares) : undefined), 
                            price: form.price ? Number(form.price) : undefined, fees: form.fees ? Number(form.fees) : undefined, 
                            taxes: form.taxes ? Number(form.taxes) : undefined, bookingExchangeRate: form.bookingExchangeRate ? Number(form.bookingExchangeRate) : 1 
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
            refreshActiveNode(newData.banks); // --- NEU: Erzwingt sofortiges Neuladen bei Speichern ---
        } 
        else if (modalObj.type === 'addCategory' || modalObj.type === 'addAsset' || modalObj.type === 'addBank' || modalObj.type === 'addBudget' || modalObj.type === 'editBudget') {
            const updateRecursive = (nodes) => nodes.map(n => {
                if (n.id === modalObj.parentId) {
                    let copy = {...n};
                    if (!copy.children) copy.children = [];
                    if (modalObj.type === 'addCategory') {
                        copy.children.push({ id: generateId(), name: form.name || (t('newCategoryName')||'Neue Kategorie'), type: 'category', isArchived: false, children: [] });
                    } else {
                        const ac = form.assetClass || 'cash';
                        const isLiq = !['pension_cash', 'pension_fund', 'realestate', 'mortgage', 'pension_3a_managed'].includes(ac);
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
                if (modalObj.type.includes('Booking') && copy.bookings) copy.bookings = copy.bookings.filter(b => b.id !== modalObj.item.id);
                else if (modalObj.type.includes('Balance') && copy.balances) copy.balances = copy.balances.filter(b => b.id !== modalObj.item.id);
                return copy;
            }
            if (n.children) return { ...n, children: updateRecursive(n.children) };
            return n;
        });
        newData.banks = updateRecursive(newData.banks);
        updateTreeData(newData);
        
        refreshActiveNode(newData.banks); // --- NEU: Der Bug-Fix. Erzwingt das sofortige Rendern der Tabelle ---

        if (typeof window !== 'undefined' && window.showToast) window.showToast(t ? t('msgDeleted') || "Gelöscht" : "Gelöscht", "success");
        setModalObj(null);
    };

    let availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung'];
    const ac = selectedNode?.assetClass;
    if (modalObj.type?.includes('Booking') && selectedNode?.type === 'asset') {
        if (ac === 'realestate') availableBookingTypes = ['Wertanpassung'];
        else if (ac === 'mortgage') availableBookingTypes = ['Abzahlung', 'Zinszahlung', 'Schulderhöhung'];
        else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) availableBookingTypes = ['Kauf', 'Verkauf', 'Dividende', 'Gebühr', 'Wertanpassung'];
        else if (['pension_cash', 'pension_3a_cash'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Zinszahlung', 'Gebühr'];
        else if (['managed_fund', 'pension_3a_managed'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Wertanpassung', 'Gebühr'];
    }

    const activeBookingCategories = data.settings?.bookingCategories || defaultBookingCategories || {};
    const availableSubCategories = activeBookingCategories[form.type] || [];
    const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

    const currentSh = getActualShares(selectedNode);
    const currentPr = getActualPrice(selectedNode);

    let modalTitle = modalObj.type.includes('edit') ? (t ? t('modalEdit') : 'Bearbeiten') : (t ? t('modalNew') : 'Neu');
    if (modalObj.type === 'printAssetBookings') modalTitle = t ? t('printTitle') || 'Journal Drucken' : 'Journal Drucken';
    if (modalObj.type === 'bulkAction') modalTitle = t ? t('titleBulkAction') || 'Massenbearbeitung' : 'Massenbearbeitung';

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
          
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                {modalObj.type === 'bulkAction' && <Icon name="Layers" className="text-indigo-500" />}
                {modalTitle}
            </h3>
            <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700"><Icon name="X" size={20}/></button>
          </div>
          
          <div className="p-6 space-y-5 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto finspa-scrollbar">

              {modalObj.type === 'bulkAction' && (
                  <div className="space-y-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50 text-sm font-medium shadow-sm flex items-start gap-3">
                          <Icon name="Info" size={18} className="mt-0.5 shrink-0" />
                          <span>{t ? t('descBulkEdit1') || 'Sie bearbeiten aktuell' : 'Sie bearbeiten aktuell'} <strong>{modalObj.selectedIds.length}</strong> {t ? t('descBulkEdit2') || 'ausgewählte Einträge.' : 'ausgewählte Einträge.'}</span>
                      </div>
                      
                      <div>
                          <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{t ? t('labelSelectAction') || 'Aktion wählen' : 'Aktion wählen'}</label>
                          <select 
                              className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                              value={form.bulkOperation} 
                              onChange={e => setForm({...form, bulkOperation: e.target.value})}
                          >
                              <option value="delete">{t ? t('optBulkDelete') || 'Ausgewählte Einträge löschen' : 'Ausgewählte Einträge löschen'}</option>
                              <option value="changeCategory">{t ? t('optBulkCategory') || 'Kategorie (Dropdown) ändern' : 'Kategorie (Dropdown) ändern'}</option>
                              <option value="changeComment">{t ? t('optBulkComment') || 'Kommentar / Tags in Masse setzen' : 'Kommentar / Tags in Masse setzen'}</option>
                              <option value="changeDate">{t ? t('optBulkDate') || 'Datum für alle ändern' : 'Datum für alle ändern'}</option>
                          </select>
                      </div>

                      {form.bulkOperation === 'changeCategory' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{t ? t('labelSetNewCategory') || 'Neue Kategorie setzen' : 'Neue Kategorie setzen'}</label>
                              <input type="text" list="bulk-categories" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={t ? t('placeholderCategory') || 'Kategorie wählen oder tippen...' : 'Kategorie wählen oder tippen...'} value={form.subCategory || ''} onChange={e => setForm({...form, subCategory: e.target.value})} />
                              <datalist id="bulk-categories">
                                  {Object.values(activeBookingCategories).flat().filter((v,i,a)=>a.indexOf(v)===i).map(cat => <option key={cat} value={cat} />)}
                              </datalist>
                          </div>
                      )}

                      {form.bulkOperation === 'changeComment' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{t ? t('labelSetNewComment') || 'Neuer Kommentar / Tags' : 'Neuer Kommentar / Tags'}</label>
                              <input type="text" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="#Steuererklärung2026" value={form.comment || ''} onChange={e => setForm({...form, comment: e.target.value})} />
                          </div>
                      )}

                      {form.bulkOperation === 'changeDate' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{t ? t('labelSetNewDate') || 'Neues Datum setzen' : 'Neues Datum setzen'}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums" value={form.date || ''} onChange={e => setForm({...form, date: e.target.value})} />
                          </div>
                      )}
                  </div>
              )}

              {modalObj.type === 'printAssetBookings' && (
                  <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 mb-4 text-xs font-medium">
                          {t ? t('printBookingsNotice') || 'Wählen Sie Zeitraum und Buchungsart für den Export.' : 'Wählen Sie Zeitraum und Buchungsart für den Export.'}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('fromDate') || 'Von Datum' : 'Von Datum'}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.fromDate || ''} onChange={e=>setForm({...form, fromDate: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('toDate') || 'Bis Datum' : 'Bis Datum'}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.toDate || ''} onChange={e=>setForm({...form, toDate: e.target.value})}/>
                          </div>
                      </div>
                      <div className="mt-2">
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('filterBookings') || 'Buchungen filtern' : 'Buchungen filtern'}</label>
                          <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.filterType} onChange={e=>setForm({...form, filterType: e.target.value})}>
                              <option value="all">{t ? t('filterAll') || 'Alle Buchungen & Salden' : 'Alle Buchungen & Salden'}</option>
                              <option value="in">{t ? t('filterIn') || 'Nur Zuflüsse (Einzahlung, Kauf, Zins...)' : 'Nur Zuflüsse (Einzahlung, Kauf, Zins...)'}</option>
                              <option value="out">{t ? t('filterOut') || 'Nur Abflüsse (Auszahlung, Verkauf, Gebühr...)' : 'Nur Abflüsse (Auszahlung, Verkauf, Gebühr...)'}</option>
                              <option value="reval">{t ? t('filterReval') || 'Nur Wertanpassungen' : 'Nur Wertanpassungen'}</option>
                          </select>
                      </div>
                  </>
              )}

              {modalObj.type === 'editGoal' && (
                  <>
                      <div>
                          <label className="block font-bold mb-1">{t ? t('goalTarget') : 'Zielwert'}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.target || ''} onChange={e=>setForm({...form, target: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1">{t ? t('goalYear') : 'Zieljahr'}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})}/>
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
                          <input type="date" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.date || ''} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1">{t ? t('scenarioImpact') : 'Auswirkung'}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.impact || ''} onChange={e=>setForm({...form, impact: e.target.value})}/>
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
                                  <input type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.amount || ''} onChange={e=>setForm({...form, amount: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block font-bold mb-1 mt-3">{t ? t('budgetFreq') : 'Frequenz'}</label>
                                  <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.frequency || 'monthly'} onChange={e=>setForm({...form, frequency: e.target.value})}>
                                      <option value="monthly">{t ? t('freqMonthly') : 'Monatlich'}</option>
                                      <option value="yearly">{t ? t('freqYearly') : 'Jährlich'}</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block font-bold mb-1 mt-3">{t ? t('ruleNeeds') : 'Regelwerk'}</label>
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
                                  <option value="managed_fund">{t ? t('acManagedFund') : 'Verwaltetes Portfolio (Robo-Advisor)'}</option>
                                  <option value="pension_3a_managed">{t ? t('acPension3aManaged') : '3a Fonds (Gesamtwert)'}</option>
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
                          <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('labelAbsoluteBalance') : 'Saldo'} ({selectedNode?.currency || baseCurrency})</label>
                          <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold tabular-nums" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                      </div>
                      {isForeignCurrency && (
                          <div>
                              <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t ? t('labelExchangeRateDate') : 'Kurs'} ({selectedNode?.currency} -> {baseCurrency})</label>
                              <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white tabular-nums" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                          </div>
                      )}
                  </>
              )}

              {modalObj.type.includes('Booking') && modalObj.type !== 'printAssetBookings' && (
                  <>
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('date') : 'Datum'}</label>
                          <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>

                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('entryType') : 'Typ'}</label>
                          <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.type} onChange={e=>setForm({...form, type: e.target.value, subCategory: ''})}>
                              {availableBookingTypes.map(tOption => {
                                  const typeMap = { 'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee', 'Umbuchung': 'typeTransfer' };
                                  const translationKey = typeMap[tOption] || tOption;
                                  return <option key={tOption} value={tOption}>{t ? t(translationKey) : tOption}</option>;
                              })}
                          </select>
                      </div>

                      {!(isSecurities && form.type === 'Wertanpassung') && (
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('amount') : 'Betrag'} ({selectedNode?.currency || baseCurrency})</label>
                              <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold tabular-nums" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                          </div>
                      )}

                      {isSecurities && (
                          <div className={`grid gap-3 mt-3 ${form.type === 'Wertanpassung' ? 'grid-cols-1 bg-emerald-50/50 dark:bg-emerald-900/20 p-4 border border-emerald-200 dark:border-emerald-800/50 rounded-xl' : 'grid-cols-2'}`}>
                              
                              {['Kauf', 'Verkauf'].includes(form.type) && (
                                  <div>
                                      <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('shares') : 'Stücke'}</label>
                                      <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.shares || ''} onChange={e => { const sh = e.target.value; const pr = form.price || 0; setForm({ ...form, shares: sh, amount: sh && pr ? (Number(sh) * Number(pr)).toFixed(2) : form.amount }); }}/>
                                  </div>
                              )}
                              
                              <div className={['Kauf', 'Verkauf'].includes(form.type) ? "" : "col-span-2"}>
                                  <label className={`block font-bold mb-1 text-xs uppercase ${form.type === 'Wertanpassung' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}`}>
                                      {form.type === 'Wertanpassung' ? (t ? t('labelNewMarketPrice') || 'Neuer Börsenkurs' : 'Neuer Börsenkurs') : (t ? t('labelMarketPriceOpt') || 'Börsenkurs (Optional)' : 'Börsenkurs (Optional)')}
                                  </label>
                                  <input type="number" step="any" className={`w-full p-2.5 border rounded-lg dark:bg-slate-800 bg-transparent tabular-nums ${form.type === 'Wertanpassung' ? 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500' : 'border-gray-300 dark:border-slate-600'}`} 
                                      placeholder={currentPr ? `${t ? t('labelUntilNow') || 'Bisher:' : 'Bisher:'} ${currentPr}` : ''}
                                      value={form.price || ''} 
                                      onChange={e => { 
                                          const pr = e.target.value; 
                                          const sh = form.shares || 0; 
                                          const newAmt = (['Kauf', 'Verkauf'].includes(form.type) && sh && pr) ? (Number(sh) * Number(pr)).toFixed(2) : (form.type === 'Wertanpassung' ? 0 : form.amount);
                                          setForm({ ...form, price: pr, amount: newAmt }); 
                                      }}
                                  />
                              </div>

                              {form.type === 'Wertanpassung' && (
                                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                                      <Icon name="Info" size={14} /> {t ? t('infoValuationAuto') || 'Die Wertermittlung erfolgt automatisch über die aktuellen Stücke' : 'Die Wertermittlung erfolgt automatisch über die aktuellen Stücke'} ({currentSh} Stk.).
                                  </div>
                              )}
                          </div>
                      )}

                      {['Dividende', 'Umbuchung'].includes(form.type) && !modalObj.item && (
                          <div>
                              <label className="block font-bold mb-1 mt-3 text-xs uppercase text-gray-500">{t ? t('targetAccount') : 'Zielkonto'}</label>
                              <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.targetAssetId || ''} onChange={e=>setForm({...form, targetAssetId: e.target.value})}>
                                  <option value="">{t('optTargetAccount') || '-- Optional: Zielkonto wählen --'}</option>
                                  {data.banks.map(bank => {
                                      const eligibleAssets = getAllAssets([bank]).filter(a => a.id !== selectedNode?.id && ['cash', 'pension_cash', 'pension_3a_cash', 'stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(a.assetClass));                
                                      if (eligibleAssets.length === 0) return null;
                                      return (
                                          <optgroup key={bank.id} label={bank.name}>
                                              {eligibleAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
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
                                  <option value="">{t('optOptional') || '-- Keine --'}</option>
                                  {availableSubCategories.map(cat => <option key={cat} value={cat}>{t ? t(cat) : cat}</option>)}
                              </select>
                          </div>
                      )}
                      
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{t ? t('comment') : 'Kommentar / Tags'}</label>
                          <input type="text" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" placeholder="#Steuern2026 oder Notiz..." value={form.comment || ''} onChange={e=>setForm({...form, comment: e.target.value})}/>
                      </div>

                      {isForeignCurrency && (
                          <div>
                              <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{t ? t('labelExchangeRateDate') : 'Wechselkurs'} ({selectedNode?.currency} -> {baseCurrency})</label>
                              <input type="number" step="0.0001" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white tabular-nums" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                          </div>
                      )}
                  </>
              )}

          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0 rounded-b-2xl">
            {modalObj.item ? (
                <button onClick={handleItemDelete} className="px-4 py-2.5 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-2">
                    <Icon name="Trash" size={16}/> {t ? t('btnDelete') : 'Löschen'}
                </button>
            ) : <div></div>}
            
            <div className="flex gap-2 w-full justify-end">
                <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 transition-colors">
                    {t('btnCancel') || 'Abbrechen'}
                </button>
                <button 
                    onClick={modalObj.type === 'printAssetBookings' ? handlePrintAssetBookings : handleSave} 
                    className="px-6 py-2.5 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                    {modalObj.type === 'bulkAction' ? <><Icon name="Check" size={18}/> {t('btnExecute') || 'Ausführen'}</> : <><Icon name="Save" size={18}/> {t('btnSave') || 'Speichern'}</>}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
};

module.exports = FormModal;