const React = require('react');

// Hilfsfunktion zum Laden von externen CDN-Skripten
const loadScript = (url, checkGlobal) => {
    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window[checkGlobal]) {
            return resolve(window[checkGlobal]);
        }
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => resolve(window[checkGlobal]);
        script.onerror = () => reject(new Error(`Fehler beim Laden von: ${url}`));
        document.head.appendChild(script);
    });
};

// Hilfsfunktion: Konvertiert ein Blob sicher in einen Base64-String (für Android / Capacitor Filesystem)
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const PdfToolkit = {
    /**
     * Universeller Datei-Export für Android (Capacitor / WebView) & Desktop
     */
    saveOrSharePdf: async (blob, fileName, mimeType = 'application/pdf') => {
        if (typeof window !== 'undefined' && typeof window.finbundleSaveOrShare === 'function') {
            return await window.finbundleSaveOrShare(blob, fileName, mimeType);
        }

        const isAndroid = typeof window !== 'undefined' && (
            /android/i.test(navigator.userAgent || '') ||
            (window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'android') ||
            new URLSearchParams(window.location.search).get('android') === 'true'
        );
        const isCapacitor = typeof window !== 'undefined' && Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

        if (isCapacitor) {
            try {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                const base64Data = await blobToBase64(blob);
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents
                });

                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast(`Gespeichert unter Dokumente: ${fileName}`, "success");
                }

                try {
                    const { Share } = await import('@capacitor/share');
                    if (Share && typeof Share.share === 'function' && savedFile?.uri) {
                        await Share.share({
                            title: fileName,
                            url: savedFile.uri,
                            dialogTitle: 'PDF öffnen oder teilen'
                        });
                        return true;
                    }
                } catch (sharePluginErr) {}

                if (typeof navigator !== 'undefined' && navigator.canShare) {
                    const file = new File([blob], fileName, { type: mimeType });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: fileName, files: [file] });
                    }
                }
                return true;
            } catch (capErr) {
                console.warn("[PdfToolkit] Capacitor Filesystem Fallback:", capErr);
            }
        }

        if (isAndroid && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
            try {
                const file = new File([blob], fileName, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: fileName,
                        text: 'FinBundle Pro Export',
                        files: [file]
                    });
                    if (typeof window !== 'undefined' && window.showToast) {
                        window.showToast("PDF erfolgreich übergeben", "success");
                    }
                    return true;
                }
            } catch (shareErr) {
                if (shareErr && shareErr.name === 'AbortError') return false;
                console.warn("[PdfToolkit] Web Share API Fallback:", shareErr);
            }
        }

        if (isAndroid) {
            try {
                const base64Data = await blobToBase64(blob);
                const dataUrl = `data:${mimeType};base64,${base64Data}`;
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast(`Download gestartet: ${fileName}`, "success");
                }
                return true;
            } catch (e) {
                console.warn("[PdfToolkit] Data-URL Fallback fehlgeschlagen:", e);
            }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast("PDF erfolgreich exportiert", "success");
        }
        return true;
    },

    /**
     * Zeichnet das FinBundle / FinSPA Logo als native Vektorgrafik
     */
    drawFinSpaLogo: (doc, x, y, scale = 1) => {
        doc.save();
        doc.translate(x, y).scale(scale);
        
        doc.circle(50, 50, 44).lineWidth(5).strokeColor('#2563eb').stroke();
        doc.path('M 28 62 L 42 72 L 68 42').lineWidth(6).lineCap('round').lineJoin('round').strokeColor('#10b981').stroke();
        doc.path('M 54 42 L 68 42 L 68 56').lineWidth(6).lineCap('round').lineJoin('round').strokeColor('#10b981').stroke();
        doc.roundedRect(36, 32, 7, 7, 2).fill('#10b981');
        doc.roundedRect(52, 22, 7, 7, 2).fill('#10b981');
        
        doc.restore();
    },

    /**
     * Zeichnet KPI-Karten als gestochen scharfe Vektoren
     */
    drawKPIs: (doc, kpis, startY) => {
        if (!kpis || kpis.length === 0) return startY;
        const margin = 40;
        const usableWidth = doc.page.width - (2 * margin);
        const count = Math.min(kpis.length, 6);
        const gap = 14;
        const boxWidth = (usableWidth - (gap * (count - 1))) / count;
        const boxHeight = count > 4 ? 70 : 78;
        const defaultColors = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4'];

        kpis.slice(0, count).forEach((kpi, index) => {
            const x = margin + (index * (boxWidth + gap));
            const barColor = kpi.color || defaultColors[index % defaultColors.length];
            
            doc.roundedRect(x, startY, boxWidth, boxHeight, 8).fill('#ffffff');
            doc.roundedRect(x, startY, boxWidth, boxHeight, 8).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
            
            doc.save();
            doc.roundedRect(x, startY, boxWidth, boxHeight, 8).clip();
            doc.rect(x, startY, boxWidth, 4).fill(barColor);
            doc.restore();

            doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(count > 4 ? 7.5 : 8);
            doc.text(String(kpi.label || '').toUpperCase(), x + 10, startY + 12, { width: boxWidth - 20, lineBreak: false, ellipsis: true });

            doc.fillColor(kpi.textColor || '#0f172a').font('Helvetica-Bold').fontSize(count > 4 ? 12.5 : 14);
            doc.text(String(kpi.value || ''), x + 10, startY + 28, { width: boxWidth - 20, lineBreak: false, ellipsis: true });

            if (kpi.sub) {
                doc.fillColor('#64748b').font('Helvetica').fontSize(count > 4 ? 7 : 7.5);
                doc.text(String(kpi.sub), x + 10, startY + 52, { width: boxWidth - 20, lineBreak: false, ellipsis: true });
            }
        });

        return startY + boxHeight + 22;
    },

    /**
     * Zeichnet Simulationsparameter und Modellannahmen als strukturierte Spaltenkacheln
     */
    drawParameters: (doc, parameters, startY) => {
        if (!parameters || parameters.length === 0) return startY;
        const margin = 40;
        const usableWidth = doc.page.width - (2 * margin);

        let groups = [];
        if (parameters[0] && Array.isArray(parameters[0].items)) {
            groups = parameters;
        } else {
            const groupMap = {};
            parameters.forEach(p => {
                const gName = p.group || 'Simulationsparameter & Annahmen';
                if (!groupMap[gName]) groupMap[gName] = [];
                groupMap[gName].push({ label: p.label || '', value: p.value || '', sub: p.sub || '' });
            });
            groups = Object.keys(groupMap).map(g => ({ group: g, items: groupMap[g] }));
        }

        doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(10);
        doc.text("AKTIVE SIMULATIONSPARAMETER & MODELLANNAHMEN", margin, startY, { characterSpacing: 0.8 });
        doc.moveTo(margin, startY + 15).lineTo(margin + usableWidth, startY + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

        let currentY = startY + 22;
        const cols = Math.min(groups.length, 3);
        const gap = 16;
        // Bei nur 1 Parametergruppe die Kachelbreite auf max. 360pt begrenzen für saubere Lesbarkeit
        const colWidth = cols === 1 ? Math.min(usableWidth, 360) : (usableWidth - (gap * (cols - 1))) / cols;
        const rowHeight = 20;
        const headerHeight = 24;

        let maxColHeight = 0;
        groups.slice(0, cols).forEach((grp) => {
            const h = headerHeight + (grp.items.length * rowHeight) + 8;
            if (h > maxColHeight) maxColHeight = h;
        });

        if (currentY + maxColHeight > doc.page.height - 50) {
            return currentY;
        }

        groups.slice(0, cols).forEach((grp, idx) => {
            const x = margin + (idx * (colWidth + gap));
            const cardHeight = headerHeight + (grp.items.length * rowHeight) + 8;

            doc.roundedRect(x, currentY, colWidth, cardHeight, 6).fill('#ffffff');
            doc.roundedRect(x, currentY, colWidth, cardHeight, 6).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            doc.save();
            doc.roundedRect(x, currentY, colWidth, cardHeight, 6).clip();
            doc.rect(x, currentY, colWidth, headerHeight).fill('#f8fafc');
            doc.moveTo(x, currentY + headerHeight).lineTo(x + colWidth, currentY + headerHeight).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
            doc.restore();

            doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8);
            doc.text(String(grp.group || '').toUpperCase(), x + 12, currentY + 8, { width: colWidth - 24, lineBreak: false, ellipsis: true });

            let itemY = currentY + headerHeight + 6;
            grp.items.forEach((item, itemIdx) => {
                const labelWidth = (colWidth - 24) * 0.55;
                const valWidth = (colWidth - 24) * 0.45;

                doc.fillColor('#64748b').font('Helvetica').fontSize(8);
                doc.text(String(item.label || ''), x + 12, itemY, { width: labelWidth, lineBreak: false, ellipsis: true });

                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
                doc.text(String(item.value || ''), x + 12 + labelWidth, itemY, { width: valWidth, align: 'right', lineBreak: false, ellipsis: true });

                if (itemIdx < grp.items.length - 1) {
                    doc.moveTo(x + 12, itemY + 14).lineTo(x + colWidth - 12, itemY + 14).lineWidth(0.25).strokeColor('#f1f5f9').stroke();
                }
                itemY += rowHeight;
            });
        });

        return currentY + maxColHeight + 25;
    },

    /**
     * Diagramme erfassen
     */
    captureCharts: async (containerRef, isDarkTheme = false) => {
        if (!containerRef) return [];
        const chartsData = [];
        const bgColor = isDarkTheme ? '#0f172a' : '#ffffff';
        const chartBlocks = containerRef.querySelectorAll('.chart-export-block');
        
        for (let i = 0; i < chartBlocks.length; i++) {
            const titleFallback = chartBlocks[i].getAttribute('data-pdf-title') || '';
            const chartDiv = chartBlocks[i].querySelector('.universal-chart-wrapper > div');
            
            if (chartDiv && window.echarts) {
                const chartInstance = window.echarts.getInstanceByDom(chartDiv);
                if (chartInstance) {
                    const origWidth = chartInstance.getWidth();
                    const origHeight = chartInstance.getHeight();
                    const currentOption = chartInstance.getOption();
                    
                    chartInstance.resize({ width: 850, height: 480 });

                    const isPie = currentOption.series && currentOption.series[0] && (currentOption.series[0].type === 'pie');
                    const isDoughnut = isPie && currentOption.series[0].radius && Array.isArray(currentOption.series[0].radius);
                    
                    chartInstance.setOption({
                        legend: {
                            show: true,
                            type: 'plain',
                            orient: 'horizontal',
                            left: 'center',
                            bottom: 12,
                            width: 780,
                            itemGap: 24,
                            itemWidth: 12,
                            itemHeight: 12,
                            textStyle: {
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                fontSize: 10,
                                color: isDarkTheme ? '#cbd5e1' : '#334155',
                                padding: [0, 10, 0, 2]
                            }
                        },
                        series: isPie ? [{
                            center: ['50%', '36%'],
                            radius: isDoughnut ? ['30%', '54%'] : '54%'
                        }] : undefined,
                        animation: false
                    });
                    
                    const imgData = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: bgColor });
                    
                    chartInstance.setOption(currentOption, true);
                    chartInstance.resize({ width: origWidth, height: origHeight });
                    
                    chartsData.push({ title: titleFallback, image: imgData });
                    continue;
                }
            }
        }
        return chartsData;
    },

    /**
     * Berechnet intelligente Spaltenbreiten & Ausrichtungen anhand von Headern und Zelleninhalt
     */
    _computeSmartTableLayout: (headers, body, usableWidth, colWidthsPct, colAligns) => {
        const numCols = headers && headers.length > 0 ? headers.length : (body?.[0] ? body[0].length : 1);
        const sampleRows = (body || []).slice(0, 25);

        const isNumericLike = (str) => {
            const s = String(str || '').trim();
            if (!s || s === '-' || s === '--') return false;
            return /^[-+−]?\s*(?:CHF|EUR|USD|GBP|€|\$)?\s*[\d.,']+\s*(?:%|CHF|EUR|USD|GBP|€|\$)?$/i.test(s);
        };

        const isCurrencyCodeLike = (str) => /^[A-Z]{3}$/.test(String(str || '').trim());

        // 1. Spaltenausrichtung (Alignments)
        let resolvedAligns = [];
        if (Array.isArray(colAligns) && colAligns.length === numCols) {
            resolvedAligns = colAligns;
        } else {
            for (let c = 0; c < numCols; c++) {
                if (c === 0) {
                    resolvedAligns.push('left');
                    continue;
                }
                let numCount = 0;
                let codeCount = 0;
                let nonEmpty = 0;
                sampleRows.forEach(r => {
                    const raw = typeof r[c] === 'object' && r[c] !== null ? r[c].text : r[c];
                    const val = String(raw || '').trim();
                    if (val) {
                        nonEmpty++;
                        if (isNumericLike(val)) numCount++;
                        if (isCurrencyCodeLike(val)) codeCount++;
                    }
                });
                if (nonEmpty > 0 && numCount / nonEmpty >= 0.6) {
                    resolvedAligns.push('right');
                } else if (nonEmpty > 0 && codeCount / nonEmpty >= 0.6) {
                    resolvedAligns.push('center');
                } else {
                    resolvedAligns.push('left');
                }
            }
        }

        // 2. Spaltenbreiten (Widths)
        let colWidths = [];
        if (Array.isArray(colWidthsPct) && colWidthsPct.length === numCols) {
            colWidths = colWidthsPct.map(pct => usableWidth * pct);
        } else {
            const weights = [];
            for (let c = 0; c < numCols; c++) {
                const headerLen = String(headers?.[c] || '').length;
                let maxCellLen = 0;
                sampleRows.forEach(r => {
                    const raw = typeof r[c] === 'object' && r[c] !== null ? r[c].text : r[c];
                    const len = String(raw || '').length;
                    if (len > maxCellLen) maxCellLen = len;
                });

                // Erste Spalte (Asset/Titel) bekommt grosszügigen Platz, kompakte Code-Spalten (z. B. Währung) weniger
                let effectiveLen = Math.max(headerLen * 0.9, Math.min(maxCellLen, c === 0 ? 34 : 22));
                if (c === 0) effectiveLen = Math.max(effectiveLen, 22);
                if (resolvedAligns[c] === 'center' && maxCellLen <= 5) effectiveLen = Math.min(effectiveLen, 9);
                weights.push(Math.max(effectiveLen, 7));
            }
            const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
            colWidths = weights.map(w => (w / totalWeight) * usableWidth);
        }

        return { colWidths, resolvedAligns, numCols };
    },

    /**
     * Universelle Tabellen-Engine mit Paginierung & dynamischem Spalten-Layout
     */
    drawTable: (doc, headers, body, startY, colWidthsPct, colAligns, addPageCallback) => {
        const margin = 40;
        const usableWidth = doc.page.width - (2 * margin);
        const { colWidths, resolvedAligns, numCols } = PdfToolkit._computeSmartTableLayout(headers, body, usableWidth, colWidthsPct, colAligns);

        const headerHeight = 26;
        const rowHeight = 22;
        let currentY = startY;

        const getX = (colIndex) => margin + colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0);

        const drawHeaders = () => {
            doc.rect(margin, currentY, usableWidth, headerHeight).fill('#0f172a');
            headers.forEach((h, i) => {
                const align = resolvedAligns[i] || 'left';
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.2);
                doc.text(String(h || ''), getX(i) + 6, currentY + 8, {
                    width: colWidths[i] - 12,
                    align: align,
                    lineBreak: false,
                    ellipsis: true
                });
            });
            currentY += headerHeight;
        };

        if (headers && headers.length > 0) {
            if (currentY + headerHeight > doc.page.height - 60) {
                currentY = addPageCallback();
            }
            drawHeaders();
        }

        if (body && body.length > 0) {
            body.forEach((row, rowIndex) => {
                if (currentY + rowHeight > doc.page.height - 55) {
                    currentY = addPageCallback();
                    if (headers && headers.length > 0) drawHeaders();
                }
                
                let isTotal = false;
                if (row[0]) {
                    const firstCellText = String(typeof row[0] === 'object' ? row[0].text : row[0]).toLowerCase().trim();
                    isTotal = firstCellText === 'total' || 
                              firstCellText === 'gesamt' || 
                              firstCellText === 'summe' || 
                              firstCellText === 'portfolio' || 
                              firstCellText.startsWith('total ') || 
                              firstCellText.startsWith('gesamt ');
                }
                
                const bgColor = isTotal ? '#f1f5f9' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
                
                doc.rect(margin, currentY, usableWidth, rowHeight).fill(bgColor);
                doc.moveTo(margin, currentY).lineTo(margin + usableWidth, currentY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

                row.forEach((cell, colIndex) => {
                    let text = '';
                    let overrideColor = null;
                    let overrideBold = false;

                    if (typeof cell === 'object' && cell !== null) {
                        text = String(cell.text || '');
                        if (cell.color) overrideColor = cell.color;
                        if (cell.bold) overrideBold = true;
                    } else {
                        text = String(cell ?? '');
                    }

                    const align = resolvedAligns[colIndex] || (colIndex === numCols - 1 ? 'right' : 'left');
                    let textColor = overrideColor || (colIndex === 0 ? '#0f172a' : '#334155');
                    const fontStyle = (isTotal || overrideBold || colIndex === 0) ? 'Helvetica-Bold' : 'Helvetica';

                    if (!overrideColor && align === 'right' && /^[-+−]?\s*(?:CHF|€|\$)?\s*[-+−]?\s*\d/.test(text.trim())) {
                        if (text.includes('-') || text.includes('−')) textColor = '#ef4444'; 
                        else if (text.includes('+') || text.toLowerCase().includes('gewinn')) textColor = '#10b981'; 
                    }

                    doc.fillColor(textColor).font(fontStyle).fontSize(8.5);
                    doc.text(text, getX(colIndex) + 6, currentY + 6.5, { 
                        width: colWidths[colIndex] - 12, 
                        align: align,
                        lineBreak: false,
                        ellipsis: true
                    });
                });

                currentY += rowHeight;
            });
            doc.moveTo(margin, currentY).lineTo(margin + usableWidth, currentY).lineWidth(1).strokeColor('#cbd5e1').stroke();
        }

        return currentY;
    },

    /**
     * Erstellt das Deckblatt im Enterprise-Design (mit dynamischer Höhenberechnung für mehrzeilige Titel)
     */
    drawCoverPage: (doc, title, subtitle, data) => {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const textMargin = 65;
        const maxTextWidth = pageWidth - (textMargin * 2);
        const settings = data?.settings || {};
        
        let pdfTitleStr = (settings.pdfCompanyName || 'FINBUNDLE PRO').toUpperCase();
        if (pdfTitleStr === 'FINSPA PRO') pdfTitleStr = 'FINBUNDLE PRO';
        const pdfSubtitleStr = (settings.pdfSubtitle || 'ENTERPRISE ASSET MANAGEMENT & REPORTING').toUpperCase();
        const ownerName = settings.userName || settings.ownerName || 'THOMAS KERLE';
        
        const now = new Date();
        const timestampStr = `${now.toLocaleDateString('de-CH')} um ${now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr`;

        PdfToolkit.drawFinSpaLogo(doc, (pageWidth / 2) - 50, 85, 1);
        
        doc.fontSize(28).font("Helvetica-Bold").fillColor('#0f172a').text(pdfTitleStr, textMargin, 225, { width: maxTextWidth, align: 'center', characterSpacing: 3 });
        doc.fontSize(11).font("Helvetica-Bold").fillColor('#94a3b8').text(pdfSubtitleStr, textMargin, 265, { width: maxTextWidth, align: 'center', characterSpacing: 1.5 });
        doc.moveTo((pageWidth / 2) - 150, 300).lineTo((pageWidth / 2) + 150, 300).lineWidth(1.5).strokeColor('#3b82f6').stroke();
        
        const reportTitle = String(title || '').toUpperCase();
        doc.fontSize(22).font("Helvetica-Bold").fillColor('#1e3a8a');
        const titleHeight = doc.heightOfString(reportTitle, { width: maxTextWidth, align: 'center', characterSpacing: 0.8 });
        doc.text(reportTitle, textMargin, 335, { width: maxTextWidth, align: 'center', characterSpacing: 0.8 });
        
        const subtitleY = 335 + titleHeight + 14;
        doc.fontSize(13).font("Helvetica").fillColor('#475569').text(subtitle || '', textMargin, subtitleY, { width: maxTextWidth, align: 'center' });
        
        doc.fontSize(9).font("Helvetica-Bold").fillColor('#94a3b8').text("ERSTELLT FÜR", textMargin, pageHeight - 120, { width: maxTextWidth, align: 'center', characterSpacing: 1 });
        doc.fontSize(12).font("Helvetica-Bold").fillColor('#334155').text(String(ownerName).toUpperCase(), textMargin, pageHeight - 105, { width: maxTextWidth, align: 'center' });
        
        doc.fontSize(9).font("Helvetica-Bold").fillColor('#94a3b8').text("ZEITPUNKT DER GENERIERUNG", textMargin, pageHeight - 70, { width: maxTextWidth, align: 'center', characterSpacing: 1 });
        doc.fontSize(12).font("Helvetica-Bold").fillColor('#334155').text(timestampStr, textMargin, pageHeight - 55, { width: maxTextWidth, align: 'center' });
    },

    /**
     * Schreibt die einheitliche Fußzeile mit exakter Paginierung
     */
    applyFooter: (doc) => {
        const margin = 40;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const totalPages = doc.bufferedPageRange().count;

        for (let i = 1; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.moveTo(margin, pageHeight - 35).lineTo(pageWidth - margin, pageHeight - 35).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
            doc.fontSize(8).font("Helvetica").fillColor('#94a3b8');
            doc.text("Generiert von FinBundle Pro", margin, pageHeight - 25, { lineBreak: false });
            doc.text(`Seite ${i} von ${totalPages - 1}`, pageWidth - margin - 100, pageHeight - 25, { width: 100, align: 'right', lineBreak: false });
        }
    },

    /**
     * Universeller Einzel-Export (Android & Desktop kompatibel)
     */
    exportReport: async (config) => {
        try {
            if (typeof window !== 'undefined' && window.showToast) window.showToast("PDF-Dokument wird generiert...", "info");

            await loadScript('https://cdn.jsdelivr.net/npm/pdfkit@0.15.0/js/pdfkit.standalone.js', 'PDFDocument');
            const PDFDocument = window.PDFDocument;
            if (!PDFDocument) throw new Error("PDFKit konnte nicht geladen werden.");

            const doc = new PDFDocument({ 
                margin: 40, 
                margins: { top: 40, bottom: 0, left: 40, right: 40 },
                size: 'A4', 
                layout: 'landscape',
                autoFirstPage: true,
                bufferPages: true,
                autoPageBreak: false 
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', async () => {
                const blob = new Blob(chunks, { type: 'application/pdf' });
                const fileName = `${String(config.title || 'FinBundle').replace(/\s+/g, '_')}_Report.pdf`;
                await PdfToolkit.saveOrSharePdf(blob, fileName, 'application/pdf');
            });

            const margin = 40;
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;

            // Seite 1: Deckblatt
            PdfToolkit.drawCoverPage(doc, config.title, config.subtitle, config.data);

            const addContentPage = () => {
                doc.addPage({ margins: { top: 40, bottom: 0, left: 40, right: 40 }, size: 'A4', layout: 'landscape' });
                let y = margin;
                doc.fontSize(17).font("Helvetica-Bold").fillColor('#1e3a8a').text(config.title, margin, y, { width: pageWidth - (margin * 2), lineBreak: false, ellipsis: true });
                y += 22;
                doc.fontSize(10).font("Helvetica").fillColor('#64748b').text(config.subtitle || '', margin, y, { width: pageWidth - (margin * 2), lineBreak: false, ellipsis: true });
                y += 15;
                doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
                y += 22;
                return y;
            };

            // Seite 2: Executive Summary (KPIs & Simulationsparameter)
            const hasKpis = config.kpis && config.kpis.length > 0;
            const hasParams = config.parameters && config.parameters.length > 0;

            if (hasKpis || hasParams) {
                let currentY = addContentPage();
                
                if (hasKpis) {
                    currentY = PdfToolkit.drawKPIs(doc, config.kpis, currentY + 6);
                }
                
                if (hasParams) {
                    if (currentY + 140 > pageHeight - 50) {
                        currentY = addContentPage();
                    }
                    currentY = PdfToolkit.drawParameters(doc, config.parameters, currentY + 5);
                }
            }

            // Seite 3+: Diagramm-Seite(n)
            if (config.chartsData && config.chartsData.length > 0) {
                let currentY = addContentPage();

                for (let i = 0; i < config.chartsData.length; i += 2) {
                    const c1 = config.chartsData[i];
                    const c2 = config.chartsData[i + 1];
                    const hasTwo = !!c2;

                    const chartWidth = hasTwo ? (pageWidth - (margin * 2) - 30) / 2 : (pageWidth - (margin * 2)) * 0.65;
                    const startX1 = hasTwo ? margin : (pageWidth - chartWidth) / 2;
                    const startX2 = hasTwo ? margin + chartWidth + 30 : 0;

                    let maxH = 0;
                    if (c1 && c1.image) {
                        const imgObj1 = doc.openImage(c1.image);
                        maxH = Math.max(maxH, (chartWidth / imgObj1.width) * imgObj1.height + 24);
                    }
                    if (c2 && c2.image) {
                        const imgObj2 = doc.openImage(c2.image);
                        maxH = Math.max(maxH, (chartWidth / imgObj2.width) * imgObj2.height + 24);
                    }

                    if (currentY + maxH > pageHeight - 55) {
                        currentY = addContentPage();
                    }

                    if (c1) {
                        if (c1.title) doc.fontSize(10.5).font("Helvetica-Bold").fillColor('#1e3a8a').text(c1.title, startX1, currentY, { width: chartWidth, align: 'center', lineBreak: false, ellipsis: true });
                        if (c1.image) doc.image(c1.image, startX1, currentY + 15, { width: chartWidth });
                    }

                    if (c2) {
                        if (c2.title) doc.fontSize(10.5).font("Helvetica-Bold").fillColor('#1e3a8a').text(c2.title, startX2, currentY, { width: chartWidth, align: 'center', lineBreak: false, ellipsis: true });
                        if (c2.image) doc.image(c2.image, startX2, currentY + 15, { width: chartWidth });
                    }

                    currentY += maxH + 22;
                }
            }

            // Tabellen-Start auf separater Folgeseite
            if (config.tableBody && config.tableBody.length > 0) {
                let currentY = addContentPage();
                PdfToolkit.drawTable(doc, config.tableHeaders, config.tableBody, currentY, config.colWidthsPct, config.colAligns, addContentPage);
            }

            PdfToolkit.applyFooter(doc);
            doc.end();

        } catch (error) {
            console.error("[PdfToolkit] Fehler beim PDF Export:", error);
            if (typeof window !== 'undefined' && window.showToast) window.showToast(`Fehler beim PDF Export: ${error.message}`, "error");
        }
    },

    /**
     * Universeller Batch-Export für FullPdfOrchestrator (Android & Desktop kompatibel)
     */
    exportCombinedReport: async (mainTitle, reportsDataArray, data) => {
        try {
            if (typeof window !== 'undefined' && window.showToast) window.showToast("Erstelle Gesamtreport...", "info");

            await loadScript('https://cdn.jsdelivr.net/npm/pdfkit@0.15.0/js/pdfkit.standalone.js', 'PDFDocument');
            const PDFDocument = window.PDFDocument;
            if (!PDFDocument) throw new Error("PDFKit konnte nicht geladen werden.");

            const doc = new PDFDocument({ 
                margin: 40, 
                margins: { top: 40, bottom: 0, left: 40, right: 40 },
                size: 'A4', 
                layout: 'landscape',
                autoFirstPage: true,
                bufferPages: true,
                autoPageBreak: false 
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', async () => {
                const blob = new Blob(chunks, { type: 'application/pdf' });
                const fileName = `FinBundle_Gesamtreport_${new Date().toISOString().split('T')[0]}.pdf`;
                await PdfToolkit.saveOrSharePdf(blob, fileName, 'application/pdf');
            });

            const margin = 40;
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;

            PdfToolkit.drawCoverPage(doc, mainTitle, "KONSOLIDIERTER PORTFOLIO GESAMTREPORT", data);

            reportsDataArray.forEach(report => {
                if (!report) return;

                const addSectionPage = () => {
                    doc.addPage({ margins: { top: 40, bottom: 0, left: 40, right: 40 }, size: 'A4', layout: 'landscape' });
                    let y = margin;
                    doc.fontSize(17).font("Helvetica-Bold").fillColor('#1e3a8a').text(report.title, margin, y, { width: pageWidth - (margin * 2), lineBreak: false, ellipsis: true });
                    y += 22;
                    doc.fontSize(10).font("Helvetica").fillColor('#64748b').text(report.subtitle || '', margin, y, { width: pageWidth - (margin * 2), lineBreak: false, ellipsis: true });
                    y += 15;
                    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
                    y += 22;
                    return y;
                };

                const hasKpis = report.kpis && report.kpis.length > 0;
                const hasParams = report.parameters && report.parameters.length > 0;

                if (hasKpis || hasParams) {
                    let y = addSectionPage();
                    if (hasKpis) y = PdfToolkit.drawKPIs(doc, report.kpis, y + 6);
                    if (hasParams) {
                        if (y + 140 > pageHeight - 50) y = addSectionPage();
                        y = PdfToolkit.drawParameters(doc, report.parameters, y + 5);
                    }
                }

                if (report.chartsData && report.chartsData.length > 0) {
                    let y = addSectionPage();
                    for (let i = 0; i < report.chartsData.length; i += 2) {
                        const c1 = report.chartsData[i];
                        const c2 = report.chartsData[i + 1];
                        const hasTwo = !!c2;
                        const chartWidth = hasTwo ? (pageWidth - (margin * 2) - 30) / 2 : (pageWidth - (margin * 2)) * 0.65;
                        const startX1 = hasTwo ? margin : (pageWidth - chartWidth) / 2;
                        const startX2 = hasTwo ? margin + chartWidth + 30 : 0;
                        let maxH = 0;

                        if (c1 && c1.image) {
                            const imgObj1 = doc.openImage(c1.image);
                            maxH = Math.max(maxH, (chartWidth / imgObj1.width) * imgObj1.height + 24);
                        }
                        if (c2 && c2.image) {
                            const imgObj2 = doc.openImage(c2.image);
                            maxH = Math.max(maxH, (chartWidth / imgObj2.width) * imgObj2.height + 24);
                        }
                        if (y + maxH > pageHeight - 55) y = addSectionPage();

                        if (c1) {
                            if (c1.title) doc.fontSize(10.5).font("Helvetica-Bold").fillColor('#1e3a8a').text(c1.title, startX1, y, { width: chartWidth, align: 'center', lineBreak: false, ellipsis: true });
                            if (c1.image) doc.image(c1.image, startX1, y + 15, { width: chartWidth });
                        }

                        if (c2) {
                            if (c2.title) doc.fontSize(10.5).font("Helvetica-Bold").fillColor('#1e3a8a').text(c2.title, startX2, y, { width: chartWidth, align: 'center', lineBreak: false, ellipsis: true });
                            if (c2.image) doc.image(c2.image, startX2, y + 15, { width: chartWidth });
                        }
                        y += maxH + 22;
                    }
                }

                if (report.tableBody && report.tableBody.length > 0) {
                    let y = addSectionPage();
                    PdfToolkit.drawTable(doc, report.tableHeaders, report.tableBody, y, report.colWidthsPct, report.colAligns, addSectionPage);
                }
            });

            PdfToolkit.applyFooter(doc);
            doc.end();

        } catch (err) {
            console.error("[PdfToolkit] Fehler beim Gesamtexport:", err);
            if (typeof window !== 'undefined' && window.showToast) window.showToast(`Fehler beim Gesamtexport: ${err.message}`, "error");
        }
    }
};

module.exports = PdfToolkit;