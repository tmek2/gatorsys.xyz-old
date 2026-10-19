import assert from "node:assert/strict";
import test from "node:test";
import { configPathValuesEqual, matchesSaved } from "../src/components/Manage/config-compare.ts";

const path = "Applications.applications";
const original = [{ id: "staff", name: "Staff", questions: [{ id: "experience", type: "text_short", question: "Experience" }] }];

test("whole application drafts retain changes to switches that default to on", () => {
  for (const patch of [{ responses_open: false }, { auto_grade: false }]) {
    assert.equal(matchesSaved([{ ...original[0], ...patch }], original, undefined, path), false);
  }
  const optionalQuestion = [{ ...original[0], questions: [{ ...original[0].questions[0], required: false }] }];
  assert.equal(matchesSaved(optionalQuestion, original, undefined, path), false);
  assert.equal(configPathValuesEqual(path, optionalQuestion, original), false, "save acknowledgements must keep a newer required flag");
});

test("returning application switches to their displayed defaults clears the draft without changing the stored data", () => {
  const before = structuredClone(original);
  const displayed = [{ ...original[0], responses_open: true, auto_grade: true, questions: [{ ...original[0].questions[0], required: true }] }];
  assert.equal(matchesSaved(displayed, original, undefined, path), true);
  assert.deepEqual(original, before);
  assert.equal(configPathValuesEqual("Other.settings", { enabled: false }, {}), true, "other settings keep their existing comparison rules");
});
