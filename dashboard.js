const state = {
  data: null,
  locale: readStoredLanguage(),
  heroSort: "matches",
  recentMatches: [],
  historyPages: new Map(),
  reviewObserver: null,
  opponentQuery: "",
  opponentSort: "matches",
  opponentMinMatches: 1,
  opponentPage: 1,
};

const HERO_SAMPLE_MIN = 3;
const SESSION_GAP_MS = 90 * 60 * 1000;
const OPPONENT_PAGE_SIZE = 20;
const STEAM_ID64_BASE = 76561197960265728n;
const LANGUAGE_STORAGE_KEY = "deadlock-dashboard-language";

function readStoredLanguage() {
  try {
    return localStorage.getItem("deadlock-dashboard-language") === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

const ENGLISH_TEXT = new Map(Object.entries({
  "Deadlock Personal Dashboard Startseite": "Deadlock Personal Dashboard home",
  "Fast bereit.": "Almost ready.",
  "Ein Profil fehlt.": "One profile is missing.",
  "Der sichere Datenzugang steht. Jetzt muss nur noch dein öffentliches Steam-Profil mit dem Dashboard verbunden werden.": "Secure data access is ready. All that remains is connecting your public Steam profile to the dashboard.",
  "Datenzugang": "Data access",
  "2/4 bereit": "2/4 ready",
  "50 Prozent der Einrichtung abgeschlossen": "50 percent of setup complete",
  "Geschützt": "Protected",
  "Steam-Profil": "Steam profile",
  "SteamID64 fehlt": "SteamID64 missing",
  "Wartet auf Profil": "Waiting for profile",
  "API-Schlüssel bleiben in GitHub Actions. Die veröffentlichte Website erhält ausschließlich fertig aufbereitete Statistikdaten.": "API keys remain in GitHub Actions. The published website only receives fully processed statistics.",
  "Rang wird geladen": "Loading rank",
  "— Spielstunden": "— hours played",
  "Letztes Match —": "Last match —",
  "Fortschritt vergleichen →": "Compare progress →",
  "Leistungsübersicht": "Performance overview",
  "Kills + Assists pro Tod": "Kills + assists per death",
  "Matchdauer": "Match duration",
  "— analysiert": "— analyzed",
  "Rangentwicklung": "Rank progression",
  "Rank-Kontext →": "Rank context →",
  "Verlauf des Deadlock-Rangs": "Deadlock rank history",
  "Für einen Verlauf fehlen noch Rangdaten.": "There is not enough rank data for a timeline yet.",
  "Aktuelle Form": "Current form",
  "Siege aus den letzten 5": "Wins in the last 5",
  "Ergebnisse der letzten fünf Matches": "Results from the last five matches",
  "Serie": "Streak",
  "Bester Held": "Best hero",
  "Dein Hero Pool": "Your hero pool",
  "Hero Pool sortieren": "Sort hero pool",
  "Meiste Matches": "Most matches",
  "Build- & Ability-Coach": "Build & ability coach",
  "Gegner-Analyse →": "Opponent analysis →",
  "Erweiterte Hero-Analysen": "Advanced hero analysis",
  "Deine Spielsessions": "Your play sessions",
  "Die letzten sechs Sessions · Matches mit höchstens 90 Minuten Abstand werden zusammengefasst.": "The last six sessions · matches no more than 90 minutes apart are grouped together.",
  "Letzte Matches": "Recent matches",
  "Vollständiges Archiv →": "Full archive →",
  "Held": "Hero",
  "Ergebnis": "Result",
  "Dauer": "Duration",
  "Rang": "Rank",
  "Deine Gegnerbilanz": "Your opponent record",
  "Vollständige Matchhistorie": "Complete match history",
  "Gegner suchen": "Search opponents",
  "Name oder Steam-ID …": "Name or Steam ID …",
  "Sortierung": "Sort by",
  "Meiste Begegnungen": "Most encounters",
  "Höchste Winrate": "Highest win rate",
  "Höchste Lossrate": "Highest loss rate",
  "Stichprobe": "Sample size",
  "Alle Gegner": "All opponents",
  "Mindestens 2 Matches": "At least 2 matches",
  "Mindestens 3 Matches": "At least 3 matches",
  "Gegner": "Opponent",
  "Siege": "Wins",
  "Niederlagen": "Losses",
  "Lossrate": "Loss rate",
  "← Zurück": "← Back",
  "Weiter →": "Next →",
  "Detailansicht schließen": "Close details",
  "Noch keine Live-Daten": "No live data yet",
  "Für die interaktive Auswertung muss JavaScript aktiviert sein.": "JavaScript must be enabled for the interactive analysis.",
  "unbekannt": "unknown",
  "Ohne Rangdaten": "No rank data",
  "Ohne aktuelle Rangdaten": "No current rank data",
  "Sieg": "Win",
  "Niederlage": "Loss",
  "Kein Match": "No match",
  "Zeitraum unbekannt": "Unknown period",
  "Aufwärtstrend": "Upward trend",
  "Rückgang": "Decline",
  "Ausgeglichen": "Balanced",
  "Gesamttrend": "Overall trend",
  "Aktueller Zeitraum": "Current period",
  "Vergleichszeitraum": "Comparison period",
  "Bilanz aktuell": "Current record",
  "Leistungsentwicklung": "Performance development",
  "Hero-Veränderung": "Hero changes",
  "Aktuell meistgespielt": "Currently most played",
  "Davor meistgespielt": "Previously most played",
  "Hero-Pool aktuell": "Current hero pool",
  "Hero-Pool davor": "Previous hero pool",
  "Fortschrittsvergleich": "Progress comparison",
  "Gleich große, direkt aufeinanderfolgende Match-Zeiträume – ohne globale Vergleichswerte.": "Equal, consecutive match periods without global reference values.",
  "Noch keine Daten": "No data yet",
  "Positives Signal": "Positive signal",
  "Häufigster Ability-Start": "Most common ability opener",
  "Mindestens drei Käufe nötig": "At least three purchases required",
  "Deine häufigsten Items": "Your most common items",
  "Kleine Stichprobe": "Small sample",
  "Deine häufigsten Ability-Startfolgen": "Your most common ability opening sequences",
  "Gegner-Analyse": "Opponent analysis",
  "Dein Hero": "Your hero",
  "Alle Heroes": "All heroes",
  "Schwierigste Gegner": "Toughest opponents",
  "Niedrigste persönliche Winrate · mindestens drei Begegnungen.": "Lowest personal win rate · at least three encounters.",
  "Beste Bilanz": "Best record",
  "Höchste persönliche Winrate · mindestens drei Begegnungen.": "Highest personal win rate · at least three encounters.",
  "Matchups aus deiner vollständigen persönlichen Historie": "Matchups from your complete personal history",
  "Aktueller Rang": "Current rank",
  "Globaler Kontext": "Global context",
  "Keine Verteilung verfügbar": "No distribution available",
  "Persönlicher Peak": "Personal peak",
  "Trend letzte 10": "Last 10 trend",
  "Rangverteilung der letzten 30 Tage": "Rank distribution over the last 30 days",
  "Die globale Rangverteilung ist momentan nicht verfügbar.": "The global rank distribution is currently unavailable.",
  "Dein Rang im Kontext": "Your rank in context",
  "Persönlicher Verlauf und Einordnung unter aktiven Ranked-Spielern": "Personal progression and position among active ranked players",
  "Suche": "Search",
  "Hero oder Match-ID": "Hero or match ID",
  "Keine Matches entsprechen diesen Filtern.": "No matches match these filters.",
  "Alle Ergebnisse": "All results",
  "Alle Modi": "All modes",
  "Neueste zuerst": "Newest first",
  "Älteste zuerst": "Oldest first",
  "Beste KDA": "Best KDA",
  "Höchste SPM": "Highest SPM",
  "Vollständiges Matcharchiv": "Complete match archive",
  "Datum unbekannt": "Date unknown",
  "Ungewertet": "Unrated",
  "Deine Werte im globalen Vergleich": "Your stats compared globally",
  "Globaler Durchschnitt": "Global average",
  "Persönliche Bestwerte": "Personal bests",
  "Meiste Kills": "Most kills",
  "Meiste Assists": "Most assists",
  "Bilanz": "Record",
  "Top Hero": "Top hero",
  "Keine Gegner entsprechen deiner Auswahl.": "No opponents match your selection.",
  "Noch keine Gegnerdaten verfügbar. Der nächste Datenlauf versucht es erneut.": "No opponent data is available yet. The next data run will try again.",
  "Details zu Hero öffnen": "Open hero details",
  "Build und Werte anzeigen": "Show build and stats",
  "DEINE PERFORMANCE": "YOUR PERFORMANCE",
  "DEIN TEAM": "YOUR TEAM",
  "GEGNERTEAM": "ENEMY TEAM",
  "Spieler wechseln: anderen Hero anklicken": "Switch player: select another hero",
  "Steam-Profil ↗": "Steam profile ↗",
  "Damage erhalten": "Damage taken",
  "Trefferquote": "Accuracy",
  "Keine Daten": "No data",
  "Item-Build": "Item build",
  "Kaufreihenfolge und Zeitpunkte dieses Spielers.": "This player's purchase order and timings.",
  "Ability-Reihenfolge": "Ability order",
  "Zeitliche Reihenfolge der Ability-Upgrades dieses Spielers.": "This player's ability upgrade order over time.",
  "Für diesen Spieler sind keine Build-Ereignisse verfügbar.": "No build events are available for this player.",
  "Dein Team": "Your team",
  "Gegnerteam": "Enemy team",
  "Dein Net Worth": "Your net worth",
  "Teamvergleich": "Team comparison",
  "Finale Teamwerte aus dem Match.": "Final team stats from the match.",
  "Economy-Verlauf": "Economy timeline",
  "Team-Net-Worth über den Matchverlauf.": "Team net worth across the match.",
  "Dein persönlicher Net-Worth-Verlauf.": "Your personal net worth timeline.",
  "Economy-Verlauf dieses Matches": "Economy timeline for this match",
  "Review-Hinweise": "Review insights",
  "Datenbasierte Auffälligkeiten – als Ausgangspunkt für deine eigene Bewertung.": "Data-driven observations as a starting point for your own review.",
  "Für dieses ältere Match liegen noch keine vollständigen Zeitreihen oder Teamdaten vor.": "Complete timeline or team data is not available for this older match.",
  "Killbeteiligung": "Kill participation",
  "Teamdaten fehlen": "Team data missing",
  "Economy-Rang": "Economy rank",
  "Nach finalem Net Worth": "By final net worth",
  "Damage-Rang": "Damage rank",
  "Im gesamten Match": "Across the full match",
  "Death-Ausfallzeit": "Time dead",
  "Performance-Profil": "Performance profile",
  "Detaillierte Werte aus den verarbeiteten Matchdaten.": "Detailed stats from the processed match data.",
  "Gegen deinen Durchschnitt": "Compared with your average",
  "Vergleich mit deiner vollständigen Matchhistorie.": "Comparison with your complete match history.",
  "Teamaufstellung": "Team roster",
  "Hero anklicken, um dessen vollständigen Build und Performance-Werte zu öffnen.": "Select a hero to open their complete build and performance stats.",
  "Wähle einen Hero aus der Teamaufstellung aus.": "Select a hero from the team roster.",
  "Kaufreihenfolge und Zeitpunkte innerhalb des Matches.": "Purchase order and timings during the match.",
  "Zeitliche Reihenfolge deiner Ability-Upgrades.": "Your ability upgrade order over time.",
  "Net Worth · 12 Min.": "Net worth · 12 min",
  "ungewertet": "unrated",
  "Für den Coach sind noch keine vollständigen Build-Daten verfügbar.": "Complete build data is not available for the coach yet.",
  "Muster aus deiner vollständigen Matchhistorie": "Patterns from your complete match history",
  "Ausgewertet wird, ob der Gegner-Hero im anderen Team stand – unabhängig von Lane oder Rolle.": "This evaluates whether the opposing hero was on the other team, regardless of lane or role.",
  "Für diese Auswahl gibt es noch keine belastbare Gegner-Stichprobe.": "There is not yet a reliable opponent sample for this selection.",
  "Höher eingestuft als": "Ranked higher than",
  "Für diesen Coach sind noch keine vollständigen Build-Daten verfügbar.": "Complete build data is not available for this coach yet.",
  "Aus deiner vollständigen Matchhistorie mit diesem Hero.": "From your complete match history with this hero.",
  "vs. Gesamt": "vs. overall",
  "Details": "Details",
  "verkauft": "sold",
  "Gegner · 12 Min.": "Opponent · 12 min",
  "Lane-Gruppe · Ende": "Lane group · final",
  "Patron zerstört": "Patron destroyed",
  "Patron-Phase erreicht": "Patron phase reached",
  "Schildgenerator zerstört": "Shield generator destroyed",
  "Objective zerstört": "Objective destroyed",
  "von deinem Team besiegt": "defeated by your team",
  "vom Gegner besiegt": "defeated by the enemy",
  "Claim gesichert": "Claim secured",
  "Claim beim Gegner": "Claim taken by enemy",
  "Kill erzielt": "Kill secured",
  "Größter Economy-Gewinn": "Largest economy gain",
  "Größter Economy-Verlust": "Largest economy loss",
  "Führung nicht geschlossen": "Lead not converted",
  "Comeback-Sieg": "Comeback win",
  "Burst-Deaths prüfen": "Review burst deaths",
  "Späte Ausfallzeiten": "Late downtime",
  "Niedrige Killbeteiligung": "Low kill participation",
  "Economy nicht vollständig umgesetzt": "Economy not fully converted",
  "Starke Lane-Economy": "Strong lane economy",
  "Lane-Economy im Rückstand": "Lane economy deficit",
  "Stabiles Matchprofil": "Stable match profile",
  "Kein einzelnes Warnsignal dominiert. Nutze Economy-Kurve und Schlüsselereignisse für die manuelle Detailprüfung.": "No single warning signal dominates. Use the economy curve and key events for your manual review.",
  "Zeitverlauf, Teamkontext und konkrete Review-Punkte aus den verfügbaren Matchdaten.": "Timeline, team context, and concrete review points from the available match data.",
  "Schlüsselereignisse": "Key events",
  "Priorisierte Objectives, Deaths, Power-Spikes und Economy-Swings.": "Prioritized objectives, deaths, power spikes, and economy swings.",
  "Daten momentan nicht erreichbar": "Data is currently unavailable",
}));

const ENGLISH_PATTERNS = [
  [/^vor weniger als 1 Stunde$/, "less than 1 hour ago"],
  [/^vor (\d+) Std\.$/, "$1h ago"],
  [/^vor (\d+) Tag$/, "$1 day ago"],
  [/^vor (\d+) Tagen$/, "$1 days ago"],
  [/^Letztes Match (.+)$/, "Last match $1"],
  [/^(\d+) Spielstunden$/, "$1 hours played"],
  [/^(\d+) Siege · (\d+) Niederlagen$/, "$1 wins · $2 losses"],
  [/^(\d+) Matches analysiert$/, "$1 matches analyzed"],
  [/^(\d+) von (\d+) verfügbaren Matches geladen$/, "$1 of $2 available matches loaded"],
  [/^(\d+) unterschiedliche Gegner · vollständige Historie$/, "$1 unique opponents · complete history"],
  [/^Seite (\d+) von (\d+) · (\d+) Gegner$/, "Page $1 of $2 · $3 opponents"],
  [/^(\d+) Gegner$/, "$1 opponents"],
  [/^(\d+) Begegnungen$/, "$1 encounters"],
  [/^(\d+) Siege$/, "$1 wins"],
  [/^(\d+) erfasste Matches$/, "$1 recorded matches"],
  [/^(\d+) Treffer$/, "$1 hits"],
  [/^(\d+) erfasste Deaths$/, "$1 recorded deaths"],
  [/^(\d+) Beteiligungen$/, "$1 participations"],
  [/^(\d+) Matches · Seite (\d+) von (\d+)$/, "$1 matches · page $2 of $3"],
  [/^(\d+) Matches · filterbar und chronologisch durchsuchbar$/, "$1 matches · filterable and chronologically searchable"],
  [/^(\d+) Matches in deiner vollständigen Historie$/, "$1 matches in your complete history"],
  [/^(\d+) Match in deiner vollständigen Historie$/, "$1 match in your complete history"],
  [/^Nach den meisten Matches in der vollständigen Historie\.$/, "By most matches in the complete history."],
  [/^Nach höchster Winrate · mindestens (\d+) Matches für das Ranking\.$/, "By highest win rate · at least $1 matches to qualify."],
  [/^Nach höchstem KDA · mindestens (\d+) Matches für das Ranking\.$/, "By highest KDA · at least $1 matches to qualify."],
  [/^Details zu (.+) öffnen$/, "Open details for $1"],
  [/^Matchdetails zu (.+) öffnen$/, "Open match details for $1"],
  [/^Build und Werte von (.+) anzeigen$/, "Show build and stats for $1"],
  [/^Steam-Profil des (.+)-Spielers öffnen$/, "Open the $1 player's Steam profile"],
  [/^(.+) · Du$/, "$1 · You"],
  [/^(\d+) Fortschritt$/, "$1 progress"],
  [/^Letztes Update (.+)$/, "Last update $1"],
  [/^(.+) auf Steam$/, "$1 on Steam"],
  [/^Höher eingestuft als (.+)%$/, "Ranked higher than $1%"],
  [/^([+−].+) Pkt\.$/, "$1 pts."],
  [/^Sieg · ungewertet$/, "Win · unrated"],
  [/^Niederlage · ungewertet$/, "Loss · unrated"],
  [/^Für diesen Vergleich werden (\d+) Matches benötigt\. Aktuell sind (\d+) Matches verfügbar\.$/, "This comparison requires $1 matches. $2 matches are currently available."],
  [/^(\d+) von 6 Kernwerten verbessert$/, "$1 of 6 core metrics improved"],
  [/^Die letzten (\d+) Matches im direkten Vergleich mit den (\d+) Matches davor\.$/, "The latest $1 matches compared directly with the previous $2 matches."],
  [/^(.+) · aktuell$/, "$1 · current"],
  [/^Davor (.+)$/, "Previous $1"],
  [/^Dein Schwerpunkt bleibt bei (.+)\.$/, "Your focus remains on $1."],
  [/^Dein Schwerpunkt hat sich von (.+) zu (.+) verschoben\.$/, "Your focus shifted from $1 to $2."],
  [/^In den letzten (\d+) Matches$/, "In the last $1 matches"],
  [/^In den (\d+) Matches davor$/, "In the previous $1 matches"],
  [/^Aus deinen (\d+) erfassten (.+)-Matches\. Zusammenhänge sind Hinweise, keine garantierte Ursache\.$/, "Based on your $1 recorded matches with $2. Correlations are signals, not guaranteed causes."],
  [/^(\d+)% deiner Matches$/, "$1% of your matches"],
  [/^(.+) vs\. Hero-Bilanz$/, "$1 vs. hero record"],
  [/^(\d+) Matches · (\d+)% Pickrate$/, "$1 matches · $2% pick rate"],
  [/^Deine Bilanz mit (.+), wenn der jeweilige Gegner-Hero im anderen Team stand\.$/, "Your record with $1 when the opposing hero was on the other team."],
  [/^(\d+) Ranked Matches erfasst$/, "$1 ranked matches recorded"],
  [/^(\d+) aktive Spieler im verfügbaren API-Zeitraum\.$/, "$1 active players in the available API period."],
  [/^Kleine Stichprobe: Erst ab (\d+) Matches fließt ein Hero in die Winrate- und KDA-Rangliste ein\.$/, "Small sample: a hero qualifies for the win rate and KDA ranking from $1 matches onward."],
  [/^Verglichen mit dem Durchschnitt aus (.+) weltweit erfassten (.+)-Matches\.$/, "Compared with the average from $1 globally recorded matches with $2."],
  [/^Globaler Durchschnitt (.+)$/, "Global average $1"],
  [/^Die letzten (\d+) Auftritte mit (.+)\.$/, "The last $1 appearances with $2."],
  [/^(.+) vs\. Gesamt$/, "$1 vs. overall"],
  [/^Top Hero: (.+)$/, "Top hero: $1"],
  [/^(.+) · verkauft (.+)$/, "$1 · sold $2"],
  [/^(.+) gegen (.+)$/, "$1 vs. $2"],
  [/^von deinem Team besiegt · Claim gesichert$/, "Defeated by your team · claim secured"],
  [/^von deinem Team besiegt · Claim beim Gegner$/, "Defeated by your team · claim taken by enemy"],
  [/^vom Gegner besiegt · Claim gesichert$/, "Defeated by the enemy · claim secured"],
  [/^vom Gegner besiegt · Claim beim Gegner$/, "Defeated by the enemy · claim taken by enemy"],
  [/^(.+) zur Gegner-Lane$/, "$1 vs. the opposing lane"],
  [/^(\d+) Kills im Zeitfenster$/, "$1 kills in the time window"],
  [/^(\d+) Kills bis Minute (\d+)$/, "$1 kills by minute $2"],
  [/^(.+) Net Worth im Messintervall$/, "$1 net worth in the measurement interval"],
  [/^(\d+) Sek\. Ausfall$/, "$1 sec. downtime"],
  [/^(\d+) Sek\. Ausfall · (.+) Sek\. TTK$/, "$1 sec. downtime · $2 sec. TTK"],
  [/^Dein Team lag zwischenzeitlich (.+) Net Worth vorn\. Prüfe im Verlauf den Umschwung nach diesem Peak\.$/, "Your team held a temporary $1 net worth lead. Review the reversal after this peak."],
  [/^Das Team drehte einen Rückstand von (.+) Net Worth\. Die Phase vor dem größten Swing ist besonders review-würdig\.$/, "The team overcame a $1 net worth deficit. The phase before the largest swing is especially worth reviewing."],
  [/^(\d+) Deaths passierten in höchstens vier Sekunden\. Positionierung, Defensive-Aktivierung und Gegner-Cooldowns sind hier die ersten Review-Punkte\.$/, "$1 deaths happened within four seconds. Positioning, defensive activation, and enemy cooldowns are the first review points."],
  [/^(\d+) Deaths lagen nach Minute 25\. In dieser Phase sind lange Respawn-Zeiten besonders teuer\.$/, "$1 deaths occurred after minute 25. Long respawn times are especially costly at this stage."],
  [/^(.+)% Beteiligung an den Team-Kills\. Prüfe Rotationen und ob Fights zu spät erreicht wurden\.$/, "$1% participation in team kills. Review rotations and whether fights were reached too late."],
  [/^Economy-Rang (\d+), aber Damage-Rang (\d+)\. Prüfe die Fights nach deinen großen Item-Timings\.$/, "Economy rank $1, but damage rank $2. Review the fights after your major item timings."],
  [/^Nach zwölf Minuten lag deine Lane-Gruppe (.+) Net Worth vorn\.$/, "After twelve minutes, your lane group held a $1 net worth lead."],
  [/^Nach zwölf Minuten lag deine Lane-Gruppe (.+) Net Worth hinten\.$/, "After twelve minutes, your lane group was $1 net worth behind."],
];

const textSources = new WeakMap();
const attributeSources = new WeakMap();

function localeCode() {
  return state.locale === "de" ? "de-DE" : "en-US";
}

function translateText(source) {
  const value = String(source ?? "");
  if (state.locale === "de" || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  const exact = ENGLISH_TEXT.get(core);
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, replacement] of ENGLISH_PATTERNS) {
    if (pattern.test(core)) return `${leading}${core.replace(pattern, replacement)}${trailing}`;
  }
  return value;
}

function setLocalizedText(element, source) {
  const original = String(source ?? "");
  element.textContent = translateText(original);
  if (element.firstChild) textSources.set(element.firstChild, original);
}

function localizeTextNode(node) {
  const source = textSources.get(node) ?? node.nodeValue;
  textSources.set(node, source);
  const translated = translateText(source);
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function localizeAttributes(element) {
  for (const name of ["aria-label", "title", "placeholder"]) {
    if (!element.hasAttribute(name)) continue;
    let sources = attributeSources.get(element);
    if (!sources) {
      sources = new Map();
      attributeSources.set(element, sources);
    }
    const source = sources.get(name) ?? element.getAttribute(name);
    sources.set(name, source);
    const translated = translateText(source);
    if (element.getAttribute(name) !== translated) element.setAttribute(name, translated);
  }
}

function localizeTree(root = document.documentElement) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root);
    return;
  }
  if (!(root instanceof Element)) return;
  localizeAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node);
    else localizeAttributes(node);
    node = walker.nextNode();
  }
}

function updateLanguageSwitch() {
  document.documentElement.lang = state.locale;
  for (const button of document.querySelectorAll("[data-language]")) {
    button.setAttribute("aria-pressed", String(button.dataset.language === state.locale));
  }
}

function setLanguage(locale, { persist = true } = {}) {
  state.locale = locale === "de" ? "de" : "en";
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, state.locale);
    } catch {
      // The language switch still works when browser storage is unavailable.
    }
  }
  updateLanguageSwitch();
  if (state.data) {
    renderProfileSummary(state.data);
    renderDashboard();
  }
  localizeTree();
}

function initLanguage() {
  updateLanguageSwitch();
  for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  }
  localizeTree();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) localizeTree(node);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

const numberFormatters = Object.fromEntries(["en", "de"].map((locale) => {
  const code = locale === "de" ? "de-DE" : "en-US";
  return [locale, {
    number: new Intl.NumberFormat(code),
    decimal: new Intl.NumberFormat(code, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    percent: new Intl.NumberFormat(code, { maximumFractionDigits: 0 }),
  }];
}));
const numberFormat = { format: (value) => numberFormatters[state.locale].number.format(value) };
const decimalFormat = {
  format: (value) => numberFormatters[state.locale].decimal.format(value),
};
const percentFormat = {
  format: (value) => numberFormatters[state.locale].percent.format(value),
};

const byId = (id) => document.getElementById(id);

function steamProfileUrl(accountId) {
  const normalized = Number(accountId);
  if (!Number.isInteger(normalized) || normalized <= 0 || normalized > 4_294_967_295) return null;
  return `https://steamcommunity.com/profiles/${STEAM_ID64_BASE + BigInt(normalized)}/`;
}

function create(tagName, className, content) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (content != null) setLocalizedText(element, content);
  return element;
}

function text(id, value) {
  const element = byId(id);
  if (element) setLocalizedText(element, value);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatRelativeDate(iso) {
  if (!iso) return "unbekannt";
  const date = new Date(iso);
  const deltaHours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
  if (deltaHours < 1) return "vor weniger als 1 Stunde";
  if (deltaHours < 24) return `vor ${Math.floor(deltaHours)} Std.`;
  const days = Math.floor(deltaHours / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return new Intl.DateTimeFormat(localeCode(), { dateStyle: "medium" }).format(date);
}

function countryFlag(code) {
  const normalized = String(code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "";
  return [...normalized]
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt()))
    .join("");
}

function heroFor(id) {
  return state.data.heroes?.[String(id)] ?? { name: `Hero ${id}`, image: null, color: null };
}

function buildAssetFor(id) {
  return state.data.buildAssets?.[String(id)] ?? null;
}

function rankDetails(badge) {
  if (badge == null) return { label: "Ohne Rangdaten", score: null, color: null };
  const tier = Math.floor(badge / 10);
  const subrank = badge % 10;
  const rank = state.data.ranks?.[String(tier)];
  return {
    label: `${rank?.name || `Tier ${tier}`}${subrank ? ` ${subrank}` : ""}`,
    score: tier * 6 + Math.max(0, subrank - 1),
    color: rank?.color ?? null,
  };
}

function selectedMatches() {
  return state.data.matches;
}

function versionedDataUrl(path) {
  const url = new URL(path, document.baseURI);
  url.searchParams.set("v", state.data?.generatedAt || Date.now());
  return url;
}

async function loadHistoryPage(page) {
  if (!Number.isInteger(page) || page < 1) return [];
  if (state.historyPages.has(page)) return state.historyPages.get(page);

  const pattern = state.data.dataFiles?.historyPagePattern;
  if (!pattern) return [];
  const path = pattern.replace("{page}", String(page).padStart(4, "0"));
  const request = fetch(versionedDataUrl(path), { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => (Array.isArray(payload.matches) ? payload.matches : []))
    .catch((error) => {
      state.historyPages.delete(page);
      throw error;
    });
  state.historyPages.set(page, request);
  return request;
}

async function resolveMatchDetail(match) {
  if (Array.isArray(match.build) || Array.isArray(match.players)) return match;
  const recent = state.recentMatches.find((candidate) => candidate.id === match.id);
  if (recent && (Array.isArray(recent.build) || Array.isArray(recent.players))) return recent;
  try {
    const pageMatches = await loadHistoryPage(match.historyPage);
    return pageMatches.find((candidate) => candidate.id === match.id) ?? { ...match, build: [], players: [] };
  } catch {
    return { ...match, build: [], players: [] };
  }
}

async function openResolvedMatchDetail(match, trigger) {
  if (trigger?.getAttribute("aria-busy") === "true") return;
  trigger?.setAttribute("aria-busy", "true");
  const detail = await resolveMatchDetail(match);
  trigger?.removeAttribute("aria-busy");
  openMatchDetail(detail);
}

function summarize(matches) {
  const decided = matches.filter((match) => match.result === "win" || match.result === "loss");
  const wins = decided.filter((match) => match.result === "win").length;
  const losses = decided.filter((match) => match.result === "loss").length;
  const kills = matches.reduce((sum, match) => sum + match.kills, 0);
  const deaths = matches.reduce((sum, match) => sum + match.deaths, 0);
  const assists = matches.reduce((sum, match) => sum + match.assists, 0);
  return {
    wins,
    losses,
    winrate: decided.length ? (wins / decided.length) * 100 : 0,
    kda: (kills + assists) / Math.max(1, deaths),
    spm: average(matches.map((match) => match.soulsPerMinute)),
    netWorth: average(matches.map((match) => match.netWorth)),
    duration: average(matches.map((match) => match.durationSeconds)),
  };
}

function matchKda(match) {
  return (match.kills + match.assists) / Math.max(1, match.deaths);
}

function signedDifference(value, reference, suffix = "") {
  const difference = value - reference;
  const formatted = Math.abs(difference) >= 100
    ? numberFormat.format(Math.round(Math.abs(difference)))
    : decimalFormat.format(Math.abs(difference));
  return `${difference >= 0 ? "+" : "−"}${formatted}${suffix}`;
}

function metricGrid(metrics, className = "detail-metric-grid") {
  const grid = create("div", className);
  for (const metric of metrics) {
    const card = create("div", "detail-metric");
    const label = create("span", "", metric.label);
    const value = create("strong", metric.tone || "", metric.value);
    card.append(label, value);
    if (metric.note) card.append(create("small", "", metric.note));
    grid.append(card);
  }
  return grid;
}

function groupHeroes(matches) {
  const groups = new Map();
  for (const match of matches) {
    const group = groups.get(match.heroId) ?? {
      heroId: match.heroId,
      matches: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      spm: 0,
    };
    group.matches += 1;
    group.wins += match.result === "win" ? 1 : 0;
    group.kills += match.kills;
    group.deaths += match.deaths;
    group.assists += match.assists;
    group.spm += match.soulsPerMinute;
    groups.set(match.heroId, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      winrate: (group.wins / group.matches) * 100,
      kda: (group.kills + group.assists) / Math.max(1, group.deaths),
      avgSpm: group.spm / group.matches,
    }))
    .sort((a, b) => b.matches - a.matches || b.winrate - a.winrate);
}

function sortHeroGroups(groups, criterion) {
  return [...groups].sort((a, b) => {
    if (criterion !== "matches") {
      const sampleDifference = Number(b.matches >= HERO_SAMPLE_MIN) - Number(a.matches >= HERO_SAMPLE_MIN);
      if (sampleDifference) return sampleDifference;
    }
    if (criterion === "winrate") {
      return b.winrate - a.winrate || b.matches - a.matches || b.kda - a.kda;
    }
    if (criterion === "kda") {
      return b.kda - a.kda || b.matches - a.matches || b.winrate - a.winrate;
    }
    return b.matches - a.matches || b.winrate - a.winrate || b.kda - a.kda;
  });
}

function currentStreak(matches) {
  const decided = matches.filter((match) => match.result === "win" || match.result === "loss");
  const first = decided[0];
  if (!first) return "—";
  let count = 0;
  for (const match of decided) {
    if (match.result !== first.result) break;
    count += 1;
  }
  return `${count}${first.result === "win" ? "W" : "L"}`;
}

function renderMetrics(matches) {
  const summary = summarize(matches);
  text("metric-winrate", `${percentFormat.format(summary.winrate)}%`);
  text("metric-record", `${summary.wins} Siege · ${summary.losses} Niederlagen`);
  text("metric-kda", decimalFormat.format(summary.kda));
  text("metric-spm", numberFormat.format(Math.round(summary.spm)));
  text("metric-networth", `${numberFormat.format(Math.round(summary.netWorth))} Ø Net Worth`);
  text("metric-duration", formatDuration(summary.duration));
  text("metric-sample", `${matches.length} Matches analysiert`);
  byId("winrate-bar").style.width = `${Math.max(0, Math.min(100, summary.winrate))}%`;
}

function renderForm(matches, heroGroups) {
  const lastFive = matches.slice(0, 5);
  const wins = lastFive.filter((match) => match.result === "win").length;
  text("form-score", `${wins}/${lastFive.length || 5}`);
  text("current-streak", currentStreak(matches));

  const qualified = heroGroups.filter((hero) => hero.matches >= Math.min(3, matches.length));
  const best = [...qualified].sort((a, b) => b.winrate - a.winrate || b.kda - a.kda)[0] ?? heroGroups[0];
  text("best-hero", best ? heroFor(best.heroId).name : "—");

  const peak = [...matches].sort(
    (a, b) => b.kills + b.assists - b.deaths - (a.kills + a.assists - a.deaths),
  )[0];
  text("peak-match", peak ? `${peak.kills}/${peak.deaths}/${peak.assists}` : "—");

  const dots = byId("form-dots");
  dots.replaceChildren();
  for (let index = 0; index < 5; index += 1) {
    const dot = document.createElement("span");
    const match = lastFive[index];
    if (match) dot.className = match.result === "win" ? "is-win" : "is-loss";
    dot.title = match ? (match.result === "win" ? "Sieg" : "Niederlage") : "Kein Match";
    dots.append(dot);
  }
}

function openDetail({ eyebrow, title, subtitle, body }) {
  state.reviewObserver?.disconnect();
  state.reviewObserver = null;
  text("detail-eyebrow", eyebrow);
  text("detail-title", title);
  text("detail-subtitle", subtitle);
  byId("detail-body").replaceChildren(body);
  const dialog = byId("detail-dialog");
  if (!dialog.open) dialog.showModal();
  document.documentElement.classList.add("detail-open");
}

function closeDetail() {
  state.reviewObserver?.disconnect();
  state.reviewObserver = null;
  const dialog = byId("detail-dialog");
  if (dialog.open) dialog.close();
  document.documentElement.classList.remove("detail-open");
}

function detailSection(title, description) {
  const section = create("section", "detail-section");
  const heading = create("div", "detail-section-heading");
  heading.append(create("h3", "", title));
  if (description) heading.append(create("p", "", description));
  section.append(heading);
  return section;
}

function progressPeriod(matches) {
  const dates = matches
    .map((match) => match.startedAt && new Date(match.startedAt))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);
  if (!dates.length) return "Zeitraum unbekannt";
  const format = new Intl.DateTimeFormat(localeCode(), { day: "2-digit", month: "short", year: "2-digit" });
  return dates.length === 1
    ? format.format(dates[0])
    : `${format.format(dates[0])} – ${format.format(dates.at(-1))}`;
}

function progressSummary(matches) {
  const summary = summarize(matches);
  const heroGroups = groupHeroes(matches);
  return {
    ...summary,
    damage: average(matches.map((match) => match.playerDamage)),
    deaths: average(matches.map((match) => match.deaths)),
    heroCount: heroGroups.length,
    favoriteHero: heroGroups[0] ?? null,
  };
}

function progressWindowBar(selected, onSelect) {
  const bar = create("div", "hero-choice-bar progress-window-bar");
  for (const size of [10, 20, 30]) {
    const button = create("button", "hero-choice", `${size} Matches`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(size === selected));
    button.addEventListener("click", () => onSelect(size));
    bar.append(button);
  }
  return bar;
}

function openProgressComparison() {
  const matches = selectedMatches();
  const body = create("div", "detail-stack");
  const controls = create("div");
  const content = create("div", "detail-stack");
  let sampleSize = 10;

  const render = () => {
    controls.replaceChildren(progressWindowBar(sampleSize, (size) => {
      sampleSize = size;
      render();
    }));
    content.replaceChildren();

    const recentMatches = matches.slice(0, sampleSize);
    const previousMatches = matches.slice(sampleSize, sampleSize * 2);
    if (recentMatches.length < sampleSize || previousMatches.length < sampleSize) {
      content.append(create(
        "p",
        "sample-notice",
        `Für diesen Vergleich werden ${sampleSize * 2} Matches benötigt. Aktuell sind ${matches.length} Matches verfügbar.`,
      ));
      return;
    }

    const recent = progressSummary(recentMatches);
    const previous = progressSummary(previousMatches);
    const metrics = [
      { label: "Winrate", current: recent.winrate, before: previous.winrate, format: (value) => `${percentFormat.format(value)}%`, suffix: " Pkt." },
      { label: "KDA", current: recent.kda, before: previous.kda, format: (value) => decimalFormat.format(value) },
      { label: "Souls / Min.", current: recent.spm, before: previous.spm, format: (value) => numberFormat.format(Math.round(value)) },
      { label: "Player Damage", current: recent.damage, before: previous.damage, format: (value) => numberFormat.format(Math.round(value)) },
      { label: "Net Worth", current: recent.netWorth, before: previous.netWorth, format: (value) => numberFormat.format(Math.round(value)) },
      { label: "Deaths / Match", current: recent.deaths, before: previous.deaths, format: (value) => decimalFormat.format(value), lowerIsBetter: true },
    ];
    const improved = metrics.filter((metric) => (
      metric.lowerIsBetter ? metric.current < metric.before : metric.current > metric.before
    )).length;
    const regressed = metrics.filter((metric) => (
      metric.lowerIsBetter ? metric.current > metric.before : metric.current < metric.before
    )).length;
    const trend = improved > regressed ? "Aufwärtstrend" : improved < regressed ? "Rückgang" : "Ausgeglichen";
    const trendTone = improved > regressed ? "positive" : improved < regressed ? "negative" : "";

    content.append(metricGrid([
      { label: "Gesamttrend", value: trend, tone: trendTone, note: `${improved} von 6 Kernwerten verbessert` },
      { label: "Aktueller Zeitraum", value: `${sampleSize} Matches`, note: progressPeriod(recentMatches) },
      { label: "Vergleichszeitraum", value: `${sampleSize} Matches`, note: progressPeriod(previousMatches) },
      { label: "Bilanz aktuell", value: `${recent.wins}W · ${recent.losses}L`, tone: recent.winrate >= previous.winrate ? "positive" : "negative", note: `${percentFormat.format(recent.winrate)}% Winrate` },
    ]));

    const comparison = detailSection(
      "Leistungsentwicklung",
      `Die letzten ${sampleSize} Matches im direkten Vergleich mit den ${sampleSize} Matches davor.`,
    );
    const rows = create("div", "comparison-list");
    for (const metric of metrics) {
      const item = create("div", "comparison-row");
      const current = create("span");
      current.append(
        create("small", "", `${metric.label} · aktuell`),
        create("strong", "", metric.format(metric.current)),
      );
      const delta = metric.current - metric.before;
      const isBetter = metric.lowerIsBetter ? delta < 0 : delta > 0;
      const isWorse = metric.lowerIsBetter ? delta > 0 : delta < 0;
      const reference = create("span", "comparison-reference");
      reference.append(
        create("small", "", `Davor ${metric.format(metric.before)}`),
        create("strong", isBetter ? "positive" : isWorse ? "negative" : "", signedDifference(metric.current, metric.before, metric.suffix || "")),
      );
      item.append(current, reference);
      rows.append(item);
    }
    comparison.append(rows);
    content.append(comparison);

    const recentHero = recent.favoriteHero;
    const previousHero = previous.favoriteHero;
    const recentHeroName = recentHero ? heroFor(recentHero.heroId).name : "—";
    const previousHeroName = previousHero ? heroFor(previousHero.heroId).name : "—";
    const heroSection = detailSection(
      "Hero-Veränderung",
      recentHeroName === previousHeroName
        ? `Dein Schwerpunkt bleibt bei ${recentHeroName}.`
        : `Dein Schwerpunkt hat sich von ${previousHeroName} zu ${recentHeroName} verschoben.`,
    );
    heroSection.append(metricGrid([
      { label: "Aktuell meistgespielt", value: recentHeroName, note: recentHero ? `${recentHero.matches} Matches · ${percentFormat.format(recentHero.winrate)}% WR` : "Keine Daten" },
      { label: "Davor meistgespielt", value: previousHeroName, note: previousHero ? `${previousHero.matches} Matches · ${percentFormat.format(previousHero.winrate)}% WR` : "Keine Daten" },
      { label: "Hero-Pool aktuell", value: `${recent.heroCount} Heroes`, note: `In den letzten ${sampleSize} Matches` },
      { label: "Hero-Pool davor", value: `${previous.heroCount} Heroes`, note: `In den ${sampleSize} Matches davor` },
    ]));
    content.append(heroSection);
  };

  render();
  body.append(controls, content);
  openDetail({
    eyebrow: "PERFORMANCE TREND",
    title: "Fortschrittsvergleich",
    subtitle: "Gleich große, direkt aufeinanderfolgende Match-Zeiträume – ohne globale Vergleichswerte.",
    body,
  });
}

function coachFor(heroId) {
  return state.data.heroCoach?.[String(heroId)] ?? null;
}

function buildItemIdentity(itemId) {
  const asset = buildAssetFor(itemId) ?? { name: `Asset ${itemId}`, image: null };
  const identity = create("span", "coach-identity");
  if (asset.image) {
    const image = create("img");
    image.src = asset.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    identity.append(image);
  }
  identity.append(create("strong", "", asset.name));
  return identity;
}

function buildHeroCoachSection(heroId) {
  const coach = coachFor(heroId);
  const hero = heroFor(heroId);
  if (!coach || (!coach.items?.length && !coach.abilityOrders?.length)) return null;
  const section = detailSection(
    "Build- & Ability-Coach",
    `Aus deinen ${coach.matches} erfassten ${hero.name}-Matches. Zusammenhänge sind Hinweise, keine garantierte Ursache.`,
  );
  const coreItem = coach.items?.[0] ?? null;
  const positiveItem = [...(coach.items ?? [])]
    .filter((item) => item.matches >= 3 && item.winrate > coach.baselineWinrate)
    .sort((a, b) => (b.winrate - coach.baselineWinrate) - (a.winrate - coach.baselineWinrate))[0] ?? null;
  const commonOrder = coach.abilityOrders?.[0] ?? null;
  section.append(metricGrid([
    {
      label: "Core Item",
      value: coreItem ? buildAssetFor(coreItem.itemId)?.name ?? `Asset ${coreItem.itemId}` : "—",
      note: coreItem ? `${percentFormat.format(coreItem.usageRate)}% deiner Matches` : "Noch keine Daten",
    },
    {
      label: "Positives Signal",
      value: positiveItem ? buildAssetFor(positiveItem.itemId)?.name ?? `Asset ${positiveItem.itemId}` : "—",
      note: positiveItem ? `${signedDifference(positiveItem.winrate, coach.baselineWinrate, " Pkt.")} vs. Hero-Bilanz` : "Mindestens drei Käufe nötig",
    },
    {
      label: "Häufigster Ability-Start",
      value: commonOrder ? commonOrder.abilityIds.map((id) => buildAssetFor(id)?.name ?? id).join(" → ") : "—",
      note: commonOrder ? `${commonOrder.matches} erfasste Matches` : "Noch keine Daten",
    },
  ], "coach-summary"));

  if (coach.items?.length) {
    const block = create("div", "coach-block");
    block.append(create("h4", "", "Deine häufigsten Items"));
    const rows = create("div", "coach-list");
    for (const item of coach.items.slice(0, 8)) {
      const row = create("div", "coach-row");
      const delta = item.winrate - coach.baselineWinrate;
      const sampleIsUseful = item.matches >= 3;
      const stats = create("span", "coach-row-stats");
      stats.append(
        create("strong", sampleIsUseful ? (delta >= 0 ? "positive" : "negative") : "", `${percentFormat.format(item.winrate)}% WR`),
        create("small", "", `${item.matches} Matches · ${percentFormat.format(item.usageRate)}% Pickrate`),
      );
      const timing = create("span", "coach-timing");
      timing.append(
        create("strong", "", `Ø ${formatDuration(item.avgBuySeconds)}`),
        create("small", "", sampleIsUseful ? `${signedDifference(item.winrate, coach.baselineWinrate, " Pkt.")} vs. Hero-Bilanz` : "Kleine Stichprobe"),
      );
      row.append(buildItemIdentity(item.itemId), stats, timing);
      rows.append(row);
    }
    block.append(rows);
    section.append(block);
  }

  if (coach.abilityOrders?.length) {
    const block = create("div", "coach-block");
    block.append(create("h4", "", "Deine häufigsten Ability-Startfolgen"));
    const orders = create("div", "ability-order-list");
    for (const [orderIndex, order] of coach.abilityOrders.slice(0, 3).entries()) {
      const card = create("div", "ability-order");
      const sequence = create("div", "ability-sequence");
      for (const [index, abilityId] of order.abilityIds.entries()) {
        const step = create("span", "ability-step");
        step.append(create("small", "", String(index + 1)), buildItemIdentity(abilityId));
        sequence.append(step);
      }
      const meta = create("span", "ability-order-meta");
      meta.append(
        create("strong", order.matches >= 2 && order.winrate >= coach.baselineWinrate ? "positive" : "", `${percentFormat.format(order.winrate)}% WR`),
        create("small", "", `${order.matches} ${order.matches === 1 ? "Match" : "Matches"}`),
      );
      card.append(create("span", "ability-order-rank", `0${orderIndex + 1}`), sequence, meta);
      orders.append(card);
    }
    block.append(orders);
    section.append(block);
  }
  return section;
}

function matchupCard(matchup) {
  const hero = heroFor(matchup.enemyHeroId);
  const card = create("article", "matchup-card");
  const identity = create("div", "matchup-identity");
  if (hero.image) {
    const image = create("img");
    image.src = hero.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    identity.append(image);
  }
  const copy = create("span");
  copy.append(create("strong", "", hero.name), create("small", "", `${matchup.matches} Begegnungen`));
  identity.append(copy);
  const result = create("span", "matchup-result");
  result.append(
    create("strong", matchup.winrate >= 50 ? "positive" : "negative", `${percentFormat.format(matchup.winrate)}%`),
    create("small", "", `${matchup.wins} Siege`),
  );
  card.append(identity, result);
  return card;
}

function aggregateMatchups(heroId = null) {
  const totals = new Map();
  for (const row of state.data.matchups ?? []) {
    if (heroId != null && row.heroId !== heroId) continue;
    const current = totals.get(row.enemyHeroId) ?? {
      enemyHeroId: row.enemyHeroId,
      matches: 0,
      wins: 0,
    };
    current.matches += row.matches;
    current.wins += row.wins;
    totals.set(row.enemyHeroId, current);
  }
  return [...totals.values()].map((row) => ({
    ...row,
    winrate: row.matches ? (row.wins / row.matches) * 100 : 0,
  }));
}

function buildHeroMatchupSection(heroId) {
  const matchups = aggregateMatchups(heroId).filter((row) => row.matches >= 2);
  if (!matchups.length) return null;
  const hero = heroFor(heroId);
  const section = detailSection(
    "Gegner-Analyse",
    `Deine Bilanz mit ${hero.name}, wenn der jeweilige Gegner-Hero im anderen Team stand.`,
  );
  const difficult = [...matchups].sort((a, b) => a.winrate - b.winrate || b.matches - a.matches).slice(0, 4);
  const grid = create("div", "matchup-grid");
  difficult.forEach((row) => grid.append(matchupCard(row)));
  section.append(grid);
  return section;
}

function heroChoiceBar(heroIds, selectedHeroId, onSelect) {
  const bar = create("div", "hero-choice-bar");
  for (const heroId of heroIds) {
    const hero = heroFor(heroId);
    const button = create("button", "hero-choice", hero.name);
    button.type = "button";
    button.setAttribute("aria-pressed", String(heroId === selectedHeroId));
    button.addEventListener("click", () => onSelect(heroId));
    bar.append(button);
  }
  return bar;
}

function openCoach() {
  const heroIds = groupHeroes(selectedMatches())
    .map((group) => group.heroId)
    .filter((heroId) => {
      const coach = coachFor(heroId);
      return coach && (coach.items?.length || coach.abilityOrders?.length);
    });
  const body = create("div", "detail-stack");
  if (!heroIds.length) {
    body.append(create("p", "sample-notice", "Für den Coach sind noch keine vollständigen Build-Daten verfügbar."));
  } else {
    let selectedHeroId = heroIds[0];
    const choiceHost = create("div");
    const content = create("div");
    const render = () => {
      choiceHost.replaceChildren(heroChoiceBar(heroIds, selectedHeroId, (heroId) => {
        selectedHeroId = heroId;
        render();
      }));
      const section = buildHeroCoachSection(selectedHeroId);
      content.replaceChildren();
      if (section) content.append(section);
    };
    render();
    body.append(choiceHost, content);
  }
  openDetail({
    eyebrow: "PERSONAL COACH",
    title: "Build & Ability Intelligence",
    subtitle: "Muster aus deiner vollständigen Matchhistorie",
    body,
  });
}

function openEnemyAnalysis() {
  const heroGroups = groupHeroes(selectedMatches());
  const body = create("div", "detail-stack");
  const controls = create("div", "analysis-controls");
  const label = create("label");
  label.append(create("span", "", "Dein Hero"));
  const select = create("select");
  select.append(new Option("Alle Heroes", "all"));
  for (const group of heroGroups) select.append(new Option(heroFor(group.heroId).name, String(group.heroId)));
  label.append(select);
  controls.append(label, create("p", "", "Ausgewertet wird, ob der Gegner-Hero im anderen Team stand – unabhängig von Lane oder Rolle."));
  const content = create("div", "detail-stack");
  const render = () => {
    const heroId = select.value === "all" ? null : Number(select.value);
    const matchups = aggregateMatchups(heroId).filter((row) => row.matches >= 3);
    content.replaceChildren();
    if (!matchups.length) {
      content.append(create("p", "sample-notice", "Für diese Auswahl gibt es noch keine belastbare Gegner-Stichprobe."));
      return;
    }
    const difficult = detailSection("Schwierigste Gegner", "Niedrigste persönliche Winrate · mindestens drei Begegnungen.");
    const difficultGrid = create("div", "matchup-grid");
    [...matchups].sort((a, b) => a.winrate - b.winrate || b.matches - a.matches).slice(0, 6)
      .forEach((row) => difficultGrid.append(matchupCard(row)));
    difficult.append(difficultGrid);
    const successful = detailSection("Beste Bilanz", "Höchste persönliche Winrate · mindestens drei Begegnungen.");
    const successfulGrid = create("div", "matchup-grid");
    [...matchups].sort((a, b) => b.winrate - a.winrate || b.matches - a.matches).slice(0, 6)
      .forEach((row) => successfulGrid.append(matchupCard(row)));
    successful.append(successfulGrid);
    content.append(difficult, successful);
  };
  select.addEventListener("change", render);
  render();
  body.append(controls, content);
  openDetail({
    eyebrow: "OPPONENT INTELLIGENCE",
    title: "Gegner-Analyse",
    subtitle: "Matchups aus deiner vollständigen persönlichen Historie",
    body,
  });
}

function openRankContext() {
  const context = state.data.rankContext ?? {};
  const body = create("div", "detail-stack");
  const current = rankDetails(context.currentBadge);
  const peak = rankDetails(context.peakBadge);
  body.append(metricGrid([
    { label: "Aktueller Rang", value: current.label },
    {
      label: "Globaler Kontext",
      value: context.percentile == null ? "—" : `Top ${percentFormat.format(100 - context.percentile)}%`,
      note: context.percentile == null ? "Keine Verteilung verfügbar" : `Höher eingestuft als ${percentFormat.format(context.percentile)}%`,
    },
    { label: "Persönlicher Peak", value: peak.label },
    {
      label: "Trend letzte 10",
      value: context.recentTrend == null ? "—" : `${context.recentTrend >= 0 ? "+" : ""}${context.recentTrend}`,
      tone: context.recentTrend == null ? "" : (context.recentTrend >= 0 ? "positive" : "negative"),
      note: `${context.rankedMatches ?? 0} Ranked Matches erfasst`,
    },
  ]));
  const distribution = detailSection(
    "Rangverteilung der letzten 30 Tage",
    `${numberFormat.format(context.population ?? 0)} aktive Spieler im verfügbaren API-Zeitraum.`,
  );
  const bars = create("div", "rank-distribution");
  const maxShare = Math.max(1, ...(context.distribution ?? []).map((row) => row.share));
  for (const row of context.distribution ?? []) {
    const rank = state.data.ranks?.[String(row.tier)];
    const item = create("div", "rank-distribution-row");
    item.append(create("span", "", rank?.name ?? `Tier ${row.tier}`));
    const track = create("span", "rank-distribution-track");
    const fill = create("span");
    fill.style.width = `${(row.share / maxShare) * 100}%`;
    if (rank?.color) fill.style.background = rank.color;
    track.append(fill);
    item.append(track, create("strong", "", `${percentFormat.format(row.share)}%`));
    bars.append(item);
  }
  if (bars.childElementCount) distribution.append(bars);
  else distribution.append(create("p", "sample-notice", "Die globale Rangverteilung ist momentan nicht verfügbar."));
  body.append(distribution);
  openDetail({
    eyebrow: "RANK INTELLIGENCE",
    title: "Dein Rang im Kontext",
    subtitle: "Persönlicher Verlauf und Einordnung unter aktiven Ranked-Spielern",
    body,
  });
}

function archiveSelect(labelText, values, selected, onChange) {
  const label = create("label", "archive-filter");
  label.append(create("span", "", labelText));
  const select = create("select");
  for (const [value, labelValue] of values) select.append(new Option(labelValue, value));
  select.value = selected;
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}

function openMatchArchive() {
  const archive = { hero: "all", result: "all", mode: "all", sort: "newest", query: "", page: 1 };
  const pageSize = 25;
  const body = create("div", "detail-stack");
  const filters = create("div", "archive-filters");
  const searchLabel = create("label", "archive-filter archive-search");
  searchLabel.append(create("span", "", "Suche"));
  const search = create("input");
  search.type = "search";
  search.placeholder = "Hero oder Match-ID";
  searchLabel.append(search);
  const results = create("div", "archive-results");
  const pagination = create("div", "archive-pagination");
  const modes = [...new Set(selectedMatches().map((match) => match.mode))].sort();
  const heroGroups = groupHeroes(selectedMatches());

  const render = () => {
    let matches = selectedMatches().filter((match) => {
      if (archive.hero !== "all" && match.heroId !== Number(archive.hero)) return false;
      if (archive.result !== "all" && match.result !== archive.result) return false;
      if (archive.mode !== "all" && match.mode !== archive.mode) return false;
      if (archive.query) {
        const haystack = `${match.id} ${heroFor(match.heroId).name}`.toLowerCase();
        if (!haystack.includes(archive.query.toLowerCase())) return false;
      }
      return true;
    });
    matches = [...matches].sort((a, b) => {
      if (archive.sort === "oldest") return new Date(a.startedAt) - new Date(b.startedAt);
      if (archive.sort === "kda") return matchKda(b) - matchKda(a);
      if (archive.sort === "spm") return b.soulsPerMinute - a.soulsPerMinute;
      return new Date(b.startedAt) - new Date(a.startedAt);
    });
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    archive.page = Math.min(archive.page, pageCount);
    const visible = matches.slice((archive.page - 1) * pageSize, archive.page * pageSize);
    results.replaceChildren();
    if (visible.length) results.append(compactMatchList(visible));
    else results.append(create("p", "sample-notice", "Keine Matches entsprechen diesen Filtern."));
    pagination.replaceChildren();
    const previous = create("button", "insight-action", "← Zurück");
    previous.type = "button";
    previous.disabled = archive.page === 1;
    previous.addEventListener("click", () => { archive.page -= 1; render(); });
    const next = create("button", "insight-action", "Weiter →");
    next.type = "button";
    next.disabled = archive.page === pageCount;
    next.addEventListener("click", () => { archive.page += 1; render(); });
    pagination.append(previous, create("span", "", `${matches.length} Matches · Seite ${archive.page} von ${pageCount}`), next);
  };

  filters.append(
    searchLabel,
    archiveSelect("Hero", [["all", "Alle Heroes"], ...heroGroups.map((group) => [String(group.heroId), heroFor(group.heroId).name])], archive.hero, (value) => { archive.hero = value; archive.page = 1; render(); }),
    archiveSelect("Ergebnis", [["all", "Alle Ergebnisse"], ["win", "Siege"], ["loss", "Niederlagen"]], archive.result, (value) => { archive.result = value; archive.page = 1; render(); }),
    archiveSelect("Modus", [["all", "Alle Modi"], ...modes.map((mode) => [mode, mode])], archive.mode, (value) => { archive.mode = value; archive.page = 1; render(); }),
    archiveSelect("Sortierung", [["newest", "Neueste zuerst"], ["oldest", "Älteste zuerst"], ["kda", "Beste KDA"], ["spm", "Höchste SPM"]], archive.sort, (value) => { archive.sort = value; archive.page = 1; render(); }),
  );
  search.addEventListener("input", () => { archive.query = search.value.trim(); archive.page = 1; render(); });
  render();
  body.append(filters, results, pagination);
  openDetail({
    eyebrow: "FULL MATCH ARCHIVE",
    title: "Vollständiges Matcharchiv",
    subtitle: `${selectedMatches().length} Matches · filterbar und chronologisch durchsuchbar`,
    body,
  });
}

function compactMatchList(matches) {
  const list = create("div", "compact-match-list");
  for (const match of matches) {
    const hero = heroFor(match.heroId);
    const button = create("button", "compact-match");
    button.type = "button";
    const identity = create("span", "compact-match-identity");
    if (hero.image) {
      const image = create("img");
      image.src = hero.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      identity.append(image);
    }
    const copy = create("span");
    copy.append(
      create("strong", "", hero.name),
      create(
        "small",
        "",
        match.startedAt
          ? new Intl.DateTimeFormat(localeCode(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.startedAt))
          : "Datum unbekannt",
      ),
    );
    identity.append(copy);
    const result = create("span", `compact-result ${match.result === "win" ? "positive" : "negative"}`);
    result.append(
      create("strong", "", match.result === "win" ? "Sieg" : "Niederlage"),
      create("small", "", `${match.kills}/${match.deaths}/${match.assists} · ${numberFormat.format(match.soulsPerMinute)} SPM`),
    );
    button.append(identity, result);
    button.addEventListener("click", () => openResolvedMatchDetail(match, button));
    list.append(button);
  }
  return list;
}

function openHeroDetail(heroId) {
  const matches = selectedMatches().filter((match) => match.heroId === heroId);
  const group = groupHeroes(matches)[0];
  if (!group) return;
  const hero = heroFor(heroId);
  const summary = summarize(matches);
  const benchmark = state.data.heroBenchmarks?.[String(heroId)] ?? null;
  const body = create("div", "detail-stack");

  if (matches.length < HERO_SAMPLE_MIN) {
    body.append(create("p", "sample-notice", `Kleine Stichprobe: Erst ab ${HERO_SAMPLE_MIN} Matches fließt ein Hero in die Winrate- und KDA-Rangliste ein.`));
  }

  body.append(metricGrid([
    { label: "Matches", value: numberFormat.format(matches.length), note: `${summary.wins} Siege · ${summary.losses} Niederlagen` },
    { label: "Winrate", value: `${percentFormat.format(summary.winrate)}%`, tone: summary.winrate >= 50 ? "positive" : "negative" },
    { label: "KDA", value: decimalFormat.format(summary.kda) },
    { label: "Souls / Min.", value: numberFormat.format(Math.round(summary.spm)) },
  ]));

  if (benchmark) {
    const comparison = detailSection(
      "Deine Werte im globalen Vergleich",
      `Verglichen mit dem Durchschnitt aus ${numberFormat.format(benchmark.matches)} weltweit erfassten ${hero.name}-Matches.`,
    );
    const rows = create("div", "comparison-list");
    for (const row of [
      { label: "Winrate", personal: summary.winrate, reference: benchmark.winrate, format: (value) => `${percentFormat.format(value)}%`, suffix: " Pkt." },
      { label: "KDA", personal: summary.kda, reference: benchmark.kda, format: (value) => decimalFormat.format(value) },
      { label: "Net Worth", personal: summary.netWorth, reference: benchmark.avgNetWorth, format: (value) => numberFormat.format(Math.round(value)) },
      { label: "Player Damage", personal: average(matches.map((match) => match.playerDamage)), reference: benchmark.avgPlayerDamage, format: (value) => numberFormat.format(Math.round(value)) },
    ]) {
      const item = create("div", "comparison-row");
      const copy = create("span");
      copy.append(create("small", "", row.label), create("strong", "", row.format(row.personal)));
      const delta = row.personal - row.reference;
      const reference = create("span", "comparison-reference");
      reference.append(
        create("small", "", `Globaler Durchschnitt ${row.format(row.reference)}`),
        create("strong", delta >= 0 ? "positive" : "negative", signedDifference(row.personal, row.reference, row.suffix || "")),
      );
      item.append(copy, reference);
      rows.append(item);
    }
    comparison.append(rows);
    body.append(comparison);
  }

  const records = detailSection("Persönliche Bestwerte", "Aus deiner vollständigen Matchhistorie mit diesem Hero.");
  records.append(metricGrid([
    { label: "Meiste Kills", value: numberFormat.format(Math.max(...matches.map((match) => match.kills))) },
    { label: "Meiste Assists", value: numberFormat.format(Math.max(...matches.map((match) => match.assists))) },
    { label: "Peak SPM", value: numberFormat.format(Math.max(...matches.map((match) => match.soulsPerMinute))) },
    { label: "Peak Net Worth", value: numberFormat.format(Math.max(...matches.map((match) => match.netWorth))) },
  ]));
  body.append(records);

  const coach = buildHeroCoachSection(heroId);
  if (coach) body.append(coach);
  const matchups = buildHeroMatchupSection(heroId);
  if (matchups) body.append(matchups);

  const recent = detailSection("Letzte Matches", `Die letzten ${Math.min(6, matches.length)} Auftritte mit ${hero.name}.`);
  recent.append(compactMatchList(matches.slice(0, 6)));
  body.append(recent);

  openDetail({
    eyebrow: "HERO INTELLIGENCE",
    title: hero.name,
    subtitle: `${matches.length} ${matches.length === 1 ? "Match" : "Matches"} in deiner vollständigen Historie`,
    body,
  });
}

function buildSessions(matches) {
  const sessions = [];
  for (const match of matches) {
    const startedAt = match.startedAt ? new Date(match.startedAt).getTime() : null;
    const current = sessions.at(-1);
    const previousMatch = current?.matches.at(-1);
    const previousStartedAt = previousMatch?.startedAt ? new Date(previousMatch.startedAt).getTime() : null;
    if (!current || startedAt == null || previousStartedAt == null || previousStartedAt - startedAt > SESSION_GAP_MS) {
      sessions.push({ matches: [match] });
    } else {
      current.matches.push(match);
    }
  }
  return sessions;
}

function renderSessions(matches) {
  const grid = byId("session-grid");
  grid.replaceChildren();
  const overall = summarize(matches);
  const sessions = buildSessions(matches).slice(0, 6);
  for (const [index, session] of sessions.entries()) {
    const summary = summarize(session.matches);
    const heroes = groupHeroes(session.matches);
    const favoriteHero = heroes[0] ? heroFor(heroes[0].heroId).name : "—";
    const newest = session.matches[0]?.startedAt ? new Date(session.matches[0].startedAt) : null;
    const oldest = session.matches.at(-1)?.startedAt ? new Date(session.matches.at(-1).startedAt) : null;
    const card = create("article", "session-card");
    const header = create("div", "session-card-header");
    header.append(
      create("span", "session-rank", String(index + 1).padStart(2, "0")),
      create("strong", "", newest ? new Intl.DateTimeFormat(localeCode(), { dateStyle: "medium" }).format(newest) : "Datum unbekannt"),
    );
    const timeRange = newest && oldest
      ? `${new Intl.DateTimeFormat(localeCode(), { hour: "2-digit", minute: "2-digit" }).format(oldest)}–${new Intl.DateTimeFormat(localeCode(), { hour: "2-digit", minute: "2-digit" }).format(newest)}`
      : "—";
    header.append(create("small", "", timeRange));
    card.append(header);
    card.append(metricGrid([
      { label: "Bilanz", value: `${summary.wins}W · ${summary.losses}L`, tone: summary.winrate >= 50 ? "positive" : "negative" },
      { label: "Winrate", value: `${percentFormat.format(summary.winrate)}%`, note: `${signedDifference(summary.winrate, overall.winrate, " Pkt.")} vs. Gesamt` },
      { label: "KDA", value: decimalFormat.format(summary.kda) },
      { label: "Ø SPM", value: numberFormat.format(Math.round(summary.spm)) },
    ], "session-stats"));
    const footer = create("div", "session-card-footer");
    footer.append(
      create("span", "", `${session.matches.length} ${session.matches.length === 1 ? "Match" : "Matches"}`),
      create("span", "", `Top Hero: ${favoriteHero}`),
    );
    card.append(footer);
    grid.append(card);
  }
}

function renderOpponents() {
  const body = byId("opponent-table-body");
  if (!body) return;
  const query = state.opponentQuery.toLocaleLowerCase("de");
  const opponents = (state.data.opponents ?? [])
    .filter((opponent) => opponent.matches >= state.opponentMinMatches)
    .filter((opponent) => !query || `${opponent.name} ${opponent.accountId} ${opponent.steamId64}`.toLocaleLowerCase("de").includes(query))
    .sort((a, b) => {
      if (state.opponentSort === "winrate") return b.winrate - a.winrate || b.matches - a.matches;
      if (state.opponentSort === "lossrate") return b.lossrate - a.lossrate || b.matches - a.matches;
      return b.matches - a.matches || b.winrate - a.winrate;
    });
  const totalPages = Math.max(1, Math.ceil(opponents.length / OPPONENT_PAGE_SIZE));
  state.opponentPage = Math.min(state.opponentPage, totalPages);
  const visible = opponents.slice(
    (state.opponentPage - 1) * OPPONENT_PAGE_SIZE,
    state.opponentPage * OPPONENT_PAGE_SIZE,
  );
  body.replaceChildren();

  if (!visible.length) {
    const row = create("tr");
    const cell = create("td", "opponent-empty", state.data.opponents?.length
      ? "Keine Gegner entsprechen deiner Auswahl."
      : "Noch keine Gegnerdaten verfügbar. Der nächste Datenlauf versucht es erneut.");
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
  }

  for (const opponent of visible) {
    const row = create("tr");
    const identityCell = create("td");
    const identity = create("a", "opponent-identity");
    identity.href = opponent.profileUrl;
    identity.target = "_blank";
    identity.rel = "noreferrer";
    if (opponent.avatar) {
      const image = create("img");
      image.src = opponent.avatar;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      identity.append(image);
    } else {
      identity.append(create("span", "opponent-avatar-fallback", opponent.name.slice(0, 1).toUpperCase()));
    }
    const copy = create("span");
    copy.append(create("strong", "", opponent.name), create("small", "", `Steam ${opponent.accountId}`));
    identity.append(copy);
    identityCell.append(identity);
    row.append(
      identityCell,
      create("td", "opponent-match-count", numberFormat.format(opponent.matches)),
      create("td", "positive", numberFormat.format(opponent.wins)),
      create("td", "negative", numberFormat.format(opponent.losses)),
      create("td", opponent.winrate >= 50 ? "positive" : "negative", `${percentFormat.format(opponent.winrate)}%`),
      create("td", opponent.lossrate > 50 ? "negative" : "", `${percentFormat.format(opponent.lossrate)}%`),
    );
    body.append(row);
  }

  text("opponent-coverage", `${numberFormat.format(state.data.opponents?.length ?? 0)} unterschiedliche Gegner · vollständige Historie`);
  text("opponent-page-status", opponents.length
    ? `Seite ${state.opponentPage} von ${totalPages} · ${numberFormat.format(opponents.length)} Gegner`
    : "0 Gegner");
  byId("opponent-prev").disabled = state.opponentPage <= 1;
  byId("opponent-next").disabled = state.opponentPage >= totalPages;
}

function renderHeroCards(groups) {
  const grid = byId("hero-grid");
  grid.replaceChildren();
  for (const [index, group] of groups.slice(0, 6).entries()) {
    const hero = heroFor(group.heroId);
    const card = document.createElement("article");
    card.className = "hero-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Details zu ${hero.name} öffnen`);
    if (hero.color && /^#[0-9a-f]{6}$/i.test(hero.color)) {
      card.style.setProperty("--hero-glow", `${hero.color}38`);
    }

    const visual = document.createElement("div");
    const rank = document.createElement("div");
    rank.className = "hero-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    visual.append(rank);
    if (hero.image) {
      const image = document.createElement("img");
      image.src = hero.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      visual.append(image);
    }

    const body = document.createElement("div");
    body.className = "hero-card-body";
    const kicker = document.createElement("span");
    kicker.textContent = `${group.matches} ${group.matches === 1 ? "Match" : "Matches"}`;
    const name = document.createElement("h3");
    name.textContent = hero.name;
    body.append(kicker, name);
    if (group.matches < HERO_SAMPLE_MIN) {
      body.append(create("span", "sample-badge", "Kleine Stichprobe"));
    }
    const stats = document.createElement("div");
    stats.className = "hero-card-stats";
    for (const [label, value, className] of [
      ["Winrate", `${percentFormat.format(group.winrate)}%`, group.winrate >= 50 ? "positive" : "negative"],
      ["KDA", decimalFormat.format(group.kda), ""],
      ["Souls / Min.", numberFormat.format(Math.round(group.avgSpm)), ""],
      ["Siege", `${group.wins}/${group.matches}`, ""],
    ]) {
      const cell = document.createElement("div");
      const small = document.createElement("small");
      const strong = document.createElement("strong");
      small.textContent = label;
      strong.textContent = value;
      strong.className = className;
      cell.append(small, strong);
      stats.append(cell);
    }
    body.append(stats);
    card.append(visual, body);
    card.addEventListener("click", () => openHeroDetail(group.heroId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openHeroDetail(group.heroId);
      }
    });
    grid.append(card);
  }
}

function renderHeroSort() {
  const descriptions = {
    matches: "Nach den meisten Matches in der vollständigen Historie.",
    winrate: `Nach höchster Winrate · mindestens ${HERO_SAMPLE_MIN} Matches für das Ranking.`,
    kda: `Nach höchstem KDA · mindestens ${HERO_SAMPLE_MIN} Matches für das Ranking.`,
  };
  text("hero-sort-description", descriptions[state.heroSort]);
  for (const button of document.querySelectorAll("[data-hero-sort]")) {
    button.setAttribute("aria-pressed", String(button.dataset.heroSort === state.heroSort));
  }
}

function rosterColumn(title, players, onSelect) {
  const column = create("div", "roster-column");
  column.append(create("h4", "", title));
  const list = create("div", "roster-list");
  for (const player of players) {
    const hero = heroFor(player.heroId);
    const item = create("div", `roster-player${player.isSelf ? " is-self" : ""}`);
    const select = create("button", "roster-player-select");
    select.type = "button";
    select.setAttribute("aria-pressed", "false");
    select.setAttribute("aria-label", `Build und Werte von ${hero.name} anzeigen`);
    const identity = create("span", "roster-identity");
    if (hero.image) {
      const image = create("img");
      image.src = hero.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      identity.append(image);
    }
    const copy = create("span");
    copy.append(create("strong", "", player.isSelf ? `${hero.name} · Du` : hero.name));
    copy.append(create("small", "", `${numberFormat.format(player.netWorth)} Net Worth`));
    identity.append(copy);
    select.append(identity, create("strong", "roster-kda", `${player.kills}/${player.deaths}/${player.assists}`));
    select.addEventListener("click", () => onSelect(player, item));
    item.append(select);
    const profileUrl = steamProfileUrl(player.accountId);
    if (profileUrl) {
      const profile = create("a", "roster-steam-link", "Steam ↗");
      profile.href = profileUrl;
      profile.target = "_blank";
      profile.rel = "noreferrer";
      profile.setAttribute("aria-label", `Steam-Profil des ${hero.name}-Spielers öffnen`);
      item.append(profile);
    }
    list.append(item);
  }
  column.append(list);
  return column;
}

function renderRosterPlayerDetail(match, player, target) {
  const hero = heroFor(player.heroId);
  const accuracyTotal = player.shotsHit + player.shotsMissed;
  const accuracy = accuracyTotal ? (player.shotsHit / accuracyTotal) * 100 : 0;
  const content = create("div", "roster-player-detail-content");
  const header = create("div", "roster-player-detail-header");
  const identity = create("div", "roster-player-detail-identity");
  if (hero.image) {
    const image = create("img");
    image.src = hero.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    identity.append(image);
  }
  const copy = create("div");
  copy.append(
    create("span", "eyebrow", player.isSelf ? "DEINE PERFORMANCE" : player.team === match.team ? "DEIN TEAM" : "GEGNERTEAM"),
    create("h4", "", hero.name),
    create("p", "", `${player.kills}/${player.deaths}/${player.assists} · ${numberFormat.format(player.netWorth)} Net Worth`),
  );
  identity.append(copy);
  const actions = create("div", "roster-detail-actions");
  actions.append(create("span", "roster-detail-hint", "Spieler wechseln: anderen Hero anklicken"));
  const profileUrl = steamProfileUrl(player.accountId);
  if (profileUrl) {
    const profile = create("a", "roster-detail-steam-link", "Steam-Profil ↗");
    profile.href = profileUrl;
    profile.target = "_blank";
    profile.rel = "noreferrer";
    actions.append(profile);
  }
  header.append(identity, actions);
  content.append(header);
  content.append(metricGrid([
    { label: "Player Damage", value: numberFormat.format(player.playerDamage) },
    { label: "Damage erhalten", value: numberFormat.format(player.damageTaken) },
    { label: "Healing", value: numberFormat.format(player.playerHealing) },
    { label: "Mitigation", value: numberFormat.format(player.damageMitigated) },
    { label: "Boss Damage", value: numberFormat.format(player.bossDamage) },
    { label: "Creep Damage", value: numberFormat.format(player.creepDamage) },
    { label: "Trefferquote", value: accuracyTotal ? `${percentFormat.format(accuracy)}%` : "—", note: accuracyTotal ? `${numberFormat.format(player.shotsHit)} Treffer` : "Keine Daten" },
    { label: "Last Hits / Denies", value: `${numberFormat.format(player.lastHits)} / ${numberFormat.format(player.denies)}` },
  ]));

  const itemTimeline = buildTimeline(player, "upgrade", "Item-Build", "Kaufreihenfolge und Zeitpunkte dieses Spielers.");
  const abilityTimeline = buildTimeline(player, "ability", "Ability-Reihenfolge", "Zeitliche Reihenfolge der Ability-Upgrades dieses Spielers.");
  if (itemTimeline) content.append(itemTimeline);
  if (abilityTimeline) content.append(abilityTimeline);
  if (!itemTimeline && !abilityTimeline) {
    content.append(create("p", "sample-notice", "Für diesen Spieler sind keine Build-Ereignisse verfügbar."));
  }
  target.replaceChildren(content);
}

function buildTimeline(match, type, title, description) {
  const events = (match.build ?? [])
    .map((event) => ({ ...event, asset: buildAssetFor(event.itemId) }))
    .filter((event) => event.asset?.type === type)
    .sort((a, b) => a.atSeconds - b.atSeconds);
  if (!events.length) return null;
  const section = detailSection(title, description);
  const timeline = create("div", "build-timeline");
  for (const [index, event] of events.entries()) {
    const item = create("div", "build-event");
    const imageWrap = create("span", "build-image");
    if (event.asset.image) {
      const image = create("img");
      image.src = event.asset.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      imageWrap.append(image);
    } else {
      imageWrap.append(create("span", "", String(index + 1)));
    }
    const copy = create("span");
    copy.append(
      create("strong", "", event.asset.name),
      create("small", "", `${formatDuration(event.atSeconds)}${event.soldAtSeconds > 0 ? ` · verkauft ${formatDuration(event.soldAtSeconds)}` : ""}`),
    );
    item.append(imageWrap, copy);
    timeline.append(item);
  }
  section.append(timeline);
  return section;
}

function teamSummary(players) {
  return players.reduce((summary, player) => ({
    kills: summary.kills + player.kills,
    deaths: summary.deaths + player.deaths,
    assists: summary.assists + player.assists,
    netWorth: summary.netWorth + player.netWorth,
    playerDamage: summary.playerDamage + player.playerDamage,
    healing: summary.healing + player.playerHealing,
    bossDamage: summary.bossDamage + player.bossDamage,
  }), { kills: 0, deaths: 0, assists: 0, netWorth: 0, playerDamage: 0, healing: 0, bossDamage: 0 });
}

function rankAmong(players, player, getter) {
  if (!players.length || !player) return null;
  return [...players].sort((a, b) => getter(b) - getter(a)).findIndex((candidate) => candidate === player) + 1;
}

function timelineValueAt(timeline, field, atSeconds) {
  if (!timeline?.times?.length || !timeline?.[field]?.length) return 0;
  let value = 0;
  for (let index = 0; index < timeline.times.length; index += 1) {
    if (timeline.times[index] > atSeconds) break;
    value = Number(timeline[field][index] ?? value);
  }
  return value;
}

function economyModel(match) {
  if (match.teamEconomy?.times?.length) {
    const own = match.team === 0 ? match.teamEconomy.team0 : match.teamEconomy.team1;
    const enemy = match.team === 0 ? match.teamEconomy.team1 : match.teamEconomy.team0;
    return {
      times: match.teamEconomy.times,
      series: [
        { label: "Dein Team", color: "#d7ff64", values: own },
        { label: "Gegnerteam", color: "#ff7448", values: enemy },
      ],
      differences: own.map((value, index) => value - (enemy[index] ?? 0)),
    };
  }
  if (match.timeline?.times?.length && match.timeline.netWorth?.length) {
    return {
      times: match.timeline.times,
      series: [{ label: "Dein Net Worth", color: "#d7ff64", values: match.timeline.netWorth }],
      differences: null,
    };
  }
  return null;
}

function compactAxisValue(value) {
  if (Math.abs(value) >= 100_000) return `${Math.round(value / 1_000)}k`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(0)}k`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return numberFormat.format(Math.round(value));
}

function drawReviewChart(canvas, model) {
  if (!canvas?.isConnected || !model?.times?.length) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 16, right: 16, bottom: 30, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = model.series.flatMap((series) => series.values);
  const minValue = Math.max(0, Math.min(...values) * 0.88);
  const maxValue = Math.max(...values) * 1.06;
  const range = Math.max(1, maxValue - minValue);
  const minTime = Math.min(...model.times);
  const maxTime = Math.max(...model.times);
  const timeRange = Math.max(1, maxTime - minTime);
  const x = (time) => padding.left + ((time - minTime) / timeRange) * plotWidth;
  const y = (value) => padding.top + ((maxValue - value) / range) * plotHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.font = "9px ui-monospace, monospace";
  ctx.fillStyle = "#65706b";
  ctx.strokeStyle = "rgba(226,237,231,.085)";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const lineY = padding.top + (plotHeight * index) / 4;
    const value = maxValue - (range * index) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, lineY);
    ctx.lineTo(width - padding.right, lineY);
    ctx.stroke();
    ctx.fillText(compactAxisValue(value), 0, lineY + 3);
  }

  for (const series of model.series) {
    ctx.beginPath();
    model.times.forEach((time, index) => {
      const px = x(time);
      const py = y(series.values[index] ?? 0);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  ctx.fillStyle = "#65706b";
  ctx.textAlign = "center";
  for (const time of [minTime, minTime + timeRange / 2, maxTime]) {
    ctx.fillText(`${Math.round(time / 60)} min`, x(time), height - 8);
  }
  ctx.textAlign = "start";
}

function teamComparisonBlock(match, ownTeam, enemyTeam) {
  if (!ownTeam.length || !enemyTeam.length) return null;
  const own = teamSummary(ownTeam);
  const enemy = teamSummary(enemyTeam);
  const block = create("div", "review-block");
  const heading = create("div", "review-subheading");
  heading.append(create("h4", "", "Teamvergleich"), create("p", "", "Finale Teamwerte aus dem Match."));
  block.append(heading);
  const rows = create("div", "team-comparison");
  for (const metric of [
    { label: "Kills", own: own.kills, enemy: enemy.kills },
    { label: "Net Worth", own: own.netWorth, enemy: enemy.netWorth },
    { label: "Player Damage", own: own.playerDamage, enemy: enemy.playerDamage },
    { label: "Healing", own: own.healing, enemy: enemy.healing },
    { label: "Boss Damage", own: own.bossDamage, enemy: enemy.bossDamage },
  ]) {
    const maximum = Math.max(1, metric.own, metric.enemy);
    const row = create("div", "team-comparison-row");
    row.append(create("strong", metric.own >= metric.enemy ? "positive" : "", numberFormat.format(metric.own)));
    const visual = create("div", "team-comparison-visual");
    const label = create("span", "", metric.label);
    const bars = create("span", "team-comparison-bars");
    const ownBar = create("span", "is-own");
    ownBar.style.width = `${(metric.own / maximum) * 100}%`;
    const enemyBar = create("span", "is-enemy");
    enemyBar.style.width = `${(metric.enemy / maximum) * 100}%`;
    bars.append(ownBar, enemyBar);
    visual.append(label, bars);
    row.append(visual, create("strong", metric.enemy > metric.own ? "negative" : "", numberFormat.format(metric.enemy)));
    rows.append(row);
  }
  block.append(rows);
  return block;
}

function laneReviewBlock(match, ownTeam, enemyTeam) {
  if (!match.assignedLane || !ownTeam.length || !enemyTeam.length) return null;
  const ownLane = ownTeam.filter((player) => player.assignedLane === match.assignedLane);
  const enemyLane = enemyTeam.filter((player) => player.assignedLane === match.assignedLane);
  if (!ownLane.length || !enemyLane.length) return null;
  const ownAt12 = ownLane.reduce((sum, player) => sum + (player.netWorthAt12 || 0), 0);
  const enemyAt12 = enemyLane.reduce((sum, player) => sum + (player.netWorthAt12 || 0), 0);
  if (!ownAt12 && !enemyAt12) return null;
  const ownFinal = ownLane.reduce((sum, player) => sum + player.netWorth, 0);
  const enemyFinal = enemyLane.reduce((sum, player) => sum + player.netWorth, 0);
  const block = create("div", "review-block lane-review");
  const heading = create("div", "review-subheading");
  heading.append(
    create("h4", "", `Lane ${match.assignedLane} Review`),
    create("p", "", `${ownLane.map((player) => heroFor(player.heroId).name).join(" + ")} gegen ${enemyLane.map((player) => heroFor(player.heroId).name).join(" + ")}`),
  );
  block.append(heading, metricGrid([
    { label: "Net Worth · 12 Min.", value: numberFormat.format(ownAt12), note: `${signedDifference(ownAt12, enemyAt12)} zur Gegner-Lane`, tone: ownAt12 >= enemyAt12 ? "positive" : "negative" },
    { label: "Gegner · 12 Min.", value: numberFormat.format(enemyAt12) },
    { label: "Lane-Gruppe · Ende", value: numberFormat.format(ownFinal), note: `${signedDifference(ownFinal, enemyFinal)} final`, tone: ownFinal >= enemyFinal ? "positive" : "negative" },
  ], "lane-review-metrics"));
  return { block, ownAt12, enemyAt12 };
}

function objectiveLabel(type) {
  if (type === 0) return "Patron zerstört";
  if (type >= 1 && type <= 4) return `Guardian · Lane ${type}`;
  if (type >= 5 && type <= 8) return `Walker · Lane ${type - 4}`;
  if (type === 9) return "Patron-Phase erreicht";
  if (type === 10 || type === 11) return "Schildgenerator zerstört";
  if (type >= 12 && type <= 15) return `Base Guardian · Lane ${type - 11}`;
  return "Objective zerstört";
}

function matchKeyMoments(match, model) {
  const moments = [];
  for (const event of match.objectives ?? []) {
    moments.push({
      atSeconds: event.atSeconds,
      title: objectiveLabel(event.type),
      detail: event.team === match.team ? "Dein Team" : "Gegnerteam",
      tone: event.team === match.team ? "positive" : "negative",
      priority: event.type === 0 || event.type >= 9 ? 5 : event.type >= 5 ? 3 : 1,
    });
  }
  for (const event of match.midBoss ?? []) {
    const claimedOwn = event.claimedByTeam === match.team;
    const killedOwn = event.killedByTeam === match.team;
    moments.push({
      atSeconds: event.atSeconds,
      title: "Mid Boss",
      detail: `${killedOwn ? "von deinem Team besiegt" : "vom Gegner besiegt"} · ${claimedOwn ? "Claim gesichert" : "Claim beim Gegner"}`,
      tone: claimedOwn ? "positive" : "negative",
      priority: 5,
    });
  }
  for (const death of match.deathDetails ?? []) {
    moments.push({
      atSeconds: death.atSeconds,
      title: "Death",
      detail: `${Math.round(death.durationSeconds)} Sek. Ausfall${death.timeToKillSeconds == null ? "" : ` · ${decimalFormat.format(death.timeToKillSeconds)} Sek. TTK`}`,
      tone: "negative",
      priority: death.atSeconds >= 25 * 60 ? 4 : 2,
    });
  }
  if (match.timeline?.times?.length) {
    let previousKills = 0;
    match.timeline.times.forEach((time, index) => {
      const kills = match.timeline.kills?.[index] ?? previousKills;
      const difference = kills - previousKills;
      if (difference > 0) moments.push({
        atSeconds: time,
        title: difference > 1 ? `${difference} Kills im Zeitfenster` : "Kill erzielt",
        detail: `${kills} Kills bis Minute ${Math.round(time / 60)}`,
        tone: "positive",
        priority: difference > 1 ? 4 : 1,
      });
      previousKills = kills;
    });
  }
  for (const event of (match.build ?? [])
    .map((buildEvent) => ({ ...buildEvent, asset: buildAssetFor(buildEvent.itemId) }))
    .filter((buildEvent) => buildEvent.asset?.type === "upgrade" && buildEvent.asset?.tier >= 3)
    .slice(0, 4)) {
    moments.push({
      atSeconds: event.atSeconds,
      title: event.asset.name,
      detail: `Tier-${event.asset.tier}-Power-Spike`,
      tone: "neutral",
      priority: 2,
    });
  }
  if (model?.differences?.length >= 2) {
    let swing = { amount: 0, index: 0 };
    for (let index = 1; index < model.differences.length; index += 1) {
      const amount = model.differences[index] - model.differences[index - 1];
      if (Math.abs(amount) > Math.abs(swing.amount)) swing = { amount, index };
    }
    if (Math.abs(swing.amount) >= 3_000) moments.push({
      atSeconds: model.times[swing.index],
      title: swing.amount > 0 ? "Größter Economy-Gewinn" : "Größter Economy-Verlust",
      detail: `${signedDifference(swing.amount, 0)} Net Worth im Messintervall`,
      tone: swing.amount > 0 ? "positive" : "negative",
      priority: 5,
    });
  }
  return moments
    .sort((a, b) => b.priority - a.priority || a.atSeconds - b.atSeconds)
    .slice(0, 18)
    .sort((a, b) => a.atSeconds - b.atSeconds);
}

function reviewInsights(match, context) {
  const insights = [];
  const { participation, economyRank, damageRank, lane, model } = context;
  if (model?.differences?.length) {
    const maxLead = Math.max(...model.differences);
    const minLead = Math.min(...model.differences);
    if (match.result === "loss" && maxLead >= 4_000) insights.push({
      title: "Führung nicht geschlossen",
      body: `Dein Team lag zwischenzeitlich ${numberFormat.format(Math.round(maxLead))} Net Worth vorn. Prüfe im Verlauf den Umschwung nach diesem Peak.`,
      tone: "warning",
    });
    if (match.result === "win" && minLead <= -4_000) insights.push({
      title: "Comeback-Sieg",
      body: `Das Team drehte einen Rückstand von ${numberFormat.format(Math.round(Math.abs(minLead)))} Net Worth. Die Phase vor dem größten Swing ist besonders review-würdig.`,
      tone: "positive",
    });
  }
  const deaths = match.deathDetails ?? [];
  const quickDeaths = deaths.filter((death) => death.timeToKillSeconds != null && death.timeToKillSeconds <= 4).length;
  const lateDeaths = deaths.filter((death) => death.atSeconds >= 25 * 60).length;
  if (quickDeaths >= 2) insights.push({
    title: "Burst-Deaths prüfen",
    body: `${quickDeaths} Deaths passierten in höchstens vier Sekunden. Positionierung, Defensive-Aktivierung und Gegner-Cooldowns sind hier die ersten Review-Punkte.`,
    tone: "warning",
  });
  if (lateDeaths >= 2) insights.push({
    title: "Späte Ausfallzeiten",
    body: `${lateDeaths} Deaths lagen nach Minute 25. In dieser Phase sind lange Respawn-Zeiten besonders teuer.`,
    tone: "warning",
  });
  if (participation != null && participation < 40) insights.push({
    title: "Niedrige Killbeteiligung",
    body: `${percentFormat.format(participation)}% Beteiligung an den Team-Kills. Prüfe Rotationen und ob Fights zu spät erreicht wurden.`,
    tone: "neutral",
  });
  if (economyRank != null && damageRank != null && economyRank <= 3 && damageRank >= 7) insights.push({
    title: "Economy nicht vollständig umgesetzt",
    body: `Economy-Rang ${economyRank}, aber Damage-Rang ${damageRank}. Prüfe die Fights nach deinen großen Item-Timings.`,
    tone: "warning",
  });
  if (lane && Math.abs(lane.ownAt12 - lane.enemyAt12) >= 1_500) insights.push({
    title: lane.ownAt12 >= lane.enemyAt12 ? "Starke Lane-Economy" : "Lane-Economy im Rückstand",
    body: `Nach zwölf Minuten lag deine Lane-Gruppe ${numberFormat.format(Math.abs(lane.ownAt12 - lane.enemyAt12))} Net Worth ${lane.ownAt12 >= lane.enemyAt12 ? "vorn" : "hinten"}.`,
    tone: lane.ownAt12 >= lane.enemyAt12 ? "positive" : "warning",
  });
  if (!insights.length) insights.push({
    title: "Stabiles Matchprofil",
    body: "Kein einzelnes Warnsignal dominiert. Nutze Economy-Kurve und Schlüsselereignisse für die manuelle Detailprüfung.",
    tone: "neutral",
  });
  return insights.slice(0, 4);
}

function buildDeepMatchReview(match) {
  const section = detailSection(
    "Deep Match Review",
    "Zeitverlauf, Teamkontext und konkrete Review-Punkte aus den verfügbaren Matchdaten.",
  );
  section.classList.add("deep-review");
  const players = match.players ?? [];
  const self = players.find((player) => player.isSelf) ?? null;
  const ownTeam = players.filter((player) => player.team === match.team);
  const enemyTeam = players.filter((player) => player.team !== match.team);
  const ownSummary = teamSummary(ownTeam);
  const participation = ownSummary.kills ? ((match.kills + match.assists) / ownSummary.kills) * 100 : null;
  const economyRank = rankAmong(players, self, (player) => player.netWorth);
  const damageRank = rankAmong(players, self, (player) => player.playerDamage);
  const deathDowntime = (match.deathDetails ?? []).reduce((sum, death) => sum + death.durationSeconds, 0);
  section.append(metricGrid([
    { label: "Killbeteiligung", value: participation == null ? "—" : `${percentFormat.format(Math.min(100, participation))}%`, note: participation == null ? "Teamdaten fehlen" : `${match.kills + match.assists} Beteiligungen` },
    { label: "Economy-Rang", value: economyRank == null ? "—" : `${economyRank} / ${players.length}`, note: "Nach finalem Net Worth" },
    { label: "Damage-Rang", value: damageRank == null ? "—" : `${damageRank} / ${players.length}`, note: "Im gesamten Match" },
    { label: "Death-Ausfallzeit", value: deathDowntime ? formatDuration(deathDowntime) : "0:00", note: `${match.deathDetails?.length ?? match.deaths} erfasste Deaths` },
  ], "review-impact-grid"));

  const comparison = teamComparisonBlock(match, ownTeam, enemyTeam);
  if (comparison) section.append(comparison);
  const lane = laneReviewBlock(match, ownTeam, enemyTeam);
  if (lane) section.append(lane.block);

  const model = economyModel(match);
  let chart = null;
  if (model) {
    const economy = create("div", "review-block economy-review");
    const heading = create("div", "review-subheading");
    heading.append(create("h4", "", "Economy-Verlauf"), create("p", "", model.series.length > 1 ? "Team-Net-Worth über den Matchverlauf." : "Dein persönlicher Net-Worth-Verlauf."));
    const legend = create("div", "review-chart-legend");
    for (const series of model.series) {
      const item = create("span");
      const dot = create("i");
      dot.style.background = series.color;
      item.append(dot, document.createTextNode(series.label));
      legend.append(item);
    }
    chart = create("canvas", "review-chart");
    chart.setAttribute("aria-label", "Economy-Verlauf dieses Matches");
    economy.append(heading, legend, chart);
    section.append(economy);
  }

  const insights = reviewInsights(match, { participation, economyRank, damageRank, lane, model });
  const insightBlock = create("div", "review-block");
  const insightHeading = create("div", "review-subheading");
  insightHeading.append(create("h4", "", "Review-Hinweise"), create("p", "", "Datenbasierte Auffälligkeiten – als Ausgangspunkt für deine eigene Bewertung."));
  const insightGrid = create("div", "review-insight-grid");
  for (const insight of insights) {
    const card = create("article", `review-insight is-${insight.tone}`);
    card.append(create("strong", "", insight.title), create("p", "", insight.body));
    insightGrid.append(card);
  }
  insightBlock.append(insightHeading, insightGrid);
  section.append(insightBlock);

  const moments = matchKeyMoments(match, model);
  if (moments.length) {
    const momentBlock = create("div", "review-block");
    const heading = create("div", "review-subheading");
    heading.append(create("h4", "", "Schlüsselereignisse"), create("p", "", "Priorisierte Objectives, Deaths, Power-Spikes und Economy-Swings."));
    const timeline = create("div", "review-moments");
    for (const moment of moments) {
      const item = create("div", `review-moment is-${moment.tone}`);
      item.append(create("time", "", formatDuration(moment.atSeconds)));
      const copy = create("span");
      copy.append(create("strong", "", moment.title), create("small", "", moment.detail));
      item.append(copy);
      timeline.append(item);
    }
    momentBlock.append(heading, timeline);
    section.append(momentBlock);
  } else if (!model && !players.length) {
    section.append(create("p", "sample-notice", "Für dieses ältere Match liegen noch keine vollständigen Zeitreihen oder Teamdaten vor."));
  }
  return { section, chart, model };
}

function openMatchDetail(match) {
  const hero = heroFor(match.heroId);
  const overall = summarize(selectedMatches());
  const accuracyTotal = match.shotsHit + match.shotsMissed;
  const accuracy = accuracyTotal ? (match.shotsHit / accuracyTotal) * 100 : 0;
  const body = create("div", "detail-stack");

  body.append(metricGrid([
    { label: "Ergebnis", value: match.result === "win" ? "Sieg" : "Niederlage", tone: match.result === "win" ? "positive" : "negative", note: match.isScored === false ? "Ungewertet" : match.mode },
    { label: "K / D / A", value: `${match.kills} / ${match.deaths} / ${match.assists}`, note: `${decimalFormat.format(matchKda(match))} KDA` },
    { label: "Souls / Min.", value: numberFormat.format(match.soulsPerMinute) },
    { label: "Net Worth", value: numberFormat.format(match.netWorth), note: formatDuration(match.durationSeconds) },
  ]));

  const deepReview = buildDeepMatchReview(match);
  body.append(deepReview.section);

  const performance = detailSection("Performance-Profil", "Detaillierte Werte aus den verarbeiteten Matchdaten.");
  performance.append(metricGrid([
    { label: "Player Damage", value: numberFormat.format(match.playerDamage) },
    { label: "Damage erhalten", value: numberFormat.format(match.damageTaken) },
    { label: "Healing", value: numberFormat.format(match.playerHealing) },
    { label: "Mitigation", value: numberFormat.format(match.damageMitigated) },
    { label: "Boss Damage", value: numberFormat.format(match.bossDamage) },
    { label: "Creep Damage", value: numberFormat.format(match.creepDamage) },
    { label: "Trefferquote", value: accuracyTotal ? `${percentFormat.format(accuracy)}%` : "—", note: accuracyTotal ? `${numberFormat.format(match.shotsHit)} Treffer` : "Keine Daten" },
    { label: "Last Hits / Denies", value: `${numberFormat.format(match.lastHits)} / ${numberFormat.format(match.denies)}` },
  ]));
  body.append(performance);

  const comparison = detailSection("Gegen deinen Durchschnitt", "Vergleich mit deiner vollständigen Matchhistorie.");
  const comparisonRows = create("div", "comparison-list");
  for (const row of [
    { label: "KDA", value: matchKda(match), reference: overall.kda, format: (value) => decimalFormat.format(value) },
    { label: "Souls / Min.", value: match.soulsPerMinute, reference: overall.spm, format: (value) => numberFormat.format(Math.round(value)) },
    { label: "Net Worth", value: match.netWorth, reference: overall.netWorth, format: (value) => numberFormat.format(Math.round(value)) },
  ]) {
    const item = create("div", "comparison-row");
    const current = create("span");
    current.append(create("small", "", row.label), create("strong", "", row.format(row.value)));
    const reference = create("span", "comparison-reference");
    reference.append(
      create("small", "", `Ø ${row.format(row.reference)}`),
      create("strong", row.value >= row.reference ? "positive" : "negative", signedDifference(row.value, row.reference)),
    );
    item.append(current, reference);
    comparisonRows.append(item);
  }
  comparison.append(comparisonRows);
  body.append(comparison);

  if (match.players?.length) {
    const teams = detailSection("Teamaufstellung", "Hero anklicken, um dessen vollständigen Build und Performance-Werte zu öffnen.");
    const grid = create("div", "roster-grid");
    const playerDetail = create("div", "roster-player-detail");
    playerDetail.append(create("p", "roster-player-prompt", "Wähle einen Hero aus der Teamaufstellung aus."));
    const ownTeam = match.players.filter((player) => player.team === match.team);
    const enemyTeam = match.players.filter((player) => player.team !== match.team);
    const selectPlayer = (player, button) => {
      for (const sibling of grid.querySelectorAll(".roster-player")) {
        sibling.classList.toggle("is-selected", sibling === button);
        sibling.querySelector(".roster-player-select")?.setAttribute("aria-pressed", String(sibling === button));
      }
      renderRosterPlayerDetail(match, player, playerDetail);
    };
    grid.append(
      rosterColumn("Dein Team", ownTeam, selectPlayer),
      rosterColumn("Gegnerteam", enemyTeam, selectPlayer),
    );
    teams.append(grid, playerDetail);
    body.append(teams);
  } else {
    const itemTimeline = buildTimeline(match, "upgrade", "Item-Build", "Kaufreihenfolge und Zeitpunkte innerhalb des Matches.");
    const abilityTimeline = buildTimeline(match, "ability", "Ability-Reihenfolge", "Zeitliche Reihenfolge deiner Ability-Upgrades.");
    if (itemTimeline) body.append(itemTimeline);
    if (abilityTimeline) body.append(abilityTimeline);
  }

  openDetail({
    eyebrow: "DEEP MATCH REVIEW",
    title: `${hero.name} · #${match.id.slice(-7)}`,
    subtitle: match.startedAt
      ? new Intl.DateTimeFormat(localeCode(), { dateStyle: "full", timeStyle: "short" }).format(new Date(match.startedAt))
      : "Datum unbekannt",
    body,
  });
  if (deepReview.chart && deepReview.model) {
    requestAnimationFrame(() => {
      drawReviewChart(deepReview.chart, deepReview.model);
      if (typeof ResizeObserver === "function") {
        state.reviewObserver = new ResizeObserver(() => drawReviewChart(deepReview.chart, deepReview.model));
        state.reviewObserver.observe(deepReview.chart);
      }
    });
  }
}

function renderMatches(matches) {
  const body = byId("match-table-body");
  body.replaceChildren();
  for (const match of matches.slice(0, 12)) {
    const hero = heroFor(match.heroId);
    const row = document.createElement("tr");
    row.className = "match-row";
    row.tabIndex = 0;
    row.setAttribute("aria-label", `Matchdetails zu ${hero.name} öffnen`);
    row.addEventListener("click", () => openResolvedMatchDetail(match, row));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openResolvedMatchDetail(match, row);
      }
    });

    const matchCell = document.createElement("td");
    const matchId = document.createElement("div");
    matchId.className = "match-id";
    const matchStrong = document.createElement("strong");
    matchStrong.textContent = `#${match.id.slice(-7)}`;
    const matchDate = document.createElement("small");
    matchDate.textContent = match.startedAt
      ? new Intl.DateTimeFormat(localeCode(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(match.startedAt))
      : "Datum unbekannt";
    matchId.append(matchStrong, matchDate);
    matchCell.append(matchId);

    const heroCell = document.createElement("td");
    const heroWrap = document.createElement("div");
    heroWrap.className = "table-hero";
    if (hero.image) {
      const image = document.createElement("img");
      image.src = hero.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      heroWrap.append(image);
    }
    const heroName = document.createElement("span");
    heroName.textContent = hero.name;
    heroWrap.append(heroName);
    heroCell.append(heroWrap);

    const resultCell = document.createElement("td");
    const result = document.createElement("span");
    result.className = `result-pill ${match.result === "win" ? "is-win" : "is-loss"}`;
    const resultLabel = match.result === "win" ? "Sieg" : "Niederlage";
    result.textContent = match.isScored === false ? `${resultLabel} · ungewertet` : resultLabel;
    resultCell.append(result);

    const kdaCell = document.createElement("td");
    kdaCell.textContent = `${match.kills} / ${match.deaths} / ${match.assists}`;
    const spmCell = document.createElement("td");
    spmCell.textContent = numberFormat.format(match.soulsPerMinute);
    const durationCell = document.createElement("td");
    durationCell.textContent = formatDuration(match.durationSeconds);

    const rankCell = document.createElement("td");
    const rankWrap = document.createElement("div");
    rankWrap.className = "rank-cell";
    const rank = rankDetails(match.rankBadge);
    const rankName = document.createElement("span");
    rankName.textContent = rank.label;
    const delta = document.createElement("small");
    delta.textContent = match.rankDelta == null ? match.mode : `${match.rankDelta >= 0 ? "+" : ""}${match.rankDelta} Fortschritt`;
    if (match.rankDelta > 0) delta.className = "positive";
    if (match.rankDelta < 0) delta.className = "negative";
    rankWrap.append(rankName, delta);
    rankCell.append(rankWrap);

    row.append(matchCell, heroCell, resultCell, kdaCell, spmCell, durationCell, rankCell);
    body.append(row);
  }
}

function drawRankChart(matches) {
  const canvas = byId("rank-chart");
  const empty = byId("rank-empty");
  const points = matches
    .filter((match) => rankDetails(match.rankBadge).score != null)
    .slice()
    .reverse()
    .map((match) => ({ ...match, ...rankDetails(match.rankBadge) }));

  empty.hidden = points.length >= 2;
  canvas.hidden = points.length < 2;
  text("rank-context", `${points.length} Ranked Matches`);
  if (points.length < 2) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 18, right: 18, bottom: 34, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const scores = points.map((point) => point.score);
  const min = Math.min(...scores) - 1;
  const max = Math.max(...scores) + 1;
  const range = Math.max(1, max - min);
  const x = (index) => padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (score) => padding.top + ((max - score) / range) * plotHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#65706b";
  ctx.strokeStyle = "rgba(226,237,231,.09)";
  for (let index = 0; index <= 4; index += 1) {
    const value = max - (range * index) / 4;
    const lineY = padding.top + (plotHeight * index) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, lineY);
    ctx.lineTo(width - padding.right, lineY);
    ctx.stroke();
    const tier = Math.max(0, Math.floor(value / 6));
    const label = state.data.ranks?.[String(tier)]?.name ?? `Tier ${tier}`;
    ctx.fillText(label.slice(0, 10), 0, lineY + 3);
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(215,255,100,.22)");
  gradient.addColorStop(1, "rgba(215,255,100,0)");
  ctx.beginPath();
  points.forEach((point, index) => {
    const px = x(index);
    const py = y(point.score);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.lineTo(x(points.length - 1), height - padding.bottom);
  ctx.lineTo(x(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    const px = x(index);
    const py = y(point.score);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = "#d7ff64";
  ctx.lineWidth = 2.25;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(215,255,100,.28)";
  ctx.stroke();
  ctx.shadowBlur = 0;

  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  ctx.textAlign = "center";
  ctx.fillStyle = "#65706b";
  for (const index of [...new Set(labels)]) {
    const date = points[index].startedAt ? new Date(points[index].startedAt) : null;
    ctx.fillText(
      date ? new Intl.DateTimeFormat(localeCode(), { day: "2-digit", month: "short" }).format(date) : "—",
      x(index),
      height - 9,
    );
  }
  ctx.textAlign = "start";
}

function renderDashboard() {
  const matches = selectedMatches();
  const heroGroups = groupHeroes(matches);
  renderMetrics(matches);
  renderForm(matches, heroGroups);
  renderHeroSort();
  renderHeroCards(sortHeroGroups(heroGroups, state.heroSort));
  renderSessions(matches);
  renderOpponents();
  renderMatches(state.recentMatches.length ? state.recentMatches : matches.slice(0, 12));
  drawRankChart(matches);
  text(
    "match-coverage",
    `${state.data.coverage.publishedMatches} von ${state.data.coverage.availableMatches} verfügbaren Matches geladen`,
  );
}

function renderProfileSummary(data) {
  const profile = data.profile;
  text("profile-name", profile.name);
  const avatar = byId("profile-avatar");
  if (profile.avatar) {
    avatar.src = profile.avatar;
    avatar.alt = `${profile.name} auf Steam`;
  } else {
    avatar.hidden = true;
  }
  text("country-flag", countryFlag(profile.countryCode));
  const latestRanked = data.matches.find((match) => match.rankBadge != null);
  text("current-rank", latestRanked ? rankDetails(latestRanked.rankBadge).label : "Ohne aktuelle Rangdaten");
  text("deadlock-hours", `${numberFormat.format(Math.round((profile.deadlockMinutes || 0) / 60))} Spielstunden`);
  text("last-match", `Letztes Match ${formatRelativeDate(data.coverage.newestMatch)}`);
  const steamLink = byId("steam-profile-link");
  if (profile.profileUrl) steamLink.href = profile.profileUrl;
  else steamLink.hidden = true;
  const footerAuthor = byId("footer-author");
  if (profile.profileUrl) footerAuthor.href = profile.profileUrl;
  text(
    "footer-update-time",
    `Letztes Update ${new Intl.DateTimeFormat(localeCode(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))}`,
  );
}

function showReady(data) {
  state.data = data;
  byId("setup-view").hidden = true;
  byId("dashboard-view").hidden = false;
  renderProfileSummary(data);

  byId("detail-close").addEventListener("click", closeDetail);
  byId("detail-dialog").addEventListener("close", () => {
    state.reviewObserver?.disconnect();
    state.reviewObserver = null;
    document.documentElement.classList.remove("detail-open");
  });
  byId("detail-dialog").addEventListener("click", (event) => {
    if (event.target === byId("detail-dialog")) closeDetail();
  });

  for (const button of document.querySelectorAll("[data-hero-sort]")) {
    button.addEventListener("click", () => {
      state.heroSort = button.dataset.heroSort;
      renderHeroSort();
      renderHeroCards(sortHeroGroups(groupHeroes(selectedMatches()), state.heroSort));
    });
  }

  byId("rank-details-button")?.addEventListener("click", openRankContext);
  byId("coach-button")?.addEventListener("click", openCoach);
  byId("enemy-analysis-button")?.addEventListener("click", openEnemyAnalysis);
  byId("match-archive-button")?.addEventListener("click", openMatchArchive);
  byId("progress-compare-button")?.addEventListener("click", openProgressComparison);
  byId("opponent-search")?.addEventListener("input", (event) => {
    state.opponentQuery = event.target.value.trim();
    state.opponentPage = 1;
    renderOpponents();
  });
  byId("opponent-sort")?.addEventListener("change", (event) => {
    state.opponentSort = event.target.value;
    state.opponentPage = 1;
    renderOpponents();
  });
  byId("opponent-min-matches")?.addEventListener("change", (event) => {
    state.opponentMinMatches = Number(event.target.value);
    state.opponentPage = 1;
    renderOpponents();
  });
  byId("opponent-prev")?.addEventListener("click", () => {
    state.opponentPage = Math.max(1, state.opponentPage - 1);
    renderOpponents();
  });
  byId("opponent-next")?.addEventListener("click", () => {
    state.opponentPage += 1;
    renderOpponents();
  });

  renderDashboard();
  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => drawRankChart(selectedMatches()));
  });
}

function showSetup(message) {
  byId("setup-view").hidden = false;
  byId("dashboard-view").hidden = true;
}

async function init() {
  try {
    const response = await fetch(`./data/dashboard.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.state !== "ready" || !Array.isArray(data.matches) || !data.profile) {
      showSetup(data.setup?.message);
      return;
    }
    state.data = data;
    state.historyPages.clear();
    state.recentMatches = data.matches.slice(0, 12);
    if (data.dataFiles?.recentMatches) {
      try {
        const recentResponse = await fetch(versionedDataUrl(data.dataFiles.recentMatches), { cache: "force-cache" });
        if (!recentResponse.ok) throw new Error(`HTTP ${recentResponse.status}`);
        const recentPayload = await recentResponse.json();
        if (Array.isArray(recentPayload.matches)) state.recentMatches = recentPayload.matches;
      } catch {
        // The compact summary remains usable if the optional detail payload is temporarily unavailable.
      }
    }
    showReady(data);
  } catch {
    showSetup("Daten momentan nicht erreichbar");
  }
}

initLanguage();
init();
