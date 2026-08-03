import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("credentials are documented but never committed", async () => {
  const [example, ignore] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.match(example, /^STEAM_API_KEY=$/m);
  assert.match(example, /^STEAM_ID64=$/m);
  assert.match(example, /^DEADLOCK_API_KEY=$/m);
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});

test("the public status endpoint exposes booleans, not secrets", async () => {
  const route = await readFile(new URL("app/api/status/route.ts", root), "utf8");

  assert.match(route, /Boolean\(process\.env\.STEAM_API_KEY\)/);
  assert.match(route, /Boolean\(process\.env\.STEAM_ID64\)/);
  assert.doesNotMatch(route, /steamApi:\s*process\.env\.STEAM_API_KEY/);
});

test("starter preview metadata has been removed", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /Deadlock-Matchdaten/);
  assert.match(layout, /Deadlock Personal Intelligence/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|SkeletonPreview/);
});
