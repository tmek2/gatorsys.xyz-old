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

test("uses the approved Gator brand contract", async () => {
  const site = await import("../src/config/site.ts").catch(() => null);
  assert.ok(site, "shared Gator site configuration must exist");
  assert.equal(site.SITE_NAME, "Gator");
  assert.deepEqual(
    site.NAV_LINKS.map((link: { label: string; href: string }) => [
      link.label,
      link.href,
    ]),
    [
      ["Features", "/#features"],
      ["Dashboard", "/servers"],
      ["Documentation", "https://docs.gatorsys.xyz"],
      ["Support", site.SUPPORT_URL],
    ],
  );
});

test("contains no visible legacy Birb branding or astrobirb links", async () => {
  const sourceFiles = await collectSourceFiles(path.join(root, "src"));
  sourceFiles.push(path.join(root, "next.config.js"));

  /* One exemption beyond the old footer's, and it is a credit rather than
     branding. The Gator story credits Birb in two wrapped lines. They are
     counted, and everything else in the file is still scanned. */
  const README = "src/components/site/mac/content.ts";
  const CREDIT = /^ *".*\bBirb\b.*",$/gm;

  const offenders: string[] = [];
  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    const relativePath = path.relative(root, file).replaceAll("\\", "/");
    let checkedSource = source;
    if (relativePath === README) {
      const credits = source.match(CREDIT) ?? [];
      assert.equal(credits.length, 2, "the Gator story credit changed unexpectedly");
      checkedSource = source.replace(CREDIT, "");
    }

    if (/\bbirb\b|astro-?birb|astrobirb\.dev/i.test(checkedSource)) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
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
