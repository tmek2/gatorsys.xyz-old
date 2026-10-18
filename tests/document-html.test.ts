import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createDocumentSanitizer, sanitizeDocumentHtml } from "../src/utils/document-html.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const sanitize = createDocumentSanitizer(dom.window as any);
function parsed(html: string): HTMLElement { return new JSDOM(sanitize(html)).window.document.body; }

test("stored HTML loses executable elements, handlers, embedded pages and unsafe URL schemes", () => {
  const body = parsed(`
    <script>alert(1)</script><style>body {display:none}</style>
    <iframe srcdoc="<script>alert(2)</script>"></iframe><object data="javascript:alert(3)"></object>
    <svg onload="alert(4)"><a xlink:href="javascript:alert(5)">x</a></svg>
    <p id="app" onclick="alert(6)">Text</p>
    <img src="javascript:alert(7)" onerror="alert(8)">
    <img src="data:image/svg+xml;base64,PHN2Zz4=">
    <a href="jAva&#x09;script:alert(9)" target="_blank">bad</a>
    <a href="data:text/html,<script>alert(10)</script>">data</a>
  `);
  assert.equal(body.querySelector("script, style, iframe, object, svg"), null);
  assert.equal(body.querySelector("[onclick], [onerror], [onload], [id]"), null);
  assert.ok(Array.from(body.querySelectorAll("img")).every((image) => !image.hasAttribute("src")));
  assert.ok(Array.from(body.querySelectorAll("a")).every((link) => !link.hasAttribute("href")));
  assert.doesNotMatch(body.innerHTML, /alert\(/);
  assert.match(body.textContent || "", /Text/);
});

test("ordinary editor formatting, table sizes, links and embedded raster images survive", () => {
  const body = parsed(`
    <h2 style="text-align:center">Heading</h2>
    <p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <s>Strike</s>
      <span style="font-family: Georgia; font-size: 24px; color: #f7a8c4">Styled</span>
      <mark data-color="#ffee00" style="background-color:#ffee00">Highlight</mark></p>
    <ul><li>Bullet</li></ul><ol start="3"><li>Numbered</li></ol>
    <blockquote data-hint="true"><p>A quote</p></blockquote>
    <pre><code class="language-js">const x = 1;</code></pre>
    <table style="min-width:200px"><tbody><tr><th colspan="2" colwidth="100,100">Title</th></tr><tr><td>Cell</td></tr></tbody></table>
    <a href="https://example.com/page" target="_blank">Read</a>
    <a href="/document/example">Local</a><a href="mailto:help@example.com">Email</a>
    <img src="data:image/png;base64,aGVsbG8=" alt="Diagram" width="120">
  `);
  for (const selector of ["h2", "strong", "em", "u", "s", "mark", "ul li", "ol li", "blockquote", "pre code", "table th", "table td"]) {
    assert.ok(body.querySelector(selector), `${selector} must remain available`);
  }
  assert.equal(body.querySelector("h2")?.style.textAlign, "center");
  assert.equal(body.querySelector("span")?.style.fontSize, "24px");
  assert.equal(body.querySelector("span")?.style.fontFamily, "Georgia");
  assert.equal(body.querySelector("th")?.getAttribute("colwidth"), "100,100");
  assert.equal(body.querySelector("code")?.className, "language-js");
  assert.equal(body.querySelector("a")?.getAttribute("rel"), "noopener noreferrer");
  assert.equal(body.querySelectorAll("a")[1].getAttribute("href"), "/document/example");
  assert.match(body.querySelector("img")?.getAttribute("src") || "", /^data:image\/png;base64,/);
});

test("document CSS cannot escape its content box or load arbitrary styles", () => {
  const body = parsed('<p class="fixed inset-0" style="position:fixed;inset:0;z-index:999999;background-image:url(https://example.com/track);color:red;text-align:right">Safe</p>');
  const paragraph = body.querySelector("p")!;
  assert.equal(paragraph.hasAttribute("class"), false);
  assert.equal(paragraph.style.position, "");
  assert.equal(paragraph.style.backgroundImage, "");
  assert.equal(paragraph.style.color, "red");
  assert.equal(paragraph.style.textAlign, "right");
});

test("unavailable DOM and malformed input never return raw HTML", () => {
  assert.equal(sanitizeDocumentHtml('<img onerror="alert(1)" src=x>'), "");
  assert.equal(sanitize(null), "");
  assert.equal(sanitize({ html: "unsafe" }), "");
  assert.equal(parsed('<p><strong>Hello').textContent, "Hello");
});
