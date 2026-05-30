const React = require('react');
const { useState } = React;
const Icon = require('../Icons.jsx');

const PdfScanner = ({ setModalObj, data, updateTreeData, selectedNode, setSelectedNode, fCur, t }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [error, setError] = useState('');
    
    // States für die bearbeitbaren Tabellenzeilen
    const [transactions, setTransactions] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    
    // Hole die verfügbaren Modelle aus den globalen Einstellungen oder nutze Fallbacks
    const availableModels = data?.settings?.aiModels && data.settings.aiModels.length > 0 
        ? data.settings.aiModels 
        : [
            { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder (14B)' },
            { id: 'llama3:latest', name: 'Llama 3 (8B)' }
        ];
          
    const [selectedModel, setSelectedModel] = useState(availableModels[0].id);

    // States für die seitenweise Verarbeitung
    const [extractedPages, setExtractedPages] = useState([]);
    const [processingStatus, setProcessingStatus] = useState('');

    // Kategorien aus den globalen Settings laden
    const activeBookingCategories = data?.settings?.bookingCategories || {
        'Einzahlung': ['Lohn', 'Dividenden', 'Zinsen', 'Verkauf', 'Mieteinnahmen', 'Umbuchung Eingang', 'Sonstiges'],
        'Auszahlung': ['Steuern', 'Gebühren', 'Lebensmittel', 'Telekommunikation', 'Versicherungen', 'Verkehr', 'Umbuchung Ausgang', 'Sonstiges']
    };
    const availableTypes = Object.keys(activeBookingCategories);

    const getBankAssets = (node) => {
        let assets = [];
        if (node.type === 'asset') assets.push(node);
        if (node.children) node.children.forEach(child => { assets = assets.concat(getBankAssets(child)); });
        return assets;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { setError('Bitte lade eine gültige PDF-Datei hoch.'); return; }

        setIsLoading(true); 
        setError(''); 
        setExtractedText(''); 
        setTransactions([]); 
        setExtractedPages([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
            
            // 1. Durchgang: Sammeln inkl. Styles und Seitenhöhe
            const allPagesData = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });
                const validItems = textContent.items.filter(item => item.str.trim().length > 0);
                
                allPagesData.push({ 
                    items: validItems, 
                    styles: textContent.styles,
                    pageHeight: viewport.height 
                });
            }

            // 2. Frequenzanalyse (Header/Footer filtern)
            const stringFrequency = {};
            if (pdf.numPages > 1) {
                allPagesData.forEach(pageData => {
                    const uniqueStringsOnPage = new Set(pageData.items.map(item => item.str.trim()));
                    uniqueStringsOnPage.forEach(str => {
                        stringFrequency[str] = (stringFrequency[str] || 0) + 1;
                    });
                });
            }

            const recurrenceThreshold = Math.ceil(pdf.numPages * 0.6);
            const recurringStrings = new Set(
                Object.entries(stringFrequency)
                    .filter(([str, count]) => count >= recurrenceThreshold && str.length > 3)
                    .map(([str]) => str)
            );

            // 3. Durchgang: Layout rekonstruieren inkl. Formatierung
            let fullText = '';
            let pagesArray = [];
            const lineTolerance = 4;

            allPagesData.forEach((pageData, index) => {
                const lines = []; 
                const styles = pageData.styles;
                const pageHeight = pageData.pageHeight;

                pageData.items.forEach(item => {
                    const str = item.str.trim();
                    const x = item.transform[4];
                    const y = item.transform[5];

                    // Nur extreme 5% Ränder als Header/Footer behandeln!
                    const isHeaderOrFooter = (y > pageHeight * 0.95) || (y < pageHeight * 0.05);
                    
                    if (recurringStrings.has(str) && isHeaderOrFooter) {
                        return; 
                    }

                    const fontInfo = styles[item.fontName];
                    const isBold = fontInfo && (
                        (fontInfo.fontFamily && fontInfo.fontFamily.toLowerCase().includes('bold')) ||
                        (fontInfo.name && fontInfo.name.toLowerCase().includes('bold'))
                    );

                    let formattedText = str;
                    if (isBold) {
                        formattedText = `**${str}**`;
                    }

                    let foundLine = lines.find(line => Math.abs(line.y - y) <= lineTolerance);

                    if (foundLine) {
                        foundLine.items.push({ x, text: formattedText });
                    } else {
                        lines.push({ y, items: [{ x, text: formattedText }] });
                    }
                });

                lines.sort((a, b) => b.y - a.y);

                let textLines = [];
                for (let i = 0; i < lines.length; i++) {
                    lines[i].items.sort((a, b) => a.x - b.x);
                    
                    // NEU: Räumliche Rekonstruktion (Layout-Mapping)
                    // Berechnet Leerzeichen basierend auf der physischen X-Koordinate
                    let lineText = "";
                    lines[i].items.forEach(item => {
                        // Ein typisches PDF-Zeichen ist ca. 4.5 Punkte breit. Wir übersetzen X in Leerzeichen.
                        const targetPos = Math.max(0, Math.floor(item.x / 4.5));
                        
                        if (targetPos > lineText.length) {
                            // Fülle mit Leerzeichen auf, bis die echte visuelle Spalten-Position erreicht ist
                            lineText += ' '.repeat(targetPos - lineText.length);
                        } else if (lineText.length > 0) {
                            // Mindestens 1 Leerzeichen Abstand, falls Wörter aneinander kleben
                            lineText += ' ';
                        }
                        lineText += item.text;
                    });

                    if (i > 0) {
                        const prevY = lines[i-1].y;
                        const currY = lines[i].y;
                        const gap = prevY - currY;
                        
                        if (gap > 12) {
                            // Längere Trennlinie für das nun breitere Layout
                            textLines.push('\n' + '-'.repeat(100) + '\n'); 
                        }
                    }
                    textLines.push(lineText);
                }

                const pageText = textLines.join('\n');
                pagesArray.push(pageText);
                fullText += `\n\n=== SEITE ${index + 1} ===\n\n` + pageText;
            });
            
            setExtractedPages(pagesArray);
            setExtractedText(fullText.trim());

        } catch (err) {
            console.error("PDF Parse Fehler:", err);
            setError('Fehler beim Auslesen des PDFs. Ist es evtl. ein reines Bild ohne Textebene?');
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeWithLLM = async () => {
        if (!extractedPages || extractedPages.length === 0) return;
        setIsLlmProcessing(true); 
        setError('');

        const categoriesString = Object.entries(activeBookingCategories)
            .map(([type, cats]) => `- ${type}: ${cats.join(', ')}`)
            .join('\n');

        const systemPrompt = `
You are an advanced financial data extraction AI.
The text layout has been spatially reconstructed. Columns are aligned using spaces, exactly like in the original visual PDF.
- Pay close attention to the vertical alignment of amounts under column headers (e.g. "Belastungen" vs "Gutschriften").
- "----------------------------------------------------------------------------------------------------" strictly separates distinct transaction blocks.

CRITICAL RULES:
1. IGNORE TOTALS & BALANCES: Ignore starting/ending balances (Saldo). In batch payments (like "Vergütung"), completely IGNORE the total sum block.
2. NO HALLUCINATIONS: NEVER use words like "Total", "**Total**", "Vergütung", or empty strings as a vendor name. 
3. ORPHAN RULE: If a block contains an amount but absolutely NO payee name, SKIP IT entirely. Do not invent a name. Do not copy a name from a previous block.
4. STRICT ALIGNMENT: A transaction amount MUST match the payee name located within the EXACT SAME "------" block.
5. FOREIGN CURRENCY: Keep only the final deducted amount in base currency (CHF).
6. CATEGORIZATION: You MUST categorize each transaction. Choose the most appropriate category from the following allowed lists based on the transaction type:
Allowed Categories:
${categoriesString}
If no specific category fits perfectly, use "Sonstiges". Do NOT invent new categories.

STEP-BY-STEP REASONING:
Briefly analyze the blocks line-by-line. Identify the payee and the amount within the same block, map amounts to their vertical column headers, and determine the best matching category from the allowed list.

FINAL OUTPUT:
After your reasoning, you MUST output the final JSON enclosed in markdown code blocks like this:
\`\`\`json
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 0.00,
      "vendor": "Cleaned Payee Name",
      "type": "Must be exactly 'Auszahlung' or 'Einzahlung'",
      "category": "Must be ONE EXACT MATCH from the Allowed Categories list"
    }
  ]
}
\`\`\`
`;

        let allTransactions = [];

        for (let i = 0; i < extractedPages.length; i++) {
            const pageText = extractedPages[i];
            if (pageText.trim().length < 50) continue; 

            const estimatedTokens = Math.ceil((systemPrompt.length + pageText.length) / 3) + 1200; 
            const optimizedNumCtx = Math.max(1024, Math.ceil(estimatedTokens / 256) * 256);

            setProcessingStatus(`Analysiere Seite ${i + 1} von ${extractedPages.length} (Kontext: ${optimizedNumCtx} Tokens)...`);

            try {
                const response = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: "Rechnungstext der aktuellen Seite:\n\n" + pageText }
                        ],
                        stream: false, 
                        options: { 
                            temperature: 0.1,
                            num_ctx: optimizedNumCtx 
                        } 
                    })
                });

                if (!response.ok) throw new Error(`API Fehler bei Seite ${i + 1}`);
                const responseData = await response.json();
                const rawContent = responseData.message.content;
                
                let jsonStr = "";
                const match = rawContent.match(/[\`]{3}(?:json)?\s*(\{[\s\S]*?\})\s*[\`]{3}/i);
                
                if (match) {
                    jsonStr = match[1];
                } else {
                    const start = rawContent.indexOf('{');
                    const end = rawContent.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        jsonStr = rawContent.substring(start, end + 1);
                    } else {
                        throw new Error("Kein valides JSON in der Antwort der KI gefunden.");
                    }
                }
                
                const jsonResult = JSON.parse(jsonStr);
                
                if (jsonResult.transactions && jsonResult.transactions.length > 0) {
                    allTransactions = [...allTransactions, ...jsonResult.transactions];
                    setTransactions(allTransactions);
                }
            } catch (err) {
                console.error(`Fehler bei Seite ${i + 1}:`, err);
                setError(`Fehler bei der KI-Analyse auf Seite ${i + 1}. Die restlichen Seiten wurden abgebrochen.`);
                break; 
            }
        }
        
        setProcessingStatus(''); 
        setIsLlmProcessing(false);
    };

    const handleTransactionChange = (index, field, value) => {
        const updatedTxs = [...transactions];
        updatedTxs[index][field] = value;
        if (field === 'type') updatedTxs[index].category = '';
        setTransactions(updatedTxs);
    };

    const saveBookingsToAsset = (txsToSave) => {
        if (!selectedAssetId) {
            alert('Bitte wähle zuerst oben das Zielkonto aus.');
            return false;
        }

        const generateId = () => Math.random().toString(36).substr(2, 9);
        const accountUpdates = {};
        accountUpdates[selectedAssetId] = [];

        const allAssets = [];
        (data.banks || []).forEach(b => allAssets.push(...getBankAssets(b)));
        const mainAssetName = allAssets.find(a => a.id === selectedAssetId)?.name || 'Zahlungskonto';

        txsToSave.forEach(tx => {
            let finalCategory = tx.category;
            if (tx.vendor && tx.vendor !== tx.category) {
                finalCategory = `${tx.category} (${tx.vendor})`;
            }

            if (tx.category === 'Dividenden' && tx.sourceAssetId) {
                const depotName = allAssets.find(a => a.id === tx.sourceAssetId)?.name || 'Depot';
                
                accountUpdates[selectedAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: tx.type || 'Einzahlung',
                    subCategory: `Dividende (von ${depotName})`,
                    amount: Number(tx.amount || 0),
                    bookingExchangeRate: 1
                });

                if (!accountUpdates[tx.sourceAssetId]) accountUpdates[tx.sourceAssetId] = [];
                accountUpdates[tx.sourceAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: 'Auszahlung',
                    subCategory: `Umbuchung Dividende an ${mainAssetName}`,
                    amount: Number(tx.amount || 0),
                    bookingExchangeRate: 1
                });
            } else {
                accountUpdates[selectedAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: tx.type || 'Auszahlung',
                    subCategory: finalCategory,
                    amount: Number(tx.amount || 0),
                    bookingExchangeRate: 1
                });
            }
        });
        
        const updateRecursive = (nodes) => nodes.map(n => {
            let copy = {...n};
            if (accountUpdates[copy.id]) {
                if (!copy.bookings) copy.bookings = [];
                copy.bookings = [...copy.bookings, ...accountUpdates[copy.id]];
            }
            if (copy.children) copy.children = updateRecursive(copy.children);
            return copy;
        });

        const newBanks = updateRecursive(data.banks);
        updateTreeData({ banks: newBanks });

        if (selectedNode && accountUpdates[selectedNode.id] && setSelectedNode) {
            const getUpdatedNode = (nodes) => {
                for(let i=0; i<nodes.length; i++) {
                    if(nodes[i].id === selectedNode.id) return nodes[i];
                    if(nodes[i].children) { let r = getUpdatedNode(nodes[i].children); if(r) return r; }
                }
            };
            setSelectedNode(getUpdatedNode(newBanks));
        }
        return true;
    };

    const applySingleTransaction = (index) => {
        const tx = transactions[index];
        if (tx.category === 'Dividenden' && !tx.sourceAssetId) {
            alert('Bitte wähle für die Dividende das Ursprungskonto (Depot) aus.');
            return;
        }

        const success = saveBookingsToAsset([tx]);
        if (success) {
            setTransactions(transactions.filter((_, i) => i !== index));
        }
    };

    const applyAllTransactions = () => {
        const missingSource = transactions.some(tx => tx.category === 'Dividenden' && !tx.sourceAssetId);
        if (missingSource) {
            alert('Bitte wähle für alle Dividenden das Ursprungskonto aus, bevor du fortfährst.');
            return;
        }

        const success = saveBookingsToAsset(transactions);
        if (success) {
            setTransactions([]); 
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6 transition-all duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-indigo-500/10 w-full max-w-7xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header mit modernem Gradient */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Icon name="Scan" size={20} />
                        </div>
                        <h3 className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">
                            {t ? t('pdfScannerTitle') : 'KI Beleg-Extraktion'}
                        </h3>
                    </div>
                    
                    {/* Modellauswahl als Select-Dropdown */}
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
                        <Icon name="Cpu" size={14} className="text-slate-400" />
                        <select 
                            value={selectedModel} 
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="text-xs bg-transparent border-none outline-none font-bold text-slate-600 dark:text-slate-300 w-40 cursor-pointer focus:ring-0"
                            title="KI-Modell auswählen"
                        >
                            {availableModels.map(model => (
                                <option 
                                    key={model.id} 
                                    value={model.id} 
                                    className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                >
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Body Area */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    
                    {/* Upload State */}
                    {!extractedText && !isLoading && (
                        <div className="h-full flex items-center justify-center min-h-[400px]">
                            <label className="group cursor-pointer flex flex-col items-center justify-center w-full max-w-2xl p-16 bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
                                <div className="w-20 h-20 mb-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/30 transition-all duration-500 ease-out">
                                    <Icon name="UploadCloud" size={36} className="text-indigo-600 dark:text-indigo-400 animate-bounce" />
                                </div>
                                <span className="font-extrabold text-slate-700 dark:text-slate-200 text-2xl mb-2 text-center">PDF hier ablegen</span>
                                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center">Klicken, um Rechnungen oder Auszüge auszuwählen</span>
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {/* Loading & Processing States */}
                    {(isLoading || isLlmProcessing) && (
                        <div className="h-full flex flex-col items-center justify-center min-h-[400px] space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center relative z-10 border border-slate-100 dark:border-slate-700">
                                    <Icon 
                                        name={isLoading ? "FileText" : "Sparkles"} 
                                        size={40} 
                                        className={`${isLoading ? 'text-blue-500 animate-pulse' : 'text-purple-500 animate-spin-slow'}`} 
                                    />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    {isLoading ? 'Lese PDF-Strukturen...' : 'KI analysiert Buchungen...'}
                                </h4>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                                    {processingStatus || 'Dies kann je nach Modell einen Moment dauern.'}
                                </p>
                            </div>
                            
                            {/* Animated Progress Bar Placeholder */}
                            <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/2 animate-progress-indeterminate rounded-full"></div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-5 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 rounded-r-xl shadow-sm flex items-start gap-3">
                            <Icon name="AlertCircle" className="text-red-500 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-800 dark:text-red-400">Verarbeitungsfehler</h4>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Results Area */}
                    {extractedText && !isLoading && !isLlmProcessing && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                            
                            {/* Linke Seite: Rohtext (Terminal Style) */}
                            <div className="lg:col-span-1 flex flex-col h-[65vh]">
                                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Icon name="Terminal" size={14} /> PDF Rohtext
                                </h4>
                                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none bg-slate-900">
                                    {/* Terminal Header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                        </div>
                                        <span className="text-[10px] font-mono font-medium text-slate-500">raw_data.txt</span>
                                    </div>
                                    {/* Terminal Content */}
                                    <div className="p-4 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-emerald-400/80 flex-1 custom-scrollbar">
                                        {extractedText}
                                    </div>
                                </div>
                            </div>

                            {/* Rechte Seite: Interaktive Tabelle */}
                            <div className="lg:col-span-3 flex flex-col h-[65vh]">
                                
                                {/* Action Bar */}
                                <div className="mb-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <Icon name="Target" size={18} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                Ziel-Konto auswählen
                                            </label>
                                            <select 
                                                className="text-sm py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/50 transition-shadow min-w-[250px]"
                                                value={selectedAssetId}
                                                onChange={e => setSelectedAssetId(e.target.value)}
                                            >
                                                <option value="">-- Bitte wählen --</option>
                                                {(data?.banks || []).map(bank => {
                                                    const bankAssets = getBankAssets(bank);
                                                    if (bankAssets.length === 0) return null;
                                                    return (
                                                        <optgroup key={bank.id} label={bank.name}>
                                                            {bankAssets.map(asset => (
                                                                <option key={asset.id} value={asset.id}>{asset.name} ({asset.currency})</option>
                                                            ))}
                                                        </optgroup>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {transactions.length > 0 && selectedAssetId && (
                                        <button 
                                            onClick={applyAllTransactions}
                                            className="group bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                        >
                                            <Icon name="Save" size={16} className="group-hover:scale-110 transition-transform" /> 
                                            Alle {transactions.length} übernehmen
                                        </button>
                                    )}
                                </div>
                                
                                {/* Table Area */}
                                {transactions.length === 0 ? (
                                    <div className="flex-1 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                                        <div className="w-20 h-20 mb-4 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center">
                                            <Icon name="CheckCircle" size={40} className="text-indigo-400"/>
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Alles erledigt!</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">Es gibt keine offenen Buchungen mehr auf diesen Seiten. Du kannst ein neues PDF hochladen oder die KI neu starten.</p>
                                        <button onClick={analyzeWithLLM} className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2">
                                            <Icon name="RefreshCw" size={16}/> Analyse wiederholen
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 border border-slate-200 dark:border-slate-700/60 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Datum</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Beschreibung</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Typ & Kategorie</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider text-right">Betrag</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider text-center w-24">Aktion</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {transactions.map((tx, idx) => {
                                                        const isDeposit = tx.type === 'Einzahlung';
                                                        const availableSubCats = activeBookingCategories[tx.type] || [];
                                                        
                                                        return (
                                                            <tr key={idx} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors duration-200">
                                                                <td className="px-5 py-4 align-top">
                                                                    <input 
                                                                        type="date" 
                                                                        className="bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-2.5 py-1.5 w-[120px] text-xs font-medium text-slate-600 dark:text-slate-300 outline-none transition-all"
                                                                        value={tx.date || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'date', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-4 align-top">
                                                                    <input 
                                                                        type="text" 
                                                                        className="bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-3 py-1.5 w-full text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-all placeholder:font-normal"
                                                                        value={tx.vendor || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'vendor', e.target.value)}
                                                                        placeholder="Händler / Beschreibung"
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-4 align-top">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex gap-2">
                                                                            <select 
                                                                                className={`bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-xs font-bold outline-none shadow-sm transition-all ${isDeposit ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20' : 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400 focus:ring-2 focus:ring-rose-500/20'}`}
                                                                                value={tx.type || ''}
                                                                                onChange={(e) => handleTransactionChange(idx, 'type', e.target.value)}
                                                                            >
                                                                                {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                            </select>
                                                                            
                                                                            <select 
                                                                                className="flex-1 bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none transition-all"
                                                                                value={tx.category || ''}
                                                                                onChange={(e) => handleTransactionChange(idx, 'category', e.target.value)}
                                                                            >
                                                                                <option value="">Kategorie wählen</option>
                                                                                {availableSubCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        
                                                                        {tx.category === 'Dividenden' && (
                                                                            <div className="relative">
                                                                                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                                    <Icon name="CornerDownRight" size={12} className="text-indigo-400" />
                                                                                </div>
                                                                                <select 
                                                                                    className="w-full pl-6 pr-2 py-1.5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                                                    value={tx.sourceAssetId || ''}
                                                                                    onChange={(e) => handleTransactionChange(idx, 'sourceAssetId', e.target.value)}
                                                                                >
                                                                                    <option value="">-- Ursprungs-Depot wählen --</option>
                                                                                    {(data?.banks || []).map(bank => {
                                                                                        const bankAssets = getBankAssets(bank).filter(a => a.id !== selectedAssetId);
                                                                                        if (bankAssets.length === 0) return null;
                                                                                        return (
                                                                                            <optgroup key={bank.id} label={bank.name}>
                                                                                                {bankAssets.map(asset => (
                                                                                                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                                                                                                ))}
                                                                                            </optgroup>
                                                                                        );
                                                                                    })}
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-right align-top">
                                                                    <div className="relative inline-block">
                                                                        <input 
                                                                            type="number" 
                                                                            step="any"
                                                                            className={`bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-3 py-1.5 w-[110px] text-right text-sm font-mono font-black outline-none transition-all ${isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}
                                                                            value={tx.amount || ''}
                                                                            onChange={(e) => handleTransactionChange(idx, 'amount', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-center align-top">
                                                                    <button 
                                                                        onClick={() => applySingleTransaction(idx)}
                                                                        className={`w-full flex justify-center items-center py-2 rounded-lg font-bold shadow-sm transition-all ${selectedAssetId ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500 dark:hover:text-white border border-indigo-200 dark:border-indigo-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed border'}`}
                                                                        title={!selectedAssetId ? 'Konto wählen' : 'Einzeln übernehmen'}
                                                                    >
                                                                        <Icon name="Plus" size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end shrink-0 rounded-b-3xl">
                    <button 
                        onClick={() => setModalObj(null)} 
                        className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Fertig / Schliessen
                    </button>
                </div>
            </div>
            
            {/* Custom CSS for Progress Bar Animation & Scrollbars */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .animate-progress-indeterminate {
                    animation: progress-indeterminate 1.5s infinite linear;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.3);
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.5);
                }
            `}} />
        </div>
    );
};

module.exports = PdfScanner;