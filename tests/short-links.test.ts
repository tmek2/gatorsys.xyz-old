import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeShortId,
  encodeShortId,
  formLink,
  isPublicFormId,
  resourceLink,
} from "../src/utils/short-links.ts";

/**
 * The router hands a route param over already percent-decoded. Every slug in
 * here is therefore run through `decodeURIComponent` before being decoded,
 * because that is what the page actually receives — the step the old `%2D`
 * escape did not survive.
 */
const asDelivered = (slug: string) => decodeURIComponent(slug);

const GUILD = "100000000000000101";

test("round-trips a slug application id", () => {
  const slug = encodeShortId(GUILD, "staff");
  assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, "staff"]);
});

test("round-trips a uuid resource id through the router's decode", () => {
  const uuid = "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34";
  const slug = encodeShortId(GUILD, uuid);
  assert.equal(slug.includes("%"), false, "no percent-escape may survive to the router");
  assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, uuid]);
});

test("uuid packs shorter than it started", () => {
  const uuid = "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34";
  const [, packed] = encodeShortId(GUILD, uuid).split("-");
  assert.ok(packed.length <= 26, `expected a compact uuid, got ${packed.length} chars`);
});

test("round-trips uuids at both numeric extremes", () => {
  for (const uuid of [
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "00000000-0000-0000-0000-000000000001",
  ]) {
    const slug = encodeShortId(GUILD, uuid);
    assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, uuid], uuid);
  }
});

test("uppercase uuids come back canonical and still resolve", () => {
  const uuid = "A9F31C2E-4B21-4F0A-9C11-77D2EE9A1F34";
  const slug = encodeShortId(GUILD, uuid);
  assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, uuid.toLowerCase()]);
});

test("round-trips the three-part department shapes", () => {
  const uuid = "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34";
  const slug = encodeShortId(GUILD, "fhp", uuid);
  assert.deepEqual(decodeShortId(asDelivered(slug), 3), [GUILD, "fhp", uuid]);

  const both = encodeShortId(GUILD, uuid, "staff-application");
  assert.deepEqual(decodeShortId(asDelivered(both), 3), [GUILD, uuid, "staff-application"]);
});

test("round-trips ids carrying hyphens, spaces and unicode", () => {
  for (const value of [
    "staff-application",
    "senior-command-2024",
    "state trooper",
    "état-major",
    "ロブロックス",
    "a~b",
    "100%-done",
    "slash/id",
  ]) {
    const slug = encodeShortId(GUILD, value);
    assert.equal(slug.includes("%"), false, `percent leaked for ${value}`);
    assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, value], value);
  }
});

test("a numeric application id stays numeric", () => {
  const slug = encodeShortId(GUILD, "100000000000000201");
  assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, "100000000000000201"]);
});

test("links minted under the old %2D escape still resolve", () => {
  // Exactly what the previous encoder produced, as the router now delivers it.
  const uuid = "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34";
  const legacy = `${BigInt(GUILD).toString(36)}-~${uuid}`;
  assert.deepEqual(decodeShortId(legacy, 2), [GUILD, uuid]);

  const legacySlug = `${BigInt(GUILD).toString(36)}-~staff`;
  assert.deepEqual(decodeShortId(legacySlug, 2), [GUILD, "staff"]);

  const legacyDept = `${BigInt(GUILD).toString(36)}-~fhp-~${uuid}`;
  assert.deepEqual(decodeShortId(legacyDept, 3), [GUILD, "fhp", uuid]);
});

test("rejects slugs that are not ours", () => {
  assert.equal(decodeShortId("", 2), null);
  assert.equal(decodeShortId("nothyphenated", 2), null);
  assert.equal(decodeShortId("-", 2), null);
  assert.equal(decodeShortId("a-b-c", 2), null);
  assert.equal(decodeShortId("aexfcscv2wlq", 2), null);
});

test("formLink prefers a minted public id and falls back to the packed pair", () => {
  assert.equal(formLink(GUILD, "staff", "1381234567890123456"), "/form/1381234567890123456");
  assert.equal(formLink(GUILD, "staff", null), `/form/${encodeShortId(GUILD, "staff")}`);
  assert.equal(formLink(GUILD, "staff", ""), `/form/${encodeShortId(GUILD, "staff")}`);
});

test("a packed pair is never mistaken for a public id", () => {
  assert.equal(isPublicFormId("1381234567890123456"), true);
  assert.equal(isPublicFormId(encodeShortId(GUILD, "staff")), false);
  assert.equal(
    isPublicFormId(encodeShortId(GUILD, "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34")),
    false,
  );
  // Two numeric parts pack to base36, which still carries the separator.
  assert.equal(isPublicFormId(encodeShortId(GUILD, "100000000000000201")), false);
});

test("resource and department links keep their prefixes", () => {
  const uuid = "a9f31c2e-4b21-4f0a-9c11-77d2ee9a1f34";
  assert.match(resourceLink("document", GUILD, uuid), /^\/document\//);
  assert.match(resourceLink("spreadsheet", GUILD, uuid), /^\/spreadsheet\//);

  const slug = resourceLink("document", GUILD, uuid).replace("/document/", "");
  assert.deepEqual(decodeShortId(asDelivered(slug), 2), [GUILD, uuid]);
});
