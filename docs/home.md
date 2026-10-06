FinBundle PRO - Version 1.0.0 - RC3.1 - ist eine autarke, offline-first Enterprise Wealth Architecture zur Verwaltung komplexer Vermögensstrukturen. Die Applikation ist als Single-Page-Application (SPA) konzipiert und nutzt einen modernen Tech-Stack aus React, Electron, Tailwind CSS und Apache ECharts, der vollständig unter der MIT Lizenz veröffentlicht wird.

### Core Architecture (Zero-Cloud)

Im Gegensatz zu herkömmlichen Multi-Tenant-Clouds verbleibt die vollständige Datenhoheit auf dem lokalen System.

*   **AES-256 ZIP Vault:** Der gesamte Applikationsstatus (Memory State) wird via PBKDF2 und AES-256-CBC verschlüsselt und über die W3C File Access API direkt auf der lokalen Festplatte persistiert.
*   **Sandboxed AI-Injektor:** KI-Analysen werden über eine strikte Trennung von Code-Generierung und Daten-Execution realisiert, kompatibel mit lokalen Runtimes wie Ollama.
*   **5-Zonen UI-Layout:** Die ergonomische Navigation gliedert sich in MenuBar, hierarchischen TreeView, kontextsensitive EditorArea, dynamischen PropertyEditor und ein überlagerndes Fly-In Cockpit.
*   **PII-Gate:** Ein clientseitiger Regex-Filter anonymisiert Personendaten (Namen, IBANs) direkt bei der Beleg-Erfassung.

## Core Engines & Data Flow

Die technische Geschäftslogik ist in spezialisierte Engines gekapselt, die unabhängig vom UI-Rendering operieren und maximale Berechnungsgeschwindigkeit bei der Aggregation der Hierarchiebäume garantieren.

### Key Components

*   **Auto-Valuation v2:** Synthetisiert die Differenz zwischen historisch investiertem Kapitaleinsatz (Principal) und dem aktuellen Marktwert zur automatischen P&L-Buchungsanpassung.
*   **Total Return Spikes:** Eine mathematische Rendering-Logik, die ausgeschüttete Dividenden nahtlos in die visuellen Performance-Graphen reintegriert.
*   **ApiSyncEngine:** Koordiniert den Abruf historischer und Intraday-Börsenkurse (EODHD, Alpha Vantage) sowie Devisenkurse (Frankfurter API) mit aggressiven lokalen Caching-Strategien.
*   **Reporting Suite:** 15 dedizierte Standardberichte, darunter die Wasserfall-Brückenrechnung und die Performance-Isolierung für Schweizer Vorsorgegelder (Säule 3a, PK).
*   **PdfToolkit:** Generiert clientseitig native, hochauflösende Vektor-PDFs inklusive Paginierung und Chart-Injektion ohne externe Render-Server.

### Key Shortcuts
!sind in vorherigen Versionen noch nicht implementiert!
