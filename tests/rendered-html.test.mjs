import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Deadlock setup dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Deadlock Personal Intelligence<\/title>/i);
  assert.match(html, /Deine Matches/);
  assert.match(html, /Datenzugang einrichten/);
  assert.match(html, /Projektfundament/);
  assert.match(html, /Privater Workspace/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("does not render credential values", async () => {
  process.env.STEAM_API_KEY = "test-secret-never-render";
  const response = await render();
  const html = await response.text();
  assert.doesNotMatch(html, /test-secret-never-render/);
});
