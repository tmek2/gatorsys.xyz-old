/**
 * Moving a block anywhere in the message, not just within its own list.
 *
 * A container's blocks are edited by a nested copy of the editor, but moves are
 * expressed as paths (`number[]`) into the whole tree, so a block can move
 * into, out of and between containers. (Discohook's drop callback takes `{
 * path: number[] }` too, but only ships sibling moves.)
 *
 * All pure functions over the layout. The editor holds one tree at the top and
 * every move arrives as a path, so one array is spliced however deep the row
 * is.
 */

/** The shape these functions need. `ContainerBlock` satisfies it. */
export interface TreeBlock {
  type: string;
  blocks?: TreeBlock[];
  [key: string]: any;
}

/**
 * A position in the layout as indices from the root: `[2]` is the third block;
 * `[2, 0]` is the first block inside it (only meaningful when the third block
 * is a container).
 */
export type BlockPath = number[];

/** Where a dragged block would land, relative to the row under the pointer. */
export interface DropTarget {
  path: BlockPath;
  /** `inside` appends to that container's blocks; the others place beside. */
  mode: "before" | "after" | "inside";
}

/** Discord has no container inside a container, so neither do we. */
export const MAX_NEST_DEPTH = 2;

export function pathKey(path: BlockPath): string {
  return path.join(".");
}

export function parsePath(key: string | undefined): BlockPath | null {
  if (!key) return null;
  const parts = key.split(".").filter(Boolean);
  if (!parts.length) return null;
  const path = parts.map((part) => Number(part));
  return path.some((n) => !Number.isInteger(n) || n < 0) ? null : path;
}

export function samePath(a: BlockPath | null, b: BlockPath | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/** Is `ancestor` a strict prefix of `path` — i.e. does it contain it? */
export function isAncestorPath(ancestor: BlockPath, path: BlockPath): boolean {
  if (ancestor.length >= path.length) return false;
  return ancestor.every((value, index) => value === path[index]);
}

/** The list holding the block at `path`, or undefined if the path is wrong. */
export function listAtPath<T extends TreeBlock>(
  layout: T[],
  path: BlockPath,
): T[] | undefined {
  let list: T[] = layout;
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const block = list[path[depth]];
    if (!block || !Array.isArray(block.blocks)) return undefined;
    list = block.blocks as T[];
  }
  return list;
}

export function blockAtPath<T extends TreeBlock>(
  layout: T[],
  path: BlockPath,
): T | undefined {
  if (!path.length) return undefined;
  const list = listAtPath(layout, path);
  return list ? list[path[path.length - 1]] : undefined;
}

/**
 * The layout with the block at `path` removed. Only the lists on the way down
 * are copied, so untouched blocks keep their identity and React keeps their DOM
 * (and the caret).
 */
export function removeAtPath<T extends TreeBlock>(
  layout: T[],
  path: BlockPath,
): { layout: T[]; removed: T | undefined } {
  if (!path.length) return { layout, removed: undefined };
  const [index, ...rest] = path;
  const target = layout[index];
  if (!target) return { layout, removed: undefined };
  if (!rest.length) {
    const next = [...layout];
    next.splice(index, 1);
    return { layout: next, removed: target };
  }
  const inner = removeAtPath((target.blocks || []) as T[], rest);
  if (!inner.removed) return { layout, removed: undefined };
  const next = [...layout];
  next[index] = { ...target, blocks: inner.layout };
  return { layout: next, removed: inner.removed };
}

/**
 * The layout with `block` inserted so it ends up at `path`, read against this
 * layout: a move passes the destination as it stands after the removal
 * (`resolveDropPath` and `stepPath` both do).
 */
export function insertAtPath<T extends TreeBlock>(
  layout: T[],
  path: BlockPath,
  block: T,
): T[] {
  if (!path.length) return layout;
  const [index, ...rest] = path;
  if (!rest.length) {
    const next = [...layout];
    next.splice(Math.max(0, Math.min(layout.length, index)), 0, block);
    return next;
  }
  const parent = layout[index];
  if (!parent) return layout;
  const next = [...layout];
  next[index] = {
    ...parent,
    blocks: insertAtPath((parent.blocks || []) as T[], rest, block),
  };
  return next;
}

/**
 * Where `path` points after the block at `removed` is taken out: later siblings
 * in the removed block's list shift down by one. Null if `path` is the removed
 * block or inside it.
 */
export function shiftForRemoval(
  path: BlockPath,
  removed: BlockPath,
): BlockPath | null {
  if (samePath(path, removed) || isAncestorPath(removed, path)) return null;
  const depth = removed.length - 1;
  const sharesParent =
    path.length > depth &&
    removed.slice(0, depth).every((value, index) => value === path[index]);
  const next = [...path];
  if (sharesParent && path[depth] > removed[depth]) next[depth] -= 1;
  return next;
}

/** Can this block live at this depth? */
export function canNest(block: TreeBlock, depth: number): boolean {
  if (depth <= 1) return true;
  if (depth > MAX_NEST_DEPTH) return false;
  // A container inside a container is not a thing Discord renders.
  return block.type !== "container";
}

/**
 * Turns a drop target (against the layout under the pointer) into an insertion
 * path against the layout once the dragged block is removed. Null for a no-op
 * or a disallowed drop: onto itself, into itself, or a container into a
 * container.
 */
export function resolveDropPath<T extends TreeBlock>(
  layout: T[],
  from: BlockPath,
  target: DropTarget,
): BlockPath | null {
  const moving = blockAtPath(layout, from);
  if (!moving) return null;
  const shifted = shiftForRemoval(target.path, from);
  if (!shifted) return null;

  if (target.mode === "inside") {
    const without = removeAtPath(layout, from).layout;
    const container = blockAtPath(without, shifted);
    if (!container || container.type !== "container") return null;
    const to = [...shifted, (container.blocks || []).length];
    return canNest(moving, to.length) ? to : null;
  }

  const index = shifted[shifted.length - 1] + (target.mode === "after" ? 1 : 0);
  const to = [...shifted.slice(0, -1), index];
  return canNest(moving, to.length) ? to : null;
}

/**
 * Every position a block can be inserted at, in reading order. For `[A,
 * Container(x, y), B]`: before A, between A and the container, inside before x,
 * between x and y, after y, between the container and B, after B. A container's
 * inside slots sit where they appear on screen.
 */
export function insertionSlots<T extends TreeBlock>(layout: T[]): BlockPath[] {
  const slots: BlockPath[] = [];
  const walk = (list: T[], prefix: BlockPath) => {
    list.forEach((block, index) => {
      slots.push([...prefix, index]);
      if (block.type === "container") {
        walk((block.blocks || []) as T[], [...prefix, index]);
      }
    });
    slots.push([...prefix, list.length]);
  };
  walk(layout, []);
  return slots;
}

/**
 * Where the up and down arrows move a block: the next position in reading order
 * through `insertionSlots`, so a block can move into a container past its top
 * edge, through its children and out the bottom, by keyboard or on a phone.
 * Null at either end of the message (the button is disabled).
 */
export function stepPath<T extends TreeBlock>(
  layout: T[],
  from: BlockPath,
  direction: 1 | -1,
): BlockPath | null {
  const moving = blockAtPath(layout, from);
  if (!moving) return null;
  const { layout: without, removed } = removeAtPath(layout, from);
  if (!removed) return null;

  const slots = insertionSlots(without).filter((slot) => canNest(moving, slot.length));
  // The block's own position is still a slot once it has been lifted out — it
  // is the gap it left behind — so `from` is where to start counting from.
  const at = slots.findIndex((slot) => samePath(slot, from));
  if (at === -1) return null;
  const next = slots[at + direction];
  return next ?? null;
}

/**
 * The layout with the block at `from` moved to `to`, where `to` is a path
 * against the layout after the removal (what `stepPath` and `resolveDropPath`
 * return).
 */
export function moveBlock<T extends TreeBlock>(
  layout: T[],
  from: BlockPath,
  to: BlockPath,
): T[] {
  const { layout: without, removed } = removeAtPath(layout, from);
  if (!removed) return layout;
  if (!canNest(removed, to.length)) return layout;
  return insertAtPath(without, to, removed);
}

/** Does this block have anywhere to go in that direction? */
export function canStep<T extends TreeBlock>(
  layout: T[],
  from: BlockPath,
  direction: 1 | -1,
): boolean {
  return stepPath(layout, from, direction) !== null;
}
