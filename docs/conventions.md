# Conventions

How this codebase is written, and why. Follow these when adding to it; the
tests enforce many of them.

## Words on screen

- Plain, short sentences, the way a person would say it. No feature lists
  strung together with commas, no "seamless", "robust", "powerful".
- No em or en dashes in visible text. Use a comma, a colon or a new sentence.
- No all-caps captions or tracked uppercase labels.
- A label sits above the control it names. A tab's title has no description
  line under it.
- Sample names in mockups, placeholders and test data: `.tmek`,
  `Alternative`, `offser`.

## Design

- One typeface, Rethink Sans, through `var(--font-ui)`. Other faces are only
  offered inside the document and spreadsheet editors.
- Neutral greys only: no grey with a blue or purple cast (Tailwind's `zinc`,
  `slate` and `gray`, shadcn's hue-240 tokens).
- One accent, the site's pink: `--g-accent` on the public pages and
  `--accent-peach` in the dashboard hold the same colour, and both follow
  light mode. For a wash in a Tailwind class use
  `bg-[rgb(var(--accent-rgb)/0.12)]`, never a literal pink. The accent is used
  sparingly: a switch that is on, one chip, one button.
- No icon inside a filled box, no pills for status, no pulsing dots. Avatars
  are the exception, and they are round.
- Everything that appears or disappears animates. Use the motion contract
  (below) rather than inventing timing. Every `<button>` already gives a
  little under a press (globals.css); a component only needs its own motion
  when it does something more.
- One button: the site's `RippleButton` (`default` for the main action,
  `outline` or `ghost` beside it), or `.gw-btn` inside an editor, which is the
  same outline button at editor size. One switcher between views: `Segments`.
  One option control: `OptionCard`.
- No per-page Save button: edits go through the dashboard's one save prompt.
- Tooltips are the site's own (`HoverTip`; `TitleTips` turns any `title`
  attribute into one), not the browser's, and every tooltip has the same
  surface (`.gw-tip`, `.g-tip`, `.g-theme-tip`).
- Phones get their own layout (the dock, sheets that rise from the bottom),
  not the desktop one squeezed.

## CSS

### Where styles live

| File | What |
| --- | --- |
| `src/app/globals.css` | Tailwind, site-wide tokens, older global rules |
| `src/styles/motion.css` | the motion contract: durations, curves, enter and exit |
| `src/styles/hit-target.css` | invisible larger hit areas for small controls |
| `src/styles/segments.css` | the segmented switcher (`Segments`), used on every page |
| `src/components/site/tokens.css` | the public site's palette and the window material |
| `src/components/Manage/manage-restyle.css` | the dashboard palette (`--manage-*`) and its controls |
| `src/components/Manage/manage-elevate.css` | opt-in dashboard extras |
| `src/components/Manage/manage-window.css` | the dashboard window, in ordered parts |
| `src/components/Manage/discord-surface.css` | the Discord look-alike message previews |

The dashboard loads them in this order (in `manage-shell.tsx`): globals,
then `manage-restyle`, `manage-elevate`, `manage-window`. Later files win, which
is why `manage-restyle` uses `!important` against older rules in globals.

### Class prefixes

| Prefix | Belongs to |
| --- | --- |
| `g-` | the public site (`src/components/site/`) |
| `gw-` | the dashboard window (`manage-window/`) |
| `manage-` | the dashboard's older shell classes |
| `gator-` | shared product pieces from globals (switches, row actions) |
| `dc-` | Discord look-alike surfaces (`discord-surface.css`) |
| `gs-` | status pages and `/panel` |
| `sv-`, `servers-` | server cards and the server picker |
| `wf-` | the workflow editor |
| `account-`, `owner-` | those pages |

### Tokens

| Token | Meaning | Declared in |
| --- | --- | --- |
| `--u1` ... `--u12` | spacing on a 4px grid | `manage-window/01-tokens.css` |
| `--t-*`, `--lh-*` | type sizes and line heights | `manage-window/01-tokens.css` |
| `--r-*` | radii, each the outer radius minus the padding inside it | `manage-window/01-tokens.css` |
| `--g-*`, `--mac-*` | the public site's colours and window material | `site/tokens.css` |
| `--manage-*` | the dashboard's colours | `manage-restyle.css` |
| `--tone-*` | status colours (ok, warn, bad, info, idle) | `globals.css` |
| `--motion-*`, `--ease-*` | durations and curves | `styles/motion.css` |

Tokens used by anything that can be portalled to `<body>` (menus, popovers,
dialogs) are declared on `:root` too. An unresolved `var()` drops the whole
declaration rather than falling back.

### Details worth knowing

- `data-bare` on an element opts it and its children out of the dashboard's
  blanket input styling.
- Animate only `opacity` and `transform`. Radix surfaces get their timing from
  `[data-state]` rules in `motion.css`; hand-made overlays use `usePresence`
  from `src/components/motion.tsx`.
- Never put a literal `*/` inside a CSS or JS comment.

## Large files are split into a folder of the same name

When a file grows too large to read, its parts move into a folder beside it
with the same name:

- `manage-window.css` is only a list of `@import "./manage-window/NN-name.css";`
  lines. The numbers are the cascade order: a later part may override an
  earlier one, so keep the order and add rules to the part they belong to.
- `department-workspace.tsx`, `message-design.tsx`, `fields.tsx`,
  `sections/resources.tsx` and `sections/tickets.tsx` keep their main
  component, and their pieces live in the folder. Names other files import are
  re-exported from the main file, so importers do not care where a piece lives.

`workflow/blocks.ts` stays one file on purpose: it is a catalogue, one entry per
block, and the contract exporter loads it by path.

## Comments

A comment says why, in the present tense, in as few lines as it needs. It does
not tell the story of how the code got here; that is what commit messages are
for. Write the measurement or the reason that would stop someone from
"simplifying" the code back into the bug.

## Tests

Most tests read source files and assert that a decision is still in the code.
So:

- Read files with `source()` from `tests/read-source.ts`. It follows the split
  convention above: reading `x.css` inlines its parts, and reading `x.tsx`
  appends the files in `x/`.
- When an assertion bans something its own explanation has to name, strip
  comments from the source before matching, or the explanation fails the test.
- When you move code, update the path in the test rather than deleting the
  assertion.

Run `npm test`, `npx tsc --noEmit -p .` and `npx next build` before pushing.

## Commits

One change per commit, with a message that says what changed and why in plain
sentences (`Split the Resources and Tickets tabs into parts`). Push to `main`
to deploy.
