/**
 * @file MarketAlertEngine.js
 * @description Kursabruf via EODHD & Alert-Prüfung für FinBundle Pro.
 */

class MarketAlertEngine {
  constructor(data, updateTreeData, showToast) {
    this.data = data;
    this.updateTreeData = updateTreeData;
    this.showToast = showToast;
  }

  getEodhdApiKey() {
    return this.data.settings?.finApiKeys?.eodhd || '';
  }

  // Holt den aktuellen Schlusskurs für einen Ticker mit 4-Stunden-Cache
  async fetchQuote(ticker) {
    const eodKey = this.getEodhdApiKey();
    if (!eodKey) return null;

    const cacheKey = `finbundle_quote_${ticker}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { price, timestamp } = JSON.parse(cached);
        // Cache gültig für 4 Stunden
        if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
          return price;
        }
      } catch (e) {}
    }

    try {
      // EODHD Free Endpoint für EOD Daten
      const url = `https://eodhd.com/api/real-time/${ticker}?api_token=${eodKey}&fmt=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      
      const json = await res.json();
      const price = Number(json.close || json.previousClose || json.price || 0);

      if (price > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({ price, timestamp: Date.now() }));
        return price;
      }
    } catch (err) {
      console.warn(`Fehler beim Kursabruf für ${ticker}:`, err);
    }
    return null;
  }

  // Prüft alle registrierten Alerts gegen die Live-Kurse
  async checkAllAlerts() {
    const alerts = this.data.alerts || [];
    if (alerts.length === 0) return;

    let updatedAlerts = [...alerts];
    let triggeredCount = 0;

    for (let i = 0; i < updatedAlerts.length; i++) {
      const alert = updatedAlerts[i];
      if (alert.triggered) continue; // Bereits ausgelöst

      const currentPrice = await this.fetchQuote(alert.ticker);
      if (!currentPrice) continue;

      let shouldTrigger = false;
      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = currentPrice;
        triggeredCount++;

        if (this.showToast) {
          this.showToast(
            `Börsen-Alert: ${alert.ticker} hat ${alert.targetPrice} erreicht (Aktuell: ${currentPrice})!`,
            'warning'
          );
        }
      }
    }

    if (triggeredCount > 0) {
      this.updateTreeData({ alerts: updatedAlerts });
    }
  }
}

module.exports = MarketAlertEngine;