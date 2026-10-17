const React = require('react');
const { useState, useEffect, useMemo, useRef } = React;
const Icon = require('./Icons.jsx');
const DataEngine = require('./../data/DataEngine.jsx'); 

// Hilfskomponente für das visuelle Markieren von Suchtreffern
const HighlightText = ({ text, highlight }) => {
  if (!highlight) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-yellow-100 rounded-[2px] px-[1px]">{part}</mark>
        ) : part
      )}
    </span>
  );
};

const TreeView = ({ data, viewMode, selectedNode, setSelectedNode, setActiveReport, isTreeVisible, setIsTreeVisible, showArchived, setShowArchived, expandedNodes, toggleExpand, deleteNode, setModalObj, updateTreeData, t }) => {
  
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOverNodeId, setDragOverNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  // Erkennung für Android / Touch-Geräte, damit Aktions-Icons ohne Maus-Hover bedienbar sind
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /android/i.test(ua) || window.innerWidth < 768 || ('ontouchstart' in window);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const ua = navigator.userAgent || '';
      setIsTouchDevice(/android/i.test(ua) || window.innerWidth < 768 || ('ontouchstart' in window));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const allAssets = useMemo(() => DataEngine.getAllAssets(data?.banks || []), [data?.banks]);
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // --- 1. PERFORMANCE: Werte zentral vorberechnen statt bei jedem Render ---
  const { nodeValues, nodeTypes } = useMemo(() => {
    const values = {};
    const types = {};
    
    const calculate = (node) => {
      types[node.id] = node.type;
      if (node.isArchived && !showArchived) {
          values[node.id] = 0;
          return 0;
      }
      
      let val = 0;
      if (node.type === 'asset') {
          val = DataEngine.getAssetValueAtDate(node, today, allAssets);
      } else if (node.children) {
          val = node.children.reduce((sum, child) => sum + calculate(child), 0);
      }
      
      values[node.id] = val;
      return val;
    };
    
    data?.banks?.forEach(calculate);
    return { nodeValues: values, nodeTypes: types };
  }, [data?.banks, showArchived, today, allAssets]);

  // --- 2. UX: Auto-Expand beim Drag & Drop ---
  useEffect(() => {
    let timer;
    if (dragOverNodeId && draggedNodeId && !expandedNodes[dragOverNodeId]) {
      const targetType = nodeTypes[dragOverNodeId];
      if (targetType === 'bank' || targetType === 'category') {
        timer = setTimeout(() => {
          toggleExpand(dragOverNodeId, { stopPropagation: () => {} });
        }, 600);
      }
    }
    return () => clearTimeout(timer);
  }, [dragOverNodeId, draggedNodeId, expandedNodes, toggleExpand, nodeTypes]);

  const handleDrop = (sourceId, targetId) => {
    if (!updateTreeData) return;
    if (sourceId === targetId) return;

    let banksCopy = JSON.parse(JSON.stringify(data.banks || []));
    let sourceNode = null;

    const removeNode = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === sourceId) {
                sourceNode = nodes.splice(i, 1)[0];
                return true;
            }
            if (nodes[i].children && removeNode(nodes[i].children)) return true;
        }
        return false;
    };

    removeNode(banksCopy);
    if (!sourceNode) return;

    if (sourceNode.type === 'bank') {
        const targetIdx = banksCopy.findIndex(b => b.id === targetId);
        if (targetIdx !== -1) banksCopy.splice(targetIdx, 0, sourceNode);
        else banksCopy.push(sourceNode);
    } else {
        const insertNode = (nodes) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === targetId) {
                    if (nodes[i].type === 'bank' || nodes[i].type === 'category') {
                        if (!nodes[i].children) nodes[i].children = [];
                        nodes[i].children.push(sourceNode);
                    } else {
                        nodes.splice(i + 1, 0, sourceNode);
                    }
                    return true;
                }
                if (nodes[i].children && insertNode(nodes[i].children)) return true;
            }
            return false;
        };
        
        if (!insertNode(banksCopy)) {
            if (banksCopy.length > 0) {
               if (!banksCopy[0].children) banksCopy[0].children = [];
               banksCopy[0].children.push(sourceNode);
            }
        }
    }
    updateTreeData({ banks: banksCopy });
  };

  const handleContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 200;
    const menuHeight = 160;
    const rawX = e.clientX || (e.touches && e.touches[0]?.clientX) || 40;
    const rawY = e.clientY || (e.touches && e.touches[0]?.clientY) || 100;
    const safeX = typeof window !== 'undefined' ? Math.min(rawX, window.innerWidth - menuWidth - 12) : rawX;
    const safeY = typeof window !== 'undefined' ? Math.min(rawY, window.innerHeight - menuHeight - 12) : rawY;
    setContextMenu({ x: Math.max(8, safeX), y: Math.max(8, safeY), node });
  };

  const filterTreeNodes = (nodes, query) => {
    if (!query) return nodes;
    return nodes.map(node => {
      const matchesSelf = node.name.toLowerCase().includes(query.toLowerCase());
      if (node.children) {
        const filteredChildren = filterTreeNodes(node.children, query);
        if (filteredChildren.length > 0 || matchesSelf) {
          return { ...node, children: filteredChildren };
        }
      }
      return matchesSelf ? { ...node } : null;
    }).filter(Boolean);
  };

  const filteredBanks = useMemo(() => {
    return filterTreeNodes(data?.banks || [], searchQuery);
  }, [data?.banks, searchQuery, showArchived]);

  const filterBudgetList = (items) => {
    if (!searchQuery) return items;
    return items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const renderNode = (node, depth = 0) => {
    if (node.isArchived && !showArchived) return null; 
    const isSelected = selectedNode?.id === node.id;
    const isExpanded = searchQuery ? true : expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    
    const isForeignCurrency = node.type === 'asset' && node.currency && node.currency !== baseCurrency;
    const isCreditCard = node.type === 'asset' && node.assetClass === 'credit_card';
    
    // Standard-Symbol neutral (Wallet) statt DollarSign
    let iconName = 'Wallet', iconColor = 'text-emerald-500';

    if (node.type === 'bank') { 
      iconName = 'Shield'; 
      iconColor = 'text-slate-500 dark:text-slate-400'; 
    }
    else if (node.type === 'category') { 
      iconName = isExpanded ? 'FolderOpen' : 'Folder'; 
      iconColor = 'text-yellow-500'; 
    }
    else if (node.type === 'asset') {
       if (isCreditCard) {
         iconName = 'CreditCard';
         iconColor = 'text-indigo-500 dark:text-indigo-400';
       }
       else if (node.assetClass === 'realestate') {
         iconName = 'Home';
         iconColor = 'text-blue-500';
       }
       else if (node.assetClass === 'mortgage') { 
         iconName = 'Building'; 
         iconColor = 'text-red-500'; 
       }
       else if (node.assetClass?.includes('pension')) {
         iconName = 'Lock';
         iconColor = 'text-slate-500';
       }
       else if (node.assetClass === 'crypto') { 
         iconName = 'Coins'; 
         iconColor = 'text-orange-500'; 
       }
       else if (node.assetClass === 'fund' || node.assetClass === 'stock') {
         iconName = 'TrendingUp';
         iconColor = 'text-emerald-500';
       }
       // Währungsangepasste Konten-Icons (CHF = neutrales Wallet, EUR = Euro, USD = Dollar)
       else if (node.assetClass === 'cash' || !node.assetClass) {
         if (node.currency === 'USD') {
           iconName = 'DollarSign';
           iconColor = 'text-emerald-500';
         } else if (node.currency === 'EUR') {
           iconName = 'EuroSign';
           iconColor = 'text-blue-500';
         } else {
           iconName = 'Wallet';
           iconColor = 'text-emerald-600 dark:text-emerald-400';
         }
       }
       
       if (isForeignCurrency) iconColor = 'text-indigo-500 dark:text-indigo-400';
    }
    
    const isDragOver = dragOverNodeId === node.id;
    const isBeingDragged = draggedNodeId === node.id;
    
    const nodeValue = nodeValues[node.id] || 0;
    const displayValue = (node.type === 'asset' && isForeignCurrency) 
                         ? DataEngine.getAssetRawValueAtDate(node, today) 
                         : nodeValue;
                         
    const displayCurrency = (node.type === 'asset' && node.currency) ? node.currency : baseCurrency;
    
    return (
      <div key={node.id} className="select-none text-sm w-full">
        <div 
          draggable={!isTouchDevice && (viewMode === 'vermoegen' || viewMode === 'ai')}
          onDragStart={(e) => {
              e.stopPropagation();
              setDraggedNodeId(node.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragOver={(e) => {
              e.preventDefault(); 
              e.stopPropagation();
              
              const draggedType = nodeTypes[draggedNodeId];
              let isValidDrop = false;
              
              if (draggedType === 'asset' && (node.type === 'bank' || node.type === 'category')) isValidDrop = true;
              else if (draggedType === 'category' && (node.type === 'bank' || node.type === 'category')) isValidDrop = true;
              else if (draggedType === 'bank' && node.type === 'bank') isValidDrop = true; 
              
              if (!isValidDrop) {
                  e.dataTransfer.dropEffect = "none";
                  if (dragOverNodeId === node.id) setDragOverNodeId(null);
                  return;
              }

              if (draggedNodeId && draggedNodeId !== node.id) setDragOverNodeId(node.id);
          }}
          onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverNodeId === node.id) setDragOverNodeId(null);
          }}
          onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverNodeId(null);
              if (draggedNodeId && draggedNodeId !== node.id) handleDrop(draggedNodeId, node.id);
              setDraggedNodeId(null);
          }}
          onDragEnd={() => { setDraggedNodeId(null); setDragOverNodeId(null); }}
          onContextMenu={(e) => handleContextMenu(e, node)}
          className={`flex items-center justify-between py-2 md:py-1.5 px-2 cursor-pointer rounded-lg md:rounded transition-all duration-200 group 
            ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'} 
            ${node.isArchived ? 'opacity-50' : ''}
            ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/40 border border-blue-400 border-dashed scale-[1.01] z-10 shadow-sm' : ''}
            ${isBeingDragged ? 'opacity-30 scale-95' : ''}
          `} 
          onClick={() => { setSelectedNode({ ...node, selectedBooking: null }); setActiveReport(null); }}
        >
          <div className="flex items-center gap-2 truncate min-w-0 flex-1 pr-2">
            {hasChildren ? (
              <div onClick={(e) => { e.stopPropagation(); toggleExpand(node.id, e); }} className="w-6 h-6 md:w-4 md:h-4 flex items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-slate-700 shrink-0">
                <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" />
              </div>
            ) : <span className="w-6 md:w-4 shrink-0"></span>}
            <Icon name={iconName} className={`${iconColor} shrink-0`} size={14}/>
            <span className="truncate pr-1" title={node.name}>
               <HighlightText text={node.name} highlight={searchQuery} />
            </span>
            
            {isCreditCard && (
              <span className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded shrink-0 pointer-events-none border border-indigo-200 dark:border-indigo-800/60">
                Karte
              </span>
            )}

            {isForeignCurrency && (
              <span className="px-1 py-0.5 text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded shrink-0 pointer-events-none">
                {node.currency}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-mono text-gray-500 dark:text-gray-400 transition-all ${isTouchDevice ? '' : 'group-hover:hidden'}`}>
              {DataEngine.formatCurrency(displayValue, 'de', displayCurrency)}
            </span>

            {/* Auf Desktop per Hover sichtbar, auf Android/Touch über einen kompakten Drei-Punkte/Aktions-Button erreichbar */}
            {isTouchDevice ? (
              <button
                type="button"
                onClick={(e) => handleContextMenu(e, node)}
                className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 dark:hover:text-slate-200 active:bg-gray-200 dark:active:bg-slate-700"
                title="Aktionen"
              >
                <Icon name="MoreVertical" size={14} />
              </button>
            ) : (
              <div className="hidden group-hover:flex gap-1 items-center transition-all">
                 {node.type === 'bank' && <Icon name="FolderPlus" size={13} className="hover:text-blue-500 p-0.5" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t ? t('addCategory') : 'Kategorie hinzufügen'} />}
                 {node.type === 'category' && (<><Icon name="FolderPlus" size={13} className="hover:text-blue-500 p-0.5" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t ? t('addCategory') : 'Kategorie hinzufügen'} /><Icon name="Plus" size={13} className="hover:text-green-500 p-0.5" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addAsset', parentId: node.id}); }} title={t ? t('addAsset') : 'Anlage hinzufügen'} /></>)}
                 <Icon name="Trash" size={13} className="hover:text-red-500 p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteNode(node); }} title={t ? t('btnDelete') : 'Löschen'} />
                 <Icon name="Menu" size={11} className="cursor-grab text-gray-300 dark:text-gray-600 ml-0.5" />
              </div>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="border-l border-gray-200 dark:border-slate-700/60 ml-[14px] md:ml-[11px] pl-3 mt-0.5 space-y-0.5 transition-all">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderBudgetList = (items, typeIcon, groupName, budgetGroupKey) => {
    const filteredItems = filterBudgetList(items);
    if (filteredItems.length === 0 && searchQuery) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1.5 font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider flex justify-between items-center w-full">
            <span className="truncate">{groupName}</span>
            <div className="flex items-center justify-center shrink-0 w-7 h-7 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors" 
                 onClick={() => setModalObj({type: 'addBudget', budgetGroup: budgetGroupKey})} 
                 title={t ? t('titleAdd') : 'Hinzufügen'}>
                 <Icon name="Plus" size={14} className="text-gray-500 hover:text-green-500" />
            </div>
        </div>

        {filteredItems.map(item => {
          const isSelected = selectedNode?.id === item.id;
          const itemValue = Number(item.amount || item.value || 0);
          
          return (
            <div key={item.id} className={`group flex items-center justify-between py-2 md:py-1.5 px-4 cursor-pointer rounded-lg md:rounded transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'}`} onClick={() => { setSelectedNode({...item, budgetType: budgetGroupKey}); setActiveReport(null); }}>
              <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                  <span className="shrink-0 text-[13px]">{typeIcon}</span>
                  <span className="truncate" title={item.name}>
                      <HighlightText text={item.name} highlight={searchQuery} />
                  </span>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-mono text-gray-500 dark:text-gray-400 transition-all ${isTouchDevice ? '' : 'group-hover:hidden'}`}>
                  {DataEngine.formatCurrency(itemValue, 'de', baseCurrency)}
                </span>
                <Icon 
                  name="Trash" 
                  size={14} 
                  className={`${isTouchDevice ? 'block opacity-60' : 'hidden group-hover:block opacity-50'} shrink-0 hover:opacity-100 hover:text-red-500 p-0.5`} 
                  onClick={(e)=>{ e.stopPropagation(); deleteNode({...item, budgetType: budgetGroupKey}); }} 
                  title={t ? t('btnDelete') : 'Löschen'} 
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (viewMode === 'liveEditor') return null;

  return (
    <>
      <style>{`
        .custom-tree-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-tree-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .dark .custom-tree-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(71, 85, 105, 0.4); }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(107, 114, 128, 0.6); }
      `}</style>
      
      <div className={`print-hide ${isTreeVisible ? 'w-[84vw] max-w-xs sm:w-72 border-r' : 'w-0 overflow-hidden'} border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/40 flex flex-col h-full shrink-0 transition-all duration-300`}>
        
        <div className="p-3 font-bold border-b border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 flex justify-between items-center text-sm shrink-0">
          <div className="flex items-center gap-2 truncate min-w-0">
            {viewMode === 'budget' ? (t ? t('menuBudget') : 'Budget') : (viewMode === 'ai' ? (t ? t('aiCopilotTitle') || 'KI Copilot' : 'KI Copilot') : (t ? t('menuWealth') : 'Vermögen'))} - {t ? t('tree') : 'Übersicht'}
          </div>
          
          <div className="flex items-center gap-2">

            {(viewMode === 'vermoegen' || viewMode === 'ai') && (
            <>
                <div 
                        className={`cursor-pointer p-1.5 rounded transition-all duration-200 ${
                            showArchived 
                            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400' 
                            : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400'
                        }`}
                        onClick={() => setShowArchived(!showArchived)}
                        title={showArchived ? 'Archivierte Assets ausblenden' : 'Archivierte Assets anzeigen'}
                    >
                        <Icon name={showArchived ? "Archive" : "Inbox"} size={15} />
                </div>

              <div 
                className="cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded transition-colors"
                onClick={() => setModalObj({ type: 'addBank' })}
                title={t ? t('titleAddBank') : 'Neue Bank hinzufügen'}
              >
                <Icon name="Plus" size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
            </>
            )}
            <button
              type="button"
              onClick={() => setIsTreeVisible(false)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0 cursor-pointer"
              title={t ? t('titleHideTree') : 'Strukturbaum ausblenden'}
            >
              <Icon name="ChevronLeft" size={15} />
            </button>
          </div>
        </div>

        <div className="p-2 border-b border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/30 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-gray-400 dark:text-gray-500"><Icon name="Search" size={12} /></span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t ? t('placeholderSearchFilter') : 'Suchen und filtern...'}
              className="w-full pl-8 pr-7 py-1.5 md:py-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                <Icon name="X" size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 custom-tree-scrollbar space-y-0.5">
          {(viewMode === 'vermoegen' || viewMode === 'ai') && filteredBanks.map(b => renderNode(b))}
          
          {viewMode === 'budget' && (
            <div className="w-full">
              {renderBudgetList(data?.budget?.incomeSources || [], '📈', t ? t('incomeSources') : 'Einnahmen', 'incomeSources')}
              {renderBudgetList(data?.budget?.expenses || [], '📉', t ? t('expensePositions') : 'Ausgaben', 'expenses')}
              {renderBudgetList(data?.budget?.subscriptions || [], '🔄', t ? t('subscriptions') : 'Abonnements', 'subscriptions')}
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div 
          className="fixed bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-xl py-1.5 z-[10000] min-w-[200px] text-xs font-medium text-slate-700 dark:text-slate-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-700 truncate max-w-[200px]">
            {contextMenu.node.name}
          </div>
          {contextMenu.node.type === 'bank' && (
            <button className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5" onClick={() => { setModalObj({type: 'addCategory', parentId: contextMenu.node.id}); setContextMenu(null); }}>
              <Icon name="FolderPlus" size={14} className="text-blue-500" /> {t ? t('addCategory') : 'Kategorie hinzufügen'}
            </button>
          )}
          {contextMenu.node.type === 'category' && (
            <>
              <button className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5" onClick={() => { setModalObj({type: 'addCategory', parentId: contextMenu.node.id}); setContextMenu(null); }}>
                <Icon name="FolderPlus" size={14} className="text-blue-500" /> {t ? t('addCategory') : 'Kategorie hinzufügen'}
              </button>
              <button className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5" onClick={() => { setModalObj({type: 'addAsset', parentId: contextMenu.node.id}); setContextMenu(null); }}>
                <Icon name="Plus" size={14} className="text-green-500" /> {t ? t('addAsset') : 'Anlage hinzufügen'}
              </button>
              <button className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5" onClick={() => { setModalObj({type: 'addAsset', parentId: contextMenu.node.id, defaultAssetClass: 'credit_card'}); setContextMenu(null); }}>
                <Icon name="CreditCard" size={14} className="text-indigo-500" /> {t ? (t('addCreditCard') || 'Kreditkarte hinzufügen') : 'Kreditkarte hinzufügen'}
              </button>
            </>
          )}
          <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
          <button className="w-full text-left px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 text-red-600 dark:text-red-400 font-bold" onClick={() => { deleteNode(contextMenu.node); setContextMenu(null); }}>
            <Icon name="Trash" size={14} /> {t ? t('btnDelete') : 'Löschen'}
          </button>
        </div>
      )}
    </>
  );
};

module.exports = TreeView;