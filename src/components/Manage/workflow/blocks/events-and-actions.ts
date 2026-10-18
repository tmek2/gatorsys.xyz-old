import type { BlockDef, BlockPort } from "../blocks";

const flowOut: BlockPort = { id: "next", label: "", type: "flow" };
const flowIn: BlockPort = { id: "in", label: "", type: "flow" };

export const definitions: BlockDef[] = [
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
  }
];
