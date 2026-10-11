/**
 * @file FinBundleAgentEngine.js
 * @description KI-Agenten-Engine für FinBundle Pro.
 * Unterstützt präzise Buchungsparameter: Bank, Konto, Valuta (ISO), Kategorie & Buchungstext.
 */

const resolveWriteEngine = () => {
  if (typeof window !== 'undefined' && window.FinBundleWriteEngine) return window.FinBundleWriteEngine;
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k.includes('FinBundleWriteEngine'));
    if (foundKey) {
      const exp = window.__FinSPAModules[foundKey].exports;
      return exp?.default || exp || {};
    }
  }
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    try { return window.require('FinBundleWriteEngine.js'); } catch (e) {}
  }
  try { return require('./FinBundleWriteEngine.js'); } catch (e) {}
  try { return require('../api/FinBundleWriteEngine.js'); } catch (e) {}
  return null;
};

const resolveDataEngine = () => {
  if (typeof window !== 'undefined' && window.DataEngine) return window.DataEngine;
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k.includes('DataEngine'));
    if (foundKey) {
      const exp = window.__FinSPAModules[foundKey].exports;
      return exp?.default || exp || {};
    }
  }
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    try { return window.require('DataEngine.jsx'); } catch (e) {}
  }
  try { return require('../data/DataEngine.jsx'); } catch (e) {}
  try { return require('./data/DataEngine.jsx'); } catch (e) {}
  return {};
};

const DataEngine = resolveDataEngine();
const getAllAssets = DataEngine.getAllAssets || ((banks) => []);

class FinBundleAgentEngine {
  constructor(data, updateTreeData) {
    this.data = data || { banks: [], settings: {} };
    this.updateTreeData = updateTreeData;
    const WriteEngineClass = resolveWriteEngine();
    this.writeEngine = WriteEngineClass ? new WriteEngineClass(this.data, this.updateTreeData) : null;
  }

  getGeminiApiKey() {
    return this.data.settings?.aiApiKeys?.gemini || '';
  }

  getSystemContext() {
    const banks = this.data.banks || [];
    const baseCur = this.data.settings?.baseCurrency || 'CHF';
    const todayStr = new Date().toISOString().split('T')[0];

    // Strukturierte Kontenübersicht mit zugehöriger Bank
    const bankStructure = [];
    banks.forEach(bank => {
      const accounts = [];
      const traverse = (node) => {
        if (node.type === 'asset' && !node.isArchived) {
          accounts.push({
            id: node.id,
            name: node.name,
            assetClass: node.assetClass,
            currency: node.currency || baseCur
          });
        }
        if (node.children) node.children.forEach(traverse);
      };
      if (bank.children) bank.children.forEach(traverse);

      bankStructure.push({
        bankName: bank.name,
        bankId: bank.id,
        accounts: accounts
      });
    });

    const configuredCategories = this.data.settings?.bookingCategories || {};
    const defaultExpenseCategories = [
      'Lebensmittel', 'Restaurant', 'Mobilität', 'Wohnen', 
      'Telekommunikation', 'Versicherungen', 'Freizeit', 
      'Gesundheit', 'Steuern', 'Reisen', 'Kreditkartenabrechnung', 'Sonstiges'
    ];
    const defaultIncomeCategories = [
      'Lohn', 'Dividenden', 'Zinsen', 'Rückvergütung', 'Sonstiges'
    ];

    const allowedExpenseCategories = configuredCategories['Auszahlung'] && configuredCategories['Auszahlung'].length > 0
      ? configuredCategories['Auszahlung']
      : defaultExpenseCategories;

    const allowedIncomeCategories = configuredCategories['Einzahlung'] && configuredCategories['Einzahlung'].length > 0
      ? configuredCategories['Einzahlung']
      : defaultIncomeCategories;

    // Händler-Gedächtnis aus bisherigen Buchungen aufbauen
    const merchantMap = {};
    const allAssets = getAllAssets(banks);
    allAssets.forEach(asset => {
      (asset.bookings || []).slice(0, 150).forEach(b => {
        if (b.comment && b.subCategory && b.subCategory !== 'Sonstiges') {
          const rawWord = b.comment.split(' ')[0].replace(/[^a-zA-ZäöüÄÖÜéàè]/g, '').trim();
          if (rawWord.length > 2 && !merchantMap[rawWord]) {
            merchantMap[rawWord] = b.subCategory;
          }
        }
      });
    });

    return {
      todayDate: todayStr,
      currentYear: new Date().getFullYear(),
      baseCurrency: baseCur,
      bankStructure: bankStructure,
      allowedExpenseCategories,
      allowedIncomeCategories,
      knownMerchantCategories: merchantMap
    };
  }

  async getWorkingModelName(apiKey) {
    const cached = localStorage.getItem('finbundle_gemini_active_model');
    if (cached && !cached.includes('2.5') && !cached.includes('1.5')) {
      return cached;
    }

    const preferred = 'gemini-3.8-flash';

    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));

        if (available.includes(preferred)) {
          localStorage.setItem('finbundle_gemini_active_model', preferred);
          return preferred;
        }

        const flashModel = available.find(m => m.includes('3.') && m.includes('flash')) || available.find(m => m.includes('flash'));
        if (flashModel) {
          localStorage.setItem('finbundle_gemini_active_model', flashModel);
          return flashModel;
        }
      }
    } catch (e) {
      console.warn('[AgentEngine] ListModels-Abfrage fehlgeschlagen, nutze Standard:', e);
    }

    localStorage.setItem('finbundle_gemini_active_model', preferred);
    return preferred;
  }

  async transcribeAudio(audioBlob) {
    const apiKey = this.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Kein Google Gemini API Key hinterlegt. Bitte trage diesen in den Einstellungen ein.');
    }

    const modelName = await this.getWorkingModelName(apiKey);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const base64Audio = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        const base64 = res.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const mimeType = audioBlob.type || 'audio/webm';

    const requestBody = {
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType.split(';')[0],
              data: base64Audio
            }
          },
          {
            text: "Transkribiere das gesprochene Audio exakt auf Deutsch. Achte auf Schweizer Fachbegriffe, Banken und Verben ('Buche 23.85 bei der UBS auf Hauptkonto Valuta 08.10. Kategorie Lebensmittel Buchungstext Coop Einkauf'). Gib AUSSCHLIESSLICH den erkannten Text zurück."
          }
        ]
      }]
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Audio-Transkription fehlgeschlagen: ${err.error?.message || response.statusText}`);
    }

    const resJson = await response.json();
    return resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  async processUserPrompt(promptText) {
    const apiKey = this.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Kein Google Gemini API Key hinterlegt. Bitte trage diesen in den Einstellungen ein.');
    }

    if (!this.writeEngine) {
      const WriteEngineClass = resolveWriteEngine();
      if (WriteEngineClass) {
        this.writeEngine = new WriteEngineClass(this.data, this.updateTreeData);
      } else {
        throw new Error('FinBundleWriteEngine konnte nicht geladen werden.');
      }
    }

    const modelName = await this.getWorkingModelName(apiKey);
    const context = this.getSystemContext();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // Präzise Funktionsdeklarationen mit allen Parametern
    const tools = [{
      functionDeclarations: [
        {
          name: "book_transaction",
          description: "Erfasst eine einzelne Buchung mit Bank, Konto, Datum/Valuta, Kategorie und Buchungstext.",
          parameters: {
            type: "OBJECT",
            properties: {
              bankName: { 
                type: "STRING", 
                description: "Name der Bank oder des Finanzinstituts (z. B. 'UBS', 'Raiffeisen', 'PostFinance')." 
              },
              accountName: { 
                type: "STRING", 
                description: "Name des konkreten Kontos (z. B. 'Hauptkonto', 'Privatkonto', 'Sparkonto', 'Kreditkarte')." 
              },
              amount: { 
                type: "NUMBER", 
                description: "Betrag als Dezimalzahl (z. B. 23.85)." 
              },
              type: { 
                type: "STRING", 
                enum: ["Auszahlung", "Einzahlung"], 
                description: "Buchungsart: 'Auszahlung' für Ausgaben/Einkäufe, 'Einzahlung' für Einnahmen/Lohn." 
              },
              category: { 
                type: "STRING", 
                description: "Kategorie aus den erlaubten Kategorien (z. B. 'Lebensmittel', 'Restaurant')." 
              },
              bookingText: { 
                type: "STRING", 
                description: "Der genaue Buchungstext / Verwendungszweck (z. B. 'Coop einkauf', 'Migros Supermarkt')." 
              },
              date: { 
                type: "STRING", 
                description: "Valuta / Buchungsdatum zwingend im ISO-Format 'YYYY-MM-DD' (z. B. '2026-10-08')." 
              }
            },
            required: ["accountName", "amount", "type", "category"]
          }
        },
        {
          name: "book_batch_transactions",
          description: "Bucht mehrere Buchungen gleichzeitig (z. B. Positionen einer Sammelabrechnung).",
          parameters: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                description: "Liste aller Buchungsposten",
                items: {
                  type: "OBJECT",
                  properties: {
                    bankName: { type: "STRING", description: "Name der Bank (optional)" },
                    accountName: { type: "STRING", description: "Name des Kontos" },
                    amount: { type: "NUMBER", description: "Betrag" },
                    category: { type: "STRING", description: "Kategorie" },
                    bookingText: { type: "STRING", description: "Buchungstext / Geschäft" },
                    type: { type: "STRING", enum: ["Auszahlung", "Einzahlung"] },
                    date: { type: "STRING", description: "Datum als 'YYYY-MM-DD'" }
                  },
                  required: ["amount", "category"]
                }
              }
            },
            required: ["items"]
          }
        },
        {
          name: "settle_credit_card",
          description: "Begleicht eine Kreditkartenabrechnung (Übertrag vom Girokonto auf die Kreditkarte).",
          parameters: {
            type: "OBJECT",
            properties: {
              fromBankName: { type: "STRING", description: "Ausgangs-Bankkonto" },
              cardName: { type: "STRING", description: "Kreditkartenkonto" },
              amount: { type: "NUMBER", description: "Abrechnungsbetrag" },
              date: { type: "STRING", description: "Datum als 'YYYY-MM-DD'" }
            },
            required: ["fromBankName", "amount"]
          }
        }
      ]
    }];

    const systemInstructionText = `Du bist der präzise Finanz-Buchungs-Agent von FinBundle Pro.
Heute ist der: ${context.todayDate} (Jahr: ${context.currentYear}, Basiswährung: ${context.baseCurrency}).

Verfügbare Banken und deren Unterkonten:
${JSON.stringify(context.bankStructure, null, 2)}

Erlaubte Kategorien:
- Ausgaben (Auszahlung): ${JSON.stringify(context.allowedExpenseCategories)}
- Einnahmen (Einzahlung): ${JSON.stringify(context.allowedIncomeCategories)}

Händler-Gedächtnis:
${JSON.stringify(context.knownMerchantCategories, null, 2)}

Regeln für die Parameter-Extraktion:
1. 'bankName' & 'accountName': Wenn der Nutzer sagt 'bei der UBS auf mein Konto Hauptkonto', setze bankName = 'UBS' und accountName = 'Hauptkonto'.
2. 'date' / Valuta:
   - Wandle deutsche Datumsangaben ('08.10.2026', '08.10.', '8. Oktober') immer in valides ISO-Format 'YYYY-MM-DD' um.
   - Falls die Jahreszahl unvollständig oder abgehackt gesprochen wurde (z. B. '08.10.202' oder nur '08.10.'), ergänze das aktuelle Jahr ${context.currentYear} -> '2026-10-08'.
   - Falls kein Datum genannt wird, verwende das heutige Datum (${context.todayDate}).
3. 'bookingText': Übernimm den genannten Verwendungszweck (z. B. 'Coop einkauf') exakt in das Feld 'bookingText'.
4. 'category': Ordne den Buchungstext der passenden Kategorie zu (z. B. 'Coop' oder 'Lebensmittel' -> Kategorie 'Lebensmittel').
5. 'type': Einkäufe/Ausgaben sind 'Auszahlung', Gutschriften/Lohn sind 'Einzahlung'.`;

    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }],
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstructionText }]
      },
      tools: tools
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      localStorage.removeItem('finbundle_gemini_active_model');
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API Fehler: ${err.error?.message || response.statusText}`);
    }

    const resJson = await response.json();
    const candidate = resJson.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

    if (!functionCall) {
      return {
        executed: false,
        textResponse: candidate?.content?.parts?.[0]?.text || "Eingabe erfasst, aber keine Buchungspositionen erkannt."
      };
    }

    const { name, args } = functionCall;
    let result;

    if (name === "book_transaction") {
      result = this.writeEngine.bookTransaction({
        bankName: args.bankName,
        assetIdOrName: args.accountName,
        amount: args.amount,
        type: args.type || 'Auszahlung',
        category: args.category || 'Sonstiges',
        comment: args.bookingText || '',
        date: args.date
      });
    } else if (name === "book_batch_transactions") {
      result = this.writeEngine.bookBatchTransactions(args.items || []);
    } else if (name === "settle_credit_card") {
      result = this.writeEngine.settleCreditCardBill({
        fromBankNameOrId: args.fromBankName,
        cardIdOrName: args.cardName,
        amount: args.amount,
        date: args.date
      });
    }

    return {
      executed: true,
      toolUsed: name,
      details: result,
      textResponse: result?.message || "Buchung erfolgreich erfasst."
    };
  }
}

if (typeof window !== 'undefined') {
  window.FinBundleAgentEngine = FinBundleAgentEngine;
}

module.exports = FinBundleAgentEngine;