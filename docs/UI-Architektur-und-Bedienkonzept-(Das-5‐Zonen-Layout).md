FinBundle PRO verzichtet auf simple tabellarische Ansichten und nutzt stattdessen ein hochgradig modulares *Enterprise Multi-Pane Layout*[cite: 1]. Dieses Design ermöglicht eine maximale Datendichte und Effizienz, ohne den Nutzer optisch zu überladen[cite: 1]. 

Die Benutzeroberfläche gliedert sich in fünf interaktive Kernzonen:

### 🌐 Zone 1: Die Top MenuBar
Eine persistente, am oberen Bildschirmrand fixierte Navigationsleiste (`MenuBar.jsx`)[cite: 1, 9]. 
* **Globale Steuerung:** Beinhaltet die Dropdowns für Datei-Aktionen, den Wechsel der Hauptansichten (Vermögen, Budget, Datensicht, API LiveEditor) und das Reporting[cite: 1, 9].
* **Live-Metriken:** Integrierte `MiniSparkline`-SVG-Komponenten visualisieren hier kontinuierlich den konsolidierten Gesamtwert (Total Net Worth) über alle Assets hinweg sowie aktuelle Devisenkurse[cite: 1, 9].

### 🌳 Zone 2: Der Hierarchiebaum (TreeView)
Die linke Seitenleiste ersetzt flache Tabellen durch ein dreistufiges Strukturmodell mit rekursiver Salden-Vererbung[cite: 1].
* **Stufe 1 (Bank / Institut):** Der rechtliche Verwahrort (z.B. UBS, Swissquote)[cite: 1]. Aggregiert alle Untersalden und bildet Risikoknoten für die Allokation[cite: 1].
* **Stufe 2 (Kategorie / Ordner):** Die logische Gliederung (z.B. Girokonten, Säule 3a), beliebig tief verschachtelbar[cite: 1].
* **Stufe 3 (Asset):** Das buchbare Finanzobjekt (z.B. Apple-Aktie, Sparkonto)[cite: 1].

### 🖥️ Zone 3: Die Center Stage (EditorArea)
Das dynamische Herzstück der Applikation (`EditorArea.jsx`), das kontextsensitiv auf Auswahlen im Navigationsbaum reagiert[cite: 1, 7].
* **Bei Asset-Auswahl:** Rendert das chronologische Transaktionsjournal, Sparkline-Graphen der Wertentwicklung und Buttons zur Schnellerfassung von Buchungen[cite: 1, 7].
* **Bei Report-Auswahl:** Lädt spezialisierte Vollbild-Auswertungsmodule (z.B. den `WaterfallReport` oder `TopFlowReport`) inklusive der `UniversalChart`-Graphen[cite: 1, 7].

### ⚙️ Zone 4: Der PropertyEditor
Ein reaktives Panel am rechten Rand (`PropertyEditor.jsx`), das die finanzmathematische DNA jedes Assets steuert[cite: 1, 10].
* Erlaubt Inline-Anpassungen (z.B. Ticker-Symbole, ISIN, Steuerabzüge oder Forward Yields für Dividenden), ohne den Haupt-Workspace in der Mitte zu verdecken[cite: 1, 10]. 
* Alle Änderungen werden durch die Auto-Save-Funktion sofort persistiert[cite: 1, 10].

### 🚀 Zone 5: Das Fly-In Cockpit (Command Palette)
Eine verdeckte, überlagernde Ebene für Power-User, die bei Bedarf in den Viewport gleitet[cite: 1, 7].
* **Globaler Schnellzugriff:** Öffnet sich über `Strg + K` (Windows) bzw. `Cmd + K` (macOS)[cite: 1, 7].
* Bietet eine globale Suche über alle Assets, Berichte und Kategorien, Schnellaktionen (Beleg-Scanner, API-Sync) sowie direkten Zugriff auf angepinnte KI-Plugins[cite: 1, 7].

---

## ⌨️ Tastatur-Shortcuts (Power-User)

Für eine schnelle und mausfreie Bedienung unterstützt FinBundle PRO folgende globale Tastenkombinationen[cite: 1]:

| Windows / Linux | macOS | Aktion |
| :--- | :--- | :--- |
| `Ctrl` + `K` / `Space` | `Cmd` + `K` / `Space` | Fly-In Schnellzugriff (Cockpit) öffnen[cite: 1] |
| `Ctrl` + `S` | `Cmd` + `S` | Sofortiger Festplatten-Flush (Save / Krypto-Vault schreiben)[cite: 1] |
| `Ctrl` + `N` | `Cmd` + `N` | Neue Buchung im aktuell aktiven Asset anlegen[cite: 1] |
| `Ctrl` + `Shift` + `P` | `Cmd` + `Shift` + `P` | Plugin-Verwaltung & KI-Copilot öffnen[cite: 1] |
| `Ctrl` + `Shift` + `R` | `Cmd` + `Shift` + `R` | Reporting-Suite aufrufen[cite: 1] |