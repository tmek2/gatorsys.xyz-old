import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/config/site";
import { FOLDERS, MODULE_BY_KEY, MODULE_COUNT } from "@/components/site/modules";

/* The card shown when the link is pasted, generated from the same data as the
   page so it cannot go stale: the landing at chat size, with the headline and,
   under it, the window rising off the bottom edge with its first row of
   modules. An embed is about 500px wide, so the headline is sized to be read
   and the window to be recognised.

   The palette is the dark appearance's, hard-coded: Satori has no cascade or
   custom properties. Values come from tokens.css and mac.css. */

export const runtime = "nodejs";

/* The hero's own words. The landing test holds these to `landing.tsx`, so a
   new headline on the page is a failing test until the card says it too. */
const LEAD = "Your community.";
const REST = "One dashboard.";

export const alt = `${LEAD} ${REST} ${SITE_NAME}'s landing page, with its window of modules.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#0c0c0c";
const INK = "#f4f2f0";
const DIM = "#a6a6a6";
const FAINT = "#6e6e6e";
const ACCENT = "#f7a8c4";
/* The window: a darker ground than the page it sits on, and a raised sheet
   inside it with a hairline rim. */
const WINDOW = "#030303";
const PAGE = "#0b0b0c";
const RIM = "rgba(255,255,255,0.08)";
const CARD = "#121212";

/* The first row of the wall, in order. Tabler's glyph paths are inlined because
   the icon package renders through `forwardRef`, which Satori does not call. */
const ROW = ["sessions", "punishments", "infractions", "promotions"] as const;
const GLYPHS: Record<(typeof ROW)[number], string[]> = {
  sessions: ["M18.364 19.364a9 9 0 1 0 -12.728 0", "M15.536 16.536a5 5 0 1 0 -7.072 0", "M11 13a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"],
  punishments: [
    "M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385",
    "M6 9l4 4",
    "M13 10l-4 -4",
    "M3 21h7",
    "M6.793 15.793l-3.586 -3.586a1 1 0 0 1 0 -1.414l2.293 -2.293l.5 .5l3 -3l-.5 -.5l2.293 -2.293a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-2.293 2.293l-.5 -.5l-3 3l.5 .5l-2.293 2.293a1 1 0 0 1 -1.414 0",
  ],
  infractions: ["M14 3v4a1 1 0 0 0 1 1h4", "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2", "M12 17l.01 0", "M12 11l0 3"],
  promotions: ["M7 11l5 -5l5 5", "M7 17l5 -5l5 5"],
};
const FOLDER_GLYPH = ["M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"];
const SEARCH_GLYPH = ["M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0", "M21 21l-6 -6"];

const CARDS = ROW.map((key) => {
  const folder = FOLDERS.find((f) => f.key === key);
  return {
    key,
    name: folder?.label ?? MODULE_BY_KEY.get(key)?.name ?? key,
    purpose: MODULE_BY_KEY.get(key)?.purpose ?? "",
    hue: folder?.hue ?? ACCENT,
  };
});
const SIDE = ["Bot", "Modules", "Documentation", "Support"];

const APP_MARK_PATH = "M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10-3h8v11h-8z";

function Mark({ width, color }: { width: number; color: string }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24" fill={color}>
      <g>
        <path d={APP_MARK_PATH} />
      </g>
    </svg>
  );
}

function Glyph({ paths, size: box, color, weight = 2 }: { paths: string[]; size: number; color: string; weight?: number }) {
  return (
    <svg width={box} height={box} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/* Rethink Sans from Google Fonts, subset to the letters this card uses. Runs
   once at build (the route is static); if the fetch fails the card renders in
   the fallback face rather than failing the build. */
const LETTERS = [SITE_NAME, LEAD, REST, String(MODULE_COUNT), "Search+", ...SIDE, ...CARDS.flatMap((card) => [card.name, card.purpose])].join("");

async function rethink(weight: 500 | 700): Promise<ArrayBuffer> {
  const sheet = await fetch(
    `https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@${weight}&text=${encodeURIComponent(LETTERS)}`,
  ).then((response) => response.text());
  const face = sheet.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!face) throw new Error("Google Fonts sent no TrueType face");
  const response = await fetch(face[1]);
  if (!response.ok) throw new Error(`Google Fonts answered ${response.status}`);
  return response.arrayBuffer();
}

async function faces() {
  try {
    const [regular, bold] = await Promise.all([rethink(500), rethink(700)]);
    return [
      { name: "Rethink Sans", data: regular, weight: 500 as const, style: "normal" as const },
      { name: "Rethink Sans", data: bold, weight: 700 as const, style: "normal" as const },
    ];
  } catch (error) {
    console.warn("[opengraph-image] drawing in the fallback face:", error);
    return undefined;
  }
}

export default async function Image() {
  const fonts = await faces();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "50px 64px 0",
          background: GROUND,
          fontFamily: "Rethink Sans",
          color: INK,
        }}
      >
        {/* The landing's dot field as an SVG pattern (Satori does not draw a
           repeating radial gradient). */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            <pattern id="dots" width="21" height="21" patternUnits="userSpaceOnUse">
              <circle cx="10.5" cy="10.5" r="1.1" fill={INK} fillOpacity="0.15" />
            </pattern>
          </defs>
          <rect width="1200" height="630" fill="url(#dots)" />
        </svg>

        {/* The brand, where the page's nav puts it. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark width={30} color={ACCENT} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{SITE_NAME}</div>
        </div>

        {/* The headline, as the page sets it: two lines, the claim in pink. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: "-0.018em",
          }}
        >
          <div style={{ display: "flex" }}>{LEAD}</div>
          <div style={{ display: "flex" }}>{REST}</div>
        </div>

        {/* The window, rising off the bottom edge. */}
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            top: 356,
            height: 300,
            display: "flex",
            padding: 10,
            borderRadius: 18,
            border: `1px solid ${RIM}`,
            background: WINDOW,
            boxShadow: "0 -30px 70px -24px rgba(0,0,0,0.9)",
          }}
        >
          {/* The sidebar, with the page it is on lit. */}
          <div style={{ display: "flex", flexDirection: "column", width: 178, padding: "38px 8px 0 4px", gap: 4 }}>
            <div style={{ display: "flex", padding: "0 10px 8px", fontSize: 13, fontWeight: 500, color: FAINT }}>{SITE_NAME}</div>
            {SIDE.map((row) => (
              <div
                key={row}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 34,
                  padding: "0 10px",
                  borderRadius: 9,
                  background: row === "Modules" ? "rgba(255,255,255,0.075)" : "transparent",
                  fontSize: 16,
                  fontWeight: row === "Modules" ? 700 : 500,
                  color: row === "Modules" ? INK : DIM,
                }}
              >
                <Glyph paths={FOLDER_GLYPH} size={17} color={row === "Modules" ? INK : DIM} weight={1.8} />
                {row}
                {row === "Modules" ? (
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 500, color: FAINT }}>{MODULE_COUNT}</span>
                ) : null}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
            {/* The tab strip: one folder tab, and the search field. */}
            <div style={{ display: "flex", alignItems: "flex-end", height: 44 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: 138,
                  height: 38,
                  padding: "0 16px",
                  borderTopLeftRadius: 11,
                  borderTopRightRadius: 11,
                  borderTop: `1px solid ${RIM}`,
                  borderLeft: `1px solid ${RIM}`,
                  borderRight: `1px solid ${RIM}`,
                  background: PAGE,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <Mark width={15} color={INK} />
                Modules
              </div>
              <div style={{ display: "flex", alignItems: "center", height: 38, padding: "0 14px", fontSize: 22, color: FAINT }}>+</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: 210,
                  height: 30,
                  marginLeft: "auto",
                  marginBottom: 7,
                  marginRight: 6,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: `1px solid ${RIM}`,
                  background: "rgba(255,255,255,0.04)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: FAINT,
                }}
              >
                <Glyph paths={SEARCH_GLYPH} size={15} color={FAINT} />
                Search
              </div>
            </div>

            {/* The raised page. Its top edge runs from the tab's right foot,
                so the tab and the page are one sheet. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                position: "relative",
                padding: "20px 20px 0",
                borderTopRightRadius: 14,
                borderLeft: `1px solid ${RIM}`,
                borderRight: `1px solid ${RIM}`,
                background: PAGE,
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 138, right: 0, height: 1, background: RIM, display: "flex" }} />
              <div style={{ display: "flex", gap: 12 }}>
                {CARDS.map((card) => (
                  <div
                    key={card.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      height: 220,
                      position: "relative",
                      overflow: "hidden",
                      padding: "22px 18px",
                      borderRadius: 12,
                      border: `1px solid ${RIM}`,
                      background: CARD,
                    }}
                  >
                    {/* The big faint glyph in the corner, as on the wall. */}
                    <div style={{ position: "absolute", top: -14, right: -14, display: "flex" }}>
                      <Glyph paths={GLYPHS[card.key]} size={78} color="rgba(255,255,255,0.05)" weight={1.4} />
                    </div>
                    <Glyph paths={GLYPHS[card.key]} size={21} color={card.hue} />
                    <div style={{ display: "flex", marginTop: 14, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{card.name}</div>
                    <div style={{ display: "flex", marginTop: 6, fontSize: 15, fontWeight: 500, lineHeight: 1.4, color: DIM }}>{card.purpose}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
