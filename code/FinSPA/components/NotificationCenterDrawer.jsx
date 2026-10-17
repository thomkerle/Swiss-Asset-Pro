/**
 * @file NotificationCenterDrawer.jsx
 * @description Rein informative Mitteilungszentrale für FinBundle Pro.
 * Behebt doppelte Ticker-Keys, visualisiert Kurs-Kacheln mit 5%-Handlungssignal und bietet direkte History-Navigation.
 */

const React = require('react');
const { useState, useEffect } = React;
const Icon = require('./Icons.jsx');

const resolveModuleClass = (pathPart, globalName) => {
  if (typeof window !== 'undefined' && typeof window[globalName] === 'function') {
    return window[globalName];
  }
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k.includes(pathPart));
    if (foundKey) {
      const exp = window.__FinSPAModules[foundKey].exports;
      if (typeof exp === 'function') return exp;
      if (exp && typeof exp.default === 'function') return exp.default;
      if (exp && typeof exp[globalName] === 'function') return exp[globalName];
    }
  }
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    try {
      const r = window.require(pathPart);
      if (typeof r === 'function') return r;
      if (r && typeof r.default === 'function') return r.default;
      if (r && typeof r[globalName] === 'function') return r[globalName];
    } catch (e) {}
  }
  try {
    const r = require(`../api/${pathPart}`);
    if (typeof r === 'function') return r;
    if (r && typeof r.default === 'function') return r.default;
    if (r && typeof r[globalName] === 'function') return r[globalName];
  } catch (e) {}
  return null;
};

const NotificationCenterDrawer = ({ data, updateTreeData, setSelectedNode, setActiveReport, setViewMode, isOpen, onClose, fCur, t }) => {
  const [activeTab, setActiveTab] = useState('movers');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL', 'ACTION', 'UP', 'DOWN'
  const [centerData, setCenterData] = useState({ movers: [], fxAlerts: [], recentBookings: [], history: [], actionCount: 0, totalUnread: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Fallbacks auf Window-Ebene, falls Props in Zwischen-Hierarchien fehlen
  const doSetSelectedNode = setSelectedNode || (typeof window !== 'undefined' && window.__finspaSetSelectedNode);
  const doSetActiveReport = setActiveReport || (typeof window !== 'undefined' && window.__finspaSetActiveReport);
  const doSetViewMode = setViewMode || (typeof window !== 'undefined' && window.__finspaSetViewMode);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const EngineClass = resolveModuleClass('ActivityNotificationEngine.js', 'ActivityNotificationEngine');
      if (typeof EngineClass === 'function') {
        const engine = new EngineClass(data, updateTreeData);
        const compiled = await engine.compileCenterData();
        setCenterData(compiled);
      }
    } catch (e) {
      console.warn('[NotificationCenter] Fehler beim Laden:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- NAHTLOSE HISTORY-NAVIGATION: Exaktes Wiederherstellen des Zustands ---
  const handleNavigateToHistoryItem = (item) => {
    if (!item) return;

    // 1. Alle Nodes rekursiv durchsuchen (Assets, Kategorien, Banken)
    const getAllNodes = (nodes) => {
      let res = [];
      (nodes || []).forEach(n => {
        res.push(n);
        if (n.children) res = res.concat(getAllNodes(n.children));
      });
      return res;
    };

    const allNodes = getAllNodes(data?.banks || []);
    const targetNode = allNodes.find(n => n.id === item.id);

    // Wenn es ein Asset oder Bankknoten ist: ZUERST ansteuern und Reports deaktivieren!
    if (targetNode) {
      if (doSetViewMode) doSetViewMode(item.viewMode || 'vermoegen');
      if (doSetActiveReport) doSetActiveReport(null);
      if (doSetSelectedNode) doSetSelectedNode(targetNode);
      onClose();
      return;
    }

    // 2. Budget-Position aufrufen
    if (item.budgetType && data?.budget) {
      const groupItems = data.budget[item.budgetType] || [];
      const foundBudget = groupItems.find(b => b.id === item.id);
      if (foundBudget) {
        if (doSetViewMode) doSetViewMode('budget');
        if (doSetActiveReport) doSetActiveReport(null);
        if (doSetSelectedNode) doSetSelectedNode({ ...foundBudget, budgetType: item.budgetType });
        onClose();
        return;
      }
    }

    // 3. Reiner Report-Aufruf
    const reportId = (item.id && String(item.id).startsWith('rep_')) 
      ? String(item.id).replace('rep_', '') 
      : (item.type === 'report' ? (item.activeReport || item.id) : null);

    if (reportId) {
      if (doSetViewMode) doSetViewMode('vermoegen');
      if (doSetActiveReport) doSetActiveReport(reportId);
      if (doSetSelectedNode) doSetSelectedNode(null);
      onClose();
      return;
    }

    // 4. Fallback für reine Ansichten (z.B. budget, ai, liveEditor, datensicht)
    if (item.viewMode && doSetViewMode) {
      doSetViewMode(item.viewMode);
      if (doSetActiveReport) doSetActiveReport(null);
      if (doSetSelectedNode) doSetSelectedNode(null);
      onClose();
    }
  };

  const handleSelectAssetById = (assetId) => {
    const getAll = (nodes) => {
      let res = [];
      (nodes || []).forEach(n => {
        if (n.type === 'asset') res.push(n);
        if (n.children) res = res.concat(getAll(n.children));
      });
      return res;
    };
    const all = getAll(data?.banks || []);
    const target = all.find(a => a.id === assetId);
    if (target) {
      if (doSetSelectedNode) doSetSelectedNode(target);
      if (doSetActiveReport) doSetActiveReport(null);
      if (doSetViewMode) doSetViewMode('vermoegen');
      onClose();
    }
  };

  const displayedTiles = centerData.movers.filter(m => {
    if (filterMode === 'ACTION') return m.requiresAction;
    if (filterMode === 'UP') return m.isUp;
    if (filterMode === 'DOWN') return !m.isUp;
    return true;
  });

  const baseCur = data?.settings?.baseCurrency || 'CHF';

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-200 dark:border-slate-800 flex flex-col animate-slide-left">
          
          {/* Header */}
          <div className="p-4 px-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-850/80 backdrop-blur-md flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                <Icon name="Activity" size={16} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Mitteilungszentrale</span>
                  {centerData.actionCount > 0 && (
                    <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse font-mono">
                      {centerData.actionCount} Signal(e)
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Marktradar (10-Min-Takt) & Navigations-History
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={loadNotifications} 
                disabled={isLoading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Aktualisieren"
              >
                <Icon name="RefreshCw" size={14} className={isLoading ? "animate-spin text-blue-500" : ""} />
              </button>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 dark:border-slate-800 px-4 gap-2 pt-2 bg-white dark:bg-slate-900 shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('movers')}
              className={`pb-2.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'movers' 
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span>Börsen-Radar</span>
              {centerData.movers.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  centerData.actionCount > 0 
                    ? 'bg-amber-500 text-white animate-pulse' 
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                }`}>
                  {centerData.movers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`pb-2.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'bookings' 
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span>Buchungs-Audit</span>
              {centerData.recentBookings.length > 0 && (
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {centerData.recentBookings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history' 
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span>Verlauf</span>
              <span className="text-[9px] text-gray-400 font-mono">({centerData.history.length})</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto finspa-scrollbar p-5 space-y-4">
            
            {/* TAB 1: BÖRSEN-RADAR */}
            {activeTab === 'movers' && (
              <div className="space-y-4">
                
                {/* Filter-Leiste */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px] font-bold">
                    <button
                      onClick={() => setFilterMode('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'ALL' 
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' 
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      Alle ({centerData.movers.length})
                    </button>
                    <button
                      onClick={() => setFilterMode('ACTION')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        filterMode === 'ACTION' 
                          ? 'bg-amber-500 text-white shadow-xs font-black' 
                          : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <span>⚠️ ≥ 5% ({centerData.actionCount})</span>
                    </button>
                    <button
                      onClick={() => setFilterMode('UP')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'UP' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      ▲ Gewinner
                    </button>
                    <button
                      onClick={() => setFilterMode('DOWN')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'DOWN' 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      ▼ Verlierer
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-gray-400">
                    Takt: 10 Min.
                  </span>
                </div>

                {displayedTiles.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-slate-850 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-400 text-xs">
                    {centerData.movers.length === 0 
                      ? 'Keine Wertschriften mit Ticker gefunden oder EODHD-API liefert keine Daten.'
                      : 'Keine Positionen für diesen Filter vorhanden.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {displayedTiles.map((tile, idx) => {
                      const isUp = tile.isUp;
                      const hasAction = tile.requiresAction;

                      return (
                        <div
                          key={`${tile.assetId || tile.ticker}_${idx}`}
                          onClick={() => handleSelectAssetById(tile.assetId)}
                          className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group shadow-xs ${
                            hasAction 
                              ? 'border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse' 
                              : (isUp
                                  ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/15 hover:border-emerald-400'
                                  : 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/15 hover:border-rose-400')
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1 mb-1.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-mono text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 shrink-0">
                                  {tile.ticker}
                                </span>
                                {tile.bankName && (
                                  <span className="text-[10px] text-gray-400 truncate">
                                    {tile.bankName}
                                  </span>
                                )}
                              </div>

                              {hasAction && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-white shrink-0">
                                  Signal ≥ 5%
                                </span>
                              )}
                            </div>

                            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={tile.name}>
                              {tile.name}
                            </h5>
                          </div>

                          <div className="my-3 py-2 px-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] text-gray-400 block uppercase font-mono">Buchungskurs</span>
                              <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                                {tile.lastBookedPrice.toFixed(2)} {tile.currency}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <div className={`p-1 rounded-lg ${isUp ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'}`}>
                                <Icon name={isUp ? "TrendingUp" : "TrendingDown"} size={14} />
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-gray-400 block uppercase font-mono">Live (EODHD)</span>
                                <span className="text-xs font-mono font-black text-slate-900 dark:text-white">
                                  {tile.livePrice.toFixed(2)} {tile.currency}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-end text-xs font-mono pt-1">
                            <div>
                              <span className="text-[9px] text-gray-400 block font-sans">Effekt ({baseCur})</span>
                              <strong className={`font-black text-xs ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isUp ? '+' : ''}{tile.totalGainLossBase.toFixed(2)} {baseCur}
                              </strong>
                            </div>

                            <div className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                              isUp 
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300' 
                                : 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                            }`}>
                              {isUp ? '+' : ''}{tile.diffPct}%
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Devisen-Schwankungen */}
                {centerData.fxAlerts.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <Icon name="Globe" size={12} className="text-indigo-500" /> 
                      Devisen vs. Basiswährung ({baseCur})
                    </h4>
                    <div className="space-y-1.5">
                      {centerData.fxAlerts.map((fx, idx) => (
                        <div key={`${fx.pair}_${idx}`} className="p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
                          <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{fx.pair}</span>
                          <div className="text-right font-mono">
                            <span className="text-gray-400 text-[11px] mr-2">Rate: {fx.currentRate.toFixed(4)}</span>
                            <span className={`font-bold ${fx.direction === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {fx.direction === 'UP' ? '+' : ''}{fx.diffPct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BUCHUNGS-AUDIT */}
            {activeTab === 'bookings' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span className="font-black uppercase tracking-wider">Kürzlich verbucht (letzte 2 Stunden / Heute)</span>
                  <span className="font-mono">{centerData.recentBookings.length} Einträge</span>
                </div>

                {centerData.recentBookings.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs">
                    In den letzten Stunden wurden keine neuen Buchungen erfasst.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {centerData.recentBookings.map((b, idx) => (
                      <div 
                        key={`${b.id || 'b'}_${b.assetId || ''}_${idx}`}
                        onClick={() => handleSelectAssetById(b.assetId)}
                        className="p-3 bg-white dark:bg-slate-855 rounded-xl border border-gray-200/80 dark:border-slate-700/80 hover:border-blue-400 cursor-pointer transition-all flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                            <span className="truncate">{b.assetName}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              b.type === 'Einzahlung' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {b.category}
                            </span>
                          </div>
                          {b.comment && (
                            <div className="text-[11px] text-gray-400 truncate mt-0.5">{b.comment}</div>
                          )}
                        </div>

                        <div className="text-right shrink-0 font-mono font-bold">
                          <span className={b.type === 'Einzahlung' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'}>
                            {b.type === 'Einzahlung' ? '+' : '-'}{Number(b.amount || 0).toFixed(2)} {b.currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: VERLAUF */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span className="font-black uppercase tracking-wider">Zuletzt besucht (letzte 10 Elemente)</span>
                  <span className="text-[10px]">Klick springt direkt dorthin</span>
                </div>

                {centerData.history.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs">
                    Noch kein Verlauf aufgezeichnet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {centerData.history.map((item, idx) => (
                      <div 
                        key={`${item.id || 'h'}_${item.timestamp || ''}_${idx}`}
                        onClick={() => handleNavigateToHistoryItem(item)}
                        className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-gray-200/70 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800 cursor-pointer transition-all flex justify-between items-center text-xs group"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-1 rounded-md bg-gray-100 dark:bg-slate-800 text-blue-500 group-hover:scale-110 transition-transform">
                            <Icon name={item.activeReport ? "FileText" : (item.assetClass === 'credit_card' ? 'CreditCard' : 'CheckCircle')} size={13} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-gray-400 capitalize">
                              {item.activeReport ? `Bericht • ${item.viewMode}` : (item.budgetType ? `Budget • ${item.budgetType}` : (item.assetClass || item.type))}
                            </span>
                          </div>
                        </div>

                        <Icon name="ArrowRight" size={12} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-3 px-6 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-[11px] text-gray-400 flex justify-between items-center">
            <span>FinBundle Intelligence Hub</span>
            <span className="font-mono">Auto-Sync alle 10 Min.</span>
          </div>

        </div>
      </div>
    </div>
  );
};

module.exports = NotificationCenterDrawer;