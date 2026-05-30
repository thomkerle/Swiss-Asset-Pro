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

// Hilfsfunktion, um den Benutzernamen aus den Einstellungen zu lesen
const getOwnerName = (data) => {
    return data?.settings?.userName && data.settings.userName.trim() !== '' 
        ? data.settings.userName 
        : 'FinSPA Inhaber'; // Standardtext, falls das Feld leer ist
};

// Hilfsfunktion zur Formatierung der Tabellen-Zellen (verhindert doppelten Code)
const buildTableContent = (headers, body) => {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeBody = Array.isArray(body) ? body : [];

  const tableContent = [
    safeHeaders.map(h => ({ text: h, style: 'tableHeader' }))
  ];
  
  const formattedBody = safeBody.map((row) => {
    if (!row) return [];
    
    const firstCellStr = String(row[0] || '').toLowerCase();
    const isTotalRow = firstCellStr.includes('total') || 
                       firstCellStr.includes('gesamt') || 
                       firstCellStr.includes('summe') ||
                       firstCellStr.includes('volumen');

    return row.map((cell) => {
      const cellStr = String(cell || '');
      const isNumeric = cellStr.includes('CHF') || cellStr.includes('€') || cellStr.includes('$') || cellStr.includes('%') || !isNaN(cellStr.replace(/[^0-9.-]/g, ''));
      
      let textColor = '#334155';
      if (cellStr.includes('-') || cellStr.includes('−')) {
        textColor = '#ef4444';
      } else if (cellStr.includes('+') || cellStr.toLowerCase().includes('gewinn')) {
        textColor = '#10b981';
      }

      return {
        text: cellStr,
        style: isNumeric ? 'tableCellRight' : 'tableCell',
        bold: isTotalRow,
        color: textColor
      };
    });
  });

  tableContent.push(...formattedBody);
  return tableContent;
};

// Layout-Konfiguration für Tabellen (wird in beiden Export-Funktionen genutzt)
const tableLayoutConfig = {
  fillColor: function (rowIndex, node) {
    if (rowIndex === 0) return '#0f172a';
    if (rowIndex === node.table.body.length - 1) {
      const firstCell = node.table.body[rowIndex][0];
      const firstCellText = String(firstCell && firstCell.text ? firstCell.text : '').toLowerCase();
      const isTotal = firstCellText.includes('total') || firstCellText.includes('gesamt') || firstCellText.includes('summe') || firstCellText.includes('volumen');
      if (isTotal) return '#f8fafc';
    }
    return (rowIndex % 2 === 0) ? '#f1f5f9' : null;
  },
  hLineWidth: function (i, node) {
    if (i === 0 || i === 1) return 1;
    if (i === node.table.body.length) return 1;
    if (i === node.table.body.length - 1) {
      const lastCell = node.table.body[node.table.body.length - 1][0];
      const lastCellText = String(lastCell && lastCell.text ? lastCell.text : '').toLowerCase();
      const isTotal = lastCellText.includes('total') || lastCellText.includes('gesamt') || lastCellText.includes('summe') || lastCellText.includes('volumen');
      if (isTotal) return 1.5;
    }
    return 0.5;
  },
  vLineWidth: () => 0.5,
  hLineColor: function (i, node) {
    if (i === node.table.body.length - 1) {
      const lastCell = node.table.body[node.table.body.length - 1][0];
      const lastCellText = String(lastCell && lastCell.text ? lastCell.text : '').toLowerCase();
      if (lastCellText.includes('total') || lastCellText.includes('gesamt') || lastCellText.includes('summe')) return '#475569';
    }
    return '#e2e8f0';
  },
  vLineColor: () => '#f1f5f9'
};

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
  tableHeader: { bold: true, fontSize: 10, color: '#ffffff', margin: [10, 6, 10, 6] },
  tableCell: { fontSize: 9, color: '#334155', margin: [10, 6, 10, 6] },
  tableCellRight: { fontSize: 9, color: '#334155', alignment: 'right', font: 'Roboto', margin: [10, 6, 10, 6] },
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

  // 1. Export für einen einzelnen Report
  exportReport: async ({ title, subtitle, tableHeaders, tableBody, chartBase64, chartsBase64, data }) => {
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

      // Abwärtskompatible Normalisierung zu einem einheitlichen Array
      let allCharts = [];
      if (chartsBase64 && Array.isArray(chartsBase64)) {
          allCharts = chartsBase64;
      } else if (chartBase64) {
          allCharts = [chartBase64];
      }

      // Alle Charts sequenziell in das PDF-Dokument einfügen
      if (allCharts.length > 0) {
        allCharts.forEach((chartImg, index) => {
          docContent.push({
            image: chartImg,
            fit: [740, 440],
            alignment: 'center',
            margin: [0, 10, 0, index === allCharts.length - 1 ? 0 : 20],
            // Seitenumbruch nach jedem Chart, außer nach dem letzten, sofern keine Tabelle folgt
            pageBreak: (index < allCharts.length - 1 || (tableBody && tableBody.length > 0)) ? 'after' : undefined
          });
        });
      }

      // Tabelle rendern, falls Daten vorhanden sind
      if (tableHeaders && tableBody && tableBody.length > 0) {
        const tableContent = buildTableContent(tableHeaders, tableBody);
        docContent.push({
          style: 'tableStyle',
          table: { headerRows: 1, dontBreakRows: true, widths: Array.isArray(tableHeaders) ? tableHeaders.map((_, idx) => idx === 0 ? '*' : 'auto') : [], body: tableContent },
          layout: tableLayoutConfig
        });
      }

      const docDefinition = { pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [40, 40, 40, 40], content: docContent, styles: pdfStyles, footer: function(currentPage, pageCount) { if (currentPage === 1) return null; return { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 8, color: '#94a3b8', margin: [0, 0, 40, 0] }; } };

      window.pdfMake.createPdf(docDefinition).download(`${title.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (pdfError) {
      console.error("[FinSPA PDF Engine] Fehler:", pdfError);
      alert("PDF-Erzeugung abgebrochen: " + pdfError.message);
    }
  },

  // 2. Globaler Export für alle zusammengestellten Reports
  exportAllReports: async ({ mainTitle = "Gesamtauswertung", reports = [], data }) => {
    try {
      const initialized = await PdfExportEngine.initLibraries();
      if (!initialized || !window.pdfMake) throw new Error("PDF-Bibliotheken nicht initialisiert.");

      if (!reports || reports.length === 0) {
        alert("Es wurden keine Reports für den Gesamtexport übergeben.");
        return;
      }

      const now = new Date();
      const timestampStr = `${now.toLocaleDateString('de-CH')} um ${now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr`;

      const ownerName = getOwnerName(data);
      const pdfTitleStr = (data?.settings?.pdfCompanyName || 'FINSPA PRO').toUpperCase();
      const pdfSubtitleStr = (data?.settings?.pdfSubtitle || 'ENTERPRISE ASSET MANAGEMENT & REPORTING').toUpperCase();

      // Master Deckblatt
      const docContent = [
        { text: pdfTitleStr, style: 'coverAppTitle', alignment: 'center', margin: [0, 80, 0, 5] },
        { text: pdfSubtitleStr, style: 'coverAppSubtitle', alignment: 'center', margin: [0, 0, 0, 40] },
        { canvas: [{ type: 'line', x1: 220, y1: 0, x2: 520, y2: 0, lineWidth: 1.5, lineColor: '#3b82f6' }], alignment: 'center' },
        
        { text: mainTitle.toUpperCase(), style: 'coverReportTitle', alignment: 'center', margin: [0, 60, 0, 10] },
        { text: `Umfassendes Portfolio-Dossier mit ${reports.length} Auswertungen`, style: 'coverReportSubtitle', alignment: 'center', margin: [0, 0, 0, 120] },
        
        { text: 'ERSTELLT FÜR', style: 'coverMetaLabel', alignment: 'center', margin: [0, 0, 0, 2] },
        { text: ownerName, style: 'coverMetaValue', alignment: 'center', margin: [0, 0, 0, 20] }, 
        { text: 'ZEITPUNKT DER GENERIERUNG', style: 'coverMetaLabel', alignment: 'center', margin: [0, 0, 0, 2] },
        { text: timestampStr, style: 'coverMetaValue', alignment: 'center' },
        
        { text: '', pageBreak: 'after' }
      ];

      // Alle Reports iterativ anfügen
      reports.forEach((rep, index) => {
        docContent.push({ text: rep.title.toUpperCase(), style: 'reportSectionTitle' });
        if (rep.subtitle) {
          docContent.push({ text: rep.subtitle, style: 'reportSectionSubtitle' });
        }
        
        docContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 20] });

        if (rep.chartBase64) {
          docContent.push({
            image: rep.chartBase64,
            fit: [740, 380],
            alignment: 'center',
            margin: [0, 10, 0, 20]
          });
        }

        if (rep.tableHeaders && rep.tableBody && rep.tableBody.length > 0) {
          const tableContent = buildTableContent(rep.tableHeaders, rep.tableBody);
          docContent.push({
            style: 'tableStyle',
            table: { 
              headerRows: 1, 
              dontBreakRows: true, 
              widths: Array.isArray(rep.tableHeaders) ? rep.tableHeaders.map((_, idx) => idx === 0 ? '*' : 'auto') : [], 
              body: tableContent 
            },
            layout: tableLayoutConfig
          });
        }

        if (index < reports.length - 1) {
          docContent.push({ text: '', pageBreak: 'after' });
        }
      });

      const docDefinition = { 
        pageSize: 'A4', 
        pageOrientation: 'landscape', 
        pageMargins: [40, 40, 40, 40], 
        content: docContent, 
        styles: pdfStyles, 
        footer: function(currentPage, pageCount) { 
          if (currentPage === 1) return null; 
          return { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 8, color: '#94a3b8', margin: [0, 0, 40, 0] }; 
        } 
      };

      window.pdfMake.createPdf(docDefinition).download(`FinSPA_Gesamtreport_${now.toISOString().split('T')[0]}.pdf`);
    } catch (pdfError) {
      console.error("[FinSPA PDF Engine] Fehler beim Gesamtexport:", pdfError);
      alert("Generierung des Gesamtreports fehlgeschlagen: " + pdfError.message);
    }
  }
};

module.exports = PdfExportEngine;