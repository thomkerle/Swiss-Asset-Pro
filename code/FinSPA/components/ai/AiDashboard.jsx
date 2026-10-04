/**
 * @file AiDashboard.jsx
 * @description FinSPA KI Copilot Dashboard mit Plugin-/Add-In-Speicherfunktion,
 * optimiertem Tab-Flyout für Temperatur/Kontext und Iframe-Sandbox.
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();
const Icon = safeRequire('../Icons.jsx') || (({name, className, size}) => <span className={className}>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules?.['data/DataEngine.jsx']?.exports || {};
const finspaSchema = safeRequire('../../schema/finspa-schema.json');
const { getFinSpaApiScript } = safeRequire('../../api/FinSpaApiInject.js') || require('../../api/FinSpaApiInject.js');
const { getSystemPrompt } = safeRequire('../../api/SystemPrompt.js') || require('../../api/SystemPrompt.js');

const extractCodeFromText = (inputText) => {
    if (!inputText) return null;
    try {
        const regex = new RegExp("\\x60\\x60\\x60(?:html|xml|javascript|js)?\\s*([\\s\\S]*?)\\s*\\x60\\x60\\x60", "i");
        const match = inputText.match(regex);
        let code = null;
        
        if (match && match[1]) {
            code = match[1].trim();
        } else {
            const doctypeIndex = inputText.toUpperCase().indexOf('<!DOCTYPE');
            const htmlIndex = inputText.toLowerCase().indexOf('<html');
            let startIndex = -1;
            if (doctypeIndex !== -1) startIndex = doctypeIndex;
            else if (htmlIndex !== -1) startIndex = htmlIndex;

            if (startIndex !== -1) {
                code = inputText.substring(startIndex).trim();
            }
        }

        if (code) {
            const endIndex = code.toLowerCase().lastIndexOf('</html>');
            if (endIndex !== -1) {
                code = code.substring(0, endIndex + 7);
            }
            code = code.replace(/^<modus_.*?>/i, '').replace(/<\/modus_.*?>$/i, '').trim();

            if (!code.toLowerCase().includes('<html')) {
                code = `<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body>${code}</body></html>`;
            }
            return code;
        }
        return null;
    } catch (e) {
        console.error("[AiDashboard] Fehler beim Extrahieren des Codes:", e);
        return null;
    }
};

const formatTokenCount = (num) => {
    if (num > 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const AiDashboard = ({ data, fCur, t, setModalObj, updateTreeData }) => {
    const isOpenAI = (id) => id.startsWith('gpt-');
    const isGemini = (id) => id.startsWith('gemini-');
    const isClaude = (id) => id.startsWith('claude-');
    const isCloudModelFn = (id) => isOpenAI(id) || isGemini(id) || isClaude(id);

    const buildAvailableModels = () => {
        const tLocal = t ? (t('suffixLocal') || '- Lokal') : '- Lokal';
        const tCloud = t ? (t('suffixCloud') || '(Cloud)') : '(Cloud)';

        let models = data?.settings?.aiModels && data.settings.aiModels.length > 0 
            ? [...data.settings.aiModels] 
            : [
                { id: 'qwen2.5-coder:14b', name: `Qwen 2.5 Coder (14B) ${tLocal}` },
                { id: 'llama3:latest', name: `Llama 3 (8B) ${tLocal}` }
            ];
            
        const keys = data?.settings?.aiApiKeys || {};
        
        if (keys.gemini) {
            models.push({ id: 'gemini-3.5-flash', name: `Gemini 3.5 Flash ${tCloud}` });
            models.push({ id: 'gemini-3.1-flash-lite', name: `Gemini 3.1 Flash Lite ${tCloud}` });
            models.push({ id: 'gemini-3-flash-preview', name: `Gemini 3 Flash Preview ${tCloud}` });
        }
        if (keys.openai) {
            models.push({ id: 'gpt-4o', name: `GPT-4o ${tCloud}` });
            models.push({ id: 'gpt-4o-mini', name: `GPT-4o-mini ${tCloud}` });
        }
        if (keys.anthropic) {
            models.push({ id: 'claude-3-5-sonnet-20240620', name: `Claude 3.5 Sonnet ${tCloud}` });
        }
        return models;
    };

    const availableModels = buildAvailableModels();

    const PROMPT_LIBRARY = [
        {
            category: 'Portfolio & Assets',
            icon: 'PieChart',
            prompts: [
                { title: 'Vorsorge & Rentenanalyse', text: 'Erstelle eine Auswertung, die mein liquides Vermögen der gebundenen Säule 3a und Pensionskasse gegenüberstellt und eine Rentenschätzung visualisiert.' },
                { title: 'Dividenden-Cluster & Zahltage', text: 'Zeige mir eine Übersicht der Top-Dividendenzahler gruppiert nach Zahlungsintervallen und Währungen.' },
                { title: 'Vermögenskonzentration & Klumpenrisiko', text: 'Analysiere Klumpenrisiken nach Banken und Einzelwerten mit einer Risikomatrix.' }
            ]
        },
        {
            category: 'Budget & Cashflow',
            icon: 'TrendingDown',
            prompts: [
                { title: 'Monatlicher Sparpuffer', text: 'Berechne meinen monatlichen freien Cashflow und zeige ein Balkendiagramm der Fixkosten vs. Einnahmen.' },
                { title: 'Historische Sparquote', text: 'Analysiere meine Sparquote über die letzten 12 Monate und stelle Einnahmen und Ausgaben gegenüber.' }
            ]
        },
        {
            category: 'FIRE & Zukunftsplanung',
            icon: 'Target',
            prompts: [
                { title: 'Projizierte liquide Vermögensentwicklung', text: 'Erstelle einen Zukunfts-Report, der mein liquides Vermögen über 10 Jahre mit einer 4% und 7% Renditekurve extrapoliert.' },
                { title: 'FIRE-Zielerreichung mit Szenarien', text: 'Berechne anhand meines Sparverhaltens das voraussichtliche Erreichen der finanziellen Freiheit unter Berücksichtigung geplanter Szenarien.' }
            ]
        }
    ];

    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState(data?.aiContext?.history || []);
    const [selectedModel, setSelectedModel] = useState(availableModels[0]?.id || 'qwen2.5-coder:14b');
    
    // Sidebar State mit Tabs
    const [showSidebar, setShowSidebar] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('prompts'); // 'prompts' | 'settings'
    const [aiTemperature, setAiTemperature] = useState(0.1);
    const [aiContextWindow, setAiContextWindow] = useState(16384);

    // Modal State: Plugin Speichern
    const [pluginModal, setPluginModal] = useState(null);
    const [pluginTitle, setPluginTitle] = useState('');
    const [pluginCategory, setPluginCategory] = useState('Vorsorge');
    
    const chatContainerRef = useRef(null);
    const endOfMessagesRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
        const timer = setTimeout(scrollToBottom, 300);
        return () => clearTimeout(timer);
    }, [chatHistory, isLoading, scrollToBottom]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

    const handleClearChat = () => {
        if (chatHistory.length === 0) return;
        if (window.confirm("Chatverlauf wirklich leeren?")) {
            setChatHistory([]);
            setPrompt('');
            if (updateTreeData) updateTreeData({ aiContext: { history: [], apiMessages: [] } });
        }
    };

    const handlePromptSelect = (predefinedText) => {
        setPrompt(predefinedText);
        setShowSidebar(false);
        if (textareaRef.current) textareaRef.current.focus();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(err => console.error('Fehler beim Kopieren:', err));
        if (typeof window !== 'undefined' && window.showToast) window.showToast("In die Zwischenablage kopiert", "info");
    };

    const existingCategories = useMemo(() => {
        const cats = new Set(['Vorsorge', 'Vermögen', 'Performance', 'Steuern', 'Cashflow', 'Budget']);
        (data?.plugins || []).forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return Array.from(cats);
    }, [data?.plugins]);

    const handleOpenSavePlugin = (htmlCode, lastUserPrompt = '') => {
        let suggestedTitle = 'Neuer Report';
        if (lastUserPrompt) {
            const clean = lastUserPrompt.replace(/^(erstelle|zeige|berechne|mache)\s+(mir\s+)?(einen\s+|eine\s+|das\s+)?/i, '').trim();
            suggestedTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
            if (suggestedTitle.length > 35) suggestedTitle = suggestedTitle.substring(0, 32) + '...';
        }

        let suggestedCat = 'Vermögen';
        const lower = (lastUserPrompt || '').toLowerCase();
        if (lower.includes('vorsorge') || lower.includes('3a') || lower.includes('rente') || lower.includes('pension')) suggestedCat = 'Vorsorge';
        else if (lower.includes('steuer')) suggestedCat = 'Steuern';
        else if (lower.includes('dividende') || lower.includes('rendite') || lower.includes('performance')) suggestedCat = 'Performance';
        else if (lower.includes('budget') || lower.includes('sparen') || lower.includes('ausgabe')) suggestedCat = 'Budget';
        else if (lower.includes('cashflow') || lower.includes('fluss')) suggestedCat = 'Cashflow';

        setPluginTitle(suggestedTitle);
        setPluginCategory(suggestedCat);
        setPluginModal({ code: htmlCode });
    };

    const handleConfirmSavePlugin = () => {
        if (!pluginTitle.trim()) {
            alert("Bitte geben Sie einen Namen für das Plugin ein.");
            return;
        }

        const newPlugin = {
            id: 'plug_' + Math.random().toString(36).substr(2, 9),
            title: pluginTitle.trim(),
            category: pluginCategory.trim() || 'Allgemein',
            code: pluginModal.code,
            createdAt: new Date().toISOString()
        };

        const updatedPlugins = [...(data?.plugins || []), newPlugin];
        if (updateTreeData) {
            updateTreeData({ plugins: updatedPlugins });
        }

        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(`Plugin "${newPlugin.title}" im Menü unter "${newPlugin.category}" gespeichert!`, "success");
        }

        setPluginModal(null);
    };

    const handleAskAI = async () => {
        if (!prompt.trim() || isLoading) return;

        const userMessage = { role: 'user', content: prompt, timestamp: new Date().toISOString() };
        const newHistory = [...chatHistory, userMessage];
        setChatHistory(newHistory);
        setPrompt('');
        setIsLoading(true);

        if (textareaRef.current) textareaRef.current.style.height = '56px';
        
        const budgetString = JSON.stringify(data?.budget || {});
        const schemaInfo = JSON.stringify(finspaSchema, null, 2);

        const systemPrompt = getSystemPrompt(schemaInfo, budgetString);
        const apiKeys = data?.settings?.aiApiKeys || {};
       
        try {
            let textContent = "";
            let returnedModel = selectedModel;
            
            const mappedHistory = newHistory.slice(-4).map(h => ({
                role: h.role === 'user' ? 'user' : 'assistant', 
                content: h.content || h.htmlWidget || h.text || ''
            }));

            if (isOpenAI(selectedModel)) {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeys.openai}`
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...mappedHistory
                        ],
                        temperature: aiTemperature
                    })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`OpenAI API: ${errData.error?.message || response.statusText}`);
                }
                const result = await response.json();
                textContent = result.choices[0].message.content;
                returnedModel = result.model || selectedModel;
                
            } else if (isClaude(selectedModel)) {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKeys.anthropic,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        system: systemPrompt,
                        messages: mappedHistory,
                        max_tokens: 4096,
                        temperature: aiTemperature
                    })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Anthropic API: ${errData.error?.message || response.statusText}`);
                }
                const result = await response.json();
                textContent = result.content[0].text;
                
            } else if (isGemini(selectedModel)) {
                const geminiMessages = mappedHistory.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                }));
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKeys.gemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: geminiMessages,
                        generationConfig: { temperature: aiTemperature }
                    })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Google API: ${errData.error?.message || response.statusText}`);
                }
                const result = await response.json();
                textContent = result.candidates[0].content.parts[0].text;
                
            } else {
                const response = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...newHistory.slice(-4).map(h => ({ role: h.role, content: h.content || h.htmlWidget || h.text || '' }))
                        ],
                        stream: false,
                        options: { temperature: aiTemperature, num_ctx: aiContextWindow }
                    })
                });
                if (!response.ok) throw new Error(`Ollama Error: ${response.status}`);
                const result = await response.json();
                textContent = result.message.content;
                returnedModel = result.model || selectedModel;
            }
            
            let cleanCode = extractCodeFromText(textContent);

            if (!cleanCode) {
                 const errorMessage = { 
                     role: 'assistant', text: "Konnte keinen gültigen HTML/JS Code aus der Antwort extrahieren.",
                     timestamp: new Date().toISOString()
                 };
                 const finalHistory = [...newHistory, errorMessage];
                 setChatHistory(finalHistory);
                 if (updateTreeData) updateTreeData({ aiContext: { history: finalHistory } });
                 return;
            }

            const finalMessage = { 
                role: 'assistant', 
                htmlWidget: cleanCode, 
                userPrompt: userMessage.content,
                timestamp: new Date().toISOString(), 
                modelUsed: returnedModel 
            };
            
            const finalHistory = [...newHistory, finalMessage];
            setChatHistory(finalHistory);
            if (updateTreeData) updateTreeData({ aiContext: { history: finalHistory } });

        } catch (error) {
            const isCloud = isCloudModelFn(selectedModel);
            const errorPrefix = isCloud ? '' : 'Verbindungsfehler zur lokalen KI (Ollama): ';
            setChatHistory([...newHistory, { 
                role: 'assistant', 
                text: `${errorPrefix}${error.message}`.trim(), 
                isError: true, 
                timestamp: new Date().toISOString() 
            }]);
        } finally { 
            setIsLoading(false); 
        }
    };

    const renderIframeWidget = (htmlContent, lastPrompt = '') => {
        const injectedScripts = `
        <style>
            html, body {
                margin: 0;
                padding: 12px;
                box-sizing: border-box;
                max-width: 100vw;
                overflow-x: hidden;
                font-family: system-ui, -apple-system, sans-serif;
                background-color: #ffffff;
            }
            * { box-sizing: inherit; }
            canvas {
                max-width: 100% !important;
                max-height: 400px !important;
                height: auto !important;
                background-color: #ffffff;
            }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script>
            window.PdfToolkit = window.parent.PdfToolkit || window.PdfToolkit;
            window.PdfExportEngine = window.parent.PdfToolkit || window.parent.PdfExportEngine || window.PdfExportEngine;
            
            if (window.Chart) {
                window.Chart.defaults.animation = false;
                window.Chart.defaults.responsiveAnimationDuration = 0;
            }
            if (window.echarts) {
                const originalInit = window.echarts.init;
                window.echarts.init = function() {
                    const chart = originalInit.apply(this, arguments);
                    const originalSetOption = chart.setOption;
                    chart.setOption = function(option) {
                        if (option) option.animation = false;
                        return originalSetOption.apply(this, arguments);
                    };
                    return chart;
                };
            }
        </script>
        ${getFinSpaApiScript()}
        <script>
            window.finspaData = ${JSON.stringify(data).replace(/</g, '\\u003c')};        
        </script>
        `;

        let finalHtml = htmlContent;
        if (finalHtml.includes('</head>')) {
            finalHtml = finalHtml.replace('</head>', injectedScripts + '\n</head>');
        } else {
            finalHtml = injectedScripts + finalHtml;
        }

        return (
            <div className="flex flex-col mt-3 w-full animate-fade-in-up">
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl transition-all group">
                    <div className="bg-gradient-to-b from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 opacity-70">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-3 tracking-wider uppercase">
                                FinBundle AI Widget
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleOpenSavePlugin(htmlContent, lastPrompt)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Diesen Report dauerhaft im Menü unter Plugins speichern"
                            >
                                <Icon name="FolderPlus" size={13} className="text-white" />
                                <span>Als Plugin speichern</span>
                            </button>
                            
                            <button 
                                className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" 
                                title="Widget neu laden" 
                                onClick={(e) => {
                                    const iframe = e.currentTarget.parentElement.parentElement.parentElement.querySelector('iframe');
                                    if (iframe) iframe.srcdoc = iframe.srcdoc;
                                }}
                            >
                                <Icon name="RefreshCw" size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative bg-white dark:bg-slate-950">
                        <iframe 
                            srcDoc={finalHtml}
                            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-modals"
                            className="w-full bg-transparent"
                            style={{ minHeight: '480px', height: '100%', border: 'none' }} 
                            title="AI Generated Widget"
                        />
                    </div>
                </div>

                <details className="mt-4 text-sm text-gray-500 dark:text-slate-400 group/code">
                    <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors list-none flex items-center gap-2 font-medium bg-gray-50 dark:bg-slate-900/50 w-max px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-800">
                        <Icon name="Code" size={16} /> Code anzeigen
                        <Icon name="ChevronDown" size={14} className="ml-2 group-open/code:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-3 relative animate-fade-in-up">
                        <button 
                            onClick={() => copyToClipboard(htmlContent)}
                            className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600 shadow-md z-10"
                            title="Code kopieren"
                        >
                            <Icon name="Copy" size={16} />
                        </button>
                        <pre className="p-5 bg-[#0d1117] text-[#c9d1d9] rounded-2xl overflow-x-auto whitespace-pre-wrap border border-slate-800 shadow-inner text-xs font-mono leading-relaxed custom-scrollbar">
                            {htmlContent}
                        </pre>
                    </div>
                </details>
            </div>
        );
    };

    // --- RECHTES FLYOUT: MIT TABS & GARANTIERT FREI ZUGÄNGLICHER TEMPERATUR ---
    const renderSidebar = () => {
        return (
            <div className={`fixed inset-y-0 right-0 w-96 max-w-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                        <Icon name={sidebarTab === 'prompts' ? "BookOpen" : "Settings"} className="text-blue-500" /> 
                        {sidebarTab === 'prompts' ? 'Prompt Bibliothek' : 'KI Einstellungen'}
                    </h2>
                    <button onClick={() => setShowSidebar(false)} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors">
                        <Icon name="X" size={20} />
                    </button>
                </div>

                {/* Tabs Leiste */}
                <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-950/60 p-1.5 shrink-0">
                    <button 
                        onClick={() => setSidebarTab('prompts')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${sidebarTab === 'prompts' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="BookOpen" size={13} />
                        <span>Prompts</span>
                    </button>
                    <button 
                        onClick={() => setSidebarTab('settings')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${sidebarTab === 'settings' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="Settings" size={13} />
                        <span>Einstellungen ({aiTemperature})</span>
                    </button>
                </div>

                {/* Body mit pb-32 Puffer gegen Abschneiden */}
                <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-6 custom-scrollbar">
                    
                    {/* TAB 1: PROMPTS */}
                    {sidebarTab === 'prompts' && (
                        <div className="space-y-6">
                            {PROMPT_LIBRARY.map((category, idx) => (
                                <div key={idx}>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                        <Icon name={category.icon} size={14} /> {category.category}
                                    </h3>
                                    <div className="space-y-2">
                                        {category.prompts.map((p, pIdx) => (
                                            <div 
                                                key={pIdx} onClick={() => handlePromptSelect(p.text)}
                                                className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md bg-white dark:bg-slate-950 cursor-pointer transition-all group"
                                            >
                                                <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">{p.title}</div>
                                                <div className="text-xs text-gray-500 dark:text-slate-500 line-clamp-2">{p.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TAB 2: KI-EINSTELLUNGEN */}
                    {sidebarTab === 'settings' && (
                        <div className="space-y-6 animate-fade-in-up">
                            
                            {/* Temperatur Box */}
                            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Icon name="Zap" size={13} className="text-amber-500" />
                                        Modell-Temperatur
                                    </span>
                                    <span className="font-mono text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                        {aiTemperature.toFixed(1)}
                                    </span>
                                </div>

                                <input 
                                    type="range" 
                                    min="0.0" 
                                    max="1.0" 
                                    step="0.05" 
                                    value={aiTemperature} 
                                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))} 
                                    className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 dark:bg-slate-800 rounded-lg"
                                />

                                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                                    <span>0.0 (Faktisch / Code)</span>
                                    <span>0.5 (Ausgewogen)</span>
                                    <span>1.0 (Kreativ)</span>
                                </div>

                                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed pt-1">
                                    {aiTemperature <= 0.2 ? 'Empfohlen für exakte Charts, Berechnungen und fehlerfreien Code.' : 'Höhere Kreativität – für freie Finanzanalysen oder neue Widget-Ideen.'}
                                </p>
                            </div>

                            {/* Kontextfenster */}
                            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                                <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    <span>Kontextfenster</span>
                                    <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400">{formatTokenCount(aiContextWindow)}</span>
                                </label>
                                
                                <select 
                                    value={aiContextWindow} 
                                    onChange={(e) => setAiContextWindow(parseInt(e.target.value))}
                                    className="w-full p-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none font-semibold cursor-pointer"
                                >
                                    <option value={4096}>4K Tokens (~3'000 Wörter)</option>
                                    <option value={8192}>8K Tokens (~6'000 Wörter)</option>
                                    <option value={16384}>16K Tokens (~12'000 Wörter - Empfohlen)</option>
                                    <option value={32768}>32K Tokens (~24'000 Wörter)</option>
                                </select>
                                
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                                    Größere Fenster erlauben der KI, das komplette Portfolio samt Buchungshistorie im Gedächtnis zu behalten[cite: 17, 23].
                                </p>
                            </div>

                            {/* Modellinfo Box */}
                            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Icon name="Cpu" size={14} className="text-blue-600 dark:text-blue-400" />
                                    Aktives Modell: {selectedModel}
                                </div>
                                <div className="text-[11px] text-blue-800/80 dark:text-blue-400/80 leading-relaxed">
                                    {isCloudModelFn(selectedModel) 
                                        ? 'Cloud-Verarbeitung mit hoher Geschwindigkeit und komplexer Code-Generierung.' 
                                        : 'Vollständig lokale Ausführung über Ollama. Deine Daten verlassen dieses Gerät nicht.'}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col relative transition-colors duration-500 overflow-hidden font-sans">
            
            {showSidebar && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" 
                    onClick={() => setShowSidebar(false)}
                />
            )}
            
            {renderSidebar()}

            <header className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-20 flex justify-between items-center shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-[#2548C3] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white flex items-center justify-center">
                        <Icon name="Cpu" size={22} className="stroke-[2.5px]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                            FinBundle <span className="text-blue-600 dark:text-blue-400">Copilot</span>
                        </h1>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">KI-gestützte Report- & Widget-Entwicklung</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center bg-gray-100 dark:bg-slate-900 rounded-xl p-1 border border-gray-200 dark:border-slate-800">
                        <Icon name="Box" size={14} className="ml-2 text-gray-400" />
                        <select 
                            value={selectedModel} onChange={e => setSelectedModel(e.target.value)} 
                            className="text-xs py-1.5 px-2 bg-transparent text-gray-700 dark:text-slate-300 outline-none font-semibold cursor-pointer min-w-[140px]"
                        >
                            {availableModels.map(m => <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{m.name}</option>)}
                        </select>
                    </div>

                    <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

                    <button 
                        onClick={handleClearChat} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300"
                    >
                        <Icon name="PlusCircle" size={16} /> <span className="hidden sm:inline">Neuer Chat</span>
                    </button>

                    <button 
                        onClick={() => { setSidebarTab('prompts'); setShowSidebar(true); }} 
                        className="p-2.5 rounded-xl text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        title="Prompts & Einstellungen"
                    >
                        <Icon name="BookOpen" size={18} />
                    </button>
                </div>
            </header>
            
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative bg-gray-50/50 dark:bg-slate-950">
                <div className="flex-1 p-4 md:p-8 space-y-8 w-full max-w-6xl mx-auto">
                    
                    {chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full mt-10 md:mt-20 animate-fade-in-up px-4">
                            <div className="inline-flex justify-center items-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6 shadow-xl">
                                <Icon name="Sparkles" size={36} />
                            </div>
                            <h2 className="text-3xl font-black mb-3 text-slate-800 dark:text-slate-100 text-center">
                                Was möchtest du heute analysieren?
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-lg text-sm">
                                Stelle eine Finanzfrage. Der Copilot generiert interaktive Widgets, die du direkt als dauerhaftes <strong>Menü-Plugin</strong> speichern kannst.
                            </p>
                            
                            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                                {PROMPT_LIBRARY[0].prompts.slice(0, 2).map((p, i) => (
                                    <button 
                                        key={i} onClick={() => handlePromptSelect(p.text)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-semibold hover:border-blue-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300"
                                    >
                                        {p.title}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => { setSidebarTab('prompts'); setShowSidebar(true); }}
                                    className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all flex items-center gap-1.5"
                                >
                                    <Icon name="Menu" size={13} /> Alle Prompts
                                </button>
                            </div>
                        </div>
                    )}

                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            {msg.role === 'user' ? (
                                <div className="max-w-[85%] md:max-w-[70%] px-6 py-4 rounded-3xl rounded-tr-sm text-[15px] leading-relaxed bg-gray-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm border border-gray-200/50 dark:border-slate-700/50">
                                    {msg.content}
                                </div>
                            ) : (
                                <div className="w-full max-w-5xl flex gap-3 md:gap-5">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2548C3] to-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg mt-1">
                                        <Icon name="Cpu" size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">FinBundle Copilot</span>
                                            {msg.modelUsed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 font-mono">{msg.modelUsed}</span>}
                                        </div>
                                        {msg.text && (
                                            <div className={`p-5 rounded-2xl rounded-tl-sm text-sm border shadow-sm ${msg.isError ? 'bg-red-50 dark:bg-red-900/10 text-red-700 border-red-200' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-800'}`}>
                                                {msg.text}
                                            </div>
                                        )}
                                        {msg.htmlWidget && renderIframeWidget(msg.htmlWidget, msg.userPrompt)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="w-full max-w-5xl flex gap-3 md:gap-5 animate-fade-in-up">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 animate-pulse mt-1">
                                <Icon name="Cpu" size={20} />
                            </div>
                            <div className="flex items-center gap-3 px-6 py-4 rounded-3xl rounded-tl-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                                <span className="text-sm font-medium text-slate-500">Copilot generiert Analyse & Code...</span>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} className="h-6 w-full shrink-0"></div>
                </div>
            </main>

            <footer className="shrink-0 p-4 md:px-8 md:py-6 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 relative z-20">
                <div className="max-w-4xl mx-auto relative">
                    <textarea 
                        ref={textareaRef}
                        className="w-full pl-6 pr-[68px] py-4 border border-gray-300 dark:border-slate-700 rounded-[28px] resize-none bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 outline-none text-[15px] min-h-[56px] max-h-[200px] transition-all text-slate-800 dark:text-slate-200 custom-scrollbar"
                        placeholder="Beschreibe die gewünschte Auswertung..."
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                        rows={1}
                    />
                    
                    <button 
                        onClick={handleAskAI} 
                        disabled={isLoading || !prompt.trim()} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-all shadow-md"
                    >
                        <Icon name="ArrowUp" size={20} />
                    </button>
                </div>
            </footer>

            {/* MODAL: ALS PLUGIN SPEICHERN */}
            {pluginModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Icon name="FolderPlus" className="text-blue-500" />
                                Report als Plugin speichern
                            </h3>
                            <button onClick={() => setPluginModal(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white">
                                <Icon name="X" size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    Name des Reports (im Menü)
                                </label>
                                <input 
                                    type="text" 
                                    value={pluginTitle} 
                                    onChange={e => setPluginTitle(e.target.value)} 
                                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmSavePlugin(); if (e.key === 'Escape') setPluginModal(null); }}
                                    placeholder="z.B. Vorsorge & Rentenanalyse" 
                                    className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    Menü-Kategorie (z.B. Vorsorge, Vermögen)
                                </label>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={pluginCategory} 
                                        onChange={e => setPluginCategory(e.target.value)} 
                                        placeholder="Kategorie eingeben..." 
                                        className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                    />
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {existingCategories.map((c, i) => (
                                            <button 
                                                key={i} 
                                                type="button" 
                                                onClick={() => setPluginCategory(c)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${pluginCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                Dieser Report wird dauerhaft im Hauptmenü unter <strong>Plugins &rarr; {pluginCategory || '...'}</strong> verankert und steht jederzeit für Analysen und den PDF-Export bereit.
                            </p>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 flex justify-end gap-3">
                            <button 
                                onClick={() => setPluginModal(null)} 
                                className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold"
                            >
                                Abbrechen
                            </button>
                            <button 
                                onClick={handleConfirmSavePlugin} 
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                            >
                                Als Plugin speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

module.exports = AiDashboard;