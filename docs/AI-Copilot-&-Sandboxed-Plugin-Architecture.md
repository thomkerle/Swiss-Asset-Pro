Der AI Copilot (implementiert in der `AiDashboard.jsx`[cite: 14]) ermöglicht die dynamische Generierung maßgeschneiderter Finanz-Auswertungen und interaktiver Dashboards per Texteingabe (Prompting)[cite: 14]. 

Anstatt auf starre Reports beschränkt zu sein, können Nutzer mit der KI eigene HTML/JS-Widgets generieren, die tief in die FinBundle-Architektur integriert sind[cite: 14].

### Zero-Data-Leak & Sandbox-Sicherheit
Das fundamentale Prinzip des Copiloten ist die strikte Trennung von Code-Generierung und Daten-Verarbeitung[cite: 18]. 
* **Keine Exfiltration:** Cloud-LLMs erhalten über den System-Prompt lediglich die Struktur-Definitionen (Schnittstellen) der Applikation, aber **niemals** reale Salden, IBANs oder Transaktionsdetails[cite: 18].
* **Lokale Iframe-Sandbox:** Die KI liefert reinen Code zurück, der clientseitig in einem strikt isolierten `<iframe sandbox="allow-scripts">` gerendert wird[cite: 14].
* **Data Injektion:** Über das Modul `FinSpaApiInject.js` werden die echten Portfolio-Daten lokal auf dem Endgerät (im RAM) direkt in das Widget injiziert[cite: 17]. 

### Unterstützte KI-Runtimes
Das System unterstützt eine hybride Modell-Architektur[cite: 14]:
1. **Lokal & Autark (Ollama):** Maximale Privatsphäre durch lokale Ausführung von Modellen wie *Qwen 2.5 Coder* oder *Llama 3* auf der eigenen Hardware[cite: 14].
2. **Cloud-APIs:** Für komplexere Code-Generierungen können API-Keys für *OpenAI (GPT-4o)*, *Google Gemini (3.5 Flash)* oder *Anthropic (Claude 3.5 Sonnet)* in den Einstellungen hinterlegt werden[cite: 14]. Anpassbare Parameter wie Modell-Temperatur und Kontextfenster (bis zu 32K Tokens) steuern die Ausgabe[cite: 14].

### Der System-Prompt Contract
Der `SystemPrompt.js` orchestriert die KI mit einem harten Regelwerk[cite: 18]:
* **Vorinstallierte Bibliotheken:** Die KI wird angewiesen, nur die im System bereits gebündelten Bibliotheken (Tailwind CSS, ECharts, Chart.js, Plotly) zu nutzen[cite: 18].
* **Vielsprachigkeit:** Jedes generierte Widget muss nativ die vier Kernsprachen (Deutsch, Englisch, Französisch, Italienisch) über ein integriertes I18N-Wörterbuch unterstützen[cite: 18].
* **PDF-Fähigkeit:** Um mit der nativen `PdfToolkit`-Engine zu harmonieren, wird die KI gezwungen, spezifische Vektor-KPIs und Parameter-Arrays zurückzugeben anstatt verschwommene HTML-Screenshots zu generieren[cite: 18].
* **Temporäre Szenarien:** Die Sandbox erlaubt Was-wäre-wenn-Analysen durch virtuelle Buchungen oder Asset-Modifikationen, ohne den realen Portfolio-Status zu verändern[cite: 18].

### Plugin-Persistenz & Sharing
Einmal generierte und validierte Reports müssen nicht jedes Mal neu erzeugt werden.
* **Speichern:** Sie lassen sich dauerhaft als Plugin im System verankern und im "Fly-In Cockpit" anheften[cite: 14].
* **Teilen:** Über den Plugin-Manager können Nutzer ihre Add-Ins als `.finplugin.json` Dateien exportieren und sicher mit der Community teilen, da diese Dateien nur die Auswertungslogik, aber keine Nutzerdaten enthalten[cite: 7, 14].