import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (/\.(ts|tsx|js|css|svg|md)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

test("preview configuration uses local links and a fictional name", async () => {
  const site = await import("../src/config/site.ts");
  assert.equal(site.SITE_NAME, "Community Dashboard Preview");
  assert.equal(site.DOCS_URL, "/setup");
  assert.equal(site.SUPPORT_URL, "/setup#support");
  assert.ok(site.NAV_LINKS.some(link => link.href === "/servers"));
});

test("the application contains no hardcoded community invite or author link", async () => {
  const sourceFiles = await collectSourceFiles(path.join(root, "src"));
  sourceFiles.push(path.join(root, "next.config.js"));
  for (const file of sourceFiles) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /https:\/\/discord\.gg\/[A-Za-z0-9]+/, file);
    assert.doesNotMatch(contents, /https:\/\/discord\.com\/users\/\d+/, file);
  }
});

test("provides direct privacy and terms pages without hash fragments", async () => {
  const privacy = await readFile(
    path.join(root, "src/app/privacy/page.tsx"),
    "utf8",
  ).catch(() => "");
  const terms = await readFile(
    path.join(root, "src/app/terms/page.tsx"),
    "utf8",
  ).catch(() => "");

  assert.match(privacy, /Privacy Policy/);
  assert.match(terms, /Terms of Service/);
  assert.doesNotMatch(
    `${privacy}\n${terms}`,
    /#privacypolicy|#termsandconditions/i,
  );
});

test("route transitions do not render skeletons or delayed loading overlays", async () => {
  const provider = await readFile(
    path.join(root, "src/app/components/ProgressBarProvider.tsx"),
    "utf8",
  );

  assert.doesNotMatch(provider, /RouteGhost|ghost-shimmer|setTimeout|AppProgressBar/);
  assert.match(provider, /page-enter/);
});
