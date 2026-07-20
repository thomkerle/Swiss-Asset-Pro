/**
 * @file FinSpaApiInject.js
 * @description Vollständige FinSPA_API inkl. Budget-Methoden und synchronisierter DataEngine Logik.
 */

const getFinSpaApiScript = () => `
<script>
// Global an window binden für das iFrame
window.FinSPA_API = {
    _getData: function() { 
        return window.finspaData || { banks: [], budget: {}, settings: {} }; 
    },

    // --- Helper (synchron mit DataEngine) ---
    _isSecurity: function(assetClass) {
        return ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes((assetClass || '').toLowerCase());
    },
    _parseRate: function(val) {
        return parseFloat(String(val || '1').replace(',', '.'));
    },
    _getTodayStr: function() {
        return new Date().toISOString().split('T')[0];
    },
    
    // Zentrale Klassifizierung von Buchungsflüssen (In/Out) - Synchron mit DataEngine
    _getBookingFlow: function(booking) {
        let amt = Number(booking.amount || 0);
        const type = String(booking.type || '').toLowerCase();
        
        let isPositive = ['einzahlung', 'kauf', 'wertanpassung', 'dividende', 'ausschüttung', 'abzahlung'].includes(type);
        
        // Sonderfall: Negative Wertanpassung wird als Abfluss/Wertminderung gewertet
        if (type === 'wertanpassung' && amt < 0) {
            isPositive = false;
            amt = Math.abs(amt);
        }

        return {
            isPositive: isPositive,
            amount: amt
        };
    },

    _isAssetLiquid: function(asset) {
        if (asset.hasOwnProperty('isLiquid')) return asset.isLiquid;
        const ac = (asset.assetClass || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const isPension = ac.includes('pension') || name.includes('vorsorge') || name.includes('3a');
        
        if (['stock', 'fund', 'managed_fund', 'crypto', 'realestate', 'mortgage'].includes(ac)) return false;
        if (isPension) return false;
        
        return true; 
    },

    _classifyBooking: function(bk, asset) {
        const isLiquid = this._isAssetLiquid(asset);
        
        const rawCategory = bk.normCategory || bk.category || bk.subCategory || '';
        const catLower = rawCategory.toLowerCase();
        const rawType = String(bk.type || bk.normType || '').toLowerCase();
        
        let classification = {
            type: 'neutral', 
            category: rawCategory || 'Unkategorisiert',
            isLiquid: isLiquid
        };

        if (['dividende', 'ausschüttung'].includes(rawType) || catLower.includes('dividende')) {
            const ac = (asset.assetClass || '').toLowerCase();
            const isSecurityAsset = ['stock', 'fund', 'managed_fund', 'pension_fund', 'pension_3a_fund', 'pension_3a_managed'].includes(ac);
            
            if (isSecurityAsset || !isLiquid) {
                classification.type = 'income';
            } else {
                classification.type = 'shift'; 
            }
            classification.category = 'Dividenden'; 
            return classification;
        }

        if (['zinszahlung'].includes(rawType) || catLower.includes('zinsen')) {
            classification.type = 'income';
            classification.category = 'Zinsen'; 
            return classification;
        }

        if (catLower.includes('miete')) {
            classification.type = 'income';
            classification.category = 'Mieteinnahmen'; 
            return classification;
        }

        if (!isLiquid) {
            classification.type = 'ignore';
            return classification;
        }

        const isTransfer = catLower.includes('umbuchung') || catLower.includes('transfer');
        if (isTransfer) {
            classification.type = 'shift';
            return classification;
        }

        if (['einzahlung', 'verkauf'].includes(rawType)) {
            classification.type = 'income';
        } else if (['auszahlung', 'kauf', 'abzahlung', 'gebühr'].includes(rawType)) {
            classification.type = 'expense';
        }

        return classification;
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

    // --- Neue dynamische Wertermittlung (aus DataEngine) ---
    getAssetSharesAtDate: function(asset, targetDate) {
        if (!this._isSecurity(asset.assetClass)) return 0;
        let sh = 0;
        if (asset.bookings) {
            asset.bookings.forEach(b => {
                if (b.date <= targetDate) {
                    const bType = String(b.type || '').toLowerCase();
                    if (['kauf', 'einzahlung', 'dividende', 'ausschüttung'].includes(bType) && b.shares) sh += Number(b.shares);
                    if (['verkauf', 'auszahlung'].includes(bType) && b.shares) sh -= Number(b.shares);
                }
            });
        }
        return sh > 0 ? sh : (Number(asset.shares) || 0);
    },

    getAssetPriceAtDate: function(asset, targetDate) {
        if (!this._isSecurity(asset.assetClass)) return 1;
        
        if (targetDate >= this._getTodayStr() && Number(asset.price) > 0) {
            return Number(asset.price);
        }
        
        let p = 0;
        if (asset.bookings) {
            const sorted = [...asset.bookings].sort((a,b) => new Date(a.date) - new Date(b.date));
            const pastBookings = sorted.filter(b => b.date <= targetDate && Number(b.price) > 0);
            if (pastBookings.length > 0) {
                p = Number(pastBookings[pastBookings.length - 1].price);
            }
        }
        return p > 0 ? p : (Number(asset.price) || 0);
    },

    getAssetRawValueAtDate: function(asset, targetDate) {
        if (this._isSecurity(asset.assetClass)) {
            const sh = this.getAssetSharesAtDate(asset, targetDate);
            const pr = this.getAssetPriceAtDate(asset, targetDate);
            if (sh > 0 && pr > 0) return sh * pr;
        }

        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
        let baseAmount = applicableBalance ? Number(applicableBalance.amount) : 0;
        let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';
        let netBookings = 0;

        if (asset.bookings) {
            asset.bookings.forEach(bk => {
                if (bk.date > baseDate && bk.date <= targetDate) {
                    const flow = this._getBookingFlow(bk);
                    if (flow.isPositive) netBookings += flow.amount;
                    else netBookings -= flow.amount;
                }
            });
        }
        return baseAmount + netBookings;
    },

    getAssetValueAtDate: function(asset, targetDate, allAssets) {
        const rawValue = this.getAssetRawValueAtDate(asset, targetDate);
        
        if (!asset.currency || asset.currency === 'CHF') return rawValue;

        if (targetDate >= this._getTodayStr() && asset.exchangeRate) {
            return rawValue * this._parseRate(asset.exchangeRate);
        }

        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
        let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate ? applicableBalance.bookingExchangeRate : this._parseRate(asset.exchangeRate);
        let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';

        if (asset.bookings) {
            asset.bookings.forEach(bk => {
                if (bk.date > baseDate && bk.date <= targetDate) {
                    if (bk.bookingExchangeRate && bk.bookingExchangeRate !== 1) applicableRate = bk.bookingExchangeRate;
                }
            });
        }

        if (!applicableRate || applicableRate === 1) {
            let latestDate = '1970-01-01';
            const searchAssets = allAssets || this.getAllAssets();
            searchAssets.forEach(otherAsset => {
                if (otherAsset.currency === asset.currency) {
                    if (otherAsset.bookings) {
                        otherAsset.bookings.forEach(b => {
                            if (b.bookingExchangeRate && b.bookingExchangeRate !== 1 && b.date <= targetDate && b.date > latestDate) {
                                applicableRate = b.bookingExchangeRate;
                                latestDate = b.date;
                            }
                        });
                    }
                }
            });
        }

        return rawValue * this._parseRate(applicableRate || 1);
    },

    getInvestedCapitalAtDate: function(asset, targetDate, allAssets) {
        let investedRaw = 0;
        
        const ac = (asset.assetClass || '').toLowerCase();
        const isFluctuating = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes(ac);
        
        if (isFluctuating) {
            let allEntries = [
                ...(asset.balances || []).map(b => ({...b, _isBal: true})),
                ...(asset.bookings || [])
            ].filter(e => e.date <= targetDate).sort((a,b) => new Date(a.date) - new Date(b.date));

            let hasInitialInvested = false;

            allEntries.forEach(bk => {
                if (bk._isBal) {
                    if (!hasInitialInvested && investedRaw === 0) {
                         investedRaw = Number(bk.amount || 0);
                         hasInitialInvested = true;
                    }
                } else {
                    const bkType = String(bk.type).toLowerCase();
                    if (['kauf', 'einzahlung'].includes(bkType) && String(bk.subCategory || '').toLowerCase() !== 'zinsen') {
                        investedRaw += Number(bk.amount || 0);
                        hasInitialInvested = true;
                    }
                    if (['verkauf', 'auszahlung'].includes(bkType)) {
                        investedRaw -= Number(bk.amount || 0);
                    }
                }
            });
        } else {
            let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
            let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
            let baseDate = '1970-01-01';

            if (applicableBalance) {
                investedRaw = applicableBalance.amount;
                baseDate = applicableBalance.date;
            }

            (asset.bookings || []).forEach(bk => {
                const bkType = String(bk.type).toLowerCase();
                const isKauf = bkType === 'kauf';
                const isEinzahlung = bkType === 'einzahlung' && String(bk.subCategory || '').toLowerCase() !== 'zinsen';
                const isAuszahlung = bkType === 'verkauf' || bkType === 'auszahlung';

                if (applicableBalance) {
                    if (bk.date > baseDate && bk.date <= targetDate) {
                        if (isKauf || isEinzahlung) investedRaw += Number(bk.amount);
                        if (isAuszahlung) investedRaw -= Number(bk.amount);
                    }
                } else {
                    if (bk.date <= targetDate) {
                        if (isKauf || isEinzahlung) investedRaw += Number(bk.amount);
                        if (isAuszahlung) investedRaw -= Number(bk.amount);
                    }
                }
            });
        }

        if (!asset.currency || asset.currency === 'CHF') return investedRaw;

        if (targetDate >= this._getTodayStr() && asset.exchangeRate) {
            return investedRaw * this._parseRate(asset.exchangeRate);
        }

        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
        let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate ? applicableBalance.bookingExchangeRate : this._parseRate(asset.exchangeRate);
        let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';

        if (asset.bookings) {
            asset.bookings.forEach(bk => {
                if (bk.date > baseDate && bk.date <= targetDate) {
                    if (bk.bookingExchangeRate && bk.bookingExchangeRate !== 1) applicableRate = bk.bookingExchangeRate;
                }
            });
        }

        if (!applicableRate || applicableRate === 1) {
            let latestDate = '1970-01-01';
            const searchAssets = allAssets || this.getAllAssets();
            searchAssets.forEach(otherAsset => {
                if (otherAsset.currency === asset.currency) {
                    if (otherAsset.bookings) {
                        otherAsset.bookings.forEach(b => {
                            if (b.bookingExchangeRate && b.bookingExchangeRate !== 1 && b.date <= targetDate && b.date > latestDate) {
                                applicableRate = b.bookingExchangeRate;
                                latestDate = b.date;
                            }
                        });
                    }
                }
            });
        }

        return investedRaw * this._parseRate(applicableRate || 1);
    },

    // --- Legacy Kompatibilität für die KI ---
    getLatestBalanceValue: function(asset) {
        return this.getAssetValueAtDate(asset, this._getTodayStr(), this.getAllAssets());
    },

    // --- Wealth Calculations ---
    getTotalWealth: function() {
        const today = this._getTodayStr();
        const allAssets = this.getAllAssets();
        return allAssets.reduce((sum, asset) => sum + this.getAssetValueAtDate(asset, today, allAssets), 0);
    },

    getTotalLiquidWealth: function() {
        const today = this._getTodayStr();
        const allAssets = this.getAllAssets();
        return this.getLiquidAssets().reduce((sum, asset) => sum + this.getAssetValueAtDate(asset, today, allAssets), 0);
    },

    getWealthDistributionByClass: function() {
        const data = this._getData();
        const allAssets = this.getAllAssets();
        const today = this._getTodayStr();
        const distribution = {};
        const classMap = {};
        
        if (data.settings && data.settings.assetClasses) {
            data.settings.assetClasses.forEach(ac => classMap[ac.id] = ac.name);
        }
        
        allAssets.forEach(asset => {
            const val = this.getAssetValueAtDate(asset, today, allAssets);
            const acName = classMap[asset.assetClass] || asset.assetClass || 'unknown';
            distribution[acName] = (distribution[acName] || 0) + val;
        });
        return distribution;
    },

    getWealthByBank: function() {
        const allAssets = this.getAllAssets();
        const today = this._getTodayStr();
        const bankTotals = {};
        
        allAssets.forEach(asset => {
            const bName = asset.bankName || 'Unbekannt';
            const val = this.getAssetValueAtDate(asset, today, allAssets);
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
                assetClass: asset.assetClass,
                assetExchangeRate: asset.exchangeRate // Für FX-Fallback
            }))
        );
    },

    getNormalizedBookings: function() {
        const assets = this.getAllAssets();
        let allBookings = [];
        assets.forEach(asset => {
            (asset.bookings || []).forEach(bk => {
                const classif = this._classifyBooking(bk, asset);
                const bkRate = bk.bookingExchangeRate ? this._parseRate(bk.bookingExchangeRate) : 0;
                const assetRate = this._parseRate(asset.exchangeRate || 1);
                const appliedRate = (bkRate !== 0 && bkRate !== 1) ? bkRate : assetRate;
                
                allBookings.push({
                    ...bk,
                    ...classif, 
                    _baseValue: Number(bk.amount || 0) * appliedRate,
                    assetName: asset.name,
                    bankName: asset.bankName,
                    assetClass: asset.assetClass
                });
            });
        });
        return allBookings;
    },

    getTotalFeesPaid: function() {
        return this.getAllBookings()
            .filter(b => String(b.type || '').toLowerCase() === 'gebühr')
            .reduce((sum, b) => {
                const bkRate = this._parseRate(b.bookingExchangeRate || 0);
                const assetRate = this._parseRate(b.assetExchangeRate || 1);
                const appliedRate = (bkRate !== 0 && bkRate !== 1) ? bkRate : assetRate;
                return sum + (Number(b.amount || 0) * appliedRate);
            }, 0);
    },

    getTotalDividendsReceived: function() {
        return this.getAllBookings()
            .filter(b => {
                const rawType = String(b.type || '').toLowerCase();
                const catStr = String(b.subCategory || b.category || '').toLowerCase();
                return ['dividende', 'ausschüttung'].includes(rawType) || catStr.includes('dividende');
            })
            .reduce((sum, b) => {
                const bkRate = this._parseRate(b.bookingExchangeRate || 0);
                const assetRate = this._parseRate(b.assetExchangeRate || 1);
                const appliedRate = (bkRate !== 0 && bkRate !== 1) ? bkRate : assetRate;
                return sum + (Number(b.amount || 0) * appliedRate);
            }, 0);
    },

    getMonthlyCashflowHistory: function() {
        const bookings = this.getAllBookings();
        const cashflowMap = {};
        bookings.forEach(b => {
            if (!b.date) return;
            const month = b.date.substring(0, 7); 
            if (!cashflowMap[month]) cashflowMap[month] = { month: month, income: 0, expenses: 0, net: 0 };
            
            const bkRate = this._parseRate(b.bookingExchangeRate || 0);
            const assetRate = this._parseRate(b.assetExchangeRate || 1);
            const appliedRate = (bkRate !== 0 && bkRate !== 1) ? bkRate : assetRate;
            
            const amount = Number(b.amount || 0) * appliedRate;
            const type = String(b.type || '').toLowerCase();
            
            if (['einzahlung', 'dividende', 'ausschüttung', 'verkauf'].includes(type)) {
                cashflowMap[month].income += amount;
            } else if (['auszahlung', 'gebühr', 'kauf', 'zinszahlung', 'abzahlung'].includes(type)) {
                cashflowMap[month].expenses += amount;
            }
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
            return String(item.frequency || '').toLowerCase() === 'yearly' ? sum + (amount / 12) : sum + amount;
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

            let chartsBase64 = [];
            const canvases = document.querySelectorAll('canvas');
            
            canvases.forEach(canvas => {
                const tempCtx = canvas.getContext('2d');
                const origComposite = tempCtx.globalCompositeOperation;
                tempCtx.globalCompositeOperation = 'destination-over';
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                chartsBase64.push(canvas.toDataURL('image/png', 1.0));
                tempCtx.globalCompositeOperation = origComposite;
            });

            await window.PdfExportEngine.exportReport({
                title: config.title || 'Dashboard Export',
                subtitle: config.subtitle || '',
                tableHeaders: config.tables?.[0]?.headers || [],
                tableBody: config.tables?.[0]?.rows || [],
                chartsBase64: chartsBase64,
                data: window.FinSPA_API._getData()
            });
        }
    }
};

const FinSPA_API = window.FinSPA_API;
</script>
`;

module.exports = { getFinSpaApiScript };