import { BLOCKS_BY_TYPE, portsCompatible } from "./blocks";
import { isRunnable } from "./serialize";
import type { WorkflowGraph, WorkflowEdge } from "./workflow-canvas";

export type WorkflowIssue = { node: string; message: string };
export type WorkflowCapabilities = { erlc: boolean; modules?: Record<string, boolean>; supported?: string[] };
export const requiresErlc = (type: string) => type.startsWith("erlc.") || type.startsWith("erlc_") || ["player_on_team", "player_is_mod", "player_permission", "session.start"].includes(type);

export function requiredModule(type: string): string | null {
  if(type.startsWith("shift.") || ["start_shift","end_shift","void_shift","shift_time","shift_leaderboard","staff_on_duty","quota_progress","quota.met","quota.missed"].includes(type)) return "Shifts";
  if(type.startsWith("department.") || type.startsWith("department_") || type === "in_department") return "Department";
  if(type.startsWith("session.") || type === "session_status") return "Sessions";
  return null;
}

export function connectionProblem(graph: WorkflowGraph, edge: WorkflowEdge, checkDataOrder = true): string | null {
  const source = graph.nodes.find(n => n.id === edge.from.node);
  const target = graph.nodes.find(n => n.id === edge.to.node);
  const output = BLOCKS_BY_TYPE[source?.type || ""]?.outputs.find(p => p.id === edge.from.port);
  const input = BLOCKS_BY_TYPE[target?.type || ""]?.inputs.find(p => p.id === edge.to.port);
  if (!output || !input) return "Choose an existing output and input.";
  if (source?.id === target?.id) return "A step cannot connect to itself.";
  if (!portsCompatible(output.type, input.type)) return `${output.label || "Run order"} cannot supply ${input.label || "run order"}. Choose matching information.`;
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === edge.from.node) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return graph.edges.some(e => e.from.node === id && visit(e.to.node));
  };
  if (visit(edge.to.node)) return "This connection would loop back to an earlier step. Use a Repeat step for a bounded loop.";
  if (output.type !== "flow" && checkDataOrder) {
    const proposed = { ...graph, edges: [...graph.edges, edge] };
    if (dataOrderProblems(proposed).some(i => i.node === target?.id)) return "Use information from an action that runs before this step on every path.";
  }
  return null;
}

// Follow data consumers to the action that actually needs the value. An action
// output is available only if every path to that consumer passes its producer.
export function dataOrderProblems(graph: WorkflowGraph): WorkflowIssue[] {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const isFlow = (e: WorkflowEdge) => BLOCKS_BY_TYPE[byId.get(e.from.node)?.type || ""]?.outputs.find(p => p.id === e.from.port)?.type === "flow";
  const start = graph.nodes.find(n => BLOCKS_BY_TYPE[n.type]?.isTrigger)?.id;
  if (!start) return [];
  function reachable(target: string, excluded?: string) {
    const seen = new Set<string>();
    function walk(id: string): boolean {
      if (id === excluded || seen.has(id)) return false;
      if (id === target) return true;
      seen.add(id);
      return graph.edges.some(e => isFlow(e) && e.from.node === id && walk(e.to.node));
    }
    return walk(start!);
  }
  const issues: WorkflowIssue[] = [];
  for (const edge of graph.edges.filter(e => !isFlow(e))) {
    if (!BLOCKS_BY_TYPE[byId.get(edge.from.node)?.type || ""]?.inputs.some(p => p.type === "flow")) continue;
    const seen = new Set<string>();
    function check(id: string) {
      if (seen.has(id)) return; seen.add(id);
      if (BLOCKS_BY_TYPE[byId.get(id)?.type || ""]?.inputs.some(p => p.type === "flow")) {
        if (reachable(id) && reachable(id, edge.from.node)) issues.push({ node: edge.to.node, message: "Use information from an action that runs before this step on every path." });
      } else graph.edges.filter(e => e.from.node === id && !isFlow(e)).forEach(e => check(e.to.node));
    }
    check(edge.to.node);
  }
  return issues;
}

export function workflowIssues(graph: WorkflowGraph, capabilities?: WorkflowCapabilities): WorkflowIssue[] {
  const issues: WorkflowIssue[] = dataOrderProblems(graph);
  const add = (node: string, message: string) => issues.push({ node, message });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const triggers = graph.nodes.filter(n => BLOCKS_BY_TYPE[n.type]?.isTrigger);
  if (triggers.length !== 1) add(triggers[1]?.id || graph.nodes[0]?.id || "", "Choose exactly one event to start this workflow.");
  if (nodes.size !== graph.nodes.length) add("", "Some steps have duplicate IDs. Remove the duplicate steps.");
  const inputs = new Set<string>();
  const flow = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const problem = connectionProblem({ ...graph, edges: graph.edges.filter(e => e !== edge) }, edge, false);
    if (problem) add(edge.to.node, problem);
    const key = `${edge.to.node}:${edge.to.port}`;
    if (inputs.has(key)) add(edge.to.node, "An input can use only one source.");
    inputs.add(key);
    const port = BLOCKS_BY_TYPE[nodes.get(edge.from.node)?.type || ""]?.outputs.find(p => p.id === edge.from.port);
    if (port?.type === "flow") flow.set(edge.from.node, [...(flow.get(edge.from.node) || []), edge.to.node]);
  }
  const reached = new Set<string>();
  const walk = (id: string) => { if (reached.has(id)) return; reached.add(id); (flow.get(id) || []).forEach(walk); };
  triggers.forEach(n => walk(n.id));
  // Values are pulled backwards by their consumers; actions need run-order connections.
  const used = new Set(reached);
  let changed = true;
  while (changed) { changed = false; for (const e of graph.edges) if (used.has(e.to.node) && !used.has(e.from.node)) { used.add(e.from.node); changed = true; } }
  for (const node of graph.nodes) {
    const block = BLOCKS_BY_TYPE[node.type];
    if (!block || !isRunnable(node.type) || (capabilities?.supported && !capabilities.supported.includes(node.type))) { add(node.id, `${block?.label || node.type} is not supported by the bot. Replace this step.`); continue; }
    const module = requiredModule(node.type);
    if (module && capabilities?.modules && !capabilities.modules[module]) add(node.id, `Enable ${module} in its dashboard tab before using this block.`);
    if (capabilities && requiresErlc(node.type) && !capabilities.erlc) add(node.id, "Connect ER:LC and enable its module in the ERLC tab before using this step.");
    if (block.inputs.some(p => p.type === "flow") && !reached.has(node.id)) add(node.id, `${block.label} needs a run-order connection from the starting event.`);
    else if (!block.isTrigger && !used.has(node.id)) add(node.id, `${block.label} is unused. Connect its result or remove it.`);
    const filled = (key: string) => inputs.has(`${node.id}:${key}`) || String(node.values?.[key] ?? "").trim() !== "";
    for (const port of block.inputs) {
      if (port.required && port.type !== "flow" && !filled(port.id)) add(node.id, `${block.label}: choose ${port.label.toLowerCase()}.`);
      const value = node.values?.[port.id];
      if (!inputs.has(`${node.id}:${port.id}`) && value?.trim() && port.type === "number" && !Number.isFinite(Number(value))) add(node.id, `${port.label} must be a number.`);
    }
    if (["send", "log", "send_embed", "send_container"].includes(node.type) && !filled("channel")) add(node.id, `${block.label}: choose a channel.`);
    if (["send", "dm", "log"].includes(node.type) && !["text", "message", "embed"].some(filled)) add(node.id, `${block.label}: write a message or choose message data.`);
    if (["send_embed", "send_container", "dm_embed"].includes(node.type) && !filled("message")) add(node.id, `${block.label}: create a message.`);
    if (node.type.startsWith("workflow.") && !filled("workflow")) add(node.id, "Choose a saved workflow.");
    if (node.type === "schedule.daily" || node.type === "schedule.weekly") {
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(node.values?.time || "")) add(node.id, "Choose a valid UTC time, such as 18:30.");
      if (node.type === "schedule.weekly" && !["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].includes(node.values?.day || "")) add(node.id, "Choose a day of the week.");
    }
    if (node.type === "schedule.interval" && (!Number.isInteger(Number(node.values?.minutes)) || Number(node.values?.minutes) < 5 || Number(node.values?.minutes) > 10080)) add(node.id, "Set a whole-number interval from 5 to 10,080 minutes.");
    if (node.type === "wait" && !inputs.has(`${node.id}:seconds`) && (!Number.isInteger(Number(node.values?.seconds)) || Number(node.values?.seconds) < 0 || Number(node.values?.seconds) > 60)) add(node.id, "Wait supports 0 to 60 whole seconds.");
    if (["erlc.count.rose", "erlc.count.dropped"].includes(node.type) && (!filled("threshold") || !Number.isFinite(Number(node.values?.threshold)) || Number(node.values?.threshold) < 0)) add(node.id, "Enter a player-count threshold of zero or more.");
  }
  if (triggers.length === 1 && reached.size === 1) add(triggers[0].id, "Add a step after the starting event.");
  return issues;
}
