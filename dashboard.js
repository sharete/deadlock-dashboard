const state = {
  data: null,
  heroSort: "matches",
  recentMatches: [],
  historyPages: new Map(),
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
    const item = create("button", `roster-player${player.isSelf ? " is-self" : ""}`);
    item.type = "button";
    item.setAttribute("aria-pressed", "false");
    item.setAttribute("aria-label", `Build und Werte von ${hero.name} anzeigen`);
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
    item.append(identity, create("strong", "roster-kda", `${player.kills}/${player.deaths}/${player.assists}`));
    item.addEventListener("click", () => onSelect(player, item));
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
  header.append(identity, create("span", "roster-detail-hint", "Spieler wechseln: anderen Hero anklicken"));
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
    const teams = detailSection("Teamaufstellung", "Hero anklicken, um dessen vollständigen Build und Performance-Werte zu öffnen.");
    const grid = create("div", "roster-grid");
    const playerDetail = create("div", "roster-player-detail");
    playerDetail.append(create("p", "roster-player-prompt", "Wähle einen Hero aus der Teamaufstellung aus."));
    const ownTeam = match.players.filter((player) => player.team === match.team);
    const enemyTeam = match.players.filter((player) => player.team !== match.team);
    const selectPlayer = (player, button) => {
      for (const sibling of grid.querySelectorAll(".roster-player")) {
        sibling.classList.toggle("is-selected", sibling === button);
        sibling.setAttribute("aria-pressed", String(sibling === button));
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
  renderMatches(state.recentMatches.length ? state.recentMatches : matches.slice(0, 12));
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

  byId("rank-details-button")?.addEventListener("click", openRankContext);
  byId("coach-button")?.addEventListener("click", openCoach);
  byId("enemy-analysis-button")?.addEventListener("click", openEnemyAnalysis);
  byId("match-archive-button")?.addEventListener("click", openMatchArchive);

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

init();
