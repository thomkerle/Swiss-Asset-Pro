const React = require('react');
const { PieChartSVG } = require('../Charts.jsx');

const BudgetDashboard = ({ data, fCur }) => {
    const incomes = data.budget.incomeSources.reduce((s, i) => s + Number(i.amount), 0);
    const expenses = data.budget.expenses.reduce((s, i) => s + Number(i.amount), 0);
    const subs = data.budget.subscriptions.reduce((s, i) => s + Number(i.amount), 0);
    const totalExp = expenses + subs;
    const savings = incomes - totalExp;

    const expData = [
      { label: 'Fixe Ausgaben', value: expenses, color: '#ef4444' },
      { label: 'Abonnements', value: subs, color: '#f97316' },
      { label: 'Mögliche Sparquote', value: savings > 0 ? savings : 0, color: '#22c55e' }
    ];

    return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 overflow-auto">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">Budget Übersicht</h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm"><div className="text-sm text-gray-500 font-bold uppercase tracking-wider">Einnahmen</div><div className="text-2xl font-black text-green-600 mt-2">{fCur(incomes)}</div></div>
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm"><div className="text-sm text-gray-500 font-bold uppercase tracking-wider">Ausgaben (inkl. Abos)</div><div className="text-2xl font-black text-red-600 mt-2">{fCur(totalExp)}</div></div>
                 <div className="p-6 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm"><div className="text-sm text-gray-500 font-bold uppercase tracking-wider">Monatliche Sparquote</div><div className="text-2xl font-black text-blue-600 mt-2">{fCur(savings)}</div></div>
             </div>
             <div className="p-8 bg-gray-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm flex justify-center"><PieChartSVG data={expData} fCur={fCur} /></div>
        </div>
    );
};
module.exports = BudgetDashboard;