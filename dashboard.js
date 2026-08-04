const state = {
  data: null,
  heroSort: "matches",
};

const HERO_SAMPLE_MIN = 3;
const SESSION_GAP_MS = 90 * 60 * 1000;

const numberFormat = new Intl.NumberFormat("de-DE");
const decimalFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const byId = (id) => document.getElementById(id);

function create(tagName, className, content) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (content != null) element.textContent = String(content);
  return element;
}

function text(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
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
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
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
  text("detail-eyebrow", eyebrow);
  text("detail-title", title);
  text("detail-subtitle", subtitle);
  byId("detail-body").replaceChildren(body);
  const dialog = byId("detail-dialog");
  if (!dialog.open) dialog.showModal();
  document.documentElement.classList.add("detail-open");
}

function closeDetail() {
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
      identity.append(image);
    }
    const copy = create("span");
    copy.append(
      create("strong", "", hero.name),
      create(
        "small",
        "",
        match.startedAt
          ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.startedAt))
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
    button.addEventListener("click", () => openMatchDetail(match));
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
    const comparison = detailSection("Du gegen den API-Benchmark", `${numberFormat.format(benchmark.matches)} globale Hero-Matches als Referenz.`);
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
        create("small", "", `Benchmark ${row.format(row.reference)}`),
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
      create("strong", "", newest ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(newest) : "Datum unbekannt"),
    );
    const timeRange = newest && oldest
      ? `${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(oldest)}–${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(newest)}`
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

function rosterColumn(title, players) {
  const column = create("div", "roster-column");
  column.append(create("h4", "", title));
  const list = create("div", "roster-list");
  for (const player of players) {
    const hero = heroFor(player.heroId);
    const item = create("div", `roster-player${player.isSelf ? " is-self" : ""}`);
    const identity = create("span", "roster-identity");
    if (hero.image) {
      const image = create("img");
      image.src = hero.image;
      image.alt = "";
      identity.append(image);
    }
    const copy = create("span");
    copy.append(create("strong", "", player.isSelf ? `${hero.name} · Du` : hero.name));
    copy.append(create("small", "", `${numberFormat.format(player.netWorth)} Net Worth`));
    identity.append(copy);
    item.append(identity, create("strong", "roster-kda", `${player.kills}/${player.deaths}/${player.assists}`));
    list.append(item);
  }
  column.append(list);
  return column;
}

function buildTimeline(match, type, title, description) {
  const events = match.build
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
    const teams = detailSection("Teamaufstellung", "Dein Hero ist in der eigenen Aufstellung hervorgehoben.");
    const grid = create("div", "roster-grid");
    const ownTeam = match.players.filter((player) => player.team === match.team);
    const enemyTeam = match.players.filter((player) => player.team !== match.team);
    grid.append(rosterColumn("Dein Team", ownTeam), rosterColumn("Gegnerteam", enemyTeam));
    teams.append(grid);
    body.append(teams);
  }

  const itemTimeline = buildTimeline(match, "upgrade", "Item-Build", "Kaufreihenfolge und Zeitpunkte innerhalb des Matches.");
  const abilityTimeline = buildTimeline(match, "ability", "Ability-Reihenfolge", "Zeitliche Reihenfolge deiner Ability-Upgrades.");
  if (itemTimeline) body.append(itemTimeline);
  if (abilityTimeline) body.append(abilityTimeline);

  openDetail({
    eyebrow: "MATCH INTELLIGENCE",
    title: `${hero.name} · #${match.id.slice(-7)}`,
    subtitle: match.startedAt
      ? new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(new Date(match.startedAt))
      : "Datum unbekannt",
    body,
  });
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
    row.addEventListener("click", () => openMatchDetail(match));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMatchDetail(match);
      }
    });

    const matchCell = document.createElement("td");
    const matchId = document.createElement("div");
    matchId.className = "match-id";
    const matchStrong = document.createElement("strong");
    matchStrong.textContent = `#${match.id.slice(-7)}`;
    const matchDate = document.createElement("small");
    matchDate.textContent = match.startedAt
      ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(match.startedAt))
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
      date ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(date) : "—",
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
  renderMatches(matches);
  drawRankChart(matches);
  text(
    "match-coverage",
    `${state.data.coverage.publishedMatches} von ${state.data.coverage.availableMatches} verfügbaren Matches geladen`,
  );
}

function showReady(data) {
  state.data = data;
  byId("setup-view").hidden = true;
  byId("dashboard-view").hidden = false;
  byId("live-state").classList.add("is-live");
  text("live-state-label", "Automatische Updates aktiv");

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

  byId("detail-close").addEventListener("click", closeDetail);
  byId("detail-dialog").addEventListener("close", () => {
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

  text(
    "footer-update",
    `Letztes Update ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))} · Community-Daten`,
  );

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
  text("live-state-label", message || "Steam-Profil fehlt");
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
    showReady(data);
  } catch {
    showSetup("Daten momentan nicht erreichbar");
  }
}

init();
