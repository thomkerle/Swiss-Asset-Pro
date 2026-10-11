# FinBundle Pro — Benutzerhandbuch: Mitteilungszentrale & KI-Buchungsassistent

Dieses Benutzerhandbuch beschreibt die Einrichtung, Funktionsweise und tägliche Nutzung der **Mitteilungszentrale** (Intelligence Hub) sowie des **KI-gestützten Buchungsassistenten** (FinBundle Copilot). Beide Werkzeuge unterstützen dich bei der Überwachung deines Portfolios und der fehlerfreien Erfassung von Einnahmen und Ausgaben, während alle Finanzdaten lokal auf deinem Rechner verbleiben.

---

## 1. Übersicht & Kernfunktionen

* **Natürlicher Buchungs-Dialog:** Erfasse Buchungen per Freitext oder Spracheingabe (z. B. *"Buche 23.85 bei der UBS auf mein Hauptkonto mit Valuta 08.10., Kategorie Lebensmittel, Buchungstext: Coop Einkauf"*).
* **Visuelle Kontrolle vor dem Verbuchen:** Der gesprochene Text landet direkt im Eingabefeld zur Prüfung und Korrektur, bevor die Buchung ausgelöst wird.
* **Sammelbuchungen (Batch-Booking):** Diktierte Kreditkarten- oder Kassenbelege mit mehreren Positionen werden in einem Schritt aufgeteilt und verbucht.
* **Börsen-Radar (Mitteilungszentrale):** Überwacht Wertpapiere mit Ticker im 10-Minuten-Takt. Kacheln zeigen Kursbewegungen und den Gesamteffekt in CHF an. Bei Abweichungen ab **$\ge 5\,\%$** signalisiert ein oranger, pulsierender Rahmen Handlungsbedarf.
* **Nahtlose Historie:** Die Mitteilungszentrale merkt sich die letzten 10 aufgerufenen Ansichten, Berichte und Konten; ein Klick springt direkt an die entsprechende Stelle im Programm.
* **Lokale Datenhoheit (Offline-First):** Kontostände, Depotsummen und Transaktionshistorien verbleiben auf deinem Computer. Die Cloud-KI verarbeitet ausschliesslich den gesprochenen Befehl und Kontonamen als neutrale Metadaten.

---

## 2. Architektur & Datenfluss

```text
+----------------------------------------------------------------------------------------------------+
|                                    DEIN RECHNER (LOKALE UMGEBUNG)                                  |
|                                                                                                    |
|  [Mikrofon / Tastatur]                                                                             |
|          |                                                                                         |
|          v                                                                                         |
|  +----------------------------------------------------------------------------------------------+  |
|  | QuickAgentBar (Eingabeleiste)                                                                |  |
|  | - Audio-Aufnahme via HTML5 MediaRecorder (lokales Opus-Audio)                                |  |
|  | - Visuelles Textfeld zur Kontrolle und Korrektur des erkannten Textes                       |  |
|  +-----------------------------------------------+----------------------------------------------+  |
|                                                  |                                                 |
|                                                  v                                                 |
|  +----------------------------------------------------------------------------------------------+  |
|  | FinBundleAgentEngine (Lokaler Orchestrator)                                                  |  |
|  | - Bereitet Struktur-Metadaten vor (Banknamen, Kategorien, Händler-Memory)                    |  |
|  | - Hält Salden, Beträge und Portfoliowerte vollständig zurück                                 |  |
|  +-----------------------+----------------------------------------------------------------------+  |
|                          |                                                                         |
+--------------------------|-------------------------------------------------------------------------+
                           | HTTPS (Zustandsloser Request)
                           v
+----------------------------------------------------------------------------------------------------+
|                                      GOOGLE CLOUD (GEMINI API)                                     |
|                                                                                                    |
|  Modell: gemini-3.8-flash                                                                          |
|  - Wandelt Audio in Text um (Transkription)                                                        |
|  - Übersetzt Sprachbefehle in strukturierte Parameter:                                             |
|    { bankName: "UBS", accountName: "Hauptkonto", amount: 23.85, date: "2026-10-08", ... }          |
+----------------------------------------------------------------------------------------------------+
                           |
                           | Strukturierte Antwort (Function Call)
                           v
+----------------------------------------------------------------------------------------------------+
|                                    DEIN RECHNER (LOKALE AUSFÜHRUNG)                                |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | FinBundleWriteEngine (Lokale Buchungs-Logik)                                                 |  |
|  | - Findet Zielkonto in der Baumstruktur (findAssetByNameOrId)                                 |  |
|  | - Validiert Datum/Valuta und Betrag                                                          |  |
|  | - Schreibt Buchung direkt in deine lokale FinBundle-Datei                                    |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | ActivityNotificationEngine (Börsen-Radar & Historie)                                         |  |
|  | - Ruft Live-Kurse via EODHD ab (nur Ticker wie 'NOVN.SW'; keine Depotbestände)               |  |
|  | - Prüft Devisenkurse via Frankfurter API (z. B. EUR/CHF)                                      |  |
|  | - Berechnet Kursgewinne/-verluste lokal und steuert das Signal-Pulsieren                     |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Benutzeroberfläche & Komponenten

### QuickAgentBar (Aktionsleiste oben)

Die Leiste befindet sich am oberen Bildschirmrand und bietet schnellen Zugriff auf Diktat, Buchungseingabe und den Status der Mitteilungszentrale:

```xml
<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 920 70" width="100%" height="70">
  <defs>
    <linearGradient id="copilotGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="920" height="70" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" rx="8"/>
  <rect x="20" y="17" width="36" height="36" rx="10" fill="url(#copilotGrad)"/>
  <path d="M38 27 L40 33 L46 35 L40 37 L38 43 L36 37 L30 35 L36 33 Z" fill="#fef08a"/>
  <text x="66" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#0f172a" letter-spacing="0.5">FINBUNDLE COPILOT</text>
  <rect x="205" y="17" width="36" height="36" rx="10" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
  <rect x="219" y="26" width="8" height="12" rx="4" fill="#2563eb"/>
  <path d="M216 33 C216 38, 230 38, 230 33" stroke="#2563eb" stroke-width="1.5" fill="none"/>
  <line x1="223" y1="38" x2="223" y2="42" stroke="#2563eb" stroke-width="1.5"/>
  <rect x="249" y="17" width="510" height="36" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="263" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" fill="#334155">Buche 23.85 bei der UBS auf Hauptkonto Valuta 08.10. Kategorie Lebensmittel...</text>
  <rect x="767" y="17" width="82" height="36" rx="10" fill="#2563eb"/>
  <text x="793" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="700" fill="#ffffff">Buchen</text>
  <rect x="857" y="17" width="36" height="36" rx="10" fill="#fffbeb" stroke="#fef3c7" stroke-width="1"/>
  <path d="M875 25 C871 25, 868 28, 868 32 L868 37 L866 39 L884 39 L882 37 L882 32 C882 28, 879 25, 875 25 Z" fill="#d97706"/>
  <circle cx="887" cy="21" r="7" fill="#dc2626"/>
  <text x="885" y="24" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">2</text>
</svg>
```

### Mitteilungszentrale (Slide-Over Drawer)

Durch Klick auf das Aktivitäts-Symbol öffnet sich der seitliche Drawer:

```xml
<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 440 600" width="100%" height="600">
  <rect width="440" height="600" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <rect width="440" height="65" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="20" y="16" width="32" height="32" rx="8" fill="#2563eb"/>
  <path d="M26 32 L31 32 L34 24 L38 40 L41 32 L46 32" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="62" y="34" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="900" fill="#0f172a" letter-spacing="0.5">MITTEILUNGSZENTRALE</text>
  <text x="62" y="47" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9.5" fill="#64748b">Marktradar (10-Min-Takt) &amp; Historie</text>
  <rect y="65" width="440" height="40" fill="#ffffff" stroke="#f1f5f9" stroke-width="1"/>
  <text x="30" y="89" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="800" fill="#2563eb">BÖRSEN-RADAR</text>
  <line x1="25" y1="104" x2="125" y2="104" stroke="#2563eb" stroke-width="2"/>
  <text x="160" y="89" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#64748b">BUCHUNGS-AUDIT</text>
  <text x="310" y="89" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#64748b">VERLAUF (10)</text>
  
  <!-- Tile 1: >= 5% Abweichung mit orangem Signalrand -->
  <rect x="20" y="120" width="400" height="135" rx="14" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/>
  <rect x="35" y="133" width="56" height="20" rx="6" fill="#ffffff" stroke="#fde68a" stroke-width="1"/>
  <text x="63" y="147" font-family="monospace" font-size="9.5" font-weight="900" fill="#1e293b" text-anchor="middle">NOVN.SW</text>
  <rect x="330" y="133" width="75" height="20" rx="6" fill="#f59e0b"/>
  <text x="367" y="147" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8.5" font-weight="900" fill="#ffffff" text-anchor="middle">SIGNAL &gt;= 5%</text>
  <text x="35" y="171" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Novartis AG N (Degiro)</text>
  <rect x="35" y="181" width="370" height="42" rx="8" fill="#ffffff" stroke="#fef3c7" stroke-width="1"/>
  <text x="45" y="196" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8" font-weight="700" fill="#94a3b8">BUCHUNGSKURS</text>
  <text x="45" y="212" font-family="monospace" font-size="11" font-weight="700" fill="#334155">94.20 CHF</text>
  <path d="M210 200 L215 195 L220 200 M215 195 L215 210" fill="none" stroke="#10b981" stroke-width="2"/>
  <text x="395" y="196" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8" font-weight="700" fill="#94a3b8" text-anchor="end">LIVE (EODHD)</text>
  <text x="395" y="212" font-family="monospace" font-size="11.5" font-weight="900" fill="#0f172a" text-anchor="end">99.50 CHF</text>
  <text x="35" y="242" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#047857">Effekt: +265.00 CHF</text>
  <text x="405" y="242" font-family="monospace" font-size="11" font-weight="900" fill="#047857" text-anchor="end">+5.63%</text>

  <!-- Tile 2: Normale Position -->
  <rect x="20" y="270" width="400" height="135" rx="14" fill="#fff1f2" stroke="#fecdd3" stroke-width="1.5"/>
  <rect x="35" y="283" width="56" height="20" rx="6" fill="#ffffff" stroke="#fda4af" stroke-width="1"/>
  <text x="63" y="297" font-family="monospace" font-size="9.5" font-weight="900" fill="#1e293b" text-anchor="middle">PSEC.US</text>
  <text x="35" y="321" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Prospect Capital (IBKR)</text>
  <rect x="35" y="331" width="370" height="42" rx="8" fill="#ffffff" stroke="#ffe4e6" stroke-width="1"/>
  <text x="45" y="346" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8" font-weight="700" fill="#94a3b8">BUCHUNGSKURS</text>
  <text x="45" y="362" font-family="monospace" font-size="11" font-weight="700" fill="#334155">4.80 USD</text>
  <path d="M210 348 L215 353 L220 348 M215 353 L215 338" fill="none" stroke="#f43f5e" stroke-width="2"/>
  <text x="395" y="346" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8" font-weight="700" fill="#94a3b8" text-anchor="end">LIVE (EODHD)</text>
  <text x="395" y="362" font-family="monospace" font-size="11.5" font-weight="900" fill="#0f172a" text-anchor="end">4.68 USD</text>
  <text x="35" y="392" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#be123c">Effekt: -54.20 CHF</text>
  <text x="405" y="392" font-family="monospace" font-size="11" font-weight="900" fill="#be123c" text-anchor="end">-2.50%</text>

  <rect y="560" width="440" height="40" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="20" y="584" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9.5" fill="#64748b">FinBundle Intelligence Hub</text>
  <text x="420" y="584" font-family="monospace" font-size="9.5" fill="#64748b" text-anchor="end">Intervall: 10 Min.</text>
</svg>
```

---

## 4. Voraussetzungen & Ersteinrichtung

Damit der Sprachassistent und die Kursabfragen fehlerfrei funktionieren, sind zwei Schritte erforderlich:

### A. API-Keys in den Einstellungen hinterlegen
Öffne in FinBundle Pro die **Einstellungen** (Zahnrad-Symbol):
1. **Google Gemini API Key:** Unter *KI-Assistent* eintragen. Der Key kann kostenlos über [Google AI Studio](https://aistudio.google.com/) erstellt werden. Er wird für die Audio-Transkription und die Strukturierung der Buchungsbefehle benötigt.
2. **EODHD API Key:** Unter *Finanz-APIs* hinterlegen. Erforderlich für den automatischen Abruf der Aktien- und ETF-Schlusskurse im Börsen-Radar.

### B. Spracheingabe & Browser-Berechtigungen (Google Chrome & Windows)
Wenn FinBundle Pro im Browser ausgeführt wird, sind für den Zugriff auf Mikrofon und externe APIs zwei Einstellungen erforderlich:

1. **Windows Mikrofon-Freigabe (Desktop-Apps):**
   * Öffne die Windows-Einstellungen mit **`Win + I`**.
   * Gehe zu **Datenschutz und Sicherheit $\rightarrow$ Mikrofon**.
   * Vergewissere dich, dass **Mikrofonzugriff** auf **Ein** steht.
   * Scrolle nach unten zum Bereich **Desktop-Apps den Zugriff auf das Mikrofon erlauben** und stelle diesen Schalter zwingend auf **Ein**. Prüfe, dass dein Browser (z. B. Google Chrome) in dieser Liste freigegeben ist.
   * *Prüfung:* Klicke in FinBundle Pro auf das Mikrofon-Symbol. Der Button färbt sich rot pulsierend und in der Windows-Taskleiste (unten rechts) erscheint das Mikrofon-Icon.
2. **CORS-Unblocker für externe Schnittstellen:**
   * Wenn FinBundle Pro als lokale Datei (`file:///...`) im Browser läuft, blockiert Chromium Aufrufe an externe APIs (z. B. Frankfurter Devisenkurse oder EODHD) aufgrund der *Same-Origin-Policy*.
   * Installiere im Chrome Web Store eine Browser-Erweiterung zur CORS-Freigabe (z. B. *CORS Unblock* oder *Allow CORS*) und aktiviere sie für den Tab von FinBundle Pro.
   * *Prüfung:* In der Mitteilungszentrale werden im Reiter *Börsen-Radar* aktuelle Wechselkurse (EUR/CHF, USD/CHF) geladen, ohne dass in der Browserkonsole (`F12`) rote CORS-Fehlermeldungen erscheinen.

---

## 5. Buchungsassistent: Workflows & Prompt-Beispiele

### Workflow beim Erfassen von Belegen

```text
[1. Mikrofon klicken]  -->  [2. Beleg sprechen]  -->  [3. Text prüfen]  -->  [4. Enter / Buchen]
      (Button pulsiert)          ("Coop 24.50...")        (Steht im Feld)      (Direkt verbucht)
```

1. Klicke auf das **Mikrofon-Symbol** in der oberen Aktionsleiste.
2. Sprich deine Buchungsanweisung deutlich.
3. Klicke erneut auf das Symbol (oder warte kurz): Der transkribierte Text erscheint direkt im Eingabefeld.
4. Kontrolliere Betrag und Konto. Korrigiere Tippfehler bei Bedarf per Tastatur.
5. Drücke **Enter** oder klicke auf **Buchen**. Die Buchung wird sofort angelegt.

---

### Bewährte Prompt-Muster

| Anwendungsfall | Beispiel-Prompt | Was der Assistent tut |
| :--- | :--- | :--- |
| **Präzise Einzelbuchung** | *„Buche 23.85 bei der UBS auf mein Hauptkonto mit Valuta 08.10.2026, Kategorie Lebensmittel, Buchungstext: Coop Einkauf“* | Findet das Unterkonto „Hauptkonto“ bei der Bank „UBS“, setzt Valuta `2026-10-08`, Kategorie `Lebensmittel` und Kommentar `Coop Einkauf`. |
| **Sammelbeleg (Kreditkarte)** | *„Auf die Kreditkarte verbuchen: Migros 74.50, SBB Ticket 14 Franken, Restaurant Bären 68 Franken und Coop 18.20“* | Teilt die Anweisung automatisch in 4 Einzelbuchungen auf und weist jeder Position die passende Kategorie zu. |
| **Kartenabrechnung ausgleichen** | *„Kreditkartenabrechnung von 850 Franken via UBS Privatkonto begleichen“* | Führt eine Umbuchung aus: 850 CHF Abgang vom UBS Privatkonto und 850 CHF Gutschrift auf der Kreditkarte. |
| **Relatives Datum** | *„Vorgestern 65 Franken für Benzin bei Avia auf PostFinance verbucht“* | Ermittelt ausgehend vom heutigen Tag das Datum von vorgestern und bucht auf PostFinance mit Kategorie `Mobilität`. |

> **Tipp:** Wenn du mehrere Konten mit ähnlichem Namen besitzt (z. B. zwei Konten namens *„Privatkonto“*), nenne die Bank im Satz dazu (*„...bei der Raiffeisen auf mein Sparkonto...“*). Das System steuert dann zielsicher das richtige Institut an.

---

## 6. Die Mitteilungszentrale im Detail

Die Mitteilungszentrale fasst Marktentwicklungen und Aktivitäten zusammen, ohne eigenmächtig Buchungen zu erzeugen.

### A. Börsen-Radar (Reine Marktinformation)
* **Vergleich:** Der hinterlegte Buchungskurs (letzter im Journal erfasster Kurs) wird mit dem aktuellen EODHD-Schlusskurs verglichen.
* **Kachel-Darstellung:**
  * **Grüne Kachel ($\blacktriangle$):** Kurs gestiegen. Zeigt den Kursgewinn in Prozent und den absoluten Wertzuwachs auf deinen Gesamtbestand in CHF.
  * **Rote Kachel ($\blacktriangledown$):** Kurs gefallen. Zeigt den prozentualen Verlust und den Effekt in CHF.
* **Signal bei $\ge 5\,\%$:** Weicht ein Titel um 5 % oder mehr vom Buchungskurs ab, erhält die Kachel einen **orangen Rahmen**, ein **Warn-Badge** und **pulsiert**. Gleichzeitig erscheint auf dem Glocken-Icon in der oberen Leiste ein roter Zähler, der auf möglichen Handlungsbedarf (z. B. Rebalancing oder Gewinnmitnahme) hinweist.
* **Filter:** Über die oberen Buttons kannst du die Ansicht filtern: *Alle*, *Nur Signale ($\ge 5\,\%$)*, *Gewinner* oder *Verlierer*.

### B. Buchungs-Audit
* Zeigt alle Transaktionen, die in den **letzten 2 Stunden** (oder am aktuellen Tag) erfasst wurden.
* Ermöglicht die Kontrolle frisch gesprochener oder eingetragener Buchungen im Überblick.
* Ein Klick auf einen Eintrag öffnet das entsprechende Konto im Hauptfenster.

### C. Verlauf (History-Navigation)
* Speichert automatisch die **letzten 10 aufgerufenen Objekte** (Depots, Bankkonten, Berichte oder Budget-Kategorien).
* Klickst du auf einen Verlaufseintrag, stellt FinBundle Pro die jeweilige Ansicht sofort wieder her.

---

## 7. Troubleshooting & Häufige Fragen

### 1. Das Mikrofon reagiert nicht / `NotAllowedError: Permission denied by system`
* **Ursache:** Windows blockiert den Mikrofonzugriff für Desktop-Anwendungen oder Chrome hat keine Berechtigung.
* **Lösung:**
  1. Öffne die Windows-Einstellungen mit **`Win + I`**.
  2. Navigiere zu **Datenschutz und Sicherheit $\rightarrow$ Mikrofon**.
  3. Aktiviere den Schalter **Desktop-Apps den Zugriff auf das Mikrofon erlauben**.
  4. Stelle sicher, dass Google Chrome in der Liste darunter aufgeführt und nicht gesperrt ist.
  5. Starte den Browser neu.

### 2. Devisenkurse oder Börsendaten laden nicht (CORS-Fehler)
* **Ursache:** FinBundle Pro wird als lokale Datei über `file:///` ausgeführt. Der Browser verweigert API-Aufrufe an externe Adressen.
* **Lösung:** Installiere im Chrome Web Store eine CORS-Erweiterung (z. B. *CORS Unblock*) und aktiviere sie für den FinBundle-Tab. Alternativ kann FinBundle über einen lokalen Webserver gestartet werden (z. B. im Projektordner im Terminal: `npx serve .`).

### 3. Fehlermeldung: `Gemini API Fehler: Model models/gemini-2.5-flash is no longer available`
* **Ursache:** Im Speicher deines Browsers liegt noch ein veralteter Modellname.
* **Lösung:** Öffne die Entwicklerkonsole mit **`F12`**, wechsle in den Reiter **Console**, gib folgenden Befehl ein und bestätige mit Enter:
  ```javascript
  localStorage.removeItem('finbundle_gemini_active_model');
  ```
  Lade die Seite mit **`F5`** neu. Das System wählt nun automatisch das aktuelle Modell `gemini-3.8-flash`.

### 4. Buchung landet auf dem falschen Konto
* **Ursache:** Es existieren mehrere Konten mit ähnlichem Namen (z. B. zwei Konten namens *„Privatkonto“*).
* **Lösung:** Nenne beim Diktieren immer die zugehörige Bank mit (z. B. *„...bei der UBS auf mein Privatkonto...“*). Die Engine filtert dann gezielt innerhalb dieser Bankstruktur.

---

## 8. Glossar

* **Buchungskurs:** Der Anschaffungs- oder Bilanzkurs, mit dem eine Wertschrift aktuell in deinen Büchern steht.
* **EODHD:** *End of Day Historical Data* – Ein Datenanbieter für historische und zeitnahe Aktienkurse.
* **Frankfurter API:** Eine frei zugängliche Schnittstelle für offizielle Devisenreferenzkurse der Europäischen Zentralbank.
* **Function Calling:** Verfahren, bei dem das KI-Sprachmodell einen Freitext-Befehl in exakte Parameter (Betrag, Währung, Valuta, Konto) übersetzt.
* **Merchant-Memory:** Ein lokales Verzeichnis, das häufig genutzte Händlernamen (z. B. *Migros*, *SBB*) automatisch mit deinen gewohnten Kategorien verknüpft.
* **Offline-First:** Softwareprinzip, bei dem alle Daten lokal gespeichert werden. Die Anwendung bleibt ohne Internetverbindung lauffähig; Cloud-Dienste werden nur als temporäre Werkzeuge zugeschaltet.
* **Valuta:** Das buchhalterische Datum der Wertstellung einer Ausgabe oder Einnahme.
