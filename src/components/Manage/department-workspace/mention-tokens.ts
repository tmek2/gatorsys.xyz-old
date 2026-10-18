type MentionMember = { id: string; name: string };

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}_]/u;

function continuesName(text: string, index: number): boolean {
  const next = text[index] || "";
  return WORD_CHARACTER.test(next) || next === "-" ||
    (next === "." && WORD_CHARACTER.test(text[index + 1] || ""));
}

/** Shared by rendered mentions and delivery, so both identify the same person. */
export function memberMentions<T extends MentionMember>(
  text: string,
  members: T[],
  preferredIds: string[] = [],
): { start: number; end: number; member: T }[] {
  const byId = new Map(members.map((member) => [String(member.id), member]));
  const byName = new Map<string, T[]>();
  for (const member of byId.values()) {
    if (!member.name) continue;
    const name = member.name.toLowerCase();
    const matches = byName.get(name) || [];
    matches.push(member);
    byName.set(name, matches);
  }
  const names = [...byId.values()]
    .filter((member) => member.name)
    .map((member) => member.name)
    .sort((a, b) => b.length - a.length);
  const preferred = new Set(preferredIds);
  const matches: { start: number; end: number; member: T }[] = [];
  for (let at = text.indexOf("@"); at >= 0; at = text.indexOf("@", at + 1)) {
    if (text[at - 1] === "<") {
      const token = /^@!?([^<>\s]+)>/.exec(text.slice(at));
      const member = token && byId.get(token[1]);
      if (token && member) {
        matches.push({ start: at - 1, end: at + token[0].length, member });
        at += token[0].length - 1;
      }
      continue;
    }
    if (continuesName(text, at - 1) || text[at - 1] === "@") continue;
    const name = names.find((candidate) =>
      text.slice(at + 1, at + 1 + candidate.length).toLowerCase() === candidate.toLowerCase() &&
      !continuesName(text, at + 1 + candidate.length),
    );
    if (!name) continue;
    const candidates = byName.get(name.toLowerCase())!;
    // Identical display names need the id captured by the picker. Guessing
    // would send an announcement to somebody the author did not select.
    const selected = candidates.filter((candidate) => preferred.has(candidate.id));
    const member = candidates.length === 1 ? candidates[0] : selected.length === 1 ? selected[0] : null;
    if (!member) continue;
    const end = at + 1 + name.length;
    matches.push({ start: at, end, member });
    at = end - 1;
  }
  return matches;
}

export function mentionedMemberIds(
  text: string,
  members: MentionMember[],
  preferredIds: string[] = [],
): string[] {
  return [...new Set(memberMentions(text, members, preferredIds).map(({ member }) => member.id))].slice(0, 20);
}
