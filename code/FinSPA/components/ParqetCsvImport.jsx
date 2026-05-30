/**
 * Konvertiert Zahlenstrings aus der parqet-CSV (z.B. "36,29" oder "1.000,50") in valide Floats
 */
const parseParqetNum = (val) => {
  if (!val) return 0;
  // Entfernt Tausenderpunkte und ersetzt das Komma durch einen Punkt
  const cleaned = String(val).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

/**
 * Konvertiert das parqet Datumsformat (DD.MM.YYYY) in das Standard-ISO-Format (YYYY-MM-DD)
 */
const parseParqetDate = (dateStr) => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const parts = String(dateStr).split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return dateStr;
};

/**
 * Importiert den CSV-String aus einem parqet-Export und transformiert ihn in die AssetPro-Struktur
 * @param {string} csvContent - Der rohe Textinhalt der parqet CSV-Datei
 * @param {function} t - Die Übersetzungsfunktion
 * @returns {Array} Banken-Struktur für das Datenmodell
 */
const importParqetCSV = (csvContent, t) => {
  if (!csvContent) return [];

  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  // Header analysieren, um flexibel auf Spaltenindizes zuzugreifen
  const header = lines[0].trim().split(';');
  const colIdx = {};
  header.forEach((col, index) => {
    colIdx[col.trim()] = index;
  });

  const assetsMap = {};

  // Zeilen verarbeiten (Header überspringen)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(';');
    
    // Hilfsfunktion zum sicheren Auslesen der Spaltenwerte
    const getValue = (colName) => {
      const idx = colIdx[colName];
      return idx !== undefined ? columns[idx] : '';
    };

    const holdingName = getValue('holdingname');
    const holdingNickname = getValue('holdingnickname');
    const identifier = getValue('identifier');
    const currency = getValue('currency') || 'CHF';
    const csvType = getValue('type');

    // Eindeutigen Asset-Key bestimmen (Identifier bevorzugt, sonst Name)
    let assetId = identifier || holdingNickname || holdingName;
    if (!assetId) continue;

    // Bereinigter Anzeigename für deine App
    const resolvedName = holdingName || holdingNickname || (t ? t('parqetUnknownAsset') : 'Unbekanntes Asset');

    // Falls das Asset in diesem Import-Durchlauf noch nicht existiert, initialisieren
    if (!assetsMap[assetId]) {
      let assetClass = 'stock';
      const lowerName = resolvedName.toLowerCase();
      const lowerNickname = holdingNickname.toLowerCase();

      // Klassifizierung anhand deiner TreeView.jsx AssetClasses
      if (lowerName.includes('etf') || lowerName.includes('fund') || lowerName.includes('fonds')) {
        assetClass = 'fund';
      } else if (lowerNickname === 'axa - p' || lowerName.includes('sparkonto') || lowerName.includes('wallet')) {
        assetClass = 'cash';
      }

      assetsMap[assetId] = {
        id: `ast_${assetId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: resolvedName,
        type: 'asset',
        currency: currency,
        exchangeRate: 1.0,
        isLiquid: assetClass === 'cash',
        isArchived: false,
        assetClass: assetClass,
        balances: [],
        bookings: []
      };
    }

    const currentAsset = assetsMap[assetId];

    // parqet-Typen auf deine Buchungskategorien (DataEngine.jsx) mappen
    let bookingType = 'Einzahlung';
    let subCategory = 'Sonstiges';

    switch (csvType) {
      case 'Buy':
        bookingType = 'Kauf';
        subCategory = 'Investition';
        break;
      case 'Dividend':
        bookingType = 'Dividende';
        subCategory = 'Ausschüttung';
        break;
      case 'Sell':
        bookingType = 'Verkauf';
        subCategory = 'Teilverkauf';
        break;
      case 'TransferIn':
        bookingType = 'Einzahlung';
        subCategory = resolvedName.toLowerCase().includes('lohn') ? 'Lohn' : 'Sonstiges';
        break;
      case 'TransferOut':
        bookingType = 'Auszahlung';
        subCategory = 'Sonstiges';
        break;
      case 'Interest':
        bookingType = 'Einzahlung';
        subCategory = 'Zinsen';
        break;
      default:
        bookingType = 'Einzahlung';
        subCategory = 'Sonstiges';
    }

    // Buchungs-Objekt erstellen
    const bookingItem = {
      id: `bk_parqet_${i}_${Math.random().toString(36).substr(2, 5)}`,
      date: parseParqetDate(getValue('date')),
      type: bookingType,
      subCategory: subCategory,
      amount: parseParqetNum(getValue('amount'))
    };

    // Zusätzliche Wertpapier-Details mappen, falls vorhanden
    if (['Buy', 'Sell', 'Dividend'].includes(csvType)) {
      const shares = parseParqetNum(getValue('shares'));
      const price = parseParqetNum(getValue('price'));
      const fee = parseParqetNum(getValue('fee'));
      const tax = parseParqetNum(getValue('tax'));

      if (shares > 0) bookingItem.shares = shares;
      if (price > 0) bookingItem.price = price;
      if (fee > 0) bookingItem.fees = fee;
      if (tax > 0) bookingItem.taxes = tax;
    }

    currentAsset.bookings.push(bookingItem);
  }

  // Assets in Cash und Wertpapiere aufteilen
  const cashAssets = [];
  const securityAssets = [];

  Object.values(assetsMap).forEach(asset => {
    // Chronologisch nach Datum sortieren
    asset.bookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (asset.isLiquid) {
      cashAssets.push(asset);
    } else {
      securityAssets.push(asset);
    }
  });

  // Strukturierte Kategorien aufbauen, damit TreeView.jsx es rendern kann
  const categories = [];
  if (cashAssets.length > 0) {
    categories.push({
      id: 'cat_parqet_cash',
      name: t ? t('parqetCatCash') : 'parqet Konten & Liquidität',
      type: 'category',
      isArchived: false,
      children: cashAssets
    });
  }
  if (securityAssets.length > 0) {
    categories.push({
      id: 'cat_parqet_securities',
      name: t ? t('parqetCatSecurities') : 'parqet Depot & Wertpapiere',
      type: 'category',
      isArchived: false,
      children: securityAssets
    });
  }

  // Rückgabe als parqet-Bankknoten
  return [
    {
      id: 'bank_parqet_import',
      name: t ? t('parqetBankName') : 'parqet Import-Depot',
      type: 'bank',
      isArchived: false,
      children: categories
    }
  ];
};

module.exports = { 
  importParqetCSV: importParqetCSV 
};