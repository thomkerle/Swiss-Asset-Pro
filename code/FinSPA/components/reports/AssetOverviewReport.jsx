const React = require('react');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || {};
const { getAssetValueAtDate = () => 0 } = DataEngine;
const ReportHeader = safeRequire('../ReportHeader.jsx') || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);

const AssetOverviewReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const targetDate = dateRange?.to || new Date().toISOString().split('T')[0];
  const overview = {};
  let grandTotal = 0;

  const processNode = (node, bankName) => {
    if (node.isArchived) return;
    
    if (node.type === 'asset') {
      const val = getAssetValueAtDate(node, targetDate);
      if (val === 0) return;
      
      const ac = node.assetClass || 'cash';
      
      if (!overview[ac]) overview[ac] = { total: 0, banks: {} };
      if (!overview[ac].banks[bankName]) overview[ac].banks[bankName] = { total: 0, assets: [] };
      
      overview[ac].total += val;
      overview[ac].banks[bankName].total += val;
      overview[ac].banks[bankName].assets.push({ name: node.name, val });
      grandTotal += val; 
    }
    
    if (node.children) {
      node.children.forEach(child => processNode(child, bankName));
    }
  };

  data?.banks?.forEach(bank => {
    processNode(bank, bank.name);
  });

  const getAcName = (ac) => {
    // 1. Spezifische Keys zuerst prüfen (z.B. acPension_cash)
    const key = `ac${ac.charAt(0).toUpperCase() + ac.slice(1)}`;
    if (t) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    
    // 2. Fallback Map für hartkodierte oder fehlende Übersetzungen
    const map = { 
      cash: 'Konten / Cash', fund: 'Fonds / ETFs', stock: 'Aktien', 
      crypto: 'Krypto', realestate: 'Immobilien', mortgage: 'Hypotheken', 
      pension_cash: 'Vorsorge (Konten)', pension_fund: 'Vorsorge (Depots)' 
    };
    return map[ac] || ac;
  };

  const getAcIcon = (ac) => {
    if (ac === 'realestate') return 'Home';
    if (ac === 'mortgage') return 'Building';
    if (ac?.includes('pension')) return 'Lock';
    if (ac === 'crypto') return 'Coins';
    if (ac === 'fund' || ac === 'stock') return 'TrendingUp';
    return 'PieChart';
  };

  const sortedClasses = Object.keys(overview).sort((a,b) => overview[b].total - overview[a].total);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-200 dark:border-slate-800 pb-6 gap-4">
        <div className="flex-1">
          <ReportHeader 
            title={t('repOverviewTitle')} 
            subtitle={`${t('repOverviewSub')} ${targetDate}`} 
            isTreeVisible={isTreeVisible} 
            setIsTreeVisible={setIsTreeVisible} 
          />
        </div>
        
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-2xl shadow-lg shrink-0 min-w-[250px] border border-blue-500">
           <div className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
             <Icon name="Shield" size={12}/> {t('totalWealth')}
           </div>
           <div className="text-3xl font-black">{fCur(grandTotal)}</div>
        </div>
      </div>
      
      <div className="space-y-10">
        {sortedClasses.length === 0 && (
          <div className="bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
            <Icon name="Info" size={32} className="mx-auto mb-3 opacity-50"/>
            {t('noActiveAssets')}
          </div>
        )}
        
        {sortedClasses.map(ac => (
          <div key={ac} className="bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-white dark:bg-slate-800 px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-extrabold text-xl text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Icon name={getAcIcon(ac)} size={20} />
                </div>
                {getAcName(ac)}
              </h3>
              <div className="flex flex-col items-end">
                <span className="font-black text-2xl text-gray-900 dark:text-white">{fCur(overview[ac].total)}</span>
                <span className="text-xs font-bold text-gray-400 uppercase">{((overview[ac].total / grandTotal) * 100).toFixed(1)}% {t('ofPortfolio')}</span>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.keys(overview[ac].banks)
                .sort((a,b) => overview[ac].banks[b].total - overview[ac].banks[a].total)
                .map(bankName => (
                <div key={bankName} className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-xl transition-all duration-300 group flex flex-col">
                  
                  <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4 mb-4">
                     <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                       <Icon name="Building" size={14} className="text-gray-400"/> {bankName}
                     </span>
                     <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm">
                       {fCur(overview[ac].banks[bankName].total)}
                     </span>
                  </div>
                  
                  <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400 flex-1">
                    {overview[ac].banks[bankName].assets
                      .sort((a,b) => b.val - a.val)
                      .map((asset, idx) => (
                       <li key={idx} className="flex justify-between items-center py-1 border-b border-dashed border-gray-200 dark:border-slate-800 last:border-0">
                         <span className="truncate pr-4 font-medium" title={asset.name}>{asset.name}</span>
                         <span className="font-mono text-gray-900 dark:text-gray-300">{fCur(asset.val)}</span>
                       </li>
                    ))}
                  </ul>

                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

module.exports = AssetOverviewReport;