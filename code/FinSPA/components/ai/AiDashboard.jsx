/**
 * @file AiDashboard.jsx
 * @description FinSPA KI Copilot Dashboard. Bietet eine Chat-Schnittstelle zu lokalen LLMs (Ollama)
 * sowie zu Cloud-Modellen (OpenAI, Anthropic, Gemini), generiert dynamische HTML/Chart.js Widgets 
 * basierend auf den Finanzdaten des Nutzers.
 * @version 2.6.0 - Robust Cloud API Handling (analog zum PdfScanner)
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();
const Icon = safeRequire('../Icons.jsx') || (({name, className, size}) => <span className={className}>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const finspaSchema = safeRequire('../../schema/finspa-schema.json');
const { getFinSpaApiScript } = safeRequire('../../api/FinSpaApiInject.js') || require('../../api/FinSpaApiInject.js');
const { getSystemPrompt } = safeRequire('../../api/SystemPrompt.js') || require('../../api/SystemPrompt.js');

const extractCodeFromText = (inputText) => {
    if (!inputText) return null;
    try {
        const regex = new RegExp("\\x60\\x60\\x60(?:html|xml)?\\s*([\\s\\S]*?)\\s*\\x60\\x60\\x60", "i");
        const match = inputText.match(regex);
        let code = null;
        if (match && match[1]) {
            code = match[1].trim();
        } else {
            const doctypeIndex = inputText.toUpperCase().indexOf('<!DOCTYPE');
            const htmlIndex = inputText.toLowerCase().indexOf('<HTML');
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
            return code;
        }
        return null;
    } catch (e) {
        console.error("Fehler beim Extrahieren des Codes:", e);
        return null;
    }
};

const formatTokenCount = (num) => {
    if (num > 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const AiDashboard = ({ data, fCur, t, setModalObj, updateTreeData }) => {
    
    // --- HILFSFUNKTIONEN WIE IM PDF-SCANNER ---
    const isOpenAI = (id) => id.startsWith('gpt-');
    const isGemini = (id) => id.startsWith('gemini-');
    const isClaude = (id) => id.startsWith('claude-');
    const isCloudModelFn = (id) => isOpenAI(id) || isGemini(id) || isClaude(id);

    // --- DYNAMISCHE MODELLE WIE IM PDF-SCANNER LADEN ---
// --- DYNAMISCHE MODELLE WIE IM PDF-SCANNER LADEN ---
    const buildAvailableModels = () => {
        const tLocal = t ? t('suffixLocal') : '- Lokal';
        const tCloud = t ? t('suffixCloud') : '(Cloud)';

        let models = data?.settings?.aiModels && data.settings.aiModels.length > 0 
            ? [...data.settings.aiModels] 
            : [
                { id: 'qwen2.5-coder:14b', name: `Qwen 2.5 Coder (14B) ${tLocal}` },
                { id: 'llama3:latest', name: `Llama 3 (8B) ${tLocal}` }
            ];
            
        const keys = data?.settings?.aiApiKeys || {};
        
        if (keys.gemini) {
            // Aktualisiert auf die neuen Gemini 3 Modelle
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
            category: t('aiCatPortfolio') || 'Portfolio & Assets',
            icon: 'PieChart',
            prompts: [
                { title: t('aiP1Title'), text: t('aiP1Text') },
                { title: t('aiP2Title'), text: t('aiP2Text') },
                { title: t('aiP3Title'), text: t('aiP3Text') }
            ]
        },
        {
            category: t('aiCatBudget') || 'Budget & Cashflow',
            icon: 'TrendingDown',
            prompts: [
                { title: t('aiP4Title'), text: t('aiP4Text') },
                { title: t('aiP5Title'), text: t('aiP5Text') },
                { title: t('aiP6Title'), text: t('aiP6Text') }
            ]
        },
        {
            category: t('aiCatFire') || 'FIRE & Zukunftsplanung',
            icon: 'Target',
            prompts: [
                { title: t('aiP7Title'), text: t('aiP7Text') },
                { title: t('aiP8Title'), text: t('aiP8Text') }
            ]
        }
    ];

    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState(data.aiContext?.history || []);
    const [selectedModel, setSelectedModel] = useState(availableModels[0]?.id || 'qwen2.5-coder:14b');
    
    const [showSidebar, setShowSidebar] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [aiTemperature, setAiTemperature] = useState(0.1);
    const [aiContextWindow, setAiContextWindow] = useState(16384);
    
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
        if (window.confirm(t('aiClearChatConfirm') || "Chatverlauf leeren?")) {
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
    };

    const handleAskAI = async () => {
        if (!prompt.trim() || isLoading) return;

        const userMessage = { role: 'user', content: prompt, timestamp: new Date().toISOString() };
        const newHistory = [...chatHistory, userMessage];
        setChatHistory(newHistory);
        setPrompt('');
        setIsLoading(true);

        if (textareaRef.current) textareaRef.current.style.height = '56px';
        
        const budgetString = JSON.stringify(data.budget || {});
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

            // --- CLOUD ROUTING ODER LOKAL ---
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
                    throw new Error(`OpenAI API: ${errData.error?.message || response.statusText || 'Unbekannter Fehler'}`);
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
                    throw new Error(`Anthropic API: ${errData.error?.message || response.statusText || 'Unbekannter Fehler'}`);
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
                    throw new Error(`Google API: ${errData.error?.message || response.statusText || 'Unbekannter Fehler'}`);
                }
                const result = await response.json();
                textContent = result.candidates[0].content.parts[0].text;
                
            } else {
                // Local Ollama Fallback
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
                     role: 'assistant', text: t('aiErrorNoHtml') || "Konnte keinen gültigen Code aus der Antwort extrahieren.",
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
                timestamp: new Date().toISOString(), 
                modelUsed: returnedModel 
            };
            
            const finalHistory = [...newHistory, finalMessage];
            
            setChatHistory(finalHistory);
            if (updateTreeData) updateTreeData({ aiContext: { history: finalHistory } });

        } catch (error) {
            // Dynamischer Fehlerpräfix analog zum PdfScanner
            const isCloud = isCloudModelFn(selectedModel);
            const errorPrefix = isCloud ? '' : (t('aiErrorConnection') ? t('aiErrorConnection') + ' ' : 'Verbindungsfehler zur lokalen KI (Ollama): ');
            
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

    const renderIframeWidget = (htmlContent) => {
        // PARAMETERLOSE INJECTED-API
        const injectedScripts = `
        <style>
            /* Basis-Reset für den iFrame */
            html, body {
                margin: 0;
                padding: 10px;
                box-sizing: border-box;
                max-width: 100vw;
                overflow-x: hidden;
                font-family: system-ui, -apple-system, sans-serif;
            }
            * { box-sizing: inherit; }

            canvas {
                max-width: 100% !important;
                max-height: 400px !important;
                height: auto !important;
                object-fit: contain;
            }

            .js-plotly-plot, .plotly-graph-div, div[_echarts_instance_] {
                max-width: 100% !important;
                max-height: 400px !important;
            }

            .chart-container, #chart, #myChart, .wrapper {
                position: relative;
                width: 100% !important;
                max-width: 100% !important;
                max-height: 400px !important;
                display: flex;
                justify-content: center;
                align-items: center;
            }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
        <script>
            window.PdfExportEngine = window.parent.PdfExportEngine; 
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
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 dark:shadow-black/30 transition-all group">
                    <div className="bg-gradient-to-b from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 group-hover:opacity-100 opacity-70 transition-opacity">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-3 tracking-wider uppercase">
                                {t('aiWidgetTitle') || 'AI Widget'} <span className="opacity-50 lowercase ml-1">{t('aiWidgetVersion')}</span>
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button className="text-gray-400 hover:text-blue-500 transition-colors" title={t('aiWidgetReload')} onClick={(e) => {
                                const iframe = e.currentTarget.parentElement.parentElement.parentElement.querySelector('iframe');
                                if (iframe) iframe.srcdoc = iframe.srcdoc;
                            }}>
                                <Icon name="RefreshCw" size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative bg-white dark:bg-slate-950">
                        <iframe 
                            srcDoc={finalHtml}
                            sandbox="allow-scripts allow-same-origin allow-downloads"
                            className="w-full bg-transparent"
                            style={{ minHeight: '450px', height: '100%', border: 'none' }} 
                            title="AI Generated Widget"
                        />
                    </div>
                </div>

                <details className="mt-4 text-sm text-gray-500 dark:text-slate-400 group/code">
                    <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors list-none flex items-center gap-2 font-medium bg-gray-50 dark:bg-slate-900/50 w-max px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-800">
                        <Icon name="Code" size={16} /> {t('aiViewCode') || 'Code anzeigen'}
                        <Icon name="ChevronDown" size={14} className="ml-2 group-open/code:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-3 relative animate-fade-in-up">
                        <button 
                            onClick={() => copyToClipboard(htmlContent)}
                            className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600 shadow-md z-10"
                            title={t('aiCopyCode')}
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

    const renderSidebar = () => {
        return (
            <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                        <Icon name="BookOpen" className="text-blue-500" /> {t('aiPromptLibrary') || 'Prompt Bibliothek'}
                    </h2>
                    <button onClick={() => setShowSidebar(false)} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors">
                        <Icon name="X" size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
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

                    <hr className="border-gray-200 dark:border-slate-800" />

                    <div>
                        <div className="flex justify-between items-center cursor-pointer group" onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}>
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                <Icon name="Settings" size={14} /> {t('aiAdvancedSettings') || 'Erweiterte Einstellungen'}
                            </h3>
                            <Icon name={showAdvancedSettings ? "ChevronUp" : "ChevronDown"} size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        
                        {showAdvancedSettings && (
                            <div className="mt-4 space-y-4 animate-fade-in-up">
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        <span>{t('aiTemp')}</span><span className="font-mono">{aiTemperature}</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="1" step="0.1" value={aiTemperature} 
                                        onChange={(e) => setAiTemperature(parseFloat(e.target.value))} className="w-full accent-blue-600"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">{t('aiTempDesc')}</p>
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        <span>{t('aiContext')}</span><span className="font-mono">{formatTokenCount(aiContextWindow)}</span>
                                    </label>
                                    <select 
                                        value={aiContextWindow} onChange={(e) => setAiContextWindow(parseInt(e.target.value))}
                                        className="w-full p-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                                    >
                                        <option value={4096} className="bg-white dark:bg-slate-900">{t('aiCtx4k') || '4K Tokens'}</option>
                                        <option value={8192} className="bg-white dark:bg-slate-900">{t('aiCtx8k') || '8K Tokens'}</option>
                                        <option value={16384} className="bg-white dark:bg-slate-900">{t('aiCtx16k') || '16K Tokens'}</option>
                                        <option value={32768} className="bg-white dark:bg-slate-900">{t('aiCtx32k') || '32K Tokens'}</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col relative transition-colors duration-500 overflow-hidden font-sans">
            
            {showSidebar && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowSidebar(false)}></div>}
            
            {renderSidebar()}

            <header className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-20 flex justify-between items-center shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-[#2548C3] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white flex items-center justify-center">
                        <Icon name="Cpu" size={22} className="stroke-[2.5px]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                            {t('aiCopilotTitle') || 'FinSPA'} <span className="text-blue-600 dark:text-blue-400">Copilot</span>
                        </h1>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('aiCopilotSubtitle')}</p>
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
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all duration-300"
                        title={t('aiClearChatTooltip')}
                    >
                        <Icon name="PlusCircle" size={16} /> <span className="hidden sm:inline">{t('aiNewChat') || 'Neuer Chat'}</span>
                    </button>

                    <button 
                        onClick={() => setShowSidebar(true)} 
                        className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50" 
                        title={t('aiPromptSettingsTooltip')}
                    >
                        <Icon name="BookOpen" size={18} />
                    </button>
                </div>
            </header>
            
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative bg-gray-50/50 dark:bg-slate-950">
                
                <div className="flex-1 p-4 md:p-8 space-y-8 w-full max-w-6xl mx-auto">
                    
                    {chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full mt-10 md:mt-20 animate-fade-in-up px-4">
                            <div className="inline-flex justify-center items-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 mb-8 shadow-2xl shadow-blue-500/10">
                                <Icon name="Sparkles" size={40} className="stroke-1" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black mb-4 text-slate-800 dark:text-slate-100 tracking-tight text-center">
                                {t('aiReadyToCode')}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-12 text-center max-w-lg text-lg leading-relaxed">
                                {t('aiHeroDesc')}
                            </p>
                            
                            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                                {PROMPT_LIBRARY[0].prompts.slice(0, 2).map((p, i) => (
                                    <button 
                                        key={i} onClick={() => handlePromptSelect(p.text)}
                                        className="px-5 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-sm font-semibold hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all text-slate-700 dark:text-slate-300"
                                    >
                                        {p.title}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setShowSidebar(true)}
                                    className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center gap-2"
                                >
                                    <Icon name="Menu" size={16} /> {t('aiShowAllPrompts') || 'Alle Prompts'}
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
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2548C3] to-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20 mt-1">
                                        <Icon name="Cpu" size={20} className="stroke-[2px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">FinSPA Copilot</span>
                                            {msg.modelUsed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 font-mono">{msg.modelUsed}</span>}
                                        </div>
                                        {msg.text && (
                                            <div className={`p-5 rounded-2xl rounded-tl-sm text-sm border shadow-sm ${msg.isError ? 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-800'}`}>
                                                {msg.text}
                                            </div>
                                        )}
                                        {msg.htmlWidget && renderIframeWidget(msg.htmlWidget)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="w-full max-w-5xl flex gap-3 md:gap-5 animate-fade-in-up">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2548C3] to-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20 mt-1">
                                <Icon name="Cpu" size={20} className="stroke-[2px] animate-pulse" />
                            </div>
                            <div className="flex items-center gap-3 px-6 py-4 rounded-3xl rounded-tl-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm w-max">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 ml-2">
                                    {t('aiIsTyping') || 'Denkt nach...'}
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} className="h-6 w-full shrink-0"></div>
                </div>
            </main>

            <footer className="shrink-0 p-4 md:px-8 md:py-6 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 relative z-20">
                <div className="max-w-4xl mx-auto relative group">
                    
                    {chatHistory.length > 0 && (
                        <button 
                            onClick={handleClearChat}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all z-10"
                            title={t('aiClearChatConfirm')}
                        >
                            <Icon name="Trash2" size={18} />
                        </button>
                    )}

                    <textarea 
                        ref={textareaRef}
                        className={`w-full ${chatHistory.length > 0 ? 'pl-14' : 'pl-6'} pr-[68px] py-4 border border-gray-300 dark:border-slate-700 rounded-[28px] resize-none bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:border-[#2548C3] dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-[15px] min-h-[56px] max-h-[200px] transition-all text-slate-800 dark:text-slate-200 shadow-inner custom-scrollbar`}
                        placeholder={t('aiInputPlaceholder') || 'Frag den FinSPA Copilot...'}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                        rows={1}
                    />
                    
                    <button 
                        onClick={handleAskAI} 
                        disabled={isLoading || !prompt.trim()} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#2548C3] hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-md active:scale-95 disabled:shadow-none disabled:active:scale-100"
                        title={t('aiSendTooltip')}
                    >
                        <Icon name="ArrowUp" size={20} className="font-bold stroke-[3px]" />
                    </button>
                </div>
                <div className="text-center mt-3 text-[10px] text-gray-400 dark:text-slate-500 font-medium tracking-wide">
                    {isCloudModelFn(selectedModel) 
                        ? `CLOUD KI (${selectedModel.toUpperCase()}) • DATEN WERDEN ZUR VERARBEITUNG GESENDET` 
                        : (t('aiPrivacyDisclaimer') ? t('aiPrivacyDisclaimer').replace('{model}', selectedModel.split(':')[0].toUpperCase()) : `LOKALE KI (${selectedModel.split(':')[0].toUpperCase()}) • DATEN VERLASSEN DEIN GERÄT NICHT`)}
                </div>
            </footer>
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
                
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(15px) scale(0.99); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}} />
        </div>
    );
};

module.exports = AiDashboard;