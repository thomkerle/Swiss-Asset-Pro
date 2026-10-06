Der PropertyEditor (Zone 4) am rechten Bildschirmrand ist die Steuerzentrale für die finanzmathematische Logik jedes einzelnen Assets. Sobald Sie ein Konto oder Wertpapier im Strukturbaum anklicken, öffnet sich dieses Panel automatisch. Alle Änderungen werden durch die integrierte Auto-Save-Funktion verzugsfrei gespeichert.

### 1. Verfügbare Basis-Felder

Je nach gewählter Anlageklasse passt sich der PropertyEditor dynamisch an[cite: 3]. Die wichtigsten Basis-Felder umfassen:

*   **Währung (Currency):** Die Originalwährung, in der das Asset geführt wird (z. B. CHF, USD, EUR)[cite: 3]. Fremdwährungen werden für das globale Reporting automatisch über den *Aktuellen Kurs* in die Basiswährung umgerechnet[cite: 3].
*   **Liquides Mittel (Checkbox):** Legt fest, ob dieses Asset Teil Ihres sofort verfügbaren "Notgroschens" ist[cite: 3]. Ist das Häkchen gesetzt, fließt der Saldo in den Report zur Liquiditätsreichweite ein. 
*   **Ticker (API) & ISIN:** Für börsengehandelte Assets zwingend notwendig, um die automatische Kurs- und Stammdatenaktualisierung zu gewährleisten[cite: 3].
*   **Wertpapier Status:** Ein schreibgeschützter Bereich (gelbe Karte), der die aktuelle Stückzahl und den letzten bekannten Preis aus Ihrem Buchungsjournal zusammenfasst[cite: 3].

### 2. Ticker für Aktien und ETFs eintragen

Das Feld **Ticker (API)** verknüpft Ihr lokales Asset mit den globalen Marktdaten der APIs (EODHD oder Alpha Vantage)[cite: 3].

*   **Formatierung beachten:** Tragen Sie hier das offizielle Börsensymbol inklusive der Länder- bzw. Börsen-Endung ein.
    *   *US-Markt:* Für Apple tragen Sie `AAPL.US` ein.
    *   *Schweizer Markt:* Für Novartis tragen Sie `NOVN.SW` ein.
*   **Auswirkung:** Sobald ein gültiger Ticker hinterlegt ist, kann FinBundle PRO im API LiveEditor historische Kurse und Livedaten abrufen.

---

### 3. Dividenden Prognose & Steuerthematik (Quellensteuer)

Für Einkommensinvestoren bietet der PropertyEditor eine dedizierte blaue Steuerungskarte namens **DIVIDENDEN PROGNOSE**[cite: 3]. Die hier getätigten Eingaben dienen *ausschließlich* der Simulation für den zukunftsgerichteten Report "Dividenden-Kalender"[cite: 3].

![alt](https://github.com/thomkerle/Swiss-Asset-Pro/blob/23ec3d7b016d4c9eaa84b59e1d552c2db1a1fab8/wiki-images/mockup-property-editor-dividends.svg)

#### Felder der Dividenden Prognose
1.  **Erwartete Rendite / Erw. Rendite (%):** Hier tragen Sie die erwartete, zukünftige jährliche Brutto-Dividendenrendite ein (z. B. `12.7`)[cite: 3].
2.  **Steuer-Total (%):** Hier definieren Sie den prozentualen Steuerabzug (Quellen- und/oder Verrechnungssteuer), der vor der Konto-Gutschrift einbehalten wird (z. B. `30` für US-Aktien ohne W-8BEN, `15` mit W-8BEN oder `35` für Schweizer Titel)[cite: 3].
3.  **Zahlmonate (1-12):** Eine kommagetrennte Liste der Monate, in denen das Unternehmen ausschüttet (z. B. `1,2,3,4,5,6,7,8,9,10,11,12` für monatliche Zahler)[cite: 3].

#### Die Auswirkungen auf den Dividenden-Kalender (Forward Report)
Die Steuerangabe hat **ausschließlich Effekt auf den Dividenden-Forward Report** (den in die Zukunft blickenden Kalender). 
Das System nimmt den aktuellen Marktwert Ihrer Stücke, multipliziert diesen mit der Brutto-Rendite und **zieht anschließend das Steuer-Total ab**. Das Resultat wird auf die markierten Zahlmonate verteilt. 

**Wichtig:** Der Report visualisiert dadurch exakt den **Netto-Cashflow**, der realistischerweise auf Ihrem Bankkonto eingehen wird. 

#### Verbuchung in der Realität (Kein Steuer-Tracking)
Der einbehaltene, potenziell rückforderbare Steuerbetrag wird in FinBundle PRO **nirgends je verbucht**. Das System führt keine virtuellen Schattenkonten für Steuerrückforderungen. 
Wenn Sie eine historische Dividende manuell im Journal nacherfassen, müssen Sie daher **immer den reinen Nettobetrag** eintragen, der effektiv auf Ihrem Bankkonto gutgeschrieben wurde.

---

### ⚠️ Troubleshooting: PropertyEditor & Dividenden

| Symptom | Ursache & Lösung |
| :--- | :--- |
| **"Ich habe einen Ticker eingetragen, aber der API-Abruf schlägt fehl."** | **Ursache:** Häufig fehlt das korrekte Börsen-Suffix (z. B. `.US` oder `.SW`).<br>**Lösung:** Suchen Sie das Symbol direkt auf der Datenprovider-Website, um das exakte Kürzel zu ermitteln[cite: 3]. |
| **"Mein ETF schüttet aus, aber die Prognose im Forward-Report ist leer."** | **Ursache:** Sie haben die Rendite eingetragen, aber das Feld *Zahlmonate (1-12)* ist leer.<br>**Lösung:** Tragen Sie die entsprechenden Monate als Zahlen (z. B. `3,6,9,12`) ein, damit die Engine weiß, wann der Cashflow zu erwarten ist[cite: 3]. |
| **"Wie verbuche ich eine Dividende manuell im Journal?"** | **Ursache:** Verwirrung um Brutto vs. Netto.<br>**Lösung:** Erfassen Sie im `FormModal` für Ihr Buchungsjournal **ausschließlich den Nettobetrag**, der Ihrem echten Bankkonto gutgeschrieben wurde. Rückforderbare Steuern werden in der Software nicht bilanziert. |
| **"Die Dividendenvorschau zeigt viel niedrigere Werte als erwartet."** | **Ursache:** Der *Forward Yield* bezieht sich auf den *aktuellen Marktwert*, nicht auf Ihr initial investiertes Kapital. Wenn der Kurs einer Aktie fällt, sinkt auch die Prognose des absoluten Auszahlungsbetrags.<br>**Lösung:** Aktualisieren Sie die "Erw. Rendite (%)", falls das Unternehmen die absolute Dividende beibehalten hat. |

---
