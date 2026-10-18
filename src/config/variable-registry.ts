/**
 * Variable metadata for the message editors' picker. The bot's
 * utils/variables.py resolves variables; this mirrors its keys with what the
 * picker needs: scope, group and a description. Keys missing here still work as
 * raw chips under "Other".
 */

/**
 * Where a variable comes from: - global: every message the bot sends resolves
 * it - shared: more than one module provides it ({reason} is set by tickets,
 * infractions, promotions and suggestions) - module: only one module resolves
 * it
 */
export type VariableScope = "global" | "shared" | "module";

export interface VariableMeta {
  group: string;
  scope: VariableScope;
  description: string;
  /** What this actually renders as, for the ones whose output has a fixed
   *  shape. See `VARIABLE_EXAMPLES`. */
  example?: string;
}

/**
 * What a variable turns into, for variables whose output shape is fixed, read
 * off the bot's resolver (utils/variables.py). The timestamp family emits
 * Discord's `<t:…:R>` markup, which Discord renders in the reader's locale.
 * Partial on purpose: values that are a server's own data (a name, a reason, a
 * count) have no fixed example, and an invented one would read as a format
 * promise.
 */
export const VARIABLE_EXAMPLES: Record<string, string> = {
  // Resolved literally by global_message_vars.
  "{date}": "2026-08-12",
  "{year}": "2026",
  // Discord's timestamp markup. What you get is the tag; what the reader sees
  // is their own locale, which is the whole point of using it over {date}.
  "{timestamp.short_time}": "16:20",
  "{timestamp.long_time}": "16:20:20",
  "{timestamp.short_date}": "12/08/2026",
  "{timestamp.long_date}": "12 August 2026",
  "{timestamp.short_datetime}": "12 August 2026 16:20",
  "{timestamp.long_datetime}": "Wednesday, 12 August 2026 16:20",
  "{timestamp.relative}": "2 hours ago",
  "{time.relative}": "2 hours ago",
  "{time.absolute}": "Wednesday, 12 August 2026 16:20",
  // Whitespace tokens, which are the two nobody can guess from the name.
  "{newline}": "a line break",
  "{blank}": "an invisible character",
  // Mentions render as a pill in Discord; names and ids are plain text. Only
  // the {author.*} spellings are here: {user.mention} is built by individual
  // modules, not the global resolver, so an example would imply it works
  // everywhere. Enforced by tests/test_variable_documentation.py in the bot.
  "{author.mention}": "@Alex",
  "{author.name}": "Alex",
  "{author.display}": "Alex",
  "{author.id}": "100000000000000001",
  "{guild.name}": "Bot HQ",
  "{guild.id}": "100000000000000101",
  // `str(member_count)` in the resolver — a bare integer, no separator.
  "{guild.members}": "1204",
};

const G = (group: string, scope: VariableScope, entries: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(entries).map(([key, description]) => [
      key,
      // Examples are attached here from VARIABLE_EXAMPLES rather than written
      // into each entry.
      { group, scope, description, example: VARIABLE_EXAMPLES[key] } as VariableMeta,
    ]),
  );

export const VARIABLE_REGISTRY: Record<string, VariableMeta> = {
  // Global means resolved by `global_message_vars`, which every configured
  // message runs through. Checked against the resolver; the bot asserts the
  // same in tests/test_variable_documentation.py.
  ...G("Global", "global", {
    "{author.mention}": "Mention the acting user",
    "{author.name}": "Acting user's username",
    "{author.display}": "Acting user's display name",
    "{author.display_name}": "Acting user's display name",
    "{author.id}": "Acting user's Discord ID",
    "{author.avatar}": "Acting user's avatar URL",
    "{guild.name}": "Server name",
    "{guild.id}": "Server ID",
    "{channel.name}": "Channel name",
    "{channel.id}": "Channel ID",
    "{channel.mention}": "Channel mention",
    "{time.relative}": "Current time (relative)",
    "{time.absolute}": "Current time (absolute)",
    "{server.name}": "Server name",
    "{server.id}": "Server ID",
    "{server.members}": "Server member count",
  }),
  // Older spellings, each built by two or more modules (tickets, custom
  // commands, autoresponse, sessions, applications) and by none of the rest.
  // Prefer the Global spellings; these remain because saved messages use them.
  ...G("Shared", "shared", {
    "{user}": "Mention of the member who used it (tickets and custom commands)",
    "{user.name}": "Invoking user's username",
    "{user.id}": "Invoking user's Discord ID",
    "{user.mention}": "Invoking user mention",
    "{user.avatar}": "Invoking user's avatar",
    "{user_display}": "Their display name (sessions)",
    "{user_avatar}": "Their avatar link (sessions)",
    "{server_name}": "The server’s name (applications and sessions)",
    "{server}": "The server’s name (custom commands)",
    "{channel}": "The channel, as a mention (custom commands)",
    "{now}": "The time now (custom commands)",
    "{ago}": "How long ago, like “5 minutes ago” (custom commands)",
    "{time}": "The time now (custom commands)",
  }),
  ...G("Roblox", "global", {
    "{rbx.user}": "Roblox username",
    "{rbx.display}": "Roblox display name",
    "{rbx.id}": "Roblox user ID",
    "{rbx.url}": "Roblox profile URL",
    "{rbx.age}": "Account created (relative)",
    "{rbx.age.days}": "Account age in days",
    "{rbx.created}": "Account created (absolute)",
    "{rbx.created.relative}": "Account created (relative)",
    "{rbx.avatar.url}": "Headshot image URL",
    "{rbx.avatar}": "Cached headshot emoji",
    "{rbx.link}": "Profile link",
  }),
  ...G("Roblox groups", "global", {
    "{rbx.group.member:<groupId>}": "true or false: whether they’re in the group",
    "{rbx.group.rank.name:<groupId>}": "Group rank name",
    "{rbx.rank:<groupId>}": "Group rank number",
    "{rbx.group.rank.id:<groupId>}": "Group role ID",
  }),
  ...G("Ticket", "module", {
    "{ticket.id}": "Ticket ID",
    // Set only in Cogs/Modules/tickets.py.
    "{opener.mention}": "Ticket opener mention",
    "{opener.name}": "Ticket opener username",
    "{opener.display_name}": "Ticket opener display name",
    "{opener.id}": "Ticket opener Discord ID",
  }),
  ...G("Shared", "shared", {
    // Set by tickets (close reason), infractions and promotions (the reason
    // given), and suggestions (the accept/deny reason).
    "{reason}": "The reason given (close, infraction, promotion or suggestion)",
  }),
  ...G("Ticket answers", "module", {
    "{a.1}": "First form answer",
    "{a.2}": "Second form answer",
    "{a.3}": "Third form answer",
    "{a.4}": "Fourth form answer",
    "{a.5}": "Fifth form answer",
    "{q.1}": "First form question",
    "{q.2}": "Second form question",
    "{q.3}": "Third form question",
    "{q.4}": "Fourth form question",
    "{q.5}": "Fifth form question",
  }),
  ...G("Custom command", "module", {
    "{command}": "Command name",
    "{command.name}": "Command name",
    "{command.path}": "Command path",
    "{category}": "Command category",
    "{rand}": "Random value",
    "{field1}": "Slash field 1",
    "{field2}": "Slash field 2",
    "{field3}": "Slash field 3",
    "{field4}": "Slash field 4",
    "{field5}": "Slash field 5",
  }),
  // Guild, channel, member and time placeholders. Global: they come from
  // `global_message_vars`. tests/test_variable_documentation.py in the bot
  // resolves all four tables against it.
  ...G("Server details", "global", {
    "{guild.icon}": "Server icon URL",
    "{guild.banner}": "Server banner URL",
    "{guild.members}": "Member count",
    "{guild.created}": "Server creation date",
    "{guild.created.relative}": "Server created (relative)",
    "{guild.description}": "Server description",
    "{guild.boost.tier}": "Boost / premium tier",
    "{guild.boost.count}": "Number of boosts",
    "{guild.roles}": "Number of roles",
    "{guild.channels}": "Number of channels",
    "{guild.emojis}": "Number of emojis",
    "{guild.vanity}": "Vanity invite code",
  }),
  ...G("Channel details", "global", {
    "{channel.topic}": "Channel topic",
    "{channel.category}": "Parent category name",
    "{channel.jump}": "Link to the channel",
    "{channel.nsfw}": "Whether the channel is NSFW",
    "{channel.slowmode}": "Slowmode delay (seconds)",
    "{channel.created}": "Channel creation date",
  }),
  ...G("Member details", "global", {
    "{author.display}": "Display name",
    "{author.tag}": "Username",
    "{author.created}": "Account creation date",
    "{author.created.relative}": "Account created (relative)",
    "{author.joined}": "Server join date",
    "{author.joined.relative}": "Joined (relative)",
    "{author.top_role}": "Highest role",
    "{author.roles}": "Number of roles",
    "{author.color}": "Role colour (hex)",
    "{author.boosting}": "Whether boosting (Yes/No)",
  }),
  ...G("Date & time", "global", {
    "{date}": "Current date (YYYY-MM-DD)",
    "{year}": "Current year",
    "{timestamp.short_time}": "Discord short time",
    "{timestamp.long_time}": "Discord long time",
    "{timestamp.short_date}": "Discord short date",
    "{timestamp.long_date}": "Discord long date",
    "{timestamp.short_datetime}": "Discord short date + time",
    "{timestamp.long_datetime}": "Discord long date + time",
    "{timestamp.relative}": "Discord relative time",
    "{newline}": "Line break",
    "{blank}": "Zero-width space",
  }),
  ...G("Session", "module", {
    "{server.code}": "ER:LC server code",
    "{server_code}": "ER:LC server code",
    "{server.owner}": "Configured server owner",
    "{server_owner}": "Configured server owner",
    "{votes}": "Current poll votes",
    "{votes.needed}": "Poll goal",
    "{votes_needed}": "Poll goal",
    "{votes.remaining}": "Votes still needed",
    "{votes_remaining}": "Votes still needed",
    "{voters}": "Poll voters",
    "{players}": "Current players",
    "{players.max}": "Server capacity",
    "{max_players}": "Server capacity",
    "{queue}": "Queue count",
    "{staff}": "In-game staff count",
    "{players.list}": "In-game player usernames",
    "{queue.list}": "Queued player usernames",
    "{staff.list}": "In-game staff usernames",
    "{vehicles.list}": "Spawned vehicle list",
    "{server.join.url}": "Quick-join URL",
    "{quick_join_url}": "Quick-join URL",
    "{session.status}": "Current session status",
    "{ping.role}": "Configured ping role",
    "{prc.updated.relative}": "Last PRC update (relative)",
    "{prc.updated.absolute}": "Last PRC update (absolute)",
  }),
  ...G("Giveaway", "module", {
    "{prize}": "Giveaway prize",
    "{description}": "Giveaway description",
    "{winners}": "Number of winners",
    "{host}": "Host mention",
    "{ends}": "Relative ending time",
    "{ends.full}": "Ending date and time",
    "{thumbnail}": "Giveaway thumbnail URL",
    "{entries}": "Current entry count",
    "{required.group}": "Required Roblox group link",
    "{required.roles}": "Required Discord roles",
    "{server.link}": "Game / private-server link",
  }),
  ...G("Suggestion", "module", {
    "{suggestion}": "Submitted suggestion text",
    "{upvotes}": "Current upvote count",
    "{downvote}": "Current downvote count",
    "{image}": "Submitted image URL",
  }),
  ...G("Leave request", "module", {
    "{loa.id}": "Leave request ID",
    "{loa.start}": "Leave start time",
    "{loa.end}": "Leave end time",
    "{loa.reason}": "Leave reason",
  }),
  ...G("Promotion", "module", {
    "{newrank}": "New rank, as a role mention",
    "{newrank.name}": "New rank name, as plain text",
    // The rank they came from, recorded by `PromotionSystem` on every
    // promotion.
    "{previousrank}": "Previous rank, as a role mention",
    "{previousrank.name}": "Previous rank name, as plain text",
    // `{oldrank}` is the same as `{previousrank}`; the bot accepts both.
    "{oldrank}": "Previous rank, as a role mention (same as {previousrank})",
    "{oldrank.name}": "Previous rank name, as plain text",
    // The raw ids, for a message that needs to build its own mention or link.
    "{newrank.id}": "New rank role ID",
    "{previousrank.id}": "Previous rank role ID",
  }),
  ...G("Infraction", "module", {
    "{case}": "Infraction case ID",
    "{action}": "Infraction action",
    "{notes}": "Notes",
    "{expiration}": "Expiration",
    "{infraction.start}": "Start time",
    "{infraction.end}": "End time",
    // Filled only when the infraction type demotes. Same spellings as the
    // promotion side.
    "{newrank}": "Rank after a demotion, as a role mention",
    "{newrank.name}": "Rank after a demotion, as plain text",
    "{oldrank}": "Rank before a demotion, as a role mention",
    "{oldrank.name}": "Rank before a demotion, as plain text",
    "{previousrank}": "Rank before a demotion (same as {oldrank})",
    "{previousrank.name}": "Rank before a demotion, as plain text",
  }),
  ...G("Staff / issuer", "shared", {
    "{staff.mention}": "Staff Discord mention",
    "{staff.name}": "Staff Discord username",
    "{staff.display}": "Staff display name",
    "{staff.id}": "Staff Discord ID",
    "{staff.avatar}": "Staff avatar URL",
    "{staff.rbx.user}": "Staff Roblox username",
    "{staff.rbx.id}": "Staff Roblox user ID",
    "{staff.rbx.url}": "Staff profile URL",
    "{staff.rbx.age}": "Staff created (relative)",
    "{staff.rbx.avatar}": "Staff avatar emoji",
  }),
};

/** Order groups sensibly: Global first, then Roblox, then module groups. */
const GROUP_ORDER = [
  "Global",
  // Straight after Global, because these are nearly as widely available.
  "Shared",
  "Roblox",
  "Roblox groups",
  "Ticket",
  "Ticket answers",
  "Custom command",
  "Server details",
  "Channel details",
  "Member details",
  "Date & time",
  "Session",
  "Giveaway",
  "Suggestion",
  "Leave request",
  "Promotion",
  "Infraction",
  "Staff / issuer",
  "Other",
];

/**
 * The synonyms the bot expands (utils/template_variable_migration.py):
 * `{member.*}` is `{author.*}` and `{server.*}` is `{guild.*}`, both ways, so
 * either spelling is described the same and filed under the right scope.
 */
const SYNONYM_PREFIXES: [string, string][] = [
  ["{member.", "{author."],
  ["{server.", "{guild."],
];

function canonicalVariable(key: string): string {
  for (const [alias, canonical] of SYNONYM_PREFIXES) {
    if (key.startsWith(alias)) {
      const swapped = canonical + key.slice(alias.length);
      if (VARIABLE_REGISTRY[swapped]) return swapped;
    }
    // Both directions: a picker may offer the canonical spelling for a token
    // the registry happens to list under the alias.
    if (key.startsWith(canonical)) {
      const swapped = alias + key.slice(canonical.length);
      if (VARIABLE_REGISTRY[swapped]) return swapped;
    }
  }
  return key;
}

export function describeVariable(key: string): VariableMeta {
  return (
    VARIABLE_REGISTRY[key] ||
    VARIABLE_REGISTRY[canonicalVariable(key)] || {
      group: "Other",
      scope: "module",
      description: "",
    }
  );
}

/**
 * All variable keys for the global groups plus the requested module groups, so
 * a module editor offers the full correct set.
 */
export function variablesForGroups(...groups: string[]): string[] {
  const wanted = new Set(["Global", "Roblox", "Roblox groups", ...groups]);
  return Object.entries(VARIABLE_REGISTRY)
    .filter(([, meta]) => wanted.has(meta.group))
    .map(([key]) => key);
}

/** Group a flat list of variable keys into ordered, described sections. */
export function groupVariables(
  variables: string[],
): {
  group: string;
  scope: VariableScope;
  items: { key: string; description: string; example?: string }[];
}[] {
  const byGroup = new Map<
    string,
    { scope: VariableScope; items: { key: string; description: string; example?: string }[] }
  >();
  for (const key of variables) {
    const meta = describeVariable(key);
    if (!byGroup.has(meta.group)) byGroup.set(meta.group, { scope: meta.scope, items: [] });
    byGroup.get(meta.group)!.items.push({
      key,
      description: meta.description,
      example: meta.example,
    });
  }
  return [...byGroup.entries()]
    .map(([group, value]) => ({ group, scope: value.scope, items: value.items }))
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.group);
      const bi = GROUP_ORDER.indexOf(b.group);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}
