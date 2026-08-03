import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the GitHub Pages entrypoint contains the interactive dashboard", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("dashboard.js", root), "utf8"),
  ]);

  assert.match(html, /<html lang="de">/);
  assert.match(html, /<title>Deadlock Personal Intelligence<\/title>/);
  assert.match(html, /data-window="30"/);
  assert.match(html, /id="rank-chart"/);
  assert.match(html, /\.\/dashboard\.js/);
  assert.match(script, /data\/dashboard\.json/);
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
  assert.match(workflow, /cp data\/dashboard\.json/);
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
  assert.doesNotMatch(seed, /[A-Fa-f0-9]{32}/);
});
