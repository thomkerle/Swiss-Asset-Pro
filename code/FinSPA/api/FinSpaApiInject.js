/**
 * @file FinSpaApiInject.js
 * @description Vollständige FinSPA_API inkl. Budget-Methoden.
 */

const getFinSpaApiScript = () => `
<script>
// Global an window binden für das iFrame
window.FinSPA_API = {
    _getData: function() { 
        return window.finspaData || { banks: [], budget: {}, settings: {} }; 
    },

    // --- Assets & Navigation ---
    getAllAssets: function() {
        const data = this._getData();
        const assets = [];
        function traverse(node, currentBank) {
            let bankName = currentBank;
            if (node.type === 'bank') bankName = node.name;
            if (node.type === 'asset') {
                assets.push({ ...node, bankName: bankName });
            }
            if (node.children) {
                node.children.forEach(child => traverse(child, bankName));
            }
        }
        (data.banks || []).forEach(bank => traverse(bank, 'Unbekannt'));
        return assets;
    },

    getLiquidAssets: function() {
        return this.getAllAssets().filter(a => a.isLiquid === true);
    },

    getAssetsByBank: function(bankName) {
        return this.getAllAssets().filter(a => a.bankName === bankName);
    },

    getAssetsByClass: function(assetClass) {
        return this.getAllAssets().filter(a => a.assetClass === assetClass);
    },

    getLatestBalanceValue: function(asset) {
        if (!asset || !asset.balances || asset.balances.length === 0) return 0;
        const latest = asset.balances.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        }, asset.balances[0]);
        const rate = latest.bookingExchangeRate || asset.exchangeRate || 1;
        return latest.amount * rate;
    },

    // --- Wealth Calculations ---
    getTotalWealth: function() {
        return this.getAllAssets().reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getTotalLiquidWealth: function() {
        return this.getLiquidAssets().reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getWealthDistributionByClass: function() {
        const data = this._getData();
        const assets = this.getAllAssets();
        const distribution = {};
        const classMap = {};
        if (data.settings && data.settings.assetClasses) {
            data.settings.assetClasses.forEach(ac => classMap[ac.id] = ac.name);
        }
        assets.forEach(asset => {
            const val = this.getLatestBalanceValue(asset);
            const acName = classMap[asset.assetClass] || asset.assetClass || 'unknown';
            distribution[acName] = (distribution[acName] || 0) + val;
        });
        return distribution;
    },

    getWealthByBank: function() {
        const assets = this.getAllAssets();
        const bankTotals = {};
        assets.forEach(asset => {
            const bName = asset.bankName || 'Unbekannt';
            const val = this.getLatestBalanceValue(asset);
            bankTotals[bName] = (bankTotals[bName] || 0) + val;
        });
        return Object.keys(bankTotals).map(name => ({
            bankName: name,
            totalValue: bankTotals[name]
        }));
    },

    // --- Bookings & Transaction Logic ---
    getAllBookings: function() {
        return this.getAllAssets().flatMap(asset => 
            (asset.bookings || []).map(booking => ({
                ...booking,
                assetName: asset.name,
                bankName: asset.bankName,
                assetClass: asset.assetClass
            }))
        );
    },

    getTotalFeesPaid: function() {
        return this.getAllBookings()
            .filter(b => b.type === 'Gebühr')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    getTotalDividendsReceived: function() {
        return this.getAllBookings()
            .filter(b => b.type === 'Einzahlung' && b.subCategory === 'Dividenden')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    getMonthlyCashflowHistory: function() {
        const bookings = this.getAllBookings();
        const cashflowMap = {};
        bookings.forEach(b => {
            if (!b.date) return;
            const month = b.date.substring(0, 7); 
            if (!cashflowMap[month]) cashflowMap[month] = { month: month, income: 0, expenses: 0, net: 0 };
            const amount = b.amount * (b.bookingExchangeRate || 1);
            if (['Einzahlung', 'Dividende', 'Verkauf'].includes(b.type)) cashflowMap[month].income += amount;
            else if (['Auszahlung', 'Gebühr', 'Kauf', 'Zinszahlung', 'Abzahlung'].includes(b.type)) cashflowMap[month].expenses += amount;
        });
        return Object.keys(cashflowMap).sort().map(m => {
            cashflowMap[m].net = cashflowMap[m].income - cashflowMap[m].expenses;
            return cashflowMap[m];
        });
    },

    // --- Budget API ---
    _normalizeToMonthly: function(items) {
        if (!items || !Array.isArray(items)) return 0;
        return items.reduce((sum, item) => {
            const amount = parseFloat(item.amount) || 0;
            return item.frequency === 'yearly' ? sum + (amount / 12) : sum + amount;
        }, 0);
    },

    getMonthlyIncome: function() {
        return this._normalizeToMonthly(this._getData().budget?.incomeSources);
    },

    getMonthlyFixedCosts: function() {
        const data = this._getData();
        return this._normalizeToMonthly(data.budget?.expenses) + this._normalizeToMonthly(data.budget?.subscriptions);
    },

    getBudgetOverview: function() {
        const income = this.getMonthlyIncome();
        const costs = this.getMonthlyFixedCosts();
        return {
            income: income,
            costs: costs,
            disposable: income - costs,
            savingsRate: income > 0 ? ((income - costs) / income) * 100 : 0
        };
    },

    getExpensesByCategory: function(categoryType) {
        const data = this._getData();
        const allItems = [...(data.budget?.expenses || []), ...(data.budget?.subscriptions || [])];
        return this._normalizeToMonthly(allItems.filter(i => i.ruleCategory === categoryType));
    },

    getFreeMonthlyBuffer: function() {
        return this.getMonthlyIncome() - this.getMonthlyFixedCosts();
    },

    getSavingsRate: function() {
        return this.getBudgetOverview().savingsRate;
    },

    getFireProgress: function() {
        const data = this._getData();
        const currentWealth = this.getTotalWealth();
        const targetWealth = data.goals?.fire?.target || 0;
        return {
            current: currentWealth,
            target: targetWealth,
            percentage: targetWealth > 0 ? Math.min((currentWealth / targetWealth) * 100, 100) : 0
        };
    },

    // --- PDF Export ---
    PDF: {
      exportDashboard: async function(config) {
            if (!window.PdfExportEngine) {
                alert("PDF-Engine ist noch nicht geladen oder nicht verfügbar.");
                return;
            }

            // Automatisches Extrahieren ALLER Charts auf dem Dashboard
            let chartsBase64 = [];
            const canvases = document.querySelectorAll('canvas');
            
            canvases.forEach(canvas => {
                // Weißen Hintergrund erzwingen, da transparente PNGs in PDFs schwarz werden können
                const tempCtx = canvas.getContext('2d');
                const origComposite = tempCtx.globalCompositeOperation;
                tempCtx.globalCompositeOperation = 'destination-over';
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                chartsBase64.push(canvas.toDataURL('image/png', 1.0));
                tempCtx.globalCompositeOperation = origComposite; // Reset
            });

            await window.PdfExportEngine.exportReport({
                title: config.title || 'Dashboard Export',
                subtitle: config.subtitle || '',
                tableHeaders: config.tables?.[0]?.headers || [],
                tableBody: config.tables?.[0]?.rows || [],
                chartsBase64: chartsBase64 // <-- NEU: Array mit allen Charts
            });
        }
    } // <-- Ende des PDF-Objekts (nur Klammer, KEIN Semikolon)
}; // <-- Ende des FinSPA_API-Objekts (mit Semikolon)

// Fallback, damit die KI die Methoden auch ohne 'window.' aufrufen kann
const FinSPA_API = window.FinSPA_API;
</script>
`;

module.exports = { getFinSpaApiScript };