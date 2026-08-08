# 🏔️ FinBundle Pro

**FinBundle Pro** ist eine moderne, hochgradig interaktive Single Page Application (SPA) zur ganzheitlichen Überwachung und Planung von privaten Vermögenswerten, Wertpapieren, Immobilien, Vorsorge und Budgetflüssen[cite: 23]. 

Im Gegensatz zu klassischen SaaS-Lösungen setzt FinBundle Pro konsequent auf **Privacy-First** und lokale Datenkontrolle[cite: 23]. Es gibt keine Cloud-Anbindung, keinen Login-Zwang und keine Backend-Datenbank. Die App ist 100% offline-fähig und bietet dennoch die Funktionalität professioneller Portfolio-Tracker[cite: 23].

---

## ✨ Kernfunktionen im Detail

### 🌐 API LiveEditor & Marktdaten-Zentrale
Der API LiveEditor ist das Herzstück für alle börsengehandelten Assets (Aktien, Fonds, ETFs, Kryptowährungen)[cite: 10].
*   **Intelligentes Caching:** Um API-Limits zu schonen, werden Real-Time-Kurse, EOD-Daten (End of Day) und Fundamentaldaten lokal zwischengespeichert[cite: 15].
*   **Bulk-Sync:** Automatisierter Abruf von tagesaktuellen Kursen und zugehörigen Wechselkursen für das gesamte Portfolio in einem Durchgang[cite: 10, 15].
*   **Fundamentaldaten & Dividenden:** Auf Knopfdruck Anzeige von Dividendenrendite, Ex-Datum, KGV (P/E), EPS, Marktkapitalisierung und 52-Wochen-Hoch/Tief[cite: 10, 15].
*   **Performance Analyser:** Interaktive historische Charts (relativ/absolut) und Echtzeit-Intraday-Daten inklusive technischer Indikatoren (SMA, EMA, Bollinger Bänder)[cite: 10].

### 📊 Ganzheitliches Portfolio-Tracking
Egal ob traditionelle oder alternative Anlageklassen – FinBundle Pro aggregiert alles in einer einheitlichen Baumstruktur[cite: 23].
*   **Schweizer Spezialitäten:** Native Unterstützung für Pensionskassen (2. Säule) und Säule 3a (Konten & Fonds)[cite: 23].
*   **Sachwerte & Immobilien:** Verwaltung von Immobilien (über Marktwertanpassungen) und Hypotheken (als negative Salden inkl. Zins- und Amortisationserfassung)[cite: 23].
*   **Multi-Währung:** Lückenlose Unterstützung von Fremdwährungen mit automatischer und historisch korrekter Umrechnung via Frankfurter API[cite: 10, 15].

### 💰 Budgetierung nach 50/30/20
Ein integriertes Budget-Dashboard überwacht die laufenden Einnahmen und Ausgaben[cite: 23].
*   **Regelbasierte Aufteilung:** Automatische Klassifizierung in *Needs* (50% Fixkosten), *Wants* (30% Lifestyle) und *Savings* (20% Sparen)[cite: 23].
*   **Abo-Manager:** Erfassung von Verträgen und Abonnements inklusive Kündigungsfristen[cite: 23].
*   **Netto-Cashflow:** Darstellung der monatlichen Überschüsse als Grundlage für weitere Investitionen[cite: 23].

### 📈 Reports, Analysen & FIRE-Simulation
*   **Waterfall-Analyse:** Visualisiert die Brücke zwischen Start- und Endvermögen und trennt echte Markteffekte (Rendite) von eigenen Einzahlungen (Cashflow)[cite: 20].
*   **Steuerreport:** Stichtagsbezogene Auswertung (z.B. per 31.12.) zur nahtlosen Übernahme in die Steuererklärung[cite: 23].
*   **Simulation & FIRE:** Definition eines Zieljahres für die finanzielle Unabhängigkeit (Financial Independence, Retire Early) inkl. Berechnung von Zukunftsszenarien (Sabbatical, Autokauf, Erbschaften)[cite: 23].

### 🔒 Privacy-First & Verschlüsselung
Ihre Finanzdaten gehören Ihnen. Punkt.
*   **Zero-Knowledge-Architektur:** Speicherung der Daten wahlweise im `localStorage` des Browsers oder im lokalen Dateisystem[cite: 20, 23].
*   **AES-256 ZIP-Export:** Projekte lassen sich als hochsichere `.zip`-Archive mit PIN-Schutz exportieren (via CryptoJS)[cite: 20, 23].
*   **Offene Daten-Standards:** Import von CSV-Daten (z.B. aus Parqet) und Export der generierten Buchungsjournale nach `.xlsx`[cite: 20, 23].

### 🤖 Lokale KI-Integration (Ollama)
*   **KI-Copilot:** Nahtlose Anbindung an lokale Large Language Models (LLMs) via Ollama. Die KI generiert Widgets und analysiert Dashboards, ohne dass Ihre Finanzdaten das Gerät verlassen[cite: 23].
*   **KI-Belegscanner:** Extrahierung von Datum, Betrag und Kategorie aus PDF-Rechnungen. Vor dem Senden an Cloud-KIs werden sensible Daten (IBAN, Namen) lokal anonymisiert[cite: 23].

---

## 🛠️ Tech Stack & Integrationen

*   **Core:** React (JSX), Tailwind CSS[cite: 20]
*   **Visualisierung:** Apache ECharts (`echarts.min.js`), Chart.js[cite: 20]
*   **APIs (Marktdaten):** EODHD, Alpha Vantage, Frankfurter API[cite: 10, 15]
*   **Daten-Verarbeitung:** pdfMake, html2canvas, ExcelJS[cite: 20]
*   **Security:** CryptoJS, JSZip[cite: 20]
*   **Hybrid Ready:** Vorbereitet für Capacitor und Electron[cite: 20]
*   **i18n:** Volle Mehrsprachigkeit (Deutsch, Englisch, Französisch, Italienisch)[cite: 23, 24, 25, 26]

---

## 🚀 Ausführung & Installation

Da FinBundle Pro komplett clientseitig läuft, ist kein komplexes Backend (Node.js/Python/DB) notwendig.

**Option 1: FinSPA Loader (Empfohlen)**
Nutzen Sie die beiliegende `FinSPA_Loader.html`, um das gepackte Projekt (`FinSPA.zip`) direkt im Browser zu entpacken und auszuführen – komplett offline und ohne Build-Prozess.

**Option 2: Lokaler Development Server**
1. Repository klonen
2. Abhängigkeiten installieren: `npm install`
3. Entwicklungsserver starten: `npm start`
4. Im Browser unter `http://localhost:3000` aufrufen.

---

*Haftungsausschluss: FinBundle Pro ist ein Tool zur Visualisierung von privaten Finanzdaten und stellt keine steuerliche oder Anlageberatung dar.*
