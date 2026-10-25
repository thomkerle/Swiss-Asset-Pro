/**
 * @file FinSpaApiInject.js
 * @description Vollständige, sprachunabhängige FinSPA_API mit nativer 4-Sprachen-Engine (DE/EN/FR/IT),
 * kanonischer Buchungs- und Frequenz-Normalisierung, nahtloser Darkmode-Synchronisation,
 * integrierter Privacy-ID-Bridge, 1:1 DataEngine-Logik und PDF-Bridge.
 */

const getFinSpaApiScript = (activeLang = 'de') => `
<style id="finspa-theme-styles">
  :root {
    --finspa-bg: #ffffff;
    --finspa-card-bg: #f8fafc;
    --finspa-text: #0f172a;
    --finspa-text-muted: #64748b;
    --finspa-border: #e2e8f0;
  }
  html.dark {
    --finspa-bg: #020617;
    --finspa-card-bg: #0f172a;
    --finspa-text: #f1f5f9;
    --finspa-text-muted: #94a3b8;
    --finspa-border: #1e293b;
    color-scheme: dark;
  }
  html, body {
    background-color: var(--finspa-bg) !important;
    color: var(--finspa-text) !important;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  html.dark body.bg-white,
  html.dark .bg-white:not(.keep-light) {
    background-color: #0f172a !important;
    color: #f1f5f9 !important;
  }
  html.dark .bg-gray-50,
  html.dark .bg-slate-50,
  html.dark .bg-gray-100 {
    background-color: #1e293b !important;
    color: #e2e8f0 !important;
  }
  html.dark .text-slate-900,
  html.dark .text-slate-800,
  html.dark .text-gray-900,
  html.dark .text-gray-800 {
    color: #f8fafc !important;
  }
  html.dark .text-slate-700,
  html.dark .text-gray-700,
  html.dark .text-slate-600,
  html.dark .text-gray-600 {
    color: #cbd5e1 !important;
  }
  html.dark .text-gray-500,
  html.dark .text-slate-500,
  html.dark .text-gray-400 {
    color: #94a3b8 !important;
  }
  html.dark .border-gray-100,
  html.dark .border-gray-200,
  html.dark .border-gray-300,
  html.dark .border-slate-200,
  html.dark .border {
    border-color: #334155 !important;
  }
  html.dark .divide-gray-100 > :not([hidden]) ~ :not([hidden]),
  html.dark .divide-gray-200 > :not([hidden]) ~ :not([hidden]) {
    border-color: #1e293b !important;
  }
  html.dark input:not([type="range"]),
  html.dark select,
  html.dark textarea {
    background-color: #0f172a !important;
    color: #f8fafc !important;
    border-color: #475569 !important;
  }
  html.dark tr.hover\\:bg-gray-50:hover,
  html.dark tr:hover {
    background-color: rgba(30, 41, 59, 0.65) !important;
  }
  html.dark canvas {
    background-color: transparent !important;
  }
</style>
<script>
window.__finspaLang = "${activeLang}";

window.FinSPA_API = {
    _themeListeners: [],

    // --- 4-Sprachen-Wörterbuch für sämtliche API-Ausgaben & Fallbacks ---
    _i18n: {
        de: {
            unknown: 'Unbekannt',
            mainPortfolio: 'Hauptportfolio',
            directPortfolio: 'Direkt / Hauptportfolio',
            other: 'Sonstige',
            uncategorized: 'Unkategorisiert',
            dividends: 'Dividenden',
            interest: 'Zinsen',
            rentalIncome: 'Mieteinnahmen',
            simulatedAsset: 'Simuliertes Asset',
            simulationBank: 'Simulation (Hypothetisch)',
            simulatedExpenses: 'Simulierte Ausgaben',
            simulatedIncome: 'Simulierte Einnahmen',
            scenario: 'Szenario',
            incomeItem: 'Einnahme',
            expenseItem: 'Ausgabe',
            subItem: 'Abo',
            intervalMonthly: 'Monatlich',
            intervalQuarterly: 'Quartalsweise',
            intervalSemiAnnual: 'Halbjährlich',
            intervalAnnual: 'Jährlich',
            simParams: 'Simulationsparameter',
            generalParams: 'Allgemeine Parameter',
            wealthDev: 'Vermögensentwicklung',
            portfolioReport: 'Portfolio Report',
            generatedOn: 'Generiert per ',
            ac_cash: 'Konto',
            ac_credit_card: 'Kreditkarte',
            ac_fund: 'Fonds / ETF',
            ac_stock: 'Aktie',
            ac_crypto: 'Krypto',
            ac_realestate: 'Immobilie',
            ac_mortgage: 'Hypothek',
            ac_pension_cash: 'Pensionskasse (2. Säule)',
            ac_pension_fund: 'Pensionskasse Fonds (2. Säule)',
            ac_pension_3a_cash: '3a Vorsorgekonto',
            ac_pension_3a_fund: '3a Vorsorgefonds',
            ac_managed_fund: 'Verwaltetes Vermögen',
            ac_pension_3a_managed: '3a Fonds (Gesamtwert)'
        },
        en: {
            unknown: 'Unknown',
            mainPortfolio: 'Main Portfolio',
            directPortfolio: 'Direct / Main Portfolio',
            other: 'Other',
            uncategorized: 'Uncategorized',
            dividends: 'Dividends',
            interest: 'Interest',
            rentalIncome: 'Rental Income',
            simulatedAsset: 'Simulated Asset',
            simulationBank: 'Simulation (Hypothetical)',
            simulatedExpenses: 'Simulated Expenses',
            simulatedIncome: 'Simulated Income',
            scenario: 'Scenario',
            incomeItem: 'Income',
            expenseItem: 'Expense',
            subItem: 'Subscription',
            intervalMonthly: 'Monthly',
            intervalQuarterly: 'Quarterly',
            intervalSemiAnnual: 'Semi-Annual',
            intervalAnnual: 'Annual',
            simParams: 'Simulation Parameters',
            generalParams: 'General Parameters',
            wealthDev: 'Wealth Development',
            portfolioReport: 'Portfolio Report',
            generatedOn: 'Generated on ',
            ac_cash: 'Account / Cash',
            ac_credit_card: 'Credit Card',
            ac_fund: 'Fund / ETF',
            ac_stock: 'Stock',
            ac_crypto: 'Crypto',
            ac_realestate: 'Real Estate',
            ac_mortgage: 'Mortgage',
            ac_pension_cash: 'Pension Fund (2nd Pillar)',
            ac_pension_fund: 'Pension Fund Securities (2nd Pillar)',
            ac_pension_3a_cash: 'Pillar 3a Account',
            ac_pension_3a_fund: 'Pillar 3a Fund',
            ac_managed_fund: 'Managed Portfolio',
            ac_pension_3a_managed: 'Pillar 3a Managed Fund'
        },
        fr: {
            unknown: 'Inconnu',
            mainPortfolio: 'Portefeuille principal',
            directPortfolio: 'Direct / Portefeuille principal',
            other: 'Autres',
            uncategorized: 'Non catégorisé',
            dividends: 'Dividendes',
            interest: 'Intérêts',
            rentalIncome: 'Revenus locatifs',
            simulatedAsset: 'Actif simulé',
            simulationBank: 'Simulation (Hypothétique)',
            simulatedExpenses: 'Dépenses simulées',
            simulatedIncome: 'Revenus simulés',
            scenario: 'Scénario',
            incomeItem: 'Revenu',
            expenseItem: 'Dépense',
            subItem: 'Abonnement',
            intervalMonthly: 'Mensuel',
            intervalQuarterly: 'Trimestriel',
            intervalSemiAnnual: 'Semestriel',
            intervalAnnual: 'Annuel',
            simParams: 'Paramètres de simulation',
            generalParams: 'Paramètres généraux',
            wealthDev: 'Évolution de la fortune',
            portfolioReport: 'Rapport de portefeuille',
            generatedOn: 'Généré le ',
            ac_cash: 'Compte / Liquidités',
            ac_credit_card: 'Carte de crédit',
            ac_fund: 'Fonds / ETF',
            ac_stock: 'Action',
            ac_crypto: 'Crypto',
            ac_realestate: 'Immobilier',
            ac_mortgage: 'Hypothèque',
            ac_pension_cash: 'Caisse de pension (2e pilier)',
            ac_pension_fund: 'Fonds de pension (2e pilier)',
            ac_pension_3a_cash: 'Compte prévoyance 3a',
            ac_pension_3a_fund: 'Fonds de prévoyance 3a',
            ac_managed_fund: 'Fortune gérée',
            ac_pension_3a_managed: 'Fonds 3a (Valeur globale)'
        },
        it: {
            unknown: 'Sconosciuto',
            mainPortfolio: 'Portafoglio principale',
            directPortfolio: 'Diretto / Portafoglio principale',
            other: 'Altro',
            uncategorized: 'Non categorizzato',
            dividends: 'Dividendi',
            interest: 'Interessi',
            rentalIncome: 'Redditi da locazione',
            simulatedAsset: 'Asset simulato',
            simulationBank: 'Simulazione (Ipotetica)',
            simulatedExpenses: 'Spese simulate',
            simulatedIncome: 'Entrate simulate',
            scenario: 'Scenario',
            incomeItem: 'Entrata',
            expenseItem: 'Spesa',
            subItem: 'Abbonamento',
            intervalMonthly: 'Mensile',
            intervalQuarterly: 'Trimestrale',
            intervalSemiAnnual: 'Semestrale',
            intervalAnnual: 'Annuale',
            simParams: 'Parametri di simulazione',
            generalParams: 'Parametri generali',
            wealthDev: 'Sviluppo del patrimonio',
            portfolioReport: 'Rapporto di portafoglio',
            generatedOn: 'Generato il ',
            ac_cash: 'Conto / Liquidità',
            ac_credit_card: 'Carta di credito',
            ac_fund: 'Fondo / ETF',
            ac_stock: 'Azione',
            ac_crypto: 'Cripto',
            ac_realestate: 'Immobili',
            ac_mortgage: 'Ipoteca',
            ac_pension_cash: 'Cassa pensioni (2° pilastro)',
            ac_pension_fund: 'Fondo pensione (2° pilastro)',
            ac_pension_3a_cash: 'Conto previdenza 3a',
            ac_pension_3a_fund: 'Fondo previdenza 3a',
            ac_managed_fund: 'Patrimonio gestito',
            ac_pension_3a_managed: 'Fondo 3a (Valore totale)'
        }
    },

    // --- Sprachunabhängige Konzept-Lexika (DE, EN, FR, IT) ---
    _concepts: {
        deposit: ['einzahlung', 'deposit', 'dépôt', 'depot', 'versement', 'deposito', 'versamento', 'top-up', 'gutschrift', 'credit'],
        withdrawal: ['auszahlung', 'withdrawal', 'retrait', 'paiement', 'prelievo', 'pagamento', 'belastung', 'debit', 'kartenzahlung', 'card payment', 'paiement par carte', 'pagamento con carta'],
        buy: ['kauf', 'buy', 'purchase', 'achat', 'acquisto'],
        sell: ['verkauf', 'sell', 'sale', 'vente', 'vendita'],
        dividend: ['dividende', 'dividenden', 'ausschüttung', 'ausschuettung', 'dividend', 'dividends', 'distribution', 'dividendes', 'dividendo', 'dividendi', 'distribuzione'],
        interest: ['zinszahlung', 'zinsen', 'zins', 'interest', 'intérêts', 'interets', 'intérêt', 'interet', 'interessi', 'interesse', 'sollzins', 'hypothekarzins'],
        fee: ['gebühr', 'gebühren', 'gebuehr', 'fee', 'fees', 'frais', 'commission', 'commissione', 'commissioni', 'spese', 'depotgebühr', 'transaktionsgebühr'],
        revaluation: ['wertanpassung', 'revaluation', 'marktbewertung', 'abschreibung', 'réévaluation', 'reevaluation', 'rivalutazione', 'svalutazione', 'api kurs-sync', 'kurs aus transaktion'],
        amortization: ['abzahlung', 'amortisation', 'amortization', 'sondertilgung', 'tilgung', 'remboursement', 'ammortamento', 'rimborso'],
        debt_increase: ['schulderhöhung', 'schulderhoehung', 'aufstockung', 'debt increase', 'augmentation de dette', 'aumento debito'],
        transfer: ['umbuchung', 'transfer', 'virement', 'transfert', 'bonifico', 'trasferimento', 'ausgleich', 'abrechnung', 'kreditkartenabrechnung', 'settlement', 'règlement', 'reglement', 'saldo carta', 'investition', 'reinvestition', 'reinvestment', 'réinvestissement', 'reinvestimento', 'liquidation', 'teilverkauf', 'partial sale'],
        rent: ['miete', 'mieteinnahmen', 'mietvertrag', 'rent', 'rental', 'loyer', 'loyers', 'affitto', 'locazione'],
        pillar2: ['pensionskasse', 'bvg', 'lpp', '2. säule', '2. saeule', '2nd pillar', 'pillar 2', '2e pilier', '2° pilastro', 'caisse de pension', 'cassa pensioni', 'freizügigkeit', 'libre passage', 'libero passaggio'],
        pillar3a: ['3a', 'säule 3a', 'saeule 3a', 'pillar 3a', '3rd pillar', 'pilier 3a', '3e pilier', 'pilastro 3a', '3° pilastro', 'viac', 'frankly', 'finpension', 'vorsorge 3a', 'prévoyance 3a', 'previdenza 3a'],
        pensionGeneric: ['vorsorge', 'prévoyance', 'prevoyance', 'previdenza', 'retirement', 'pension', 'rente', 'retraite', 'pensione']
    },

    _getData: function() { 
        return window.finspaData || window.parent?.finspaData || { banks: [], budget: {}, settings: {}, goals: {}, scenarios: [] }; 
    },

    // --- 4-Sprachen Lokalisierung (DE, EN, FR, IT) ---
    getLanguage: function() {
        const lang = String(window.__finspaLang || window.parent?.__finspaLang || this._getData()?.settings?.language || 'de').toLowerCase().slice(0, 2);
        return ['de', 'en', 'fr', 'it'].includes(lang) ? lang : 'de';
    },

    t: function(key, customLang) {
        const lang = customLang || this.getLanguage();
        const dict = this._i18n[lang] || this._i18n.de;
        return dict[key] !== undefined ? dict[key] : (this._i18n.de[key] || key);
    },

    getLocale: function(customLang) {
        const lang = customLang || this.getLanguage();
        const localeMap = { de: 'de-CH', en: 'en-US', fr: 'fr-CH', it: 'it-CH' };
        return localeMap[lang] || 'de-CH';
    },

    getBaseCurrency: function(customData) {
        const d = customData || this._getData();
        return d?.settings?.baseCurrency || 'CHF';
    },

    formatCurrency: function(val, cur, customLang) {
        const num = Math.round(Number(val || 0));
        const currency = cur || this.getBaseCurrency();
        const locale = this.getLocale(customLang);
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num);
        } catch (e) {
            return currency + ' ' + num.toLocaleString('de-CH');
        }
    },

    // --- Dark Mode & Theme Synchronisation ---
    isDarkMode: function() {
        try {
            if (typeof window.__finspaForceDark === 'boolean') return window.__finspaForceDark;
            if (window.parent && window.parent.document && window.parent.document.documentElement) {
                return window.parent.document.documentElement.classList.contains('dark');
            }
        } catch (e) {}
        return document.documentElement.classList.contains('dark');
    },

    getThemeColors: function() {
        const dark = this.isDarkMode();
        return {
            isDark: dark,
            background: dark ? '#0f172a' : '#ffffff',
            cardBg: dark ? '#1e293b' : '#f8fafc',
            textPrimary: dark ? '#f8fafc' : '#0f172a',
            textSecondary: dark ? '#94a3b8' : '#64748b',
            borderColor: dark ? '#334155' : '#e2e8f0',
            gridColor: dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
            tooltipBg: dark ? '#020617' : '#ffffff',
            tooltipText: dark ? '#f8fafc' : '#0f172a'
        };
    },

    onThemeChange: function(cb) {
        if (typeof cb === 'function') {
            this._themeListeners.push(cb);
        }
    },

    _applyTheme: function(isDark) {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');

        const colors = this.getThemeColors();
        if (window.Chart && window.Chart.defaults) {
            window.Chart.defaults.color = colors.textSecondary;
            window.Chart.defaults.borderColor = colors.gridColor;
        }

        if (window.echarts) {
            const divs = document.querySelectorAll('div[_echarts_instance_], [id*="chart"], [id*="Chart"]');
            divs.forEach(div => {
                try {
                    const inst = window.echarts.getInstanceByDom(div);
                    if (inst) {
                        inst.setOption({
                            textStyle: { color: colors.textSecondary },
                            legend: { textStyle: { color: colors.textSecondary } },
                            xAxis: { axisLabel: { color: colors.textSecondary }, splitLine: { lineStyle: { color: colors.gridColor } } },
                            yAxis: { axisLabel: { color: colors.textSecondary }, splitLine: { lineStyle: { color: colors.gridColor } } }
                        });
                    }
                } catch (e) {}
            });
        }

        this._themeListeners.forEach(fn => {
            try { fn(isDark, colors); } catch (e) {}
        });
        window.dispatchEvent(new CustomEvent('finspa-theme-change', { detail: { isDark, colors } }));
    },

    // --- Sprachunabhängige Privacy-ID-Bridge ---
    _extractCleanId: function(val) {
        const s = String(val || '').trim();
        const lower = s.toLowerCase();
        const markerIdx = lower.indexOf('[id:');
        if (markerIdx !== -1) {
            const endIdx = s.indexOf(']', markerIdx);
            if (endIdx !== -1) return s.slice(markerIdx + 4, endIdx).trim();
        }
        return s;
    },

    resolveNodeName: function(idOrLabel, customData) {
        const raw = String(idOrLabel || '').trim();
        if (!raw) return '';
        const lookupId = this._extractCleanId(raw);
        const d = customData || this._getData();
        let foundName = null;

        function searchTree(nodes) {
            (nodes || []).forEach(n => {
                if (n.id === lookupId || n.name === raw) foundName = n.name;
                if (n.children) searchTree(n.children);
            });
        }
        searchTree(d.banks || []);
        if (foundName) return foundName;

        const budget = d.budget || {};
        ['incomeSources', 'expenses', 'subscriptions'].forEach((grp, gIdx) => {
            const prefix = gIdx === 0 ? 'inc_' : (gIdx === 1 ? 'exp_' : 'sub_');
            (budget[grp] || []).forEach((item, idx) => {
                const itemId = item.id || (prefix + (idx + 1));
                if (itemId === lookupId) foundName = item.name;
            });
        });
        if (foundName) return foundName;

        (d.scenarios || []).forEach((sc, idx) => {
            const scId = sc.id || ('scen_' + (idx + 1));
            if (scId === lookupId) foundName = sc.name;
        });

        return foundName || raw;
    },

    _matchNodeIdOrName: function(queryVal, actualName, actualId, ancestorIds = [], ancestorNames = []) {
        if (!queryVal) return true;
        const cleanQ = this._extractCleanId(queryVal).toLowerCase();
        const actId = String(actualId || '').toLowerCase();
        const actName = String(actualName || '').toLowerCase();
        if (actId === cleanQ || actName === cleanQ || (cleanQ.length >= 2 && actName.includes(cleanQ))) {
            return true;
        }
        if (Array.isArray(ancestorIds) && ancestorIds.some(id => String(id).toLowerCase() === cleanQ)) return true;
        if (Array.isArray(ancestorNames) && ancestorNames.some(nm => String(nm).toLowerCase().includes(cleanQ))) return true;
        return false;
    },

    // --- Sprachunabhängige Konzept- und Buchungstyp-Erkennung ---
    _hasConcept: function(text, conceptKey) {
        if (!text) return false;
        const lower = String(text).toLowerCase().trim();
        const words = this._concepts[conceptKey] || [];
        return words.some(w => lower === w || lower.includes(w));
    },

    _normalizeBookingType: function(rawType, rawSubCat = '') {
        const t = String(rawType || '').toLowerCase().trim();
        if (!t) return 'unknown';

        // Exakte Treffer zuerst prüfen
        for (const key of ['revaluation', 'dividend', 'interest', 'fee', 'buy', 'sell', 'amortization', 'debt_increase', 'transfer', 'deposit', 'withdrawal']) {
            const list = this._concepts[key] || [];
            if (list.includes(t)) return key;
        }
        // Teilwort-Treffer
        for (const key of ['revaluation', 'dividend', 'interest', 'fee', 'buy', 'sell', 'amortization', 'debt_increase', 'transfer', 'deposit', 'withdrawal']) {
            if (this._hasConcept(t, key)) return key;
        }
        // Fallback über Subkategorie
        if (this._hasConcept(rawSubCat, 'dividend')) return 'dividend';
        if (this._hasConcept(rawSubCat, 'interest')) return 'interest';
        if (this._hasConcept(rawSubCat, 'fee')) return 'fee';
        return t;
    },

    // --- Helper (1:1 synchron mit DataEngine.jsx, sprachunabhängig) ---
    _isSecurity: function(assetClass) {
        return ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes((assetClass || '').toLowerCase());
    },
    _isFluctuating: function(assetClass) {
        return ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes((assetClass || '').toLowerCase());
    },
    _isPillar2Asset: function(asset) {
        const ac = String(asset?.assetClass || '').toLowerCase();
        if (['pension_cash', 'pension_fund'].includes(ac)) return true;
        if (['pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed', 'stock', 'crypto', 'realestate', 'mortgage', 'credit_card'].includes(ac)) return false;
        const label = (String(asset?.name || '') + ' ' + String(asset?.categoryName || '')).toLowerCase();
        if (this._hasConcept(label, 'pillar3a')) return false;
        return this._hasConcept(label, 'pillar2');
    },
    _isPillar3aAsset: function(asset) {
        const ac = String(asset?.assetClass || '').toLowerCase();
        if (['pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(ac)) return true;
        if (['pension_cash', 'pension_fund', 'stock', 'crypto', 'realestate', 'mortgage', 'credit_card'].includes(ac)) return false;
        const label = (String(asset?.name || '') + ' ' + String(asset?.categoryName || '')).toLowerCase();
        if (this._hasConcept(label, 'pillar2')) return false;
        return this._hasConcept(label, 'pillar3a') || this._hasConcept(label, 'pensionGeneric');
    },
    _isPensionAsset: function(asset) {
        return this._isPillar2Asset(asset) || this._isPillar3aAsset(asset);
    },
    _parseRate: function(val) {
        const parsed = parseFloat(String(val || '1').replace(',', '.'));
        return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
    },
    _formatLocalIsoDate: function(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    _getTodayStr: function() {
        return this._formatLocalIsoDate(new Date());
    },

    _getBookingFlow: function(booking) {
        let amt = Number(booking?.amount || 0);
        const normType = this._normalizeBookingType(booking?.type || booking?.originalType, booking?.subCategory);
        let isPositive = ['deposit', 'buy', 'revaluation', 'dividend', 'amortization', 'interest'].includes(normType);
        if (normType === 'revaluation' && amt < 0) {
            isPositive = false;
            amt = Math.abs(amt);
        }
        return { isPositive: isPositive, amount: amt, canonicalType: normType };
    },

    _isAssetLiquid: function(asset) {
        if (!asset) return false;
        const ac = (asset?.assetClass || '').toLowerCase();
        if (['stock', 'fund', 'managed_fund', 'crypto', 'realestate', 'mortgage', 'pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(ac)) {
            return false;
        }
        if (this._isPensionAsset(asset)) return false;
        if (asset.hasOwnProperty('isLiquid')) return Boolean(asset.isLiquid);
        return true; 
    },

    _isDividendBooking: function(bk) {
        const normType = this._normalizeBookingType(bk?.type || bk?.originalType, bk?.subCategory || bk?.category);
        return normType === 'dividend' || this._hasConcept(bk?.subCategory || bk?.category, 'dividend');
    },

    _classifyBooking: function(bk, asset) {
        const isLiquid = this._isAssetLiquid(asset);
        const rawCategory = bk.normCategory || bk.category || bk.subCategory || '';
        const commentStr = String(bk.comment || '');
        const normType = this._normalizeBookingType(bk.type || bk.originalType || bk.normType, rawCategory);
        const ac = (asset?.assetClass || '').toLowerCase();
        
        let classification = {
            canonicalType: normType,
            flowType: 'neutral',
            categoryKey: rawCategory ? 'custom' : 'uncategorized',
            category: rawCategory || this.t('uncategorized'),
            isLiquid: isLiquid
        };

        if (bk._isAutoValuation || normType === 'revaluation') {
            classification.flowType = 'ignore';
            return classification;
        }

        if (this._isDividendBooking(bk)) {
            const isSecurityAsset = this._isFluctuating(ac);
            classification.flowType = (isSecurityAsset || isLiquid) ? 'income' : 'shift';
            classification.categoryKey = 'dividends';
            classification.category = rawCategory || this.t('dividends');
            return classification;
        }

        if (normType === 'interest' || this._hasConcept(rawCategory, 'interest')) {
            const isDebtInterest = normType === 'interest' && ['mortgage', 'credit_card'].includes(ac);
            classification.flowType = isDebtInterest ? 'expense' : 'income';
            classification.categoryKey = 'interest';
            classification.category = rawCategory || this.t('interest');
            return classification;
        }

        if (this._hasConcept(rawCategory, 'rent') && normType === 'deposit') {
            classification.flowType = 'income';
            classification.categoryKey = 'rentalIncome';
            classification.category = rawCategory || this.t('rentalIncome');
            return classification;
        }

        const isInternalShift =
            normType === 'transfer' ||
            normType === 'buy' ||
            normType === 'sell' ||
            this._hasConcept(rawCategory, 'transfer') ||
            this._hasConcept(rawCategory, 'pillar3a') ||
            this._hasConcept(rawCategory, 'pillar2') ||
            this._hasConcept(commentStr, 'transfer');

        if (isInternalShift) {
            classification.flowType = 'shift';
            return classification;
        }

        if (!isLiquid) {
            classification.flowType = 'ignore';
            return classification;
        }

        if (normType === 'deposit') classification.flowType = 'income';
        else if (['withdrawal', 'amortization', 'fee'].includes(normType)) classification.flowType = 'expense';

        return classification;
    },

    // --- Metadaten: Assetklassen (lokalisiert in DE/EN/FR/IT) & Buchungskategorien ---
    getAssetClasses: function(customData) {
        const data = customData || this._getData();
        const standardIds = [
            'cash', 'credit_card', 'fund', 'stock', 'crypto', 'realestate', 'mortgage',
            'pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'
        ];
        const germanDefaults = ['Konto', 'Kreditkarte', 'Fonds / ETF', 'Aktie', 'Krypto', 'Immobilie', 'Hypothek', 'Pensionskasse (2. Säule)', '3a Vorsorgekonto', '3a Vorsorgefonds', 'Verwaltetes Vermögen', '3a Fonds (Gesamtwert)'];

        const userClasses = data?.settings?.assetClasses || [];
        const merged = userClasses.map(c => {
            const localizedName = this.t('ac_' + c.id);
            const hasLocalized = localizedName && localizedName !== ('ac_' + c.id);
            const isDefaultGermanName = germanDefaults.includes(c.name);
            return {
                ...c,
                name: (hasLocalized && (isDefaultGermanName || this.getLanguage() !== 'de')) ? localizedName : (c.name || localizedName)
            };
        });

        standardIds.forEach(id => {
            if (!merged.find(c => c.id === id)) {
                merged.push({ id: id, name: this.t('ac_' + id), description: '' });
            }
        });
        return merged;
    },

    getBookingCategories: function(customData) {
        const data = customData || this._getData();
        const defaults = {
            'Einzahlung': ['Lohn', 'Dividenden', 'Zinsen', 'Verkauf', 'Mieteinnahmen', 'Umbuchung Eingang', 'Kreditkartenabrechnung', 'Sonstiges'],
            'Auszahlung': ['Steuern', 'Gebühren', 'Lebensmittel', 'Telekommunikation', 'Versicherungen', 'Verkehr', 'Umbuchung Ausgang', 'Kartenzahlung', 'Sonstiges'],
            'Kauf': ['Investition', 'Reinvestition'],
            'Verkauf': ['Liquidation', 'Teilverkauf'],
            'Dividende': ['Ausschüttung'],
            'Wertanpassung': ['Marktbewertung', 'Abschreibung'],
            'Abzahlung': ['Amortisation', 'Sondertilgung'],
            'Zinszahlung': ['Hypothekarzins', 'Sollzins'],
            'Schulderhöhung': ['Aufstockung'],
            'Gebühr': ['Depotgebühr', 'Transaktionsgebühr']
        };
        return data?.settings?.bookingCategories || defaults;
    },

    // --- Assets & Strukturbaum-Navigation ---
    getAllAssets: function(customData) {
        const data = customData || this._getData();
        const assets = [];
        const unknownLabel = this.t('unknown');
        const mainPortLabel = this.t('mainPortfolio');

        function traverse(node, curBankName, curBankId, curCatName, curCatId, ancestorCatIds, ancestorCatNames, pathArr) {
            if (!node) return;
            let bName = curBankName, bId = curBankId;
            let cName = curCatName, cId = curCatId;
            let nextCatIds = [...ancestorCatIds];
            let nextCatNames = [...ancestorCatNames];
            const nextPath = [...pathArr, node.name];

            if (node.type === 'bank') {
                bName = node.name;
                bId = node.id;
            }
            if (node.type === 'category') {
                cName = node.name;
                cId = node.id;
                nextCatIds.push(node.id);
                nextCatNames.push(node.name);
            }
            if (node.type === 'asset' && !node.isArchived) {
                assets.push({
                    ...node,
                    bankId: bId || '',
                    bankName: bName || unknownLabel,
                    categoryId: cId || bId || '',
                    categoryName: cName || bName || mainPortLabel,
                    ancestorCategoryIds: nextCatIds,
                    ancestorCategoryNames: nextCatNames,
                    path: pathArr.join(' ➔ ')
                });
            }
            if (node.children) {
                node.children.forEach(child => traverse(child, bName, bId, cName, cId, nextCatIds, nextCatNames, nextPath));
            }
        }
        (data.banks || []).forEach(bank => traverse(bank, bank.name, bank.id, '', '', [], [], []));
        return assets;
    },

    getTreeStructure: function(includeAssets = false, customData) {
        const data = customData || this._getData();
        const allAssets = this.getAllAssets(data);
        const today = this._getTodayStr();
        const self = this;

        function buildNode(node, bankName, pathArr) {
            if (!node || node.isArchived) return null;
            const currentPath = [...pathArr, node.name];

            if (node.type === 'asset') {
                if (!includeAssets) return null;
                return {
                    id: node.id,
                    name: node.name,
                    type: 'asset',
                    assetClass: node.assetClass || 'cash',
                    currency: node.currency || self.getBaseCurrency(data),
                    isLiquid: self._isAssetLiquid(node),
                    valueInBase: self.getAssetValueAtDate(node, today, allAssets)
                };
            }

            let directAssets = [];
            let childCategories = [];
            let subtreeValue = 0;
            let subtreeAssetCount = 0;
            let classesSet = new Set();

            const collectMetrics = (n) => {
                if (!n || n.isArchived) return;
                if (n.type === 'asset') {
                    subtreeValue += self.getAssetValueAtDate(n, today, allAssets);
                    subtreeAssetCount += 1;
                    if (n.assetClass) classesSet.add(n.assetClass);
                }
                if (n.children) n.children.forEach(collectMetrics);
            };
            collectMetrics(node);

            (node.children || []).forEach(child => {
                if (child.isArchived) return;
                if (child.type === 'category') {
                    const builtCat = buildNode(child, bankName, currentPath);
                    if (builtCat) childCategories.push(builtCat);
                } else if (child.type === 'asset' && includeAssets) {
                    const builtAsset = buildNode(child, bankName, currentPath);
                    if (builtAsset) directAssets.push(builtAsset);
                }
            });

            const result = {
                id: node.id,
                name: node.name,
                type: node.type,
                path: currentPath.join(' ➔ '),
                totalValue: subtreeValue,
                assetCount: subtreeAssetCount,
                assetClassesPresent: Array.from(classesSet),
                categories: childCategories
            };
            if (includeAssets) result.assets = directAssets;
            return result;
        }

        return (data.banks || []).map(b => buildNode(b, b.name, [])).filter(Boolean);
    },

    getCategories: function(customData) {
        const data = customData || this._getData();
        const allAssets = this.getAllAssets(data);
        const today = this._getTodayStr();
        const tree = this.getTreeStructure(false, data);
        const list = [];

        function flatten(nodes, bankName, bankId) {
            (nodes || []).forEach(n => {
                const bName = n.type === 'bank' ? n.name : bankName;
                const bId = n.type === 'bank' ? n.id : bankId;
                if (n.type === 'category') {
                    list.push({
                        id: n.id,
                        name: n.name,
                        bankId: bId,
                        bankName: bName,
                        path: n.path,
                        totalValue: n.totalValue,
                        assetCount: n.assetCount,
                        assetClassesPresent: n.assetClassesPresent
                    });
                }
                if (n.categories) flatten(n.categories, bName, bId);
            });
        }
        flatten(tree, '', '');

        (data.banks || []).forEach(bank => {
            if (!bank || bank.isArchived) return;
            const directAssets = (bank.children || []).filter(c => c.type === 'asset' && !c.isArchived);
            if (directAssets.length > 0) {
                const val = directAssets.reduce((s, a) => s + this.getAssetValueAtDate(a, today, allAssets), 0);
                const classes = Array.from(new Set(directAssets.map(a => a.assetClass || 'cash')));
                list.push({
                    id: bank.id + '_direct',
                    name: bank.name + ' (' + this.t('directPortfolio') + ')',
                    bankId: bank.id,
                    bankName: bank.name,
                    path: bank.name + ' ➔ ' + this.t('mainPortfolio'),
                    totalValue: val,
                    assetCount: directAssets.length,
                    assetClassesPresent: classes
                });
            }
        });

        return list;
    },

    getAssetsByCategory: function(categoryNameOrId, customData) {
        const self = this;
        return this.getAllAssets(customData).filter(a =>
            self._matchNodeIdOrName(categoryNameOrId, a.categoryName, a.categoryId, a.ancestorCategoryIds, a.ancestorCategoryNames) ||
            a.id === categoryNameOrId
        );
    },

    getLiquidAssets: function(customData) {
        return this.getAllAssets(customData).filter(a => this._isAssetLiquid(a));
    },

    getAssetsByBank: function(bankNameOrId, customData) {
        const self = this;
        return this.getAllAssets(customData).filter(a =>
            self._matchNodeIdOrName(bankNameOrId, a.bankName, a.bankId)
        );
    },

    getAssetsByClass: function(assetClass, customData) {
        const q = String(assetClass || '').toLowerCase();
        return this.getAllAssets(customData).filter(a => (a.assetClass || '').toLowerCase() === q);
    },

    getCreditCardAssets: function(customData) {
        const today = this._getTodayStr();
        const allAssets = this.getAllAssets(customData);
        return allAssets.filter(a => a.assetClass === 'credit_card').map(cc => {
            const rawBal = this.getAssetRawValueAtDate(cc, today);
            const baseBal = this.getAssetValueAtDate(cc, today, allAssets);
            const limit = Number(cc.cardLimit || 5000);
            const used = rawBal < 0 ? Math.abs(rawBal) : 0;
            return {
                ...cc,
                currentBalanceRaw: rawBal,
                currentBalanceBase: baseBal,
                cardLimit: limit,
                usedAmount: used,
                availableLimit: Math.max(0, limit - used),
                usagePct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0
            };
        });
    },

    // --- Wertermittlung (1:1 mit DataEngine.jsx + Fallback für Fonds ohne Stückzahl) ---
    _hasShareTracking: function(asset) {
        if (!asset || !this._isSecurity(asset.assetClass)) return false;
        if (Number(asset.shares) > 0) return true;
        return (asset.bookings || []).some(b => Number(b.shares) > 0);
    },

    getAssetSharesAtDate: function(asset, targetDate) {
        if (!asset || !this._isSecurity(asset.assetClass)) return 0;
        const dStr = targetDate || this._getTodayStr();
        let sh = 0;
        let hadShareBookings = false;
        if (asset.bookings) {
            asset.bookings.forEach(b => {
                if (b.date <= dStr && Number(b.shares) > 0) {
                    hadShareBookings = true;
                    const normType = this._normalizeBookingType(b.type, b.subCategory);
                    if (['buy', 'deposit', 'dividend'].includes(normType)) sh += Number(b.shares);
                    if (['sell', 'withdrawal'].includes(normType)) sh -= Number(b.shares);
                }
            });
        }
        if (hadShareBookings) return Math.max(0, sh);
        return Number(asset.shares) > 0 ? Number(asset.shares) : 0;
    },

    getAssetPriceAtDate: function(asset, targetDate) {
        if (!asset || !this._isSecurity(asset.assetClass)) return 1;
        const dStr = targetDate || this._getTodayStr();
        if (dStr >= this._getTodayStr() && Number(asset.price) > 0) return Number(asset.price);
        let p = 0;
        if (asset.bookings) {
            const sorted = [...asset.bookings].sort((a,b) => new Date(a.date) - new Date(b.date));
            const pastBookings = sorted.filter(b => b.date <= dStr && Number(b.price) > 0);
            if (pastBookings.length > 0) p = Number(pastBookings[pastBookings.length - 1].price);
        }
        return p > 0 ? p : (Number(asset.price) || 0);
    },

    getAssetRawValueAtDate: function(asset, targetDate) {
        if (!asset) return 0;
        const dStr = targetDate || this._getTodayStr();
        if (this._isSecurity(asset.assetClass) && this._hasShareTracking(asset)) {
            const sh = this.getAssetSharesAtDate(asset, dStr);
            if (sh <= 0) return 0;
            const pr = this.getAssetPriceAtDate(asset, dStr);
            if (pr > 0) return sh * pr;
        }

        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= dStr);
        let baseAmount = applicableBalance ? Number(applicableBalance.amount) : 0;
        let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';
        let netBookings = 0;

        if (asset.bookings) {
            asset.bookings.forEach(bk => {
                if (bk._isAutoValuation) return;
                if (bk.date > baseDate && bk.date <= dStr) {
                    const flow = this._getBookingFlow(bk);
                    if (flow.isPositive) netBookings += flow.amount;
                    else netBookings -= flow.amount;
                }
            });
        }
        return baseAmount + netBookings;
    },

    _resolveHistoricalFxRate: function(asset, targetDate, allAssets) {
        const baseCur = this.getBaseCurrency();
        if (!asset || !asset.currency || asset.currency === baseCur) return 1;
        const dStr = targetDate || this._getTodayStr();

        if (dStr >= this._getTodayStr() && asset.exchangeRate) {
            return this._parseRate(asset.exchangeRate);
        }

        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= dStr);
        let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate && Number(applicableBalance.bookingExchangeRate) !== 1
            ? applicableBalance.bookingExchangeRate
            : this._parseRate(asset.exchangeRate);
        let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';

        if (asset.bookings) {
            asset.bookings.forEach(bk => {
                if (bk.date > baseDate && bk.date <= dStr) {
                    if (bk.bookingExchangeRate && Number(bk.bookingExchangeRate) !== 1) applicableRate = bk.bookingExchangeRate;
                }
            });
        }

        if (!applicableRate || Number(applicableRate) === 1) {
            let latestDate = '1970-01-01';
            const pool = allAssets || this.getAllAssets();
            pool.forEach(otherAsset => {
                if (otherAsset.currency === asset.currency && otherAsset.bookings) {
                    otherAsset.bookings.forEach(b => {
                        if (b.bookingExchangeRate && Number(b.bookingExchangeRate) !== 1 && b.date <= dStr && b.date > latestDate) {
                            applicableRate = b.bookingExchangeRate;
                            latestDate = b.date;
                        }
                    });
                }
            });
        }
        return this._parseRate(applicableRate || 1);
    },

    _getBookingAppliedFxRate: function(bk, asset, allAssets) {
        const baseCur = this.getBaseCurrency();
        const cur = asset?.currency || bk?.currency || baseCur;
        if (!cur || cur === baseCur) return 1;
        const bkRate = bk?.bookingExchangeRate ? this._parseRate(bk.bookingExchangeRate) : 0;
        if (bkRate > 0 && bkRate !== 1) return bkRate;
        const assetRate = this._parseRate(asset?.exchangeRate || bk?.assetExchangeRate || 1);
        if (assetRate > 0 && assetRate !== 1) return assetRate;
        return this._resolveHistoricalFxRate(asset || { currency: cur }, bk?.date, allAssets);
    },

    getAssetValueAtDate: function(asset, targetDate, allAssets) {
        const dStr = targetDate || this._getTodayStr();
        const rawValue = this.getAssetRawValueAtDate(asset, dStr);
        const rate = this._resolveHistoricalFxRate(asset, dStr, allAssets);
        return rawValue * rate;
    },

    getInvestedCapitalAtDate: function(asset, targetDate, allAssets) {
        if (!asset) return 0;
        const dStr = targetDate || this._getTodayStr();
        let investedRaw = 0;
        const isFluc = this._isFluctuating(asset.assetClass);
        
        if (isFluc) {
            let allEntries = [
                ...(asset.balances || []).map(b => ({...b, _isBal: true})),
                ...(asset.bookings || []).filter(b => !b._isAutoValuation)
            ].filter(e => e.date <= dStr).sort((a,b) => new Date(a.date) - new Date(b.date));

            let hasInitial = false;
            allEntries.forEach(bk => {
                if (bk._isBal) {
                    if (!hasInitial && investedRaw === 0) {
                         investedRaw = Number(bk.amount || 0);
                         hasInitial = true;
                    }
                } else {
                    const normType = this._normalizeBookingType(bk.type, bk.subCategory);
                    const isIntOrDiv = this._hasConcept(bk.subCategory, 'interest') || this._hasConcept(bk.subCategory, 'dividend');
                    if (['buy', 'deposit'].includes(normType) && !isIntOrDiv) {
                        investedRaw += Number(bk.amount || 0);
                        hasInitial = true;
                    }
                    if (['sell', 'withdrawal'].includes(normType)) {
                        investedRaw -= Number(bk.amount || 0);
                    }
                }
            });
        } else {
            let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
            let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= dStr);
            let baseDate = '1970-01-01';

            if (applicableBalance) {
                investedRaw = Number(applicableBalance.amount || 0);
                baseDate = applicableBalance.date;
            }

            (asset.bookings || []).forEach(bk => {
                if (bk._isAutoValuation) return;
                const normType = this._normalizeBookingType(bk.type, bk.subCategory);
                const isIntOrDiv = this._hasConcept(bk.subCategory, 'interest') || this._hasConcept(bk.subCategory, 'dividend');
                const isKauf = normType === 'buy';
                const isEinzahlung = normType === 'deposit' && !isIntOrDiv;
                const isAuszahlung = normType === 'sell' || normType === 'withdrawal';

                if (applicableBalance) {
                    if (bk.date > baseDate && bk.date <= dStr) {
                        if (isKauf || isEinzahlung) investedRaw += Number(bk.amount || 0);
                        if (isAuszahlung) investedRaw -= Number(bk.amount || 0);
                    }
                } else {
                    if (bk.date <= dStr) {
                        if (isKauf || isEinzahlung) investedRaw += Number(bk.amount || 0);
                        if (isAuszahlung) investedRaw -= Number(bk.amount || 0);
                    }
                }
            });
        }

        const rate = this._resolveHistoricalFxRate(asset, dStr, allAssets);
        return investedRaw * rate;
    },

    getLatestBalanceValue: function(asset, customAssets) {
        return this.getAssetValueAtDate(asset, this._getTodayStr(), customAssets || this.getAllAssets());
    },

    getTotalWealthAtDate: function(targetDate, customData) {
        const dStr = targetDate || this._getTodayStr();
        const allAssets = this.getAllAssets(customData);
        return allAssets.reduce((sum, asset) => sum + this.getAssetValueAtDate(asset, dStr, allAssets), 0);
    },

    getTotalWealth: function(customData) {
        return this.getTotalWealthAtDate(this._getTodayStr(), customData);
    },

    getTotalLiquidWealth: function(customData) {
        const today = this._getTodayStr();
        const allAssets = this.getAllAssets(customData);
        return this.getLiquidAssets(customData).reduce((sum, asset) => sum + this.getAssetValueAtDate(asset, today, allAssets), 0);
    },

    getWealthDistributionByClass: function(customData) {
        const data = customData || this._getData();
        const allAssets = this.getAllAssets(data);
        const today = this._getTodayStr();
        const distribution = {};
        const classMap = {};
        
        this.getAssetClasses(data).forEach(ac => classMap[ac.id] = ac.name);
        
        allAssets.forEach(asset => {
            const val = this.getAssetValueAtDate(asset, today, allAssets);
            const acName = classMap[asset.assetClass] || this.t('ac_' + asset.assetClass) || asset.assetClass || this.t('other');
            distribution[acName] = (distribution[acName] || 0) + val;
        });
        return distribution;
    },

    getWealthDistributionByClassId: function(customData) {
        const data = customData || this._getData();
        const allAssets = this.getAllAssets(data);
        const today = this._getTodayStr();
        const distribution = {};
        allAssets.forEach(asset => {
            const val = this.getAssetValueAtDate(asset, today, allAssets);
            const acId = asset.assetClass || 'cash';
            distribution[acId] = (distribution[acId] || 0) + val;
        });
        return distribution;
    },

    getWealthByBank: function(customData) {
        const allAssets = this.getAllAssets(customData);
        const today = this._getTodayStr();
        const unknownLabel = this.t('unknown');
        const map = {};
        
        allAssets.forEach(asset => {
            const key = asset.bankId || asset.bankName || unknownLabel;
            if (!map[key]) {
                map[key] = {
                    bankId: asset.bankId || key,
                    bankName: asset.bankName || unknownLabel,
                    totalValue: 0,
                    assetCount: 0
                };
            }
            map[key].totalValue += this.getAssetValueAtDate(asset, today, allAssets);
            map[key].assetCount += 1;
        });
        
        return Object.keys(map).map(k => map[k]);
    },

    generateMonthEnds: function(startStr, endStr) {
        let dates = []; 
        let curr = new Date(startStr || '2024-01-01'); 
        let end = new Date(endStr || this._getTodayStr());
        while (curr <= end) {
            let lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
            if (lastDay > end) lastDay = end;
            dates.push(this._formatLocalIsoDate(lastDay));
            curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
        }
        if (endStr && !dates.includes(endStr)) dates.push(endStr);
        return dates;
    },

    calcLinearRegression: function(points) {
        const n = (points || []).length; 
        if (n < 2) return (x) => points?.[0]?.y || 0;
        let sX = 0, sY = 0, sXY = 0, sXX = 0;
        points.forEach((p, i) => { sX += i; sY += p.y; sXY += i * p.y; sXX += i * i; });
        const slope = (n * sXY - sX * sY) / (n * sXX - sX * sX);
        const inc = (sY - slope * sX) / n;
        return (x) => slope * x + inc;
    },

    calcExpRegression: function(points) {
        const n = (points || []).length; 
        if (n < 2) return (x) => points?.[0]?.y || 0;
        let sX = 0, sLnY = 0, sXLnY = 0, sXX = 0;
        points.forEach((p, i) => { const lnY = Math.log(Math.max(p.y, 1)); sX += i; sLnY += lnY; sXLnY += i * lnY; sXX += i * i; });
        const b = (n * sXLnY - sX * sLnY) / (n * sXX - sX * sX);
        const a = Math.exp((sLnY - b * sX) / n);
        return (x) => a * Math.exp(b * x);
    },

    getHistoricalWealth: function(startDate, endDate, customData) {
        const allAssets = this.getAllAssets(customData);
        const monthEnds = this.generateMonthEnds(startDate || '2024-01-01', endDate || this._getTodayStr());
        return monthEnds.map(dStr => {
            let total = 0;
            let liquid = 0;
            allAssets.forEach(a => {
                const val = this.getAssetValueAtDate(a, dStr, allAssets);
                total += val;
                if (this._isAssetLiquid(a)) liquid += val;
            });
            return { date: dStr, total: total, liquid: liquid };
        });
    },

    // --- Spezial-Auswertungen (Vorsorge, Wertschriften, Dividenden, Steuern) ---
    getPensionSummary: function(customData) {
        const allAssets = this.getAllAssets(customData);
        const today = this._getTodayStr();
        const curYear = String(new Date().getFullYear());

        const p2Assets = allAssets.filter(a => this._isPillar2Asset(a));
        const p3aAssets = allAssets.filter(a => this._isPillar3aAsset(a));

        const p2Value = p2Assets.reduce((s, a) => s + this.getAssetValueAtDate(a, today, allAssets), 0);
        const p2Invested = p2Assets.reduce((s, a) => s + this.getInvestedCapitalAtDate(a, today, allAssets), 0);
        const p3aValue = p3aAssets.reduce((s, a) => s + this.getAssetValueAtDate(a, today, allAssets), 0);
        const p3aInvested = p3aAssets.reduce((s, a) => s + this.getInvestedCapitalAtDate(a, today, allAssets), 0);

        let deposits3aThisYear = 0;
        p3aAssets.forEach(a => {
            (a.bookings || []).forEach(b => {
                if (b._isAutoValuation) return;
                const normType = this._normalizeBookingType(b.type, b.subCategory);
                if (String(b.date || '').startsWith(curYear) && ['deposit', 'buy'].includes(normType)) {
                    const rate = this._getBookingAppliedFxRate(b, a, allAssets);
                    deposits3aThisYear += Number(b.amount || 0) * rate;
                }
            });
        });

        const liquidValue = this.getTotalLiquidWealth(customData);
        const estimatedAnnualPensionP2 = p2Value * 0.068;
        const estimatedAnnualPension3a = p3aValue * 0.04;
        const estimatedAnnualLiquidDrawdown = liquidValue * 0.04;

        return {
            pillar2: {
                value: p2Value,
                invested: p2Invested,
                gain: p2Value - p2Invested,
                estimatedAnnualPension: estimatedAnnualPensionP2,
                estimatedMonthlyPension: estimatedAnnualPensionP2 / 12,
                assets: p2Assets
            },
            pillar3a: {
                value: p3aValue,
                invested: p3aInvested,
                gain: p3aValue - p3aInvested,
                depositsThisYear: deposits3aThisYear,
                maxAnnualAllowance: 7258,
                remainingAllowanceThisYear: Math.max(0, 7258 - deposits3aThisYear),
                estimatedAnnualPension: estimatedAnnualPension3a,
                estimatedMonthlyPension: estimatedAnnualPension3a / 12,
                assets: p3aAssets
            },
            liquidWealth: liquidValue,
            estimatedMonthlyRetirementTotal: (estimatedAnnualPensionP2 + estimatedAnnualPension3a + estimatedAnnualLiquidDrawdown) / 12,
            totalValue: p2Value + p3aValue,
            totalInvested: p2Invested + p3aInvested,
            totalGain: (p2Value + p3aValue) - (p2Invested + p3aInvested)
        };
    },

    getSecuritiesPerformance: function(targetDate, customData) {
        const dStr = targetDate || this._getTodayStr();
        const allAssets = this.getAllAssets(customData);
        const secAssets = allAssets.filter(a => ['stock', 'fund', 'crypto', 'managed_fund', 'pension_fund', 'pension_3a_fund', 'pension_3a_managed'].includes(a.assetClass));

        return secAssets.map(a => {
            const marketValue = this.getAssetValueAtDate(a, dStr, allAssets);
            const invested = this.getInvestedCapitalAtDate(a, dStr, allAssets);
            let dividends = 0;
            (a.bookings || []).forEach(b => {
                if (b._isAutoValuation) return;
                if (b.date <= dStr && this._isDividendBooking(b)) {
                    const r = this._getBookingAppliedFxRate(b, a, allAssets);
                    dividends += Number(b.amount || 0) * r;
                }
            });
            const unrealizedGain = marketValue - invested;
            const totalReturn = unrealizedGain + dividends;
            const roiPct = invested > 0 ? (totalReturn / invested) * 100 : 0;
            return {
                id: a.id,
                name: a.name,
                ticker: a.ticker || '',
                isin: a.isin || '',
                bankId: a.bankId,
                bankName: a.bankName,
                categoryId: a.categoryId,
                categoryName: a.categoryName,
                assetClass: a.assetClass,
                currency: a.currency || this.getBaseCurrency(customData),
                shares: this.getAssetSharesAtDate(a, dStr),
                price: this.getAssetPriceAtDate(a, dStr),
                invested,
                marketValue,
                unrealizedGain,
                dividends,
                totalReturn,
                roiPct
            };
        });
    },

    getDividendCalendar: function(customData) {
        const allAssets = this.getAllAssets(customData);
        const today = this._getTodayStr();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoStr = this._formatLocalIsoDate(oneYearAgo);
        const baseCur = this.getBaseCurrency(customData);

        const monthlyBreakdown = Array.from({ length: 12 }, (_, idx) => ({
            month: idx + 1,
            grossTotal: 0,
            netTotal: 0,
            payers: []
        }));

        const resolveIntervalInfo = (count) => {
            if (count >= 10) return { key: 'monthly', label: this.t('intervalMonthly') };
            if (count >= 3) return { key: 'quarterly', label: this.t('intervalQuarterly') };
            if (count === 2) return { key: 'semi-annual', label: this.t('intervalSemiAnnual') };
            return { key: 'annual', label: this.t('intervalAnnual') };
        };

        const nonDividendClasses = ['cash', 'credit_card', 'mortgage', 'pension_cash', 'pension_3a_cash'];
        const positions = [];

        allAssets.forEach(a => {
            const ac = String(a.assetClass || 'cash').toLowerCase();
            const yieldPctMeta = parseFloat(String(a.forwardYield || '0').replace(',', '.'));

            // Reine Cash-/Verrechnungskonten ausschliessen, sofern kein expliziter Forward-Yield hinterlegt ist
            if (nonDividendClasses.includes(ac) && !(yieldPctMeta > 0)) return;

            const valBase = this.getAssetValueAtDate(a, today, allAssets);
            const assetCur = a.currency || baseCur;
            const taxPct = parseFloat(String(a.totalTaxes || '0').replace(',', '.')) || 0;

            const divBookings = (a.bookings || []).filter(b => !b._isAutoValuation && this._isDividendBooking(b));
            const recentDivBookings = divBookings.filter(b => b.date >= oneYearAgoStr);
            const bookingsPool = recentDivBookings.length > 0 ? recentDivBookings : divBookings;

            let annualGross = 0;
            let activeMonths = [];
            let effectiveYieldPct = yieldPctMeta > 0 ? yieldPctMeta : 0;

            if (yieldPctMeta > 0 && valBase > 0) {
                annualGross = valBase * (yieldPctMeta / 100);
                activeMonths = String(a.payoutMonths || '12')
                    .split(',')
                    .map(m => parseInt(m.trim(), 10))
                    .filter(m => m >= 1 && m <= 12);
            } else if (bookingsPool.length > 0) {
                const bookedSumBase = bookingsPool.reduce((s, b) => {
                    const r = this._getBookingAppliedFxRate(b, a, allAssets);
                    return s + Number(b.amount || 0) * r;
                }, 0);
                const yearsSet = new Set(bookingsPool.map(b => String(b.date || '').substring(0, 4)).filter(Boolean));
                const numYears = recentDivBookings.length > 0 ? 1 : Math.max(1, yearsSet.size);
                annualGross = bookedSumBase / numYears;
                effectiveYieldPct = valBase > 0 ? (annualGross / valBase) * 100 : 0;

                const monthsSet = new Set();
                bookingsPool.forEach(b => {
                    const m = parseInt(String(b.date || '').substring(5, 7), 10);
                    if (m >= 1 && m <= 12) monthsSet.add(m);
                });
                activeMonths = Array.from(monthsSet).sort((x, y) => x - y);
            }

            if (annualGross <= 0) return;
            if (activeMonths.length === 0) activeMonths = [12];

            const annualNet = annualGross * (1 - taxPct / 100);
            const perPayoutGross = annualGross / activeMonths.length;
            const perPayoutNet = annualNet / activeMonths.length;
            const intervalInfo = resolveIntervalInfo(activeMonths.length);

            activeMonths.forEach(m => {
                monthlyBreakdown[m - 1].grossTotal += perPayoutGross;
                monthlyBreakdown[m - 1].netTotal += perPayoutNet;
                monthlyBreakdown[m - 1].payers.push({
                    assetId: a.id,
                    name: a.name,
                    ticker: a.ticker || '',
                    currency: assetCur,
                    intervalKey: intervalInfo.key,
                    interval: intervalInfo.label,
                    gross: perPayoutGross,
                    net: perPayoutNet
                });
            });

            positions.push({
                id: a.id,
                name: a.name,
                ticker: a.ticker || '',
                bankId: a.bankId,
                bankName: a.bankName,
                categoryName: a.categoryName,
                assetClass: a.assetClass,
                currency: assetCur,
                intervalKey: intervalInfo.key,
                interval: intervalInfo.label,
                payoutFrequency: activeMonths.length,
                valueInBase: valBase,
                forwardYieldPct: Number(effectiveYieldPct.toFixed(2)),
                taxPct: taxPct,
                payoutMonths: activeMonths,
                annualGross,
                annualNet
            });
        });

        positions.sort((a, b) => b.annualGross - a.annualGross);

        return {
            totalAnnualGross: positions.reduce((s, p) => s + p.annualGross, 0),
            totalAnnualNet: positions.reduce((s, p) => s + p.annualNet, 0),
            monthlyBreakdown,
            positions
        };
    },

    getTaxSummary: function(year, customData) {
        const taxYear = year || new Date().getFullYear();
        const keyDate = String(taxYear) + "-12-31";
        const allAssets = this.getAllAssets(customData);

        let bankAccounts = 0;
        let securities = 0;
        let realEstate = 0;
        let debts = 0;
        let taxFreePension = 0;
        let taxableDividends = 0;
        let taxableInterest = 0;

        allAssets.forEach(a => {
            const val = this.getAssetValueAtDate(a, keyDate, allAssets);
            const ac = (a.assetClass || 'cash').toLowerCase();
            if (this._isPensionAsset(a)) {
                taxFreePension += val;
            } else if (ac === 'mortgage') {
                debts += Math.abs(val);
            } else if (ac === 'credit_card') {
                if (val < 0) debts += Math.abs(val);
                else bankAccounts += val;
            } else if (ac === 'realestate') {
                realEstate += val;
            } else if (['stock', 'fund', 'crypto', 'managed_fund'].includes(ac)) {
                securities += val;
            } else {
                bankAccounts += val;
            }

            if (!this._isPensionAsset(a)) {
                (a.bookings || []).forEach(b => {
                    if (b._isAutoValuation) return;
                    if (String(b.date || '').startsWith(String(taxYear))) {
                        const normType = this._normalizeBookingType(b.type, b.subCategory);
                        const rate = this._getBookingAppliedFxRate(b, a, allAssets);
                        const amtBase = Number(b.amount || 0) * rate;
                        if (this._isDividendBooking(b)) taxableDividends += amtBase;
                        if (normType === 'interest' || this._hasConcept(b.subCategory, 'interest')) taxableInterest += amtBase;
                    }
                });
            }
        });

        const grossTaxableWealth = bankAccounts + securities + realEstate;
        return {
            year: taxYear,
            keyDate,
            bankAccounts,
            securities,
            realEstate,
            grossTaxableWealth,
            debts,
            netTaxableWealth: grossTaxableWealth - debts,
            taxFreePension,
            taxableDividends,
            taxableInterest,
            totalTaxableIncome: taxableDividends + taxableInterest
        };
    },

    // --- Flexible Query-Methoden für Assets & Buchungen ---
    queryAssets: function(filter = {}, customData) {
        const all = this.getAllAssets(customData);
        const today = filter.date || this._getTodayStr();
        const self = this;
        return all.filter(a => {
            if (filter.bankName && !self._matchNodeIdOrName(filter.bankName, a.bankName, a.bankId)) return false;
            if (filter.categoryName && !self._matchNodeIdOrName(filter.categoryName, a.categoryName, a.categoryId, a.ancestorCategoryIds, a.ancestorCategoryNames)) return false;
            if (filter.assetClass) {
                const classes = Array.isArray(filter.assetClass) ? filter.assetClass : [filter.assetClass];
                if (!classes.includes(a.assetClass)) return false;
            }
            if (filter.currency && a.currency !== filter.currency) return false;
            if (typeof filter.isLiquid === 'boolean' && this._isAssetLiquid(a) !== filter.isLiquid) return false;
            if (filter.search) {
                const q = String(filter.search).toLowerCase();
                const hit = (a.name || '').toLowerCase().includes(q) ||
                            (a.ticker || '').toLowerCase().includes(q) ||
                            (a.isin || '').toLowerCase().includes(q) ||
                            (a.path || '').toLowerCase().includes(q);
                if (!hit) return false;
            }
            const val = this.getAssetValueAtDate(a, today, all);
            if (typeof filter.minBalance === 'number' && val < filter.minBalance) return false;
            if (typeof filter.maxBalance === 'number' && val > filter.maxBalance) return false;
            return true;
        });
    },

    getAllBookings: function(customData) {
        const allAssets = this.getAllAssets(customData);
        return allAssets.flatMap(asset => 
            (asset.bookings || [])
                .filter(booking => !booking._isAutoValuation)
                .map(booking => {
                    const appliedRate = this._getBookingAppliedFxRate(booking, asset, allAssets);
                    return {
                        ...booking,
                        canonicalType: this._normalizeBookingType(booking.type, booking.subCategory),
                        _baseValue: Number(booking.amount || 0) * appliedRate,
                        assetId: asset.id,
                        assetName: asset.name,
                        bankId: asset.bankId,
                        bankName: asset.bankName,
                        categoryId: asset.categoryId,
                        categoryName: asset.categoryName,
                        assetClass: asset.assetClass,
                        currency: asset.currency || this.getBaseCurrency(customData),
                        assetExchangeRate: asset.exchangeRate
                    };
                })
        );
    },

    getNormalizedBookings: function(customData) {
        const assets = this.getAllAssets(customData);
        let allBookings = [];
        assets.forEach(asset => {
            (asset.bookings || []).forEach(bk => {
                if (bk._isAutoValuation) return;
                const classif = this._classifyBooking(bk, asset);
                const appliedRate = this._getBookingAppliedFxRate(bk, asset, assets);
                
                allBookings.push({
                    ...bk,
                    originalType: bk.type,
                    type: bk.type,
                    canonicalType: classif.canonicalType,
                    flowType: classif.flowType,
                    classificationType: classif.flowType,
                    categoryKey: classif.categoryKey,
                    category: classif.category,
                    subCategory: bk.subCategory || classif.category,
                    isLiquid: classif.isLiquid,
                    _baseValue: Number(bk.amount || 0) * appliedRate,
                    assetId: asset.id,
                    assetName: asset.name,
                    bankId: asset.bankId,
                    bankName: asset.bankName,
                    categoryId: asset.categoryId,
                    categoryName: asset.categoryName,
                    assetClass: asset.assetClass,
                    currency: asset.currency || this.getBaseCurrency(customData)
                });
            });
        });
        return allBookings;
    },

    queryBookings: function(filter = {}, customData) {
        const list = this.getNormalizedBookings(customData);
        const self = this;
        return list.filter(b => {
            if (filter.fromDate && b.date < filter.fromDate) return false;
            if (filter.toDate && b.date > filter.toDate) return false;
            if (filter.type) {
                const ft = String(filter.type).toLowerCase().trim();
                const normFilterType = self._normalizeBookingType(ft);
                const matchRaw = String(b.type || '').toLowerCase() === ft;
                const matchCanon = b.canonicalType === normFilterType;
                const matchFlow = String(b.flowType || '').toLowerCase() === ft;
                if (!matchRaw && !matchCanon && !matchFlow) return false;
            }
            if (filter.subCategory) {
                const sc = String(filter.subCategory).toLowerCase();
                const matchSub = (b.subCategory || '').toLowerCase().includes(sc) || (b.category || '').toLowerCase().includes(sc) || (b.categoryKey || '').toLowerCase() === sc;
                if (!matchSub) return false;
            }
            if (filter.bankName && !self._matchNodeIdOrName(filter.bankName, b.bankName, b.bankId)) return false;
            if (filter.assetClass && b.assetClass !== filter.assetClass) return false;
            if (filter.tag && !(b.comment || '').toLowerCase().includes(String(filter.tag).toLowerCase())) return false;
            if (filter.search) {
                const q = String(filter.search).toLowerCase();
                const hit = (b.assetName || '').toLowerCase().includes(q) ||
                            (b.subCategory || '').toLowerCase().includes(q) ||
                            (b.comment || '').toLowerCase().includes(q) ||
                            (b.type || '').toLowerCase().includes(q);
                if (!hit) return false;
            }
            return true;
        });
    },

    getTotalFeesPaid: function(customData) {
        return this.getNormalizedBookings(customData)
            .filter(b => b.canonicalType === 'fee' || this._hasConcept(b.subCategory, 'fee'))
            .reduce((sum, b) => sum + Number(b._baseValue || 0), 0);
    },

    getTotalDividendsReceived: function(customData) {
        return this.getNormalizedBookings(customData)
            .filter(b => this._isDividendBooking(b))
            .reduce((sum, b) => sum + Number(b._baseValue || 0), 0);
    },

    getMonthlyCashflowHistory: function(customData) {
        const bookings = this.getNormalizedBookings(customData);
        const cashflowMap = {};
        const fallbackCat = this.t('other');
        bookings.forEach(b => {
            if (!b.date) return;
            if (b.flowType !== 'income' && b.flowType !== 'expense') return;
            const month = b.date.substring(0, 7); 
            if (!cashflowMap[month]) {
                cashflowMap[month] = { month: month, income: 0, expenses: 0, net: 0, savingsRate: 0, byCategory: {} };
            }
            
            const amount = Math.abs(Number(b._baseValue || 0));
            if (b.flowType === 'income') {
                cashflowMap[month].income += amount;
            } else if (b.flowType === 'expense') {
                cashflowMap[month].expenses += amount;
                const cat = b.subCategory || b.category || fallbackCat;
                cashflowMap[month].byCategory[cat] = (cashflowMap[month].byCategory[cat] || 0) + amount;
            }
        });
        return Object.keys(cashflowMap).sort().map(m => {
            const entry = cashflowMap[m];
            entry.net = entry.income - entry.expenses;
            entry.savingsRate = entry.income > 0 ? (entry.net / entry.income) * 100 : 0;
            return entry;
        });
    },

    // --- Budget, Ziele & Szenarien API (inkl. 4-Sprachen-Frequenzen & Buchungs-Fallback) ---
    _normalizeToMonthly: function(items) {
        if (!items || !Array.isArray(items)) return 0;
        return items.reduce((sum, item) => {
            const amount = parseFloat(item.amount) || 0;
            const freq = String(item.frequency || 'monthly').toLowerCase().trim();
            if (['yearly', 'annual', 'annually', 'jährlich', 'jaehrlich', 'annuel', 'annuelle', 'annuale'].includes(freq)) return sum + (amount / 12);
            if (['semi-annually', 'semi-annual', 'halbjährlich', 'halbjaehrlich', 'semestriel', 'semestrielle', 'semestrale'].includes(freq)) return sum + (amount / 6);
            if (['quarterly', 'vierteljährlich', 'vierteljaehrlich', 'quartalsweise', 'trimestriel', 'trimestrielle', 'trimestrale'].includes(freq)) return sum + (amount / 3);
            return sum + amount;
        }, 0);
    },

    getBudgetItems: function(customData) {
        const d = customData || this._getData();
        const toMonthly = (item) => this._normalizeToMonthly([item]);
        return {
            incomeSources: (d.budget?.incomeSources || []).map((item, idx) => ({
                ...item,
                id: item.id || ('inc_' + (idx + 1)),
                name: item.name || (this.t('incomeItem') + ' ' + (idx + 1)),
                monthlyAmount: toMonthly(item)
            })),
            expenses: (d.budget?.expenses || []).map((item, idx) => ({
                ...item,
                id: item.id || ('exp_' + (idx + 1)),
                name: item.name || (this.t('expenseItem') + ' ' + (idx + 1)),
                monthlyAmount: toMonthly(item)
            })),
            subscriptions: (d.budget?.subscriptions || []).map((item, idx) => ({
                ...item,
                id: item.id || ('sub_' + (idx + 1)),
                name: item.name || (this.t('subItem') + ' ' + (idx + 1)),
                monthlyAmount: toMonthly(item)
            }))
        };
    },

    getMonthlyIncome: function(customData) {
        const d = customData || this._getData();
        const budgetIncome = this._normalizeToMonthly(d.budget?.incomeSources);
        if (budgetIncome > 0) return budgetIncome;

        const hist = this.getMonthlyCashflowHistory(d).slice(-12);
        if (hist.length === 0) return 0;
        return hist.reduce((s, m) => s + m.income, 0) / hist.length;
    },

    getMonthlyFixedCosts: function(customData) {
        const d = customData || this._getData();
        const budgetCosts = this._normalizeToMonthly(d.budget?.expenses) + this._normalizeToMonthly(d.budget?.subscriptions);
        if (budgetCosts > 0) return budgetCosts;

        const hist = this.getMonthlyCashflowHistory(d).slice(-12);
        if (hist.length === 0) return 0;
        return hist.reduce((s, m) => s + m.expenses, 0) / hist.length;
    },

    getBudgetOverview: function(customData) {
        const income = this.getMonthlyIncome(customData);
        const costs = this.getMonthlyFixedCosts(customData);
        const items = this.getBudgetItems(customData);
        return {
            income: income,
            costs: costs,
            disposable: income - costs,
            savingsRate: income > 0 ? ((income - costs) / income) * 100 : 0,
            incomeSources: items.incomeSources,
            expenses: items.expenses,
            subscriptions: items.subscriptions
        };
    },

    getExpensesByCategory: function(categoryType, customData) {
        const d = customData || this._getData();
        const allItems = [...(d.budget?.expenses || []), ...(d.budget?.subscriptions || [])];
        return this._normalizeToMonthly(allItems.filter(i => i.ruleCategory === categoryType));
    },

    getFreeMonthlyBuffer: function(customData) {
        return this.getMonthlyIncome(customData) - this.getMonthlyFixedCosts(customData);
    },

    getSavingsRate: function(customData) {
        return this.getBudgetOverview(customData).savingsRate;
    },

    getGoals: function(customData) {
        const d = customData || this._getData();
        return d.goals || { fire: { target: 0, year: new Date().getFullYear() + 10 } };
    },

    getScenarios: function(customData) {
        const d = customData || this._getData();
        return (d.scenarios || []).map((sc, idx) => ({
            ...sc,
            id: sc.id || ('scen_' + (idx + 1)),
            name: sc.name || (this.t('scenario') + ' ' + (idx + 1)),
            impact: Number(sc.impact || 0)
        }));
    },

    getFireProgress: function(customData) {
        const d = customData || this._getData();
        const currentWealth = this.getTotalWealth(d);
        const liquidWealth = this.getTotalLiquidWealth(d);
        const monthlySavings = Math.max(0, this.getFreeMonthlyBuffer(d));
        const annualSavings = monthlySavings * 12;
        const annualExpenses = this.getMonthlyFixedCosts(d) * 12;
        const targetWealth = (d.goals?.fire?.target && d.goals.fire.target > 0)
            ? Number(d.goals.fire.target)
            : (annualExpenses > 0 ? annualExpenses * 25 : 1000000);
        const scenarios = this.getScenarios(d);
        const scenarioImpact = scenarios.reduce((s, sc) => s + Number(sc.impact || 0), 0);

        return {
            current: currentWealth,
            liquidCurrent: liquidWealth,
            target: targetWealth,
            targetYear: d.goals?.fire?.year || (new Date().getFullYear() + 10),
            monthlySavings: monthlySavings,
            annualSavings: annualSavings,
            scenarios: scenarios,
            scenarioImpact: scenarioImpact,
            projectedAfterScenarios: currentWealth + scenarioImpact,
            percentage: targetWealth > 0 ? Math.min((currentWealth / targetWealth) * 100, 100) : 0
        };
    },

    // --- Temporäre Szenario-Simulation (Sandbox / What-If Engine) ---
    createSandbox: function(scenarioConfig) {
        const baseData = JSON.parse(JSON.stringify(this._getData()));
        scenarioConfig = scenarioConfig || {};

        if (scenarioConfig.removeAssetIds && Array.isArray(scenarioConfig.removeAssetIds)) {
            const removeSet = new Set(scenarioConfig.removeAssetIds);
            function purge(nodes) {
                return nodes.filter(n => !removeSet.has(n.id)).map(n => {
                    if (n.children) return { ...n, children: purge(n.children) };
                    return n;
                });
            }
            baseData.banks = purge(baseData.banks || []);
        }

        if (scenarioConfig.addAssets && Array.isArray(scenarioConfig.addAssets)) {
            let simBank = (baseData.banks || []).find(b => b.id === 'bank_sim');
            if (!simBank) {
                simBank = { id: 'bank_sim', name: this.t('simulationBank'), type: 'bank', children: [] };
                baseData.banks.push(simBank);
            }
            scenarioConfig.addAssets.forEach(a => {
                simBank.children.push({
                    id: a.id || 'mock_' + Math.random().toString(36).substr(2, 9),
                    name: a.name || this.t('simulatedAsset'),
                    type: 'asset',
                    assetClass: a.assetClass || 'stock',
                    currency: a.currency || this.getBaseCurrency(baseData),
                    isLiquid: a.isLiquid || false,
                    price: a.price || 1,
                    shares: a.shares || 0,
                    balances: a.balances || (a.initialBalance ? [{ date: '2000-01-01', amount: a.initialBalance }] : []),
                    bookings: a.bookings || []
                });
            });
        }

        if (scenarioConfig.addBookings && Array.isArray(scenarioConfig.addBookings)) {
            scenarioConfig.addBookings.forEach(bk => {
                const defaultSubCat = this.t('scenario');
                function injectBooking(nodes) {
                    nodes.forEach(n => {
                        if (n.type === 'asset' && n.id === bk.assetId) {
                            n.bookings = n.bookings || [];
                            n.bookings.push({
                                id: 'sim_bk_' + Math.random().toString(36).substr(2, 9),
                                date: bk.date || new Date().toISOString().split('T')[0],
                                type: bk.type || 'Kauf',
                                amount: bk.amount || 0,
                                subCategory: bk.subCategory || defaultSubCat,
                                shares: bk.shares,
                                price: bk.price
                            });
                        }
                        if (n.children) injectBooking(n.children);
                    });
                }
                injectBooking(baseData.banks || []);
            });
        }

        if (scenarioConfig.budgetDelta) {
            baseData.budget = baseData.budget || { expenses: [], incomeSources: [], subscriptions: [] };
            if (scenarioConfig.budgetDelta.monthlyExpenses) {
                baseData.budget.expenses.push({
                    name: this.t('simulatedExpenses'),
                    amount: scenarioConfig.budgetDelta.monthlyExpenses,
                    frequency: 'monthly'
                });
            }
            if (scenarioConfig.budgetDelta.monthlyIncome) {
                baseData.budget.incomeSources.push({
                    name: this.t('simulatedIncome'),
                    amount: scenarioConfig.budgetDelta.monthlyIncome,
                    frequency: 'monthly'
                });
            }
        }

        const self = this;
        return {
            getRawData: () => baseData,
            getTotalWealth: () => self.getTotalWealth(baseData),
            getTotalLiquidWealth: () => self.getTotalLiquidWealth(baseData),
            getWealthDistributionByClass: () => self.getWealthDistributionByClass(baseData),
            getWealthByBank: () => self.getWealthByBank(baseData),
            getAllAssets: () => self.getAllAssets(baseData),
            getLiquidAssets: () => self.getLiquidAssets(baseData),
            getHistoricalWealth: (s, e) => self.getHistoricalWealth(s, e, baseData),
            getMonthlyIncome: () => self.getMonthlyIncome(baseData),
            getMonthlyFixedCosts: () => self.getMonthlyFixedCosts(baseData),
            getFreeMonthlyBuffer: () => self.getFreeMonthlyBuffer(baseData),
            getSavingsRate: () => self.getSavingsRate(baseData),
            getFireProgress: () => self.getFireProgress(baseData),
            getDiffToLive: () => ({
                wealthDiff: self.getTotalWealth(baseData) - self.getTotalWealth(),
                liquidDiff: self.getTotalLiquidWealth(baseData) - self.getTotalLiquidWealth(),
                costsDiff: self.getMonthlyFixedCosts(baseData) - self.getMonthlyFixedCosts()
            })
        };
    },

    // --- DOM-Extraktion & PDF-Export (4-sprachig) ---
    extractKpisFromDom: function() {
        const kpis = [];
        const candidateCards = document.querySelectorAll('.kpi-card, [data-kpi], .stat-card, .grid > div');
        candidateCards.forEach(card => {
            if (kpis.length >= 6) return;
            if (card.querySelector('canvas, [_echarts_instance_], input, select, textarea, button')) return;
            const textNodes = card.innerText.split('\\n').map(t => t.trim()).filter(Boolean);
            if (textNodes.length >= 2) {
                let label = textNodes[0];
                let value = textNodes[1];
                let sub = textNodes[2] || '';
                if (/^[\\d\\.,'\\+\\-\\sCHF€$]+$/.test(label) && textNodes.length >= 2) {
                    value = textNodes[0];
                    label = textNodes[1];
                }
                if (label && value && value.length < 35 && label.length < 40) {
                    kpis.push({
                        label: label.substring(0, 32),
                        value: value,
                        sub: sub.substring(0, 35),
                        color: kpis.length === 0 ? '#3b82f6' : (kpis.length === 1 ? '#10b981' : (kpis.length === 2 ? '#f59e0b' : '#6366f1'))
                    });
                }
            }
        });
        return kpis;
    },

    extractParametersFromDom: function() {
        const groups = [];
        const defaultSimTitle = this.t('simParams');
        const defaultGenTitle = this.t('generalParams');
        const summarySections = document.querySelectorAll('[data-summary], [data-simulation-summary], .simulation-summary');
        if (summarySections.length > 0) {
            summarySections.forEach(sec => {
                const title = sec.querySelector('h3, h4, .font-bold')?.innerText?.trim() || defaultSimTitle;
                const items = [];
                sec.querySelectorAll('li, div.flex, tr').forEach(row => {
                    const texts = row.innerText.split('\\n').map(t => t.trim()).filter(Boolean);
                    if (texts.length >= 2) items.push({ label: texts[0], value: texts[1] });
                });
                if (items.length > 0) groups.push({ group: title, items });
            });
            if (groups.length > 0) return groups;
        }

        const paramContainers = document.querySelectorAll('.simulation-card, .param-card, [data-param-group], .space-y-4, .space-y-6');
        paramContainers.forEach(container => {
            const heading = container.querySelector('h3, h4, h5, .font-bold, .font-black')?.innerText?.trim();
            const inputs = container.querySelectorAll('input, select');
            if (inputs.length > 0) {
                const groupItems = [];
                inputs.forEach(inp => {
                    let label = '';
                    if (inp.id) {
                        const lbl = document.querySelector('label[for="' + inp.id + '"]');
                        if (lbl) label = lbl.innerText.trim();
                    }
                    if (!label && inp.closest('div')) {
                        const directLabel = inp.closest('div').querySelector('label, span.text-xs, span.font-bold');
                        if (directLabel) label = directLabel.innerText.trim();
                    }
                    if (!label) label = inp.getAttribute('name') || inp.getAttribute('placeholder') || 'Parameter';

                    let val = inp.value;
                    const valueDisplay = inp.closest('div')?.querySelector('.val, .value, span.font-mono');
                    if (valueDisplay) val = valueDisplay.innerText.trim();
                    if (inp.type === 'range' && !valueDisplay) val = inp.value;

                    const lblLower = label.toLowerCase();
                    if (lblLower.includes('rendite') || lblLower.includes('zins') || lblLower.includes('rate') || lblLower.includes('yield') || lblLower.includes('taux') || lblLower.includes('rendimento') || lblLower.includes('tasso')) {
                        if (!String(val).includes('%')) val = val + ' %';
                    }
                    if (label && val) groupItems.push({ label: label.substring(0, 30), value: String(val).substring(0, 25) });
                });
                if (groupItems.length > 0) {
                    groups.push({ group: (heading || defaultGenTitle).substring(0, 35), items: groupItems });
                }
            }
        });
        return groups.slice(0, 3);
    },

    _findChartTitle: function(el, fallbackTitle) {
        let cur = el ? el.parentElement : null;
        while (cur && cur !== document.body) {
            const heading = cur.querySelector(':scope > h2, :scope > h3, :scope > h4, :scope > div > h2, :scope > div > h3, :scope > div > h4');
            if (heading && heading.innerText && heading.innerText.trim()) {
                return heading.innerText.trim();
            }
            cur = cur.parentElement;
        }
        return fallbackTitle;
    },

    captureAllCharts: async function() {
        const chartsData = [];
        const defaultChartTitle = this.t('wealthDev');
        const capturedCanvases = new Set();

        if (window.echarts) {
            const echartsDivs = document.querySelectorAll('div[_echarts_instance_], .universal-chart-wrapper > div');
            const seenInstances = new Set();

            echartsDivs.forEach((div) => {
                const instance = window.echarts.getInstanceByDom(div);
                if (instance && !seenInstances.has(instance)) {
                    seenInstances.add(instance);
                    div.querySelectorAll('canvas').forEach(c => capturedCanvases.add(c));

                    try {
                        const prevOpt = instance.getOption();
                        const xAxes = Array.isArray(prevOpt.xAxis) ? prevOpt.xAxis : (prevOpt.xAxis ? [prevOpt.xAxis] : []);
                        const yAxes = Array.isArray(prevOpt.yAxis) ? prevOpt.yAxis : (prevOpt.yAxis ? [prevOpt.yAxis] : []);
                        const seriesList = Array.isArray(prevOpt.series) ? prevOpt.series : [];

                        // Für den PDF-Export temporär auf kontrastreiche Druckfarben (Light Mode) umschalten
                        instance.setOption({
                            animation: false,
                            textStyle: { color: '#0f172a' },
                            legend: { textStyle: { color: '#334155' } },
                            xAxis: xAxes.map(() => ({
                                axisLabel: { color: '#334155' },
                                axisLine: { lineStyle: { color: '#cbd5e1' } },
                                splitLine: { lineStyle: { color: '#e2e8f0' } }
                            })),
                            yAxis: yAxes.map(() => ({
                                axisLabel: { color: '#334155' },
                                axisLine: { lineStyle: { color: '#cbd5e1' } },
                                splitLine: { lineStyle: { color: '#e2e8f0' } }
                            })),
                            series: seriesList.map(s => s.type === 'pie' ? {
                                label: { color: '#0f172a' },
                                itemStyle: { borderColor: '#ffffff' }
                            } : {})
                        });

                        const img = instance.getDataURL({ type: 'png', pixelRatio: 2.5, backgroundColor: '#ffffff' });
                        const titleText = this._findChartTitle(div, defaultChartTitle);
                        chartsData.push({ title: titleText, image: img, fit: [720, 320] });

                        // Ursprüngliches Theme wiederherstellen
                        instance.setOption(prevOpt, true);
                    } catch (e) {}
                }
            });
            this._applyTheme(this.isDarkMode());
        }

        // Nur noch eigenständige Chart.js-Canvases erfassen, die NICHT bereits zu ECharts gehören
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
            if (capturedCanvases.has(canvas) || canvas.closest('div[_echarts_instance_]')) return;
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(canvas, 0, 0);

                const titleText = this._findChartTitle(canvas, defaultChartTitle);
                chartsData.push({
                    title: titleText,
                    image: tempCanvas.toDataURL('image/png', 1.0),
                    fit: [720, 320]
                });
            } catch (e) {}
        });
        return chartsData;
    },

    exportPdfReport: async function(config) {
        config = config || {};
        const domKpis = this.extractKpisFromDom();
        const defaultColors = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4'];

        let finalKpis = config.kpis;
        if (!finalKpis || !Array.isArray(finalKpis) || finalKpis.length === 0) {
            finalKpis = domKpis;
        } else {
            // Fehlende Sub-Zeilen & Farben automatisch aus dem DOM ergänzen
            finalKpis = finalKpis.map((k, idx) => ({
                ...k,
                sub: k.sub !== undefined ? k.sub : (domKpis[idx]?.sub || ''),
                color: k.color || domKpis[idx]?.color || defaultColors[idx % defaultColors.length]
            }));
        }

        let finalParams = config.parameters || config.params;
        if (!finalParams || !Array.isArray(finalParams) || finalParams.length === 0) {
            finalParams = this.extractParametersFromDom();
        }

        let charts = config.chartsData;
        if (!charts || charts.length === 0) charts = await this.captureAllCharts();

        const locale = this.getLocale();
        const exportPayload = {
            title: config.title || this.t('portfolioReport'),
            subtitle: config.subtitle || (this.t('generatedOn') + new Date().toLocaleDateString(locale)),
            kpis: finalKpis,
            parameters: finalParams,
            chartsData: charts,
            tableHeaders: config.tableHeaders || [],
            tableBody: config.tableBody || [],
            colWidthsPct: config.colWidthsPct || null,
            colAligns: config.colAligns || null,
            data: this._getData()
        };

        try {
            const engine = window.PdfToolkit || window.parent?.PdfToolkit || window.PdfExportEngine || window.parent?.PdfExportEngine;
            if (engine && typeof engine.exportReport === 'function') {
                await engine.exportReport(exportPayload);
                return;
            }
        } catch (e) {
            console.warn("[FinSPA_API] Direkter Engine-Aufruf fehlgeschlagen:", e);
        }

        if (window.parent && typeof window.parent.postMessage === 'function') {
            window.parent.postMessage({ type: 'FINSPA_PDF_EXPORT', config: exportPayload }, '*');
        }
    }
};

// Initiale Theme-Synchronisation & Live-Observer auf das Elternfenster
(function initFinSpaThemeSync() {
    const syncNow = () => {
        if (window.FinSPA_API) {
            window.FinSPA_API._applyTheme(window.FinSPA_API.isDarkMode());
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncNow);
    } else {
        syncNow();
    }
    try {
        if (window.parent && window.parent.document && window.parent.document.documentElement) {
            const obs = new MutationObserver(() => syncNow());
            obs.observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
    } catch (e) {}
    window.addEventListener('message', (ev) => {
        if (ev.data && ev.data.type === 'FINSPA_SET_THEME') {
            window.__finspaForceDark = Boolean(ev.data.isDark);
            syncNow();
        }
        if (ev.data && ev.data.type === 'TRIGGER_PLUGIN_PDF' && window.FinSPA_API) {
            const pdfBtn = document.getElementById('pdfBtn') || document.querySelector('[data-pdf-export]');
            if (pdfBtn) pdfBtn.click();
            else window.FinSPA_API.exportPdfReport({});
        }
    });
})();

window.PdfToolkit = window.parent?.PdfToolkit || window.PdfToolkit;
window.PdfExportEngine = window.PdfToolkit || window.parent?.PdfExportEngine;
<\/script>
`;

if (typeof window !== 'undefined') {
    window.FinSpaApiInject = { getFinSpaApiScript };
    window.getFinSpaApiScript = getFinSpaApiScript;
}
module.exports = { getFinSpaApiScript };