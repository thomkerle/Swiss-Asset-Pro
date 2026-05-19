const React = require('react');
const { PieChartSVG } = require('../Charts.jsx');

const BudgetDashboard = ({ data, fCur, t }) => {
    // 1. Normalisierungs-Engine: Rechnet alles auf monatliche Basis um
    const getMonthly = (item) => {
        const amt = Number(item.amount) || 0;
        return item.frequency === 'yearly' ? amt / 12 : amt;
    };

    const incomes = data.budget?.incomeSources?.reduce((s, i) => s + getMonthly(i), 0) || 0;
    
    let needs = 0;
    let wants = 0;
    let explicitSavings = 0;
    let totalExp = 0;

    // 2. Kategorisierung & Systematik auswerten
    const allOutflows = [...(data.budget?.expenses || []), ...(data.budget?.subscriptions || [])];
    allOutflows.forEach(item => {
        const mAmount = getMonthly(item);
        totalExp += mAmount;
        
        const cat = item.ruleCategory || 'needs'; // Direkter Fallback auf 'needs'

        if (cat === 'wants') wants += mAmount;
        else if (cat === 'savings') explicitSavings += mAmount;
        else needs += mAmount; 
    });

    // 3. Puffer und echte Sparquote berechnen
    const leftover = incomes - totalExp;
    const trueSavings = explicitSavings; 
    
    // NEU: Die effektive Sparquote beinhaltet auch das Geld, das am Ende des Monats übrig bleibt
    const effectiveSavings = explicitSavings + Math.max(0, leftover);

    // 4. Daten für Kuchendiagramm aufbereiten
    const expData = [
      { label: `Fixe Ausgaben (${t('budgetRuleCat')} Needs)`, value: needs, color: '#ef4444' },
      { label: `Lifestyle & Abos (${t('budgetRuleCat')} Wants)`, value: wants, color: '#f97316' },
      { label: t('ruleSavings') ? t('ruleSavings').split(' ')[0] : 'Savings', value: trueSavings, color: '#22c55e' } 
    ];
    
    if (leftover > 0) {
        expData.push({ label: t('labelNetCashflow') || 'Net Cashflow', value: leftover, color: '#94a3b8' });
    }

    const pct = (val) => incomes > 0 ? Math.round((val / incomes) * 100) : 0;

    return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">
                {t('menuBudget')}
            </h2>
            
            <div className="grid grid-cols-4 gap-4 mb-8">
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                     <div className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('incomeSources')} (Mt.)</div>
                     <div className="text-2xl font-black text-gray-800 dark:text-white mt-2">{fCur(incomes)}</div>
                 </div>
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                     <div className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('labelTotalExpenses')}</div>
                     <div className="text-2xl font-black text-gray-800 dark:text-white mt-2">{fCur(totalExp)}</div>
                 </div>
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                     <div className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('labelRatio')} ({t('ruleSavings') ? t('ruleSavings').split(' ')[0] : 'Savings'})</div>
                     <div className="text-2xl font-black text-green-600 mt-2">{fCur(trueSavings)}</div>
                 </div>
                 <div className={`p-6 border rounded-xl shadow-sm ${leftover >= 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                     <div className={`text-sm font-bold uppercase tracking-wider ${leftover >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                         {t('labelNetCashflow')}
                     </div>
                     <div className={`text-2xl font-black mt-2 ${leftover >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                         {fCur(leftover)}
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-2 gap-8">
                 <div className="p-8 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm flex flex-col items-center justify-center">
                    <h3 className="font-bold text-lg mb-6 text-gray-800 dark:text-gray-200">{t('allocByCat')} ({t('freqMonthly')})</h3>
                    <PieChartSVG data={expData} fCur={fCur} />
                 </div>

                 <div className="p-8 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200 flex justify-between items-center">
                        50/30/20 Analyse
                        <span className="text-xs font-normal text-gray-500">Benchmark</span>
                    </h3>
                    <div className="space-y-6 mt-6">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Needs ({t('freqMonthly')}) - Ziel: max. 50%</span>
                                <span className="text-sm font-bold text-red-500">{pct(needs)}% ({fCur(needs)})</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                <div className="bg-red-500 h-2.5 rounded-full" style={{width: `${Math.min(pct(needs), 100)}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Wants ({t('freqMonthly')}) - Ziel: max. 30%</span>
                                <span className="text-sm font-bold text-orange-500">{pct(wants)}% ({fCur(wants)})</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                <div className="bg-orange-500 h-2.5 rounded-full" style={{width: `${Math.min(pct(wants), 100)}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                {/* Hier nutzen wir nun die effektive Sparquote, damit der Puffer als "gespart" gewertet wird */}
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Savings (inkl. Cashflow) - Ziel: min. 20%</span>
                                <span className="text-sm font-bold text-green-500">{pct(effectiveSavings)}% ({fCur(effectiveSavings)})</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                <div className="bg-green-500 h-2.5 rounded-full" style={{width: `${Math.min(pct(effectiveSavings), 100)}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('labelNetCashflow')}</span>
                                <span className="text-sm font-bold text-blue-500">{pct(leftover)}% ({fCur(leftover)})</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{width: `${Math.max(0, Math.min(pct(leftover), 100))}%`}}></div>
                            </div>
                        </div>
                    </div>
                 </div>
             </div>
        </div>
    );
};
module.exports = BudgetDashboard;