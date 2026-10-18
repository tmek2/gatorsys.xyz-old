# Gator (Website)
- Redesign for the website is in progress.
- **Idea:** Mostly hand drawn, after the gator there would be a sort of discord UI/server previewing what the bot can do, imp better than having images.
- **Purpose:** Bot serves as a somewhat acceptable quality free alternative instead of the paid greedy giants. Offers full customizability over everything. More coming soon.
- **Credit:** fir4s for the hand drawn gator and transition idea. Also mentioned that discord design I think?
- **Disclaimer:** This is all made with **AI**, and no it is not AI slop, I'm actually thinking here behind the screen not "Chatgpt make me good site, 0 mistake".
- Send your suggestions to my discord [.tmek](<https://discord.com/users/642749164165267466>)


## Run the website

This repository contains the website only. Live server management needs a separately running, compatible bot and its dashboard API. A Discord bot token by itself is not enough; the bot source will be released separately.

For a standalone demonstration without OAuth or a bot, use the `codex/test-preview` branch. Its account and three communities are fictional, and its actions only change preview data.

### 1. Install dependencies

Use Node.js **22.6 or newer** and npm. From the repository folder, run:

```sh
npm ci
```

### 2. Create your environment file

Copy `.env.example` to `.env.local` in the repository root. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```sh
cp .env.example .env.local
```

Generate a private session secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste the result into `AUTH_SECRET`. Fill in these values with your own installation's information:

| Setting | What to put there |
| --- | --- |
| `AUTH_URL` | Your website's origin, such as `http://localhost:3000`. Use your public HTTPS origin when deploying. |
| `AUTH_SECRET` | The generated secret above. Keep it private and stable between restarts. |
| `DISCORD_CLIENT_ID` | Your Discord application's OAuth2 client ID. |
| `DISCORD_CLIENT_SECRET` | That application's OAuth2 client secret. This is not the bot token. |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | The application ID for the Add bot button, usually the same as `DISCORD_CLIENT_ID`. This ID is public. |
| `PROD_API_URL` | The base address of your bot's running dashboard API, without an endpoint or query string. |
| `API_AUTH` | The bot API's matching dashboard credential. Keep this on the server. |

Optional settings are described in `.env.example`:

- `SITE`: origin used for shared links and metadata; normally the same as `AUTH_URL`.
- `REDIS_URL`: enables caching. Without it, reads go directly to the bot.
- `NEXT_PUBLIC_SITE_NAME`: the name shown in the navigation and browser tab.
- `NEXT_PUBLIC_DOCS_URL` and `NEXT_PUBLIC_SUPPORT_URL`: your own public links. Empty values use the website's local setup guide.
- `CANONICAL_URL`: opt-in redirect from raw Vercel deployment addresses to a public origin. Leave it empty when you want deployment previews to remain accessible.

Names starting with `NEXT_PUBLIC_` are visible to visitors and are read during the build. Never put a secret in one. Rebuild after changing a public setting.

`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `DASHBOARD_PUBLIC_URL` remain supported as legacy aliases; prefer the names in the example. Hosting values such as `VERCEL_URL`, `NEXT_RUNTIME`, and `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` are supplied by the host.

### 3. Configure Discord sign-in

Open your application in the [Discord Developer Portal](https://discord.com/developers/applications). In **OAuth2 → Redirects**, register this exact local callback:

```text
http://localhost:3000/api/auth/callback/discord
```

For production, also register:

```text
https://YOUR_DOMAIN/api/auth/callback/discord
```

The scheme, hostname, port and path must match your website exactly. Sign-in uses the `identify` and `guilds` scopes. The bot must be installed in a server, and your Discord account must have the permissions accepted by that bot.

### 4. Check and start

```sh
npm run check:env
npm run dev
```

Open **http://localhost:3000**. The configuration check reports missing names and invalid URL formats without printing secret values. It cannot verify whether a credential is accepted by Discord or by your bot.

Visit `/servers`, sign in, and select a linked server. Try an edit in a test server, save it, then refresh to confirm the bot has stored it.

## Deploy

Set the same required environment variables on your Node hosting service, register its HTTPS callback in Discord, and set `AUTH_URL` and `SITE` to that origin. Then run:

```sh
npm ci
npm run check:env
npm run build
npm start
```

Use your hosting provider's normal Next.js configuration on Vercel. A Git push only deploys if you have connected the repository to a hosting project; this repository does not create that connection.

Run the bot as a separate service. Its dashboard API must be reachable from the website server. Use HTTPS for connections across the public internet. The website does not need direct access to the bot's database.

Before using the legal pages for a public service, review their text against your own operation, hosting, support process and retention policy. They are included pages, not a statement about how every installation operates.

## Common setup problems

| What happens | What to check |
| --- | --- |
| Sign-in opens the setup guide | Fill in `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, then restart. |
| Discord reports an invalid redirect | Register the exact `/api/auth/callback/discord` URL for the origin you are using. Check HTTP versus HTTPS, port and `www`. |
| Sign-in succeeds but no servers appear | Confirm that the bot is installed, the signed-in user has access, and the bot exposes the expected dashboard API. |
| The dashboard reports a connection or authorization error | Check `PROD_API_URL`, the matching `API_AUTH`, and whether the bot service is running. Never copy `API_AUTH` into a browser request or a public variable. |
| A changed public name or invite ID does not appear | Rebuild; `NEXT_PUBLIC_` values are fixed when the browser code is built. |
| Commands fail in PowerShell because scripts are blocked | Use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`. |

## Development checks

```sh
npm test
npm run test:interactions
npm run typecheck
npm run build
```

The tests include real route-handler, message conversion, draft storage and rendered editor checks. Some existing tests also read source to protect layout and integration contracts. Bot-repository parity checks are skipped when the separate bot checkout is unavailable.

Stop the development server before building: both commands use `.next/`.

## Find your way around

```text
auth.ts                       Discord sign-in and session callbacks
src/app/                      pages, layouts and website API routes
  api/manage/[id]/            authenticated requests to the bot
  manage/[id]/               server dashboard
  account/, servers/         account page and community picker
  setup/                     local installation guide
  globals/                   ordered parts of the global stylesheet
src/components/
  Manage/                    dashboard sections and editors
  site/                      shared navigation, theme and public pages
  account/, servers/         account and community components
  ui/                        shared controls
src/server/                  server configuration and network boundaries
src/utils/                   request, cache, identity and link helpers
src/config/                  public configuration and feature catalogues
src/types/, types/           shared TypeScript definitions
scripts/                     environment check and maintenance utilities
tests/                       behavior and contract checks
docs/                        architecture, conventions and bot API contract
```

See [architecture](docs/architecture.md), [contributor notes](docs/conventions.md), and the [bot API contract](docs/bot-api.md) before adding features. Keep credentials in environment variables and use fictional names and IDs in examples.
