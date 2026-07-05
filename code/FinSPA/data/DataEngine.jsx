const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultBookingCategories = {
    'Einzahlung': ['Lohn', 'Dividenden', 'Zinsen', 'Verkauf', 'Mieteinnahmen', 'Umbuchung Eingang', 'Sonstiges'],
    'Auszahlung': ['Steuern', 'Gebühren', 'Lebensmittel', 'Telekommunikation', 'Versicherungen', 'Verkehr', 'Umbuchung Ausgang', 'Sonstiges'],
    'Kauf': ['Investition', 'Reinvestition'],
    'Verkauf': ['Liquidation', 'Teilverkauf'],
    'Dividende': ['Ausschüttung'],
    'Wertanpassung': ['Marktbewertung', 'Abschreibung'],
    'Abzahlung': ['Amortisation', 'Sondertilgung'],
    'Zinszahlung': ['Hypothekarzins', 'Sollzins'],
    'Schulderhöhung': ['Aufstockung'],
    'Gebühr': ['Depotgebühr', 'Transaktionsgebühr']
};

const ensureDefaultAssetClasses = (loadedData) => {
    if (!loadedData) return loadedData;
    if (!loadedData.settings) loadedData.settings = {};
    if (!loadedData.settings.assetClasses) loadedData.settings.assetClasses = [];

    const defaultClasses = [
        { id: 'cash', name: 'Konto', description: 'Liquide Mittel und Girokonten' },
        { id: 'fund', name: 'Fonds / ETF', description: 'Investmentfonds und passive ETFs' },
        { id: 'stock', name: 'Aktie', description: 'Direktinvestitionen in Einzelaktien' },
        { id: 'crypto', name: 'Krypto', description: 'Kryptowährungen wie BTC, ETH' },
        { id: 'realestate', name: 'Immobilie', description: 'Liegenschaften, Haus, Wohnung' },
        { id: 'mortgage', name: 'Hypothek', description: 'Hypothekarische Belastungen' },
        { id: 'pension_cash', name: 'Pensionskasse (2. Säule)', description: 'Berufliche Vorsorge (2. Säule) / Pensionsguthaben' },
        { id: 'pension_3a_cash', name: '3a Vorsorgekonto', description: 'Säule 3a Sparkonto (Vorsorgeguthaben Cash)' },
        { id: 'pension_3a_fund', name: '3a Vorsorgefonds', description: 'Säule 3a Wertschriftenlösung (Vorsorgeguthaben Fonds)' },
        { id: 'managed_fund', name: 'Verwaltetes Vermögen', description: 'Robo-Advisor oder Fonds ohne Einzelkurse (z.B. TrueWealth)' },
        { id: 'pension_3a_managed', name: '3a Fonds (Gesamtwert)', description: 'Säule 3a Fondslösung über Gesamtwert (z.B. Viac, frankly)' }
    ];

    defaultClasses.forEach(defClass => {
        const exists = loadedData.settings.assetClasses.find(c => c.id === defClass.id);
        if (!exists) {
            loadedData.settings.assetClasses.push(defClass);
        }
    });

    return loadedData;
};

const initialData = {
  version: "Beta-0.9.6", lastModified: new Date().toISOString(), 
  settings: { 
      baseCurrency: 'CHF', 
      showTaxesForDividends: true, 
      showFeesForSecurities: true,
      bookingCategories: defaultBookingCategories,
      assetClasses: [
          { id: 'cash', name: 'Konto', description: 'Liquide Mittel und Girokonten' },
          { id: 'fund', name: 'Fonds / ETF', description: 'Investmentfonds und passive ETFs' },
          { id: 'stock', name: 'Aktie', description: 'Direktinvestitionen in Einzelaktien' },
          { id: 'crypto', name: 'Krypto', description: 'Kryptowährungen wie BTC, ETH' },
          { id: 'realestate', name: 'Immobilie', description: 'Liegenschaften, Haus, Wohnung' },
          { id: 'mortgage', name: 'Hypothek', description: 'Hypothekarische Belastungen' },
          { id: 'pension_cash', name: 'Pensionskasse (2. Säule)', description: 'Berufliche Vorsorge (2. Säule) / Pensionsguthaben' },
          { id: 'pension_3a_cash', name: '3a Vorsorgekonto', description: 'Säule 3a Sparkonto (Vorsorgeguthaben Cash)' },
          { id: 'pension_3a_fund', name: '3a Vorsorgefonds', description: 'Säule 3a Wertschriftenlösung (Vorsorgeguthaben Fonds)' },
          { id: 'managed_fund', name: 'Verwaltetes Vermögen', description: 'Robo-Advisor oder Fonds ohne Einzelkurse (z.B. TrueWealth)' },
          { id: 'pension_3a_managed', name: '3a Fonds (Gesamtwert)', description: 'Säule 3a Fondslösung über Gesamtwert (z.B. Viac, frankly)' }
      ]
  },
  banks: [],
  budget: { incomeSources: [], expenses: [], subscriptions: [] },
  goals: { fire: { target: 500000, year: 2035 } }, scenarios: [],
  aiContext: { history: [], apiMessages: [] } 
};

const isSecurity = (assetClass) => ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes((assetClass || '').toLowerCase());

const parseRate = (val) => parseFloat(String(val || '1').replace(',', '.'));
const getTodayStr = () => new Date().toISOString().split('T')[0];

const isAssetLiquid = (asset) => {
    if (asset.hasOwnProperty('isLiquid')) return asset.isLiquid;
    
    const ac = (asset.assetClass || '').toLowerCase();
    const name = (asset.name || '').toLowerCase();
    const isPension = ac.includes('pension') || name.includes('vorsorge') || name.includes('3a');
    
    if (['stock', 'fund', 'managed_fund', 'crypto', 'realestate', 'mortgage'].includes(ac)) return false;
    if (isPension) return false;
    
    return true; 
};

const classifyBooking = (bk, asset) => {
    const isLiquid = isAssetLiquid(asset);
    
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
};

const getAllAssets = (nodes) => {
  let assets = [];
  nodes.forEach(node => { if (node.type === 'asset') assets.push(node); if (node.children) assets = assets.concat(getAllAssets(node.children)); });
  return assets;
};

const getAssetSharesAtDate = (asset, targetDate) => {
    if (!isSecurity(asset.assetClass)) return 0;
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
};

const getAssetPriceAtDate = (asset, targetDate) => {
    if (!isSecurity(asset.assetClass)) return 1;
    
    if (targetDate >= getTodayStr() && Number(asset.price) > 0) {
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
};

const getBookingFlow = (booking) => {
    let amt = Number(booking.amount || 0);
    const type = String(booking.type || '').toLowerCase();
    
    let isPositive = ['einzahlung', 'kauf', 'wertanpassung', 'dividende', 'ausschüttung', 'abzahlung'].includes(type);
    
    if (type === 'wertanpassung' && amt < 0) {
        isPositive = false;
        amt = Math.abs(amt);
    }

    return {
        isPositive,
        amount: amt
    };
};

const getAssetRawValueAtDate = (asset, targetDate) => {
    if (isSecurity(asset.assetClass)) {
        const sh = getAssetSharesAtDate(asset, targetDate);
        if (sh <= 0) return 0;
        
        const pr = getAssetPriceAtDate(asset, targetDate);
        if (pr > 0) return sh * pr;
    }

    let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
    let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
    let baseAmount = applicableBalance ? Number(applicableBalance.amount) : 0;
    let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';
    let netBookings = 0;

    if (asset.bookings) {
        asset.bookings.forEach(bk => {
            if (bk.date > baseDate && bk.date <= targetDate) {
                const flow = getBookingFlow(bk);
                if (flow.isPositive) netBookings += flow.amount;
                else netBookings -= flow.amount;
            }
        });
    }
    return baseAmount + netBookings;
};

const getAssetValueAtDate = (asset, targetDate, allAssets = []) => {
    const rawValue = getAssetRawValueAtDate(asset, targetDate);
    
    if (!asset.currency || asset.currency === 'CHF') return rawValue;

    if (targetDate >= getTodayStr() && asset.exchangeRate) {
        return rawValue * parseRate(asset.exchangeRate);
    }

    let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
    let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
    let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate ? applicableBalance.bookingExchangeRate : parseRate(asset.exchangeRate);
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
        allAssets.forEach(otherAsset => {
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

    return rawValue * parseRate(applicableRate || 1);
};

// --- NEUE FUNKTION: Investiertes Kapital berechnen (inkl. FX-Handhabung) ---
const getInvestedCapitalAtDate = (asset, targetDate, allAssets = []) => {
    let investedRaw = 0;
    
    const ac = (asset.assetClass || '').toLowerCase();
    const isFluctuating = ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes(ac);
    
    if (isFluctuating) {
        // Salden definieren bei schwankenden Anlagen NICHT das investierte Kapital (nur historische Kostenbasis am Start)
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
                if (['Kauf', 'Einzahlung'].includes(bk.type) && bk.subCategory !== 'Zinsen') {
                    investedRaw += Number(bk.amount || 0);
                    hasInitialInvested = true;
                }
                if (['Verkauf', 'Auszahlung'].includes(bk.type)) {
                    investedRaw -= Number(bk.amount || 0);
                }
            }
        });
    } else {
        // Klassische Konten (Salden überschreiben alle vorherigen Buchungen)
        let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
        let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
        let baseDate = '1970-01-01';

        if (applicableBalance) {
            investedRaw = applicableBalance.amount;
            baseDate = applicableBalance.date;
        }

        (asset.bookings || []).forEach(bk => {
            if (applicableBalance) {
                if (bk.date > baseDate && bk.date <= targetDate) {
                    if (['Kauf'].includes(bk.type)) investedRaw += Number(bk.amount);
                    if (['Einzahlung'].includes(bk.type) && bk.subCategory !== 'Zinsen') investedRaw += Number(bk.amount);
                    if (['Verkauf', 'Auszahlung'].includes(bk.type)) investedRaw -= Number(bk.amount);
                }
            } else {
                if (bk.date <= targetDate) {
                    if (['Kauf'].includes(bk.type)) investedRaw += Number(bk.amount);
                    if (['Einzahlung'].includes(bk.type) && bk.subCategory !== 'Zinsen') investedRaw += Number(bk.amount);
                    if (['Verkauf', 'Auszahlung'].includes(bk.type)) investedRaw -= Number(bk.amount);
                }
            }
        });
    }

    // Wenn Heimatwährung, direkt roh zurückgeben
    if (!asset.currency || asset.currency === 'CHF') return investedRaw;

    // Wechselkurs-Ermittlung analog zu getAssetValueAtDate
    if (targetDate >= getTodayStr() && asset.exchangeRate) {
        return investedRaw * parseRate(asset.exchangeRate);
    }

    let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
    let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
    let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate ? applicableBalance.bookingExchangeRate : parseRate(asset.exchangeRate);
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
        allAssets.forEach(otherAsset => {
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

    return investedRaw * parseRate(applicableRate || 1);
};

const getTotalWealthAtDate = (assets, date) => assets.reduce((sum, a) => sum + getAssetValueAtDate(a, date, assets), 0);

const generateMonthEnds = (startStr, endStr) => {
    let dates = []; let curr = new Date(startStr); let end = new Date(endStr);
    while (curr <= end) {
        let lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
        if (lastDay > end) lastDay = end;
        dates.push(lastDay.toISOString().split('T')[0]);
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
    }
    if (!dates.includes(endStr)) dates.push(endStr);
    return dates;
};

const calcLinearRegression = (points) => {
  const n = points.length; if(n<2) return (x)=>points[0]?.y||0;
  let sX=0, sY=0, sXY=0, sXX=0;
  points.forEach((p,i)=>{sX+=i; sY+=p.y; sXY+=i*p.y; sXX+=i*i;});
  const slope = (n*sXY - sX*sY)/(n*sXX - sX*sX);
  const inc = (sY - slope*sX)/n;
  return (x) => slope*x + inc;
};

const calcExpRegression = (points) => {
  const n = points.length; if(n<2) return (x)=>points[0]?.y||0;
  let sX=0, sLnY=0, sXLnY=0, sXX=0;
  points.forEach((p,i)=>{ const lnY = Math.log(Math.max(p.y, 1)); sX+=i; sLnY+=lnY; sXLnY+=i*lnY; sXX+=i*i; });
  const b = (n*sXLnY - sX*sLnY)/(n*sXX - sX*sX);
  const a = Math.exp((sLnY - b*sX)/n);
  return (x) => a * Math.exp(b*x);
};

const formatCurrency = (val, lang, currency = 'CHF') => {
  const localeMap = { de: 'de-CH', en: 'en-US', fr: 'fr-FR', it: 'it-IT' };
  return new Intl.NumberFormat(localeMap[lang] || 'de-CH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val || 0);
};

const getNormalizedBookings = (assets) => {
    let allBookings = [];
    assets.forEach(asset => {
        (asset.bookings || []).forEach(bk => {
            const classif = classifyBooking(bk, asset);
            
            // KORREKTUR: FX-Rate der Einzelbuchung priorisieren!
            const bkRate = bk.bookingExchangeRate ? parseRate(bk.bookingExchangeRate) : 0;
            const assetRate = parseRate(asset.exchangeRate || 1);
            const appliedRate = (bkRate !== 0 && bkRate !== 1) ? bkRate : assetRate;
            
            allBookings.push({
                ...bk,
                ...classif, 
                _baseValue: Number(bk.amount || 0) * appliedRate,
                assetName: asset.name
            });
        });
    });
    return allBookings;
};

module.exports = { 
    generateId, 
    initialData, 
    defaultBookingCategories, 
    getAllAssets, 
    getAssetSharesAtDate,
    getAssetPriceAtDate,
    getAssetRawValueAtDate, 
    getAssetValueAtDate, 
    getInvestedCapitalAtDate, // NEU EXPORTIERT
    getTotalWealthAtDate, 
    generateMonthEnds, 
    calcLinearRegression, 
    calcExpRegression, 
    formatCurrency,
    getNormalizedBookings,
    getBookingFlow,
    ensureDefaultAssetClasses 
};