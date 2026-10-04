const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const exportCSV = (data, t) => {
   let csv = safeT(t, 'csvHeader', "Datum;Typ;Kategorie;Asset;Betrag;Waehrung;Wechselkurs\n");
   const traverse = (nodes) => {
      nodes.forEach(n => {
         if (n.type === 'asset') {
             if (n.bookings) n.bookings.forEach(b => { csv += `${b.date};${b.type};${b.subCategory || ''};${n.name};${b.amount};${n.currency};${b.bookingExchangeRate || 1}\n`; });
             if (n.balances) n.balances.forEach(b => { 
                csv += `${b.date};${safeT(t, 'csvBalanceDate', 'Stichtag-Saldo')};${safeT(t, 'csvSystem', 'System')};${n.name};${b.amount};${n.currency};${b.bookingExchangeRate || 1}\n`; 
             });
         }
         if (n.children) traverse(n.children);
      });
   };
   if(data && data.banks) traverse(data.banks);
   return csv;
};

const detectDelimiter = (text) => {
    const firstLine = text.split('\n')[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
};

const parseCSVLine = (text, delimiter) => {
    let result = [];
    let cur = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cur += '"'; 
                    i++; 
                } else {
                    inQuotes = false;
                }
            } else {
                cur += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === delimiter) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += c;
            }
        }
    }
    result.push(cur.trim());
    return result;
};

const parseNumber = (val) => {
    if (!val) return 0;
    let str = String(val);
    str = str.replace(/[A-Za-z]/g, '').trim();
    str = str.replace(/['’]/g, '').trim();
    if (str.match(/\d+\.\d{3},\d+/)) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.match(/\d+,\d{3}\.\d+/)) str = str.replace(/,/g, '');
    else str = str.replace(',', '.');
    
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const parseDate = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (str.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
        const [d, m, y] = str.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [m, d, y] = str.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10);
    return str; 
};

const normalizeType = (val) => {
    if (!val) return 'Einzahlung';
    const str = String(val).toLowerCase();
    
    if (str.startsWith('kauf') || str.includes('buy')) return 'Kauf';
    if (str.startsWith('verkauf') || str.includes('sell')) return 'Verkauf';
    if (str.includes('dividende') || str.includes('ausschüttung') || str.includes('dividend')) return 'Dividende';
    if (str.includes('zins')) return 'Zinszahlung';
    if (str.includes('gebühr') || str.includes('fee') || str.includes('steuer') || str.includes('kosten')) return 'Gebühr';
    if (str.includes('auszahlung')) return 'Auszahlung';
    
    return 'Einzahlung';
};

const processCsvImport = (previewData, currentData, DataEngine, options = {}) => {
    const { generateId } = DataEngine;
    const { importMode = 'single_asset', targetId = null, t } = options;
    
    let banksCopy = JSON.parse(JSON.stringify(currentData.banks || []));
    let importedBookingsCount = 0;

    const defaultCsvCategoryName = safeT(t, 'csvImportDefaultCategory', 'Importierte Assets');
    const importedPrefix = safeT(t, 'bookingImportedOn', 'Importiert am');

    if (importMode === 'single_asset' && targetId) {
        let targetAsset = null;
        
        const findAssetById = (nodes) => {
            for (let n of nodes) {
                if (n.type === 'asset' && n.id === targetId) {
                    targetAsset = n;
                    return true;
                }
                if (n.children && findAssetById(n.children)) return true;
            }
            return false;
        };
        findAssetById(banksCopy);

        if (!targetAsset) {
            throw new Error(safeT(t, 'errTargetAccountNotFound', "Das gewählte Ziel-Konto wurde nicht im Portfolio gefunden."));
        }

        if (!targetAsset.bookings) targetAsset.bookings = [];

        previewData.forEach(item => {
            if (!item.date) return;

            const isDuplicate = targetAsset.bookings.some(b => 
                b.date === item.date && 
                b.type === item.type && 
                Math.abs((Number(b.amount) || 0) - (Number(item.amount) || 0)) < 0.01 &&
                (b.comment === item.asset || b.subCategory === item.asset)
            );

            if (!isDuplicate) {
                targetAsset.bookings.push({
                    id: generateId(),
                    date: item.date,
                    type: item.type,
                    amount: item.amount,
                    shares: item.shares > 0 ? item.shares : undefined,
                    price: item.price > 0 ? item.price : undefined,
                    subCategory: item.asset ? item.asset.substring(0, 40) : 'CSV Import',
                    comment: item.asset || `${importedPrefix} ${new Date().toISOString().split('T')[0]}`
                });
                importedBookingsCount++;
            }
        });
    } else {
        let targetBank = null;
        let targetCategory = null;

        if (targetId && targetId.includes('|')) {
            const [bId, cId] = targetId.split('|');
            targetBank = banksCopy.find(b => b.id === bId);
            if (targetBank) targetCategory = targetBank.children?.find(c => c.id === cId);
        }

        if (!targetBank || !targetCategory) {
            targetBank = banksCopy.find(b => b.name === 'CSV Import');
            if (!targetBank) {
                targetBank = { id: generateId(), type: 'bank', name: 'CSV Import', children: [] };
                banksCopy.push(targetBank);
            }
            targetCategory = targetBank.children.find(c => c.name === defaultCsvCategoryName || c.name === 'Importierte Assets');
            if (!targetCategory) {
                targetCategory = { id: generateId(), type: 'category', name: defaultCsvCategoryName, children: [] };
                targetBank.children.push(targetCategory);
            }
        }

        previewData.forEach(item => {
            if (!item.date || !item.asset) return;

            let targetAsset = null;
            const findAsset = (nodes) => {
                for (let n of nodes) {
                    if (n.type === 'asset' && n.name.toLowerCase() === item.asset.toLowerCase()) {
                        targetAsset = n;
                        return true;
                    }
                    if (n.children && findAsset(n.children)) return true;
                }
                return false;
            };
            findAsset([targetBank]);

            if (!targetAsset) {
                targetAsset = {
                    id: generateId(),
                    type: 'asset',
                    name: item.asset,
                    assetClass: 'stock',
                    currency: item.currency,
                    bookings: []
                };
                if (!targetCategory.children) targetCategory.children = [];
                targetCategory.children.push(targetAsset);
            }

            if (!targetAsset.bookings) targetAsset.bookings = [];

            const isDuplicate = targetAsset.bookings.some(b => 
                b.date === item.date && 
                b.type === item.type && 
                Math.abs((Number(b.amount) || 0) - (Number(item.amount) || 0)) < 0.01
            );

            if (!isDuplicate) {
                targetAsset.bookings.push({
                    id: generateId(),
                    date: item.date,
                    type: item.type,
                    amount: item.amount,
                    shares: item.shares > 0 ? item.shares : undefined,
                    price: item.price > 0 ? item.price : undefined,
                    subCategory: 'CSV Import',
                    comment: `${importedPrefix} ${new Date().toISOString().split('T')[0]}`
                });
                importedBookingsCount++;
            }
        });
    }

    return {
        updatedBanks: banksCopy,
        importedCount: importedBookingsCount
    };
};

module.exports = { 
    exportCSV,
    detectDelimiter,
    parseCSVLine,
    parseNumber,
    parseDate,
    normalizeType,
    processCsvImport
};