const React = require('react');

const BudgetEditor = ({ selectedNode, fCur, t }) => {
    const getMonthlyAmount = (amt, freq) => freq === 'yearly' ? (Number(amt) / 12) : Number(amt);
    const normalizedAmt = getMonthlyAmount(selectedNode.amount, selectedNode.frequency);

    const getCategoryLabel = (cat) => {
        if (cat === 'wants') return t('ruleWants');
        if (cat === 'savings') return t('ruleSavings');
        return t('ruleNeeds');
    };

    return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
            <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-4">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="text-blue-500">{selectedNode.budgetType}</span> {selectedNode.name}
                </h2>
                <p className="text-gray-500 mt-2">
                    {t('deleteNodeArchiveTip').includes('Archivieren') 
                        ? 'Detailansicht des Budget-Postens. Bearbeitung über den Eigenschaften-Editor (rechts).' 
                        : 'Detailed view of the budget item. Edit via the property editor (right).'}
                </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">{t('budgetAmount')}</div>
                    <div className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-baseline gap-2">
                        {fCur(selectedNode.amount)}
                        {selectedNode.frequency === 'yearly' && (
                            <span className="text-sm font-medium text-gray-500">({fCur(normalizedAmt)} / {t('freqMonthly').toLowerCase().substring(0,2)}.)</span>
                        )}
                    </div>
                </div>
                <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">{t('budgetFreq')}</div>
                    <div className="text-2xl font-black text-gray-800 dark:text-gray-100">
                        {selectedNode.frequency === 'monthly' ? t('freqMonthly') : selectedNode.frequency === 'yearly' ? t('freqYearly') : selectedNode.frequency}
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mt-6">
                {selectedNode.noticePeriod && (
                    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm">
                        <div className="text-xs text-yellow-600 dark:text-yellow-500 uppercase font-bold mb-1">{t('budgetNotice').split(' ')[0]}</div>
                        <div className="text-lg font-bold text-yellow-800 dark:text-yellow-400">{selectedNode.noticePeriod}</div>
                    </div>
                )}
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                    <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold mb-1">{t('budgetRuleCat')}</div>
                    <div className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase">
                        {getCategoryLabel(selectedNode.ruleCategory)}
                    </div>
                </div>
            </div>
        </div>
    );
};
module.exports = BudgetEditor;