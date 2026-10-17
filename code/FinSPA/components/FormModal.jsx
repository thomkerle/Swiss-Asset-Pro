const React = require('react');
const { useState, useEffect, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const { 
  generateId = () => Math.random().toString(36).substr(2, 9),
  getAllAssets = (banks) => []
} = DataEngine;

const resolvePdfExporter = () => {
  try {
    const mod = require('./print/PdfToolkit.jsx');
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod;
  } catch (e) {}
  try {
    const mod = require('../print/PdfToolkit.jsx');
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod;
  } catch (e) {}
  try {
    const mod = require('./print/PdfExportEngine.jsx');
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod;
  } catch (e) {}
  try {
    const mod = require('../print/PdfExportEngine.jsx');
    if (mod && (mod.exportReport || mod.default?.exportReport)) return mod.default || mod;
  } catch (e) {}
  if (typeof window !== 'undefined') {
    if (window.PdfToolkit && typeof window.PdfToolkit.exportReport === 'function') return window.PdfToolkit;
    if (window.PdfExportEngine && typeof window.PdfExportEngine.exportReport === 'function') return window.PdfExportEngine;
  }
  return { exportReport: () => alert('PdfExportEngine konnte nicht geladen werden.') };
};

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const FormModal = ({ data, modalObj, setModalObj, selectedNode, setSelectedNode, updateTreeData, t, defaultBookingCategories }) => {
    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const allAssets = useMemo(() => getAllAssets(data?.banks || []), [data?.banks]);

    // Ziel-Asset zuverlässig über modalObj.assetId oder selectedNode auflösen
    const targetAssetNode = useMemo(() => {
        if (modalObj?.assetId) {
            const found = allAssets.find(a => a.id === modalObj.assetId);
            if (found) return found;
        }
        return selectedNode;
    }, [modalObj?.assetId, selectedNode, allAssets]);

    const isForeignCurrency = targetAssetNode?.currency && targetAssetNode.currency !== baseCurrency;

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

    const initialAssetClass = modalObj?.item?.assetClass || modalObj?.defaultAssetClass || 'cash';
    const initialDefaultType = modalObj?.defaultType || (targetAssetNode?.assetClass === 'credit_card' ? 'Auszahlung' : 'Einzahlung');

    const [form, setForm] = useState(() => {
        if (modalObj.item) {
            return {
                ...modalObj.item,
                bookingExchangeRate: modalObj.item.bookingExchangeRate || (isForeignCurrency ? (targetAssetNode?.exchangeRate || 1) : 1),
                targetAssetId: modalObj.item.targetAssetId || ''
            };
        }
        return { 
            date: new Date().toISOString().split('T')[0], 
            fromDate: `${new Date().getFullYear()}-01-01`, 
            toDate: new Date().toISOString().split('T')[0],
            filterType: 'all', 
            type: initialDefaultType, 
            name: modalObj.type === 'editGoal' ? '' : '',
            target: data?.goals?.fire?.target || 1000000,
            year: data?.goals?.fire?.year || 2040,
            assetClass: initialAssetClass,
            currency: baseCurrency,
            cardLimit: 5000,
            amount: '', 
            subCategory: '', 
            comment: '', 
            shares: '', 
            price: '', 
            fees: '', 
            taxes: '', 
            bookingExchangeRate: isForeignCurrency ? (targetAssetNode?.exchangeRate || 1) : 1,
            targetAssetId: '',
            bulkOperation: 'delete',
            ticker: '',
            isin: '',
            frequency: 'monthly',
            ruleCategory: 'needs'
        };
    });

    const [suggestedFxRate, setSuggestedFxRate] = useState(null);
    const [isFetchingFx, setIsFetchingFx] = useState(false);

    const fetchHistoricalRate = async (manualTrigger = false, customFromCur = null) => {
        const dateToFetch = form.date || new Date().toISOString().split('T')[0];
        const fromCur = customFromCur || (modalObj.type === 'addAsset' ? form.currency : targetAssetNode?.currency);
        const toCur = baseCurrency;

        if (!fromCur || fromCur === toCur || !dateToFetch) {
            setSuggestedFxRate(null);
            return;
        }

        setIsFetchingFx(true);
        let rate = null;

        const todayStr = new Date().toISOString().split('T')[0];
        const targetEndpoint = dateToFetch > todayStr ? 'latest' : dateToFetch;

        try {
            try {
                const res = await fetch(`https://api.frankfurter.dev/v1/${targetEndpoint}?base=${fromCur}&symbols=${toCur}`);
                if (res.ok) {
                    const json = await res.json();
                    rate = json.rates[toCur];
                }
            } catch (e) { console.warn("Frankfurter V2 failed", e); }

            if (!rate) {
                try {
                    const res = await fetch(`https://api.frankfurter.app/${targetEndpoint}?base=${fromCur}&symbols=${toCur}`);
                    if (res.ok) {
                        const json = await res.json();
                        rate = json.rates[toCur];
                    }
                } catch (e) { console.warn("Frankfurter V1 failed", e); }
            }

            if (!rate && targetEndpoint !== 'latest') {
                 try {
                    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${fromCur}&symbols=${toCur}`);
                    if (res.ok) {
                        const json = await res.json();
                        rate = json.rates[toCur];
                    }
                } catch (e) { console.warn("Frankfurter V2 latest fallback failed", e); }
            }

            if (!rate) {
                const mockMap = {
                    'USD_CHF': 0.89, 'EUR_CHF': 0.95, 'GBP_CHF': 1.13, 'JPY_CHF': 0.0056,
                    'CHF_USD': 1.12, 'CHF_EUR': 1.05, 'CHF_GBP': 0.88, 'BTC_CHF': 58000, 'ETH_CHF': 3200
                };
                rate = mockMap[`${fromCur}_${toCur}`];
                
                if (manualTrigger && rate && typeof window !== 'undefined' && window.showToast) {
                    window.showToast(safeT(t, 'msgApiBlockedOfflineRate', "API blockiert. Verwende Offline-Richtwert."), "warning");
                }
            }

            if (rate) {
                setSuggestedFxRate(rate);
                if (manualTrigger) {
                    setForm(prev => ({...prev, bookingExchangeRate: rate}));
                    if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast(`${safeT(t, 'msgRateUpdated', "Kurs aktualisiert")}: 1 ${fromCur} = ${rate} ${toCur}`, "success");
                    }
                }
            } else {
                setSuggestedFxRate(null);
                if (manualTrigger && typeof window !== 'undefined' && window.showToast) {
                    window.showToast(safeT(t, 'msgNoRateFound', "Kein Kurs für diese Währung gefunden."), "error");
                }
            }
        } catch (error) {
            console.error("[FinSPA] FX Error:", error);
            setSuggestedFxRate(null);
        } finally {
            setIsFetchingFx(false);
        }
    };

    useEffect(() => {
        if (isForeignCurrency || (modalObj.type === 'addAsset' && form.currency !== baseCurrency)) {
            const timeoutId = setTimeout(() => fetchHistoricalRate(false), 450);
            return () => clearTimeout(timeoutId);
        }
    }, [form.date, form.currency, targetAssetNode?.currency, baseCurrency, isForeignCurrency]);

    const refreshActiveNode = (newBanks) => {
        const refId = targetAssetNode?.id || selectedNode?.id;
        if (!refId) return;
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.id === refId) return n;
                if (n.children) {
                    let r = findNode(n.children);
                    if (r) return r;
                }
            }
            return null;
        };
        const updatedNode = findNode(newBanks);
        if (updatedNode && setSelectedNode) setSelectedNode(updatedNode);
    };

    const handlePrintAssetBookings = () => {
        if (!targetAssetNode) return;
        const { fromDate, toDate, filterType } = form;
        const items = [...(targetAssetNode.balances || []).map(b => ({ ...b, _isBal: true })), ...(targetAssetNode.bookings || [])];

        const filtered = items.filter(item => {
            if (fromDate && item.date < fromDate) return false;
            if (toDate && item.date > toDate) return false;
            if (filterType !== 'all') {
                if (item._isBal) return false; 
                const isFlowIn = ['Einzahlung', 'Kauf', 'Dividende', 'Zinszahlung', 'Abzahlung'].includes(item.type);
                const isFlowOut = ['Auszahlung', 'Verkauf', 'Gebühr', 'Schulderhöhung', 'Umbuchung'].includes(item.type);
                const isReval = item.type === 'Wertanpassung';
                if (filterType === 'in' && !isFlowIn) return false;
                if (filterType === 'out' && !isFlowOut) return false;
                if (filterType === 'reval' && !isReval) return false;
            }
            return true;
        });

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tableHeaders = [safeT(t, 'date', 'Datum'), safeT(t, 'entryType', 'Eintrag'), safeT(t, 'entryDetail', 'Detail'), safeT(t, 'amount', 'Betrag')];

        const tableBody = filtered.map(item => {
            let typeLabel = item.type;
            if (item._isBal) typeLabel = safeT(t, 'balanceLabel', 'SALDO');
            else {
                const typeMap = { 'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee', 'Umbuchung': 'typeTransfer' };
                if (typeMap[item.type] && t) typeLabel = safeT(t, typeMap[item.type], item.type);
            }

            let details = item._isBal ? safeT(t, 'systemManual', 'System/Manuell') : (item.subCategory || '');
            if (item.comment) details += ` | ${item.comment}`; 
            if (!item._isBal && ['Kauf', 'Verkauf'].includes(item.type) && item.shares) details += ` (${item.shares} ${safeT(t, 'pcsAt', 'Stk. à')} ${item.price})`;

            let displayAmount = Number(item.amount || 0);
            let isPositiveType = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
            if (item.type === 'Wertanpassung' && displayAmount < 0) { isPositiveType = false; displayAmount = Math.abs(displayAmount); }

            const prefix = !item._isBal ? (isPositiveType ? '+' : '-') : '';
            const currency = targetAssetNode?.currency || baseCurrency;
            const formattedAmount = `${prefix}${displayAmount.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`;

            return [item.date, typeLabel, details, formattedAmount];
        });

        if (tableBody.length === 0) {
            tableBody.push([{ text: safeT(t, 'noEntries', 'Keine Einträge.'), colSpan: 4, alignment: 'center' }, {}, {}, {}]);
        } else {
            let totalIn = 0; let totalOut = 0; const currency = targetAssetNode?.currency || baseCurrency;
            filtered.forEach(item => {
                // Salden und reine Wertanpassungen nicht in den Cashflow-Summen mitzählen
                if (item._isBal || item.type === 'Wertanpassung') return;
                let amt = Number(item.amount || 0);
                let isPositiveType = ['Einzahlung', 'Kauf', 'Dividende', 'Abzahlung'].includes(item.type);
                if (isPositiveType) totalIn += amt; else totalOut += amt;
            });

            tableBody.push(["", "", "", ""]);
            tableBody.push([{ text: safeT(t, 'totalIn', 'Total Ein (+)'), bold: true }, "", "", { text: `+${totalIn.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
            tableBody.push([{ text: safeT(t, 'totalOut', 'Total Aus (-)'), bold: true }, "", "", { text: `-${totalOut.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
            const netFlow = totalIn - totalOut; const netPrefix = netFlow >= 0 ? '+' : '';
            tableBody.push([{ text: safeT(t, 'totalNet', 'Total Netto'), bold: true }, "", "", { text: `${netPrefix}${netFlow.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}`, bold: true }]);
        }

        let filterLabel = safeT(t, 'filterAll', "Alle Buchungen");
        if (filterType === 'in') filterLabel = safeT(t, 'filterIn', "Nur Zuflüsse/Einzahlungen");
        if (filterType === 'out') filterLabel = safeT(t, 'filterOut', "Nur Abflüsse/Auszahlungen");
        if (filterType === 'reval') filterLabel = safeT(t, 'filterReval', "Nur Wertanpassungen");

        const exporter = resolvePdfExporter();
        exporter.exportReport({ 
            title: `${safeT(t, 'bookingJournal', 'Buchungsjournal')} - ${targetAssetNode.name}`, 
            subtitle: `${safeT(t, 'dateRangeTitle', 'Zeitraum:')} ${fromDate || 'Anfang'} ${safeT(t, 'wordTo', 'bis')} ${toDate || 'Heute'} | Filter: ${filterLabel} | Währung: ${targetAssetNode.currency || baseCurrency}`, 
            tableHeaders, 
            tableBody, 
            data 
        });
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
            if (typeof window !== 'undefined' && window.showToast) window.showToast(`${modalObj.selectedIds.length} ${safeT(t, 'msgEntriesEdited', 'Einträge bearbeitet')}`, "success");
            
            updateTreeData(newData);
            refreshActiveNode(newData.banks); 
            setModalObj(null);
            return;
        }

        if (modalObj.type === 'editGoal') { 
            if (!newData.goals) newData.goals = {};
            newData.goals.fire = { target: Number(form.target||0), year: Number(form.year||2040) }; 
        } 
        else if (modalObj.type === 'addScenario') { 
            if (!newData.scenarios) newData.scenarios = [];
            newData.scenarios.push({ id: generateId(), name: form.name||safeT(t, 'newTargetName', 'Neu'), date: form.date, impact: Number(form.impact||0) }); 
        } 
        else if (modalObj.type === 'addBank') { 
            newData.banks.push({ id: generateId(), name: form.name || safeT(t, 'newBankName', 'Neue Bank'), type: 'bank', isArchived: false, children: [] }); 
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
                newData.budget[group] = [...newData.budget[group], { id: generateId(), name: form.name || safeT(t, 'newBudgetItem', 'Neuer Posten'), amount: Number(form.amount || 0), frequency: form.frequency || 'monthly', ruleCategory: form.ruleCategory || 'needs' }];
            }
        } 
        else if (['addBooking', 'editBooking', 'addBalance', 'editBalance'].includes(modalObj.type)) {
            const bookingRate = form.bookingExchangeRate ? parseFloat(String(form.bookingExchangeRate).replace(',', '.')) : 0;
            const nodeRate = targetAssetNode?.exchangeRate ? parseFloat(String(targetAssetNode.exchangeRate).replace(',', '.')) : 1;
            const sourceRate = isForeignCurrency ? (bookingRate || nodeRate || 1) : 1;
            const amountInBaseCurrency = (Number(form.amount) || 0) * sourceRate;
            const isCreditCardSettlement = targetAssetNode?.assetClass === 'credit_card' && form.type === 'Einzahlung';

            const updateRecursive = (nodes) => nodes.map(n => {
                let copy = {...n};

                // Gegenbuchung auf Ziel- bzw. Belastungskonto (bei Dividende, Umbuchung oder Kreditkarten-Ausgleich)
                if (form.targetAssetId && n.id === form.targetAssetId && modalObj.type === 'addBooking') {
                    if (!copy.bookings) copy.bookings = [];
                    const isTargetSecurity = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(copy.assetClass);
                    const isTargetForeign = copy.currency && copy.currency !== baseCurrency;
                    let targetRate = copy.exchangeRate ? parseFloat(String(copy.exchangeRate).replace(',', '.')) : 1;
                    if (!isTargetForeign) targetRate = 1;
                    const finalTargetAmount = targetRate !== 0 ? (amountInBaseCurrency / targetRate) : amountInBaseCurrency;

                    if (isCreditCardSettlement) {
                        // Beim Ausgleich einer Kreditkartenabrechnung wird das gewählte Bankkonto belastet (Auszahlung)
                        copy.bookings.push({
                            id: generateId(),
                            date: form.date,
                            type: 'Auszahlung',
                            subCategory: safeT(t, 'ccSettlementOut', `Kartenabrechnung ${targetAssetNode?.name || ''}`).trim(),
                            comment: form.comment || `#Kreditkartenausgleich`,
                            amount: Number(finalTargetAmount.toFixed(2)),
                            bookingExchangeRate: isTargetForeign ? targetRate : 1,
                            _timestamp: Date.now()
                        });
                    } else {
                        copy.bookings.push({
                            id: generateId(), 
                            date: form.date, 
                            type: isTargetSecurity ? 'Kauf' : 'Einzahlung', 
                            subCategory: form.type === 'Dividende' ? safeT(t, 'divIn', 'Dividenden Eingang') : safeT(t, 'transferIn', 'Umbuchung Eingang'),
                            comment: form.comment || '',
                            amount: Number(finalTargetAmount.toFixed(2)), 
                            bookingExchangeRate: isTargetForeign ? targetRate : 1,
                            _timestamp: Date.now()
                        });
                    }
                }

                if (n.id === modalObj.assetId) {
                    if (modalObj.type.includes('Booking')) {
                        if (!copy.bookings) copy.bookings = [];
                        if (modalObj.item) copy.bookings = copy.bookings.filter(b=>b.id !== modalObj.item.id);
                        
                        let saveType = form.type; 
                        let saveCat = form.subCategory;
                        if (form.type === 'Umbuchung') { 
                            saveType = 'Auszahlung'; 
                            saveCat = safeT(t, 'transferOut', 'Umbuchung Ausgang'); 
                        } else if (isCreditCardSettlement && !saveCat) {
                            saveCat = safeT(t, 'ccSettlementIn', 'Kartenabrechnung Ausgleich');
                        }

                        // Bei Wertanpassung von Wertpapieren auch den Stamm-Preis aktualisieren
                        if (saveType === 'Wertanpassung' && Number(form.price) > 0) {
                            copy.price = Number(form.price);
                        }

                        copy.bookings.push({ 
                            id: modalObj.item?.id || generateId(), 
                            date: form.date, 
                            type: saveType, 
                            subCategory: saveCat, 
                            comment: form.comment, 
                            amount: Number(form.amount || 0), 
                            shares: saveType === 'Wertanpassung' ? undefined : (form.shares ? Number(form.shares) : undefined), 
                            price: form.price ? Number(form.price) : undefined, 
                            fees: form.fees ? Number(form.fees) : undefined, 
                            taxes: form.taxes ? Number(form.taxes) : undefined, 
                            bookingExchangeRate: form.bookingExchangeRate ? Number(form.bookingExchangeRate) : 1,
                            _timestamp: modalObj.item?._timestamp || Date.now()
                        });
                    } else {
                        if (!copy.balances) copy.balances = [];
                        if (modalObj.item) copy.balances = copy.balances.filter(b=>b.id !== modalObj.item.id);
                        copy.balances.push({ 
                            id: modalObj.item?.id || generateId(), 
                            date: form.date, 
                            amount: Number(form.amount || 0), 
                            bookingExchangeRate: Number(form.bookingExchangeRate || 1) 
                        });
                    }
                }
                if (n.children) copy.children = updateRecursive(copy.children);
                return copy;
            });
            newData.banks = updateRecursive(newData.banks);
            refreshActiveNode(newData.banks); 
        } 
        else if (modalObj.type === 'addCategory' || modalObj.type === 'addAsset') {
            const updateRecursive = (nodes) => nodes.map(n => {
                if (n.id === modalObj.parentId) {
                    let copy = {...n};
                    if (!copy.children) copy.children = [];
                    if (modalObj.type === 'addCategory') {
                        copy.children.push({ 
                            id: generateId(), 
                            name: form.name || safeT(t, 'newCategoryName', 'Neue Kategorie'), 
                            type: 'category', 
                            isArchived: false, 
                            children: [] 
                        });
                    } else {
                        const ac = form.assetClass || 'cash';
                        const selectedCur = form.currency || baseCurrency;
                        const fxRate = selectedCur === baseCurrency ? 1.0 : (Number(suggestedFxRate) || Number(form.bookingExchangeRate) || 1.0);
                        const isLiq = !['pension_cash', 'pension_fund', 'realestate', 'mortgage', 'pension_3a_managed', 'pension_3a_cash', 'pension_3a_fund'].includes(ac);
                        
                        const newAssetObj = { 
                            id: generateId(), 
                            name: form.name || (ac === 'credit_card' ? safeT(t, 'newCreditCardName', 'Neue Kreditkarte') : safeT(t, 'newAssetName', 'Neues Asset')), 
                            type: 'asset', 
                            currency: selectedCur, 
                            exchangeRate: fxRate, 
                            isLiquid: isLiq, 
                            isArchived: false, 
                            assetClass: ac, 
                            balances: [], 
                            bookings: [], 
                            ticker: form.ticker || '', 
                            isin: form.isin || '' 
                        };

                        if (ac === 'credit_card') {
                            newAssetObj.cardLimit = Number(form.cardLimit || 5000);
                        }

                        copy.children.push(newAssetObj);
                    }
                    return copy;
                }
                if (n.children) return { ...n, children: updateRecursive(n.children) };
                return n;
            });
            newData.banks = updateRecursive(newData.banks);
        }

        if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgSaveSuccess2', "Erfolgreich gespeichert"), "success");
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
        
        refreshActiveNode(newData.banks); 

        if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgDeleted', "Gelöscht"), "success");
        setModalObj(null);
    };

    let availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung'];
    const ac = targetAssetNode?.assetClass;
    if (modalObj.type?.includes('Booking') && targetAssetNode?.type === 'asset') {
        if (ac === 'realestate') availableBookingTypes = ['Wertanpassung'];
        else if (ac === 'mortgage') availableBookingTypes = ['Abzahlung', 'Zinszahlung', 'Schulderhöhung'];
        else if (ac === 'credit_card') availableBookingTypes = ['Auszahlung', 'Einzahlung', 'Gebühr', 'Umbuchung'];
        else if (['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac)) availableBookingTypes = ['Kauf', 'Verkauf', 'Dividende', 'Gebühr', 'Wertanpassung'];
        else if (['pension_cash', 'pension_3a_cash'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Zinszahlung', 'Gebühr'];
        else if (['managed_fund', 'pension_3a_managed'].includes(ac)) availableBookingTypes = ['Einzahlung', 'Auszahlung', 'Umbuchung', 'Wertanpassung', 'Gebühr'];
    }

    const activeBookingCategories = data.settings?.bookingCategories || defaultBookingCategories || {};
    const availableSubCategories = activeBookingCategories[form.type] || [];
    const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);
    const isCreditCardAsset = ac === 'credit_card';

    const currentSh = getActualShares(targetAssetNode);
    const currentPr = getActualPrice(targetAssetNode);

    let modalTitle = modalObj.type.includes('edit') ? safeT(t, 'modalEdit', 'Bearbeiten') : safeT(t, 'modalNew', 'Neu');
    if (modalObj.type === 'addAsset' && form.assetClass === 'credit_card') modalTitle = safeT(t, 'addCreditCard', 'Kreditkarte hinzufügen');
    if (modalObj.type === 'printAssetBookings') modalTitle = safeT(t, 'printTitle', 'Journal Drucken');
    if (modalObj.type === 'bulkAction') modalTitle = safeT(t, 'titleBulkAction', 'Massenbearbeitung');

    const recalculateSecurityAmount = (shVal, prVal, feeVal, taxVal, txType) => {
        if (!['Kauf', 'Verkauf'].includes(txType)) return form.amount;
        const sh = Number(shVal || 0);
        const pr = Number(prVal || 0);
        const fee = Number(feeVal || 0);
        const tax = Number(taxVal || 0);
        if (sh > 0 && pr > 0) {
            const base = sh * pr;
            const total = txType === 'Kauf' ? (base + fee + tax) : Math.max(0, base - fee - tax);
            return total.toFixed(2);
        }
        return form.amount;
    };

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
          
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                {modalObj.type === 'bulkAction' && <Icon name="Layers" className="text-indigo-500" />}
                {(modalObj.type === 'addAsset' && form.assetClass === 'credit_card') && <Icon name="CreditCard" className="text-indigo-500" />}
                {modalTitle}
            </h3>
            <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"><Icon name="X" size={20}/></button>
          </div>
          
          <div className="p-6 space-y-5 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto finspa-scrollbar">

              {modalObj.type === 'bulkAction' && (
                  <div className="space-y-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50 text-sm font-medium shadow-sm flex items-start gap-3">
                          <Icon name="Info" size={18} className="mt-0.5 shrink-0" />
                          <span>{safeT(t, 'descBulkEdit1', 'Sie bearbeiten aktuell')} <strong>{modalObj.selectedIds.length}</strong> {safeT(t, 'descBulkEdit2', 'ausgewählte Einträge.')}</span>
                      </div>
                      
                      <div>
                          <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{safeT(t, 'labelSelectAction', 'Aktion wählen')}</label>
                          <select 
                              className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                              value={form.bulkOperation} 
                              onChange={e => setForm({...form, bulkOperation: e.target.value})}
                          >
                              <option value="delete">{safeT(t, 'optBulkDelete', 'Ausgewählte Einträge löschen')}</option>
                              <option value="changeCategory">{safeT(t, 'optBulkCategory', 'Kategorie (Dropdown) ändern')}</option>
                              <option value="changeComment">{safeT(t, 'optBulkComment', 'Kommentar / Tags in Masse setzen')}</option>
                              <option value="changeDate">{safeT(t, 'optBulkDate', 'Datum für alle ändern')}</option>
                          </select>
                      </div>

                      {form.bulkOperation === 'changeCategory' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{safeT(t, 'labelSetNewCategory', 'Neue Kategorie setzen')}</label>
                              <input type="text" list="bulk-categories" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={safeT(t, 'placeholderCategory', 'Kategorie wählen oder tippen...')} value={form.subCategory || ''} onChange={e => setForm({...form, subCategory: e.target.value})} />
                              <datalist id="bulk-categories">
                                  {Object.values(activeBookingCategories).flat().filter((v,i,a)=>a.indexOf(v)===i).map(cat => <option key={cat} value={cat} />)}
                              </datalist>
                          </div>
                      )}

                      {form.bulkOperation === 'changeComment' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{safeT(t, 'labelSetNewComment', 'Neuer Kommentar / Tags')}</label>
                              <input type="text" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={safeT(t, 'placeholderTaxExample', '#Steuererklärung2026')} value={form.comment || ''} onChange={e => setForm({...form, comment: e.target.value})} />
                          </div>
                      )}

                      {form.bulkOperation === 'changeDate' && (
                          <div className="animate-fade-in mt-4">
                              <label className="block font-bold mb-2 text-xs uppercase tracking-wider text-gray-500">{safeT(t, 'labelSetNewDate', 'Neues Datum setzen')}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums" value={form.date || ''} onChange={e => setForm({...form, date: e.target.value})} />
                          </div>
                      )}
                  </div>
              )}

              {modalObj.type === 'printAssetBookings' && (
                  <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 mb-4 text-xs font-medium">
                          {safeT(t, 'printBookingsNotice', 'Wählen Sie Zeitraum und Buchungsart für den Export.')}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'fromDate', 'Von Datum')}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.fromDate || ''} onChange={e=>setForm({...form, fromDate: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'toDate', 'Bis Datum')}</label>
                              <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.toDate || ''} onChange={e=>setForm({...form, toDate: e.target.value})}/>
                          </div>
                      </div>
                      <div className="mt-2">
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'filterBookings', 'Buchungen filtern')}</label>
                          <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.filterType} onChange={e=>setForm({...form, filterType: e.target.value})}>
                              <option value="all">{safeT(t, 'filterAll', 'Alle Buchungen & Salden')}</option>
                              <option value="in">{safeT(t, 'filterIn', 'Nur Zuflüsse (Einzahlung, Kauf, Zins...)')}</option>
                              <option value="out">{safeT(t, 'filterOut', 'Nur Abflüsse (Auszahlung, Verkauf, Gebühr...)')}</option>
                              <option value="reval">{safeT(t, 'filterReval', 'Nur Wertanpassungen')}</option>
                          </select>
                      </div>
                  </>
              )}

              {modalObj.type === 'editGoal' && (
                  <>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'goalTarget', 'Zielwert')}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.target || ''} onChange={e=>setForm({...form, target: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'goalYear', 'Zieljahr')}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})}/>
                      </div>
                  </>
              )}

              {modalObj.type === 'addScenario' && (
                  <>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'scenarioName', 'Name')}</label>
                          <input type="text" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent" value={form.name || ''} onChange={e=>setForm({...form, name: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'scenarioDate', 'Datum')}</label>
                          <input type="date" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.date || ''} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'scenarioImpact', 'Auswirkung')}</label>
                          <input type="number" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.impact || ''} onChange={e=>setForm({...form, impact: e.target.value})}/>
                      </div>
                  </>
              )}

              {(modalObj.type === 'addCategory' || modalObj.type === 'addAsset' || modalObj.type === 'addBank' || modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                  <>
                      <div>
                          <label className="block font-bold mb-1">{safeT(t, 'propName', 'Name')}</label>
                          <input 
                              type="text" 
                              autoFocus
                              placeholder={modalObj.type === 'addAsset' && form.assetClass === 'credit_card' ? 'z.B. Cembra Mastercard / Viseca' : ''}
                              className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" 
                              value={form.name || ''} 
                              onChange={e=>setForm({...form, name: e.target.value})}
                          />
                      </div>

                      {(modalObj.type === 'addBudget' || modalObj.type === 'editBudget') && (
                          <>
                              <div>
                                  <label className="block font-bold mb-1 mt-3">{safeT(t, 'amount', 'Betrag')}</label>
                                  <input type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent tabular-nums" value={form.amount || ''} onChange={e=>setForm({...form, amount: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block font-bold mb-1 mt-3">{safeT(t, 'budgetFreq', 'Frequenz')}</label>
                                  <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.frequency || 'monthly'} onChange={e=>setForm({...form, frequency: e.target.value})}>
                                      <option value="monthly">{safeT(t, 'freqMonthly', 'Monatlich')}</option>
                                      <option value="yearly">{safeT(t, 'freqYearly', 'Jährlich')}</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block font-bold mb-1 mt-3">{safeT(t, 'ruleNeeds', 'Regelwerk')}</label>
                                  <select className="w-full p-2 border rounded dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.ruleCategory || 'needs'} onChange={e=>setForm({...form, ruleCategory: e.target.value})}>
                                      <option value="needs">{safeT(t, 'ruleNeedsFix', 'Bedürfnisse')}</option>
                                      <option value="wants">{safeT(t, 'ruleWantsLife', 'Wünsche')}</option>
                                      <option value="savings">{safeT(t, 'ruleSavingsSave', 'Sparen/Investieren')}</option>
                                  </select>
                              </div>
                          </>
                      )}

                      {modalObj.type === 'addAsset' && (
                          <div className="space-y-3 mt-3">
                              <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                      <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'assetClass', 'Asset-Klasse')}</label>
                                      <select 
                                          className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent" 
                                          value={form.assetClass || 'cash'} 
                                          onChange={e => setForm({...form, assetClass: e.target.value})}
                                      >
                                          <option value="cash">{safeT(t, 'acCash', 'Bargeld / Bankkonto')}</option>
                                          <option value="credit_card">{safeT(t, 'acCreditCard', 'Kreditkarte')}</option>
                                          <option value="fund">{safeT(t, 'acFund', 'Fonds / ETF')}</option>
                                          <option value="stock">{safeT(t, 'acStock', 'Aktien')}</option>
                                          <option value="crypto">{safeT(t, 'acCrypto', 'Krypto')}</option>
                                          <option value="realestate">{safeT(t, 'acRealEstate', 'Immobilien')}</option>
                                          <option value="mortgage">{safeT(t, 'acMortgage', 'Hypothek')}</option>
                                          <option value="pension_cash">{safeT(t, 'acPensionCash', 'Pensionskasse (PK)')}</option>
                                          <option value="pension_fund">{safeT(t, 'acPensionFund', 'Vorsorge Fonds')}</option>
                                          <option value="pension_3a_cash">{safeT(t, 'acPension3aCash', 'Säule 3a Cash')}</option>
                                          <option value="pension_3a_fund">{safeT(t, 'acPension3aFund', 'Säule 3a Fonds')}</option>
                                          <option value="managed_fund">{safeT(t, 'acManagedFund', 'Verwaltetes Portfolio (Robo-Advisor)')}</option>
                                          <option value="pension_3a_managed">{safeT(t, 'acPension3aManaged', '3a Fonds (Gesamtwert)')}</option>
                                      </select>
                                  </div>

                                  <div>
                                      <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'currency', 'Währung')}</label>
                                      <select 
                                          className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-slate-100 bg-transparent font-mono font-bold"
                                          value={form.currency || baseCurrency}
                                          onChange={e => setForm({...form, currency: e.target.value})}
                                      >
                                          <option value="CHF">CHF</option>
                                          <option value="EUR">EUR</option>
                                          <option value="USD">USD</option>
                                          <option value="GBP">GBP</option>
                                      </select>
                                  </div>
                              </div>

                              {form.assetClass === 'credit_card' && (
                                  <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                                      <label className="block font-bold text-xs uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                          <Icon name="CreditCard" size={13} />
                                          {safeT(t, 'labelCardLimit', 'Kreditkarten-Limite')} ({form.currency || baseCurrency})
                                      </label>
                                      <input 
                                          type="number" 
                                          step="100"
                                          className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-slate-900 font-mono font-bold tabular-nums"
                                          value={form.cardLimit ?? 5000}
                                          onChange={e => setForm({...form, cardLimit: e.target.value})}
                                      />
                                      <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80">
                                          {safeT(t, 'descCreditCardLimit', 'Kartenausgaben werden als Verbindlichkeit gebucht und reduzieren das verfügbare Kartenlimit.')}
                                      </p>
                                  </div>
                              )}

                              {['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes(form.assetClass || 'cash') && (
                                  <div className="grid grid-cols-2 gap-3 pt-1">
                                      <div>
                                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'ticker', 'Ticker (API)')}</label>
                                          <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent uppercase text-sm font-mono" placeholder="z.B. O.US / NESN.SW" value={form.ticker || ''} onChange={e=>setForm({...form, ticker: e.target.value.toUpperCase()})}/>
                                      </div>
                                      <div>
                                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'isin', 'ISIN')}</label>
                                          <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent uppercase text-sm font-mono" placeholder="z.B. CH0038863350" value={form.isin || ''} onChange={e=>setForm({...form, isin: e.target.value.toUpperCase()})}/>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                  </>
              )}

              {modalObj.type.includes('Balance') && (
                  <>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 mb-4 text-xs font-medium">{safeT(t, 'balanceNotice', 'Stichtags-Salden überschreiben historische Buchungen.')}</div>
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'labelBalanceDate', 'Datum')}</label>
                          <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'labelAbsoluteBalance', 'Saldo')} ({targetAssetNode?.currency || baseCurrency})</label>
                          <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold tabular-nums" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                      </div>
                      {isForeignCurrency && (
                          <div>
                              <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{safeT(t, 'labelExchangeRateDate', 'Kurs')} ({targetAssetNode?.currency} → {baseCurrency})</label>
                              <div className="relative">
                                 <input type="number" step="0.0001" className="w-full p-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white tabular-nums" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                                 <button type="button" onMouseDown={(e) => { e.preventDefault(); }} onClick={() => fetchHistoricalRate(true)} className={`absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition-colors ${isFetchingFx ? 'animate-spin text-gray-400' : ''}`} title={safeT(t, 'titleUpdateRate', "Kurs ermitteln")}>
                                     <Icon name="RefreshCw" size={14} />
                                 </button>
                              </div>
                              <div className="h-5 flex items-center mt-1">
                                  {!isFetchingFx && suggestedFxRate !== null && suggestedFxRate !== Number(form.bookingExchangeRate) && (
                                      <button 
                                          type="button" 
                                          onClick={() => setForm({...form, bookingExchangeRate: suggestedFxRate})}
                                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                                      >
                                          <Icon name="Download" size={10} />
                                          {safeT(t, 'labelFxSuggestion', 'Vorschlag:')} <span className="font-bold">{suggestedFxRate}</span> {safeT(t, 'btnApply', 'übernehmen')}
                                      </button>
                                  )}
                              </div>
                          </div>
                      )}
                  </>
              )}

              {modalObj.type.includes('Booking') && modalObj.type !== 'printAssetBookings' && (
                  <>
                      {isCreditCardAsset && (
                          <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                              form.type === 'Einzahlung' 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300'
                          }`}>
                              <Icon name={form.type === 'Einzahlung' ? 'CheckCircle' : 'CreditCard'} size={15} />
                              <span>
                                  {form.type === 'Einzahlung'
                                      ? safeT(t, 'infoCcSettle', 'Abrechnungs-Ausgleich / Gutschrift: Reduziert den offenen Kartensaldo.')
                                      : safeT(t, 'infoCcExpense', 'Kartenausgabe / Einkauf: Erhöht den offenen Kartensaldo.')}
                              </span>
                          </div>
                      )}

                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'date', 'Datum')}</label>
                          <input type="date" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
                      </div>

                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'entryType', 'Typ')}</label>
                          <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.type} onChange={e=>setForm({...form, type: e.target.value, subCategory: ''})}>
                              {availableBookingTypes.map(tOption => {
                                  const typeMap = { 'Einzahlung': 'typeDeposit', 'Auszahlung': 'typeWithdrawal', 'Kauf': 'typeBuy', 'Verkauf': 'typeSell', 'Abzahlung': 'typeAmortization', 'Wertanpassung': 'typeReval', 'Zinszahlung': 'typeInterest', 'Dividende': 'typeDiv', 'Schulderhöhung': 'typeDebtInc', 'Gebühr': 'typeFee', 'Umbuchung': 'typeTransfer' };
                                  const translationKey = typeMap[tOption] || tOption;
                                  let label = safeT(t, translationKey, tOption);
                                  if (isCreditCardAsset && tOption === 'Auszahlung') label = `${label} (Kartenbelastung)`;
                                  if (isCreditCardAsset && tOption === 'Einzahlung') label = `${label} (Abrechnung ausgleichen)`;
                                  return <option key={tOption} value={tOption}>{label}</option>;
                              })}
                          </select>
                      </div>

                      {!(isSecurities && form.type === 'Wertanpassung') && (
                          <div>
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'amount', 'Betrag')} ({targetAssetNode?.currency || baseCurrency})</label>
                              <input type="number" step="any" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent font-bold tabular-nums" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/>
                          </div>
                      )}

                      {isSecurities && (
                          <div className={`grid gap-3 mt-3 ${form.type === 'Wertanpassung' ? 'grid-cols-1 bg-emerald-50/50 dark:bg-emerald-900/20 p-4 border border-emerald-200 dark:border-emerald-800/50 rounded-xl' : 'grid-cols-2'}`}>
                              
                              {['Kauf', 'Verkauf'].includes(form.type) && (
                                  <div>
                                      <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'shares', 'Stücke')}</label>
                                      <input 
                                          type="number" 
                                          step="any" 
                                          className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums" 
                                          value={form.shares || ''} 
                                          onChange={e => { 
                                              const sh = e.target.value; 
                                              const newAmt = recalculateSecurityAmount(sh, form.price, form.fees, form.taxes, form.type);
                                              setForm({ ...form, shares: sh, amount: newAmt }); 
                                          }}
                                      />
                                  </div>
                              )}
                              
                              <div className={['Kauf', 'Verkauf'].includes(form.type) ? "" : "col-span-2"}>
                                  <label className={`block font-bold mb-1 text-xs uppercase ${form.type === 'Wertanpassung' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}`}>
                                      {form.type === 'Wertanpassung' ? safeT(t, 'labelNewMarketPrice', 'Neuer Börsenkurs') : safeT(t, 'labelMarketPriceOpt', 'Börsenkurs (Optional)')}
                                  </label>
                                  <input 
                                      type="number" 
                                      step="any" 
                                      className={`w-full p-2.5 border rounded-lg dark:bg-slate-800 bg-transparent tabular-nums ${form.type === 'Wertanpassung' ? 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500' : 'border-gray-300 dark:border-slate-600'}`} 
                                      placeholder={currentPr ? `${safeT(t, 'labelUntilNow', 'Bisher:')} ${currentPr}` : ''}
                                      value={form.price || ''} 
                                      onChange={e => { 
                                          const pr = e.target.value; 
                                          const newAmt = form.type === 'Wertanpassung' ? 0 : recalculateSecurityAmount(form.shares, pr, form.fees, form.taxes, form.type);
                                          setForm({ ...form, price: pr, amount: newAmt }); 
                                      }}
                                  />
                              </div>

                              {['Kauf', 'Verkauf'].includes(form.type) && (
                                  <>
                                      <div>
                                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'fees', 'Gebühren (Opt.)')}</label>
                                          <input 
                                              type="number" 
                                              step="any" 
                                              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums text-xs" 
                                              placeholder="0.00"
                                              value={form.fees || ''} 
                                              onChange={e => {
                                                  const f = e.target.value;
                                                  const newAmt = recalculateSecurityAmount(form.shares, form.price, f, form.taxes, form.type);
                                                  setForm({ ...form, fees: f, amount: newAmt });
                                              }}
                                          />
                                      </div>
                                      <div>
                                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'taxes', 'Steuern/Stempel (Opt.)')}</label>
                                          <input 
                                              type="number" 
                                              step="any" 
                                              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent tabular-nums text-xs" 
                                              placeholder="0.00"
                                              value={form.taxes || ''} 
                                              onChange={e => {
                                                  const tx = e.target.value;
                                                  const newAmt = recalculateSecurityAmount(form.shares, form.price, form.fees, tx, form.type);
                                                  setForm({ ...form, taxes: tx, amount: newAmt });
                                              }}
                                          />
                                      </div>
                                  </>
                              )}

                              {form.type === 'Wertanpassung' && (
                                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                                      <Icon name="Info" size={14} /> {safeT(t, 'infoValuationAuto', 'Die Wertermittlung erfolgt automatisch über die aktuellen Stücke')} ({currentSh} Stk.).
                                  </div>
                              )}
                          </div>
                      )}

                      {(['Dividende', 'Umbuchung'].includes(form.type) || (isCreditCardAsset && form.type === 'Einzahlung')) && !modalObj.item && (
                          <div>
                              <label className="block font-bold mb-1 mt-3 text-xs uppercase text-gray-500">
                                  {isCreditCardAsset && form.type === 'Einzahlung'
                                      ? safeT(t, 'debitAccountOpt', 'Belastungskonto für Ausgleich (Optional)')
                                      : safeT(t, 'targetAccount', 'Zielkonto')}
                              </label>
                              <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-slate-800 dark:text-slate-100" value={form.targetAssetId || ''} onChange={e=>setForm({...form, targetAssetId: e.target.value})}>
                                  <option value="">
                                      {isCreditCardAsset && form.type === 'Einzahlung'
                                          ? safeT(t, 'optDebitAccount', '-- Optional: Bankkonto direkt mitbelasten --')
                                          : safeT(t, 'optTargetAccount', '-- Optional: Zielkonto wählen --')}
                                  </option>
                                  {data.banks.map(bank => {
                                      const eligibleAssets = getAllAssets([bank]).filter(a => 
                                          a.id !== targetAssetNode?.id && 
                                          ['cash', 'credit_card', 'pension_cash', 'pension_3a_cash', 'stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(a.assetClass)
                                      );                
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
                              <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'category', 'Kategorie')}</label>
                              <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" value={form.subCategory || ''} onChange={e=>setForm({...form, subCategory: e.target.value})}>
                                  <option value="">{safeT(t, 'optOptional', '-- Keine --')}</option>
                                  {availableSubCategories.map(cat => <option key={cat} value={cat}>{safeT(t, cat, cat)}</option>)}
                              </select>
                          </div>
                      )}
                      
                      <div>
                          <label className="block font-bold mb-1 text-xs uppercase text-gray-500">{safeT(t, 'comment', 'Kommentar / Tags')}</label>
                          <input type="text" className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent" placeholder={safeT(t, 'placeholderTaxExample', '#Steuern2026 oder Notiz...')} value={form.comment || ''} onChange={e=>setForm({...form, comment: e.target.value})}/>
                      </div>

                      {isForeignCurrency && (
                          <div>
                              <label className="block font-bold mb-1 text-[10px] uppercase text-gray-500">{safeT(t, 'labelExchangeRateDate', 'Wechselkurs')} ({targetAssetNode?.currency} → {baseCurrency})</label>
                              <div className="relative">
                                 <input type="number" step="0.0001" className="w-full p-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 bg-white tabular-nums" value={form.bookingExchangeRate} onChange={e=>setForm({...form, bookingExchangeRate: e.target.value})}/>
                                 <button type="button" onMouseDown={(e) => { e.preventDefault(); }} onClick={() => fetchHistoricalRate(true)} className={`absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition-colors ${isFetchingFx ? 'animate-spin text-gray-400' : ''}`} title={safeT(t, 'titleUpdateRate', "Kurs ermitteln")}>
                                     <Icon name="RefreshCw" size={14} />
                                 </button>
                              </div>
                              
                              <div className="h-5 flex items-center mt-1">
                                  {!isFetchingFx && suggestedFxRate !== null && suggestedFxRate !== Number(form.bookingExchangeRate) && (
                                      <button 
                                          type="button" 
                                          onClick={() => setForm({...form, bookingExchangeRate: suggestedFxRate})}
                                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                                      >
                                          <Icon name="Download" size={10} />
                                          {safeT(t, 'labelFxSuggestion', 'Vorschlag:')} <span className="font-bold">{suggestedFxRate}</span> {safeT(t, 'btnApply', 'übernehmen')}
                                      </button>
                                  )}
                              </div>
                          </div>
                      )}
                  </>
              )}

          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0 rounded-b-2xl">
            {modalObj.item ? (
                <button onClick={handleItemDelete} className="px-4 py-2.5 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
                    <Icon name="Trash" size={16}/> {safeT(t, 'btnDelete', 'Löschen')}
                </button>
            ) : <div></div>}
            
            <div className="flex gap-2 w-full justify-end">
                <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                    {safeT(t, 'btnCancel', 'Abbrechen')}
                </button>
                <button 
                    onClick={modalObj.type === 'printAssetBookings' ? handlePrintAssetBookings : handleSave} 
                    className="px-6 py-2.5 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                    {modalObj.type === 'bulkAction' ? <><Icon name="Check" size={18}/> {safeT(t, 'btnExecute', 'Ausführen')}</> : <><Icon name="Save" size={18}/> {safeT(t, 'btnSave', 'Speichern')}</>}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
};

module.exports = FormModal;