import assert from "node:assert/strict";
import test from "node:test";
import { resourceDraftFingerprint, mergeSavedResource } from "../src/components/Manage/resource-save.ts";

test("save timestamps and field order do not make a resource dirty", () => {
  const draft = { id: "notes", title: "Notes", document_html: "<p>Text</p>", updated_at: "earlier" };
  assert.equal(resourceDraftFingerprint(draft), resourceDraftFingerprint({ updated_at: "later", document_html: draft.document_html, title: "Notes", id: "notes", saved_by: "editor" }));
  assert.notEqual(resourceDraftFingerprint(draft), resourceDraftFingerprint({ ...draft, document_html: "<p>New text</p>" }));
  assert.notEqual(resourceDraftFingerprint(draft), resourceDraftFingerprint({ ...draft, share: { access: "restricted" } }));
});

test("an acknowledgement keeps newer document and sheet fields while accepting save metadata", () => {
  const submitted = { id: "notes", title: "First title", document_html: "<p>First text</p>", spreadsheet_data: [["First cell"]], updated_at: "initial" };
  const current = { ...submitted, title: "Newer title", document_html: "<p>Newer text</p>", spreadsheet_data: [["Newer cell"]] };
  const merged = mergeSavedResource(current, submitted, { ...submitted, updated_at: "saved", saved_by: "editor" })!;
  assert.equal(merged.title, "Newer title");
  assert.equal(merged.document_html, "<p>Newer text</p>");
  assert.deepEqual(merged.spreadsheet_data, [["Newer cell"]]);
  assert.equal(merged.updated_at, "saved");
  assert.equal((merged as any).saved_by, "editor");
  assert.equal(mergeSavedResource({ ...current, id: "other" }, submitted, submitted)?.id, "other");
  assert.equal(mergeSavedResource(null, submitted, submitted), null);
});
