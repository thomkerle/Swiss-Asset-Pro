const React = require('react');
const { useState } = React;
const Icon = require('./Icons.jsx');

const TreeView = ({ data, viewMode, selectedNode, setSelectedNode, setActiveReport, isTreeVisible, setIsTreeVisible, showArchived, setShowArchived, expandedNodes, toggleExpand, deleteNode, setModalObj, updateTreeData, t }) => {
  
  // States für Drag & Drop
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOverNodeId, setDragOverNodeId] = useState(null);

  // Funktion zum Behandeln des "Loslassens" (Drop)
  const handleDrop = (sourceId, targetId) => {
    if (!updateTreeData) {
        console.warn("[FinSPA] updateTreeData prop fehlt in TreeView!");
        return;
    }
    if (sourceId === targetId) return; // Nichts zu tun, wenn Quelle und Ziel gleich sind

    let banksCopy = JSON.parse(JSON.stringify(data.banks));
    let sourceNode = null;

    // 1. Quell-Knoten finden und entfernen
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
    if (!sourceNode) return; // Falls der Knoten nicht gefunden wurde, Abbruch.

    // 2. Quell-Knoten am Ziel wieder einfügen
    if (sourceNode.type === 'bank') {
        // Banken können nur auf der obersten Ebene (zwischen Banken) verschoben werden
        const targetIdx = banksCopy.findIndex(b => b.id === targetId);
        if (targetIdx !== -1) {
            banksCopy.splice(targetIdx, 0, sourceNode);
        } else {
            banksCopy.push(sourceNode);
        }
    } else {
        // Kategorien und Assets einfügen
        const insertNode = (nodes) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === targetId) {
                    if (nodes[i].type === 'bank' || nodes[i].type === 'category') {
                        // In eine Bank oder Kategorie als Kind-Element einfügen
                        if (!nodes[i].children) nodes[i].children = [];
                        nodes[i].children.push(sourceNode);
                    } else {
                        // Wenn das Ziel ein Asset ist, auf gleicher Ebene daneben einfügen
                        nodes.splice(i + 1, 0, sourceNode);
                    }
                    return true;
                }
                if (nodes[i].children && insertNode(nodes[i].children)) return true;
            }
            return false;
        };
        
        if (!insertNode(banksCopy)) {
            // Fallback, falls das Ziel warum auch immer nicht gefunden wurde
            if (banksCopy.length > 0) {
               if (!banksCopy[0].children) banksCopy[0].children = [];
               banksCopy[0].children.push(sourceNode);
            }
        }
    }

    // Geänderten Baum speichern
    updateTreeData({ banks: banksCopy });
  };

  const renderNode = (node, depth = 0) => {
    if (node.isArchived && !showArchived) return null; 
    const isSelected = selectedNode?.id === node.id;
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    
    // Ermittlung der globalen Basiswährung zur Feststellung von Fremdwährungen
    const baseCurrency = data.settings?.baseCurrency || 'CHF';
    const isForeignCurrency = node.type === 'asset' && node.currency && node.currency !== baseCurrency;
    
    let iconName = 'DollarSign', iconColor = 'text-green-500';
    if (node.type === 'bank') { iconName = 'Shield'; iconColor = 'text-slate-500 dark:text-slate-400'; }
    else if (node.type === 'category') { iconName = isExpanded ? 'FolderOpen' : 'Folder'; iconColor = 'text-yellow-500'; }
    else if (node.type === 'asset') {
       if (node.assetClass === 'realestate') iconName = 'Home';
       else if (node.assetClass === 'mortgage') { iconName = 'Building'; iconColor = 'text-red-500'; }
       else if (node.assetClass?.includes('pension')) iconName = 'Lock';
       else if (node.assetClass === 'crypto') { iconName = 'Coins'; iconColor = 'text-orange-500'; }
       else if (node.assetClass === 'fund' || node.assetClass === 'stock') iconName = 'TrendingUp';
       
       // Visueller Farb-Indikator für Fremdwährungskonten im Strukturbaum
       if (isForeignCurrency) {
           iconColor = 'text-indigo-500 dark:text-indigo-400';
       }
    }
    
    const isDragOver = dragOverNodeId === node.id;
    const isBeingDragged = draggedNodeId === node.id;
    
    return (
      <div key={node.id} className="select-none text-sm relative">
        <div 
          draggable={viewMode === 'vermoegen' || viewMode === 'ai'}
          onDragStart={(e) => {
              e.stopPropagation();
              setDraggedNodeId(node.id);
              e.dataTransfer.effectAllowed = 'move';
              // Setzt transparente Drag-Vorschau, ist aber optional
              e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragOver={(e) => {
              e.preventDefault(); // Nötig, um onDrop auszulösen
              e.stopPropagation();
              if (draggedNodeId && draggedNodeId !== node.id) {
                  setDragOverNodeId(node.id);
              }
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
              if (draggedNodeId && draggedNodeId !== node.id) {
                  handleDrop(draggedNodeId, node.id);
              }
              setDraggedNodeId(null);
          }}
          onDragEnd={() => {
              setDraggedNodeId(null);
              setDragOverNodeId(null);
          }}
          className={`flex items-center justify-between py-1.5 px-2 cursor-pointer rounded transition-all duration-200 group 
            ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'} 
            ${node.isArchived ? 'opacity-50' : ''}
            ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/40 border border-blue-400 border-dashed scale-[1.02] z-10' : ''}
            ${isBeingDragged ? 'opacity-30 scale-95' : ''}
          `} 
          style={{ paddingLeft: `${depth * 16 + 12}px` }} 
          onClick={() => { setSelectedNode(node); setActiveReport(null); }}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            {hasChildren ? <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" onClick={(e) => toggleExpand(node.id, e)} /> : <span className="w-3 shrink-0"></span>}
            <Icon name={iconName} className={`${iconColor} shrink-0`} size={14}/>
            <span className="truncate">{node.name}</span>
            
            {/* Währungs-Badge wird direkt angehängt, wenn es ein Fremdwährungskonto ist */}
            {isForeignCurrency && (
              <span className="ml-1.5 px-1 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded shrink-0 pointer-events-none">
                {node.currency}
              </span>
            )}
          </div>
          <div className="hidden group-hover:flex gap-1.5 opacity-50 hover:opacity-100 items-center shrink-0">
             {node.type === 'bank' && <Icon name="FolderPlus" size={14} className="hover:text-blue-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t('addCategory')} />}
             {node.type === 'category' && (<><Icon name="FolderPlus" size={14} className="hover:text-blue-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t('addCategory')} /><Icon name="Plus" size={14} className="hover:text-green-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addAsset', parentId: node.id}); }} title={t('addAsset')} /></>)}
             <Icon name="Trash" size={14} className="hover:text-red-500" onClick={(e)=>{ e.stopPropagation(); deleteNode(node); }} title={t('btnDelete')} />
             {/* Kleiner Drag-Indikator, der nur beim Hover sichtbar ist */}
             <Icon name="Menu" size={12} className="cursor-grab text-gray-300 dark:text-gray-600 active:cursor-grabbing ml-1" />
          </div>
        </div>
        {isExpanded && hasChildren && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  const renderBudgetList = (items, typeIcon, groupName, budgetGroupKey) => (
    <div className="mb-4">
      <div className="px-3 py-1 font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider flex justify-between items-center w-full">
          <span className="truncate">{groupName}</span>
          <div className="flex items-center justify-center shrink-0 w-8 h-8 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors ml-2" 
               onClick={() => setModalObj({type: 'addBudget', budgetGroup: budgetGroupKey})} 
               title="Hinzufügen">
               <Icon name="Plus" size={16} className="text-gray-500 hover:text-green-500" />
          </div>
      </div>

      {items.map(item => {
        const isSelected = selectedNode?.id === item.id;
        return (
          <div key={item.id} className={`group flex items-center justify-between py-1.5 px-4 cursor-pointer rounded transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'}`} onClick={() => { setSelectedNode({...item, budgetType: budgetGroupKey}); setActiveReport(null); }}>
            <div className="flex items-center gap-2 truncate min-w-0">
                <span className="shrink-0">{typeIcon}</span>
                <span className="truncate">{item.name}</span>
            </div>
            <Icon name="Trash" size={14} className="hidden group-hover:block shrink-0 opacity-50 hover:opacity-100 hover:text-red-500" onClick={(e)=>{ e.stopPropagation(); deleteNode({...item, budgetType: budgetGroupKey}); }} title={t('btnDelete')} />
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* CSS-Injektion für elegante, abgerundete Scrollbars */}
      <style>{`
        .custom-tree-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-tree-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.4);
          border-radius: 10px;
        }
        .dark .custom-tree-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(71, 85, 105, 0.5);
        }
        .custom-tree-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
      
      <div className={`print-hide ${isTreeVisible ? 'w-72 border-r' : 'w-0 overflow-hidden'} border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex flex-col h-full shrink-0 transition-all duration-300`}>
        
        <div className="p-3 font-bold border-b border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 flex justify-between items-center text-sm shrink-0">
          <div className="flex items-center gap-2 truncate min-w-0">
            {viewMode === 'budget' ? t('menuBudget') : (viewMode === 'ai' ? 'KI Copilot' : t('menuWealth'))} - {t('tree')}
          </div>
          
          <div className="flex items-center gap-2">
            {(viewMode === 'vermoegen' || viewMode === 'ai') && (
              <div 
                className="cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded transition-colors"
                onClick={() => setModalObj({ type: 'addBank' })}
                title="Neue Bank hinzufügen"
              >
                <Icon name="Plus" size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
            )}
            
            <Icon 
              name="ChevronLeft" 
              size={14} 
              className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0" 
              onClick={() => setIsTreeVisible(false)} 
              title="Strukturbaum ausblenden" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-tree-scrollbar">
          {(viewMode === 'vermoegen' || viewMode === 'ai') && data.banks.map(b => renderNode(b))}
          
          {viewMode === 'budget' && (
            <div className="w-full">
              {renderBudgetList(data.budget.incomeSources || [], '📈', t('incomeSources'), 'incomeSources')}
              {renderBudgetList(data.budget.expenses || [], '📉', t('expensePositions'), 'expenses')}
              {renderBudgetList(data.budget.subscriptions || [], '🔄', t('subscriptions'), 'subscriptions')}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

module.exports = TreeView;