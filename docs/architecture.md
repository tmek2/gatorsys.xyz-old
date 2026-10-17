# How the website works

## The one rule

The website keeps no data. Every setting, case, ticket panel, application,
department and document lives in the bot's database, and the site reads and
writes it through the bot's dashboard API. The bot checks permissions on
every call. So a page here can be wrong about what it shows, but it cannot
give anyone access they do not have.

## A request, end to end

```
browser ─▶ src/app/api/manage/[id]/<thing>/route.ts
             withAuth()            is there a session? (src/utils/api-middleware.ts)
             botDashboardGet/Post  call the bot with API_AUTH and the session's
                                   user id (src/utils/manage-api.ts)
          ◀─ relayBotResponse()    pass the bot's answer through
```

- The user id always comes from the encrypted session cookie, never from the
  request. The server id may come from the URL, because the bot checks it
  against the user. `tests/auth-boundary.test.ts` holds this in place.
- Every bot call has a 25 second ceiling, so a sleeping bot returns a fast
  error instead of a hung page.
- A write calls `invalidateManageCache(guildId)`, which retires the cached
  reads for everyone (see Caching).

## Signing in

- NextAuth v5 with the Discord provider (`auth.ts`), scopes `identify` and
  `guilds`.
- Discord's tokens live only in the encrypted JWT cookie. The session object
  the browser can read never contains them; server code reads the access token
  with `getDiscordAccessToken()` (`src/utils/discord-session-token.ts`).
- `src/middleware.ts` refreshes the token and writes the new cookie on every
  page request. A page cannot set cookies, and Discord's refresh token works
  once, so refreshing anywhere else would lose it.
- A session can outlive its tokens. `isLive()` and `viewerFromSession()`
  (`src/utils/viewer.ts`) are the one check for "is this session usable", and
  everything that shows who is signed in asks them.

## Caching

| Where | What | How it is invalidated |
| --- | --- | --- |
| Redis (`src/utils/redis.ts`) | the dashboard's `meta` and `config` reads, per user | a per-server generation number in the key (`src/utils/manage-cache.ts`), bumped by every write |
| Redis | the server picker's list | a 20 minute fresh copy plus a longer stale copy served while refreshing (`src/utils/mutual-servers.ts`) |
| Browser memory (`src/utils/client-cache.ts`) | GET requests from the dashboard, 30 seconds | by key prefix, when that thing is saved |

Without `REDIS_URL` the server cache is simply off. Every Redis call has a
short timeout and fails open.

## The dashboard

Route: `src/app/manage/[id]/[[...section]]/page.tsx` renders `ManageShell`.

- **`manage-shell.tsx`** draws the window: the bar, the rail of tabs
  (`nav-groups.tsx`), and the pane. Large tabs are loaded on demand.
- **`manage-context.tsx`** (`ManageProvider`, `useManage()`) loads the server's
  `meta` (channels, roles, permissions, module state) and `config` (the bot's
  config document), and holds the draft:
  - `stage(path, value)` records an edit by dot-path into the config document;
  - `save()` sends every staged path; `commit(changes)` writes values directly
    (use it when a handler would otherwise stage and save in one go);
  - unsaved edits are kept in `localStorage`, so a closed tab does not lose
    them;
  - editors that save to their own endpoint (tickets, custom commands, the
    bot profile, GatorAI, workflows, the message designer) call
    `registerExternalDraft()`, so the one save prompt (`save-bar.tsx`) covers
    them too.
- **Most tabs are declared, not written.** `schema.ts` lists each module's
  settings as fields with a `path` into the bot's config document, and
  `schema-section.tsx` draws them. Only add a path the bot actually reads.
- **Hand-written tabs** live in `sections/` (overview, permissions, tickets,
  resources, sessions, custom commands, GatorAI and a few more).
- **Messages.** `message-design.tsx` is the message designer used across
  modules: embeds, and Discord's container ("Components V2") messages.
  `message-design/model.ts` is the block model, `discord-json.ts` converts to
  and from Discord's own JSON (the import/export box), and `embed-canvas.tsx`
  and `container-canvas.tsx` edit a message in place on a Discord look-alike
  surface (`discord-surface.css`).
- **Departments.** `department-workspace.tsx` and its folder are one
  department's tabs. They run in the dashboard and in the member portal
  (`/departments/<server>/<department>`); `workspace-host.tsx` is what differs
  between the two (which endpoints to call, how to report).
- **Workflows.** `workflow/blocks.ts` is the catalogue of blocks, `serialize.ts`
  turns a drawn graph into the steps the bot runs, and `workflow-canvas.tsx` is
  the editor. The bot validates saved workflows against a contract exported
  from this catalogue (see below).

## The public site

`src/components/site/` holds the public site and the pieces every page
shares: `site-nav.tsx` and `site-footer.tsx`, the palette (`tokens.css`), the
appearance switch (`theme.ts`, which sets the theme before first paint), and
the landing page (`landing.tsx`, with its window in `mac/`; phones get their
own layout in `mac/ios.css`).

`src/components/legacy-header/` is the previous header. Only the shared
document reader still uses it.

## Shared links

Documents, forms, spreadsheets and department resources are shared by short
links (`/document/<slug>`, `/form/<id>`, `/d/...`). The slug packs the ids
(`src/utils/short-links.ts`), so a link needs no lookup. Old link shapes
redirect with a temporary (307) redirect, because browsers keep a 308
forever.

Pages that show what someone wrote (transcripts, cases, forms, documents) are
public by link but must not be indexed: `robots.ts` asks crawlers to stay out,
and each of those routes sets `NO_INDEX` (`src/utils/no-index.ts`).

## Working with the bot repository

The bot is `tmek2/gatorsys`. Two things are kept in step by hand:

- **Endpoints.** A new dashboard feature usually needs a bot endpoint first.
- **The workflow contract.** After changing `workflow/blocks.ts` or
  `serialize.ts`, export the catalogue into the bot checkout and commit it
  there:

  ```bash
  node scripts/export-workflow-contract.cjs ../gatorsys
  ```

  With `--check` it only verifies that the bot's copy is current.

A few tests read the bot's source to check that both sides agree; they look
for the checkout beside this one (`../gatorsys` or `../fdny-systems`), or in
`GATORSYS_REPO`.
