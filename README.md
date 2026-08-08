🏔️ FinBundle Pro
FinBundle Pro ist eine ganzheitliche, Offline-First-Anwendung zur persönlichen Finanz- und Vermögensplanung. Sie bündelt Portfolio-Tracking, Budgetierung, Cashflow-Analyse, Marktdaten-Synchronisierung und FIRE-Simulationen (Financial Independence, Retire Early) in einem sicheren, lokalen Umfeld – ohne Cloud-Zwang für Ihre persönlichen Daten.

✨ Kernfunktionen
🌐 API LiveEditor & Marktdaten-Zentrale
Bulk-Sync: Automatisierter Abruf von tagesaktuellen EOD-Kursen (End of Day) und zugehörigen Wechselkursen für das gesamte Portfolio in einem Rutsch.

Fundamentaldaten & Dividenden: Auf Knopfdruck Anzeige von Dividendenrendite, Ex-Datum, KGV (P/E), EPS, Marktkapitalisierung und 52-Wochen-Hoch/Tief.

Performance Analyser: Interaktive historische Charts (relativ/absolut) und Echtzeit-Intraday-Daten inklusive technischer Indikatoren (SMA, EMA, Bollinger Bänder).

Intelligentes Caching: Maximale Effizienz und Schonung von API-Limits durch lokales Zwischenspeichern von Kursen und Metriken.

📊 Vermögensverwaltung & Portfolio-Tracking
Ganzheitlicher Ansatz: Verwaltung von Bargeld, Aktien, ETFs, Krypto, Immobilien, Hypotheken und Schweizer Spezialitäten wie Säule 3a & Pensionskassen.

Multi-Währung: Native Unterstützung von Fremdwährungen mit automatischer Umrechnung (Live & Historisch via Frankfurter API).

Dividenden-Kalender: Prognose des passiven Einkommens (Forward Yield), Berechnung der Netto-Ausschüttungen und Steuerabzüge.

💰 Budgetierung & Cashflow
Regelbasierte Budgets: Einnahmen, Fixkosten, Lifestyle und Sparquoten aufteilen nach der 50/30/20-Regel.

Zahlungsströme: Detaillierte Analyse des Netto-Cashflows über verschiedene Frequenzen (monatlich, quartalsweise, jährlich).

📈 Reports & Analysen (Exportierbar)
Asset Overview: Konsolidierte Übersicht der Banken und Kategorien.

Waterfall-Analyse: Brücke zwischen Start- und Endvermögen (Markteffekte vs. Cashflow).

Steuerreport: Stichtagsbezogene Auswertung (z.B. per 31.12.) für die Steuererklärung.

Simulation & FIRE: Zukunftsszenarien, exponentielles Wachstum und Zielerreichung berechnen.

PDF- & Excel-Export: Alle Reports können als professionell aufbereitete PDF-Dokumente (inkl. ECharts) oder nach .xlsx exportiert werden.

🔒 Privacy & Datenhoheit
100% Lokal: Alle sensiblen Finanzdaten bleiben auf Ihrem Gerät (localStorage / lokales Dateisystem).

AES-Verschlüsselung: Projekte lassen sich als verschlüsselte .zip-Archive (via CryptoJS) mit PIN-Schutz exportieren und sichern.

Offene Standards: Import von CSV-Daten (z.B. aus Parqet) und Export der Buchungsjournale.

🤖 Lokale KI-Integration
KI-Copilot: Anbindung an lokale LLMs (z.B. Ollama) für automatische Kategorisierung und intelligente Abfragen komplett offline.

PDF-Scanner: KI-gestützte Textextraktion aus hochgeladenen Rechnungen und Bankbelegen.

🛠️ Tech Stack
Frontend: React (JSX)

Styling: Tailwind CSS (Nativer Dark Mode / Light Mode)

Charts: ECharts (echarts.min.js)

Daten-Schnittstellen (APIs):

EODHD / Alpha Vantage: Für Real-Time / EOD-Kurse, Intraday-Charts und Fundamentaldaten

Frankfurter API: Für historische und aktuelle FX-Wechselkurse

PDF- & Excel-Generierung: pdfMake, html2canvas, exceljs

Security & Zip: CryptoJS & JSZip

i18n: Integrierte Lokalisierung (Deutsch, Englisch, Französisch, Italienisch)
