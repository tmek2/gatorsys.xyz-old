import type { BlockDef, BlockPort } from "../blocks";

const flowOut: BlockPort = { id: "next", label: "", type: "flow" };
const flowIn: BlockPort = { id: "in", label: "", type: "flow" };

export const definitions: BlockDef[] = [
  {
    type: "erlc.heal",
    label: "Heal Player",
    description: "Restores a player to full health.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.unwanted",
    label: "Clear Wanted",
    description: "Clears a player's wanted status.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.refresh",
    label: "Refresh Player",
    description: "Reloads a player's character.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.helper_add",
    label: "Add Helper",
    description: "Grants in-game helper.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.helper_remove",
    label: "Remove Helper",
    description: "Revokes in-game helper.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.teleport",
    label: "Teleport To Player",
    description: "Moves one player to another.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
      { id: "target", label: "Move to", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
  },
  {
    type: "erlc.shutdown",
    label: "Shutdown Server",
    description: "Ends the ER:LC server session.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
  },
  {
    type: "erlc.fire_start",
    label: "Start Fire",
    description: "Starts a fire in the world.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
  },
  {
    type: "erlc.fire_stop",
    label: "Stop All Fires",
    description: "Clears every active fire.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
  },
  {
    type: "erlc.fire_stop_dumpster",
    label: "Stop Dumpster Fire",
    description: "Clears only the dumpster fire.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
  },
  {
    type: "erlc.run",
    label: "Run Game Command",
    description: "Runs any command body, without the leading colon.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "command", label: "Command", type: "text", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "command", label: "Command", kind: "text", placeholder: "pm Player Hello" },
    ],
  },
  {
    type: "erlc.team_counts",
    label: "Team Counts",
    description: "How many players are on each in-game team.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "civilian", label: "Civilian", type: "number" },
      { id: "police", label: "Police", type: "number" },
      { id: "sheriff", label: "Sheriff", type: "number" },
      { id: "fire", label: "Fire", type: "number" },
      { id: "dot", label: "DOT", type: "number" },
      { id: "jail", label: "Jail", type: "number" },
    ],
  },
  {
    type: "session.start",
    label: "Start Session",
    description: "Posts the configured Sessions start message and updates the session status.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "host", label: "Host", type: "member" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Started", type: "boolean" },
    ],
  },
  {
    type: "session.boost",
    label: "Boost Session",
    description: "Sends the session boost message.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "host", label: "Host", type: "member" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
  },
  {
    type: "session.shutdown",
    label: "Shut Session Down",
    description: "Posts the configured shutdown message and marks the session offline. In-game shutdown commands remain separate actions.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "host", label: "Host", type: "member" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Closed", type: "boolean" },
    ],
  },
  {
    type: "shift.end_break",
    label: "End Break",
    description: "Ends a member's break and returns how long it ran.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "minutes", label: "Minutes", type: "number" },
    ],
  },
  {
    type: "shift.end_all",
    label: "End Every Shift",
    description: "Ends every shift currently running.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "count", label: "Ended", type: "number" },
    ],
  },
  {
    type: "is_equal",
    label: "Is Equal",
    description: "Whether two values are the same.",
    category: "condition",
    inputs: [
      { id: "a", label: "Value", type: "text", required: true },
      { id: "b", label: "Equals", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "b", label: "Equals", kind: "text" },
    ],
  },
  {
    type: "contains_value",
    label: "Contains",
    description: "Whether a list or record holds a value.",
    category: "condition",
    inputs: [
      { id: "value", label: "List", type: "list", required: true },
      { id: "find", label: "Contains", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "find", label: "Contains", kind: "text" },
    ],
  },
  {
    type: "both",
    label: "Both",
    description: "True only when both sides are true.",
    category: "condition",
    inputs: [
      { id: "a", label: "This", type: "boolean", required: true },
      { id: "b", label: "And this", type: "boolean", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
  },
  {
    type: "either",
    label: "Either",
    description: "True when at least one side is true.",
    category: "condition",
    inputs: [
      { id: "a", label: "This", type: "boolean", required: true },
      { id: "b", label: "Or this", type: "boolean", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
  },
  {
    type: "greater",
    label: "Greater Than",
    description: "Whether the first number is larger than the second.",
    category: "condition",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "Compared to", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "b", label: "Compared to", kind: "number" },
    ],
  },
  {
    type: "less",
    label: "Less Than",
    description: "Whether the first number is smaller than the second.",
    category: "condition",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "Compared to", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "b", label: "Compared to", kind: "number" },
    ],
  },
  {
    type: "at_least",
    label: "At Least",
    description: "Whether the first number is at least the second.",
    category: "condition",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "Compared to", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "b", label: "Compared to", kind: "number" },
    ],
  },
  {
    type: "at_most",
    label: "At Most",
    description: "Whether the first number is at most the second.",
    category: "condition",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "Compared to", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "b", label: "Compared to", kind: "number" },
    ],
  },
  {
    type: "in_range",
    label: "In Range",
    description: "Whether a number falls inside a range.",
    category: "condition",
    inputs: [
      { id: "value", label: "Number", type: "number", required: true },
      { id: "low", label: "At least", type: "number" },
      { id: "high", label: "At most", type: "number" },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "low", label: "At least", kind: "number" },
      { id: "high", label: "At most", kind: "number" },
    ],
  },
  {
    type: "has_discord_permission",
    label: "Has Discord Permission",
    description: "Whether a member holds a Discord permission.",
    category: "condition",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "permission", label: "Permission", kind: "select", options: [{ value: "administrator", label: "Administrator" }, { value: "manage_guild", label: "Manage server" }, { value: "manage_roles", label: "Manage roles" }, { value: "kick_members", label: "Kick members" }, { value: "ban_members", label: "Ban members" }, { value: "moderate_members", label: "Timeout members" }, { value: "manage_messages", label: "Manage messages" }] },
    ],
  },
  {
    type: "has_tier",
    label: "Has Staff Tier",
    description: "Whether a member is at or above one of this server's tiers.",
    category: "condition",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "tier", label: "Tier", kind: "select", options: [{ value: "staff", label: "Staff" }, { value: "management", label: "Management" }, { value: "admin", label: "Admin" }] },
    ],
  },
  {
    type: "player_is_mod",
    label: "Player Is Moderator",
    description: "Whether a player has in-game moderator or above.",
    category: "condition",
    inputs: [
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
  },
  {
    type: "player_permission",
    label: "Player Has Permission",
    description: "Whether a player holds a given in-game permission.",
    category: "condition",
    inputs: [
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "permission", label: "Permission", kind: "select", options: [{ value: "moderator", label: "Moderator" }, { value: "administrator", label: "Administrator" }, { value: "owner", label: "Owner" }] },
    ],
  },
  {
    type: "player_on_team",
    label: "Player On Team",
    description: "Whether a player is on a given in-game team.",
    category: "condition",
    inputs: [
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "team", label: "Team", kind: "select", options: [{ value: "civilian", label: "Civilian" }, { value: "police", label: "Police" }, { value: "sheriff", label: "Sheriff" }, { value: "fire", label: "Fire" }, { value: "dot", label: "Dot" }, { value: "jail", label: "Jail" }] },
    ],
  },
  {
    type: "session_status",
    label: "Session Is",
    description: "Whether the server's session is in a given state.",
    category: "condition",
    inputs: [],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "status", label: "Status", kind: "select", options: [{ value: "running", label: "Running" }, { value: "voting", label: "Vote open" }, { value: "closed", label: "Closed" }] },
    ],
  },
  {
    type: "in_department",
    label: "In Department",
    description: "Whether a member belongs to a department.",
    category: "condition",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "boolean" },
    ],
    fields: [
      { id: "department", label: "Department", kind: "text" },
    ],
  },
  {
    type: "value_text",
    label: "Text",
    description: "A text you type here, ready to wire anywhere.",
    category: "data",
    inputs: [{ id: "value", label: "Text", type: "text" }],
    outputs: [
      { id: "value", label: "Value", type: "text" },
    ],
    fields: [
      { id: "value", label: "Text", kind: "text" },
    ],
  },
  {
    type: "value_number",
    label: "Number",
    description: "A number you type here, ready to wire anywhere.",
    category: "data",
    inputs: [{ id: "value", label: "Number", type: "number" }],
    outputs: [
      { id: "value", label: "Value", type: "number" },
    ],
    fields: [
      { id: "value", label: "Number", kind: "number" },
    ],
  },
  {
    type: "value_boolean",
    label: "Yes / No",
    description: "A fixed true or false.",
    category: "data",
    inputs: [{ id: "value", label: "Yes / no", type: "boolean" }],
    outputs: [
      { id: "value", label: "Value", type: "boolean" },
    ],
    fields: [
      { id: "value", label: "Value", kind: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
    ],
  },
  {
    type: "math_add",
    label: "Add",
    description: "The two numbers added together.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_subtract",
    label: "Subtract",
    description: "The first number minus the second.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_multiply",
    label: "Multiply",
    description: "The two numbers multiplied.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_divide",
    label: "Divide",
    description: "The first number divided by the second.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_min",
    label: "Smaller Of",
    description: "Whichever of the two numbers is smaller.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_max",
    label: "Larger Of",
    description: "Whichever of the two numbers is larger.",
    category: "data",
    inputs: [
      { id: "a", label: "Number", type: "number", required: true },
      { id: "b", label: "And", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "b", label: "And", kind: "number" },
    ],
  },
  {
    type: "math_round",
    label: "Round",
    description: "A number rounded to whole, up, or down.",
    category: "data",
    inputs: [
      { id: "value", label: "Number", type: "number", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "number" },
    ],
    fields: [
      { id: "mode", label: "Mode", kind: "select", options: [{ value: "nearest", label: "Nearest" }, { value: "up", label: "Up" }, { value: "down", label: "Down" }] },
    ],
  }
];
