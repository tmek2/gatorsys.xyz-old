import createDOMPurify, { type WindowLike } from "dompurify";

const TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "code", "pre",
  "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "hr",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  "span", "div", "mark", "sub", "sup", "a", "img",
];
const ATTRIBUTES = [
  "style", "href", "target", "rel", "title", "src", "alt", "width", "height",
  "colspan", "rowspan", "colwidth", "start", "class", "data-color", "data-hint",
];
const STYLE_VALUES: Record<string, RegExp> = {
  color: /^(?:#[a-f\d]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i,
  "background-color": /^(?:#[a-f\d]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i,
  "font-family": /^[a-z\d\s,'".-]+$/i,
  "font-size": /^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%)$/i,
  "font-weight": /^(?:normal|bold|[1-9]00)$/i,
  "font-style": /^(?:normal|italic|oblique)$/i,
  "text-align": /^(?:left|right|center|justify|start|end)$/i,
  "text-decoration": /^(?:none|underline|line-through|overline)(?:\s+(?:underline|line-through|overline))*$/i,
  "text-decoration-line": /^(?:none|underline|line-through|overline)(?:\s+(?:underline|line-through|overline))*$/i,
  "white-space": /^(?:normal|pre|pre-wrap|pre-line)$/i,
  "line-height": /^(?:normal|[0-3](?:\.\d+)?)$/i,
  width: /^\d{1,4}(?:\.\d+)?(?:px|%)$/i,
  "min-width": /^\d{1,4}(?:\.\d+)?(?:px|%)$/i,
  height: /^\d{1,4}(?:\.\d+)?(?:px|%)$/i,
};

function allowedUrl(value: string, image: boolean): boolean {
  if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z\d+/=\s]+$/i.test(value)) return true;
  try {
    const url = new URL(value, "https://document.invalid/");
    return ["https:", "http:", ...(!image ? ["mailto:", "tel:"] : [])].includes(url.protocol);
  } catch {
    return false;
  }
}

/** One policy for stored documents, editor imports, previews and downloads. */
export function createDocumentSanitizer(browserWindow: WindowLike) {
  const purifier = createDOMPurify(browserWindow);
  const document = browserWindow.document!;
  purifier.addHook("uponSanitizeAttribute", (node, attribute) => {
    if (attribute.attrName === "style") {
      const parsed = document.createElement("span").style;
      parsed.cssText = attribute.attrValue;
      const kept: string[] = [];
      for (const name of Array.from(parsed)) {
        const value = parsed.getPropertyValue(name).trim();
        if (STYLE_VALUES[name]?.test(value)) kept.push(`${name}: ${value}`);
      }
      attribute.attrValue = kept.join("; ");
      attribute.keepAttr = kept.length > 0;
    } else if (attribute.attrName === "href" || attribute.attrName === "src") {
      attribute.keepAttr = allowedUrl(attribute.attrValue, attribute.attrName === "src");
    } else if (attribute.attrName === "class") {
      attribute.keepAttr = node.tagName === "CODE" && /^language-[a-z\d_+-]+$/i.test(attribute.attrValue);
    } else if (attribute.attrName === "target") {
      attribute.keepAttr = ["_blank", "_self"].includes(attribute.attrValue);
    }
  });
  purifier.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && (node as Element).getAttribute("target") === "_blank") {
      (node as Element).setAttribute("rel", "noopener noreferrer");
    }
  });
  return (html: unknown): string => purifier.sanitize(typeof html === "string" ? html : "", {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

let sanitize: ReturnType<typeof createDocumentSanitizer> | undefined;

export function sanitizeDocumentHtml(html: unknown): string {
  // Document data arrives after hydration. Never return unsanitized HTML during
  // a server render, where there is no DOM for the browser sanitizer to use.
  if (typeof window === "undefined") return "";
  sanitize ??= createDocumentSanitizer(window);
  return sanitize(html);
}
