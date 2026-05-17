# FinSPA – Ganzheitliche Vermögens- & Budgetverwaltung

FinSPA ist eine moderne, hochgradig interaktive **Single Page Application (SPA)** auf React-Basis zur ganzheitlichen Überwachung und Planung von privaten Vermögenswerten, Wertpapieren, Immobilien, Vorsorge und Budgetflüssen.

Die App setzt konsequent auf **lokale Datenkontrolle** (keine Cloud-Verbindung, 100 % offline-fähig per JSON-Sicherung) und bietet eine intuitive 3-Spalten-Benutzeroberfläche zur nahtlosen Navigation.

---

## 🚀 Hauptfeatures (Überblick)

* **3-Spalten-Layout:** Strukturbaum (Links), interaktives Dashboard & Detail-Editor (Mitte) und dynamischer Eigenschaftseditor (Rechts).
* **Vollständige Vermögensverwaltung:** Unterstützung von Bargeldkonten, Depots (Aktien/Fonds), Kryptowährungen, Vorsorge-Säule 3a sowie komplexen Immobilien und Hypotheken.
* **Fremdwährungssupport (CHF, USD, EUR):** Automatische und tagesaktuelle Umrechnung mit anpassbaren Wechselkursen.
* **Detaillierte Transaktionen:** Getrennte Erfassung von Asset-Stammdaten (aktueller Kurs) und transaktionsspezifischen Merkmalen (Stückzahl, Kaufpreis, Transaktionswechselkurs, Steuern und Gebühren).
* **Integriertes Budgeting:** Monatliche Einnahmequellen, Ausgaben und Abonnements (inkl. Kündigungsfristen) mit Echtzeit-Sparquotenberechnung.
* **11 Professionelle Reports:** Bestandesberichte (u.a. Liquiditätsrisiko, Steuerreport), Bewegungsberichte (u.a. Wasserfall, passives Einkommen, Buchungsanalyse) sowie Zukunftsregressionen.
* **Main-Language & i18n:** Voller Support für Deutsch und Englisch inklusive eines dynamisch angepassten Benutzerhandbuchs.

---

## 🛠️ Ausführung & Installation

Da die gesamte FinSPA-Anwendung in einer einzigen, robusten React-Datei (`FinSPA.jsx`) konsolidiert wurde, entfällt das fehleranfällige Entpacken von ZIP-Archiven oder die lokale CORS-Konfiguration. 

1. Kopiere den Quellcode der `FinSPA.jsx` in deine lokale Entwicklungsumgebung oder lade ihn direkt im Web-Interface hoch.
2. Starte die Anwendung direkt im Browser.
3. Klicke in der Menüleiste auf **Datei -> Öffnen (JSON)**, um deine bestehenden Projektdaten oder Demodaten zu laden.

---

## 📖 Implementierte Use Cases

### 🏦 Strukturierung (UCASE001 - UCASE003)
* **UCASE001 (Banken):** Flexibles Erfassen mehrerer Institute/Broker auf der obersten Baumebene.
* **UCASE002 (Löschen):** Sicherheitsüberprüfung beim Löschen von Knoten mit der Option zum **Archivieren** (Daten bleiben für Reports erhalten) oder zum dauerhaften Löschen.
* **UCASE003 (Kategorien):** Beliebig tief schachtelbare Zwischenebenen innerhalb der Banken (z.B. *UBS -> Sparen -> Festgeld -> Konto*).

### 💳 Assets & Transaktionen (UCASE004 - UCASE005)
* **UCASE004 (Assets):** Erfassen des eigentlichen Kontoblatts mit Währung und Liquiditäts-Flag.
* **UCASE005 (Buchungen):** Tabellarische Übersicht. Transaktions-Eigenschaften (Kaufkurse, Gebühren, Steuern) sind sauber von Asset-Stammdaten getrennt.

### 🏡 Spezial-Assets (UCASE006 - UCASE009)
* **UCASE006 (Depot-Wertpapiere):** Spezifische Buchungsmaske für Käufe/Verkäufe. Der Wechselkurs zum exakten Transaktionszeitpunkt wird separat getrackt.
* **UCASE007 (Vorsorge / Säule 3a):** Unterstützung von Vorsorgekonten und Vorsorgedepots. Diese werden vom System automatisch als *illiquide* eingestuft.
* **UCASE008 (Kryptowährungen):** Tracken von volatilen Krypto-Assets (z.B. Bitcoin) inklusive Bruchteil-Stückzahlen.
* **UCASE009 (Immobilien & Hypotheken):**
  * Immobilien werden als positiver Sachwert geführt (Anpassungen über *Wertanpassungen*).
  * Hypotheken werden als **negativer Saldo** erfasst. Amortisationen (Abzahlungen) und Zinszahlungen werden separat kontiert, um die finanzielle Gesundheit exakt zu bewerten.

---

## 📊 Reports (FUNREQ026 - FUNREQ046)

1. **Allokation nach Banken:** Proportionale Verteilung des Kapitals als Kreisdiagramm.
2. **Liquiditätsrisiko:** Strikte Gegenüberstellung von sofort verfügbaren Mitteln vs. gebundenen Vorsorge- oder Immobiliengeldern.
3. **Steuerreport:** Schnelle Übersicht aller Brutto-Vermögenswerte und Schulden zum gesetzlichen Stichtag am 31.12.
4. **Kategorienfluss:** Performance-Vergleich aller Assets gruppiert nach ihren Baumkategorien.
5. **Wasserfallfluss:** Veranschaulicht, ob dein Vermögenszuwachs aus eigener Sparleistung (Zuflüssen) oder aus Marktrendite/Zinsen resultiert.
6. **Passives Einkommen:** Konsolidierter Monitor für Dividenden, Zinsen (z.B. Sparkontoerträge) und Mieteinnahmen.
7. **Buchungsanalyse:** Automatische Auswertung aller getätigten Ausgaben, visualisiert nach Kategorien.
8. **Zukunfts-Simulation:** Lineare und exponentielle Performance-Projektion (bis zu 5 Jahre) unter Berücksichtigung von künftigen Lebensereignissen (Szenarien wie z.B. Autokauf oder Erbschaften) und dem persönlichen FIRE-Sparziel.

---

## 🔒 Datenschutz & Sicherheit

FinSPA speichert zu keinem Zeitpunkt Daten auf externen Servern. Die Anwendung läuft vollständig clientseitig im Browser. Backups werden als reine `.json`-Textdateien auf deiner lokalen Festplatte gesichert und geladen. Dadurch bleibt deine finanzielle Privatsphäre zu 100% geschützt.
