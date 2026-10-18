import { BLOCKS_BY_TYPE, portsCompatible } from "./blocks.ts";
import type { WorkflowEdge, WorkflowGraph } from "./workflow-canvas";

export type SourceOption = { value: string; label: string };

/** Build choices for one open inspector. Hidden inspectors need no graph walk. */
export function inspectorSources(
  graph: WorkflowGraph,
  selectedId: string | null,
  allowsConnection: (edge: WorkflowEdge) => boolean,
): Record<string, SourceOption[]> {
  const node = graph.nodes.find((item) => item.id === selectedId);
  const block = node && BLOCKS_BY_TYPE[node.type];
  if (!node || !block) return {};
  return Object.fromEntries(block.inputs.filter((input) => input.type !== "flow").map((input) => [
    input.id,
    graph.nodes.flatMap((source, index) => (BLOCKS_BY_TYPE[source.type]?.outputs || [])
      .filter((output) => output.type !== "flow" && portsCompatible(output.type, input.type)
        && allowsConnection({ id: "candidate", from: { node: source.id, port: output.id }, to: { node: node.id, port: input.id } }))
      .map((output) => ({ value: `${source.id}:${output.id}`, label: `${index + 1}. ${BLOCKS_BY_TYPE[source.type].label} → ${output.label}` }))),
  ]));
}
