# Working on the dashboard

## Start here

Read [architecture.md](architecture.md) before changing data flow, and [bot-api.md](bot-api.md) before adding an endpoint. Run npm test, npm run test:interactions, npm run typecheck and npm run build before pushing.

## Keep the two boundaries clear

- Server code may read API_AUTH and Discord OAuth tokens. Client components may not.
- The acting user always comes from the session. Put it after any request-body spread so a caller cannot override it.
- The bot decides which server a user can manage. A cached server list is navigation data, not permission evidence.
- Handle an unsuccessful read as an error. Do not turn it into an empty editable form that could overwrite saved data.

## Where code belongs

Routes live in src/app. Shared HTTP and data helpers live in src/utils; network boundary and environment code lives in src/server. Dashboard sections and their editors live in src/components/Manage. Shared public navigation and theme code lives in src/components/site.

Split a large component into a folder beside its entry file when it gains independent responsibilities. Keep types and pure transforms separate from React state. Do not move files just to change their names.

Global styles are imported in order from src/app/globals/. The numbers preserve the existing cascade. Dashboard window styles follow the same convention under Manage/manage-window/. Change the appropriate part rather than adding another override at the end.

## State and messages

Use ManageProvider for staged settings and the shared save/discard bar. Editors with separate endpoints register an external draft. Preserve unset paths when serializing drafts; JSON omits undefined values.

Messages are persistent data. Keep multiple embeds, explicit container layout and text when importing or applying a template. Validate Discord limits before sending to the bot.

## Comments and tests

Write comments for a constraint or a non-obvious decision. Use neutral fictional names and IDs in examples. Do not include account details, production addresses, generated project instructions or credentials.

Prefer tests that call a real helper, route handler or rendered control. Existing source checks also protect layout and bot contract decisions; update their expectations when intentionally changing a feature, without dropping behavioral coverage.

Server and browser caches must be invalidated after writes. Never cache a response before its permission check. Cancel timers, listeners and pending work when their owner goes away.
