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

const FormModal = ({ data, modalObj, setModalObj, selectedNode, setSelectedNode, updateTreeData, t, defaultBookingCategories }) => {
    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const isForeignCurrency = selectedNode?.currency && selectedNode.currency !== baseCurrency;

    // Helferfunktionen für Bestände und Preise (ausgelagert, um Abhängigkeiten zu reduzieren)
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

module.exports = FormModal;