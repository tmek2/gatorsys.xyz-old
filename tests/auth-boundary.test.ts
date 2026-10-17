import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * The authorization boundary.
 *
 * Sessions are not kept in localStorage, and admin checks are not done on the
 * client. These tests keep it that way, since either is easy to reintroduce
 * with one convenient change.
 *
 * The chain: withAuth proves a session exists, the user id comes from the
 * encrypted cookie (never the request), and the bot decides whether that user
 * may manage that guild.
 */

async function routeFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await routeFiles(path)));
    else if (entry.name === "route.ts") out.push(path);
  }
  return out;
}

test("no auth material is put in browser storage", async () => {
  // A token in localStorage is readable by any script on the page, which turns
  // XSS into account takeover. Sessions are an httpOnly encrypted JWT cookie
  // instead.
  const files = await routeFiles("src");
  const sources = await Promise.all(
    [...files, "src/components/Manage/manage-context.tsx", "auth.ts"].map((f) =>
      readFile(f, "utf8").catch(() => ""),
    ),
  );
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /(localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*[^)]*\b(token|session|auth|jwt|bearer|credential|secret)\b/i,
      "auth material must never be written to browser storage",
    );
  }
});

test("every manage and department route is guarded server-side", async () => {
  const files = [
    ...(await routeFiles("src/app/api/manage")),
    ...(await routeFiles("src/app/api/departments")),
  ];
  assert.ok(files.length > 20, "expected the full route set");
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /withAuth|await auth\(\)/,
      `${file} has no server-side session check`,
    );
  }
});

test("identity comes from the session, never from the request", async () => {
  // A user id taken from the request would let any logged-in user act as
  // someone else. The guild id may come from the URL (the bot checks it against
  // the user); the user id may not.
  const files = [
    ...(await routeFiles("src/app/api/manage")),
    ...(await routeFiles("src/app/api/departments")),
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /\buser:\s*(body|payload|json|data|searchParams|params|req|request)\b/,
      `${file} takes the acting user from the request instead of the session`,
    );
  }
});

test("nothing a customer wrote is left open to search engines", async () => {
  // Customer content (transcripts, infraction panels, documents, spreadsheets,
  // forms, applications) is public by link on purpose, but must not be indexed.
  const robots = await readFile(new URL("../src/app/robots.ts", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");

  // An allow-list of what is ours to advertise, not a block-list of what is
  // not -- a block-list is one new route away from being wrong.
  assert.match(robots, /allow: \["\/", "\/servers", "\/privacy", "\/terms"\]/);
  for (const path of [
    "/transcript/",
    "/panel/",
    "/document/",
    "/spreadsheet/",
    "/form/",
    "/application/",
    "/docs/shared/",
    "/manage/",
    "/api/",
  ]) {
    assert.ok(robots.includes(`"${path}"`), `${path} should be disallowed`);
  }
  // A sitemap is a list of pages you are asking to be crawled, so it must not
  // enumerate the routes robots.ts just excluded.
  for (const path of ["transcript", "document", "spreadsheet", "panel"]) {
    assert.ok(!sitemap.includes(`/${path}`), `sitemap must not list /${path}`);
  }

  // robots.txt is only a request, and a blocked URL can still be listed from
  // inbound links, so every customer-content route also sets `noindex` in its
  // own metadata.
  const contentRoutes = [
    "transcript/[id]",
    "panel/[id]",
    "panel/[id]/[infid]",
    "document/[slug]",
    "spreadsheet/[slug]",
    "form/[slug]",
    "application/[guildId]/[appId]",
    "d/document/[slug]",
    "d/spreadsheet/[slug]",
    "d/form/[slug]",
    "docs/shared/[serverId]/[resourceId]",
    "departments/[parentId]/[departmentId]",
    "departments/join/[code]",
    "p/[serverId]/[departmentId]",
  ];
  for (const route of contentRoutes) {
    const page = await readFile(
      new URL(`../src/app/${route}/page.tsx`, import.meta.url),
      "utf8",
    );
    assert.match(page, /NO_INDEX/, `src/app/${route}/page.tsx is missing NO_INDEX`);
  }

  // The pages that build a rich Discord link preview keep doing so: the
  // unfurler reads OG tags and ignores robots meta, so the two coexist.
  const join = await readFile(
    new URL("../src/app/departments/join/[code]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(join, /openGraph/);
  assert.match(join, /robots: NO_INDEX/);
});

test("a missing page is a page, not Next's stock 404", async () => {
  const notFoundPage = await readFile(
    new URL("../src/app/not-found.tsx", import.meta.url),
    "utf8",
  );
  // Distinct from error.tsx, which catches thrown errors. Without it a dead
  // share link shows the framework's plain 404.
  assert.match(notFoundPage, /export default function NotFound/);
  // Most 404s here are an expired link, not a typo, so the copy says so.
  assert.match(notFoundPage, /expired/);
  assert.match(notFoundPage, /robots: \{ index: false, follow: false \}/);
});
