const React = require('react');
const Icon = require('./Icons.jsx');

const PropertyEditor = ({ data, activeReport, selectedNode, setSelectedNode, updateTreeData, syncExchangeRates, t }) => {
  if (activeReport || !selectedNode) return <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex items-center justify-center text-gray-400 shrink-0 text-center">{t ? t('propEditor') : 'Eigenschaftseditor'} {t ? t('propInactive') : 'inaktiv.'}</div>;

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
        <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-inner">
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-700 pb-3"><Icon name="Settings" className="text-gray-500" /><h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">{t ? t('budgetDetails') : 'Budget Details'}</h3></div>
          <div className="space-y-4">
             <div>
                 <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('budgetName') : 'Bezeichnung'}</label>
                 <input className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.name || ''} onChange={e => handleBudgetPropChange('name', e.target.value)} />
             </div>
             <div>
                 <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('budgetAmount') : 'Betrag'}</label>
                 <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.amount || ''} onChange={e => handleBudgetPropChange('amount', e.target.value)} />
             </div>
             <div>
                 <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('budgetFreq') : 'Frequenz'}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.frequency || 'monthly'} onChange={e => handleBudgetPropChange('frequency', e.target.value)}>
                    <option value="monthly">{t ? t('freqMonthly') : 'Monatlich'}</option>
                    <option value="yearly">{t ? t('freqYearly') : 'Jährlich'}</option>
                </select>
             </div>

             <div>
                 <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('budgetRuleCat') : '50/30/20 Kategorie'}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.ruleCategory || 'needs'} onChange={e => handleBudgetPropChange('ruleCategory', e.target.value)}>
                    <option value="needs">{t ? t('ruleNeeds') : 'Needs (Fixkosten, z.B. Wohnen, Steuern)'}</option>
                    <option value="wants">{t ? t('ruleWants') : 'Wants (Lifestyle, z.B. Abos, Freizeit)'}</option>
                    <option value="savings">{t ? t('ruleSavings') : 'Savings (Sparen, z.B. 3a, ETF-Sparplan)'}</option>
                </select>
             </div>	

             <div>
                 <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('budgetNotice') : 'Kündigungsfrist (Optional)'}</label>
                 <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.noticePeriod || ''} onChange={e => handleBudgetPropChange('noticePeriod', e.target.value)} />
             </div>
          </div>
        </div>
      );
  }

  // --- HIER BEGINNT DIE UNTERSTÜTZUNG FÜR BUCHUNGEN (INKL. FREMDWÄHRUNGEN) ---
  if (selectedNode.selectedBooking) {
    const booking = selectedNode.selectedBooking;
    const isBal = booking._isBal;
    
    // Globale Basiswährung auslesen und Fremdwährungs-Check durchführen
    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const isForeignCurrency = selectedNode.currency && selectedNode.currency !== baseCurrency;

    const handleBookingPropChange = (keyOrObj, val) => {
      // Unterstützt atomare Key-Value Updates ODER ganze Zustandsobjekte (verhindert Race Conditions)
      const changes = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: val };
      const updatedBooking = { ...booking, ...changes };
      
      // Lokalen State aktualisieren für sofortiges UI-Feedback
      setSelectedNode(prev => ({ ...prev, selectedBooking: updatedBooking }));
      
      // Globales TreeData-Update (für Berechnungen in Echtzeit)
      const updateRecursive = (nodes) => nodes.map(n => {
        if (n.id === selectedNode.id) {
          if (isBal) {
            const newBalances = (n.balances || []).map(b => b.id === booking.id ? updatedBooking : b);
            return { ...n, balances: newBalances };
          } else {
            const newBookings = (n.bookings || []).map(b => b.id === booking.id ? updatedBooking : b);
            return { ...n, bookings: newBookings };
          }
        }
        if (n.children) return { ...n, children: updateRecursive(n.children) };
        return n;
      });
      
      updateTreeData({ banks: updateRecursive(data.banks) });
    };

    return (
      <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-inner">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="Edit" className="text-gray-500" />
            <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">
              {isBal ? (t ? t('editBalance') : 'Saldo') : (t ? t('editBooking') : 'Buchung')}
            </h3>
          </div>
          <Icon 
            name="X" 
            size={18}
            className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors" 
            onClick={() => setSelectedNode({ ...selectedNode, selectedBooking: null })} 
            title="Zurück zum Asset"
          />
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('date') : 'Datum'}</label>
            <input type="date" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.date || ''} onChange={e => handleBookingPropChange('date', e.target.value)} />
          </div>
          
          <div>
            <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('amount') : 'Betrag'} ({selectedNode.currency || baseCurrency})</label>
            <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm" value={booking.amount || ''} onChange={e => handleBookingPropChange('amount', Number(e.target.value))} />
          </div>

          {/* DYNAMISCHES FREMDWÄHRUNGS-FELD FÜR WECHSELKURS */}
          {isForeignCurrency && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">
                {t ? t('labelExchangeRateDate') : 'Wechselkurs'} ({selectedNode.currency} → {baseCurrency})
              </label>
              <input 
                type="number" 
                step="0.0001" 
                className="w-full p-2 border border-yellow-300/70 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm font-mono text-sm" 
                value={booking.bookingExchangeRate ?? ''} 
                onChange={e => handleBookingPropChange('bookingExchangeRate', Number(e.target.value))} 
              />
            </div>
          )}

          {!isBal && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('entryType') : 'Typ'}</label>
              <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.type || ''} onChange={e => handleBookingPropChange('type', e.target.value)}>
                <option value="Einzahlung">Einzahlung</option>
                <option value="Auszahlung">Auszahlung</option>
                <option value="Kauf">Kauf</option>
                <option value="Verkauf">Verkauf</option>
                <option value="Dividende">Dividende</option>
                <option value="Zinszahlung">Zinszahlung</option>
                <option value="Gebühr">Gebühr</option>
                <option value="Wertanpassung">Wertanpassung</option>
                <option value="Abzahlung">Abzahlung</option>
                <option value="Schulderhöhung">Schulderhöhung</option>
              </select>
            </div>
          )}

          {!isBal && ['Kauf', 'Verkauf', 'Dividende'].includes(booking.type) && (
            <div className="grid grid-cols-2 gap-3 bg-yellow-50/50 dark:bg-slate-800/40 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('shares') : 'Stücke'}</label>
                <input 
                  type="number" 
                  step="any" 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" 
                  value={booking.shares || ''} 
                  onChange={e => {
                    const sh = Number(e.target.value);
                    const pr = booking.price || 0;
                    handleBookingPropChange({
                      shares: sh,
                      amount: sh && pr ? Number((sh * pr).toFixed(2)) : booking.amount
                    });
                  }} 
                />
              </div>
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('price') : 'Preis'}</label>
                <input 
                  type="number" 
                  step="any" 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" 
                  value={booking.price || ''} 
                  onChange={e => {
                    const pr = Number(e.target.value);
                    const sh = booking.shares || 0;
                    handleBookingPropChange({
                      price: pr,
                      amount: sh && pr ? Number((sh * pr).toFixed(2)) : booking.amount
                    });
                  }} 
                />
              </div>
            </div>
          )}

          {!isBal && (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('entryDetail') : 'Detail / Notiz'}</label>
              <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={booking.subCategory || ''} onChange={e => handleBookingPropChange('subCategory', e.target.value)} />
            </div>
          )}
        </div>
      </div>
    );
  }
  // --- ENDE DES BUCHUNGS-EDITORS ---

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

  return (
    <div className="print-hide w-80 border-l border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-inner">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-700 pb-3"><Icon name="Settings" className="text-gray-500" /><h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">{t ? t('propEditor') : 'Eigenschaften'}</h3></div>
      <div className="space-y-4">
        <div>
            <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('propName') : 'Name'}</label>
            <input className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" value={selectedNode.name || ''} onChange={e => handlePropChange('name', e.target.value)} />
        </div>
        
        <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer shadow-sm hover:border-blue-500 transition-colors">
          <input type="checkbox" checked={selectedNode.isArchived || false} onChange={e => handlePropChange('isArchived', e.target.checked)} className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500" /> 
          <span className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-200 flex items-center gap-2">
              <Icon name="Archive" size={14}/> {t ? t('isArchived') : 'Archiviert'}
          </span>
        </label>

        {selectedNode.type === 'asset' && (
          <>
            <div><label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('assetClass') : 'Anlageklasse'}</label>
              <select 
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" 
                  value={selectedNode.assetClass || 'cash'} 
                  onChange={e => { 
                      const val = e.target.value; 
                      const updates = { assetClass: val };
                      
                      if (['pension_cash', 'pension_3a_cash', 'pension_fund', 'pension_3a_fund', 'realestate', 'mortgage'].includes(val)) { 
                          updates.isLiquid = false; 
                      } 
                      
                      handlePropChange(updates);
                  }}
              >
                {data?.settings?.assetClasses ? (
                    data.settings.assetClasses.map(ac => (
                        <option key={ac.id} value={ac.id}>{ac.name}</option>
                    ))
                ) : (
                    <>
                        <option value="cash">{t ? t('acCash') : 'Konto'}</option>
                        <option value="fund">{t ? t('acFund') : 'Fonds / ETF'}</option>
                        <option value="stock">{t ? t('acStock') : 'Aktie'}</option>
                        <option value="crypto">{t ? t('acCrypto') : 'Krypto'}</option>
                        <option value="realestate">{t ? t('acRealEstate') : 'Immobilie'}</option>
                        <option value="mortgage">{t ? t('acMortgage') : 'Hypothek'}</option>
                        <option value="pension_cash">{t ? t('acPensionCash') : 'Pensionskasse'}</option>
                        <option value="pension_3a_cash">{t ? t('acPension3aCash') : '3a Vorsorgekonto'}</option>
                        <option value="pension_3a_fund">{t ? t('acPension3aFund') : '3a Vorsorgefonds'}</option>
                    </>
                )}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex flex-col justify-end h-full">
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight">{t ? t('currency') : 'Währung'}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.currency || 'CHF'} onChange={e => handlePropChange('currency', e.target.value)}>
                  <option>CHF</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div className="flex flex-col justify-end h-full">
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-1 uppercase leading-tight" title={t ? t('propTrackRateTitle') : 'Genereller Tracking-Kurs'}>{t ? t('propCurrentRate') : 'Aktueller Kurs'}</label>
                <input type="number" step="any" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm text-sm" value={selectedNode.exchangeRate ?? ''} onChange={e => handlePropChange('exchangeRate', e.target.value)} onBlur={e => { if (syncExchangeRates) syncExchangeRates(selectedNode.currency, e.target.value); }} />
              </div>
            </div>
            
            <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer shadow-sm hover:border-blue-500 transition-colors">
              <input type="checkbox" checked={selectedNode.isLiquid || false} onChange={e => handlePropChange('isLiquid', e.target.checked)} className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500" /> 
              <span className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-200">{t ? t('isLiquid') : 'Liquides Mittel'}</span>
            </label>

            {(selectedNode.assetClass === 'fund' || selectedNode.assetClass === 'stock' || selectedNode.assetClass === 'crypto' || selectedNode.assetClass === 'pension_fund' || selectedNode.assetClass === 'pension_3a_fund') && (
              <div className="bg-yellow-50 dark:bg-slate-800/50 border border-yellow-200 dark:border-slate-600 p-4 rounded-xl space-y-4 mt-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                 <h4 className="font-bold text-xs text-yellow-800 dark:text-yellow-500 uppercase tracking-wider flex items-center gap-2"><Icon name="TrendingUp" size={14}/> {t ? t('propSecurityStatus') : 'Wertpapier Status'}</h4>
                 
                 <div className="grid grid-cols-2 gap-3 items-end">
                   <div className="flex flex-col justify-end h-full">
                     <label className="text-xs text-yellow-800 dark:text-yellow-600/80 font-bold mb-1 block uppercase leading-tight">{t ? t('propCurrentShares') : 'Aktuelle Stückzahl'}</label>
                     <input type="number" step="any" className="w-full p-2 border border-yellow-300/60 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 shadow-sm text-sm" value={selectedNode.shares ?? ''} onChange={e => handlePropChange('shares', e.target.value)} />
                   </div>
                   <div className="flex flex-col justify-end h-full">
                     <label className="text-xs text-yellow-800 dark:text-yellow-600/80 font-bold mb-1 block uppercase leading-tight">{t ? t('propCurrentPrice') : 'Aktueller Preis'}</label>
                     <input type="number" step="any" className="w-full p-2 border border-yellow-300/60 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 shadow-sm text-sm" value={selectedNode.price ?? ''} onChange={e => handlePropChange('price', e.target.value)} />
                   </div>
                 </div>
              </div>
            )}
            <div className="pt-6 mt-6 border-t border-gray-200 dark:border-slate-700">
               <button className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-md"><Icon name="Save" size={16}/> {t ? t('btnApply') : 'Anwenden'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

module.exports = PropertyEditor;