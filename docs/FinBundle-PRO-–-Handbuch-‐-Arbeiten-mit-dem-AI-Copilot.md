Der AI Copilot generiert über natürliche Sprache neue, interaktive Dashboards und Analysen[cite: 14].

### Architektur & Datenfluss (Zero Data Leakage)
Die KI generiert ausschließlich Code, echte Daten werden erst lokal in das Widget injiziert[cite: 17, 18].

    +------------------+       (1) Prompt + SystemPrompt      +-----------------------+
    |                  |  --------------------------------->  |                       |
    |  FinBundle UI    |                                      |  LLM (Ollama/Gemini)  |
    |                  |  <---------------------------------  |                       |
    +------------------+       (2) Generierter HTML/JS Code   +-----------------------+
             |
             v
    +------------------+       (3) Rendern im Iframe          +-----------------------+
    |                  |  --------------------------------->  |                       |
    |  DataEngine      |                                      |   Sandboxed Widget    |
    |  (Lokale Daten)  |  <---------------------------------  |   (HTML / JS)         |
    +------------------+       (4) Daten-Injektion (lokal)    +-----------------------+

**Wichtig:** Ihr realer Datenbestand (Salden, Transaktionen, Institutsnamen) wird **niemals** an die KI gesendet[cite: 14, 18]!

### Voraussetzungen & Einrichtung
1.  **AI Engine aktivieren:** Schalter (`aiEnabled`) in den Einstellungen aktivieren[cite: 9].
2.  **Lokale KI (Ollama):** Ollama muss im Hintergrund laufen (Standardport: `http://localhost:11434`)[cite: 14].
3.  **Online KI (Cloud LLMs):** Für Cloud-LLMs wie Google Gemini muss ein API-Key in den Settings eingetragen werden[cite: 14]. Das System wurde netzwerkseitig und vom Prompting her primär auf Gemini getestet. Für die Online-Nutzung ist in der Regel ein kostenpflichtiges Abonnement notwendig (z.B. Google One AI Premium für ca. 22 bis 25 CHF pro Monat, Stand Ende 2026).

### Der unsichtbare System-Prompt
Im Hintergrund wird stets ein `SystemPrompt.js` vorangestellt, der die KI zwingt[cite: 14, 18]:
*   Die exakte Struktur der `FinSPA_API` zu nutzen, um echte Daten abzufragen[cite: 18].
*   Isolierten HTML/JS-Code mit vorinstallierten Bibliotheken (wie Tailwind CSS, ECharts, Chart.js) zu generieren[cite: 18].
*   Vielsprachigkeit (DE/EN/FR/IT) über ein integriertes I18N-Wörterbuch zu gewährleisten[cite: 18].
*   Die native `PdfToolkit`-Engine über Vektor-KPIs zu unterstützen, anstatt ungenaue HTML-Screenshots zu erzeugen[cite: 18].

### Iteratives Arbeiten
Die Zusammenarbeit mit dem Copilot ist als Chat aufgebaut[cite: 14]. Geben Sie der KI direktes Feedback zur Verfeinerung, z. B. *"Mache den Hintergrund dunkelblau"* oder *"Füge eine Tabelle mit den genauen Summen hinzu"*. Die KI erinnert sich an den vorherigen Code und passt das Widget an[cite: 14]. Sobald das Ergebnis perfekt ist, klicken Sie auf **Als Plugin speichern**, um das Widget dauerhaft im Menü zu verankern[cite: 14].

---

### ⚠️ Troubleshooting: AI Copilot & Generierung

Falls die KI nicht wie gewünscht reagiert, prüfen Sie folgende Lösungsansätze:

| Symptom | Ursache & Lösung |
| :--- | :--- |
| **"Verbindungsfehler zur lokalen KI (Ollama)"** | **Ursache:** Die lokale Ollama-Instanz läuft nicht oder ist auf einem falschen Port erreichbar[cite: 14].<br>**Lösung:** Stellen Sie sicher, dass die Ollama-App gestartet ist und das angefragte Modell (z.B. `qwen2.5-coder:14b`) heruntergeladen wurde[cite: 14]. |
| **"Cloud API Error / Verbindung fehlgeschlagen"** | **Ursache:** Der hinterlegte API-Key ist ungültig oder das Abrechnungskonto beim Provider ist nicht gedeckt[cite: 14].<br>**Lösung:** Prüfen Sie den API-Key in den FinBundle-Einstellungen[cite: 14]. Bei Google Gemini: Stellen Sie sicher, dass in der Google Cloud Console die Abrechnung (Billing) für das Projekt aktiviert ist. |
| **"Konnte keinen gültigen HTML/JS Code extrahieren"** | **Ursache:** Das Sprachmodell hat den Code nicht in einem sauberen HTML-Block formatiert oder zu viel erklärenden Text generiert[cite: 14].<br>**Lösung:** Weisen Sie die KI im Chat mit einem Satz wie *"Generiere nur den reinen HTML-Code ohne Erklärungen"* explizit an. Alternativ: Setzen Sie die Modell-Temperatur in den KI-Einstellungen auf einen niedrigeren Wert (z. B. `0.1`)[cite: 14]. |
| **"Das generierte Widget ist leer oder stürzt ab"** | **Ursache:** Die KI hat möglicherweise fehlerhaften JavaScript-Code oder falsche Parameter für die Chart-Bibliothek geschrieben.<br>**Lösung:** Öffnen Sie den Code über "Code anzeigen" und lesen Sie eventuelle Fehlermeldungen ab[cite: 14]. Schreiben Sie der KI im Chat einfach: *"Der Code rendert nicht. Korrigiere die ECharts-Konfiguration."* Sie wird den Fehler in der Regel selbstständig beheben[cite: 14]. |

### Die Funktionen des System-Prompts (FinSPA_API)

Der System-Prompt übergibt der KI eine vollständige Referenz der `FinSPA_API`, mit der sie auf die lokalen Finanzdaten zugreifen und diese berechnen kann[cite: 20]. Die wichtigsten Funktionen gliedern sich in folgende Bereiche[cite: 20]:

**Vermögen & Portfoliostruktur**[cite: 20]
*   `getTotalWealth()`: Berechnet das Gesamtvermögen in der Basiswährung[cite: 20].
*   `getTotalLiquidWealth()`: Gibt die Summe aller liquiden Mittel (Cash/Konten) zurück[cite: 20].
*   `getWealthDistributionByClass()` & `getWealthByBank()`: Liefern die Vermögensverteilung nach Anlageklassen oder Bankinstituten als Array oder Key-Value-Map[cite: 20].
*   `getHistoricalWealth(startDate, endDate)`: Erzeugt historische Zeitreihendaten für das Gesamtvermögen und die liquiden Mittel[cite: 20].

**Asset-Filter & Wertermittlung**[cite: 20]
*   `getAllAssets()` & `getLiquidAssets()`: Filtern und liefern Arrays aller aktiven oder ausschließlich liquiden Anlageobjekte[cite: 20].
*   `getAssetValueAtDate(...)` & `getInvestedCapitalAtDate(...)`: Ermitteln historische Marktwerte sowie das tatsächlich investierte Kapital (Cost Basis) zu einem bestimmten Stichtag[cite: 20].
*   `getAssetSharesAtDate(...)` & `getAssetPriceAtDate(...)`: Liefern historische Stückzahlen und Stückpreise für Wertpapiere an einem Ziel-Datum[cite: 20].

**Buchungen, Cashflow & Erträge**[cite: 20]
*   `getNormalizedBookings()`: Gibt alle Buchungen zurück und klassifiziert diese automatisch in Einnahme, Ausgabe oder neutrale Umbuchung[cite: 20].
*   `getTotalDividendsReceived()` & `getTotalFeesPaid()`: Summieren alle historisch erhaltenen Dividenden oder gezahlten Gebühren[cite: 20].
*   `getMonthlyCashflowHistory()`: Erstellt eine monatliche Übersicht über Einnahmen, Ausgaben und den daraus resultierenden Netto-Cashflow[cite: 20].

**Budget & FIRE (Financial Independence)**[cite: 20]
*   `getBudgetOverview()` & `getSavingsRate()`: Liefern einen Überblick über Einnahmen und Ausgaben und berechnen die prozentuale Sparquote[cite: 20].
*   `getFireProgress()`: Berechnet den prozentualen Fortschritt zur finanziellen Freiheit basierend auf dem aktuellen Vermögen und einem definierten Zielwert[cite: 20].

**Temporäre Szenario-Simulation (Sandbox)**[cite: 20]
*   `createSandbox(scenarioConfig)`: Erstellt einen nicht-destruktiven, temporären Klon der Portfoliodaten für "Was-wäre-wenn"-Analysen[cite: 20]. Hier können hypothetische Assets oder Buchungen hinzugefügt, bestehende ausgeblendet oder das Budget verändert werden, ohne die realen Daten zu beeinträchtigen[cite: 20].
*   Das zurückgegebene Sandbox-Objekt bietet eigene Funktionen (z. B. `sandbox.getTotalWealth()`) sowie `getDiffToLive()`, um die Differenz zwischen dem hypothetischen Szenario und dem realen Portfolio aufzuzeigen[cite: 20].

**Formatierung & PDF-Export**[cite: 20]
*   `formatCurrency(...)`: Formatiert Zahlenwerte korrekt als Währung im passenden Sprachformat[cite: 20].
*   `exportPdfReport(config)`: Übergibt strukturierte Vektor-KPIs, Parameter-Gruppen, Charts und Tabellen an das lokale `PdfToolkit`, um scharfe PDF-Reports zu generieren anstatt unscharfe HTML-Screenshots anzufertigen[cite: 20].

### Externe Code-Prüfung & Fehlerbehebung (Web-KIs)

Manchmal liefern kleinere, lokal ausgeführte KI-Modelle (wie Ollama) fehlerhaften Code oder Sie möchten eine hochkomplexe Anpassung vornehmen. In solchen Fällen kann eine leistungsstarke, webbasierte KI (wie z. B. das Web-Interface von ChatGPT-4o oder Claude 3.5 Sonnet) deutlich bessere und schnellere Resultate bei der Fehlerbehebung liefern. 

Sie können das fehlerhafte Widget einfach im System zwischenspeichern, den Code extern reparieren lassen und den korrigierten Code anschließend wieder einfügen.

**Der empfohlene Workflow:**
1. **Als Plugin speichern:** Auch wenn das generierte Widget im Copiloten Fehler wirft oder noch nicht perfekt ist, klicken Sie zunächst auf **Als Plugin speichern**, um es im System zu sichern[cite: 14].
2. **Code kopieren:** Klicken Sie im Chat (oder später im Plugin) auf **Code anzeigen** und kopieren Sie den gesamten fehlerhaften HTML-Code in Ihre Zwischenablage[cite: 14].
3. **Web-KI befragen:** Öffnen Sie die Web-KI Ihrer Wahl in einem neuen Browser-Tab. Kopieren Sie den untenstehenden **Korrektur-Prompt**, ergänzen Sie Ihre spezifische Fehlerbeschreibung und fügen Sie ganz unten den fehlerhaften FinBundle-Code ein.
4. **Code ersetzen:** Kopieren Sie den von der Web-KI reparierten Code. Gehen Sie in FinBundle PRO auf `Datei ➔ Plugins ➔ Plugins verwalten...` und klicken Sie bei Ihrem zuvor gespeicherten Plugin auf das *Bearbeiten-Symbol* (Stift)[cite: 7]. 
5. Ersetzen Sie den alten Code im Textfeld vollständig durch den neuen Code und klicken Sie auf **Speichern**[cite: 7]. Ihr Widget ist nun repariert und voll einsatzbereit.

**Der Korrektur-Prompt (für Copy & Paste in die Web-KI):**
```text
Ich nutze die Finanzsoftware "FinBundle PRO". Hier ist ein generierter HTML/JS-Code für ein interaktives Widget. 
Das Widget nutzt die lokale JavaScript-Schnittstelle `window.FinSPA_API`, um Finanzdaten abzurufen und darzustellen. Tailwind CSS, ECharts und Chart.js sind in der Sandbox bereits vorinstalliert.

Ich habe folgendes Problem mit dem Code:
[HIER FEHLER ODER GEWÜNSCHTE ÄNDERUNG BESCHREIBEN, z. B. "Der Chart wird nicht gerendert" oder "Bitte füge unten eine Tabelle mit den Summen hinzu"]

Bitte analysiere und korrigiere den Code unter Beachtung folgender Regeln:
1. Liefere als Ergebnis zwingend ein einziges, vollständiges und in sich geschlossenes HTML-Dokument (inklusive `<!DOCTYPE html><html>...`).
2. Verändere nicht die Aufrufe der `FinSPA_API` und erfinde keine neuen API-Funktionen, da diese fest vorgegeben sind.
3. Füge keine neuen `<script src="...">` Tags für externe Bibliotheken hinzu.
4. Antworte nach Möglichkeit nur mit dem reinen Code, damit ich diesen per Copy & Paste direkt in meine lokale FinBundle-Umgebung zurückschreiben kann.

Hier ist der aktuelle Code:
[HIER DEN KOPIERTEN CODE AUS FINBUNDLE EINFÜGEN]

