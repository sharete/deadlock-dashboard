import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STEAM_ID64_BASE = 76561197960265728n;
const DEADLOCK_APP_ID = 1422450;
const DEFAULT_API_BASE = "https://api.deadlock-api.com";
const root = new URL("../", import.meta.url);

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.trunc(asNumber(value, fallback));
  return Math.max(min, Math.min(max, number));
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
          await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
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
  if (outcome === 5) return "unscored";
  return asNumber(match.match_result, -1) === asNumber(match.player_team, -2)
    ? "win"
    : "loss";
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
    result: matchOutcome(match),
    kills: asNumber(match.player_kills),
    deaths: asNumber(match.player_deaths),
    assists: asNumber(match.player_assists),
    netWorth,
    soulsPerMinute: durationSeconds > 0 ? Math.round((netWorth / durationSeconds) * 60) : 0,
    lastHits: asNumber(match.last_hits),
    denies: asNumber(match.denies),
    rankBadge: match.ranked_display_badge == null ? null : asNumber(match.ranked_display_badge),
    rankDelta: match.ranked_delta == null ? null : asNumber(match.ranked_delta),
  };
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

export function buildDashboardData({
  steamId64,
  profile,
  ownedGames,
  matchHistory,
  heroAssets,
  rankAssets,
  maxMatches = 100,
  defaultWindow = 30,
  timezone = "Europe/Berlin",
  generatedAt = new Date().toISOString(),
}) {
  const accountId = steamId64ToAccountId(steamId64);
  const matches = [...matchHistory]
    .sort((a, b) => asNumber(b.start_time) - asNumber(a.start_time))
    .slice(0, boundedInteger(maxMatches, 100, 30, 100))
    .map(normalizeMatch);

  const usedHeroIds = new Set(matches.map((match) => match.heroId));
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

  return {
    schemaVersion: 1,
    state: "ready",
    generatedAt,
    timezone,
    defaultWindow: boundedInteger(defaultWindow, 30, 30, 100),
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
    ranks,
    matches,
    source: {
      matchData: "Deadlock API community project",
      profileData: "Steam Web API",
      disclaimer: "Deadlock API ist ein Community-Projekt und nicht mit Valve verbunden.",
    },
  };
}

async function main() {
  const config = JSON.parse(await readFile(new URL("config/dashboard.json", root), "utf8"));
  const steamApiKey = String(process.env.STEAM_API_KEY ?? "").trim();
  if (!steamApiKey) {
    throw new Error("Das GitHub Secret STEAM_API_KEY fehlt.");
  }

  if (!String(process.env.STEAM_ID64 ?? "").trim() && !String(config.steamProfile ?? "").trim()) {
    const setupData = {
      schemaVersion: 1,
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
    await writeFile(
      new URL("data/dashboard.json", root),
      `${JSON.stringify(setupData, null, 2)}\n`,
      "utf8",
    );
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

  const [profilePayload, gamesPayload, matchHistory, heroAssets, rankAssets] = await Promise.all([
    fetchJson(profileUrl, { label: "Steam-Profil" }),
    fetchJson(gamesUrl, { label: "Steam-Spielzeit" }),
    fetchJson(`${apiBase}/v1/players/${accountId}/match-history`, {
      label: "Deadlock-Matchverlauf",
      headers: deadlockHeaders,
    }),
    fetchJson(`${apiBase}/v1/assets/heroes?language=german&only_active=true`, {
      label: "Deadlock-Helden",
      headers: deadlockHeaders,
    }),
    fetchJson(`${apiBase}/v1/assets/ranks?language=german`, {
      label: "Deadlock-Ränge",
      headers: deadlockHeaders,
    }),
  ]);

  const profile = profilePayload?.response?.players?.[0];
  if (!profile) throw new Error("Steam hat für die angegebene SteamID64 kein Profil geliefert.");
  if (!Array.isArray(matchHistory)) throw new Error("Der Deadlock-Matchverlauf hat ein ungültiges Format.");
  if (!Array.isArray(heroAssets) || !Array.isArray(rankAssets)) {
    throw new Error("Die Deadlock-Assetdaten haben ein ungültiges Format.");
  }

  const dashboard = buildDashboardData({
    steamId64,
    profile,
    ownedGames: gamesPayload?.response?.games ?? [],
    matchHistory,
    heroAssets,
    rankAssets,
    maxMatches: config.maxMatches,
    defaultWindow: config.defaultWindow,
    timezone: config.timezone,
  });

  await writeFile(
    new URL("data/dashboard.json", root),
    `${JSON.stringify(dashboard, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Dashboard aktualisiert: ${dashboard.profile.name}, ${dashboard.matches.length} Matches veröffentlicht.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Dashboard-Update fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  });
}
