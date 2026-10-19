# Gator (Website)
- gatorsys.xyz's second design.
- **Idea:** Modern, smooth UI with some creative ideas for the interactions. Main color palette for dark mode black/pink, light mode is beige/velvet. Inspo for the UI taken from discord.
- **Purpose:** A production ready dashboard used for a moderation bot. (Bot code still to be released)
- **Disclaimer:** This is all made with **AI**, and no it is not AI slop, I'm actually thinking here behind the screen not "Chatgpt make me good site, 0 mistake".
- All personal branding was removed. Only generic names are now used, will need updating.
- Note: There are a few mismatched designs I haven't fixed for the bigger tabs like resources and workflows.
- The branch (test-preview) is only a preview without any APIs, main has all the actual code.


## Deploy the website

This repository contains the website. The live dashboard also needs a separately hosted, compatible bot dashboard API. A Discord bot token alone cannot connect it; the bot source will be released separately.

| Branch | What it runs |
| --- | --- |
| `main` | The real website, with Discord sign-in and your own bot connection. |
| `test-preview` | A fictional signed-in user and three test servers. All actions are simulated; no OAuth, bot, database, or credentials are needed. |

### Hosting settings

Use a host that supports a Next.js server, such as Vercel or a Node.js application host. This website cannot run as a static HTML upload because sign-in and dashboard requests need the server.

For **Vercel**, import the repository, choose **Next.js**, keep the repository root as the project directory, and choose `main` as the production branch. Add the environment values below before deploying. Keep the framework's output settings; use `npm ci` to install and `npm run build` to build. Add your website domain to that project. See [Vercel's Next.js guide](https://vercel.com/docs/frameworks/full-stack/nextjs) and [environment settings guide](https://vercel.com/docs/environment-variables).

For a **Node.js host**, select Node.js 22.6 or newer, install with `npm ci`, build with `npm run build`, and start with `npm start`. Keep the process running using the host's application service. Serve your domain over HTTPS and forward requests to the application's assigned port. The host can set `PORT`; `npm start` uses it. Configure the values below before building and starting.

### What to replace in `.env`

On a managed host, enter these names and values in its **Environment Variables** settings. On a host that reads files, copy `.env.example` to **`.env` in the repository root**, next to `package.json`, and replace the sample values. The filled file is ignored by Git. Use the same values at build time and when the server runs.

| Name | Replace it with |
| --- | --- |
| `AUTH_URL` | Your website's public HTTPS origin. Replace `https://dashboard.example.com` with your domain; do not include a page path. |
| `AUTH_SECRET` | A private random secret of at least 32 characters. Keep it stable between deployments. Generate one with the command below. |
| `DISCORD_CLIENT_ID` | Your Discord application's **Application ID** from the Developer Portal. |
| `DISCORD_CLIENT_SECRET` | That application's **OAuth2 client secret**, which is different from a bot token. |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | The application ID used by **Add bot**, normally the same as `DISCORD_CLIENT_ID`. |
| `PROD_API_URL` | The HTTPS base address of your running bot's dashboard API. Replace `https://bot-api.example.com` with yours. Do not append an endpoint or `auth` query. |
| `API_AUTH` | The dashboard API credential configured on that bot. The website and bot must use the same value. |
| `SITE` | Your website's public HTTPS origin, normally the same as `AUTH_URL`. Used for shared links and metadata. |
| `NEXT_PUBLIC_SITE_NAME` | Your public website name. Replace **Community Dashboard** with the name visitors should see. |

Generate `AUTH_SECRET` on a trusted machine:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Optional settings:

| Name | What it controls |
| --- | --- |
| `NEXT_PUBLIC_SUPPORT_URL` | Your support page or community invite. Leave empty to use this website's `/setup#support`. |
| `NEXT_PUBLIC_DOCS_URL` | Your documentation address. Leave empty to use this website's `/setup` guide. |
| `REDIS_URL` | Your Redis connection URL for caching. Leave empty if you do not use Redis. |
| `CANONICAL_URL` | Your preferred website origin when raw Vercel deployment URLs should redirect there. Leave empty to keep deployment URLs accessible. |

Names beginning with `NEXT_PUBLIC_` are visible to visitors. Rebuild and redeploy after changing a public name, public link, or application ID. See the [Next.js environment guide](https://nextjs.org/docs/app/guides/environment-variables).

The aliases `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `DASHBOARD_PUBLIC_URL` remain supported for existing installations; prefer the names above. Platform values such as `VERCEL_URL` are supplied by the host.

### Connect Discord and the bot

1. In your application's **OAuth2 → Redirects** in the Discord Developer Portal, register `https://YOUR_WEBSITE_DOMAIN/api/auth/callback/discord`. Use your deployed domain, matching `AUTH_URL` exactly.
2. Make sure the bot's dashboard API is running at `PROD_API_URL` and accepts `API_AUTH`. It must support the routes in [`docs/bot-api.md`](docs/bot-api.md); this website does not create the bot endpoints.
3. Deploy the website, open your domain, sign in, choose a server you manage, change a setting, and confirm it stays changed after reloading. The bot must be in that server.
4. If the host provides a command console, `npm run check:env` checks the required names and URL formats without printing secrets. A successful configuration check does not replace the sign-in and bot checks above.

### Where to change names and branding

| Change | Location |
| --- | --- |
| Website name and public links | The environment values above; defaults are in `src/config/site.ts`. |
| Generic logo in navigation | `src/components/site/app-logo.tsx`. Replace this small SVG mark with your own. |
| Browser icon and fallback image | `public/icon.svg`, referenced by `src/app/layout.tsx`. |
| Browser title, description and social metadata | `src/config/site.ts`, `src/app/layout.tsx`, and `src/app/opengraph-image.tsx`. |
| Landing page wording and navigation | `src/components/site/landing.tsx`, `site-nav.tsx`, `nav-menu.tsx`, and `site-footer.tsx`. |
| Interactive landing-window content | `src/components/site/mac/files.tsx` and the other components in that folder. |
| Pink/beige palette and light/dark colors | `src/components/site/tokens.css` and `src/app/globals/01-foundation.css`. Dashboard colors also live in `src/components/Manage/manage-restyle.css` and `manage-window/`. |
| Generic bot name/avatar in message previews | `src/components/Manage/bot-identity.tsx`. Real server profile details come from the bot API and can be changed in **Customization**. Renaming the website does not rename your Discord bot. |
| Neutral decorative artwork | `public/doodle/` and `public/doodles/`. |
| Privacy, terms and setup wording | `src/app/privacy/`, `src/app/terms/`, and `src/app/setup/`. Review these for your own installation. |

The original README bullet points above are kept as written. Existing `gator-*` CSS classes and the `GatorAI` configuration key are compatibility identifiers, not public branding settings. A global replacement can break styles or bot requests.

### File structure

```text
.env.example                   Template for deployment settings
README.md                      Deployment and customization guide
package.json                   Install, build, start and check commands
auth.ts                        Discord sign-in on main
next.config.js                 Framework, image and redirect settings
public/                        Icons, fonts and decorative assets
scripts/                       Configuration and workflow-contract tools
src/
  app/                         Pages and website API routes
    api/manage/[id]/            Server dashboard requests
    manage/[id]/                Dashboard, forms and resource editors
    account/                    Profile and connected accounts
    departments/                Department member portal
  components/
    Manage/                     Dashboard controls, editors and feature pages
    site/                       Public layout, navigation and landing content
  config/                       Website name and public-link defaults
  server/                       Server-only bot connection settings
  utils/                        Request, cache, session and link helpers
  styles/                       Shared style utilities
  types/                        Shared data shapes
tests/                         Automated and interaction checks
docs/                          Architecture, bot API and dependency notes
```

For a deeper map, read [`docs/architecture.md`](docs/architecture.md) and [`docs/conventions.md`](docs/conventions.md). Audit notes are in [`docs/dependencies.md`](docs/dependencies.md).

### Test preview branch

Deploy `codex/test-preview` as a **separate** website. On a Node.js host, use the same install, build and start commands above, without service credentials. It starts as **Dev User** with **Harbor Community**, **Cedar Gaming**, and **Northstar Network**. The yellow notice can be closed; **Test preview** reopens it, and **Reset preview** restores the samples.

Each visitor's changes stay separately in server memory. A restart, twelve idle hours, or eviction after 100 active visitors resets the samples. Use one running Node server for consistent edits across pages. Hosts with multiple independent function instances can reset samples between requests. Do not enter real personal information.

Preview identities are in `src/preview/identity.ts`, server samples in `src/preview/seed.ts`, and simulated behavior in the other `src/preview/` files. The preview name and links are fixed in `src/config/site.ts` on that branch. The live-service environment values above are for **main** and are ignored by the preview.

### Verify changes before deploying

```sh
npm test
npm run test:interactions
npm run typecheck
npm run build
```

These check website behavior. A real Discord sign-in and bot action still require your configured services.
