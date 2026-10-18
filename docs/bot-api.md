# Bot dashboard API

This website requires a compatible bot service. It does not provide a general adapter for arbitrary Discord bots. The bot source is separate; keep endpoint contracts synchronized when releasing it.

## Request rules

- PROD_API_URL is the bot API base URL. API_AUTH is sent as the auth query parameter, over a server-to-server connection. Do not expose it to browser code or log query strings.
- Acting user IDs are taken from the encrypted website session. The bot must check that user against the requested server on every protected operation. Never trust a supplied role, browser state or cached server list as permission evidence.
- Discord server, channel, role, user and case IDs are strings. JavaScript numbers cannot represent all Discord IDs exactly.
- Reads return JSON. Writes return a success object or an HTTP error that the website relays. The bot must validate payload shapes, module limits and permissions.
- Use 400 for invalid input, 401 for failed authentication, 403 for missing permission, 404 for missing resources, and appropriate 5xx responses for temporary service failures.
- Requests have a 25-second ceiling; a slow bot returns a recoverable timeout. Optional Redis caching is keyed by user and server, and writes retire related cached reads.

## Endpoint map

U means the signed-in Discord user ID; fields listed as query values are URL parameters. Request bodies vary by operation; the corresponding route under src/app/api is the website-side contract. Preserve existing endpoint spelling, including legacy case-sensitive names.

| Website API route | Website method | Bot path / method | Forwarded query/body apart from auth |
| --- | --- | --- | --- |
| `/api/account/roblox` | GET | `dashboard_roblox_identity` GET | query user U; refresh bypasses cache |
| same | POST | `dashboard_roblox_identity` POST | body user U, action, sid |
| `/api/application/[guildId]/[appId]` | GET | `dashboard_application_public` GET | query server G, user U, application A |
| same | POST | `dashboard_application_submit` POST | query server G; body user U, application A, answers, integrity, caseId |
| `/api/departments/join` | POST | `dashboard_departmentjoin` POST | query server 0; body all domain input and user U |
| `/api/departments/join/preview` | GET | `dashboard_departmentjoinpreview` GET | query code, user U |
| `/api/departments/mine` | GET | `dashboard_mydepartments` GET | query user U |
| `/api/departments/[parentId]/[departmentId]` | GET | `dashboard_departments` GET | query server G, department D, include, user U |
| same `/appconfig` | GET | `dashboard_departmentappconfig` GET | query server G, department D, user U; scope=meta returns payload.meta, otherwise `{config}` |
| same `/appconfig` | PATCH | `dashboard_departmentappconfig` POST | query server G; body user U, department D, applications, profiles; fallback GET retains existing applications |
| same `/applicationdecision` | POST | `dashboard_departmentappdecision` POST | query server G; body user U, department D, id, decision, reason |
| same `/applicationresponses` | GET | `dashboard_departmentappresponses` GET | query server G, user U, department D, application A |
| same `/doc/[resourceId]` | GET | `dashboard_deptdocument` GET | query server G, resource R, user U |
| same `/feature` | POST | `dashboard_departmentfeature` POST | query server G; body domain fields, department_id D, user U |
| `/api/docs/shared/[serverId]/[resourceId]` | GET | `dashboard_deptdocument` GET | query server G, resource R, user U |
| `/api/guild/[id]` | GET | `mutual_servers` POST | body user U, guilds [G]; returns `{mutualGuilds: payload.mutual || []}` |
| `/api/infractions/[id]` | GET | `infractions` GET + `permissions` GET | query server G; guard query server G, user U |
| same `/[singleid]` | GET | `infraction` GET | query server G, id case; fresh permissions guard before cached reads |
| same `/[singleid]/delete` | DELETE | `delinfraction` DELETE | query server G, id case; guard permissions; website success `{message}` |
| same `/[singleid]/update` | PUT | `UpdateInfraction` POST | query server G, id case; full JSON body; guard permissions |
| `/api/mutual` | GET | Discord guild GET then `mutual_servers` POST | body user U, guilds `[{id,owner,permissions}]`; query refresh bypasses cache |
| `/api/owner` | GET / POST | `dashboard_owner` GET / POST | GET query user U; POST body action, guild_id, other domain fields, user U |
| `/api/owner/context` | GET / POST | `dashboard_globalcontext` GET / POST | GET query user U; POST body domain fields, user U |
| `/api/p/[serverId]/[departmentId]` | GET (public) | `dashboard_departmentpublic` GET | query server G, department D; no user |
| `/api/transcript/[id]` | GET | `transcript` GET then `permissions` GET | query id transcript; guard query server payload.GuildID, user U; website returns `{data,compact,GuildID}` |
| `/api/manage/[id]/aicontext` | GET / POST | `dashboard_aicontext` GET / POST | GET server G,user U; POST server G, domain body + U |
| same `/aigaps` | GET / POST | `dashboard_aigaps` GET / POST | same; gap actions |
| same `/applicationaiscan` | POST | `dashboard_application_ai_scan` POST | server G; domain body + U |
| same `/applicationdecision` | POST | `dashboard_application_decision` POST | server G; domain body + U |
| same `/applicationdecisionbulk` | POST | `dashboard_application_decision_bulk` POST | server G; body user U, ids string[], decision approve/deny, reason max1000 |
| same `/applicationpublishstaged` | POST | `dashboard_application_publish_staged` POST | server G; domain body + U |
| same `/applicationresponsedelete` | POST | `dashboard_application_response_delete` POST | server G; domain body + U |
| same `/applicationresponses` | GET | `dashboard_application_responses` GET | server G,user U,application A |
| same `/audit` | GET | `dashboard_audit` GET | server G,user U,limit default25,kind dashboard/commands |
| same `/automations` | GET / POST | `dashboard_automations` GET / POST | GET server G,user U; POST server G, domain body + U |
| same `/autoresponders` | GET / POST | `dashboard_autoresponders` GET / POST | same |
| same `/botprofile` | GET / POST | `dashboard_botprofile` GET / POST | same |
| same `/config` | GET | `dashboard_config` GET | server G,user U; caches by user/guild/generation 45s; refresh bypass |
| same `/config` | PATCH | `dashboard_config` POST | server G; body user U,set {},unset [],module,summary |
| same `/connectionroles` | GET / POST | `dashboard_connectionroles` GET / POST | GET server G,user U; POST server G, domain body + U (action,parent,child typed locally) |
| same `/customcommandai` | POST | `dashboard_customcommand_ai` POST | server G; domain body + U |
| same `/customcommands` | GET / POST | `dashboard_customcommands` GET / POST | GET server G,user U; POST server G, domain body + U |
| same `/departmentaction` | POST | `dashboard_departmentaction` POST | server G; domain body + U |
| same `/departmentjoin` | POST | `dashboard_departmentjoin` POST | server G; domain body + U |
| same `/departmentlink` | POST | `dashboard_departmentlink` POST | server G; domain body + U |
| same `/departmentprofiles` | POST | `dashboard_departmentprofiles` POST | server G; domain body + U |
| same `/departments` | GET | `dashboard_departments` GET | server G,user U, optional department/include |
| same `/deptresources` | GET / POST | `dashboard_deptresources` GET / POST | GET server G,user U; POST server G, domain body + U |
| same `/deptsheetops` | GET | `dashboard_deptsheetops` GET | server G,user U,resource,since default0,client,name |
| same `/gatorai` | GET | `dashboard_gatorai` GET | server G,user U; long numeric IDs become strings |
| same `/gatorai` | PATCH | `dashboard_gatorai` POST | server G; body user U,settings; cooldown_seconds clamped30-600 |
| same `/infraction-types` | GET / POST | `dashboard_infractiontypes` GET / POST | GET server G,user U; POST server G; body user U,types[] limited projected fields |
| same `/media` | POST | `dashboard_media` POST | server G; body user U,image data:image/... string |
| same `/membersubmission` | GET | `dashboard_membersubmission` GET | server G,user U,department,member |
| same `/messages` | GET / PUT | `dashboard_messages` GET / POST | GET server G,user U,type; POST server G; body user U,type,data nullable |
| same `/meta` | GET | `dashboard_meta` GET | server G,user U, optional members=1; user/guild/generation/members cache60s |
| same `/panels` | GET | `dashboard_panels` GET | server G,user U |
| same `/prcserver` | GET | `dashboard_prcserver` GET | server G,user U |
| same `/qotd` | GET / PATCH | `dashboard_qotd` GET / POST | GET server G,user U; POST server G; body user U,set {} |
| same `/resourceversionrestore` | POST | `dashboard_resource_version_restore` POST | server G; body user U,resource,version |
| same `/resourceversions` | GET | `dashboard_resource_versions` GET | server G,user U,resource |
| same `/sessionpanel` | POST | `dashboard_sessionpanel` POST | server G; body user U,channel |
| same `/staff` | GET | `dashboard_staff` or `dashboard_staffmember` GET | server G,user U, optional member selects single endpoint |
| same `/staffaction` | POST | `dashboard_staffaction` POST | server G; domain body + U |
| same `/templates` | GET / POST | `dashboard_templates` GET / POST | GET server G,user U; POST server G, domain body + U |
| same `/ticketpanels` | POST | `dashboard_ticketpanels` POST | server G; domain body + U |
| same `/ticketpanelsend` | POST | `dashboard_ticketpanelsend` POST | server G; body must contain name/channel, domain fields + U |


## Other integrations

Discord OAuth and the signed-in user's server list use Discord's API. Optional Roblox linking uses the bot's account-link endpoints and Roblox's public user/headshot APIs. The image preview endpoint validates public network addresses, pins DNS resolution, limits downloaded bytes and does not forward credentials.

The website's /api/health endpoint only confirms that the website is running; it does not report whether Discord, Redis or the bot is available.
