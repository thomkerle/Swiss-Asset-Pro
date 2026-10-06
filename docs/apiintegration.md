FinBundle PRO bietet die Möglichkeit, Börsenkurse, Devisen und Fundamentaldaten automatisiert abzurufen. Der **API LiveEditor** (`ApiLiveEditorDashboard.jsx`)[cite: 21] dient hierfür als zentrale Schaltstelle. Da FinBundle PRO eine autarke Offline-Anwendung ist, greift sie für Marktdaten direkt von Ihrem Rechner auf externe Schnittstellen zu[cite: 1, 21].

### Unterstützte Datenprovider

Das System ist primär für die Nutzung mit **EODHD** (End of Day Historical Data) und **Alpha Vantage** optimiert[cite: 21]. Beide Provider bieten eine kostenlose Basis-Ebene an (Stand Ende 2026).

#### EODHD (Primäre Empfehlung)
EODHD ist tief in FinBundle PRO integriert und liefert die stabilsten und umfangreichsten Daten[cite: 21].
*   **Funktionen:** Historische End-of-Day (EOD) Kurse, Intraday-Daten, Live-Realtime-Metriken und umfangreiche Fundamentaldaten (Dividendenrendite, KGV, EPS)[cite: 21].
*   **Kostenlos (Basis):** Die kostenfreie API erlaubt in der Regel eine begrenzte Anzahl an Aufrufen pro Tag, was für kleine Portfolios mit wenigen Aktien/ETFs ausreichend ist.
*   **Kostenpflichtig (Erweitert):** Wenn Sie viele Aktien tracken, historische Daten über Jahrzehnte laden oder Intraday-Charts rendern möchten, ist ein kostenpflichtiges Abo zwingend erforderlich[cite: 21]. EODHD bietet verschiedene Pakete an (ca. 20 bis 50 USD pro Monat, abhängig vom Datenumfang).
*   **Integration:** Das System ist intensiv auf EODHD getestet. Die ISIN-Auflösung zu Ticker-Symbolen funktioniert beispielsweise primär über diese API[cite: 21].

#### Alpha Vantage (Sekundäres Fallback)
Alpha Vantage dient in FinBundle PRO hauptsächlich als Fallback für aktuelle Kurse und Basis-Fundamentaldaten[cite: 21].
*   **Kostenlos (Basis):** Bietet ebenfalls eine kostenlose Einstiegsebene mit strengen Limits (z. B. 25 Aufrufe pro Tag).
*   **Funktionen:** Liefert verlässliche Schlusskurse für amerikanische Werte, ist bei europäischen oder Schweizer Titeln (SIX) jedoch oft lückenhaft.

### Basisbedienkonzepte im LiveEditor

Um Live-Marktdaten abzurufen, müssen Sie folgende Schritte durchführen:

1.  **API Keys hinterlegen:** Ohne API Key funktioniert der Abruf nicht[cite: 21]. Navigieren Sie zu `Datei ➔ Einstellungen` und tragen Sie Ihren persönlichen EODHD oder Alpha Vantage API Key im Bereich `finApiKeys` ein[cite: 21].
2.  **Ticker eintragen:** Damit das System weiß, welches Wertpapier abgefragt werden soll, muss das Asset einen gültigen Ticker besitzen[cite: 21]. Im LiveEditor können Sie diesen direkt im Daten-Grid in der Spalte "Ticker (API)" eintragen (z. B. `AAPL.US` oder `NOVN.SW`)[cite: 21].
3.  **Live-Metriken abrufen:** Markieren Sie die gewünschten Assets über die Checkboxen und klicken Sie auf **Marktdaten (Live) laden**[cite: 21]. Das System ruft nun die aktuelle prozentuale und absolute Tagesveränderung ab[cite: 21]. *Achtung: Dies verbraucht API-Aufrufe!*[cite: 21]
4.  **Bulk-Sync (Kurse fixieren):** Mit dem Button **Markierte aktualisieren** wird der letzte verfügbare Schlusskurs in das Buchungsjournal der jeweiligen Assets geschrieben (als "API Kurs-Sync" Buchung)[cite: 21]. Dies aktualisiert Ihren Gesamtsaldo[cite: 21].
5.  **Charts & Analysen:** Im Tab *Chart Vergleiche* können Sie historische Verläufe, Intraday-Daten und technische Indikatoren (z. B. SMA 50, Bollinger Bands) rendern[cite: 21]. *Wichtig: Historische und Intraday-Charts laden massiv viele Datenpunkte herunter. Dies erfordert bei mehr als 1-2 Aktien fast immer eine kostenpflichtige EODHD-Subscription!*[cite: 21] Ohne Subscription bleibt der Chart oft leer oder das API-Limit ist sofort erschöpft.

### ⚠️ Troubleshooting: API & Marktdaten

| Symptom | Ursache & Lösung |
| :--- | :--- |
| **"Keine API Konfiguration / Live-Kurs Button deaktiviert"** | **Ursache:** Es wurde kein API Key in den Einstellungen hinterlegt[cite: 21].<br>**Lösung:** Registrieren Sie sich bei EODHD oder Alpha Vantage, kopieren Sie den API Key und fügen Sie ihn unter `Datei ➔ Einstellungen` ein[cite: 21]. |
| **"Kursabruf fehlgeschlagen / API-Limit erreicht"** | **Ursache:** Sie haben das Limit Ihres kostenlosen API-Plans erreicht oder der Ticker ist ungültig[cite: 21].<br>**Lösung:** Warten Sie bis zum nächsten Tag oder führen Sie ein Upgrade auf einen bezahlten Plan durch. Prüfen Sie zudem, ob der Ticker korrekt ist (z. B. Endung `.SW` für Schweizer Aktien vergessen?)[cite: 21]. |
| **"Historien-Chart oder Intraday-Chart bleibt leer"** | **Ursache:** Historische und Intraday-Daten erfordern meist eine aktive, kostenpflichtige Subscription bei EODHD[cite: 21]. Mit kostenlosen Keys liefert die API hier oft keine oder nur stark verzögerte Daten zurück.<br>**Lösung:** Prüfen Sie Ihr EODHD Abo-Modell. |
| **"Fundamentaldaten (Dividende, KGV) werden nicht angezeigt"** | **Ursache:** Der Ticker fehlt oder die API liefert für diesen spezifischen Markt/Titel keine Fundamentaldaten[cite: 21].<br>**Lösung:** Tragen Sie den Ticker nach. Bei Nischen-ETFs sind oft keine EPS oder KGV-Daten verfügbar. |
| **"Die Spalte 'Lokaler Kurs' weicht vom Chart ab"** | **Ursache:** Der 'Lokale Kurs' ist der zuletzt manuell oder per Bulk-Sync in Ihrem Buchungsjournal gespeicherte Kurs[cite: 21]. Der Chart zeigt hingegen die frischen Livedaten der API[cite: 21].<br>**Lösung:** Führen Sie einen Sync durch (`Markierte aktualisieren`), um das Journal auf den neuesten Stand zu bringen[cite: 21]. |
