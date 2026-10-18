import { definitions as coreBlocks } from "./blocks/core";
import { definitions as messageAndControlBlocks } from "./blocks/messages-and-control";
import { definitions as eventAndActionBlocks } from "./blocks/events-and-actions";
import { definitions as conditionAndValueBlocks } from "./blocks/conditions-and-values";

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

export const BLOCKS: BlockDef[] = [
  ...coreBlocks,
  ...messageAndControlBlocks,
  ...eventAndActionBlocks,
  ...conditionAndValueBlocks,
];


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
