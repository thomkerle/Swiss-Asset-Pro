/**
 * @file ActivityNotificationEngine.js
 * @description Rein informative Markt- & Aktivitäts-Engine für FinBundle Pro.
 * Überwacht EODHD-Kurse (10-Minuten-Takt), Devisen und Navigations-Kontexte.
 */

const resolveDataEngine = () => {
  if (typeof window !== 'undefined' && window.DataEngine) return window.DataEngine;
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k.includes('DataEngine'));
    if (foundKey) {
      const exp = window.__FinSPAModules[foundKey].exports;
      return exp?.default || exp || {};
    }
  }
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    try { return window.require('DataEngine.jsx'); } catch (e) {}
  }
  try { return require('../data/DataEngine.jsx'); } catch (e) {}
  try { return require('./data/DataEngine.jsx'); } catch (e) {}
  return {};
};

const DataEngine = resolveDataEngine();
const getAllAssets = DataEngine.getAllAssets || ((banks) => []);
const getAssetValueAtDate = DataEngine.getAssetValueAtDate || (() => 0);
const getAssetSharesAtDate = DataEngine.getAssetSharesAtDate || (() => 0);
const getAssetPriceAtDate = DataEngine.getAssetPriceAtDate || (() => 0);

class ActivityNotificationEngine {
  constructor(data, updateTreeData) {
    this.data = data || { banks: [], settings: {} };
    this.updateTreeData = updateTreeData;
  }

  getEodhdApiKey() {
    return this.data.settings?.finApiKeys?.eodhd || '';
  }

  getBaseCurrency() {
    return this.data.settings?.baseCurrency || 'CHF';
  }

  // Ermittelt alle Assets inklusive des jeweiligen Banknamens (Depot-Zuordnung)
  getAllAssetsWithBank() {
    const banks = this.data.banks || [];
    const assets = [];
    const traverse = (node, currentBank) => {
      let bankName = currentBank;
      if (node.type === 'bank') bankName = node.name;
      if (node.type === 'asset' && !node.isArchived) {
        assets.push({ ...node, bankName: bankName || 'Depot' });
      }
      if (node.children) node.children.forEach(child => traverse(child, bankName));
    };
    banks.forEach(b => traverse(b, ''));
    return assets;
  }

  // --- 1. HISTORIE: Speichert den vollen Navigations-Kontext ---
  static recordHistoryItem(item, context = {}) {
    if (!item) return;
    try {
      const key = 'finbundle_activity_history';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      
      const id = item.id || context.activeReport || context.viewMode || 'home';
      const filtered = existing.filter(h => h.id !== id);
      
      const entry = {
        id: id,
        name: item.name || item.title || (context.activeReport ? `Report: ${context.activeReport}` : 'Ansicht'),
        type: item.type || (context.activeReport ? 'report' : 'view'),
        assetClass: item.assetClass,
        budgetType: item.budgetType,
        viewMode: context.viewMode || 'vermoegen',
        activeReport: context.activeReport || null,
        timestamp: Date.now()
      };

      const updated = [entry, ...filtered].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('[ActivityEngine] Historie-Fehler:', e);
    }
  }

  static getHistoryItems() {
    try {
      return JSON.parse(localStorage.getItem('finbundle_activity_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  // --- 2. BUCHUNGS-AUDIT (letzte 2 Stunden / Heute) ---
  getRecentBookings(maxHours = 2) {
    const allAssets = getAllAssets(this.data.banks || []);
    const cutoffTime = Date.now() - (maxHours * 60 * 60 * 1000);
    const todayStr = new Date().toISOString().split('T')[0];
    const recent = [];

    allAssets.forEach(asset => {
      (asset.bookings || []).forEach(b => {
        const isWithinTime = b._timestamp && b._timestamp >= cutoffTime;
        const isToday = b.date === todayStr;

        if (isWithinTime || isToday) {
          recent.push({
            id: b.id,
            assetId: asset.id,
            assetName: asset.name,
            assetClass: asset.assetClass,
            amount: b.amount,
            type: b.type,
            category: b.subCategory || 'Sonstiges',
            comment: b.comment || '',
            currency: asset.currency || this.getBaseCurrency(),
            timestamp: b._timestamp || new Date(b.date).getTime(),
            isRecentHours: !!isWithinTime
          });
        }
      });
    });

    return recent.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
  }

  // --- 3. EODHD KURSABRUF (10-MINUTEN CACHE) ---
  async fetchLiveQuote(ticker) {
    const key = this.getEodhdApiKey();
    if (!key || !ticker) return null;

    const cleanTicker = String(ticker).trim();
    const cacheKey = `finbundle_eodhd_${cleanTicker}`;
    const cached = localStorage.getItem(cacheKey);

    // 10 Minuten Cache (600'000 ms)
    if (cached) {
      try {
        const { price, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 10 * 60 * 1000 && price > 0) {
          return price;
        }
      } catch (e) {}
    }

    // 1. Realtime Endpunkt
    try {
      const url = `https://eodhd.com/api/real-time/${encodeURIComponent(cleanTicker)}?api_token=${key}&fmt=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const currentPrice = Number(data.close || data.previousClose || data.price || 0);
        if (currentPrice > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ price: currentPrice, timestamp: Date.now() }));
          return currentPrice;
        }
      }
    } catch (err) {}

    // 2. EOD Fallback
    try {
      const eodUrl = `https://eodhd.com/api/eod/${encodeURIComponent(cleanTicker)}?api_token=${key}&fmt=json&limit=1&order=d`;
      const resEod = await fetch(eodUrl);
      if (resEod.ok) {
        const dataEod = await resEod.json();
        const item = Array.isArray(dataEod) ? dataEod[0] : dataEod;
        const price = Number(item?.close || item?.adjusted_close || 0);
        if (price > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ price: price, timestamp: Date.now() }));
          return price;
        }
      }
    } catch (errEod) {}

    return null;
  }

  // --- 4. REIN INFORMATIVER VERGLEICH (KACHEL-DATEN) ---
  async evaluateMarketMovers(actionThresholdPercent = 5.0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const allAssets = this.getAllAssetsWithBank();
    const baseCur = this.getBaseCurrency();
    
    const securities = allAssets.filter(a => 
      a.ticker && ['stock', 'fund', 'crypto', 'pension_fund'].includes(a.assetClass) && !a.isArchived
    );
    
    const tiles = [];

    for (const asset of securities) {
      const shares = Number(getAssetSharesAtDate(asset, todayStr)) || 0;
      if (shares <= 0) continue;

      let lastBookedPrice = Number(getAssetPriceAtDate(asset, todayStr)) || 0;
      if (lastBookedPrice <= 0 && asset.bookings && asset.bookings.length > 0) {
        const sorted = [...asset.bookings].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastWithPrice = sorted.find(b => Number(b.price) > 0);
        if (lastWithPrice) lastBookedPrice = Number(lastWithPrice.price);
      }
      if (lastBookedPrice <= 0) lastBookedPrice = Number(asset.price || 0);
      if (lastBookedPrice <= 0) continue;

      const fxRate = Number(asset.exchangeRate) || 1;

      const livePrice = await this.fetchLiveQuote(asset.ticker);
      if (!livePrice || livePrice <= 0) continue;

      const priceDiffRaw = livePrice - lastBookedPrice;
      const diffPct = ((livePrice - lastBookedPrice) / lastBookedPrice) * 100;

      const totalGainLossBase = shares * priceDiffRaw * fxRate;
      const totalLiveValueBase = shares * livePrice * fxRate;
      const totalBookedValueBase = shares * lastBookedPrice * fxRate;

      // Ab 5.0% Abweichung: Signal für Handlungsbedarf
      const requiresAction = Math.abs(diffPct) >= actionThresholdPercent;

      tiles.push({
        assetId: asset.id,
        name: asset.name,
        bankName: asset.bankName,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        currency: asset.currency || baseCur,
        shares: shares,
        lastBookedPrice: lastBookedPrice,
        livePrice: livePrice,
        priceDiffRaw: Number(priceDiffRaw.toFixed(2)),
        diffPct: Number(diffPct.toFixed(2)),
        totalGainLossBase: Number(totalGainLossBase.toFixed(2)),
        totalLiveValueBase: Number(totalLiveValueBase.toFixed(2)),
        totalBookedValueBase: Number(totalBookedValueBase.toFixed(2)),
        fxRate: fxRate,
        isUp: diffPct >= 0,
        requiresAction: requiresAction
      });
    }

    return tiles.sort((a, b) => {
      if (a.requiresAction && !b.requiresAction) return -1;
      if (!a.requiresAction && b.requiresAction) return 1;
      return Math.abs(b.diffPct) - Math.abs(a.diffPct);
    });
  }

  // --- 5. DEVISEN-MONITORING ---
  async evaluateFxDeviations(thresholdPct = 0.8) {
    const baseCur = this.getBaseCurrency();
    const trackedCurrencies = ['EUR', 'USD', 'GBP'];
    const fxAlerts = [];

    for (const cur of trackedCurrencies) {
      if (cur === baseCur) continue;
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${cur}&symbols=${baseCur}`);
        if (!res.ok) continue;
        const json = await res.json();
        const currentRate = json.rates?.[baseCur];
        const savedRate = this.data.settings?.exchangeRates?.[cur] || (cur === 'USD' ? 0.89 : (cur === 'EUR' ? 0.95 : 1.13));

        if (currentRate && savedRate) {
          const diffPct = ((currentRate - savedRate) / savedRate) * 100;
          if (Math.abs(diffPct) >= thresholdPct) {
            fxAlerts.push({
              pair: `${cur}/${baseCur}`,
              currentRate: currentRate,
              savedRate: savedRate,
              diffPct: Number(diffPct.toFixed(2)),
              direction: diffPct >= 0 ? 'UP' : 'DOWN'
            });
          }
        }
      } catch (e) {}
    }

    return fxAlerts;
  }

  async compileCenterData() {
    const [movers, fxAlerts] = await Promise.all([
      this.evaluateMarketMovers(5.0),
      this.evaluateFxDeviations(0.8)
    ]);

    const recentBookings = this.getRecentBookings(2);
    const history = ActivityNotificationEngine.getHistoryItems();
    
    const actionCount = movers.filter(m => m.requiresAction).length;

    return {
      movers,
      fxAlerts,
      recentBookings,
      history,
      actionCount,
      totalUnread: actionCount + fxAlerts.length + recentBookings.length
    };
  }
}

if (typeof window !== 'undefined') {
  window.ActivityNotificationEngine = ActivityNotificationEngine;
}
module.exports = ActivityNotificationEngine;