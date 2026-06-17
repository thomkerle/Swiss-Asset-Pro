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

const initialData = {
  version: "Beta-0.9.4", lastModified: new Date().toISOString(), 
  settings: { 
      baseCurrency: 'CHF', 
      showTaxesForDividends: true, 
      showFeesForSecurities: true,
      bookingCategories: defaultBookingCategories
  },
  banks: [],
  budget: { incomeSources: [], expenses: [], subscriptions: [] },
  goals: { fire: { target: 500000, year: 2035 } }, scenarios: [],
  aiContext: { history: [], apiMessages: [] } 
};

// --- HILFSFUNKTIONEN FÜR DIE ENGINE ---
const isSecurity = (assetClass) => ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund'].includes(assetClass);
const parseRate = (val) => parseFloat(String(val || '1').replace(',', '.'));
const getTodayStr = () => new Date().toISOString().split('T')[0];

const getAllAssets = (nodes) => {
  let assets = [];
  nodes.forEach(node => { if (node.type === 'asset') assets.push(node); if (node.children) assets = assets.concat(getAllAssets(node.children)); });
  return assets;
};

// --- Zentrale Stückzahl-Berechnung ---
const getAssetSharesAtDate = (asset, targetDate) => {
    if (!isSecurity(asset.assetClass)) return 0;
    let sh = 0;
    if (asset.bookings) {
        asset.bookings.forEach(b => {
            if (b.date <= targetDate) {
                if (['Kauf', 'Einzahlung', 'Dividende'].includes(b.type) && b.shares) sh += Number(b.shares);
                if (['Verkauf', 'Auszahlung'].includes(b.type) && b.shares) sh -= Number(b.shares);
            }
        });
    }
    return sh > 0 ? sh : (Number(asset.shares) || 0);
};

// --- Zentrale Preis-Berechnung (KORRIGIERT FÜR ALLE BUCHUNGSTYPEN) ---
const getAssetPriceAtDate = (asset, targetDate) => {
    if (!isSecurity(asset.assetClass)) return 1;
    
    // Für aktuelle Bewertungen hat der manuell gepflegte Global-Preis Vorrang
    if (targetDate >= getTodayStr() && Number(asset.price) > 0) {
        return Number(asset.price);
    }
    
    let p = 0;
    if (asset.bookings) {
        const sorted = [...asset.bookings].sort((a,b) => new Date(a.date) - new Date(b.date));
        // BUGFIX: Wir filtern nicht mehr nach Typ! Jeder Eintrag mit einem Preis > 0 ist gültig.
        const pastBookings = sorted.filter(b => b.date <= targetDate && Number(b.price) > 0);
        if (pastBookings.length > 0) {
            p = Number(pastBookings[pastBookings.length - 1].price);
        }
    }
    return p > 0 ? p : (Number(asset.price) || 0);
};

// --- Zentrale Klassifizierung von Buchungsflüssen (In/Out) ---
const getBookingFlow = (booking) => {
    let amt = Number(booking.amount || 0);
    // Standard-Klassifizierung
    let isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(booking.type);
    
    // Sonderfall: Negative Wertanpassung wird als Abfluss/Wertminderung gewertet
    if (booking.type === 'Wertanpassung' && amt < 0) {
        isPositive = false;
        amt = Math.abs(amt);
    }

    return {
        isPositive,
        amount: amt
    };
};

// --- Ermittelt den reinen Asset-Wert (ohne Währungsumrechnung) ---
const getAssetRawValueAtDate = (asset, targetDate) => {
    if (isSecurity(asset.assetClass)) {
        const sh = getAssetSharesAtDate(asset, targetDate);
        const pr = getAssetPriceAtDate(asset, targetDate);
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
                // Zentralisierte In/Out Logik nutzen
                const flow = getBookingFlow(bk);
                if (flow.isPositive) netBookings += flow.amount;
                else netBookings -= flow.amount;
            }
        });
    }
    return baseAmount + netBookings;
};

// --- Ermittelt den finalen Wert in Basiswährung (CHF) ---
const getAssetValueAtDate = (asset, targetDate, allAssets = []) => {
    const rawValue = getAssetRawValueAtDate(asset, targetDate);
    
    // Wenn es kein Fremdwährungskonto ist, direkt zurückgeben
    if (!asset.currency || asset.currency === 'CHF') return rawValue;

    // Aktueller Live-Kurs hat Vorrang, wenn wir das "Heute" betrachten
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

    // Historischer Fallback-Suchlauf über andere Assets gleicher Währung
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
            let nType = bk.type;
            let nCat = bk.subCategory || '';
            if (nType === 'Dividende') { nType = 'Einzahlung'; nCat = 'Dividenden'; }
            if (nType === 'Zinszahlung') { nType = 'Einzahlung'; nCat = 'Zinsen'; }
            if (nType === 'Gebühr') { nType = 'Auszahlung'; nCat = 'Gebühren'; }
            if (nCat === 'Ausschüttung') { nCat = 'Dividenden'; }

            allBookings.push({
                ...bk,
                normType: nType,
                normCategory: nCat,
                _assetCurrency: asset.currency,
                _assetExchangeRate: parseRate(asset.exchangeRate || 1),
                _assetClass: asset.assetClass,
                _baseValue: Number(bk.amount) * parseRate(asset.exchangeRate || 1),
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
    getTotalWealthAtDate, 
    generateMonthEnds, 
    calcLinearRegression, 
    calcExpRegression, 
    formatCurrency,
    getNormalizedBookings,
    getBookingFlow
};