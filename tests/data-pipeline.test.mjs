import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardData,
  buildMatchPlayersUrl,
  buildProcessedMatchesUrl,
  mergeMatchSources,
  parseSteamProfileReference,
  steamId64ToAccountId,
} from "../scripts/fetch-dashboard-data.mjs";

test("Steam profile references are parsed without exposing credentials", () => {
  assert.deepEqual(parseSteamProfileReference("76561198000000000"), {
    type: "steamId64",
    value: "76561198000000000",
  });
  assert.deepEqual(
    parseSteamProfileReference("https://steamcommunity.com/id/example-player/"),
    { type: "vanity", value: "example-player" },
  );
  assert.equal(steamId64ToAccountId("76561197960265729"), 1);
  assert.throws(() => steamId64ToAccountId("123"), /17 Ziffern/);
});

test("the complete raw match history is normalized", () => {
  const matches = Array.from({ length: 105 }, (_, index) => ({
    match_id: 9_000 - index,
    hero_id: index % 2 ? 2 : 1,
    hero_level: 15,
    start_time: 1_800_000_000 - index * 1_000,
    match_mode: index % 3 === 0 ? 4 : 1,
    player_team: 0,
    match_result: index % 2,
    player_match_outcome: index % 2 ? 2 : 1,
    player_kills: 10 + index,
    player_deaths: 5,
    player_assists: 8,
    net_worth: 45_000,
    match_duration_s: 1_800,
    last_hits: 100,
    denies: 4,
    player_damage: 52_000,
    damage_taken: 31_000,
    player_healing: 4_500,
    damage_mitigated: 7_000,
    boss_damage: 3_000,
    creep_damage: 60_000,
    shots_hit: 600,
    shots_missed: 400,
    build_item_ids: [100, 200],
    build_times_s: [120, 360],
    build_sold_times_s: [0, 1_400],
    build_upgrade_ids: [1, 2],
    ranked_display_badge: index % 3 === 0 ? 74 : null,
    ranked_delta: index % 3 === 0 ? 12 : null,
  }));

  const result = buildDashboardData({
    steamId64: "76561197960265729",
    profile: {
      personaname: "Test Player",
      profileurl: "https://steamcommunity.com/profiles/76561197960265729/",
      avatarfull: "https://example.com/avatar.jpg",
      loccountrycode: "DE",
    },
    ownedGames: [{ appid: 1422450, playtime_forever: 600 }],
    matchHistory: matches,
    matchPlayers: [
      { match_id: 9_000, account_id: 1, hero_id: 1, team: 0, kills: 10, deaths: 5, assists: 8, net_worth: 45_000 },
      { match_id: 9_000, account_id: 2, hero_id: 2, team: 1, kills: 7, deaths: 6, assists: 4, net_worth: 40_000 },
    ],
    heroAssets: [
      { id: 1, name: "Hero One", images: { icon_hero_card_webp: "https://example.com/one.webp" } },
      { id: 2, name: "Hero Two", images: { icon_hero_card_webp: "https://example.com/two.webp" } },
    ],
    itemAssets: [
      { id: 100, name: "Test Item", type: "upgrade", image_webp: "https://example.com/item.webp", item_tier: 2, cost: 1_600 },
      { id: 200, name: "Test Ability", type: "ability", image_webp: "https://example.com/ability.webp" },
    ],
    heroStats: [
      { hero_id: 1, matches: 100, wins: 55, total_kills: 1_000, total_deaths: 500, total_assists: 750, total_net_worth: 4_000_000, total_player_damage: 5_000_000 },
    ],
    rankAssets: [{ tier: 7, name: "Oracle", color: "#abcdef", images: {} }],
    generatedAt: "2026-08-04T12:00:00.000Z",
  });

  assert.equal(result.state, "ready");
  assert.equal(result.profile.accountId, 1);
  assert.equal(result.profile.deadlockMinutes, 600);
  assert.equal(result.matches.length, 105);
  assert.equal(result.matches[0].result, "win");
  assert.equal(result.matches[0].soulsPerMinute, 1_500);
  assert.equal(result.matches[0].playerDamage, 52_000);
  assert.equal(result.matches[0].build[1].soldAtSeconds, 1_400);
  assert.equal(result.matches[0].players.length, 2);
  assert.equal(result.matches[0].players[0].isSelf, true);
  assert.equal(result.heroes["1"].name, "Hero One");
  assert.equal(result.buildAssets["100"].name, "Test Item");
  assert.equal(Math.round(result.heroBenchmarks["1"].winrate), 55);
  assert.equal(result.ranks["7"].name, "Oracle");
  assert.equal(JSON.stringify(result).includes("STEAM_API_KEY"), false);
});

test("an unscored match still uses the actual winning team", () => {
  const result = buildDashboardData({
    steamId64: "76561197960265729",
    profile: { personaname: "Test Player" },
    ownedGames: [],
    matchHistory: [
      {
        match_id: 94_422_365,
        hero_id: 13,
        start_time: 1_784_381_982,
        match_mode: 1,
        player_team: 0,
        match_result: 0,
        player_match_outcome: 5,
        match_duration_s: 2_000,
      },
    ],
    heroAssets: [{ id: 13, name: "Haze", images: {} }],
    rankAssets: [],
  });

  assert.equal(result.matches[0].result, "win");
  assert.equal(result.matches[0].isScored, false);
});

test("processed match query is scoped without an analysis cap", () => {
  const url = buildProcessedMatchesUrl("https://api.deadlock-api.com/", 64_862);
  const query = url.searchParams.get("query");

  assert.equal(url.origin, "https://api.deadlock-api.com");
  assert.match(query, /account_id = 64862/);
  assert.doesNotMatch(query, /LIMIT\s+\d+/);
  assert.match(query, /player_match_outcome/);
  assert.match(query, /max_player_damage AS player_damage/);
  assert.match(query, /items\.item_id AS build_item_ids/);
});

test("team rosters are limited to the visible match details", () => {
  const url = buildMatchPlayersUrl("https://api.deadlock-api.com/", [100, 101, 101, 102]);
  const query = url.searchParams.get("query");

  assert.match(query, /match_id IN \(100,101,102\)/);
  assert.match(query, /account_id/);
  assert.match(query, /net_worth/);
  assert.doesNotMatch(query, /undefined|NaN/);
});

test("processed matches supplement stale player history", () => {
  const history = [
    { match_id: 100, start_time: 1_000, ranked_delta: 25, player_kills: 7 },
  ];
  const processed = [
    { match_id: 101, start_time: 2_000, player_kills: 9 },
    { match_id: 100, start_time: 1_000, player_kills: 6, player_deaths: 4 },
  ];

  const merged = mergeMatchSources(history, processed);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged.find((match) => match.match_id === 101), processed[0]);
  assert.equal(merged.find((match) => match.match_id === 100).player_kills, 7);
  assert.equal(merged.find((match) => match.match_id === 100).player_deaths, 4);
  assert.equal(merged.find((match) => match.match_id === 100).ranked_delta, 25);
});
