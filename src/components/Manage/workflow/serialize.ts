import { BLOCKS_BY_TYPE } from "./blocks";
import type { WorkflowGraph, WorkflowNode } from "./workflow-canvas";

/** The graph is the execution plan. A derived list supports older consumers;
 * the bot must never replay that list after a graph has started or failed. */

/** Follow the flow chain from the trigger, in the order it will run. */
export function graphToAutomation(graph: WorkflowGraph): {
  trigger: string;
  steps: { type: string; [key: string]: unknown }[];
} {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const trigger = graph.nodes.find(
    (node) => BLOCKS_BY_TYPE[node.type]?.isTrigger,
  );

  const steps: { type: string; [key: string]: unknown }[] = [];
  const seen = new Set<string>();
  let current: WorkflowNode | undefined = trigger;

  while (current) {
    // Stops walking at a cycle (a block wired back to an earlier one) instead
    // of hanging.
    if (seen.has(current.id)) break;
    seen.add(current.id);

    if (!BLOCKS_BY_TYPE[current.type]?.isTrigger) {
      const values: Record<string, unknown> = { ...current.values };
      for (const edge of graph.edges) {
        if (edge.to.node !== current.id) continue;
        if (edge.to.port === "in") continue;
        const source = byId.get(edge.from.node);
        if (source) values[edge.to.port] = `{${edge.from.node}.${edge.from.port}}`;
      }
      steps.push({ type: current.type, ...values });
    }

    const next: { node: string; port: string } | undefined = graph.edges.find(
      (edge) =>
        edge.from.node === current!.id &&
        (edge.from.port === "next" || edge.from.port === "then"),
    )?.to;
    current = next ? byId.get(next.node) : undefined;
  }

  return { trigger: trigger?.type || "manual", steps };
}

/**
 * A graph for an automation that predates the canvas, laid out as a column like
 * the list it came from.
 */
export function automationToGraph(automation: {
  trigger?: string;
    steps?: { type: string; [key: string]: unknown }[];
  graph?: WorkflowGraph | null;
}): WorkflowGraph {
  if (automation.graph?.nodes?.length) return automation.graph;

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowGraph["edges"] = [];
  const triggerType = automation.trigger || "manual";
  const triggerId = "n0";
  nodes.push({
    id: triggerId,
    type: BLOCKS_BY_TYPE[triggerType] ? triggerType : "manual",
    x: 60,
    y: 60,
  });

  let previous = triggerId;
  (automation.steps || []).forEach((step, index) => {
    if (!BLOCKS_BY_TYPE[step.type]) return;
    const id = `n${index + 1}`;
    const values = Object.fromEntries(Object.entries(step).filter(([key]) => key !== "type").map(([key, value]) => [{ channel_id: "channel", role_id: "role", message: "text" }[key] || key, String(value ?? "")]));
    nodes.push({ id, type: step.type, x: 60, y: 60 + (index + 1) * 220, values });
    const subject = BLOCKS_BY_TYPE[triggerType]?.outputs.find(p => p.type === "member");
    if (subject && BLOCKS_BY_TYPE[step.type]?.inputs.some(p => p.id === "member")) edges.push({ id: `subject${index}`, from: { node: triggerId, port: subject.id }, to: { node: id, port: "member" } });
    edges.push({
      id: `e${index}`,
      from: { node: previous, port: "next" },
      to: { node: id, port: "in" },
    });
    previous = id;
  });

  return { nodes, edges };
}

/**
 * What the bot can run today. The palette offers many more blocks; the rest
 * save and round-trip but do nothing at run time. Most runnable steps are pure
 * (comparisons, arithmetic, text and list operations); the Discord effects are
 * delegated to the bot's `execute_workflow_step`, so each Discord action has
 * one implementation.
 *
 * Kept in step with the engine (utils/workflow_graph.py in the bot) by hand;
 * docs/AUTOMATION_ENGINE_GAP.md in the bot repo has the commands to re-derive
 * both lists.
 */
export const RUNNABLE_STEPS = new Set([
  "workflow.enable", "workflow.disable",
  "all_of",
  "any_of",
  "appeal_decide",
  "at_least",
  "at_most",
  "ban_member",
  "between",
  "both",
  "branch",
  "channel_lookup",
  "channel_permission",
  "channel_value",
  "compare",
  "contains_value",
  "cooldown",
  "count",
  "create_channel",
  "crosspost",
  "delete_channel",
  "delete_message",
  "demote",
  "department_add",
  "department_on_duty",
  "department_remove",
  "department_roster",
  "disconnect_voice",
  "dm",
  "dm_embed",
  "edit_message",
  "either",
  "embed_build",
  "embed_field",
  "end_leave",
  "end_shift",
  "erlc.admin",
  "erlc.announce",
  "erlc.ban",
  "erlc.fire_start",
  "erlc.fire_stop",
  "erlc.fire_stop_dumpster",
  "erlc.heal",
  "erlc.helper_add",
  "erlc.helper_remove",
  "erlc.hint",
  "erlc.jail",
  "erlc.kick",
  "erlc.kill",
  "erlc.load",
  "erlc.logs",
  "erlc.mass_unban",
  "erlc.mod",
  "erlc.pm",
  "erlc.queue",
  "erlc.refresh",
  "erlc.respawn",
  "erlc.run",
  "erlc.shutdown",
  "erlc.staff",
  "erlc.team_counts",
  "erlc.teleport",
  "erlc.unadmin",
  "erlc.unban",
  "erlc.unmod",
  "erlc.unwanted",
  "erlc.vehicles",
  "erlc.wanted",
  "erlc_command",
  "erlc_message",
  "erlc_players",
  "erlc_status",
  "for_each",
  "format_time",
  "greater",
  "guard",
  "guild_stats",
  "has_discord_permission",
  "has_role",
  "has_tier",
  "http_request",
  "if_else",
  "in_department",
  "in_list",
  "in_range",
  "infraction_count",
  "is_empty",
  "is_equal",
  "issue_infraction",
  "join_text",
  "kick_member",
  "less",
  "list_filter",
  "list_first",
  "list_join",
  "list_sort",
  "log",
  "log_create",
  "log_delete",
  "log_edit",
  "log_find",
  "log_note",
  "matches",
  "math",
  "math_add",
  "math_divide",
  "math_max",
  "math_min",
  "math_multiply",
  "math_round",
  "math_subtract",
  "member_lookup",
  "member_name",
  "members_with_role",
  "move_voice",
  "negate",
  "nickname",
  "note",
  "now",
  "number_value",
  "on_leave",
  "parallel",
  "pick",
  "pin",
  "player_is_mod",
  "player_on_team",
  "player_permission",
  "player_record",
  "promote",
  "punish",
  "purge",
  "quota_progress",
  "random_of",
  "react",
  "record_field",
  "repeat",
  "reply",
  "roblox_linked_member",
  "roblox_lookup",
  "role_add",
  "role_members",
  "role_remove",
  "role_value",
  "send",
  "send_container",
  "send_embed",
  "session.boost",
  "session.shutdown",
  "session.start",
  "session_status",
  "set_slowmode",
  "set_topic",
  "shift.end_all",
  "shift.end_break",
  "shift_leaderboard",
  "shift_time",
  "staff_on_duty",
  "start_leave",
  "start_shift",
  "stop",
  "suspend",
  "switch",
  "template_message",
  "text_contains",
  "text_length",
  "text_lower",
  "text_replace",
  "text_split",
  "text_trim",
  "text_upper",
  "text_value",
  "thread_create",
  "ticket_close",
  "time_add",
  "time_between",
  "timeout",
  "try_catch",
  "unban_member",
  "untimeout",
  "value_boolean",
  "value_number",
  "value_text",
  "void_shift",
  "wait",
  "webhook",
]);

/**
 * Triggers the bot actually emits (a rule on a recognised but unemitted trigger
 * would enable and never fire). Currently every recognised trigger except
 * `manual`, which `/automation run` calls directly without trigger matching.
 */
export const RUNNABLE_TRIGGERS = new Set([
  "appeal.submitted",
  "application.approved",
  "application.rejected",
  "bolo.created",
  "custom.command",
  "department.joined",
  "department.rank.changed",
  "erlc.command.used",
  "erlc.count.dropped",
  "erlc.count.rose",
  "erlc.kill",
  "erlc.player.joined",
  "erlc.player.left",
  "form.submitted",
  "infraction.created",
  "leave.ended",
  "leave.started",
  "log.deleted",
  "log.edited",
  "manual",
  "member.banned",
  "member.boosted",
  "member.joined",
  "member.left",
  "member.role.added",
  "member.role.removed",
  "member.unbanned",
  "message.deleted",
  "message.edited",
  "message.sent",
  "promotion.created",
  "punishment.created",
  "quota.met",
  "quota.missed",
  "reaction.added",
  "role_add",
  "schedule",
  "schedule.daily",
  "schedule.interval",
  "schedule.weekly",
  "session.ended",
  "session.started",
  "session.vote",
  "shift.ended",
  "shift.started",
  "ticket.claimed",
  "ticket.closed",
  "ticket.opened",
  "voice.joined",
  "voice.left",
  "webhook.received",
]);

/** Whether a block does anything when the automation runs. */
export function isRunnable(type: string): boolean {
  return RUNNABLE_STEPS.has(type) || RUNNABLE_TRIGGERS.has(type);
}
