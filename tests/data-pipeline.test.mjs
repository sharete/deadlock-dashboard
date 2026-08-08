import assert from "node:assert/strict";
import test from "node:test";

import {
  accountIdToSteamId64,
  buildBasicMatchPlayersUrl,
  buildDashboardData,
  buildHeroCoach,
  buildHeroMatchupsUrl,
  buildMatchPlayersUrl,
  buildMatchMetadataUrl,
  buildPublishedDataFiles,
  buildProcessedMatchesUrl,
  buildRankContext,
  buildTeamEconomy,
  flattenMatchMetadataPlayers,
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
  assert.equal(accountIdToSteamId64(1), "76561197960265729");
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
    assigned_lane: 2,
    mvp_rank: 3,
    average_badge_team0: 74,
    average_badge_team1: 73,
    timeline_times_s: [180, 360],
    timeline_net_worth: [2_000, 4_500],
    timeline_kills: [0, 2],
    timeline_deaths: [0, 1],
    timeline_assists: [1, 3],
    timeline_player_damage: [500, 2_500],
    death_times_s: [350],
    death_durations_s: [22],
    death_ttk_s: [3.5],
    death_killer_slots: [7],
    objective_times_s: [300],
    objective_types: [1],
    objective_teams: [0],
    mid_boss_times_s: [1_200],
    mid_boss_killed_teams: [0],
    mid_boss_claimed_teams: [1],
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
      {
        match_id: 9_000, account_id: 1, hero_id: 1, team: 0, kills: 10, deaths: 5, assists: 8, net_worth: 45_000,
        player_damage: 52_000, player_healing: 4_500, build_item_ids: [100], build_times_s: [120],
        assigned_lane: 2, timeline_times_s: [180, 360], timeline_net_worth: [2_000, 4_500],
      },
      {
        match_id: 9_000, account_id: 2, hero_id: 2, team: 1, kills: 7, deaths: 6, assists: 4, net_worth: 40_000,
        player_damage: 39_000, player_healing: 7_500, last_hits: 180, denies: 3,
        build_item_ids: [300], build_times_s: [90], build_upgrade_ids: [123],
        assigned_lane: 2, timeline_times_s: [180, 360], timeline_net_worth: [1_800, 4_000],
      },
    ],
    heroAssets: [
      { id: 1, name: "Hero One", images: { icon_hero_card_webp: "https://example.com/one.webp" } },
      { id: 2, name: "Hero Two", images: { icon_hero_card_webp: "https://example.com/two.webp" } },
    ],
    itemAssets: [
      { id: 100, name: "Test Item", type: "upgrade", image_webp: "https://example.com/item.webp", item_tier: 2, cost: 1_600 },
      { id: 200, name: "Test Ability", type: "ability", image_webp: "https://example.com/ability.webp" },
      { id: 300, name: "Roster Ability", type: "ability", image_webp: "https://example.com/roster-ability.webp" },
    ],
    heroStats: [
      { hero_id: 1, matches: 100, wins: 55, total_kills: 1_000, total_deaths: 500, total_assists: 750, total_net_worth: 4_000_000, total_player_damage: 5_000_000 },
    ],
    rankAssets: [{ tier: 7, name: "Oracle", color: "#abcdef", images: {} }],
    rankSnapshot: { badge: 74, rank: 7, subrank: 4 },
    badgeDistribution: [
      { badge_level: 64, unique_players: 75 },
      { badge_level: 74, unique_players: 25 },
    ],
    heroMatchups: [
      { hero_id: 1, enemy_hero_id: 2, matches_played: 12, wins: 7 },
    ],
    enemyStats: [{ enemy_id: 2, matches_played: 5, wins: 3 }],
    opponentProfiles: [{
      steamid: "76561197960265730",
      personaname: "Known Rival",
      avatarmedium: "https://example.com/rival.jpg",
      profileurl: "https://steamcommunity.com/profiles/76561197960265730/",
    }],
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
  assert.equal(result.matches[0].players[1].playerHealing, 7_500);
  assert.equal(result.matches[0].players[1].build[0].itemId, 300);
  assert.equal(result.matches[0].assignedLane, 2);
  assert.equal(result.matches[0].timeline.netWorth[1], 4_500);
  assert.equal(result.matches[0].deathDetails[0].timeToKillSeconds, 3.5);
  assert.equal(result.matches[0].objectives[0].type, 1);
  assert.equal(result.matches[0].midBoss[0].claimedByTeam, 1);
  assert.deepEqual(result.matches[0].teamEconomy.team0, [2_000, 4_500]);
  assert.deepEqual(result.matches[0].teamEconomy.team1, [1_800, 4_000]);
  assert.equal(result.matches[0].players[0].timeline, undefined);
  assert.equal(result.heroes["1"].name, "Hero One");
  assert.equal(result.buildAssets["100"].name, "Test Item");
  assert.equal(result.buildAssets["300"].name, "Roster Ability");
  assert.equal(Math.round(result.heroBenchmarks["1"].winrate), 55);
  assert.equal(result.ranks["7"].name, "Oracle");
  assert.equal(result.heroCoach["1"].matches, 53);
  assert.equal(result.matchups[0].enemyHeroId, 2);
  assert.equal(Math.round(result.matchups[0].winrate), 58);
  assert.equal(result.opponents[0].name, "Known Rival");
  assert.equal(result.opponents[0].matches, 5);
  assert.equal(result.opponents[0].wins, 3);
  assert.equal(result.opponents[0].losses, 2);
  assert.equal(result.opponents[0].winrate, 60);
  assert.equal(result.opponents[0].lossrate, 40);
  assert.equal(result.rankContext.currentBadge, 74);
  assert.equal(result.rankContext.percentile, 75);
  assert.equal(JSON.stringify(result).includes("STEAM_API_KEY"), false);

  const published = buildPublishedDataFiles(result);
  assert.equal(published.dashboard.schemaVersion, 6);
  assert.equal(published.dashboard.matches.length, 105);
  assert.equal(published.dashboard.matches[0].historyPage, 1);
  assert.equal(published.dashboard.matches[104].historyPage, 2);
  assert.equal("build" in published.dashboard.matches[0], false);
  assert.equal("players" in published.dashboard.matches[0], false);
  assert.equal("timeline" in published.dashboard.matches[0], false);
  assert.equal("teamEconomy" in published.dashboard.matches[0], false);
  assert.equal("assignedLane" in published.dashboard.matches[0], false);
  assert.equal(published.recentMatches.matches.length, 12);
  assert.equal(published.recentMatches.matches[0].players.length, 2);
  assert.equal(published.historyPages.length, 2);
  assert.equal(published.historyPages[0].data.matches.length, 100);
  assert.equal(published.historyPages[1].data.matches.length, 5);
  assert.equal(published.historyPages[0].data.matches[0].build.length, 2);
  assert.equal(published.historyPages[0].data.matches[0].timeline.times.length, 2);
  assert.equal("players" in published.historyPages[0].data.matches[0], false);
  assert.equal(published.historyIndex.totalMatches, 105);
  assert.ok(JSON.stringify(published.dashboard).length < JSON.stringify(result).length);
});

test("a multi-thousand-match history stays paginated and roster-bounded", () => {
  const player = {
    accountId: 1,
    heroId: 1,
    team: 0,
    kills: 10,
    deaths: 5,
    assists: 8,
    netWorth: 45_000,
    build: [{ itemId: 100, atSeconds: 120, soldAtSeconds: 0, upgradeId: 0 }],
    isSelf: true,
  };
  const matches = Array.from({ length: 2_005 }, (_, index) => ({
    id: String(100_000 - index),
    heroId: 1,
    startedAt: new Date(1_800_000_000_000 - index * 60_000).toISOString(),
    durationSeconds: 1_800,
    result: index % 2 ? "loss" : "win",
    kills: 10,
    deaths: 5,
    assists: 8,
    netWorth: 45_000,
    soulsPerMinute: 1_500,
    build: [{ itemId: 100, atSeconds: 120, soldAtSeconds: 0, upgradeId: 0 }],
    players: index < 12 ? Array.from({ length: 12 }, () => ({ ...player })) : [],
  }));

  const published = buildPublishedDataFiles({
    schemaVersion: 3,
    state: "ready",
    generatedAt: "2026-08-04T12:00:00.000Z",
    matches,
  });

  assert.equal(published.dashboard.matches.length, 2_005);
  assert.equal(published.recentMatches.matches.length, 12);
  assert.equal(published.recentMatches.matches[0].players.length, 12);
  assert.equal(published.historyPages.length, 21);
  assert.equal(published.historyPages[20].data.matches.length, 5);
  assert.equal(published.historyIndex.pages.length, 21);
  assert.equal("build" in published.dashboard.matches[2_000], false);
  assert.equal("players" in published.historyPages[0].data.matches[0], false);
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
  assert.match(query, /stats\.time_stamp_s AS timeline_times_s/);
  assert.match(query, /death_details\.time_to_kill_s AS death_ttk_s/);
  assert.match(query, /objectives\.team_objective/);
});

test("team rosters are limited to the visible match details", () => {
  const url = buildMatchPlayersUrl("https://api.deadlock-api.com/", [100, 101, 101, 102]);
  const query = url.searchParams.get("query");

  assert.match(query, /match_id IN \(100,101,102\)/);
  assert.match(query, /account_id/);
  assert.match(query, /net_worth/);
  assert.match(query, /max_player_damage AS player_damage/);
  assert.match(query, /items\.item_id AS build_item_ids/);
  assert.match(query, /stats\.net_worth AS timeline_net_worth/);
  assert.match(query, /assigned_lane/);
  assert.doesNotMatch(query, /undefined|NaN/);

  const fallbackQuery = buildBasicMatchPlayersUrl("https://api.deadlock-api.com/", [100, 101])
    .searchParams.get("query");
  assert.match(fallbackQuery, /match_id IN \(100,101\)/);
  assert.match(fallbackQuery, /assigned_lane/);
  assert.doesNotMatch(fallbackQuery, /timeline_net_worth/);

  const metadataUrl = buildMatchMetadataUrl("https://api.deadlock-api.com/", [100, 101]);
  assert.deepEqual(metadataUrl.searchParams.getAll("match_ids"), ["100", "101"]);
  assert.equal(metadataUrl.searchParams.get("include_player_items"), "true");
  assert.equal(metadataUrl.searchParams.get("include_player_stats"), "true");
});

test("match metadata fallback is flattened into the roster contract", () => {
  const rows = flattenMatchMetadataPlayers([{
    match_id: 500,
    players: [{
      account_id: 1,
      team: "Team0",
      hero_id: 13,
      kills: 8,
      deaths: 4,
      assists: 10,
      net_worth: 42_000,
      assigned_lane: 2,
      items: [{ item_id: 100, game_time_s: 120, sold_time_s: 0, upgrade_id: 5 }],
      stats: [
        { time_stamp_s: 180, net_worth: 2_000, player_damage: 1_000 },
        { time_stamp_s: 360, net_worth: 4_500, player_damage: 30_000, player_healing: 4_000, shots_hit: 400 },
      ],
    }],
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].team, 0);
  assert.equal(rows[0].player_damage, 30_000);
  assert.deepEqual(rows[0].timeline_times_s, [180, 360]);
  assert.deepEqual(rows[0].timeline_net_worth, [2_000, 4_500]);
  assert.deepEqual(rows[0].build_item_ids, [100]);
  assert.deepEqual(rows[0].build_upgrade_ids, [5]);
});

test("team economy aggregates aligned player timelines without publishing raw roster curves", () => {
  const economy = buildTeamEconomy([
    { team: 0, timeline: { times: [180, 360, 540], netWorth: [2_000, 4_000, 6_000] } },
    { team: 0, timeline: { times: [180, 540], netWorth: [1_500, 5_500] } },
    { team: 1, timeline: { times: [180, 360, 540], netWorth: [1_800, 3_700, 5_800] } },
  ]);

  assert.deepEqual(economy.times, [180, 360, 540]);
  assert.deepEqual(economy.team0, [3_500, 5_500, 11_500]);
  assert.deepEqual(economy.team1, [1_800, 3_700, 5_800]);
});

test("hero matchup query covers the complete personal history", () => {
  const url = buildHeroMatchupsUrl("https://api.deadlock-api.com/", 64_862);
  const query = url.searchParams.get("query");

  assert.match(query, /match_player AS self FINAL/);
  assert.match(query, /match_player AS enemy FINAL/);
  assert.match(query, /self\.team != enemy\.team/);
  assert.match(query, /self\.account_id = 64862/);
  assert.match(query, /GROUP BY self\.hero_id, enemy\.hero_id/);
  assert.doesNotMatch(query, /LIMIT\s+\d+/);
});

test("personal coach deduplicates items and groups ability start orders", () => {
  const assets = {
    "10": { id: 10, type: "upgrade" },
    "20": { id: 20, type: "ability" },
    "21": { id: 21, type: "ability" },
  };
  const matches = [
    {
      heroId: 1,
      result: "win",
      build: [
        { itemId: 10, atSeconds: 100 },
        { itemId: 10, atSeconds: 400 },
        { itemId: 20, atSeconds: 60 },
        { itemId: 21, atSeconds: 180 },
      ],
    },
    {
      heroId: 1,
      result: "loss",
      build: [
        { itemId: 10, atSeconds: 200 },
        { itemId: 20, atSeconds: 70 },
        { itemId: 21, atSeconds: 200 },
      ],
    },
  ];

  const coach = buildHeroCoach(matches, assets)["1"];
  assert.equal(coach.items[0].matches, 2);
  assert.equal(coach.items[0].avgBuySeconds, 150);
  assert.equal(coach.abilityOrders[0].matches, 2);
  assert.deepEqual(coach.abilityOrders[0].abilityIds, [20, 21]);
});

test("rank context derives a transparent player percentile", () => {
  const context = buildRankContext(
    { badge: 74, rank: 7, subrank: 4 },
    [
      { badge_level: 64, unique_players: 60 },
      { badge_level: 74, unique_players: 30 },
      { badge_level: 84, unique_players: 10 },
    ],
    [
      { rankBadge: 74 },
      { rankBadge: 72 },
    ],
  );

  assert.equal(context.currentBadge, 74);
  assert.equal(context.percentile, 60);
  assert.equal(context.population, 100);
  assert.equal(context.recentTrend, 2);

  const unranked = buildRankContext(
    { badge: 0, rank: 0, subrank: 0 },
    [{ badge_level: 64, unique_players: 100 }],
    [],
  );
  assert.equal(unranked.currentBadge, null);
  assert.equal(unranked.percentile, null);
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
