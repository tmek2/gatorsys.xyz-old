import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  boundedPosition,
  moveItem,
} from "../src/components/site/mac/drag-geometry.ts";
import {
  readPinned,
  togglePinned,
} from "../src/components/servers/pinned-communities.ts";

test("a corner grab keeps the whole dragged card inside each edge", () => {
  for (const grab of [0, 12, 180, 239]) {
    for (const pointer of [-1000, 10, 200, 500, 10000]) {
      const left = boundedPosition(pointer, grab, 240, 24, 800);
      assert.ok(left >= 24);
      assert.ok(left + 240 <= 800);
    }
  }
  assert.equal(boundedPosition(380, 20, 240, 24, 800), 360);
});
test("drag bounds have a stable origin when a pane shrinks below the card size", () => {
  assert.equal(boundedPosition(500, 0, 240, 24, 200), 24);
  assert.equal(boundedPosition(-500, 240, 240, 24, 200), 24);
});
test("rearranging preserves identity and leaves the cancellation snapshot untouched", () => {
  const original = ["sessions", "shifts", "tickets", "forms"];
  const next = moveItem(original, 0, 2);
  assert.deepEqual(next, ["shifts", "tickets", "sessions", "forms"]);
  assert.deepEqual(original, ["sessions", "shifts", "tickets", "forms"]);
  assert.deepEqual(moveItem(next, 2, 0), original);
  assert.equal(moveItem(original, 0, -1), original);
  assert.equal(moveItem(original, 3, 4), original);
});
test("pins recover from missing, corrupt and unexpected browser storage", () => {
  for (const value of [null, "broken", "null", "{}", '"101"'])
    assert.deepEqual(readPinned(value), []);
  assert.deepEqual(readPinned('["101","101",101,null,"not-a-server","102"]'), [
    "101",
    "102",
  ]);
  assert.equal(
    readPinned(JSON.stringify(Array.from({ length: 100 }, (_, i) => String(i))))
      .length,
    50,
  );
});
test("pinning and unpinning survives a storage round trip without duplicates", () => {
  const original = ["101"];
  const added = togglePinned(original, "102");
  assert.deepEqual(original, ["101"]);
  assert.deepEqual(readPinned(JSON.stringify(added)), ["101", "102"]);
  assert.deepEqual(togglePinned(added, "101"), ["102"]);
});

test("community identity survives the page wrapper remount on navigation", () => {
  const layout = readFileSync(
    new URL("../src/app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    layout.indexOf("<CommunityNavigation>") <
      layout.indexOf("<ProgressBarProvider>"),
  );
  assert.ok(
    layout.indexOf("</CommunityNavigation>") >
      layout.indexOf("</ProgressBarProvider>"),
  );
});
