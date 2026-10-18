"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEyeOff,
  IconFocusCentered,
  IconHistory,
  IconMessage,
  IconMinus,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { ChannelPicker, RolePicker, SelectField } from "../fields";
import { useOptionalManage } from "../manage-context";
import type { GuildMeta } from "../types";
import { isRunnable } from "./serialize";
import { insertFlowStep, removeFlowStep } from "./graph-editing";
import { inspectorSources } from "./inspector-sources";
import { workflowIssues, connectionProblem, requiresErlc, type WorkflowCapabilities } from "./validation";
import {
  MessageValueEditor,
  describeNodeMessage,
  parseNodeMessage,
} from "./message-value-editor";
import {
  BLOCKS,
  BLOCKS_BY_TYPE,
  type BlockField,
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PORT_COLORS,
  PORT_LABELS,
  portsCompatible,
  type BlockCategory,
  type BlockDef,
  type BlockPort,
  type PortType,
} from "./blocks";

/**
 * Guild roles and channels for editors rendered outside `ManageProvider`. The
 * automation editor has its own route without the provider (which would also
 * load the config and arm a save prompt), so the page fetches the meta and
 * passes it down here. Inside the provider, the provider wins.
 */
const WorkflowMetaContext = React.createContext<GuildMeta | null>(null);

/** The provider's meta if there is one, the page's if not, null if neither. */
function useEditorMeta(): GuildMeta | null {
  const fromProvider = useOptionalManage()?.meta ?? null;
  const fromPage = React.useContext(WorkflowMetaContext);
  return fromProvider ?? fromPage;
}

/**
 * The workflow editor: a node graph on a canvas. Every block declares typed
 * inputs and outputs, and you wire values between them ("the player from the
 * punishment that just happened").
 *
 * - A viewport: pan with space, middle-drag or a drag on empty canvas; zoom at
 *   the cursor; fit the graph to the screen.
 * - A docked palette showing every block with its ports; blocks drag onto the
 *   canvas.
 * - Connections are type-checked while dragging: ports that cannot accept the
 *   held type dim out.
 * - Problems (a required input with nothing in it, no trigger, an unreachable
 *   block) are counted as you build, each with a link to the block.
 * - Node positions are stored in the document.
 */

export type WorkflowNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Values typed into the node's own fields. A wire into the matching port
   *  wins over these — the field is the shortcut, not the override. */
  values?: Record<string, string>;
};

export type WorkflowEdge = {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

const NODE_WIDTH = 312;
const HEADER_HEIGHT = 58;
const PORT_ROW = 30;
const PORT_TOP = 12;
const GRID = 20;
/* Minimum zoom. 0.2 fits a large graph while titles stay legible as shapes;
   fit-to-view clamps to the same floor. */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;

function portIndex(block: BlockDef, portId: string, side: "in" | "out") {
  const list = side === "in" ? block.inputs : block.outputs;
  return list.findIndex((port) => port.id === portId);
}

/**
 * Approximate node height, for fitting the view and the reachability hit test.
 * Includes inline fields so fitting does not crop the bottom row.
 */
function nodeHeight(block: BlockDef) {
  const ports = block.inputs.length + block.outputs.length;
  const fields = (block.fields || []).reduce(
    (total, field) => total + (field.kind === "textarea" ? 78 : 56),
    0,
  );
  return HEADER_HEIGHT + PORT_TOP * 2 + ports * PORT_ROW + fields;
}

/** Where a port's dot sits, in canvas coordinates. */
function portPoint(
  node: WorkflowNode,
  portId: string,
  side: "in" | "out",
): { x: number; y: number } | null {
  const block = BLOCKS_BY_TYPE[node.type];
  if (!block) return null;
  const index = portIndex(block, portId, side);
  if (index < 0) return null;
  if (side === "in") {
    return {
      x: node.x,
      y: node.y + HEADER_HEIGHT + PORT_TOP + index * PORT_ROW + PORT_ROW / 2,
    };
  }
  // Outputs sit under the inputs and the fields, which is where they are drawn.
  const fields = (block.fields || []).reduce(
    (total, field) => total + (field.kind === "textarea" ? 78 : 56),
    0,
  );
  return {
    x: node.x + NODE_WIDTH,
    y:
      node.y +
      HEADER_HEIGHT +
      PORT_TOP +
      block.inputs.length * PORT_ROW +
      fields +
      index * PORT_ROW +
      PORT_ROW / 2,
  };
}

/** A cubic that leaves horizontally, so a line reads as a signal path. */
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * `BLO-001`, from the node's position in the document: short and stable enough
 * to refer to out loud.
 */
export function blockRef(index: number) {
  return `BLO-${String(index + 1).padStart(3, "0")}`;
}

type Dragging =
  | { kind: "node"; id: string; dx: number; dy: number }
  | { kind: "canvas"; x: number; y: number; panX: number; panY: number }
  | {
      kind: "port";
      node: string;
      port: string;
      side: "in" | "out";
      type: PortType;
      x: number;
      y: number;
    }
  | null;

export function WorkflowCanvas({
  graph,
  onChange,
  readOnly = false,
  capabilities,
  workflows = [],
}: {
  workflows?: { _id: string; name: string }[];
  capabilities?: WorkflowCapabilities;
  graph: WorkflowGraph;
  onChange: (next: WorkflowGraph, historyGroup?: string) => void;
  readOnly?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const meta = useEditorMeta();
  const [inspectorElement, setInspectorElement] = useState<HTMLDivElement | null>(null);
  const [showData, setShowData] = useState(false);
  const pendingFocus = useRef<string | null>(null);
  const dragHistory = useRef("");
  const [portOffsets, setPortOffsets] = useState<Record<string, {x:number;y:number}>>({});
  const [connectionNotice, setConnectionNotice] = useState("");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<Dragging>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BlockCategory | "all">("all");
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** The wire under the pointer, so it can thicken before you commit to it. */
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  /** The right-click menu: what was under the pointer, and where. */
  const [menu, setMenu] = useState<
    | { kind: "canvas"; x: number; y: number }
    | { kind: "node"; id: string; x: number; y: number }
    | { kind: "edge"; id: string; x: number; y: number }
    | null
  >(null);
  const [problemsOpen, setProblemsOpen] = useState(false);
  /* The palette can be hidden, giving the canvas the full width while wiring. */
  const [paletteOpen, setPaletteOpen] = useState(graph.nodes.length === 0);
  const [inserting, setInserting] = useState<string | null>(null);
  const feedbackGraph = useRef<WorkflowGraph | null>(null);
  useEffect(()=>{
    if(feedbackGraph.current && feedbackGraph.current!==graph) {setConnectionNotice("");feedbackGraph.current=null;}
  },[graph]);
  useEffect(()=>{if(!paletteOpen)setInserting(null);},[paletteOpen]);
  const arrangePending = useRef(false);
  /* The armed port. Click an output and the palette narrows to the blocks that
     can continue from it; picking one places it, wires it and selects it.
     Clicking an empty input does the reverse: the palette narrows to blocks
     that produce that type (how you find `Pick A Channel` from a channel port).
     Dragging wires still works. */
  const [armed, setArmed] = useState<
    {
      node: string;
      port: string;
      type: PortType;
      label: string;
      /** The side of the *armed* port. `out` continues a chain forwards; `in`
       *  reaches backwards for something that produces the value. */
      side: "in" | "out";
    } | null
  >(null);

  const nodesById = useMemo(
    () => Object.fromEntries(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  /** `node:port` for every input that already has an edge into it. */
  const wiredPorts = useMemo(
    () =>
      new Set(
        (graph.edges || []).map(
          (edge) => `${edge.to?.node}:${edge.to?.port}`,
        ),
      ),
    [graph.edges],
  );
  const problems = useMemo(() => workflowIssues(graph, capabilities).map(i => ({...i, ref: blockRef(graph.nodes.findIndex(n=>n.id===i.node))})), [graph, capabilities]);
  const problemNodes = useMemo(
    () => new Set(problems.map((problem) => problem.node)),
    [problems],
  );
  const topologyKey = graph.nodes.map((node) => `${node.id}:${node.type}`).join("|");
  const sources = useMemo(() => inspectorSources(
    graph,
    paletteOpen ? null : selected,
    (edge) => !connectionProblem(graph, edge),
    // Coordinates and typed values do not change connection compatibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [topologyKey, graph.edges, selected, paletteOpen]);

  /** Screen point → canvas point. Zoom divides; pan subtracts. */
  const toCanvas = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const box = surfaceRef.current?.getBoundingClientRect();
      return {
        x: (event.clientX - (box?.left ?? 0) - pan.x) / zoom,
        y: (event.clientY - (box?.top ?? 0) - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const measure = () => {
      const next: Record<string,{x:number;y:number}> = {};
      surface.querySelectorAll<HTMLElement>("[data-wf-anchor]").forEach(dot => {
        const card = dot.closest<HTMLElement>(".wf-node");
        if (!card) return;
        const d = dot.getBoundingClientRect(), n = card.getBoundingClientRect();
        next[dot.dataset.wfAnchor!] = {x:(d.left+d.width/2-n.left)/zoom,y:(d.top+d.height/2-n.top)/zoom};
      });
      setPortOffsets(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    surface.querySelectorAll(".wf-node").forEach(card=>observer.observe(card));
    return () => observer.disconnect();
  }, [graph.nodes, graph.edges, zoom, readOnly, showData]);
  function measuredPort(node:WorkflowNode, port:string, side:"in"|"out") {
    const offset=portOffsets[`${node.id}:${side}:${port}`];
    return offset ? {x:node.x+offset.x,y:node.y+offset.y} : portPoint(node,port,side);
  }

  // Space is the pan modifier, held rather than toggled, and released on blur
  // (a window that loses focus mid-hold never gets the keyup).
  useEffect(() => {
    if (readOnly) return;
    function down(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".wf-canvas") || target.isContentEditable ||
        target.closest('button,input,textarea,select,a,[role="button"],[role="option"],[role="listbox"],[role="dialog"],[contenteditable="true"]')) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceHeld(true);
      }
      if (event.key === "Escape") {
        if (armed) setArmed(null);
        else setSelected(null);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        removeNode(selected);
      }
    }
    function up(event: KeyboardEvent) {
      if (event.code === "Space") setSpaceHeld(false);
    }
    function blur() {
      setSpaceHeld(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, selected, graph, armed]);

  /** Zoom about a screen point, so the thing under the cursor stays under it. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const box = surfaceRef.current?.getBoundingClientRect();
      const originX = clientX ?? (box ? box.left + box.width / 2 : 0);
      const originY = clientY ?? (box ? box.top + box.height / 2 : 0);
      setZoom((current) => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
        if (next === current) return current;
        const localX = originX - (box?.left ?? 0);
        const localY = originY - (box?.top ?? 0);
        setPan((currentPan) => ({
          x: localX - ((localX - currentPan.x) / current) * next,
          y: localY - ((localY - currentPan.y) / current) * next,
        }));
        return next;
      });
    },
    [],
  );

  // Registered by hand because React's onWheel is passive and cannot
  // preventDefault, which would let the gesture zoom the whole page instead.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    function onWheel(event: WheelEvent) {
      if ((event.target as HTMLElement).closest("input, textarea, select, [role='listbox'], .wf-port-input")) return;
      event.preventDefault();
      // The wheel zooms, as in every canvas editor. Shift pans horizontally,
      // and a trackpad's sideways swipe arrives as deltaX either way.
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        setPan((current) => ({
          x: current.x - (event.deltaX || event.deltaY),
          y: current.y,
        }));
        return;
      }
      zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY);
    }
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /** Frame the whole graph, with a margin so nothing touches an edge. */
  const fitView = useCallback(() => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box || graph.nodes.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of graph.nodes) {
      const block = BLOCKS_BY_TYPE[node.type];
      const card = Array.from(surfaceRef.current!.querySelectorAll<HTMLElement>("[data-wf-node]")).find(card => card.dataset.wfNode === node.id);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.y + (card?.offsetHeight || (block ? nodeHeight(block) : 200)));
    }
    const margin = 80;
    const next = Math.min(
      1,
      Math.max(
        ZOOM_MIN,
        Math.min(
          (box.width - margin * 2) / Math.max(1, maxX - minX),
          (box.height - margin * 2) / Math.max(1, maxY - minY),
        ),
      ),
    );
    setZoom(next);
    setPan({
      x: box.width / 2 - ((minX + maxX) / 2) * next,
      y: box.height / 2 - ((minY + maxY) / 2) * next,
    });
  }, [graph.nodes]);

  useEffect(() => {
    if (arrangePending.current) { arrangePending.current = false; fitView(); }
  }, [graph.nodes, fitView]);

  function focusNode(id: string) {
    const node = nodesById[id];
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!node || !box) return;
    setSelected(id);
    setPaletteOpen(false);
    setZoom(1);
    requestAnimationFrame(()=>{
      const width = surfaceRef.current?.getBoundingClientRect().width || box.width;
      setPan({x: Math.max(24, (width - NODE_WIDTH) / 2) - node.x, y: 100 - node.y});
    });
  }

  useEffect(() => {
    if (pendingFocus.current) { const id = pendingFocus.current; pendingFocus.current = null; focusNode(id); }
  }, [graph.nodes]);

  function arrange() {
    const levels = new Map<string, number>();
    const visiting = new Set<string>();
    const level = (id: string): number => {
      if (levels.has(id)) return levels.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const parents = graph.edges.filter(e=>e.to.node===id).map(e=>e.from.node);
      const value = parents.length ? Math.max(...parents.map(parent=>level(parent)+1)) : 0;
      visiting.delete(id); levels.set(id,value); return value;
    };
    const bottoms = new Map<number, number>();
    const cards = Array.from(surfaceRef.current!.querySelectorAll<HTMLElement>("[data-wf-node]"));
    const nodes = graph.nodes.map(node=>{
      const column = level(node.id), y = bottoms.get(column) || 100;
      const height = cards.find(card=>card.dataset.wfNode===node.id)?.offsetHeight || 300;
      bottoms.set(column,y+height+70);
      return {...node,x:80+column*(NODE_WIDTH+120),y};
    });
    arrangePending.current = true;
    onChange({...graph,nodes});
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return;
    const point = toCanvas(event);
    if (drag.kind === "node") {
      onChange({
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === drag.id
            ? {
                // Snapped, so a canvas somebody has dragged around for ten
                // minutes still lines up.
                ...node,
                x: Math.round((point.x - drag.dx) / GRID) * GRID,
                y: Math.round((point.y - drag.dy) / GRID) * GRID,
              }
            : node,
        ),
      }, dragHistory.current);
      return;
    }
    if (drag.kind === "canvas") {
      setPan({
        x: drag.panX + (event.clientX - drag.x),
        y: drag.panY + (event.clientY - drag.y),
      });
      return;
    }
    setDrag({ ...drag, x: point.x, y: point.y });
  }

  function finishPortDrag(nodeId: string, portId: string, side: "in" | "out") {
    if (!drag || drag.kind !== "port") return;
    if (drag.side === side) {
      if (drag.node !== nodeId) setConnectionNotice("Connect an output to an input. Two outputs cannot connect to each other.");
      return setDrag(null);
    }
    // Normalise to output → input regardless of which end was grabbed first.
    const from =
      drag.side === "out"
        ? { node: drag.node, port: drag.port }
        : { node: nodeId, port: portId };
    const to =
      drag.side === "out"
        ? { node: nodeId, port: portId }
        : { node: drag.node, port: drag.port };
    if (from.node === to.node) return setDrag(null);

    const fromBlock = BLOCKS_BY_TYPE[nodesById[from.node]?.type];
    const toBlock = BLOCKS_BY_TYPE[nodesById[to.node]?.type];
    const fromPort = fromBlock?.outputs.find((port) => port.id === from.port);
    const toPort = toBlock?.inputs.find((port) => port.id === to.port);
    if (!fromPort || !toPort || !portsCompatible(fromPort.type, toPort.type)) {
      setConnectionNotice("These ports need matching data types. Use a conversion block or choose a compatible input.");
      return setDrag(null);
    }

    const problem = connectionProblem(graph, { id: "candidate", from, to });
    if (problem) { setConnectionNotice(problem); return setDrag(null); }
    setConnectionNotice("");
    onChange({
      ...graph,
      edges: [
        // An input takes one connection. Two things feeding one slot is a
        // question the engine cannot answer, so the new one replaces the old.
        ...graph.edges.filter(
          (edge) => !(edge.to.node === to.node && edge.to.port === to.port),
        ),
        { id: nextId("edge"), from, to },
      ],
    });
    setDrag(null);
  }

  /**
   * Where a newly placed block joins the armed port: armed on an output, its
   * first input that accepts the type; armed on an input, its first output that
   * produces it.
   */
  function landingPort(block: BlockDef): BlockPort | null {
    if (!armed) return null;
    if (armed.side === "in") {
      return (
        block.outputs.find((port) => portsCompatible(port.type, armed.type)) ||
        null
      );
    }
    return (
      block.inputs.find((port) => portsCompatible(armed.type, port.type)) || null
    );
  }

  /** Drop a block on the canvas. `at` is a screen point when dragged in. */
  function addBlock(block: BlockDef, at?: { clientX: number; clientY: number }) {
    if (readOnly) return;
    if (!isRunnable(block.type) || (capabilities && requiresErlc(block.type) && !capabilities.erlc)) return;
    if (block.isTrigger && graph.nodes.some(n => BLOCKS_BY_TYPE[n.type]?.isTrigger)) return;
    const box = surfaceRef.current?.getBoundingClientRect();
    const point = at
      ? toCanvas(at)
      : {
          // Dropped into the middle of what is currently on screen, not at
          // 0,0 — a block that lands off-canvas reads as nothing happening.
          x: (-pan.x + (box?.width ?? 800) / 2) / zoom - NODE_WIDTH / 2,
          y: (-pan.y + (box?.height ?? 600) / 3) / zoom,
        };
    const id = nextId("node");
    if (inserting) {
      const next = insertFlowStep(graph,inserting,{id,type:block.type,x:0,y:0,...(block.type==="wait"?{values:{seconds:"5"}}:{})});
      if (!next) {setConnectionNotice("That step cannot fit here. Choose an action with one continuation.");return;}
      feedbackGraph.current=next;
      onChange(next);
      pendingFocus.current=id;
      setSelected(id);setPaletteOpen(false);setArmed(null);
      setConnectionNotice("Step inserted. The rest of your workflow stays connected.");
      return;
    }

    // Armed: the new block is placed clear of the source node's right edge,
    // level with the port, already wired, so chains read left to right.
    const target = armed ? landingPort(block) : null;
    const source = armed ? nodesById[armed.node] : null;
    if (armed && target && source) {
      const backwards = armed.side === "in";
      const anchor = measuredPort(source, armed.port, backwards ? "in" : "out");
      // Reaching backwards from an input, the producer goes to the left of the
      // block that needs it.
      const x = backwards
        ? source.x - NODE_WIDTH - 90
        : source.x + NODE_WIDTH + 90;
      const y = (anchor?.y ?? source.y) - HEADER_HEIGHT - PORT_TOP;
      // One edge into an input. Wiring a second silently replaces the first
      // everywhere else in this editor, and it has to here too.
      const wire = backwards
        ? { from: { node: id, port: target.id }, to: { node: armed.node, port: armed.port } }
        : { from: { node: armed.node, port: armed.port }, to: { node: id, port: target.id } };
      const trigger = graph.nodes.find(node=>BLOCKS_BY_TYPE[node.type]?.isTrigger);
      const bindings: WorkflowEdge[] = [];
      if (!backwards && target.type === "flow" && trigger) {
        for (const input of block.inputs.filter(p=>["member","player","message"].includes(p.type))) {
          const outputs = BLOCKS_BY_TYPE[trigger.type].outputs.filter(p=>p.type===input.type);
          if (outputs.length === 1) bindings.push({id:nextId("edge"),from:{node:trigger.id,port:outputs[0].id},to:{node:id,port:input.id}});
        }
      }
      onChange({
        ...graph,
        nodes: [
          ...graph.nodes,
          {
            id,
            type: block.type,
            ...(block.type==="wait" ? {values:{seconds:"5"}} : {}),
            x: Math.round(x / GRID) * GRID,
            y: Math.round(y / GRID) * GRID,
          },
        ],
        edges: [
          ...graph.edges.filter(
            (edge) =>
              !(edge.to.node === wire.to.node && edge.to.port === wire.to.port),
          ),
          { id: nextId("edge"), ...wire },
          ...bindings,
        ],
      });
      setSelected(id);
      pendingFocus.current = id;
      setPaletteOpen(false);
      // Re-arms on the new block's flow output, so building a chain is click,
      // click, click. Nothing to re-arm when reaching backwards.
      const carry = backwards
        ? null
        : block.outputs.find((port) => port.type === "flow");
      setArmed(
        carry
          ? {
              node: id,
              port: carry.id,
              type: carry.type,
              label: carry.label || "Next",
              side: "out",
            }
          : null,
      );
      return;
    }

    onChange({
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id,
          type: block.type,
          ...(block.type==="wait" ? {values:{seconds:"5"}} : {}),
          x: Math.round(point.x / GRID) * GRID,
          y: Math.round(point.y / GRID) * GRID,
        },
      ],
    });
    setSelected(id);
    pendingFocus.current = id;
    setPaletteOpen(false);
    if (block.isTrigger) {
      const output = block.outputs.find(port=>port.type==="flow");
      if (output) setArmed({node:id,port:output.id,type:output.type,label:"Next action",side:"out"});
      setCategory("all"); setQuery("");
    }
  }

  function removeNode(id: string) {
    if(readOnly)return;
    const result=removeFlowStep(graph,id);
    feedbackGraph.current=result.graph;
    onChange(result.graph);
    setConnectionNotice(result.reconnected ? "Step removed. Its neighbors are connected. Undo restores the step." : "Block removed. Undo restores it and its connections.");
    setSelected(null);
  }

  function beginInsert(edge: WorkflowEdge) {
    if(readOnly)return;
    setInserting(edge.id);
    setArmed({node:edge.from.node,port:edge.from.port,type:"flow",label:BLOCKS_BY_TYPE[nodesById[edge.from.node]?.type]?.label || "Step",side:"out"});
    setQuery("");setCategory("all");setPaletteOpen(true);
  }

  function continueFrom(node:WorkflowNode, port:BlockPort) {
    if(readOnly)return;
    const existing=graph.edges.filter(edge=>edge.from.node===node.id&&edge.from.port===port.id);
    if(existing.length===1) {beginInsert(existing[0]);return;}
    setInserting(null);setArmed({node:node.id,port:port.id,type:port.type,label:port.label||"Next action",side:"out"});
    setQuery("");setCategory("all");setPaletteOpen(true);
  }

  function openAddMenu() {
    const current = nodesById[selected || ""];
    const ends = graph.nodes.filter(node=>BLOCKS_BY_TYPE[node.type]?.outputs.some(port=>port.type==="flow") && !graph.edges.some(edge=>edge.from.node===node.id&&BLOCKS_BY_TYPE[node.type]?.outputs.some(port=>port.id===edge.from.port&&port.type==="flow")));
    const source = current || (ends.length===1 ? ends[0] : null);
    const ports = source ? BLOCKS_BY_TYPE[source.type]?.outputs.filter(port=>port.type==="flow") || [] : [];
    if(source && ports.length===1) {continueFrom(source,ports[0]);return;}
    setInserting(null);setArmed(null);setQuery("");setCategory("all");setPaletteOpen(true);
  }

  /**
   * Disconnects one wire. (Dropping a new wire on an occupied input replaces
   * it.)
   */
  function removeEdge(id: string) {
    onChange({ ...graph, edges: graph.edges.filter((edge) => edge.id !== id) });
    setHoverEdge((current) => (current === id ? null : current));
    setMenu(null);
  }

  const term = query.trim().toLowerCase();
  const {groups:grouped,categories:availableCategories} = useMemo(() => {
    const out = new Map<BlockCategory, BlockDef[]>();
    const categories = new Set<BlockCategory>();
    for (const block of BLOCKS) {
      // Retain older equivalent blocks in saved graphs without offering two
      // indistinguishable choices when someone builds a new workflow.
      if (["value_text", "value_number", "if_else", "both", "either", "between", "role_members"].includes(block.type)) continue;
      if (!isRunnable(block.type) || (capabilities?.supported && !capabilities.supported.includes(block.type))) continue;
      if (inserting && (block.inputs.filter(port=>port.type==="flow").length!==1 || block.outputs.filter(port=>port.type==="flow").length!==1)) continue;
      const hasTrigger = graph.nodes.some(n => BLOCKS_BY_TYPE[n.type]?.isTrigger);
      if (block.isTrigger && hasTrigger) continue;
      if (!hasTrigger && !block.isTrigger) continue;
      if (capabilities && requiresErlc(block.type) && !capabilities.erlc) continue;
      // Armed: only blocks that can join the held port. Never a trigger: a
      // graph has one, where the run starts.
      if (armed) {
        if (block.isTrigger) continue;
        const joins =
          armed.side === "in"
            ? block.outputs.some((port) => portsCompatible(port.type, armed.type))
            : block.inputs.some((port) => portsCompatible(armed.type, port.type));
        if (!joins) continue;
      }
      categories.add(block.category);
      if (category !== "all" && block.category !== category) continue;
      if (
        term &&
        !block.label.toLowerCase().includes(term) &&
        !block.description.toLowerCase().includes(term) &&
        !block.type.toLowerCase().includes(term) &&
        !CATEGORY_LABELS[block.category].toLowerCase().includes(term)
      ) {
        continue;
      }
      out.set(block.category, [...(out.get(block.category) || []), block]);
    }
    return {groups:out,categories};
  }, [term, category, armed, capabilities, graph.nodes, inserting]);

  /**
   * Which ports can accept what is being dragged, computed once per drag and
   * used to dim the rest.
   */
  function portDimmed(side: "in" | "out", type: PortType, nodeId: string) {
    if (!drag || drag.kind !== "port") return false;
    if (drag.node === nodeId) return true;
    if (drag.side === side) return true;
    return drag.side === "out"
      ? !portsCompatible(drag.type, type)
      : !portsCompatible(type, drag.type);
  }

  function mapPort(node: WorkflowNode, port: BlockPort, side: "in" | "out") {
    const connected = graph.edges.some(edge=>side === "in" ? edge.to.node===node.id&&edge.to.port===port.id : edge.from.node===node.id&&edge.from.port===port.id);
    const chooseData = () => {
      if (readOnly) return;
      if(side==="out"&&port.type==="flow"){continueFrom(node,port);return;}
      setInserting(null);
      setArmed({node:node.id,port:port.id,type:port.type,label:port.label || "Value",side});
      setCategory("all");
      setQuery("");
      setPaletteOpen(true);
    };
    return <div key={`${side}:${port.id}`} className={`wf-port wf-port-${side} wf-map-port`}>
      {port.type !== "flow" ? <button className="wf-port-label wf-data-choice" disabled={readOnly} onPointerDown={event=>event.stopPropagation()} onClick={chooseData} title={side === "out" ? "Use this data in another block" : "Choose a block to provide this value"}>{port.label || "Value"}<span>{PORT_LABELS[port.type]}</span></button> : side === "out" && !readOnly ? <button className="wf-add-next" onPointerDown={event=>event.stopPropagation()} onClick={chooseData}><IconPlus size={14}/>{connected ? "Insert step" : port.label || "Add next action"}</button> : <span className="wf-port-label">{port.label || (side === "in" ? "From previous block" : "Next action")}</span>}
      <button data-wf-anchor={`${node.id}:${side}:${port.id}`} className="wf-dot" aria-label={`${BLOCKS_BY_TYPE[node.type].label}: ${port.label || "Flow"} ${side === "in" ? "input" : "output"}, ${PORT_LABELS[port.type]}`} style={{color:PORT_COLORS[port.type]}} onPointerDown={event=>{if(readOnly)return;event.stopPropagation();const point=toCanvas(event);setDrag({kind:"port",node:node.id,port:port.id,type:port.type,side,x:point.x,y:point.y});}} onPointerUp={event=>{event.stopPropagation();if(!readOnly)finishPortDrag(node.id,port.id,side);}} onClick={()=>{if(readOnly)return;setArmed({node:node.id,port:port.id,type:port.type,label:port.label||"Next action",side});setCategory("all");setQuery("");setPaletteOpen(true);}}/>
    </div>;
  }

  return (
    <div
      className="wf-canvas-wrap"
      data-panning={spaceHeld ? "true" : "false"}
      /* What is being dragged, for the cursor. From the drag state, not
         `:active`, which also fires on a press that becomes a click. */
      data-drag={drag?.kind ?? "none"}
      data-palette={paletteOpen ? "open" : "closed"}
      data-panel={paletteOpen ? "library" : selected ? "inspector" : "closed"}
    >
      <div
        ref={surfaceRef}
        className="wf-canvas"
        tabIndex={0}
        aria-label="Workflow canvas"
        style={{ backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
                 backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onPointerMove={onPointerMove}
        /* Right-click on empty canvas adds a block at that spot. */
        onContextMenu={(event) => {
          if (readOnly) return;
          event.preventDefault();
          const point = toCanvas(event);
          setMenu({ kind: "canvas", x: point.x, y: point.y });
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDrag(null);
        }}
        onPointerCancel={()=>setDrag(null)}
        /* No `onPointerLeave` cancel: the pan captures the pointer, so leaving
           the surface mid-drag is normal, and capture guarantees the pointerup
           arrives here. */
        onDragStart={(event) => {
          /* Refuses the browser's native drag. Nodes move with pointer events,
             and a native image or text drag would swallow the pan. The palette
             (the drag source for new blocks) is outside this element. */
          event.preventDefault();
        }}
        onDragOver={(event) => {
          if (readOnly) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (readOnly) return;
          event.preventDefault();
          const type = event.dataTransfer.getData("application/x-gator-block");
          const block = BLOCKS_BY_TYPE[type];
          if (block) {
            addBlock(block, {
              clientX: event.clientX - NODE_WIDTH / 2,
              clientY: event.clientY - HEADER_HEIGHT / 2,
            });
          }
        }}
        onPointerDown={(event) => {
          /* Empty canvas means not on a block, a control or a wire. Not
             `event.target === event.currentTarget`: `.wf-surface` covers the
             whole canvas and is the target nearly everywhere. The SVG layer
             ignores the pointer, but each wire has a hit stroke that stops the
             press so clicking a wire selects it instead of panning. */
          const target = event.target as HTMLElement;
          const onEmpty =
            !target.closest(".wf-node") &&
            !target.closest("button, input, textarea, select, a, label");
          // Space or the middle button pans from anywhere; otherwise only empty
          // canvas pans (dragging a block starts on the block).
          const wantsPan = spaceHeld || event.button === 1 || onEmpty;
          if (!wantsPan) return;
          // Prevents a text selection from starting. Must come before the
          // capture.
          event.preventDefault();
          event.currentTarget.focus({preventScroll:true});
          event.currentTarget.setPointerCapture(event.pointerId);
          // Clicking anywhere that is not a block or a control deselects.
          if (onEmpty) {
            setSelected(null);
            setArmed(null);
          }
          setDrag({
            kind: "canvas",
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          });
        }}
      >
        <div
          className="wf-surface"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Wires can be selected and removed. Each has an invisible wide
             stroke that takes the pointer, since the 2px line itself is too
             thin to hit. */}
          <svg className="wf-edges">
            {graph.edges.filter(edge=>showData || BLOCKS_BY_TYPE[nodesById[edge.from.node]?.type]?.outputs.find(port=>port.id===edge.from.port)?.type === "flow").map((edge) => {
              const a = nodesById[edge.from.node]
                ? measuredPort(nodesById[edge.from.node], edge.from.port, "out")
                : null;
              const b = nodesById[edge.to.node]
                ? measuredPort(nodesById[edge.to.node], edge.to.port, "in")
                : null;
              if (!a || !b) return null;
              const block = BLOCKS_BY_TYPE[nodesById[edge.from.node].type];
              const port = block?.outputs.find((item) => item.id === edge.from.port);
              const path = edgePath(a, b);
              return (
                <g key={edge.id} className="wf-edge-group">
                  <path
                    d={path}
                    data-wf-from={`${edge.from.node}:out:${edge.from.port}`}
                    data-wf-to={`${edge.to.node}:in:${edge.to.port}`}
                    data-wf-kind={port?.type === "flow" ? "flow" : "data"}
                    stroke={PORT_COLORS[port?.type || "flow"]}
                    className={`wf-edge ${hoverEdge === edge.id ? "wf-edge-hot" : ""}`}
                  />
                  {readOnly ? null : (
                    <path
                      d={path}
                      className="wf-edge-hit"
                      // Stops the canvas from starting a pan on a wire press: a
                      // pan would capture the pointer and the double-click's
                      // second click would never reach the wire.
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerEnter={() => setHoverEdge(edge.id)}
                      onPointerLeave={() =>
                        setHoverEdge((current) => (current === edge.id ? null : current))
                      }
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        removeEdge(edge.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const point = toCanvas(event);
                        setMenu({ kind: "edge", id: edge.id, x: point.x, y: point.y });
                      }}
                    >
                      <title>Double-click to disconnect</title>
                    </path>
                  )}
                </g>
              );
            })}
            {drag?.kind === "port" && nodesById[drag.node] ? (
              (() => {
                const anchor = measuredPort(nodesById[drag.node], drag.port, drag.side);
                if (!anchor) return null;
                const a = drag.side === "out" ? anchor : { x: drag.x, y: drag.y };
                const b = drag.side === "out" ? { x: drag.x, y: drag.y } : anchor;
                return (
                  <path
                    d={edgePath(a, b)}
                    stroke={PORT_COLORS[drag.type]}
                    className="wf-edge wf-edge-live"
                  />
                );
              })()
            ) : null}
          </svg>

          {menu ? (
            <WorkflowContextMenu
              menu={menu}
              onClose={() => setMenu(null)}
              onAddBlock={(block, x, y) =>
                addBlock(block, {
                  clientX:
                    (surfaceRef.current?.getBoundingClientRect().left ?? 0) +
                    x * zoom +
                    pan.x,
                  clientY:
                    (surfaceRef.current?.getBoundingClientRect().top ?? 0) +
                    y * zoom +
                    pan.y,
                })
              }
              onRemoveNode={removeNode}
              onRemoveEdge={removeEdge}
              onDisconnectNode={(id) =>
                onChange({
                  ...graph,
                  edges: graph.edges.filter(
                    (edge) => edge.from.node !== id && edge.to.node !== id,
                  ),
                })
              }
              edgeCountFor={(id) =>
                graph.edges.filter(
                  (edge) => edge.from.node === id || edge.to.node === id,
                ).length
              }
            />
          ) : null}
          {graph.nodes.map((node, index) => {
            const block = BLOCKS_BY_TYPE[node.type];
            if (!block) return null;
            const accent = CATEGORY_ACCENTS[block.category];
            // A field under a port that already has a wire is a value that
            // looks used and is not, which is worse than no field at all.
            const declaredFieldIds = new Set(
              (block.fields || []).map((field) => field.id),
            );
            const nodeEditor = selected === node.id && !paletteOpen ? (
                <div className="wf-node-body">
                  {block.inputs.map((port) => (
                    <React.Fragment key={port.id}>
                      <div className="wf-port wf-port-in">
                      <button
                        type="button"
                        data-wf-anchor={`${node.id}:in:${port.id}`}
                        className={`wf-dot ${
                          portDimmed("in", port.type, node.id) ? "is-dim" : ""
                        }`}
                        aria-label={`${port.label || "Flow"} input, ${PORT_LABELS[port.type]}`}
                        style={{ color: PORT_COLORS[port.type] }}
                        onPointerDown={(event) => {
                          if (readOnly) return;
                          event.stopPropagation();
                          const point = toCanvas(event);
                          setDrag({
                            kind: "port",
                            node: node.id,
                            port: port.id,
                            side: "in",
                            type: port.type,
                            x: point.x,
                            y: point.y,
                          });
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation();
                          finishPortDrag(node.id, port.id, "in");
                        }}
                        /* Clicking an empty input arms it: the palette shows
                           the blocks that produce its type. */
                        onClick={(event) => {
                          if (readOnly || port.type === "flow") return;
                          event.stopPropagation();
                          setArmed((current) =>
                            current &&
                            current.node === node.id &&
                            current.port === port.id
                              ? null
                              : {
                                  node: node.id,
                                  port: port.id,
                                  type: port.type,
                                  label: port.label || "input",
                                  side: "in",
                                },
                          );
                          setPaletteOpen(true);
                        }}
                      />
                      <span className="wf-port-label">
                        {port.label || "Run"}
                        {port.required ? <i aria-hidden>*</i> : null}
                      </span>
                      </div>
                      {port.type !== "flow" && (sources[port.id]?.length > 0 || wiredPorts.has(`${node.id}:${port.id}`)) && <WorkflowSelect label={`${block.label}: ${port.label} source`}
                        disabled={readOnly}
                        value={(()=>{const edge=graph.edges.find(e=>e.to.node===node.id&&e.to.port===port.id);return edge ? `${edge.from.node}:${edge.from.port}` : "literal";})()}
                        options={[{value:"literal",label:"Enter a value"},...(sources[port.id] || []),...graph.edges.filter(e=>e.to.node===node.id&&e.to.port===port.id&&!sources[port.id]?.some(s=>s.value===`${e.from.node}:${e.from.port}`)).map(e=>({value:`${e.from.node}:${e.from.port}`,label:"Connection needs fixing"}))]}
                        onChange={value=>{
                          const edges=graph.edges.filter(e=>!(e.to.node===node.id&&e.to.port===port.id));
                          if(value!=="literal"){const split=value.lastIndexOf(":");edges.push({id:crypto.randomUUID(),from:{node:value.slice(0,split),port:value.slice(split+1)},to:{node:node.id,port:port.id}});}
                          onChange({...graph,edges});
                        }}/>}
                      {/* The typed value for this port. Hidden when wired, and
                         skipped when the block declares a field with the same
                         id (that field carries its own label, placeholder or
                         options). */}
                      {port.type !== "flow" &&
                      !wiredPorts.has(`${node.id}:${port.id}`) &&
                      !declaredFieldIds.has(port.id) ? (
                        <PortInput
                          port={port}
                          value={node.values?.[port.id] || ""}
                          readOnly={readOnly}
                          onChange={(next) =>
                            onChange({
                              ...graph,
                              nodes: graph.nodes.map((item) =>
                                item.id === node.id
                                  ? {
                                      ...item,
                                      values: { ...(item.values || {}), [port.id]: next },
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      ) : null}
                    </React.Fragment>
                  ))}
                  {block.fields?.length ? (
                    <div className="wf-fields">
                      {block.fields.filter(field => !wiredPorts.has(`${node.id}:${field.id}`)).map((field) => (
                        <NodeField
                          key={field.id}
                          field={field.id === "workflow" && node.type.startsWith("workflow.") ? {...field, kind: "select", options: workflows.map(w=>({value:w._id,label:w.name}))} : field}
                          value={node.values?.[field.id] || ""}
                          readOnly={readOnly}
                          onChange={(next) =>
                            onChange({
                              ...graph,
                              nodes: graph.nodes.map((item) =>
                                item.id === node.id
                                  ? {
                                      ...item,
                                      values: { ...(item.values || {}), [field.id]: next },
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  {block.outputs.map((port) => (
                    <div key={port.id} className="wf-port wf-port-out">
                      {port.type === "flow" && !readOnly && !graph.edges.some(edge=>edge.from.node===node.id&&edge.from.port===port.id) ? <button className="wf-add-next" onPointerDown={event=>event.stopPropagation()} onClick={()=>{setArmed({node:node.id,port:port.id,type:port.type,label:port.label||"Next action",side:"out"});setCategory("all");setQuery("");setPaletteOpen(true);}}><IconPlus size={13}/>{port.label || "Add next action"}</button> : <span className="wf-port-label">{port.label || (block.isTrigger ? "Then" : "Next")}</span>}
                      <button
                        type="button"
                        data-wf-anchor={`${node.id}:out:${port.id}`}
                        className={`wf-dot ${
                          portDimmed("out", port.type, node.id) ? "is-dim" : ""
                        } ${
                          armed?.node === node.id && armed?.port === port.id
                            ? "is-armed"
                            : ""
                        }`}
                        aria-label={`${port.label || "Flow"} output, ${PORT_LABELS[port.type]}`}
                        style={{ color: PORT_COLORS[port.type] }}
                        onPointerDown={(event) => {
                          if (readOnly) return;
                          event.stopPropagation();
                          const point = toCanvas(event);
                          setDrag({
                            kind: "port",
                            node: node.id,
                            port: port.id,
                            side: "out",
                            type: port.type,
                            x: point.x,
                            y: point.y,
                          });
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation();
                          finishPortDrag(node.id, port.id, "out");
                        }}
                        /* Pointerdown starts a wire; if the pointer did not
                           move, the following click arms the port instead. */
                        onClick={(event) => {
                          if (readOnly) return;
                          event.stopPropagation();
                          setArmed((current) =>
                            current &&
                            current.node === node.id &&
                            current.port === port.id
                              ? null
                              : {
                                  node: node.id,
                                  port: port.id,
                                  type: port.type,
                                  label:
                                    port.label ||
                                    (block.isTrigger ? "Then" : "Next"),
                                  side: "out",
                                },
                          );
                          setPaletteOpen(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
            ) : null;
            return (
              <React.Fragment key={node.id}><div
                key={node.id}
                data-wf-node={node.id}
                className={`wf-node ${selected === node.id ? "wf-node-on" : ""} ${
                  problemNodes.has(node.id) ? "wf-node-warn" : ""
                }`}
                style={
                  {
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    ["--wf-accent" as string]: accent,
                  } as React.CSSProperties
                }
                onContextMenu={(event) => {
                  if (readOnly) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelected(node.id);
                  const point = toCanvas(event);
                  setMenu({ kind: "node", id: node.id, x: point.x, y: point.y });
                }}
                onPointerDown={(event) => {
                  if (readOnly || spaceHeld || event.button === 1) return;
                  // Prevents dragging a block from selecting its title text.
                  // Only when the press is not in a port's input, so those
                  // inputs can still take focus.
                  const target = event.target as HTMLElement;
                  if (target.closest("button, input, textarea, select, a, label")) return;
                  event.preventDefault();
                  surfaceRef.current?.focus({preventScroll:true});
                  surfaceRef.current?.setPointerCapture(event.pointerId);
                  dragHistory.current = nextId("drag");
                  setSelected(node.id);
                  setPaletteOpen(false);
                  const point = toCanvas(event);
                  setDrag({
                    kind: "node",
                    id: node.id,
                    dx: point.x - node.x,
                    dy: point.y - node.y,
                  });
                }}
              >
                <div className="wf-node-head">
                  <span className="wf-map-index" aria-hidden>{String(index+1).padStart(2,"0")}</span>
                  <div className="min-w-0">
                    <span className="wf-node-kind">{block.isTrigger ? "When this happens" : block.inputs.some(p=>p.type==="flow") ? "Then do this" : block.outputs.some(p=>p.type==="boolean") ? "Check a condition" : "Get or prepare data"}</span>
                    <p className="wf-node-title">{block.label}</p>
                    <p className="wf-node-sub">{block.description}</p>
                  </div>
                  <span className="wf-node-ref" title={blockRef(index)}>{block.isTrigger ? "START" : block.inputs.some(p=>p.type==="flow") ? "ACTION" : "DATA"}</span>
                </div>
                <div className="wf-map-body">
                  <p className="wf-map-summary">{nodeSummary(node, block, meta)}</p>
                  {!showData && graph.edges.some(edge=>edge.to.node===node.id && block.inputs.some(port=>port.id===edge.to.port && port.type!=="flow")) && <div className="wf-map-sources" aria-label={`${block.label} uses data from`}>
                    <span>Using</span>
                    {graph.edges.filter(edge=>edge.to.node===node.id && block.inputs.some(port=>port.id===edge.to.port && port.type!=="flow")).map(edge=>{
                      const source = nodesById[edge.from.node];
                      const sourceBlock = BLOCKS_BY_TYPE[source?.type];
                      const output = sourceBlock?.outputs.find(port=>port.id===edge.from.port);
                      if (!source || !output) return null;
                      return <button key={edge.id} onPointerDown={event=>event.stopPropagation()} onClick={()=>focusNode(source.id)} title={`Open ${sourceBlock.label}, which provides ${output.label || "this value"}`}><span>{String(graph.nodes.findIndex(item=>item.id===source.id)+1).padStart(2,"0")}</span>{output.label || PORT_LABELS[output.type]}</button>;
                    })}
                  </div>}
                  <button className="wf-map-configure" onPointerDown={e=>e.stopPropagation()} onClick={()=>focusNode(node.id)}>
                    {problems.some(p=>p.node===node.id) ? <><IconAlertTriangle size={14}/>{problems.filter(p=>p.node===node.id).length} to finish</> : <><IconPencil size={14}/>Edit block</>}
                  </button>
                  {block.inputs.filter(port=>port.type==="flow" || showData).map(port=>mapPort(node,port,"in"))}
                  {block.outputs.filter(port=>port.type==="flow" || showData).map(port=>mapPort(node,port,"out"))}
                </div>
                {selected === node.id && !readOnly ? (
                  <button
                    type="button"
                    className="wf-node-delete"
                    aria-label={`Delete ${block.label}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeNode(node.id)}
                  >
                    <IconTrash size={13} />
                  </button>
                ) : null}
              </div>
              {selected === node.id && inspectorElement && !paletteOpen ? createPortal(nodeEditor,inspectorElement) : null}
              </React.Fragment>
            );
          })}
        </div>

        {graph.nodes.length === 0 ? (
          <div className="wf-empty">
            <span className="wf-start-number">01</span>
            <p>What should start your workflow?</p>
            <p>Choose an event. Then add an action and tell it what to use.</p>
            <button className="wf-settings-action" onClick={()=>{setPaletteOpen(true);setCategory("trigger");setQuery("");}}>Choose a starting event <IconPlus size={15}/></button>
          </div>
        ) : null}

        <div className="wf-canvas-toolbar" onPointerDown={event=>event.stopPropagation()}>
          {!readOnly && <button className="wf-toolbar-primary" onClick={openAddMenu}><IconPlus size={15}/>Add block</button>}
          {!readOnly && graph.nodes.length > 1 && <button onClick={arrange}><IconFocusCentered size={15}/>Arrange</button>}
          {graph.nodes.length > 0 && <WorkflowSelect label="Jump to a block" value="" placeholder="Find a block…" onChange={focusNode} options={graph.nodes.map((node,index)=>({value:node.id,label:`${index+1}. ${BLOCKS_BY_TYPE[node.type]?.label || node.type}`}))}/>}
          {graph.nodes.length > 0 && <button aria-pressed={showData} onClick={()=>setShowData(value=>!value)}>{showData ? "Hide data" : "Show data"}</button>}
          <span className="wf-wire-key"><i/>Run order <i className="is-data"/>Data</span>
        </div>

        {/* Viewport controls, bottom-left, out of the way of the palette. */}
        <div className="wf-viewport-controls">
          <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">
            <IconMinus size={15} />
          </button>
          <button
            type="button"
            className="wf-zoom-level"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => zoomAt(1.2)} aria-label="Zoom in">
            <IconPlus size={15} />
          </button>
          <button type="button" onClick={fitView} aria-label="Fit the graph to the screen">
            <IconFocusCentered size={15} />
          </button>
        </div>

        {/* The hint leads with dragging empty canvas, mentions space for panning
           without an empty patch, and double-click for removing a wire. */}
        <p className="wf-pan-hint" aria-hidden>
          Drag the canvas to pan · scroll to zoom · double-click a wire to
          disconnect · right-click for more
        </p>

        {connectionNotice && <div className="wf-connection-notice" role="status">{connectionNotice}<button onClick={()=>setConnectionNotice("")} aria-label="Dismiss connection notice">×</button></div>}
        {problems.length ? (
          <div className="wf-problems">
            <button
              type="button"
              className="wf-problems-badge"
              onClick={() => setProblemsOpen((open) => !open)}
              aria-expanded={problemsOpen}
            >
              <IconAlertTriangle size={14} />
              {problems.length} {problems.length === 1 ? "problem" : "problems"}
            </button>
            {problemsOpen ? (
              <ul className="wf-problems-list">
                {problems.map((problem, index) => (
                  <li key={`${problem.node}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        focusNode(problem.node);
                        setProblemsOpen(false);
                      }}
                    >
                      <span className="wf-problems-ref">{problem.ref}</span>
                      {problem.message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="wf-palette-handle"
          aria-expanded={paletteOpen}
          aria-label={paletteOpen ? "Hide the block palette" : "Show the block palette"}
          title={paletteOpen ? "Hide blocks" : "Show blocks"}
          onClick={() => setPaletteOpen((open) => !open)}
        >
          {paletteOpen ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
      ) : null}

      <aside className="wf-inspector" hidden={!selected || paletteOpen} aria-label="Edit selected block">
        <header><div><span>{selected ? `Step ${graph.nodes.findIndex(node=>node.id===selected)+1} of ${graph.nodes.length}` : "Block settings"}</span><h2>{BLOCKS_BY_TYPE[nodesById[selected || ""]?.type]?.label || "Select a block"}</h2></div><button onClick={()=>setSelected(null)} aria-label="Close block settings"><IconX size={18}/></button></header>
        {selected && <nav className="wf-step-navigation" aria-label="Connected steps">{graph.edges.filter(edge=>edge.to.node===selected && BLOCKS_BY_TYPE[nodesById[edge.from.node]?.type]?.outputs.some(port=>port.id===edge.from.port&&port.type==="flow")).map(edge=><button key={edge.id} onClick={()=>focusNode(edge.from.node)}><IconChevronLeft size={15}/>Back to {BLOCKS_BY_TYPE[nodesById[edge.from.node]?.type]?.label}</button>)}</nav>}
        <p className="wf-inspector-help">{BLOCKS_BY_TYPE[nodesById[selected || ""]?.type]?.description}</p>
        {problems.filter(p=>p.node===selected).length > 0 && <ul className="wf-inspector-issues">{problems.filter(p=>p.node===selected).map((p,i)=><li key={i}>{p.message}</li>)}</ul>}
        <div className="wf-inspector-fields" ref={setInspectorElement}/>
        {selected && nodesById[selected] && <section className="wf-next-steps" aria-label="What happens next"><h3>What happens next</h3>{(BLOCKS_BY_TYPE[nodesById[selected].type]?.outputs.filter(port=>port.type==="flow") || []).map(port=>{
          const routes=graph.edges.filter(edge=>edge.from.node===selected&&edge.from.port===port.id);
          return <div key={port.id}>{port.label&&<small>{port.label}</small>}{routes.map(edge=><div className="wf-next-route" key={edge.id}><button onClick={()=>focusNode(edge.to.node)}>Edit {BLOCKS_BY_TYPE[nodesById[edge.to.node]?.type]?.label}<IconChevronRight size={15}/></button>{!readOnly&&<button onClick={()=>beginInsert(edge)} aria-label={`Insert before ${BLOCKS_BY_TYPE[nodesById[edge.to.node]?.type]?.label}`}><IconPlus size={15}/>Insert before</button>}</div>)}{!routes.length&&!readOnly&&<button className="wf-continue-building" onClick={()=>continueFrom(nodesById[selected],port)}><IconPlus size={16}/>Add the next step</button>}</div>;
        })}{!BLOCKS_BY_TYPE[nodesById[selected].type]?.outputs.some(port=>port.type==="flow")&&<p>Use this block’s output as a value in another step.</p>}</section>}
        <footer><button className="wf-settings-action" onClick={()=>setSelected(null)}>Done</button>{!readOnly && selected && <button className="wf-settings-action wf-settings-action-danger" onClick={()=>removeNode(selected)}>Delete block</button>}</footer>
      </aside>
      {!readOnly ? (
        <aside
          className="wf-palette"
          aria-label="Blocks"
          data-armed={armed ? "true" : "false"}
          hidden={!paletteOpen}
        >
          <div className="wf-library-heading"><strong>{inserting ? "Make room for a step" : graph.nodes.some(n=>BLOCKS_BY_TYPE[n.type]?.isTrigger) ? "What should happen next?" : "Choose a starting event"}</strong><p>{inserting ? "Choose an action. We’ll connect it on both sides." : armed ? "Only compatible blocks are shown." : "Search by what you want to do."}</p><button className="wf-library-close" aria-label="Close block library" onClick={()=>setPaletteOpen(false)}><IconX size={18}/></button></div>
          {inserting && <div className="wf-insert-preview"><span>{BLOCKS_BY_TYPE[nodesById[graph.edges.find(edge=>edge.id===inserting)?.from.node || ""]?.type]?.label}</span><strong><IconPlus size={15}/>Your new step</strong><span>{BLOCKS_BY_TYPE[nodesById[graph.edges.find(edge=>edge.id===inserting)?.to.node || ""]?.type]?.label}</span></div>}
          {!term && category==="all" && armed?.type==="flow" && <div className="wf-quick-steps"><span>Common next steps</span>{["send","wait","role_add","branch"].map(type=>[...grouped.values()].flat().find(block=>block.type===type)).filter((block):block is BlockDef=>!!block).map(block=><button key={block.type} onClick={()=>addBlock(block)}>{block.type==="send"?"Send a message":block.type==="wait"?"Pause for a moment":block.type==="role_add"?"Give a role":"Choose a path"}<IconPlus size={14}/></button>)}</div>}
          {/* The palette is docked beside the canvas, so every block and its
             ports stay visible while building. */}
          {armed && !inserting ? (
            <div className="wf-armed">
              <span className="wf-armed-dot" style={{ color: PORT_COLORS[armed.type] }} />
              <span className="min-w-0">
                <span className="wf-armed-title">
                  {armed.side === "in" ? "Supply" : "Continue from"} {armed.label}
                </span>
                <span className="wf-armed-hint">
                  {PORT_LABELS[armed.type]} · pick one and it wires itself
                </span>
              </span>
              <button type="button" onClick={() => setArmed(null)} aria-label="Cancel">
                <IconX size={14} />
              </button>
            </div>
          ) : null}
          <div className="wf-palette-search">
            <IconSearch size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search blocks"
              aria-label="Search blocks"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <IconX size={14} />
              </button>
            ) : null}
          </div>
          <div className="wf-palette-chips">
            <button
              type="button"
              className={`wf-chip ${category === "all" ? "is-on" : ""}`}
              onClick={() => setCategory("all")}
            >
              All
            </button>
            {CATEGORY_ORDER.filter(item=>availableCategories.has(item)).map((item) => (
              <button
                key={item}
                type="button"
                className={`wf-chip ${category === item ? "is-on" : ""}`}
                style={
                  { ["--wf-accent" as string]: CATEGORY_ACCENTS[item] } as React.CSSProperties
                }
                onClick={() => setCategory(category === item ? "all" : item)}
              >
                {CATEGORY_LABELS[item]}
              </button>
            ))}
          </div>
          {capabilities && !capabilities.erlc && <p className="wf-library-note">ER:LC blocks become available when you connect your game in ERLC settings.</p>}
          <div className="wf-palette-body">
            {grouped.size === 0 ? (
              <p className="wf-palette-empty">
                {armed
                  ? `Nothing can take a ${PORT_LABELS[armed.type].toLowerCase()} from here.`
                  : `Nothing matches ${query.trim() ? `“${query.trim()}”` : "that filter"}.`}
              </p>
            ) : (
              [...grouped.entries()].sort(([a],[b])=>["trigger","message","action","condition","logic","data","roblox","staff","flow"].indexOf(a)-["trigger","message","action","condition","logic","data","roblox","staff","flow"].indexOf(b)).map(([group, blocks]) => (
                <div key={group} className="wf-palette-group">
                  <p
                    className="wf-palette-group-title"
                    style={{ color: CATEGORY_ACCENTS[group] }}
                  >
                    {CATEGORY_LABELS[group]}
                    <span>{blocks.length}</span>
                  </p>
                  {blocks.map((block) => (
                    <PaletteCard
                      key={block.type}
                      block={block}
                      lands={landingPort(block)}
                      onAdd={() => addBlock(block)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

/** A single-choice control for a node's options: a group of buttons. */
function WorkflowSelect({label,value,options,onChange,disabled=false,placeholder="Choose…"}: {label:string;value:string;options:{value:string;label:string;description?:string}[];onChange:(value:string)=>void;disabled?:boolean;placeholder?:string}) {
  return <div className="wf-choice" role="group" aria-label={label} inert={disabled} aria-disabled={disabled || undefined} onPointerDown={event=>event.stopPropagation()}><SelectField value={value} options={options} placeholder={placeholder} onChange={next=>{if(!disabled)onChange(next || "");}}/></div>;
}

function nodeSummary(node:WorkflowNode, block:BlockDef, meta:GuildMeta | null | undefined) {
  const values=node.values || {};
  if(block.isTrigger) return block.description;
  const text=values.text || values.content || values.message;
  if(text && !text.startsWith("{")) return text.length>90 ? `${text.slice(0,87)}…` : text;
  if(values.role) return `Role: ${meta?.roles.find(role=>role.id===values.role)?.name || "selected role"}`;
  if(values.channel) return `Channel: ${meta?.channels.find(channel=>channel.id===values.channel)?.name || "selected channel"}`;
  if(values.value) return `Value: ${values.value}`;
  if(node.type==="wait" && values.seconds) return `Wait ${values.seconds} seconds, then continue.`;
  return block.description;
}

function PaletteCard({
  block,
  onAdd,
  lands,
}: {
  block: BlockDef;
  onAdd: () => void;
  /** When a port is armed, the input this block would be wired into. */
  lands?: BlockPort | null;
}) {
  const accent = CATEGORY_ACCENTS[block.category];
  /* Blocks the engine cannot run yet are marked in the palette, not only once
     placed. */
  const runnable = isRunnable(block.type);
  return (
    <div
      className="wf-palette-card"
      data-runnable={runnable ? "true" : "false"}
      title={runnable ? undefined : `${block.label} can be built now and will start working when the bot supports it.`}
      style={{ ["--wf-accent" as string]: accent } as React.CSSProperties}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-gator-block", block.type);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <button type="button" className="wf-palette-card-head" onClick={onAdd}>
        <span className="min-w-0">
          <span className="wf-palette-card-label">
            {block.label}
            {runnable ? null : <i className="wf-soon" aria-label="not runnable yet">soon</i>}
          </span>
          <span className="wf-palette-card-hint">{block.description}</span>
        </span>
        {lands ? (
          <span className="wf-palette-lands">
            <i style={{ color: PORT_COLORS[lands.type] }} />
            {lands.label || "Run"}
          </span>
        ) : (
          <IconPlus size={14} />
        )}
      </button>
      {block.inputs.length || block.outputs.length ? (
        <details className="wf-palette-details"><summary>Inputs & outputs</summary><div className="wf-palette-card-ports">
          <ul>
            {block.inputs.slice(0, 6).map((port) => (
              <li key={port.id}>
                <i style={{ color: PORT_COLORS[port.type] }} />
                {port.label || "Run"}
              </li>
            ))}
          </ul>
          <ul className="is-out">
            {block.outputs.slice(0, 6).map((port) => (
              <li key={port.id}>
                {port.label || (block.isTrigger ? "Then" : "Next")}
                <i style={{ color: PORT_COLORS[port.type] }} />
              </li>
            ))}
          </ul>
        </div></details>
      ) : null}
    </div>
  );
}

/**
 * One inline control on a node, styled for the canvas rather than like a
 * dashboard form row.
 */
/**
 * The editor under an input port with nothing wired into it. The engine accepts
 * a typed value in place of a wire (`resolve` in workflow_graph.py reads
 * `node.values[portId]` when no edge feeds the port; a wire wins), so required
 * inputs can be filled without a producer block. It disappears once a wire is
 * connected, so it never shows an unused value.
 */
function PortInput({
  port,
  value,
  onChange: onChangeValue,
  readOnly,
}: {
  port: BlockPort;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}) {
  const onChange = (value: string) => { if (!readOnly) onChangeValue(value); };
  const meta = useEditorMeta();
  const stop = (event: React.PointerEvent | React.MouseEvent) =>
    event.stopPropagation();
  const [editing, setEditing] = useState(false);

  // Common fixed values are picked here; a wire can still supply a shared value.
  if (port.type === "channel" || port.type === "role") {
    return <div className="wf-port-input" onPointerDown={stop} inert={readOnly}>
      {port.type === "channel" ? <ChannelPicker channels={meta?.channels || []} value={value} onChange={v => onChange(String(v || ""))} /> : <RolePicker roles={meta?.roles || []} value={value} onChange={v => onChange(String(v || ""))} />}
    </div>;
  }

  if (port.type === "message") {
    const message = parseNodeMessage(value);
    return (
      <div className="wf-port-input" onPointerDown={stop} inert={readOnly}>
        <button
          type="button"
          className="wf-field-message"
          disabled={readOnly}
          onClick={() => setEditing(true)}
        >
          <IconMessage size={13} />
          <span>{describeNodeMessage(message)}</span>
        </button>
        {editing ? (
          <MessageValueEditor
            title={port.label || "Message"}
            value={value}
            onChange={onChange}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </div>
    );
  }

  if (port.type === "boolean") {
    return (
      <div className="wf-port-input" onPointerDown={stop} inert={readOnly}>
        <WorkflowSelect label={port.label} value={value} disabled={readOnly} options={[{value:"true",label:"Yes"},{value:"false",label:"No"}]} onChange={onChange} placeholder="Choose yes or no"/>
      </div>
    );
  }

  // Lists and records come from other blocks; there is nothing sensible to
  // type.
  if (port.type === "list" || port.type === "record") {
    return (
      <p className="wf-port-hint" onPointerDown={stop}>
        Wire this in from another block.
      </p>
    );
  }

  const placeholder =
    port.type === "member" || port.type === "user"
      ? "Discord id, or wire a member in"
      : port.type === "player"
        ? "Roblox username"
        : port.type === "time"
          ? "18:00"
          : port.type === "number"
            ? "0"
            : "Type a value, or wire one in";

  return (
    <div className="wf-port-input" onPointerDown={stop} inert={readOnly}>
      {port.type === "text" && ["text", "content", "description", "reason"].includes(port.id) ? <textarea aria-label={port.label} rows={3} value={value} disabled={readOnly} placeholder="Write your message…" onChange={event=>onChange(event.target.value)}/> : <input
        aria-label={port.label}
        type={port.type === "number" ? "number" : "text"}
        value={value}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />}
    </div>
  );
}

function NodeField({
  field,
  value,
  onChange: onChangeValue,
  readOnly,
}: {
  field: BlockField;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}) {
  const onChange = (value: string) => { if (!readOnly) onChangeValue(value); };
  const meta = useEditorMeta();
  const stop = (event: React.PointerEvent | React.MouseEvent) =>
    event.stopPropagation();
  const [editing, setEditing] = useState(false);

  // A message field shows what is in the message and opens the full message
  // editor (the one the module message cards use).
  if (field.kind === "message") {
    const message = parseNodeMessage(value);
    return (
      <div className="wf-field" onPointerDown={stop}>
        {field.label ? <span className="wf-field-label">{field.label}</span> : null}
        <button
          type="button"
          className="wf-field-message"
          disabled={readOnly}
          onClick={() => setEditing(true)}
        >
          <IconMessage size={13} />
          <span>{describeNodeMessage(message)}</span>
        </button>
        {editing ? (
          <MessageValueEditor
            title={field.label || "Message"}
            value={value}
            onChange={onChange}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <label className="wf-field" onPointerDown={stop} inert={readOnly}>
      {field.label ? <span className="wf-field-label">{field.label}</span> : null}
      {field.kind === "textarea" ? (
        <textarea
          rows={2}
          value={value}
          disabled={readOnly}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.kind === "select" ? (
        <WorkflowSelect label={field.label} value={value} disabled={readOnly} options={field.options || []} onChange={onChange}/>
      ) : field.kind === "channel" ? (
        // The `Pick A Channel` block's own field: a channel picker.
        <ChannelPicker
          channels={meta?.channels || []}
          value={value || null}
          placeholder="Pick a channel"
          onChange={(next) => onChange(typeof next === "string" ? next : "")}
        />
      ) : field.kind === "role" ? (
        <RolePicker
          roles={meta?.roles || []}
          value={value || null}
          placeholder="Pick a role"
          onChange={(next) => onChange(typeof next === "string" ? next : "")}
        />
      ) : (
        <input
          type={field.kind === "number" ? "number" : "text"}
          value={value}
          disabled={readOnly}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

/**
 * The chrome around the canvas: the name, the state and the three views. The
 * resource mark in the corner is the way back.
 */
export function WorkflowShell({
  name,
  enabled,
  onToggle,
  onRename,
  tab,
  onTab,
  children,
  actions,
  backHref,
  status,
  readOnly = false,
}: {
  readOnly?: boolean;
  name: string;
  enabled: boolean;
  onToggle: () => void;
  tab: "editor" | "history" | "settings";
  onTab: (next: "editor" | "history" | "settings") => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Where the resource mark goes. Without it the mark is decoration. */
  backHref?: string;
  /** Autosave state, shown beside the name. */
  /**
   * When given, the title can be edited where it is shown (new automations
   * start as "Untitled automation").
   */
  onRename?: (next: string) => void;
  status?: string;
}) {
  const mark = (
    <>
      <IconSettings size={22} className="wf-shell-mark-icon" />
      <IconArrowLeft size={20} className="wf-shell-mark-back" />
    </>
  );
  return (
    <div className="wf-shell">
      <header className="wf-shell-head">
        {backHref ? (
          <Link
            href={backHref}
            className="wf-shell-mark wf-shell-mark-link"
            aria-label="Back to resources"
            title="Back to resources"
          >
            {mark}
          </Link>
        ) : (
          <span className="wf-shell-mark">{mark}</span>
        )}
        <div className="min-w-0">
          {onRename ? (
            <input
              className="wf-shell-name wf-shell-name-input"
              value={name}
              onChange={(event) => onRename(event.target.value)}
              placeholder="Untitled automation"
              aria-label="Automation name"
              spellCheck={false}
              // Selects the whole thing on focus, because the value being
              // replaced is almost always the placeholder-ish default.
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            <p className="wf-shell-name">{name || "Untitled automation"}</p>
          )}
          <p className={`wf-shell-state ${enabled ? "is-on" : ""}`}>
            {enabled ? <IconCheck size={14} /> : <IconEyeOff size={14} />}
            {enabled ? "Enabled" : "Paused"}
            {status ? <span className="wf-shell-saved">· {status}</span> : null}
          </p>
        </div>
        <div className="wf-shell-actions">
          <button
            type="button"
            onClick={onToggle}
            disabled={readOnly}
            className="wf-shell-toggle"
            aria-pressed={enabled}
            aria-label={enabled ? "Pause this automation" : "Resume this automation"}
          >
            <span className="wf-enable-indicator" aria-hidden/>{enabled ? "Enabled" : "Enable workflow"}
          </button>
          {actions}
        </div>
      </header>
      <nav className="wf-tabs" role="tablist">
        {(
          [
            ["editor", "Editor", IconPencil],
            ["history", "History", IconHistory],
            ["settings", "Settings", IconSettings],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={`wf-tab ${tab === id ? "is-on" : ""}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      {children}
    </div>
  );
}

type CanvasMenu =
  | { kind: "canvas"; x: number; y: number }
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number };

/**
 * The canvas's right-click menu: add a block where you clicked, and disconnect
 * wires.
 */
function WorkflowContextMenu({
  menu,
  onClose,
  onAddBlock,
  onRemoveNode,
  onRemoveEdge,
  onDisconnectNode,
  edgeCountFor,
}: {
  menu: CanvasMenu;
  onClose: () => void;
  onAddBlock: (block: BlockDef, x: number, y: number) => void;
  onRemoveNode: (id: string) => void;
  onRemoveEdge: (id: string) => void;
  onDisconnectNode: (id: string) => void;
  edgeCountFor: (id: string) => number;
}) {
  const [query, setQuery] = useState("");

  // Dismissed by any press outside the menu, or Escape. `onClose` is held in a
  // ref and the effect has no dependencies: the parent passes a new inline
  // function each render, and the canvas re-renders on pointer movement, so
  // depending on it would keep re-arming the listener and it would never be
  // installed.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function away(event: MouseEvent) {
      if (!(event.target as HTMLElement)?.closest?.("[data-wf-menu]")) {
        closeRef.current();
      }
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    // Deferred a frame: the press that opened this would otherwise close it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", away);
      window.addEventListener("keydown", key);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, []);

  const term = query.trim().toLowerCase();
  const matches = term
    ? BLOCKS.filter(
        (block) =>
          block.label.toLowerCase().includes(term) ||
          block.description.toLowerCase().includes(term),
      ).slice(0, 8)
    : [];

  return (
    <div
      data-wf-menu
      className="wf-menu"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.kind === "canvas" ? (
        <>
          <p className="wf-menu-title">Add a block here</p>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks…"
            className="wf-menu-search"
          />
          {matches.length ? (
            matches.map((block) => (
              <button
                key={block.type}
                type="button"
                className="wf-menu-item"
                onClick={() => {
                  onAddBlock(block, menu.x, menu.y);
                  onClose();
                }}
              >
                <span className="wf-menu-item-label">{block.label}</span>
                <span className="wf-menu-item-sub">{block.description}</span>
              </button>
            ))
          ) : (
            <p className="wf-menu-empty">
              {term ? `Nothing matches “${query}”.` : "Type to search the palette."}
            </p>
          )}
        </>
      ) : null}

      {menu.kind === "node" ? (
        <>
          <button
            type="button"
            className="wf-menu-item"
            disabled={edgeCountFor(menu.id) === 0}
            onClick={() => {
              onDisconnectNode(menu.id);
              onClose();
            }}
          >
            <span className="wf-menu-item-label">
              Disconnect all wires
              {edgeCountFor(menu.id) ? ` (${edgeCountFor(menu.id)})` : ""}
            </span>
            <span className="wf-menu-item-sub">
              Keeps the block and everything typed into it.
            </span>
          </button>
          <button
            type="button"
            className="wf-menu-item is-danger"
            onClick={() => {
              onRemoveNode(menu.id);
              onClose();
            }}
          >
            <span className="wf-menu-item-label">Delete block</span>
            <span className="wf-menu-item-sub">Its wires go with it.</span>
          </button>
        </>
      ) : null}

      {menu.kind === "edge" ? (
        <button
          type="button"
          className="wf-menu-item is-danger"
          onClick={() => {
            onRemoveEdge(menu.id);
            onClose();
          }}
        >
          <span className="wf-menu-item-label">Disconnect</span>
          <span className="wf-menu-item-sub">
            The input falls back to whatever is typed into it.
          </span>
        </button>
      ) : null}
    </div>
  );
}

export { IconDotsVertical };
