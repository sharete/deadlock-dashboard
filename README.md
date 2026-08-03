# Deadlock Personal Intelligence

Privates Dashboard für die Analyse der eigenen Deadlock-Matches, Helden und Builds.

## Aktueller Stand

- Professionelles, responsives Dashboard-Fundament
- Sichere serverseitige Konfiguration für Zugangsdaten
- Status-Endpunkt unter `/api/status`, der nur den Einrichtungsstatus ausgibt
- Noch keine erfundenen oder unbestätigten Deadlock-Datenquellen

## Lokale Einrichtung

1. Abhängigkeiten installieren: `npm install`
2. `.env.example` als `.env.local` kopieren
3. Steam Web API Key unter <https://steamcommunity.com/dev/apikey> erzeugen
4. `STEAM_API_KEY` und `STEAM_ID64` in `.env.local` eintragen
5. Entwicklungsserver starten: `npm run dev`

## Sicherheit

Echte Zugangsdaten gehören ausschließlich in `.env.local`. Diese Datei wird von
Git ignoriert. In Browser-Code dürfen keine geheimen Schlüssel mit
`NEXT_PUBLIC_` veröffentlicht werden.

## Geplante nächste Phase

Bevor Matchdaten angebunden werden, wird die verfügbare Deadlock-Datenquelle mit
dem eigenen Steam-Konto geprüft. Erst danach werden Datenmodell, Abrufintervall
und die Auswertungen für 30, 60 und 100 Matches festgelegt.
