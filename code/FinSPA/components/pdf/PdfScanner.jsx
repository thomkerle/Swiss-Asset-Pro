const React = require('react');
const { useState } = React;
const Icon = require('../Icons.jsx');

const PdfScanner = ({ setModalObj, data, updateTreeData, selectedNode, setSelectedNode, fCur, t }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [error, setError] = useState('');
    
    // States für den Privacy-Review-Schritt
    const [isReviewingText, setIsReviewingText] = useState(false);
    const [sanitizedPagesReview, setSanitizedPagesReview] = useState([]);
    const [activeDicts, setActiveDicts] = useState([]);
    
    // States für die bearbeitbaren Tabellenzeilen
    const [transactions, setTransactions] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    
    // Strikte Unterscheidung von Cloud-Modellen (um gpt-oss als lokales Modell zu erkennen)
    const isCloudModelFn = (id) => ['gpt-4o', 'gpt-4o-mini', 'gemini-3.5-flash', 'gemini-pro-latest', 'claude-3-5-sonnet-20240620'].includes(id);
    const isOpenAI = (id) => ['gpt-4o', 'gpt-4o-mini'].includes(id);
    const isGemini = (id) => ['gemini-3.5-flash', 'gemini-pro-latest'].includes(id);
    const isClaude = (id) => ['claude-3-5-sonnet-20240620'].includes(id);

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
            models.push({ id: 'gemini-3.5-flash', name: `Gemini 3.5 Flash ${tCloud}` });
            models.push({ id: 'gemini-pro-latest', name: `Gemini Pro Latest ${tCloud}` });
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
    const [selectedModel, setSelectedModel] = useState(availableModels[0].id);
    const [extractedPages, setExtractedPages] = useState([]);
    const [processingStatus, setProcessingStatus] = useState('');

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

    // ERWEITERTER SANITIZER: Anonymisiert das PDF tiefgreifender
    const sanitizePdfText = (rawText) => {
        let safeText = rawText;
        const dict = {};
        let counter = 1;

        // 1. IBANs filtern
        const ibanRegex = /[a-zA-Z]{2}[0-9]{2}\s?([0-9a-zA-Z]{4}\s?){4,5}[0-9a-zA-Z]{0,2}/gi;
        safeText = safeText.replace(ibanRegex, t ? t('placeholderIban') : '[IBAN_ANONYMISIERT]');

        // 2. E-Mail-Adressen filtern
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        safeText = safeText.replace(emailRegex, t ? t('placeholderEmail') : '[EMAIL_ANONYMISIERT]');

        // 3. Kreditkarten / Lange Kontonummern (13-16 Ziffern)
        const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
        safeText = safeText.replace(creditCardRegex, t ? t('placeholderCard') : '[KARTENNUMMER_ANONYMISIERT]');

        // 4. Typische Adressmuster (Strasse, Weg, Gasse, Matte + Hausnummer)
        const streetRegex = /\b[A-ZÄÖÜ][a-zA-ZäöüÄÖÜß]+(?:strasse|str\.|weg|gasse|platz|allee|matte)\s+\d+[a-zA-Z]?\b/gi;
        safeText = safeText.replace(streetRegex, t ? t('placeholderStreet') : '[STRASSE_ANONYMISIERT]');

        // 5. Postleitzahl + Ort (4- oder 5-stellige Ziffern gefolgt von einem Wort)
        const zipCityRegex = /\b[1-9]\d{3,4}\s+[A-ZÄÖÜ][a-zA-ZäöüÄÖÜß-]+\b/g;
        safeText = safeText.replace(zipCityRegex, t ? t('placeholderZip') : '[PLZ_ORT_ANONYMISIERT]');

        // 6. Postfach
        const postfachRegex = /\bPostfach(?:\s+\d+)?\b/gi;
        safeText = safeText.replace(postfachRegex, t ? t('placeholderPOBox') : '[POSTFACH_ANONYMISIERT]');

        // 7. Telefonnummern
        const phoneRegex = /(?:(?:\+|00)(?:41|49|43)|0\d{1,3})[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}\b/g;
        safeText = safeText.replace(phoneRegex, t ? t('placeholderPhone') : '[TELEFON_ANONYMISIERT]');

        // 8. Bekannte Daten aus dem State dynamisch ersetzen
        const userFields = [
            { val: data?.settings?.ownerName || data?.settings?.userName, placeholder: t ? t('placeholderUser') : '[BENUTZERNAME]' },
            { val: data?.settings?.address, placeholder: t ? t('placeholderStreet') : '[STRASSE_ANONYMISIERT]' },
            { val: data?.settings?.city, placeholder: t ? t('placeholderCity') : '[ORT_ANONYMISIERT]' },
            { val: data?.settings?.zip, placeholder: t ? t('placeholderZipOnly') : '[PLZ_ANONYMISIERT]' }
        ];

        userFields.forEach(field => {
            if (field.val && typeof field.val === 'string' && field.val.length > 2) {
                const escapedVal = field.val.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                safeText = safeText.replace(new RegExp(escapedVal, 'gi'), field.placeholder);
            }
        });

        // 9. Bank- und Kontonamen aus dem State dynamisch ersetzen
        const placeholderBankStr = t ? t('placeholderBank') : '[BANK_';
        const placeholderAccountStr = t ? t('placeholderAccount') : '[KONTO_';

        if (data && data.banks) {
            data.banks.forEach(bank => {
                if (bank.name && bank.name.length > 2) {
                    const placeholder = `${placeholderBankStr}${counter++}]`;
                    dict[placeholder] = bank.name;
                    const escapedName = bank.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                    safeText = safeText.replace(new RegExp(escapedName, 'gi'), placeholder);
                }
                const anonymizeNodes = (nodes) => {
                    nodes.forEach(node => {
                        if (node.name && node.name.length > 2) {
                            const placeholder = `${placeholderAccountStr}${counter++}]`;
                            dict[placeholder] = node.name;
                            const escapedName = node.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                            safeText = safeText.replace(new RegExp(escapedName, 'gi'), placeholder);
                        }
                        if (node.children) anonymizeNodes(node.children);
                    });
                };
                if (bank.children) anonymizeNodes(bank.children);
            });
        }
        
        return { safeText, dict };
    };

    const desanitizeText = (llmJsonString, dict) => {
        let restoredString = llmJsonString;
        Object.entries(dict).forEach(([placeholder, realName]) => {
            restoredString = restoredString.replace(new RegExp(placeholder.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g'), realName);
        });
        return restoredString;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { 
            setError(t ? t('pdfInvalid') : 'Bitte lade eine gültige PDF-Datei hoch.'); 
            return; 
        }

        setIsLoading(true); 
        setError(''); 
        setExtractedText(''); 
        setTransactions([]); 
        setExtractedPages([]);
        setIsReviewingText(false);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
            
            const allPagesData = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });
                const validItems = textContent.items.filter(item => item.str.trim().length > 0);
                
                allPagesData.push({ items: validItems, styles: textContent.styles, pageHeight: viewport.height });
            }

            const stringFrequency = {};
            if (pdf.numPages > 1) {
                allPagesData.forEach(pageData => {
                    const uniqueStringsOnPage = new Set(pageData.items.map(item => item.str.trim()));
                    uniqueStringsOnPage.forEach(str => { stringFrequency[str] = (stringFrequency[str] || 0) + 1; });
                });
            }

            const recurrenceThreshold = Math.ceil(pdf.numPages * 0.6);
            const recurringStrings = new Set(
                Object.entries(stringFrequency).filter(([str, count]) => count >= recurrenceThreshold && str.length > 3).map(([str]) => str)
            );

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

                    const isHeaderOrFooter = (y > pageHeight * 0.95) || (y < pageHeight * 0.05);
                    if (recurringStrings.has(str) && isHeaderOrFooter) return; 

                    const fontInfo = styles[item.fontName];
                    const isBold = fontInfo && ((fontInfo.fontFamily && fontInfo.fontFamily.toLowerCase().includes('bold')) || (fontInfo.name && fontInfo.name.toLowerCase().includes('bold')));

                    let formattedText = isBold ? `**${str}**` : str;
                    let foundLine = lines.find(line => Math.abs(line.y - y) <= lineTolerance);

                    if (foundLine) foundLine.items.push({ x, text: formattedText });
                    else lines.push({ y, items: [{ x, text: formattedText }] });
                });

                lines.sort((a, b) => b.y - a.y);

                let textLines = [];
                for (let i = 0; i < lines.length; i++) {
                    lines[i].items.sort((a, b) => a.x - b.x);
                    
                    let lineText = "";
                    lines[i].items.forEach(item => {
                        const targetPos = Math.max(0, Math.floor(item.x / 4.5));
                        if (targetPos > lineText.length) {
                            lineText += ' '.repeat(targetPos - lineText.length);
                        } else if (lineText.length > 0) {
                            lineText += ' ';
                        }
                        lineText += item.text;
                    });

                    if (i > 0 && (lines[i-1].y - lines[i].y) > 12) { textLines.push('\n' + '-'.repeat(100) + '\n'); }
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
            setError(t ? t('pdfParseError') : 'Fehler beim Auslesen des PDFs. Ist es evtl. ein reines Bild ohne Textebene?');
        } finally {
            setIsLoading(false);
        }
    };

    const prepareAnalysis = () => {
        if (!extractedPages || extractedPages.length === 0) return;
        
        const isCloudModel = isCloudModelFn(selectedModel);
        
        if (isCloudModel) {
            const preparedPages = [];
            const dicts = [];
            
            extractedPages.forEach(page => {
                const { safeText, dict } = sanitizePdfText(page);
                preparedPages.push(safeText);
                dicts.push(dict);
            });
            
            setSanitizedPagesReview(preparedPages);
            setActiveDicts(dicts);
            setIsReviewingText(true); 
        } else {
            executeLLMAnalysis(extractedPages, Array(extractedPages.length).fill({}));
        }
    };

    const executeLLMAnalysis = async (pagesToProcess, dictsForPages) => {
        setIsReviewingText(false);
        setIsLlmProcessing(true); 
        setError('');

        const isCloudModel = isCloudModelFn(selectedModel);
        const apiKeys = data?.settings?.aiApiKeys || {};

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

FINAL OUTPUT:
You MUST output the final JSON enclosed in markdown code blocks like this:
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

        for (let i = 0; i < pagesToProcess.length; i++) {
            const pageText = pagesToProcess[i];
            const dict = dictsForPages[i] || {};
            
            if (pageText.trim().length < 50) continue; 

            setProcessingStatus(`${t ? t('pdfStatusAnalyzePage') : 'Analysiere Seite'} ${i + 1} ${t ? t('pdfStatusOf') : 'von'} ${pagesToProcess.length} ${t ? t('pdfStatusWith') : 'mit'} ${selectedModel}...`);

            try {
                let rawContent = "";

                if (isOpenAI(selectedModel)) {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.openai}` },
                        body: JSON.stringify({
                            model: selectedModel,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: "Rechnungstext der aktuellen Seite:\n\n" + pageText }
                            ],
                            temperature: 0.1,
                            response_format: { type: "json_object" }
                        })
                    });
                    if (!response.ok) throw new Error(t ? t('pdfErrOpenAi') : "OpenAI API Fehler");
                    const resData = await response.json();
                    rawContent = resData.choices[0].message.content;

                } else if (isGemini(selectedModel)) {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKeys.gemini}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nRechnungstext:\n\n" + pageText }] }],
                            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                        })
                    });
                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(`Google API: ${errData.error?.message || response.statusText || 'Unbekannter Fehler'}`);
                    }
                    const resData = await response.json();
                    rawContent = resData.candidates[0].content.parts[0].text;

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
                            max_tokens: 2000,
                            temperature: 0.1,
                            system: systemPrompt,
                            messages: [{ role: "user", content: "Hier ist der Rechnungstext. Bitte extrahiere die Daten als JSON.\n\n" + pageText }]
                        })
                    });
                    if (!response.ok) throw new Error(t ? t('pdfErrAnthropic') : "Anthropic API Fehler (Möglicherweise blockiert durch CORS)");
                    const resData = await response.json();
                    rawContent = resData.content[0].text;

                } else {
                    // LOKALES MODELL FALLBACK (Ollama)
                    const estimatedTokens = Math.ceil((systemPrompt.length + pageText.length) / 3) + 1200; 
                    const optimizedNumCtx = Math.max(1024, Math.ceil(estimatedTokens / 256) * 256);
                    
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
                            options: { temperature: 0.1, num_ctx: optimizedNumCtx } 
                        })
                    });
                    if (!response.ok) throw new Error(t ? t('pdfErrOllama') : "Lokaler Ollama API Fehler");
                    const resData = await response.json();
                    rawContent = resData.message.content;
                }
                
                // DE-SANITIZER: Ersetze Platzhalter wieder durch die echten Namen
                if (isCloudModel) {
                    rawContent = desanitizeText(rawContent, dict);
                }

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
                        throw new Error(t ? t('pdfNoJson') : "Kein valides JSON in der Antwort der KI gefunden.");
                    }
                }
                
                const jsonResult = JSON.parse(jsonStr);
                
                if (jsonResult.transactions && jsonResult.transactions.length > 0) {
                    const mappedTxs = jsonResult.transactions.map(tx => ({...tx, isApplied: false}));
                    allTransactions = [...allTransactions, ...mappedTxs];
                    setTransactions(allTransactions);
                }
            } catch (err) {
                console.error(`Fehler bei Seite ${i + 1}:`, err);
                setError(`${t ? t('pdfErrModelPage') : 'Fehler bei Modell'} ${selectedModel} ${t ? t('pdfErrOnPage') : 'auf Seite'} ${i + 1}: ${err.message}`);
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
            alert(t ? t('pdfAlertSelectTarget') : 'Bitte wähle zuerst oben das Zielkonto aus.');
            return false;
        }

        const generateId = () => Math.random().toString(36).substr(2, 9);
        const accountUpdates = {};
        accountUpdates[selectedAssetId] = [];

        const allAssets = [];
        (data.banks || []).forEach(b => allAssets.push(...getBankAssets(b)));
        const mainAssetName = allAssets.find(a => a.id === selectedAssetId)?.name || 'Zahlungskonto';

        txsToSave.forEach(tx => {
            if (tx.category === 'Dividenden' && tx.sourceAssetId) {
                const depotName = allAssets.find(a => a.id === tx.sourceAssetId)?.name || 'Depot';
                
                accountUpdates[selectedAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: tx.type || 'Einzahlung',
                    subCategory: `Dividende (von ${depotName})`,
                    comment: tx.vendor || '',
                    amount: Number(tx.amount || 0),
                    bookingExchangeRate: 1
                });

                if (!accountUpdates[tx.sourceAssetId]) accountUpdates[tx.sourceAssetId] = [];
                accountUpdates[tx.sourceAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: 'Auszahlung',
                    subCategory: `Umbuchung Dividende an ${mainAssetName}`,
                    comment: tx.vendor || '',
                    amount: Number(tx.amount || 0),
                    bookingExchangeRate: 1
                });
            } else {
                accountUpdates[selectedAssetId].push({
                    id: generateId(),
                    date: tx.date || new Date().toISOString().split('T')[0],
                    type: tx.type || 'Auszahlung',
                    subCategory: tx.category || 'Sonstiges',
                    comment: tx.vendor || '',
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
        if (tx.isApplied) return;

        const success = saveBookingsToAsset([tx]);
        if (success) {
            const updatedTxs = [...transactions];
            updatedTxs[index].isApplied = true;
            setTransactions(updatedTxs);
        }
    };

    const applyAllTransactions = () => {
        const pendingTxs = transactions.filter(tx => !tx.isApplied);
        if (pendingTxs.length === 0) return;

        const success = saveBookingsToAsset(pendingTxs);
        if (success) {
            const updatedTxs = transactions.map(tx => ({...tx, isApplied: true}));
            setTransactions(updatedTxs);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6 transition-all duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-indigo-500/10 w-full max-w-7xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Icon name="Scan" size={20} />
                        </div>
                        <h3 className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">
                            {t ? t('pdfScannerTitle') : 'KI Beleg-Extraktion'}
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
                        <Icon name="Cpu" size={14} className="text-slate-400" />
                        <select 
                            value={selectedModel} 
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="text-xs bg-transparent border-none outline-none font-bold text-slate-600 dark:text-slate-300 w-48 cursor-pointer focus:ring-0"
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

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {/* 1. UPLOAD STATE */}
                    {!extractedText && !isLoading && !isReviewingText && (
                        <div className="h-full flex items-center justify-center min-h-[400px]">
                            <label className="group cursor-pointer flex flex-col items-center justify-center w-full max-w-2xl p-16 bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
                                <div className="w-20 h-20 mb-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/30 transition-all duration-500 ease-out">
                                    <Icon name="UploadCloud" size={36} className="text-indigo-600 dark:text-indigo-400 animate-bounce" />
                                </div>
                                <span className="font-extrabold text-slate-700 dark:text-slate-200 text-2xl mb-2 text-center">{t ? t('pdfUploadBox') : 'PDF hier ablegen'}</span>
                                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center">{t ? t('pdfUploadSub') : 'Klicken, um Rechnungen oder Auszüge auszuwählen'}</span>
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {/* 2. LOADING STATE */}
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
                                    {isLoading ? (t ? t('pdfLoading') : 'Lese PDF-Strukturen...') : (t ? t('pdfAiAnalyzing') : 'KI analysiert Buchungen...')}
                                </h4>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                                    {processingStatus || (t ? t('pdfWaitMsg') : 'Dies kann je nach Modell einen Moment dauern.')}
                                </p>
                            </div>
                            
                            <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/2 animate-progress-indeterminate rounded-full"></div>
                            </div>
                        </div>
                    )}

                    {/* ERROR STATE */}
                    {error && (
                        <div className="mb-6 p-5 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 rounded-r-xl shadow-sm flex items-start gap-3">
                            <Icon name="AlertCircle" className="text-red-500 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-800 dark:text-red-400">{t ? t('pdfErrorTitle') : 'Verarbeitungsfehler'}</h4>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* 3. PRIVACY REVIEW STATE (EDITIERBAR) */}
                    {isReviewingText && (
                        <div className="h-full flex flex-col max-w-4xl mx-auto">
                            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-2xl p-5 flex gap-4">
                                <div className="text-yellow-600 dark:text-yellow-500 mt-1"><Icon name="Shield" size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-yellow-800 dark:text-yellow-400 text-lg mb-1">
                                        {t ? t('pdfReviewTitle') : 'Privatsphäre-Prüfung vor Cloud-Versand'}
                                    </h4>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        {t ? t('pdfReviewDesc') : 'Du hast ein Cloud-Modell ausgewählt. Hier siehst du die anonymisierten Daten, die an die externe KI gesendet werden. IBANs, Banknamen und Adressen wurden durch Platzhalter ersetzt. Du kannst den Text in den Boxen manuell editieren, um weitere sensible Daten zu entfernen.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-slate-900 min-h-[300px]">
                                <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                                    <span className="text-[12px] font-mono font-medium text-slate-400 flex items-center gap-2">
                                        <Icon name="Edit" size={12} /> sanitized_payload.txt - Editierbar
                                    </span>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                                    {sanitizedPagesReview.map((pageText, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                                {t ? t('pdfPage') : 'Seite'} {idx + 1}
                                            </div>
                                            <textarea 
                                                value={pageText}
                                                onChange={(e) => {
                                                    const newPages = [...sanitizedPagesReview];
                                                    newPages[idx] = e.target.value;
                                                    setSanitizedPagesReview(newPages);
                                                }}
                                                className="w-full min-h-[250px] bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-[11px] leading-relaxed text-emerald-400/90 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y custom-scrollbar shadow-inner"
                                                spellCheck="false"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 shrink-0">
                                <button 
                                    onClick={() => {
                                        setIsReviewingText(false);
                                        setExtractedText('');
                                    }} 
                                    className="px-6 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    {t ? t('btnCancel') : 'Abbrechen'}
                                </button>
                                <button 
                                    onClick={() => executeLLMAnalysis(sanitizedPagesReview, activeDicts)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                                >
                                    <Icon name="Send" size={16} /> {t ? t('pdfBtnRelease') : 'Daten freigeben & analysieren'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 4. RESULT STATE */}
                    {extractedText && !isLoading && !isLlmProcessing && !isReviewingText && transactions.length === 0 && (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl max-w-lg">
                                <div className="w-20 h-20 mx-auto mb-6 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center">
                                    <Icon name="FileText" size={32} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">{t ? t('pdfReadSuccess') : 'PDF erfolgreich gelesen'}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                                    {t ? t('pdfReadPages_1') : 'Das Dokument hat '} {extractedPages.length} {t ? t('pdfReadPages_2') : ' Seiten. Die Strukturen wurden rekonstruiert. Klicke auf den Button, um die Daten '} 
                                    {isCloudModelFn(selectedModel)
                                        ? (t ? t('pdfCloudPrepare') : 'für den sicheren Cloud-Versand vorzubereiten') 
                                        : (t ? t('pdfLocalAnalyze') : 'mit der lokalen KI zu analysieren')}.
                                </p>
                                <button 
                                    onClick={prepareAnalysis} 
                                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex justify-center items-center gap-2"
                                >
                                    <Icon name="Sparkles" size={18} /> {t ? t('pdfBtnStart') : 'Analyse starten'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 5. FINISHED TRANSACTIONS STATE */}
                    {transactions.length > 0 && !isLoading && !isLlmProcessing && !isReviewingText && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                            {/* Raw Data Sidebar */}
                            <div className="lg:col-span-1 flex flex-col h-[65vh]">
                                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Icon name="Terminal" size={14} /> {t ? t('pdfRawText') : 'PDF Rohtext'}
                                </h4>
                                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none bg-slate-900">
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                        </div>
                                        <span className="text-[10px] font-mono font-medium text-slate-500">raw_data.txt</span>
                                    </div>
                                    <div className="p-4 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-emerald-400/80 flex-1 custom-scrollbar">
                                        {extractedText}
                                    </div>
                                </div>
                            </div>

                            {/* Table Area */}
                            <div className="lg:col-span-3 flex flex-col h-[65vh]">
                                <div className="mb-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <Icon name="Target" size={18} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                {t ? t('pdfTargetAccount') : 'Ziel-Konto auswählen'}
                                            </label>
                                            <select 
                                                className="text-sm py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/50 transition-shadow min-w-[250px]"
                                                value={selectedAssetId}
                                                onChange={e => setSelectedAssetId(e.target.value)}
                                            >
                                                <option value="">{t ? t('pdfSelectPrompt') : '-- Bitte wählen --'}</option>
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

                                    {transactions.filter(t => !t.isApplied).length > 0 && selectedAssetId && (
                                        <button 
                                            onClick={applyAllTransactions}
                                            className="group bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                        >
                                            <Icon name="Save" size={16} className="group-hover:scale-110 transition-transform" /> 
                                            {t ? t('pdfTakeoverAll') : 'Alle übernehmen'} ({transactions.filter(t => !t.isApplied).length})
                                        </button>
                                    )}
                                </div>
                                
                                {transactions.filter(t => !t.isApplied).length === 0 ? (
                                    <div className="flex-1 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                                        <div className="w-20 h-20 mb-4 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center">
                                            <Icon name="CheckCircle" size={40} className="text-indigo-400"/>
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{t ? t('pdfAllDone') : 'Alles erledigt!'}</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">{t ? t('pdfNoMoreBookings') : 'Es gibt keine offenen Buchungen mehr auf diesen Seiten. Du kannst ein neues PDF hochladen oder die KI neu starten.'}</p>
                                        <button onClick={() => { setTransactions([]); setExtractedText(''); }} className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2">
                                            <Icon name="RefreshCw" size={16}/> {t ? t('pdfRepeatAnalysis') : 'Neue Datei'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 border border-slate-200 dark:border-slate-700/60 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">{t ? t('pdfColDate') : 'Datum'}</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">{t ? t('pdfColDesc') : 'Beschreibung'}</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">{t ? t('pdfColTypeCat') : 'Typ & Kategorie'}</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider text-right">{t ? t('pdfColAmount') : 'Betrag'}</th>
                                                        <th className="px-5 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider text-center w-24">{t ? t('pdfColAction') : 'Aktion'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {transactions.map((tx, idx) => {
                                                        const isDeposit = tx.type === 'Einzahlung';
                                                        const availableSubCats = activeBookingCategories[tx.type] || [];
                                                        
                                                        return (
                                                            <tr key={idx} className={`group transition-colors duration-200 ${tx.isApplied ? 'bg-emerald-50/40 dark:bg-emerald-900/10 opacity-70 hidden' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'}`}>
                                                                <td className="px-5 py-4 align-top">
                                                                    <input 
                                                                        type="date" 
                                                                        disabled={tx.isApplied}
                                                                        className="bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-2.5 py-1.5 w-[120px] text-xs font-medium text-slate-600 dark:text-slate-300 outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                                                        value={tx.date || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'date', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-4 align-top">
                                                                    <input 
                                                                        type="text" 
                                                                        disabled={tx.isApplied}
                                                                        className="bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-3 py-1.5 w-full text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-all placeholder:font-normal disabled:opacity-70 disabled:cursor-not-allowed"
                                                                        value={tx.vendor || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'vendor', e.target.value)}
                                                                        placeholder={t ? t('pdfPlaceholderDesc') : 'Händler / Beschreibung'}
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-4 align-top">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex gap-2">
                                                                            <select 
                                                                                disabled={tx.isApplied}
                                                                                className={`bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-xs font-bold outline-none shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed ${isDeposit ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20' : 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400 focus:ring-2 focus:ring-rose-500/20'}`}
                                                                                value={tx.type || ''}
                                                                                onChange={(e) => handleTransactionChange(idx, 'type', e.target.value)}
                                                                            >
                                                                                {availableTypes.map(typeOpt => <option key={typeOpt} value={typeOpt}>{typeOpt}</option>)}
                                                                            </select>
                                                                            
                                                                            <select 
                                                                                disabled={tx.isApplied}
                                                                                className="flex-1 bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                                                                value={tx.category || ''}
                                                                                onChange={(e) => handleTransactionChange(idx, 'category', e.target.value)}
                                                                            >
                                                                                <option value="">{t ? t('pdfSelectCat') : 'Kategorie wählen'}</option>
                                                                                {availableSubCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        
                                                                        {tx.category === 'Dividenden' && (
                                                                            <div className="relative">
                                                                                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                                    <Icon name="CornerDownRight" size={12} className="text-indigo-400" />
                                                                                </div>
                                                                                <select 
                                                                                    disabled={tx.isApplied}
                                                                                    className="w-full pl-6 pr-2 py-1.5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                                                                    value={tx.sourceAssetId || ''}
                                                                                    onChange={(e) => handleTransactionChange(idx, 'sourceAssetId', e.target.value)}
                                                                                >
                                                                                    <option value="">{t ? t('pdfSelectSource') : '-- Ursprungs-Depot (Optional) --'}</option>
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
                                                                            disabled={tx.isApplied}
                                                                            className={`bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 rounded-lg px-3 py-1.5 w-[110px] text-right text-sm font-mono font-black outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed ${isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}
                                                                            value={tx.amount || ''}
                                                                            onChange={(e) => handleTransactionChange(idx, 'amount', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-center align-top">
                                                                    <button 
                                                                        onClick={() => applySingleTransaction(idx)}
                                                                        disabled={tx.isApplied}
                                                                        className={`w-full flex justify-center items-center py-2 rounded-lg font-bold shadow-sm transition-all ${
                                                                            tx.isApplied 
                                                                                ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800 cursor-default'
                                                                                : selectedAssetId 
                                                                                    ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500 dark:hover:text-white border border-indigo-200 dark:border-indigo-800' 
                                                                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed border'
                                                                        }`}
                                                                        title={tx.isApplied ? 'Bereits übernommen' : (!selectedAssetId ? (t ? t('pdfBtnSelectAccount') : 'Konto wählen') : (t ? t('pdfBtnTakeoverSingle') : 'Einzeln übernehmen'))}
                                                                    >
                                                                        {tx.isApplied ? <Icon name="Check" size={16} /> : <Icon name="Plus" size={16} />}
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

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end shrink-0 rounded-b-3xl">
                    <button 
                        onClick={() => setModalObj(null)} 
                        className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        {t ? t('pdfBtnDone') : 'Fertig / Schliessen'}
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .animate-progress-indeterminate {
                    animation: progress-indeterminate 1.5s infinite linear;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); }
            `}} />
        </div>
    );
};

module.exports = PdfScanner;