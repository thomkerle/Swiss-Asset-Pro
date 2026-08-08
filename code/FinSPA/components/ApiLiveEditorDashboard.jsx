// ApiLiveEditorDashboard.jsx
const React = require('react');
const { useState, useEffect, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../components/Icons.jsx') || (({name}) => <span>[{name}]</span>);
const UniversalChart = safeRequire('./../api/UniversalChart.jsx') || safeRequire('../api/UniversalChart.jsx') || (() => <div>UniversalChart Modul nicht gefunden</div>);
const ApiSyncEngine = safeRequire('.././api/ApiSyncEngine.jsx') || { fetchAssetPrice: async () => null, fetchHybrid: async () => null, fetchFundamentals: async () => null };
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};

const { 
    getAllAssets = () => [], 
    formatCurrency = (val) => val,
    getAssetPriceAtDate = () => 0,
    getAssetRawValueAtDate = () => 0,
    generateMonthEnds = (s, e) => [s, e]
} = DataEngine;

const safeT = (t, key, fallback) => {
    if (!t) return fallback;
    const res = t(key);
    return (res && res !== key) ? res : fallback;
};

// Hilfsfunktion zur Formatierung großer Zahlen (Market Cap)
const formatCompactNumber = (number) => {
    if (!number) return '-';
    const n = Number(number);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
    return n.toLocaleString('de-CH');
};

const editorCache = {
    activeTab: 'grid',
    selectedAssets: new Set(),
    searchTerm: '',
    onlyValidTickers: true,
    chartTimeframe: '6m',
    chartMode: 'normalized',
    indicator: 'none',
    useBaseFx: false,
    liveMetrics: {},
    sparklineFxRates: {},
    historyChartData: null,
    intradayChartData: null,
    expandedFundamentals: {}
};

const AssetGridSparkline = ({ asset, dates, isBaseCurrency, fxRates, baseCurrency, t }) => {
    const currency = isBaseCurrency ? baseCurrency : asset.currency;
    
    const history = useMemo(() => {
        return dates.map(d => {
            let nativePrice = getAssetPriceAtDate(asset, d);
            
            if (!nativePrice || nativePrice === 0 || nativePrice === 1) {
                nativePrice = getAssetRawValueAtDate(asset, d) || 0;
            }

            if (isBaseCurrency && asset.currency !== baseCurrency) {
                const rate = fxRates?.[asset.currency]?.[d] || 1;
                return nativePrice * rate;
            }
            return nativePrice;
        });
    }, [asset, dates, isBaseCurrency, fxRates, baseCurrency]);

    if (!history || history.length < 2 || history.every(v => v === 0 || v === history[0])) {
        return (
            <div className="flex flex-col items-center">
                <div className="w-[124px] h-[46px] bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl p-1.5 flex items-center justify-center shadow-sm text-[10px] text-gray-400 italic">
                    N/A
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 tracking-wider">
                    {safeT(t, 'sparklinePerformance', 'Performance')} ({currency})
                </span>
            </div>
        );
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = (max - min) || 0.0001;
    
    const first = history[0];
    const last = history[history.length - 1];
    const isUp = last >= first;
    
    const colorStroke = isUp ? '#10b981' : '#f43f5e';

    const width = 110;
    const height = 34;
    const padX = 6;
    const padY = 6;

    const ptsObj = history.map((val, i) => {
        const x = padX + (i / (history.length - 1)) * (width - 2 * padX);
        const y = (height - padY) - ((val - min) / range) * (height - 2 * padY);
        return { x, y, val };
    });

    const linePath = `M ${ptsObj.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
    const areaPath = `${linePath} L ${(width - padX).toFixed(1)},${height} L ${padX},${height} Z`;

    const firstY = ptsObj[0].y;
    const gradId = `spark-grad-${asset.id || Math.random().toString(36).substr(2, 5)}-${currency}`;

    return (
        <div className="flex flex-col items-center">
            <div className="w-[124px] h-[46px] bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl flex items-center justify-center shadow-sm hover:shadow transition-shadow">
                <svg width={width} height={height} className="overflow-visible">
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colorStroke} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={colorStroke} stopOpacity="0.0" />
                        </linearGradient>
                    </defs>
                    <line x1={padX} y1={firstY} x2={width - padX} y2={firstY} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,3" className="dark:stroke-slate-600" />
                    <path d={areaPath} fill={`url(#${gradId})`} />
                    <path d={linePath} fill="none" stroke={colorStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {ptsObj.map((p, idx) => (
                        <circle key={idx} cx={p.x} cy={p.y} r="2" fill="#ffffff" stroke={colorStroke} strokeWidth="1.5" className="dark:fill-slate-900" />
                    ))}
                    {ptsObj.length > 0 && (
                        <circle cx={ptsObj[ptsObj.length - 1].x} cy={ptsObj[ptsObj.length - 1].y} r="3.5" fill="#ffffff" stroke={colorStroke} strokeWidth="2" className="dark:fill-slate-900" />
                    )}
                </svg>
            </div>
            <span className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 tracking-wider">
                {safeT(t, 'sparklinePerformance', 'Performance')} ({currency})
            </span>
        </div>
    );
};

const calculateSMA = (data, periods) => {
    return data.map((val, idx) => {
        if (idx < periods - 1) return null;
        let sum = 0;
        for (let i = 0; i < periods; i++) sum += data[idx - i];
        return sum / periods;
    });
};

const calculateEMA = (data, periods) => {
    const k = 2 / (periods + 1);
    let emaArray = [];
    let emaPrev = null;
    for (let i = 0; i < data.length; i++) {
        if (i < periods - 1) {
            emaArray.push(null);
        } else if (i === periods - 1) {
            let sum = 0;
            for (let j = 0; j < periods; j++) sum += data[i - j];
            emaPrev = sum / periods;
            emaArray.push(emaPrev);
        } else {
            emaPrev = (data[i] * k) + (emaPrev * (1 - k));
            emaArray.push(emaPrev);
        }
    }
    return emaArray;
};

const ApiLiveEditorDashboard = ({ data, updateTreeData, fCur, t, showToast }) => {
    const [activeTab, setActiveTab] = useState(editorCache.activeTab); 
    const [selectedAssets, setSelectedAssets] = useState(editorCache.selectedAssets);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState(editorCache.searchTerm);
    const [onlyValidTickers, setOnlyValidTickers] = useState(editorCache.onlyValidTickers); 
    
    const [chartTimeframe, setChartTimeframe] = useState(editorCache.chartTimeframe); 
    const [chartMode, setChartMode] = useState(editorCache.chartMode);
    const [indicator, setIndicator] = useState(editorCache.indicator);
    const [useBaseFx, setUseBaseFx] = useState(editorCache.useBaseFx);
    
    const [historyChartData, setHistoryChartData] = useState(editorCache.historyChartData);
    const [intradayChartData, setIntradayChartData] = useState(editorCache.intradayChartData);
    const [isLoadingCharts, setIsLoadingCharts] = useState(false);

    const [liveMetrics, setLiveMetrics] = useState(editorCache.liveMetrics);
    const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
    
    const [sparklineFxRates, setSparklineFxRates] = useState(editorCache.sparklineFxRates);
    const [expandedFundamentals, setExpandedFundamentals] = useState(editorCache.expandedFundamentals);

    useEffect(() => {
        editorCache.activeTab = activeTab;
        editorCache.selectedAssets = selectedAssets;
        editorCache.searchTerm = searchTerm;
        editorCache.onlyValidTickers = onlyValidTickers;
        editorCache.chartTimeframe = chartTimeframe;
        editorCache.chartMode = chartMode;
        editorCache.indicator = indicator;
        editorCache.useBaseFx = useBaseFx;
        editorCache.liveMetrics = liveMetrics;
        editorCache.sparklineFxRates = sparklineFxRates;
        editorCache.historyChartData = historyChartData;
        editorCache.intradayChartData = intradayChartData;
        editorCache.expandedFundamentals = expandedFundamentals;
    }, [
        activeTab, selectedAssets, searchTerm, onlyValidTickers, 
        chartTimeframe, chartMode, indicator, useBaseFx, 
        liveMetrics, sparklineFxRates, historyChartData, intradayChartData, expandedFundamentals
    ]);

    const baseCurrency = data?.settings?.baseCurrency || 'CHF';
    const finKeys = data?.settings?.finApiKeys || {};
    const hasKeys = !!(finKeys.eodhd || finKeys.alphavantage);

    const editableAssets = useMemo(() => {
        const assets = getAllAssets(data?.banks || []);
        return assets.filter(a => 
            !a.isArchived && 
            ['stock', 'fund', 'crypto', 'pension_fund', 'pension_3a_fund', 'managed_fund', 'pension_3a_managed'].includes(a.assetClass)
        );
    }, [data?.banks]);

    const filteredAssets = useMemo(() => {
        return editableAssets.filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (a.ticker && a.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
            const hasTicker = !onlyValidTickers || (a.ticker && a.ticker.trim().length > 0);
            return matchesSearch && hasTicker;
        });
    }, [editableAssets, searchTerm, onlyValidTickers]);

    const sparklineDates = useMemo(() => {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        const startStr = sixMonthsAgo.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];
        return generateMonthEnds(startStr, endStr);
    }, []);

    useEffect(() => {
        const fetchFx = async () => {
            const currencies = [...new Set(editableAssets.map(a => a.currency).filter(c => c && c !== baseCurrency))];
            if (currencies.length === 0) return;

            const startStr = sparklineDates[0];
            const endStr = sparklineDates[sparklineDates.length - 1];
            let newRates = { ...sparklineFxRates };
            let updated = false;

            for (const cur of currencies) {
                if (newRates[cur] && Object.keys(newRates[cur]).length > 0) continue; 
                try {
                    let resData = null;
                    try {
                        const res = await ApiSyncEngine.fetchCached(`https://api.frankfurter.dev/v1/${startStr}..${endStr}?base=${cur}&symbols=${baseCurrency}`, 24 * 60);
                        resData = res;
                    } catch(e) {}
                    
                    if (!resData) {
                        const res2 = await ApiSyncEngine.fetchCached(`https://api.frankfurter.app/${startStr}..${endStr}?base=${cur}&symbols=${baseCurrency}`, 24 * 60);
                        resData = res2;
                    }

                    if (resData && resData.rates) {
                        const curRates = {};
                        sparklineDates.forEach(d => {
                            let dt = new Date(d);
                            let rate = 1;
                            for (let i = 0; i < 7; i++) {
                                const ds = dt.toISOString().split('T')[0];
                                if (resData.rates[ds] && resData.rates[ds][baseCurrency]) {
                                    rate = resData.rates[ds][baseCurrency];
                                    break;
                                }
                                dt.setDate(dt.getDate() - 1);
                            }
                            curRates[d] = rate;
                        });
                        newRates[cur] = curRates;
                        updated = true;
                    }
                } catch (e) {
                    console.warn("FX fetch failed for grid sparklines", e);
                }
            }
            if (updated) setSparklineFxRates(newRates);
        };
        fetchFx();
    }, [editableAssets, baseCurrency, sparklineDates, sparklineFxRates]);

    const getLatestPriceInfo = (asset) => {
        if (!asset.bookings || asset.bookings.length === 0) return { price: asset.price || 0, date: '-' };
        const sorted = [...asset.bookings].sort((a,b) => new Date(b.date) - new Date(a.date));
        const lastSync = sorted.find(b => b.type === 'Wertanpassung' && b.subCategory === 'API Kurs-Sync');
        if (lastSync) return { price: lastSync.price, date: lastSync.date, isApi: true };
        
        const lastPrice = sorted.find(b => ['Kauf', 'Verkauf', 'Wertanpassung'].includes(b.type) && Number(b.price) > 0);
        return { price: lastPrice ? lastPrice.price : (asset.price || 0), date: lastPrice ? lastPrice.date : '-', isApi: false };
    };

    const toggleAssetSelection = (id) => {
        const newSet = new Set(selectedAssets);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedAssets(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
        else setSelectedAssets(new Set());
    };

    const handleInlineUpdate = (assetId, field, value) => {
        const updateRecursive = (nodes) => nodes.map(n => {
            if (n.id === assetId) return { ...n, [field]: value };
            if (n.children) return { ...n, children: updateRecursive(n.children) };
            return n;
        });
        updateTreeData({ banks: updateRecursive(data.banks) });
    };

    const handleToggleFundamentals = async (asset) => {
        if (expandedFundamentals[asset.id]) {
            const newExp = { ...expandedFundamentals };
            delete newExp[asset.id];
            setExpandedFundamentals(newExp);
            return;
        }
        
        if (!asset.ticker) {
            showToast(safeT(t, 'msgNeedsTickerForFund', 'Bitte zuerst einen Ticker eintragen.'), 'warning');
            return;
        }

        const fundData = await ApiSyncEngine.fetchFundamentals({ ticker: asset.ticker, finKeys });
        
        if (fundData) {
            setExpandedFundamentals({ ...expandedFundamentals, [asset.id]: fundData });
        } else {
            showToast(safeT(t, 'msgFundFetchFailed', 'Konnte keine Fundamentaldaten abrufen (API-Limit?).'), 'error');
        }
    };

    const applyAutoValuation = (assetNode) => {
        let copy = { ...assetNode, bookings: [...assetNode.bookings] };
        copy.bookings.sort((a,b) => new Date(a.date) - new Date(b.date));
  
        let totalShares = 0; 
        let runningPrincipalRaw = 0; 
        let finalBookings = []; 
        let lastBookingDate = new Date().toISOString().split('T')[0];
        let latestPrice = 0;
  
        copy.bookings.filter(b => !(b._isAutoValuation || (b.subCategory || '').includes('Auto-Anpassung'))).forEach(b => {
            finalBookings.push(b); 
            if (b.date > lastBookingDate) lastBookingDate = b.date;
  
            if (['Kauf', 'Einzahlung'].includes(b.type)) {
                if (b.shares) totalShares += Number(b.shares);
                runningPrincipalRaw += Number(b.amount || 0);
            } else if (['Verkauf', 'Auszahlung'].includes(b.type)) {
                if (b.shares) totalShares -= Number(b.shares);
                runningPrincipalRaw -= Number(b.amount || 0);
            } else if (b.type === 'Wertanpassung') {
                runningPrincipalRaw += Number(b.amount || 0);
            }
            if (Number(b.price) > 0) latestPrice = Number(b.price);
        });
  
        const currentPriceToUse = Number(assetNode.price) > 0 ? Number(assetNode.price) : latestPrice;
  
        if (totalShares > 0 && currentPriceToUse > 0) {
            const expectedCurrentValue = totalShares * currentPriceToUse;
            const diff = expectedCurrentValue - runningPrincipalRaw;
  
            if (Math.abs(diff) > 0.01) {
                const todayStr = new Date().toISOString().split('T')[0];
                finalBookings.push({
                    id: Math.random().toString(36).substr(2, 9), 
                    date: todayStr > lastBookingDate ? todayStr : lastBookingDate, 
                    type: 'Wertanpassung',
                    subCategory: `Auto-Anpassung (Aktueller Kurs)`,
                    amount: Number(diff.toFixed(2)), 
                    bookingExchangeRate: assetNode.exchangeRate || 1, 
                    _isAutoValuation: true 
                });
            }
        }
        copy.bookings = finalBookings.sort((a,b) => new Date(b.date) - new Date(a.date));
        return copy;
    };

    const fetchLiveMetrics = async () => {
        if (!hasKeys || !finKeys.eodhd) {
            showToast(safeT(t, 'toastReqEodhdLive', 'Für Live-Metriken wird ein EODHD API-Key benötigt.'), 'error');
            return;
        }

        const assetsToFetch = filteredAssets.filter(a => selectedAssets.has(a.id) && a.ticker);
        if (assetsToFetch.length === 0) return;

        setIsFetchingMetrics(true);
        let newMetrics = { ...liveMetrics };

        for (const asset of assetsToFetch) {
            try {
                const rtJson = await ApiSyncEngine.fetchCached(`https://eodhd.com/api/real-time/${asset.ticker}?api_token=${finKeys.eodhd}&fmt=json`, 5);
                
                if (rtJson && rtJson.close !== undefined && rtJson.close !== 'NA') {
                    newMetrics[asset.id] = {
                        price: Number(rtJson.close),
                        change: Number(rtJson.change || 0),
                        change_p: Number(rtJson.change_p || 0),
                        volume: Number(rtJson.volume || 0)
                    };
                }
            } catch (e) {
                console.warn(`Fehler beim Live-Fetch für ${asset.ticker}`, e);
            }
            await new Promise(r => setTimeout(r, 200));
        }

        setLiveMetrics(newMetrics);
        setIsFetchingMetrics(false);
        showToast(safeT(t, 'toastLiveMetricsUpdated', 'Live-Marktdaten aktualisiert.'), 'success');
    };

    const handleBulkSync = async () => {
        if (!hasKeys) {
            showToast(safeT(t, 'msgNoFinApiKeys', 'Keine API-Keys konfiguriert.'), 'error');
            return;
        }

        const assetsToSync = filteredAssets.filter(a => selectedAssets.has(a.id));
        if (assetsToSync.length === 0) return;

        setIsSyncing(true);
        let successCount = 0;
        let failCount = 0;

        let banksCopy = JSON.parse(JSON.stringify(data.banks));

        for (const asset of assetsToSync) {
            if (!asset.ticker && !asset.isin) {
                failCount++;
                continue;
            }

            try {
                const result = await ApiSyncEngine.fetchAssetPrice({
                    assetNode: asset, finKeys, baseCurrency, showToast: null, safeT, t
                });

                if (result && result.price > 0) {
                    const { price, provider, apiDate, currentFxRate, ticker } = result;
                    const fromCurrency = asset.currency;
                    
                    const updateNodeRecursive = (nodes) => {
                        for (let i=0; i<nodes.length; i++) {
                            if (nodes[i].id === asset.id) {
                                let nodeToUpdate = nodes[i];
                                nodeToUpdate.exchangeRate = currentFxRate;
                                if (ticker && !nodeToUpdate.ticker) nodeToUpdate.ticker = ticker;
                                
                                let bookings = [...(nodeToUpdate.bookings || [])];
                                const existingSyncIdx = bookings.findIndex(b => b.date === apiDate && b.type === 'Wertanpassung' && b.subCategory === 'API Kurs-Sync');
                                
                                const newBooking = {
                                    id: Math.random().toString(36).substr(2, 9), date: apiDate, type: 'Wertanpassung',
                                    subCategory: 'API Kurs-Sync', price: price, amount: 0, bookingExchangeRate: currentFxRate,
                                    comment: `#${provider.replace(/\s+/g, '')} Kurs (FX: 1 ${fromCurrency} = ${currentFxRate} ${baseCurrency})`
                                };

                                if (existingSyncIdx >= 0) bookings[existingSyncIdx] = newBooking;
                                else bookings.push(newBooking);

                                nodeToUpdate.bookings = bookings;
                                nodes[i] = applyAutoValuation(nodeToUpdate);
                                return true;
                            }
                            if (nodes[i].children && updateNodeRecursive(nodes[i].children)) return true;
                        }
                        return false;
                    };
                    
                    updateNodeRecursive(banksCopy);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
            
            await new Promise(r => setTimeout(r, 250));
        }

        updateTreeData({ banks: banksCopy });
        setIsSyncing(false);
        showToast(safeT(t, 'msgBulkSyncFinished', `Sync beendet: ${successCount} aktualisiert, ${failCount} fehlgeschlagen.`), successCount > 0 ? 'success' : 'warning');
    };

    const fetchChartData = async () => {
        if (!hasKeys || !finKeys.eodhd) {
            showToast(safeT(t, 'toastReqEodhdCharts', 'Für historische & Intraday-Charts wird ein EODHD API-Key benötigt.'), 'error');
            return;
        }

        const assetsToCompare = editableAssets.filter(a => selectedAssets.has(a.id) && a.ticker);
        if (assetsToCompare.length === 0) {
            showToast(safeT(t, 'toastReqAssetTicker', 'Bitte wähle mindestens ein Asset mit hinterlegtem Ticker aus.'), 'warning');
            return;
        }
        if (chartMode === 'candlestick' && assetsToCompare.length > 1) {
            showToast(safeT(t, 'toastReqSingleAssetCandle', 'Für Candlesticks bitte nur ein einzelnes Asset auswählen.'), 'warning');
            return;
        }

        setIsLoadingCharts(true);
        const toDate = new Date();
        const fromDate = new Date();
        
        if (chartTimeframe === '1m') { fromDate.setMonth(fromDate.getMonth() - 1); }
        else if (chartTimeframe === '6m') { fromDate.setMonth(fromDate.getMonth() - 6); }
        else if (chartTimeframe === 'ytd') { fromDate.setMonth(0, 1); }
        else if (chartTimeframe === '1y') { fromDate.setFullYear(fromDate.getFullYear() - 1); }
        else if (chartTimeframe === '5y') { fromDate.setFullYear(fromDate.getFullYear() - 5); }

        const unbufferedStartDateStr = fromDate.toISOString().split('T')[0];
        let neededBuffer = 0;
        if (indicator === 'sma50') neededBuffer = 50;
        else if (indicator === 'sma200') neededBuffer = 200;
        else if (indicator === 'ema20' || indicator === 'bollinger') neededBuffer = 20;

        if (neededBuffer > 0) {
            fromDate.setDate(fromDate.getDate() - Math.ceil(neededBuffer * 1.5)); 
        }

        const fmtFrom = fromDate.toISOString().split('T')[0];
        const fmtTo = toDate.toISOString().split('T')[0];

        const intraFromDate = new Date();
        intraFromDate.setDate(intraFromDate.getDate() - 14);
        const unixIntraFrom = Math.floor(intraFromDate.getTime() / 1000);
        const unixTo = Math.floor(toDate.getTime() / 1000);

        let seriesHistoryData = [];
        let seriesIntradayData = [];
        let commonHistoryDates = new Set();
        let commonIntradayDates = new Set();
        let fxRatesCache = {};

        if (useBaseFx) {
            const uniqueCurrencies = [...new Set(assetsToCompare.map(a => a.currency).filter(c => c && c !== baseCurrency))];
            for (const cur of uniqueCurrencies) {
                let rates = null;
                try {
                    const res = await ApiSyncEngine.fetchCached(`https://api.frankfurter.dev/v1/${fmtFrom}..${fmtTo}?base=${cur}&symbols=${baseCurrency}`, 12 * 60);
                    if (res && res.rates && Object.keys(res.rates).length > 0) rates = res.rates;
                } catch(e) { }

                if (!rates) {
                    try {
                        const res = await ApiSyncEngine.fetchCached(`https://api.frankfurter.app/${fmtFrom}..${fmtTo}?base=${cur}&symbols=${baseCurrency}`, 12 * 60);
                        if (res && res.rates && Object.keys(res.rates).length > 0) rates = res.rates;
                    } catch(e) { }
                }

                if (rates) {
                    fxRatesCache[cur] = rates;
                } else {
                    fxRatesCache[cur] = { "fallback": 1 };
                }
            }
        }

        for (const asset of assetsToCompare) {
            try {
                const urlHist = `https://eodhd.com/api/eod/${asset.ticker}?from=${fmtFrom}&to=${fmtTo}&period=d&api_token=${finKeys.eodhd}&fmt=json`;
                const urlIntra = `https://eodhd.com/api/intraday/${asset.ticker}?api_token=${finKeys.eodhd}&interval=5m&fmt=json&from=${unixIntraFrom}&to=${unixTo}`;
                const urlRealTime = `https://eodhd.com/api/real-time/${asset.ticker}?api_token=${finKeys.eodhd}&fmt=json`;

                const [jsonHist, jsonIntra] = await Promise.all([
                    ApiSyncEngine.fetchCached(urlHist, 12 * 60).catch(() => null), // EOD wird 12h gecacht
                    ApiSyncEngine.fetchCached(urlIntra, 5).catch(() => null)       // Intraday wird 5 Min gecacht
                ]);

                if (Array.isArray(jsonHist) && jsonHist.length > 0) {
                    let dataPoints = jsonHist.map(point => {
                        const fxDate = point.date;
                        let rate = 1;
                        if (useBaseFx && asset.currency && asset.currency !== baseCurrency) {
                            const cache = fxRatesCache[asset.currency];
                            if (cache && !cache.fallback) {
                                if (cache[fxDate] && cache[fxDate][baseCurrency]) rate = cache[fxDate][baseCurrency];
                                else {
                                    let dt = new Date(fxDate);
                                    for(let i=0; i<7; i++) {
                                        dt.setDate(dt.getDate()-1);
                                        if (cache[dt.toISOString().split('T')[0]] && cache[dt.toISOString().split('T')[0]][baseCurrency]) {
                                            rate = cache[dt.toISOString().split('T')[0]][baseCurrency];
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        return { date: point.date, open: Number(point.open)*rate, high: Number(point.high)*rate, low: Number(point.low)*rate, close: Number(point.close)*rate };
                    });
                    dataPoints.forEach(p => commonHistoryDates.add(p.date));
                    seriesHistoryData.push({ asset: asset.name, data: dataPoints });
                }

                let intraDataPoints = [];
                if (Array.isArray(jsonIntra) && jsonIntra.length > 0) {
                    const validPoints = jsonIntra.filter(p => p.datetime);
                    if (validPoints.length > 0) {
                        const allAvailableDates = [...new Set(validPoints.map(p => p.datetime.split(' ')[0]))].sort();
                        const lastTradingDay = allAvailableDates[allAvailableDates.length - 1];
                        intraDataPoints = validPoints.filter(p => p.datetime.startsWith(lastTradingDay));
                    }
                }

                if (intraDataPoints.length === 0) {
                    try {
                        const rtJson = await ApiSyncEngine.fetchCached(urlRealTime, 5);
                        if (rtJson && rtJson.close !== undefined && rtJson.close !== 'NA') {
                            const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
                            intraDataPoints = [{
                                datetime: nowStr,
                                open: Number(rtJson.open || rtJson.close),
                                high: Number(rtJson.high || rtJson.close),
                                low: Number(rtJson.low || rtJson.close),
                                close: Number(rtJson.close)
                            }];
                        }
                    } catch (rtErr) {
                        console.warn("Intraday RT Fallback fehlgeschlagen:", rtErr);
                    }
                }

                if (intraDataPoints.length > 0) {
                    const formattedIntra = intraDataPoints.map(point => {
                        const pointDateStr = point.datetime || point.date;
                        return { 
                            date: pointDateStr, 
                            open: Number(point.open), 
                            high: Number(point.high), 
                            low: Number(point.low), 
                            close: Number(point.close) 
                        };
                    });
                    formattedIntra.forEach(p => commonIntradayDates.add(p.date));
                    seriesIntradayData.push({ asset: asset.name, data: formattedIntra });
                }

            } catch (e) {
                console.warn(`Fehler beim Fetch für ${asset.ticker}`, e);
            }
        }

        const buildChartState = (seriesData, commonDates, isIntraday) => {
            if (seriesData.length === 0) return null;
            const sortedDates = Array.from(commonDates).sort();
            const datasets = [];

            seriesData.forEach((series, sIndex) => {
                let lastClose = null;
                const filledCloses = sortedDates.map(date => {
                    const pt = series.data.find(d => d.date === date);
                    if (pt) { lastClose = pt.close; return pt.close; }
                    return lastClose; 
                });

                if (chartMode === 'candlestick') {
                    const candleData = sortedDates.map(date => {
                        const pt = series.data.find(d => d.date === date);
                        return pt ? [pt.open, pt.close, pt.low, pt.high] : null; 
                    });
                    datasets.push({ label: series.asset, type: 'candlestick', data: candleData });
                } else {
                    const startValStr = isIntraday ? sortedDates[0] : unbufferedStartDateStr;
                    const firstValidPrice = series.data.find(d => d.date >= startValStr)?.close || 1;
                    const normalizedData = sortedDates.map(date => {
                        const pt = series.data.find(d => d.date === date);
                        if (!pt) return null; 
                        return chartMode === 'normalized' ? ((pt.close / firstValidPrice) * 100) - 100 : pt.close;
                    });
                    datasets.push({
                        label: series.asset, type: 'line', data: normalizedData,
                        valueFormatter: chartMode === 'normalized' ? (val) => `${val.toFixed(2)}%` : (val) => val.toFixed(2)
                    });
                }

                if (indicator !== 'none' && chartMode !== 'normalized') {
                    let indData = [];
                    let color = sIndex === 0 ? '#f59e0b' : '#3b82f6';
                    if (indicator === 'sma50') {
                        indData = calculateSMA(filledCloses, 50);
                        datasets.push({ label: `SMA 50`, type: 'line', data: indData, itemStyle: { color }, lineStyle: { type: 'dashed', width: 2 }, symbol: 'none' });
                    } else if (indicator === 'sma200') {
                        indData = calculateSMA(filledCloses, 200);
                        datasets.push({ label: `SMA 200`, type: 'line', data: indData, itemStyle: { color: '#ef4444' }, lineStyle: { type: 'dashed', width: 2 }, symbol: 'none' });
                    } else if (indicator === 'ema20') {
                        indData = calculateEMA(filledCloses, 20);
                        datasets.push({ label: `EMA 20`, type: 'line', data: indData, itemStyle: { color: '#8b5cf6' }, lineStyle: { type: 'solid', width: 2 }, symbol: 'none' });
                    }
                }
            });

            let displayDates = sortedDates;
            if (neededBuffer > 0 && !isIntraday) {
                let cutIndex = sortedDates.findIndex(d => d >= unbufferedStartDateStr);
                if (cutIndex < 0) cutIndex = 0;
                displayDates = sortedDates.slice(cutIndex);
                datasets.forEach(ds => { ds.data = ds.data.slice(cutIndex); });
            }

            return { labels: displayDates, datasets };
        };

        setHistoryChartData(buildChartState(seriesHistoryData, commonHistoryDates, false));
        setIntradayChartData(buildChartState(seriesIntradayData, commonIntradayDates, true));
        setIsLoadingCharts(false);
    };

    return (
        <div className="p-8 h-full bg-white dark:bg-slate-950 flex flex-col finspa-scrollbar relative">
            <div className="flex justify-between items-end border-b border-gray-200 dark:border-slate-800 pb-6 mb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                            <Icon name="Cloud" className="text-indigo-600 dark:text-indigo-400" size={24}/>
                        </div>
                        {safeT(t, 'titleLiveEditor', 'API LiveEditor')}
                    </h2>
                    <p className="text-gray-500 text-sm mt-2">{safeT(t, 'subLiveEditor', 'Zentrale Verwaltung und Live-Abgleich aller börsengehandelten Assets.')}</p>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('grid')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                        <Icon name="List" size={16}/> {safeT(t, 'liveEditorTabGrid', 'Data Grid')}
                    </button>
                    <button onClick={() => setActiveTab('charts')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'charts' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                        <Icon name="TrendingUp" size={16}/> {safeT(t, 'liveEditorTabCharts', 'Chart Vergleiche')}
                    </button>
                </div>
            </div>

            {!hasKeys && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl flex items-start gap-3 shrink-0">
                    <Icon name="AlertTriangle" className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">{safeT(t, 'warnNoApiKeysTitle', 'Fehlende API Konfiguration')}</h4>
                        <p className="text-amber-700 dark:text-amber-500/80 text-xs mt-1">{safeT(t, 'warnNoApiKeysDesc', 'Um Live-Kurse abzurufen, müssen in den Einstellungen gültige API Keys für EODHD oder Alpha Vantage hinterlegt werden.')}</p>
                    </div>
                </div>
            )}

            {activeTab === 'grid' && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 p-4 border border-b-0 border-gray-200 dark:border-slate-700 rounded-t-xl shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder={safeT(t, 'liveEditorSearchPlaceholder', 'Assets durchsuchen...')} 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={onlyValidTickers} 
                                    onChange={(e) => setOnlyValidTickers(e.target.checked)} 
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                />
                                {safeT(t, 'liveEditorOnlyTicker', 'Nur mit Ticker')}
                            </label>
                            
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-2">
                                {selectedAssets.size} / {filteredAssets.length} {safeT(t, 'liveEditorMarked', 'markiert')}
                            </span>
                            
                            <button 
                                onClick={fetchLiveMetrics} 
                                disabled={isFetchingMetrics || selectedAssets.size === 0 || !hasKeys}
                                className="flex items-center gap-2 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                {isFetchingMetrics ? <Icon name="Loader" className="animate-spin" size={14}/> : <Icon name="Activity" size={14}/>}
                                {safeT(t, 'btnLoadLiveMetrics', 'Marktdaten (Live) laden')}
                            </button>
                        </div>
                        <button 
                            onClick={handleBulkSync} 
                            disabled={isSyncing || selectedAssets.size === 0 || !hasKeys}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all ${isSyncing || selectedAssets.size === 0 || !hasKeys ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
                        >
                            {isSyncing ? <><Icon name="Loader" className="animate-spin" size={16}/> {safeT(t, 'btnSyncRunning', 'Sync läuft...')}</> : <><Icon name="RefreshCw" size={16}/> {safeT(t, 'btnBulkSync', 'Markierte aktualisieren')}</>}
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto border border-gray-200 dark:border-slate-700 rounded-b-xl finspa-scrollbar">
                        <table className="w-full text-left text-sm border-collapse bg-white dark:bg-slate-900">
                            <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 w-10 border-b border-gray-200 dark:border-slate-700">
                                        <input type="checkbox" checked={selectedAssets.size === filteredAssets.length && filteredAssets.length > 0} onChange={handleSelectAll} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                                    </th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">{safeT(t, 'colAssetName', 'Asset Name')}</th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">{safeT(t, 'colTicker', 'Ticker (API)')}</th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 text-right">{safeT(t, 'colToday', 'Heute (%)')}</th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 text-right">{safeT(t, 'colLocalPrice', 'Lokaler Kurs')}</th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 text-center w-64">{safeT(t, 'colTrend', 'Trend (6M)')}</th>
                                    <th className="p-3 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">{safeT(t, 'colLastSync', 'Letzter API Sync')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                {filteredAssets.map(asset => {
                                    const { price, date, isApi } = getLatestPriceInfo(asset);
                                    const isSelected = selectedAssets.has(asset.id);
                                    const metrics = liveMetrics[asset.id];
                                    const fundData = expandedFundamentals[asset.id];
                                    const isFundExpanded = !!fundData;
                                    
                                    return (
                                        <React.Fragment key={asset.id}>
                                            <tr className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleAssetSelection(asset.id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{asset.name}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-2 mt-0.5">
                                                        <span>{asset.assetClass}</span>
                                                        <span className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">{asset.currency}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={asset.ticker || ''} 
                                                        onChange={e => handleInlineUpdate(asset.id, 'ticker', e.target.value.toUpperCase())}
                                                        placeholder="z.B. AAPL.US"
                                                        className="w-28 p-1.5 text-xs font-mono uppercase bg-transparent border border-gray-300 dark:border-slate-600 rounded hover:bg-white dark:hover:bg-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                    />
                                                    <button 
                                                        onClick={() => handleToggleFundamentals(asset)} 
                                                        className={`p-1.5 rounded transition-colors ${isFundExpanded ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-gray-100 text-gray-400 hover:text-indigo-500 dark:bg-slate-800'}`}
                                                        title={safeT(t, 'btnShowFundamentals', 'Fundamentaldaten & Dividenden anzeigen')}
                                                    >
                                                        <Icon name="Info" size={14} />
                                                    </button>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {metrics ? (
                                                        <div className={`font-mono font-bold ${metrics.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {metrics.change >= 0 ? '+' : ''}{metrics.change_p.toFixed(2)}%
                                                            <div className="text-[10px] opacity-70">
                                                                {metrics.change >= 0 ? '+' : ''}{metrics.change.toFixed(2)} {asset.currency}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 dark:text-slate-600">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {price > 0 ? (
                                                            asset.currency && asset.currency !== baseCurrency ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span>{fCur ? fCur(price * (asset.exchangeRate || 1), baseCurrency) : (price * (asset.exchangeRate || 1)).toLocaleString('de-CH', {minimumFractionDigits: 2})}</span>
                                                                    <span className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">
                                                                        {fCur ? fCur(price, asset.currency) : price.toLocaleString('de-CH', {minimumFractionDigits: 2})} | FX: {asset.exchangeRate || 1}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                fCur ? fCur(price, baseCurrency) : price.toLocaleString('de-CH', {minimumFractionDigits: 2})
                                                            )
                                                        ) : '-'}
                                                    </div>
                                                    {metrics && metrics.price && metrics.price !== price && (
                                                        <div className="text-[10px] text-blue-500 font-mono mt-1" title="Kurs der Live-Metrik">Live: {metrics.price.toFixed(2)}</div>
                                                    )}
                                                </td>
                                                
                                                <td className="p-3 align-middle">
                                                    <div className="flex justify-center gap-4">
                                                        <AssetGridSparkline 
                                                            asset={asset} 
                                                            dates={sparklineDates} 
                                                            isBaseCurrency={false} 
                                                            baseCurrency={baseCurrency} 
                                                            t={t}
                                                        />
                                                        
                                                        {asset.currency && asset.currency !== baseCurrency && (
                                                            <AssetGridSparkline 
                                                                asset={asset} 
                                                                dates={sparklineDates} 
                                                                isBaseCurrency={true} 
                                                                fxRates={sparklineFxRates} 
                                                                baseCurrency={baseCurrency} 
                                                                t={t}
                                                            />
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="p-3">
                                                    {isApi ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded text-xs font-bold font-mono">
                                                            <Icon name="Check" size={12}/> {date}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Nie (Manuell: {date})</span>
                                                    )}
                                                </td>
                                            </tr>
                                            {isFundExpanded && (
                                                <tr className="bg-indigo-50/40 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30 shadow-inner">
                                                    <td colSpan="7" className="p-4 px-10">
                                                        <div className="flex flex-wrap gap-8 items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundDivYield', 'Div. Rendite')}</span>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {fundData.yield ? (Number(fundData.yield) * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundExDate', 'Ex-Datum')}</span>
                                                                <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                                                                    {fundData.exDate || '-'}
                                                                </span>
                                                            </div>
                                                            <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundPE', 'KGV (P/E)')}</span>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {fundData.pe ? Number(fundData.pe).toFixed(2) : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundEPS', 'Gewinn (EPS)')}</span>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {fundData.eps ? Number(fundData.eps).toFixed(2) : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundMCap', 'Marktkapitalisierung')}</span>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {formatCompactNumber(fundData.mcap)}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fund52W', '52W Hoch / Tief')}</span>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {fundData.high52 && fundData.low52 ? `${Number(fundData.high52).toFixed(2)} / ${Number(fundData.low52).toFixed(2)}` : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800"></div>
                                                            <div className="flex flex-col max-w-[200px]">
                                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{safeT(t, 'fundSector', 'Sektor / Industrie')}</span>
                                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={`${fundData.sector} / ${fundData.industry}`}>
                                                                    {fundData.sector || '-'} <span className="font-normal opacity-70">/ {fundData.industry || '-'}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredAssets.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-500 italic">
                                            {safeT(t, 'msgNoAssetsFound', 'Keine passenden Assets gefunden.')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'charts' && (
                <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
                    <div className="flex flex-wrap gap-6 justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Icon name="Activity" className="text-indigo-500"/> {safeT(t, 'titlePerformanceAnalyser', 'Performance Analyser')}</h3>
                            <p className="text-xs text-gray-500 mt-1">{safeT(t, 'subPerformanceAnalyser', 'Historische Daten inkl. Indikatoren und Intraday-Support.')}</p>
                        </div>
                        
                        <div className="flex items-center flex-wrap gap-4 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                            <select 
                                value={chartMode} 
                                onChange={(e) => setChartMode(e.target.value)}
                                className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 text-xs outline-none"
                            >
                                <option value="normalized">{safeT(t, 'chartModeRelative', 'Relativ (%)')}</option>
                                <option value="absolute">{safeT(t, 'chartModeAbsolute', 'Absolut (Preis)')}</option>
                                <option value="candlestick">{safeT(t, 'chartModeCandlestick', 'Candlestick (OHLC)')}</option>
                            </select>

                            <select 
                                value={indicator} 
                                onChange={(e) => setIndicator(e.target.value)}
                                disabled={chartMode === 'normalized'}
                                className={`bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 text-xs outline-none ${chartMode === 'normalized' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="none">{safeT(t, 'indicatorNone', 'Kein Indikator')}</option>
                                <option value="sma50">SMA 50</option>
                                <option value="sma200">SMA 200</option>
                                <option value="ema20">EMA 20</option>
                                <option value="bollinger">Bollinger Bands</option>
                            </select>

                            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer" title={`Historische Kurse in ${baseCurrency} umrechnen`}>
                                <input type="checkbox" checked={useBaseFx} onChange={e => setUseBaseFx(e.target.checked)} className="rounded text-indigo-600" />
                                FX: {baseCurrency}
                            </label>

                            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1"></div>
                            
                            <div className="flex gap-1">
                                {['1m', '6m', 'ytd', '1y', '5y'].map(tf => (
                                    <button 
                                        key={tf} 
                                        onClick={() => setChartTimeframe(tf)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded uppercase transition-colors ${chartTimeframe === tf ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                            
                            <button 
                                onClick={fetchChartData}
                                disabled={isLoadingCharts || selectedAssets.size === 0 || !hasKeys}
                                className={`ml-2 flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all ${isLoadingCharts || selectedAssets.size === 0 || !hasKeys ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}
                            >
                                {isLoadingCharts ? <Icon name="Loader" className="animate-spin" size={14}/> : <Icon name="Play" size={14}/>} {safeT(t, 'btnRenderChart', 'Rendern')}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 relative overflow-hidden flex flex-col xl:flex-row gap-4">
                        {isLoadingCharts && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                                <Icon name="Loader" className="animate-spin text-indigo-500 mb-4" size={32} />
                                <p className="font-bold text-slate-700 dark:text-slate-300">{safeT(t, 'msgLoadingMarketData', 'Lade Marktdaten...')}</p>
                            </div>
                        )}
                        
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col relative overflow-hidden">
                            <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 text-xs font-bold text-gray-500 dark:text-gray-400">
                                {safeT(t, 'titleHistoryEod', 'Historie (EOD)')} - {chartTimeframe.toUpperCase()}
                            </div>
                            <div className="flex-1 relative p-4">
                                {historyChartData && historyChartData.datasets.length > 0 ? (
                                    <UniversalChart 
                                        engine={data?.settings?.chartEngine || 'echarts'} 
                                        type={chartMode === 'candlestick' ? 'candlestick' : 'line'} 
                                        height="100%" 
                                        labels={historyChartData.labels} 
                                        datasets={historyChartData.datasets} 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                        <Icon name="BarChart2" size={48} className="mb-4 opacity-20 text-indigo-500"/>
                                        <p className="text-sm">{safeT(t, 'msgNoHistoryData', 'Keine Historiendaten.')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col relative overflow-hidden">
                            <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 text-xs font-bold text-gray-500 dark:text-gray-400">
                                {safeT(t, 'titleIntraday', 'Intraday / Real-Time - Aktueller Handelstag')}
                            </div>
                            <div className="flex-1 relative p-4">
                                {intradayChartData && intradayChartData.datasets.length > 0 ? (
                                    <UniversalChart 
                                        engine={data?.settings?.chartEngine || 'echarts'} 
                                        type={chartMode === 'candlestick' ? 'candlestick' : 'line'} 
                                        height="100%" 
                                        labels={intradayChartData.labels} 
                                        datasets={intradayChartData.datasets} 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-center px-4">
                                        <Icon name="Activity" size={48} className="mb-4 opacity-20 text-indigo-500"/>
                                        <p className="text-sm font-bold">{safeT(t, 'msgNoIntradayData', 'Keine Intraday-Daten.')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

module.exports = ApiLiveEditorDashboard;