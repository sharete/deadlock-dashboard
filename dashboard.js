const state = {
  data: null,
  windowSize: 30,
};

const numberFormat = new Intl.NumberFormat("de-DE");
const decimalFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const byId = (id) => document.getElementById(id);

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
  return state.data.matches.slice(0, state.windowSize);
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

function renderHeroCards(groups) {
  const grid = byId("hero-grid");
  grid.replaceChildren();
  for (const [index, group] of groups.slice(0, 6).entries()) {
    const hero = heroFor(group.heroId);
    const card = document.createElement("article");
    card.className = "hero-card";
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
    body.append(kicker, name, stats);
    card.append(visual, body);
    grid.append(card);
  }
}

function renderMatches(matches) {
  const body = byId("match-table-body");
  body.replaceChildren();
  for (const match of matches.slice(0, 12)) {
    const hero = heroFor(match.heroId);
    const row = document.createElement("tr");

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
  renderHeroCards(heroGroups);
  renderMatches(matches);
  drawRankChart(matches);
  text(
    "match-coverage",
    `${state.data.coverage.publishedMatches} von ${state.data.coverage.availableMatches} verfügbaren Matches geladen`,
  );
}

function showReady(data) {
  state.data = data;
  state.windowSize = [30, 60, 100].includes(data.defaultWindow) ? data.defaultWindow : 30;
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
  text(
    "footer-update",
    `Letztes Update ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))} · Community-Daten`,
  );

  for (const button of document.querySelectorAll("[data-window]")) {
    const selected = Number(button.dataset.window) === state.windowSize;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      state.windowSize = Number(button.dataset.window);
      for (const sibling of document.querySelectorAll("[data-window]")) {
        sibling.setAttribute("aria-pressed", String(sibling === button));
      }
      renderDashboard();
    });
  }

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
