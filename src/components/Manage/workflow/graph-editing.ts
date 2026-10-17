import { BLOCKS_BY_TYPE } from "./blocks";
import type { WorkflowGraph, WorkflowNode } from "./workflow-canvas";

function isFlow(graph: WorkflowGraph, edge: WorkflowGraph["edges"][number]) {
  const source = graph.nodes.find(node => node.id === edge.from.node);
  return BLOCKS_BY_TYPE[source?.type]?.outputs.some(port => port.id === edge.from.port && port.type === "flow");
}

/** Insert into one route, retaining other branches and all existing data wires. */
export function insertFlowStep(graph: WorkflowGraph, edgeId: string, node: WorkflowNode): WorkflowGraph | null {
  const edge = graph.edges.find(item => item.id === edgeId);
  const block = BLOCKS_BY_TYPE[node.type];
  const inputs = block?.inputs.filter(port => port.type === "flow") || [];
  const outputs = block?.outputs.filter(port => port.type === "flow") || [];
  if (!edge || !isFlow(graph, edge) || block?.isTrigger || inputs.length !== 1 || outputs.length !== 1 || graph.nodes.some(item => item.id === node.id)) return null;
  const destination = graph.nodes.find(item => item.id === edge.to.node);
  if (!destination) return null;
  const downstream = new Set([destination.id]);
  const queue = [destination.id];
  while (queue.length) {
    const current = queue.shift();
    for (const link of graph.edges) if (link.from.node === current && isFlow(graph, link) && !downstream.has(link.to.node)) {
      downstream.add(link.to.node); queue.push(link.to.node);
    }
  }
  const trigger = graph.nodes.find(item => BLOCKS_BY_TYPE[item.type]?.isTrigger);
  const bindings: WorkflowGraph["edges"] = [];
  if (trigger) for (const input of block.inputs.filter(port => ["member", "player", "message"].includes(port.type))) {
    const options = BLOCKS_BY_TYPE[trigger.type].outputs.filter(port => port.type === input.type);
    if (options.length === 1) bindings.push({id:`${node.id}:bind:${input.id}`,from:{node:trigger.id,port:options[0].id},to:{node:node.id,port:input.id}});
  }
  return {
    ...graph,
    nodes: graph.nodes.flatMap(item => {
      const moved = downstream.has(item.id) ? {...item,x:item.x+410} : item;
      return item.id===destination.id ? [{...node,x:destination.x,y:destination.y},moved] : [moved];
    }),
    edges: [...graph.edges.filter(item => item.id !== edge.id),
      {...edge,to:{node:node.id,port:inputs[0].id}},
      {id:`${node.id}:continue`,from:{node:node.id,port:outputs[0].id},to:edge.to}, ...bindings],
  };
}

/** Removing an ordinary step closes its route; branch removal stays explicit. */
export function removeFlowStep(graph: WorkflowGraph, id: string) {
  const node = graph.nodes.find(item => item.id === id);
  const block = BLOCKS_BY_TYPE[node?.type];
  const incoming = graph.edges.filter(edge => edge.to.node === id && isFlow(graph, edge));
  const outgoing = graph.edges.filter(edge => edge.from.node === id && isFlow(graph, edge));
  const reconnect = !block?.isTrigger && block?.outputs.filter(port => port.type === "flow").length === 1 && incoming.length === 1 && outgoing.length === 1 && incoming[0].from.node !== outgoing[0].to.node;
  const edges = graph.edges.filter(edge => edge.from.node !== id && edge.to.node !== id);
  if (reconnect && !edges.some(edge => edge.from.node===incoming[0].from.node && edge.from.port===incoming[0].from.port && edge.to.node===outgoing[0].to.node && edge.to.port===outgoing[0].to.port)) edges.push({...incoming[0],to:outgoing[0].to});
  return {graph:{...graph,nodes:graph.nodes.filter(item=>item.id!==id),edges},reconnected:!!reconnect};
}
