const React = require('react');

const loadScript = (url) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject();
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) { resolve(); return; }
    
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Fehler beim Laden von: ${url}`));
    document.head.appendChild(script);
  });
};

const getOwnerName = (data) => {
    return data?.settings?.userName && data.settings.userName.trim() !== '' 
        ? data.settings.userName 
        : 'FinSPA Inhaber'; 
};

const buildTableBody = (body) => {
  const safeBody = Array.isArray(body) ? body : [];
  
  return safeBody.map((row) => {
    if (!row) return [];
    
    const firstCellStr = String(row[0] || '').toLowerCase();
    const isTotalRow = firstCellStr.includes('total') || 
                       firstCellStr.includes('gesamt') || 
                       firstCellStr.includes('summe') ||
                       firstCellStr.includes('volumen');

    return row.map((cell) => {
      const cellStr = String(cell || '');
      
      // STRIKTE ERKENNUNG: 
      // Prüft ob der String (abgesehen von Währungssymbolen) NUR aus Ziffern, 
      // Vorzeichen, Leerzeichen, Punkten, Kommas und Hochkommas (1'000) besteht.
      const isNumeric = /^[-+−]?\s*(?:CHF|€|\$)?\s*\d[\d\s.,']*\s*(?:CHF|€|\$|%)?\s*$/i.test(cellStr.trim());
      
      let textColor = '#334155';
      
      if (isNumeric) {
          if (cellStr.includes('-') || cellStr.includes('−')) {
            textColor = '#ef4444';
          } else if (cellStr.includes('+') || cellStr.toLowerCase().includes('gewinn')) {
            textColor = '#10b981';
          }
      }

      const safeText = isNumeric ? cellStr.replace(/ /g, '\u00A0') : cellStr;

      return {
        text: safeText,
        style: isNumeric ? 'tableCellRight' : 'tableCell',
        bold: isTotalRow,
        color: textColor
      };
    });
  });
};

const getTableLayoutConfig = (headerRows = 1) => ({
  fillColor: function (rowIndex, node) {
    if (rowIndex < headerRows) return '#0f172a'; 
    if (rowIndex === node.table.body.length - 1) {
      const firstCell = node.table.body[rowIndex][0];
      const firstCellText = String(firstCell && firstCell.text ? firstCell.text : '').toLowerCase();
      const isTotal = firstCellText.includes('total') || firstCellText.includes('gesamt') || firstCellText.includes('summe') || firstCellText.includes('volumen');
      if (isTotal) return '#f8fafc';
    }
    return (rowIndex % 2 === 0) ? '#f1f5f9' : null;
  },
  hLineWidth: function (i, node) {
    if (i === 0 || i <= headerRows) return 1;
    if (i === node.table.body.length) return 1;
    if (i === node.table.body.length - 1) {
      const lastCell = node.table.body[node.table.body.length - 1][0];
      const lastCellText = String(lastCell && lastCell.text ? lastCell.text : '').toLowerCase();
      if (lastCellText.includes('total') || lastCellText.includes('gesamt') || lastCellText.includes('summe')) return 1.5;
    }
    return 0.5;
  },
  vLineWidth: () => 0.5,
  hLineColor: function (i, node) {
    if (i === 0 || i <= headerRows) return '#334155';
    if (i === node.table.body.length - 1) {
      const lastCell = node.table.body[node.table.body.length - 1][0];
      const lastCellText = String(lastCell && lastCell.text ? lastCell.text : '').toLowerCase();
      if (lastCellText.includes('total') || lastCellText.includes('gesamt') || lastCellText.includes('summe')) return '#475569';
    }
    return '#e2e8f0';
  },
  vLineColor: () => '#f1f5f9'
});

const pdfStyles = {
  coverAppTitle: { fontSize: 26, font: 'Roboto', bold: true, color: '#0f172a', letterSpacing: 3 },
  coverAppSubtitle: { fontSize: 9, font: 'Roboto', bold: true, color: '#94a3b8', letterSpacing: 1.5 },
  coverReportTitle: { fontSize: 24, font: 'Roboto', bold: true, color: '#1e3a8a', letterSpacing: 1 },
  coverReportSubtitle: { fontSize: 12, font: 'Roboto', color: '#475569' },
  coverMetaLabel: { fontSize: 8, font: 'Roboto', bold: true, color: '#94a3b8', letterSpacing: 1 },
  coverMetaValue: { fontSize: 10, font: 'Roboto', color: '#334155', bold: true },
  kpiLabel: { fontSize: 8, font: 'Roboto', bold: true, color: '#94a3b8', letterSpacing: 1 },
  kpiValue: { fontSize: 12, font: 'Roboto', bold: true, color: '#0f172a', margin: [0, 2, 0, 0] },
  reportSectionTitle: { fontSize: 18, font: 'Roboto', bold: true, color: '#1e3a8a', margin: [0, 10, 0, 5] },
  reportSectionSubtitle: { fontSize: 10, font: 'Roboto', color: '#64748b', margin: [0, 0, 0, 15] },
  chartTitlePdf: { fontSize: 14, font: 'Roboto', bold: true, color: '#1e3a8a', margin: [0, 15, 0, 5] }, 
  tableHeader: { bold: true, fontSize: 7.5, color: '#ffffff', margin: [3, 4, 3, 4] },
  tableCell: { fontSize: 7.5, color: '#334155', margin: [3, 4, 3, 4] },
  tableCellRight: { fontSize: 7.5, color: '#334155', alignment: 'right', font: 'Roboto', margin: [3, 4, 3, 4] },
  tableStyle: { margin: [0, 5, 0, 15] }
};

const PdfExportEngine = {
  initLibraries: async () => {
    try {
      if (!window.echarts) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js');
      }

      if (!window.pdfMake || typeof window.pdfMake.createPdf !== 'function') {
        if (window.pdfMake) window.pdfMake = undefined;

        const tempModule = window.module; const tempExports = window.exports; const tempDefine = window.define;
        window.module = undefined; window.exports = undefined; window.define = undefined;

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');

        window.module = tempModule; window.exports = tempExports; window.define = tempDefine;
      }

      return true;
    } catch (error) {
      console.error("[FinSPA PDF Engine] Fehler:", error);
      return false;
    }
  },

  exportReport: async ({ title, subtitle, tableHeaders, customHeaderRows, tableBody, chartsData, chartsBase64, chartBase64, data }) => {
    try {
      const initialized = await PdfExportEngine.initLibraries();
      if (!initialized || !window.pdfMake) throw new Error("PDF-Bibliotheken nicht initialisiert.");

      const now = new Date();
      const timestampStr = `${now.toLocaleDateString('de-CH')} um ${now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr`;

      const safeSubtitle = String(subtitle || '');
      const parts = safeSubtitle.split('|');
      const subtitleMain = parts[0] ? parts[0].trim() : '';
      const hasFocusMetric = safeSubtitle.includes('|');

      const ownerName = getOwnerName(data);
      const pdfTitleStr = (data?.settings?.pdfCompanyName || 'FINSPA PRO').toUpperCase();
      const pdfSubtitleStr = (data?.settings?.pdfSubtitle || 'ENTERPRISE ASSET MANAGEMENT & REPORTING').toUpperCase();

      const docContent = [
        { text: pdfTitleStr, style: 'coverAppTitle', alignment: 'center', margin: [0, 80, 0, 5] },
        { text: pdfSubtitleStr, style: 'coverAppSubtitle', alignment: 'center', margin: [0, 0, 0, 40] },
        { canvas: [{ type: 'line', x1: 220, y1: 0, x2: 520, y2: 0, lineWidth: 1.5, lineColor: '#3b82f6' }], alignment: 'center' },
        
        { text: title.toUpperCase(), style: 'coverReportTitle', alignment: 'center', margin: [0, 60, 0, 10] },
        { text: subtitleMain, style: 'coverReportSubtitle', alignment: 'center', margin: [0, 0, 0, 120] },
        
        { text: 'ERSTELLT FÜR', style: 'coverMetaLabel', alignment: 'center', margin: [0, 0, 0, 2] },
        { text: ownerName, style: 'coverMetaValue', alignment: 'center', margin: [0, 0, 0, 20] },
        { text: 'ZEITPUNKT DER GENERIERUNG', style: 'coverMetaLabel', alignment: 'center', margin: [0, 0, 0, 2] },
        { text: timestampStr, style: 'coverMetaValue', alignment: 'center' },
        
        { text: '', pageBreak: 'after' }
      ];

      docContent.push({
        columns: [
          { stack: [{ text: 'BERICHTSART', style: 'kpiLabel' }, { text: title, style: 'kpiValue' }], width: '*' },
          { stack: [{ text: 'ANALYSE-ZEITRAUM', style: 'kpiLabel' }, { text: safeSubtitle.split('|')[0].replace(/Stichtag:|per/gi, '').trim(), style: 'kpiValue' }], width: '*' },
          hasFocusMetric ? { stack: [{ text: 'KONSOLIDIERTES TOTAL', style: 'kpiLabel' }, { text: safeSubtitle.split('|')[1].replace(/Gesamtvolumen:|Anzahl Buchungen:/gi, '').trim(), style: 'kpiValue', color: '#1e40af' }], width: 'auto' } : { text: '', width: 'auto' }
        ],
        margin: [0, 10, 0, 15]
      });

      docContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 20] });

      if (chartsData && chartsData.length > 0) {
          chartsData.forEach((chartObj, index) => {
              if (chartObj.title) {
                  docContent.push({ text: chartObj.title, style: 'chartTitlePdf' });
              }

              if (chartObj.image) {
                  docContent.push({
                      image: chartObj.image,
                      fit: [740, 360], 
                      alignment: 'center',
                      // FIX: Rand unten vergrößert, da wir die Legenden-Abstände entfernt haben
                      margin: [0, 5, 0, 30] 
                  });
              }

              const isLastChart = index === chartsData.length - 1;
              const hasTable = (tableBody && tableBody.length > 0);
              if (!isLastChart || hasTable) {
                  docContent.push({ text: '', pageBreak: 'after' });
              }
          });
      } else {
          let allCharts = [];
          if (chartsBase64 && Array.isArray(chartsBase64)) allCharts = chartsBase64;
          else if (chartBase64) allCharts = [chartBase64];

          if (allCharts.length > 0) {
            allCharts.forEach((chartImg, index) => {
              docContent.push({
                image: chartImg,
                fit: [740, 440],
                alignment: 'center',
                margin: [0, 10, 0, index === allCharts.length - 1 ? 0 : 20],
                pageBreak: (index < allCharts.length - 1 || (tableBody && tableBody.length > 0)) ? 'after' : undefined
              });
            });
          }
      }

      let tableContent = [];
      let headerRowCount = 1;
      let columnCount = 0;

      if (customHeaderRows && customHeaderRows.length > 0) {
          tableContent.push(...customHeaderRows);
          headerRowCount = customHeaderRows.length;
          columnCount = customHeaderRows[0].length;
      } else if (tableHeaders && tableHeaders.length > 0) {
          tableContent.push(tableHeaders.map(h => ({ text: h, style: 'tableHeader' })));
          columnCount = tableHeaders.length;
      }

      if (tableContent.length > 0 && tableBody && tableBody.length > 0) {
          tableContent.push(...buildTableBody(tableBody));
          
          const dynamicWidths = Array(columnCount).fill('*');

          docContent.push({
            style: 'tableStyle',
            table: { 
                headerRows: headerRowCount, 
                dontBreakRows: true, 
                widths: dynamicWidths, 
                body: tableContent 
            },
            layout: getTableLayoutConfig(headerRowCount)
          });
      }

      const docDefinition = { 
          pageSize: 'A4', 
          pageOrientation: 'landscape', 
          pageMargins: [20, 30, 20, 30], 
          content: docContent, 
          styles: pdfStyles, 
          footer: function(currentPage, pageCount) { 
              if (currentPage === 1) return null; 
              return { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 8, color: '#94a3b8', margin: [0, 0, 20, 0] }; 
          } 
      };

      window.pdfMake.createPdf(docDefinition).download(`${title.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (pdfError) {
      console.error("[FinSPA PDF Engine] Fehler:", pdfError);
      alert("PDF-Erzeugung abgebrochen: " + pdfError.message);
    }
  },

  exportAllReports: async ({ mainTitle = "Gesamtauswertung", reports = [], data }) => {
    alert("Gesamtexport wird vorbereitet...");
  }
};

module.exports = PdfExportEngine;