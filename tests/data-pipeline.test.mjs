import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardData,
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

test("raw match history is normalized and capped", () => {
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
    heroAssets: [
      { id: 1, name: "Hero One", images: { icon_hero_card_webp: "https://example.com/one.webp" } },
      { id: 2, name: "Hero Two", images: { icon_hero_card_webp: "https://example.com/two.webp" } },
    ],
    rankAssets: [{ tier: 7, name: "Oracle", color: "#abcdef", images: {} }],
    maxMatches: 100,
    generatedAt: "2026-08-04T12:00:00.000Z",
  });

  assert.equal(result.state, "ready");
  assert.equal(result.profile.accountId, 1);
  assert.equal(result.profile.deadlockMinutes, 600);
  assert.equal(result.matches.length, 100);
  assert.equal(result.matches[0].result, "win");
  assert.equal(result.matches[0].soulsPerMinute, 1_500);
  assert.equal(result.heroes["1"].name, "Hero One");
  assert.equal(result.ranks["7"].name, "Oracle");
  assert.equal(JSON.stringify(result).includes("STEAM_API_KEY"), false);
});

test("processed match query is scoped and capped", () => {
  const url = buildProcessedMatchesUrl("https://api.deadlock-api.com/", 64_862, 500);
  const query = url.searchParams.get("query");

  assert.equal(url.origin, "https://api.deadlock-api.com");
  assert.match(query, /account_id = 64862/);
  assert.match(query, /LIMIT 100/);
  assert.match(query, /player_match_outcome/);
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
