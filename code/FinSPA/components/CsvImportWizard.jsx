const React = require('react');
const { useState, useMemo } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('./Icons.jsx') || (({name}) => <span>[{name}]</span>);
const DataEngine = safeRequire('../data/DataEngine.jsx') || {};
const CsvEngine = safeRequire('./CsvEngine.jsx') || safeRequire('../components/CsvEngine.jsx') || {};
const { parseDate, parseNumber, normalizeType, processCsvImport } = CsvEngine;

const CsvImportWizard = ({ data, updateTreeData, setModalObj, showToast, t }) => {
    const [step, setStep] = useState(1);
    const [fileTypeLabel, setFileTypeLabel] = useState('CSV');
    
    // Gesamte geparste Rohdaten (nur für CSV)
    const [allRows, setAllRows] = useState([]);
    
    // Konfiguration des Grids (nur für CSV)
    const [config, setConfig] = useState({
        delimiter: ';',
        headerRow: 0,
        startRow: 1
    });
    const [colMapping, setColMapping] = useState({});

    // Finale Vorschau-Daten für alle Formate (CSV, CAMT, MT940)
    const [previewData, setPreviewData] = useState([]);
    const [importErrors, setImportErrors] = useState([]);

    // --- ZIEL-MODUS ---
    const [importMode, setImportMode] = useState('single_asset');

    const availableAssets = useMemo(() => {
        const list = [];
        const traverse = (nodes, bankName = '', catName = '') => {
            nodes.forEach(n => {
                if (n.type === 'bank') traverse(n.children || [], n.name, catName);
                else if (n.type === 'category') traverse(n.children || [], bankName, n.name);
                else if (n.type === 'asset') {
                    list.push({
                        id: n.id,
                        name: n.name,
                        path: `${bankName}${catName ? ' ➔ ' + catName : ''} ➔ ${n.name}`,
                        currency: n.currency || 'CHF'
                    });
                }
            });
        };
        traverse(data?.banks || []);
        return list;
    }, [data?.banks]);

    const availableCategories = useMemo(() => {
        const list = [];
        (data?.banks || []).forEach(bank => {
            (bank.children || []).forEach(cat => {
                if (cat.type === 'category') {
                    list.push({ id: `${bank.id}|${cat.id}`, path: `${bank.name} ➔ ${cat.name}` });
                }
            });
        });
        return list;
    }, [data?.banks]);

    const [selectedAssetId, setSelectedAssetId] = useState(availableAssets.length > 0 ? availableAssets[0].id : '');
    const [selectedCategoryId, setSelectedCategoryId] = useState(availableCategories.length > 0 ? availableCategories[0].id : 'new_import');

    const safeT = (key, fallback) => (t && t(key) ? t(key) : fallback);

    // --- PARSER FÜR STRUKTURIERTE FORMATE (CAMT & MT940) ---
    
    const parseCamt053 = (xmlText) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const entries = xmlDoc.getElementsByTagName("Ntry");
        const results = [];
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const amtNode = entry.getElementsByTagName("Amt")[0];
            const cdtDbtInd = entry.getElementsByTagName("CdtDbtInd")[0]?.textContent;
            
            const bookgDtNode = entry.getElementsByTagName("BookgDt")[0] || entry.getElementsByTagName("ValDt")[0];
            const dt = bookgDtNode ? bookgDtNode.getElementsByTagName("Dt")[0]?.textContent : null;
            const isDebit = cdtDbtInd === 'DBIT';

            // Absender / Empfänger ermitteln
            const cdtrNm = entry.getElementsByTagName("Cdtr")[0]?.getElementsByTagName("Nm")[0]?.textContent;
            const dbtrNm = entry.getElementsByTagName("Dbtr")[0]?.getElementsByTagName("Nm")[0]?.textContent;
            let counterParty = (isDebit ? cdtrNm : dbtrNm) || cdtrNm || dbtrNm || '';

            // Texte, Mitteilungen und Referenzen
            const ustrd = entry.getElementsByTagName("Ustrd")[0]?.textContent;
            const addtlTxInf = entry.getElementsByTagName("AddtlTxInf")[0]?.textContent;
            const addtlNtryInf = entry.getElementsByTagName("AddtlNtryInf")[0]?.textContent;
            const ref = entry.getElementsByTagName("Ref")[0]?.textContent;

            let textParts = [];
            if (ustrd) textParts.push(ustrd);
            if (ref) textParts.push(`Ref: ${ref}`);
            // Duplikate vermeiden (z.B. wenn AddtlTxInf und AddtlNtryInf beide "Vergütung" sind)
            if (addtlTxInf && !textParts.includes(addtlTxInf)) textParts.push(addtlTxInf);
            if (addtlNtryInf && !textParts.includes(addtlNtryInf)) textParts.push(addtlNtryInf);

            let assetParts = [];
            if (counterParty) assetParts.push(counterParty);
            if (textParts.length > 0) assetParts.push(textParts.join(', '));
            
            let assetStr = assetParts.join(' - ');
            if (!assetStr) assetStr = 'CAMT.053 Buchung';

            if (amtNode && dt) {
                 const amount = parseFloat(amtNode.textContent);
                 const currency = amtNode.getAttribute("Ccy") || 'CHF';
                 
                 results.push({
                     _originalIndex: i,
                     date: dt,
                     type: isDebit ? 'Auszahlung' : 'Einzahlung',
                     asset: assetStr.trim().substring(0, 150),
                     amount: amount,
                     currency: currency,
                     shares: '',
                     price: '',
                     rawType: isDebit ? 'Auszahlung' : 'Einzahlung',
                     selected: true
                 });
            }
        }
        return results;
    };

    const parseMT940 = (text) => {
        let mtCurrency = data?.settings?.baseCurrency || 'CHF';
        // Versuche Währung aus Eröffnungssaldo :60F: oder :60M: zu lesen
        const currMatch = text.match(/:6[02][FM]:[CD]\d{6}([A-Z]{3})/);
        if (currMatch) mtCurrency = currMatch[1];

        const lines = text.split(/\r?\n/);
        const results = [];
        let currentEntry = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith(':61:')) {
                // Vorherigen Eintrag speichern
                if (currentEntry) { results.push(currentEntry); currentEntry = null; }

                // Regex für MT940 Transaktion (z.B. :61:2308150815CD1000,00NTRF)
                const match = line.match(/^:61:(\d{6})(?:\d{4})?(C|D|RC|RD)([A-Z]{1})?([\d,.]+)/);
                if (match) {
                    const dateStr = match[1];
                    const typeInd = match[2];
                    const amountStr = match[4].replace(',', '.');

                    // YYMMDD -> YYYY-MM-DD (Geht davon aus, dass 20xx gemeint ist)
                    const year = parseInt(dateStr.substring(0, 2)) + 2000;
                    const month = dateStr.substring(2, 4);
                    const day = dateStr.substring(4, 6);

                    const isCredit = typeInd.includes('C');
                    currentEntry = {
                        _originalIndex: i,
                        date: `${year}-${month}-${day}`,
                        type: isCredit ? 'Einzahlung' : 'Auszahlung',
                        amount: parseFloat(amountStr),
                        currency: mtCurrency,
                        asset: '',
                        shares: '',
                        price: '',
                        rawType: isCredit ? 'Einzahlung' : 'Auszahlung',
                        selected: true
                    };
                }
            } else if (line.startsWith(':86:')) {
                if (currentEntry) currentEntry.asset += line.substring(4) + " ";
            } else if (line.startsWith(':')) {
                if (currentEntry) { results.push(currentEntry); currentEntry = null; }
            } else {
                if (currentEntry) currentEntry.asset += line + " ";
            }
        }
        if (currentEntry) results.push(currentEntry);

        // Aufräumen der Texte
        results.forEach(p => { p.asset = p.asset.trim().substring(0, 150) || 'MT940 Buchung'; });
        return results;
    };

    // --- STEP 1: UPLOAD & DISPATCHING ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            
            // Format-Erkennung
            const isXML = fileName.endsWith('.xml') || text.trim().startsWith('<?xml');
            const isMT940 = fileName.endsWith('.mt940') || fileName.endsWith('.sta') || fileName.endsWith('.txt') && (text.trim().startsWith('{1:') || text.includes(':20:'));
            
            if (isXML) {
                setFileTypeLabel('CAMT.053');
                const parsedCamt = parseCamt053(text);
                if (parsedCamt.length === 0) setImportErrors([safeT('errCamtNoEntries', "Konnte keine gültigen Buchungen (Ntry) in der CAMT-Datei finden.")]);
                setPreviewData(parsedCamt);
                setStep(3); // Mapping überspringen!
                return;
            } 
            
            if (isMT940) {
                setFileTypeLabel('MT940');
                const parsedMt = parseMT940(text);
                if (parsedMt.length === 0) setImportErrors([safeT('errMt940NoEntries', "Konnte keine gültigen Buchungen (:61:) in der MT940-Datei finden.")]);
                setPreviewData(parsedMt);
                setStep(3); // Mapping überspringen!
                return;
            }

            // --- STANDARD CSV LOGIK ---
            setFileTypeLabel('CSV');
            const parseLineRobust = (line, delim) => {
                let res = []; let cur = ''; let inQ = false;
                for(let i = 0; i < line.length; i++) {
                    let c = line[i];
                    if(inQ) {
                        if(c === '"' && line[i+1] === '"') { cur += '"'; i++; }
                        else if(c === '"') inQ = false;
                        else cur += c;
                    } else {
                        if(c === '"') inQ = true;
                        else if(c === delim) { res.push(cur.trim()); cur = ''; }
                        else cur += c;
                    }
                }
                res.push(cur.trim());
                return res;
            };

            const firstLine = text.split('\n')[0] || '';
            const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
            
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                if (showToast) showToast(safeT('errCsvEmpty', 'Datei ist leer oder hat kein gültiges Format.'), 'error');
                return;
            }

            const parsedRows = lines.map(line => parseLineRobust(line, delimiter));
            
            let guessHeaderIdx = 0;
            for(let i = 0; i < Math.min(parsedRows.length, 20); i++) {
                const rowStr = parsedRows[i].join(' ').toLowerCase();
                if(rowStr.includes('datum') && (rowStr.includes('betrag') || rowStr.includes('gutschrift') || rowStr.includes('typ') || rowStr.includes('änderung'))) {
                    guessHeaderIdx = i;
                    break;
                }
            }

            const guessMap = {};
            if (parsedRows[guessHeaderIdx]) {
                parsedRows[guessHeaderIdx].forEach((headerRaw, idx) => {
                    const header = headerRaw.toLowerCase().trim();
                    if (header.includes('datum') || header.includes('date') || header.includes('valuta')) guessMap[idx] = 'date';
                    else if (header.includes('typ') || header.includes('aktion') || header.includes('transaktionsart') || header === 'beschreibung') guessMap[idx] = 'type';
                    else if (header.includes('produkt') || header.includes('asset') || header.includes('name') || header.includes('isin') || header.includes('avisierungstext')) guessMap[idx] = 'asset';
                    // Auto-Erkennung für kombinierte Betragsspalte (Betrag, Wert, Total, Bewegung)
                    else if (header === 'wert' || header.includes('betrag') || header.includes('total') || header.includes('umsatz') || header.includes('bewegung')) guessMap[idx] = 'amount'; 
                    else if (header === 'gutschrift' || header.includes('eingang')) guessMap[idx] = 'amountIn';
                    else if (header === '' && idx > 0 && parsedRows[guessHeaderIdx][idx-1].toLowerCase().trim() === 'änderung') guessMap[idx] = 'amountIn'; 
                    else if (header.includes('lastschrift') || header.includes('belastung') || header.includes('ausgang')) guessMap[idx] = 'amountOut';
                    else if (header.includes('währung') || header.includes('currency') || header === 'whg' || header === 'änderung') guessMap[idx] = 'currency';
                    else if (header.includes('menge') || header.includes('stück') || header.includes('anzahl')) guessMap[idx] = 'shares';
                    else if (header === 'kurs' || header.includes('price')) guessMap[idx] = 'price';
                });
            }

            setAllRows(parsedRows);
            setConfig({ delimiter, headerRow: guessHeaderIdx, startRow: guessHeaderIdx + 1 });
            setColMapping(guessMap);
            setStep(2);
        };
        reader.readAsText(file, 'UTF-8');
    };

    // --- STEP 2: MAPPING (NUR FÜR CSV) ---
    const generatePreview = () => {
        const preview = [];
        const errors = [];
        const dataRows = allRows.slice(config.startRow);

        const getMappedFields = (row) => {
            // "amount" hinzugefügt für das kombinierte Feld
            let map = { date: '', type: '', asset: '', amount: '', amountIn: '', amountOut: '', currency: '', shares: '', price: '' };
            row.forEach((cell, idx) => {
                const targetField = colMapping[idx];
                if (targetField) map[targetField] = cell;
            });
            return map;
        };

        dataRows.forEach((row, relativeIdx) => {
            if (row.length === 0 || (row.length === 1 && row[0] === '')) return;

            const fields = getMappedFields(row);
            const actualRowIndex = config.startRow + relativeIdx + 1;
            const parsedDate = parseDate ? parseDate(fields.date) : fields.date;

            let finalAmount = 0;
            // Zuerst prüfen, ob das kombinierte 'amount' Feld genutzt wird
            if (fields.amount && String(fields.amount).trim() !== '') {
                finalAmount = parseNumber ? parseNumber(fields.amount) : Number(fields.amount);
            } 
            // Fallback auf getrennte Spalten
            else if (fields.amountIn && String(fields.amountIn).trim() !== '') {
                finalAmount = parseNumber ? parseNumber(fields.amountIn) : Number(fields.amountIn);
            } else if (fields.amountOut && String(fields.amountOut).trim() !== '') {
                finalAmount = -(parseNumber ? Math.abs(parseNumber(fields.amountOut)) : Math.abs(Number(fields.amountOut)));
            }

            let entryType = normalizeType ? normalizeType(fields.type) : 'Einzahlung';
            
            // Logik für korrekten Typ anhand des Vorzeichens, wenn kein spezieller Typ (wie Kauf/Verkauf) gefunden wurde
            if ((entryType === 'Einzahlung' || !fields.type || String(fields.type).toLowerCase().includes('buchung')) && finalAmount < 0) {
                entryType = 'Auszahlung';
            }

            if (!parsedDate || isNaN(new Date(parsedDate).getTime())) {
                errors.push(`Zeile ${actualRowIndex}: Ungültiges Datum (${fields.date || 'Leer'})`);
                return;
            }

            let parsedShares = parseNumber ? parseNumber(fields.shares) : Number(fields.shares);
            let parsedPrice = parseNumber ? parseNumber(fields.price) : Number(fields.price);
            
            if (!parsedShares || !parsedPrice) {
                const textMatch = (fields.type || '').match(/(?:Kauf|Verkauf)\s+([\d.]+)\s+zu je\s+([\d.]+)/i);
                if (textMatch) {
                    parsedShares = parseFloat(textMatch[1]);
                    parsedPrice = parseFloat(textMatch[2]);
                }
            }

            preview.push({
                _originalIndex: actualRowIndex,
                date: parsedDate,
                type: entryType,
                asset: fields.asset ? fields.asset.replace(/^"|"$/g, '').trim() : 'Buchung / Text',
                amount: Math.abs(finalAmount), // Betrag als positiven Wert speichern, das Vorzeichen steckt im `type`
                currency: fields.currency || data?.settings?.baseCurrency || 'CHF',
                shares: parsedShares,
                price: parsedPrice,
                rawType: fields.type,
                selected: true
            });
        });

        setPreviewData(preview);
        setImportErrors(errors);
        setStep(3);
    };

    // --- STEP 3 INTERAKTIONEN ---
    
    const handleRowEdit = (index, field, value) => {
        setPreviewData(prevData => {
            const newData = [...prevData];
            newData[index] = { ...newData[index], [field]: value };
            return newData;
        });
    };

    const handleRowDelete = (index) => {
        setPreviewData(prevData => prevData.filter((_, i) => i !== index));
    };

    const toggleAllRows = (e) => {
        const isChecked = e.target.checked;
        setPreviewData(prevData => prevData.map(row => ({ ...row, selected: isChecked })));
    };

    const processImport = () => {
        if (!processCsvImport) {
            if (showToast) showToast('Import-Engine nicht gefunden.', 'error'); return;
        }

        const targetId = importMode === 'single_asset' ? selectedAssetId : selectedCategoryId;
        
        // Filtert alle abgewählten Einträge heraus
        const mappedData = previewData
            .filter(item => item.selected !== false)
            .map(item => ({
                ...item,
                asset: item.asset 
            }));

        if (mappedData.length === 0) {
            if (showToast) showToast(safeT('warnNoEntriesSelected', 'Es wurden keine Einträge zum Importieren ausgewählt.'), 'warning');
            return;
        }

        try {
            const result = processCsvImport(mappedData, data, DataEngine, { importMode, targetId });
            updateTreeData({ banks: result.updatedBanks });
            if (showToast) showToast(`${result.importedCount} ${safeT('msgImportSuccess', 'Buchungen erfolgreich importiert.')}`, 'success');
            setModalObj(null);
        } catch (err) {
            if (showToast) showToast(err.message, 'error');
        }
    };

    const maxCols = allRows.length > 0 ? Math.max(...allRows.map(r => r.length)) : 0;
    const selectedCount = previewData.filter(r => r.selected !== false).length;

    // Weiter-Button nur aktivieren, wenn mindestens eine Art von Betrags-Feld zugeordnet ist
    const isAmountMapped = Object.values(colMapping).includes('amount') || 
                           Object.values(colMapping).includes('amountIn') || 
                           Object.values(colMapping).includes('amountOut');

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700 overflow-hidden">
                
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400"><Icon name="List" size={20} /></div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">{safeT('wizBankImportTitle', 'Bankdaten Import')} <span className="text-xs ml-2 bg-blue-600 text-white px-2 py-0.5 rounded-full">{fileTypeLabel}</span></h3>
                            <div className="text-xs text-gray-500 font-medium">
                                {fileTypeLabel === 'CSV' ? `Schritt ${step} von 3` : (step === 3 ? safeT('wizStepAutoExtracted', 'Automatisch extrahiert') : safeT('wizStepReady', 'Bereit'))}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white"><Icon name="X" size={24} /></button>
                </div>

                <div className="flex-1 overflow-auto p-0 finspa-scrollbar bg-gray-50 dark:bg-slate-950">
                    {step === 1 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 px-6">
                            <Icon name="UploadCloud" size={48} className="text-blue-500 mb-2" />
                            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{safeT('wizSelectFile', 'Datei auswählen')}</h4>
                            <p className="text-sm text-gray-500 max-w-md">{safeT('wizSelectFileDesc', 'Lade einen Kontoauszug hoch. Unterstützt werden generische CSV Dateien sowie Bankstandards wie CAMT.053 (XML) und MT940 (.sta/.txt).')}</p>
                            
                            <div className="flex gap-2 mt-2">
                                <span className="bg-gray-200 dark:bg-slate-800 text-xs px-2 py-1 rounded text-gray-600 dark:text-gray-400 font-mono">.csv</span>
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-xs px-2 py-1 rounded text-blue-700 dark:text-blue-400 font-mono border border-blue-200 dark:border-blue-800">.xml (CAMT)</span>
                                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-xs px-2 py-1 rounded text-emerald-700 dark:text-emerald-400 font-mono border border-emerald-200 dark:border-emerald-800">.sta / .mt940</span>
                            </div>

                            <label className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shadow-md transition-all">
                                <span className="flex items-center gap-2"><Icon name="File" size={18}/> {safeT('wizBtnSelectFile', 'Datei wählen')}</span>
                                <input type="file" accept=".csv,.xml,.txt,.mt940,.sta" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {step === 2 && fileTypeLabel === 'CSV' && (
                        <div className="h-full flex flex-col">
                            {/* Toolbar Oben */}
                            <div className="p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex flex-wrap gap-4 items-end shrink-0">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{safeT('wizHeaderRow', 'Zeile der Überschriften')}</label>
                                    <input type="number" min="1" max={allRows.length} value={config.headerRow + 1} onChange={(e) => setConfig({...config, headerRow: Math.max(0, parseInt(e.target.value) - 1)})} className="w-24 p-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded outline-none text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{safeT('wizDataRow', 'Erste Zeile mit Daten')}</label>
                                    <input type="number" min="1" max={allRows.length} value={config.startRow + 1} onChange={(e) => setConfig({...config, startRow: Math.max(0, parseInt(e.target.value) - 1)})} className="w-24 p-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded outline-none text-sm font-bold text-blue-600" />
                                </div>
                                
                                <div className="ml-auto text-xs text-gray-500 max-w-xs leading-tight">
                                    <Icon name="Info" size={12} className="inline mr-1 text-blue-500"/>
                                    {safeT('wizColMappingDesc', 'Wähle für jede Spalte, die du importieren möchtest, das passende FinBundle Feld in der Kopfzeile aus.')}
                                </div>
                            </div>

                            {/* Generisches Daten-Grid - JETZT MIT HORIZONTALEM SCROLL */}
                            <div className="flex-1 overflow-auto p-4 finspa-scrollbar">
                                <div className="w-max min-w-full border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-gray-100 dark:bg-slate-800">
                                            <tr>
                                                <th className="p-2 border-r border-gray-200 dark:border-slate-700 bg-gray-200 dark:bg-slate-900 w-12 text-center text-xs text-gray-500 sticky left-0 z-10 shadow-[1px_0_0_rgba(0,0,0,0.1)]">{safeT('wizColRow', 'Zeile')}</th>
                                                {Array.from({ length: maxCols }).map((_, colIdx) => (
                                                    <th key={colIdx} className="p-2 border-r border-gray-200 dark:border-slate-700 min-w-[160px] max-w-[200px]">
                                                        <select
                                                            value={colMapping[colIdx] || ''}
                                                            onChange={(e) => setColMapping({...colMapping, [colIdx]: e.target.value})}
                                                            className={`w-full p-1.5 text-xs bg-white dark:bg-slate-900 border rounded cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 ${colMapping[colIdx] ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold' : 'border-gray-300 dark:border-slate-600 text-gray-500'}`}
                                                        >
                                                            <option value="">{safeT('wizOptIgnore', '-- Ignorieren --')}</option>
                                                            <option value="date">{safeT('wizOptDate', '📅 Datum (Pflicht)')}</option>
                                                            <option value="type">{safeT('wizOptType', '⚙️ Typ (Kauf, Zins...)')}</option>
                                                            <option value="asset">{safeT('wizOptAsset', '🏷️ Asset / Buchungstext')}</option>
                                                            <option value="amount">{safeT('wizOptAmount', '💰 Betrag / Bewegung (+/-)')}</option>
                                                            <option value="amountIn">{safeT('wizOptAmountIn', '➕ Nur Gutschrift')}</option>
                                                            <option value="amountOut">{safeT('wizOptAmountOut', '➖ Nur Belastung')}</option>
                                                            <option value="currency">{safeT('wizOptCurrency', '🌍 Währung')}</option>
                                                            <option value="shares">{safeT('wizOptShares', '📚 Stückzahl')}</option>
                                                            <option value="price">{safeT('wizOptPrice', '📈 Ausführungskurs')}</option>
                                                        </select>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700 font-mono text-xs">
                                            {allRows.slice(0, Math.max(config.startRow + 15, 20)).map((row, rowIdx) => {
                                                const isHeader = rowIdx === config.headerRow;
                                                const isData = rowIdx >= config.startRow;
                                                const isSkipped = !isHeader && !isData;
                                                
                                                return (
                                                    <tr key={rowIdx} className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${isHeader ? 'bg-yellow-50 dark:bg-yellow-900/20 font-bold shadow-sm' : isSkipped ? 'opacity-40 bg-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'}`}>
                                                        <td className="p-2 border-r border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800/80 text-center text-gray-400 sticky left-0 z-10">
                                                            {rowIdx + 1}
                                                        </td>
                                                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                                                            <td key={colIdx} className={`p-2 border-r border-gray-200 dark:border-slate-700 truncate max-w-[200px] ${colMapping[colIdx] && isData ? 'text-blue-900 dark:text-blue-200 font-medium' : 'text-slate-600 dark:text-slate-400'}`} title={row[colIdx]}>
                                                                {row[colIdx] || ''}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {allRows.length > (config.startRow + 15) && (
                                    <div className="mt-3 text-center text-xs text-gray-400">
                                        {safeT('wizMoreRowsHidden', '... weitere Zeilen verbergen.').replace('...', '... ' + (allRows.length - (config.startRow + 15)))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-6 space-y-6 flex flex-col h-full">
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4 shrink-0">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Icon name="FolderOpen" size={16} className="text-yellow-500" /> {safeT('wizWhereToImport', 'Wohin sollen die Daten importiert werden?')}
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${importMode === 'category' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'}`}>
                                        <input type="radio" name="importMode" value="category" checked={importMode === 'category'} onChange={() => setImportMode('category')} className="mt-1 text-blue-600" />
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-white">{safeT('wizModeBroker', 'Broker / Depot (Multi-Asset)')}</div>
                                            <div className="text-xs text-gray-500">{safeT('wizModeBrokerDesc', 'Erstellt für jedes Produkt/Aktie eigene Anlageklassen.')}</div>
                                        </div>
                                    </label>

                                    <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${importMode === 'single_asset' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'}`}>
                                        <input type="radio" name="importMode" value="single_asset" checked={importMode === 'single_asset'} onChange={() => setImportMode('single_asset')} className="mt-1 text-blue-600" />
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-white">{safeT('wizModeAccount', 'Kontoauszug (Einzel-Konto)')}</div>
                                            <div className="text-xs text-gray-500">{safeT('wizModeAccountDesc', 'Fügt alle Buchungen direkt in ein bestehendes Konto (Asset) ein.')}</div>
                                        </div>
                                    </label>
                                </div>

                                {importMode === 'single_asset' ? (
                                    <div className="pt-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">{safeT('wizTargetAccount', 'Ziel-Konto wählen:')}</label>
                                        <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium outline-none">
                                            {availableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.path} ({asset.currency})</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="pt-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">{safeT('wizTargetCategory', 'Ziel-Kategorie wählen:')}</label>
                                        <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium outline-none">
                                            <option value="new_import">{safeT('wizNewImportFolder', '➕ Als neuen Import Ordner anlegen')}</option>
                                            {availableCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.path}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {importErrors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-200 dark:border-red-800 shrink-0">
                                    <h4 className="font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                                        <Icon name="AlertTriangle" size={16}/> {importErrors.length} {safeT('wizWarnings', 'Warnungen')}
                                    </h4>
                                    <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-5 space-y-1">
                                        {importErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                                        {importErrors.length > 5 && <li>{safeT('wizMoreIgnored', '...und weitere ignoriert.')}</li>}
                                    </ul>
                                </div>
                            )}

                            {/* Die editierbare Tabelle für alle Einträge */}
                            <div className="border border-gray-200 dark:border-slate-700 rounded-xl flex-1 overflow-hidden flex flex-col min-h-[300px]">
                                <div className="bg-gray-100 dark:bg-slate-800 p-3 border-b border-gray-200 dark:border-slate-700 shrink-0 flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        {safeT('wizEditPreview', 'Import-Vorschau bearbeiten')} ({previewData.length} Einträge aus {fileTypeLabel})
                                    </span>
                                </div>
                                <div className="overflow-auto finspa-scrollbar flex-1 relative">
                                    <table className="w-full text-left text-sm min-w-max">
                                        <thead className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-3 border-r dark:border-slate-700 w-12 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={previewData.length > 0 && previewData.every(r => r.selected !== false)}
                                                        onChange={toggleAllRows}
                                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                        title={safeT('wizTitleSelectAll', 'Alle auswählen/abwählen')}
                                                    />
                                                </th>
                                                <th className="p-3 border-r dark:border-slate-700 w-32">{safeT('wizColDate', 'Datum')}</th>
                                                <th className="p-3 border-r dark:border-slate-700 w-40">{safeT('wizColType', 'Typ')}</th>
                                                <th className="p-3 border-r dark:border-slate-700 min-w-[200px]">{safeT('wizColAssetText', 'Asset / Text')}</th>
                                                <th className="p-3 text-right border-r dark:border-slate-700 w-24">{safeT('wizColShares', 'Menge')}</th>
                                                <th className="p-3 text-right border-r dark:border-slate-700 w-24">{safeT('wizColPrice', 'Kurs')}</th>
                                                <th className="p-3 text-right border-r dark:border-slate-700 w-32">{safeT('wizColAmount', 'Betrag')}</th>
                                                <th className="p-3 text-center w-12">{safeT('wizColAction', 'Aktion')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                            {previewData.map((row, i) => (
                                                <tr key={i} className={`group transition-all ${row.selected === false ? 'opacity-50 grayscale bg-gray-50 dark:bg-slate-800/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                                                    <td className="p-1.5 border-r dark:border-slate-700 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={row.selected !== false}
                                                            onChange={(e) => handleRowEdit(i, 'selected', e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-1.5 border-r dark:border-slate-700">
                                                        <input 
                                                            type="date" 
                                                            value={row.date || ''} 
                                                            onChange={(e) => handleRowEdit(i, 'date', e.target.value)} 
                                                            className="w-full p-2 bg-transparent outline-none dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all" 
                                                            disabled={row.selected === false}
                                                        />
                                                    </td>
                                                    <td className="p-1.5 border-r dark:border-slate-700">
                                                        <select 
                                                            value={row.type || 'Einzahlung'} 
                                                            onChange={(e) => handleRowEdit(i, 'type', e.target.value)} 
                                                            className="w-full p-2 bg-transparent outline-none dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                                                            disabled={row.selected === false}
                                                        >
                                                            <option value="Einzahlung">Einzahlung</option>
                                                            <option value="Auszahlung">Auszahlung</option>
                                                            <option value="Kauf">Kauf</option>
                                                            <option value="Verkauf">Verkauf</option>
                                                            <option value="Dividende">Dividende</option>
                                                            <option value="Zinszahlung">Zinszahlung</option>
                                                            <option value="Gebühr">Gebühr</option>
                                                            <option value="Wertanpassung">Wertanpassung</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-1.5 border-r dark:border-slate-700">
                                                        <input 
                                                            type="text" 
                                                            value={row.asset || ''} 
                                                            onChange={(e) => handleRowEdit(i, 'asset', e.target.value)} 
                                                            className="w-full p-2 bg-transparent outline-none dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all" 
                                                            placeholder={safeT('wizPlaceholderCategory', 'Kategorie oder Text')} 
                                                            disabled={row.selected === false}
                                                        />
                                                    </td>
                                                    <td className="p-1.5 text-right border-r dark:border-slate-700">
                                                        <input 
                                                            type="number" 
                                                            step="any" 
                                                            value={row.shares !== undefined ? row.shares : ''} 
                                                            onChange={(e) => handleRowEdit(i, 'shares', e.target.value)} 
                                                            className="w-full p-2 text-right bg-transparent outline-none dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-gray-400" 
                                                            placeholder="-" 
                                                            disabled={row.selected === false}
                                                        />
                                                    </td>
                                                    <td className="p-1.5 text-right border-r dark:border-slate-700">
                                                        <input 
                                                            type="number" 
                                                            step="any" 
                                                            value={row.price !== undefined ? row.price : ''} 
                                                            onChange={(e) => handleRowEdit(i, 'price', e.target.value)} 
                                                            className="w-full p-2 text-right bg-transparent outline-none dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-gray-400" 
                                                            placeholder="-" 
                                                            disabled={row.selected === false}
                                                        />
                                                    </td>
                                                    <td className="p-1.5 text-right border-r dark:border-slate-700">
                                                        <input 
                                                            type="number" 
                                                            step="any" 
                                                            value={row.amount !== undefined ? row.amount : ''} 
                                                            onChange={(e) => handleRowEdit(i, 'amount', e.target.value)} 
                                                            className="w-full p-2 text-right bg-transparent outline-none font-bold dark:text-white rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all" 
                                                            disabled={row.selected === false}
                                                        />
                                                    </td>
                                                    <td className="p-1.5 text-center align-middle">
                                                        <button 
                                                            onClick={() => handleRowDelete(i)} 
                                                            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-50 group-hover:opacity-100 transition-all bg-gray-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" 
                                                            title={safeT('wizTitleDeleteEntry', 'Eintrag komplett löschen')}
                                                        >
                                                            <Icon name="Trash" size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button onClick={() => setModalObj(null)} className="px-4 py-2 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">{safeT('wizBtnCancel', 'Abbrechen')}</button>
                    
                    <div className="flex gap-2">
                        {step === 2 && fileTypeLabel === 'CSV' && (
                            <button 
                                onClick={generatePreview} 
                                disabled={!Object.values(colMapping).includes('date') || !isAmountMapped} 
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                {safeT('wizBtnGeneratePreview', 'Vorschau generieren')} <Icon name="ArrowRight" size={16}/>
                            </button>
                        )}
                        {step === 3 && (
                            <>
                                {fileTypeLabel === 'CSV' && (
                                    <button onClick={() => setStep(2)} className="px-4 py-2 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">{safeT('wizBtnBack', 'Zurück')}</button>
                                )}
                                <button onClick={processImport} disabled={importMode === 'single_asset' && !selectedAssetId || selectedCount === 0} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
                                    <Icon name="Check" size={16}/> {safeT('wizBtnImport', 'Importieren')} ({selectedCount})
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

module.exports = CsvImportWizard;