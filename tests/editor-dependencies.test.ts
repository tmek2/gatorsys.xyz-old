import assert from "node:assert/strict";
import test from "node:test";
import { mergeAttributes } from "@tiptap/core";

test("document attributes cannot inherit executable properties from a JSON prototype key", () => {
  const imported = JSON.parse('{"class":"document-image","__proto__":{"src":"invalid-image","onerror":"unexpected()"}}');
  const attributes = mergeAttributes({ title: "Safe image" }, imported);
  assert.equal(Object.getPrototypeOf(attributes), Object.prototype);
  assert.equal(attributes.class, "document-image");
  assert.equal(attributes.title, "Safe image");
  assert.equal(attributes.onerror, undefined);
  assert.equal(attributes.src, undefined);
  // DOM serializers enumerate attributes with for...in, including inheritance.
  const serializedKeys: string[] = [];
  for (const key in attributes) serializedKeys.push(key);
  assert.ok(!serializedKeys.includes("onerror"));
  assert.ok(!serializedKeys.includes("src"));
});
