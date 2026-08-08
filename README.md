# 🏔️ FinBundle Pro

**FinBundle Pro** ist eine moderne, hochgradig interaktive Single Page Application (SPA) zur ganzheitlichen Überwachung und Planung von privaten Vermögenswerten, Wertpapieren, Immobilien, Vorsorge und Budgetflüssen. 

Im Gegensatz zu klassischen SaaS-Lösungen setzt FinBundle Pro konsequent auf **Privacy-First** und lokale Datenkontrolle. Es gibt keine Cloud-Anbindung, keinen Login-Zwang und keine Backend-Datenbank. Die App ist 100% offline-fähig und bietet dennoch die Funktionalität professioneller Portfolio-Tracker.

---

## ✨ Kernfunktionen im Detail

### 🌐 API LiveEditor & Marktdaten-Zentrale
Der API LiveEditor ist das Herzstück für alle börsengehandelten Assets (Aktien, Fonds, ETFs, Kryptowährungen).
*   **Intelligentes Caching:** Um API-Limits zu schonen, werden Real-Time-Kurse, EOD-Daten (End of Day) und Fundamentaldaten lokal zwischengespeichert.
*   **Bulk-Sync:** Automatisierter Abruf von tagesaktuellen Kursen und zugehörigen Wechselkursen für das gesamte Portfolio in einem Durchgang.
*   **Fundamentaldaten & Dividenden:** Auf Knopfdruck Anzeige von Dividendenrendite, Ex-Datum, KGV (P/E), EPS, Marktkapitalisierung und 52-Wochen-Hoch/Tief.
*   **Performance Analyser:** Interaktive historische Charts (relativ/absolut) und Echtzeit-Intraday-Daten inklusive technischer Indikatoren (SMA, EMA, Bollinger Bänder).

### 📊 Ganzheitliches Portfolio-Tracking
Egal ob traditionelle oder alternative Anlageklassen – FinBundle Pro aggregiert alles in einer einheitlichen Baumstruktur.
*   **Schweizer Spezialitäten:** Native Unterstützung für Pensionskassen (2. Säule) und Säule 3a (Konten & Fonds).
*   **Sachwerte & Immobilien:** Verwaltung von Immobilien (über Marktwertanpassungen) und Hypotheken (als negative Salden inkl. Zins- und Amortisationserfassung).
*   **Multi-Währung:** Lückenlose Unterstützung von Fremdwährungen mit automatischer und historisch korrekter Umrechnung via Frankfurter API.

### 💰 Budgetierung nach 50/30/20
Ein integriertes Budget-Dashboard überwacht die laufenden Einnahmen und Ausgaben.
*   **Regelbasierte Aufteilung:** Automatische Klassifizierung in *Needs* (50% Fixkosten), *Wants* (30% Lifestyle) und *Savings* (20% Sparen).
*   **Abo-Manager:** Erfassung von Verträgen und Abonnements inklusive Kündigungsfristen.
*   **Netto-Cashflow:** Darstellung der monatlichen Überschüsse als Grundlage für weitere Investitionen.

### 📈 Reports, Analysen & FIRE-Simulation
*   **Waterfall-Analyse:** Visualisiert die Brücke zwischen Start- und Endvermögen und trennt echte Markteffekte (Rendite) von eigenen Einzahlungen (Cashflow).
*   **Steuerreport:** Stichtagsbezogene Auswertung (z.B. per 31.12.) zur nahtlosen Übernahme in die Steuererklärung.
*   **Simulation & FIRE:** Definition eines Zieljahres für die finanzielle Unabhängigkeit (Financial Independence, Retire Early) inkl. Berechnung von Zukunftsszenarien (Sabbatical, Autokauf, Erbschaften).

### 🔒 Privacy-First & Verschlüsselung
Ihre Finanzdaten gehören Ihnen. Punkt.
*   **Zero-Knowledge-Architektur:** Speicherung der Daten wahlweise im `localStorage` des Browsers oder im lokalen Dateisystem.
*   **AES-256 ZIP-Export:** Projekte lassen sich als hochsichere `.zip`-Archive mit PIN-Schutz exportieren (via CryptoJS).
*   **Offene Daten-Standards:** Import von CSV-Daten (z.B. aus Parqet) und Export der generierten Buchungsjournale nach `.xlsx`.

### 🤖 Lokale KI-Integration (Ollama)
*   **KI-Copilot:** Nahtlose Anbindung an lokale Large Language Models (LLMs) via Ollama. Die KI generiert Widgets und analysiert Dashboards, ohne dass Ihre Finanzdaten das Gerät verlassen.
*   **KI-Belegscanner:** Extrahierung von Datum, Betrag und Kategorie aus PDF-Rechnungen. Vor dem Senden an Cloud-KIs werden sensible Daten (IBAN, Namen) lokal anonymisiert.

---

## 🛠️ Tech Stack & Integrationen

*   **Core:** React (JSX), Tailwind CSS
*   **Visualisierung:** Apache ECharts (`echarts.min.js`), Chart.js
*   **APIs (Marktdaten):** EODHD, Alpha Vantage, Frankfurter API
*   **Daten-Verarbeitung:** pdfMake, html2canvas, ExcelJS
*   **Security:** CryptoJS, JSZip
*   **Hybrid Ready:** Vorbereitet für Capacitor und Electron
*   **i18n:** Volle Mehrsprachigkeit (Deutsch, Englisch, Französisch, Italienisch)

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

## ⚠️ Haftungsausschluss (Disclaimer)

FinBundle Pro ist ein privates Software-Projekt zur Visualisierung und Verwaltung von eigenen Finanzdaten und stellt **keine finanzielle, steuerliche oder rechtliche Anlageberatung dar**. 

Die Nutzung der Software erfolgt **vollständig auf eigene Gefahr**. Der Entwickler übernimmt keinerlei Gewähr oder Garantie für die Richtigkeit, Vollständigkeit oder Aktualität der abgerufenen Marktdaten, Berechnungen, Steuerreports oder Zukunftssimulationen. **Jegliche Haftung für direkte, indirekte oder beiläufig entstandene Schäden, Vermögensverluste, entgangene Gewinne oder Datenverluste, die durch die Nutzung dieser Software oder das Vertrauen auf die darin angezeigten Daten entstehen, wird vollumfänglich und ausdrücklich abgelehnt.** 

Bitte prüfen Sie alle finanzrelevanten und steuerlichen Daten selbst oder ziehen Sie vor wichtigen finanziellen Entscheidungen einen qualifizierten Fachberater hinzu.


## Bilder produziert mit Demo_Datensatz.json

### Bild 1 - Budget Verwaltung

<img width="2404" height="1176" alt="image" src="https://github.com/user-attachments/assets/ee476a86-c782-4aa1-84b8-131bd22c9ac3" />


### Bild 2 - Asset Tracking

<img width="2400" height="1174" alt="Bild 1" src="https://github.com/user-attachments/assets/6035c67b-ba41-476d-b006-6949985075fc" />


