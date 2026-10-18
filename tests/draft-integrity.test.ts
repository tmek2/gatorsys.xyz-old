import assert from "node:assert/strict";
import test from "node:test";
import { parseDraft, serializeDraft } from "../src/components/Manage/draft-storage.ts";

test("a staged field removal survives closing and restoring the browser", () => {
  const draft = { "Welcome.channel": undefined };
  const restored = parseDraft(serializeDraft(draft));
  assert.ok(Object.hasOwn(restored, "Welcome.channel"));
  assert.equal(restored["Welcome.channel"], undefined);
});

test("restoring keeps removals distinct from empty, disabled and zero values", () => {
  const draft = {
    removed: undefined,
    disabled: false,
    count: 0,
    empty: "",
    none: null,
    list: [],
    message: { content: "Welcome", embed: { title: "Rules" } },
  };
  assert.deepEqual(parseDraft(serializeDraft(draft)), draft);
});

test("drafts saved before the versioned format still load", () => {
  assert.deepEqual(parseDraft('{"Modules.Shifts":true}'), { "Modules.Shifts": true });
});

test("unexpected stored values cannot become staged array edits", () => {
  for (const stored of ["null", "[]", '"text"', "4", '{"format":"settings-draft-v1","set":null,"unset":[]}']) {
    assert.deepEqual(parseDraft(stored), {});
  }
  assert.throws(() => parseDraft("not JSON"), SyntaxError);
});
