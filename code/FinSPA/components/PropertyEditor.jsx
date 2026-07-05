const React = require('react');
const Icon = require('./Icons.jsx');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const DataEngine = safeRequire('../data/DataEngine.jsx') || (typeof window !== 'undefined' && window.__FinSPAModules && window.__FinSPAModules['data/DataEngine.jsx']?.exports) || {};
const { 
  getAllAssets = () => [], 
  generateId = () => Math.random().toString(36).substr(2, 9),
  defaultBookingCategories = {},
  initialData = { settings: { assetClasses: [] } }
} = DataEngine;

const PropertyEditor = ({ data, activeReport, selectedNode, setSelectedNode, updateTreeData, syncExchangeRates, t }) => {
  const [transferTargetId, setTransferTargetId] = React.useState('');
  
  React.useEffect(() => {
      setTransferTargetId('');
  }, [selectedNode?.selectedBooking?.id]);

  const safeT = (key, fallback) => {
      if (!t) return fallback;
      const res = t(key);
      return (res && res !== key) ? res : fallback;
  };

  const AutoSaveIndicator = () => (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full shrink-0">
          <Icon name="Check" size={10} /> {safeT('labelAutoSave', 'Auto-Save')}
      </span>
  );

  if (activeReport || !selectedNode) {
      return (
          <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex items-center justify-center text-gray-400 shrink-0 text-center">
              {safeT('propEditor', 'Eigenschaften')} {safeT('propInactive', 'inaktiv.')}
          </div>
      );
  }

  const renderContent = () => {
      // Zentralisierte Berechnungs-Logik der Ist-Werte aus den historischen Transaktionen
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

      const actualShares = getActualShares(selectedNode);
      const actualPrice = getActualPrice(selectedNode);

      // 1. BUDGET ANSICHT
      if (selectedNode.budgetType) {
          const handleBudgetPropChange = (key, val) => {
              let foundGroup = null; let foundIdx = -1;
              ['incomeSources', 'expenses', 'subscriptions'].forEach(grp => {
                  const idx = data.budget[grp].findIndex(i => i.id === selectedNode.id);
                  if (idx > -1) { foundGroup = grp; foundIdx = idx; }
              });
              if (foundGroup) {
                  const newArr = [...data.budget[foundGroup]];
                  newArr[foundIdx] = { ...newArr[foundIdx], [key]: val };
                  updateTreeData({ budget: { ...data.budget, [foundGroup]: newArr } });
                  setSelectedNode(prev => ({ ...prev, [key]: val }));
              }
          };

          return (
            <>
                 <div>
                     <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('budgetName', 'Bezeichnung')}</label>
                     <input className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.name || ''} onChange={e => handleBudgetPropChange('name', e.target.value)} />
                 </div>
                 <div>
                     <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('budgetAmount', 'Betrag')}</label>
                     <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm tabular-nums" value={selectedNode.amount || ''} onChange={e => handleBudgetPropChange('amount', e.target.value)} />
                 </div>
                 <div>
                     <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('budgetFreq', 'Frequenz')}</label>
                     <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.frequency || 'monthly'} onChange={e => handleBudgetPropChange('frequency', e.target.value)}>
                        <option value="monthly">{safeT('freqMonthly', 'Monatlich')}</option>
                        <option value="quarterly">{safeT('freqQuarterly', 'Vierteljährlich')}</option>
                        <option value="semi-annually">{safeT('freqSemiAnnually', 'Halbjährlich')}</option>
                        <option value="yearly">{safeT('freqYearly', 'Jährlich')}</option>
                    </select>
                 </div>
                 <div>
                     <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('budgetRuleCat', '50/30/20 Kategorie')}</label>
                     <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.ruleCategory || 'needs'} onChange={e => handleBudgetPropChange('ruleCategory', e.target.value)}>
                        <option value="needs">{safeT('ruleNeedsFix', 'Needs (Fixkosten)')}</option>
                        <option value="wants">{safeT('ruleWantsLife', 'Wants (Lifestyle)')}</option>
                        <option value="savings">{safeT('ruleSavingsSave', 'Savings (Sparen)')}</option>
                    </select>
                 </div>	
                 <div>
                     <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('budgetNotice', 'Kündigungsfrist (Optional)')}</label>
                     <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.noticePeriod || ''} onChange={e => handleBudgetPropChange('noticePeriod', e.target.value)} />
                 </div>
            </>
          );
      }

      // 2. BUCHUNGS-ANSICHT (Innerhalb des Assets ausgewählt)
      if (selectedNode.selectedBooking) {
        const booking = selectedNode.selectedBooking;
        const isBal = booking._isBal;
        
        const baseCurrency = data?.settings?.baseCurrency || 'CHF';
        const isForeignCurrency = selectedNode.currency && selectedNode.currency !== baseCurrency;

        const activeBookingCategories = data?.settings?.bookingCategories || defaultBookingCategories || {};
        const availableSubCategories = activeBookingCategories[booking.type] || [];
        
        const ac = selectedNode?.assetClass;
        const isSecurities = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(ac);

        const handleBookingPropChange = (keyOrObj, val) => {
          const changes = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: val };
          if (booking.type === 'Wertanpassung' || changes.type === 'Wertanpassung') changes.shares = undefined;
          const updatedBooking = { ...booking, ...changes };
          
          let newBookings = selectedNode.bookings || [];
          let newBalances = selectedNode.balances || [];
          
          if (isBal) {
              newBalances = newBalances.map(b => b.id === booking.id ? updatedBooking : b);
          } else {
              newBookings = newBookings.map(b => b.id === booking.id ? updatedBooking : b);
          }

          setSelectedNode(prev => ({ 
              ...prev, selectedBooking: updatedBooking, bookings: newBookings, balances: newBalances
          }));
          
          const updateRecursive = (nodes) => nodes.map(n => {
            if (n.id === selectedNode.id) return { ...n, bookings: newBookings, balances: newBalances };
            if (n.children) return { ...n, children: updateRecursive(n.children) };
            return n;
          });
          updateTreeData({ banks: updateRecursive(data.banks) });
        };

        return (
          <>
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('date', 'Datum')}</label>
                <input type="date" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm tabular-nums" value={booking.date || ''} onChange={e => handleBookingPropChange('date', e.target.value)} />
              </div>

              {!isBal && (
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('type', 'Typ')}</label>
                  <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" value={booking.type || ''} onChange={e => handleBookingPropChange('type', e.target.value)}>
                    <option value="Einzahlung">{safeT('typeDeposit', 'Einzahlung')}</option>
                    <option value="Auszahlung">{safeT('typeWithdrawal', 'Auszahlung')}</option>
                    <option value="Kauf">{safeT('typeBuy', 'Kauf')}</option>
                    <option value="Verkauf">{safeT('typeSell', 'Verkauf')}</option>
                    <option value="Dividende">{safeT('typeDividend', 'Dividende / Zins')}</option>
                    <option value="Wertanpassung">{safeT('typeRevaluation', 'Wertanpassung')}</option>
                    <option value="Umbuchung">{safeT('typeTransfer', 'Umbuchung')}</option>
                    <option value="Abzahlung">{safeT('typeAmortization', 'Abzahlung')}</option>
                  </select>
                </div>
              )}
              
              {!(isSecurities && booking.type === 'Wertanpassung') && (
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('amount', 'Betrag')} ({selectedNode.currency || baseCurrency})</label>
                  <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm tabular-nums" value={booking.amount || ''} onChange={e => handleBookingPropChange('amount', Number(e.target.value))} />
                </div>
              )}

              {isForeignCurrency && (
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">
                    {safeT('labelExchangeRateDate', 'Wechselkurs')} ({selectedNode.currency} → {baseCurrency})
                  </label>
                  <input type="number" step="0.0001" className="w-full p-2 border border-yellow-300/70 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm tabular-nums" value={booking.bookingExchangeRate ?? ''} onChange={e => handleBookingPropChange('bookingExchangeRate', Number(e.target.value))} />
                </div>
              )}

              {!isBal && ['Dividende', 'Umbuchung'].includes(booking.type) && (
                  <div className="mt-4 p-3 bg-blue-50/60 dark:bg-slate-800/40 border border-blue-200 dark:border-slate-700 rounded-lg shadow-sm">
                      <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('labelTransferTargetAccount', 'Zielkonto für Gegenbuchung')}</label>
                      <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)}>
                          <option value="">{safeT('optTargetAccount', '-- Optional: Zielkonto wählen --')}</option>
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
                      
                      {transferTargetId && (
                           <button 
                             onClick={() => {
                                 const bookingRate = booking.bookingExchangeRate ? parseFloat(String(booking.bookingExchangeRate).replace(',', '.')) : 0;
                                 const nodeRate = selectedNode.exchangeRate ? parseFloat(String(selectedNode.exchangeRate).replace(',', '.')) : 1;
                                 const sourceRate = isForeignCurrency ? (bookingRate || nodeRate || 1) : 1;
                                 const amountInBaseCurrency = (Number(booking.amount) || 0) * sourceRate;
                                 
                                 const updateRecursive = (nodes) => nodes.map(n => {
                                     let copy = { ...n };
                                     if (n.id === selectedNode.id) {
                                         copy.bookings = (copy.bookings || []).map(b => b.id === booking.id ? { ...b, subCategory: booking.type === 'Dividende' ? 'Dividende' : 'Umbuchung Ausgang' } : b);
                                     }
                                     if (n.id === transferTargetId) {
                                         if (!copy.bookings) copy.bookings = [];
                                         const isTargetSecurity = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(copy.assetClass);
                                         const isTargetForeign = copy.currency && copy.currency !== baseCurrency;
                                         let targetRate = copy.exchangeRate ? parseFloat(String(copy.exchangeRate).replace(',', '.')) : 1;
                                         if (!isTargetForeign) targetRate = 1;
                                         const finalTargetAmount = targetRate !== 0 ? (amountInBaseCurrency / targetRate) : amountInBaseCurrency;
            
                                         copy.bookings.push({
                                             id: generateId(), date: booking.date, type: isTargetSecurity ? 'Kauf' : 'Einzahlung',
                                             subCategory: booking.type === 'Dividende' ? 'Dividenden Eingang' : 'Umbuchung Eingang',
                                             amount: Number(finalTargetAmount.toFixed(2)), bookingExchangeRate: isTargetForeign ? targetRate : 1
                                         });
                                     }
                                     if (n.children) copy.children = updateRecursive(n.children);
                                     return copy;
                                 });
            
                                 updateTreeData({ banks: updateRecursive(data.banks) });
                                 setSelectedNode({ ...selectedNode, selectedBooking: null });
                                 setTransferTargetId('');
                                 if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT('msgTransferGenerated', "Gegenbuchung erfolgreich generiert"), "success");
                             }} 
                             className="w-full mt-3 flex items-center justify-center gap-2 bg-slate-900 dark:bg-blue-600 text-white p-2 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-md text-sm"
                           >
                               <Icon name="Send" size={14}/> {safeT('btnExecuteTransfer', 'Gegenbuchung ausführen')}
                           </button>
                      )}
                  </div>
              )}

              {!isBal && isSecurities && (
                <div className={`grid gap-3 mt-2 ${booking.type === 'Wertanpassung' ? 'grid-cols-1 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 border border-emerald-200 dark:border-emerald-700/50 rounded-lg' : 'grid-cols-2 bg-yellow-50/50 dark:bg-slate-800/40 p-3 rounded-lg border border-gray-200 dark:border-slate-800'}`}>
                  
                  {['Kauf', 'Verkauf'].includes(booking.type) && (
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('labelShares', 'Stücke')}</label>
                        <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm tabular-nums" value={booking.shares || ''} onChange={e => { const sh = Number(e.target.value); const pr = booking.price || 0; handleBookingPropChange({ shares: sh, amount: sh && pr ? Number((sh * pr).toFixed(2)) : booking.amount }); }} />
                      </div>
                  )}

                  <div className={['Kauf', 'Verkauf'].includes(booking.type) ? "" : "col-span-2"}>
                    <label className={`block text-xs font-bold mb-1 uppercase leading-tight ${booking.type === 'Wertanpassung' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {booking.type === 'Wertanpassung' ? `${safeT('labelNewMarketPrice', 'Neuer Marktkurs')} (${safeT('labelUntilNow', 'Bisher:')} ${actualPrice})` : safeT('labelMarketPrice', 'Börsenkurs')}
                    </label>
                    <input type="number" step="any" className={`w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm tabular-nums ${booking.type === 'Wertanpassung' ? 'border-emerald-300 dark:border-emerald-600 focus:ring-emerald-500' : 'border-gray-300 dark:border-slate-600'}`} value={booking.price ?? ''} onChange={e => { const pr = e.target.value; const sh = booking.shares || 0; handleBookingPropChange({ price: pr === '' ? undefined : Number(pr), amount: ['Kauf', 'Verkauf'].includes(booking.type) && sh && pr ? Number((sh * pr).toFixed(2)) : (booking.type === 'Wertanpassung' ? 0 : booking.amount) }); }} />
                  </div>

                  {booking.type === 'Wertanpassung' && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                          {safeT('infoCalcByInventory', 'Berechnung erfolgt über Bestand')} ({actualShares} {safeT('labelPcs', 'Stk.')}).
                      </div>
                  )}
                </div>
              )}

              {!isBal && (
                <>
                  {availableSubCategories.length > 0 ? (
                    <div>
                      <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('category', 'Kategorie')}</label>
                      <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.subCategory || ''} onChange={e => handleBookingPropChange('subCategory', e.target.value)}>
                        <option value="">{safeT('optOptional', '-- Keine --')}</option>
                        {availableSubCategories.map(c => <option key={c} value={c}>{safeT(c, c)}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('category', 'Kategorie')}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.subCategory || ''} onChange={e => handleBookingPropChange('subCategory', e.target.value)} />
                    </div>
                  )}

                  <div>
                    <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('labelSetNewComment', 'Kommentar / Tags')}</label>
                    <input type="text" placeholder={safeT('placeholderNoteTag', "#Steuern2026 oder Notiz...")} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.comment || ''} onChange={e => handleBookingPropChange('comment', e.target.value)} />
                  </div>
                </>
              )}
          </>
        );
      }

      // 3. ASSET ANSICHT (Hauptansicht des selektierten Vermögenswerts)
      const handlePropChange = (keyOrObj, val) => {
          const changes = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: val };
          const updateRecursive = (nodes) => nodes.map(n => {
              if (n.id === selectedNode.id) return { ...n, ...changes };
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
          });
          updateTreeData({ banks: updateRecursive(data.banks) });
          setSelectedNode(prev => ({ ...prev, ...changes }));
      };

      const handleQuickFX = async (e) => {
          if (e) e.preventDefault();
          
          const baseCurrency = data?.settings?.baseCurrency || 'CHF';
          const fromCurrency = selectedNode.currency;
          
          if (!fromCurrency || fromCurrency === baseCurrency) {
              if (typeof window !== 'undefined' && window.showToast) window.showToast(`Basiswährung und Asset-Währung sind identisch (${baseCurrency}).`, "info");
              return;
          }

          try {
              if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT('msgFetchingRate', `Kurs ${fromCurrency} zu ${baseCurrency} wird abgerufen...`), "info");

              let liveRate = null;
              try {
                  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${fromCurrency}&symbols=${baseCurrency}`);
                  if (res.ok) {
                      const json = await res.json();
                      liveRate = json.rates[baseCurrency];
                  }
              } catch(e) { console.warn("Frankfurter V2 fetch failed", e); }

              if (!liveRate) {
                  try {
                      const res2 = await fetch(`https://api.frankfurter.app/latest?base=${fromCurrency}&symbols=${baseCurrency}`);
                      if (res2.ok) {
                          const json2 = await res2.json();
                          liveRate = json2.rates[baseCurrency];
                      }
                  } catch(e) { console.warn("Frankfurter V1 fetch failed", e); }
              }

              if (!liveRate) {
                  const mockMap = {
                      'USD_CHF': 0.89, 'EUR_CHF': 0.95, 'GBP_CHF': 1.13, 'JPY_CHF': 0.0056,
                      'CHF_USD': 1.12, 'CHF_EUR': 1.05, 'CHF_GBP': 0.88, 'BTC_CHF': 58000, 'ETH_CHF': 3200
                  };
                  liveRate = mockMap[`${fromCurrency}_${baseCurrency}`];
                  if (liveRate && typeof window !== 'undefined' && window.showToast) {
                      window.showToast("API blockiert/Krypto. Verwende Offline-Richtwert.", "warning");
                  }
              }

              if (liveRate) {
                  handlePropChange('exchangeRate', liveRate);
                  if (syncExchangeRates) syncExchangeRates(fromCurrency, liveRate);
                  if (typeof window !== 'undefined' && window.showToast) {
                      window.showToast(`${safeT('msgRateUpdated', "Kurs aktualisiert")}: 1 ${fromCurrency} = ${liveRate} ${baseCurrency}`, "success");
                  }
              } else {
                  throw new Error('Kein Kurs gefunden');
              }
          } catch (error) {
              console.error("FX Fetch Error:", error);
              if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT('msgFetchRateError', `Fehler beim Abruf. Währung ${fromCurrency} evtl. nicht unterstützt.`), "error");
          }
      };

      return (
          <>
            <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('propName', 'Name')}</label>
                <input className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" value={selectedNode.name || ''} onChange={e => handlePropChange('name', e.target.value)} />
            </div>
            
            <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer shadow-sm hover:border-blue-500 transition-colors">
              <input type="checkbox" checked={selectedNode.isArchived || false} onChange={e => handlePropChange('isArchived', e.target.checked)} className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500" /> 
              <span className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-200 flex items-center gap-2">
                  <Icon name="Archive" size={14}/> {safeT('isArchived', 'Archiviert')}
              </span>
            </label>

            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('assetClass', 'Anlageklasse')}</label>
              <select 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" 
                  value={selectedNode.assetClass || 'cash'} 
                  onChange={e => { 
                      const val = e.target.value; 
                      const updates = { assetClass: val };
                      if (['pension_cash', 'pension_3a_cash', 'pension_fund', 'pension_3a_fund', 'realestate', 'mortgage', 'pension_3a_managed', 'managed_fund'].includes(val)) { updates.isLiquid = false; } 
                      handlePropChange(updates);
                  }}
              >
                {(() => {
                    const titleMap = {
                        'cash': 'acCash', 'fund': 'acFund', 'stock': 'acStock', 'crypto': 'acCrypto',
                        'realestate': 'acRealEstate', 'mortgage': 'acMortgage', 
                        'pension_cash': 'acPensionCash', 'pension_fund': 'acPensionFund', 
                        'pension_3a_cash': 'acPension3aCash', 'pension_3a_fund': 'acPension3aFund',
                        'managed_fund': 'acManagedFund', 'pension_3a_managed': 'acPension3aManaged'
                    };
                    
                    const standardClasses = initialData?.settings?.assetClasses || [];
                    const userClasses = data?.settings?.assetClasses || [];
                    const finalClasses = [...userClasses];
                    
                    standardClasses.forEach(sc => {
                        if (!finalClasses.find(fc => fc.id === sc.id)) {
                            finalClasses.push(sc);
                        }
                    });

                    return finalClasses.map(ac => {
                        const tKey = titleMap[ac.id];
                        const fallbackName = ac.name || ac.fallback;
                        const displayName = tKey && safeT(tKey, fallbackName) !== tKey 
                                            ? safeT(tKey, fallbackName) 
                                            : fallbackName;
                        return <option key={ac.id} value={ac.id}>{displayName}</option>;
                    });
                })()}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex flex-col justify-end h-full">
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{safeT('currency', 'Währung')}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.currency || 'CHF'} onChange={e => handlePropChange('currency', e.target.value)}>
                  <option>CHF</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div className="flex flex-col justify-end h-full relative group">
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight" title={safeT('propTrackRateTitle', 'Genereller Tracking-Kurs')}>{safeT('propCurrentRate', 'Aktueller Kurs')}</label>
                <div className="relative">
                    <input type="number" step="any" className="w-full p-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm tabular-nums focus:ring-2 focus:ring-blue-500 outline-none" value={selectedNode.exchangeRate ?? ''} onChange={e => handlePropChange('exchangeRate', e.target.value)} onBlur={e => { if (syncExchangeRates) syncExchangeRates(selectedNode.currency, e.target.value); }} />
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); }} onClick={handleQuickFX} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors" title={safeT('titleUpdateRate', "Kurs aktualisieren")}><Icon name="RefreshCw" size={14} /></button>
                </div>
              </div>
            </div>
            
            <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer shadow-sm hover:border-blue-500 transition-colors">
              <input type="checkbox" checked={selectedNode.isLiquid || false} onChange={e => handlePropChange('isLiquid', e.target.checked)} className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500" /> 
              <span className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-200">{safeT('isLiquid', 'Liquides Mittel')}</span>
            </label>

            {(selectedNode.assetClass === 'fund' || selectedNode.assetClass === 'stock' || selectedNode.assetClass === 'crypto' || selectedNode.assetClass === 'pension_fund' || selectedNode.assetClass === 'pension_3a_fund') && (
              <div className="bg-yellow-50 dark:bg-slate-800/50 border border-yellow-200 dark:border-slate-600 p-4 rounded-xl space-y-4 mt-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                 <h4 className="font-bold text-xs text-yellow-800 dark:text-yellow-500 uppercase tracking-wider flex items-center gap-2"><Icon name="TrendingUp" size={14}/> {safeT('propSecurityStatus', 'Wertpapier Status')}</h4>
                 
                 <div className="grid grid-cols-2 gap-3 items-end">
                   <div className="flex flex-col justify-end h-full">
                     <label className="text-xs text-yellow-800 dark:text-yellow-600/80 font-bold mb-1 block uppercase leading-tight">{safeT('propCurrentShares', 'Aktuelle Stückzahl')}</label>
                     <div className="w-full p-2.5 border border-yellow-200/60 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-mono shadow-inner select-all tabular-nums">
                         {actualShares.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                     </div>
                   </div>
                   <div className="flex flex-col justify-end h-full">
                     <label className="text-xs text-yellow-800 dark:text-yellow-600/80 font-bold mb-1 block uppercase leading-tight">{safeT('propCurrentPrice', 'Aktueller Preis')}</label>
                     <div className="w-full p-2.5 border border-yellow-200/60 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-mono shadow-inner select-all tabular-nums">
                         {actualPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                     </div>
                   </div>
                 </div>
              </div>
            )}
            
            {(selectedNode.assetClass === 'fund' || selectedNode.assetClass === 'stock' || selectedNode.assetClass === 'managed_fund') && (
              <div className="bg-blue-50 dark:bg-slate-800/50 border border-blue-200 dark:border-slate-600 p-4 rounded-xl space-y-4 mt-4 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                 <h4 className="font-bold text-xs text-blue-800 dark:text-blue-500 uppercase tracking-wider flex items-center gap-2">
                     <Icon name="Calendar" size={14}/> {safeT('propForwardYield', 'Dividenden Prognose')}
                 </h4>
                 
                 <div className="grid grid-cols-2 gap-3 items-end">
                   <div className="flex flex-col justify-end h-full">
                     <label className="text-[10px] text-blue-800 dark:text-blue-400 font-bold mb-1 block uppercase leading-tight">
                         {safeT('propExpectedYield', 'Erw. Rendite (%)')}
                     </label>
                     <input type="number" step="any" placeholder={safeT('placeholderEgYield', 'z.B. 3.5')} className="w-full p-2 border border-blue-300/60 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 shadow-sm text-sm tabular-nums" value={selectedNode.forwardYield ?? ''} onChange={e => handlePropChange('forwardYield', e.target.value)} />
                   </div>
                   
                   <div className="flex flex-col justify-end h-full" title={safeT('titleTaxDeduction', 'Temporärer Steuerabzug am Zahltag (z.B. 35% Verrechnungssteuer, 30% US-Abzug)')}>
                      <label className="text-[10px] text-blue-800 dark:text-blue-400 font-bold mb-1 block uppercase leading-tight">
                          {safeT('propTotalTaxes', 'Steuer-Total (%)')}
                      </label>
                      <input type="number" step="any" placeholder={safeT('placeholderEgTaxes', 'z.B. 35')} className="w-full p-2 border border-blue-300/60 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 shadow-sm text-sm tabular-nums" value={selectedNode.totalTaxes ?? ''} onChange={e => handlePropChange('totalTaxes', e.target.value)} />
                   </div>

                   <div className="flex flex-col justify-end h-full col-span-2 mt-1">
                     <label className="text-[10px] text-blue-800 dark:text-blue-400 font-bold mb-1 block uppercase leading-tight">
                         {safeT('propPayoutMonths', 'Zahlmonate (1-12)')}
                     </label>
                     <input type="text" placeholder={safeT('placeholderEgMonths', 'z.B. 3,6,9,12')} className="w-full p-2 border border-blue-300/60 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 shadow-sm text-sm" value={selectedNode.payoutMonths ?? ''} onChange={e => handlePropChange('payoutMonths', e.target.value)} />
                   </div>
                 </div>
                 <div className="text-[10px] text-blue-600/70 dark:text-blue-400/70 leading-tight">
                    {safeT('descTaxesNotice', 'Eingabe der Gesamtkosten (Quell- + Verrechnungssteuer) zur Netto-Prognose.')}
                 </div>
              </div>
            )}
          </>
      );
  };

  return (
    <>
      <style>{`
        .custom-tree-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-tree-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .dark .custom-tree-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(71, 85, 105, 0.4); }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(107, 114, 128, 0.6); }
      `}</style>
      
      <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto custom-tree-scrollbar shrink-0 shadow-inner">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-3 shrink-0">
            <div className="flex items-center gap-2">
                <Icon name={selectedNode.selectedBooking ? "Edit" : "Settings"} className="text-gray-500" />
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">
                    {selectedNode.budgetType ? safeT('budgetDetails', 'Budget Details') : 
                     selectedNode.selectedBooking ? (selectedNode.selectedBooking._isBal ? safeT('editBalance', 'Saldo bearbeiten') : safeT('editBooking', 'Buchung bearbeiten')) : 
                     safeT('propEditor', 'Eigenschaften')}
                </h3>
            </div>
            <div className="flex items-center gap-3">
               <AutoSaveIndicator />
               {selectedNode.selectedBooking && (
                   <Icon name="X" size={18} className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => setSelectedNode({ ...selectedNode, selectedBooking: null })} title={safeT('titleCloseEditor', "Editor schließen")} />
               )}
            </div>
        </div>
        
        <div className="space-y-4 pb-12">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

module.exports = PropertyEditor;