# Deadlock Personal Intelligence

Persönliches Deadlock-Dashboard für Matches, Helden, Builds und die eigene
Entwicklung. Die Website wird statisch über GitHub Pages veröffentlicht.

## Hosting

Der Workflow `Deploy Deadlock Dashboard to Pages` prüft und veröffentlicht die
Website bei jedem Push auf `main`. Die statische Seite benötigt zur Laufzeit
keinen Server und gibt keine API-Schlüssel an den Browser weiter.

## Datenprinzip

Wie beim Übertreiber-Dashboard werden Live-Daten später innerhalb einer GitHub
Action abgerufen und als statische Dashboard-Daten ausgegeben:

1. GitHub Action liest den API-Key aus einem Repository-Secret.
2. Das Datenskript ruft die Deadlock- und Steam-Daten ab.
3. Tests prüfen die generierte Ausgabe.
4. GitHub Pages veröffentlicht ausschließlich die fertigen statischen Dateien.

Die Deadlock-Datenquelle wird erst integriert, nachdem ihre Verfügbarkeit mit
dem eigenen Steam-Konto verifiziert wurde.

## Lokale Prüfung

Voraussetzung: Node.js 20 oder neuer.

```text
npm test
```

Zum lokalen Anzeigen kann `index.html` direkt im Browser geöffnet werden.

## Zugangsdaten

Echte Zugangsdaten dürfen niemals in `.env`, HTML, JavaScript oder Git landen.
Für die spätere Datenaktualisierung werden sie unter
`Settings → Secrets and variables → Actions` als GitHub-Secrets hinterlegt.
