/**
 * Short, stable links for shared things.
 *
 * The old URLs carried every id in the path
 * (`/application/<guild>/<name-slug>`, `/docs/shared/<guild>/<uuid>`,
 * `/departments/<guild>/<dept>/doc/<uuid>`), and the application one went stale
 * on rename. A short link encodes the same ids into one opaque segment, e.g.
 * `/form/aa1p9lr8kx-~staff`.
 *
 * Encoded rather than a stored random id: it resolves in the router with no
 * database lookup on public pages, needs no migration, and survives renames.
 *
 * It is not a secret (the old URLs published the same ids). Access is decided
 * by the resource's share settings.
 */

/**
 * Base36: a snowflake is an integer, and a 19-digit id is 12 base36 characters.
 * Parts are joined with `-`, which is not a base36 digit.
 */
const PART = /^[0-9a-z]+$/;

function packNumber(value: string): string | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value).toString(36);
  } catch {
    return null;
  }
}

function unpackNumber(token: string): string | null {
  if (!PART.test(token)) return null;
  try {
    // BigInt has no base36 parser, so it accumulates a digit at a time.
    // `BigInt()` rather than `0n` literals: this file is compiled for a
    // pre-ES2020 target where the literal is a syntax error.
    const base = BigInt(36);
    let total = BigInt(0);
    for (const character of token) {
      const digit = parseInt(character, 36);
      if (Number.isNaN(digit)) return null;
      total = total * base + BigInt(digit);
    }
    return total.toString();
  } catch {
    return null;
  }
}

/**
 * A uuid written as one base36 number: 25 characters, no hyphens. Prefixed with
 * `_`, which is not a base36 digit, so it can never start a packed number.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function packUuid(value: string): string | null {
  if (!UUID.test(value)) return null;
  const base = BigInt(16);
  let total = BigInt(0);
  for (const character of value.toLowerCase().replace(/-/g, "")) {
    total = total * base + BigInt(parseInt(character, 16));
  }
  return `_${total.toString(36)}`;
}

function unpackUuid(token: string): string | null {
  const digits = token.slice(1);
  if (!PART.test(digits)) return null;
  const base = BigInt(36);
  let total = BigInt(0);
  for (const character of digits) {
    const digit = parseInt(character, 36);
    if (Number.isNaN(digit)) return null;
    total = total * base + BigInt(digit);
  }
  const hex = total.toString(16).padStart(32, "0");
  if (hex.length !== 32) return null;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Anything else (an application id like `staff`) is escaped: bytes outside
 * `[A-Za-z0-9._]` become `~` plus two hex digits (`~` itself is `~7e`). Not
 * percent-encoding: the router hands over route params already percent-decoded,
 * so an escaped hyphen would come back as a real one and split the slug. This
 * escape survives decoding, so no `-` can appear inside a token.
 */
const SAFE = /[A-Za-z0-9._]/;

function packFree(value: string): string {
  let out = "~";
  for (const byte of new TextEncoder().encode(value)) {
    const character = String.fromCharCode(byte);
    out += byte < 0x80 && SAFE.test(character)
      ? character
      : `~${byte.toString(16).padStart(2, "0")}`;
  }
  return out;
}

function unpackFree(token: string): string | null {
  const body = token.slice(1);
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "~" && /^[0-9a-f]{2}$/i.test(body.slice(index + 1, index + 3))) {
      bytes.push(parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    // A `~` that is not an escape comes from a link minted before this scheme;
    // taken as is.
    for (const byte of new TextEncoder().encode(character)) bytes.push(byte);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

function packPart(value: string): string {
  return packNumber(value) ?? packUuid(value) ?? packFree(value);
}

function unpackPart(token: string): string | null {
  if (token.startsWith("~")) return unpackFree(token);
  if (token.startsWith("_")) return unpackUuid(token);
  return unpackNumber(token);
}

/**
 * Packs ids into one slug, joined with `-`, which none of the encoded parts can
 * contain.
 */
export function encodeShortId(...parts: (string | number)[]): string {
  return parts.map((part) => packPart(String(part))).join("-");
}

function unpackAll(tokens: string[]): string[] | null {
  const parts = tokens.map(unpackPart);
  if (parts.some((part) => part === null || part === "")) return null;
  return parts as string[];
}

/**
 * Links minted before the `~` escape are still in Discord messages, and their
 * hyphens arrive literal, giving too many tokens. The groupings that give the
 * right count are tried (a `~` token absorbs the hyphens after it). Bounded: at
 * most three parts, and only after the strict split fails.
 */
function decodeLegacy(tokens: string[], expected: number): string[] | null {
  const cuts: number[][] = [];
  const walk = (start: number, remaining: number, taken: number[]) => {
    if (cuts.length > 64) return;
    if (remaining === 1) {
      cuts.push([...taken, tokens.length - start]);
      return;
    }
    for (let size = 1; size <= tokens.length - start - (remaining - 1); size += 1) {
      walk(start + size, remaining - 1, [...taken, size]);
    }
  };
  walk(0, expected, []);

  for (const sizes of cuts) {
    let cursor = 0;
    const grouped = sizes.map((size) => {
      const group = tokens.slice(cursor, cursor + size).join("-");
      cursor += size;
      return group;
    });
    // Only a `~` group can legitimately have swallowed a hyphen.
    if (grouped.some((group, index) => sizes[index] > 1 && !group.startsWith("~"))) {
      continue;
    }
    const parts = unpackAll(grouped);
    if (parts) return parts;
  }
  return null;
}

/** Unpack a slug. Returns null for anything that is not one of ours. */
export function decodeShortId(slug: string, expected: number): string[] | null {
  const tokens = String(slug || "").split("-");
  if (tokens.length === expected) return unpackAll(tokens);
  if (tokens.length > expected) return decodeLegacy(tokens, expected);
  return null;
}

/**
 * `/form/<id>`: a server application. If the bot has minted a `public_id` (a
 * numeric snowflake allocated once), that is the link, resolved with one lookup
 * through the bot's resolver endpoint. Otherwise the packed pair is used, which
 * needs no lookup. `/form/[slug]` accepts both forever (digits first, then
 * unpacking), so sent links never break.
 */
export function formLink(
  guildId: string,
  appId: string,
  publicId?: string | number | null,
): string {
  const numeric = String(publicId ?? "");
  if (/^\d+$/.test(numeric)) return `/form/${numeric}`;
  return `/form/${encodeShortId(guildId, appId)}`;
}

/**
 * Whether a `/form/<…>` segment is a minted public id: a packed pair always
 * contains `-`, so bare digits are unambiguous.
 */
export function isPublicFormId(slug: string): boolean {
  return /^\d+$/.test(String(slug || ""));
}

/** `/document/<slug>` and `/spreadsheet/<slug>` — a server resource. */
export function resourceLink(
  kind: "document" | "spreadsheet",
  guildId: string,
  resourceId: string,
): string {
  return `/${kind}/${encodeShortId(guildId, resourceId)}`;
}

export function departmentResourceLink(
  kind: "document" | "spreadsheet",
  guildId: string,
  departmentId: string,
  resourceId: string,
): string {
  return `/d/${kind}/${encodeShortId(guildId, departmentId, resourceId)}`;
}

/** Absolute form of any of the above, for copy-to-clipboard. */
export function absoluteLink(path: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "";
  return `${base}${path}`;
}
