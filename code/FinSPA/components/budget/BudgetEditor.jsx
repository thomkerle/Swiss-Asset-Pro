const React = require('react');

const BudgetEditor = ({ selectedNode, fCur }) => {
    return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
            <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-4"><h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3"><span className="text-blue-500">{selectedNode.budgetType}</span> {selectedNode.name}</h2><p className="text-gray-500 mt-2">Detailansicht des Budget-Postens. Bearbeitung über den Eigenschaften-Editor (rechts).</p></div>
            <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm"><div className="text-xs text-gray-500 uppercase font-bold mb-1">Eingetragener Betrag</div><div className="text-2xl font-black text-gray-800 dark:text-gray-100">{fCur(selectedNode.amount)}</div></div>
                <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm"><div className="text-xs text-gray-500 uppercase font-bold mb-1">Rhythmus / Frequenz</div><div className="text-2xl font-black text-gray-800 dark:text-gray-100">{selectedNode.frequency === 'monthly' ? 'Monatlich' : selectedNode.frequency === 'yearly' ? 'Jährlich' : selectedNode.frequency}</div></div>
            </div>
            {selectedNode.noticePeriod && (<div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm"><div className="text-xs text-yellow-600 dark:text-yellow-500 uppercase font-bold mb-1">Kündigungsfrist</div><div className="text-lg font-bold text-yellow-800 dark:text-yellow-400">{selectedNode.noticePeriod}</div></div>)}
        </div>
    );
};
module.exports = BudgetEditor;