/**
 * The block catalogue: what a workflow can be built from.
 *
 * Every block declares typed outputs (what it produces) and typed inputs (what
 * it needs); you wire one to another and the value flows. A punishment trigger
 * outputs an Id, a Type, a Player, a Moderator, a Reason and a Description; a
 * "send message" block takes a Channel and Text.
 *
 * Connections are type-checked: a Player output does not fit a Channel input.
 * The colours below are the port types (purple is always text).
 */

export type PortType =
  | "text"
  | "number"
  | "boolean"
  | "user"
  | "member"
  | "role"
  | "channel"
  | "player"
  | "record"
  | "message"
  | "list"
  | "time"
  | "flow";

export const PORT_COLORS: Record<PortType, string> = {
  // Deliberately few and deliberately distinct at 8px. A palette with twelve
  // near-identical hues is a palette nobody learns.
  text: "#c084fc",
  number: "#38bdf8",
  boolean: "#fb7185",
  user: "#34d399",
  member: "#34d399",
  role: "#f59e0b",
  channel: "#22d3ee",
  player: "#fbbf24",
  record: "#a78bfa",
  message: "#f472b6",
  list: "#818cf8",
  time: "#a3a3a3",
  flow: "#e5e7eb",
};

export const PORT_LABELS: Record<PortType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / no",
  user: "Discord user",
  member: "Server member",
  role: "Role",
  channel: "Channel",
  player: "Roblox player",
  record: "Record",
  message: "Message",
  list: "List",
  time: "Time",
  flow: "Flow",
};

export type BlockPort = {
  id: string;
  label: string;
  type: PortType;
  /** Inputs only: the block will not run until this is connected or filled. */
  required?: boolean;
};

export type BlockCategory =
  | "trigger"
  | "action"
  | "message"
  | "logic"
  | "condition"
  | "data"
  | "roblox"
  | "staff"
  | "flow";

/**
 * A control on the node itself, for inputs that usually do not need a wire
 * (like a message's text). The matching port still exists, and a wire into it
 * wins.
 */
export type BlockField = {
  id: string;
  label: string;
  kind: "text" | "textarea" | "number" | "select" | "role" | "channel" | "message";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type BlockDef = {
  type: string;
  label: string;
  description: string;
  category: BlockCategory;
  inputs: BlockPort[];
  outputs: BlockPort[];
  /** Inline controls, rendered inside the node under its ports. */
  fields?: BlockField[];
  /** Triggers start a graph and take no flow input. */
  isTrigger?: boolean;
};

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  trigger: "Triggers",
  action: "Actions",
  message: "Messages & embeds",
  logic: "Logic",
  condition: "Conditions",
  data: "Data",
  roblox: "Roblox & ER:LC",
  staff: "Staff",
  flow: "Flow control",
};

/**
 * The order the palette lists categories in: triggers first, flow control last.
 * Rendered from this rather than `Object.keys`.
 */
export const CATEGORY_ORDER: BlockCategory[] = [
  "trigger",
  "action",
  "message",
  "roblox",
  "staff",
  "condition",
  "logic",
  "data",
  "flow",
];

/** Header gradients, one per category. */
export const CATEGORY_ACCENTS: Record<BlockCategory, string> = {
  trigger: "#b45309",
  action: "#1d4ed8",
  message: "#9d174d",
  logic: "#7c3aed",
  condition: "#0369a1",
  data: "#0f766e",
  roblox: "#be123c",
  staff: "#047857",
  flow: "#5c5c5c",
};

const flowOut: BlockPort = { id: "next", label: "", type: "flow" };
const flowIn: BlockPort = { id: "in", label: "", type: "flow" };

export const BLOCKS: BlockDef[] = [
  ...(["enable", "disable"] as const).map(action => ({
    type: `workflow.${action}`, label: action === "enable" ? "Enable Workflow" : "Disable Workflow",
    description: action === "enable" ? "Enable a valid, configured workflow in this server." : "Pause a workflow so future events do not start it.",
    category: "flow" as const, inputs: [flowIn], outputs: [flowOut],
    fields: [{ id: "workflow", label: "Workflow", kind: "text" as const }],
  })),
  // ── Triggers ────────────────────────────────────────────────────────────
  {
    type: "punishment.created",
    label: "Log Created",
    description: "When a punishment log is created.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "id", label: "Id", type: "text" },
      { id: "type", label: "Type", type: "text" },
      { id: "player", label: "Player", type: "player" },
      { id: "moderator", label: "Moderator", type: "member" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "description", label: "Description", type: "text" },
    ],
  },
  {
    type: "member.joined",
    label: "Member Joined",
    description: "When somebody joins the server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Member", type: "member" },
      { id: "account_age", label: "Account age (days)", type: "number" },
    ],
  },
  {
    type: "member.left",
    label: "Member Left",
    description: "When somebody leaves the server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Member", type: "member" },
      { id: "joined_days", label: "Days in server", type: "number" },
    ],
  },
  {
    type: "shift.started",
    label: "Shift Started",
    description: "When a staff member goes on duty.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Member", type: "member" },
      { id: "department", label: "Department", type: "text" },
      { id: "shift_type", label: "Shift type", type: "text" },
      { id: "active_shifts", label: "Staff on duty", type: "number" },
    ],
  },
  {
    type: "shift.ended",
    label: "Shift Ended",
    description: "When a staff member goes off duty.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Member", type: "member" },
      { id: "minutes", label: "Minutes worked", type: "number" },
      { id: "department", label: "Department", type: "text" },
    ],
  },
  {
    type: "application.approved",
    label: "Application Approved",
    description: "When an application is accepted.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Applicant", type: "member" },
      { id: "application", label: "Application", type: "text" },
      { id: "reviewer", label: "Reviewer", type: "member" },
    ],
  },
  {
    type: "application.rejected",
    label: "Application Rejected",
    description: "When an application is turned down.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Applicant", type: "member" },
      { id: "application", label: "Application", type: "text" },
      { id: "reason", label: "Reason", type: "text" },
    ],
  },
  {
    type: "form.submitted",
    label: "Form Submitted",
    description: "When somebody submits a form.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Submitter", type: "member" },
      { id: "form", label: "Form", type: "text" },
    ],
  },
  {
    type: "ticket.closed",
    label: "Ticket Closed",
    description: "When a ticket is closed.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Opener", type: "member" },
      { id: "closer", label: "Closed by", type: "member" },
      { id: "panel", label: "Panel", type: "text" },
    ],
  },
  {
    type: "infraction.created",
    label: "Infraction Issued",
    description: "When a staff infraction is issued.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "staff", label: "Staff member", type: "member" },
      { id: "action", label: "Action", type: "text" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "issuer", label: "Issued by", type: "member" },
    ],
  },
  {
    type: "promotion.created",
    label: "Promotion Issued",
    description: "When somebody is promoted.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "staff", label: "Staff member", type: "member" },
      { id: "rank", label: "New rank", type: "text" },
    ],
  },
  {
    type: "leave.started",
    label: "Leave Started",
    description: "When a leave of absence or reduced activity begins.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      flowOut,
      { id: "member", label: "Member", type: "member" },
      { id: "kind", label: "Type", type: "text" },
      { id: "days", label: "Days", type: "number" },
    ],
  },
  {
    type: "leave.ended",
    label: "Leave Ended",
    description: "When a leave of absence or reduced activity ends.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [flowOut, { id: "member", label: "Member", type: "member" }],
  },
  {
    type: "manual",
    label: "Run By Hand",
    description: "Only runs when somebody starts it.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [flowOut, { id: "actor", label: "Started by", type: "member" }],
  },
  {
    type: "schedule",
    label: "On A Schedule",
    description: "Runs every so often, whether anything happened or not.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [flowOut, { id: "now", label: "Time", type: "text" }],
  },

  // ── Actions ─────────────────────────────────────────────────────────────
  {
    type: "role_add",
    label: "Give A Role",
    description: "Add a role to a member.",
    category: "action",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "role", label: "Role", type: "role", required: true },
    ],
    outputs: [flowOut],
  },
  {
    type: "role_remove",
    label: "Take A Role",
    description: "Remove a role from a member.",
    category: "action",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "role", label: "Role", type: "role", required: true },
    ],
    outputs: [flowOut],
  },
  {
    type: "dm",
    label: "Send A DM",
    description: "Message a member directly.",
    category: "message",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "text", label: "Message", type: "text" },
      { id: "embed", label: "Embed", type: "message" },
    ],
    outputs: [flowOut, { id: "delivered", label: "Delivered", type: "boolean" }],
  },
  {
    type: "send",
    label: "Post A Message",
    description: "Send a message to a channel.",
    category: "message",
    inputs: [
      flowIn,
      { id: "channel", label: "Channel", type: "channel" },
      { id: "text", label: "Message", type: "text" },
      { id: "embed", label: "Embed", type: "message" },
    ],
    outputs: [flowOut, { id: "message", label: "Message", type: "message" }],
    // No fields: `channel` and `text` are ports, and an unwired port renders
    // its own editor. A separate field for the same value would be a second
    // control the engine does not read.
  },
  {
    type: "log",
    label: "Write A Log",
    description: "Record a line in a log channel.",
    category: "action",
    inputs: [
      flowIn,
      { id: "channel", label: "Channel", type: "channel" },
      { id: "text", label: "Line", type: "text", required: true },
    ],
    outputs: [flowOut],
  },
  {
    type: "nickname",
    label: "Set A Nickname",
    description: "Rename a member.",
    category: "action",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "nickname", label: "Nickname", type: "text", required: true },
    ],
    outputs: [flowOut],
  },
  {
    type: "ticket_close",
    label: "Close A Ticket",
    description: "Close the member's open ticket.",
    category: "action",
    inputs: [flowIn, { id: "member", label: "Member", type: "member", required: true }],
    outputs: [flowOut],
  },
  {
    type: "wait",
    label: "Wait",
    description: "Pause before the next block.",
    category: "action",
    inputs: [flowIn, { id: "seconds", label: "Seconds", type: "number", required: true }],
    outputs: [flowOut],
  },

  // ── Logic ───────────────────────────────────────────────────────────────
  {
    type: "branch",
    label: "If / Otherwise",
    description: "Take one path or the other.",
    category: "logic",
    inputs: [flowIn, { id: "test", label: "Condition", type: "boolean", required: true }],
    outputs: [
      { id: "then", label: "If true", type: "flow" },
      { id: "else", label: "Otherwise", type: "flow" },
    ],
  },
  {
    type: "compare",
    label: "Compare",
    description: "Is one number bigger than another?",
    category: "logic",
    inputs: [
      { id: "left", label: "Left", type: "number", required: true },
      { id: "right", label: "Right", type: "number", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "has_role",
    label: "Has Role?",
    description: "Whether a member holds a role.",
    category: "logic",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
      { id: "role", label: "Role", type: "role", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "matches",
    label: "Text Matches?",
    description: "Whether text contains something.",
    category: "logic",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
      { id: "needle", label: "Contains", type: "text", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "all_of",
    label: "All Of",
    description: "True only when every input is true.",
    category: "logic",
    inputs: [
      { id: "a", label: "First", type: "boolean", required: true },
      { id: "b", label: "Second", type: "boolean", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "any_of",
    label: "Any Of",
    description: "True when at least one input is true.",
    category: "logic",
    inputs: [
      { id: "a", label: "First", type: "boolean", required: true },
      { id: "b", label: "Second", type: "boolean", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "negate",
    label: "Not",
    description: "Flips true and false.",
    category: "logic",
    inputs: [{ id: "value", label: "Value", type: "boolean", required: true }],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },

  // ── Data ────────────────────────────────────────────────────────────────
  {
    type: "text_value",
    label: "Text",
    description: "Type text or use text from another block.",
    category: "data",
    inputs: [{ id: "value", label: "Text", type: "text" }],
    outputs: [{ id: "value", label: "Value", type: "text" }],
    fields: [{ id: "value", label: "Text", kind: "textarea", placeholder: "Anything" }],
  },
  {
    type: "number_value",
    label: "Number",
    description: "Type a number or pass one through from another block, such as account age or player count.",
    category: "data",
    inputs: [{ id: "value", label: "Number", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    fields: [{ id: "value", label: "Number", kind: "number", placeholder: "0" }],
  },
  {
    type: "role_value",
    label: "Pick A Role",
    description: "A role chosen from this server.",
    category: "data",
    inputs: [],
    outputs: [{ id: "value", label: "Role", type: "role" }],
    fields: [{ id: "value", label: "Role", kind: "role" }],
  },
  {
    type: "channel_value",
    label: "Pick A Channel",
    description: "A channel chosen from this server.",
    category: "data",
    inputs: [],
    outputs: [{ id: "value", label: "Channel", type: "channel" }],
    fields: [{ id: "value", label: "Channel", kind: "channel" }],
  },
  {
    type: "join_text",
    label: "Join Text",
    description: "Glue two pieces of text together.",
    category: "data",
    inputs: [
      { id: "a", label: "First", type: "text", required: true },
      { id: "b", label: "Second", type: "text" },
    ],
    outputs: [{ id: "value", label: "Result", type: "text" }],
  },
  {
    type: "member_name",
    label: "Member Name",
    description: "A member's display name as text.",
    category: "data",
    inputs: [{ id: "member", label: "Member", type: "member", required: true }],
    outputs: [
      { id: "name", label: "Name", type: "text" },
      { id: "mention", label: "Mention", type: "text" },
      { id: "id", label: "Id", type: "text" },
    ],
  },

  // ── Roblox & ER:LC ──────────────────────────────────────────────────────
  {
    type: "roblox_lookup",
    label: "Look Up Player",
    description: "Roblox account details for a player.",
    category: "roblox",
    inputs: [{ id: "player", label: "Player", type: "player", required: true }],
    outputs: [
      { id: "username", label: "Username", type: "text" },
      { id: "display", label: "Display name", type: "text" },
      { id: "id", label: "Roblox id", type: "text" },
      { id: "age_days", label: "Account age (days)", type: "number" },
    ],
  },
  {
    type: "roblox_linked_member",
    label: "Linked Member",
    description: "The Discord member linked to a Roblox player.",
    category: "roblox",
    inputs: [{ id: "player", label: "Player", type: "player", required: true }],
    outputs: [
      { id: "member", label: "Member", type: "member" },
      { id: "linked", label: "Is linked", type: "boolean" },
    ],
  },
  {
    type: "erlc_command",
    label: "Run ER:LC Command",
    description: "Send an approved command to the linked server.",
    category: "roblox",
    inputs: [
      flowIn,
      { id: "command", label: "Command", type: "text", required: true },
      { id: "target", label: "Target", type: "player" },
    ],
    outputs: [flowOut, { id: "ok", label: "Accepted", type: "boolean" }],
  },
  {
    type: "erlc_status",
    label: "Server Status",
    description: "Live player count, queue and staff on duty.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "players", label: "Players", type: "number" },
      { id: "queue", label: "Queue", type: "number" },
      { id: "staff", label: "Staff", type: "number" },
    ],
  },
  {
    type: "punish",
    label: "File A Punishment",
    description: "Record a punishment against a player.",
    category: "roblox",
    inputs: [
      flowIn,
      { id: "player", label: "Player", type: "player", required: true },
      { id: "type", label: "Type", type: "text", required: true },
      { id: "reason", label: "Reason", type: "text", required: true },
    ],
    outputs: [flowOut, { id: "case_id", label: "Case id", type: "text" }],
  },

  // ── Staff ───────────────────────────────────────────────────────────────
  {
    type: "shift_time",
    label: "Shift Time",
    description: "How long a member has worked recently.",
    category: "staff",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
      { id: "days", label: "Over days", type: "number" },
    ],
    outputs: [
      { id: "minutes", label: "Minutes", type: "number" },
      { id: "shifts", label: "Shifts", type: "number" },
      { id: "met_quota", label: "Met quota", type: "boolean" },
    ],
  },
  {
    type: "infraction_count",
    label: "Infraction Count",
    description: "How many infractions a member has.",
    category: "staff",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
      { id: "days", label: "Over days", type: "number" },
    ],
    outputs: [{ id: "count", label: "Count", type: "number" }],
  },
  {
    type: "issue_infraction",
    label: "Issue An Infraction",
    description: "File a staff infraction.",
    category: "staff",
    inputs: [
      flowIn,
      { id: "member", label: "Staff member", type: "member", required: true },
      { id: "action", label: "Action", type: "text", required: true },
      { id: "reason", label: "Reason", type: "text", required: true },
    ],
    outputs: [flowOut],
  },
  {
    type: "on_leave",
    label: "On Leave?",
    description: "Whether a member is currently on leave.",
    category: "staff",
    inputs: [{ id: "member", label: "Member", type: "member", required: true }],
    outputs: [
      { id: "result", label: "On leave", type: "boolean" },
      { id: "kind", label: "Type", type: "text" },
    ],
  },
];


// ── messages and embeds ──
//
// A message is a value you compose (an embed with a title, colour, fields,
// thumbnail and footer) and hand to whatever sends it.
BLOCKS.push(
  {
    type: "embed_build",
    label: "Build An Embed",
    description: "Compose an embed to send.",
    category: "message",
    inputs: [
      { id: "title", label: "Title", type: "text" },
      { id: "description", label: "Description", type: "text" },
      { id: "thumbnail", label: "Thumbnail URL", type: "text" },
      { id: "image", label: "Image URL", type: "text" },
      { id: "footer", label: "Footer", type: "text" },
    ],
    outputs: [{ id: "embed", label: "Embed", type: "message" }],
    fields: [
      { id: "title", label: "Title", kind: "text", placeholder: "Heading" },
      { id: "description", label: "Description", kind: "textarea" },
      { id: "color", label: "Colour", kind: "text", placeholder: "#ffb3ab" },
    ],
  },
  {
    type: "embed_field",
    label: "Add An Embed Field",
    description: "Attach a name/value row to an embed.",
    category: "message",
    inputs: [
      { id: "embed", label: "Embed", type: "message", required: true },
      { id: "name", label: "Name", type: "text" },
      { id: "value", label: "Value", type: "text" },
    ],
    outputs: [{ id: "embed", label: "Embed", type: "message" }],
    fields: [
      { id: "name", label: "Name", kind: "text" },
      { id: "value", label: "Value", kind: "textarea" },
      {
        id: "inline",
        label: "Layout",
        kind: "select",
        options: [
          { value: "false", label: "Full width" },
          { value: "true", label: "Inline" },
        ],
      },
    ],
  },
  {
    type: "template_message",
    label: "Use A Template",
    description: "One of this server's saved message templates.",
    category: "message",
    inputs: [],
    outputs: [{ id: "message", label: "Message", type: "message" }],
    fields: [{ id: "template", label: "Template", kind: "message" }],
  },
  {
    type: "reply",
    label: "Reply To A Message",
    description: "Answer a message in place.",
    category: "message",
    inputs: [
      flowIn,
      { id: "message", label: "Message", type: "message", required: true },
      { id: "text", label: "Reply", type: "text" },
    ],
    outputs: [flowOut],
    fields: [{ id: "content", label: "Reply", kind: "textarea" }],
  },
  {
    type: "react",
    label: "React To A Message",
    description: "Add an emoji reaction.",
    category: "message",
    inputs: [flowIn, { id: "message", label: "Message", type: "message", required: true }],
    outputs: [flowOut],
    fields: [{ id: "emoji", label: "Emoji", kind: "text", placeholder: "✅" }],
  },
  {
    type: "pin",
    label: "Pin A Message",
    description: "Pin it in its channel.",
    category: "message",
    inputs: [flowIn, { id: "message", label: "Message", type: "message", required: true }],
    outputs: [flowOut],
  },
  {
    type: "delete_message",
    label: "Delete A Message",
    description: "Remove a message.",
    category: "message",
    inputs: [flowIn, { id: "message", label: "Message", type: "message", required: true }],
    outputs: [flowOut],
  },
  {
    type: "thread_create",
    label: "Start A Thread",
    description: "Open a thread on a message or in a channel.",
    category: "message",
    inputs: [
      flowIn,
      { id: "channel", label: "Channel", type: "channel" },
      { id: "message", label: "On message", type: "message" },
    ],
    outputs: [flowOut, { id: "thread", label: "Thread", type: "channel" }],
    fields: [{ id: "name", label: "Thread name", kind: "text" }],
  },

  // ── flow control ──
  //
  // Repeat over a list, run two paths, stop early, wait until later.
  {
    type: "for_each",
    label: "For Each",
    description: "Run the next blocks once per item.",
    category: "flow",
    inputs: [flowIn, { id: "list", label: "List", type: "list", required: true }],
    outputs: [
      { id: "next", label: "Each", type: "flow" },
      { id: "item", label: "Item", type: "record" },
      { id: "index", label: "Index", type: "number" },
      { id: "done", label: "When finished", type: "flow" },
    ],
  },
  {
    type: "parallel",
    label: "Do Both",
    description: "Run two paths at once.",
    category: "flow",
    inputs: [flowIn],
    outputs: [
      { id: "next", label: "First", type: "flow" },
      { id: "second", label: "Second", type: "flow" },
    ],
  },
  {
    type: "stop",
    label: "Stop Here",
    description: "End the run without an error.",
    category: "flow",
    inputs: [flowIn],
    outputs: [],
  },
  {
    type: "guard",
    label: "Only Continue If",
    description: "Stop unless the condition holds.",
    category: "flow",
    inputs: [flowIn, { id: "test", label: "Condition", type: "boolean", required: true }],
    outputs: [flowOut],
  },
  {
    type: "delay_until",
    label: "Wait Until",
    description: "Hold until a time of day.",
    category: "flow",
    inputs: [flowIn, { id: "when", label: "Time", type: "time" }],
    outputs: [flowOut],
    fields: [{ id: "at", label: "Time", kind: "text", placeholder: "18:00" }],
  },
  {
    type: "cooldown",
    label: "Rate Limit",
    description: "Skip if this ran recently.",
    category: "flow",
    inputs: [flowIn],
    outputs: [flowOut, { id: "skipped", label: "Skipped", type: "flow" }],
    fields: [{ id: "seconds", label: "Every (seconds)", kind: "number", placeholder: "300" }],
  },
  {
    type: "note",
    label: "Note",
    description: "A comment on the canvas. Does nothing.",
    category: "flow",
    inputs: [],
    outputs: [],
    fields: [{ id: "text", label: "", kind: "textarea", placeholder: "Why this exists…" }],
  },

  // ── More data ───────────────────────────────────────────────────────────
  {
    type: "switch",
    label: "Match",
    description: "Pick a path by matching text.",
    category: "logic",
    inputs: [flowIn, { id: "value", label: "Value", type: "text", required: true }],
    outputs: [
      { id: "next", label: "Matches", type: "flow" },
      { id: "else", label: "Otherwise", type: "flow" },
    ],
    fields: [{ id: "cases", label: "One per line", kind: "textarea", placeholder: "ban\nkick" }],
  },
  {
    type: "in_list",
    label: "Is In List?",
    description: "Whether a value appears in a list.",
    category: "logic",
    inputs: [
      { id: "list", label: "List", type: "list", required: true },
      { id: "value", label: "Value", type: "text", required: true },
    ],
    outputs: [{ id: "result", label: "Result", type: "boolean" }],
  },
  {
    type: "count",
    label: "Count",
    description: "How many items a list holds.",
    category: "data",
    inputs: [{ id: "list", label: "List", type: "list", required: true }],
    outputs: [{ id: "value", label: "Count", type: "number" }],
  },
  {
    type: "math",
    label: "Arithmetic",
    description: "Add, subtract, multiply or divide.",
    category: "data",
    inputs: [
      { id: "left", label: "Left", type: "number", required: true },
      { id: "right", label: "Right", type: "number", required: true },
    ],
    outputs: [{ id: "value", label: "Result", type: "number" }],
    fields: [
      {
        id: "op",
        label: "Operation",
        kind: "select",
        options: [
          { value: "add", label: "Add" },
          { value: "sub", label: "Subtract" },
          { value: "mul", label: "Multiply" },
          { value: "div", label: "Divide" },
        ],
      },
    ],
  },
  {
    type: "format_time",
    label: "Format A Time",
    description: "A timestamp as readable text.",
    category: "data",
    inputs: [{ id: "when", label: "Time", type: "time" }],
    outputs: [{ id: "value", label: "Text", type: "text" }],
    fields: [
      {
        id: "style",
        label: "Style",
        kind: "select",
        options: [
          { value: "R", label: "Relative (in 2 hours)" },
          { value: "F", label: "Full date and time" },
          { value: "d", label: "Short date" },
        ],
      },
    ],
  },
  {
    type: "now",
    label: "Right Now",
    description: "The current time.",
    category: "data",
    inputs: [],
    outputs: [{ id: "value", label: "Time", type: "time" }],
  },
  {
    type: "members_with_role",
    label: "Members With A Role",
    description: "Everyone holding a role, as a list.",
    category: "data",
    inputs: [{ id: "role", label: "Role", type: "role", required: true }],
    outputs: [
      { id: "value", label: "Members", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "random_of",
    label: "Pick One At Random",
    description: "One item out of a list.",
    category: "data",
    inputs: [{ id: "list", label: "List", type: "list", required: true }],
    outputs: [{ id: "value", label: "Item", type: "record" }],
  },

  // ── More actions ────────────────────────────────────────────────────────
  {
    type: "timeout",
    label: "Time A Member Out",
    description: "Mute them for a while.",
    category: "action",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "minutes", label: "Minutes", type: "number" },
    ],
    outputs: [flowOut],
    fields: [
      { id: "minutes", label: "Minutes", kind: "number", placeholder: "10" },
      { id: "reason", label: "Reason", kind: "text" },
    ],
  },
  {
    type: "kick_member",
    label: "Kick A Member",
    description: "Remove them from the server.",
    category: "action",
    inputs: [flowIn, { id: "member", label: "Member", type: "member", required: true }],
    outputs: [flowOut],
    fields: [{ id: "reason", label: "Reason", kind: "text" }],
  },
  {
    type: "channel_permission",
    label: "Set A Channel Permission",
    description: "Allow or deny a role in one channel.",
    category: "action",
    inputs: [
      flowIn,
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "role", label: "Role", type: "role", required: true },
    ],
    outputs: [flowOut],
    fields: [
      {
        id: "mode",
        label: "Access",
        kind: "select",
        options: [
          { value: "allow", label: "Allow" },
          { value: "deny", label: "Deny" },
          { value: "reset", label: "Reset to default" },
        ],
      },
    ],
  },
  {
    type: "webhook",
    label: "Call A Webhook",
    description: "POST somewhere outside Discord.",
    category: "action",
    inputs: [flowIn, { id: "body", label: "Body", type: "text" }],
    outputs: [flowOut, { id: "ok", label: "Succeeded", type: "boolean" }],
    fields: [{ id: "url", label: "URL", kind: "text", placeholder: "https://…" }],
  },
  {
    type: "start_shift",
    label: "Put On Duty",
    description: "Start a shift for a member.",
    category: "staff",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "department", label: "Department", type: "text" },
    ],
    outputs: [flowOut],
  },
  {
    type: "end_shift",
    label: "Take Off Duty",
    description: "End a member's shift.",
    category: "staff",
    inputs: [flowIn, { id: "member", label: "Member", type: "member", required: true }],
    outputs: [flowOut, { id: "minutes", label: "Minutes worked", type: "number" }],
  },
  {
    type: "start_leave",
    label: "Put On Leave",
    description: "Start leave for a member.",
    category: "staff",
    inputs: [
      flowIn,
      { id: "member", label: "Member", type: "member", required: true },
      { id: "days", label: "Days", type: "number" },
    ],
    outputs: [flowOut],
    fields: [
      {
        id: "kind",
        label: "Type",
        kind: "select",
        options: [
          { value: "loa", label: "Leave of absence" },
          { value: "ra", label: "Reduced activity" },
        ],
      },
      { id: "reason", label: "Reason", kind: "text" },
    ],
  },
  {
    type: "staff_on_duty",
    label: "Staff On Duty",
    description: "Everyone currently working, as a list.",
    category: "staff",
    inputs: [{ id: "department", label: "Department", type: "text" }],
    outputs: [
      { id: "value", label: "Members", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "erlc_players",
    label: "Players In Server",
    description: "Everyone in the linked ER:LC server.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "value", label: "Players", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "erlc_message",
    label: "Announce In Game",
    description: "Send a server message or hint.",
    category: "roblox",
    inputs: [flowIn, { id: "text", label: "Text", type: "text" }],
    outputs: [flowOut],
    fields: [
      { id: "text", label: "Text", kind: "textarea" },
      {
        id: "style",
        label: "As",
        kind: "select",
        options: [
          { value: "m", label: "Message" },
          { value: "h", label: "Hint" },
        ],
      },
    ],
  },
  {
    type: "player_record",
    label: "Player Record",
    description: "This server's punishment history for a player.",
    category: "roblox",
    inputs: [{ id: "player", label: "Player", type: "player", required: true }],
    outputs: [
      { id: "cases", label: "Cases", type: "number" },
      { id: "points", label: "Points", type: "number" },
      { id: "has_bolo", label: "Has BOLO", type: "boolean" },
      { id: "value", label: "Records", type: "list" },
    ],
  },
);

/* ── everything else the bot can do ──

   Each block below exposes something the bot can already do from a command or a
   module; a block for a capability the engine lacks would fail at run time.
   Generated from a table so the same concept always has the same port id and
   type ("player" is always `player`, "reason" is always `text`), which keeps
   the connection type check useful. */
BLOCKS.push(
  {
    type: "message.sent",
    label: "Message Sent",
    description: "When a message is posted in a channel you watch.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Author", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
      { id: "content", label: "Content", type: "text" },
      { id: "message", label: "Message", type: "message" },
    ],
    fields: [
      { id: "channel", label: "Only in channel", kind: "channel" },
    ],
  },
  {
    type: "message.deleted",
    label: "Message Deleted",
    description: "When a message is deleted.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Author", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
      { id: "content", label: "Content", type: "text" },
    ],
  },
  {
    type: "message.edited",
    label: "Message Edited",
    description: "When a message is edited.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Author", type: "member" },
      { id: "before", label: "Before", type: "text" },
      { id: "after", label: "After", type: "text" },
    ],
  },
  {
    type: "reaction.added",
    label: "Reaction Added",
    description: "When somebody reacts to a message.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "emoji", label: "Emoji", type: "text" },
      { id: "message", label: "Message", type: "message" },
    ],
  },
  {
    type: "member.banned",
    label: "Member Banned",
    description: "When a member is banned from the Discord server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "user", label: "User", type: "user" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "moderator", label: "Moderator", type: "member" },
    ],
  },
  {
    type: "member.unbanned",
    label: "Member Unbanned",
    description: "When a Discord ban is lifted.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "user", label: "User", type: "user" },
      { id: "moderator", label: "Moderator", type: "member" },
    ],
  },
  {
    type: "member.role.added",
    label: "Role Given",
    description: "When a member gains a role.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "role", label: "Role", type: "role" },
    ],
  },
  {
    type: "member.role.removed",
    label: "Role Taken",
    description: "When a member loses a role.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "role", label: "Role", type: "role" },
    ],
  },
  {
    type: "member.boosted",
    label: "Server Boosted",
    description: "When somebody boosts the server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "total", label: "Boost count", type: "number" },
    ],
  },
  {
    type: "voice.joined",
    label: "Voice Joined",
    description: "When somebody joins a voice channel.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
    ],
  },
  {
    type: "voice.left",
    label: "Voice Left",
    description: "When somebody leaves a voice channel.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
      { id: "minutes", label: "Minutes", type: "number" },
    ],
  },
  {
    type: "session.started",
    label: "Session Started",
    description: "When a session is opened.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "host", label: "Host", type: "member" },
      { id: "code", label: "Server code", type: "text" },
      { id: "attending", label: "Attending", type: "number" },
    ],
  },
  {
    type: "session.ended",
    label: "Session Ended",
    description: "When a session is closed.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "host", label: "Host", type: "member" },
      { id: "minutes", label: "Length (minutes)", type: "number" },
      { id: "peak", label: "Peak players", type: "number" },
    ],
  },
  {
    type: "session.vote",
    label: "Session Vote",
    description: "When a session vote reaches its target.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "votes", label: "Votes", type: "number" },
      { id: "target", label: "Target", type: "number" },
    ],
  },
  {
    type: "ticket.opened",
    label: "Ticket Opened",
    description: "When a ticket is opened from a panel.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Opener", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
      { id: "panel", label: "Panel", type: "text" },
    ],
  },
  {
    type: "ticket.claimed",
    label: "Ticket Claimed",
    description: "When a staff member claims a ticket.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Staff", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
    ],
  },
  {
    type: "appeal.submitted",
    label: "Appeal Submitted",
    description: "When somebody appeals a punishment.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "case", label: "Case id", type: "text" },
      { id: "reason", label: "Reason", type: "text" },
    ],
  },
  {
    type: "log.edited",
    label: "Log Edited",
    description: "When a punishment log is edited.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "id", label: "Id", type: "text" },
      { id: "editor", label: "Editor", type: "member" },
      { id: "before", label: "Before", type: "text" },
      { id: "after", label: "After", type: "text" },
    ],
  },
  {
    type: "log.deleted",
    label: "Log Deleted",
    description: "When a punishment log is deleted.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "id", label: "Id", type: "text" },
      { id: "actor", label: "Deleted by", type: "member" },
      { id: "player", label: "Player", type: "player" },
    ],
  },
  {
    type: "erlc.player.joined",
    label: "Player Joined Game",
    description: "When somebody joins the ER:LC server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player" },
      { id: "count", label: "Player count", type: "number" },
    ],
  },
  {
    type: "erlc.player.left",
    label: "Player Left Game",
    description: "When somebody leaves the ER:LC server.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player" },
      { id: "count", label: "Player count", type: "number" },
    ],
  },
  {
    type: "erlc.count.dropped",
    label: "Player Count Dropped",
    description: "When the in-game player count falls below a number.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "count", label: "Player count", type: "number" },
    ],
    fields: [
      { id: "threshold", label: "Below", kind: "number", placeholder: "10" },
    ],
  },
  {
    type: "erlc.count.rose",
    label: "Player Count Rose",
    description: "When the in-game player count passes a number.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "count", label: "Player count", type: "number" },
    ],
    fields: [
      { id: "threshold", label: "Above", kind: "number", placeholder: "25" },
    ],
  },
  {
    type: "erlc.command.used",
    label: "Game Command Used",
    description: "When a moderator runs a command in-game.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "moderator", label: "Moderator", type: "player" },
      { id: "command", label: "Command", type: "text" },
    ],
  },
  {
    type: "erlc.kill",
    label: "Player Killed",
    description: "When one player kills another in-game.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "killer", label: "Killer", type: "player" },
      { id: "victim", label: "Victim", type: "player" },
    ],
  },
  {
    type: "webhook.received",
    label: "Webhook Received",
    description: "When an external service calls this workflow's webhook.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "body", label: "Body", type: "text" },
      { id: "source", label: "Source", type: "text" },
    ],
  },
  {
    type: "custom.command",
    label: "Custom Command",
    description: "A slash command you define, with your own arguments.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Caller", type: "member" },
      { id: "channel", label: "Channel", type: "channel" },
      { id: "target", label: "Target", type: "member" },
      { id: "player", label: "Player", type: "player" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "number", label: "Number", type: "number" },
    ],
    fields: [
      { id: "name", label: "Command name", kind: "text", placeholder: "warn" },
      { id: "description", label: "Description", kind: "text", placeholder: "Warn a player" },
      { id: "permission", label: "Who can run it", kind: "select", options: [{ value: "everyone", label: "Everyone" }, { value: "staff", label: "Staff" }, { value: "management", label: "Management" }, { value: "admin", label: "Admin" }] },
    ],
  },
  {
    type: "quota.missed",
    label: "Quota Missed",
    description: "When a staff member ends a period under quota.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "done", label: "Done", type: "number" },
      { id: "required", label: "Required", type: "number" },
    ],
  },
  {
    type: "quota.met",
    label: "Quota Met",
    description: "When a staff member reaches their quota.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "done", label: "Done", type: "number" },
    ],
  },
  {
    type: "department.joined",
    label: "Department Joined",
    description: "When somebody is added to a department.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "department", label: "Department", type: "text" },
    ],
  },
  {
    type: "department.rank.changed",
    label: "Rank Changed",
    description: "When a department rank changes.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member" },
      { id: "before", label: "From", type: "text" },
      { id: "after", label: "To", type: "text" },
    ],
  },
  {
    type: "bolo.created",
    label: "BOLO Created",
    description: "When a BOLO is raised on a player.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player" },
      { id: "reason", label: "Reason", type: "text" },
    ],
  },
  {
    type: "schedule.daily",
    label: "Every Day",
    description: "Runs once a day at the time you set.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "now", label: "Now", type: "time" },
    ],
    fields: [
      { id: "time", label: "At", kind: "text", placeholder: "18:00" },
    ],
  },
  {
    type: "schedule.weekly",
    label: "Every Week",
    description: "Runs once a week on the day you set.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "now", label: "Now", type: "time" },
    ],
    fields: [
      { id: "day", label: "On", kind: "select", options: [{ value: "monday", label: "Monday" }, { value: "tuesday", label: "Tuesday" }, { value: "wednesday", label: "Wednesday" }, { value: "thursday", label: "Thursday" }, { value: "friday", label: "Friday" }, { value: "saturday", label: "Saturday" }, { value: "sunday", label: "Sunday" }] },
      { id: "time", label: "At", kind: "text", placeholder: "18:00" },
    ],
  },
  {
    type: "schedule.interval",
    label: "Every N Minutes",
    description: "Runs on a fixed interval.",
    category: "trigger",
    isTrigger: true,
    inputs: [],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "now", label: "Now", type: "time" },
    ],
    fields: [
      { id: "minutes", label: "Minutes", kind: "number", placeholder: "30" },
    ],
  },
  {
    type: "erlc.kick",
    label: "Kick From Game",
    description: "Removes a player from the ER:LC server.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.ban",
    label: "Ban From Game",
    description: "Bans a player from the ER:LC server.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.unban",
    label: "Unban From Game",
    description: "Lifts an ER:LC ban.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.mod",
    label: "Give Mod",
    description: "Grants in-game moderator.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.unmod",
    label: "Remove Mod",
    description: "Revokes in-game moderator.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.admin",
    label: "Give Admin",
    description: "Grants in-game admin.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.unadmin",
    label: "Remove Admin",
    description: "Revokes in-game admin.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.jail",
    label: "Jail Player",
    description: "Sends a player to jail in-game.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.respawn",
    label: "Respawn Player",
    description: "Respawns a player where they stand.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.wanted",
    label: "Mark Wanted",
    description: "Flags a player as wanted.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text", placeholder: "Why" },
    ],
  },
  {
    type: "erlc.pm",
    label: "Send Private Message",
    description: "Sends a private message to a player in-game.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
      { id: "message", label: "Message", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Delivered", type: "boolean" },
    ],
    fields: [
      { id: "message", label: "Message", kind: "textarea", placeholder: "What to send them." },
    ],
  },
  {
    type: "erlc.hint",
    label: "Send Hint",
    description: "Shows a hint across the top of everybody's screen.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "message", label: "Message", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "message", label: "Hint", kind: "textarea" },
    ],
  },
  {
    type: "erlc.announce",
    label: "Announce In Game",
    description: "Sends a server-wide message in ER:LC.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "message", label: "Message", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Sent", type: "boolean" },
    ],
    fields: [
      { id: "message", label: "Message", kind: "textarea" },
    ],
  },
  {
    type: "erlc.load",
    label: "Load Server Message",
    description: "Runs the server's saved :load message.",
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
    type: "erlc.mass_unban",
    label: "Mass Unban",
    description: "Lifts every ER:LC ban at once.",
    category: "roblox",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "count", label: "Lifted", type: "number" },
    ],
  },
  {
    type: "erlc.queue",
    label: "Server Queue",
    description: "How many players are waiting to join.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "waiting", label: "Waiting", type: "number" },
      { id: "value", label: "Queue", type: "list" },
    ],
  },
  {
    type: "erlc.vehicles",
    label: "Spawned Vehicles",
    description: "Vehicles currently spawned in the server.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "value", label: "Vehicles", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "erlc.staff",
    label: "In-Game Staff",
    description: "Who currently has mod or admin in-game.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "value", label: "Staff", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "erlc.logs",
    label: "Game Logs",
    description: "Recent kills, commands or joins from the ER:LC server.",
    category: "roblox",
    inputs: [],
    outputs: [
      { id: "value", label: "Entries", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
    fields: [
      { id: "kind", label: "Kind", kind: "select", options: [{ value: "join", label: "Joins" }, { value: "kill", label: "Kills" }, { value: "command", label: "Commands" }, { value: "modcall", label: "Mod calls" }] },
    ],
  },
  {
    type: "ban_member",
    label: "Ban Member",
    description: "Bans somebody from the Discord server.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Banned", type: "boolean" },
    ],
    fields: [
      { id: "reason", label: "Reason", kind: "text" },
      { id: "delete_days", label: "Delete messages (days)", kind: "number", placeholder: "0" },
    ],
  },
  {
    type: "unban_member",
    label: "Unban Member",
    description: "Lifts a Discord ban.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "user", label: "User", type: "user", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Unbanned", type: "boolean" },
    ],
  },
  {
    type: "untimeout",
    label: "Remove Timeout",
    description: "Ends a member's timeout early.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Cleared", type: "boolean" },
    ],
  },
  {
    type: "edit_message",
    label: "Edit Message",
    description: "Rewrites a message the bot sent.",
    category: "message",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "message", label: "Message", type: "message", required: true },
      { id: "content", label: "Content", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
    fields: [
      { id: "content", label: "New content", kind: "textarea" },
    ],
  },
  {
    type: "create_channel",
    label: "Create Channel",
    description: "Makes a new channel.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "name", label: "Name", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel" },
    ],
    fields: [
      { id: "name", label: "Name", kind: "text" },
      { id: "kind", label: "Type", kind: "select", options: [{ value: "text", label: "Text" }, { value: "voice", label: "Voice" }, { value: "forum", label: "Forum" }] },
      { id: "category", label: "Category id", kind: "text" },
    ],
  },
  {
    type: "delete_channel",
    label: "Delete Channel",
    description: "Removes a channel.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
  },
  {
    type: "set_slowmode",
    label: "Set Slowmode",
    description: "Changes a channel's slowmode.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "seconds", label: "Seconds", type: "number" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
    fields: [
      { id: "seconds", label: "Seconds", kind: "number", placeholder: "5" },
    ],
  },
  {
    type: "set_topic",
    label: "Set Channel Topic",
    description: "Rewrites a channel's topic.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "text", label: "Topic", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
    fields: [
      { id: "text", label: "Topic", kind: "text" },
    ],
  },
  {
    type: "move_voice",
    label: "Move To Voice",
    description: "Moves somebody into a voice channel.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "channel", label: "Channel", type: "channel", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
  },
  {
    type: "disconnect_voice",
    label: "Disconnect From Voice",
    description: "Removes somebody from voice.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
  },
  {
    type: "purge",
    label: "Purge Messages",
    description: "Bulk-deletes recent messages in a channel.",
    category: "action",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "count", label: "How many", type: "number" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "deleted", label: "Deleted", type: "number" },
    ],
    fields: [
      { id: "count", label: "How many", kind: "number", placeholder: "20" },
    ],
  },
  {
    type: "crosspost",
    label: "Publish Message",
    description: "Publishes a message in an announcement channel.",
    category: "message",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "message", label: "Message", type: "message", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
  },
  {
    type: "log_create",
    label: "Create Log",
    description: "Creates a punishment log on the panel.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "player", label: "Player", type: "player", required: true },
      { id: "moderator", label: "Moderator", type: "member" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "description", label: "Description", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "id", label: "Id", type: "text" },
      { id: "record", label: "Record", type: "record" },
    ],
    fields: [
      { id: "type", label: "Type", kind: "select", options: [{ value: "warning", label: "Warning" }, { value: "note", label: "Note" }, { value: "kick", label: "Kick" }, { value: "tempban", label: "Temporary ban" }, { value: "ban", label: "Ban" }, { value: "bolo", label: "BOLO" }] },
    ],
  },
  {
    type: "log_edit",
    label: "Edit Log",
    description: "Changes a punishment log.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "id", label: "Id", type: "text", required: true },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "record", label: "Record", type: "record" },
    ],
  },
  {
    type: "log_delete",
    label: "Delete Log",
    description: "Removes a punishment log.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "id", label: "Id", type: "text", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Deleted", type: "boolean" },
    ],
  },
  {
    type: "log_find",
    label: "Find Log",
    description: "Looks a punishment log up by its id.",
    category: "data",
    inputs: [
      { id: "id", label: "Id", type: "text", required: true },
    ],
    outputs: [
      { id: "record", label: "Record", type: "record" },
      { id: "player", label: "Player", type: "player" },
      { id: "type", label: "Type", type: "text" },
      { id: "reason", label: "Reason", type: "text" },
      { id: "found", label: "Found", type: "boolean" },
    ],
  },
  {
    type: "appeal_decide",
    label: "Decide Appeal",
    description: "Approves or denies an appeal.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "case", label: "Case id", type: "text", required: true },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Done", type: "boolean" },
    ],
    fields: [
      { id: "decision", label: "Decision", kind: "select", options: [{ value: "approve", label: "Approve" }, { value: "deny", label: "Deny" }] },
    ],
  },
  {
    type: "promote",
    label: "Promote Member",
    description: "Moves somebody up a rank and logs it.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "role", label: "New rank", type: "role" },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Promoted", type: "boolean" },
    ],
  },
  {
    type: "demote",
    label: "Demote Member",
    description: "Moves somebody down a rank and logs it.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "role", label: "New rank", type: "role" },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Demoted", type: "boolean" },
    ],
  },
  {
    type: "suspend",
    label: "Suspend Member",
    description: "Suspends a staff member for a period.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "days", label: "Days", type: "number" },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Suspended", type: "boolean" },
    ],
  },
  {
    type: "end_leave",
    label: "End Leave",
    description: "Brings somebody back from leave early.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Ended", type: "boolean" },
    ],
  },
  {
    type: "void_shift",
    label: "Void Shift",
    description: "Cancels a shift without crediting the time.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "reason", label: "Reason", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
  },
  {
    type: "quota_progress",
    label: "Quota Progress",
    description: "How far through their quota somebody is.",
    category: "staff",
    inputs: [
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "done", label: "Done", type: "number" },
      { id: "required", label: "Required", type: "number" },
      { id: "met", label: "Met", type: "boolean" },
      { id: "remaining", label: "Remaining", type: "number" },
    ],
  },
  {
    type: "department_roster",
    label: "Department Roster",
    description: "Everybody in a department, with their ranks.",
    category: "staff",
    inputs: [],
    outputs: [
      { id: "value", label: "Members", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
    fields: [
      { id: "department", label: "Department", kind: "text" },
    ],
  },
  {
    type: "department_on_duty",
    label: "Department On Duty",
    description: "Who is currently on shift in a department.",
    category: "staff",
    inputs: [],
    outputs: [
      { id: "value", label: "Members", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
    fields: [
      { id: "department", label: "Department", kind: "text" },
    ],
  },
  {
    type: "shift_leaderboard",
    label: "Shift Leaderboard",
    description: "The top staff by time on duty.",
    category: "staff",
    inputs: [],
    outputs: [
      { id: "value", label: "Rows", type: "list" },
      { id: "top", label: "Top member", type: "member" },
    ],
    fields: [
      { id: "days", label: "Over the last (days)", kind: "number", placeholder: "7" },
    ],
  },
  {
    type: "department_add",
    label: "Add To Department",
    description: "Puts somebody in a department at a rank.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Added", type: "boolean" },
    ],
    fields: [
      { id: "department", label: "Department", kind: "text" },
      { id: "rank", label: "Rank", kind: "text" },
    ],
  },
  {
    type: "department_remove",
    label: "Remove From Department",
    description: "Takes somebody out of a department.",
    category: "staff",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "ok", label: "Removed", type: "boolean" },
    ],
    fields: [
      { id: "department", label: "Department", kind: "text" },
    ],
  },
  {
    type: "text_upper",
    label: "Uppercase",
    description: "Turns text into UPPERCASE.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "text" },
    ],
  },
  {
    type: "text_lower",
    label: "Lowercase",
    description: "Turns text into lowercase.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "text" },
    ],
  },
  {
    type: "text_trim",
    label: "Trim Text",
    description: "Removes spaces from both ends.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "text" },
    ],
  },
  {
    type: "text_replace",
    label: "Replace In Text",
    description: "Swaps one piece of text for another.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
      { id: "find", label: "Find", type: "text" },
      { id: "with", label: "Replace with", type: "text" },
    ],
    outputs: [
      { id: "value", label: "Result", type: "text" },
    ],
    fields: [
      { id: "find", label: "Find", kind: "text" },
      { id: "with", label: "Replace with", kind: "text" },
    ],
  },
  {
    type: "text_split",
    label: "Split Text",
    description: "Breaks text into a list on a separator.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Parts", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
    fields: [
      { id: "separator", label: "Separator", kind: "text", placeholder: "," },
    ],
  },
  {
    type: "text_length",
    label: "Text Length",
    description: "How many characters a piece of text has.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
    ],
    outputs: [
      { id: "value", label: "Length", type: "number" },
    ],
  },
  {
    type: "text_contains",
    label: "Text Contains",
    description: "Whether a piece of text contains another.",
    category: "data",
    inputs: [
      { id: "value", label: "Text", type: "text", required: true },
      { id: "find", label: "Find", type: "text" },
    ],
    outputs: [
      { id: "value", label: "Contains", type: "boolean" },
    ],
    fields: [
      { id: "find", label: "Find", kind: "text" },
    ],
  },
  {
    type: "list_filter",
    label: "Filter List",
    description: "Keeps only the entries whose field matches.",
    category: "data",
    inputs: [
      { id: "value", label: "List", type: "list", required: true },
      { id: "keep", label: "Only when", type: "boolean" },
    ],
    outputs: [
      { id: "value", label: "Result", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
    // The field/value pair filters. `Only when` gates the whole block rather
    // than each entry, because the graph has no per-item scope to test it in.
    fields: [
      { id: "field", label: "Field", kind: "text", placeholder: "Team" },
      { id: "equals", label: "Equals", kind: "text", placeholder: "Police" },
    ],
  },
  {
    type: "list_first",
    label: "First In List",
    description: "The first entry, and whether there was one.",
    category: "data",
    inputs: [
      { id: "value", label: "List", type: "list", required: true },
    ],
    outputs: [
      { id: "value", label: "First", type: "record" },
      { id: "found", label: "Found", type: "boolean" },
    ],
  },
  {
    type: "list_join",
    label: "Join List",
    description: "Turns a list into one line of text.",
    category: "data",
    inputs: [
      { id: "value", label: "List", type: "list", required: true },
    ],
    outputs: [
      { id: "value", label: "Text", type: "text" },
    ],
    fields: [
      { id: "separator", label: "Separator", kind: "text", placeholder: ", " },
    ],
  },
  {
    type: "list_sort",
    label: "Sort List",
    description: "Orders a list by one of its fields.",
    category: "data",
    inputs: [
      { id: "value", label: "List", type: "list", required: true },
    ],
    outputs: [
      { id: "value", label: "Result", type: "list" },
    ],
    fields: [
      { id: "field", label: "By field", kind: "text" },
      { id: "direction", label: "Direction", kind: "select", options: [{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }] },
    ],
  },
  {
    type: "record_field",
    label: "Read Field",
    description: "Pulls one named field out of a record.",
    category: "data",
    inputs: [
      { id: "record", label: "Record", type: "record", required: true },
    ],
    outputs: [
      { id: "value", label: "Value", type: "text" },
      { id: "number", label: "As number", type: "number" },
      { id: "found", label: "Found", type: "boolean" },
    ],
    fields: [
      { id: "field", label: "Field", kind: "text", placeholder: "reason" },
    ],
  },
  {
    type: "time_add",
    label: "Add Time",
    description: "Moves a time forward or back.",
    category: "data",
    inputs: [
      { id: "value", label: "Time", type: "time", required: true },
      { id: "minutes", label: "Minutes", type: "number" },
    ],
    outputs: [
      { id: "value", label: "Result", type: "time" },
    ],
    fields: [
      { id: "minutes", label: "Minutes", kind: "number" },
    ],
  },
  {
    type: "time_between",
    label: "Time Between",
    description: "How long there is between two times.",
    category: "data",
    inputs: [
      { id: "from", label: "From", type: "time", required: true },
      { id: "to", label: "To", type: "time", required: true },
    ],
    outputs: [
      { id: "minutes", label: "Minutes", type: "number" },
      { id: "hours", label: "Hours", type: "number" },
      { id: "days", label: "Days", type: "number" },
    ],
  },
  {
    type: "member_lookup",
    label: "Find Member",
    description: "Looks a Discord member up by id or name.",
    category: "data",
    inputs: [
      { id: "value", label: "Id or name", type: "text", required: true },
    ],
    outputs: [
      { id: "member", label: "Member", type: "member" },
      { id: "found", label: "Found", type: "boolean" },
    ],
  },
  {
    type: "channel_lookup",
    label: "Find Channel",
    description: "Looks a channel up by id or name.",
    category: "data",
    inputs: [
      { id: "value", label: "Id or name", type: "text", required: true },
    ],
    outputs: [
      { id: "channel", label: "Channel", type: "channel" },
      { id: "found", label: "Found", type: "boolean" },
    ],
  },
  {
    type: "role_members",
    label: "Role Members",
    description: "Everybody carrying a role.",
    category: "data",
    inputs: [
      { id: "role", label: "Role", type: "role", required: true },
    ],
    outputs: [
      { id: "value", label: "Members", type: "list" },
      { id: "count", label: "Count", type: "number" },
    ],
  },
  {
    type: "guild_stats",
    label: "Server Stats",
    description: "Live counts for this Discord server.",
    category: "data",
    inputs: [],
    outputs: [
      { id: "members", label: "Members", type: "number" },
      { id: "online", label: "Online", type: "number" },
      { id: "boosts", label: "Boosts", type: "number" },
      { id: "channels", label: "Channels", type: "number" },
    ],
  },
  {
    type: "if_else",
    label: "If / Else",
    description: "Sends the run down one of two paths.",
    category: "logic",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "when", label: "When", type: "boolean", required: true },
    ],
    outputs: [
      { id: "then", label: "Then", type: "flow" },
      { id: "else", label: "Else", type: "flow" },
    ],
  },
  {
    type: "pick",
    label: "Pick One",
    description: "Chooses between two values.",
    category: "logic",
    inputs: [
      { id: "when", label: "When", type: "boolean", required: true },
      { id: "a", label: "If yes", type: "text" },
      { id: "b", label: "If no", type: "text" },
    ],
    outputs: [
      { id: "value", label: "Value", type: "text" },
    ],
  },
  {
    type: "is_empty",
    label: "Is Empty",
    description: "Whether a value is missing or blank.",
    category: "logic",
    inputs: [
      { id: "value", label: "Value", type: "text" },
    ],
    outputs: [
      { id: "value", label: "Empty", type: "boolean" },
    ],
  },
  {
    type: "between",
    label: "Between",
    description: "Whether a number falls inside a range.",
    category: "logic",
    inputs: [
      { id: "value", label: "Number", type: "number", required: true },
      { id: "low", label: "At least", type: "number" },
      { id: "high", label: "At most", type: "number" },
    ],
    outputs: [
      { id: "value", label: "In range", type: "boolean" },
    ],
    fields: [
      { id: "low", label: "At least", kind: "number" },
      { id: "high", label: "At most", kind: "number" },
    ],
  },
  {
    type: "repeat",
    label: "Repeat",
    description: "Runs the same path a fixed number of times.",
    category: "flow",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "times", label: "Times", type: "number" },
    ],
    outputs: [
      { id: "each", label: "Each", type: "flow" },
      { id: "index", label: "Index", type: "number" },
      { id: "next", label: "", type: "flow" },
    ],
    fields: [
      { id: "times", label: "Times", kind: "number", placeholder: "3" },
    ],
  },
  {
    type: "try_catch",
    label: "Try / Otherwise",
    description: "Runs a path, and a different one if it fails.",
    category: "flow",
    inputs: [
      { id: "in", label: "", type: "flow" },
    ],
    outputs: [
      { id: "try", label: "Try", type: "flow" },
      { id: "catch", label: "Otherwise", type: "flow" },
      { id: "error", label: "Error", type: "text" },
    ],
  },
  {
    type: "log_note",
    label: "Write To Audit",
    description: "Records a line in this server's audit trail.",
    category: "flow",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "text", label: "Text", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
    ],
    fields: [
      { id: "text", label: "Text", kind: "textarea" },
    ],
  },
  {
    type: "http_request",
    label: "Call A URL",
    description: "Sends a request to an external service.",
    category: "flow",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "url", label: "URL", type: "text", required: true },
      { id: "body", label: "Body", type: "text" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "status", label: "Status", type: "number" },
      { id: "response", label: "Response", type: "text" },
      { id: "ok", label: "Succeeded", type: "boolean" },
    ],
    fields: [
      { id: "method", label: "Method", kind: "select", options: [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PATCH", label: "PATCH" }, { value: "DELETE", label: "DELETE" }] },
      { id: "url", label: "URL", kind: "text", placeholder: "https://" },
    ],
  },
  {
    type: "send_embed",
    label: "Send An Embed",
    description: "Posts an embed built here to a channel.",
    category: "message",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "message", label: "Message", type: "message" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "sent", label: "Sent", type: "message" },
    ],
    fields: [
      { id: "message", label: "Message", kind: "message" },
    ],
  },
  {
    type: "send_container",
    label: "Send A Container",
    description: "Posts a components-v2 container to a channel.",
    category: "message",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "channel", label: "Channel", type: "channel", required: true },
      { id: "message", label: "Message", type: "message" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "sent", label: "Sent", type: "message" },
    ],
    fields: [
      { id: "message", label: "Message", kind: "message" },
    ],
  },
  {
    type: "dm_embed",
    label: "DM An Embed",
    description: "Sends an embed straight to a member.",
    category: "message",
    inputs: [
      { id: "in", label: "", type: "flow" },
      { id: "member", label: "Member", type: "member", required: true },
      { id: "message", label: "Message", type: "message" },
    ],
    outputs: [
      { id: "next", label: "", type: "flow" },
      { id: "delivered", label: "Delivered", type: "boolean" },
    ],
    fields: [
      { id: "message", label: "Message", kind: "message" },
    ],
  },
);

/* ── conditions, in-game actions, sessions and held values ──

   Conditions are their own category (a yes/no question about the world,
   distinct from control flow). Also: ER:LC in-game actions (kill, jail, heal,
   teleport, fires, helper), the session lifecycle (start, vote, boost, shut
   down), and blocks that simply hold a fixed value. */
BLOCKS.push(
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
  },
);

export const BLOCKS_BY_TYPE: Record<string, BlockDef> = Object.fromEntries(
  BLOCKS.map((block) => [block.type, block]),
);

/**
 * Whether an output type may feed an input type. Loose only where it is safe: a
 * member is a user, and anything can become text in a message. Everything else
 * must match exactly, so an impossible connection cannot be drawn.
 */
export function portsCompatible(from: PortType, to: PortType): boolean {
  if (from === to) return true;
  if (to === "text") return ["number", "boolean", "time"].includes(from);
  if (to === "user" && from === "member") return true;
  return false;
}
