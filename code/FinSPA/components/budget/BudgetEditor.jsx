const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();
const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name}) => <span>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({ title, subtitle, isTreeVisible, setIsTreeVisible }) => (
  <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-4">
    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
       {!isTreeVisible && setIsTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 hover:text-gray-600 print-hide" onClick={() => setIsTreeVisible(true)} />}
       {title}
    </h2>
    <p className="text-gray-500 mt-2">{subtitle}</p>
  </div>
));

const BudgetEditor = ({ selectedNode, setSelectedNode, fCur, t, isTreeVisible, setIsTreeVisible }) => {
    // Normalisierungs-Rechner für die Detailkarten
    const getMonthlyAmount = (amt, freq) => {
        const f = String(freq || 'monthly').toLowerCase();
        const a = Number(amt) || 0;
        if (f === 'yearly' || f === 'jährlich') return a / 12;
        if (f === 'semi-annually' || f === 'halbjährlich') return a / 6;
        if (f === 'quarterly' || f === 'vierteljährlich') return a / 3;
        return a;
    };
    
    const normalizedAmt = getMonthlyAmount(selectedNode.amount, selectedNode.frequency);
    const isMonthly = String(selectedNode.frequency || 'monthly').toLowerCase() === 'monthly' || String(selectedNode.frequency).toLowerCase() === 'monatlich';

    const getCategoryLabel = (cat) => {
        if (cat === 'wants') return t ? t('ruleWants') : 'Wants (Lifestyle)';
        if (cat === 'savings') return t ? t('ruleSavings') : 'Savings (Sparen)';
        return t ? t('ruleNeeds') : 'Needs (Fixkosten)';
    };

    const displayFreq = (freq) => {
        const f = String(freq || 'monthly').toLowerCase();
        if (f === 'monthly' || f === 'monatlich') return t ? t('freqMonthly') : 'Monatlich';
        if (f === 'quarterly' || f === 'vierteljährlich') return t ? (t('freqQuarterly') || 'Vierteljährlich') : 'Vierteljährlich';
        if (f === 'semi-annually' || f === 'halbjährlich') return t ? (t('freqSemiAnnually') || 'Halbjährlich') : 'Halbjährlich';
        if (f === 'yearly' || f === 'jährlich') return t ? t('freqYearly') : 'Jährlich';
        return freq;
    };

    const headerTitle = (
        <span className="flex items-center gap-2">
            <span className="text-blue-500 uppercase tracking-wider text-xl font-black opacity-80 mt-1">{selectedNode.budgetType}</span>
            <span>{selectedNode.name}</span>
        </span>
    );

    const headerSubtitle = t && t('deleteNodeArchiveTip') && t('deleteNodeArchiveTip').includes('Archivieren') 
                            ? 'Detailansicht des Budget-Postens. Bearbeitung über den Eigenschaften-Editor (rechts).' 
                            : 'Detailed view of the budget item. Edit via the property editor (right).';

    return (
        <div className="w-full px-4 md:px-8 pb-12 relative h-full overflow-auto finspa-scrollbar">
            
            {/* Zurück-Navigation zum Dashboard */}
            <div className="pt-4 pb-3 print-hide">
                <button 
                    onClick={() => setSelectedNode && setSelectedNode(null)} 
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-blue-600 transition-colors"
                >
                    <Icon name="ArrowLeft" size={14} /> 
                    {t && t('backToDashboard') ? t('backToDashboard') : 'Zurück zum Dashboard'}
                </button>
            </div>

            <ReportHeader 
                title={headerTitle} 
                subtitle={headerSubtitle}
                isTreeVisible={isTreeVisible} 
                setIsTreeVisible={setIsTreeVisible} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider">{t ? t('budgetAmount') : 'Betrag'}</div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                        {fCur ? fCur(selectedNode.amount) : selectedNode.amount}
                        {!isMonthly && (
                            <span className="text-sm font-medium text-gray-400">
                                ({fCur ? fCur(normalizedAmt) : normalizedAmt} / {(t ? t('freqMonthly') : 'Monatlich').toLowerCase().substring(0,2)}.)
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider">{t ? t('budgetFreq') : 'Frequenz'}</div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                        {displayFreq(selectedNode.frequency)}
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {selectedNode.noticePeriod && (
                    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/60 rounded-2xl shadow-sm">
                        <div className="text-xs text-yellow-600 dark:text-yellow-500 uppercase font-bold mb-2 tracking-wider">
                            {t ? t('budgetNotice').split(' ')[0] : 'Kündigungsfrist'}
                        </div>
                        <div className="text-xl font-bold text-yellow-800 dark:text-yellow-400">{selectedNode.noticePeriod}</div>
                    </div>
                )}
                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/60 rounded-2xl shadow-sm">
                    <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold mb-2 tracking-wider">{t ? t('budgetRuleCat') : 'Kategorie'}</div>
                    <div className="text-xl font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                        {getCategoryLabel(selectedNode.ruleCategory)}
                    </div>
                </div>
            </div>
        </div>
    );
};

module.exports = BudgetEditor;