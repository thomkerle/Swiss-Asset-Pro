/**
 * @file FinSpaApiInject.js
 * @description Exportiert die FinSPA_API als String für die Injektion in iFrames.
 */

const getFinSpaApiScript = () => `
<script>
const FinSPA_API = {
    _getData: function() { 
        return window.finspaData || { banks: [], budget: {}, settings: {} }; 
    },

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

    getTotalWealth: function() {
        const assets = this.getAllAssets();
        return assets.reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getTotalLiquidWealth: function() {
        const liquidAssets = this.getLiquidAssets();
        return liquidAssets.reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getWealthDistributionByClass: function() {
        const data = this._getData();
        const assets = this.getAllAssets();
        const distribution = {};
        
        const classMap = {};
        if (data.settings && data.settings.assetClasses) {
            data.settings.assetClasses.forEach(ac => {
                classMap[ac.id] = ac.name;
            });
        }

        assets.forEach(asset => {
            const val = this.getLatestBalanceValue(asset);
            const acId = asset.assetClass || 'unknown';
            const acName = classMap[acId] || acId; 
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

    getAllBookings: function() {
        const assets = this.getAllAssets();
        return assets.flatMap(asset => {
            return (asset.bookings || []).map(booking => ({
                ...booking,
                assetName: asset.name,
                bankName: asset.bankName,
                assetClass: asset.assetClass
            }));
        });
    },

    getTotalFeesPaid: function() {
        const bookings = this.getAllBookings();
        return bookings
            .filter(b => b.type === 'Gebühr')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    getTotalDividendsReceived: function() {
        const bookings = this.getAllBookings();
        return bookings
            .filter(b => b.type === 'Einzahlung' && b.subCategory === 'Dividenden')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    _normalizeToMonthly: function(items) {
        if (!items) return 0;
        return items.reduce((sum, item) => {
            if (item.frequency === 'monthly') return sum + item.amount;
            if (item.frequency === 'yearly') return sum + (item.amount / 12);
            return sum;
        }, 0);
    },

    getMonthlyIncome: function() {
        const data = this._getData();
        return this._normalizeToMonthly(data.budget?.incomeSources);
    },

    getMonthlyFixedCosts: function() {
        const data = this._getData();
        const expenses = this._normalizeToMonthly(data.budget?.expenses);
        const subs = this._normalizeToMonthly(data.budget?.subscriptions);
        return expenses + subs;
    },

    getMonthlyCashflowHistory: function() {
        const bookings = this.getAllBookings();
        const cashflowMap = {};

        bookings.forEach(b => {
            if (!b.date) return;
            const month = b.date.substring(0, 7); 
            if (!cashflowMap[month]) {
                cashflowMap[month] = { month: month, income: 0, expenses: 0, net: 0 };
            }
            
            const amount = b.amount * (b.bookingExchangeRate || 1);
            
            if (['Einzahlung', 'Dividende', 'Verkauf'].includes(b.type)) {
                cashflowMap[month].income += amount;
            } else if (['Auszahlung', 'Gebühr', 'Kauf', 'Zinszahlung', 'Abzahlung'].includes(b.type)) {
                cashflowMap[month].expenses += amount;
            }
        });

        const sortedMonths = Object.keys(cashflowMap).sort();
        
        if (sortedMonths.length === 0) {
            const currentMonth = new Date().toISOString().substring(0, 7);
            const structuralIncome = this.getMonthlyIncome();
            const structuralExpenses = this.getMonthlyFixedCosts();
            return [{
                month: currentMonth,
                income: structuralIncome,
                expenses: structuralExpenses,
                net: structuralIncome - structuralExpenses
            }];
        }

        return sortedMonths.map(m => {
            cashflowMap[m].net = cashflowMap[m].income - cashflowMap[m].expenses;
            return cashflowMap[m];
        });
    },

    getFreeMonthlyBuffer: function() {
        return this.getMonthlyIncome() - this.getMonthlyFixedCosts();
    },

    getSavingsRate: function() {
        const data = this._getData();
        const income = this.getMonthlyIncome();
        if (income === 0) return 0;
        const savingsExpenses = (data.budget?.expenses || []).filter(e => e.ruleCategory === 'savings');
        const monthlySavings = this._normalizeToMonthly(savingsExpenses);
        return (monthlySavings / income) * 100;
    },

    getFireProgress: function() {
        const data = this._getData();
        const currentWealth = this.getTotalWealth();
        const targetWealth = data.goals?.fire?.target || 0;
        if (targetWealth === 0) return 100;
        return {
            current: currentWealth,
            target: targetWealth,
            percentage: Math.min((currentWealth / targetWealth) * 100, 100)
        };
    },

    PDF: {
        exportDashboard: async function(config) {
            if (!window.PdfExportEngine) return;
            
            const tableData = (config.tables && config.tables.length > 0) ? config.tables[0] : { headers: [], rows: [] };
            
            await window.PdfExportEngine.exportReport({
                title: config.title || 'Export',
                subtitle: config.subtitle || '',
                tableHeaders: tableData.headers || [],
                tableBody: tableData.rows || [],
                chartBase64: null
            });
        }
    }
};            
</script>
`;

module.exports = { getFinSpaApiScript };