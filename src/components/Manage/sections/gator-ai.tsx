"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAlertTriangle, IconRefresh, IconSearch } from "@tabler/icons-react";
import { PresenceList } from "@/components/motion";
import { AppLogo } from "@/components/site/app-logo";
import { ChannelPicker, FieldRow, OptionCard, OptionCards, SettingsCard, Stepper } from "../fields";
import { configValuesEqual, useManage } from "../manage-context";
import { SectionHeader } from "../section-header";
import { Segments } from "../segments";
import { ModuleGate, PluginToggleButton } from "../module-gate";

type Personality = "friendly" | "balanced" | "unfiltered";
type Age = "online" | "everyday" | "formal";
type Filter = "strict" | "standard" | "relaxed";

/* Channel and member ids are strings here. They are Discord ids, longer than
   a JavaScript number holds exactly; the API route hands them over as text
   and the bot takes them back as text. */
export interface AiSettings {
  enabled: boolean;
  personality: Personality;
  age: Age;
  filter: Filter;
  respond_to_replies: boolean;
  allow_ask_command: boolean;
  image_generation: boolean;
  channels: string[];
  web_search: boolean;
  cooldown_seconds: number;
  escalate_after_turns: number;
  escalation_summary: boolean;
  known_issue: string;
  /** Members who may not use the AI here. Ids, because a name is not an
   *  identity and somebody who changes theirs must stay blocked. */
  blocked_users: { user_id: string; by?: string | null; at?: string; reason?: string }[];
}

/** A blocked member with the names the API resolved, for display only. */
export interface BlockedMember {
  user_id: string;
  name: string;
  avatar?: string | null;
  by?: string | null;
  by_name?: string | null;
  at?: string;
  reason?: string;
}

/** Below this it stops being a conversation and starts being a flood. */
export const MIN_COOLDOWN_SECONDS = 30;

const PERSONALITIES: { id: Personality; label: string; blurb: string }[] = [
  { id: "friendly", label: "Friendly", blurb: "Warm and patient. Stays pleasant even when provoked." },
  { id: "balanced", label: "Balanced", blurb: "Direct and honest. Won't agree with you just to be agreeable." },
  { id: "unfiltered", label: "Unfiltered", blurb: "Blunt and funny. Matches energy and will clap back." },
];

/**
 * How old the bot sounds. The tiers describe register (vocabulary and
 * formality), not trends or an actual language.
 */
const AGES: { id: Age; label: string; blurb: string }[] = [
  { id: "online", label: "Very online", blurb: "Slang, shorthand, lowercase. Writes like the server does." },
  { id: "everyday", label: "Everyday", blurb: "Plain, normal English. How most people type." },
  { id: "formal", label: "Old-fashioned", blurb: "Formal and spelled out. No slang at all." },
];

const FILTERS: { id: Filter; label: string; blurb: string }[] = [
  { id: "strict", label: "Strict", blurb: "Family friendly. No swearing, nothing adult." },
  { id: "standard", label: "Standard", blurb: "Normal community rules." },
  { id: "relaxed", label: "Relaxed", blurb: "For adult servers. Swearing and dark jokes are fine." },
];

/* ── the preview ──

   What the three dials add up to, shown rather than described: a member asks
   something and Assistant answers in the picked manner, again each time a dial
   moves. The answers follow the bot's own precedence: the filter is a ceiling
   on what may be said, the personality is the stance taken under it, and the
   voice is the register it is said in. So each question has an answer per
   personality and filter, and the voice is applied to that answer. These are
   examples written for the page, not the model's output. */
type Answers = Record<Personality, Record<Filter, string>>;

const ASKS: { who: string; text: string; answers: Answers }[] = [
  {
    who: "Alex",
    text: "is my staff application any good? be honest",
    answers: {
      friendly: {
        strict: "It's a really good start! Add a line about why you want the role and you're all set.",
        standard: "It's a really good start! Add a line about why you want the role and you're all set.",
        relaxed: "It's a solid start! Tell them why you want the role though, or it reads like you just want the badge.",
      },
      balanced: {
        strict: "Honestly? It's fine but forgettable. Say why you want the role, not just that you do.",
        standard: "Honestly? It's fine but forgettable. Say why you want the role, not just that you do.",
        relaxed: "Honestly? It's forgettable. Three lines won't cut it. Say why you want the role, not just that you do.",
      },
      unfiltered: {
        strict: "Three lines and \"pls accept\"? Come on. Tell them why it should be you.",
        standard: "Three lines and \"pls accept\"? Hell no. Tell them why it should be you.",
        relaxed: "Three lines and \"pls accept\"? Damn. That's not an application, that's a ransom note. Tell them why it should be you.",
      },
    },
  },
  {
    who: "Sam",
    text: "can you ban Jordan for me",
    answers: {
      friendly: {
        strict: "I can't ban anyone myself, but staff can! Want me to point you to where to report it?",
        standard: "I can't ban anyone myself, but staff can! Want me to point you to where to report it?",
        relaxed: "I can't ban anyone myself, but staff can! Want me to point you to where to report it?",
      },
      balanced: {
        strict: "I can't ban people. If Jordan broke a rule, report it and staff will handle it.",
        standard: "I can't ban people. If Jordan broke a rule, report it and staff will handle it.",
        relaxed: "Not my call. If Jordan actually broke a rule, report it and staff will deal with it.",
      },
      unfiltered: {
        strict: "Nice try. I don't ban people. Report it like everyone else.",
        standard: "Nice try. I'm not your hitman. Report it like everyone else.",
        relaxed: "Lmao no. I'm not your personal hitman. Report it like everyone else, damn.",
      },
    },
  },
  {
    who: "Jordan",
    text: "who's the best staff member here?",
    answers: {
      friendly: {
        strict: "Everyone pulls their weight! Though whoever answers tickets at 3am deserves a medal.",
        standard: "Everyone pulls their weight! Though whoever answers tickets at 3am deserves a medal.",
        relaxed: "Everyone pulls their weight! Though whoever answers tickets at 3am deserves a medal.",
      },
      balanced: {
        strict: "I don't pick favourites. The activity page has the numbers if you want them.",
        standard: "I don't pick favourites. The activity page has the numbers if you want them.",
        relaxed: "I don't pick favourites. The activity page has the numbers if you want them.",
      },
      unfiltered: {
        strict: "Not you, judging by your ticket count.",
        standard: "Not you, judging by your ticket count. Sorry, not sorry.",
        relaxed: "Not you, judging by your ticket count. Hell, not even close.",
      },
    },
  },
];

/** An answer in the picked voice. Very online: lowercase, shorthand, no full
 *  stops. Old-fashioned: spelled out, nothing casual. */
function voiced(text: string, age: Age): string {
  if (age === "online") {
    let line = text.toLowerCase();
    const swaps: [RegExp, string][] = [
      [/\bhonestly\?\s*/g, "ngl "],
      [/\byou're\b/g, "ur"],
      [/\byour\b/g, "ur"],
      [/\byou\b/g, "u"],
      [/\breally\b/g, "rly"],
      [/\bthough\b/g, "tho"],
      [/\bpeople\b/g, "ppl"],
      [/\bfavourites\b/g, "favs"],
      [/\bcome on\b/g, "cmon"],
      [/\bi'm\b/g, "im"],
      [/\bit's\b/g, "its"],
      [/\bthat's\b/g, "thats"],
      [/\bdon't\b/g, "dont"],
      [/\bcan't\b/g, "cant"],
      [/\bwon't\b/g, "wont"],
      [/\bsorry, not sorry\b/g, "sorry not sorry"],
    ];
    for (const [pattern, to] of swaps) line = line.replace(pattern, to);
    return line.replace(/[.!](?=\s|$)/g, "").replace(/\s+/g, " ").trim();
  }
  if (age === "formal") {
    let line = text;
    const swaps: [RegExp, string][] = [
      [/Honestly\? It's/g, "To be candid, it is"],
      [/Honestly\? /g, "To be candid, "],
      [/Lmao no\./g, "Certainly not."],
      [/Nice try\./g, "A valiant attempt."],
      [/Come on\./g, "Surely you can do better."],
      [/Sorry, not sorry\./g, "I shall not apologise."],
      [/Want me to point you to/g, "Shall I direct you to"],
      [/Not my call\./g, "That is not my decision."],
      [/at 3am/g, "at three in the morning"],
      [/\bIt's\b/g, "It is"],
      [/\bit's\b/g, "it is"],
      [/\bThat's\b/g, "That is"],
      [/\bthat's\b/g, "that is"],
      [/\byou're\b/g, "you are"],
      [/\bI'm\b/g, "I am"],
      [/\bcan't\b/g, "cannot"],
      [/\bwon't\b/g, "will not"],
      [/\bdon't\b/g, "do not"],
      [/!/g, "."],
    ];
    for (const [pattern, to] of swaps) line = line.replace(pattern, to);
    return line;
  }
  return text;
}

/** How long it "types" after a dial moves, before the new answer. */
const TYPING_MS = 620;

/* "Go back" goes to the module list, not `history.back()` (which could return
   to this same gate). */
export function GatorAiSection({ onNavigate }: { onNavigate?: (next: string) => void } = {}) {
  const {
    guildId,
    meta,
    setNotice,
    registerExternalDraft,
    setExternalDraftDirty,
  } = useManage();
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<AiSettings | null>(null);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  /** What is known about people on the block list, by id: the names the bot
   *  resolved, and anyone picked here. The list itself is the draft's, so a
   *  discarded block or unblock goes back with everything else. */
  const [people, setPeople] = useState<Record<string, BlockedMember>>({});
  /** Who can be blocked. The same `/meta` the sharing panel reads, rather than
   *  a second endpoint that would have to agree with it. */
  const [members, setMembers] = useState<
    { id: string; name: string; username?: string; avatar?: string | null }[]
  >([]);
  const [blockQuery, setBlockQuery] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const draftRef = useRef<AiSettings | null>(null);
  draftRef.current = draft;
  const savedRef = useRef<AiSettings | null>(null);
  savedRef.current = saved;

  const load = useCallback(async () => {
    // A failed load shows an error with a retry instead of an endless skeleton.
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/${guildId}/gatorai`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.settings) {
        throw new Error(json?.detail || json?.message || "Couldn't load Assistant settings.");
      }
      setSaved(readSettings(json.settings));
      setDraft(readSettings(json.settings));
      setChannels(json.channels || []);
      setPeople(
        Object.fromEntries(
          ((json.blocked || []) as BlockedMember[]).map((entry) => [String(entry.user_id), entry]),
        ),
      );
      // Best effort: the card still lists and unblocks without it.
      try {
        const metaRes = await fetch(`/api/manage/${guildId}/meta?members=1`, { cache: "no-store" });
        const meta = await metaRes.json().catch(() => null);
        setMembers(Array.isArray(meta?.members) ? meta.members : []);
      } catch {
        /* the picker is an addition to this card, not the point of it */
      }
    } catch (caught) {
      const text =
        caught instanceof Error ? caught.message : "Couldn't load Assistant settings.";
      setLoadError(text);
      setNotice?.({ kind: "error", text });
    }
  }, [guildId, setNotice]);

  useEffect(() => {
    load();
  }, [load]);

  // Dirty is computed against what is stored, so undoing a change clears the
  // save prompt.
  const dirty = useMemo(
    // By value, not by text: a field typed into and cleared is `""` where the
    // stored copy has no key, and key order does not count.
    () => Boolean(saved && draft) && !configValuesEqual(saved, draft),
    [saved, draft],
  );

  // The section hands its save and discard to the dashboard's save prompt, the
  // same one every other module uses. No per-page save button.
  useEffect(() => {
    return registerExternalDraft("gatorai", {
      save: async () => {
        const current = draftRef.current;
        if (!current) return true;
        const res = await fetch(`/api/manage/${guildId}/gatorai`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: current }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail || json.message || "Save failed");
        // The bot clamps and validates, so what it returns is the truth.
        if (json.settings) {
          const accepted = readSettings(json.settings);
          savedRef.current = accepted;
          setSaved(accepted);
          // A reply acknowledges the submitted snapshot, not later typing.
          if (configValuesEqual(draftRef.current, current)) {
            draftRef.current = accepted;
            setDraft(accepted);
          }
        } else {
          savedRef.current = current;
          setSaved(current);
        }
        return true;
      },
      discard: () => setDraft(savedRef.current),
      hasChanges: () => !configValuesEqual(draftRef.current, savedRef.current),
      label: "Assistant's settings",
    });
  }, [guildId, registerExternalDraft]);

  useEffect(() => {
    setExternalDraftDirty("gatorai", dirty);
  }, [dirty, setExternalDraftDirty]);

  function patch(next: Partial<AiSettings>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  /* The rows, from the draft: what is listed is what would be saved. */
  const blockedRows = useMemo<BlockedMember[]>(() => {
    const byId = new Map(members.map((person) => [String(person.id), person]));
    return (draft?.blocked_users || []).map((item) => {
      const id = String(item.user_id);
      const known = people[id];
      const member = byId.get(id);
      return {
        user_id: id,
        name: known?.name || member?.name || member?.username || `Member ${id}`,
        avatar: known?.avatar ?? member?.avatar ?? null,
        by_name: known?.by_name ?? null,
        reason: item.reason ?? known?.reason,
      };
    });
  }, [draft?.blocked_users, members, people]);

  if (!draft) {
    if (loadError) {
      return (
        <div className="space-y-4">
          <SectionHeader title="Assistant" />
          <div className="settings-card space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--tone-warn)]">
              <IconAlertTriangle size={15} />
              {loadError}
            </p>
            <p className="cool-text text-sm">
              This usually means the bot is restarting or unreachable. Nothing
              has been changed.
            </p>
            <button
              type="button"
              onClick={() => load()}
              className="btn-pop btn-peach inline-flex h-9 items-center px-4 text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    /* Wrapped in `ModuleGate` like every other module tab (this tab is
       hand-written, so it does not get it from `SchemaSection`), so an off
       module shows the gate instead of its settings. */
    <ModuleGate
      moduleKey="GatorAI"
      moduleLabel="Assistant"
      onGoBack={() => onNavigate?.("modules")}
    >
    <div className="space-y-5 gw-ai">
      <SectionHeader
        title="Assistant"
        actions={<PluginToggleButton moduleKey="GatorAI" moduleLabel="Assistant" />}
      />

      {/* Three dials and what they sound like together, side by side. */}
      <SettingsCard title="How it talks" description="Move a dial and it answers again.">
        <div className="gw-ai-studio">
          <div className="gw-ai-dials">
            <Dial
              label="Personality"
              options={PERSONALITIES}
              value={draft.personality}
              onChange={(personality) => patch({ personality })}
            />
            <Dial label="Voice" options={AGES} value={draft.age} onChange={(age) => patch({ age })} />
            <Dial
              label="Content filter"
              options={FILTERS}
              value={draft.filter}
              onChange={(filter) => patch({ filter })}
            />
          </div>
          <div className="gw-ai-side">
            <AiPreview personality={draft.personality} age={draft.age} filter={draft.filter} />
            <p className="gw-ai-note">
              Whatever you pick, it never uses slurs, never makes sexual content, and never takes a
              side on politics or religion.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Where it answers" description="Where members can talk to it.">
        {/* Four switches, as the cards every other tab uses, side by side. */}
        <OptionCards>
          <OptionCard
            label="Replies"
            description="Answers when someone replies to it or pings it, outside tickets."
            checked={draft.respond_to_replies}
            onChange={(next) => patch({ respond_to_replies: next })}
          />
          <OptionCard
            label="/ask"
            description="A slash command. Only the person who used it sees the answer."
            checked={draft.allow_ask_command}
            onChange={(next) => patch({ allow_ask_command: next })}
          />
          <OptionCard
            label="Images"
            description="Members can ask it to make pictures."
            checked={draft.image_generation}
            onChange={(next) => patch({ image_generation: next })}
          />
          <OptionCard
            label="Web search"
            description="Looks up recent things online and says where it found them."
            checked={draft.web_search}
            onChange={(next) => patch({ web_search: next })}
          />
        </OptionCards>
        <FieldRow label="Cooldown" description="How long one member waits between answers." inline>
          <Stepper
            label="Seconds between answers"
            min={MIN_COOLDOWN_SECONDS}
            max={600}
            step={10}
            unit={["second", "seconds"]}
            value={Math.max(MIN_COOLDOWN_SECONDS, Number(draft.cooldown_seconds) || MIN_COOLDOWN_SECONDS)}
            onChange={(cooldown_seconds) => patch({ cooldown_seconds })}
          />
        </FieldRow>
        {/* The dashboard's channel picker. Empty means every channel. */}
        <FieldRow label="Channels" description="Leave empty to answer in every channel.">
          <ChannelPicker
            channels={
              meta?.channels?.length
                ? meta.channels
                : channels.map((channel, position) => ({
                    id: String(channel.id),
                    name: channel.name,
                    type: "text" as const,
                    parentId: null,
                    position,
                  }))
            }
            multi
            placeholder="Every channel"
            value={draft.channels}
            onChange={(next) => patch({ channels: ((next as string[]) || []).map(String) })}
          />
        </FieldRow>
      </SettingsCard>

      <SettingsCard
        title="Blocked"
        description="Members who can't use it. /ai block in Discord adds to the same list."
      >
        {/* People can be added to the blocklist here, not only removed. Both
            fields are the window's one text field. */}
        <div className="gw-ai-block">
          <div className="gw-ai-block-fields">
            <label className="gw-field gw-ai-search">
              <IconSearch size={15} aria-hidden="true" />
              <input
                value={blockQuery}
                onChange={(event) => setBlockQuery(event.target.value)}
                placeholder="Find a member"
                aria-label="Find a member to block"
                data-bare
              />
            </label>
            <input
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Reason (optional)"
              aria-label="Reason for the block"
              maxLength={300}
              className="gw-field"
            />
          </div>
          {blockQuery.trim().length >= 2 ? (
            <div className="gw-ai-matches" role="listbox" aria-label="Members">
              {(() => {
                const term = blockQuery.trim().toLowerCase();
                const already = new Set(blockedRows.map((item) => item.user_id));
                const matches = members
                  .filter(
                    (person) =>
                      !already.has(String(person.id)) &&
                      ((person.name || "").toLowerCase().includes(term) ||
                        (person.username || "").toLowerCase().includes(term)),
                  )
                  .slice(0, 8);
                if (!matches.length) {
                  return <p className="gw-ai-empty">Nobody here is called “{blockQuery.trim()}”.</p>;
                }
                return matches.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="gw-ai-person"
                    onClick={() => {
                      const reason = blockReason.trim().slice(0, 300);
                      const id = String(person.id);
                      patch({
                        blocked_users: [
                          ...(draft.blocked_users || []),
                          { user_id: id, at: new Date().toISOString(), reason },
                        ],
                      });
                      // Their name and picture, so the row reads as them
                      // before anything is saved.
                      setPeople((current) => ({
                        ...current,
                        [id]: {
                          user_id: id,
                          name: person.name || person.username || "Unknown",
                          avatar: person.avatar,
                          reason,
                        },
                      }));
                      setBlockQuery("");
                      setBlockReason("");
                    }}
                  >
                    <Avatar src={person.avatar} name={person.name || person.username || "?"} />
                    <span className="gw-ai-person-copy">
                      <span className="gw-ai-person-name">{person.name || person.username}</span>
                      {person.username ? <span className="gw-ai-person-sub">@{person.username}</span> : null}
                    </span>
                    <span className="gw-ai-person-go">Block</span>
                  </button>
                ));
              })()}
            </div>
          ) : null}
        </div>
        {blockedRows.length ? (
          <PresenceList
            items={blockedRows}
            className="gw-ai-blocked"
            render={(entry) => (
              <div className="gw-ai-person" data-static="true">
                <Avatar src={entry.avatar} name={entry.name} />
                <span className="gw-ai-person-copy">
                  <span className="gw-ai-person-name">{entry.name}</span>
                  {/* Who blocked them and why, stored with the record. */}
                  <span className="gw-ai-person-sub">
                    {entry.reason || "No reason given"}
                    {entry.by_name ? ` · by ${entry.by_name}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="gw-btn"
                  data-kind="ghost"
                  onClick={() =>
                    patch({
                      blocked_users: (draft.blocked_users || []).filter(
                        (item) => String(item.user_id) !== entry.user_id,
                      ),
                    })
                  }
                >
                  Unblock
                </button>
              </div>
            )}
          />
        ) : (
          <div className="gw-ai-empty">Nobody is blocked.</div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Known problem"
        description="If something is broken, tell it here and it will say so when members ask."
      >
        <FieldRow label="What's broken">
          <div className="w-full">
            <input
              value={draft.known_issue}
              onChange={(event) => patch({ known_issue: event.target.value })}
              placeholder="e.g. Roblox verification is down"
              maxLength={500}
              className="gw-field w-full"
            />
            {draft.known_issue ? (
              <p className="gw-ai-live">
                <IconAlertTriangle size={13} aria-hidden="true" />
                Members asking about it are being told. Clear this once it's fixed.
              </p>
            ) : null}
          </div>
        </FieldRow>
      </SettingsCard>
    </div>
    </ModuleGate>
  );
}

/** The bot's settings in the page's shape: newer fields filled in for a bot
 *  that has not restarted since, and every id as text. */
function readSettings(raw: Record<string, unknown>): AiSettings {
  const settings = raw as unknown as AiSettings;
  return {
    ...settings,
    // `age` is the newest dial; an older bot returns the shape without it.
    age: settings.age || "everyday",
    image_generation: settings.image_generation ?? true,
    // The channel list came later still; missing, the Channels picker mapped
    // over nothing and took the whole tab down with it.
    channels: Array.isArray(settings.channels) ? settings.channels.map(String) : [],
    blocked_users: (Array.isArray(settings.blocked_users) ? settings.blocked_users : []).map((item) => ({
      ...item,
      user_id: String(item.user_id),
      by: item.by == null ? item.by : String(item.by),
    })),
  };
}

/** One dial: its name, the choices as the window's switcher, and what the
 *  chosen one means. */
function Dial<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; blurb: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const current = options.find((option) => option.id === value) ?? options[1];
  return (
    <div className="gw-ai-dial">
      <span className="gw-ai-dial-name">{label}</span>
      <Segments
        kind="choice"
        label={label}
        value={value}
        options={options.map((option) => ({ value: option.id, label: option.label }))}
        onChange={onChange}
      />
      <p key={current.id} className="gw-ai-dial-say">
        {current.blurb}
      </p>
    </div>
  );
}

/** A member asks, Assistant answers in the picked manner. It types for a moment
 *  whenever a dial moves, then answers a word at a time. */
function AiPreview({
  personality,
  age,
  filter,
}: {
  personality: Personality;
  age: Age;
  filter: Filter;
}) {
  const [ask, setAsk] = useState(0);
  const [typing, setTyping] = useState(false);
  const question = ASKS[ask];
  const answer = voiced(question.answers[personality]?.[filter] ?? question.answers.balanced.standard, age);
  const key = `${ask}-${personality}-${age}-${filter}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTyping(true);
    const id = window.setTimeout(() => setTyping(false), TYPING_MS);
    return () => window.clearTimeout(id);
  }, [key]);

  return (
    <div className="gw-ai-chat">
      <div className="gw-ai-line" key={`ask-${ask}`}>
        <span className="gw-ai-face" aria-hidden="true">
          {question.who.replace(/^\./, "").slice(0, 1).toUpperCase()}
        </span>
        <div className="gw-ai-said">
          <span className="gw-ai-who">{question.who}</span>
          <p className="gw-ai-text">{question.text}</p>
        </div>
      </div>
      <div className="gw-ai-line" data-bot="true">
        <span className="gw-ai-face" data-bot="true" aria-hidden="true">
          <AppLogo size={18} title="" />
        </span>
        <div className="gw-ai-said" aria-live="polite">
          <span className="gw-ai-who">
            Assistant <span className="gw-ai-tag">App</span>
          </span>
          {typing ? (
            <p className="gw-ai-typing" aria-label="Typing">
              <i />
              <i />
              <i />
            </p>
          ) : (
            <p className="gw-ai-text" key={key}>
              {answer.split(" ").map((word, index) => (
                <span
                  key={index}
                  className="gw-ai-word"
                  style={{ ["--w" as string]: Math.min(index, 40) }}
                >
                  {word}{" "}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        className="gw-ai-ask"
        onClick={() => setAsk((current) => (current + 1) % ASKS.length)}
      >
        <IconRefresh size={14} aria-hidden="true" />
        Ask something else
      </button>
    </div>
  );
}

/** A member's picture, or their first letter where they have none. */
function Avatar({ src, name }: { src?: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="gw-ai-avatar" />
  ) : (
    <span className="gw-ai-avatar" aria-hidden="true">
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
