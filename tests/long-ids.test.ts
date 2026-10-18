import assert from "node:assert/strict";
import test from "node:test";
import { quoteLongIntegers } from "../src/utils/long-ids.ts";
import { source } from "./read-source.ts";

test("fractions and exponents are consumed as complete JSON numbers", () => {
  const raw = '{"fraction":0.1234567890123456789,"exponent":1e12345678901234567,"negative":-0.12345678901234567,"id":100000000000000001}';
  const rewritten = quoteLongIntegers(raw);
  assert.ok(rewritten.includes('0.1234567890123456789'));
  assert.ok(rewritten.includes('1e12345678901234567'));
  assert.ok(rewritten.includes('-0.12345678901234567'));
  assert.equal(JSON.parse(rewritten).id, "100000000000000001");
  const original = JSON.parse(raw);
  const parsed = JSON.parse(rewritten);
  for (const key of ["fraction", "exponent", "negative"]) assert.equal(parsed[key], original[key]);
});

/**
 * Discord ids are 17 to 19 digits. A JavaScript number holds about 16 exactly,
 * so an id parsed as a number is rounded to a different one, and saving it
 * back stores the wrong channel or the wrong member. The bot sends Assistant's
 * ids as numbers; the dashboard turns them into strings before parsing.
 */

test("long integers are read as text, everything else as it was", () => {
  const raw =
    '{"channels":[1234567890123456789,-1234567890123456789],"cooldown_seconds":30,' +
    '"at":1700000000000,"ratio":1234567890123456789.5,"note":"id 1234567890123456789, ok"}';
  const parsed = JSON.parse(quoteLongIntegers(raw));
  assert.deepEqual(parsed.channels, ["1234567890123456789", "-1234567890123456789"]);
  // Short numbers, timestamps and decimals stay numbers.
  assert.equal(parsed.cooldown_seconds, 30);
  assert.equal(parsed.at, 1700000000000);
  assert.equal(typeof parsed.ratio, "number");
  // Text is never touched, digits and escapes included.
  assert.equal(parsed.note, "id 1234567890123456789, ok");
  assert.equal(
    JSON.parse(quoteLongIntegers('{"a":"say \\"1234567890123456789\\""}')).a,
    'say "1234567890123456789"',
  );
});

test("Assistant's ids survive the trip to the page and back", async () => {
  const route = await source("src/app/api/manage/[id]/gatorai/route.ts");
  const api = await source("src/utils/manage-api.ts");
  const section = await source("src/components/Manage/sections/gator-ai.tsx");
  assert.equal(route.match(/relayBotResponse\(response, \{ idsAsText: true \}\)/g)?.length, 2);
  assert.match(api, /JSON\.parse\(idsAsText \? quoteLongIntegers\(raw\) : raw\)/);
  // The page never turns an id back into a number.
  assert.doesNotMatch(section, /Number\(person\.id\)|Number\(id\)/);
  assert.match(section, /channels: Array\.isArray\(settings\.channels\) \? settings\.channels\.map\(String\) : \[\]/);
});
