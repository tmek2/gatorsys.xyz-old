import assert from "node:assert/strict";
import test from "node:test";

import {
  blockAtPath,
  canStep,
  insertAtPath,
  insertionSlots,
  isAncestorPath,
  moveBlock,
  parsePath,
  pathKey,
  removeAtPath,
  resolveDropPath,
  samePath,
  shiftForRemoval,
  stepPath,
  type BlockPath,
  type TreeBlock,
} from "../src/components/Manage/block-tree.ts";

/**
 * Moving a block anywhere in the message.
 *
 * The whole message is one tree, and every move is a path resolved against it,
 * so a block can move into, out of and between containers. (Discohook's drop
 * callback takes a path, but its drag that would produce one is unfinished, and
 * it ships sibling-only arrows.)
 *
 * These are the index sums that go wrong quietly.
 */

/** `[A, C(x, y), B]` — the shape every interesting question is about. */
function layout(): TreeBlock[] {
  return [
    { type: "text", id: "A" },
    {
      type: "container",
      id: "C",
      blocks: [
        { type: "text", id: "x" },
        { type: "text", id: "y" },
      ],
    },
    { type: "text", id: "B" },
  ];
}

/** The ids in reading order, containers written as `C(...)`. */
function shape(blocks: TreeBlock[]): string {
  return blocks
    .map((block) =>
      block.type === "container"
        ? `${block.id}(${shape(block.blocks || [])})`
        : String(block.id),
    )
    .join(",");
}

test("the fixture reads the way it looks", () => {
  assert.equal(shape(layout()), "A,C(x,y),B");
});

// ── Paths ────────────────────────────────────────────────────────────────────

test("a path addresses a block at any depth", () => {
  assert.equal(blockAtPath(layout(), [0])?.id, "A");
  assert.equal(blockAtPath(layout(), [1])?.id, "C");
  assert.equal(blockAtPath(layout(), [1, 0])?.id, "x");
  assert.equal(blockAtPath(layout(), [1, 1])?.id, "y");
  assert.equal(blockAtPath(layout(), [2])?.id, "B");
  assert.equal(blockAtPath(layout(), [9]), undefined);
  assert.equal(blockAtPath(layout(), [0, 0]), undefined, "text has no children");
});

test("paths survive the round trip through a dataset attribute", () => {
  for (const path of [[0], [1, 0], [12, 3]]) {
    assert.deepEqual(parsePath(pathKey(path)), path);
  }
  assert.equal(parsePath(""), null);
  assert.equal(parsePath(undefined), null);
  assert.equal(parsePath("1.x"), null, "a non-numeric segment is not a path");
  assert.equal(parsePath("-1"), null);
});

test("containment is strict", () => {
  assert.ok(isAncestorPath([1], [1, 0]));
  assert.ok(!isAncestorPath([1], [1]), "a block does not contain itself");
  assert.ok(!isAncestorPath([1, 0], [1]));
  assert.ok(!isAncestorPath([0], [1, 0]));
  assert.ok(samePath([1, 0], [1, 0]));
  assert.ok(!samePath([1], [1, 0]));
  assert.ok(!samePath(null, [1]));
});

// ── Remove and insert ────────────────────────────────────────────────────────

test("removing returns the block and a layout without it", () => {
  const nested = removeAtPath(layout(), [1, 0]);
  assert.equal(nested.removed?.id, "x");
  assert.equal(shape(nested.layout), "A,C(y),B");

  const top = removeAtPath(layout(), [1]);
  assert.equal(top.removed?.id, "C");
  assert.equal(shape(top.layout), "A,B");
});

test("removing does not touch the blocks it did not remove", () => {
  const before = layout();
  const { layout: after } = removeAtPath(before, [1, 0]);
  assert.equal(shape(before), "A,C(x,y),B", "the input is left alone");
  // Identity matters: React keeps a field's DOM — and the caret in it — only
  // for blocks that are the same object across a render.
  assert.equal(after[0], before[0], "an untouched block keeps its identity");
  assert.notEqual(after[1], before[1], "the container it came out of is new");
});

test("inserting puts the block exactly where the path says", () => {
  const block: TreeBlock = { type: "text", id: "N" };
  assert.equal(shape(insertAtPath(layout(), [0], block)), "N,A,C(x,y),B");
  assert.equal(shape(insertAtPath(layout(), [3], block)), "A,C(x,y),B,N");
  assert.equal(shape(insertAtPath(layout(), [1, 0], block)), "A,C(N,x,y),B");
  assert.equal(shape(insertAtPath(layout(), [1, 2], block)), "A,C(x,y,N),B");
});

// ── The shift that every move depends on ─────────────────────────────────────

test("removing a block shifts only its later siblings", () => {
  // Take out A at [0]: C moves from [1] to [0], and x stays x's child.
  assert.deepEqual(shiftForRemoval([1], [0]), [0]);
  assert.deepEqual(shiftForRemoval([1, 0], [0]), [0, 0]);
  assert.deepEqual(shiftForRemoval([2], [0]), [1]);
  // Take out y at [1,1]: nothing at the top level moves.
  assert.deepEqual(shiftForRemoval([2], [1, 1]), [2]);
  assert.deepEqual(shiftForRemoval([1, 0], [1, 1]), [1, 0]);
  // A position after it in the same list does move.
  assert.deepEqual(shiftForRemoval([1, 2], [1, 1]), [1, 1]);
});

test("a block is nowhere once it or its container is removed", () => {
  assert.equal(shiftForRemoval([1], [1]), null);
  assert.equal(shiftForRemoval([1, 0], [1]), null, "it went with the container");
});

// ── Insertion slots, in reading order ────────────────────────────────────────

test("the slots are the gaps you can see, in the order you read them", () => {
  assert.deepEqual(insertionSlots(layout()), [
    [0], //     before A
    [1], //     between A and the container
    [1, 0], //  inside, before x
    [1, 1], //  inside, between x and y
    [1, 2], //  inside, after y
    [2], //     between the container and B
    [3], //     after B
  ]);
});

test("an empty container still offers the one slot inside it", () => {
  const slots = insertionSlots([{ type: "container", id: "C", blocks: [] }]);
  assert.deepEqual(slots, [[0], [0, 0], [1]]);
});

// ── The arrows ───────────────────────────────────────────────────────────────

test("moving down walks a block into the container below it", () => {
  const before = layout();
  const to = stepPath(before, [0], 1);
  assert.deepEqual(to, [0, 0], "past the container's top edge, not over it");
  assert.equal(shape(moveBlock(before, [0], to as BlockPath)), "C(A,x,y),B");
});

test("moving down walks it through the container's children", () => {
  const one = moveBlock(layout(), [0], stepPath(layout(), [0], 1) as BlockPath);
  assert.equal(shape(one), "C(A,x,y),B");
  const two = moveBlock(one, [0, 0], stepPath(one, [0, 0], 1) as BlockPath);
  assert.equal(shape(two), "C(x,A,y),B");
  const three = moveBlock(two, [0, 1], stepPath(two, [0, 1], 1) as BlockPath);
  assert.equal(shape(three), "C(x,y,A),B");
});

test("moving down from the last child takes the block out of the container", () => {
  // Moving down from a container's last block steps out of the container.
  const before = layout();
  const to = stepPath(before, [1, 1], 1);
  assert.deepEqual(to, [2]);
  assert.equal(shape(moveBlock(before, [1, 1], to as BlockPath)), "A,C(x),y,B");
});

test("moving up from the first child takes it out above the container", () => {
  const before = layout();
  const to = stepPath(before, [1, 0], -1);
  assert.deepEqual(to, [1]);
  assert.equal(shape(moveBlock(before, [1, 0], to as BlockPath)), "A,x,C(y),B");
});

test("a block walks from one container into the next", () => {
  const before: TreeBlock[] = [
    { type: "container", id: "C1", blocks: [{ type: "text", id: "x" }] },
    { type: "container", id: "C2", blocks: [{ type: "text", id: "z" }] },
  ];
  // Out of the first…
  const out = stepPath(before, [0, 0], 1);
  assert.deepEqual(out, [1]);
  const between = moveBlock(before, [0, 0], out as BlockPath);
  assert.equal(shape(between), "C1(),x,C2(z)");
  // …and into the second.
  const into = stepPath(between, [1], 1);
  assert.deepEqual(into, [1, 0]);
  assert.equal(shape(moveBlock(between, [1], into as BlockPath)), "C1(),C2(x,z)");
});

test("the ends of the message are the ends", () => {
  assert.equal(stepPath(layout(), [0], -1), null);
  assert.equal(stepPath(layout(), [2], 1), null);
  assert.ok(!canStep(layout(), [0], -1));
  assert.ok(!canStep(layout(), [2], 1));
  assert.ok(canStep(layout(), [0], 1));
  assert.ok(canStep(layout(), [1, 1], 1));
});

test("a container steps past another container rather than into it", () => {
  // Discord has no container inside a container, so a moving container is not
  // offered the slots inside another. Stepping down from C1 lands after C2.
  const before: TreeBlock[] = [
    { type: "container", id: "C1", blocks: [] },
    { type: "container", id: "C2", blocks: [{ type: "text", id: "z" }] },
  ];
  const to = stepPath(before, [0], 1);
  assert.deepEqual(to, [1]);
  assert.equal(shape(moveBlock(before, [0], to as BlockPath)), "C2(z),C1()");
});

test("a full round trip leaves the message exactly as it was", () => {
  // Down four times and up four times. If any one of the eight sums is off by
  // one this does not come back.
  let current = layout();
  const down: BlockPath[] = [];
  let at: BlockPath = [0];
  for (let i = 0; i < 4; i += 1) {
    const to = stepPath(current, at, 1);
    assert.ok(to, `no room to move down on step ${i}`);
    current = moveBlock(current, at, to as BlockPath);
    down.push(to as BlockPath);
    at = to as BlockPath;
  }
  assert.equal(shape(current), "C(x,y),A,B");
  for (let i = 0; i < 4; i += 1) {
    const to = stepPath(current, at, -1);
    assert.ok(to, `no room to move up on step ${i}`);
    current = moveBlock(current, at, to as BlockPath);
    at = to as BlockPath;
  }
  assert.equal(shape(current), "A,C(x,y),B", "back where it started");
});

// ── The drag ─────────────────────────────────────────────────────────────────

test("dropping beside a block in another container lands in that container", () => {
  const before = layout();
  const to = resolveDropPath(before, [0], { path: [1, 1], mode: "after" });
  assert.deepEqual(to, [0, 2], "the container shifted down when A left");
  assert.equal(shape(moveBlock(before, [0], to as BlockPath)), "C(x,y,A),B");
});

test("dropping onto a container appends to it", () => {
  const before = layout();
  const to = resolveDropPath(before, [2], { path: [1], mode: "inside" });
  assert.deepEqual(to, [1, 2]);
  assert.equal(shape(moveBlock(before, [2], to as BlockPath)), "A,C(x,y,B)");
});

test("dropping a child of a container out at the top level takes it out", () => {
  const before = layout();
  const to = resolveDropPath(before, [1, 0], { path: [0], mode: "before" });
  assert.deepEqual(to, [0]);
  assert.equal(shape(moveBlock(before, [1, 0], to as BlockPath)), "x,A,C(y),B");
});

test("the index shift is applied when the target sits after the block", () => {
  const before = layout();
  // A (index 0) dropped after B (index 2): B is at 1 once A is gone, so the
  // block lands at 2 — not 3, which would be past the end.
  const to = resolveDropPath(before, [0], { path: [2], mode: "after" });
  assert.deepEqual(to, [2]);
  assert.equal(shape(moveBlock(before, [0], to as BlockPath)), "C(x,y),B,A");
});

test("a drop that means nothing is refused rather than guessed at", () => {
  const before = layout();
  assert.equal(
    resolveDropPath(before, [1], { path: [1], mode: "inside" }),
    null,
    "a container cannot be dropped into itself",
  );
  assert.equal(
    resolveDropPath(before, [1], { path: [1, 0], mode: "after" }),
    null,
    "nor beside one of its own children",
  );
  assert.equal(
    resolveDropPath(before, [0], { path: [2], mode: "inside" }),
    null,
    "B is not a container, so there is no inside of it",
  );
});

test("a container dropped into a container is refused", () => {
  const before: TreeBlock[] = [
    { type: "container", id: "C1", blocks: [] },
    { type: "container", id: "C2", blocks: [{ type: "text", id: "z" }] },
  ];
  assert.equal(resolveDropPath(before, [0], { path: [1], mode: "inside" }), null);
  assert.equal(resolveDropPath(before, [0], { path: [1, 0], mode: "before" }), null);
  // And the move itself refuses too, so a bad path from anywhere is inert.
  assert.equal(shape(moveBlock(before, [0], [0, 0])), "C1(),C2(z)");
});

test("the module button placeholder is allowed inside a container", () => {
  // It is a property of the message rather than of a box, but where it goes is
  // a layout question and the bot walks into containers looking for it.
  const before: TreeBlock[] = [
    { type: "system_button" },
    { type: "container", id: "C", blocks: [{ type: "text", id: "x" }] },
  ];
  const to = resolveDropPath(before, [0], { path: [1], mode: "inside" });
  assert.deepEqual(to, [0, 1]);
  assert.equal(shape(moveBlock(before, [0], to as BlockPath)), "C(x,undefined)");
});
