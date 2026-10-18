/* A drawing per module, in two states (before and after Bot).

   - Each module has its own objects, drawn from what it replaces:
       sessions     a pinned message and people asking, vs a panel
       punishments  a sticky note and a bin, vs a searchable record
       infractions  a stamp landing unread, vs an approval step
       promotions   roles ticked by hand, vs a rank moving on its own
       shifts       a spreadsheet and a pencil, vs a stopwatch
       leave        a note taped over a calendar, vs dates on it
       departments  one endless list, vs a chart of three
       tickets      DMs converging on one person, vs a queue
       gatorai      one question asked five times, vs one answer
       erlc         two windows fighting, vs one with a panel beside it
   - The window's greys plus one accent per side: red for what is missing or
     wrong, pink for what the bot does.
   - The byline says who does the work: a person before, Bot (mark, name, app
     tag) after.
   - Before and after are one function taking `on`, so everything sits at the
     same coordinates and the wipe lines up.
   - Every length is a literal, so server and client render identically.
   - Modules with real screenshots (shots.ts) show those instead; their drawings
     stay here as the fallback. */

import type { ReactNode } from "react";
import { AppLogo } from "../app-logo";

const W = 640;
const H = 420;

/* The window's greys, and the two accents. */
const SHELL = "#202020";
const BAR = "#2e2e2e";
const PANE = "#343434";
const LINE = "#424242";
const INK = "#f3f3f3";
const TEXT = "#b5bac1";
const DIM = "#525252";
const FAINT = "#3d3d3d";
const RED = "#e4626a";
/* Discord's blurple for the app tag, the one colour not chosen by the site. */
const BLURPLE = "#5865f2";
const PINK = "#f7a8c4";

const FONT =
  "var(--font-inter), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ------------------------------------------------------------- primitives */

const Bar = ({
  x, y, w, h = 6, fill = DIM, op = 1, r,
}: { x: number; y: number; w: number; h?: number; fill?: string; op?: number; r?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={r ?? h / 2} fill={fill} opacity={op} />
);

const Box = ({
  x, y, w, h, fill = "#ffffff", op = 0.04, r = 12, stroke, dash, sw = 1.6,
}: {
  x: number; y: number; w: number; h: number; fill?: string; op?: number; r?: number;
  stroke?: string; dash?: boolean; sw?: number;
}) => (
  /* `fillOpacity`, not `opacity`, so a faint fill keeps a visible outline. */
  <rect
    x={x} y={y} width={w} height={h} rx={r}
    fill={fill} fillOpacity={op}
    stroke={stroke} strokeWidth={stroke ? sw : undefined}
    strokeOpacity={stroke ? 0.9 : undefined}
    strokeDasharray={dash ? "6 5" : undefined}
  />
);

const Ava = ({ x, y, r = 11, fill = DIM, op = 1 }: { x: number; y: number; r?: number; fill?: string; op?: number }) => (
  <circle cx={x} cy={y} r={r} fill={fill} opacity={op} />
);

const Tick = ({ x, y, c = PINK, s = 1 }: { x: number; y: number; c?: string; s?: number }) => (
  <path d={`M${x} ${y} l${4 * s} ${4 * s} l${7 * s} ${-8 * s}`} stroke={c} strokeWidth={2.4 * s} fill="none" strokeLinecap="round" strokeLinejoin="round" />
);

const Cross = ({ x, y, c = RED, s = 1 }: { x: number; y: number; c?: string; s?: number }) => (
  <path d={`M${x} ${y} l${8 * s} ${8 * s} M${x + 8 * s} ${y} l${-8 * s} ${8 * s}`} stroke={c} strokeWidth={2.3 * s} strokeLinecap="round" />
);

const Query = ({ x, y, c = RED }: { x: number; y: number; c?: string }) => (
  <path
    d={`M${x} ${y} a4.6 4.6 0 0 1 8.2 2.5 c0 2.7 -4.1 3.1 -4.1 5.6 M${x + 4.1} ${y + 12.8} l0 0.6`}
    stroke={c} strokeWidth="2.3" fill="none" strokeLinecap="round"
  />
);

/** A message, with a tail, so it is a message rather than a rectangle. */
const Bubble = ({
  x, y, w, h, c = "#ffffff", op = 0.07, tail = "left",
}: { x: number; y: number; w: number; h: number; c?: string; op?: number; tail?: "left" | "right" | "none" }) => (
  <g fill={c} fillOpacity={op}>
    <rect x={x} y={y} width={w} height={h} rx={11} />
    {tail === "left" ? <path d={`M${x + 3} ${y + h - 13} l-10 13 l15 0 z`} /> : null}
    {tail === "right" ? <path d={`M${x + w - 3} ${y + h - 13} l10 13 l-15 0 z`} /> : null}
  </g>
);

/** A thumbtack, for the thing every server pins and nobody reads. */
const Pin = ({ x, y, c = DIM }: { x: number; y: number; c?: string }) => (
  <g stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x - 9} ${y - 13} l18 0 l-4.5 6 l0 7 l6.5 5 l-22 0 l6.5 -5 l0 -7 z`} />
    <path d={`M${x} ${y + 5} l0 11`} />
  </g>
);

/** A direct message. */
const Env = ({ x, y, w = 34, h = 24, c = DIM, op = 1 }: { x: number; y: number; w?: number; h?: number; c?: string; op?: number }) => (
  <g stroke={c} strokeOpacity={op} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
    <rect x={x} y={y} width={w} height={h} rx={4} />
    <path d={`M${x + 3} ${y + 4} L${x + w / 2} ${y + h * 0.62} L${x + w - 3} ${y + 4}`} />
  </g>
);

/** A stopwatch: hours that count themselves. */
const Watch = ({ x, y, r = 26, c = PINK }: { x: number; y: number; r?: number; c?: string }) => (
  <g stroke={c} strokeWidth="2.6" fill="none" strokeLinecap="round">
    <circle cx={x} cy={y} r={r} />
    <path d={`M${x} ${y - r + 7} l0 ${r - 7} l${r * 0.46} ${r * 0.3}`} />
    <path d={`M${x - 8} ${y - r - 8} l16 0 M${x} ${y - r - 8} l0 8`} />
  </g>
);

/** A magnifier, for a history you can actually look things up in. */
const Mag = ({ x, y, r = 7.5, c = PINK }: { x: number; y: number; r?: number; c?: string }) => (
  <g stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round">
    <circle cx={x} cy={y} r={r} />
    <path d={`M${x + r * 0.72} ${y + r * 0.72} l6.5 6.5`} />
  </g>
);

/** Rank, as the insignia everyone in these servers already wears. */
const Chev = ({ x, y, n, c = DIM, op = 1 }: { x: number; y: number; n: number; c?: string; op?: number }) => (
  <g stroke={c} strokeOpacity={op} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {[0, 1, 2, 3].slice(0, n).map((i) => (
      <path key={i} d={`M${x - 13} ${y + i * 9 + 7} l13 -8 l13 8`} />
    ))}
  </g>
);

/** A saved transcript. */
const Doc = ({ x, y, w = 28, h = 36, c = PINK, op = 1 }: { x: number; y: number; w?: number; h?: number; c?: string; op?: number }) => (
  <g stroke={c} strokeOpacity={op} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    <path d={`M${x} ${y} l${w - 9} 0 l9 9 l0 ${h - 9} l${-w} 0 z`} />
    <path d={`M${x + w - 9} ${y} l0 9 l9 0`} />
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${x + 6} ${y + 17 + i * 6.5} l${w - 15} 0`} strokeOpacity={op * 0.55} strokeWidth="1.6" />
    ))}
  </g>
);

/** The pencil doing by hand what nothing is doing for you. */
const Pencil = ({ x, y, c = RED }: { x: number; y: number; c?: string }) => (
  <g stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x} ${y + 20} l3.5 -9 l16 -16 l5.5 5.5 l-16 16 z`} />
    <path d={`M${x + 15} ${y - 4} l5.5 5.5`} />
  </g>
);

/** Where a note goes when nobody kept it. */
const Bin = ({ x, y, c = RED }: { x: number; y: number; c?: string }) => (
  <g stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x - 12} ${y} l24 0 M${x - 5} ${y - 6} l10 0`} />
    <path d={`M${x - 9.5} ${y + 3} l1.8 21 a2.4 2.4 0 0 0 2.4 2.2 l10.6 0 a2.4 2.4 0 0 0 2.4 -2.2 l1.8 -21`} />
  </g>
);

/** The pointer, mid-job, because somebody is doing this a click at a time. */
const Cursor = ({ x, y, c = RED }: { x: number; y: number; c?: string }) => (
  <path
    d={`M${x} ${y} l0 17 l4.4 -4.4 l3.2 7.4 l3.4 -1.5 l-3.2 -7.2 l6 -0.4 z`}
    fill={c} stroke={SHELL} strokeWidth="1.3" strokeLinejoin="round"
  />
);

/** A tickbox that is either done or waiting for somebody. */
const Check = ({ x, y, on, c = PINK }: { x: number; y: number; on: boolean; c?: string }) => (
  <>
    <rect x={x} y={y} width={17} height={17} rx={5} fill={on ? c : "none"} fillOpacity={on ? 0.92 : 0} stroke={on ? c : DIM} strokeWidth="1.9" strokeOpacity="0.9" />
    {on ? <path d={`M${x + 4.4} ${y + 8.6} l3.2 3.2 l5.4 -6.4`} stroke={SHELL} strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
  </>
);

/** The one mark that says a machine did this. */
const Spark = ({ x, y, s = 1, c = PINK }: { x: number; y: number; s?: number; c?: string }) => (
  <path
    d={`M${x} ${y - 10 * s} l${2.8 * s} ${7.2 * s} l${7.2 * s} ${2.8 * s} l${-7.2 * s} ${2.8 * s} l${-2.8 * s} ${7.2 * s} l${-2.8 * s} ${-7.2 * s} l${-7.2 * s} ${-2.8 * s} l${7.2 * s} ${-2.8 * s} z`}
    fill={c}
  />
);

const Arrow = ({
  x1, y1, x2, y2, c, w = 2.6,
}: { x1: number; y1: number; x2: number; y2: number; c: string; w?: number }) => {
  const up = y2 < y1 - 1;
  return (
    <g stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x1} ${y1} L${x2} ${y2}`} />
      {up
        ? <path d={`M${x2 - 7} ${y2 + 9} L${x2} ${y2} L${x2 + 7} ${y2 + 9}`} />
        : <path d={`M${x2 - 9} ${y2 - 7} L${x2} ${y2} L${x2 - 9} ${y2 + 7}`} />}
    </g>
  );
};

/* --------------------------------------------------------------- the frame */

/**
 * The window, the byline, then the module's own picture. The byline is shared
 * by every scene: it answers who is doing the work.
 */
function Win({ children, on }: { children: ReactNode; on: boolean }) {
  return (
    <>
      <rect x="0" y="0" width={W} height={H} rx="14" fill={SHELL} />
      <rect x="0" y="0" width={W} height="34" rx="14" fill={BAR} />
      <rect x="0" y="20" width={W} height="14" fill={BAR} />
      <circle cx="22" cy="17" r="5" fill={FAINT} />
      <circle cx="38" cy="17" r="5" fill={FAINT} />
      <circle cx="54" cy="17" r="5" fill={FAINT} />
      <line x1="0" y1="34" x2={W} y2="34" stroke={LINE} strokeWidth="1" />
      <rect x="0" y="34" width={W} height={H - 34} fill={PANE} />

      {/* The byline as Discord draws it: a round avatar, the name, the app tag
         in blurple with its check, then the timestamp. */}
      <circle cx="52" cy="66" r="18" fill={on ? PINK : DIM} />
      {on ? (
        <>
          <g transform="translate(41, 55)" style={{ color: SHELL }}>
            <AppLogo size={22} />
          </g>
          <text x="82" y="62" fontFamily={FONT} fontSize="16" fontWeight="600" fill={INK}>
            Bot
          </text>
          <rect x="131" y="50" width="53" height="17" rx="4" fill={BLURPLE} />
          <path d="M138 58.6 l2.6 2.6 l4.6 -5.4" stroke="#ffffff" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="150" y="63" fontFamily={FONT} fontSize="10.5" fontWeight="700" fill="#ffffff" letterSpacing="0.02em">
            APP
          </text>
          <Bar x={194} y={56} w={74} h={6} fill={TEXT} op={0.3} />
        </>
      ) : (
        <>
          <Bar x={82} y={52} w={94} h={9} fill={TEXT} op={0.42} />
          <Bar x={186} y={55} w={66} h={6} fill={TEXT} op={0.22} />
        </>
      )}
      <line x1="32" y1="92" x2={W - 32} y2="92" stroke={LINE} strokeWidth="1" />

      {children}
    </>
  );
}

/* ------------------------------------------------------------ the ten pairs */

/* Each is one function. `on` is the after. The blocks are at one set of
   coordinates and only their contents change. */
type Draw = (on: boolean) => ReactNode;

/* -------------------------------------------------------------- sessions */
/* A pinned message people keep asking about, or a panel that answers them. */
const sessions: Draw = (on) => (
  <>
    <Box x={32} y={110} w={576} h={122} op={on ? 0.06 : 0.03} />
    {on ? <rect x="32" y="110" width="4" height="122" rx="2" fill={PINK} /> : null}

    {on ? (
      <>
        {/* A panel: a heading, a button, and the people who pressed it. */}
        <Bar x={58} y={134} w={148} h={9} fill={PINK} op={0.95} />
        <Bar x={58} y={158} w={264} h={6} fill={TEXT} op={0.3} />
        <rect x="58" y="182" width="140" height="34" rx="17" fill={PINK} />
        <Bar x={92} y={196} w={72} h={7} fill={SHELL} op={0.85} />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={238 + i * 21} cy={199} r={12} fill={DIM} stroke={PANE} strokeWidth="2.5" />
        ))}
        <rect x="352" y="187" width="52" height="24" rx="12" fill={PINK} fillOpacity="0.22" />
        <Bar x={366} y={196} w={24} h={6} fill={PINK} op={0.9} />
      </>
    ) : (
      <>
        {/* A pinned message, four days old, that answers nothing. */}
        <Pin x={62} y={142} c={DIM} />
        <Bar x={84} y={134} w={116} h={8} fill={TEXT} op={0.38} />
        <Bar x={58} y={166} w={324} h={6} fill={TEXT} op={0.22} />
        <Bar x={58} y={186} w={252} h={6} fill={TEXT} op={0.22} />
        <Bar x={58} y={206} w={188} h={6} fill={TEXT} op={0.16} />
        <Cross x={562} y={134} s={1} />
      </>
    )}

    {/* The same three people underneath, asking or listed. */}
    {[256, 306, 356].map((y, i) => (
      <g key={y}>
        <Ava x={50} y={y + 14} r={14} fill={DIM} op={on ? 0.9 : 1} />
        <Bar x={76} y={y + 4} w={[128, 104, 142][i]} h={7} fill={TEXT} op={on ? 0.42 : 0.4} />
        {on ? (
          <>
            <rect x={76} y={y + 20} width="74" height="18" rx="9" fill={PINK} fillOpacity="0.2" />
            <Bar x={88} y={y + 26} w={50} h={5} fill={PINK} op={0.85} />
            <Tick x={578} y={y + 12} s={1} />
          </>
        ) : (
          <>
            <Bubble x={76} y={y + 18} w={[206, 168, 234][i]} h={24} tail="none" />
            <Bar x={92} y={y + 27} w={[150, 118, 178][i]} h={6} fill={TEXT} op={0.28} />
            <Query x={576} y={y + 10} />
          </>
        )}
      </g>
    ))}
  </>
);

/* ----------------------------------------------------------- punishments */
/* A note that gets thrown away, or a record you can search. */
const punishments: Draw = (on) => (
  <>
    {on ? (
      <>
        {/* The search bar is the whole point: a history you can ask questions of. */}
        <Box x={32} y={112} w={576} h={40} op={0.06} r={20} />
        <Mag x={62} y={132} />
        <Bar x={86} y={129} w={148} h={7} fill={PINK} op={0.8} />
        <rect x="536" y="122" width="52" height="20" rx="10" fill={PINK} fillOpacity="0.2" />
        <Bar x={550} y={129} w={24} h={6} fill={PINK} op={0.85} />

        {/* Three cases, each with its number and the history behind it. */}
        {[170, 246, 322].map((y, i) => (
          <g key={y}>
            <Box x={32} y={y} w={576} h={64} op={0.04} />
            <Ava x={64} y={y + 32} r={16} fill={DIM} />
            <Bar x={90} y={y + 18} w={[142, 118, 156][i]} h={7} fill={TEXT} op={0.5} />
            <Bar x={90} y={y + 38} w={[228, 262, 196][i]} h={6} fill={TEXT} op={0.24} />
            <rect x={430} y={y + 22} width="62" height="20" rx="6" fill={PINK} fillOpacity="0.18" />
            <Bar x={442} y={y + 29} w={38} h={6} fill={PINK} op={0.8} />
            {/* The case's own timeline, three marks on a line. */}
            <line x1={512} y1={y + 32} x2={578} y2={y + 32} stroke={PINK} strokeOpacity="0.35" strokeWidth="1.6" />
            {[0, 1, 2].map((d) => (
              <circle key={d} cx={512 + d * 33} cy={y + 32} r={4.5} fill={PINK} opacity={0.5 + d * 0.2} />
            ))}
          </g>
        ))}
      </>
    ) : (
      <>
        {/* One note, in somebody's hand, on its way to the bin. */}
        <g transform="rotate(-5 232 250)">
          <rect x="72" y="140" width="320" height="216" rx="6" fill="#ffffff" fillOpacity="0.1" />
          <Bar x={100} y={172} w={168} h={8} fill={TEXT} op={0.4} />
          {[204, 236, 268, 300].map((y, i) => (
            <g key={y}>
              <Bar x={100} y={y} w={[214, 178, 236, 156][i]} h={6} fill={TEXT} op={0.26} />
              {i === 1 ? <path d="M96 239 l190 -6" stroke={RED} strokeWidth="2" strokeLinecap="round" /> : null}
            </g>
          ))}
        </g>
        <Bin x={520} y={238} />
        {/* And the one that already went in. */}
        <g transform="rotate(14 500 336)" opacity="0.5">
          <rect x="468" y="312" width="64" height="46" rx="5" fill="#ffffff" fillOpacity="0.07" />
          <Bar x={480} y={328} w={40} h={5} fill={TEXT} op={0.3} />
          <Bar x={480} y={342} w={28} h={5} fill={TEXT} op={0.2} />
        </g>
        <Cross x={562} y={130} s={1.1} />
      </>
    )}
  </>
);

/* ----------------------------------------------------------- infractions */
/* A stamp that lands before anyone reads it, or a step in between. */
const infractions: Draw = (on) => (
  <>
    {/* The case, written up. Same card both sides. */}
    <Box x={32} y={176} w={190} h={150} op={0.045} />
    <Ava x={62} y={208} r={16} fill={DIM} />
    {[236, 258, 280, 302].map((y, i) => (
      <Bar key={y} x={56} y={y} w={[134, 108, 142, 92][i]} h={6} fill={TEXT} op={0.28} />
    ))}

    {/* The middle: a review, or the absence of one. */}
    <Box
      x={248} y={194} w={150} h={114}
      fill={on ? PINK : "none"} op={on ? 0.12 : 1}
      stroke={on ? `${PINK}66` : `${RED}77`} dash={!on}
    />
    {on ? (
      <>
        <Ava x={278} y={224} r={13} fill={PINK} op={0.95} />
        <Bar x={298} y={220} w={62} h={7} fill={PINK} op={0.85} />
        {/* Approve or deny, which is the whole of the module. */}
        <rect x="268" y="258" width="52" height="28" rx="8" fill={PINK} fillOpacity="0.9" />
        <Tick x={286} y={270} c={SHELL} s={0.95} />
        <rect x="330" y="258" width="52" height="28" rx="8" fill="#ffffff" fillOpacity="0.07" stroke={LINE} strokeWidth="1.4" />
        <Cross x={350} y={266} c={TEXT} s={0.85} />
      </>
    ) : (
      <Cross x={315} y={243} s={1.2} />
    )}

    <Arrow x1={228} y1={251} x2={242} y2={251} c={on ? PINK : RED} />
    <Arrow x1={404} y1={251} x2={432} y2={251} c={on ? PINK : RED} />

    {/* The outcome. Before, a stamp has already hit it. */}
    <Box x={440} y={194} w={168} h={114} op={0.05} />
    {on ? (
      <>
        <Tick x={468} y={222} s={1.2} />
        <Bar x={496} y={220} w={72} h={7} fill={PINK} op={0.85} />
        <Bar x={468} y={250} w={112} h={6} fill={TEXT} op={0.26} />
        <rect x="468" y="272" width="86" height="20" rx="10" fill={PINK} fillOpacity="0.2" />
        <Bar x={480} y={279} w={62} h={6} fill={PINK} op={0.8} />
      </>
    ) : (
      <>
        <Bar x={468} y={220} w={112} h={6} fill={TEXT} op={0.22} />
        <Bar x={468} y={238} w={84} h={6} fill={TEXT} op={0.22} />
        <g transform="rotate(-12 524 268)">
          <rect x="466" y="246" width="116" height="44" rx="7" fill="none" stroke={RED} strokeWidth="2.6" strokeOpacity="0.85" />
          <Bar x={484} y={264} w={80} h={7} fill={RED} op={0.85} />
        </g>
      </>
    )}
  </>
);

/* ------------------------------------------------------------ promotions */
/* Roles ticked one at a time, or a rank that moves and takes the rest with it. */
const promotions: Draw = (on) => (
  <>
    {/* The roles. Boxes get ticked either way; the question is by whom. */}
    <Box x={32} y={110} w={286} h={172} op={0.04} />
    <Bar x={56} y={132} w={96} h={7} fill={on ? PINK : DIM} op={on ? 0.85 : 0.6} />
    {[162, 200, 238].map((y, i) => (
      <g key={y}>
        <Check x={56} y={y} on={on || i === 0} c={on ? PINK : DIM} />
        <Bar x={86} y={y + 5} w={[152, 118, 176][i]} h={7} fill={TEXT} op={on ? 0.42 : 0.28} />
      </g>
    ))}
    {/* Somebody is mid-click on the second one. */}
    {on ? null : <Cursor x={64} y={206} />}

    {/* The rank. Two stripes, then three. */}
    <Box x={340} y={110} w={268} h={172} op={0.04} />
    <Chev x={392} y={162} n={2} c={on ? PINK : DIM} op={on ? 0.35 : 0.75} />
    {on ? (
      <>
        <Arrow x1={444} y1={186} x2={496} y2={186} c={PINK} />
        <Chev x={548} y={162} n={3} c={PINK} />
        <Bar x={378} y={244} w={192} h={7} fill={PINK} op={0.6} />
      </>
    ) : (
      <>
        <Cross x={462} y={178} s={1.2} />
        <Bar x={378} y={244} w={124} h={7} fill={RED} op={0.5} />
      </>
    )}

    {/* And whether anybody told them. */}
    <Box x={32} y={300} w={576} h={82} op={0.035} />
    <Env x={62} y={328} c={on ? PINK : DIM} />
    {on ? (
      <>
        <Bubble x={116} y={318} w={300} h={44} c={PINK} op={0.14} tail="left" />
        <Bar x={136} y={330} w={188} h={7} fill={PINK} op={0.8} />
        <Bar x={136} y={346} w={244} h={6} fill={TEXT} op={0.26} />
        <Tick x={560} y={334} s={1.1} />
      </>
    ) : (
      <>
        <Bar x={116} y={332} w={168} h={7} fill={TEXT} op={0.2} />
        <Bar x={116} y={350} w={112} h={6} fill={TEXT} op={0.14} />
        <Cross x={560} y={332} s={1.1} />
      </>
    )}
  </>
);

/* ---------------------------------------------------------------- shifts */
/* A spreadsheet somebody keeps by hand, or hours that count themselves. */
const shifts: Draw = (on) =>
  on ? (
    <>
      <Watch x={94} y={188} r={34} />
      <Bar x={48} y={252} w={92} h={7} fill={PINK} op={0.8} />
      <Bar x={56} y={272} w={76} h={6} fill={TEXT} op={0.24} />
      {/* Hours, per person, without anybody writing them down. */}
      {[116, 168, 220, 272, 324].map((y, i) => (
        <g key={y}>
          <Ava x={196} y={y + 16} r={13} fill={DIM} />
          <Bar x={220} y={y + 6} w={[104, 84, 118, 92, 110][i]} h={7} fill={TEXT} op={0.4} />
          <rect x={220} y={y + 24} width={[268, 214, 306, 176, 240][i]} height="12" rx="6" fill={PINK} fillOpacity={0.85 - i * 0.1} />
          <Bar x={548} y={y + 12} w={[44, 36, 50, 30, 40][i]} h={7} fill={PINK} op={0.5} />
        </g>
      ))}
    </>
  ) : (
    <>
      {/* A grid with holes in it, and the pencil that keeps it. */}
      <Box x={32} y={110} w={430} h={272} op={0.035} r={8} />
      {[0, 1, 2, 3].map((c) => (
        <line key={c} x1={32 + (c + 1) * 86} y1={110} x2={32 + (c + 1) * 86} y2={382} stroke={LINE} strokeWidth="1" />
      ))}
      {[0, 1, 2, 3, 4].map((r) => (
        <line key={r} x1={32} y1={110 + (r + 1) * 45} x2={462} y2={110 + (r + 1) * 45} stroke={LINE} strokeWidth="1" />
      ))}
      {[
        [1, 1], [1, 0], [0, 1], [1, 1], [0, 0],
        [1, 0], [0, 1], [1, 1], [0, 0], [1, 1],
        [0, 1], [1, 1], [0, 0], [1, 0], [1, 1],
        [1, 1], [0, 0], [1, 0], [1, 1], [0, 1],
        [0, 0], [1, 1], [1, 0], [0, 1], [1, 1],
        [1, 0], [1, 1], [0, 1], [1, 1], [0, 0],
      ].map(([a, bb], k) => {
        const col = k % 5;
        const row = Math.floor(k / 5);
        const x = 46 + col * 86;
        const y = 130 + row * 45;
        return a ? (
          <Bar key={k} x={x} y={y} w={bb ? 56 : 38} h={6} fill={TEXT} op={0.26} />
        ) : (
          <rect key={k} x={x} y={y - 5} width="56" height="16" rx="4" fill={RED} fillOpacity="0.12" />
        );
      })}
      <Pencil x={496} y={166} />
      <Bar x={492} y={228} w={104} h={7} fill={RED} op={0.45} />
      <Bar x={492} y={250} w={72} h={6} fill={TEXT} op={0.2} />
      <Cross x={534} y={306} s={1.2} />
    </>
  );

/* ------------------------------------------------------------------- loa */
/* A note taped over the calendar, or the days actually on it. */
const loa: Draw = (on) => (
  <>
    {/* Who is away. */}
    <Ava x={82} y={168} r={30} fill={on ? PINK : DIM} op={on ? 0.9 : 1} />
    <Bar x={44} y={214} w={76} h={7} fill={TEXT} op={on ? 0.45 : 0.35} />
    {on ? (
      <>
        <rect x="40" y="234" width="84" height="22" rx="11" fill={PINK} fillOpacity="0.22" />
        <Bar x={54} y={242} w={56} h={6} fill={PINK} op={0.9} />
        <Bar x={44} y={278} w={76} h={6} fill={TEXT} op={0.24} />
        <Bar x={44} y={296} w={58} h={6} fill={TEXT} op={0.18} />
      </>
    ) : (
      <Query x={72} y={240} />
    )}

    {/* The month, either way. */}
    <Box x={168} y={110} w={440} h={272} op={0.04} r={10} />
    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
      <Bar key={d} x={188 + d * 60} y={132} w={22} h={5} fill={TEXT} op={0.2} />
    ))}
    {[152, 210, 268, 326].map((y) => (
      <g key={y}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <rect key={d} x={184 + d * 60} y={y} width={48} height={44} rx={7} fill="#ffffff" fillOpacity="0.035" />
        ))}
      </g>
    ))}
    {on ? (
      <>
        {/* On the days it covers, and a day it ends. */}
        <rect x="304" y="222" width="228" height="22" rx="11" fill={PINK} />
        <Bar x={324} y={229} w={92} h={7} fill={SHELL} op={0.75} />
        <rect x="304" y="338" width="108" height="20" rx="10" fill={PINK} fillOpacity="0.25" />
        <Bar x={318} y={345} w={64} h={6} fill={PINK} op={0.9} />
      </>
    ) : (
      /* Taped over it, belonging to no day at all. */
      <g transform="rotate(-6 390 244)">
        <rect x="272" y="196" width="236" height="96" rx="5" fill="#ffffff" fillOpacity="0.17" />
        <Bar x={296} y={222} w={124} h={7} fill={TEXT} op={0.4} />
        <Bar x={296} y={246} w={172} h={6} fill={TEXT} op={0.26} />
        <Cross x={470} y={212} s={0.95} />
      </g>
    )}
  </>
);

/* ------------------------------------------------------------ department */
/* One list that never ends, or a chart of who is in what. */
const department: Draw = (on) =>
  on ? (
    <>
      <rect x="256" y="110" width="128" height="36" rx="9" fill={PINK} />
      <Bar x={288} y={124} w={64} h={8} fill={SHELL} op={0.85} />
      <path
        d="M320 146 L320 168 M96 168 L544 168 M96 168 L96 188 M320 168 L320 188 M544 168 L544 188"
        stroke={PINK} strokeOpacity="0.5" strokeWidth="2" fill="none"
      />
      {[96, 320, 544].map((cx, g) => (
        <g key={cx}>
          <Box x={cx - 88} y={188} w={176} h={192} op={0.045} />
          <Bar x={cx - 66} y={210} w={[72, 88, 64][g]} h={7} fill={PINK} op={0.8} />
          <rect x={cx + 34} y={204} width="34" height="18" rx="9" fill={PINK} fillOpacity="0.2" />
          <Bar x={cx + 44} y={210} w={14} h={5} fill={PINK} op={0.9} />
          {[246, 282, 318, 354].map((y, r) => (
            <g key={y}>
              <Ava x={cx - 56} y={y} r={10} fill={DIM} />
              <Bar x={cx - 36} y={y - 4} w={[84, 66, 92, 58][r]} h={6} fill={TEXT} op={0.3} />
            </g>
          ))}
        </g>
      ))}
    </>
  ) : (
    <>
      {/* One column, and it keeps going past the bottom of the window. */}
      <Box x={168} y={110} w={340} h={306} op={0.035} r={10} />
      <Bar x={194} y={132} w={124} h={7} fill={DIM} op={0.6} />
      {[164, 208, 252, 296, 340, 384].map((y, i) => (
        <g key={y} opacity={i === 5 ? 0.5 : 1}>
          <Ava x={214} y={y + 12} r={13} fill={DIM} />
          <Bar x={240} y={y + 2} w={[142, 116, 158, 128, 148, 122][i]} h={7} fill={TEXT} op={0.32} />
          <Bar x={240} y={y + 20} w={[206, 238, 184, 214, 196, 226][i]} h={5} fill={TEXT} op={0.18} />
        </g>
      ))}
      {/* The scrollbar, which is the whole problem in one object. */}
      <rect x="494" y="150" width="6" height="238" rx="3" fill="#ffffff" fillOpacity="0.06" />
      <rect x="494" y="150" width="6" height="44" rx="3" fill={TEXT} fillOpacity="0.32" />
      <Cross x={556} y={128} s={1.1} />
    </>
  );

/* --------------------------------------------------------------- tickets */
/* Every request lands in one person's DMs, or in a queue anybody can work. */
const tickets: Draw = (on) =>
  on ? (
    <>
      <Bar x={44} y={116} w={104} h={8} fill={PINK} op={0.85} />
      <rect x="164" y="110" width="50" height="22" rx="11" fill={PINK} fillOpacity="0.2" />
      <Bar x={177} y={118} w={24} h={6} fill={PINK} op={0.9} />
      {[152, 210, 268, 326].map((y, i) => (
        <g key={y}>
          <Box x={32} y={y} w={576} h={48} op={0.04} />
          {/* Open, taken, or done: three states, one dot. */}
          <circle cx={62} cy={y + 24} r={6} fill={PINK} fillOpacity={[1, 1, 0.4, 0.4][i]} stroke={PINK} strokeWidth="1.6" strokeOpacity="0.9" />
          <Ava x={94} y={y + 24} r={13} fill={DIM} />
          <Bar x={120} y={y + 14} w={[146, 120, 162, 132][i]} h={7} fill={TEXT} op={0.42} />
          <Bar x={120} y={y + 30} w={[214, 246, 190, 224][i]} h={5} fill={TEXT} op={0.2} />
          {/* And when it closes, the transcript stays. */}
          {i >= 2 ? <Doc x={556} y={y + 6} w={26} h={34} /> : <Bar x={534} y={y + 20} w={48} h={7} fill={PINK} op={0.35} />}
        </g>
      ))}
    </>
  ) : (
    <>
      {/* One person, and everybody's message pointing at them. */}
      <Ava x={130} y={242} r={38} fill={DIM} />
      <circle cx="160" cy="212" r="14" fill={RED} stroke={PANE} strokeWidth="3" />
      <Bar x={153} y={209} w={14} h={6} fill={SHELL} op={0.9} />
      <Bar x={84} y={296} w={92} h={7} fill={TEXT} op={0.35} />
      <Bar x={96} y={314} w={68} h={6} fill={TEXT} op={0.2} />
      {[
        [330, 128, 262, 200],
        [412, 196, 288, 226],
        [352, 296, 274, 268],
        [456, 328, 302, 288],
      ].map(([ex, ey, ax, ay], i) => (
        <g key={i}>
          <path d={`M${ex - 6} ${ey + 12} L${ax} ${ay}`} stroke={RED} strokeWidth="1.6" strokeOpacity="0.45" strokeDasharray="5 5" />
          <Env x={ex} y={ey} c={TEXT} op={0.5} />
          <circle cx={ex + 34} cy={ey} r={4.5} fill={RED} />
        </g>
      ))}
      {/* And one that never got read. */}
      <g transform="rotate(16 528 350)" opacity="0.5">
        <Env x={506} y={336} c={TEXT} op={0.4} />
      </g>
      <Cross x={556} y={126} s={1.1} />
    </>
  );

/* --------------------------------------------------------------- gatorai */
/* The same question five times, answered five times, or answered once. */
const gatorai: Draw = (on) => (
  <>
    {/* Five people, and the identical question. Same on both sides, because
        the questions are not the thing that changes. */}
    {[112, 168, 224, 280, 336].map((y) => (
      <g key={y}>
        <Ava x={54} y={y + 20} r={13} fill={DIM} />
        <Bubble x={78} y={y} w={196} h={40} tail="left" />
        <Bar x={98} y={y + 12} w={152} h={6} fill={TEXT} op={0.3} />
        <Bar x={98} y={y + 26} w={116} h={6} fill={TEXT} op={0.2} />
      </g>
    ))}

    {on ? (
      <>
        {/* Five lines into one answer. */}
        {[132, 188, 244, 300, 356].map((y) => (
          <path key={y} d={`M282 ${y} C 330 ${y}, 340 244, 386 244`} stroke={PINK} strokeOpacity="0.35" strokeWidth="1.6" fill="none" />
        ))}
        <Bubble x={398} y={182} w={210} h={124} c={PINK} op={0.15} tail="none" />
        <Spark x={428} y={214} s={1.1} />
        <Bar x={450} y={210} w={112} h={7} fill={PINK} op={0.85} />
        <Bar x={424} y={240} w={158} h={6} fill={TEXT} op={0.3} />
        <Bar x={424} y={258} w={128} h={6} fill={TEXT} op={0.3} />
        <Tick x={424} y={278} s={1.05} />
        <Bar x={448} y={280} w={72} h={6} fill={PINK} op={0.6} />
      </>
    ) : (
      <>
        {/* The same person, typing the same answer, five times over. */}
        {[112, 168, 224, 280, 336].map((y) => (
          <g key={y}>
            <path d={`M282 ${y + 20} l22 0`} stroke={RED} strokeOpacity="0.3" strokeWidth="1.6" />
            <Ava x={328} y={y + 20} r={13} fill={DIM} op={0.8} />
            <Bubble x={352} y={y + 4} w={176} h={32} tail="none" />
            <Bar x={370} y={y + 17} w={136} h={6} fill={TEXT} op={0.24} />
          </g>
        ))}
        {/* Which is the same work, done again, and again. */}
        <g stroke={RED} strokeOpacity="0.5" strokeWidth="1.8" fill="none">
          <rect x="556" y="196" width="42" height="54" rx="7" />
          <rect x="550" y="204" width="42" height="54" rx="7" strokeOpacity="0.34" />
          <rect x="544" y="212" width="42" height="54" rx="7" strokeOpacity="0.2" />
        </g>
        <Cross x={562} y={286} s={1} />
      </>
    )}
  </>
);

/* ------------------------------------------------------------------- prc */
/* Two windows fighting for the screen, or one with the server beside it. */
const prc: Draw = (on) =>
  on ? (
    <>
      <Box x={32} y={110} w={378} h={272} op={0.035} />
      {[142, 178, 214, 250, 286, 322].map((y, i) => (
        <g key={y}>
          <Ava x={62} y={y + 6} r={11} fill={DIM} />
          <Bar x={84} y={y + 2} w={[228, 176, 246, 158, 212, 190][i]} h={6} fill={TEXT} op={0.28} />
        </g>
      ))}
      {/* The server, on the same screen. */}
      <Box x={426} y={110} w={182} h={272} op={0.06} />
      <rect x="426" y="110" width="182" height="4" rx="2" fill={PINK} />
      <Bar x={450} y={134} w={86} h={7} fill={PINK} op={0.85} />
      <circle cx={584} cy={137} r={5} fill={PINK} />
      <rect x="450" y="160" width="60" height="20" rx="6" fill={PINK} fillOpacity="0.9" />
      <Bar x={462} y={167} w={36} h={6} fill={SHELL} op={0.85} />
      <Bar x={522} y={167} w={62} h={6} fill={TEXT} op={0.3} />
      {[204, 238, 272, 306].map((y, i) => (
        <g key={y}>
          <Ava x={450} y={y + 6} r={9} fill={DIM} />
          <Bar x={468} y={y + 2} w={[96, 76, 108, 86][i]} h={6} fill={TEXT} op={0.3} />
        </g>
      ))}
      <rect x="440" y="342" width="154" height="26" rx="13" fill={PINK} fillOpacity="0.2" />
      <Tick x={458} y={353} s={0.9} />
      <Bar x={480} y={352} w={82} h={6} fill={PINK} op={0.8} />
    </>
  ) : (
    <>
      {/* One window, then the other one over the top of it. */}
      <rect x="32" y="110" width="360" height="230" rx="12" fill={SHELL} stroke={LINE} strokeWidth="1" />
      <rect x="32" y="110" width="360" height="28" rx="12" fill={BAR} />
      <rect x="32" y="126" width="360" height="12" fill={BAR} />
      <Bar x={54} y={120} w={62} h={6} fill={DIM} />
      {[160, 192, 224, 256, 288].map((y, i) => (
        <g key={y}>
          <Ava x={62} y={y + 6} r={10} fill={DIM} op={0.7} />
          <Bar x={82} y={y + 2} w={[196, 152, 214, 138, 178][i]} h={6} fill={TEXT} op={0.22} />
        </g>
      ))}
      <g transform="rotate(-4 402 268)">
        <rect x="248" y="164" width="322" height="216" rx="12" fill={BAR} stroke={LINE} strokeWidth="1" />
        <rect x="248" y="164" width="322" height="28" rx="12" fill={SHELL} />
        <rect x="248" y="180" width="322" height="12" fill={SHELL} />
        <Bar x={270} y={174} w={72} h={6} fill={DIM} />
        {[212, 248, 284, 320].map((y, i) => (
          <g key={y}>
            <Ava x={280} y={y + 8} r={11} fill={DIM} />
            <Bar x={302} y={y + 4} w={[164, 128, 186, 142][i]} h={6} fill={TEXT} op={0.3} />
          </g>
        ))}
      </g>
      <Cross x={556} y={126} s={1.1} />
    </>
  );

/* --------------------------------------------------------------- the map */

const SCENES: Record<string, { draw: Draw; alt: [string, string] }> = {
  sessions: { draw: sessions, alt: ["a pinned message, and everybody asking anyway", "a panel, and the people already on it"] },
  punishments: { draw: punishments, alt: ["a note, and the bin it ends up in", "a record you can search back through"] },
  infractions: { draw: infractions, alt: ["a stamp that lands before anyone reads it", "one approval in between"] },
  promotions: { draw: promotions, alt: ["roles ticked by hand, and nobody told", "the rank moves and the rest follows"] },
  shifts: { draw: shifts, alt: ["a spreadsheet with holes in it", "hours that count themselves"] },
  loa: { draw: loa, alt: ["a note taped over the calendar", "the days it covers, on the days"] },
  department: { draw: department, alt: ["one list that never ends", "three rosters, and who is in them"] },
  tickets: { draw: tickets, alt: ["every request in one person's messages", "a queue, and the transcript after"] },
  gatorai: { draw: gatorai, alt: ["the same question answered five times", "asked five times, answered once"] },
  prc: { draw: prc, alt: ["another window over the one you were in", "the server beside what you were doing"] },
};

const FALLBACK = "sessions";
const pick = (scene?: string) => SCENES[scene && SCENES[scene] ? scene : FALLBACK];

/* ----------------------------------------------------------- the exports */

export function DiscordBefore({ className, label, scene }: { className?: string; label?: string; scene?: string }) {
  const s = pick(scene);
  const alt = `Before Bot: ${label || s.alt[0]}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={alt}>
      <Win on={false}>{s.draw(false)}</Win>
    </svg>
  );
}

export function DiscordAfter({ className, label, scene }: { className?: string; label?: string; scene?: string }) {
  const s = pick(scene);
  const alt = `With Bot: ${label || s.alt[1]}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={alt}>
      <Win on>{s.draw(true)}</Win>
    </svg>
  );
}
