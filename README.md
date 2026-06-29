# 🏔️ FinBundle Pro

**FinBundle Pro** ist eine ganzheitliche, Offline-First-Anwendung zur persönlichen Finanz- und Vermögensplanung. Sie bündelt Portfolio-Tracking, Budgetierung, Cashflow-Analyse und FIRE-Simulationen (Financial Independence, Retire Early) in einem sicheren, lokalen Umfeld – ohne Cloud-Zwang.

---

## ✨ Kernfunktionen

### 📊 Vermögensverwaltung & Portfolio-Tracking
* **Ganzheitlicher Ansatz:** Verwaltung von Bargeld, Aktien, ETFs, Krypto, Immobilien, Hypotheken und Schweizer Spezialitäten wie Säule 3a & Pensionskassen.
* **Multi-Währung:** Native Unterstützung von Fremdwährungen mit automatischer Umrechnung (Live & Historisch via Frankfurter API).
* **Dividenden-Kalender:** Prognose des passiven Einkommens (Forward Yield), Berechnung der Netto-Ausschüttungen und Steuerabzüge.

### 💰 Budgetierung & Cashflow
* **Regelbasierte Budgets:** Einnahmen, Fixkosten, Lifestyle und Sparquoten aufteilen nach der 50/30/20-Regel.
* **Zahlungsströme:** Detaillierte Analyse des Netto-Cashflows über verschiedene Frequenzen (monatlich, quartalsweise, jährlich).

### 📈 Reports & Analysen (Exportierbar)
* **Asset Overview:** Konsolidierte Übersicht der Banken und Kategorien.
* **Waterfall-Analyse:** Brücke zwischen Start- und Endvermögen (Markteffekte vs. Cashflow).
* **Steuerreport:** Stichtagsbezogene Auswertung (z.B. per 31.12.) für die Steuererklärung.
* **Simulation & FIRE:** Zukunftsszenarien, exponentielles Wachstum und Zielerreichung berechnen.
* **PDF- & Excel-Export:** Alle Reports können als aufbereitete PDF-Dokumente (inkl. ECharts) oder nach `.xlsx` exportiert werden.

### 🔒 Privacy & Datenhoheit
* **100% Lokal:** Alle Finanzdaten bleiben im Browser oder der lokalen App (`localStorage` / lokales Dateisystem).
* **AES-Verschlüsselung:** Projekte lassen sich als verschlüsselte `.zip`-Archive (via CryptoJS) mit PIN-Schutz exportieren und sichern.
* **Offene Standards:** Import von CSV-Daten (z.B. aus Parqet) und Export der Buchungsjournale.

### 🤖 Lokale KI-Integration
* **KI-Copilot:** Anbindung an lokale LLMs (z.B. Ollama) für automatische Kategorisierung und intelligente Abfragen.
* **PDF-Scanner:** KI-gestützte Textextraktion aus hochgeladenen Rechnungen und Dokumenten.

---

## 🛠️ Tech Stack

* **Frontend:** React (JSX)
* **Styling:** Tailwind CSS (Dark Mode / Light Mode nativ unterstützt)
* **Charts:** ECharts (`echarts.min.js`)
* **PDF-Generierung:** `pdfMake` & `html2canvas`
* **Krypto & Zip:** `CryptoJS` & `JSZip`
* **API:** Frankfurter API für Echtzeit- und historische Währungskurse
* **i18n:** Integrierte Lokalisierung (Deutsch, Englisch, Französisch, Italienisch)

---

## 🚀 Installation & Start

