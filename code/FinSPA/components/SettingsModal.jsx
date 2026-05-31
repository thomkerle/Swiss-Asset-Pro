const React = require('react');
const Icon = require('./Icons.jsx');

const SettingsModal = ({ data, updateTreeData, setModalObj, showToast, defaultBookingCategories, t }) => {
    const { useState } = React;
    const [activeTab, setActiveTab] = useState('user');
    
    // Lokalen State mit den Daten initialisieren (Deep Clone)
    const [localSettings, setLocalSettings] = useState(() => {
        const initial = JSON.parse(JSON.stringify(data.settings || {}));
        
        if (!initial.userName) initial.userName = '';
        if (!initial.pdfCompanyName) initial.pdfCompanyName = 'FINSPA PRO';
        if (!initial.pdfSubtitle) initial.pdfSubtitle = 'ENTERPRISE ASSET MANAGEMENT & REPORTING';
        if (!initial.saveMethod) initial.saveMethod = 'plaintext';

        if (!initial.bookingCategories) initial.bookingCategories = defaultBookingCategories;
        
        if (initial.aiEnabled === undefined) initial.aiEnabled = true;
        
        // Objekt für API-Keys der Cloud-Anbieter initialisieren
        if (!initial.aiApiKeys) {
            initial.aiApiKeys = {
                openai: '',
                anthropic: '',
                gemini: ''
            };
        }

        if (!initial.aiModels) {
            initial.aiModels = [
                { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder (14B)' },
                { id: 'llama3:latest', name: 'Llama 3 (8B)' }
            ];
        }

        if (!initial.assetClasses) {
            initial.assetClasses = [
                { id: 'cash', name: t('acCash') || 'Bargeld / Konto', description: t('descCash') || 'Liquide Mittel und Girokonten' },
                { id: 'fund', name: t('acFund') || 'Fonds / ETF', description: t('descFund') || 'Investmentfonds und passive ETFs' },
                { id: 'stock', name: t('acStock') || 'Aktien', description: t('descStock') || 'Direktinvestitionen in Einzelaktien' },
                { id: 'crypto', name: t('acCrypto') || 'Krypto', description: t('descCrypto') || 'Kryptowährungen wie BTC, ETH' },
                { id: 'realestate', name: t('acRealEstate') || 'Immobilien', description: t('descRealEstate') || 'Liegenschaften, Haus, Wohnung' },
                { id: 'mortgage', name: t('acMortgage') || 'Hypothek', description: t('descMortgage') || 'Hypothekarische Belastungen' },
                { id: 'pension_cash', name: t('acPension_cash') || 'Pensionskasse', description: t('descPensionCash') || 'Berufliche Vorsorge (2. Säule) / Pensionsguthaben' },
                { id: 'pension_3a_cash', name: t('acPension3aCash') || '3a Vorsorgekonto', description: t('descPension3aCash') || 'Säule 3a Sparkonto (Vorsorgeguthaben Cash)' },
                { id: 'pension_3a_fund', name: t('acPension3aFund') || '3a Vorsorgefonds', description: t('descPension3aFund') || 'Säule 3a Wertschriftenlösung (Vorsorgeguthaben Fonds)' }
            ];
        }
        
        return initial;
    });
    
    const categoriesKeys = Object.keys(localSettings.bookingCategories || {});
    const [selectedCatType, setSelectedCatType] = useState(categoriesKeys[0] || 'Einzahlung');
    const [newCatName, setNewCatName] = useState('');

    const [newAiModelId, setNewAiModelId] = useState('');
    const [newAiModelName, setNewAiModelName] = useState('');

    const [newAssetName, setNewAssetName] = useState('');
    const [newAssetDesc, setNewAssetDesc] = useState('');

    const addCategory = () => {
        if(!newCatName.trim()) return;
        const updatedCats = JSON.parse(JSON.stringify(localSettings.bookingCategories || {}));
        if(!updatedCats[selectedCatType]) updatedCats[selectedCatType] = [];
        if(!updatedCats[selectedCatType].includes(newCatName.trim())) {
            updatedCats[selectedCatType].push(newCatName.trim());
        }
        setLocalSettings({...localSettings, bookingCategories: updatedCats}); 
        setNewCatName('');
    };

    const handleSaveSettings = () => { 
        let finalSettings = JSON.parse(JSON.stringify(localSettings));

        if (newCatName.trim()) {
            if (!finalSettings.bookingCategories[selectedCatType]) finalSettings.bookingCategories[selectedCatType] = [];
            if (!finalSettings.bookingCategories[selectedCatType].includes(newCatName.trim())) {
                finalSettings.bookingCategories[selectedCatType].push(newCatName.trim());
            }
        }

        if (newAiModelId.trim()) {
            finalSettings.aiModels = [...finalSettings.aiModels, { 
                id: newAiModelId.trim(), 
                name: newAiModelName.trim() || newAiModelId.trim() 
            }];
        }

        if (newAssetName.trim()) {
            const generatedId = newAssetName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!finalSettings.assetClasses.find(a => a.id === generatedId)) {
                finalSettings.assetClasses = [...finalSettings.assetClasses, {
                    id: generatedId,
                    name: newAssetName.trim(),
                    description: newAssetDesc.trim()
                }];
            }
        }

        updateTreeData({ settings: finalSettings }); 
        setModalObj(null); 
        showToast(t('msgSettingsSaved') || 'Einstellungen erfolgreich gespeichert.', "success"); 
    };
    
    const removeCategory = (cat) => {
        const updatedCats = {...localSettings.bookingCategories};
        updatedCats[selectedCatType] = updatedCats[selectedCatType].filter(c => c !== cat);
        setLocalSettings({...localSettings, bookingCategories: updatedCats});
    };

    const addAiModel = () => {
        if (!newAiModelId.trim()) return;
        const newModels = [...localSettings.aiModels, { 
            id: newAiModelId.trim(), 
            name: newAiModelName.trim() || newAiModelId.trim() 
        }];
        setLocalSettings({ ...localSettings, aiModels: newModels });
        setNewAiModelId('');
        setNewAiModelName('');
    };

    const removeAiModel = (idToRemove) => {
        const newModels = localSettings.aiModels.filter(m => m.id !== idToRemove);
        setLocalSettings({ ...localSettings, aiModels: newModels });
    };

    const updateAssetDesc = (id, newDesc) => {
        const updatedClasses = localSettings.assetClasses.map(a => 
            a.id === id ? { ...a, description: newDesc } : a
        );
        setLocalSettings({ ...localSettings, assetClasses: updatedClasses });
    };

    const addAssetClass = () => {
        if (!newAssetName.trim()) return;
        const generatedId = newAssetName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        if (localSettings.assetClasses.find(a => a.id === generatedId)) {
            showToast(t('msgAssetExists') || 'Asset-Klasse existiert bereits', 'error');
            return;
        }

        const newClasses = [...localSettings.assetClasses, {
            id: generatedId,
            name: newAssetName.trim(),
            description: newAssetDesc.trim()
        }];
        setLocalSettings({ ...localSettings, assetClasses: newClasses });
        setNewAssetName('');
        setNewAssetDesc('');
    };

    // Hilfsfunktion zum Aktualisieren der API Keys
    const updateApiKey = (provider, value) => {
        setLocalSettings({
            ...localSettings,
            aiApiKeys: {
                ...localSettings.aiApiKeys,
                [provider]: value
            }
        });
    };

    const TabButton = ({ id, label }) => (
        <button 
            className={`pb-3 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === id ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} 
            onClick={() => setActiveTab(id)}
        >
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col h-[650px] max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Icon name="Settings" /> {t('fileSettings') || 'Einstellungen'}</h3>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
                </div>
                <div className="flex border-b border-gray-200 dark:border-slate-700 px-4 pt-2 gap-6 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto custom-scrollbar">
                    <TabButton id="user" label={t('tabUser') || 'Benutzer & PDF'} />
                    <TabButton id="categories" label={t('tabCategories') || 'Kategorien'} />
                    <TabButton id="assets" label={t('tabAssets') || 'Asset-Klassen'} />
                    <TabButton id="ai" label={t('tabAI') || 'KI-Assistent'} />
                    <TabButton id="general" label={t('tabGeneral') || 'Allgemein & Sicherheit'} />
                </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    {/* TAB: BENUTZER & PDF */}
                    {activeTab === 'user' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded text-sm mb-4">
                                {t('settingsUserDesc') || 'Hinterlege hier deinen Namen und passe die Kopfzeilen für das Deckblatt der PDF-Reports an.'}
                            </div>
                            
                            <div>
                                <label className="block font-bold mb-2 text-sm text-gray-700 dark:text-gray-300">{t('labelOwnerName') || 'Name des Inhabers'}</label>
                                <input 
                                    type="text" 
                                    className="w-full max-w-sm p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={localSettings.userName}
                                    placeholder={t('placeholderOwnerName') || 'z.B. Max Mustermann'}
                                    onChange={e => setLocalSettings({...localSettings, userName: e.target.value})}
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                                <label className="block font-bold mb-2 text-sm text-gray-700 dark:text-gray-300">{t('labelPdfTitle') || 'PDF-Titel (Deckblatt)'}</label>
                                <input 
                                    type="text" 
                                    className="w-full max-w-sm p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={localSettings.pdfCompanyName}
                                    placeholder={t('placeholderPdfTitle') || 'z.B. MEIN PORTFOLIO'}
                                    onChange={e => setLocalSettings({...localSettings, pdfCompanyName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block font-bold mb-2 text-sm text-gray-700 dark:text-gray-300">{t('labelPdfSubtitle') || 'PDF-Untertitel (Deckblatt)'}</label>
                                <input 
                                    type="text" 
                                    className="w-full max-w-sm p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={localSettings.pdfSubtitle}
                                    placeholder={t('placeholderPdfSubtitle') || 'z.B. VERMÖGENSÜBERSICHT 2026'}
                                    onChange={e => setLocalSettings({...localSettings, pdfSubtitle: e.target.value})}
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: KATEGORIEN */}
                    {activeTab === 'categories' && (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded text-sm mb-4 shrink-0">
                                {t('settingsCatDesc') || 'Definiere hier eigene Unterkategorien für deine Buchungen.'}
                            </div>
                            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                                <div className="w-full md:w-1/3 overflow-y-auto pr-2 custom-scrollbar">
                                    <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelTransTypeSetting') || 'Buchungstyp'}</label>
                                    <div className="space-y-1">
                                        {categoriesKeys.map(type => (
                                            <div key={type} onClick={()=>setSelectedCatType(type)} className={`p-2.5 rounded cursor-pointer text-sm font-medium transition-colors ${selectedCatType===type ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                                                {t(type) || type}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-full md:w-2/3 md:border-l border-gray-200 dark:border-slate-700 md:pl-6 overflow-y-auto custom-scrollbar">
                                    <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelSubCategories') || 'Unterkategorien'}</label>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {(localSettings.bookingCategories[selectedCatType]||[]).map(cat => (
                                            <span key={cat} className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 font-medium">
                                                {t(cat) || cat} 
                                                <Icon name="X" size={10} className="cursor-pointer text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition-opacity" onClick={()=>removeCategory(cat)}/>
                                            </span>
                                        ))}
                                    </div>
                                    <label className="block font-bold mb-2 text-xs text-gray-400 uppercase tracking-wider">{t('labelNewCategory') || 'Neue Kategorie'}</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder={t('placeholderCatName') || 'Name...'} className="flex-1 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" onKeyDown={e=>e.key==='Enter' && addCategory()}/>
                                        <button onClick={addCategory} className="bg-gray-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors shadow-sm shrink-0">{t('btnAdd') || 'Hinzufügen'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: ASSET-KLASSEN */}
                    {activeTab === 'assets' && (
                        <div className="space-y-6 flex flex-col h-full">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm shrink-0">
                                {t('settingsAssetDesc') || 'Definiere Asset-Klassen und beschreibe sie detailliert, um deine Vermögenswerte besser zu strukturieren.'}
                            </div>
                            
                            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                                {localSettings.assetClasses.map(asset => (
                                    <div key={asset.id} className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{asset.name}</span>
                                            <span className="text-[10px] font-mono bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md">{asset.id}</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            value={asset.description || ''} 
                                            onChange={e => updateAssetDesc(asset.id, e.target.value)}
                                            placeholder={t('placeholderAssetDesc') || 'Beschreibung (Optional)'}
                                            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700 shrink-0">
                                <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelNewAssetClass') || 'Neue Asset-Klasse erstellen'}</label>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <input 
                                        type="text" value={newAssetName} onChange={e=>setNewAssetName(e.target.value)} 
                                        placeholder={t('placeholderAssetName') || 'Name (z.B. Rohstoffe)'} 
                                        className="w-full md:w-1/3 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input 
                                        type="text" value={newAssetDesc} onChange={e=>setNewAssetDesc(e.target.value)} 
                                        placeholder={t('placeholderAssetDesc') || 'Beschreibung (Optional)'} 
                                        className="flex-1 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyDown={e=>e.key==='Enter' && addAssetClass()}
                                    />
                                    <button onClick={addAssetClass} className="bg-gray-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors shadow-sm shrink-0">
                                        {t('btnAdd') || 'Hinzufügen'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: KI-ASSISTENT */}
                    {activeTab === 'ai' && (
                        <div className="space-y-6">
                            <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={localSettings.aiEnabled} 
                                    onChange={(e) => setLocalSettings({...localSettings, aiEnabled: e.target.checked})}
                                    className="w-5 h-5 accent-blue-600"
                                />
                                <div>
                                    <div className="font-bold text-sm">{t('settingsAiEnable') || 'KI Beleg-Scanner aktivieren'}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('settingsAiEnableDesc') || 'Ermöglicht das Auslesen von PDF-Rechnungen und Dokumenten.'}</div>
                                </div>
                            </label>

                            <div className={`transition-opacity duration-300 ${localSettings.aiEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                
                                {/* LOKALE MODELLE */}
                                <h4 className="font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelAvailableModels') || 'Lokale Modelle (Ollama)'}</h4>
                                <div className="space-y-2 mb-6">
                                    {localSettings.aiModels.map(model => (
                                        <div key={model.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{model.name}</div>
                                                <div className="text-xs font-mono text-gray-500">{model.id}</div>
                                            </div>
                                            <button onClick={() => removeAiModel(model.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                <Icon name="Trash" size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2 mb-8 border-b border-gray-200 dark:border-slate-700 pb-8">
                                    <label className="block font-bold mb-3 text-xs text-gray-400 uppercase tracking-wider">{t('labelNewModel') || 'Neues lokales Modell (Ollama String) hinzufügen'}</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input 
                                            type="text" value={newAiModelId} onChange={e=>setNewAiModelId(e.target.value)} 
                                            placeholder={t('placeholderModelId') || 'Modell-ID (z.B. mistral:latest)'} 
                                            className="w-full sm:w-1/2 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input 
                                            type="text" value={newAiModelName} onChange={e=>setNewAiModelName(e.target.value)} 
                                            placeholder={t('placeholderModelName') || 'Anzeigename (z.B. Mistral 7B)'} 
                                            className="w-full sm:w-1/2 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={e=>e.key==='Enter' && addAiModel()}
                                        />
                                        <button onClick={addAiModel} className="bg-gray-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors shadow-sm shrink-0">
                                            {t('btnAdd') || 'Hinzufügen'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">{t('settingsAiNotice') || "Das Modell muss über deine lokale Ollama Installation verfügbar sein (z.B. via 'ollama run ...')."}</p>
                                </div>

{/* EXTERNE CLOUD MODELLE */}
                                <div>
                                    <h4 className="font-bold mb-2 text-xs text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                                        <Icon name="Cloud" size={14} /> {t('labelCloudAi') || 'Externe Cloud-KIs (Anonymisiert)'}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                                        {t('cloudAiDesc') || 'Hinterlege hier API-Keys für externe Anbieter. PDF-Daten werden vor der Übermittlung an die Cloud lokal anonymisiert (Kontonamen, IBANs etc. werden entfernt).'}
                                    </p>

                                    <div className="space-y-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('keyOpenAiApiKey') || 'OpenAI API-Key (ChatGPT)'}</label>
                                            <input 
                                                type="password" 
                                                value={localSettings.aiApiKeys?.openai || ''}
                                                onChange={e => updateApiKey('openai', e.target.value)}
                                                placeholder="sk-..." 
                                                className="w-full max-w-lg p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">{t('descOpenAiApiKey') || 'Aktiviert Modelle wie GPT-4o und GPT-4o-mini im Beleg-Scanner.'}</p>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('keyGeminiApiKey') || 'Google Gemini API-Key'}</label>
                                            <input 
                                                type="password" 
                                                value={localSettings.aiApiKeys?.gemini || ''}
                                                onChange={e => updateApiKey('gemini', e.target.value)}
                                                placeholder="AIza..." 
                                                className="w-full max-w-lg p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">{t('descGeminiApiKey') || 'Aktiviert Modelle wie Gemini 1.5 Pro im Beleg-Scanner.'}</p>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('keyAnthropicApiKey') || 'Anthropic API-Key (Claude)'}</label>
                                            <input 
                                                type="password" 
                                                value={localSettings.aiApiKeys?.anthropic || ''}
                                                onChange={e => updateApiKey('anthropic', e.target.value)}
                                                placeholder="sk-ant-..." 
                                                className="w-full max-w-lg p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">{t('descAnthropicApiKey') || 'Aktiviert Modelle wie Claude 3.5 Sonnet im Beleg-Scanner.'}</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* TAB: ALLGEMEIN & SICHERHEIT */}
                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            <div className="space-y-4 max-w-sm">
                                <div>
                                    <label className="block font-bold mb-2 text-sm text-gray-700 dark:text-gray-300">{t('labelBaseCurrency') || 'Basiswährung'}</label>
                                    <select className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500" value={localSettings.baseCurrency||'CHF'} onChange={e=>setLocalSettings({...localSettings, baseCurrency: e.target.value})}>
                                        <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">CHF</option>
                                        <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">USD</option>
                                        <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">EUR</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2 mt-4">
                                    <label className="text-sm font-bold text-gray-700 dark:text-slate-300">
                                        {t('settingsChartEngine') || 'Standard Chart-Engine'}
                                    </label>
                                    <select
                                        value={localSettings.chartEngine || 'echarts'}
                                        onChange={(e) => setLocalSettings({...localSettings, chartEngine: e.target.value})}
                                        className="p-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none">
                                        <option value="chartjs">Chart.js (JChart)</option>
                                        <option value="echarts">Apache ECharts</option>
                                        <option value="plotly">Plotly.js</option>
                                    </select>
                                    <p className="text-xs text-gray-400">
                                        {t('settingsChartEngineDesc') || 'Bestimmt, welche Engine standardmäßig zur Visualisierung der Finanzdaten genutzt wird.'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                                <label className="block font-bold mb-4 text-sm text-gray-700 dark:text-gray-300">{t('labelSaveMethod') || 'Speichermethode für Projekte'}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div 
                                        className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${localSettings.saveMethod === 'plaintext' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}
                                        onClick={() => setLocalSettings({...localSettings, saveMethod: 'plaintext'})}
                                    >
                                        <div className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200"><Icon name="FileText" /> {t('savePlaintext') || 'Klartext (JSON)'}</div>
                                        <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">{t('savePlaintextDesc') || 'Schnell, Standardformat, nicht verschlüsselt.'}</div>
                                    </div>
                                    <div 
                                        className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${localSettings.saveMethod === 'zip' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}
                                        onClick={() => setLocalSettings({...localSettings, saveMethod: 'zip'})}
                                    >
                                        <div className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200"><Icon name="Archive" /> {t('saveZip') || 'Verschlüsseltes ZIP'}</div>
                                        <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">{t('saveZipDesc') || 'Sehr sicher, erfordert PIN beim Speichern und Laden.'}</div>
                                    </div>
                                </div>
                                
                                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                                    <p className="text-xs text-amber-800 dark:text-amber-400">
                                        <strong>{t('importantNotice') || 'Wichtiger Hinweis:'}</strong> {t('zipWarning') || 'Beim verschlüsselten ZIP wird das gesamte Projekt mittels AES-256 gesichert. FinSPA speichert diesen PIN niemals dauerhaft. Ohne den PIN sind die Daten unwiederbringlich verloren!'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                    <button onClick={() => setModalObj(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-slate-700 text-sm transition-colors">{t('btnCancel') || 'Abbrechen'}</button>
                    <button onClick={handleSaveSettings} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm shadow-md transition-colors">{t('btnSaveSettings') || 'Einstellungen speichern'}</button>
                </div>
            </div>
        </div>
    );
};

module.exports = SettingsModal;