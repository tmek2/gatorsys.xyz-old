import { type FlowStep } from "../container-flow-builder";

/* The container (Components v2) block model: types, Discord's limits, ids, summaries and validation. No React. */

/* ── Container (Components v2) blocks — mirrors the bot's builder ──────── */

export interface ContainerRowButton {
  type: string;
  label: string;
  /** Legacy action-row position. Kept when opening and resaving messages. */
  row?: number;
  ix?: number;
  emoji?: string;
  color?: string;
  url?: string;
  command?: string;
  template_name?: string;
  multi_panel?: string | null;
  ticket_panels?: string[];
  ticket_questions?: Record<string, any>[];
  application_id?: string;
  verification_required?: boolean;
  require_acknowledgement?: boolean;
  /** button (flow): the ordered action steps run when the button is clicked. */
  flow?: FlowStep[];
  /** package: Roblox item link + how the reward is delivered. Expands into an
   *  adjacent Purchase Here + Claim pair on the bot side. */
  purchase_url?: string;
  purchase_label?: string;
  claim_label?: string;
  reward_type?: string;
  role_ids?: string[];
  [key: string]: any;
}

export interface ContainerBlock {
  type: string;
  /**
   * Editor-only identity for React keys, collapsed state and drag (positions
   * change when blocks move; an id follows the block). Optional: blocks saved
   * before ids existed have none and key by position. The bot ignores this key.
   */
  id?: string;
  content?: string;
  divider?: boolean;
  spacing?: number | string;
  thumbnail_url?: string;
  urls?: string[];
  buttons?: ContainerRowButton[];
  /** text_button: the single button rendered beside the text. */
  button?: ContainerRowButton | null;
  /** message_dropdown */
  name?: string;
  placeholder?: string;
  templates?: { name?: string; type?: string }[];
  ephemeral?: boolean;
  /** system_button: place the module button(s) in the row of the block above. */
  inline?: boolean;
  /**
   * container: the blocks inside the accent-bordered box. A container is a
   * block like any other, so text, buttons and separators can sit beside it at
   * the top level, as in Discord's component tree. A layout with no container
   * block means one container around everything, coloured by the message's
   * `v2_color`.
   */
  blocks?: ContainerBlock[];
  /** container: accent colour, falling back to the message's `v2_color`. */
  color?: string;
}

export interface SystemComponentPreview {
  kind?: "button" | "select";
  label?: string;
  emoji?: string;
  style?: "Blurple" | "Green" | "Red" | "Grey";
  disabled?: boolean;
  placeholder?: string;
  options?: { label?: string; description?: string; emoji?: string }[];
}

/**
 * Discord's limits for a components-v2 message. Exceeding them fails at send
 * time with an error that names a component index, so the editor enforces them.
 */
export const CONTAINER_LIMITS = {
  /** Per TextDisplay, and what the bot truncates to in `_render_into`. */
  text: 4000,
  /** Across every TextDisplay in one message. */
  total: 4000,
  /** Top-level components in one container. */
  blocks: 40,
  /** Images in one media gallery. */
  galleryItems: 10,
  /** Components across one action row. */
  rowWidth: 5,
  /**
   * Options in one select menu. The bot truncates to the same number, so
   * exceeding it would silently drop the last ones.
   */
  selectOptions: 25,
} as const;

/** Every character Discord counts toward the message budget — the text blocks,
 *  and nothing else. Button labels and image URLs are not in it. */
export function containerCharacterCount(blocks: ContainerBlock[]): number {
  return (blocks || []).reduce((sum, block) => {
    if (block.type === "container") {
      return sum + containerCharacterCount(block.blocks || []);
    }
    return ["text", "section", "text_button"].includes(block.type)
      ? sum + String(block.content || "").length
      : sum;
  }, 0);
}

/**
 * Whether a layout places its own containers (the bot's
 * `layout_has_containers`). If it does, blocks sit at the top level and a
 * container is one of them; if not, the whole layout is wrapped in one
 * container.
 */
export function layoutHasContainers(blocks: ContainerBlock[]): boolean {
  return (blocks || []).some((block) => block.type === "container");
}

/**
 * The layout as the editor and preview work with it, with containers explicit.
 *
 * A layout saved before containers were blocks has none and means "one
 * container around everything". This makes that wrapper explicit on the way in,
 * so after the first edit a container exists only where one is wanted and new
 * blocks stay outside it. Returns a value; the stored document is unchanged
 * until edited.
 *
 * The accent is not copied onto the new container: the bot and the preview fall
 * back to the message's `v2_color`, so it is stored in one place only.
 */
export function toEditorLayout(
  blocks: ContainerBlock[],
  explicit = false,
): ContainerBlock[] {
  const list = blocks || [];
  // Saved by this editor, so the layout means what it says. The bot reads the
  // same flag (`v2_explicit_layout`) instead of inspecting the tree.
  if (explicit) return list;
  if (!list.length || layoutHasContainers(list)) return list;
  // The module button placeholder can be wrapped too: the bot's
  // `_strip_system_button` searches inside containers.
  return [{ type: "container", blocks: list }];
}

/**
 * Whether the module button placeholder is anywhere in the message. Asked of
 * the whole tree, because a nested editor only sees its own blocks and there is
 * one module button.
 */
export function layoutHasSystemButton(blocks: ContainerBlock[] | undefined): boolean {
  return (blocks || []).some(
    (block) =>
      block.type === "system_button" ||
      (block.type === "container" && layoutHasSystemButton(block.blocks)),
  );
}

/**
 * Compares two drafts by meaning: key order is ignored, and absent, null, ""
 * and [] are equal, so an untouched field the server omits does not count as an
 * edit (which would keep the save prompt up and block leaving the tab).
 */
export function sameMessage(left: unknown, right: unknown): boolean {
  const normalise = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items = value.map(normalise).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as object).sort()) {
        const item = normalise((value as Record<string, unknown>)[key]);
        if (item !== undefined) out[key] = item;
      }
      return Object.keys(out).length ? out : undefined;
    }
    // false is a value somebody chose; "" and null are the absence of one.
    if (value === "" || value === null) return undefined;
    return value;
  };
  return JSON.stringify(normalise(left)) === JSON.stringify(normalise(right));
}

/** A fresh editor id for a block. See `ContainerBlock.id`. */
export function newBlockId(): string {
  // crypto.randomUUID is not available on every target this renders in, and a
  // collision here only has to be unlikely within one message.
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A block's key: its id, or its position when it has none. Used for both the
 * React key and the folded set so they agree.
 */
export function blockKey(block: ContainerBlock, index: number): string {
  return block.id ?? `at-${index}`;
}

/**
 * Adds an id to every block (containers included) that lacks one. Called when
 * the editor writes, not when it reads: minting on read would change keys every
 * render. Idempotent, since it runs on every save.
 */
export function ensureBlockIds(blocks: ContainerBlock[]): ContainerBlock[] {
  return (blocks || []).map((block) => {
    const nested = Array.isArray(block.blocks)
      ? ensureBlockIds(block.blocks)
      : block.blocks;
    if (block.id && nested === block.blocks) return block;
    return { ...block, id: block.id || newBlockId(), ...(nested ? { blocks: nested } : {}) };
  });
}

/**
 * A copy of a block that Discord accepts next to the original. Deep-copied so
 * the two do not share arrays. Every stored `custom_id` is removed at any
 * depth: Discord requires unique custom ids per message, and the bot only mints
 * one for a button without one (`container_runtime._make_container_button`).
 */
export function duplicateBlock(block: ContainerBlock): ContainerBlock {
  const stripIds = (value: any): any => {
    if (Array.isArray(value)) return value.map(stripIds);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "custom_id")
          .map(([key, nested]) => [key, stripIds(nested)]),
      );
    }
    return value;
  };
  const copy = stripIds(JSON.parse(JSON.stringify(block))) as ContainerBlock;
  // A new editor id too, so React keys and the collapsed state treat the copy
  // as its own block.
  return { ...copy, id: newBlockId() };
}

/** Every block in a layout, containers opened up. For counting and validating,
 *  where nesting does not change the answer. */
export function flattenContainerBlocks(blocks: ContainerBlock[]): ContainerBlock[] {
  const out: ContainerBlock[] = [];
  for (const block of blocks || []) {
    if (block.type === "container") out.push(...flattenContainerBlocks(block.blocks || []));
    else out.push(block);
  }
  return out;
}

/**
 * Components in a message, counted as Discord counts them: every block at any
 * depth plus the containers themselves. The limit applies to the whole message.
 */
export function countContainerComponents(blocks: ContainerBlock[]): number {
  return (blocks || []).reduce(
    (sum, block) =>
      block.type === "container"
        ? sum + 1 + countContainerComponents(block.blocks || [])
        : sum + 1,
    0,
  );
}

/**
 * A one-line summary of a block for its collapsed header. Matches the bot's
 * `_comp_label` (Builders/container_schema.py) so both editors describe a
 * layout the same way.
 */
export function containerBlockSummary(block: ContainerBlock): string {
  const oneLine = (value: string | undefined, cap: number) =>
    String(value || "").replace(/\s+/g, " ").trim().slice(0, cap);
  switch (block.type) {
    case "text":
      return oneLine(block.content, 60) || "No text yet";
    case "section": {
      const text = oneLine(block.content, 46) || "No text yet";
      return block.thumbnail_url ? `${text} · thumbnail` : text;
    }
    case "text_button": {
      const text = oneLine(block.content, 40) || "No text yet";
      const label = oneLine(block.button?.label, 24);
      return label ? `${text} · “${label}”` : text;
    }
    case "separator":
      return `${block.spacing === "large" ? "Large" : "Small"} ${
        block.divider === false ? "spacer" : "divider"
      }`;
    case "media_gallery": {
      const count = (block.urls || []).filter((url) => String(url || "").trim()).length;
      return count ? `${count} image${count === 1 ? "" : "s"}` : "No images yet";
    }
    case "button_row": {
      const labels = (block.buttons || [])
        .map((button) => oneLine(button.label, 20))
        .filter(Boolean);
      if (!labels.length) return "No buttons yet";
      return labels.slice(0, 3).join(", ") + (labels.length > 3 ? "…" : "");
    }
    case "message_dropdown": {
      const count = (block.templates || []).filter((option) => option?.name).length;
      return count ? `${count} option${count === 1 ? "" : "s"}` : "No options yet";
    }
    case "system_button":
      return block.inline ? "Shares the row above" : "Live feature controls";
    case "container": {
      const count = (block.blocks || []).length;
      return count ? `${count} block${count === 1 ? "" : "s"} inside` : "Empty. Add blocks inside";
    }
    default:
      return "";
  }
}

/**
 * False when a block would render as nothing. Drives the dot in its header,
 * like `EmbedSection`.
 */
export function containerBlockFilled(block: ContainerBlock): boolean {
  switch (block.type) {
    case "text":
    case "section":
      return Boolean(String(block.content || "").trim());
    case "text_button":
      return Boolean(String(block.content || "").trim());
    case "media_gallery":
      return (block.urls || []).some((url) => String(url || "").trim());
    case "button_row":
      return (block.buttons || []).some((button) => String(button?.label || "").trim());
    case "message_dropdown":
      return (block.templates || []).some((option) => String(option?.name || "").trim());
    case "container":
      return (block.blocks || []).some((child) => containerBlockFilled(child));
    default:
      return true;
  }
}

/**
 * What is wrong with one block, if anything: the rules
 * `containerValidationError` enforces for the whole message, asked of a single
 * block so its header can show the problem while folded.
 */
export function containerBlockErrors(block: ContainerBlock): string[] {
  const errors: string[] = [];
  if (["text", "section", "text_button"].includes(block.type)) {
    const content = String(block.content || "");
    if (!content.trim()) errors.push("Needs text");
    else if (content.length > CONTAINER_LIMITS.text)
      errors.push("Over Discord’s 4,000 character limit");
  }
  if (block.type === "button_row" && !(block.buttons || []).length) {
    errors.push("Needs at least one button");
  }
  if (block.type === "media_gallery" && !(block.urls || []).length) {
    errors.push("Needs at least one image");
  }
  return errors;
}

export function containerValidationError(blocks: ContainerBlock[]): string | null {
  const list = blocks || [];

  // Recursive, so blocks inside containers are checked and named by their path.
  const walk = (nodes: ContainerBlock[], prefix: string): string | null => {
    for (const [index, block] of nodes.entries()) {
      const position = prefix ? `${prefix}, block ${index + 1}` : `Block ${index + 1}`;
      if (block.type === "container") {
        const nested = walk(block.blocks || [], `Container ${index + 1}`);
        if (nested) return nested;
        continue;
      }
      if (["text", "section", "text_button"].includes(block.type)) {
        const content = String(block.content || "");
        if (!content.trim()) return `${position} needs text before this message can be saved`;
        if (content.length > CONTAINER_LIMITS.text)
          return `${position} is over Discord’s 4,000 character limit`;
      }
    }
    return null;
  };
  const blockError = walk(list, "");
  if (blockError) return blockError;

  // Total and component limits: Discord rejects the send otherwise, naming a
  // component index the author cannot see.
  const total = containerCharacterCount(list);
  if (total > CONTAINER_LIMITS.total)
    return `This message is ${total.toLocaleString()} characters. Discord allows ${CONTAINER_LIMITS.total.toLocaleString()} across all text blocks.`;
  // Counted across the whole message: Discord's ceiling is on components, and
  // nesting one inside a container does not make it free.
  const count = countContainerComponents(list);
  if (count > CONTAINER_LIMITS.blocks)
    return `This message has ${count} blocks. Discord allows ${CONTAINER_LIMITS.blocks}.`;
  return null;
}

/**
 * Placements made in the bot's /config editor store the module button's
 * position as an integer `v2_button_after` instead of a `system_button` block.
 * When there is such a placement and no placeholder block, a placeholder is
 * shown at that position so the web editor can display and move it. Editing
 * writes it into the layout; leaving it alone keeps `v2_button_after`.
 */
export function injectLegacyModuleButton(
  blocks: ContainerBlock[],
  systemButtons: SystemComponentPreview[] | undefined,
  buttonAfter: number | string | undefined | null,
  inline = false,
): ContainerBlock[] {
  if (!systemButtons || !systemButtons.length) return blocks;
  if (blocks.some((block) => block.type === "system_button")) return blocks;
  if (buttonAfter === undefined || buttonAfter === null || buttonAfter === "") return blocks;
  const index =
    typeof buttonAfter === "number"
      ? buttonAfter
      : buttonAfter === "end"
        ? blocks.length - 1
        : Number.NaN;
  if (Number.isNaN(index)) return blocks;
  const at = Math.max(0, Math.min(blocks.length, index + 1));
  const placeholder: ContainerBlock = inline
    ? { type: "system_button", inline: true }
    : { type: "system_button" };
  return [...blocks.slice(0, at), placeholder, ...blocks.slice(at)];
}
