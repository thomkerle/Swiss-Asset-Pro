const ExcelExportEngine = {
  /**
   * Generiert das FinSPA-Logo on-the-fly als Base64 Bild
   */
  generateLogoBase64: () => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, 200, 200);

    ctx.beginPath(); ctx.arc(100, 100, 88, 0, 2*Math.PI);
    ctx.lineWidth = 10; ctx.strokeStyle = '#2563eb'; ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(56, 124); ctx.lineTo(84, 144); ctx.lineTo(136, 84);
    ctx.lineWidth = 12; ctx.strokeStyle = '#10b981'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(108, 84); ctx.lineTo(136, 84); ctx.lineTo(136, 112);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(72, 64, 14, 14, 4) : ctx.fillRect(72, 64, 14, 14); ctx.fill();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(104, 44, 14, 14, 4) : ctx.fillRect(104, 44, 14, 14); ctx.fill();

    return canvas.toDataURL('image/png');
  },

  exportPortfolio: async (data, DataEngine, t) => {
    // Hilfsfunktion zur Übersetzung mit Fallback
    const getText = (key, fallback) => (typeof t === 'function' && t(key) && t(key) !== key ? t(key) : fallback);

    const { getAssetValueAtDate, getAssetRawValueAtDate, getAllAssets, getBookingFlow } = DataEngine || {};
    const todayStr = new Date().toISOString().split('T')[0];
    const allAssets = typeof getAllAssets === 'function' ? getAllAssets(data.banks || []) : [];

    if (typeof window !== 'undefined' && !window.ExcelJS) {
      try {
         await new Promise((resolve, reject) => {
           const script = document.createElement('script');
           script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
           script.onload = resolve;
           script.onerror = () => reject(new Error("ExcelJS konnte nicht via CDN geladen werden."));
           document.head.appendChild(script);
         });
      } catch (e) {
          throw new Error("Bitte stelle sicher, dass du online bist.");
      }
    }

    const ExcelJS = window.ExcelJS;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FinSPA Pro';
    workbook.created = new Date();

    const baseCurrency = data.settings?.baseCurrency || 'CHF';
    const primaryBlue = '2563EB'; 
    const emeraldGreen = '10B981';
    const purpleHex = '8B5CF6';
    const headerGray = '334155';   
    const textDark = '1E293B'; // KUGELSICHER: Standard-Textfarbe 

    const mapAssetClass = (key) => {
        const map = {
            'cash': getText('exclCatCash', 'Giro- & Sparkonten'),
            'stock': getText('exclCatStock', 'Aktien & ETFs'),
            'crypto': getText('exclCatCrypto', 'Kryptowährungen'),
            'fund': getText('exclCatFund', 'Anlagefonds'),
            'managed_fund': getText('MANAGED_FUND', 'Verwaltetes Vermögen'),
            'pension_cash': getText('exclCatPensionCash', 'Pensionskasse (Cash)'),
            'pension_fund': getText('exclCatPensionFund', 'Pensionskasse (Wertschriften)'),
            'pension_3a_cash': getText('exclCatPension3aCash', 'Säule 3a (Cash)'),
            'pension_3a_fund': getText('exclCatPension3aFund', 'Säule 3a (Wertschriften)'),
            'pension_3a_managed': getText('PENSION_3A_MANAGED', '3a Fonds (Gesamtwert)'),
            'realestate': getText('exclCatRealEstate', 'Immobilien'),
            'mortgage': getText('exclCatMortgage', 'Hypothek (Schuld)')
        };
        return map[key?.toLowerCase()] || key?.toUpperCase() || getText('exclCatOther', 'SONSTIGE');
    };

    // =========================================================================
    // 1. DATEN-ANALYSE
    // =========================================================================
    let portfolioTotal = 0;
    let portfolioInvestedTotal = 0;
    
    const bankData = [];
    const assetClassTotals = {};
    const performanceTotals = {};
    
    let liquidityTotals = { 
        'cash': 0, 
        'market': 0,
        'tied': 0,
        'illiquid': 0,
        'debt': 0
    };
    
    const allAssetsList = []; 

    data.banks?.forEach(bank => {
        let bankTotalValue = 0;
        const processAssetsForTotal = (nodes) => {
            nodes.forEach(node => {
                if (node.type === 'asset' && !node.isArchived) {
                    const val = typeof getAssetValueAtDate === 'function' ? getAssetValueAtDate(node, todayStr, allAssets) : 0;
                    bankTotalValue += val;
                    
                    const aClass = mapAssetClass(node.assetClass);
                    assetClassTotals[aClass] = (assetClassTotals[aClass] || 0) + val;

                    const rawClass = (node.assetClass || '').toLowerCase();
                    if (rawClass === 'cash') {
                        liquidityTotals['cash'] += val;
                    } else if (['stock', 'fund', 'crypto', 'managed_fund'].includes(rawClass)) {
                        liquidityTotals['market'] += val;
                    } else if (rawClass.includes('pension')) {
                        liquidityTotals['tied'] += val;
                    } else if (rawClass === 'mortgage') {
                        liquidityTotals['debt'] += val;
                    } else {
                        liquidityTotals['illiquid'] += val;
                    }

                    let assetInvested = 0;
                    let hasInvestedData = false;
                    
                    if (node.bookings && node.bookings.length > 0) {
                        hasInvestedData = true;
                        node.bookings.forEach(b => {
                            const bRate = b.bookingExchangeRate ? parseFloat(String(b.bookingExchangeRate).replace(',', '.')) : (parseFloat(String(node.exchangeRate || 1).replace(',', '.')));
                            const amtBase = Number(b.amount || 0) * (bRate || 1);
                            if (['Einzahlung', 'Kauf'].includes(b.type)) assetInvested += amtBase;
                            else if (['Auszahlung', 'Verkauf'].includes(b.type)) assetInvested -= amtBase;
                        });
                    } else if (node.balances && node.balances.length > 0) {
                        hasInvestedData = true;
                        const sortedBals = [...node.balances].sort((a,b) => new Date(a.date) - new Date(b.date));
                        const bRate = parseFloat(String(node.exchangeRate || 1).replace(',', '.'));
                        assetInvested = Number(sortedBals[0].amount) * bRate;
                    }

                    if (!performanceTotals[aClass]) performanceTotals[aClass] = { invested: 0, current: 0 };
                    const finalInvested = hasInvestedData ? assetInvested : val; 
                    
                    performanceTotals[aClass].invested += finalInvested;
                    performanceTotals[aClass].current += val;
                    portfolioInvestedTotal += finalInvested;

                    allAssetsList.push({ name: node.name, bankName: bank.name, value: val });
                }
                if (node.children) processAssetsForTotal(node.children);
            });
        };
        processAssetsForTotal(bank.children || []);
        portfolioTotal += bankTotalValue;
        bankData.push({ bank, bankTotalValue });
    });

    const top5Assets = allAssetsList.sort((a,b) => b.value - a.value).slice(0, 5);

    // =========================================================================
    // 2. HAUPT-DASHBOARD AUFBAUEN
    // =========================================================================
    const wsDashboard = workbook.addWorksheet('Dashboard', { views: [{ showGridLines: false }] });
    
    wsDashboard.columns = [
      { header: '', key: 'padding', width: 3 },  
      { header: '', key: 'name', width: 32 },    
      { header: '', key: 'value', width: 22, style: { numFmt: `#,##0.00 "${baseCurrency}"` } }, 
      { header: '', key: 'percent', width: 16, style: { numFmt: '0.00%' } }, 
      { header: '', key: 'action', width: 16 },  
      { header: '', key: 'pad2', width: 4 },     
      { header: '', key: 'name2', width: 32 },   
      { header: '', key: 'val2', width: 22, style: { numFmt: `#,##0.00 "${baseCurrency}"` } },  
      { header: '', key: 'perc2', width: 16, style: { numFmt: '0.00%' } }, 
    ];

    const logoBase64 = ExcelExportEngine.generateLogoBase64();
    if (logoBase64) {
        const logoId = workbook.addImage({ base64: logoBase64, extension: 'png' });
        wsDashboard.addImage(logoId, { tl: { col: 1, row: 1 }, ext: { width: 90, height: 90 } });
    }

    wsDashboard.getCell('C2').value = 'FinSPA Pro';
    wsDashboard.getCell('C2').font = { size: 24, bold: true, color: { argb: primaryBlue } };
    wsDashboard.getCell('C3').value = getText('exclTitle', 'Portfolio Übersicht & Analyse');
    wsDashboard.getCell('C3').font = { size: 14, italic: true, color: { argb: '64748B' } };
    
    wsDashboard.getCell('C5').value = getText('exclDate', 'Stichtag:');
    wsDashboard.getCell('D5').value = new Date().toLocaleDateString('de-CH');
    wsDashboard.getCell('C6').value = getText('exclOwner', 'Inhaber:');
    wsDashboard.getCell('D6').value = data.settings?.userName || getText('exclDefaultUser', 'Standardbenutzer');
    ['C5', 'C6'].forEach(c => wsDashboard.getCell(c).font = { bold: true, color: { argb: '94A3B8' }});

    let leftRow = 9;
    let rightRow = 9;

    // --- LINKE SEITE: TABELLE 1 (BANKEN) ---
    wsDashboard.getCell(`B${leftRow}`).value = getText('exclWealthByInst', 'VERMÖGEN NACH INSTITUT');
    wsDashboard.getCell(`B${leftRow}`).font = { size: 12, bold: true, color: { argb: primaryBlue } };
    leftRow++;

    const headerRowBank = wsDashboard.getRow(leftRow);
    headerRowBank.values = ['', getText('exclInstitution', 'Institut'), `${getText('exclValue', 'Wert')} (${baseCurrency})`, getText('exclShare', 'Anteil'), getText('exclDetailView', 'Detailansicht')];
    headerRowBank.font = { bold: true, color: { argb: 'FFFFFF' } };
    for(let i=2; i<=5; i++) headerRowBank.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    leftRow++;

    const bankStartRow = leftRow;
    bankData.forEach(bd => {
      const share = portfolioTotal > 0 ? (bd.bankTotalValue / portfolioTotal) : 0;
      const safeBankName = bd.bank.name.substring(0, 30).replace(/[\\/?*[\]]/g, '');
      
      const row = wsDashboard.getRow(leftRow);
      row.getCell('name').value = bd.bank.name;
      row.getCell('value').value = bd.bankTotalValue;
      row.getCell('percent').value = share;
      row.getCell('action').value = { text: getText('exclOpenBank', 'Bank öffnen ➡️'), hyperlink: `#'${safeBankName}'!A1` };
      
      // KUGELSICHER: Explizite Zellen-Farben
      row.getCell('name').font = { color: { argb: textDark }, bold: false };
      row.getCell('value').font = { color: { argb: textDark }, bold: false };
      row.getCell('percent').font = { color: { argb: textDark }, bold: false };
      row.getCell('action').font = { color: { argb: '0563C1' }, underline: true };
      
      for(let i=2; i<=5; i++) row.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
      leftRow++;
    });

    if (bankData.length > 0) {
        wsDashboard.addConditionalFormatting({
            ref: `D${bankStartRow}:D${leftRow - 1}`,
            rules: [{ type: 'dataBar', cfvo: [{type: 'num', value: 0}, {type: 'max'}], color: {argb: `FF${primaryBlue}`} }]
        });
    }

    const totalRow = wsDashboard.getRow(leftRow);
    totalRow.getCell('name').value = getText('exclPortfolioTotal', 'PORTFOLIO TOTAL');
    totalRow.getCell('value').value = portfolioTotal;
    totalRow.font = { bold: true, size: 12, color: { argb: textDark } };
    totalRow.getCell('value').border = { top: { style: 'thin', color: { argb: '000000' } }, bottom: { style: 'double', color: { argb: '000000' } } };
    leftRow += 3; 

    // --- LINKE SEITE: TABELLE 2 (ANLAGEKLASSEN) ---
    wsDashboard.getCell(`B${leftRow}`).value = getText('exclAssetAlloc', 'ASSET ALLOKATION (KLASSEN)');
    wsDashboard.getCell(`B${leftRow}`).font = { size: 12, bold: true, color: { argb: emeraldGreen } };
    leftRow++;

    const headerRowClass = wsDashboard.getRow(leftRow);
    headerRowClass.getCell('name').value = getText('exclAssetClass', 'Anlageklasse');
    headerRowClass.getCell('value').value = `${getText('exclValue', 'Wert')} (${baseCurrency})`;
    headerRowClass.getCell('percent').value = getText('exclShare', 'Anteil');
    headerRowClass.font = { bold: true, color: { argb: 'FFFFFF' } };
    for(let i=2; i<=4; i++) headerRowClass.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    leftRow++;

    const classStartRow = leftRow;
    Object.keys(assetClassTotals).sort((a,b) => assetClassTotals[b] - assetClassTotals[a]).forEach(aClass => {
        const val = assetClassTotals[aClass];
        const share = portfolioTotal > 0 ? (val / portfolioTotal) : 0;
        
        const row = wsDashboard.getRow(leftRow);
        row.getCell('name').value = aClass;
        row.getCell('value').value = val;
        row.getCell('percent').value = share;

        // KUGELSICHER: Explizite Zellen-Farben
        row.getCell('name').font = { color: { argb: textDark }, bold: false };
        row.getCell('value').font = { color: { argb: textDark }, bold: false };
        row.getCell('percent').font = { color: { argb: textDark }, bold: false };

        for(let i=2; i<=4; i++) row.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
        leftRow++;
    });

    if (Object.keys(assetClassTotals).length > 0) {
        wsDashboard.addConditionalFormatting({
            ref: `D${classStartRow}:D${leftRow - 1}`,
            rules: [{ type: 'dataBar', cfvo: [{type: 'num', value: 0}, {type: 'max'}], color: {argb: `FF${emeraldGreen}`} }]
        });
    }

    // --- RECHTE SEITE: TOP 5 ---
    wsDashboard.getCell(`G${rightRow}`).value = getText('exclTop5', 'TOP 5 POSITIONEN');
    wsDashboard.getCell(`G${rightRow}`).font = { size: 12, bold: true, color: { argb: 'F59E0B' } }; 
    rightRow++;

    const headerRowTop = wsDashboard.getRow(rightRow);
    headerRowTop.getCell('name2').value = getText('exclAssetInst', 'Asset (Institut)');
    headerRowTop.getCell('val2').value = `${getText('exclValue', 'Wert')} (${baseCurrency})`;
    headerRowTop.getCell('perc2').value = getText('exclPortfolioShare', 'Portfolio-Anteil');
    headerRowTop.font = { bold: true, color: { argb: 'FFFFFF' } };
    for(let i=7; i<=9; i++) headerRowTop.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    rightRow++;

    top5Assets.forEach(asset => {
        const share = portfolioTotal > 0 ? (asset.value / portfolioTotal) : 0;
        const row = wsDashboard.getRow(rightRow);
        row.getCell('name2').value = `${asset.name} (${asset.bankName})`;
        row.getCell('val2').value = asset.value;
        row.getCell('perc2').value = share;

        // KUGELSICHER: Explizite Zellen-Farben
        row.getCell('name2').font = { color: { argb: textDark }, bold: false };
        row.getCell('val2').font = { color: { argb: textDark }, bold: false };
        row.getCell('perc2').font = { color: { argb: textDark }, bold: false };

        for(let i=7; i<=9; i++) row.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
        rightRow++;
    });
    rightRow += 3;

    // --- RECHTE SEITE: LIQUIDITÄTS-ANALYSE ---
    wsDashboard.getCell(`G${rightRow}`).value = getText('exclLiqAnalysis', 'LIQUIDITÄTS-ANALYSE');
    wsDashboard.getCell(`G${rightRow}`).font = { size: 12, bold: true, color: { argb: purpleHex } }; 
    rightRow++;

    const headerRowLiq = wsDashboard.getRow(rightRow);
    headerRowLiq.getCell('name2').value = getText('exclAvailability', 'Verfügbarkeit');
    headerRowLiq.getCell('val2').value = `${getText('exclValue', 'Wert')} (${baseCurrency})`;
    headerRowLiq.getCell('perc2').value = getText('exclShareTotal', 'Anteil am Total');
    headerRowLiq.font = { bold: true, color: { argb: 'FFFFFF' } };
    for(let i=7; i<=9; i++) headerRowLiq.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    rightRow++;

    const liqStartRow = rightRow;
    
    // Mapping mit Fallbacks für garantierte Strings
    const liqLabels = {
        'cash': getText('exclLiqCash', 'Sofort verfügbar (Cash)') || 'Sofort verfügbar (Cash)',
        'market': getText('exclLiqMarket', 'Markt-Liquidität (Aktien/Fonds)') || 'Markt-Liquidität (Aktien/Fonds)',
        'tied': getText('exclLiqTied', 'Gebundene Vorsorge (3a/PK)') || 'Gebundene Vorsorge (3a/PK)',
        'illiquid': getText('exclLiqIlliquid', 'Illiquide (Immo/Sonstige)') || 'Illiquide (Immo/Sonstige)',
        'debt': getText('exclLiqDebt', 'Verbindlichkeiten (Hypothek)') || 'Verbindlichkeiten (Hypothek)'
    };

    Object.keys(liquidityTotals).forEach(internalKey => {
        const val = liquidityTotals[internalKey];
        // Cash ("Giro & Sparkonten") IMMER anzeigen, Rest nur wenn größer als 0
        if (val === 0 && internalKey !== 'cash') return;

        const share = portfolioTotal > 0 ? (val / portfolioTotal) : 0;
        const row = wsDashboard.getRow(rightRow);
        
        row.getCell('name2').value = liqLabels[internalKey];
        row.getCell('val2').value = val;
        row.getCell('perc2').value = share;

        // BOMBENSICHER GEGEN ÜBERSCHNEIDUNGEN: Zwinge jede Zelle einzeln zu schwarzer Schrift!
        row.getCell('name2').font = { color: { argb: textDark }, bold: false };
        row.getCell('val2').font = { color: { argb: textDark }, bold: false };
        row.getCell('perc2').font = { color: { argb: textDark }, bold: false };

        for(let i=7; i<=9; i++) row.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
        rightRow++;
    });

    if (rightRow > liqStartRow) {
        wsDashboard.addConditionalFormatting({
            ref: `I${liqStartRow}:I${rightRow - 1}`,
            rules: [{ type: 'dataBar', cfvo: [{type: 'num', value: 0}, {type: 'max'}], color: {argb: `FF${purpleHex}`} }]
        });
    }

    // --- ZENTRALE PERFORMANCE-ANALYSE ---
    let bottomRow = Math.max(leftRow, rightRow) + 3;

    wsDashboard.getCell(`B${bottomRow}`).value = getText('exclPerfReturn', 'PERFORMANCE & RENDITE');
    wsDashboard.getCell(`B${bottomRow}`).font = { size: 14, bold: true, color: { argb: emeraldGreen } }; 
    bottomRow++;

    const headerRowPerf = wsDashboard.getRow(bottomRow);
    headerRowPerf.getCell(2).value = getText('exclAssetClass', 'Anlageklasse');
    headerRowPerf.getCell(3).value = `${getText('exclInvested', 'Investiert')} (${baseCurrency})`;
    
    headerRowPerf.getCell(4).value = `${getText('exclCurrent', 'Aktuell')} (${baseCurrency})`;
    wsDashboard.mergeCells(bottomRow, 4, bottomRow, 5); 
    
    headerRowPerf.getCell(6).value = getText('exclProfitLoss', 'Gewinn / Verlust');
    wsDashboard.mergeCells(bottomRow, 6, bottomRow, 7); 
    
    headerRowPerf.getCell(8).value = getText('exclRoi', 'Rendite');
    wsDashboard.mergeCells(bottomRow, 8, bottomRow, 9); 
    
    headerRowPerf.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    [2, 3, 4, 5, 6, 7, 8, 9].forEach(i => {
        headerRowPerf.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
        headerRowPerf.getCell(i).numFmt = '@';
    });
    bottomRow++;

    Object.keys(performanceTotals).sort((a,b) => performanceTotals[b].current - performanceTotals[a].current).forEach(aClass => {
        const perf = performanceTotals[aClass];
        if (perf.current === 0 && perf.invested === 0) return;

        const profit = perf.current - perf.invested;
        const roi = perf.invested !== 0 ? (profit / perf.invested) : 0;

        const row = wsDashboard.getRow(bottomRow);
        row.getCell(2).value = aClass;
        row.getCell(3).value = perf.invested;
        
        row.getCell(4).value = perf.current;
        wsDashboard.mergeCells(bottomRow, 4, bottomRow, 5);
        
        row.getCell(6).value = profit;
        wsDashboard.mergeCells(bottomRow, 6, bottomRow, 7);
        
        row.getCell(8).value = roi;
        wsDashboard.mergeCells(bottomRow, 8, bottomRow, 9);

        row.getCell(3).numFmt = `#,##0.00 "${baseCurrency}"`;
        row.getCell(4).numFmt = `#,##0.00 "${baseCurrency}"`;
        row.getCell(6).numFmt = `+#,##0.00 "${baseCurrency}";[Red]-#,##0.00 "${baseCurrency}"`;
        row.getCell(8).numFmt = `+0.00%;[Red]-0.00%`;
        
        const colorProfit = profit >= 0 ? emeraldGreen : 'EF4444';
        row.getCell(6).font = { color: { argb: colorProfit }, bold: true };
        row.getCell(8).font = { color: { argb: colorProfit }, bold: true };
        
        row.getCell(2).font = { color: { argb: textDark }, bold: false };
        row.getCell(3).font = { color: { argb: textDark }, bold: false };
        row.getCell(4).font = { color: { argb: textDark }, bold: false };

        [2, 3, 4, 5, 6, 7, 8, 9].forEach(i => row.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } });
        bottomRow++;
    });

    const totalProfit = portfolioTotal - portfolioInvestedTotal;
    const totalRoi = portfolioInvestedTotal !== 0 ? (totalProfit / portfolioInvestedTotal) : 0;
    
    const rowTotalPerf = wsDashboard.getRow(bottomRow);
    rowTotalPerf.getCell(2).value = getText('exclPortfolioOverall', 'PORTFOLIO GESAMT');
    rowTotalPerf.getCell(3).value = portfolioInvestedTotal;
    
    rowTotalPerf.getCell(4).value = portfolioTotal;
    wsDashboard.mergeCells(bottomRow, 4, bottomRow, 5);
    
    rowTotalPerf.getCell(6).value = totalProfit;
    wsDashboard.mergeCells(bottomRow, 6, bottomRow, 7);
    
    rowTotalPerf.getCell(8).value = totalRoi;
    wsDashboard.mergeCells(bottomRow, 8, bottomRow, 9);

    rowTotalPerf.getCell(3).numFmt = `#,##0.00 "${baseCurrency}"`;
    rowTotalPerf.getCell(4).numFmt = `#,##0.00 "${baseCurrency}"`;
    rowTotalPerf.getCell(6).numFmt = `+#,##0.00 "${baseCurrency}";[Red]-#,##0.00 "${baseCurrency}"`;
    rowTotalPerf.getCell(8).numFmt = `+0.00%;[Red]-0.00%`;
    
    const isPosTotal = totalProfit >= 0;
    const totalColor = isPosTotal ? emeraldGreen : 'EF4444';
    
    rowTotalPerf.font = { bold: true, size: 12, color: { argb: textDark } };
    rowTotalPerf.getCell(6).font = { color: { argb: totalColor }, bold: true };
    rowTotalPerf.getCell(8).font = { color: { argb: totalColor }, bold: true };
    
    [2, 3, 4, 5, 6, 7, 8, 9].forEach(i => {
        rowTotalPerf.getCell(i).border = { top: { style: 'thin', color: { argb: '000000' } }, bottom: { style: 'double', color: { argb: '000000' } } };
    });


    // =========================================================================
    // 3. REITER 2 bis X: BANK BLÄTTER (Mit Mini-Dashboard & Outlines)
    // =========================================================================
    data.banks?.forEach((bank) => {
      const safeBankName = bank.name.substring(0, 30).replace(/[\\/?*[\]]/g, '');
      const wsBank = workbook.addWorksheet(safeBankName);
      
      const bankTotalInfo = bankData.find(bd => bd.bank.id === bank.id);
      const specificBankTotal = bankTotalInfo ? bankTotalInfo.bankTotalValue : 0;
      
      const specificBankAssetClassTotals = {};
      const specificBankAssetsList = [];

      const preProcessBankAssets = (nodes) => {
        nodes.forEach(node => {
          if (node.type === 'asset' && !node.isArchived) {
            const val = typeof getAssetValueAtDate === 'function' ? getAssetValueAtDate(node, todayStr, allAssets) : 0;
            const aClass = mapAssetClass(node.assetClass);
            specificBankAssetClassTotals[aClass] = (specificBankAssetClassTotals[aClass] || 0) + val;
            specificBankAssetsList.push({ name: node.name, value: val });
          }
          if (node.children) preProcessBankAssets(node.children);
        });
      };
      preProcessBankAssets(bank.children || []);
      const specificBankTopAssets = specificBankAssetsList.sort((a,b) => b.value - a.value).slice(0, 5);

      wsBank.columns = [
        { key: 'date', width: 35 },       
        { key: 'type', width: 25 },       
        { key: 'cat', width: 25 },        
        { key: 'comment', width: 45 },    
        { key: 'amtOrig', width: 20 },    
        { key: 'amtBase', width: 20, style: { numFmt: `#,##0.00 "${baseCurrency}"` } } 
      ];

      wsBank.getCell('A1').value = { text: getText('exclBackToDash', '🏠 Zurück zum Haupt-Dashboard'), hyperlink: "#'Dashboard'!A1" };
      wsBank.getCell('A1').font = { color: { argb: '0563C1' }, underline: true, bold: true, size: 11 };
      
      wsBank.getCell('A3').value = bank.name.toUpperCase();
      wsBank.getCell('A3').font = { size: 18, bold: true, color: { argb: primaryBlue } };
      
      let dashRow = 5;
      
      wsBank.getCell(`A${dashRow}`).value = getText('exclBankTotalVal', 'Gesamtwert der Bank:');
      wsBank.getCell(`A${dashRow}`).font = { color: { argb: '64748B' }, bold: true };
      wsBank.getCell(`B${dashRow}`).value = specificBankTotal;
      wsBank.getCell(`B${dashRow}`).font = { size: 14, bold: true, color: { argb: '1E293B' } };
      wsBank.getCell(`B${dashRow}`).numFmt = `#,##0.00 "${baseCurrency}"`;
      dashRow += 2;

      wsBank.getCell(`A${dashRow}`).value = getText('exclTopPositions', 'Top Positionen:');
      wsBank.getCell(`A${dashRow}`).font = { bold: true, color: { argb: primaryBlue } };
      wsBank.getCell(`C${dashRow}`).value = getText('exclAssetAllocShort', 'Asset Allokation:');
      wsBank.getCell(`C${dashRow}`).font = { bold: true, color: { argb: emeraldGreen } };
      dashRow++;

      const startMiniDashRow = dashRow;
      const maxRows = Math.max(specificBankTopAssets.length, Object.keys(specificBankAssetClassTotals).length);
      const allocKeys = Object.keys(specificBankAssetClassTotals).sort((a,b) => specificBankAssetClassTotals[b] - specificBankAssetClassTotals[a]);

      for (let i = 0; i < maxRows; i++) {
          const row = wsBank.getRow(dashRow);
          
          if (i < specificBankTopAssets.length) {
              row.getCell('date').value = specificBankTopAssets[i].name;
              row.getCell('type').value = specificBankTopAssets[i].value;
              row.getCell('type').numFmt = `#,##0.00 "${baseCurrency}"`;
              row.getCell('date').font = { color: { argb: textDark } };
              row.getCell('type').font = { color: { argb: textDark } };
          }
          
          if (i < allocKeys.length) {
              const aClass = allocKeys[i];
              const val = specificBankAssetClassTotals[aClass];
              const share = specificBankTotal > 0 ? val / specificBankTotal : 0;
              
              row.getCell('cat').value = aClass;
              row.getCell('comment').value = share; 
              row.getCell('comment').numFmt = '0.00%';
              row.getCell('amtOrig').value = val;
              row.getCell('amtOrig').numFmt = `#,##0.00 "${baseCurrency}"`;
              
              row.getCell('cat').font = { color: { argb: textDark } };
              row.getCell('comment').font = { color: { argb: textDark } };
              row.getCell('amtOrig').font = { color: { argb: textDark } };
          }
          dashRow++;
      }

      if (allocKeys.length > 0) {
          wsBank.addConditionalFormatting({
              ref: `D${startMiniDashRow}:D${dashRow - 1}`,
              rules: [{ type: 'dataBar', cfvo: [{type: 'num', value: 0}, {type: 'max'}], color: {argb: `FF${emeraldGreen}`} }]
          });
      }

      dashRow += 3; 

      const tableHeaderRow = wsBank.getRow(dashRow);
      tableHeaderRow.values = {
          date: getText('exclDateAssetName', 'Datum / Asset Name'),
          type: getText('exclTypeClass', 'Buchungstyp / Anlageklasse'),
          cat: getText('exclCatCurr', 'Kategorie / Währung'),
          comment: getText('exclNoteComment', 'Notiz / Kommentar'),
          amtOrig: getText('exclValAmtOrig', 'Wert / Betrag (Orig)'),
          amtBase: `${getText('exclValAmt', 'Wert / Betrag')} (${baseCurrency})`
      };
      tableHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      for(let i=1; i<=6; i++) {
          tableHeaderRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
      }
      
      const frozenRow = dashRow; 
      let bankCurrentRow = dashRow + 1;

      const processAssets = (nodes) => {
        nodes.forEach(node => {
          if (node.type === 'asset' && !node.isArchived) {
            
            const rawVal = typeof getAssetRawValueAtDate === 'function' ? getAssetRawValueAtDate(node, todayStr) : 0;
            const baseVal = typeof getAssetValueAtDate === 'function' ? getAssetValueAtDate(node, todayStr, allAssets) : 0;
            const mappedClass = mapAssetClass(node.assetClass);
            const isForeign = node.currency && node.currency !== baseCurrency;

            const assetRow = wsBank.getRow(bankCurrentRow);
            assetRow.getCell('date').value = node.name;
            assetRow.getCell('type').value = `${getText('exclClassPrefix', 'Klasse:')} ${mappedClass}`;
            assetRow.getCell('cat').value = node.currency || 'CHF';
            assetRow.getCell('amtBase').value = baseVal;
            
            if (isForeign) {
                assetRow.getCell('amtOrig').value = rawVal;
                assetRow.getCell('amtOrig').numFmt = `#,##0.00 "${node.currency}"`;
            }

            assetRow.font = { bold: true, size: 11, color: { argb: '1E293B' } };
            assetRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
            for(let i=1; i<=6; i++) {
                assetRow.getCell(i).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
            }
            bankCurrentRow++;

            const rawItems = [
                ...(node.balances || []).map(b => ({ ...b, _isBal: true })),
                ...(node.bookings || [])
            ];

            if (rawItems.length > 0) {
                const sortedItems = rawItems.sort((a,b) => new Date(b.date) - new Date(a.date));
                
                sortedItems.forEach(item => {
                    const bRow = wsBank.getRow(bankCurrentRow);
                    
                    let displayAmtOrig = 0;
                    let fontColorHex = '475569';
                    
                    const bRate = item.bookingExchangeRate ? parseFloat(String(item.bookingExchangeRate).replace(',', '.')) : parseFloat(String(node.exchangeRate || 1).replace(',', '.'));
                    const usedRate = bRate || 1;

                    if (item._isBal) {
                        displayAmtOrig = Number(item.amount || 0);
                        fontColorHex = primaryBlue; 
                        bRow.getCell('type').value = getText('exclBalanceTarget', 'SALDO (Stichtag)');
                    } else {
                        let flow = { isPositive: true, amount: 0 };
                        if (typeof getBookingFlow === 'function') {
                            flow = getBookingFlow(item);
                        } else {
                            let amt = Number(item.amount || 0);
                            let isPos = ['Einzahlung', 'Kauf', 'Wertanpassung', 'Dividende', 'Abzahlung'].includes(item.type);
                            if (item.type === 'Wertanpassung' && amt < 0) { isPos = false; amt = Math.abs(amt); }
                            flow = { isPositive: isPos, amount: amt };
                        }
                        
                        displayAmtOrig = flow.isPositive ? flow.amount : -flow.amount;
                        fontColorHex = flow.isPositive ? emeraldGreen : 'EF4444';
                        
                        bRow.getCell('type').value = getText(item.type, item.type);
                    }

                    bRow.getCell('date').value = `      ↳ ${item.date}`;
                    bRow.getCell('cat').value = getText(item.subCategory, item.subCategory) || '';
                    bRow.getCell('comment').value = item.comment || '';
                    
                    bRow.getCell('amtOrig').value = displayAmtOrig;
                    bRow.getCell('amtOrig').numFmt = `#,##0.00 "${node.currency || 'CHF'}"`;
                    bRow.getCell('amtBase').value = displayAmtOrig * usedRate;

                    bRow.getCell('amtOrig').font = { color: { argb: fontColorHex }, bold: item._isBal };
                    bRow.getCell('amtBase').font = { color: { argb: fontColorHex }, bold: item._isBal };
                    
                    ['date', 'type', 'cat', 'comment'].forEach(col => {
                        bRow.getCell(col).font = { color: { argb: '64748B' }, size: 10 };
                    });
                    
                    for(let i=1; i<=6; i++) {
                        bRow.getCell(i).border = { bottom: { style: 'thin', color: { argb: 'F8FAFC' } } };
                    }
                    
                    bRow.outlineLevel = 1; 
                    
                    bankCurrentRow++;
                });
            } else {
                const emptyRow = wsBank.getRow(bankCurrentRow);
                emptyRow.getCell('date').value = getText('exclNoBookings', '      ↳ Keine Buchungen/Salden erfasst');
                emptyRow.font = { italic: true, color: { argb: '94A3B8' }, size: 10 };
                emptyRow.outlineLevel = 1;
                bankCurrentRow++;
            }
          }
          if (node.children) processAssets(node.children);
        });
      };
      
      processAssets(bank.children || []);
    });

    // =========================================================================
    // 5. ABSCHLUSS: Gridlinien global deaktivieren und Header einfrieren
    // =========================================================================
    workbook.worksheets.forEach(ws => {
      if (ws.name === 'Dashboard') {
          ws.views = [{ showGridLines: false }];
      } else {
          ws.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
          const frozenRow = ws.views && ws.views[0] && ws.views[0].ySplit ? ws.views[0].ySplit : 6;
          ws.views = [{ state: 'frozen', ySplit: frozenRow, showGridLines: false }];
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return fileBlob;
  }
};

module.exports = ExcelExportEngine;