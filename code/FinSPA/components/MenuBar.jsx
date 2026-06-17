const React = require('react');
const Icon = require('./Icons.jsx');

const MenuBar = ({ 
  data, viewMode, setViewMode, setActiveReport, setSelectedNode, 
  theme, setTheme, lang, setLang, setModalObj, t, 
  handleNewProject, handleOpenProject, handleSaveProject, 
  handleImportCSV, handleImportParqetCSV, handleExportCSV, handlePrint, handleExportPDF
}) => {
  
  // Umgebungen erkennen
  const isStandalone = typeof window !== 'undefined' && 
    (window.chrome?.webview || window.navigator?.userAgent.includes('Electron'));
  
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const handleWindowAction = (action) => {
    if (typeof window === 'undefined') return;

    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ command: action });
    } 
    else if (window.finspaHostAPI && typeof window.finspaHostAPI.send === 'function') {
      window.finspaHostAPI.send('window-control', action);
    }
    else {
      if (action === 'close') window.close();
    }
  };

  const MenuItem = ({ title, children }) => (
    // h-full sichert ab, dass es keinen Spalt beim Hover gibt
    <div className="relative group px-4 h-full flex items-center cursor-pointer hover:bg-slate-700 text-sm font-medium transition-colors" style={{ WebkitAppRegion: 'no-drag' }}>
      {title}
      {/* Das absolute Dropdown bekommt explizit no-drag, damit Electron Klicks zulässt */}
      <div className="absolute left-0 top-full hidden group-hover:block bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xl border dark:border-slate-700 min-w-[240px] rounded-b-md z-[9999]" style={{ WebkitAppRegion: 'no-drag', cursor: 'default' }}>
        {children}
      </div>
    </div>
  );
  
  const MenuSubItem = ({ label, onClick, iconName, rightText }) => (
    // Jedes klickbare Element braucht no-drag
    <div className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer transition-colors" onClick={onClick} style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="flex items-center gap-3">{iconName && <Icon name={iconName} size={14} className="w-4 text-center" />} {label}</div>
      {rightText && <span className="text-xs text-gray-400 font-bold">{rightText}</span>}
    </div>
  );

  const MenuNestedItem = ({ label, iconName, children }) => (
    <div className="relative group/nested px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer transition-colors" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="flex items-center gap-3">
        {iconName && <Icon name={iconName} size={14} className="w-4 text-center" />} 
        {label}
      </div>
      <Icon name="ChevronRight" size={12} className="text-gray-400" />
      <div className="absolute left-full top-0 hidden group-hover/nested:block bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xl border dark:border-slate-700 min-w-[240px] rounded-md z-[9999]" style={{ WebkitAppRegion: 'no-drag', cursor: 'default' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div 
      className={`print-hide flex bg-slate-900 text-slate-200 select-none items-center shadow-md relative z-50 h-10 ${isStandalone && isMac ? 'pl-[70px]' : ''}`}
      style={{ WebkitAppRegion: isStandalone ? 'drag' : 'auto' }}
    >
      <div className="px-4 h-full bg-blue-700 font-bold tracking-wider mr-2 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <Icon name="PieChart" size={16} className="text-white"/> FinSPA
      </div>
      
      <MenuItem title={t ? t('menuFile') : 'Datei'}>
        <MenuSubItem label={t ? t('fileNew') : 'Neu (Leeres Projekt)'} iconName="FilePlus" onClick={handleNewProject} />
        
        <label className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors" style={{ WebkitAppRegion: 'no-drag' }}>
          <Icon name="FolderOpen" size={14} className="w-4 text-center"/> {t ? t('fileOpen') : 'Öffnen'}
          <input type="file" accept=".json,.zip" className="hidden" onChange={handleOpenProject} />
        </label>
        
        <MenuSubItem label={t ? t('fileSave') : 'Speichern'} iconName="Save" onClick={() => handleSaveProject(false)} />
        <MenuSubItem label={t ? t('fileSaveAs') : 'Speichern unter...'} iconName="Copy" onClick={() => handleSaveProject(true)} />
        
        <hr className="dark:border-slate-700 my-1"/>
        
      <MenuNestedItem label={t ? t('fileImport') : 'Importieren'} iconName="Download">
        <label className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors" style={{ WebkitAppRegion: 'no-drag' }}>
          <Icon name="List" size={14} className="w-4 text-center"/> {t ? t('fileImportStandard') : 'Buchungen importieren'}
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
        </label>
        <label className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors" style={{ WebkitAppRegion: 'no-drag' }}>
          <Icon name="TrendingUp" size={14} className="w-4 text-center"/> {t ? t('fileImportParqet') : 'Parqet Daten importieren'}
          <input type="file" accept=".csv" className="hidden" onChange={handleImportParqetCSV} />
        </label>
        {data?.settings?.aiEnabled !== false && (
            <MenuSubItem label={t ? t('fileImportPdfKI') : 'PDF Rechnung scannen (KI)'} iconName="FileText" onClick={() => setModalObj({type: 'pdfImport'})} />
        )}
      </MenuNestedItem>

        <MenuNestedItem label={t ? t('fileExportTitle') : 'Exportieren'} iconName="Upload">
            <MenuSubItem label={t ? t('fileExportCsv') : 'Buchungen exportieren'} iconName="List" onClick={handleExportCSV} />
            <MenuSubItem label={t ? t('filePrintPdf') : 'Als PDF exportieren'} iconName="FileText" onClick={handleExportPDF} />
        </MenuNestedItem>
        
        <hr className="dark:border-slate-700 my-1"/>
        <MenuSubItem label={t ? t('filePrint') : 'Drucken'} iconName="Printer" onClick={handlePrint} rightText="Ctrl+P" />
        <hr className="dark:border-slate-700 my-1"/>
       
        <MenuSubItem label={t ? t('fileSettings') : 'Einstellungen'} iconName="Settings" onClick={() => setModalObj({type: 'settings'})} />
      </MenuItem>

      <MenuItem title={t ? t('menuViews') : 'Ansichten'}>
        <MenuSubItem label={t ? t('viewWealth') : 'Vermögensverwaltung'} iconName="Shield" onClick={() => { setViewMode('vermoegen'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'vermoegen' ? '✓' : ''} />
        <MenuSubItem label={t ? t('viewBudget') : 'Budgetverwaltung'} iconName="DollarSign" onClick={() => { setViewMode('budget'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'budget' ? '✓' : ''} />
        <hr className="dark:border-slate-700 my-1"/>
        <MenuSubItem label={t ? t('viewData') : 'Datensicht'} iconName="Settings" onClick={() => { setViewMode('datensicht'); setActiveReport(null); }} rightText={viewMode === 'datensicht' ? '✓' : ''} />

        {data?.settings?.aiEnabled !== false && (
          <>
            <hr className="dark:border-slate-700 my-1"/>
            <MenuSubItem label={t ? t('menuAiAssistant') : 'KI-Assistent (Ollama)'} iconName="Cpu" onClick={() => { setViewMode('ai'); setActiveReport(null); setSelectedNode(null); }} rightText={viewMode === 'ai' ? '✓' : ''} />
          </>
        )}
      </MenuItem>

      <MenuItem title={t ? t('menuReports') : 'Reports'}>
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider">{t ? t('repStock') : 'Bestandesreports'}</div>
        <MenuSubItem label={t ? t('repOverview') : "Banken & Kategorien"} iconName="List" onClick={() => setActiveReport('overview')} />
        <MenuSubItem label={t ? t('repAlloc') : 'Allokation nach Banken'} iconName="PieChart" onClick={() => setActiveReport('allocation')} />
        <MenuSubItem label={t ? t('repLiq') : 'Liquiditätsrisiko'} iconName="PieChart" onClick={() => setActiveReport('liquidity')} />
        <MenuSubItem label={t ? t('repHist') : 'Historischer Verlauf'} iconName="TrendingUp" onClick={() => setActiveReport('history')} />
        <MenuSubItem label={t ? t('repTax') : 'Steuerreport (31.12)'} iconName="List" onClick={() => setActiveReport('tax')} />
        <MenuSubItem label={t ? t('repPension3a') : 'Säule 3a Performance'} iconName="Lock" onClick={() => setActiveReport('pension3a')} />
        <MenuSubItem label={t ? t('repSecurities') : 'Aktien & Fonds Performance'} iconName="TrendingUp" onClick={() => setActiveReport('securities')} />
        
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider mt-1">{t ? t('repFlow') : 'Bewegungsreports'}</div>
        <MenuSubItem label={t ? t('repCatFlow') : 'Kategorienfluss'} iconName="BarChart" onClick={() => setActiveReport('categoryFlow')} />
        <MenuSubItem label={t ? t('repWaterfall') : 'Wasserfallfluss'} iconName="BarChart" onClick={() => setActiveReport('waterfall')} />
        <MenuSubItem label={t ? t('repPassive') : 'Passives Einkommen'} iconName="DollarSign" onClick={() => setActiveReport('passive')} />
        <MenuSubItem label={t ? t('repTopFlow') : 'Top Flow Assets'} iconName="BarChart" onClick={() => setActiveReport('topFlow')} />
        <MenuSubItem label={t ? t('repBookAna') : 'Buchungsanalyse'} iconName="PieChart" onClick={() => setActiveReport('bookingAnalysis')} />
        
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-900 text-[10px] font-black text-gray-500 uppercase tracking-wider mt-1">{t ? t('repFuture') : 'Zukunftsreports'}</div>
        <MenuSubItem label={t ? t('repSimReg') : 'Simulation & Regression'} iconName="TrendingUp" onClick={() => setActiveReport('future')} />
        <MenuSubItem label={t ? t('repScenFire') : 'Szenarien & FIRE'} iconName="Target" onClick={() => setActiveReport('scenarios')} />
      </MenuItem>
      
      <MenuItem title={t ? t('menuHelp') : 'Hilfe'}>
         <MenuSubItem label={t ? t('helpManual') : 'Benutzerhandbuch'} iconName="Info" onClick={() => setModalObj({type: 'help'})} />
         <hr className="dark:border-slate-700 my-1"/>
         <MenuSubItem label={t ? t('helpAbout') : 'Über FinSPA'} iconName="Star" onClick={() => setModalObj({type: 'about'})} />
      </MenuItem>

      <div className="ml-auto flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>      
         <MenuItem title={lang.toUpperCase()}>
          <MenuSubItem label="Deutsch" onClick={() => setLang('de')} rightText={lang === 'de' ? '✓' : ''} />
          <MenuSubItem label="English" onClick={() => setLang('en')} rightText={lang === 'en' ? '✓' : ''} />
          <MenuSubItem label="Français" onClick={() => setLang('fr')} rightText={lang === 'fr' ? '✓' : ''} />
          <MenuSubItem label="Italiano" onClick={() => setLang('it')} rightText={lang === 'it' ? '✓' : ''} />
        </MenuItem>

        <div className="px-4 h-full flex items-center cursor-pointer hover:bg-slate-700 border-l border-slate-700 transition-colors" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={t ? t('themeToggle') : 'Design umschalten'}>
          <Icon name={theme === 'light' ? "Moon" : "Sun"} size={16} />
        </div>

        {isStandalone && !isMac && (
          <div className="flex items-center border-l border-slate-700 h-full">
            <div className="px-4 h-full flex items-center cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => handleWindowAction('minimize')} title="Minimieren">
              <Icon name="Minus" size={16} />
            </div>
            <div className="px-4 h-full flex items-center cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => handleWindowAction('maximize')} title="Maximieren/Wiederherstellen">
              <Icon name="Square" size={14} />
            </div>
            <div className="px-4 h-full flex items-center cursor-pointer hover:bg-red-600 transition-colors" onClick={() => handleWindowAction('close')} title="Schließen">
              <Icon name="X" size={16} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

module.exports = MenuBar;