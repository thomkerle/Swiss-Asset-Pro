FinBundle PRO garantiert vollständige Datenportabilität und Interoperabilität durch die konsequente Nutzung offener Datenstandards[cite: 1]. Das System ermöglicht einen reibungslosen Umzug aus bestehenden Tools und bietet umfangreiche Reporting-Exporte für externe Parteien (wie z. B. Steuerämter).

### 📥 Datenimport (Migration & Erfassung)

Das System bietet verschiedene Wege, um historische oder laufende Transaktionen effizient zu erfassen:

*   **Parqet CSV Import:** Ein spezialisierter Migrations-Assistent, der Wertpapierkäufe, Dividenden und Bankknoten automatisiert aus Parqet-CSV-Exporten einliest[cite: 1]. Dieser Import ist direkt über das Hauptmenü unter `Datei ➔ Importieren ➔ Parqet Daten importieren` zugänglich[cite: 9].
*   **Standard CSV Assistent:** Für den Import allgemeiner Buchungsdaten steht ein geführter CSV-Wizard zur Verfügung, der sich flexibel an verschiedene Spaltenformate anpassen lässt[cite: 9].
*   **KI-gestützter PDF-Scanner (PII-Gate):** Bankbelege und Rechnungen können als PDF eingelesen werden[cite: 1, 9]. Um die Privatsphäre zu wahren, durchlaufen die Dokumente ein clientseitiges PII-Gate (Personally Identifiable Information)[cite: 1]. Dieser lokale Regex-Filter anonymisiert sensible Daten wie Namen, IBANs und Adressen, bevor die Zahlenwerte an eine KI zur automatischen Buchungserkennung übergeben werden[cite: 1].

### 📤 Datenexport & Reporting

Für die Weitergabe von Finanzdaten, Backups oder die Steuererklärung stehen leistungsstarke Export-Engines zur Verfügung:

*   **ExcelJS Export (.xlsx):** Die integrierte Excel-Engine generiert lokal ein professionelles, mehrteiliges Workbook[cite: 1, 13]. Es umfasst ein aggregiertes Dashboard-Sheet sowie dedizierte Detailblätter für jede angelegte Bank[cite: 13]. Das Exportmodul übernimmt dabei Formatierungen, Währungssymbole, Formeln und bedingte Color-Codings nativ in die Excel-Datei[cite: 13].
*   **Native Vektor-PDFs (PdfToolkit):** Im Gegensatz zu einfachen Screenshots nutzt FinBundle PRO eine native Engine, die PDFs clientseitig als scharfe Vektordokumente zeichnet[cite: 12]. Nutzer können einzelne Reports oder einen konsolidierten Gesamtreport exportieren[cite: 9, 12]. Die PDFs beinhalten formatierte KPIs, hochauflösende Charts und saubere, paginierte Datentabellen mit Kopf- und Fußzeilen[cite: 12].
*   **CSV Buchungsjournal:** Die komplette Transaktionshistorie kann als tabellarische CSV-Datei für die freie Weiterverarbeitung exportiert werden[cite: 9].
*   **JSON Raw Backup:** Für die revisionssichere Kaltarchivierung oder tiefgreifende Analysen erlaubt das System den direkten Export des unverschlüsselten, rohen JSON-State-Objekts[cite: 1].
