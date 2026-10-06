Der zentrale Einstellungsdialog lässt sich im Hauptmenü unter `Datei ➔ Einstellungen` oder über das Fly-In Cockpit aufrufen[cite: 7, 9]. FinBundle PRO speichert diese Konfigurationen zusammen mit den Portfoliodaten sicher im verschlüsselten AES-256 Vault[cite: 1].

Folgende Einstellungsbereiche stehen aktuell zur Verfügung:

### 🌍 Allgemein & Lokalisierung
*   **Basiswährung (`baseCurrency`):** Legt die primäre Leitwährung des gesamten Portfolios fest (Standardmäßig auf `CHF` voreingestellt)[cite: 2, 6, 8]. Sämtliche konsolidierten Berechnungen (Total Wealth) und Fremdwährungen werden in diesen Wert umgerechnet[cite: 2, 6].
*   **Sprache (`language`):** Steuert die Vielsprachigkeit der Applikation und der generierten KI-Widgets[cite: 7]. Unterstützt werden Deutsch (`de`), Englisch (`en`), Französisch (`fr`) und Italienisch (`it`)[cite: 17, 18].
*   **PDF-Metadaten:** Konfiguration von `userName` (bzw. `ownerName`), `pdfCompanyName` und dem `pdfSubtitle` für personalisierte Deckblätter beim PDF-Export[cite: 12].

### ☁️ API & Marktdaten (finApiKeys)
*   **EODHD API-Key:** Notwendig für den Abruf detaillierter historischer EOD-Kurse, Intraday-Live-Metriken und Fundamentaldaten (Dividendenrendite, KGV, EPS)[cite: 6, 16].
*   **Alpha Vantage API-Key:** Dient als Fallback-Schnittstelle für den Abruf von Echtzeitkursen und Basis-Unternehmensdaten[cite: 6, 16].
*   **Statische Wechselkurse (`exchangeRates`):** Definition von Fallback-Werten für Währungspaare, falls die Live-Synchronisation über die Frankfurter API fehlschlägt oder offline gearbeitet wird[cite: 9, 10].

### 🤖 KI & Copilot (aiApiKeys & aiModels)
*   **Copilot Aktivierung (`aiEnabled`):** Globaler Schalter, um die KI-Funktionalitäten und das PDF-Scanner PII-Gate ein- oder auszublenden[cite: 9].
*   **Cloud LLM Keys:** Hinterlegung individueller API-Keys für *OpenAI* (GPT-4o), *Google Gemini* (z.B. Gemini 3.5 Flash) oder *Anthropic* (Claude 3.5 Sonnet)[cite: 14].
*   **Lokale Modelle:** Verwaltung eigener Modelle für die Offline-Ausführung (z.B. Registrierung von lokalen Ollama-Runtimes wie `qwen2.5-coder:14b` oder `llama3:latest`)[cite: 14].

### 🏷️ System & Kategorisierung
*   **Säule 3a Limit (`pillar3aMaxLimit`):** Festlegung des steuerlich abzugsfähigen Maximalbetrags für das aktuelle Jahr (z.B. 7'258 CHF), um den Ausschöpfungsgrad im Vorsorge-Report präzise zu berechnen[cite: 3].
*   **Asset-Klassen (`assetClasses`):** Verwaltung und Erweiterung der unterstützten Anlageklassen für den Strukturbaum[cite: 10, 18].
*   **Buchungskategorien (`bookingCategories`):** Individualisierung der Dropdown-Auswahlmöglichkeiten für Transaktionen (z.B. Unterkategorien für Einzahlungen oder Abzahlungen)[cite: 8, 18].
*   **Chart-Engine (`chartEngine`):** Globale Auswahl der Rendering-Bibliothek (Standard: `echarts`, mit Fallbacks zu `chartjs` oder `plotly`) für die Darstellung in den Standard-Reports und im API LiveEditor[cite: 2, 3, 6, 19].