Die effizienteste und sicherste Methode, um große Mengen an historischen Transaktionen in FinBundle PRO zu überführen, ist der tabellarische Datenimport. Er ermöglicht es Ihnen, hunderte Buchungen in wenigen Sekunden zu erfassen und zu kategorisieren.

### 1. Warum der tabellarische Import der bevorzugte Weg ist (Privacy First)

Obwohl FinBundle PRO einen KI-gestützten PDF-Belegscanner anbietet, ist der Datei-Import via CSV oder CAMT der **absolut empfohlene Weg** für den Massenimport von Bankdaten. 

*   **Kein Datenabfluss (Zero-Data-Leakage):** Beim Import von Tabellenformaten geschieht die gesamte Verarbeitung 100% lokal in der FinBundle DataEngine. Es werden keinerlei Daten an externe Server oder Sprachmodelle gesendet.
*   **Grenzen des PDF-Scanners:** Der PDF-Scanner nutzt zwar ein starkes clientseitiges PII-Gate, welches Namen und IBANs vor dem Senden an das LLM maskiert (z. B. `[USER_MASKED]`), dennoch können Buchungstexte wie "Mietzinszahlung an Vermieter X" oder "Gehalt Arbeitgeber Y" Rückschlüsse auf Ihre finanziellen Verhältnisse zulassen. Beim CSV-Import entfällt dieses Restrisiko vollständig.

### 2. Unterstützte Formate

Das System ist flexibel aufgebaut und unterstützt die gängigen Export-Formate von Schweizer und internationalen Banken:
*   **CSV (Comma-Separated Values):** Das Standardformat. Trennzeichen (Komma, Semikolon, Tabulator) werden meist automatisch erkannt.
*   **CAMT / CAML (XML-basiert):** Standardisierte ISO-20022 Bankformate (wie camt.053 oder camt.054), die von fast allen Schweizer Banken (UBS, ZKB, PostFinance) ausgegeben werden.
*   **CAT / MT940:** Ältere, aber noch immer weit verbreitete Text-basierte Kontoauszugsformate.

### 3. Der Import-Workflow (Schritt-für-Schritt)

Wenn Sie im Menü auf `Datei ➔ Importieren ➔ Buchungen importieren (CSV Wizard)` klicken (oder das Fly-In Cockpit nutzen), startet der Import-Assistent.

#### Schritt 3.1: Datei-Upload & Spalten-Mapping (Zuordnung)
Nachdem Sie die Datei ausgewählt haben, präsentiert FinBundle PRO Ihnen eine Vorschau der erkannten Daten in Tabellenform. Da jede Bank ihre Spalten anders benennt, müssen Sie dem System nun mitteilen, welche Spalte welche Bedeutung hat.

Folgende **Pflichtfelder** müssen zwingend zugewiesen werden:
1.  **Datum:** Der Tag der Transaktion. *Achtung:* Viele Banken unterscheiden zwischen dem **Buchungsdatum** (Wann die Bank die Zeile erfasst hat) und dem **Valuta-Datum** (Wann das Geld effektiv wertmäßig verfügbar war). Wir empfehlen, für Finanzanalysen stets das *Buchungsdatum* zu mappen.
2.  **Buchungstext / Beschreibung:** Der Verwendungszweck (z. B. "Gehaltseingang" oder "Einkauf Migros").
3.  **Betrag:** Der Wert der Transaktion. FinBundle PRO benötigt die Beträge mit korrekten Vorzeichen (Ausgaben als Minus, Einnahmen als Plus). *Hinweis: Manche Banken trennen Einnahmen und Ausgaben in zwei separate Spalten (Soll/Haben). Der Wizard bietet hierfür eine Zusammenführungs-Option an.*

#### Schritt 3.2: Datenaufbereitung (Data Cleansing)
Bevor die Daten endgültig geschrieben werden, liegen sie in einer interaktiven Zwischentabelle vor. Hier können Sie:
*   Irrelevante Zeilen (z. B. Kontostand-Überschriften der Bank) per Checkbox abwählen.
*   Kategorien bereits im Vorfeld über ein Dropdown zuweisen.
*   Fehlende Vorzeichen bei Beträgen korrigieren.

#### Schritt 3.3: Zielkonto wählen & Import abschliessen
Im letzten Schritt wählen Sie über ein Dropdown-Menü das **Import Konto** (Ihr Ziel-Asset im Strukturbaum) aus. Klicken Sie auf Ausführen, um die Buchungen permanent in das Transaktionsjournal des Assets zu schreiben.

---

### ⚠️ Besonderheit: Sammelbuchungen

Eine der größten Herausforderungen beim Bankdaten-Import sind **Sammelbuchungen**. 

*   **Das Problem:** Eine Bank gibt in der Exportdatei oft nur eine einzige, aggregierte Zeile aus (z. B. `- 1'000 CHF` mit dem Text "Sammelauftrag E-Banking"). FinBundle PRO kann nicht wissen, dass sich dieser Betrag in 300 CHF Krankenkasse, 500 CHF Miete und 200 CHF Stromrechnung aufteilt.
*   **Die Lösung:** Importieren Sie die Sammelbuchung zunächst regulär. Wechseln Sie danach in die `EditorArea`, löschen Sie den einzelnen Sammelbuchungs-Eintrag manuell heraus und erfassen Sie die darin enthaltenen Posten als individuelle Einzelbuchungen. So bleiben Ihre Budget-Reports (wie der *Kategorienfluss* oder das *50/30/20 Dashboard*) sauber und trennscharf.

---

### 🛠️ Troubleshooting: Import-Fehler beheben

Falls die Daten nicht wie gewünscht in der Tabelle erscheinen, prüfen Sie folgende Lösungsansätze:

| Symptom | Ursache & Lösung |
| :--- | :--- |
| **"Die Vorschau-Tabelle zeigt nur eine einzige, riesige Spalte an."** | **Ursache:** Das CSV-Trennzeichen (Delimiter) wurde falsch erkannt (z. B. Komma statt Semikolon).<br>**Lösung:** Wählen Sie im oberen Bereich des Wizards das Trennzeichen manuell aus (meistens `;` für Excel-Exporte im deutschsprachigen Raum). |
| **"Umlaute (ä, ö, ü) oder Sonderzeichen werden als kryptische Symbole () dargestellt."** | **Ursache:** Die Bank hat die Datei in einem alten Encoding (z. B. ANSI / Windows-1252) anstatt im modernen UTF-8 Format exportiert.<br>**Lösung:** Öffnen Sie die CSV-Datei kurz im Windows Editor (Notepad) oder in TextEdit (Mac) und klicken Sie auf `Speichern unter`. Wählen Sie als Codierung `UTF-8` und importieren Sie die neue Datei. |
| **"Alle meine Ausgaben werden in FinBundle als Einnahmen (grün) verbucht!"** | **Ursache:** Die Bank exportiert Ausgaben ohne Minuszeichen, liefert diese aber in einer separaten "Soll"-Spalte.<br>**Lösung:** Aktivieren Sie im Zuordnungs-Schritt die Funktion *Vorzeichen invertieren* für die entsprechende Betragsspalte oder nutzen Sie das Mapping für getrennte *Soll/Haben*-Spalten. |
| **"Das Datum wird nicht erkannt (z. B. Invalid Date)."** | **Ursache:** Das Datumsformat der Bank (z. B. `MM/DD/YYYY` oder `DD.MM.YY`) weicht vom ISO-Standard ab.<br>**Lösung:** Wählen Sie im Wizard bei der Spalte Datum über das kleine Zahnrad-Symbol das spezifische Datumsformat aus, das Ihre Bank verwendet, damit die DataEngine es korrekt nach `YYYY-MM-DD` parsen kann. |
