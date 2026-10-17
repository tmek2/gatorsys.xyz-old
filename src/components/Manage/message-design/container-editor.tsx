"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBox,
  IconArrowDown,
  IconArrowUp,
  IconChevronRight,
  IconFolderDown,
  IconFolderUp,
  IconGripVertical,
  IconLayoutList,
  IconMinus,
  IconPhoto,
  IconAlertTriangle,
  IconCopy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  type BlockPath,
  type DropTarget,
  canStep,
  isAncestorPath,
  moveBlock,
  parsePath,
  pathKey,
  resolveDropPath,
  samePath,
  stepPath,
} from "../block-tree";
import { foldAway } from "@/components/motion";
import { PickerPopover } from "../picker-popover";
import { AccentSwatches, accentHex } from "./accent";
import {
  BlockBodyProps,
  ButtonRowBody,
  MediaGalleryBody,
  MessageDropdownBody,
  SectionBody,
  SeparatorBody,
  SystemButtonBody,
  TextBody,
  TextButtonBody,
} from "./block-bodies";
import { useButtonTargets } from "./button-controls";
import {
  CONTAINER_LIMITS,
  ContainerBlock,
  SystemComponentPreview,
  blockKey,
  containerBlockErrors,
  containerBlockFilled,
  containerBlockSummary,
  containerCharacterCount,
  countContainerComponents,
  duplicateBlock,
  layoutHasSystemButton,
  newBlockId,
  toEditorLayout,
} from "./model";

/* The block list editor: adding, moving, folding and nesting blocks in a container message. */

/**
 * Every block kind the bot's container renderer draws. The leaf kinds match
 * `BUTTON_ANCHOR_COMPONENT_TYPES` in the bot's Builders/container_schema.py and
 * the `_render_into` branches in container_runtime.py; container is the eighth
 * and holds other blocks. Discord's File component is not offered because the
 * bot does not render it.
 */
/* ── one tree for moves across containers ──

   A container's blocks are edited by a nested `ContainerBlocksEditor` with its
   own array, but moving a block into, out of or between containers is a
   question about the whole message. So the top-level editor publishes the
   layout and one drag session here, and every nested editor addresses it by
   path. Local edits (typing, adding, deleting, duplicating) still go through
   the nested `onChange`. */
interface BlockTreeValue {
  /** The whole message's blocks, already normalised by `toEditorLayout`. */
  layout: ContainerBlock[];
  setLayout: (next: ContainerBlock[]) => void;
  /** The row being dragged, and where it would land. Null when idle. */
  from: BlockPath | null;
  target: DropTarget | null;
  /** How far the lifted row has travelled, so it can follow the pointer. */
  offset: number;
  beginDrag: (path: BlockPath, clientY: number) => void;
}

const BlockTreeContext = React.createContext<BlockTreeValue | null>(null);

/**
 * Hit-tests the pointer against every block row in the message. The deepest row
 * containing the pointer wins, and a container's children are inside it, so
 * this covers dropping into a container, out of one, and across to another.
 */
function hitTestRows(root: HTMLElement | null, from: BlockPath, clientY: number): DropTarget | null {
  if (!root) return null;
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-block-path]"));
  let deepest: { path: BlockPath; box: DOMRect; type: string } | null = null;
  const topLevel: { path: BlockPath; box: DOMRect }[] = [];
  for (const row of rows) {
    const path = parsePath(row.dataset.blockPath);
    if (!path) continue;
    // Its own row, and anything inside it, are not somewhere it can go.
    if (samePath(path, from) || isAncestorPath(from, path)) continue;
    const box = row.getBoundingClientRect();
    if (path.length === 1) topLevel.push({ path, box });
    if (clientY < box.top || clientY > box.bottom) continue;
    if (!deepest || path.length > deepest.path.length) {
      deepest = { path, box, type: row.dataset.blockType || "" };
    }
  }

  if (deepest) {
    if (deepest.type === "container") {
      // Inset, so the strip at a container's top and bottom edge means "beside
      // it"; otherwise there would be no way to drop between two containers.
      const inset = Math.min(12, deepest.box.height / 4);
      if (clientY > deepest.box.top + inset && clientY < deepest.box.bottom - inset) {
        return { path: deepest.path, mode: "inside" };
      }
    }
    const middle = deepest.box.top + deepest.box.height / 2;
    return { path: deepest.path, mode: clientY < middle ? "before" : "after" };
  }

  // In the space between rows, or past the ends: fall back to the top level,
  // which is the only list that owns the gaps outside every box.
  if (!topLevel.length) return null;
  topLevel.sort((a, b) => a.box.top - b.box.top);
  if (clientY < topLevel[0].box.top) return { path: topLevel[0].path, mode: "before" };
  const last = topLevel[topLevel.length - 1];
  if (clientY > last.box.bottom) return { path: last.path, mode: "after" };
  let nearest = topLevel[0];
  for (const row of topLevel) {
    if (row.box.top <= clientY) nearest = row;
  }
  return { path: nearest.path, mode: "after" };
}

function moveHint(
  layout: ContainerBlock[],
  from: BlockPath,
  direction: 1 | -1,
): string | undefined {
  const to = stepPath(layout, from, direction);
  if (!to) return undefined;
  if (to.length > from.length) return "Move into the container";
  if (to.length < from.length) return "Move out of the container";
  if (from.length > 1 && to[0] !== from[0]) return "Move into the next container";
  return direction === 1 ? "Move down" : "Move up";
}

export const CONTAINER_ADDERS: {
  type: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  make: () => ContainerBlock;
}[] = [
  {
    type: "text",
    label: "Text",
    hint: "A paragraph. Markdown, headings and variables all work.",
    icon: <IconLayoutList size={15} />,
    make: () => ({ id: newBlockId(), type: "text", content: "" }),
  },
  {
    type: "section",
    label: "Section + Thumbnail",
    hint: "Text with a small image pinned to its right.",
    icon: <IconBox size={15} />,
    make: () => ({ id: newBlockId(), type: "section", content: "", thumbnail_url: "" }),
  },
  {
    type: "text_button",
    label: "Text + Button",
    hint: "Text with one button beside it, rather than underneath.",
    icon: <IconBox size={15} />,
    make: () => ({ id: newBlockId(), type: "text_button", content: "", button: { type: "link", label: "", url: "" } }),
  },
  {
    type: "button_row",
    label: "Button Row",
    hint: "Up to five buttons on one line: links, tickets, forms, flows.",
    icon: <IconPlus size={15} />,
    make: () => ({ id: newBlockId(), type: "button_row", buttons: [{ type: "link", label: "", url: "" }] }),
  },
  {
    type: "media_gallery",
    label: "Media Gallery",
    hint: "Up to ten images in a grid.",
    icon: <IconPhoto size={15} />,
    make: () => ({ id: newBlockId(), type: "media_gallery", urls: [] }),
  },
  {
    type: "separator",
    label: "Separator",
    hint: "A dividing line, or blank space with no line.",
    icon: <IconMinus size={15} />,
    make: () => ({ id: newBlockId(), type: "separator", divider: true }),
  },
  {
    type: "message_dropdown",
    label: "Message Dropdown",
    hint: "A menu that sends a saved message when an option is picked.",
    icon: <IconLayoutList size={15} />,
    make: () => ({
      id: newBlockId(),
      type: "message_dropdown",
      placeholder: "Choose a message",
      templates: [],
      ephemeral: true,
    }),
  },
  {
    type: "container",
    label: "Container",
    hint: "A coloured box. Only what you put inside it is boxed.",
    icon: <IconBox size={15} />,
    make: () => ({ id: newBlockId(), type: "container", color: "none", blocks: [] }),
  },
];

/**
 * Blocks a container can hold: no nested containers (Discord has none), and the
 * module-button placeholder belongs to the message, not a box.
 */
export const NESTABLE_ADDERS = CONTAINER_ADDERS.filter((adder) => adder.type !== "container");

export const CONTAINER_ADDER_LABELS: Record<string, string> = Object.fromEntries(
  CONTAINER_ADDERS.map((adder) => [adder.type, adder.label]),
);

/**
 * The block picker: a menu with an icon, name and one-line description per
 * block, like the flow builder's.
 */
export function AddBlockMenu({
  onAdd,
  disabled,
  nested = false,
  label = "Add block",
  trigger,
}: {
  onAdd: (type: string) => void;
  disabled?: boolean;
  /** Inside a container, where a container itself is not on offer. */
  nested?: boolean;
  label?: string;
  /** The button that opens it, where the default one does not fit. */
  trigger?: React.ReactNode;
}) {
  const adders = nested ? NESTABLE_ADDERS : CONTAINER_ADDERS;
  return (
    <PickerPopover
      title={nested ? "Add a block inside" : "Add a block"}
      description={
        nested
          ? "These sit inside the container's coloured box."
          : "Blocks stack top to bottom. Add a Container for the ones you want boxed."
      }
      searchPlaceholder="Search blocks…"
      options={adders.map((adder) => ({
        value: adder.type,
        label: adder.label,
        hint: adder.hint,
        icon: adder.icon,
      }))}
      onPick={onAdd}
      trigger={
        trigger ?? (
          <button
            type="button"
            disabled={disabled}
            className="gw-btn"
          >
            <IconPlus size={13} />
            {label}
          </button>
        )
      }
    />
  );
}

function ContainerBody({
  block,
  patch,
  insertMenu,
  totalCount,
  systemButtons,
  systemButtonPlaced,
  path = [],
}: BlockBodyProps) {
  return (
    <div className="space-y-3 rounded-xl border-l-2 border-white/15 bg-white/[0.02] py-2 pl-3 pr-2">
      <p className="cool-text text-[11px] leading-relaxed">
        Everything below is drawn inside this container’s coloured box. Blocks
        outside it stay outside. Plain text, buttons and separators sit on their
        own.
      </p>
      <AccentSwatches
        value={block.color || "none"}
        onChange={(next) => patch({ color: next })}
      />

      {/* Recursive: a container holds other blocks. It is given the whole
         message's count, so spreading blocks across containers cannot pass the
         limit. */}
      <ContainerBlocksEditor
        nested
        // Already inside a container, so there is nothing left to wrap:
        // toEditorLayout only ever considers the top level.
        explicitLayout
        totalCount={totalCount}
        // Lets the module button be placed in here. Whether it is already
        // placed is asked of the whole message, so the answer comes from above.
        systemButtons={systemButtons}
        systemButtonPlaced={systemButtonPlaced}
        blocks={block.blocks || []}
        insertMenu={insertMenu}
        // Where this list begins in the message, so a row inside it can name a
        // destination outside it — the next container, or the top level.
        path={path}
        onChange={(next) => patch({ blocks: next })}
      />
    </div>
  );
}

/** Types that have been moved out of the chain. */
export const BLOCK_BODY_EDITORS: Record<
  string,
  (props: BlockBodyProps) => React.ReactElement
> = {
  separator: SeparatorBody,
  section: SectionBody,
  text: TextBody,
  text_button: TextButtonBody,
  media_gallery: MediaGalleryBody,
  button_row: ButtonRowBody,
  system_button: SystemButtonBody,
  container: ContainerBody,
  message_dropdown: MessageDropdownBody,
};

export function ContainerBlocksEditor({
  blocks: storedBlocks,
  onChange,
  insertMenu,
  systemButtons,
  nested = false,
  totalCount,
  explicitLayout,
  systemButtonPlaced,
  path = [],
}: {
  blocks: ContainerBlock[];
  onChange: (next: ContainerBlock[]) => void;
  /** Mirrors the message's `v2_explicit_layout`. See toEditorLayout.
   *  Required for the reason given on `ContainerPreview`. */
  explicitLayout: boolean;
  insertMenu?: React.ReactNode;
  /**
   * When set, this module has its own action buttons (a giveaway's "Enter", a
   * ticket's "Close" and "Claim"), shown as a draggable placeholder to position
   * within the layout.
   */
  systemButtons?: SystemComponentPreview[];
  /**
   * Set for the blocks inside a container. Hides the once-per-message controls:
   * the container adder, the module-button placeholder and the message-wide
   * budgets.
   */
  nested?: boolean;
  /** Whether the module button is placed anywhere in the message. Undefined in
   *  the top-level editor, which works it out and passes it down. */
  systemButtonPlaced?: boolean;
  /**
   * Where this list sits in the message: `[]` at the top, `[2]` for the blocks
   * of the third block. Moves are addressed from the root, so a nested row can
   * name a destination outside its own list.
   */
  path?: BlockPath;
  /**
   * Components in the whole message, so a nested editor enforces the message's
   * limit, not just its own container's.
   */
  totalCount?: number;
}) {
  // Normalised at the boundary, so everything below works on a layout with
  // explicit containers and "add a block" appends beside a container rather
  // than inside it. The stored value only changes when `onChange` fires.
  // Memoised because this array identifies the published drag session; a new
  // one every render would republish the context on every keystroke.
  const blocks = useMemo(
    () => (nested ? storedBlocks : toEditorLayout(storedBlocks, explicitLayout)),
    [nested, storedBlocks, explicitLayout],
  );
  /* Blocks added after the editor opened unroll into place; the ones it
     opened with are simply there. */
  const knownBlocks = React.useRef<Set<string> | null>(null);
  const arrivedBlocks = React.useRef(new Set<string>());
  {
    const keysNow = blocks.map((block, index) => blockKey(block, index));
    if (knownBlocks.current) {
      for (const key of keysNow) if (!knownBlocks.current.has(key)) arrivedBlocks.current.add(key);
    }
    knownBlocks.current = new Set(keysNow);
  }
  const systemLabel = (systemButtons || []).map((button) => button.label).filter(Boolean).join(" + ");
  const targets = useButtonTargets();
  // The whole message, not this list: a nested editor that asked its own blocks
  // would offer to place a second button inside every container.
  const hasSystemButton = systemButtonPlaced ?? layoutHasSystemButton(blocks);
  const total = containerCharacterCount(blocks);
  // The top-level editor is the one that knows the whole message; a nested one
  // is told.
  const componentCount = totalCount ?? countContainerComponents(blocks);

  /* Folded state, keyed by block id so moves, duplicates and deletes keep it
     without remapping. A layout saved before ids existed keys by position until
     its first edit mints ids (see ensureBlockIds), so one fold may be lost
     once. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* Pointer drag over the whole message. The dragged block follows the cursor.
     The session lives at the top level and hit-tests every row in the message,
     because a drop can land beside a block, inside a container, or outside the
     container it came from; each is a path, carried out by one splice at the
     root. */
  const parentTree = React.useContext(BlockTreeContext);
  const [dragFrom, setDragFrom] = useState<BlockPath | null>(null);
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragFromRef = useRef<BlockPath | null>(null);
  const dragTargetRef = useRef<DropTarget | null>(null);
  const blocksRef = useRef(blocks);
  const onChangeRef = useRef(onChange);
  const listRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  dragFromRef.current = dragFrom;
  dragTargetRef.current = dragTarget;
  blocksRef.current = blocks;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (dragFrom === null) return;
    const move = (event: PointerEvent) => {
      setDragOffset(event.clientY - dragStartYRef.current);
      const from = dragFromRef.current;
      if (!from) return;
      setDragTarget(hitTestRows(listRef.current, from, event.clientY));
    };
    const commit = () => {
      const from = dragFromRef.current;
      const target = dragTargetRef.current;
      if (from && target) {
        const to = resolveDropPath(blocksRef.current, from, target);
        if (to) onChangeRef.current(moveBlock(blocksRef.current, from, to));
      }
      setDragFrom(null);
      setDragTarget(null);
      setDragOffset(0);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", commit);
    document.addEventListener("pointercancel", commit);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", commit);
      document.removeEventListener("pointercancel", commit);
    };
  }, [dragFrom]);

  const beginOwnDrag = useCallback((at: BlockPath, clientY: number) => {
    dragStartYRef.current = clientY;
    setDragFrom(at);
    setDragTarget(null);
    setDragOffset(0);
  }, []);

  /* The tree this editor addresses. The top-level editor owns it; nested
     editors inherit the same object, so every row reports paths against the
     same layout. */
  const ownTree = useMemo<BlockTreeValue>(
    () => ({
      layout: blocks,
      setLayout: onChange,
      from: dragFrom,
      target: dragTarget,
      offset: dragOffset,
      beginDrag: beginOwnDrag,
    }),
    [blocks, onChange, dragFrom, dragTarget, dragOffset, beginOwnDrag],
  );
  const tree = nested && parentTree ? parentTree : ownTree;
  /** This row's address in the whole message. */
  const pathOf = useCallback((index: number) => [...path, index], [path]);

  function update(index: number, patch: Partial<ContainerBlock>) {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  /** Move a block by one position in reading order, container walls included. */
  function step(index: number, direction: 1 | -1) {
    const from = pathOf(index);
    const to = stepPath(tree.layout, from, direction);
    if (to) tree.setLayout(moveBlock(tree.layout, from, to));
  }

  const body = (
    // The drag hit test queries every `data-block-path` under this element; at
    // the top level that is the whole message.
    <div className="space-y-3" ref={listRef}>
      <div className="flex flex-wrap items-center gap-2">
        <AddBlockMenu
          nested={nested}
          label={nested ? "Add inside" : "Add block"}
          disabled={componentCount >= CONTAINER_LIMITS.blocks}
          onAdd={(type) => {
            const adder = CONTAINER_ADDERS.find((entry) => entry.type === type);
            if (adder) onChange([...blocks, adder.make()]);
          }}
        />
        {systemButtons && systemButtons.length && !hasSystemButton ? (
          <button
            type="button"
            onClick={() => onChange([...blocks, { type: "system_button" }])}
            className="gw-btn" data-kind="accent"
          >
            <IconPlus size={13} />
            Place {systemButtons.length > 1 ? `${systemLabel} buttons` : `“${systemLabel || "feature button"}” button`}
          </button>
        ) : null}
        {/* Fold or unfold every block at once. */}
        {blocks.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              setCollapsed((current) =>
                current.size >= blocks.length
                  ? new Set()
                  : new Set(blocks.map(blockKey)),
              )
            }
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-white/45 transition-colors hover:text-white/80"
          >
            {collapsed.size >= blocks.length ? (
              <IconFolderUp size={16} />
            ) : (
              <IconFolderDown size={13} />
            )}
            {collapsed.size >= blocks.length ? "Expand all" : "Collapse all"}
          </button>
        ) : null}
        {/* Component and character budgets, using the embed editor's thresholds:
           quiet, then amber, then red. */}
        <span className="ml-auto flex items-center gap-3">
          {nested ? null : componentCount > CONTAINER_LIMITS.blocks * 0.6 ? (
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                componentCount > CONTAINER_LIMITS.blocks ? "text-[var(--tone-bad)]" : "text-white/40"
              }`}
            >
              {componentCount}/{CONTAINER_LIMITS.blocks} blocks
            </span>
          ) : null}
          {nested ? null : total > CONTAINER_LIMITS.total * 0.6 ? (
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                total > CONTAINER_LIMITS.total
                  ? "text-[var(--tone-bad)]"
                  : total > CONTAINER_LIMITS.total * 0.9
                    ? "text-[var(--tone-warn)]"
                    : "text-white/40"
              }`}
            >
              {total}/{CONTAINER_LIMITS.total} characters
            </span>
          ) : null}
        </span>
      </div>
      {systemButtons && systemButtons.length && !hasSystemButton ? (
        <p className="cool-text rounded-xl border border-[var(--accent-peach)]/25 bg-[rgb(var(--accent-rgb)/0.06)] px-3 py-2 text-[11px] leading-relaxed">
          This message has {systemButtons.length > 1 ? "built-in " : "a built-in "}
          <span className="font-semibold text-[var(--accent-peach)]">{systemLabel || "feature"}</span>{" "}
          button{systemButtons.length > 1 ? "s" : ""}. Add the placeholder above and drag it where you
          want {systemButtons.length > 1 ? "them" : "it"} to appear. Otherwise
          {systemButtons.length > 1 ? " they’re" : " it’s"} added at the bottom automatically.
        </p>
      ) : null}
      {blocks.map((block, index) => {
        const here = pathOf(index);
        const isDragging = samePath(tree.from, here);
        // The drop line is drawn by the row the target names, which may be in a
        // different list from where the drag started.
        const aimedHere = tree.from !== null && samePath(tree.target?.path ?? null, here);
        const showLineBefore = aimedHere && tree.target?.mode === "before";
        const showLineAfter = aimedHere && tree.target?.mode === "after";
        const dropInside = aimedHere && tree.target?.mode === "inside";
        // Position among blocks of the same kind, 1-based; null when this is
        // the only one of its kind.
        const sameKind = blocks.filter((other) => other.type === block.type);
        const typeOrdinal =
          sameKind.length > 1 ? sameKind.indexOf(block) + 1 : null;
        const blockErrors = containerBlockErrors(block);
        return (
        <div
          // Keyed by identity so React keeps a block's DOM (and the caret) when
          // the list is reordered. Blocks without ids key by position.
          key={blockKey(block, index)}
          // The row's address in the whole message, read by the hit test across
          // all lists.
          data-block-path={pathKey(here)}
          // Read during a drag: a container is the one row a block can be
          // dropped into.
          data-block-type={block.type}
          data-arrived={arrivedBlocks.current.has(blockKey(block, index)) ? "true" : undefined}
          className={`editor-block select-none p-3 ${
            dropInside
              ? // Highlights the container the block will land in.
                "border-[var(--accent-peach)] bg-[rgb(var(--accent-rgb)/0.08)] ring-2 ring-[var(--accent-peach)]/40 "
              : ""
          }${
            isDragging
              ? // The lifted row follows the pointer above its neighbours, with
              // pointer events off so drops are measured against the row
              // underneath.
                "pointer-events-none relative z-20 border-[var(--accent-peach)]/60 opacity-95 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
              : "border-white/[0.08] transition-transform duration-150"
          }${
            // A container's row shows its accent down the left edge, as in the
            // preview, so folded containers are told apart by colour.
            block.type === "container" && accentHex(block.color) ? " relative" : ""
          }`}
          style={
            isDragging
              ? { transform: `translateY(${tree.offset}px) scale(1.01)` }
              : undefined
          }
        >
          {block.type === "container" && accentHex(block.color) ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-lg"
              style={{ background: accentHex(block.color) as string }}
            />
          ) : null}
          {showLineBefore ? (
            <div className="mb-2 h-0.5 rounded-full bg-[var(--accent-peach)]" />
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                // Pointer capture keeps the gesture alive as the row moves out
                // from under the small handle.
                event.currentTarget.setPointerCapture?.(event.pointerId);
                tree.beginDrag(here, event.clientY);
              }}
              className="shrink-0 cursor-grab touch-none text-white/25 hover:text-white/60 active:cursor-grabbing"
              aria-label="Drag block to reorder"
            >
              <IconGripVertical size={16} />
            </button>
            {/* The whole left side of the header toggles folding, not just the
               chevron. */}
            <button
              type="button"
              onClick={() => toggleCollapsed(blockKey(block, index))}
              aria-expanded={!collapsed.has(blockKey(block, index))}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-1 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gator-accent)]"
            >
              <IconChevronRight
                size={14}
                className={`shrink-0 text-white/30 transition-transform duration-200 ${
                  collapsed.has(blockKey(block, index)) ? "" : "rotate-90"
                }`}
              />
              <span className="gw-md-block-type shrink-0">
                {block.type === "system_button"
                  ? "Feature button"
                  : CONTAINER_ADDER_LABELS[block.type] || block.type.replace(/_/g, " ")}
                {/* Numbered within its kind ("Text 2"), which stays stable when
                   unrelated blocks move. Hidden when there is only one of a
                   kind. */}
                {typeOrdinal ? (
                  <span className="ml-1 text-white/35">{typeOrdinal}</span>
                ) : null}
              </span>
              {/* Errors show on the header, so a broken block can be found while
                 folded. */}
              {blockErrors.length ? (
                <IconAlertTriangle
                  size={13}
                  className="shrink-0 text-[var(--tone-warn)]"
                  aria-label={blockErrors.join(". ")}
                />
              ) : null}
              {/* What is in it, so a folded stack is still readable. */}
              <span className="cool-text min-w-0 flex-1 truncate text-[12px]">
                {containerBlockSummary(block)}
              </span>
              {/* Shown only when the block is empty (it would render as
                 nothing). */}
              {containerBlockFilled(block) ? null : (
                <span
                  className="gw-md-block-empty"
                  title="This block renders as nothing until it has content"
                >
                  Empty
                </span>
              )}
            </button>
            {/* Duplicate, move and delete. The arrows step through the message
               in reading order, not just among siblings, so a block can move
               into a container past its top edge, through its children and out
               the bottom. They also make reordering possible by keyboard and on
               touch; drag remains. */}
            <div className="gator-row-actions flex shrink-0 items-center">
              <button
                type="button"
                disabled={!canStep(tree.layout, here, -1)}
                onClick={() => step(index, -1)}
                className="gator-row-action"
                aria-label="Move block up"
                title={moveHint(tree.layout, here, -1)}
              >
                <IconArrowUp size={16} />
              </button>
              <button
                type="button"
                disabled={!canStep(tree.layout, here, 1)}
                onClick={() => step(index, 1)}
                className="gator-row-action"
                aria-label="Move block down"
                title={moveHint(tree.layout, here, 1)}
              >
                <IconArrowDown size={16} />
              </button>
              <button
                type="button"
                // Duplicating a container costs all of its children, so the
                // count is checked properly. The module-button placeholder
                // cannot be duplicated: there is one module button, and the bot
                // uses only the last placeholder it finds.
                disabled={
                  block.type === "system_button" ||
                  componentCount + countContainerComponents([block]) >
                    CONTAINER_LIMITS.blocks
                }
                onClick={() => {
                  const copy = duplicateBlock(block);
                  onChange([
                    ...blocks.slice(0, index + 1),
                    copy,
                    ...blocks.slice(index + 1),
                  ]);
                }}
                className="gator-row-action"
                aria-label="Duplicate block"
                title={
                  block.type === "system_button"
                    ? "There is one module button, so there is one place for it."
                    : componentCount + countContainerComponents([block]) >
                        CONTAINER_LIMITS.blocks
                      ? `Duplicating this would take the message past Discord's ${CONTAINER_LIMITS.blocks}-component limit`
                      : undefined
                }
              >
                <IconCopy size={16} />
              </button>
              {/* Unwrap: removes the container and keeps its blocks in place. A
                 layout saved before containers were blocks shows an implicit
                 container around everything, and removing it should not delete
                 the message. The next save marks the layout explicit, so the
                 blocks stay out. */}
              {block.type === "container" ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...blocks];
                    next.splice(index, 1, ...(block.blocks || []));
                    onChange(next);
                  }}
                  className="gator-row-action"
                  aria-label="Remove the container but keep its blocks"
                  title="Take the box off, keep its blocks"
                >
                  <IconFolderUp size={16} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  // Folded away where it stands, then gone -- not snapped out
                  // of the stack in one frame.
                  foldAway(event.currentTarget.closest("[data-block-path]"), () =>
                    onChange(blocks.filter((_, i) => i !== index)),
                  );
                }}
                className="gator-row-action gator-row-action-danger"
                aria-label={
                  block.type === "container"
                    ? "Remove the container and everything in it"
                    : "Remove block"
                }
              >
                <IconTrash size={16} />
              </button>
            </div>
          </div>
          {/* Animated with grid-rows rather than max-height, so tall blocks are
             not cut off. Same as `EmbedSection`. */}
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
              collapsed.has(blockKey(block, index))
                ? "mt-0 grid-rows-[0fr] opacity-0"
                : "mt-2 grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden">
              {/* Every type renders from the registry. An unknown type (saved by
                 a newer build) shows its row with no fields instead of breaking
                 the editor. */}
              {(() => {
                const Body = BLOCK_BODY_EDITORS[block.type];
                return Body ? (
                  <Body
                    block={block}
                    patch={(next) => update(index, next)}
                    insertMenu={insertMenu}
                    targets={targets}
                    systemButtons={systemButtons}
                    // The whole message's answer, so a container body offers
                    // the placeholder only when it is not already somewhere.
                    systemButtonPlaced={hasSystemButton}
                    totalCount={componentCount}
                    previousType={blocks[index - 1]?.type}
                    path={here}
                  />
                ) : null;
              })()}
            </div>
          </div>
          {showLineAfter ? (
            <div className="mt-2 h-0.5 rounded-full bg-[var(--accent-peach)]" />
          ) : null}
        </div>
        );
      })}
      {blocks.length === 0 ? (
        <p className="cool-text rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center text-[12px]">
          Nothing in this message yet. Add a block and it appears in the preview.
        </p>
      ) : null}
    </div>
  );

  // The top-level editor holds the message and publishes it; a nested editor
  // renders inside that provider and reads the same value.
  return nested && parentTree ? (
    body
  ) : (
    <BlockTreeContext.Provider value={ownTree}>{body}</BlockTreeContext.Provider>
  );
}
