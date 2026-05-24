/**
 * @file AiDashboard.jsx
 * @description FinSPA KI Copilot Dashboard. Bietet eine Chat-Schnittstelle zu lokalen LLMs (Ollama),
 * generiert dynamische HTML/Chart.js Widgets basierend auf den Finanzdaten des Nutzers.
 * @version 2.3.0 - Internationalized & Dynamic Models
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();
const Icon = safeRequire('../Icons.jsx') || (({name, className, size}) => <span className={className}>[{name}]</span>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.__FinSPAModules['data/DataEngine.jsx']?.exports || {};
const finspaSchema = safeRequire('../../schema/finspa-schema.json');

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
    
    // --- DYNAMISCHE KONFIGURATIONEN LADE ---
    const FALLBACK_MODELS = [
        { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder (14B)' },
        { id: 'llama3:latest', name: 'Llama 3 (8B)' }
    ];
    const availableModels = data?.settings?.aiModels || FALLBACK_MODELS;

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

       const flatAssets = [];
        // Wir importieren die DataEngine Funktionen, um korrekte Stichtagswerte zu erhalten
        const extractAssets = (nodes, currentBank = 'Unbekannt') => {
            (nodes || []).forEach(node => {
                let bankName = currentBank;
                if (node.type === 'bank') bankName = node.name;
                
                if (node.type === 'asset') {
                    // Verwende die DataEngine-Logik für den aktuellen Wert (heutiges Datum)
                    const today = new Date().toISOString().split('T')[0];
                    const val = DataEngine.getAssetValueAtDate(node, today, data.banks) || 0;
                    
                    flatAssets.push({ 
                        id: node.id, 
                        name: node.name, 
                        bank: bankName, 
                        assetClass: node.assetClass || 'cash', 
                        value: val, 
                        currency: node.currency || 'CHF',
                        isLiquid: !!node.isLiquid // Auch den Liquiditätsstatus für die KI mitgeben
                    });
                }
                
                if (node.children) extractAssets(node.children, bankName);
            });
        };
        extractAssets(data.banks || []);
        
        const budgetString = JSON.stringify(data.budget || {});
        const assetsString = JSON.stringify(flatAssets);

	const schemaInfo = JSON.stringify(finspaSchema, null, 2)


	

       const systemPrompt = `Du bist ein Frontend-Entwickler.
Du generierst vollständig lauffähige, isolierte HTML/JS-Widgets für das FinSPA Dashboard.
Hier ist die Struktur der Daten (Nodes), mit denen du arbeitest:

<datenstruktur>
- Die Daten sind in einem JSON-Objekt window.finspaData enthalten auf das Du direkt Zugriff hast
- Das Schema des Datensatzes ist ${schemaInfo}
- Als Hauptebene bezeichne ich die Childs direkt unter dem Hauptknoten.
- In der Hauptebene sind folgende Childs definiert:
a) settings
-- Darin ist das Feld baseCurrency enthalten, dass die Währung aller Assets angibt (bei Fremdgeldkonten ist die Währung in einem andere Feld angegeben, dass ich Dir noch spezifizieren werde.
-- Weitere Felder:
bookingCategories:Ein sehr wichtiges Array-Feld, wo die Buchungskategorien definiert sind. Das Feld enthält in der obersten Ebene
die Hauptkategorie und in einer Ebene darunter die Unterkategorie:

dazu ein Beispiel:

"bookingCategories": {
      "Einzahlung": [
        "Lohn",
        "Dividenden",
        "Zinsen",
        "Verkauf",
        "Mieteinnahmen",
        "Sonstiges",
        "Bonus"
      ],
	
      … weitere Einträge
}

Wenn also nach einer Buchung gefragt wird, traversierst Du dieses Feld und notierst Dir die Hauptkategorie und die Unterkategorien.
Im Beispiel :
Hauptkategorie - Einzahlung
Unterkategorien - Lohn, Dividenden, Zinsen, Verkauf, Mieteinnahme, Sonstiges, Bonus
Mit diesen notierten Werten, kannst Du dann nach Buchungen suchen (wird weiter unten spezifiziert)

assetClasses: Ein Array-Feld, das alle Assetsklassen die im Datensatz verwendet werden definiert. Hier ein Beispiel:

"assetClasses": [
      {
        "id": "cash",
        "name": "Bargeld / Konto",
        "description": "Liquide Mittel und Girokonten"
      },
	
      … weitere Einträge 	
}

Wenn also nach einer Buchung gefragt wirst, parst Du dieses Feld und suchst gezielt, nach der Assetklasse, die beim Prompt gefragt wird.
b) Das Feld nach Settings heisst banks

Diese Datenstruktur ist relativ komplex, daher ein Beispiel. Einträge mit <Einträge> sind Beispielwerte 

"banks": [
    {
      "id": "oyxevyh34",
      "name": "<Bankname>",
      "type": "bank",
      "isArchived": false,
      "children": [
        {
          "id": "vv22mb0g1",
          "name": "Konten",
          "type": "category",
          "isArchived": false,
          "children": [
            {
              "id": "6o5enqear",
              "name": "<Kontoname>",
              "type": "asset",
              "currency": "CHF",
              "exchangeRate": "1",
              "isLiquid": true,
              "isArchived": false,
              "assetClass": "cash",
              "balances": [
                {
                  "id": "23ulp6bbo",
                  "date": "2026-05-18",
                  "amount": <Gesamtbetrag auf Konto vorhanden>,
                  "bookingExchangeRate": 1
                }
              ],
              "bookings": [
                {
                  "id": "q069xvo6p",
                  "date": "2026-05-19",    <--- Buchungsdatum
                  "type": "<Wert der Hauptbookingkategorie, also bspw Einzahlung>",
                  "subCategory": "<Wert der Unterkategorie, also bspw. Dividende>",
                  "amount": 7.05,          <--- Buchungsbetrag  
                  "shares": 0,		  
                  "price": 0,
                  "fees": 0,
                  "taxes": 0,
                  "bookingExchangeRate": 1
                }
              ]
            },
            {
              "id": "yzavhxkgt",
              "name": "<ein weiteres Konto",
              "type": "asset",
              "currency": "CHF",
              "exchangeRate": "1",
              "isLiquid": true,
              "isArchived": false,
              "assetClass": "cash",
              "balances": [
                {
                  "id": "8c4dtaps5",
                  "date": "2026-05-18",
                  "amount": 0.1,
                  "bookingExchangeRate": 1
                }
              ],
              "bookings": []
            },
	… weitere Einträge

Damit sind die Daten, die Du unter window.finspaData findest vollständig erklärt und Du musst in der Lage sein, 
Prompts dieszebüglich zu beantworten
</datenstruktur>

<daten>
window.finspaData = ... (Kompletter Baum)
window.finspaBudget = ${budgetString}
</daten>


<regeln>
1. VOLLSTÄNDIGES HTML: Deine Antwort MUSS immer mit <!DOCTYPE html> beginnen und ein komplettes <html> Dokument sein.
2.a. KEIN TEMPLATING: Du bist im Browser. Es gibt keinen Server. Das HTML muss statisch sein, nutze NIEMALS {% %} oder {{ }}. Die Logik passiert rein im <script>.
2.b. STRIKTES VERBOT VON DUMMY-DATEN: Du darfst unter KEINEN UMSTÄNDEN Platzhalter, Dummy-Daten, erfundene Arrays oder statische Beispielzahlen (wie 50000, 30000, "Annuities" etc.) in das HTML, die Charts oder das PDF schreiben! 
Du MUSST ausnahmslos die Variablen verwenden, die von den FinSPA_API-Funktionen zurückgegeben werden. Jeder Wert im UI oder PDF MUSS das Resultat eines FinSPA_API Aufrufs sein.
3. SCRIPT POSITION: Das <script> MUSS am Ende des <body> stehen.
4. TAILWINDCSS: Lade Tailwind im <head> via CDN und nutze es für das Design.
5. Du hast Zugriff auf folgende API - 


//Du hast Zugriff auf folgende Javascript-API und musst sie nicht implementieren

5. Du hast Zugriff auf folgende API - 

//Du hast Zugriff auf folgende Javascript-API und musst sie nicht implementieren

const FinSPA_API = {
    // --- EXTRAKTION ---
    getAllAssets: function(data) { /* Gibt Array aller Assets inkl. bankName zurück */ },
    getLiquidAssets: function(data) { /* Gibt Array aller liquiden Assets zurück */ },
    getAssetsByBank: function(data, bankName) { /* Gibt Assets einer bestimmten Bank zurück */ },
    getAssetsByClass: function(data, assetClass) { /* Gibt Assets einer Klasse zurück */ },

    // --- BERECHNUNGEN ---
    getLatestBalanceValue: function(asset) { /* Gibt aktuellsten Saldo in Basiswährung zurück */ },
    getTotalWealth: function(data) { /* Gibt Gesamtvermögen zurück */ },
    getTotalLiquidWealth: function(data) { /* Gibt liquides Vermögen zurück */ },
    getWealthDistributionByClass: function(data) { /* Gibt Objekt { assetClass: totalValue } zurück */ },
    getWealthByBank: function(data) { /* Gibt Array [{bankName, totalValue}] zurück */ },

    // --- BUCHUNGEN & CASHFLOW ---
    getAllBookings: function(data) { /* Gibt flaches Array aller Transaktionen zurück */ },
    getTotalFeesPaid: function(data) { /* Gibt Summe aller Gebühren zurück */ },
    getTotalDividendsReceived: function(data) { /* Gibt Summe aller Dividenden zurück */ },

    // --- BUDGET & FIRE ---
    getFreeMonthlyBuffer: function(data) { /* Gibt frei verfügbares Monatsbudget zurück */ },
    getSavingsRate: function(data) { /* Gibt Sparquote in Prozent zurück */ },
    getFireProgress: function(data) { /* Gibt Objekt {current, target, percentage} zurück */ }
};		

6. Verwende ausschliesslich die Felder, die im Schema definiert sind. Erfinde keine neuen Felder.
7. VORINSTALLIERTE BIBLIOTHEKEN:
Folgende Bibliotheken sind bereits geladen und als globale window-Objekte verfügbar: 
- Chart.js (window.Chart)
- ECharts (window.echarts)
- Plotly (window.Plotly)
- PDFMake
Lade KEINE externen Scripte über <script src="...">. Greife direkt auf die globalen Objekte zu. 
html2canvas oder jsPDF werden NICHT verwendet.

8. Jeder erstellte Report oder jedes Dashboard muss als PDF exportiert werden können. 
   Nutze AUSSCHLIESSLICH die integrierte API. 
   WICHTIG: Erfinde NIEMALS hartcodierte Fantasiewerte für den PDF-Export! Alle Daten im PDF (Metrics und Tabellen) müssen zwingend aus den berechneten Javascript-Variablen stammen.

Binde folgenden Code in den Event-Listener deines Export-Buttons ein:

document.getElementById('pdfButton').addEventListener('click', async function() {
    await FinSPA_API.PDF.exportDashboard({
        title: 'Dein Report Titel',
        orientation: 'landscape',
        // NEU: Übergebe hier alle wichtigen Kennzahlen (KPIs), die auch im UI-Dashboard stehen!
        metrics: [
            { label: 'Gesamtvermögen', value: totalWealthVariable + ' CHF' },
            { label: 'Liquides Vermögen', value: liquidWealthVariable + ' CHF' }
            // Füge hier alle weiteren KPIs aus deiner Übersicht hinzu...
        ],
        chartIds: ['myChart'], // HTML-IDs der generierten Charts
        tables: [
            {
                title: 'Beispieltabelle',
                headers: ['Bezeichnung', 'Wert'], 
                // Mappe hier immer deine berechneten Daten-Arrays!
                rows: calculatedDataArray.map(item => [item.name, item.value + ' CHF'])
            }
        ]
    });
});
9. Ein Dashboard kann aus statischen HTML Elementen, Tabellen und Grafiken bestehen. Es muss als Ganzes als PDF exportiert werden können.
10. Das resultierende HTML Dokument wird in einem iFrame gerendert. Bitte Methoden so anpassen, dass das möglich ist.

11. Verwende NUR Mater-Template

<master_template>
Du MUSST exakt diese HTML-Struktur für JEDE Antwort verwenden:

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>body { background: transparent; }</style>
</head>
<body class="p-6 bg-white">
    
    <div class="mt-8 flex space-x-2">
        <button id="pdfButton" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow">
            Als PDF speichern
        </button>
    </div>
    //MUSS Ganz unten stehen. Sämtliche Scriptelemente sind HIER einzutragen
    <script>
        const data = window.finspaData;
        
        // 1. Nutze FinSPA_API um Daten zu evaluieren
        // 2. Baue dein UI (Chart.js / DOM-Manipulation für Tabellen)
        
        // 3. Füge den Event-Listener für den pdfButton ein
        document.getElementById('pdfButton').addEventListener('click', async function() {
            await FinSPA_API.PDF.exportDashboard({
                title: 'FinSPA Auswertung',
                orientation: 'landscape',
                chartIds: [], // IDs der Container eintragen, falls Diagramme existieren
                tables: [] // Array-Daten eintragen, falls Tabellen existieren
            });
        });
    </script>
</body>
</html>
</master_template>

12. SPRACHE: Generiere alle Texte, Titel und Labels innerhalb des HTML-Dokuments in genau der Sprache, in der die Nutzer-Anfrage (Prompt) gestellt wurde.
13. CHART.JS GRÖSSE: Wenn du ein Diagramm mit Chart.js erstellst, MUSST du das <canvas> Element zwingend in ein Wrapper-<div> mit einer festen Höhe packen (nutze dafür Tailwind-Klassen wie class="relative w-full h-72" oder "h-80"). In den Javascript-Optionen des Charts MUSST du außerdem zwingend "maintainAspectRatio: false" setzen, da das Diagramm sonst das Layout sprengt.

</regeln>

Antworte NUR mit dem finalen \`\`\`html Block. Erkläre nichts.`;


console.log("--- FINSPA AI PROMPT DEBUG ---");
console.log("System Prompt:", systemPrompt);
console.log("History für Ollama:", [...newHistory.slice(-4).map(h => ({ role: h.role, content: h.content }))]);
console.log("-------------------------------");

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
                     role: 'assistant', text: t('aiErrorNoHtml'),
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
            setChatHistory([...newHistory, { role: 'assistant', text: `${t('aiErrorConnection')} ${error.message}`, isError: true, timestamp: new Date().toISOString() }]);
        } finally { 
            setIsLoading(false); 
        }
    };

    const renderIframeWidget = (htmlContent) => {
        
	const flatAssets = [];
       const extractAssets = (nodes, currentBank = 'Unbekannt') => {
            (nodes || []).forEach(node => {
                let bankName = currentBank;
                if (node.type === 'bank') bankName = node.name;
                
                if (node.type === 'asset') {
                    // Verwende die DataEngine-Logik für den aktuellen Wert (heutiges Datum)
                    const today = new Date().toISOString().split('T')[0];
                    const val = DataEngine.getAssetValueAtDate(node, today, data.banks) || 0;
                    
                    flatAssets.push({ 
                        id: node.id, 
                        name: node.name, 
                        bank: bankName, 
                        assetClass: node.assetClass || 'cash', 
                        value: val, 
                        currency: node.currency || 'CHF',
                        isLiquid: !!node.isLiquid // Auch den Liquiditätsstatus für die KI mitgeben
                    });
                }
                
                if (node.children) extractAssets(node.children, bankName);
            });
        };
        
        extractAssets(data.banks || []);

	const injectedScripts = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts-gl/dist/echarts-gl.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
        <script>
            // --- Hier fügst du dein komplettes FinSPA_API Objekt ein ---
const FinSPA_API = {

    // ==========================================
    // 1. GRUNDLEGENDE DATENEXTRAKTION
    // ==========================================

    getAllAssets: function(data) {
        const assets = [];
        function traverse(node, currentBank) {
            let bankName = currentBank;
            if (node.type === 'bank') bankName = node.name;
            if (node.type === 'asset') {
                assets.push({ ...node, bankName: bankName });
            }
            if (node.children) {
                node.children.forEach(child => traverse(child, bankName));
            }
        }
        (data.banks || []).forEach(bank => traverse(bank, 'Unbekannt'));
        return assets;
    },

    getLiquidAssets: function(data) {
        return this.getAllAssets(data).filter(a => a.isLiquid === true);
    },

    getAssetsByBank: function(data, bankName) {
        return this.getAllAssets(data).filter(a => a.bankName === bankName);
    },

    getAssetsByClass: function(data, assetClass) {
        return this.getAllAssets(data).filter(a => a.assetClass === assetClass);
    },

    // ==========================================
    // 2. VERMÖGENS- UND SALDOBERECHNUNGEN
    // ==========================================

    getLatestBalanceValue: function(asset) {
        if (!asset.balances || asset.balances.length === 0) return 0;
        const latest = asset.balances.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        }, asset.balances[0]);
        const rate = latest.bookingExchangeRate || asset.exchangeRate || 1;
        return latest.amount * rate;
    },

    getTotalWealth: function(data) {
        const assets = this.getAllAssets(data);
        return assets.reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getTotalLiquidWealth: function(data) {
        const liquidAssets = this.getLiquidAssets(data);
        return liquidAssets.reduce((sum, asset) => sum + this.getLatestBalanceValue(asset), 0);
    },

    getWealthDistributionByClass: function(data) {
        const assets = this.getAllAssets(data);
        const distribution = {};
        
        // NEU: Mapping der Asset-IDs zu den sprechenden Namen aus den Settings
        const classMap = {};
        if (data.settings && data.settings.assetClasses) {
            data.settings.assetClasses.forEach(ac => {
                classMap[ac.id] = ac.name;
            });
        }

        assets.forEach(asset => {
            const val = this.getLatestBalanceValue(asset);
            const acId = asset.assetClass || 'unknown';
            // Verwende den Namen, falls vorhanden, sonst Fallback auf ID
            const acName = classMap[acId] || acId; 
            
            distribution[acName] = (distribution[acName] || 0) + val;
        });
        return distribution;
    },

    // NEU: Damit die KI aggregierte Bankdaten (Total pro Bank) korrekt abrufen kann
    getWealthByBank: function(data) {
        const assets = this.getAllAssets(data);
        const bankTotals = {};
        assets.forEach(asset => {
            const bName = asset.bankName || 'Unbekannt';
            const val = this.getLatestBalanceValue(asset);
            bankTotals[bName] = (bankTotals[bName] || 0) + val;
        });
        return Object.keys(bankTotals).map(name => ({
            bankName: name,
            totalValue: bankTotals[name]
        }));
    },

    // ==========================================
    // 3. BUCHUNGEN UND CASHFLOW
    // ==========================================

    getAllBookings: function(data) {
        const assets = this.getAllAssets(data);
        return assets.flatMap(asset => {
            return (asset.bookings || []).map(booking => ({
                ...booking,
                assetName: asset.name,
                bankName: asset.bankName,
                assetClass: asset.assetClass
            }));
        });
    },

    getTotalFeesPaid: function(data) {
        const bookings = this.getAllBookings(data);
        return bookings
            .filter(b => b.type === 'Gebühr')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    getTotalDividendsReceived: function(data) {
        const bookings = this.getAllBookings(data);
        return bookings
            .filter(b => b.type === 'Einzahlung' && b.subCategory === 'Dividenden')
            .reduce((sum, b) => sum + (b.amount * (b.bookingExchangeRate || 1)), 0);
    },

    // ==========================================
    // 4. BUDGET & FIRE
    // ==========================================

    _normalizeToMonthly: function(items) {
        if (!items) return 0;
        return items.reduce((sum, item) => {
            if (item.frequency === 'monthly') return sum + item.amount;
            if (item.frequency === 'yearly') return sum + (item.amount / 12);
            return sum;
        }, 0);
    },

    getMonthlyIncome: function(data) {
        return this._normalizeToMonthly(data.budget?.incomeSources);
    },

    getMonthlyFixedCosts: function(data) {
        const expenses = this._normalizeToMonthly(data.budget?.expenses);
        const subs = this._normalizeToMonthly(data.budget?.subscriptions);
        return expenses + subs;
    },

    getFreeMonthlyBuffer: function(data) {
        return this.getMonthlyIncome(data) - this.getMonthlyFixedCosts(data);
    },

    getSavingsRate: function(data) {
        const income = this.getMonthlyIncome(data);
        if (income === 0) return 0;
        const savingsExpenses = (data.budget?.expenses || []).filter(e => e.ruleCategory === 'savings');
        const monthlySavings = this._normalizeToMonthly(savingsExpenses);
        return (monthlySavings / income) * 100;
    },

    getFireProgress: function(data) {
        const currentWealth = this.getTotalWealth(data);
        const targetWealth = data.goals?.fire?.target || 0;
        if (targetWealth === 0) return 100;
        return {
            current: currentWealth,
            target: targetWealth,
            percentage: Math.min((currentWealth / targetWealth) * 100, 100)
        };
    },

    // ==========================================
    // 5. PRETTY PDF EXPORT API
    // ==========================================
    PDF: {
        exportDashboard: async function(config) {
            if (!window.pdfMake || !window.pdfMake.vfs) {
                console.error("pdfmake oder die Fonts (vfs) sind nicht geladen.");
                return;
            }

            const docContent = [
                { 
                    text: config.title || 'FinSPA Dashboard Report', 
                    fontSize: 26, 
                    bold: true, 
                    color: '#1e293b', 
                    margin: [0, 0, 0, 25] 
                }
            ];


            if (config.metrics && config.metrics.length > 0) {
                // Wir formatieren die Metriken als ansprechende Spalten
                const metricColumns = config.metrics.map(m => ({
                    stack: [
                        { text: m.label.toUpperCase(), fontSize: 9, color: '#64748b', bold: true },
                        { text: m.value, fontSize: 16, color: '#2548C3', bold: true, margin: [0, 4, 0, 0] }
                    ]
                }));

                // Jeweils max 4 Metriken pro Zeile nebeneinander darstellen
                for (let i = 0; i < metricColumns.length; i += 4) {
                    docContent.push({
                        columns: metricColumns.slice(i, i + 4),
                        columnGap: 20,
                        margin: [0, 0, 0, 25], // Abstand nach unten
                        pageBreak: 'avoid'
                    });
                }
            }

            // 1. Charts verarbeiten
            if (config.chartIds && config.chartIds.length > 0) {
                for (const chartId of config.chartIds) {
                    const domElement = document.getElementById(chartId);
                    if (!domElement) continue;

                    if (domElement.tagName.toLowerCase() === 'canvas') {
                        const ctx = domElement.getContext('2d');
                        const originalComposite = ctx.globalCompositeOperation;
                        ctx.globalCompositeOperation = 'destination-over';
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, domElement.width, domElement.height);
                        
                        const imgData = domElement.toDataURL("image/png", 1.0);
                        ctx.globalCompositeOperation = originalComposite;

                        docContent.push({ image: imgData, width: 750, margin: [0, 10, 0, 30], pageBreak: 'avoid' });
                        continue;
                    }

                    if (window.echarts) {
                        const eInstance = window.echarts.getInstanceByDom(domElement);
                        if (eInstance) {
                            const img = eInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
                            docContent.push({ image: img, width: 750, margin: [0, 10, 0, 30], pageBreak: 'avoid' });
                            continue;
                        }
                    }
                    
                    if (window.Plotly && domElement.className.includes('js-plotly')) {
                        const img = await window.Plotly.toImage(domElement, {format: 'png', width: 1200, height: 600});
                        docContent.push({ image: img, width: 750, margin: [0, 10, 0, 30], pageBreak: 'avoid' });
                    }
                }
            }

            // 2. Tabellen verarbeiten
            if (config.tables && config.tables.length > 0) {
                config.tables.forEach(table => {
                    if (!table.headers || !table.rows) return;
                    
                    if (table.title) {
                        docContent.push({ text: table.title, fontSize: 16, bold: true, color: '#334155', margin: [0, 15, 0, 10], pageBreak: 'avoid' });
                    }

                    docContent.push({
                        table: {
                            headerRows: 1,
                            widths: table.widths || table.headers.map(() => '*'), 
                            body: [
                                table.headers.map(h => ({ 
                                    text: h, 
                                    fillColor: '#2548C3',
                                    color: '#ffffff',
                                    bold: true,
                                    margin: [8, 8, 8, 8]
                                })),
                                ...table.rows.map(row => row.map(cell => ({ 
                                    text: cell, 
                                    margin: [8, 6, 8, 6] 
                                })))
                            ]
                        },
                        layout: {
                            fillColor: function (rowIndex) {
                                return (rowIndex % 2 === 0 && rowIndex !== 0) ? '#f8fafc' : null; 
                            },
                            hLineWidth: function (i, node) { 
                                return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5; 
                            },
                            vLineWidth: function () { return 0; }, 
                            hLineColor: function (i, node) { 
                                return (i === 0 || i === node.table.body.length) ? '#1e293b' : '#cbd5e1'; 
                            }
                        },
                        margin: [0, 10, 0, 30],
                        pageBreak: 'avoid'
                    });
                });
            }

            // Generieren und Download
            window.pdfMake.createPdf({
                pageSize: 'A4',
                pageOrientation: config.orientation || 'landscape',
                pageMargins: [40, 60, 40, 60],
                content: docContent,
                defaultStyle: { font: 'Roboto', fontSize: 11, color: '#334155' },
                header: function() {
                    return {
                        columns: [
                            { text: 'FinSPA Pro - KI Copilot', alignment: 'left', color: '#94a3b8', margin: [40, 20, 0, 0], fontSize: 9 },
                            { text: new Date().toLocaleDateString('de-CH'), alignment: 'right', color: '#94a3b8', margin: [0, 20, 40, 0], fontSize: 9 }
                        ]
                    };
                },
                footer: function(currentPage, pageCount) {
                    return {
                        columns: [
                            { text: 'Vertrauliche Finanzdaten', alignment: 'left', color: '#94a3b8', fontSize: 9, margin: [40, 15, 0, 0] },
                            { text: 'Seite ' + currentPage.toString() + ' von ' + pageCount, alignment: 'right', color: '#94a3b8', fontSize: 9, margin: [0, 15, 40, 0] }
                        ]
                    };
                }
            }).download((config.title || 'Export').replace(/\s+/g, '_') + '.pdf');
        }
    }
};            // Globale Daten bereitstellen
            window.finspaBudget = ${JSON.stringify(data.budget || {})};
            window.finspaData = ${JSON.stringify(data)};
        </script>
    `;

let finalHtml = htmlContent;
    if (finalHtml.includes('</head>')) {
        // Füge die Scripts kurz vor dem schließenden </head> Tag ein
        finalHtml = finalHtml.replace('</head>', injectedScripts + '\n</head>');
    } else {
        // Fallback, falls das Modell mal das <head> Tag vergisst
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
                                {t('aiWidgetTitle')} <span className="opacity-50 lowercase ml-1">{t('aiWidgetVersion')}</span>
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
                    srcDoc={finalHtml} // <-- Nutze hier das modifizierte finalHtml
                    sandbox="allow-scripts allow-same-origin allow-downloads"
                    className="w-full bg-transparent"
                    style={{ minHeight: '450px', height: '100%', border: 'none' }} 
                    title="AI Generated Widget"
                />
            </div>
                </div>

                <details className="mt-4 text-sm text-gray-500 dark:text-slate-400 group/code">
                    <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors list-none flex items-center gap-2 font-medium bg-gray-50 dark:bg-slate-900/50 w-max px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-800">
                        <Icon name="Code" size={16} /> {t('aiViewCode')}
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
                        <Icon name="BookOpen" className="text-blue-500" /> {t('aiPromptLibrary')}
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
                                <Icon name="Settings" size={14} /> {t('aiAdvancedSettings')}
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
                                        <option value={4096} className="bg-white dark:bg-slate-900">{t('aiCtx4k')}</option>
                                        <option value={8192} className="bg-white dark:bg-slate-900">{t('aiCtx8k')}</option>
                                        <option value={16384} className="bg-white dark:bg-slate-900">{t('aiCtx16k')}</option>
                                        <option value={32768} className="bg-white dark:bg-slate-900">{t('aiCtx32k')}</option>
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
                            {t('aiCopilotTitle')} <span className="text-blue-600 dark:text-blue-400">Copilot</span>
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
                        <Icon name="PlusCircle" size={16} /> <span className="hidden sm:inline">{t('aiNewChat')}</span>
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
                                    <Icon name="Menu" size={16} /> {t('aiShowAllPrompts')}
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
                                    {t('aiIsTyping')}
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
                        placeholder={t('aiInputPlaceholder')}
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
                    {t('aiPrivacyDisclaimer') ? t('aiPrivacyDisclaimer').replace('{model}', selectedModel.split(':')[0].toUpperCase()) : `LOKALE KI (${selectedModel.split(':')[0].toUpperCase()}) • DATEN VERLASSEN DEIN GERÄT NICHT`}
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