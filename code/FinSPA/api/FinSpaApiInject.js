/**
 * @file FinSpaApiInject.js
 * @description Vollständige FinSPA_API inkl. 4-Sprachen-Lokalisierung (DE/EN/FR/IT), 
 * Sandbox-Szenario-Engine, Budget-Methoden, synchronisierter DataEngine-Logik und PDF-Bridge.
 */

const getFinSpaApiScript = (activeLang = 'de') => `
<script>
window.__finspaLang = "${activeLang}";

window.FinSPA_API = {
    _getData: function() { 
        return window.finspaData || window.parent?.finspaData || { banks: [], budget: {}, settings: {} }; 
    },

    // --- 4-Sprachen Lokalisierung (DE, EN, FR, IT) ---
    getLanguage: function() {
        const lang = window.__finspaLang || window.parent?.__finspaLang || this._getData()?.settings?.language || 'de';
        return ['de', 'en', 'fr', 'it'].includes(lang) ? lang : 'de';
    },

    formatCurrency: function(val, cur, customLang) {
        const num = Math.round(Number(val || 0));
        const currency = cur || this._getData()?.settings?.baseCurrency || 'CHF';
        const lang = customLang || this.getLanguage();
        const localeMap = { de: 'de-CH', en: 'en-US', fr: 'fr-CH', it: 'it-CH' };
        try {
            return new Intl.NumberFormat(localeMap[lang] || 'de-CH', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num);
        } catch (e) {
            return currency + ' ' + num.toLocaleString('de-CH');
        }
    },

    // --- Helper (synchron mit DataEngine) ---
    _isSecurity: function(assetClass) {
        return ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes((assetClass || '').toLowerCase());
    },
    _parseRate: function(val) {
        return parseFloat(String(val || '1').replace(',', '.'));
    },
    _getTodayStr: function() {
        return new Date().toISOString().split('T')[0];
    },

    _getBookingFlow: function(booking) {
        let amt = Number(booking.amount || 0);
        const type = String(booking.type || '').toLowerCase();
        let isPositive = ['einzahlung', 'kauf', 'wertanpassung', 'dividende', 'ausschüttung', 'abzahlung'].includes(type);
        if (type === 'wertanpassung' && amt < 0) {
            isPositive = false;
            amt = Math.abs(amt);
        }
        return { isPositive: isPositive, amount: amt };
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
            classification.type = (isSecurityAsset || !isLiquid) ? 'income' : 'shift';
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

        if (catLower.includes('umbuchung') || catLower.includes('transfer')) {
            classification.type = 'shift';
            return classification;
        }

        if (['einzahlung', 'verkauf'].includes(rawType)) classification.type = 'income';
        else if (['auszahlung', 'kauf', 'abzahlung', 'gebühr'].includes(rawType)) classification.type = 'expense';

        return classification;
    },

    // --- Assets & Navigation ---
    getAllAssets: function(customData) {
        const data = customData || this._getData();
        const assets = [];
        function traverse(node, currentBank) {
            let bankName = currentBank;
            if (node.type === 'bank') bankName = node.name;
            if (node.type === 'asset' && !node.isArchived) {
                assets.push({ ...node, bankName: bankName });
            }
            if (node.children) node.children.forEach(child => traverse(child, bankName));
        }
        (data.banks || []).forEach(bank => traverse(bank, 'Unbekannt'));
        return assets;
    },

    getLiquidAssets: function(customData) {
        return this.getAllAssets(customData).filter(a => a.isLiquid === true);
    },

    getAssetsByBank: function(bankName, customData) {
        return this.getAllAssets(customData).filter(a => a.bankName === bankName);
    },

    getAssetsByClass: function(assetClass, customData) {
        return this.getAllAssets(customData).filter(a => a.assetClass === assetClass);
    },

    // --- Wertermittlung ---
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
        if (targetDate >= this._getTodayStr() && Number(asset.price) > 0) return Number(asset.price);
        let p = 0;
        if (asset.bookings) {
            const sorted = [...asset.bookings].sort((a,b) => new Date(a.date) - new Date(b.date));
            const pastBookings = sorted.filter(b => b.date <= targetDate && Number(b.price) > 0);
            if (pastBookings.length > 0) p = Number(pastBookings[pastBookings.length - 1].price);
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

        return rawValue * this._parseRate(applicableRate || 1);
    },

    getInvestedCapitalAtDate: function(asset, targetDate) {
        let investedRaw = 0;
        const ac = (asset.assetClass || '').toLowerCase();
        const isFluctuating = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes(ac);
        
        if (isFluctuating) {
            let allEntries = [
                ...(asset.balances || []).map(b => ({...b, _isBal: true})),
                ...(asset.bookings || [])
            ].filter(e => e.date <= targetDate).sort((a,b) => new Date(a.date) - new Date(b.date));

            let hasInitial = false;
            allEntries.forEach(bk => {
                if (bk._isBal) {
                    if (!hasInitial && investedRaw === 0) {
                         investedRaw = Number(bk.amount || 0);
                         hasInitial = true;
                    }
                } else {
                    const bkType = String(bk.type).toLowerCase();
                    if (['kauf', 'einzahlung'].includes(bkType) && String(bk.subCategory || '').toLowerCase() !== 'zinsen') {
                        investedRaw += Number(bk.amount || 0);
                        hasInitial = true;
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
        return investedRaw * this._parseRate(asset.exchangeRate || 1);
    },

    getLatestBalanceValue: function(asset, customAssets) {
        return this.getAssetValueAtDate(asset, this._getTodayStr(), customAssets || this.getAllAssets());
    },

    getTotalWealth: function(customData) {
        const today = this._getTodayStr();
        const allAssets = this.getAllAssets(customData);
        return allAssets.reduce((sum, asset) => sum + this.getAssetValueAtDate(asset, today, allAssets), 0);
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
        
        if (data.settings && data.settings.assetClasses) {
            data.settings.assetClasses.forEach(ac => classMap[ac.id] = ac.name);
        }
        
        allAssets.forEach(asset => {
            const val = this.getAssetValueAtDate(asset, today, allAssets);
            const acName = classMap[asset.assetClass] || asset.assetClass || 'Sonstige';
            distribution[acName] = (distribution[acName] || 0) + val;
        });
        return distribution;
    },

    getWealthByBank: function(customData) {
        const allAssets = this.getAllAssets(customData);
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

    getHistoricalWealth: function(startDate, endDate, customData) {
        const allAssets = this.getAllAssets(customData);
        const s = new Date(startDate || '2020-01-01');
        const e = new Date(endDate || this._getTodayStr());
        const points = [];

        let curr = new Date(s.getFullYear(), s.getMonth(), 1);
        while (curr <= e) {
            const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
            const dStr = lastDay.toISOString().split('T')[0];
            
            let total = 0;
            let liquid = 0;
            allAssets.forEach(a => {
                const val = this.getAssetValueAtDate(a, dStr, allAssets);
                total += val;
                if (this._isAssetLiquid(a)) liquid += val;
            });

            points.push({ date: dStr, total: total, liquid: liquid });
            curr.setMonth(curr.getMonth() + 1);
        }
        return points;
    },

    getAllBookings: function(customData) {
        return this.getAllAssets(customData).flatMap(asset => 
            (asset.bookings || []).map(booking => ({
                ...booking,
                assetName: asset.name,
                bankName: asset.bankName,
                assetClass: asset.assetClass,
                assetExchangeRate: asset.exchangeRate
            }))
        );
    },

    getNormalizedBookings: function(customData) {
        const assets = this.getAllAssets(customData);
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

    getTotalFeesPaid: function(customData) {
        return this.getAllBookings(customData)
            .filter(b => String(b.type || '').toLowerCase() === 'gebühr')
            .reduce((sum, b) => {
                const appliedRate = this._parseRate(b.bookingExchangeRate || b.assetExchangeRate || 1);
                return sum + (Number(b.amount || 0) * appliedRate);
            }, 0);
    },

    getTotalDividendsReceived: function(customData) {
        return this.getAllBookings(customData)
            .filter(b => {
                const rawType = String(b.type || '').toLowerCase();
                const catStr = String(b.subCategory || b.category || '').toLowerCase();
                return ['dividende', 'ausschüttung'].includes(rawType) || catStr.includes('dividende');
            })
            .reduce((sum, b) => {
                const appliedRate = this._parseRate(b.bookingExchangeRate || b.assetExchangeRate || 1);
                return sum + (Number(b.amount || 0) * appliedRate);
            }, 0);
    },

    getMonthlyCashflowHistory: function(customData) {
        const bookings = this.getAllBookings(customData);
        const cashflowMap = {};
        bookings.forEach(b => {
            if (!b.date) return;
            const month = b.date.substring(0, 7); 
            if (!cashflowMap[month]) cashflowMap[month] = { month: month, income: 0, expenses: 0, net: 0 };
            
            const appliedRate = this._parseRate(b.bookingExchangeRate || b.assetExchangeRate || 1);
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

    getMonthlyIncome: function(customData) {
        const d = customData || this._getData();
        return this._normalizeToMonthly(d.budget?.incomeSources);
    },

    getMonthlyFixedCosts: function(customData) {
        const d = customData || this._getData();
        return this._normalizeToMonthly(d.budget?.expenses) + this._normalizeToMonthly(d.budget?.subscriptions);
    },

    getBudgetOverview: function(customData) {
        const income = this.getMonthlyIncome(customData);
        const costs = this.getMonthlyFixedCosts(customData);
        return {
            income: income,
            costs: costs,
            disposable: income - costs,
            savingsRate: income > 0 ? ((income - costs) / income) * 100 : 0
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

    getFireProgress: function(customData) {
        const d = customData || this._getData();
        const currentWealth = this.getTotalWealth(d);
        const targetWealth = d.goals?.fire?.target || 0;
        return {
            current: currentWealth,
            target: targetWealth,
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
            let simBank = (baseData.banks || []).find(b => b.name === 'Simulation' || b.id === 'bank_sim');
            if (!simBank) {
                simBank = { id: 'bank_sim', name: 'Simulation (Hypothetisch)', type: 'bank', children: [] };
                baseData.banks.push(simBank);
            }
            scenarioConfig.addAssets.forEach(a => {
                simBank.children.push({
                    id: a.id || 'mock_' + Math.random().toString(36).substr(2, 9),
                    name: a.name || 'Simuliertes Asset',
                    type: 'asset',
                    assetClass: a.assetClass || 'stock',
                    currency: a.currency || 'CHF',
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
                function injectBooking(nodes) {
                    nodes.forEach(n => {
                        if (n.type === 'asset' && n.id === bk.assetId) {
                            n.bookings = n.bookings || [];
                            n.bookings.push({
                                id: 'sim_bk_' + Math.random().toString(36).substr(2, 9),
                                date: bk.date || new Date().toISOString().split('T')[0],
                                type: bk.type || 'Kauf',
                                amount: bk.amount || 0,
                                subCategory: bk.subCategory || 'Szenario',
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
                    name: 'Simulierte Ausgaben',
                    amount: scenarioConfig.budgetDelta.monthlyExpenses,
                    frequency: 'monthly'
                });
            }
            if (scenarioConfig.budgetDelta.monthlyIncome) {
                baseData.budget.incomeSources.push({
                    name: 'Simulierte Einnahmen',
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

    // --- DOM-Extraktion & PDF-Export ---
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
        const summarySections = document.querySelectorAll('[data-summary], [data-simulation-summary], .simulation-summary');
        if (summarySections.length > 0) {
            summarySections.forEach(sec => {
                const title = sec.querySelector('h3, h4, .font-bold')?.innerText?.trim() || 'Simulationsparameter';
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
                        const lbl = document.querySelector(\`label[for="\${inp.id}"]\`);
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

                    if (label.toLowerCase().includes('rendite') || label.toLowerCase().includes('zins')) {
                        if (!val.includes('%')) val = val + ' %';
                    }
                    if (label && val) groupItems.push({ label: label.substring(0, 30), value: String(val).substring(0, 25) });
                });
                if (groupItems.length > 0) {
                    groups.push({ group: (heading || 'Allgemeine Parameter').substring(0, 35), items: groupItems });
                }
            }
        });
        return groups.slice(0, 3);
    },

    captureAllCharts: async function() {
        const chartsData = [];
        if (window.echarts) {
            const echartsDivs = document.querySelectorAll('div[_echarts_instance_], .universal-chart-wrapper > div');
            echartsDivs.forEach((div) => {
                const instance = window.echarts.getInstanceByDom(div);
                if (instance) {
                    try {
                        const img = instance.getDataURL({ type: 'png', pixelRatio: 2.5, backgroundColor: '#ffffff' });
                        const titleEl = div.closest('.chart-card, .classic-card, .card-dark, div')?.querySelector('h3, h4');
                        chartsData.push({ title: titleEl ? titleEl.innerText.trim() : 'Vermögensentwicklung', image: img, fit: [720, 320] });
                    } catch (e) {}
                }
            });
        }

        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(canvas, 0, 0);

                const titleEl = canvas.closest('.chart-card, .classic-card, .card-dark, div')?.querySelector('h3, h4');
                chartsData.push({
                    title: titleEl ? titleEl.innerText.trim() : 'Vermögensentwicklung',
                    image: tempCanvas.toDataURL('image/png', 1.0),
                    fit: [720, 320]
                });
            } catch (e) {}
        });
        return chartsData;
    },

    exportPdfReport: async function(config) {
        config = config || {};
        let finalKpis = config.kpis;
        if (!finalKpis || !Array.isArray(finalKpis) || finalKpis.length === 0) finalKpis = this.extractKpisFromDom();

        let finalParams = config.parameters || config.params;
        if (!finalParams || !Array.isArray(finalParams) || finalParams.length === 0) finalParams = this.extractParametersFromDom();

        let charts = config.chartsData;
        if (!charts || charts.length === 0) charts = await this.captureAllCharts();

        const exportPayload = {
            title: config.title || 'Portfolio Report',
            subtitle: config.subtitle || ('Generiert per ' + new Date().toLocaleDateString('de-CH')),
            kpis: finalKpis,
            parameters: finalParams,
            chartsData: charts,
            tableHeaders: config.tableHeaders || [],
            tableBody: config.tableBody || [],
            colWidthsPct: config.colWidthsPct || [0.14, 0.14, 0.18, 0.18, 0.20, 0.16],
            colAligns: config.colAligns || ['left', 'center', 'right', 'right', 'right', 'right'],
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
        } else {
            alert("PDF-Engine ist nicht verfügbar.");
        }
    }
};

window.PdfToolkit = window.parent?.PdfToolkit || window.PdfToolkit;
window.PdfExportEngine = window.PdfToolkit || window.parent?.PdfExportEngine;
</script>
`;

module.exports = { getFinSpaApiScript };