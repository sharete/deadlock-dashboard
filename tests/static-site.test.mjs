import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the GitHub Pages entrypoint is complete", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /<html lang="de">/);
  assert.match(html, /<title>Deadlock Personal Intelligence<\/title>/);
  assert.match(html, /Deine Matches\./);
  assert.match(html, /GitHub Pages und Repository vorbereitet/);
  assert.match(html, /\.\/dashboard\.css/);
  assert.doesNotMatch(html, /NEXT_PUBLIC_|STEAM_API_KEY=[^<\s]+/);
});

test("the Pages workflow tests and deploys only static assets", async () => {
  const workflow = await readFile(
    new URL(".github/workflows/pages.yml", root),
    "utf8",
  );

  assert.match(workflow, /npm test/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: _site/);
  assert.doesNotMatch(workflow, /STEAM_API_KEY:\s*[^$\s]/);
});

test("credential files stay outside Git", async () => {
  const [example, ignore] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.match(example, /^STEAM_API_KEY=$/m);
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});
