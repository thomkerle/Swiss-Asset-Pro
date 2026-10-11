/**
 * @file FinBundleWriteEngine.js
 * @description Transaktionssichere Schreib-API für FinBundle Pro.
 * Unterstützt gezieltes Konto-Matching über Bank- und Kontonamen sowie Valuta-Buchungen.
 */

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
const { 
  generateId = () => Math.random().toString(36).substr(2, 9), 
  getAllAssets = (banks) => [] 
} = DataEngine;

class FinBundleWriteEngine {
  constructor(data, updateTreeDataCallback) {
    this.data = data || { banks: [] };
    this.updateTreeData = updateTreeDataCallback;
  }

  // Findet ein Konto präzise – priorisiert über den übergebenen Banknamen
  findAssetByNameOrId(accountQuery, bankQuery) {
    if (!accountQuery && !bankQuery) return null;
    const banks = this.data.banks || [];
    const accLower = String(accountQuery || '').toLowerCase().trim();
    const bankLower = String(bankQuery || '').toLowerCase().trim();

    // 1. Wenn Bankname angegeben ist: gezielt in dieser Bank suchen
    if (bankLower) {
      const targetBank = banks.find(b => 
        (b.name || '').toLowerCase() === bankLower || 
        (b.name || '').toLowerCase().includes(bankLower)
      );

      if (targetBank) {
        const bankAssets = [];
        const traverse = (node) => {
          if (node.type === 'asset') bankAssets.push(node);
          if (node.children) node.children.forEach(traverse);
        };
        (targetBank.children || []).forEach(traverse);

        // Treffer in der Zielbank nach exaktem oder Teil-Namen
        const matchInBank = bankAssets.find(a => (a.name || '').toLowerCase() === accLower) ||
                            bankAssets.find(a => (a.name || '').toLowerCase().includes(accLower));
        if (matchInBank) return matchInBank;

        // Falls Konto nicht genannt, aber Zielbank gefunden: erstes Standardkonto der Bank nehmen
        if (!accLower && bankAssets.length > 0) return bankAssets[0];
      }
    }

    // 2. Globales Matching über alle Konten
    const all = getAllAssets(banks);

    // ID-Treffer
    let match = all.find(a => a.id === accountQuery);
    if (match) return match;

    // Exakter Name
    match = all.find(a => (a.name || '').toLowerCase() === accLower);
    if (match) return match;

    // Name enthält Suchbegriff (z. B. 'Hauptkonto' -> 'UBS Hauptkonto CHF')
    match = all.find(a => (a.name || '').toLowerCase().includes(accLower));
    if (match) return match;

    // Kreditkarten-Fallback
    if (accLower.includes('kredit') || accLower.includes('karte') || accLower.includes('visa') || accLower.includes('mastercard')) {
      match = all.find(a => a.assetClass === 'credit_card' || (a.name || '').toLowerCase().includes('kredit'));
      if (match) return match;
    }

    return null;
  }

  /**
   * Bucht eine Einzeltransaktion mit Valuta, Kategorie und Buchungstext
   */
  bookTransaction({ bankName, assetIdOrName, amount, type = 'Auszahlung', category = 'Sonstiges', comment = '', date }) {
    const asset = this.findAssetByNameOrId(assetIdOrName, bankName);
    if (!asset) {
      throw new Error(`Konto "${assetIdOrName || 'Standard'}" ${bankName ? `bei ${bankName}` : ''} konnte in FinBundle Pro nicht gefunden werden.`);
    }

    // Valuta-Datum absichern (Fallback auf Heute)
    let bookingDate = date;
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      bookingDate = new Date().toISOString().split('T')[0];
    }

    const cleanComment = comment ? String(comment).trim() : '';

    const newBooking = {
      id: generateId(),
      date: bookingDate,
      type: type,
      subCategory: category,
      amount: Math.abs(Number(amount)),
      comment: cleanComment,
      bookingExchangeRate: asset.exchangeRate || 1,
      _timestamp: Date.now()
    };

    const updateRecursive = (nodes) => nodes.map(n => {
      let copy = { ...n };
      if (n.id === asset.id) {
        copy.bookings = [newBooking, ...(copy.bookings || [])];
      }
      if (n.children) copy.children = updateRecursive(n.children);
      return copy;
    });

    const newBanks = updateRecursive(this.data.banks || []);
    this.updateTreeData({ banks: newBanks });

    return {
      success: true,
      booking: newBooking,
      assetName: asset.name,
      message: `${type} von ${newBooking.amount.toFixed(2)} ${asset.currency || 'CHF'} auf "${asset.name}" (Valuta: ${bookingDate}, Text: "${cleanComment || category}") erfolgreich verbucht.`
    };
  }

  /**
   * Bucht mehrere Transaktionen (Sammelabrechnung)
   */
  bookBatchTransactions(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Keine Buchungsposten übergeben.');
    }

    const results = [];
    let updatedBanks = JSON.parse(JSON.stringify(this.data.banks || []));

    items.forEach(item => {
      let targetAsset = this.findAssetByNameOrId(item.accountName, item.bankName);
      if (!targetAsset) {
        const all = getAllAssets(updatedBanks);
        targetAsset = all.find(a => a.assetClass === 'credit_card') || all[0];
      }

      if (targetAsset) {
        let bDate = item.date;
        if (!bDate || !/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
          bDate = new Date().toISOString().split('T')[0];
        }

        const newBooking = {
          id: generateId(),
          date: bDate,
          type: item.type || 'Auszahlung',
          subCategory: item.category || 'Sonstiges',
          amount: Math.abs(Number(item.amount)),
          comment: item.bookingText || item.description || '',
          bookingExchangeRate: targetAsset.exchangeRate || 1,
          _timestamp: Date.now()
        };

        const inject = (nodes) => nodes.map(n => {
          let copy = { ...n };
          if (n.id === targetAsset.id) {
            copy.bookings = [newBooking, ...(copy.bookings || [])];
          }
          if (n.children) copy.children = inject(n.children);
          return copy;
        });

        updatedBanks = inject(updatedBanks);
        results.push(`${newBooking.amount.toFixed(2)} CHF [${newBooking.subCategory}] (${newBooking.comment || 'Kein Text'}) -> "${targetAsset.name}" [${bDate}]`);
      }
    });

    this.updateTreeData({ banks: updatedBanks });

    return {
      success: true,
      count: results.length,
      message: `${results.length} Buchungen verbucht:\n• ${results.join('\n• ')}`
    };
  }

  /**
   * Begleichung der Kreditkartenrechnung
   */
  settleCreditCardBill({ fromBankNameOrId, cardName, amount, date }) {
    const bankAsset = this.findAssetByNameOrId(fromBankNameOrId);
    const cardAsset = this.findAssetByNameOrId(cardName);

    if (!bankAsset || !cardAsset) {
      throw new Error('Bankkonto oder Kreditkartenkonto für den Ausgleich wurde nicht gefunden.');
    }

    const bookingDate = date || new Date().toISOString().split('T')[0];
    const parsedAmount = Math.abs(Number(amount));

    const bankOutBooking = {
      id: generateId(),
      date: bookingDate,
      type: 'Auszahlung',
      subCategory: 'Umbuchung Ausgang',
      comment: `Ausgleich Kreditkarte: ${cardAsset.name}`,
      amount: parsedAmount,
      bookingExchangeRate: bankAsset.exchangeRate || 1,
      _timestamp: Date.now()
    };

    const cardInBooking = {
      id: generateId(),
      date: bookingDate,
      type: 'Einzahlung',
      subCategory: 'Umbuchung Eingang',
      comment: `Monatsabrechnung via ${bankAsset.name}`,
      amount: parsedAmount,
      bookingExchangeRate: cardAsset.exchangeRate || 1,
      _timestamp: Date.now()
    };

    const updateRecursive = (nodes) => nodes.map(n => {
      let copy = { ...n };
      if (n.id === bankAsset.id) copy.bookings = [bankOutBooking, ...(copy.bookings || [])];
      if (n.id === cardAsset.id) copy.bookings = [cardInBooking, ...(copy.bookings || [])];
      if (n.children) copy.children = updateRecursive(n.children);
      return copy;
    });

    const newBanks = updateRecursive(this.data.banks || []);
    this.updateTreeData({ banks: newBanks });

    return {
      success: true,
      amount: parsedAmount,
      message: `Kreditkartenabrechnung von ${parsedAmount.toFixed(2)} CHF beglichen (${bankAsset.name} -> ${cardAsset.name}).`
    };
  }
}

if (typeof window !== 'undefined') {
  window.FinBundleWriteEngine = FinBundleWriteEngine;
}

module.exports = FinBundleWriteEngine;