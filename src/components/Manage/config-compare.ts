/* Whether an edit changes anything: the save prompt's question, in a
   dependency-free module so it can be tested by running it. */

/**
 * Key-order-insensitive deep equality. Empty-ish values (null, undefined, "",
 * false, empty arrays and objects) count as equal, and an object holding only
 * empties is empty, so reverting an edit by hand always clears the save prompt.
 */
export function configValuesEqual(a: any, b: any): boolean {
  const emptyish = (v: any): boolean =>
    v === null ||
    v === undefined ||
    v === "" ||
    v === false ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.values(v).every(emptyish));
  if (emptyish(a) && emptyish(b)) return true;
  if (emptyish(a) !== emptyish(b)) return false;
  if (typeof a !== typeof b) {
    // Saved snowflakes may be numbers while edits are strings.
    return String(a) === String(b);
  }
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => configValuesEqual(item, b[index]));
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!configValuesEqual(a[key], b[key])) return false;
  }
  return true;
}

const SNOWFLAKE = /^\d{15,21}$/;

function isIdList(value: unknown): value is (string | number)[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => SNOWFLAKE.test(String(item)))
  );
}

/**
 * Whether a staged value says the same as what is saved, which
 * `configValuesEqual` alone gets wrong in two cases: - A field with a default:
 * nothing saved means the field shows its default, so the default typed back in
 * is no change, and a default-on switch turned off (`false` against
 * `undefined`) is a change. - A list of roles or channels is unordered (a role
 * removed and re-added goes to the end). Ladders are ordered; the schema says
 * which fields are ladders.
 */
export function matchesSaved(
  staged: any,
  saved: any,
  /** The schema's field at this path, when it has one. */
  field?: { type?: string; defaultValue?: unknown },
): boolean {
  if ((saved === undefined || saved === null) && field?.defaultValue !== undefined) {
    const fallback = field.defaultValue;
    if (typeof fallback === "boolean") return Boolean(staged ?? fallback) === fallback;
    if (configValuesEqual(staged, fallback)) return true;
  }
  if (field?.type !== "ladder" && isIdList(staged) && isIdList(saved)) {
    const a = staged.map(String).sort();
    const b = saved.map(String).sort();
    return a.length === b.length && a.every((id, index) => id === b[index]);
  }
  return configValuesEqual(staged, saved);
}

/**
 * Brings a stored message to the editor's shape for comparison: a plain string
 * becomes `{ content }`, nothing saved becomes the module's default, and the
 * editor's own defaults (`render_mode: "legacy"`, `v2_color: "none"`, an empty
 * embed, empty component lists) count as nothing. Otherwise typing and deleting
 * a letter would leave the save prompt up.
 */
export function normalizeMessage(message: any): Record<string, any> {
  if (message === null || message === undefined) return {};
  if (typeof message === "string") return message.trim() ? { content: message } : {};
  if (typeof message !== "object" || Array.isArray(message)) return { content: message };
  const out: Record<string, any> = { ...message };
  if (out.render_mode === "legacy") delete out.render_mode;
  if (out.v2_color === "none") delete out.v2_color;
  // One embed is the same message whether it is stored singly or in a list.
  if (Array.isArray(out.embeds) && out.embeds.length <= 1) {
    if (out.embeds.length === 1 && (out.embed === undefined || configValuesEqual(out.embed, {}))) {
      out.embed = out.embeds[0];
    }
    delete out.embeds;
  }
  return out;
}

export function messagesEqual(a: any, b: any): boolean {
  return configValuesEqual(normalizeMessage(a), normalizeMessage(b));
}
