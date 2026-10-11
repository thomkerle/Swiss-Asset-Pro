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


![Mockup MessageCentral_Feature](./wiki-images/mockup-messagecentral_feature.svg)

### Mitteilungszentrale (Slide-Over Drawer)

Durch Klick auf das Aktivitäts-Symbol öffnet sich der seitliche Drawer:

![Mockup QuickAgentBar_Feature](./wiki-images/mockup-uickagentbar_feature.svg)

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
