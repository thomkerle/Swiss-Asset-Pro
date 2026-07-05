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
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);

const BudgetDashboard = ({ data, fCur, t, isTreeVisible, setIsTreeVisible }) => {
    
    const getMonthly = (item) => {
        const amt = Number(item.amount) || 0;
        const freq = String(item.frequency || 'monthly').toLowerCase();
        switch (freq) {
            case 'yearly':
            case 'jährlich': 
                return amt / 12;
            case 'semi-annually':
            case 'half-yearly':
            case 'halbjährlich': 
                return amt / 6;
            case 'quarterly':
            case 'vierteljährlich': 
                return amt / 3;
            case 'monthly':
            case 'monatlich':
            default: 
                return amt;
        }
    };

    const incomes = data.budget?.incomeSources?.reduce((s, i) => s + getMonthly(i), 0) || 0;
    let needs = 0, wants = 0, explicitSavings = 0, totalExp = 0;

    const allOutflows = [...(data.budget?.expenses || []), ...(data.budget?.subscriptions || [])];
    allOutflows.forEach(item => {
        const mAmount = getMonthly(item);
        totalExp += mAmount;
        const cat = item.ruleCategory || 'needs';
        if (cat === 'wants') wants += mAmount;
        else if (cat === 'savings') explicitSavings += mAmount;
        else needs += mAmount; 
    });

    const leftover = incomes - totalExp;
    const trueSavings = explicitSavings; 
    const effectiveSavings = explicitSavings + Math.max(0, leftover);

    const activeChartEngine = data?.settings?.chartEngine || 'echarts';

    const safeT = (key, fallback) => t ? (t(key) || fallback) : fallback;

    const chartLabels = [
        `${safeT('chartLabelFixkosten', 'Fixkosten')} (${safeT('budgetRuleCat', 'Needs')})`, 
        `${safeT('chartLabelLifestyle', 'Lifestyle')} (${safeT('budgetRuleCat', 'Wants')})`, 
        safeT('ruleSavings', 'Savings')
    ];
    
    const chartDataValues = [needs, wants, trueSavings];
    const chartColors = ['#ef4444', '#f97316', '#10b981'];

    if (leftover > 0) {
        chartLabels.push(safeT('labelNetCashflow', 'Net Cashflow'));
        chartDataValues.push(leftover);
        chartColors.push('#3b82f6');
    }

    const pct = (val) => incomes > 0 ? Math.round((val / incomes) * 100) : 0;

    const KpiCard = ({ title, value, icon, accentBorder, iconColor, subtext }) => (
        <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 ${accentBorder}`}>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name={icon} size={14} className={iconColor} />
                <span>{title}</span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
                {value}
            </div>
            {subtext && <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">{subtext}</div>}
        </div>
    );

    return (
        <div className="w-full pt-8 px-4 md:px-8 pb-12 relative h-full overflow-auto finspa-scrollbar">
            <ReportHeader 
                title={safeT('menuBudget', 'Budget Dashboard')} 
                subtitle={safeT('budgetDashboardSub', 'Monatliche Analyse & 50/30/20 Verteilung')}
                isTreeVisible={isTreeVisible} 
                setIsTreeVisible={setIsTreeVisible} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
                <KpiCard 
                    title={safeT('incomeSources', 'Einkommen')} 
                    value={fCur ? fCur(incomes) : incomes} 
                    icon="TrendingUp" 
                    accentBorder="border-b-emerald-500" 
                    iconColor="text-emerald-500" 
                />
                <KpiCard 
                    title={safeT('labelTotalExpenses', 'Ausgaben')} 
                    value={fCur ? fCur(totalExp) : totalExp} 
                    icon="CreditCard" 
                    accentBorder="border-b-rose-500" 
                    iconColor="text-rose-500" 
                />
                <KpiCard 
                    title={safeT('ruleSavings', 'Sparquote (Fix)')} 
                    value={fCur ? fCur(trueSavings) : trueSavings} 
                    icon="Target" 
                    accentBorder="border-b-indigo-500" 
                    iconColor="text-indigo-500" 
                    subtext={`${pct(trueSavings)}% ${safeT('percentOfIncome', 'vom Einkommen')}`} 
                />
                <KpiCard 
                    title={safeT('labelNetCashflow', 'Net Cashflow')} 
                    value={fCur ? fCur(leftover) : leftover} 
                    icon="Activity" 
                    accentBorder={leftover >= 0 ? 'border-b-blue-500' : 'border-b-red-500'} 
                    iconColor={leftover >= 0 ? 'text-blue-500' : 'text-red-500'} 
                    subtext={leftover >= 0 ? safeT('netCashflowPositiveDesc', 'Frei verfügbarer monatlicher Puffer') : safeT('netCashflowNegativeDesc', 'Defizit im aktuellen Monat')} 
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-10">
                
                <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
                    <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Icon name="PieChart" className="text-indigo-500" /> {safeT('allocByCat', 'Verteilung')}
                    </h3>
                    <p className="text-xs text-gray-500 mb-6">{safeT('chartDescAllocation', 'Mittelallokation nach Regelwerk')}</p>
                    
                    <div className="w-full flex-1 relative flex items-center justify-center overflow-hidden min-h-[300px]">
                        {chartDataValues.reduce((a,b) => a+b, 0) > 0 ? (
                            <div className="w-full h-[300px] relative">
                                <UniversalChart 
                                    engine={activeChartEngine} 
                                    type="doughnut" 
                                    height="100%" 
                                    labels={chartLabels} 
                                    datasets={[{ 
                                        data: chartDataValues, 
                                        backgroundColor: chartColors,
                                        borderWidth: 0,
                                        // HIER: Der valueFormatter fixt das Problem mit den vielen Nachkommastellen im Tooltip
                                        valueFormatter: (val) => fCur ? fCur(val) : Number(val).toFixed(2)
                                    }]} 
                                />
                            </div>
                        ) : (
                            <div className="text-gray-400 text-sm flex flex-col items-center justify-center h-full gap-2">
                                <Icon name="Inbox" size={32} className="opacity-20" />
                                {safeT('noBudgetData', 'Keine Budget-Daten vorhanden')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
                    <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-200 flex justify-between items-center">
                        <span className="flex items-center gap-2"><Icon name="BarChart2" className="text-blue-500" /> {safeT('budgetStructureTitle', '50/30/20 Budget-Struktur')}</span>
                        <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px] font-bold text-gray-400 uppercase tracking-wider">{safeT('targetBenchmark', 'Target Benchmark')}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-8">{safeT('budgetStructureDesc', 'Performanceabgleich gegen standardisierte Allokationsmodelle')}</p>
                    
                    <div className="flex-1 space-y-6 flex flex-col justify-center">
                        <div>
                            <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div><span className="truncate">{safeT('needsDesc', 'Needs (Lebenshaltung & Fixkosten) — Ziel: max. 50%')}</span></span>
                                <span className={`shrink-0 ml-4 ${pct(needs) > 50 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{pct(needs)}% ({fCur ? fCur(needs) : needs})</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct(needs) > 50 ? 'bg-rose-500' : 'bg-slate-700 dark:bg-slate-400'}`} style={{ width: `${Math.min(pct(needs), 100)}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></div><span className="truncate">{safeT('wantsDesc', 'Wants (Lifestyle & Abos) — Ziel: max. 30%')}</span></span>
                                <span className={`shrink-0 ml-4 ${pct(wants) > 30 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>{pct(wants)}% ({fCur ? fCur(wants) : wants})</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct(wants) > 30 ? 'bg-orange-500' : 'bg-slate-700 dark:bg-slate-400'}`} style={{ width: `${Math.min(pct(wants), 100)}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div><span className="truncate">{safeT('savingsDesc', 'Effective Savings (Sparen + Puffer) — Ziel: min. 20%')}</span></span>
                                <span className={`shrink-0 ml-4 ${pct(effectiveSavings) >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>{pct(effectiveSavings)}% ({fCur ? fCur(effectiveSavings) : effectiveSavings})</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(pct(trueSavings), 100)}%` }}></div>
                                {leftover > 0 && <div className="bg-blue-400 dark:bg-blue-500 h-full opacity-80" style={{ width: `${Math.min(pct(leftover), 100 - pct(trueSavings))}%` }}></div>}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

module.exports = BudgetDashboard;