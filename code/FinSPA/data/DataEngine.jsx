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
  version: "Alpha-2", lastModified: new Date().toISOString(), 
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

const getAllAssets = (nodes) => {
  let assets = [];
  nodes.forEach(node => { if (node.type === 'asset') assets.push(node); if (node.children) assets = assets.concat(getAllAssets(node.children)); });
  return assets;
};

// --- KORRIGIERT: Kein vorzeitiger Abbruch, wenn balances leer sind ---
const getAssetRawValueAtDate = (asset, targetDate) => {
    let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
    let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
    let baseAmount = applicableBalance ? applicableBalance.amount : 0;
    let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';
    let netBookings = 0;

    if (asset.bookings) {
        asset.bookings.forEach(bk => {
            if (bk.date > baseDate && bk.date <= targetDate) {
                const isPositive = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(bk.type);
                const isNegative = ['Auszahlung', 'Verkauf', 'Gebühr', 'Zinszahlung', 'Schulderhöhung'].includes(bk.type);
                if (isPositive) netBookings += Number(bk.amount);
                else if (isNegative) netBookings -= Number(bk.amount);
            }
        });
    }
    return baseAmount + netBookings;
};

// --- KORRIGIERT: Kein vorzeitiger Abbruch, wenn balances leer sind ---
const getAssetValueAtDate = (asset, targetDate, allAssets = []) => {
    let sortedBalances = [...(asset.balances || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
    let applicableBalance = [...sortedBalances].reverse().find(b => b.date <= targetDate);
    
    // Basiswert (Fremdwährung) berechnen
    const rawValue = getAssetRawValueAtDate(asset, targetDate);
    
    let applicableRate = applicableBalance && applicableBalance.bookingExchangeRate ? applicableBalance.bookingExchangeRate : asset.exchangeRate;
    let baseDate = applicableBalance ? applicableBalance.date : '1970-01-01';

    if (asset.bookings) {
        asset.bookings.forEach(bk => {
            if (bk.date > baseDate && bk.date <= targetDate) {
                if (bk.bookingExchangeRate) applicableRate = bk.bookingExchangeRate;
            }
        });
    }

    if ((!applicableRate || applicableRate === 1) && asset.currency && asset.currency !== 'CHF') {
        let latestDate = '1970-01-01';
        allAssets.forEach(otherAsset => {
            if (otherAsset.currency === asset.currency) {
                if (otherAsset.exchangeRate && otherAsset.exchangeRate !== 1) applicableRate = otherAsset.exchangeRate;
                if (otherAsset.bookings) {
                    otherAsset.bookings.forEach(b => {
                        if (b.bookingExchangeRate && b.date <= targetDate && b.date > latestDate) {
                            applicableRate = b.bookingExchangeRate;
                            latestDate = b.date;
                        }
                    });
                }
                if (otherAsset.balances) {
                    otherAsset.balances.forEach(b => {
                        if (b.bookingExchangeRate && b.date <= targetDate && b.date > latestDate) {
                            applicableRate = b.bookingExchangeRate;
                            latestDate = b.date;
                        }
                    });
                }
            }
        });
    }

    return rawValue * (applicableRate || 1);
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
                _assetExchangeRate: asset.exchangeRate || 1,
                _assetClass: asset.assetClass,
                _baseValue: Number(bk.amount) * (asset.exchangeRate || 1)
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
    getAssetRawValueAtDate, 
    getAssetValueAtDate, 
    getTotalWealthAtDate, 
    generateMonthEnds, 
    calcLinearRegression, 
    calcExpRegression, 
    formatCurrency,
    getNormalizedBookings
};