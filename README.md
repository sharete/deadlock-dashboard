# Deadlock Personal Dashboard

Persönliches Deadlock-Performance-Dashboard für Matches, Helden und
Rangentwicklung. Die Website wird statisch und kostenlos über GitHub Pages
veröffentlicht.

## Datenfluss

1. GitHub Actions liest `STEAM_API_KEY` aus den Repository-Secrets.
2. Das Datenskript ordnet das konfigurierte Steam-Profil der Deadlock-Account-ID zu.
3. Profilinformationen kommen aus der Steam Web API.
4. Matchverlauf, Helden und Ränge kommen aus dem offenen Community-Projekt
   [Deadlock API](https://api.deadlock-api.com/docs).
5. GitHub Pages veröffentlicht ausschließlich die aufbereiteten JSON-Daten und
   die statische Website. Zugangsdaten gelangen nie in den Browser.

## Skalierbare Datenablage

- `data/dashboard.json` enthält den kompakten Matchindex für Statistiken und Diagramme.
- `data/recent-matches.json` enthält ausschließlich die zwölf neuesten Matches mit
  vollständigen Teamaufstellungen und Builds.
- `data/history/index.json` beschreibt die vollständige Historie.
- `data/history/page-XXXX.json` enthält jeweils bis zu 100 ältere Matchdetails und
  wird im Browser erst beim Öffnen eines solchen Matches geladen.

Damit wachsen Teamroster und Builds nicht mehr mit der Startdatei. Auch bei mehreren
tausend Matches bleibt die initial geladene Datenmenge begrenzt.

## Intelligence-Module

- Vollständiges, clientseitig filterbares Matcharchiv mit paginierten Detaildaten
- persönlicher Build- und Ability-Coach auf Basis der eigenen Matchhistorie
- Gegner-Analyse pro eigenem Hero und über den gesamten Hero Pool
- Rank-Kontext mit persönlichem Peak, Kurztrend und 30-Tage-Rangverteilung
- Deep Match Review mit Teamvergleich, Lane-Kontext, Economy-Kurve,
  Schlüsselereignissen und datenbasierten Review-Hinweisen

Coach- und Matchup-Werte zeigen Korrelationen aus der vorhandenen Stichprobe. Sie
werden bewusst nicht als garantierte Ursache oder allgemeingültige Meta-Empfehlung
ausgegeben.

Die Deadlock API ist ein Community-Projekt und nicht mit Valve verbunden.

## Konfiguration

Die öffentliche Steam-Profil-URL wird in `config/dashboard.json` eingetragen.
Alternativ kann `STEAM_ID64` als Repository-Secret oder Repository-Variable
gesetzt werden.

Erforderliches GitHub Secret:

- `STEAM_API_KEY`

Optionale Werte:

- `STEAM_ID64` – überschreibt die Profilangabe aus der Konfiguration
- `DEADLOCK_API_KEY` – erhöht je nach Konto die Limits der Community-API

## Aktualisierung

Der Workflow `Deploy Deadlock Dashboard to Pages` läuft bei Änderungen, manuell
und alle fünf Minuten. Er prüft die Anwendung, lädt aktuelle Daten und
veröffentlicht anschließend das fertige Pages-Artefakt.

## Lokale Prüfung

Voraussetzung ist Node.js 20 oder neuer.

```text
npm test
```

Für eine echte lokale Aktualisierung werden `STEAM_API_KEY` und entweder eine
Profilangabe in der Konfiguration oder `STEAM_ID64` benötigt:

```text
npm run generate
```

Zugangsdaten dürfen niemals in HTML, JavaScript, JSON oder Git eingecheckt werden.
