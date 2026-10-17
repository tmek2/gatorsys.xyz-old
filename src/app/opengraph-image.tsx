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
const LEAD = "A better server starts";
const REST = "with Gator.";
const CLAIM = "For free.";

export const alt = `${LEAD} ${REST} ${CLAIM} ${SITE_NAME}'s landing page, with its window of modules.`;
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
const SIDE = ["Gator", "Modules", "Documentation", "Support"];

const GATOR_PATH = "M5098 6022 c-31 -14 -219 -185 -234 -213 -7 -15 -23 -67 -34 -114 -30 -127 -43 -146 -254 -363 -140 -143 -181 -172 -323 -223 -176 -64 -258 -147 -304 -306 -15 -55 -28 -75 -79 -128 -102 -104 -161 -216 -190 -360 -16 -85 -20 -95 -33 -95 -7 -1 -104 -52 -217 -114 l-205 -114 -6 63 c-6 72 -47 150 -112 213 -43 42 -52 37 -63 -34 -10 -67 -10 -67 -118 -39 -154 39 -262 31 -203 -15 15 -12 33 -27 40 -33 6 -7 33 -30 60 -51 26 -21 47 -41 47 -45 0 -3 -21 -18 -47 -31 -82 -43 -143 -81 -143 -90 0 -12 90 -30 192 -37 l90 -6 -7 -26 c-3 -14 -9 -77 -12 -138 l-6 -113 46 0 c58 0 161 37 309 111 l116 58 -44 -83 c-171 -321 -259 -670 -305 -1199 -7 -85 -16 -134 -21 -129 -5 5 -26 36 -46 69 -114 184 -173 245 -251 258 -59 10 -85 -26 -145 -206 -19 -55 -37 -103 -40 -106 -3 -3 -34 2 -70 12 -69 19 -217 18 -237 -2 -7 -7 12 -28 58 -65 37 -31 78 -66 91 -78 l23 -22 -23 -16 c-64 -44 -169 -135 -165 -145 9 -28 160 -26 250 3 l27 9 0 -97 c0 -125 8 -137 52 -86 18 21 60 67 93 102 70 74 102 124 111 170 10 52 18 46 48 -36 16 -42 55 -131 87 -198 l59 -121 -16 -54 c-12 -40 -29 -68 -67 -107 l-52 -53 -1 -82 c0 -98 -25 -155 -84 -192 -60 -38 -82 -73 -77 -120 7 -66 -39 -130 -108 -150 -67 -19 -99 -55 -91 -103 4 -30 0 -36 -45 -72 -38 -30 -60 -40 -87 -40 -76 -1 -152 -51 -152 -101 0 -27 -6 -33 -55 -55 -42 -20 -59 -23 -74 -15 -56 30 -151 0 -151 -48 0 -32 -7 -36 -72 -46 -33 -5 -54 -2 -76 9 -57 30 -165 14 -175 -25 -7 -27 -84 -26 -131 2 -30 17 -46 20 -101 15 -214 -19 -194 -20 -215 7 -30 38 -200 66 -200 33 0 -26 -17 -27 -74 -5 -45 16 -56 25 -56 43 0 36 -25 52 -245 151 -179 81 -398 249 -505 387 -26 34 -40 36 -40 6 0 -38 78 -257 121 -344 103 -205 363 -428 689 -590 73 -37 151 -79 173 -95 34 -25 49 -29 103 -29 75 0 142 -21 203 -63 l44 -30 67 13 c81 15 138 8 202 -25 58 -30 73 -31 121 -5 50 27 138 27 210 -1 53 -20 55 -20 87 -2 18 10 44 24 59 32 29 16 154 20 214 7 35 -8 39 -6 72 28 54 57 165 86 247 63 29 -8 91 35 103 72 10 33 136 84 194 79 55 -5 73 6 104 68 25 49 133 114 189 114 51 0 63 10 101 85 20 39 46 66 123 125 129 99 218 183 265 250 76 110 120 151 174 164 47 11 52 16 77 67 16 30 32 75 36 100 16 87 58 131 159 167 48 18 162 68 253 111 91 44 166 78 166 78 1 -1 -5 -42 -13 -92 -18 -113 -4 -335 21 -335 6 0 41 32 78 72 l67 73 99 -98 c55 -53 104 -97 111 -97 13 0 15 166 2 223 l-9 37 42 0 c46 0 151 16 210 31 l38 10 -28 31 c-30 32 -152 94 -241 123 -60 20 -60 19 -32 118 50 176 31 317 -42 317 -86 0 -303 -59 -456 -124 -34 -14 -65 -26 -68 -26 -2 0 11 28 31 63 208 365 295 692 306 1139 2 65 5 118 8 118 3 0 23 -34 44 -76 63 -123 167 -262 221 -298 24 -16 26 -15 55 15 16 18 51 73 77 124 l47 92 58 -24 c64 -26 205 -59 214 -51 9 9 -30 79 -76 137 -23 29 -40 54 -38 55 1 2 44 12 93 24 105 24 145 38 145 51 0 23 -191 81 -267 81 -39 0 -39 -5 -9 92 18 57 12 62 -51 47 -86 -21 -150 -57 -201 -115 l-49 -55 -13 33 c-7 18 -53 116 -102 217 -48 101 -88 186 -88 188 0 3 23 37 51 76 95 130 132 235 154 429 5 47 15 69 52 120 88 119 120 226 109 355 -6 67 -4 82 44 235 27 90 60 208 71 263 25 116 42 153 106 232 111 136 136 237 93 374 -47 149 -84 180 -223 185 -51 2 -99 1 -109 -4z";

function Mark({ width, color }: { width: number; color: string }) {
  return (
    <svg width={width} height={Math.round((width * 604) / 554)} viewBox="0 0 554 604" fill={color}>
      <g transform="translate(0,604) scale(0.1,-0.1)">
        <path d={GATOR_PATH} />
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
const LETTERS = [SITE_NAME, LEAD, REST, CLAIM, String(MODULE_COUNT), "Search+", ...SIDE, ...CARDS.flatMap((card) => [card.name, card.purpose])].join("");

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
          <div style={{ display: "flex", gap: 20 }}>
            <span>{REST}</span>
            <span style={{ color: ACCENT }}>{CLAIM}</span>
          </div>
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
