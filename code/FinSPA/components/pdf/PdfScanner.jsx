const React = require('react');
const { useState } = React;
const Icon = require('../Icons.jsx');

const PdfScanner = ({ setModalObj, data, updateTreeData, selectedNode, setSelectedNode, fCur, t }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [error, setError] = useState('');
    
    // NEU: Eigener State für die bearbeitbaren Tabellenzeilen
    const [transactions, setTransactions] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [selectedModel, setSelectedModel] = useState('qwen3-coder:30b');

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

    const formatPreciseCurrency = (val) => {
        return new Intl.NumberFormat('de-CH', { style: 'currency', currency: data?.settings?.baseCurrency || 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { setError('Bitte lade eine gültige PDF-Datei hoch.'); return; }

        setIsLoading(true); setError(''); setExtractedText(''); setTransactions([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageStrings = textContent.items.map(item => item.str);
                fullText += pageStrings.join(' ') + '\n';
            }
            setExtractedText(fullText);
        } catch (err) {
            setError('Fehler beim Auslesen des PDFs. Ist es evtl. ein reines Bild ohne Textebene?');
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeWithLLM = async () => {
        if (!extractedText) return;
        setIsLlmProcessing(true); setError('');

        const systemPrompt = `
Du bist ein präziser Finanz-Daten-Extraktions-Assistent. 
Der folgende Text ist ein Bank-Kontoauszug oder eine Rechnung. 
Extrahiere ALLE einzelnen Buchungen/Transaktionen aus dem Text. Ignoriere Überträge (Saldovortrag) und Endsalden.
Antworte AUSSCHLIESSLICH im JSON Format. Nutze exakt diese Struktur:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 0.00,
      "vendor": "Name des Zahlers/Empfängers oder Buchungstext",
      "type": "Auszahlung" oder "Einzahlung",
      "category": "Eine passende Kategorie"
    }
  ]
}
GIB KEINEN ANDEREN TEXT AUS. NUR DAS JSON OBJEKT.
`;
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: systemPrompt + "\n\nRechnungstext:\n" + extractedText,
                    stream: false, format: 'json', options: { temperature: 0.1 } 
                })
            });

            if (!response.ok) throw new Error('API Fehler');
            const responseData = await response.json();
            const jsonResult = JSON.parse(responseData.response);
            
            // Initialisieren des bearbeitbaren States
            setTransactions(jsonResult.transactions || []);
        } catch (err) {
            setError('Fehler bei der KI-Analyse. Läuft Ollama auf localhost:11434?');
        } finally {
            setIsLlmProcessing(false);
        }
    };

    // Bearbeitung einer spezifischen Tabellenzelle
    const handleTransactionChange = (index, field, value) => {
        const updatedTxs = [...transactions];
        updatedTxs[index][field] = value;
        // Wenn der Typ (Ein/Auszahlung) geändert wird, setzen wir die Kategorie zurück
        if (field === 'type') updatedTxs[index].category = '';
        setTransactions(updatedTxs);
    };

    // Direkte Speicherung in den globalen Datenbaum
    const saveBookingsToAsset = (txsToSave) => {
        if (!selectedAssetId) {
            alert('Bitte wähle zuerst oben das Zielkonto aus.');
            return false;
        }

        const generateId = () => Math.random().toString(36).substr(2, 9);
        
        const updateRecursive = (nodes) => nodes.map(n => {
            if (n.id === selectedAssetId) {
                let copy = {...n};
                if (!copy.bookings) copy.bookings = [];
                
                txsToSave.forEach(tx => {
                    let finalCategory = tx.category;
                    if (tx.vendor && tx.vendor !== tx.category) {
                        finalCategory = `${tx.category} (${tx.vendor})`;
                    }
                    
                    copy.bookings.push({
                        id: generateId(),
                        date: tx.date || new Date().toISOString().split('T')[0],
                        type: tx.type || 'Auszahlung',
                        subCategory: finalCategory,
                        amount: Number(tx.amount || 0),
                        bookingExchangeRate: 1
                    });
                });
                return copy;
            }
            if (n.children) return { ...n, children: updateRecursive(n.children) };
            return n;
        });

        const newBanks = updateRecursive(data.banks);
        updateTreeData({ banks: newBanks });

        // Wenn das Zielkonto gerade im Hintergrund offen ist, updaten wir es auch im UI
        if (selectedNode && selectedNode.id === selectedAssetId && setSelectedNode) {
            const getUpdatedNode = (nodes) => {
                for(let i=0; i<nodes.length; i++) {
                    if(nodes[i].id === selectedAssetId) return nodes[i];
                    if(nodes[i].children) { let r = getUpdatedNode(nodes[i].children); if(r) return r; }
                }
            };
            setSelectedNode(getUpdatedNode(newBanks));
        }
        return true;
    };

    const applySingleTransaction = (index) => {
        const success = saveBookingsToAsset([transactions[index]]);
        if (success) {
            // Nach Erfolg aus der Tabelle entfernen
            setTransactions(transactions.filter((_, i) => i !== index));
        }
    };

    const applyAllTransactions = () => {
        const success = saveBookingsToAsset(transactions);
        if (success) {
            setTransactions([]); // Alle erfolgreich gespeichert, Tabelle leeren
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Icon name="FileText" className="text-blue-500" /> 
                        {t ? t('pdfScannerTitle') : 'KI PDF-Belegleser'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Modell:</span>
                        <input 
                            type="text" 
                            value={selectedModel} 
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {!extractedText && !isLoading && (
                        <label className="cursor-pointer flex flex-col items-center justify-center p-12 border-2 border-dashed border-blue-300 dark:border-slate-600 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
                            <Icon name="Upload" size={48} className="text-blue-500 mb-4" />
                            <span className="font-bold text-slate-700 dark:text-slate-300 text-lg">Rechnungs- oder Auszugs-PDF auswählen</span>
                            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                        </label>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 text-blue-500">
                            <Icon name="RefreshCw" className="animate-spin mb-4" size={40} />
                            <p className="font-bold">Extrahiere Textstrukturen...</p>
                        </div>
                    )}

                    {isLlmProcessing && (
                        <div className="flex flex-col items-center justify-center py-12 text-purple-500">
                            <Icon name="Cpu" className="animate-pulse mb-4" size={40} />
                            <p className="font-bold">{selectedModel} analysiert Zeilenstruktur...</p>
                        </div>
                    )}

                    {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg text-sm font-medium">{error}</div>}

                    {extractedText && !isLoading && !isLlmProcessing && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            
                            {/* Linke Seite: Rohtext (1/4 Breite) */}
                            <div className="lg:col-span-1">
                                <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">PDF Rohtext</h4>
                                <div className="bg-gray-100 dark:bg-slate-950 p-3 rounded-xl font-mono text-[9px] text-gray-500 h-[26rem] overflow-y-auto border dark:border-slate-800 shadow-inner">
                                    {extractedText}
                                </div>
                            </div>

                            {/* Rechte Seite: Interaktive Tabelle (3/4 Breite) */}
                            <div className="lg:col-span-3 flex flex-col">
                                <div className="mb-4 p-3 bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Icon name="Shield" size={14} /> Ziel-Konto:
                                        </label>
                                        <select 
                                            className="text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg outline-none font-medium max-w-xs text-slate-800 dark:text-slate-100 dark:border-slate-700"
                                            value={selectedAssetId}
                                            onChange={e => setSelectedAssetId(e.target.value)}
                                        >
                                            <option value="">-- Bitte Konto wählen --</option>
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

                                    {/* NEU: Alle Übernehmen Button */}
                                    {transactions.length > 0 && selectedAssetId && (
                                        <button 
                                            onClick={applyAllTransactions}
                                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                                        >
                                            <Icon name="CheckCircle" size={14} /> Alle {transactions.length} übernehmen
                                        </button>
                                    )}
                                </div>
                                
                                {transactions.length === 0 ? (
                                    <div className="bg-purple-50 dark:bg-purple-900/10 border border-dashed border-purple-200 dark:border-purple-800/50 p-6 rounded-xl h-[22rem] flex flex-col items-center justify-center text-center">
                                        <Icon name="CheckCircle" size={36} className="text-purple-400 mb-3"/>
                                        <p className="text-sm text-purple-700 dark:text-purple-400 font-medium mb-4">Keine offenen Buchungen zur Verarbeitung.</p>
                                        <button onClick={analyzeWithLLM} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2">
                                            <Icon name="Activity" size={16}/> {selectedModel} (neu) starten
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 flex-1 h-[22rem] flex flex-col shadow-sm">
                                        <div className="overflow-auto flex-1">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-50 dark:bg-slate-800 border-b sticky top-0 dark:border-slate-700 z-10">
                                                    <tr>
                                                        <th className="p-3 font-bold text-gray-500 uppercase">Datum</th>
                                                        <th className="p-3 font-bold text-gray-500 uppercase">Beschreibung</th>
                                                        <th className="p-3 font-bold text-gray-500 uppercase">Typ & Kategorie</th>
                                                        <th className="p-3 font-bold text-gray-500 uppercase text-right">Betrag</th>
                                                        <th className="p-3 font-bold text-gray-500 uppercase text-center w-20">Aktion</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                                    {transactions.map((tx, idx) => {
                                                        const isDeposit = tx.type === 'Einzahlung';
                                                        const availableSubCats = activeBookingCategories[tx.type] || [];
                                                        
                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
                                                                <td className="p-3">
                                                                    <input 
                                                                        type="date" 
                                                                        className="bg-transparent border border-gray-300 dark:border-slate-600 rounded px-1 py-1 w-28 text-[11px] outline-none"
                                                                        value={tx.date || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'date', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="p-3">
                                                                    <input 
                                                                        type="text" 
                                                                        className="bg-transparent border border-gray-300 dark:border-slate-600 rounded px-2 py-1 w-full text-xs outline-none font-bold text-slate-800 dark:text-slate-200"
                                                                        value={tx.vendor || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'vendor', e.target.value)}
                                                                        placeholder="Händler / Beschreibung"
                                                                    />
                                                                </td>
                                                                <td className="p-3 flex gap-2">
                                                                    <select 
                                                                        className={`bg-transparent border rounded px-1 py-1 text-[10px] font-bold outline-none ${isDeposit ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}`}
                                                                        value={tx.type || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'type', e.target.value)}
                                                                    >
                                                                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                    </select>
                                                                    
                                                                    <select 
                                                                        className="bg-transparent border border-gray-300 dark:border-slate-600 rounded px-1 py-1 text-[10px] w-28 outline-none text-slate-700 dark:text-slate-300"
                                                                        value={tx.category || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'category', e.target.value)}
                                                                    >
                                                                        <option value="">-- Kat. --</option>
                                                                        {availableSubCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <input 
                                                                        type="number" 
                                                                        step="any"
                                                                        className={`bg-transparent border border-gray-300 dark:border-slate-600 rounded px-2 py-1 w-24 text-right text-xs font-mono font-black outline-none ${isDeposit ? 'text-green-600' : 'text-red-600'}`}
                                                                        value={tx.amount || ''}
                                                                        onChange={(e) => handleTransactionChange(idx, 'amount', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <button 
                                                                        onClick={() => applySingleTransaction(idx)}
                                                                        className={`text-[10px] font-bold px-2 py-1.5 rounded shadow-sm transition-all ${selectedAssetId ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                                        title={!selectedAssetId ? 'Konto wählen' : 'Einzeln übernehmen'}
                                                                    >
                                                                        <Icon name="Plus" size={12} />
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
                <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                    <button onClick={() => setModalObj(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white font-medium text-sm px-2">
                        Fertig / Schliessen
                    </button>
                </div>
            </div>
        </div>
    );
};

module.exports = PdfScanner;