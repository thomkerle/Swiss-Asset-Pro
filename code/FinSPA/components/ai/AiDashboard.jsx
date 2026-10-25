/**
 * @file AiDashboard.jsx
 * @description FinBundle Pro KI Copilot Dashboard mit dynamischer Ollama-API-Modellabfrage,
 * aktuellen Gemini-Modellen inkl. Denkaufwand-Steuerung (Gering/Mittel/Hoch ohne Temperatur),
 * nahtloser Darkmode-Synchronisation, erweitertem Systemprompt-Kontext und Plugin-Speicherfunktion.
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const safeRequire = (modPath, fallback = null) => {
    try {
        if (typeof require === 'function') {
            const res = require(modPath);
            if (res !== undefined && res !== null && !(typeof res === 'object' && Object.keys(res).length === 0)) {
                return res.default || res;
            }
        }
    } catch (e) {}
    if (typeof window !== 'undefined') {
        if (typeof window.require === 'function') {
            try {
                const res = window.require(modPath);
                if (res !== undefined && res !== null && !(typeof res === 'object' && Object.keys(res).length === 0)) {
                    return res.default || res;
                }
            } catch (e) {}
        }
        if (window.__FinSPAModules) {
            const cleanTarget = String(modPath || '').replace(/^(\.\/|\.\.\/)+/, '');
            const fileName = cleanTarget.split('/').pop();
            const keys = Object.keys(window.__FinSPAModules);
            const exactKey = keys.find(k => k === cleanTarget || k.endsWith('/' + cleanTarget));
            const matchKey = exactKey || keys.find(k => k.endsWith('/' + fileName) || k === fileName);
            if (matchKey) {
                if (typeof window.require === 'function') {
                    try {
                        const mod = window.require(matchKey);
                        if (mod) return mod.default || mod;
                    } catch (e) {}
                }
                const m = window.__FinSPAModules[matchKey];
                if (m) {
                    const exp = m.exports?.default || m.exports || m;
                    if (exp && !(typeof exp === 'object' && Object.keys(exp).length === 0)) return exp;
                }
            }
        }
    }
    return fallback;
};

const rawIcon = safeRequire('../Icons.jsx') || safeRequire('./Icons.jsx');
const Icon = (typeof rawIcon === 'function' ? rawIcon : null) || (({name, className, size}) => <span className={className}>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || safeRequire('../data/DataEngine.jsx') || (typeof window !== 'undefined' && window.__FinSPAModules?.['data/DataEngine.jsx']?.exports) || {};
const finspaSchema = safeRequire('../../schema/finspa-schema.json') || safeRequire('../schema/finspa-schema.json') || {};
const finSpaApiMod = safeRequire('../../api/FinSpaApiInject.js') || safeRequire('../api/FinSpaApiInject.js') || {};
const getFinSpaApiScript = typeof finSpaApiMod.getFinSpaApiScript === 'function'
    ? finSpaApiMod.getFinSpaApiScript
    : (typeof finSpaApiMod === 'function' ? finSpaApiMod : () => '');
const systemPromptMod = safeRequire('../../api/SystemPrompt.js') || safeRequire('../api/SystemPrompt.js') || {};
const getSystemPrompt = typeof systemPromptMod.getSystemPrompt === 'function'
    ? systemPromptMod.getSystemPrompt
    : (typeof systemPromptMod === 'function' ? systemPromptMod : () => '');

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

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
                code = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script><script>tailwind.config = { darkMode: 'class' };<\/script></head><body>${code}</body></html>`;
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

// ============================================================================
// FINSPA PRIVACY SHIELD (ID-BASIERTE ANONYMISIERUNG FÜR KI-REQUESTS)
// Bankinstitute, Kategorien, Budget-Posten & Szenarien werden ausschliesslich
// über ihre IDs an die KI übermittelt; keinerlei Rückschlüsse auf den Benutzer.
// ============================================================================
const buildSanitizedTreeStructure = (banks) => {
    const collectSubtreeAssets = (node) => {
        let list = [];
        if (!node || node.isArchived) return list;
        if (node.type === 'asset') list.push(node);
        (node.children || []).forEach(ch => {
            list = list.concat(collectSubtreeAssets(ch));
        });
        return list;
    };

    const mapNode = (node, pathArr = []) => {
        if (!node || node.isArchived) return null;
        const safeId = node.id || 'unknown_id';
        const safeLabel = node.type === 'bank'
            ? (`Bank [ID: ${safeId}]`)
            : (node.type === 'category'
                ? (`Kategorie [ID: ${safeId}]`)
                : `Asset [ID: ${safeId}]`);

        const currentPath = [...pathArr, safeLabel];
        const directAssets = (node.children || []).filter(c => c.type === 'asset' && !c.isArchived);
        const subtreeAssets = collectSubtreeAssets(node);
        const childCategories = (node.children || [])
            .filter(c => c.type === 'category' && !c.isArchived)
            .map(c => mapNode(c, currentPath))
            .filter(Boolean);

        const assetClassesPresent = Array.from(new Set(subtreeAssets.map(a => a.assetClass || 'cash')));
        const currenciesPresent = Array.from(new Set(subtreeAssets.map(a => a.currency || 'CHF')));

        return {
            id: safeId,
            name: safeLabel,
            type: node.type,
            path: currentPath.join(' ➔ '),
            directAssetCount: directAssets.length,
            totalSubtreeAssetCount: subtreeAssets.length,
            assetClassesPresent,
            currenciesPresent,
            categories: childCategories
        };
    };
    return (banks || []).map(b => mapNode(b, [])).filter(Boolean);
};

// Anonymisiert persönliche Bezeichnungen im Budget (Arbeitgeber, Vermieter, Abos)
const buildSanitizedBudget = (budget) => {
    if (!budget || typeof budget !== 'object') return {};
    if (!true) return budget;
    return {
        incomeSources: (budget.incomeSources || []).map((item, idx) => ({
            id: item.id || `inc_${idx + 1}`,
            name: `Einnahme [ID: ${item.id || ('inc_' + (idx + 1))}]`,
            amount: Number(item.amount || 0),
            frequency: item.frequency || 'monthly'
        })),
        expenses: (budget.expenses || []).map((item, idx) => ({
            id: item.id || `exp_${idx + 1}`,
            name: `Ausgabe [ID: ${item.id || ('exp_' + (idx + 1))}]`,
            amount: Number(item.amount || 0),
            frequency: item.frequency || 'monthly',
            ruleCategory: item.ruleCategory || 'needs'
        })),
        subscriptions: (budget.subscriptions || []).map((item, idx) => ({
            id: item.id || `sub_${idx + 1}`,
            name: `Abo [ID: ${item.id || ('sub_' + (idx + 1))}]`,
            amount: Number(item.amount || 0),
            frequency: item.frequency || 'monthly',
            ruleCategory: item.ruleCategory || 'wants'
        }))
    };
};

// Anonymisiert geplante Lebens-Szenarien über deren ID
const buildSanitizedScenarios = (scenarios) => {
    if (!Array.isArray(scenarios)) return [];
    if (!true) return scenarios;
    return scenarios.map((sc, idx) => ({
        id: sc.id || `scen_${idx + 1}`,
        name: `Szenario [ID: ${sc.id || ('scen_' + (idx + 1))}]`,
        date: sc.date || '',
        impact: Number(sc.impact || 0)
    }));
};

// Entfernt Banknamen, Kategorienamen, IBANs & E-Mail-Adressen aus ausgehenden Chat-Nachrichten
const sanitizeOutboundText = (rawText, banks = []) => {
    if (!rawText || typeof rawText !== 'string') return '';
    if (!true) return rawText;
    let cleaned = rawText;

    // 1. Schweizer & internationale IBANs maskieren
    cleaned = cleaned.replace(/\b[A-Z]{2}\d{2}[\sA-Z0-9]{11,30}\b/gi, '[IBAN_REDACTED]');
    // 2. E-Mail-Adressen & AHV/Sozialversicherungsnummern maskieren
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    cleaned = cleaned.replace(/\b756\.\d{4}\.\d{4}\.\d{2}\b/g, '[AHV_REDACTED]');

    // 3. Sichere, RegExp-freie Ersetzung für Bank-, Kategorie- und Asset-Namen
    const replaceIgnoreCase = (sourceText, searchStr, replaceWith) => {
        const src = String(sourceText || '');
        const needle = String(searchStr || '').trim();
        if (!src || needle.length < 2) return src;
        const lowerSrc = src.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        let res = '';
        let lastIdx = 0;
        let idx = lowerSrc.indexOf(lowerNeedle, lastIdx);
        while (idx !== -1) {
            res += src.slice(lastIdx, idx) + replaceWith;
            lastIdx = idx + needle.length;
            idx = lowerSrc.indexOf(lowerNeedle, lastIdx);
        }
        res += src.slice(lastIdx);
        return res;
    };

    const replaceNodesRecursive = (nodes) => {
        (nodes || []).forEach(n => {
            if (n && n.name && String(n.name).trim().length >= 2) {
                if (n.type === 'bank' && true) {
                    cleaned = replaceIgnoreCase(cleaned, n.name, `Bank [ID: ${n.id}]`);
                } else if (n.type === 'category' && true) {
                    cleaned = replaceIgnoreCase(cleaned, n.name, `Kategorie [ID: ${n.id}]`);
                } else if (n.type === 'asset') {
                    cleaned = replaceIgnoreCase(cleaned, n.name, `Asset [ID: ${n.id}]`);
                }
            }
            if (n && n.children) replaceNodesRecursive(n.children);
        });
    };
    replaceNodesRecursive(banks);
    return cleaned;
};

const AiDashboard = ({ data, fCur, t, setModalObj, updateTreeData }) => {
    const isOpenAI = (id) => String(id || '').startsWith('gpt-') || String(id || '').startsWith('o1') || String(id || '').startsWith('o3');
    const isGemini = (id) => String(id || '').startsWith('gemini-');
    const isClaude = (id) => String(id || '').startsWith('claude-');
    const isCloudModelFn = (id) => isOpenAI(id) || isGemini(id) || isClaude(id);

    // --- DARK MODE ERKENNUNG & LIVE-SYNC ---
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.classList.contains('dark');
    });

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const syncDark = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        syncDark();
        const observer = new MutationObserver(syncDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // --- DYNAMISCHE OLLAMA MODELL-ABFRAGE ---
    const [liveOllamaModels, setLiveOllamaModels] = useState([]);
    const [ollamaStatus, setOllamaStatus] = useState('idle'); // 'idle' | 'loading' | 'online' | 'offline'

    const fetchOllamaModels = useCallback(async () => {
        setOllamaStatus('loading');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('Ollama HTTP ' + res.status);
            const json = await res.json();
            const list = Array.isArray(json?.models) ? json.models : [];
            const mapped = list.map(m => {
                const rawName = m.name || m.model;
                const paramSize = m.details?.parameter_size ? ` (${m.details.parameter_size})` : '';
                return {
                    id: rawName,
                    name: `${rawName}${paramSize}`
                };
            });
            setLiveOllamaModels(mapped);
            setOllamaStatus('online');
        } catch (err) {
            setOllamaStatus('offline');
        }
    }, []);

    useEffect(() => {
        fetchOllamaModels();
    }, [fetchOllamaModels]);

    const availableModels = useMemo(() => {
        const tLocal = safeT(t, 'suffixLocal', '- Lokal');
        const tCloud = safeT(t, 'suffixCloud', '(Cloud)');

        const modelMap = new Map();

        // 1. Live gefundene Ollama-Modelle priorisieren
        liveOllamaModels.forEach(m => {
            modelMap.set(m.id, {
                id: m.id,
                name: m.name.includes(tLocal) ? m.name : `${m.name} ${tLocal}`,
                provider: 'ollama'
            });
        });

        // 2. Konfigurierte lokale Modelle aus data.settings.aiModels ergänzen
        const configuredLocal = (data?.settings?.aiModels && data.settings.aiModels.length > 0)
            ? data.settings.aiModels
            : (liveOllamaModels.length === 0 ? [
                { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder (14B)' },
                { id: 'llama3:latest', name: 'Llama 3 (8B)' }
            ] : []);

        configuredLocal.forEach(m => {
            if (!modelMap.has(m.id)) {
                modelMap.set(m.id, {
                    id: m.id,
                    name: m.name.includes(tLocal) ? m.name : `${m.name} ${tLocal}`,
                    provider: 'ollama'
                });
            }
        });

        const keys = data?.settings?.aiApiKeys || {};

        // 3. Aktuelle Gemini-Modelle (2026 Lineup mit Thinking-Level Support)
        if (keys.gemini) {
            const geminiModels = [
                { id: 'gemini-3.1-pro-preview', name: `Gemini 3.1 Pro Preview ${tCloud}` },
                { id: 'gemini-3-flash-preview', name: `Gemini 3 Flash Preview ${tCloud}` },
                { id: 'gemini-3.5-flash', name: `Gemini 3.5 Flash ${tCloud}` },
                { id: 'gemini-3.8-flash', name: `Gemini 3.8 Flash ${tCloud}` },
                { id: 'gemini-3.1-flash-lite', name: `Gemini 3.1 Flash Lite ${tCloud}` },
                { id: 'gemini-4-argon', name: `Gemini 4 Argon ${tCloud}` },
                { id: 'gemini-2.5-pro', name: `Gemini 2.5 Pro ${tCloud}` }
            ];
            geminiModels.forEach(gm => modelMap.set(gm.id, { ...gm, provider: 'gemini' }));
        }

        // 4. OpenAI & Anthropic
        if (keys.openai) {
            modelMap.set('gpt-4o', { id: 'gpt-4o', name: `GPT-4o ${tCloud}`, provider: 'openai' });
            modelMap.set('gpt-4o-mini', { id: 'gpt-4o-mini', name: `GPT-4o-mini ${tCloud}`, provider: 'openai' });
        }
        if (keys.anthropic) {
            modelMap.set('claude-3-5-sonnet-20240620', { id: 'claude-3-5-sonnet-20240620', name: `Claude 3.5 Sonnet ${tCloud}`, provider: 'anthropic' });
        }

        return Array.from(modelMap.values());
    }, [liveOllamaModels, data?.settings?.aiModels, data?.settings?.aiApiKeys, t]);

    const PROMPT_LIBRARY = [
        {
            category: safeT(t, 'aiCatPortfolio', 'Portfolio & Assets'),
            icon: 'PieChart',
            prompts: [
                { title: safeT(t, 'aiLibP1Title', 'Vorsorge & Rentenanalyse'), text: safeT(t, 'aiLibP1Text', 'Erstelle eine Auswertung, die mein liquides Vermögen der gebundenen Säule 3a und Pensionskasse gegenüberstellt und eine Rentenschätzung visualisiert.') },
                { title: safeT(t, 'aiLibP2Title', 'Dividenden-Cluster & Zahltage'), text: safeT(t, 'aiLibP2Text', 'Zeige mir eine Übersicht der Top-Dividendenzahler gruppiert nach Zahlungsintervallen und Währungen.') },
                { title: safeT(t, 'aiLibP3Title', 'Vermögenskonzentration & Klumpenrisiko'), text: safeT(t, 'aiLibP3Text', 'Analysiere Klumpenrisiken nach Banken, Kategorien und Anlageklassen mit einer Risikomatrix.') }
            ]
        },
        {
            category: safeT(t, 'aiCatBudget', 'Budget & Cashflow'),
            icon: 'TrendingDown',
            prompts: [
                { title: safeT(t, 'aiLibP4Title', 'Monatlicher Sparpuffer & Kreditkarten'), text: safeT(t, 'aiLibP4Text', 'Berechne meinen monatlichen freien Cashflow, zeige Fixkosten vs. Einnahmen sowie die aktuelle Kreditkartenauslastung.') },
                { title: safeT(t, 'aiLibP5Title', 'Historische Sparquote & Buchungskategorien'), text: safeT(t, 'aiLibP5Text', 'Analysiere meine Sparquote über die letzten 12 Monate und schlüssle die Ausgaben nach Buchungskategorien auf.') }
            ]
        },
        {
            category: safeT(t, 'aiCatFire', 'FIRE & Zukunftsplanung'),
            icon: 'Target',
            prompts: [
                { title: safeT(t, 'aiLibP6Title', 'Projizierte liquide Vermögensentwicklung'), text: safeT(t, 'aiLibP6Text', 'Erstelle einen Zukunfts-Report, der mein liquides Vermögen über 10 Jahre mit einer 4% und 7% Renditekurve extrapoliert.') },
                { title: safeT(t, 'aiLibP7Title', 'FIRE-Zielerreichung mit Szenarien'), text: safeT(t, 'aiLibP7Text', 'Berechne anhand meines Sparverhaltens das voraussichtliche Erreichen der finanziellen Freiheit unter Berücksichtigung geplanter Szenarien.') }
            ]
        }
    ];

    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState(data?.aiContext?.history || []);
    const [selectedModel, setSelectedModel] = useState(availableModels[0]?.id || 'qwen2.5-coder:14b');

    // Falls das aktuell gewählte Modell nach dem Laden der Live-Ollama-Modelle nicht existiert, auf das erste verfügbare wechseln
    useEffect(() => {
        if (availableModels.length > 0 && !availableModels.some(m => m.id === selectedModel)) {
            setSelectedModel(availableModels[0].id);
        }
    }, [availableModels, selectedModel]);
    
    // Sidebar State mit Tabs
    const [showSidebar, setShowSidebar] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('prompts'); // 'prompts' | 'settings'
    const [aiTemperature, setAiTemperature] = useState(0.1);
    const [aiContextWindow, setAiContextWindow] = useState(16384);
    const [geminiThinkingLevel, setGeminiThinkingLevel] = useState('MEDIUM'); // 'LOW' | 'MEDIUM' | 'HIGH'

    // Modal State: Plugin Speichern
    const [pluginModal, setPluginModal] = useState(null);
    const [pluginTitle, setPluginTitle] = useState('');
    const [pluginCategory, setPluginCategory] = useState(() => safeT(t, 'aiPluginCatPension', 'Vorsorge'));
    
    const chatContainerRef = useRef(null);
    const endOfMessagesRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, []);

    useEffect(() => {
        if (chatHistory.length === 0 && !isLoading) return;
        scrollToBottom();
        const timer = setTimeout(scrollToBottom, 300);
        return () => clearTimeout(timer);
    }, [chatHistory.length, isLoading, scrollToBottom]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        if (!confirmClear) return;
        const timer = setTimeout(() => setConfirmClear(false), 3500);
        return () => clearTimeout(timer);
    }, [confirmClear]);

    const handleClearChat = useCallback(() => {
        if (chatHistory.length === 0 && !isLoading) return;

        // 1. Klick: Inline-Bestätigung aktivieren (kein blockierendes window.confirm!)
        if (!confirmClear) {
            setConfirmClear(true);
            return;
        }

        // 2. Klick: Sanftes Cleanup ohne UI-Freeze
        setConfirmClear(false);
        setIsLoading(false);
        setPrompt('');

        // Zuerst laufende Iframes im DOM entschärfen, bevor React sie unmountet
        try {
            if (chatContainerRef.current) {
                const iframes = chatContainerRef.current.querySelectorAll('iframe');
                iframes.forEach(ifr => {
                    try { ifr.srcdoc = ''; } catch (e) {}
                });
            }
        } catch (e) {}

        // Chat-State im nächsten Animation-Frame leeren
        requestAnimationFrame(() => {
            setChatHistory([]);
            // Persistenz-Update zeitversetzt ausführen, damit kein synchroner Doppel-Render-Lock entsteht
            setTimeout(() => {
                if (typeof updateTreeData === 'function') {
                    const currentAiContext = (data && typeof data.aiContext === 'object') ? data.aiContext : {};
                    updateTreeData({
                        aiContext: {
                            ...currentAiContext,
                            history: [],
                            apiMessages: []
                        }
                    });
                }
            }, 60);
        });
    }, [chatHistory.length, isLoading, confirmClear, updateTreeData, data]);

    const handlePromptSelect = (predefinedText) => {
        setPrompt(predefinedText);
        setShowSidebar(false);
        if (textareaRef.current) textareaRef.current.focus();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(err => console.error('Fehler beim Kopieren:', err));
        if (typeof window !== 'undefined' && window.showToast) window.showToast(safeT(t, 'msgCopied', "In die Zwischenablage kopiert"), "info");
    };

    const existingCategories = useMemo(() => {
        const cats = new Set([safeT(t, 'aiPluginCatPension', 'Vorsorge'), safeT(t, 'aiPluginCatWealth', 'Vermögen'), safeT(t, 'aiPluginCatPerformance', 'Performance'), safeT(t, 'aiPluginCatTaxes', 'Steuern'), safeT(t, 'aiPluginCatCashflow', 'Cashflow'), safeT(t, 'aiPluginCatBudget', 'Budget')]);
        (data?.plugins || []).forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return Array.from(cats);
    }, [data?.plugins]);

    const handleOpenSavePlugin = (htmlCode, lastUserPrompt = '') => {
        let suggestedTitle = safeT(t, 'aiNewReportDefaultTitle', 'Neuer Report');
        if (lastUserPrompt) {
            const clean = lastUserPrompt.replace(/^(erstelle|zeige|berechne|mache)\s+(mir\s+)?(einen\s+|eine\s+|das\s+)?/i, '').trim();
            suggestedTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
            if (suggestedTitle.length > 35) suggestedTitle = suggestedTitle.substring(0, 32) + '...';
        }

        let suggestedCat = safeT(t, 'aiPluginCatWealth', 'Vermögen');
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
            alert(safeT(t, 'msgPluginNameRequired', "Bitte geben Sie einen Namen für das Plugin ein."));
            return;
        }

        const newPlugin = {
            id: 'plug_' + Math.random().toString(36).substr(2, 9),
            title: pluginTitle.trim(),
            category: pluginCategory.trim() || safeT(t, 'catGeneral', 'Allgemein'),
            code: pluginModal.code,
            createdAt: new Date().toISOString()
        };

        const updatedPlugins = [...(data?.plugins || []), newPlugin];
        if (updateTreeData) {
            updateTreeData({ plugins: updatedPlugins });
        }

        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(safeT(t, 'aiPluginSavedToast', 'Plugin "{title}" im Menü unter "{category}" gespeichert!').replace('{title}', newPlugin.title).replace('{category}', newPlugin.category), "success");
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
        
        const budgetString = JSON.stringify(buildSanitizedBudget(data?.budget), null, 2);
        const schemaInfo = JSON.stringify(finspaSchema, null, 2);

        // Vollständiger, anonymisierter FinBundle-Metadaten-Kontext (Banken & Kategorien nur über ID)
        const extraContext = {
            baseCurrency: data?.settings?.baseCurrency || 'CHF',
            language: data?.settings?.language || 'de',
            assetClasses: data?.settings?.assetClasses || DataEngine.initialData?.settings?.assetClasses || [],
            bookingCategories: data?.settings?.bookingCategories || DataEngine.defaultBookingCategories || {},
            treeStructure: buildSanitizedTreeStructure(data?.banks || []),
            goalsAndScenarios: {
                goals: data?.goals || {},
                scenarios: buildSanitizedScenarios(data?.scenarios)
            }
        };

        const privacyRuleInstruction = `\n\n<privacy_id_routing>\nIMPORTANT PRIVACY RULE: Bank names and category names are anonymized via their IDs (e.g. "7t58choue"). Always pass the node 'id' when calling FinSPA_API.getAssetsByBank(id) or FinSPA_API.getAssetsByCategory(id). For chart labels, use asset.bankName or FinSPA_API.resolveNodeName(id) at runtime inside the browser.\n</privacy_id_routing>`;
        const systemPrompt = getSystemPrompt(schemaInfo, budgetString, extraContext) + privacyRuleInstruction;
        const apiKeys = data?.settings?.aiApiKeys || {};
       
        try {
            let textContent = "";
            let returnedModel = selectedModel;
            
            const mappedHistory = newHistory.slice(-4).map(h => ({
                role: h.role === 'user' ? 'user' : 'assistant', 
                content: sanitizeOutboundText(h.content || h.htmlWidget || h.text || '', data?.banks || [])
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
                        max_tokens: 8192,
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

                // Gemini Thinking-Konfiguration OHNE Temperatur-Parameter
                const isLegacy25 = selectedModel.includes('2.5');
                const budgetMap = { LOW: 1024, MEDIUM: 8192, HIGH: 24576 };
                const thinkingConfig = isLegacy25
                    ? { thinkingBudget: budgetMap[geminiThinkingLevel] || 8192 }
                    : { thinkingLevel: geminiThinkingLevel };

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKeys.gemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: geminiMessages,
                        generationConfig: {
                            thinkingConfig: thinkingConfig
                        }
                    })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Google Gemini API: ${errData.error?.message || response.statusText}`);
                }
                const result = await response.json();
                const parts = result.candidates?.[0]?.content?.parts || [];
                textContent = parts.filter(p => !p.thought && p.text).map(p => p.text).join('\n') || parts.map(p => p.text || '').join('\n');
                returnedModel = `${selectedModel} (${geminiThinkingLevel})`;
                
            } else {
                const response = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...mappedHistory
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
                     role: 'assistant',
                     text: safeT(t, 'aiErrorNoHtml', "Konnte keinen gültigen HTML/JS Code aus der Antwort extrahieren."),
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
            const errorPrefix = isCloud ? '' : safeT(t, 'aiErrorConnection', 'Verbindungsfehler zur lokalen KI (Ollama): ');
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
        const activeLang = data?.settings?.language || 'de';
        const injectedScripts = `
        <style>
            html, body {
                margin: 0;
                padding: 12px;
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
            }
        </style>
        <script src="https://cdn.tailwindcss.com"><\/script>
        <script>
            if (window.tailwind) {
                window.tailwind.config = { darkMode: 'class' };
            }
        <\/script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
        <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"><\/script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"><\/script>
        <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"><\/script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
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
        <\/script>
                ${getFinSpaApiScript(activeLang)}
        <script>
            window.finspaData = ${JSON.stringify(data).replace(/</g, '\\u003c')};
            // --- FINSPA PRIVACY SHIELD: LOKALE BANK-ID & KATEGORIE-ID BRIDGE ---
            (function installFinSpaPrivacyBridge() {
                if (!window.FinSPA_API || window.FinSPA_API.__bridgeInstalled) return;
                const api = window.FinSPA_API;
                api.__bridgeInstalled = true;

                const extractCleanId = function(val) {
                    const s = String(val || '').trim();
                    const lower = s.toLowerCase();
                    const markerIdx = lower.indexOf('[id:');
                    if (markerIdx !== -1) {
                        const endIdx = s.indexOf(']', markerIdx);
                        if (endIdx !== -1) {
                            return s.slice(markerIdx + 4, endIdx).trim();
                        }
                    }
                    return s;
                };

                api._extractCleanId = extractCleanId;

                api.getAllAssets = function(customData) {
                    const d = customData || this._getData();
                    const assets = [];
                    function traverse(node, curBankName, curBankId, curCatName, curCatId, ancIds, ancNames, pathArr) {
                        if (!node || node.isArchived) return;
                        let bName = curBankName, bId = curBankId;
                        let cName = curCatName, cId = curCatId;
                        let nextAncIds = ancIds.slice();
                        let nextAncNames = ancNames.slice();
                        const nextPath = pathArr.concat([node.name]);
                        if (node.type === 'bank') { bName = node.name; bId = node.id; }
                        if (node.type === 'category') {
                            cName = node.name; cId = node.id;
                            nextAncIds.push(node.id);
                            nextAncNames.push(node.name);
                        }
                        if (node.type === 'asset' && !node.isArchived) {
                            assets.push(Object.assign({}, node, {
                                bankId: bId || '',
                                bankName: bName || 'Unbekannt',
                                categoryId: cId || bId || '',
                                categoryName: cName || bName || 'Hauptportfolio',
                                ancestorCategoryIds: nextAncIds,
                                ancestorCategoryNames: nextAncNames,
                                path: pathArr.join(' ➔ ')
                            }));
                        }
                        if (node.children) {
                            node.children.forEach(function(ch) { traverse(ch, bName, bId, cName, cId, nextAncIds, nextAncNames, nextPath); });
                        }
                    }
                    (d.banks || []).forEach(function(b) { traverse(b, b.name, b.id, '', '', [], [], []); });
                    return assets;
                };

                const matchNodeIdOrName = function(queryVal, actualName, actualId, ancestorIds, ancestorNames) {
                    if (!queryVal) return true;
                    const q = String(queryVal).toLowerCase().trim();
                    const cleanQ = extractCleanId(q).toLowerCase();
                    const actId = String(actualId || '').toLowerCase();
                    const actName = String(actualName || '').toLowerCase();
                    if (
                        actId === cleanQ ||
                        actName === cleanQ ||
                        (cleanQ.length >= 2 && actName.indexOf(cleanQ) !== -1) ||
                        ('bank [id: ' + actId + ']') === q ||
                        ('kategorie [id: ' + actId + ']') === q
                    ) {
                        return true;
                    }
                    if (Array.isArray(ancestorIds) && ancestorIds.some(function(id) { return String(id).toLowerCase() === cleanQ; })) return true;
                    if (Array.isArray(ancestorNames) && ancestorNames.some(function(nm) { return String(nm).toLowerCase().indexOf(cleanQ) !== -1; })) return true;
                    return false;
                };

                api.getAssetsByBank = function(bankIdOrName, customData) {
                    return this.getAllAssets(customData).filter(function(a) {
                        return matchNodeIdOrName(bankIdOrName, a.bankName, a.bankId, [], []);
                    });
                };

                api.getAssetsByCategory = function(catIdOrName, customData) {
                    return this.getAllAssets(customData).filter(function(a) {
                        return matchNodeIdOrName(catIdOrName, a.categoryName, a.categoryId, a.ancestorCategoryIds, a.ancestorCategoryNames) || a.id === catIdOrName;
                    });
                };

                api.getWealthByBank = function(customData) {
                    const all = this.getAllAssets(customData);
                    const today = this._getTodayStr();
                    const map = {};
                    const self = this;
                    all.forEach(function(a) {
                        const key = a.bankId || a.bankName || 'Unbekannt';
                        if (!map[key]) {
                            map[key] = { bankId: a.bankId || key, bankName: a.bankName || 'Unbekannt', totalValue: 0, assetCount: 0 };
                        }
                        map[key].totalValue += self.getAssetValueAtDate(a, today, all);
                        map[key].assetCount += 1;
                    });
                    return Object.keys(map).map(function(k) { return map[k]; });
                };
            })();
        <\/script>
        `;

        let finalHtml = htmlContent;
        if (isDarkMode && /<html[^>]*>/i.test(finalHtml)) {
            finalHtml = finalHtml.replace(/<html([^>]*)>/i, (match, attrs) => {
                if (/class\s*=\s*["'][^"']*["']/i.test(attrs)) {
                    return `<html${attrs.replace(/class\s*=\s*["']([^"']*)["']/i, 'class="$1 dark"')}>`
                }
                return `<html class="dark"${attrs}>`;
            });
        }

        if (finalHtml.includes('</head>')) {
            finalHtml = finalHtml.replace('</head>', injectedScripts + '\n</head>');
        } else {
            finalHtml = injectedScripts + finalHtml;
        }

        return (
            <div className="flex flex-col mt-3 w-full animate-fade-in-up">
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl transition-all group">
                    <div className="bg-gradient-to-b from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 opacity-70">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-3 tracking-wider uppercase">
                                {safeT(t, 'aiWidgetTitle', 'FinBundle AI Widget')}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleOpenSavePlugin(htmlContent, lastPrompt)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                title={safeT(t, 'aiSaveAsPluginTooltip', "Diesen Report dauerhaft im Menü unter Plugins speichern")}
                            >
                                <Icon name="FolderPlus" size={13} className="text-white" />
                                <span>{safeT(t, 'aiSaveAsPluginBtn', 'Als Plugin speichern')}</span>
                            </button>
                            
                            <button 
                                className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer" 
                                title={safeT(t, 'aiWidgetReload', "Widget neu laden")} 
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
                            title={safeT(t, 'aiIframeTitle', 'AI Generated Widget')}
                        />
                    </div>
                </div>

                <details className="mt-4 text-sm text-gray-500 dark:text-slate-400 group/code">
                    <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors list-none flex items-center gap-2 font-medium bg-gray-50 dark:bg-slate-900/50 w-max px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-800">
                        <Icon name="Code" size={16} /> {safeT(t, 'aiViewCode', 'Code anzeigen')}
                        <Icon name="ChevronDown" size={14} className="ml-2 group-open/code:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-3 relative animate-fade-in-up">
                        <button 
                            onClick={() => copyToClipboard(htmlContent)}
                            className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600 shadow-md z-10 cursor-pointer"
                            title={safeT(t, 'aiCopyCode', "Code kopieren")}
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

    const isCurrentModelGemini = isGemini(selectedModel);

    // --- RECHTES FLYOUT: MIT TABS, THINKING-STUFEN & OLLAMA DISCOVERY ---
    const renderSidebar = () => {
        return (
            <div className={`fixed inset-y-0 right-0 w-96 max-w-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                        <Icon name={sidebarTab === 'prompts' ? "BookOpen" : "Settings"} className="text-blue-500" /> 
                        {sidebarTab === 'prompts' ? safeT(t, 'aiPromptLibrary', 'Prompt Bibliothek') : safeT(t, 'aiAdvancedSettings', 'KI Einstellungen')}
                    </h2>
                    <button onClick={() => setShowSidebar(false)} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <Icon name="X" size={20} />
                    </button>
                </div>

                {/* Tabs Leiste */}
                <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-950/60 p-1.5 shrink-0">
                    <button 
                        onClick={() => setSidebarTab('prompts')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${sidebarTab === 'prompts' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="BookOpen" size={13} />
                        <span>{safeT(t, 'aiTabPrompts', 'Prompts')}</span>
                    </button>
                    <button 
                        onClick={() => setSidebarTab('settings')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${sidebarTab === 'settings' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="Settings" size={13} />
                        <span>
                            {safeT(t, 'fileSettings', 'Einstellungen')} ({isCurrentModelGemini ? geminiThinkingLevel : aiTemperature})
                        </span>
                    </button>
                </div>

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
                                                <div className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{p.text}</div>
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

                            {/* Lokale Ollama API Discovery Box */}
                            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-emerald-500' : (ollamaStatus === 'loading' ? 'bg-amber-400 animate-ping' : 'bg-rose-500')}`}></span>
                                        {safeT(t, 'aiOllamaDiscoveryTitle', 'Lokale Ollama Modelle')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={fetchOllamaModels}
                                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Icon name="RefreshCw" size={11} className={ollamaStatus === 'loading' ? 'animate-spin' : ''} />
                                        <span>{safeT(t, 'btnRefresh', 'Abfragen')}</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                                    {ollamaStatus === 'online'
                                        ? safeT(t, 'aiOllamaModelsFound', '{count} Modell(e) live über http://localhost:11434/api/tags gefunden.').replace('{count}', liveOllamaModels.length) : safeT(t, 'aiOllamaOfflineNotice', 'Ollama Dienst aktuell nicht erreichbar. Es werden die hinterlegten Standardmodelle angezeigt.')}
                                </p>
                            </div>

                            {/* Entweder Gemini Denkaufwand ODER Temperatur-Slider */}
                            {isCurrentModelGemini ? (
                                <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Icon name="Sparkles" size={13} className="text-indigo-500" />
                                            {safeT(t, 'aiThinkingEffort', 'Gemini Denkaufwand')}
                                        </span>
                                        <span className="font-mono text-xs font-black bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                            {geminiThinkingLevel}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                                        {[
                                            { id: 'LOW', label: safeT(t, 'aiThinkingLow', 'Gering') },
                                            { id: 'MEDIUM', label: safeT(t, 'aiThinkingMedium', 'Mittel') },
                                            { id: 'HIGH', label: safeT(t, 'aiThinkingHigh', 'Hoch') }
                                        ].map(lvl => (
                                            <button
                                                key={lvl.id}
                                                type="button"
                                                onClick={() => setGeminiThinkingLevel(lvl.id)}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    geminiThinkingLevel === lvl.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-indigo-400'
                                                }`}
                                            >
                                                {lvl.label}
                                            </button>
                                        ))}
                                    </div>

                                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed pt-1">
                                        {safeT(t, 'aiThinkingDesc', 'Steuert die Reasoning-Tiefe (thinkingLevel) der neuesten Gemini-Modelle. Gemäss Google-Spezifikation wird kein Temperatur-Parameter übergeben.')}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Icon name="Zap" size={13} className="text-amber-500" />
                                            {safeT(t, 'aiTemp', 'Modell-Temperatur')}
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
                                        <span>{safeT(t, 'aiTempFactual', '0.0 (Faktisch / Code)')}</span>
                                        <span>{safeT(t, 'aiTempBalanced', '0.5 (Ausgewogen)')}</span>
                                        <span>{safeT(t, 'aiTempCreative', '1.0 (Kreativ)')}</span>
                                    </div>

                                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed pt-1">
                                        {aiTemperature <= 0.2 ? safeT(t, 'aiTempHintLow', 'Empfohlen für exakte Charts, Berechnungen und fehlerfreien Code.') : safeT(t, 'aiTempHintHigh', 'Höhere Kreativität – für freie Finanzanalysen oder neue Widget-Ideen.')}
                                    </p>
                                </div>
                            )}

                            {/* Kontextfenster (für lokale Ollama Modelle) */}
                            {!isCloudModelFn(selectedModel) && (
                                <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        <span>{safeT(t, 'aiContext', 'Kontextfenster')}</span>
                                        <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400">{formatTokenCount(aiContextWindow)}</span>
                                    </label>
                                    
                                    <select 
                                        value={aiContextWindow} 
                                        onChange={(e) => setAiContextWindow(parseInt(e.target.value))}
                                        className="w-full p-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none font-semibold cursor-pointer"
                                    >
                                        <option value={4096}>{safeT(t, 'aiCtxOpt4k', "4K Tokens (~3'000 Wörter)")}</option>
                                        <option value={8192}>{safeT(t, 'aiCtxOpt8k', "8K Tokens (~6'000 Wörter)")}</option>
                                        <option value={16384}>{safeT(t, 'aiCtxOpt16k', "16K Tokens (~12'000 Wörter - Empfohlen)")}</option>
                                        <option value={32768}>{safeT(t, 'aiCtxOpt32k', "32K Tokens (~24'000 Wörter)")}</option>
                                    </select>
                                    
                                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                                        {safeT(t, 'aiContextDesc', 'Größere Fenster erlauben der KI, das komplette Portfolio samt Buchungshistorie im Gedächtnis zu behalten.')}
                                    </p>
                                </div>
                            )}

                            {/* Modellinfo Box */}
                            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Icon name="Cpu" size={14} className="text-blue-600 dark:text-blue-400" />
                                    {safeT(t, 'aiActiveModelLabel', 'Aktives Modell:')} {selectedModel}
                                </div>
                                <div className="text-[11px] text-blue-800/80 dark:text-blue-400/80 leading-relaxed">
                                    {isCloudModelFn(selectedModel) 
                                        ? safeT(t, 'aiModelInfoCloud', 'Cloud-Verarbeitung mit hoher Geschwindigkeit und komplexer Code-Generierung. Einzel-Assets werden lokal über die FinSPA_API im Browser ausgewertet.') : safeT(t, 'aiModelInfoLocal', 'Vollständig lokale Ausführung über Ollama. Deine Daten verlassen dieses Gerät nicht.')}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col relative transition-colors duration-300 overflow-hidden font-sans">
            
            {showSidebar && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" 
                    onClick={() => setShowSidebar(false)}
                />
            )}
            
            {renderSidebar()}

            <header className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-20 flex flex-wrap justify-between items-center gap-3 shadow-sm relative">
                <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-gradient-to-br from-[#2548C3] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white flex items-center justify-center">
                        <Icon name="Cpu" size={20} className="stroke-[2.5px]" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                            FinBundle <span className="text-blue-600 dark:text-blue-400">Copilot</span>
                        </h1>
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {safeT(t, 'aiCopilotSubtitle', 'KI-gestützte Report- & Widget-Entwicklung')}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    {/* Modell-Auswahl inkl. Live-Ollama-Refresh */}
                    <div className="flex items-center bg-gray-100 dark:bg-slate-900 rounded-xl p-1 border border-gray-200 dark:border-slate-800">
                        <span
                            className={`ml-2 w-2 h-2 rounded-full shrink-0 ${ollamaStatus === 'online' ? 'bg-emerald-500' : (ollamaStatus === 'loading' ? 'bg-amber-400 animate-ping' : 'bg-slate-400')}`}
                            title={ollamaStatus === 'online' ? safeT(t, 'aiOllamaOnlineTooltip', 'Ollama online ({count} Modelle)').replace('{count}', liveOllamaModels.length) : safeT(t, 'aiOllamaStatusTooltip', 'Ollama Status')}
                        />
                        <select 
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)} 
                            className="text-xs py-1.5 px-2 bg-transparent text-gray-700 dark:text-slate-300 outline-none font-semibold cursor-pointer max-w-[200px] sm:max-w-[250px]"
                        >
                            {availableModels.map(m => (
                                <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                                    {m.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={fetchOllamaModels}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={safeT(t, 'aiRefreshOllamaTooltip', 'Verfügbare Ollama-Modelle über API neu abfragen')}
                        >
                            <Icon name="RefreshCw" size={12} className={ollamaStatus === 'loading' ? 'animate-spin text-blue-500' : ''} />
                        </button>
                    </div>

                    {/* Direkt-Auswahl für Gemini Denkaufwand (Gering, Mittel, Hoch) */}
                    {isCurrentModelGemini && (
                        <div className="flex items-center bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-1 gap-0.5" title={safeT(t, 'aiThinkingEffort', 'Gemini Denkaufwand (ohne Temperaturparameter)')}>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-1.5 hidden lg:inline">
                                {safeT(t, 'aiThinkingShort', 'Denkaufwand:')}
                            </span>
                            {[
                                { id: 'LOW', label: safeT(t, 'aiThinkingLow', 'Gering') },
                                { id: 'MEDIUM', label: safeT(t, 'aiThinkingMedium', 'Mittel') },
                                { id: 'HIGH', label: safeT(t, 'aiThinkingHigh', 'Hoch') }
                            ].map(lvl => (
                                <button
                                    key={lvl.id}
                                    type="button"
                                    onClick={() => setGeminiThinkingLevel(lvl.id)}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        geminiThinkingLevel === lvl.id
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                    }`}
                                >
                                    {lvl.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-0.5 hidden sm:block"></div>

                    <button 
                        type="button"
                        onClick={handleClearChat} 
                        disabled={chatHistory.length === 0 && !isLoading}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            confirmClear
                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md animate-pulse'
                                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                    >
                        <Icon name={confirmClear ? "Trash2" : "PlusCircle"} size={15} />
                        <span className="hidden sm:inline">
                            {confirmClear ? safeT(t, 'aiConfirmClearBtn', 'Wirklich leeren?') : safeT(t, 'aiNewChat', 'Neuer Chat')}
                        </span>
                    </button>

                    <button 
                        onClick={() => { setSidebarTab('prompts'); setShowSidebar(true); }} 
                        className="p-2.5 rounded-xl text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                        title={safeT(t, 'aiPromptSettingsTooltip', "Prompts & Einstellungen")}
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
                            <h2 className="text-2xl sm:text-3xl font-black mb-3 text-slate-800 dark:text-slate-100 text-center">
                                {safeT(t, 'aiHeroQuestion', 'Was möchtest du heute analysieren?')}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-lg text-sm">
                                {safeT(t, 'aiHeroDesc', 'Stelle eine Finanzfrage. Der Copilot kennt alle deine Assetklassen, Buchungskategorien und deine Kontostruktur und generiert interaktive Widgets im Light- & Darkmode.')}
                            </p>
                            
                            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                                {PROMPT_LIBRARY[0].prompts.slice(0, 2).map((p, i) => (
                                    <button 
                                        key={i} onClick={() => handlePromptSelect(p.text)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-semibold hover:border-blue-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
                                    >
                                        {p.title}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => { setSidebarTab('prompts'); setShowSidebar(true); }}
                                    className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Icon name="Menu" size={13} /> {safeT(t, 'aiShowAllPrompts', 'Alle Prompts')}
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
                                            <div className={`p-5 rounded-2xl rounded-tl-sm text-sm border shadow-sm ${msg.isError ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-800'}`}>
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
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {safeT(t, 'aiIsTyping', 'Copilot generiert Analyse & Code...')}
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} className="h-6 w-full shrink-0"></div>
                </div>
            </main>

            <footer className="shrink-0 p-4 md:px-8 md:py-5 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 relative z-20">
                <div className="max-w-4xl mx-auto relative">
                    <textarea 
                        ref={textareaRef}
                        className="w-full pl-6 pr-[68px] py-4 border border-gray-300 dark:border-slate-700 rounded-[28px] resize-none bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 outline-none text-[15px] min-h-[56px] max-h-[200px] transition-all text-slate-800 dark:text-slate-200 custom-scrollbar"
                        placeholder={safeT(t, 'aiInputPlaceholder', "Beschreibe die gewünschte Auswertung...")}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                        rows={1}
                    />
                    
                    <button 
                        onClick={handleAskAI} 
                        disabled={isLoading || !prompt.trim()} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-800 text-white rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer"
                        title={safeT(t, 'aiSendTooltip', 'Senden (Enter)')}
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
                                {safeT(t, 'aiModalSavePluginTitle', 'Report als Plugin speichern')}
                            </h3>
                            <button onClick={() => setPluginModal(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white cursor-pointer">
                                <Icon name="X" size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    {safeT(t, 'colReportName', 'Name des Reports (im Menü)')}
                                </label>
                                <input 
                                    type="text" 
                                    value={pluginTitle} 
                                    onChange={e => setPluginTitle(e.target.value)} 
                                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmSavePlugin(); if (e.key === 'Escape') setPluginModal(null); }}
                                    placeholder={safeT(t, 'aiPluginTitlePlaceholder', 'z.B. Vorsorge & Rentenanalyse')} 
                                    className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    {safeT(t, 'aiPluginCategoryLabel', 'Menü-Kategorie (z.B. Vorsorge, Vermögen)')}
                                </label>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={pluginCategory} 
                                        onChange={e => setPluginCategory(e.target.value)} 
                                        placeholder={safeT(t, 'aiPluginCategoryPlaceholder', 'Kategorie eingeben...')} 
                                        className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                    />
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {existingCategories.map((c, i) => (
                                            <button 
                                                key={i} 
                                                type="button" 
                                                onClick={() => setPluginCategory(c)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${pluginCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                {safeT(t, 'aiPluginModalDesc1', 'Dieser Report wird dauerhaft im Hauptmenü unter')} <strong>{safeT(t, 'menuPlugins', 'Plugins')} &rarr; {pluginCategory || '...'}</strong> {safeT(t, 'aiPluginModalDesc2', 'verankert und steht jederzeit für Analysen und den PDF-Export bereit.')}
                            </p>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 flex justify-end gap-3">
                            <button 
                                onClick={() => setPluginModal(null)} 
                                className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                {safeT(t, 'btnCancel', 'Abbrechen')}
                            </button>
                            <button 
                                onClick={handleConfirmSavePlugin} 
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                            >
                                {safeT(t, 'aiSaveAsPluginBtn', 'Als Plugin speichern')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.AiDashboard = AiDashboard;
}
module.exports = AiDashboard;
