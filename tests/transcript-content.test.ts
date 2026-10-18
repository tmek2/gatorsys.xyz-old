import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/transcript/[id]/content.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
}).outputText;
const module = { exports: {} as { renderTranscriptContent?: (text: string) => React.ReactNode[] } };
const dependencies: Record<string, unknown> = {
  react: React,
  "@skyra/discord-components-react": {
    DiscordMention: ({ children }: { children: React.ReactNode }) => React.createElement("discord-mention", null, children),
  },
};
new Function("require", "module", "exports", compiled)(
  (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  },
  module,
  module.exports,
);

function render(text: string): HTMLParagraphElement {
  const html = renderToStaticMarkup(React.createElement("p", null, module.exports.renderTranscriptContent!(text)));
  return new JSDOM(html).window.document.querySelector("p")!;
}

test("mixed Discord tokens render once in their original order", () => {
  const paragraph = render("start <:wave:123> then <@456> at <t:1700000000:R> and <a:dance:789> end");
  assert.deepEqual(Array.from(paragraph.children).map((element) => element.tagName), ["IMG", "DISCORD-MENTION", "SPAN", "IMG"]);
  assert.equal(paragraph.querySelectorAll("discord-mention").length, 1);
  assert.equal(paragraph.querySelectorAll("img").length, 2);
  assert.equal(paragraph.querySelector("img")?.getAttribute("src"), "https://cdn.discordapp.com/emojis/123.png?v=1");
  assert.equal(paragraph.querySelectorAll("img")[1].getAttribute("src"), "https://cdn.discordapp.com/emojis/789.gif?v=1");
  assert.match(paragraph.textContent!, /^start  then user at at .+ and  end$/);
  assert.doesNotMatch(paragraph.textContent!, /<:wave|<@456|<t:1700000000/);
});

test("a timestamp before a mention stays before it", () => {
  const paragraph = render("<t:1700000000> then <#123> then <@&456>");
  assert.deepEqual(Array.from(paragraph.children).map((element) => element.tagName), ["SPAN", "DISCORD-MENTION", "DISCORD-MENTION"]);
  assert.match(paragraph.textContent!, / then channel then role$/);
});

test("underscore and asterisk italics retain their text", () => {
  const paragraph = render("before _underscored_ and *starred* after");
  assert.equal(paragraph.textContent, "before underscored and starred after");
  assert.deepEqual(Array.from(paragraph.querySelectorAll("em")).map((element) => element.textContent), ["underscored", "starred"]);
});

test("formatting can contain a Discord token while inline code remains literal", () => {
  const paragraph = render("**hello <@123>** `_<@456>_` __bold__");
  assert.equal(paragraph.querySelectorAll("discord-mention").length, 1);
  assert.equal(paragraph.querySelector("strong")?.textContent, "hello user");
  assert.equal(paragraph.querySelector("code")?.textContent, "_<@456>_");
  assert.equal(paragraph.querySelector("code discord-mention"), null);
  assert.equal(paragraph.querySelectorAll("strong")[1].textContent, "bold");
});

test("HTML and unsafe link text stay escaped text", () => {
  const text = '<script>alert(1)</script> <img src=x onerror=alert(1)> [click](javascript:alert(1))';
  const paragraph = render(text);
  assert.equal(paragraph.textContent, text);
  assert.equal(paragraph.querySelector("script, img, a"), null);
});

test("malformed and out-of-range tokens remain readable", () => {
  const text = "<t:999999999999999999999999> <a:bad-name:123> unmatched _ text";
  const paragraph = render(text);
  assert.equal(paragraph.textContent, text);
  assert.equal(paragraph.children.length, 0);
});
