// ApiSyncEngine.jsx
const ApiSyncEngine = {
    fetchHybrid: async (url) => {
        const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
        if (isElectron) {
            try {
                const nodeRequire = window.require || require;
                const electron = nodeRequire('electron');
                if (electron && electron.ipcRenderer) {
                    const response = await electron.ipcRenderer.invoke('fetch-live-price', url);
                    if (response && response.error) throw new Error(response.error);
                    return response;
                }
            } catch (e) {
                console.warn("Electron IPC Aufruf fehlgeschlagen, versuche Fallback...", e);
            }
        } 
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
        return await res.json();
    },

    // --- NEU: Intelligentes Caching via LocalStorage ---
    fetchCached: async (url, ttlMinutes = 15) => {
        // Generiert einen sicheren, URL-basierten Cache-Key
        const cacheKey = 'finspa_api_' + url.replace(/[^a-zA-Z0-9]/g, '_');
        const cachedStr = localStorage.getItem(cacheKey);
        
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                // Prüfen, ob der Cache abgelaufen ist
                if (Date.now() - cached.timestamp < ttlMinutes * 60 * 1000) {
                    return cached.data;
                }
            } catch(e) {}
        }
        
        // Cache abgelaufen oder nicht vorhanden -> Neu laden
        const data = await ApiSyncEngine.fetchHybrid(url);
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
        } catch(e) {
            console.warn("LocalStorage Limit erreicht, Caching übersprungen.");
        }
        return data;
    },

    fetchAssetPrice: async ({ assetNode, finKeys, baseCurrency, showToast, safeT, t }) => {
        let ticker = assetNode.ticker;
        const isin = assetNode.isin;

        if (!ticker && !isin) {
            if (showToast) showToast(safeT(t, 'msgNoTicker', 'Bitte zuerst ein Ticker-Symbol (z.B. AAPL.US) oder eine ISIN eintragen.'), 'warning');
            return null;
        }

        if (!finKeys.eodhd && !finKeys.alphavantage) {
            if (showToast) showToast(safeT(t, 'msgNoFinApiKeys', 'Keine API-Keys konfiguriert.'), 'info');
            return null;
        }

        if (showToast) showToast(safeT(t, 'msgFetchingPrice', 'Rufe Live-Kurs & Wechselkurs ab...'), 'info');

        let price = 0;
        let provider = '';
        let apiDate = new Date().toISOString().split('T')[0];

        try {
            if (!ticker && isin && finKeys.eodhd) {
                try {
                    // Caching für ISIN-Suche (selten veränderlich -> 24 Stunden TTL)
                    const searchJson = await ApiSyncEngine.fetchCached(`https://eodhd.com/api/search/${isin}?api_token=${finKeys.eodhd}&fmt=json`, 24 * 60);
                    if (Array.isArray(searchJson) && searchJson.length > 0) {
                        ticker = `${searchJson[0].Code}.${searchJson[0].Exchange}`;
                    }
                } catch (e) {
                    console.warn("ISIN Auflösung fehlgeschlagen:", e);
                }
            }

            if (!ticker) {
                if (showToast) showToast(safeT(t, 'msgTickerResolveFail', 'ISIN konnte nicht aufgelöst werden. Bitte Ticker manuell eintragen.'), 'warning');
                return null;
            }

            if (finKeys.eodhd) {
                try {
                    // 1. Live/Real-Time API (TTL: 5 Minuten für Schonung des Tageslimits)
                    const rtJson = await ApiSyncEngine.fetchCached(`https://eodhd.com/api/real-time/${ticker}?api_token=${finKeys.eodhd}&fmt=json`, 5);
                    if (rtJson && rtJson.close !== undefined && rtJson.close !== 'NA' && Number(rtJson.close) > 0) {
                        price = Number(rtJson.close);
                        provider = 'EODHD (Live)';
                        apiDate = new Date().toISOString().split('T')[0];
                    } else {
                        // 2. Fallback auf End of Day (TTL: 12 Stunden)
                        const json = await ApiSyncEngine.fetchCached(`https://eodhd.com/api/eod/${ticker}?api_token=${finKeys.eodhd}&fmt=json`, 12 * 60);
                        if (Array.isArray(json) && json.length > 0) {
                            const latestEod = json[json.length - 1];
                            const eodhdPrice = Number(latestEod.close) || 0;
                            if (eodhdPrice > 0) { 
                                price = eodhdPrice; 
                                provider = 'EODHD (EOD)'; 
                                if (latestEod.date) apiDate = latestEod.date; 
                            }
                        }
                    }
                } catch (e) {
                    console.warn("EODHD Fetch Fehler:", e);
                }
            }

            if (!price && finKeys.alphavantage) {
                try {
                    const avTicker = ticker.endsWith('.US') ? ticker.replace('.US', '') : ticker;
                    // Alpha Vantage (TTL: 15 Minuten)
                    const json = await ApiSyncEngine.fetchCached(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avTicker}&apikey=${finKeys.alphavantage}`, 15);
                    const quote = json['Global Quote'];
                    if (quote && quote['05. price']) {
                        price = Number(quote['05. price']);
                        provider = 'Alpha Vantage';
                        if (quote['07. latest trading day']) {
                            apiDate = quote['07. latest trading day'];
                        }
                    }
                } catch (e) {
                    console.warn("Alpha Vantage Fetch Fehler:", e);
                }
            }
        } catch (e) {
            console.error("API Stock Fetch Error:", e);
        }

        let currentFxRate = parseFloat(String(assetNode.exchangeRate || '1').replace(',', '.')) || 1;
        const fromCurrency = assetNode.currency;
        
        if (fromCurrency && fromCurrency !== baseCurrency) {
            try {
                let liveFx = null;
                try {
                    // FX-Raten (TTL: 12 Stunden)
                    const fxJson = await ApiSyncEngine.fetchCached(`https://api.frankfurter.dev/v1/${apiDate}?base=${fromCurrency}&symbols=${baseCurrency}`, 12 * 60);
                    liveFx = fxJson.rates[baseCurrency];
                } catch (fxErr) {
                    const fxJson2 = await ApiSyncEngine.fetchCached(`https://api.frankfurter.app/${apiDate}?base=${fromCurrency}&symbols=${baseCurrency}`, 12 * 60);
                    liveFx = fxJson2.rates[baseCurrency];
                }
                if (liveFx) currentFxRate = liveFx;
            } catch (fxErr) {
                console.warn("FX Fetch via Frankfurter failed, using fallback/stored rate:", fxErr);
            }
        }

        return { price, provider, apiDate, currentFxRate, ticker };
    },

    // --- NEU: Abruf von Fundamentaldaten (Dividenden & Unternehmensinfos) ---
    fetchFundamentals: async ({ ticker, finKeys }) => {
        if (!ticker) return null;

        // Versuche EODHD zuerst (Detailreicher und effizienter)
        if (finKeys.eodhd) {
            const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${finKeys.eodhd}&fmt=json`;
            try {
                // TTL: 24 Stunden für Fundamentaldaten
                const json = await ApiSyncEngine.fetchCached(url, 24 * 60);
                if (json) {
                    return {
                        yield: json.Highlights?.DividendYield || json.Valuation?.ForwardAnnualDividendYield,
                        exDate: json.SplitsDividends?.ExDividendDate || json.SplitsDividends?.ForwardExDividendDate,
                        pe: json.Valuation?.TrailingPE || json.Highlights?.PERatio,
                        eps: json.Highlights?.EPSEstimateCurrentYear || json.Highlights?.EPS,
                        high52: json.Technicals?.['52WeekHigh'],
                        low52: json.Technicals?.['52WeekLow'],
                        mcap: json.Highlights?.MarketCapitalization,
                        sector: json.General?.Sector,
                        industry: json.General?.Industry,
                        description: json.General?.Description
                    };
                }
            } catch (e) { 
                console.warn("EODHD Fundamentals Fetch Error", e); 
            }
        }
        
        // Fallback Alpha Vantage
        if (finKeys.alphavantage) {
            const avTicker = ticker.endsWith('.US') ? ticker.replace('.US', '') : ticker;
            const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${avTicker}&apikey=${finKeys.alphavantage}`;
            try {
                const json = await ApiSyncEngine.fetchCached(url, 24 * 60);
                if (json && Object.keys(json).length > 0) {
                    return {
                        yield: json.DividendYield,
                        exDate: json.ExDividendDate,
                        pe: json.PERatio,
                        eps: json.EPS,
                        high52: json['52WeekHigh'],
                        low52: json['52WeekLow'],
                        mcap: json.MarketCapitalization,
                        sector: json.Sector,
                        industry: json.Industry,
                        description: json.Description
                    };
                }
            } catch (e) { 
                console.warn("Alpha Vantage Fundamentals Fetch Error", e); 
            }
        }
        return null;
    }
};

module.exports = ApiSyncEngine;