const React = require('react');
const Icon = require('./Icons.jsx');

const MenuBar = ({ viewMode, setViewMode, setActiveReport, setSelectedNode, theme, setTheme, lang, setLang, setModalObj, t, handleNewProject, handleOpenProject, handleSaveProject, handleImportCSV, handleExportCSV, handlePrint }) => {
  const MenuItem = ({ title, children }) => (
    <div className="relative group px-4 py-2 cursor-pointer hover:bg-slate-700 text-sm font-medium transition-colors">
      {title}
      <div className="absolute left-0 top-full hidden group-hover:block bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xl border dark:border-slate-700 min-w-[240px] rounded-b-md z-50">
        {children}
      </div>
    </div>
  );
  
  const MenuSubItem = ({ label, onClick, iconName, rightText }) => (
    <div className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer transition-colors" onClick={onClick}>
      <div className="flex items-center gap-3">{iconName && <Icon name={iconName} size={14} className="text-gray-500 dark:text-gray-400 w-4 text-center" />} {label}</div>
      {rightText && <span className="text-xs text-gray-400 font-bold">{rightText}</span>}
    </div>
  );

  return (
    <div className="print-hide flex bg-slate-900 text-slate-200 select-none items-center shadow-md relative z-50">
      <div className="px-4 py-2 bg-blue-700 font-bold tracking-wider mr-2 flex items-center gap-2"><Icon name="PieChart" size={16} className="text-white"/> FinSPA</div>
      
      <MenuItem title={t('menuFile')}>
        <MenuSubItem label={t('fileNew')} iconName="FilePlus" onClick={handleNewProject} />
        <label className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors">
          <Icon name="FolderOpen" size={14} className="text-gray-500 dark:text-gray-400 w-4 text-center"/> {t('fileOpen')}
          <input type="file" accept=".json" className="hidden" onChange={handleOpenProject} />
        </label>
        <MenuSubItem label={t('fileSave')} iconName="Save" onClick={handleSaveProject} />
        <hr className="dark:border-slate-700 my-1"/>
        <label className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors">
          <Icon name="Upload" size={14} className="text-gray-500 dark:text-gray-400 w-4 text-center"/> {t('fileImport')}
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
        </label>
        <MenuSubItem label={t('fileExport')} iconName="Download" onClick={handleExportCSV} />
        <hr className="dark:border-slate-700 my-1"/>
        <MenuSubItem label={t('filePrint')} iconName="Printer" onClick={handlePrint} rightText="Ctrl+P" />
        <hr className="dark:border-slate-700 my-1"/>
        <MenuSubItem label={t('fileSettings')} iconName="Settings" onClick={() => setModalObj({type: 'settings'})} />
      </MenuItem>

      <MenuItem title={t('menuViews')}>
        <MenuSubItem label={t('viewWealth')} iconName="Shield" onClick={() => { setViewMode('vermoegen'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'vermoegen' ? '✓' : ''} />
        <MenuSubItem label={t('viewBudget')} iconName="DollarSign" onClick={() => { setViewMode('budget'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'budget' ? '✓' : ''} />
        <hr className="dark:border-slate-700 my-1"/>
        <MenuSubItem label={t('viewData')} iconName="Settings" onClick={() => { setViewMode('datensicht'); setActiveReport(null); }} rightText={viewMode === 'datensicht' ? '✓' : ''} />
      </MenuItem>

      <MenuItem title={t('menuReports')}>
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider">{t('repStock')}</div>
        <MenuSubItem label={t('repAlloc')} iconName="PieChart" onClick={() => setActiveReport('allocation')} />
        <MenuSubItem label={t('repLiq')} iconName="PieChart" onClick={() => setActiveReport('liquidity')} />
        <MenuSubItem label={t('repHist')} iconName="TrendingUp" onClick={() => setActiveReport('history')} />
        <MenuSubItem label={t('repTax')} iconName="List" onClick={() => setActiveReport('tax')} />
        
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider mt-1">{t('repFlow')}</div>
        <MenuSubItem label={t('repCatFlow')} iconName="BarChart" onClick={() => setActiveReport('categoryFlow')} />
        <MenuSubItem label={t('repWaterfall')} iconName="BarChart" onClick={() => setActiveReport('waterfall')} />
        <MenuSubItem label={t('repPassive')} iconName="DollarSign" onClick={() => setActiveReport('passive')} />
        <MenuSubItem label={t('repTopFlow')} iconName="BarChart" onClick={() => setActiveReport('topFlow')} />
        <MenuSubItem label={t('repBookAna')} iconName="PieChart" onClick={() => setActiveReport('bookingAnalysis')} />
        
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider mt-1">{t('repFuture')}</div>
        <MenuSubItem label={t('repSimReg')} iconName="TrendingUp" onClick={() => setActiveReport('future')} />
        <MenuSubItem label={t('repScenFire')} iconName="Target" onClick={() => setActiveReport('scenarios')} />
      </MenuItem>
      
      <MenuItem title={t('menuHelp')}>
         <MenuSubItem label={t('helpManual')} iconName="Info" onClick={() => setModalObj({type: 'help'})} />
      </MenuItem>

      {/* Rechter Bereich: Sprache und Dark-Mode */}
      <div className="ml-auto flex items-center">
        <MenuItem title={lang.toUpperCase()}>
          <MenuSubItem label="Deutsch" onClick={() => setLang('de')} rightText={lang === 'de' ? '✓' : ''} />
          <MenuSubItem label="English" onClick={() => setLang('en')} rightText={lang === 'en' ? '✓' : ''} />
          <MenuSubItem label="Français" onClick={() => setLang('fr')} rightText={lang === 'fr' ? '✓' : ''} />
          <MenuSubItem label="Italiano" onClick={() => setLang('it')} rightText={lang === 'it' ? '✓' : ''} />
        </MenuItem>

        <div className="px-4 py-2 cursor-pointer hover:bg-slate-700 border-l border-slate-700 transition-colors" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Design umschalten">
          <Icon name={theme === 'light' ? "Moon" : "Sun"} size={16} />
        </div>
      </div>
    </div>
  );
};
module.exports = MenuBar;