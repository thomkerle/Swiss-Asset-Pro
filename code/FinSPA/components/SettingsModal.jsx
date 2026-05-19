const React = require('react');
const Icon = require('./Icons.jsx');

const SettingsModal = ({ data, updateTreeData, setModalObj, showToast, defaultBookingCategories, t }) => {
    const { useState } = React;
    const [activeTab, setActiveTab] = useState('categories');
    const [localSettings, setLocalSettings] = useState(data.settings || {});
    if(!localSettings.bookingCategories) localSettings.bookingCategories = defaultBookingCategories;
    
    // Dynamischer Fallback auf den ersten echten Schlüssel der Kategorien
    const categoriesKeys = Object.keys(localSettings.bookingCategories || {});
    const [selectedCatType, setSelectedCatType] = useState(categoriesKeys[0] || 'Einzahlung');
    const [newCatName, setNewCatName] = useState('');

    const handleSaveSettings = () => { 
        updateTreeData({ settings: localSettings }); 
        setModalObj(null); 
        showToast(t('msgSettingsSaved'), "success"); 
    };

    const addCategory = () => {
        if(!newCatName.trim()) return;
        const updatedCats = {...localSettings.bookingCategories};
        if(!updatedCats[selectedCatType]) updatedCats[selectedCatType] = [];
        if(!updatedCats[selectedCatType].includes(newCatName.trim())) updatedCats[selectedCatType].push(newCatName.trim());
        setLocalSettings({...localSettings, bookingCategories: updatedCats}); 
        setNewCatName('');
    };
    
    const removeCategory = (cat) => {
        const updatedCats = {...localSettings.bookingCategories};
        updatedCats[selectedCatType] = updatedCats[selectedCatType].filter(c => c !== cat);
        setLocalSettings({...localSettings, bookingCategories: updatedCats});
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Icon name="Settings" /> {t('fileSettings')}</h3>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
                </div>
                <div className="flex border-b border-gray-200 dark:border-slate-700 px-4 pt-2 gap-6 bg-white dark:bg-slate-900 shrink-0">
                    <button className={`pb-3 font-bold text-sm transition-colors ${activeTab==='categories' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={()=>setActiveTab('categories')}>{t('tabCategories')}</button>
                    <button className={`pb-3 font-bold text-sm transition-colors ${activeTab==='general' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={()=>setActiveTab('general')}>{t('tabGeneral')}</button>
                </div>
                <div className="p-6 flex-1 overflow-auto">
                    {activeTab === 'categories' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded text-sm mb-4">{t('settingsCatDesc')}</div>
                            <div className="flex gap-6 h-full">
                                <div className="w-1/3">
                                    <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelTransTypeSetting')}</label>
                                    <div className="space-y-1">
                                        {categoriesKeys.map(type => (
                                            <div key={type} onClick={()=>setSelectedCatType(type)} className={`p-2.5 rounded cursor-pointer text-sm font-medium transition-colors ${selectedCatType===type ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                                                {/* Direkter Aufruf, da Keys in Translations.jsx existieren */}
                                                {t(type)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-2/3 border-l border-gray-200 dark:border-slate-700 pl-6">
                                    <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelSubCategories')}</label>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {(localSettings.bookingCategories[selectedCatType]||[]).map(cat => (
                                            <span key={cat} className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 font-medium">
                                                {/* Ebenfalls direkter Aufruf */}
                                                {t(cat)} 
                                                <Icon name="X" size={10} className="cursor-pointer text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition-opacity" onClick={()=>removeCategory(cat)}/>
                                            </span>
                                        ))}
                                    </div>
                                    <label className="block font-bold mb-2 text-xs text-gray-400 uppercase tracking-wider">{t('labelNewCategory')}</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder={t('placeholderCatName')} className="flex-1 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" onKeyDown={e=>e.key==='Enter' && addCategory()}/>
                                        <button onClick={addCategory} className="bg-gray-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors shadow-sm">{t('btnAdd')}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'general' && (
                        <div className="space-y-4 max-w-sm">
                            <div>
                                <label className="block font-bold mb-2 text-sm text-gray-700 dark:text-gray-300">{t('labelBaseCurrency')}</label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500" value={localSettings.baseCurrency||'CHF'} onChange={e=>setLocalSettings({...localSettings, baseCurrency: e.target.value})}>
                                    <option>CHF</option>
                                    <option>USD</option>
                                    <option>EUR</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                    <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 text-sm transition-colors">{t('btnCancel')}</button>
                    <button onClick={handleSaveSettings} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm shadow-md transition-colors">{t('btnSaveSettings')}</button>
                </div>
            </div>
        </div>
    );
};
module.exports = SettingsModal;