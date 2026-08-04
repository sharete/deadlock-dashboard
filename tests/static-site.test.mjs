import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the GitHub Pages entrypoint contains the interactive dashboard", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("dashboard.js", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(html, /<html lang="de">/);
  assert.match(html, /<title>Deadlock Personal Intelligence<\/title>/);
  assert.doesNotMatch(html, /data-window=/);
  assert.match(html, /data-hero-sort="matches"/);
  assert.match(html, /data-hero-sort="winrate"/);
  assert.match(html, /data-hero-sort="kda"/);
  assert.match(html, /id="rank-chart"/);
  assert.match(html, /id="rank-details-button"/);
  assert.match(html, /id="coach-button"/);
  assert.match(html, /id="enemy-analysis-button"/);
  assert.match(html, /id="match-archive-button"/);
  assert.match(html, /id="session-grid"/);
  assert.match(html, /id="detail-dialog"/);
  assert.match(html, /\.\/dashboard\.js/);
  assert.match(script, /data\/dashboard\.json/);
  assert.match(script, /match\.isScored === false/);
  assert.match(script, /ungewertet/);
  assert.doesNotMatch(script, /deadlock-analysis-window|windowSize/);
  assert.match(script, /function sortHeroGroups/);
  assert.match(script, /HERO_SAMPLE_MIN = 3/);
  assert.match(script, /function openHeroDetail/);
  assert.match(script, /Deine Werte im globalen Vergleich/);
  assert.match(script, /Globaler Durchschnitt/);
  assert.doesNotMatch(script, /Du gegen den API-Benchmark/);
  assert.match(script, /function openMatchDetail/);
  assert.match(script, /function openMatchArchive/);
  assert.match(script, /function openCoach/);
  assert.match(script, /function openEnemyAnalysis/);
  assert.match(script, /function openRankContext/);
  assert.match(script, /Zusammenhänge sind Hinweise, keine garantierte Ursache/);
  assert.match(script, /function loadHistoryPage/);
  assert.match(script, /dataFiles\.recentMatches/);
  assert.match(script, /historyPagePattern/);
  assert.match(script, /function renderRosterPlayerDetail/);
  assert.match(script, /Build und Werte von/);
  assert.match(script, /image\.decoding = "async"/);
  assert.match(script, /function buildSessions/);
  assert.match(styles, /\.detail-open main/);
  assert.match(styles, /content-visibility: auto/);
  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.doesNotMatch(`${html}\n${script}`, /STEAM_API_KEY\s*=|NEXT_PUBLIC_/);
});

test("the Pages workflow generates and deploys static data", async () => {
  const workflow = await readFile(new URL(".github/workflows/pages.yml", root), "utf8");

  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run generate/);
  assert.match(workflow, /secrets\.STEAM_API_KEY/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: _site/);
  assert.match(workflow, /cp app\/globals\.css _site\/dashboard\.css/);
  assert.doesNotMatch(workflow, /cp index\.html dashboard\.css/);
  assert.match(workflow, /cp -r data\/\. _site\/data\//);
  assert.match(workflow, /dashboard\.js\?v=\$\{GITHUB_SHA\}-\$\{GITHUB_RUN_ID\}/);
  assert.doesNotMatch(workflow, /STEAM_API_KEY:\s*[A-Za-z0-9]{20,}/);
});

test("credential files stay outside Git", async () => {
  const [example, ignore, seed] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
    readFile(new URL("data/dashboard.json", root), "utf8"),
  ]);

  assert.match(example, /^STEAM_API_KEY=$/m);
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^\/data\/recent-matches\.json$/m);
  assert.match(ignore, /^\/data\/history\/$/m);
  assert.doesNotMatch(seed, /[A-Fa-f0-9]{32}/);
});
