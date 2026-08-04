import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STEAM_ID64_BASE = 76561197960265728n;
const DEADLOCK_APP_ID = 1422450;
const DEFAULT_API_BASE = "https://api.deadlock-api.com";
const SCHEMA_VERSION = 5;
const RECENT_MATCH_LIMIT = 12;
const HISTORY_PAGE_SIZE = 100;
const root = new URL("../", import.meta.url);

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.trunc(asNumber(value, fallback));
  return Math.max(min, Math.min(max, number));
}

function asNumberArray(value) {
  return Array.isArray(value) ? value.map((entry) => asNumber(entry)) : [];
}

function cleanUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function steamId64ToAccountId(value) {
  if (!/^\d{17}$/.test(String(value ?? ""))) {
    throw new Error("Die SteamID64 muss aus genau 17 Ziffern bestehen.");
  }

  const steamId64 = BigInt(value);
  const accountId = steamId64 - STEAM_ID64_BASE;
  if (accountId < 0n || accountId > 4_294_967_295n) {
    throw new Error("Die SteamID64 liegt außerhalb des gültigen Bereichs.");
  }
  return Number(accountId);
}

export function parseSteamProfileReference(value) {
  const reference = String(value ?? "").trim();
  if (!reference) return { type: "missing", value: "" };
  if (/^\d{17}$/.test(reference)) return { type: "steamId64", value: reference };

  let url;
  try {
    url = new URL(reference.includes("://") ? reference : `https://${reference}`);
  } catch {
    return { type: "vanity", value: reference.replace(/^@/, "") };
  }

  if (!/(^|\.)steamcommunity\.com$/i.test(url.hostname)) {
    throw new Error("Das Spielerprofil muss von steamcommunity.com stammen.");
  }

  const profileMatch = url.pathname.match(/^\/profiles\/(\d{17})(?:\/|$)/i);
  if (profileMatch) return { type: "steamId64", value: profileMatch[1] };

  const vanityMatch = url.pathname.match(/^\/id\/([^/]+)(?:\/|$)/i);
  if (vanityMatch) return { type: "vanity", value: decodeURIComponent(vanityMatch[1]) };

  throw new Error("Die Steam-Profil-URL enthält weder eine SteamID64 noch einen Vanity-Namen.");
}

async function fetchJson(url, { label, headers = {}, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "sharete-deadlock-dashboard/1.0",
          ...headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = response.status === 429
            ? Math.min(30_000, Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1_000
              : 3_000 * (attempt + 1))
            : 1_000 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`${label} antwortete mit HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries && error?.name === "AbortError") continue;
      if (attempt < retries && error instanceof TypeError) continue;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`${label} konnte nicht geladen werden.`);
}

async function resolveSteamId64(reference, steamApiKey) {
  if (process.env.STEAM_ID64) return String(process.env.STEAM_ID64).trim();

  const parsed = parseSteamProfileReference(reference);
  if (parsed.type === "steamId64") return parsed.value;
  if (parsed.type === "missing") {
    throw new Error("In config/dashboard.json fehlt die öffentliche Steam-Profil-URL.");
  }

  const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  url.searchParams.set("key", steamApiKey);
  url.searchParams.set("vanityurl", parsed.value);
  const payload = await fetchJson(url, { label: "Steam-Profilauflösung" });
  const steamId64 = payload?.response?.steamid;
  if (!steamId64) {
    throw new Error("Der Vanity-Name konnte keinem Steam-Profil zugeordnet werden.");
  }
  return String(steamId64);
}

function matchOutcome(match) {
  const outcome = asNumber(match.player_match_outcome, 0);
  if (outcome === 1) return "win";
  if (outcome === 2 || outcome === 3 || outcome === 4) return "loss";

  // "Not scored" only describes whether the match affected progression. It
  // still has a winning team and must count towards the visible win/loss
  // record, matching Deadlock's account statistics.
  const matchResult = asNumber(match.match_result, -1);
  const playerTeam = asNumber(match.player_team, -2);
  return matchResult >= 0 && playerTeam >= 0 && matchResult === playerTeam ? "win" : "loss";
}

function matchMode(value) {
  return {
    1: "Unranked",
    2: "Private Lobby",
    3: "Co-op Bot",
    4: "Ranked",
    5: "Server Test",
    6: "Tutorial",
    7: "Hero Labs",
    8: "Calibration",
  }[asNumber(value)] ?? "Unknown";
}

function normalizeBuild(row) {
  const itemIds = asNumberArray(row.build_item_ids);
  const times = asNumberArray(row.build_times_s);
  const soldTimes = asNumberArray(row.build_sold_times_s);
  const upgradeIds = asNumberArray(row.build_upgrade_ids);
  return itemIds.map((itemId, index) => ({
    itemId,
    atSeconds: times[index] ?? 0,
    soldAtSeconds: soldTimes[index] ?? 0,
    upgradeId: upgradeIds[index] ?? 0,
  }));
}

function normalizeTimeline(row) {
  const times = asNumberArray(row.timeline_times_s);
  if (!times.length) return null;
  return {
    times,
    netWorth: asNumberArray(row.timeline_net_worth),
    kills: asNumberArray(row.timeline_kills),
    deaths: asNumberArray(row.timeline_deaths),
    assists: asNumberArray(row.timeline_assists),
    playerDamage: asNumberArray(row.timeline_player_damage),
  };
}

function timelineValueAt(timeline, time, field = "netWorth") {
  if (!timeline?.times?.length || !timeline?.[field]?.length) return 0;
  let value = 0;
  for (let index = 0; index < timeline.times.length; index += 1) {
    if (timeline.times[index] > time) break;
    value = asNumber(timeline[field][index], value);
  }
  return value;
}

function normalizeDeathDetails(row) {
  const times = asNumberArray(row.death_times_s);
  const durations = asNumberArray(row.death_durations_s);
  const timeToKill = asNumberArray(row.death_ttk_s);
  const killerSlots = asNumberArray(row.death_killer_slots);
  return times.map((atSeconds, index) => ({
    atSeconds,
    durationSeconds: durations[index] ?? 0,
    timeToKillSeconds: timeToKill[index] ?? null,
    killerSlot: killerSlots[index] ?? null,
  }));
}

function normalizeObjectives(row) {
  const times = asNumberArray(row.objective_times_s);
  const types = asNumberArray(row.objective_types);
  const teams = asNumberArray(row.objective_teams);
  return times
    .map((atSeconds, index) => ({
      atSeconds,
      type: types[index] ?? -1,
      team: teams[index] ?? -1,
    }))
    .filter((event) => event.atSeconds > 0);
}

function normalizeMidBoss(row) {
  const times = asNumberArray(row.mid_boss_times_s);
  const killedTeams = asNumberArray(row.mid_boss_killed_teams);
  const claimedTeams = asNumberArray(row.mid_boss_claimed_teams);
  return times
    .map((atSeconds, index) => ({
      atSeconds,
      killedByTeam: killedTeams[index] ?? -1,
      claimedByTeam: claimedTeams[index] ?? -1,
    }))
    .filter((event) => event.atSeconds > 0);
}

function normalizeMatch(match) {
  const durationSeconds = Math.max(0, asNumber(match.match_duration_s));
  const netWorth = Math.max(0, asNumber(match.net_worth));
  const startedAt = asNumber(match.start_time);

  return {
    id: String(match.match_id),
    heroId: asNumber(match.hero_id),
    heroLevel: asNumber(match.hero_level),
    startedAt: startedAt > 0 ? new Date(startedAt * 1000).toISOString() : null,
    durationSeconds,
    mode: matchMode(match.match_mode),
    team: asNumber(match.player_team, -1),
    result: matchOutcome(match),
    isScored: asNumber(match.player_match_outcome, 0) !== 5,
    kills: asNumber(match.player_kills),
    deaths: asNumber(match.player_deaths),
    assists: asNumber(match.player_assists),
    netWorth,
    soulsPerMinute: durationSeconds > 0 ? Math.round((netWorth / durationSeconds) * 60) : 0,
    lastHits: asNumber(match.last_hits),
    denies: asNumber(match.denies),
    playerDamage: asNumber(match.player_damage),
    damageTaken: asNumber(match.damage_taken),
    playerHealing: asNumber(match.player_healing),
    damageMitigated: asNumber(match.damage_mitigated),
    bossDamage: asNumber(match.boss_damage),
    creepDamage: asNumber(match.creep_damage),
    shotsHit: asNumber(match.shots_hit),
    shotsMissed: asNumber(match.shots_missed),
    assignedLane: asNumber(match.assigned_lane, 0),
    mvpRank: match.mvp_rank == null ? null : asNumber(match.mvp_rank),
    averageBadges: [
      match.average_badge_team0 == null ? null : asNumber(match.average_badge_team0),
      match.average_badge_team1 == null ? null : asNumber(match.average_badge_team1),
    ],
    timeline: normalizeTimeline(match),
    deathDetails: normalizeDeathDetails(match),
    objectives: normalizeObjectives(match),
    midBoss: normalizeMidBoss(match),
    build: normalizeBuild(match),
    rankBadge: match.ranked_display_badge == null ? null : asNumber(match.ranked_display_badge),
    rankDelta: match.ranked_delta == null ? null : asNumber(match.ranked_delta),
  };
}

export function buildProcessedMatchesUrl(apiBase, accountId) {
  const url = new URL(`${String(apiBase).replace(/\/$/, "")}/v1/sql`);
  url.searchParams.set(
    "query",
    [
      "SELECT",
      "match_id,",
      "toUnixTimestamp(start_time) AS start_time,",
      "duration_s AS match_duration_s,",
      "toInt8(match_mode) AS match_mode,",
      "toInt8(winning_team) AS match_result,",
      "toInt8(team) AS player_team,",
      "hero_id,",
      "player_level AS hero_level,",
      "kills AS player_kills,",
      "deaths AS player_deaths,",
      "assists AS player_assists,",
      "net_worth, last_hits, denies,",
      "max_player_damage AS player_damage,",
      "max_player_damage_taken AS damage_taken,",
      "arrayMax(stats.player_healing) AS player_healing,",
      "arrayMax(stats.damage_mitigated) AS damage_mitigated,",
      "max_boss_damage AS boss_damage,",
      "max_creep_damage AS creep_damage,",
      "max_shots_hit AS shots_hit, max_shots_missed AS shots_missed,",
      "assigned_lane, mvp_rank, average_badge_team0, average_badge_team1,",
      "stats.time_stamp_s AS timeline_times_s, stats.net_worth AS timeline_net_worth,",
      "stats.kills AS timeline_kills, stats.deaths AS timeline_deaths,",
      "stats.assists AS timeline_assists, stats.player_damage AS timeline_player_damage,",
      "death_details.game_time_s AS death_times_s,",
      "death_details.death_duration_s AS death_durations_s,",
      "death_details.time_to_kill_s AS death_ttk_s,",
      "death_details.killer_player_slot AS death_killer_slots,",
      "objectives.destroyed_time_s AS objective_times_s,",
      "arrayMap(x -> toInt8(x), objectives.team_objective) AS objective_types,",
      "arrayMap(x -> toInt8(x), objectives.team) AS objective_teams,",
      "mid_boss.destroyed_time_s AS mid_boss_times_s,",
      "arrayMap(x -> toInt8(x), mid_boss.team_killed) AS mid_boss_killed_teams,",
      "arrayMap(x -> toInt8(x), mid_boss.team_claimed) AS mid_boss_claimed_teams,",
      "items.item_id AS build_item_ids, items.game_time_s AS build_times_s,",
      "items.sold_time_s AS build_sold_times_s, items.upgrade_id AS build_upgrade_ids,",
      "toInt8(player_match_outcome) AS player_match_outcome,",
      "player_rank_initial_display_rank AS ranked_display_badge,",
      "player_rank_desired_progress_change AS ranked_delta",
      "FROM match_player FINAL",
      `WHERE account_id = ${boundedInteger(accountId, 0, 0, 4_294_967_295)}`,
      "ORDER BY start_time DESC",
    ].join(" "),
  );
  return url;
}

export function buildMatchPlayersUrl(apiBase, matchIds) {
  const ids = [...new Set(matchIds)]
    .map((matchId) => boundedInteger(matchId, 0, 1, Number.MAX_SAFE_INTEGER))
    .filter(Boolean)
    .slice(0, 12);
  const url = new URL(`${String(apiBase).replace(/\/$/, "")}/v1/sql`);
  url.searchParams.set(
    "query",
    [
      "SELECT match_id, account_id, toInt8(team) AS team, hero_id,",
      "kills, deaths, assists, net_worth, last_hits, denies,",
      "max_player_damage AS player_damage, max_player_damage_taken AS damage_taken,",
      "arrayMax(stats.player_healing) AS player_healing,",
      "arrayMax(stats.damage_mitigated) AS damage_mitigated,",
      "max_boss_damage AS boss_damage, max_creep_damage AS creep_damage,",
      "max_shots_hit AS shots_hit, max_shots_missed AS shots_missed,",
      "assigned_lane, mvp_rank,",
      "stats.time_stamp_s AS timeline_times_s, stats.net_worth AS timeline_net_worth,",
      "death_details.game_time_s AS death_times_s,",
      "death_details.death_duration_s AS death_durations_s,",
      "death_details.time_to_kill_s AS death_ttk_s,",
      "death_details.killer_player_slot AS death_killer_slots,",
      "items.item_id AS build_item_ids, items.game_time_s AS build_times_s,",
      "items.sold_time_s AS build_sold_times_s, items.upgrade_id AS build_upgrade_ids",
      "FROM match_player FINAL",
      `WHERE match_id IN (${ids.length ? ids.join(",") : "0"})`,
      "ORDER BY match_id DESC, team ASC, net_worth DESC",
    ].join(" "),
  );
  return url;
}

export function buildBasicMatchPlayersUrl(apiBase, matchIds) {
  const ids = [...new Set(matchIds)]
    .map((matchId) => boundedInteger(matchId, 0, 1, Number.MAX_SAFE_INTEGER))
    .filter(Boolean)
    .slice(0, 12);
  const url = new URL(`${String(apiBase).replace(/\/$/, "")}/v1/sql`);
  url.searchParams.set(
    "query",
    [
      "SELECT match_id, account_id, toInt8(team) AS team, hero_id,",
      "kills, deaths, assists, net_worth, last_hits, denies, assigned_lane, mvp_rank,",
      "max_player_damage AS player_damage, max_player_damage_taken AS damage_taken,",
      "arrayMax(stats.player_healing) AS player_healing,",
      "arrayMax(stats.damage_mitigated) AS damage_mitigated,",
      "max_boss_damage AS boss_damage, max_creep_damage AS creep_damage,",
      "max_shots_hit AS shots_hit, max_shots_missed AS shots_missed,",
      "items.item_id AS build_item_ids, items.game_time_s AS build_times_s,",
      "items.sold_time_s AS build_sold_times_s, items.upgrade_id AS build_upgrade_ids",
      "FROM match_player FINAL",
      `WHERE match_id IN (${ids.length ? ids.join(",") : "0"})`,
      "ORDER BY match_id DESC, team ASC, net_worth DESC",
    ].join(" "),
  );
  return url;
}

export function buildMatchMetadataUrl(apiBase, matchIds) {
  const ids = [...new Set(matchIds)]
    .map((matchId) => boundedInteger(matchId, 0, 1, Number.MAX_SAFE_INTEGER))
    .filter(Boolean)
    .slice(0, 12);
  const url = new URL(`${String(apiBase).replace(/\/$/, "")}/v1/matches/metadata`);
  for (const matchId of ids) url.searchParams.append("match_ids", String(matchId));
  for (const [name, value] of Object.entries({
    include_info: "false",
    include_more_info: "false",
    include_objectives: "false",
    include_mid_boss: "false",
    include_player_info: "true",
    include_player_kda: "true",
    include_player_items: "true",
    include_player_stats: "true",
    include_player_final_stats: "false",
    include_player_death_details: "false",
  })) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set("limit", String(Math.max(1, ids.length)));
  return url;
}

function enumTeamNumber(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const match = String(value ?? "").match(/Team(\d+)/i);
  return match ? asNumber(match[1], -1) : -1;
}

export function flattenMatchMetadataPlayers(metadata) {
  if (!Array.isArray(metadata)) return [];
  return metadata.flatMap((match) => (Array.isArray(match.players) ? match.players : []).map((player) => {
    const stats = Array.isArray(player.stats) ? player.stats : [];
    const final = player.final_stats ?? stats.at(-1) ?? {};
    const items = Array.isArray(player.items) ? player.items : [];
    return {
      match_id: match.match_id,
      account_id: player.account_id,
      team: enumTeamNumber(player.team),
      hero_id: player.hero_id,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      net_worth: player.net_worth,
      last_hits: player.last_hits,
      denies: player.denies,
      assigned_lane: player.assigned_lane,
      mvp_rank: player.mvp_rank,
      player_damage: final.player_damage,
      damage_taken: final.player_damage_taken,
      player_healing: final.player_healing,
      damage_mitigated: final.damage_mitigated,
      boss_damage: final.boss_damage,
      creep_damage: final.creep_damage,
      shots_hit: final.shots_hit,
      shots_missed: final.shots_missed,
      timeline_times_s: stats.map((point) => point.time_stamp_s),
      timeline_net_worth: stats.map((point) => point.net_worth),
      build_item_ids: items.map((item) => item.item_id),
      build_times_s: items.map((item) => item.game_time_s),
      build_sold_times_s: items.map((item) => item.sold_time_s),
      build_upgrade_ids: items.map((item) => item.upgrade_id),
    };
  }));
}

export function buildHeroMatchupsUrl(apiBase, accountId) {
  const url = new URL(`${String(apiBase).replace(/\/$/, "")}/v1/sql`);
  url.searchParams.set(
    "query",
    [
      "SELECT self.hero_id AS hero_id, enemy.hero_id AS enemy_hero_id,",
      "count() AS matches_played, countIf(self.team = self.winning_team) AS wins",
      "FROM match_player AS self FINAL",
      "INNER JOIN match_player AS enemy FINAL",
      "ON self.match_id = enemy.match_id AND self.team != enemy.team",
      `WHERE self.account_id = ${boundedInteger(accountId, 0, 0, 4_294_967_295)}`,
      "GROUP BY self.hero_id, enemy.hero_id",
      "ORDER BY matches_played DESC",
    ].join(" "),
  );
  return url;
}

export function mergeMatchSources(matchHistory, processedMatches) {
  const byMatchId = new Map();

  for (const match of processedMatches) {
    byMatchId.set(String(match.match_id), match);
  }

  // The player-history endpoint contains useful rank fields when available.
  // Prefer those fields while retaining processed matches that are not present
  // in the history cache yet.
  for (const match of matchHistory) {
    const key = String(match.match_id);
    byMatchId.set(key, { ...byMatchId.get(key), ...match });
  }

  return [...byMatchId.values()];
}

function heroAccentColor(colors) {
  if (typeof colors?.style_hex === "string" && /^#[0-9a-f]{6}$/i.test(colors.style_hex)) {
    return colors.style_hex;
  }
  if (Array.isArray(colors?.ui) && colors.ui.length === 3) {
    return `#${colors.ui
      .map((channel) => boundedInteger(channel, 0, 0, 255).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return null;
}

export function buildHeroCoach(matches, buildAssets) {
  const coaches = {};
  const matchesByHero = new Map();
  for (const match of matches) {
    const heroMatches = matchesByHero.get(match.heroId) ?? [];
    heroMatches.push(match);
    matchesByHero.set(match.heroId, heroMatches);
  }

  for (const [heroId, heroMatches] of matchesByHero) {
    const itemStats = new Map();
    const abilityOrders = new Map();

    for (const match of heroMatches) {
      const firstItems = new Map();
      const firstAbilities = [];
      const seenAbilities = new Set();
      for (const event of [...(match.build ?? [])].sort((a, b) => a.atSeconds - b.atSeconds)) {
        const asset = buildAssets[String(event.itemId)];
        if (asset?.type === "upgrade" && !firstItems.has(event.itemId)) {
          firstItems.set(event.itemId, event);
        }
        if (asset?.type === "ability" && !seenAbilities.has(event.itemId)) {
          seenAbilities.add(event.itemId);
          firstAbilities.push(event.itemId);
        }
      }

      for (const [itemId, event] of firstItems) {
        const current = itemStats.get(itemId) ?? {
          itemId,
          matches: 0,
          wins: 0,
          totalBuySeconds: 0,
          winBuySeconds: 0,
          lossBuySeconds: 0,
          winBuys: 0,
          lossBuys: 0,
        };
        current.matches += 1;
        current.wins += match.result === "win" ? 1 : 0;
        current.totalBuySeconds += Math.max(0, asNumber(event.atSeconds));
        if (match.result === "win") {
          current.winBuys += 1;
          current.winBuySeconds += Math.max(0, asNumber(event.atSeconds));
        } else if (match.result === "loss") {
          current.lossBuys += 1;
          current.lossBuySeconds += Math.max(0, asNumber(event.atSeconds));
        }
        itemStats.set(itemId, current);
      }

      if (firstAbilities.length) {
        const abilityIds = firstAbilities.slice(0, 4);
        const key = abilityIds.join("-");
        const current = abilityOrders.get(key) ?? { abilityIds, matches: 0, wins: 0 };
        current.matches += 1;
        current.wins += match.result === "win" ? 1 : 0;
        abilityOrders.set(key, current);
      }
    }

    const items = [...itemStats.values()]
      .map((item) => ({
        itemId: item.itemId,
        matches: item.matches,
        wins: item.wins,
        winrate: item.matches ? (item.wins / item.matches) * 100 : 0,
        usageRate: heroMatches.length ? (item.matches / heroMatches.length) * 100 : 0,
        avgBuySeconds: item.matches ? item.totalBuySeconds / item.matches : 0,
        avgWinBuySeconds: item.winBuys ? item.winBuySeconds / item.winBuys : null,
        avgLossBuySeconds: item.lossBuys ? item.lossBuySeconds / item.lossBuys : null,
      }))
      .sort((a, b) => b.matches - a.matches || b.winrate - a.winrate)
      .slice(0, 12);
    const orders = [...abilityOrders.values()]
      .map((order) => ({
        ...order,
        winrate: order.matches ? (order.wins / order.matches) * 100 : 0,
      }))
      .sort((a, b) => b.matches - a.matches || b.winrate - a.winrate)
      .slice(0, 4);

    coaches[String(heroId)] = {
      matches: heroMatches.length,
      baselineWinrate:
        heroMatches.filter((match) => match.result === "win").length / Math.max(1, heroMatches.length) * 100,
      items,
      abilityOrders: orders,
    };
  }
  return coaches;
}

export function buildRankContext(rankSnapshot, badgeDistribution, matches) {
  const latestMatchBadge = matches.find((match) => match.rankBadge != null)?.rankBadge ?? null;
  const currentBadge = asNumber(rankSnapshot?.badge, latestMatchBadge ?? 0) || latestMatchBadge;
  const distribution = Array.isArray(badgeDistribution)
    ? badgeDistribution
        .map((row) => ({
          badge: asNumber(row.badge_level),
          players: Math.max(0, asNumber(row.unique_players)),
        }))
        .filter((row) => row.badge > 0 && row.players > 0)
    : [];
  const totalPlayers = distribution.reduce((sum, row) => sum + row.players, 0);
  const playersBelow = currentBadge == null
    ? 0
    : distribution.filter((row) => row.badge < currentBadge).reduce((sum, row) => sum + row.players, 0);
  const byTier = new Map();
  for (const row of distribution) {
    const tier = Math.floor(row.badge / 10);
    byTier.set(tier, (byTier.get(tier) ?? 0) + row.players);
  }
  const rankedMatches = matches.filter((match) => match.rankBadge != null);
  const peakBadge = rankedMatches.reduce(
    (peak, match) => Math.max(peak, asNumber(match.rankBadge)),
    currentBadge ?? 0,
  ) || null;
  const recentRanked = rankedMatches.slice(0, 10);
  const badgeScore = (badge) => {
    const tier = Math.floor(asNumber(badge) / 10);
    const subrank = asNumber(badge) % 10;
    return tier * 6 + Math.max(0, subrank - 1);
  };
  const rankTrend = recentRanked.length >= 2
    ? badgeScore(recentRanked[0].rankBadge) - badgeScore(recentRanked.at(-1).rankBadge)
    : null;

  return {
    currentBadge: currentBadge ?? null,
    peakBadge,
    rank: asNumber(rankSnapshot?.rank, currentBadge == null ? 0 : Math.floor(currentBadge / 10)),
    subrank: asNumber(rankSnapshot?.subrank, currentBadge == null ? 0 : currentBadge % 10),
    percentile: currentBadge != null && totalPlayers ? (playersBelow / totalPlayers) * 100 : null,
    population: totalPlayers,
    windowDays: 30,
    rankedMatches: rankedMatches.length,
    recentTrend: rankTrend,
    distribution: [...byTier.entries()]
      .map(([tier, players]) => ({
        tier,
        players,
        share: totalPlayers ? (players / totalPlayers) * 100 : 0,
      }))
      .sort((a, b) => a.tier - b.tier),
  };
}

export function buildTeamEconomy(players) {
  const timelinePlayers = players.filter((player) => player.timeline?.times?.length);
  if (!timelinePlayers.length) return null;
  const reference = [...timelinePlayers]
    .sort((a, b) => b.timeline.times.length - a.timeline.times.length)[0].timeline.times;
  const times = [...new Set(reference.map((time) => asNumber(time)).filter((time) => time > 0))]
    .sort((a, b) => a - b);
  const valueAt = (timeline, time) => {
    return timelineValueAt(timeline, time);
  };
  const team0 = times.map((time) => timelinePlayers
    .filter((player) => player.team === 0)
    .reduce((sum, player) => sum + valueAt(player.timeline, time), 0));
  const team1 = times.map((time) => timelinePlayers
    .filter((player) => player.team === 1)
    .reduce((sum, player) => sum + valueAt(player.timeline, time), 0));
  return team0.some(Boolean) && team1.some(Boolean) ? { times, team0, team1 } : null;
}

export function buildDashboardData({
  steamId64,
  profile,
  ownedGames,
  matchHistory,
  matchPlayers = [],
  heroAssets,
  itemAssets = [],
  heroStats = [],
  rankAssets,
  rankSnapshot = null,
  badgeDistribution = [],
  heroMatchups = [],
  timezone = "Europe/Berlin",
  generatedAt = new Date().toISOString(),
}) {
  const accountId = steamId64ToAccountId(steamId64);
  const matches = [...matchHistory]
    .sort((a, b) => asNumber(b.start_time) - asNumber(a.start_time))
    .map(normalizeMatch);

  const playersByMatch = new Map();
  for (const player of matchPlayers) {
    const matchId = String(player.match_id);
    const roster = playersByMatch.get(matchId) ?? [];
    const timeline = normalizeTimeline(player);
    roster.push({
      accountId: asNumber(player.account_id),
      heroId: asNumber(player.hero_id),
      team: asNumber(player.team, -1),
      kills: asNumber(player.kills),
      deaths: asNumber(player.deaths),
      assists: asNumber(player.assists),
      netWorth: asNumber(player.net_worth),
      lastHits: asNumber(player.last_hits),
      denies: asNumber(player.denies),
      playerDamage: asNumber(player.player_damage),
      damageTaken: asNumber(player.damage_taken),
      playerHealing: asNumber(player.player_healing),
      damageMitigated: asNumber(player.damage_mitigated),
      bossDamage: asNumber(player.boss_damage),
      creepDamage: asNumber(player.creep_damage),
      shotsHit: asNumber(player.shots_hit),
      shotsMissed: asNumber(player.shots_missed),
      assignedLane: asNumber(player.assigned_lane, 0),
      mvpRank: player.mvp_rank == null ? null : asNumber(player.mvp_rank),
      netWorthAt12: timelineValueAt(timeline, 12 * 60),
      timeline,
      deathDetails: normalizeDeathDetails(player),
      build: normalizeBuild(player),
      isSelf: asNumber(player.account_id) === accountId,
    });
    playersByMatch.set(matchId, roster);
  }
  for (const match of matches) {
    const roster = playersByMatch.get(match.id) ?? [];
    match.teamEconomy = buildTeamEconomy(roster);
    match.players = roster.map((player) => {
      const { timeline, ...publishedPlayer } = player;
      return publishedPlayer;
    });
  }

  const usedHeroIds = new Set([
    ...matches.map((match) => match.heroId),
    ...matchPlayers.map((player) => asNumber(player.hero_id)),
    ...heroMatchups.flatMap((row) => [asNumber(row.hero_id), asNumber(row.enemy_hero_id)]),
  ]);
  const heroes = Object.fromEntries(
    heroAssets
      .filter((hero) => usedHeroIds.has(asNumber(hero.id)))
      .map((hero) => [
        String(hero.id),
        {
          id: asNumber(hero.id),
          name: String(hero.name || hero.class_name || `Hero ${hero.id}`),
          image:
            cleanUrl(hero.images?.icon_hero_card_webp) ??
            cleanUrl(hero.images?.icon_hero_card) ??
            cleanUrl(hero.images?.icon_image_small_webp) ??
            cleanUrl(hero.images?.icon_image_small),
          color: heroAccentColor(hero.colors),
        },
      ]),
  );

  const usedBuildAssetIds = new Set(
    [
      ...matches.flatMap((match) => match.build.map((event) => event.itemId)),
      ...[...playersByMatch.values()].flatMap((players) =>
        players.flatMap((player) => player.build.map((event) => event.itemId)),
      ),
    ],
  );
  const buildAssets = Object.fromEntries(
    itemAssets
      .filter((item) => usedBuildAssetIds.has(asNumber(item.id)))
      .map((item) => [
        String(item.id),
        {
          id: asNumber(item.id),
          name: String(item.name || item.class_name || `Item ${item.id}`),
          type: String(item.type || "unknown"),
          image:
            cleanUrl(item.shop_image_webp) ??
            cleanUrl(item.image_webp) ??
            cleanUrl(item.shop_image) ??
            cleanUrl(item.image),
          tier: item.item_tier == null ? null : asNumber(item.item_tier),
          slot: typeof item.item_slot_type === "string" ? item.item_slot_type : null,
          cost: item.cost == null ? null : asNumber(item.cost),
        },
      ]),
  );

  const benchmarkTotals = new Map();
  for (const row of heroStats) {
    const heroId = asNumber(row.hero_id);
    if (!usedHeroIds.has(heroId)) continue;
    const total = benchmarkTotals.get(heroId) ?? {
      matches: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      netWorth: 0,
      playerDamage: 0,
    };
    total.matches += asNumber(row.matches);
    total.wins += asNumber(row.wins);
    total.kills += asNumber(row.total_kills);
    total.deaths += asNumber(row.total_deaths);
    total.assists += asNumber(row.total_assists);
    total.netWorth += asNumber(row.total_net_worth);
    total.playerDamage += asNumber(row.total_player_damage);
    benchmarkTotals.set(heroId, total);
  }
  const heroBenchmarks = Object.fromEntries(
    [...benchmarkTotals.entries()].map(([heroId, total]) => [
      String(heroId),
      {
        matches: total.matches,
        winrate: total.matches ? (total.wins / total.matches) * 100 : 0,
        kda: (total.kills + total.assists) / Math.max(1, total.deaths),
        avgNetWorth: total.netWorth / Math.max(1, total.matches),
        avgPlayerDamage: total.playerDamage / Math.max(1, total.matches),
      },
    ]),
  );

  const ranks = Object.fromEntries(
    rankAssets.map((rank) => [
      String(rank.tier),
      {
        tier: asNumber(rank.tier),
        name: String(rank.name || `Tier ${rank.tier}`),
        color: typeof rank.color === "string" ? rank.color : null,
        image:
          cleanUrl(rank.images?.large_webp) ??
          cleanUrl(rank.images?.large) ??
          cleanUrl(rank.images?.small_webp) ??
          cleanUrl(rank.images?.small),
      },
    ]),
  );

  const deadlockGame = ownedGames.find((game) => asNumber(game.appid) === DEADLOCK_APP_ID);
  const newestMatch = matches.find((match) => match.startedAt)?.startedAt ?? null;
  const matchupData = heroMatchups
    .map((row) => {
      const played = Math.max(0, asNumber(row.matches_played));
      const wins = Math.max(0, asNumber(row.wins));
      return {
        heroId: asNumber(row.hero_id),
        enemyHeroId: asNumber(row.enemy_hero_id),
        matches: played,
        wins,
        winrate: played ? (wins / played) * 100 : 0,
      };
    })
    .filter((row) => row.matches > 0 && row.heroId > 0 && row.enemyHeroId > 0);
  const heroCoach = buildHeroCoach(matches, buildAssets);
  const rankContext = buildRankContext(rankSnapshot, badgeDistribution, matches);

  return {
    schemaVersion: SCHEMA_VERSION,
    state: "ready",
    generatedAt,
    timezone,
    coverage: {
      availableMatches: matchHistory.length,
      publishedMatches: matches.length,
      newestMatch,
    },
    profile: {
      name: String(profile.personaname || "Steam Player"),
      avatar: cleanUrl(profile.avatarfull) ?? cleanUrl(profile.avatarmedium),
      profileUrl: cleanUrl(profile.profileurl),
      countryCode: typeof profile.loccountrycode === "string" ? profile.loccountrycode : null,
      accountId,
      deadlockMinutes: asNumber(deadlockGame?.playtime_forever),
      lastOnlineAt:
        asNumber(profile.lastlogoff) > 0
          ? new Date(asNumber(profile.lastlogoff) * 1000).toISOString()
          : null,
    },
    heroes,
    buildAssets,
    heroBenchmarks,
    heroCoach,
    matchups: matchupData,
    rankContext,
    ranks,
    matches,
    source: {
      matchData: "Deadlock API community project",
      profileData: "Steam Web API",
      disclaimer: "Deadlock API ist ein Community-Projekt und nicht mit Valve verbunden.",
    },
  };
}

function historyFileName(page) {
  return `page-${String(page).padStart(4, "0")}.json`;
}

function matchWithoutRoster(match) {
  const { players, ...historyMatch } = match;
  return historyMatch;
}

function compactMatch(match, historyPage) {
  const {
    build,
    players,
    timeline,
    deathDetails,
    objectives,
    midBoss,
    teamEconomy,
    assignedLane,
    mvpRank,
    averageBadges,
    ...summaryMatch
  } = match;
  return { ...summaryMatch, historyPage };
}

export function buildPublishedDataFiles(
  dashboard,
  { recentLimit = RECENT_MATCH_LIMIT, pageSize = HISTORY_PAGE_SIZE } = {},
) {
  const boundedRecentLimit = boundedInteger(recentLimit, RECENT_MATCH_LIMIT, 1, 50);
  const boundedPageSize = boundedInteger(pageSize, HISTORY_PAGE_SIZE, 25, 250);
  const matches = Array.isArray(dashboard.matches) ? dashboard.matches : [];
  const historyPages = [];
  const historyManifestPages = [];

  for (let offset = 0; offset < matches.length; offset += boundedPageSize) {
    const page = Math.floor(offset / boundedPageSize) + 1;
    const pageMatches = matches.slice(offset, offset + boundedPageSize).map(matchWithoutRoster);
    const fileName = historyFileName(page);
    historyPages.push({
      fileName,
      data: {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: dashboard.generatedAt,
        page,
        matches: pageMatches,
      },
    });
    historyManifestPages.push({
      page,
      file: `./${fileName}`,
      count: pageMatches.length,
      newestMatch: pageMatches[0]?.startedAt ?? null,
      oldestMatch: pageMatches.at(-1)?.startedAt ?? null,
    });
  }

  const summaryMatches = matches.map((match, index) =>
    compactMatch(match, Math.floor(index / boundedPageSize) + 1),
  );
  const coreDashboard = {
    ...dashboard,
    schemaVersion: SCHEMA_VERSION,
    matches: summaryMatches,
    dataFiles: {
      recentMatches: "./data/recent-matches.json",
      historyIndex: "./data/history/index.json",
      historyPagePattern: "./data/history/page-{page}.json",
    },
  };

  return {
    dashboard: coreDashboard,
    recentMatches: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: dashboard.generatedAt,
      matches: matches.slice(0, boundedRecentLimit),
    },
    historyIndex: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: dashboard.generatedAt,
      totalMatches: matches.length,
      pageSize: boundedPageSize,
      pages: historyManifestPages,
    },
    historyPages,
  };
}

async function writeJson(url, value) {
  await writeFile(url, `${JSON.stringify(value)}\n`, "utf8");
}

async function main() {
  const config = JSON.parse(await readFile(new URL("config/dashboard.json", root), "utf8"));
  const steamApiKey = String(process.env.STEAM_API_KEY ?? "").trim();
  if (!steamApiKey) {
    throw new Error("Das GitHub Secret STEAM_API_KEY fehlt.");
  }

  if (!String(process.env.STEAM_ID64 ?? "").trim() && !String(config.steamProfile ?? "").trim()) {
    const setupData = {
      schemaVersion: SCHEMA_VERSION,
      state: "setup",
      generatedAt: new Date().toISOString(),
      profile: null,
      matches: [],
      heroes: {},
      ranks: {},
      setup: {
        message: "Steam-Profil noch nicht zugeordnet.",
        completed: ["hosting", "steamApiKey"],
        missing: ["steamProfile", "matchData"],
      },
    };
    await writeJson(new URL("data/dashboard.json", root), setupData);
    console.log("Setup-Dashboard veröffentlicht: Steam-Profil fehlt noch.");
    return;
  }

  const steamId64 = await resolveSteamId64(config.steamProfile, steamApiKey);
  const accountId = steamId64ToAccountId(steamId64);
  const apiBase = String(process.env.DEADLOCK_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");

  const profileUrl = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  profileUrl.searchParams.set("key", steamApiKey);
  profileUrl.searchParams.set("steamids", steamId64);

  const gamesUrl = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
  gamesUrl.searchParams.set("key", steamApiKey);
  gamesUrl.searchParams.set("steamid", steamId64);
  gamesUrl.searchParams.set("include_appinfo", "false");
  gamesUrl.searchParams.set("include_played_free_games", "true");
  gamesUrl.searchParams.set("appids_filter[0]", String(DEADLOCK_APP_ID));

  const deadlockHeaders = process.env.DEADLOCK_API_KEY
    ? { "X-API-Key": process.env.DEADLOCK_API_KEY }
    : {};

  const processedMatchesUrl = buildProcessedMatchesUrl(apiBase, accountId);
  const heroMatchupsUrl = buildHeroMatchupsUrl(apiBase, accountId);
  const badgeDistributionUrl = new URL(`${apiBase}/v1/analytics/badge-distribution`);
  badgeDistributionUrl.searchParams.set(
    "min_unix_timestamp",
    String(Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60),
  );

  const [
    profilePayload,
    gamesPayload,
    matchHistory,
    processedMatches,
    heroAssets,
    itemAssets,
    heroStats,
    rankAssets,
    rankSnapshot,
    badgeDistribution,
    heroMatchups,
  ] = await Promise.all([
    fetchJson(profileUrl, { label: "Steam-Profil" }),
    fetchJson(gamesUrl, { label: "Steam-Spielzeit" }),
    fetchJson(`${apiBase}/v1/players/${accountId}/match-history`, {
      label: "Deadlock-Matchverlauf",
      headers: deadlockHeaders,
    }),
    fetchJson(processedMatchesUrl, {
      label: "Verarbeitete Deadlock-Matches",
      headers: deadlockHeaders,
    }).catch((error) => {
      console.warn(`Direkte Matchabfrage nicht verfügbar: ${error.message}`);
      return [];
    }),
    fetchJson(`${apiBase}/v1/assets/heroes?language=german&only_active=true`, {
      label: "Deadlock-Helden",
      headers: deadlockHeaders,
    }),
    fetchJson(`${apiBase}/v1/assets/items?language=german`, {
      label: "Deadlock-Items und Fähigkeiten",
      headers: deadlockHeaders,
    }),
    fetchJson(`${apiBase}/v1/analytics/hero-stats?min_matches=20`, {
      label: "Globale Deadlock-Hero-Statistiken",
      headers: deadlockHeaders,
    }).catch((error) => {
      console.warn(`Hero-Vergleichswerte nicht verfügbar: ${error.message}`);
      return [];
    }),
    fetchJson(`${apiBase}/v1/assets/ranks?language=german`, {
      label: "Deadlock-Ränge",
      headers: deadlockHeaders,
    }),
    fetchJson(`${apiBase}/v1/players/${accountId}/rank`, {
      label: "Aktueller Deadlock-Rang",
      headers: deadlockHeaders,
    }).catch((error) => {
      console.warn(`Aktueller Rang nicht verfügbar: ${error.message}`);
      return null;
    }),
    fetchJson(badgeDistributionUrl, {
      label: "Deadlock-Rangverteilung",
      headers: deadlockHeaders,
    }).catch((error) => {
      console.warn(`Rangverteilung nicht verfügbar: ${error.message}`);
      return [];
    }),
    fetchJson(heroMatchupsUrl, {
      label: "Persönliche Gegneranalyse",
      headers: deadlockHeaders,
    }).catch((error) => {
      console.warn(`Gegneranalyse nicht verfügbar: ${error.message}`);
      return [];
    }),
  ]);

  const profile = profilePayload?.response?.players?.[0];
  if (!profile) throw new Error("Steam hat für die angegebene SteamID64 kein Profil geliefert.");
  if (!Array.isArray(matchHistory)) throw new Error("Der Deadlock-Matchverlauf hat ein ungültiges Format.");
  if (!Array.isArray(processedMatches)) {
    throw new Error("Die verarbeiteten Deadlock-Matches haben ein ungültiges Format.");
  }
  if (!Array.isArray(heroAssets) || !Array.isArray(itemAssets) || !Array.isArray(rankAssets)) {
    throw new Error("Die Deadlock-Assetdaten haben ein ungültiges Format.");
  }
  if (!Array.isArray(heroStats)) throw new Error("Die Hero-Vergleichswerte haben ein ungültiges Format.");

  if (!Array.isArray(badgeDistribution) || !Array.isArray(heroMatchups)) {
    throw new Error("Die erweiterten Analysewerte haben ein ungültiges Format.");
  }

  const currentMatchHistory = mergeMatchSources(matchHistory, processedMatches);
  const rosterMatchIds = [...currentMatchHistory]
    .sort((a, b) => asNumber(b.start_time) - asNumber(a.start_time))
    .slice(0, 12)
    .map((match) => match.match_id);
  let matchPlayers = await fetchJson(buildMatchPlayersUrl(apiBase, rosterMatchIds), {
    label: "Teamaufstellungen der letzten Matches",
    headers: deadlockHeaders,
    retries: 4,
  }).catch((error) => {
    console.warn(`Erweiterte Teamaufstellungen nicht verfügbar: ${error.message}`);
    return [];
  });
  if (!Array.isArray(matchPlayers) || !matchPlayers.length) {
    matchPlayers = await fetchJson(buildBasicMatchPlayersUrl(apiBase, rosterMatchIds), {
      label: "Basis-Teamaufstellungen der letzten Matches",
      headers: deadlockHeaders,
      retries: 4,
    }).catch((error) => {
      console.warn(`Basis-Teamaufstellungen nicht verfügbar: ${error.message}`);
      return [];
    });
  }
  if (!Array.isArray(matchPlayers) || !matchPlayers.length) {
    const metadata = await fetchJson(buildMatchMetadataUrl(apiBase, rosterMatchIds), {
      label: "Match-Metadaten der letzten Matches",
      headers: deadlockHeaders,
      retries: 4,
    }).catch((error) => {
      console.warn(`Match-Metadaten nicht verfügbar: ${error.message}`);
      return [];
    });
    matchPlayers = flattenMatchMetadataPlayers(metadata);
  }
  if (!Array.isArray(matchPlayers)) {
    throw new Error("Die Teamaufstellungen haben ein ungültiges Format.");
  }

  const dashboard = buildDashboardData({
    steamId64,
    profile,
    ownedGames: gamesPayload?.response?.games ?? [],
    matchHistory: currentMatchHistory,
    matchPlayers,
    heroAssets,
    itemAssets,
    heroStats,
    rankAssets,
    rankSnapshot,
    badgeDistribution,
    heroMatchups,
    timezone: config.timezone,
  });

  const published = buildPublishedDataFiles(dashboard);
  const historyDirectory = new URL("data/history/", root);
  await rm(historyDirectory, { recursive: true, force: true });
  await mkdir(historyDirectory, { recursive: true });
  await Promise.all([
    writeJson(new URL("data/dashboard.json", root), published.dashboard),
    writeJson(new URL("data/recent-matches.json", root), published.recentMatches),
    writeJson(new URL("data/history/index.json", root), published.historyIndex),
    ...published.historyPages.map((page) =>
      writeJson(new URL(`data/history/${page.fileName}`, root), page.data),
    ),
  ]);

  console.log(
    `Dashboard aktualisiert: ${dashboard.profile.name}, ${dashboard.matches.length} Matches in ${published.historyPages.length} Historienpaketen veröffentlicht.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Dashboard-Update fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  });
}
