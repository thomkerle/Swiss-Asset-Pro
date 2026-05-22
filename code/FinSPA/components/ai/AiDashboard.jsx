/**
 * @file AiDashboard.jsx
 * @description FinSPA KI Copilot Dashboard. Bietet eine Chat-Schnittstelle zu lokalen LLMs (Ollama),
 * generiert dynamische HTML/Chart.js Widgets basierend auf den Finanzdaten des Nutzers.
 * @version 2.2.0 - Enterprise Edition (inkl. Quick-Clear & Start-Dashboard Reset)
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback } = React;

// --- DYNAMIC IMPORTS & FALLBACKS ---
const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();
const Icon = safeRequire('../Icons.jsx') || (({name, className, size}) => <span className={className}>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};

// ============================================================================
// HILFSFUNKTIONEN & UTILS
// ============================================================================

const extractCodeFromText = (inputText) => {
    if (!inputText) return null;
    try {
        // Maskierte Backticks (\x60), damit der Markdown-Parser nicht abstürzt
        const regex = new RegExp("\\x60\\x60\\x60(?:html|xml)?\\s*([\\s\\S]*?)\\s*\\x60\\x60\\x60", "i");
        const match = inputText.match(regex);
        
        let code = null;
        if (match && match[1]) {
            code = match[1].trim();
        } else {
            // Fallback: KI hat Backticks komplett vergessen
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

// ============================================================================
// KONSTANTEN & PROMPT BIBLIOTHEK
// ============================================================================

const AVAILABLE_MODELS = [
    { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder (14B)', icon: 'Cpu', recommended: true },
    { id: 'llama3:latest', name: 'Llama 3 (8B)', icon: 'Zap', recommended: false },
    { id: 'mistral-nemo:latest', name: 'Mistral (7B)', icon: 'Wind', recommended: false },
    { id: 'codellama:13b', name: 'CodeLlama (13B)', icon: 'Code', recommended: false },
    { id: 'phi3:latest', name: 'Phi 3', icon: 'Code', recommended: false},
    { id: 'hermes3:latest', name: 'Hermes 3', icon: 'Code', recommended: false}
];

const PROMPT_LIBRARY = [
    {
        category: 'Portfolio & Assets',
        icon: 'PieChart',
        prompts: [
            { title: 'Privatkonten Tabelle', text: 'Zeichne eine schöne, moderne Tabelle aller meiner Privatkonten mit dem jeweiligen Saldo in CHF. Hebe Konten mit über 10.000 CHF grün hervor.' },
            { title: 'Asset Allocation (Pie Chart)', text: 'Erstelle ein wunderschönes Chart.js Doughnut-Diagramm, das meine Asset Allocation zeigt (Cash vs. Aktien vs. Immobilien). Nutze sanfte Tailwind-Farben.' },
            { title: 'Banken-Vergleich', text: 'Zeichne ein Balkendiagramm (Chart.js), das zeigt, wie viel Vermögen ich bei welcher Bank liegen habe.' }
        ]
    },
    {
        category: 'Budget & Cashflow',
        icon: 'TrendingDown',
        prompts: [
            { title: 'Ausgaben nach Kategorie', text: 'Analysiere mein Budget und zeichne ein Balkendiagramm meiner monatlichen Ausgaben, sortiert von der grössten zur kleinsten Ausgabe.' },
            { title: 'Einnahmen vs. Ausgaben', text: 'Erstelle ein Dashboard-Widget, das meine totalen monatlichen Einnahmen meinen totalen monatlichen Ausgaben gegenüberstellt. Berechne die Sparquote in %.' },
            { title: 'Fixkosten-Tabelle', text: 'Generiere eine cleane HTML-Tabelle aller meiner Abonnements und Fixkosten aus dem Budget.' }
        ]
    },
    {
        category: 'FIRE & Zukunftsplanung',
        icon: 'Target',
        prompts: [
            { title: 'FIRE Status Dashboard', text: 'Zeichne ein Tacho-Diagramm oder eine Fortschritts-Bar, die zeigt, wie weit ich von meinem Ziel von 1.000.000 CHF entfernt bin.' },
            { title: 'Jahre bis zur Rente', text: 'Berechne anhand meines Gesamtvermögens und meiner jährlichen Ausgaben, wie viele Jahre ich theoretisch von meinem aktuellen Vermögen leben könnte. Stelle dies gross und visuell ansprechend dar.' }
        ]
    }
];

// ============================================================================
// HAUPTKOMPONENTE
// ============================================================================

const AiDashboard = ({ data, fCur, t, setModalObj, updateTreeData }) => {
    
    // --- STATE MANAGEMENT ---
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState(data.aiContext?.history || []);
    const [selectedModel, setSelectedModel] = useState('qwen2.5-coder:14b');
    
    const [showSidebar, setShowSidebar] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    
    const [aiTemperature, setAiTemperature] = useState(0.1);
    const [aiContextWindow, setAiContextWindow] = useState(16384);
    
    const chatContainerRef = useRef(null);
    const endOfMessagesRef = useRef(null);
    const textareaRef = useRef(null);

    // ============================================================================
    // EFFECTS & SCROLL LOGIC
    // ============================================================================

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

    // ============================================================================
    // ACTIONS & HANDLERS
    // ============================================================================

    const handleClearChat = () => {
        if (chatHistory.length === 0) return; // Nichts zu tun
        if (window.confirm("Chatverlauf leeren und zum Start-Dashboard zurückkehren?")) {
            setChatHistory([]);
            setPrompt(''); // Setzt auch das Eingabefeld zurück
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

    // ============================================================================
    // CORE AI LOGIC (OLLAMA API CALL)
    // ============================================================================

    const handleAskAI = async () => {
        if (!prompt.trim() || isLoading) return;

        const userMessage = { role: 'user', content: prompt, timestamp: new Date().toISOString() };
        const newHistory = [...chatHistory, userMessage];
        setChatHistory(newHistory);
        setPrompt('');
        setIsLoading(true);

        if (textareaRef.current) textareaRef.current.style.height = '56px';

        const flatAssets = [];
        const extractAssets = (nodes, currentBank = 'Unbekannt') => {
            (nodes || []).forEach(node => {
                let bankName = currentBank;
                if (node.type === 'bank') bankName = node.name;
                if (node.type === 'asset') {
                    const val = (node.balances && node.balances.length > 0) ? node.balances[0].amount : 0;
                    flatAssets.push({ id: node.id, name: node.name, bank: bankName, assetClass: node.assetClass || 'cash', value: val, currency: node.currency || 'CHF' });
                }
                if (node.children) extractAssets(node.children, bankName);
            });
        };
        extractAssets(data.banks || []);
        
        const budgetString = JSON.stringify(data.budget || {});
        const assetsString = JSON.stringify(flatAssets);


 const systemPrompt = `Du bist ein Frontend-Entwickler.
Du generierst vollständig lauffähige, isolierte HTML/JS-Widgets für das FinSPA Dashboard.

<daten>
window.finspaData = ... (Kompletter Baum)
window.finspaAssets = ${assetsString}
window.finspaBudget = ${budgetString}
</daten>

<bezeichner fuer Assets nach denen augeschluesselt>
${JSON.stringify(flatAssets)}
</bezeichner>

<regeln>
1. VOLLSTÄNDIGES HTML: Deine Antwort MUSS immer mit <!DOCTYPE html> beginnen und ein komplettes <html> Dokument sein.
2. KEIN TEMPLATING: Du bist im Browser. Es gibt keinen Server. Das HTML muss statisch sein, nutze NIEMALS {% %} oder {{ }}. Die Logik passiert rein im <script>.
3. SCRIPT POSITION: Das <script> MUSS am Ende des <body> stehen.
4. TAILWINDCSS: Lade Tailwind im <head> via CDN und nutze es für das Design.
</regeln>

<modus_1_info>
Für Tabellen und Listen. Kopiere EXAKT dieses Grundgerüst und passe es an die Nutzeranfrage an:
\`\`\`html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="p-6 bg-white">
    <h2 class="text-2xl font-bold mb-4">Titel hier</h2>
    <table class="w-full text-left border-collapse">
        <thead>
            <tr class="bg-blue-500 text-white">
                <th class="p-2">Name</th>
            </tr>
        </thead>
        <tbody id="my-table-body"></tbody>
    </table>
    <script>
        const tbody = document.getElementById('my-table-body');
        window.finspaAssets.forEach(item => {
            if (item.value > 10000) {
                tbody.innerHTML += '<tr class="bg-green-50 p-2"><td class="p-2">' + item.name + '</td></tr>';
            } else {
                tbody.innerHTML += '<tr><td class="p-2">' + item.name + '</td></tr>';
            }
        });
    </script>
</body>
</html>
\`\`\`
</modus_1_info>

<modus_2_diagramm>
Für Diagramme. Lade zusätzlich Chart.js im <head>. Kopiere EXAKT dieses Grundgerüst:
\`\`\`html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="p-6 bg-white">
    <canvas id="myChart" style="max-height: 400px;"></canvas>
    <script>
        // Nutze window.finspaAssets hier für Chart.js Logik
        new Chart(document.getElementById('myChart'), { 
            /* Chart Konfiguration */ 
        });
    </script>
</body>
</html>
\`\`\`
</modus_2_diagramm>

Antworte NUR mit dem finalen \`\`\`html Block. Erkläre nichts.`;

        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...newHistory.slice(-4).map(h => ({ role: h.role, content: h.content }))
                    ],
                    stream: false,
                    options: { temperature: aiTemperature, num_ctx: aiContextWindow }
                })
            });

            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
            const result = await response.json();
            
            let cleanCode = extractCodeFromText(result.message.content);

            if (!cleanCode) {
                 const errorMessage = { 
                     role: 'assistant', text: "Entschuldigung, ich konnte keinen validen HTML-Code aus der Antwort extrahieren.",
                     timestamp: new Date().toISOString()
                 };
                 const finalHistory = [...newHistory, errorMessage];
                 setChatHistory(finalHistory);
                 if (updateTreeData) updateTreeData({ aiContext: { history: finalHistory } });
                 return;
            }

            const finalMessage = { role: 'assistant', htmlWidget: cleanCode, timestamp: new Date().toISOString(), modelUsed: result.model };
            const finalHistory = [...newHistory, finalMessage];
            
            setChatHistory(finalHistory);
            if (updateTreeData) updateTreeData({ aiContext: { history: finalHistory } });

        } catch (error) {
            setChatHistory([...newHistory, { role: 'assistant', text: `Verbindungsfehler zur lokalen KI (Ollama). Läuft der Service?\nDetails: ${error.message}`, isError: true, timestamp: new Date().toISOString() }]);
        } finally { 
            setIsLoading(false); 
        }
    };

    // ============================================================================
    // RENDER FUNKTIONEN (SUB-COMPONENTS)
    // ============================================================================

    const renderIframeWidget = (htmlContent) => {
        const flatAssets = [];
        const extractAssets = (nodes, currentBank = 'Unbekannt') => {
            (nodes || []).forEach(node => {
                let bankName = currentBank;
                if (node.type === 'bank') bankName = node.name;
                if (node.type === 'asset') {
                    const val = (node.balances && node.balances.length > 0) ? node.balances[0].amount : 0;
                    flatAssets.push({ id: node.id, name: node.name, bank: bankName, type: 'asset', assetClass: node.assetClass || 'cash', value: val });
                }
                if (node.children) extractAssets(node.children, bankName);
            });
        };
        extractAssets(data.banks || []);

        const injectedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <script>
                window.finspaAssets = ${JSON.stringify(flatAssets)};
                window.finspaBudget = ${JSON.stringify(data.budget || {})};
            </script>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>`;

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
                                FinSPA UI Widget <span className="opacity-50 lowercase ml-1">v.alpha</span>
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button className="text-gray-400 hover:text-blue-500 transition-colors" title="Reload Widget" onClick={(e) => {
                                const iframe = e.currentTarget.parentElement.parentElement.parentElement.querySelector('iframe');
                                if (iframe) iframe.srcdoc = iframe.srcdoc;
                            }}>
                                <Icon name="RefreshCw" size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative bg-white dark:bg-slate-950">
                        <iframe 
                            srcDoc={injectedHtml} 
                            sandbox="allow-scripts allow-same-origin"
                            className="w-full bg-transparent"
                            style={{ minHeight: '450px', height: '100%', border: 'none' }} 
                            title="AI Generated Widget"
                        />
                    </div>
                </div>

                <details className="mt-4 text-sm text-gray-500 dark:text-slate-400 group/code">
                    <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors list-none flex items-center gap-2 font-medium bg-gray-50 dark:bg-slate-900/50 w-max px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-800">
                        <Icon name="Code" size={16} /> Quellcode der KI einsehen
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

    const renderSidebar = () => {
        return (
            <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                        <Icon name="BookOpen" className="text-blue-500" /> Prompt Bibliothek
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
                                <Icon name="Settings" size={14} /> Erweiterte KI Settings
                            </h3>
                            <Icon name={showAdvancedSettings ? "ChevronUp" : "ChevronDown"} size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        
                        {showAdvancedSettings && (
                            <div className="mt-4 space-y-4 animate-fade-in-up">
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        <span>Temperature</span><span className="font-mono">{aiTemperature}</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="1" step="0.1" value={aiTemperature} 
                                        onChange={(e) => setAiTemperature(parseFloat(e.target.value))} className="w-full accent-blue-600"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Höher = Kreativer, Tiefer = Präziser Code</p>
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        <span>Context Window</span><span className="font-mono">{formatTokenCount(aiContextWindow)}</span>
                                    </label>
                                    <select 
                                        value={aiContextWindow} onChange={(e) => setAiContextWindow(parseInt(e.target.value))}
                                        className="w-full p-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                                    >
                                        <option value={4096}>4k (Fast)</option><option value={8192}>8k (Standard)</option>
                                        <option value={16384}>16k (Deep Context)</option><option value={32768}>32k (Extrem)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ============================================================================
    // MAIN RENDER
    // ============================================================================

    return (
        <div className="h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col relative transition-colors duration-500 overflow-hidden font-sans">
            
            {showSidebar && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowSidebar(false)}></div>}
            
            {renderSidebar()}

            {/* --- GLASSMORPHISM HEADER --- */}
            <header className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-20 flex justify-between items-center shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-[#2548C3] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white flex items-center justify-center">
                        <Icon name="Cpu" size={22} className="stroke-[2.5px]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                            FinSPA <span className="text-blue-600 dark:text-blue-400">Copilot</span>
                        </h1>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Local AI Development Engine</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center bg-gray-100 dark:bg-slate-900 rounded-xl p-1 border border-gray-200 dark:border-slate-800">
                        <Icon name="Box" size={14} className="ml-2 text-gray-400" />
                        <select 
                            value={selectedModel} onChange={e => setSelectedModel(e.target.value)} 
                            className="text-xs py-1.5 px-2 bg-transparent text-gray-700 dark:text-slate-300 outline-none font-semibold cursor-pointer min-w-[140px]"
                        >
                            {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

                    {/* NEUER CHAT BUTTON (Eindeutig beschriftet, statt nur ein Papierkorb) */}
                    <button 
                        onClick={handleClearChat} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all duration-300"
                        title="Aktuellen Chat leeren und zum Startbildschirm zurückkehren"
                    >
                        <Icon name="PlusCircle" size={16} /> <span className="hidden sm:inline">Neuer Chat</span>
                    </button>

                    <button 
                        onClick={() => setShowSidebar(true)} 
                        className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50" 
                        title="Prompt Bibliothek & Settings"
                    >
                        <Icon name="BookOpen" size={18} />
                    </button>
                </div>
            </header>
            
            {/* --- CHAT BEREICH --- */}
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative bg-gray-50/50 dark:bg-slate-950">
                
                <div className="flex-1 p-4 md:p-8 space-y-8 w-full max-w-6xl mx-auto">
                    
                    {/* START DASHBOARD (Wird angezeigt wenn der Chat leer ist) */}
                    {chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full mt-10 md:mt-20 animate-fade-in-up px-4">
                            <div className="inline-flex justify-center items-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 mb-8 shadow-2xl shadow-blue-500/10">
                                <Icon name="Sparkles" size={40} className="stroke-1" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black mb-4 text-slate-800 dark:text-slate-100 tracking-tight text-center">
                                Bereit zum Coden.
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-12 text-center max-w-lg text-lg leading-relaxed">
                                Beschreibe in natürlicher Sprache, welches Widget du benötigst. Ich generiere maßgeschneiderte, interaktive Dashboards basierend auf deinen FinSPA Daten.
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
                                    <Icon name="Menu" size={16} /> Alle Prompts anzeigen
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
                                    Schreibt Code und baut Widget...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} className="h-6 w-full shrink-0"></div>
                </div>
            </main>

            {/* --- EINGABE BEREICH --- */}
            <footer className="shrink-0 p-4 md:px-8 md:py-6 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 relative z-20">
                <div className="max-w-4xl mx-auto relative group">
                    
                    {/* QUICK CLEAR BUTTON (Erscheint links im Eingabefeld, sobald ein Chat aktiv ist) */}
                    {chatHistory.length > 0 && (
                        <button 
                            onClick={handleClearChat}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all z-10"
                            title="Chat leeren"
                        >
                            <Icon name="Trash2" size={18} />
                        </button>
                    )}

                    <textarea 
                        ref={textareaRef}
                        className={`w-full ${chatHistory.length > 0 ? 'pl-14' : 'pl-6'} pr-[68px] py-4 border border-gray-300 dark:border-slate-700 rounded-[28px] resize-none bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:border-[#2548C3] dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-[15px] min-h-[56px] max-h-[200px] transition-all text-slate-800 dark:text-slate-200 shadow-inner custom-scrollbar`}
                        placeholder="Was soll der KI Assistent für dich programmieren?"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                        rows={1}
                    />
                    
                    <button 
                        onClick={handleAskAI} 
                        disabled={isLoading || !prompt.trim()} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#2548C3] hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-md active:scale-95 disabled:shadow-none disabled:active:scale-100"
                        title="Senden (Enter)"
                    >
                        <Icon name="ArrowUp" size={20} className="font-bold stroke-[3px]" />
                    </button>
                </div>
                <div className="text-center mt-3 text-[10px] text-gray-400 dark:text-slate-500 font-medium tracking-wide">
                    LOKALE KI ({selectedModel.split(':')[0].toUpperCase()}) • DATEN VERLASSEN DEIN GERÄT NICHT
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