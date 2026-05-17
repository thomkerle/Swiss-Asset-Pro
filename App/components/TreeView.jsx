const React = require('react');
const Icon = require('./Icons.jsx');

const TreeView = ({ data, viewMode, selectedNode, setSelectedNode, setActiveReport, isTreeVisible, setIsTreeVisible, showArchived, setShowArchived, expandedNodes, toggleExpand, deleteNode, setModalObj, t }) => {
  const renderNode = (node, depth = 0) => {
    if (node.isArchived && !showArchived) return null; 
    const isSelected = selectedNode?.id === node.id;
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    
    let iconName = 'DollarSign', iconColor = 'text-green-500';
    if (node.type === 'bank') { iconName = 'Shield'; iconColor = 'text-slate-500 dark:text-slate-400'; }
    else if (node.type === 'category') { iconName = isExpanded ? 'FolderOpen' : 'Folder'; iconColor = 'text-yellow-500'; }
    else if (node.type === 'asset') {
       if (node.assetClass === 'realestate') iconName = 'Home';
       else if (node.assetClass === 'mortgage') { iconName = 'Building'; iconColor = 'text-red-500'; }
       else if (node.assetClass?.includes('pension')) iconName = 'Lock';
       else if (node.assetClass === 'crypto') { iconName = 'Coins'; iconColor = 'text-orange-500'; }
       else if (node.assetClass === 'fund' || node.assetClass === 'stock') iconName = 'TrendingUp';
    }
    
    return (
      <div key={node.id} className="select-none text-sm">
        <div className={`flex items-center justify-between py-1.5 px-2 cursor-pointer rounded transition-colors group ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'} ${node.isArchived ? 'opacity-50' : ''}`} style={{ paddingLeft: `${depth * 16 + 12}px` }} onClick={() => { setSelectedNode(node); setActiveReport(null); }}>
          <div className="flex items-center gap-2 truncate">
            {hasChildren ? <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={(e) => toggleExpand(node.id, e)} /> : <span className="w-3"></span>}
            <Icon name={iconName} className={iconColor} size={14}/><span className="truncate">{node.name}</span>
          </div>
          <div className="hidden group-hover:flex gap-1.5 opacity-50 hover:opacity-100 items-center">
             {node.type === 'bank' && <Icon name="FolderPlus" size={14} className="hover:text-blue-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t('addCategory') || 'Kategorie hinzufügen'} />}
             {node.type === 'category' && (<><Icon name="FolderPlus" size={14} className="hover:text-blue-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addCategory', parentId: node.id}); }} title={t('addCategory') || 'Unterkategorie hinzufügen'} /><Icon name="Plus" size={14} className="hover:text-green-500" onClick={(e)=>{ e.stopPropagation(); setModalObj({type: 'addAsset', parentId: node.id}); }} title={t('addAsset') || 'Asset hinzufügen'} /></>)}
             <Icon name="Trash" size={14} className="hover:text-red-500" onClick={(e)=>{ e.stopPropagation(); deleteNode(node); }} title={t('btnDelete')} />
          </div>
        </div>
        {isExpanded && hasChildren && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  const renderBudgetList = (items, typeIcon, groupName, budgetGroupKey) => (
    <div className="mb-4">
      <div className="px-3 py-1 font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider flex justify-between items-center">{groupName}<Icon name="Plus" size={12} className="cursor-pointer hover:text-blue-500 transition-colors" onClick={() => setModalObj({type: 'addBudget', budgetGroup: budgetGroupKey})} title="Neuen Posten hinzufügen" /></div>
      {items.map(item => {
        const isSelected = selectedNode?.id === item.id;
        return (
          <div key={item.id} className={`group flex items-center justify-between py-1.5 px-4 cursor-pointer rounded transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'}`} onClick={() => { setSelectedNode({...item, budgetType: typeIcon}); setActiveReport(null); }}>
            <div className="flex items-center gap-2 truncate"><span>{typeIcon}</span><span className="truncate">{item.name}</span></div>
            <Icon name="Trash" size={14} className="hidden group-hover:block opacity-50 hover:opacity-100 hover:text-red-500" onClick={(e)=>{ e.stopPropagation(); deleteNode({...item, budgetType: typeIcon}); }} title={t('btnDelete')} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`print-hide ${isTreeVisible ? 'w-72 border-r' : 'w-0 overflow-hidden'} border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex flex-col h-full shrink-0 transition-all duration-300`}>
      <div className="p-3 font-bold border-b border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 flex justify-between items-center text-sm min-w-max">
        <div className="flex items-center gap-2">
          {viewMode === 'vermoegen' ? t('menuWealth') : t('menuBudget')} - {t('tree')}
          {viewMode === 'vermoegen' && (<><Icon name="Plus" size={14} className="cursor-pointer ml-2 text-blue-500 hover:text-blue-600 transition-colors" title={t('addBank')} onClick={() => setModalObj({type: 'addBank'})} /><Icon name={showArchived ? "Eye" : "EyeSlash"} size={14} className={`cursor-pointer ml-2 transition-colors ${showArchived ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Archivierte Elemente ein-/ausblenden" onClick={() => setShowArchived(!showArchived)} /></>)}
        </div>
        <Icon name="ChevronLeft" size={14} className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => setIsTreeVisible(false)} title="Strukturbaum ausblenden" />
      </div>
      <div className="flex-1 overflow-y-auto py-2 min-w-max">
        {viewMode === 'vermoegen' && data.banks.map(b => renderNode(b))}
        {viewMode === 'budget' && (<div>{renderBudgetList(data.budget.incomeSources, '📈', 'Einnahmequellen', 'incomeSources')}{renderBudgetList(data.budget.expenses, '📉', 'Ausgabepositionen', 'expenses')}{renderBudgetList(data.budget.subscriptions, '🔄', 'Abos & Verträge', 'subscriptions')}</div>)}
      </div>
    </div>
  );
};
module.exports = TreeView;