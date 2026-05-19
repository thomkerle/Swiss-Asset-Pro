const i18n = {
  de: {
    // Menu & Allgemeine Navigation
    menuFile: 'Datei', menuWealth: 'Vermögen', menuBudget: 'Budget', menuViews: 'Ansichten', menuReports: 'Reports', menuData: 'Datensicht',
    fileNew: 'Neu (Leeres Projekt)', fileOpen: 'Öffnen (JSON)', fileSave: 'Sichern (JSON)', fileImport: 'Importieren (CSV)', 
    fileImportParqet: 'parqet-Import (.csv)', fileExport: 'Exportieren (CSV)', filePrint: 'Drucken', filePrintPdf: 'Als PDF exportieren', fileSettings: 'Einstellungen',
    menuHelp: 'Hilfe', helpManual: 'Benutzerhandbuch', helpAbout: 'Über FinSPA',
    themeToggle: 'Design umschalten',
    
    // Ansichten
    viewWealth: 'Vermögensverwaltung', viewBudget: 'Budgetverwaltung', viewData: 'Innere Datenhaltung (JSON)',
    
    // Reports Allgemein
    repStock: 'Bestandesreports', repFlow: 'Bewegungsreports', repFuture: 'Zukunftsreports', repBudget: 'Budgetreports',
    repOverview: 'Banken & Kategorien', repAlloc: 'Allokation nach Banken', repLiq: 'Liquiditätsrisiko', repHist: 'Historischer Verlauf', repTax: 'Steuerreport (31.12)',
    repCatFlow: 'Kategorienfluss', repWaterfall: 'Wasserfallfluss', repPassive: 'Passives Einkommen', repTopFlow: 'Top Flow Assets', repBookAna: 'Buchungsanalyse',
    repSimReg: 'Simulation & Regression', repScenFire: 'Szenarien & FIRE', reportLoading: 'Report wird geladen...',
    reportDate: 'Stichtag:',
    wordTo: 'bis',
    wordAnd: 'und',

    // AssetOverviewReport
    repOverviewTitle: 'Vermögensübersicht',
    repOverviewSub: 'Kategorien & Bankenverteilung zum Stichtag:',
    totalWealth: 'Gesamtvermögen',
    noActiveAssets: 'Keine aktiven Assets für diesen Stichtag gefunden.',
    ofPortfolio: 'des Portfolios',

    // TopFlowReport
    repTopFlowTitle: 'Top Flow Assets',
    repTopFlowSub: 'Gewinne und Verluste pro Asset im gewählten Zeitraum. (Assets ohne Bewegung sind ausgeblendet).',
    noFlowsFound: 'Keine Wertveränderungen im gewählten Zeitraum.',
    labelAsset: 'Asset',
    labelLoss: 'Verlust',
    labelProfit: 'Gewinn',

    // BookingAnalysisReport
    repBookAnaTitle: 'Buchungsanalyse',
    repBookAnaSub: 'Negative Flüsse (Ausgaben, Kosten, Zinsen) pro Detail-Kategorie',
    labelTotalExpenses: 'Total Ausgaben',
    labelBookingCount: 'Anzahl Buchungen',

    // CategoryFlowReport
    catUncategorized: 'Unkategorisiert',
    repCatFlowSub: 'Wertzunahme/-abnahme aggregiert nach Asset-Kategorien',

    // PassiveIncomeReport
    repPassiveSub: 'Alle Dividenden, Zinsen & Mieten zwischen',
    labelTotalPassive: 'Total Passives Einkommen',

    // TaxReport
    labelTaxDate: 'Stichtag für Steuererklärung:',
    labelGrossWealth: 'Bruttovermögen',
    labelDebts: 'Schulden',
    labelTaxableWealth: 'Steuerbares Reinvermögen',
    labelPosition: 'Position',
    labelTaxValueAt: 'Steuerwert am',

    // LiquidityReport
    repLiqTitle: 'Liquiditätsrisiko',
    repLiqSub: 'Sicht auf gebundenes vs. verfügbares Vermögen',
    labelLiquid: 'Liquide Mittel',
    labelIlliquid: 'Gebundenes Vermögen',
    labelAvailable: 'Verfügbar (Liquide)',
    labelTiedUp: 'Gebunden (Illiquide)',
    labelTargetDate: 'Stichtag:',
    labelRatio: 'Liquiditätsquote',

    // HistoryReport
    repHistTitle: 'Historischer Verlauf',
    repHistSub: 'Reale Berechnung basierend auf Salden & Buchungen',
    labelStartWealth: 'Startvermögen',
    labelEndWealth: 'Endvermögen',
    labelAbsoluteChange: 'Veränderung',
    labelTotalWealth: 'Gesamtvermögen',

    // ScenariosReport
    repScenFireTitle: 'Szenarien & FIRE',
    repScenFireSub: 'Zielverfolgung und Auswirkung zukünftiger Ereignisse.',
    labelFireGoal: 'FIRE Sparziel',
    labelTargetYear: 'Zieljahr:',
    labelAchieved: 'erreicht',
    labelFutureScenarios: 'Zukunftsszenarien',
    labelBtnNew: '+ Neu',
    labelImpactAnalysis: 'Projektion (Nach Szenarien)',
    labelProjectedWealth: 'Projiziertes Vermögen',

    // WaterfallReport
    repWaterfallTitle: 'Wasserfallfluss',
    repWaterfallSub: 'Treiber der Vermögensveränderung',
    labelWaterfallStart: 'Startwert',
    labelWaterfallInflows: 'Zuflüsse',
    labelWaterfallOutflows: 'Abflüsse',
    labelWaterfallMarket: 'Markt / Anpassung',
    labelWaterfallEnd: 'Endwert',
    labelNetCashflow: 'Netto-Cashflow',
    labelMarketEffect: 'Markteffekt',

    // FutureReport
    repSimRegTitle: 'Zukunfts-Simulation (Regression)',
    repSimRegSub: 'Basierend auf historischer Performance inkl. definierter Zukunftsszenarien',
    msgNotEnoughHistory: 'Zu wenig Historie für Regression. (Mind. 2 Monate nötig)',
    labelLinear: 'Linear',
    labelExponential: 'Exponentiell',
    labelToday: 'Heute',
    label3Months: '+3 Monate',
    label1Year: '+1 Jahr',
    label3Years: '+3 Jahre',
    label5Years: '+5 Jahre',
    labelProj5Years: 'Projection (in 5 Jahren)',
    
    // UI Elemente & Status
    tree: 'Strukturbaum', propEditor: 'Eigenschaftseditor', statusReady: 'Bereit', version: 'Version', 
    dateSelect: 'Zeitraum', dateRangeTitle: 'Zeitraum:',
    btnApply: 'Anwenden', btnCancel: 'Abbrechen', btnSave: 'Speichern', btnAdd: 'Hinzufügen', btnDelete: 'Löschen',
    btnSaveSettings: 'Einstellungen speichern',
    
    // TreeView & Baumstruktur
    addBank: 'Bank hinzufügen', addCategory: 'Kategorie hinzufügen', addSubCategory: 'Unterkategorie hinzufügen', addAsset: 'Asset hinzufügen', deleteConfirm: 'Wirklich löschen?',
    hideTree: 'Strukturbaum ausblenden', toggleArchived: 'Archivierte Elemente ein-/ausblenden',
    
    // Asset Klassen & Eigenschaften
    assetClass: 'Anlageklasse', currency: 'Währung', exchangeRate: 'Wechselkurs', isLiquid: 'Liquides Mittel', isArchived: 'Archiviert', propName: 'Name', propInactive: 'inaktiv.',
    acCash: 'Konto', acFund: 'Fonds / ETF', acStock: 'Aktie', acCrypto: 'Krypto', acRealEstate: 'Immobilie', acMortgage: 'Hypothek', acPensionCash: 'Vorsorgekonto 3a', acPensionFund: 'Vorsorgedepot 3a',
    propTrackRateTitle: 'Genereller Tracking-Kurs', propCurrentRate: 'Aktueller Kurs', propSecurityStatus: 'Wertpapier Status', propCurrentShares: 'Aktuelle Stückzahl', propCurrentPrice: 'Aktueller Preis',
    
    // EditorArea (Dashboard & Buchungen)
    welcomeTitle: 'Willkommen in FinSPA', welcomePrompt: 'Bitte wählen Sie links ein Element aus dem Baum oder öffnen Sie einen Report.',
    viewTitle: 'Ansicht:', selectAssetPrompt: 'Wähle auf der linken Seite ein Asset aus, um die detaillierten Buchungen zu sehen.',
    mainPortfolio: 'Hauptportfolio', consWealthOverview: 'Konsolidierte Vermögensübersicht (Währungsbereinigt)', totalValue: 'Gesamtwert',
    allocByCat: 'Aufteilung nach Kategorien', noValuedAssets: 'Keine bewerteten Assets vorhanden.', subcatTotals: 'Subkategorien-Summen',
    assetClassLabel: 'Klasse:', valueToday: 'Wert (Heute):',
    addBookingBtn: 'Buchung erfassen', addBalanceBtn: 'Stichtags-Saldo setzen',
    
    // Buchungen & Tabellen
    bookings: 'Buchungen', date: 'Datum', type: 'Typ', category: 'Kategorie', amount: 'Betrag', entryType: 'Eintrag', entryDetail: 'Detail',
    systemManual: 'System/Manuell', pcsAt: 'Stk. à', rateLabel: 'Kurs:', balanceLabel: 'SALDO',
    income: 'Einzahlung', expense: 'Auszahlung',
    typeDeposit: 'Einzahlung', typeWithdrawal: 'Auszahlung', typeBuy: 'Kauf', typeSell: 'Verkauf', typeAmortization: 'Abzahlung', typeReval: 'Wertanpassung', typeInterest: 'Zinszahlung', typeDiv: 'Dividende', typeDebtInc: 'Schulderhöhung', typeFee: 'Gebühr',
    
    // Budget & Property Editor
    budgetDetails: 'Budget Details', budgetName: 'Bezeichnung', budgetAmount: 'Betrag', budgetFreq: 'Frequenz', freqMonthly: 'Monatlich', freqYearly: 'Jährlich',
    budgetRuleCat: '50/30/20 Kategorie', ruleNeeds: 'Needs (Fixkosten, z.B. Wohnen, Steuern)', ruleWants: 'Wants (Lifestyle, z.B. Abos, Freizeit)', ruleSavings: 'Savings (Sparen, z.B. 3a, ETF-Sparplan)',
    budgetNotice: 'Kündigungsfrist (Optional)',
    incomeSources: 'Einnahmequellen', expensePositions: 'Ausgabepositionen', subscriptions: 'Abos & Verträge', addBudgetItem: 'Neuen Posten hinzufügen',
    
    // Budget Dashboard & Editor
    budgetBenchmark: 'Benchmark Comparison',
    budgetDistribution: 'Verteilung (Normalisiert)',
    budgetShortNeeds: 'Needs (Fixkosten)',
    budgetShortWants: 'Wants (Lifestyle)',
    budgetShortSavings: 'Savings (Sparen/Invest)',
    budgetEditorSub: 'Detailansicht des Budget-Postens. Bearbeitung über den Eigenschaften-Editor (rechts).',
    budgetTipText: 'Weisen Sie Ausgaben im Eigenschaften-Editor den Kategorien Needs, Wants oder Savings zu. Der Restbetrag ist Ihr freier Puffer.',
    budgetShortMonth: 'Mt.',
    budgetNoticeShort: 'Kündigungsfrist',

    // Settings Modal
    tabCategories: 'Buchungskategorien',
    tabGeneral: 'Allgemein',
    settingsCatDesc: 'Definieren Sie hier die Unterkategorien für die verschiedenen Transaktionstypen. Diese stehen beim Erfassen von Buchungen als Dropdown zur Verfügung.',
    labelTransTypeSetting: 'Transaktionstyp',
    labelSubCategories: 'Zugehörige Unterkategorien',
    labelNewCategory: 'Neue Kategorie anlegen',
    placeholderCatName: 'Name der Kategorie...',
    labelBaseCurrency: 'Basiswährung der Anwendung',

    // Transaktionstypen (Daten-Schlüssel)
    Einzahlung: 'Einzahlung',
    Auszahlung: 'Auszahlung',
    Kauf: 'Kauf',
    Verkauf: 'Verkauf',
    Abzahlung: 'Abzahlung',
    Wertanpassung: 'Wertanpassung',
    Zinszahlung: 'Zinszahlung',
    Dividende: 'Dividende',
    Schulderhöhung: 'Schulderhöhung',
    Gebühr: 'Gebühr',

    // Standard-Unterkategorien (defaultBookingCategories)
    Lohn: 'Lohn',
    Dividenden: 'Dividenden',
    Zinsen: 'Zinsen',
    Mieteinnahmen: 'Mieteinnahmen',
    Sonstiges: 'Sonstiges',
    Steuern: 'Steuern',
    Gebühren: 'Gebühren',
    Lebensmittel: 'Lebensmittel',
    Telekommunikation: 'Telekommunikation',
    Versicherungen: 'Versicherungen',
    Verkehr: 'Verkehr',
    Investition: 'Investition',
    Reinvestition: 'Reinvestition',
    Liquidation: 'Liquidation',
    Teilverkauf: 'Teilverkauf',
    Ausschüttung: 'Ausschüttung',
    Marktbewertung: 'Marktbewertung',
    Abschreibung: 'Abschreibung',
    Amortisation: 'Amortisation',
    Sondertilgung: 'Sondertilgung',
    Hypothekarzins: 'Hypothekarzins',
    Sollzins: 'Sollzins',
    Aufstockung: 'Aufstockung',
    Depotgebühr: 'Depotgebühr',
    Transaktionsgebühr: 'Transaktionsgebühr',

    // Formulare, Dialoge & Modal-Fenster
    modalEdit: 'Bearbeiten', modalNew: 'Neu erfassen', selectOption: '-- Wählen --', btnClose: 'Schließen',
    goalTarget: 'Zielbetrag (FIRE)', goalYear: 'Zieljahr',
    scenarioName: 'Szenario Name', scenarioDate: 'Datum (Eintritt)', scenarioImpact: 'Impact (positiv oder negativ)',
    labelTransType: 'Transaktionstyp', labelSubCategory: 'Detail-Kategorie', transDetails: 'Transaktionsdetails',
    labelShares: 'Stückzahl', labelPricePerShare: 'Preis pro Stück', labelFees: 'Gebühren', labelTaxes: 'Steuern',
    labelExchangeRateTrans: 'Wechselkurs (zum Transaktionszeitpunkt)', labelTotalAmount: 'Totalbetrag (Gesamt in',
    balanceNotice: 'Setzt den absoluten Stichtags-Saldo des gesamten Assets.', labelBalanceDate: 'Stichtag',
    labelAbsoluteBalance: 'Absoluter Saldo', labelExchangeRateDate: 'Wechselkurs (zum Stichtag - Optional)',
    
    // Löschen & About Dialog
    deleteNodeTitle: 'Element entfernen', deleteNodeConfirmPrefix: 'Möchten Sie', deleteNodeConfirmSuffix: 'wirklich löschen?',
    deleteNodeArchiveTip: 'Tipp: Durch das Archivieren bleibt das Element erhalten, wird aber ausgeblendet.',
    btnArchiveOnly: 'Nur Archivieren', btnDeletePermanent: 'Endgültig löschen',
    aboutDesc: 'Dein modernes Werkzeug für ganzheitliche Finanzplanung, Budgetierung und Portfolio-Analyse.',
    aboutDev: 'Entwickelt von Thomas Kerle', aboutRights: 'Alle Rechte vorbehalten.',

    // Benachrichtigungen (Toasts) & Alerts
    msgNewProjectWarning: 'Achtung: Alle nicht gespeicherten Änderungen gehen verloren. Neues, leeres Projekt starten?',
    msgNewProjectSuccess: 'Neues Projekt gestartet', msgOpenSuccess: 'Projekt erfolgreich geöffnet!',
    msgSaveSuccess: 'Projekt gesichert', msgInvalidVersion: 'Keine gültige Version.',
    msgInvalidJson: 'Fehler beim Öffnen: Ungültiges JSON.', msgCsvSuccess: 'CSV Export erfolgreich',
    msgCsvError: 'Fehler beim CSV Export', msgCsvNotSupported: 'CSV Import wird im nächsten Release unterstützt.',
    msgImportModuleError: 'Importer-Modul nicht korrekt geladen (Typenkonflikt).',
    msgFileEmpty: 'Die ausgewählte Datei enthält keine Daten.', msgParqetSuccess: 'parqet CSV-Export erfolgreich importiert!',
    msgNoValidAssets: 'Keine validen Asset-Daten in der Datei gefunden.', msgProcessErrorPrefix: 'Fehler beim Verarbeiten: ',
    msgFileReadError: 'Datei konnte nicht von der Festplatte gelesen werden.',
    msgSaved: 'Gespeichert!', msgDeleted: 'Gelöscht!', msgArchived: 'Element archiviert',
    msgDeletedPermanent: 'Endgültig gelöscht', msgRatesSynced: 'Wechselkurse synchronisiert', msgSettingsSaved: 'Einstellungen gespeichert!'
  },

  en: {
    // Menu & General Navigation
    menuFile: 'File', menuWealth: 'Wealth', menuBudget: 'Budget', menuViews: 'Views', menuReports: 'Reports', menuData: 'Data View',
    fileNew: 'New (Empty Project)', fileOpen: 'Open (JSON)', fileSave: 'Save (JSON)', fileImport: 'Import (CSV)', 
    fileImportParqet: 'parqet Import (.csv)', fileExport: 'Export (CSV)', filePrint: 'Print', filePrintPdf: 'Export as PDF', fileSettings: 'Settings',
    menuHelp: 'Help', helpManual: 'User Manual', helpAbout: 'About FinSPA',
    themeToggle: 'Toggle Theme',
    
    // Views
    viewWealth: 'Wealth Management', viewBudget: 'Budget Management', viewData: 'Internal Data (JSON)',
    
    // Reports General
    repStock: 'Inventory Reports', repFlow: 'Movement Reports', repFuture: 'Future Reports', repBudget: 'Budget Reports',
    repOverview: 'Banks & Categories', repAlloc: 'Allocation by Bank', repLiq: 'Liquidity Risk', repHist: 'Historical History', repTax: 'Tax Report (31.12)',
    repCatFlow: 'Category Flow', repWaterfall: 'Waterfall Flow', repPassive: 'Passive Income', repTopFlow: 'Top Flow Assets', repBookAna: 'Transaction Analysis',
    repSimReg: 'Simulation & Regression', repScenFire: 'Scenarios & FIRE', reportLoading: 'Loading report...',
    reportDate: 'As of:',
    wordTo: 'to',
    wordAnd: 'and',

    // AssetOverviewReport
    repOverviewTitle: 'Wealth Overview',
    repOverviewSub: 'Categories & Bank Distribution as of:',
    totalWealth: 'Total Wealth',
    noActiveAssets: 'No active assets found for this target date.',
    ofPortfolio: 'of the portfolio',

    // TopFlowReport
    repTopFlowTitle: 'Top Flow Assets',
    repTopFlowSub: 'Profits and losses per asset in the selected period. (Assets without movement are hidden).',
    noFlowsFound: 'No value changes in the selected period.',
    labelAsset: 'Asset',
    labelLoss: 'Loss',
    labelProfit: 'Profit',

    // BookingAnalysisReport
    repBookAnaTitle: 'Transaction Analysis',
    repBookAnaSub: 'Negative flows (expenses, costs, interest) per detailed category',
    labelTotalExpenses: 'Total Expenses',
    labelBookingCount: 'Number of Transactions',

    // CategoryFlowReport
    catUncategorized: 'Uncategorized',
    repCatFlowSub: 'Value increase/decrease aggregated by asset categories',

    // PassiveIncomeReport
    repPassiveSub: 'All dividends, interest & rent between',
    labelTotalPassive: 'Total Passive Income',

    // TaxReport
    labelTaxDate: 'Cut-off date for tax return:',
    labelGrossWealth: 'Gross Wealth',
    labelDebts: 'Debts',
    labelTaxableWealth: 'Taxable Net Wealth',
    labelPosition: 'Position',
    labelTaxValueAt: 'Tax value as of',
    
    // LiquidityReport
    repLiqTitle: 'Liquidity Risk',
    repLiqSub: 'View of tied-up vs. available wealth',
    labelLiquid: 'Liquid Assets',
    labelIlliquid: 'Tied-up Assets',
    labelAvailable: 'Available (Liquid)',
    labelTiedUp: 'Tied-up (Illiquide)',
    labelTargetDate: 'As of:',
    labelRatio: 'Liquidity Ratio',

    // HistoryReport
    repHistTitle: 'Historical Progress',
    repHistSub: 'Real calculation based on balances & transactions',
    labelStartWealth: 'Start Wealth',
    labelEndWealth: 'End Wealth',
    labelAbsoluteChange: 'Change',
    labelTotalWealth: 'Total Wealth',

    // ScenariosReport
    repScenFireTitle: 'Scenarios & FIRE',
    repScenFireSub: 'Goal tracking and impact of future events.',
    labelFireGoal: 'FIRE Savings Goal',
    labelTargetYear: 'Target Year:',
    labelAchieved: 'achieved',
    labelFutureScenarios: 'Future Scenarios',
    labelBtnNew: '+ New',
    labelImpactAnalysis: 'Projection (After Scenarios)',
    labelProjectedWealth: 'Projected Wealth',

    // WaterfallReport
    repWaterfallTitle: 'Waterfall Flow',
    repWaterfallSub: 'Drivers of wealth change',
    labelWaterfallStart: 'Start Value',
    labelWaterfallInflows: 'Inflows',
    labelWaterfallOutflows: 'Outflows',
    labelWaterfallMarket: 'Market / Adjustments',
    labelWaterfallEnd: 'End Value',
    labelNetCashflow: 'Net Cashflow',
    labelMarketEffect: 'Market Effect',

    // FutureReport
    repSimRegTitle: 'Future Simulation (Regression)',
    repSimRegSub: 'Based on historical performance incl. defined future scenarios',
    msgNotEnoughHistory: 'Not enough history for regression. (Min. 2 months required)',
    labelLinear: 'Linear',
    labelExponential: 'Exponential',
    labelToday: 'Today',
    label3Months: '+3 Months',
    label1Year: '+1 Year',
    label3Years: '+3 Years',
    label5Years: '+5 Years',
    labelProj5Years: 'Projection (in 5 Years)',

    // UI Elements & Status
    tree: 'Structure Tree', propEditor: 'Property Editor', statusReady: 'Ready', version: 'Version', 
    dateSelect: 'Period', dateRangeTitle: 'Period:',
    btnApply: 'Apply', btnCancel: 'Cancel', btnSave: 'Save', btnAdd: 'Add', btnDelete: 'Delete',
    btnSaveSettings: 'Save Settings',

    // TreeView & Structure
    addBank: 'Add Bank', addCategory: 'Add Category', addSubCategory: 'Add Subcategory', addAsset: 'Add Asset', deleteConfirm: 'Really delete?',
    hideTree: 'Hide Structure Tree', toggleArchived: 'Toggle archived items',
    
    // Asset Classes & Properties
    assetClass: 'Asset Class', currency: 'Currency', exchangeRate: 'Exchange Rate', isLiquid: 'Liquid Asset', isArchived: 'Archived', propName: 'Name', propInactive: 'inactive.',
    acCash: 'Account', acFund: 'Fund / ETF', acStock: 'Stock', acCrypto: 'Crypto', acRealEstate: 'Real Estate', acMortgage: 'Mortgage', acPensionCash: 'Pension Account 3a', acPensionFund: 'Pension Portfolio 3a',
    propTrackRateTitle: 'General Tracking Rate', propCurrentRate: 'Current Rate', propSecurityStatus: 'Security Status', propCurrentShares: 'Current Shares', propCurrentPrice: 'Current Price',
    
    // EditorArea (Dashboard & Bookings)
    welcomeTitle: 'Welcome to FinSPA', welcomePrompt: 'Please select an item from the tree on the left or open a report.',
    viewTitle: 'View:', selectAssetPrompt: 'Select an asset on the left to see detailed transactions.',
    mainPortfolio: 'Main Portfolio', consWealthOverview: 'Consolidated Wealth Overview (Currency Adjusted)', totalValue: 'Total Value',
    allocByCat: 'Allocation by Category', noValuedAssets: 'No valued assets available.', subcatTotals: 'Subcategory Totals',
    assetClassLabel: 'Class:', valueToday: 'Value (Today):',
    addBookingBtn: 'Add Transaction', addBalanceBtn: 'Set Balance Record',
    
    // Bookings & Tables
    bookings: 'Transactions', date: 'Date', type: 'Type', category: 'Category', amount: 'Amount', entryType: 'Entry', entryDetail: 'Detail',
    systemManual: 'System/Manual', pcsAt: 'pcs. at', rateLabel: 'Rate:', balanceLabel: 'BALANCE',
    income: 'Deposit', expense: 'Withdrawal',
    typeDeposit: 'Deposit', typeWithdrawal: 'Withdrawal', typeBuy: 'Buy', typeSell: 'Sell', typeAmortization: 'Amortization', typeReval: 'Value Adjustment', typeInterest: 'Interest Payment', typeDiv: 'Dividend', typeDebtInc: 'Debt Increase', typeFee: 'Fee',
    
    // Budget & Property Editor
    budgetDetails: 'Budget Details', budgetName: 'Designation', budgetAmount: 'Amount', budgetFreq: 'Frequency', freqMonthly: 'Monthly', freqYearly: 'Yearly',
    budgetRuleCat: '50/30/20 Category', ruleNeeds: 'Needs (Fixed costs, e.g. housing, taxes)', ruleWants: 'Wants (Lifestyle, e.g. subs, leisure)', ruleSavings: 'Savings (e.g. 3a, ETF plan)',
    budgetNotice: 'Notice Period (Optional)',
    incomeSources: 'Income Sources', expensePositions: 'Expense Items', subscriptions: 'Subscriptions & Contracts', addBudgetItem: 'Add New Item',

    // Budget Dashboard & Editor
    budgetBenchmark: 'Benchmark Comparison',
    budgetDistribution: 'Distribution (Normalized)',
    budgetShortNeeds: 'Needs (Fixed Costs)',
    budgetShortWants: 'Wants (Lifestyle)',
    budgetShortSavings: 'Savings (Save/Invest)',
    budgetEditorSub: 'Detailed view of the budget item. Edit via the property editor (right).',
    budgetTipText: 'Assign expenses to Needs, Wants or Savings categories in the property editor. The remaining amount is your free buffer.',
    budgetShortMonth: 'Mo.',
    budgetNoticeShort: 'Notice Period',

    // Settings Modal
    tabCategories: 'Booking Categories',
    tabGeneral: 'General',
    settingsCatDesc: 'Define the subcategories for the various transaction types here. These will be available as a dropdown when recording transactions.',
    labelTransTypeSetting: 'Transaction Type',
    labelSubCategories: 'Associated Subcategories',
    labelNewCategory: 'Create New Category',
    placeholderCatName: 'Category name...',
    labelBaseCurrency: 'Application Base Currency',

    // Transaction Type Key Mapping
    Einzahlung: 'Deposit',
    Auszahlung: 'Withdrawal',
    Kauf: 'Buy',
    Verkauf: 'Sell',
    Abzahlung: 'Amortization',
    Wertanpassung: 'Value Adjustment',
    Zinszahlung: 'Interest Payment',
    Dividende: 'Dividend',
    Schulderhöhung: 'Debt Increase',
    Gebühr: 'Fee',

    // Standard Subcategories
    Lohn: 'Salary',
    Dividenden: 'Dividends',
    Zinsen: 'Interest',
    Mieteinnahmen: 'Rental Income',
    Sonstiges: 'Other',
    Steuern: 'Taxes',
    Gebühren: 'Fees',
    Lebensmittel: 'Groceries',
    Telekommunikation: 'Telecommunications',
    Versicherungen: 'Insurance',
    Verkehr: 'Transport',
    Investition: 'Investment',
    Reinvestition: 'Reinvestment',
    Liquidation: 'Liquidation',
    Teilverkauf: 'Partial Sale',
    Ausschüttung: 'Distribution',
    Marktbewertung: 'Market Valuation',
    Abschreibung: 'Depreciation',
    Amortisation: 'Amortization',
    Sondertilgung: 'Special Repayment',
    Hypothekarzins: 'Mortgage Interest',
    Sollzins: 'Debit Interest',
    Aufstockung: 'Top-up',
    Depotgebühr: 'Custody Fee',
    Transaktionsgebühr: 'Transaction Fee',

    // Formulare, Dialoge & Modal-Fenster
    modalEdit: 'Edit', modalNew: 'Add New', selectOption: '-- Select --', btnClose: 'Close',
    goalTarget: 'Target Amount (FIRE)', goalYear: 'Target Year',
    scenarioName: 'Scenario Name', scenarioDate: 'Date (Occurrence)', scenarioImpact: 'Impact (positive or negative)',
    labelTransType: 'Transaction Type', labelSubCategory: 'Subcategory', transDetails: 'Transaction Details',
    labelShares: 'Shares', labelPricePerShare: 'Price per Share', labelFees: 'Fees', labelTaxes: 'Taxes',
    labelExchangeRateTrans: 'Exchange Rate (at transaction)', labelTotalAmount: 'Total amount (Total in',
    balanceNotice: 'Sets the absolute balance of the entire asset for a specific date.', labelBalanceDate: 'Target Date',
    labelAbsoluteBalance: 'Absolute Balance', labelExchangeRateDate: 'Exchange Rate (at target date - Optional)',
    
    // Löschen & About Dialog
    deleteNodeTitle: 'Remove Item', deleteNodeConfirmPrefix: 'Do you really want to delete', deleteNodeConfirmSuffix: '?',
    deleteNodeArchiveTip: 'Tip: Archiving keeps the item intact but hides it from view.',
    btnArchiveOnly: 'Archive Only', btnDeletePermanent: 'Delete Permanently',
    aboutDesc: 'Your modern tool for holistic financial planning, budgeting, and portfolio analysis.',
    aboutDev: 'Developed by Thomas Kerle', aboutRights: 'All rights reserved.',

    // Benachrichtigungen (Toasts) & Alerts
    msgNewProjectWarning: 'Warning: All unsaved changes will be lost. Start a new, empty project?',
    msgNewProjectSuccess: 'New project started', msgOpenSuccess: 'Project opened successfully!',
    msgSaveSuccess: 'Project saved', msgInvalidVersion: 'Not a valid version.',
    msgInvalidJson: 'Error opening: Invalid JSON.', msgCsvSuccess: 'CSV export successful',
    msgCsvError: 'Error during CSV export', msgCsvNotSupported: 'CSV import will be supported in the next release.',
    msgImportModuleError: 'Importer module not loaded correctly (Type conflict).',
    msgFileEmpty: 'The selected file contains no data.', msgParqetSuccess: 'parqet CSV export imported successfully!',
    msgNoValidAssets: 'No valid asset data found in the file.', msgProcessErrorPrefix: 'Error processing: ',
    msgFileReadError: 'File could not be read from disk.',
    msgSaved: 'Saved!', msgDeleted: 'Deleted!', msgArchived: 'Item archived',
    msgDeletedPermanent: 'Permanently deleted', msgRatesSynced: 'Exchange rates synchronized', msgSettingsSaved: 'Settings saved!'
  },

  fr: {
    // Menu & Navigation Générale
    menuFile: 'Fichier', menuWealth: 'Patrimoine', menuBudget: 'Budget', menuViews: 'Vues', menuReports: 'Rapports', menuData: 'Vue des données',
    fileNew: 'Nouveau (Projet vide)', fileOpen: 'Ouvrir (JSON)', fileSave: 'Enregistrer (JSON)', fileImport: 'Importer (CSV)', 
    fileImportParqet: 'Import parqet (.csv)', fileExport: 'Exporter (CSV)', filePrint: 'Imprimer', filePrintPdf: 'Exporter en PDF', fileSettings: 'Paramètres',
    menuHelp: 'Aide', helpManual: 'Manuel d\'utilisation', helpAbout: 'À propos de FinSPA',
    themeToggle: 'Changer de thème',
    
    // Vues
    viewWealth: 'Gestion de patrimoine', viewBudget: 'Gestion du budget', viewData: 'Données internes (JSON)',
    
    // Rapports Général
    repStock: 'Rapports d\'inventaire', repFlow: 'Rapports de mouvements', repFuture: 'Rapports futurs', repBudget: 'Rapports de budget',
    repOverview: 'Banques & Catégories', repAlloc: 'Allocation par banque', repLiq: 'Risque de liquidité', repHist: 'Historique', repTax: 'Rapport fiscal (31.12)',
    repCatFlow: 'Flux de catégories', repWaterfall: 'Flux en cascade', repPassive: 'Revenus passifs', repTopFlow: 'Top Flow Assets', repBookAna: 'Analyse des écritures',
    repSimReg: 'Simulation & Régression', repScenFire: 'Scénarios & FIRE', reportLoading: 'Chargement du rapport...',
    reportDate: 'Date de référence :',
    wordTo: 'à',
    wordAnd: 'et',

    // AssetOverviewReport
    repOverviewTitle: 'Aperçu du patrimoine',
    repOverviewSub: 'Catégories & répartition bancaire à la date du :',
    totalWealth: 'Patrimoine total',
    noActiveAssets: 'Aucun actif actif trouvé pour cette date.',
    ofPortfolio: 'du portefeuille',

    // TopFlowReport
    repTopFlowTitle: 'Top Flow Assets',
    repTopFlowSub: 'Gains et pertes par actif sur la période sélectionnée. (Les actifs sans mouvement sont masqués).',
    noFlowsFound: 'Aucune variation de valeur au cours de la période sélectionnée.',
    labelAsset: 'Actif',
    labelLoss: 'Perte',
    labelProfit: 'Gain',

    // BookingAnalysisReport
    repBookAnaTitle: 'Analyse des écritures',
    repBookAnaSub: 'Flux négatifs (dépenses, coûts, intérêts) par catégorie détaillée',
    labelTotalExpenses: 'Total des dépenses',
    labelBookingCount: 'Nombre de transactions',

    // CategoryFlowReport
    catUncategorized: 'Non catégorisé',
    repCatFlowSub: 'Augmentation/diminution de valeur agrégée par catégories d\'actifs',

    // PassiveIncomeReport
    repPassiveSub: 'Tous les dividendes, intérêts et loyers entre',
    labelTotalPassive: 'Revenu passif total',

    // TaxReport
    labelTaxDate: 'Date de référence pour la déclaration d\'impôts :',
    labelGrossWealth: 'Patrimoine brut',
    labelDebts: 'Dettes',
    labelTaxableWealth: 'Patrimoine net imposable',
    labelPosition: 'Position',
    labelTaxValueAt: 'Valeur fiscale au',

    // LiquidityReport
    repLiqTitle: 'Risque de liquidité',
    repLiqSub: 'Vue du patrimoine immobilisé vs disponible',
    labelLiquid: 'Actifs liquides',
    labelIlliquid: 'Actifs immobilisés',
    labelAvailable: 'Disponible (Liquide)',
    labelTiedUp: 'Immobilisé (Illiquide)',
    labelTargetDate: 'Date de référence :',
    labelRatio: 'Ratio de liquidité',

    // HistoryReport
    repHistTitle: 'Historique',
    repHistSub: 'Calcul réel basé sur les soldes et les signatures',
    labelStartWealth: 'Patrimoine de départ',
    labelEndWealth: 'Patrimoine de fin',
    labelAbsoluteChange: 'Évolution',
    labelTotalWealth: 'Patrimoine total',

    // ScenariosReport
    repScenFireTitle: 'Scénarios & FIRE',
    repScenFireSub: 'Suivi des objectifs et impact des événements futurs.',
    labelFireGoal: 'Objectif d\'épargne FIRE',
    labelTargetYear: 'Année cible :',
    labelAchieved: 'atteint',
    labelFutureScenarios: 'Scénarios futurs',
    labelBtnNew: '+ Nouveau',
    labelImpactAnalysis: 'Projection (Après Scénarios)',
    labelProjectedWealth: 'Patrimoine projeté',

    // WaterfallReport
    repWaterfallTitle: 'Flux en cascade',
    repWaterfallSub: 'Moteurs de la variation du patrimoine',
    labelWaterfallStart: 'Valeur initiale',
    labelWaterfallInflows: 'Entrées',
    labelWaterfallOutflows: 'Sorties',
    labelWaterfallMarket: 'Marché / Ajustements',
    labelWaterfallEnd: 'Valeur finale',
    labelNetCashflow: 'Flux de trésorerie net',
    labelMarketEffect: 'Effet du marché',

    // FutureReport
    repSimRegTitle: 'Simulation future (Régression)',
    repSimRegSub: 'Basé sur les performances historiques incl. les scénarios futurs',
    msgNotEnoughHistory: 'Pas assez d\'historique pour la régression. (Min. 2 mois requis)',
    labelLinear: 'Linéaire',
    labelExponential: 'Exponentiel',
    labelToday: 'Aujourd\'hui',
    label3Months: '+3 Mois',
    label1Year: '+1 An',
    label3Years: '+3 Ans',
    label5Years: '+5 Ans',
    labelProj5Years: 'Projection (dans 5 ans)',

    // Éléments UI & Statut
    tree: 'Arborescence', propEditor: 'Éditeur de propriétés', statusReady: 'Prêt', version: 'Version', 
    dateSelect: 'Période', dateRangeTitle: 'Période :',
    btnApply: 'Appliquer', btnCancel: 'Annuler', btnSave: 'Enregistrer', btnAdd: 'Ajouter', btnDelete: 'Supprimer',
    btnSaveSettings: 'Enregistrer les paramètres',
    
    // TreeView & Structure
    addBank: 'Ajouter une banque', addCategory: 'Ajouter une catégorie', addSubCategory: 'Ajouter une sous-catégorie', addAsset: 'Ajouter un actif', deleteConfirm: 'Vraiment supprimer ?',
    hideTree: 'Masquer l\'arborescence', toggleArchived: 'Afficher/Masquer les éléments archivés',
    
    // Classes d'actifs & Propriétés
    assetClass: 'Classe d\'actifs', currency: 'Devise', exchangeRate: 'Taux de change', isLiquid: 'Actif liquide', isArchived: 'Archivé', propName: 'Nom', propInactive: 'inactif.',
    acCash: 'Compte', acFund: 'Fonds / ETF', acStock: 'Action', acCrypto: 'Crypto', acRealEstate: 'Immobilier', acMortgage: 'Hypothèque', acPensionCash: 'Compte de prévoyance 3a', acPensionFund: 'Dépôt de prévoyance 3a',
    propTrackRateTitle: 'Taux de suivi général', propCurrentRate: 'Taux actuel', propSecurityStatus: 'Statut du titre', propCurrentShares: 'Parts actuelles', propCurrentPrice: 'Prix actuel',
    
    // EditorArea (Tableau de bord & Écritures)
    welcomeTitle: 'Bienvenue dans FinSPA', welcomePrompt: 'Veuillez sélectionner un élément dans l\'arborescence à gauche ou ouvrir un rapport.',
    viewTitle: 'Vue :', selectAssetPrompt: 'Sélectionnez un actif à gauche pour voir les transactions détaillées.',
    mainPortfolio: 'Portefeuille principal', consWealthOverview: 'Aperçu consolidé du patrimoine (Ajusté aux devises)', totalValue: 'Valeur totale',
    allocByCat: 'Répartition par catégorie', noValuedAssets: 'Aucun actif valorisé disponible.', subcatTotals: 'Totaux des sous-catégories',
    assetClassLabel: 'Classe :', valueToday: 'Valeur (Aujourd\'hui) :',
    addBookingBtn: 'Ajouter une transaction', addBalanceBtn: 'Définir le solde',
    
    // Écritures & Tableaux
    bookings: 'Écritures', date: 'Date', type: 'Type', category: 'Catégorie', amount: 'Montant', entryType: 'Entrée', entryDetail: 'Détail',
    systemManual: 'Système/Manuel', pcsAt: 'pces à', rateLabel: 'Taux :', balanceLabel: 'SOLDE',
    income: 'Dépôt', expense: 'Retrait',
    typeDeposit: 'Dépôt', typeWithdrawal: 'Retrait', typeBuy: 'Achat', typeSell: 'Vente', typeAmortization: 'Amortissement', typeReval: 'Ajustement de valeur', typeInterest: 'Paiement des intérêts', typeDiv: 'Dividende', typeDebtInc: 'Augmentation de dette', typeFee: 'Frais',
    
    // Budget & Property Editor
    budgetDetails: 'Détails du budget', budgetName: 'Désignation', budgetAmount: 'Montant', budgetFreq: 'Fréquence', freqMonthly: 'Mensuel', freqYearly: 'Annuel',
    budgetRuleCat: 'Catégorie 50/30/20', ruleNeeds: 'Besoins (Coûts fixes, ex. logement, impôts)', ruleWants: 'Envies (Style de vie, ex. abonnements, loisirs)', ruleSavings: 'Épargne (ex. 3a, plan ETF)',
    budgetNotice: 'Délai de résiliation (Optionnel)',
    incomeSources: 'Sources de revenus', expensePositions: 'Postes de dépenses', subscriptions: 'Abonnements & Contrats', addBudgetItem: 'Ajouter un nouvel élément',

    // Budget Dashboard & Editor
    budgetBenchmark: 'Comparaison des repères',
    budgetDistribution: 'Distribution (Normalisée)',
    budgetShortNeeds: 'Besoins (Coûts Fixes)',
    budgetShortWants: 'Envies (Style de Vie)',
    budgetShortSavings: 'Épargne (Épargner/Investir)',
    budgetEditorSub: 'Vue détaillée du poste budgétaire. Modification via l\'éditeur de propriétés (à droite).',
    budgetTipText: 'Attribuez les d' + 'épenses aux catégories Besoins, Envies ou Épargne dans l\'éditeur de propriétés. Le montant restant est votre marge libre.',
    budgetShortMonth: 'Mois',
    budgetNoticeShort: 'Délai de résiliation',

    // Settings Modal
    tabCategories: 'Catégories de réservation',
    tabGeneral: 'Général',
    settingsCatDesc: 'Définissez ici les sous-catégories pour les différents types de transactions. Celles-ci seront disponibles sous forme de liste déroulante lors de l\'enregistrement des transactions.',
    labelTransTypeSetting: 'Type de transaction',
    labelSubCategories: 'Sous-catégories associées',
    labelNewCategory: 'Créer une nouvelle catégorie',
    placeholderCatName: 'Nom de la catégorie...',
    labelBaseCurrency: 'Devise de base de l\'application',

    // Transaction Type Key Mapping
    Einzahlung: 'Dépôt',
    Auszahlung: 'Retrait',
    Kauf: 'Achat',
    Verkauf: 'Vente',
    Abzahlung: 'Amortissement',
    Wertanpassung: 'Ajustement de valeur',
    Zinszahlung: 'Paiement des intérêts',
    Dividende: 'Dividende',
    Schulderhöhung: 'Augmentation de dette',
    Gebühr: 'Frais',

    // Standard Subcategories
    Lohn: 'Salaire',
    Dividenden: 'Dividendes',
    Zinsen: 'Intérêts',
    Mieteinnahmen: 'Revenus locatifs',
    Sonstiges: 'Divers',
    Steuern: 'Impôts',
    Gebühren: 'Frais',
    Lebensmittel: 'Alimentation',
    Telekommunikation: 'Télécommunications',
    Versicherungen: 'Assurances',
    Verkehr: 'Transports',
    Investition: 'Investissement',
    Reinvestition: 'Réinvestissement',
    Liquidation: 'Liquidation',
    Teilverkauf: 'Vente partielle',
    Ausschüttung: 'Distribution',
    Marktbewertung: 'Évaluation du marché',
    Abschreibung: 'Amortissement',
    Amortisation: 'Amortissement',
    Sondertilgung: 'Remboursement exceptionnel',
    Hypothekarzins: 'Intérêt hypothécaire',
    Sollzins: 'Intérêt débiteur',
    Aufstockung: 'Augmentation',
    Depotgebühr: 'Frais de garde',
    Transaktionsgebühr: 'Frais de transaction',

    // Formulare, Dialoge & Modal-Fenster
    modalEdit: 'Éditer', modalNew: 'Nouveau', selectOption: '-- Sélectionner --', btnClose: 'Fermer',
    goalTarget: 'Montant cible (FIRE)', goalYear: 'Année cible',
    scenarioName: 'Nom du scénario', scenarioDate: 'Date (Survenue)', scenarioImpact: 'Impact (positif ou négatif)',
    labelTransType: 'Type de transaction', labelSubCategory: 'Sous-catégorie', transDetails: 'Détails de la transaction',
    labelShares: 'Nombre d\'actions', labelPricePerShare: 'Prix par action', labelFees: 'Frais', labelTaxes: 'Impôts',
    labelExchangeRateTrans: 'Taux de change (à la transaction)', labelTotalAmount: 'Montant total (Montant en',
    balanceNotice: 'Définit le solde absolu de l\'ensemble de l\'actif à une date précise.', labelBalanceDate: 'Date de référence',
    labelAbsoluteBalance: 'Solde absolu', labelExchangeRateDate: 'Taux de change (à la date de référence - Optionnel)',
    
    // Löschen & About Dialog
    deleteNodeTitle: 'Supprimer l\'élément', deleteNodeConfirmPrefix: 'Voulez-vous vraiment supprimer', deleteNodeConfirmSuffix: '?',
    deleteNodeArchiveTip: 'Astuce : L\'archivage conserve l\'élément intact mais le masque.',
    btnArchiveOnly: 'Ancre uniquement', btnDeletePermanent: 'Supprimer définitivement',
    aboutDesc: 'Votre outil moderne pour la planification financière globale, la budgétisation et l\'analyse de portefeuille.',
    aboutDev: 'Développé par Thomas Kerle', aboutRights: 'Tous droits réservés.',

    // Benachrichtigungen (Toasts) & Alerts
    msgNewProjectWarning: 'Attention : Toutes les modifications non enregistrées seront perdues. Commencer un nouveau projet vide ?',
    msgNewProjectSuccess: 'Nouveau projet démarré', msgOpenSuccess: 'Projet ouvert avec succès !',
    msgSaveSuccess: 'Projet enregistré', msgInvalidVersion: 'Version invalide.',
    msgInvalidJson: 'Erreur d\'ouverture : JSON invalide.', msgCsvSuccess: 'Exportation CSV réussie',
    msgCsvError: 'Erreur lors de l\'exportation CSV', msgCsvNotSupported: 'L\'importation CSV sera prise en charge dans la prochaine version.',
    msgImportModuleError: 'Module d\'importation mal chargé (Conflit de type).',
    msgFileEmpty: 'Le fichier sélectionné ne contient aucune donnée.', msgParqetSuccess: 'Exportation CSV parqet importée avec succès !',
    msgNoValidAssets: 'Aucune donnée d\'actif valide trouvée dans le fichier.', msgProcessErrorPrefix: 'Erreur lors du traitement : ',
    msgFileReadError: 'Le fichier n\'a pas pu être lu depuis le disque.',
    msgSaved: 'Enregistré !', msgDeleted: 'Supprimé !', msgArchived: 'Élément archivé',
    msgDeletedPermanent: 'Supprimer définitivement', msgRatesSynced: 'Taux de change synchronisés', msgSettingsSaved: 'Paramètres enregistrés !'
  },

  it: {
    // Menu & Navigazione Generale
    menuFile: 'File', menuWealth: 'Patrimonio', menuBudget: 'Budget', menuViews: 'Viste', menuReports: 'Report', menuData: 'Vista Dati',
    fileNew: 'Nuovo (Progetto vuoto)', fileOpen: 'Apri (JSON)', fileSave: 'Salva (JSON)', fileImport: 'Importa (CSV)', 
    fileImportParqet: 'Importazione parqet (.csv)', fileExport: 'Esporta (CSV)', filePrint: 'Stampa', filePrintPdf: 'Esporta come PDF', fileSettings: 'Impostazioni',
    menuHelp: 'Aiuto', helpManual: 'Manuale utente', helpAbout: 'Informazioni su FinSPA',
    themeToggle: 'Cambia tema',
    
    // Viste
    viewWealth: 'Gestione patrimoniale', viewBudget: 'Gestione budget', viewData: 'Dati interni (JSON)',
    
    // Report Generale
    repStock: 'Report di inventario', repFlow: 'Report di movimento', repFuture: 'Report futuri', repBudget: 'Report di budget',
    repOverview: 'Banche e Categorie', repAlloc: 'Allocazione per banca', repLiq: 'Rischio di liquidità', repHist: 'Andamento storico', repTax: 'Report fiscale (31.12)',
    repCatFlow: 'Flusso categorie', repWaterfall: 'Flusso a cascata', repPassive: 'Reddito passivo', repTopFlow: 'Top Flow Assets', repBookAna: 'Analisi registrazioni',
    repSimReg: 'Simulazione e Regressione', repScenFire: 'Scenari e FIRE', reportLoading: 'Caricamento report...',
    reportDate: 'Data di riferimento:',
    wordTo: 'a',
    wordAnd: 'e',

    // AssetOverviewReport
    repOverviewTitle: 'Panoramica del patrimonio',
    repOverviewSub: 'Categorie e distribuzione bancaria alla data del:',
    totalWealth: 'Patrimonio totale',
    noActiveAssets: 'Nessun asset attivo trovato per questa data.',
    ofPortfolio: 'del portafoglio',

    // TopFlowReport
    repTopFlowTitle: 'Top Flow Assets',
    repTopFlowSub: 'Profitti e perdite per asset nel periodo selezionato. (Gli asset senza movimenti sono nascosti).',
    noFlowsFound: 'Nessuna variazione di valore nel periodo selezionato.',
    labelAsset: 'Asset',
    labelLoss: 'Perdita',
    labelProfit: 'Profitto',

    // BookingAnalysisReport
    repBookAnaTitle: 'Analisi registrazioni',
    repBookAnaSub: 'Flussi negativi (spese, costi, interessi) per categoria di dettaglio',
    labelTotalExpenses: 'Spese totali',
    labelBookingCount: 'Numero di transazioni',

    // CategoryFlowReport
    catUncategorized: 'Non categorizzato',
    repCatFlowSub: 'Aumento/diminuzione di valore aggregato per categorie di asset',

    // PassiveIncomeReport
    repPassiveSub: 'Tutti i dividendi, interessi e affitti tra',
    labelTotalPassive: 'Reddito passivo totale',

    // TaxReport
    labelTaxDate: 'Data di riferimento per la dichiarazione dei redditi:',
    labelGrossWealth: 'Patrimonio lordo',
    labelDebts: 'Debiti',
    labelTaxableWealth: 'Patrimonio netto imponibile',
    labelPosition: 'Posizione',
    labelTaxValueAt: 'Valore fiscale al',

    // LiquidityReport
    repLiqTitle: 'Rischio di liquidità',
    repLiqSub: 'Vista del patrimonio vincolato vs disponibile',
    labelLiquid: 'Attività liquide',
    labelIlliquid: 'Patrimonio vincolato',
    labelAvailable: 'Disponibile (Liquido)',
    labelTiedUp: 'Vincolato (Illiquido)',
    labelTargetDate: 'Data di riferimento:',
    labelRatio: 'Rapporto di liquidità',

    // HistoryReport
    repHistTitle: 'Andamento storico',
    repHistSub: 'Calcolo reale basato su saldi e transazioni',
    labelStartWealth: 'Patrimonio iniziale',
    labelEndWealth: 'Patrimonio finale',
    labelAbsoluteChange: 'Variazione',
    labelTotalWealth: 'Patrimonio totale',

    // ScenariosReport
    repScenFireTitle: 'Scenari e FIRE',
    repScenFireSub: 'Tracciamento degli obiettivi e impatto degli eventi futuri.',
    labelFireGoal: 'Obiettivo di risparmio FIRE',
    labelTargetYear: 'Anno target:',
    labelAchieved: 'raggiunto',
    labelFutureScenarios: 'Scenari futuri',
    labelBtnNew: '+ Nuovo',
    labelImpactAnalysis: 'Proiezione (Dopo gli Scenari)',
    labelProjectedWealth: 'Patrimonio proiezione',

    // WaterfallReport
    repWaterfallTitle: 'Flusso a cascata',
    repWaterfallSub: 'Driver della variazione patrimoniale',
    labelWaterfallStart: 'Valore iniziale',
    labelWaterfallInflows: 'Entrate',
    labelWaterfallOutflows: 'Uscite',
    labelWaterfallMarket: 'Mercato / Adeguamenti',
    labelWaterfallEnd: 'Valore finale',
    labelNetCashflow: 'Flusso di cassa netto',
    labelMarketEffect: 'Effetto di mercato',

    // FutureReport
    repSimRegTitle: 'Simulazione futura (Regressione)',
    repSimRegSub: 'Basato sulle prestazioni storiche incl. scenari futuri definiti',
    msgNotEnoughHistory: 'Storico insufficiente per la regressione. (Min. 2 mesi richiesti)',
    labelLinear: 'Lineare',
    labelExponential: 'Esponenziale',
    labelToday: 'Oggi',
    label3Months: '+3 Mesi',
    label1Year: '+1 Anno',
    label3Years: '+3 Anni',
    label5Years: '+5 Anni',
    labelProj5Years: 'Proiezione (in 5 anni)',

    // Elementi UI & Stato
    tree: 'Albero di struttura', propEditor: 'Editor delle proprietà', statusReady: 'Pronto', version: 'Versione', 
    dateSelect: 'Periodo', dateRangeTitle: 'Periodo:',
    btnApply: 'Applica', btnCancel: 'Annulla', btnSave: 'Salva', btnAdd: 'Aggiungi', btnDelete: 'Elimina',
    btnSaveSettings: 'Salva impostazioni',
    
    // TreeView & Struttura
    addBank: 'Aggiungi banca', addCategory: 'Aggiungi categoria', addSubCategory: 'Aggiungi sottocategoria', addAsset: 'Aggiungi asset', deleteConfirm: 'Eliminare davvero?',
    hideTree: 'Nascondi albero di struttura', toggleArchived: 'Mostra/Nascondi elementi archiviati',
    
    // Classi di Asset & Proprietà
    assetClass: 'Classe di asset', currency: 'Valuta', exchangeRate: 'Tasso di cambio', isLiquid: 'Asset liquido', isArchived: 'Archiviato', propName: 'Nome', propInactive: 'inattivo.',
    acCash: 'Conto', acFund: 'Fondo / ETF', acStock: 'Azione', acCrypto: 'Cripto', acRealEstate: 'Immobile', acMortgage: 'Ipoteca', acPensionCash: 'Conto previdenza 3a', acPensionFund: 'Deposito previdenza 3a',
    propTrackRateTitle: 'Tasso di tracciamento generale', propCurrentRate: 'Tasso attuale', propSecurityStatus: 'Stato del titolo', propCurrentShares: 'Quote attuali', propCurrentPrice: 'Prezzo attuale',
    
    // EditorArea (Dashboard & Registrazioni)
    welcomeTitle: 'Benvenuto in FinSPA', welcomePrompt: 'Si prega di selezionare un elemento dall\'albero a sinistra o aprire un report.',
    viewTitle: 'Vista:', selectAssetPrompt: 'Seleziona un asset a sinistra per vedere le transazioni dettagliate.',
    mainPortfolio: 'Portafoglio principale', consWealthOverview: 'Panoramica consolidata del patrimonio (Adeguata alla valuta)', totalValue: 'Valore totale',
    allocByCat: 'Ripartizione per categoria', noValuedAssets: 'Nessun asset valutato disponibile.', subcatTotals: 'Totali sottocategorie',
    assetClassLabel: 'Classe:', valueToday: 'Valore (Oggi):',
    addBookingBtn: 'Aggiungi transazione', addBalanceBtn: 'Imposta saldo',
    
    // Registrazioni & Tabelle
    bookings: 'Registrazioni', date: 'Date', type: 'Typo', category: 'Categoria', amount: 'Importo', entryType: 'Voce', entryDetail: 'Dettaglio',
    systemManual: 'Sistema/Manuale', pcesAt: 'pz. a', rateLabel: 'Tasso:', balanceLabel: 'SALDO',
    income: 'Versamento', expense: 'Prelievo',
    typeDeposit: 'Versamento', typeWithdrawal: 'Prelievo', typeBuy: 'Acquisto', typeSell: 'Vendita', typeAmortization: 'Ammortamento', typeReval: 'Adeguamento del valore', typeInterest: 'Pagamento interessi', typeDiv: 'Dividendo', typeDebtInc: 'Aumento del debito', typeFee: 'Commissione',
    
    // Budget & Property Editor
    budgetDetails: 'Dettagli Budget', budgetName: 'Denominazione', budgetAmount: 'Importo', budgetFreq: 'Frequenza', freqMonthly: 'Mensile', freqYearly: 'Annuale',
    budgetRuleCat: 'Categoria 50/30/20', ruleNeeds: 'Necessità (Costi fissi, es. alloggio, tasse)', ruleWants: 'Desideri (Stile di vita, es. abbonamenti, tempo libero)', ruleSavings: 'Risparmi (es. 3a, piano ETF)',
    budgetNotice: 'Periodo di preavviso (Opzionale)',
    incomeSources: 'Fonti di reddito', expensePositions: 'Voci di spesa', subscriptions: 'Abbonamenti e Contratti', addBudgetItem: 'Aggiungi nuovo elemento',

    // Budget Dashboard & Editor
    budgetBenchmark: 'Confronto dei parametri',
    budgetDistribution: 'Distribuzione (Normalizzata)',
    budgetShortNeeds: 'Necessità (Costi Fissi)',
    budgetShortWants: 'Desideri (Stile di Vita)',
    budgetShortSavings: 'Risparmi (Risparmio/Investimento)',
    budgetEditorSub: 'Vista dettagliata della voce di budget. Modifica tramite l\'editor delle proprietà (a destra).',
    budgetTipText: 'Assegna le spese alle categorie Necessità, Desideri o Risparmi nell\'editor delle proprietà. L\'importo rimanente è il tuo margine libero.',
    budgetShortMonth: 'Mes.',
    budgetNoticeShort: 'Periodo di preavviso',

    // Settings Modal
    tabCategories: 'Categorie di registrazione',
    tabGeneral: 'Generale',
    settingsCatDesc: 'Definisci qui le sottocategorie per i vari tipi di transazione. Queste saranno disponibili come menu a discesa durante la registrazione delle transazioni.',
    labelTransTypeSetting: 'Tipo di transazione',
    labelSubCategories: 'Sottocategorie associate',
    labelNewCategory: 'Crea nuova categoria',
    placeholderCatName: 'Nome della categoria...',
    labelBaseCurrency: 'Valuta di base dell\'applicazione',

    // Transaction Type Key Mapping
    Einzahlung: 'Versamento',
    Auszahlung: 'Prelievo',
    Kauf: 'Acquisto',
    Verkauf: 'Vendita',
    Abzahlung: 'Ammortamento',
    Wertanpassung: 'Adeguamento del valore',
    Zinszahlung: 'Pagamento interessi',
    Dividende: 'Dividendo',
    Schulderhöhung: 'Aumento del debito',
    Gebühr: 'Commissione',

    // Standard Subcategories
    Lohn: 'Salario',
    Dividenden: 'Dividendi',
    Zinsen: 'Interessi',
    Mieteinnahmen: 'Redditi da locazione',
    Sonstiges: 'Altro',
    Steuern: 'Tasse',
    Gebühren: 'Commissioni',
    Lebensmittel: 'Alimentari',
    Telekommunikation: 'Telecomunicazioni',
    Versicherungen: 'Assicurazioni',
    Verkehr: 'Trasporti',
    Investition: 'Investimento',
    Reinvestition: 'Reinvestimento',
    Liquidation: 'Liquidazione',
    Teilverkauf: 'Vendita parziale',
    Ausschüttung: 'Distribuzione',
    Marktbewertung: 'Valutazione di mercato',
    Abschreibung: 'Ammortamento',
    Amortisation: 'Ammortamento',
    Sondertilgung: 'Rimborso straordinario',
    Hypothekarzins: 'Interessi ipotecari',
    Sollzins: 'Interessi debitori',
    Aufstockung: 'Aumento',
    Depotgebühr: 'Commissioni di custodia',
    Transaktionsgebühr: 'Commissioni di transazione',

    // Formulare, Dialoge & Modal-Fenster
    modalEdit: 'Modifica', modalNew: 'Nuovo', selectOption: '-- Seleziona --', btnClose: 'Chiudi',
    goalTarget: 'Importo target (FIRE)', goalYear: 'Anno target',
    scenarioName: 'Nome scenario', scenarioDate: 'Data (Evento)', scenarioImpact: 'Impatto (positivo o negativo)',
    labelTransType: 'Tipo di transazione', labelSubCategory: 'Sottocategoria', transDetails: 'Dettagli transazione',
    labelShares: 'Quantità', labelPricePerShare: 'Prezzo per quota', labelFees: 'Commissioni', labelTaxes: 'Imposte',
    labelExchangeRateTrans: 'Tasso di cambio (alla transazione)', labelTotalAmount: 'Importo totale (Totale in',
    balanceNotice: 'Imposta il saldo assoluto dell\'intero asset in una data specifica.', labelBalanceDate: 'Data di riferimento',
    labelAbsoluteBalance: 'Saldo assoluto', labelExchangeRateDate: 'Tasso di cambio (alla data di riferimento - Opzionale)',
    
    // Löschen & About Dialog
    deleteNodeTitle: 'Rimuovi elemento', deleteNodeConfirmPrefix: 'Vuoi davvero eliminare', deleteNodeConfirmSuffix: '?',
    deleteNodeArchiveTip: 'Suggerimento: Archiviando, l\'elemento viene conservato ma nascosto.',
    btnArchiveOnly: 'Solo archiviazione', btnDeletePermanent: 'Elimina definitivamente',
    aboutDesc: 'Il tuo strumento moderno per la pianificazione finanziaria olistica, il budgeting e l\'analisi del portafoglio.',
    aboutDev: 'Sviluppato da Thomas Kerle', aboutRights: 'Tutti i diritti riservati.',

    // Benachrichtigungen (Toasts) & Alerts
    msgNewProjectWarning: 'Attenzione: Tutte le modifiche non salvate andranno perse. Iniziare un nuovo progetto vuoto?',
    msgNewProjectSuccess: 'Nuovo progetto iniziato', msgOpenSuccess: 'Progetto aperto con successo!',
    msgSaveSuccess: 'Progetto salvato', msgInvalidVersion: 'Versione non valida.',
    msgInvalidJson: 'Errore di apertura: JSON non valido.', msgCsvSuccess: 'Esportazione CSV completata',
    msgCsvError: 'Errore durante l\'esportazione CSV', msgCsvNotSupported: 'L\'importazione CSV sarà supportata nella prossima versione.',
    msgImportModuleError: 'Modulo di importazione non caricato correttamente (Conflitto di tipo).',
    msgFileEmpty: 'Le file selezionato non contiene dati.', msgParqetSuccess: 'Esportazione CSV parqet importata con successo!',
    msgNoValidAssets: 'Nessun dato di asset valido trovato nel file.', msgProcessErrorPrefix: 'Errore durante l\'elaborazione: ',
    msgFileReadError: 'Impossibile leggere il file dal disco.',
    msgSaved: 'Salvato!', msgDeleted: 'Eliminato!', msgArchived: 'Elemento archiviato',
    msgDeletedPermanent: 'Eliminato definitivamente', msgRatesSynced: 'Tassi di cambio sincronizzati', msgSettingsSaved: 'Impostazioni salvate!'
  }
};

module.exports = i18n;