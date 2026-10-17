/**
 * Builds the sticker backdrops and doodle cursors from the doodle pack.
 *
 * The doodle SVGs are line art: every stroke is exported as a *closed* contour,
 * and a shape like the calendar body is an outer contour plus an inner contour
 * inside the same `d`. SVG's default nonzero fill rule turns that nesting into a
 * hole, which is why the artwork reads as an outline — and why masking the icon
 * to make a backdrop produced an outline behind an outline no matter how much it
 * was scaled, blurred or thresholded. A blur can fatten a ring; it can never
 * fill one.
 *
 * The fix is structural rather than visual: split every subpath (each `M`) into
 * its own `<path>` element. Separate elements cannot punch holes in one another,
 * they simply overlap, so each contour fills solid and the union is the filled
 * silhouette of the drawing. A round-joined stroke on top dilates that silhouette
 * a few units, which closes the hairline gaps between strokes and gives the
 * sticker its die-cut padding.
 *
 * Every path command in the pack is absolute (M/C/L/H/V/Z — verified, no
 * lowercase), so splitting on `M` needs no coordinate rewriting.
 *
 * Run: node scripts/build-doodle-silhouettes.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const doodles = join(root, "public", "doodles");

/** Pulls the viewBox and every `d` string out of a doodle SVG. */
function readDoodle(file) {
  const source = readFileSync(file, "utf8");
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${file}: no viewBox`);
  const paths = [...source.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]);
  if (!paths.length) throw new Error(`${file}: no paths`);
  return { viewBox, paths };
}

/**
 * Splits a `d` string into one string per subpath. Each `M` starts a new
 * contour; because the commands are absolute, the fragments stand alone.
 */
function splitSubpaths(d) {
  return d
    .split(/(?=M)/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 1);
}

/**
 * The union of every contour, filled solid. `dilate` is in viewBox units and is
 * applied as a round-joined stroke, so the silhouette grows evenly in all
 * directions instead of squaring off at the corners.
 */
function silhouettePaths(paths, dilate, fill) {
  return paths
    .flatMap(splitSubpaths)
    .map(
      (d) =>
        `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${dilate}"` +
        ` stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("\n");
}

function inkPaths(paths, fill) {
  return paths.map((d) => `<path d="${d}" fill="${fill}"/>`).join("\n");
}

function writeSvg(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${body}\n`, "utf8");
}

/**
 * Grows a viewBox outwards by `outset` on every side.
 *
 * The dilation is drawn as a stroke, so it extends half a stroke-width past the
 * artwork. Leaving the original viewBox in place clipped that overhang flat
 * against all four edges — the backdrop looked cropped out of its square. The
 * silhouette and the icon are both emitted with this padded box, so the two
 * layers share one coordinate space and line up at inset: 0 with no guesswork.
 */
function padViewBox(viewBox, outset) {
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  return [
    x - outset,
    y - outset,
    width + outset * 2,
    height + outset * 2,
  ].join(" ");
}

/* ── Sticker backdrops ──────────────────────────────────────────────────────
   Emitted as black-on-transparent so the stylesheet can use them as a CSS mask
   and paint them any colour, exactly like the icon layer above them. */

const STICKERS = [
  "bot",
  "calendar",
  "camera",
  "chat",
  "document",
  "heart",
  "people",
  "phone",
  "scroll",
  "shield",
  "spark",
  "tap",
];

let built = 0;

for (const name of STICKERS) {
  const file = join(doodles, `${name}.svg`);
  if (!existsSync(file)) {
    console.warn(`skip ${name}: missing`);
    continue;
  }
  const { viewBox, paths } = readDoodle(file);
  // ~9% of a 157-unit canvas: enough to bridge the gaps between strokes so the
  // backdrop reads as one shape, small enough that it still hugs the drawing.
  const dilate = Math.round(Number(viewBox.split(/\s+/)[2] || 157) * 0.09);
  const padded = padViewBox(viewBox, dilate / 2);
  writeSvg(
    join(doodles, "silhouette", `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${padded}">\n` +
      `${silhouettePaths(paths, dilate, "#000")}\n</svg>`,
  );
  // The glyph on the same padded canvas, so the sticker's two layers register
  // exactly instead of being nudged into place with percentage insets.
  writeSvg(
    join(doodles, "padded", `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${padded}">\n` +
      `${inkPaths(paths, "#000")}\n</svg>`,
  );
  built += 2;
}

/* ── Doodle cursors ─────────────────────────────────────────────────────────
   Same silhouette, but baked into the file underneath the glyph so the cursor
   carries its own background. Without it the thin line art vanished against
   light sections — which is what made the scroll cursor look like it had no
   background at all. Kept at ~34px: browsers refuse to load oversized cursors,
   and an SVG cursor needs concrete width/height attributes to render at all. */

const CURSOR_HEIGHT = 34;
const CURSOR_BACKING = "#fff6ef";
const CURSOR_EDGE = "#2b1119";
const CURSOR_INK = "#1a0a10";

const cursorDir = join(doodles, "cursor");
for (const name of ["tap", "point", "ok", "drag", "scroll"]) {
  const file = join(cursorDir, `${name}.svg`);
  if (!existsSync(file)) {
    console.warn(`skip cursor ${name}: missing`);
    continue;
  }
  const { viewBox, paths } = readDoodle(file);
  const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
  const dilate = Math.round(vbWidth * 0.1);
  // The rim is the widest stroke, so pad by its overhang or the cursor gets
  // clipped square at the edges exactly like the stickers were.
  const outset = (dilate + 10) / 2;
  const padded = padViewBox(viewBox, outset);
  const scale = CURSOR_HEIGHT / (vbHeight + outset * 2);
  const width = +((vbWidth + outset * 2) * scale).toFixed(1);

  writeSvg(
    join(doodles, "pointer", `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CURSOR_HEIGHT}" viewBox="${padded}">\n` +
      // Dark rim first, then the lighter fill inset into it, so the cursor keeps
      // a readable edge on both the cream and burgundy sections.
      `${silhouettePaths(paths, dilate + 10, CURSOR_EDGE)}\n` +
      `${silhouettePaths(paths, dilate, CURSOR_BACKING)}\n` +
      `${inkPaths(paths, CURSOR_INK)}\n</svg>`,
  );
  built += 1;
}

console.log(`built ${built} doodle assets`);
