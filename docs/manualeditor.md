### Schritt 1: Ein Säule 3a Konto strukturieren und erfassen

Die korrekte Erfassung eines Vermögenswerts beginnt in FinBundle PRO immer mit der Anlage der entsprechenden Hierarchie im Strukturbaum (Zone 2)[cite: 1]. Dies sorgt für eine saubere, automatisierte Konsolidierung der Salden und eine korrekte Zuordnung in der Reporting-Suite[cite: 1].

#### 1.1 Bank und Kategorien anlegen
1. **Neue Bank anlegen:** Klicken Sie im linken Strukturbaum auf **Neu** (oder das `+` Symbol für Banken) und geben Sie den Namen des Finanzinstituts ein (z. B. *VIAC / finpension*)[cite: 8].
2. **Kategorie "Vorsorge" erstellen:** Klicken Sie neben der neu erstellten Bank auf das **+**, wählen Sie *Neue Kategorie* und nennen Sie diese "Vorsorge"[cite: 8].
3. **Unterkategorie "Konten" hinzufügen:** Um die Struktur weiter zu verfeinern, klicken Sie auf das **+** neben "Vorsorge" und erstellen Sie eine weitere Kategorie namens "Konten" oder "Depots"[cite: 8].

![alt](https://github.com/thomkerle/Swiss-Asset-Pro/blob/main/wiki-images/mockup-tree-setup.svg)

#### 1.2 Das 3a Asset erfassen (FormModal)
Sobald die Ordnerstruktur steht, legen wir das eigentliche Finanzobjekt (Asset) an.
1. Klicken Sie neben Ihrer neuen Unterkategorie "Konten" auf das **+** und wählen Sie **Neues Asset**[cite: 8].
2. Im erscheinenden Dialogfenster geben Sie den Namen Ihres 3a-Kontos ein (z. B. *VIAC Global 100*)[cite: 8].
3. Wählen Sie die exakte Anlageklasse (*Asset-Klasse*)[cite: 8]:
   * Wählen Sie **3a Cash** (`pension_3a_cash`), wenn es sich um ein reines, verzinstes Sparkonto handelt[cite: 8, 10].
   * Wählen Sie **3a Fonds** (`pension_3a_fund`), wenn die Gelder in ein Wertschriften- oder ETF-Portfolio investiert sind[cite: 8, 10]. Diese Klassifizierung ist zwingend, damit das System später Kursgewinne korrekt berechnen kann[cite: 17].
4. Klicken Sie auf **Speichern**[cite: 8].

![alt](https://raw.githubusercontent.com/thomkerle/Swiss-Asset-Pro/main/wiki-images/mockup-asset-form.svg)

#### 1.3 Feinschliff im Eigenschaften-Editor (PropertyEditor)
Nach der Erstellung ist das neue Asset im Strukturbaum markiert und die rechte Seitenleiste (Zone 4) öffnet sich automatisch[cite: 1, 10].
1. Kontrollieren Sie die **Währung** (für Schweizer Vorsorgekonten standardmäßig `CHF`)[cite: 10].
2. Prüfen Sie die Checkbox **Liquides Mittel**[cite: 10]. Bei der Zuweisung einer 3a-Klasse (`pension_3a_cash` oder `pension_3a_fund`) deaktiviert FinBundle PRO diese Box automatisch im Hintergrund, da Vorsorgegelder rechtlich gebunden sind und nicht in der Berechnung der kurzfristigen Liquiditätsreichweite (Notgroschen) auftauchen dürfen[cite: 10, 17].
3. Optional: Handelt es sich um einen 3a-Fonds, der an an einer Börse gehandelt wird, können Sie im Feld **Ticker (API)** das entsprechende Symbol eintragen, um die Wertanpassungen später über den LiveEditor via EODHD zu synchronisieren[cite: 6, 10].
4. Alle Anpassungen im PropertyEditor werden durch die **Auto-Save** Funktion verzugsfrei in den Tresor geschrieben[cite: 1, 10].


![alt](https://github.com/thomkerle/Swiss-Asset-Pro/blob/e52e717271e13e2094670d050bfa08fb1624bb3d/wiki-images/mockup-tree-setup.svg)

#### 1.4 Das finale Resultat
Der Strukturbaum aggregiert nun automatisch alle Ebenen. Wenn Sie weitere Banken und Assets (z.B. Ihr UBS Girokonto oder ein Aktien-Depot) hinzufügen, verdichtet FinBundle PRO die Werte in Echtzeit nach oben, während das neu erstellte 3a-Konto sauber in seiner Kategorie liegt.

![alt](https://github.com/thomkerle/Swiss-Asset-Pro/blob/d3a1c57333eccc883e9d7771fea269fb6bca710e/wiki-images/mockup-tree-final.svg)

### ⚠️ Troubleshooting: Die 3a Asset-Klassen im Vergleich

Häufige Zuordnungsfehler führen zu unerwartetem Verhalten bei der Performance-Berechnung oder in den Buchungsmasken. Hier sind die Unterschiede und typischen Fehlerbilder:

| Merkmal / Verhalten | 3a Sparkonto (`pension_3a_cash`)[cite: 3, 10] | 3a Wertschriftenfonds (`pension_3a_fund`)[cite: 3, 10] | 3a Verwaltetes Depot (`pension_3a_managed`)[cite: 3, 10] |
| :--- | :--- | :--- | :--- |
| **Typischer Anwendungsfall** | Traditionelles Bank-3a-Zinskonto (z. B. WIR, Raiffeisen)[cite: 1, 3] | Selbstdokumentierte ETFs/Fonds mit Stückzahl (z. B. Swisscanto)[cite: 1, 10] | Robo-Advisor mit täglicher Gesamtwertbewertung (z. B. VIAC, finpension, frankly)[cite: 1, 3] |
| **Primäre Buchungslogik** | Einzahlung / Auszahlung / Zinszahlung[cite: 3, 8] | Kauf / Verkauf (mit Stücken & Kursen)[cite: 8, 10] | Einzahlung / Auszahlung / Wertanpassung[cite: 8, 10] |
| **Ertragsermittlung** | Summe der Zinsbuchungen[cite: 3] | Realisierte & unrealisierte Kursgewinne + Dividenden[cite: 1, 3] | Gesamtwert abzüglich investiertem Kapital (Delta)[cite: 3, 10] |
| **Buchungsjournal Tabs** | Ein einheitliches Transaktionsjournal[cite: 7] | Getrennt in *Transaktionen* und *Marktdaten*[cite: 7] | Ein einheitliches Transaktionsjournal[cite: 7] |

#### Typische Fehlerbilder & Lösungen

1. **"Im Buchungsdialog fehlen die Felder für Stücke und Kurse!"**
   * **Ursache:** Das Asset wurde als `pension_3a_cash` oder `pension_3a_managed` deklariert[cite: 8, 10].
   * **Lösung:** Stellen Sie die Anlageklasse im PropertyEditor auf `pension_3a_fund` um, falls Sie Anteile und Einzelkurse führen möchten[cite: 8, 10].

2. **"Mein VIAC- oder finpension-Konto schwankt, aber ich will keine 20 Einzeltransaktionen pro Monat abtippen."**
   * **Ursache:** Fälschliche Verwendung von `pension_3a_fund` zwingt zur exakten Stückzahlführung[cite: 8, 10].
   * **Lösung:** Nutzen Sie `pension_3a_managed`[cite: 3, 10]. Sie buchen Ihre regulären monatlichen Einzahlungen ein und erfassen zum Monatsende lediglich eine *Wertanpassung* mit dem Gesamtsaldo laut App-Auszug[cite: 8, 10]. Der Report weist Kursgewinne und Performance automatisch korrekt aus[cite: 3].

3. **"Kursgewinne tauchen fälschlicherweise als Zinsertrag auf."**
   * **Ursache:** Ein Wertschriftenkonto wurde als `pension_3a_cash` klassifiziert[cite: 3, 10]. Bei Cash-Konten werden positive Wertanpassungen als Zinseszins interpretiert[cite: 3].
   * **Lösung:** Ändern Sie die Asset-Klasse auf `pension_3a_fund` oder `pension_3a_managed`[cite: 3, 10].

4. **"Neugeld wird im Vorsorge-Report nicht als YTD-Einzahlung gezählt."**
   * **Ursache:** Die Einzahlung wurde versehentlich als *Wertanpassung* verbucht oder der Buchungskommentar enthält Ausdrücke wie `#umbuchung` oder `übertrag`[cite: 3].
   * **Lösung:** Verwenden Sie den Buchungstyp *Einzahlung* oder kennzeichnen Sie Direktkäufe im Kommentar mit `#neugeld`[cite: 3].

