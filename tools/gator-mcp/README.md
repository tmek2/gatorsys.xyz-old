# Gator MCP

An MCP server for the dashboard. It gives an agent the same surface the website
has — every server, configuration, application, ticket, department and panel the
site can read or change.

The website is a proxy: it holds no data of its own. Everything `/manage` shows
comes from the bot's API, which the site calls with a shared secret and relays.
So this talks to that API directly, which is both the complete surface and the
only one authenticable without a browser session.

## What it exposes

The tool list is not maintained by hand. FastAPI publishes an OpenAPI document
describing all 99 operations, and this reads it at startup — so an endpoint
added to the bot tomorrow is callable with no change here, and a renamed one
cannot leave a stale entry behind.

| Tool | For |
| --- | --- |
| `gator_health` | Is the API behind the site up. Start here when the dashboard looks broken. |
| `gator_list_endpoints` | The whole catalogue, filterable. |
| `gator_describe_endpoint` | What one endpoint takes. |
| `gator_call_endpoint` | Call any of them. The escape hatch that makes "everything" true. |
| `gator_guilds` | Servers the acting user manages — what `/servers` lists. |
| `gator_get_config` | A guild's configuration, whole or by dot-path. |
| `gator_set_config` | Change it by dot-path, as the dashboard's save does. |
| `gator_applications` | Applications with the `/form/<id>` link members are given. |

## Configuring it

```jsonc
// .mcp.json
{
  "mcpServers": {
    "gator": {
      "command": "python3",
      "args": ["tools/gator-mcp/server.py"],
      "env": {
        "GATOR_API_AUTH": "…",           // the website's API_AUTH
        "GATOR_ACTING_USER": "…",        // your Discord user id
        "GATOR_API_URL": "…",            // optional; defaults to production
        "GATOR_GUILDS": "123,456",       // optional; scope to these servers
        "GATOR_ALLOW_WRITES": "0"        // "1" to permit POST/PATCH/DELETE
      }
    }
  }
}
```

No dependencies — standard library only, so there is nothing to install.

## Before you point it at production

`API_AUTH` is admin-equivalent over **every guild the bot is in**. The bot
re-checks that `GATOR_ACTING_USER` can manage the target guild, so the acting
user bounds what can be reached — but the key itself does not.

Three things follow, and the defaults reflect them:

- **Writes are off** unless `GATOR_ALLOW_WRITES=1`. Reading is safe to leave on;
  writing goes straight into live servers with no undo.
- **Scope it.** `GATOR_GUILDS` refuses any call naming another guild. Set it
  even when you think you will only touch one.
- **The secret never comes back out.** It is injected here, is not accepted as a
  tool argument, and is stripped from error text — an exception quoting the URL
  that failed would otherwise carry it in the query string.

Point it at a development bot first if you have one. `GATOR_API_URL` is what
selects it.

## Running the tests

```bash
python3 tools/gator-mcp/test_server.py     # directly
npm test                                    # also runs them, via tests/gator-mcp.test.ts
```

## A note on the API's OpenAPI document

`/openapi.json` and `/docs` are served unauthenticated, which is FastAPI's
default and is what makes the catalogue above possible. Every endpoint still
requires `auth`, so this is not access — but it does publish the shape of the
surface to anyone who asks. If that is not wanted, `FastAPI(openapi_url=None)`
turns it off, and this server would then need a generated catalogue instead.
