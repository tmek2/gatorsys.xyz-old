import assert from "node:assert/strict";
import test from "node:test";
import { memberMentions, mentionedMemberIds } from "../src/components/Manage/department-workspace/mention-tokens.ts";

const members = [
  { id: "ann", name: "Ann" },
  { id: "anna", name: "Anna" },
  { id: "ann-smith", name: "Ann Smith" },
  { id: "ann-marie", name: "Ann-Marie" },
];

test("whole mentions do not notify similarly named members", () => {
  assert.deepEqual(mentionedMemberIds("Ask @Anna, then @Ann Smith and @Ann-Marie.", members), ["anna", "ann-smith", "ann-marie"]);
  assert.deepEqual(mentionedMemberIds("@Annex @Ann-other @Ann.example person@Ann", members), []);
  assert.deepEqual(mentionedMemberIds("(@ANN), @Ann!", members), ["ann"]);
});

test("stable Discord mention tokens resolve their exact member ids", () => {
  assert.deepEqual(mentionedMemberIds("<@anna> and <@!ann> <@missing>", members), ["anna", "ann"]);
  assert.deepEqual(memberMentions("Hi <@anna>!", members).map(({ start, end }) => [start, end]), [[3, 10]]);
});

test("duplicate names need a picked id instead of notifying everyone", () => {
  const duplicates = [{ id: "one", name: "Alex" }, { id: "two", name: "Alex" }];
  assert.deepEqual(mentionedMemberIds("@Alex", duplicates), []);
  assert.deepEqual(mentionedMemberIds("@Alex", duplicates, ["two"]), ["two"]);
  assert.deepEqual(mentionedMemberIds("@Alexandra", duplicates, ["two"]), []);
  assert.deepEqual(mentionedMemberIds("<@one>", duplicates, ["two"]), ["one"]);
});

test("unicode names retain the original text positions", () => {
  const unicode = [{ id: "one", name: "İpek" }, { id: "two", name: "李 明" }];
  const text = "Hi @İpek and @李 明.";
  assert.deepEqual(memberMentions(text, unicode).map(({ start, end }) => text.slice(start, end)), ["@İpek", "@李 明"]);
  assert.deepEqual(mentionedMemberIds("@李 明白", unicode), []);
});

test("repeated mentions are deduplicated and delivery stays bounded", () => {
  const people = Array.from({ length: 25 }, (_, index) => ({ id: String(index), name: `Member ${index}` }));
  assert.deepEqual(mentionedMemberIds("@Ann @Ann", [...members, members[0]]), ["ann"]);
  assert.equal(mentionedMemberIds(people.map(({ name }) => `@${name}`).join(", "), people).length, 20);
});
