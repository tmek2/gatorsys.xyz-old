# Gator (Website)
- Redesign for the website is in progress.
- **Idea:** Mostly hand drawn, after the gator there would be a sort of discord UI/server previewing what the bot can do, imp better than having images.
- **Purpose:** Bot serves as a somewhat acceptable quality free alternative instead of the paid greedy giants. Offers full customizability over everything. More coming soon.
- **Credit:** fir4s for the hand drawn gator and transition idea. Also mentioned that discord design I think?
- **Disclaimer:** This is all made with **AI**, and no it is not AI slop, I'm actually thinking here behind the screen not "Chatgpt make me good site, 0 mistake".
- Send your suggestions to my discord [.tmek](<https://discord.com/users/642749164165267466>)


## Running it

You need Node 22.6 or newer (the tests run TypeScript directly).

```bash
npm install
```

```bash
npm run dev
```

The dev server needs a `.env.local` beside `package.json`. Never commit it.

| Variable | What it is |
| --- | --- |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | The Discord application used for sign-in. |
| `AUTH_SECRET` | Encrypts the session cookie (`NEXTAUTH_SECRET` also works). |
| `PROD_API_URL` | Base URL of the bot's dashboard API. |
| `API_AUTH` | The secret shared with the bot's API. Without it no dashboard page loads. |
| `REDIS_URL` | Optional. Caches the dashboard's two heaviest reads; without it they are not cached. |
| `SITE` | Optional. The site's public URL, used for absolute links (falls back to `AUTH_URL`, `NEXTAUTH_URL`, then the Vercel URL). |

## Checking a change

```bash
npm test
```

```bash
npx tsc --noEmit -p .
```

```bash
npx next build
```

`npm test` runs the suites in `tests/`. Most of them read source files and
assert that a decision is still in the code (a rule, a class, a guard), so a
refactor that moves code may need the path in a test updated. See
[docs/conventions.md](docs/conventions.md#tests).

`npm run test:interactions` runs the few tests that render a component in
jsdom.

The production build and the dev server share `.next/`, so stop the dev
server before building.

## Deploying

Pushing to `main` deploys to Vercel. The bot is deployed separately; when a
change needs both, ship the bot first.

## Where things are

```
src/app/                    routes (Next.js app router)
  api/                      server routes; nearly all relay to the bot
  manage/                   the dashboard route
  servers/, account/ ...    the public pages
src/components/
  site/                     the public site: landing, header, footer, theme, tokens
  Manage/                   the dashboard (see docs/architecture.md)
  servers/, account/        parts of those pages
  legacy-header/            the previous header, still used by the document reader
  ui/                       small Radix wrappers (dialog, popover, menu)
src/config/                 site constants, the docs index, the variable registry
src/styles/                 site-wide CSS: motion, hit targets, the segmented switcher
src/utils/                  server and client helpers (auth, bot API, caching, links)
tests/                      node:test suites
tools/gator-mcp/            an MCP server for the bot's API (Python)
scripts/                    one-off generators, and the workflow contract export
docs/                       architecture, conventions, roadmap
```

Start with [docs/architecture.md](docs/architecture.md) for how the pieces
fit, and [docs/conventions.md](docs/conventions.md) before changing styles or
copy.
