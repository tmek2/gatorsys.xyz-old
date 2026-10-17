"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconLink, IconSearch, IconUsers, IconX } from "@tabler/icons-react";
import { SelectField } from "./fields";
import { MemberAvatar } from "./member-avatar";
import { RoleSwatch } from "./indicator";

type ShareEntry = {
  id: string;
  name: string;
  type: "role" | "user" | "gator";
  permission: "viewer" | "editor";
  /** A person's picture, kept on the grant so the row shows who it is. */
  avatar?: string | null;
};

type Option = {
  id: string;
  name: string;
  type: ShareEntry["type"];
  color?: string | null;
  /** Present on people, so a search matches the @handle as well as the
   *  nickname somebody is currently wearing. */
  handle?: string | null;
  avatar?: string | null;
};

/**
 * Access manager shared by the document and spreadsheet editors. Search adds
 * people, Discord roles and department roles; each grant has its own
 * viewer/editor permission and can be removed. General access (link / members /
 * restricted) is below.
 */
export function ShareAccessPanel({
  resource,
  onChange,
  guildId,
  shareUrl,
  kindLabel = "document",
  scope = "server",
  onClose,
}: {
  resource: any;
  onChange: (next: any) => void;
  guildId?: string;
  shareUrl?: string;
  kindLabel?: string;
  /**
   * What owns this: a department resource can be shared with department
   * members; a server application cannot.
   */
  scope?: "server" | "department";
  onClose: () => void;
}) {
  const share = resource.share || {};
  const entries: ShareEntry[] = Array.isArray(share.entries) ? share.entries : [];
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;
    (async () => {
      try {
        // `?members` because this picker is what the member list is for. It is
        // not on /manage's critical path.
        const response = await fetch(`/api/manage/${guildId}/meta?members=1`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        // Roles and real members (from `meta`, which excludes bots).
        const roleOptions = (Array.isArray(body.roles) ? body.roles : [])
          .filter((role: any) => !role.managed)
          .map((role: any) => ({
            id: `role:${role.id}`,
            name: role.name,
            type: "role" as const,
            color: role.color,
          }));
        const memberOptions = (Array.isArray(body.members) ? body.members : []).map(
          (person: any) => ({
            id: `user:${person.id}`,
            name: person.name || person.username,
            handle: person.username,
            avatar: person.avatar,
            type: "user" as const,
          }),
        );
        setOptions([...roleOptions, ...memberOptions]);
      } catch {
        /* the picker still works with free-typed people */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => {
    if (!focused) return;
    const close = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [focused]);

  const chosen = new Set(entries.map((entry) => entry.id));
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = options.filter(
      (option) => !chosen.has(option.id) && (!term || option.name.toLowerCase().includes(term)),
    );
    return list.slice(0, 8);
  }, [options, query, entries]);

  function patchEntries(next: ShareEntry[]) {
    onChange({ ...resource, share: { ...share, entries: next } });
  }

  function addEntry(option: Option) {
    if (chosen.has(option.id)) return;
    patchEntries([
      ...entries,
      {
        id: option.id,
        name: option.name,
        type: option.type,
        permission: "viewer",
        avatar: option.avatar || null,
      },
    ]);
    // Closes the list after adding, so it does not cover the new grant.
    setQuery("");
    setFocused(false);
    setQuery("");
  }

  // Grants only come from the list of real roles and members; typed text never
  // creates one.

  function updateEntry(id: string, patch: Partial<ShareEntry>) {
    patchEntries(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(id: string) {
    patchEntries(entries.filter((entry) => entry.id !== id));
  }

  return (
    <>
      {/* Search + add */}
      <div ref={boxRef} className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 focus-within:border-[var(--accent-peach)]/50">
          <IconSearch size={16} className="shrink-0 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (results.length) addEntry(results[0]);
                else if (results.length) addEntry(results[0]);
              }
            }}
            placeholder="Search people and roles"
            className="min-w-0 flex-1 bg-transparent text-sm text-white/85 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/35"
            aria-label="Add people or roles"
          />
        </div>
        {focused && (results.length || query.trim()) ? (
          <div className="absolute left-0 right-0 top-[52px] z-30 max-h-60 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
            {results.length ? (
              <>
                <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Discord Roles
                </p>
                {results.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addEntry(option);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06]"
                  >
                    {option.type === "user" ? (
                      <MemberAvatar
                        src={option.avatar}
                        name={option.name}
                        className="h-6 w-6"
                      />
                    ) : (
                      <RoleSwatch color={option.color} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {option.handle ? (
                      <span className="shrink-0 text-xs text-white/35">
                        @{option.handle}
                      </span>
                    ) : null}
                  </button>
                ))}
              </>
            ) : null}
            {/* No "Add <typed text>" option. */}
            {query.trim() && !results.length ? (
              <p className="px-3 py-2 text-sm text-white/40">
                Nobody and no role matches “{query.trim()}”.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Added grants */}
      {entries.length ? (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2"
            >
              {/* A person shows their own face; a role keeps the glyph, since
                  a role does not have one. */}
              {entry.type === "user" ? (
                <MemberAvatar
                  src={entry.avatar}
                  name={entry.name}
                  className="h-7 w-7"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-peach)]/15 text-[var(--accent-peach)]">
                  <IconUsers size={14} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white/85">{entry.name}</p>
                <p className="text-[11px] text-white/50">
                  {entry.type === "user" ? "Person" : entry.type === "gator" ? "Gator role" : "Discord role"}
                </p>
              </div>
              {/* Each grant says what it allows. */}
              <div className="w-[8.5rem] shrink-0">
                <SelectField
                  value={entry.permission}
                  options={[
                    { value: "viewer", label: "Viewer" },
                    { value: "editor", label: "Editor" },
                  ]}
                  onChange={(permission) =>
                    updateEntry(entry.id, {
                      permission: permission as ShareEntry["permission"],
                    })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="rounded-xl p-1 text-white/35 hover:bg-white/[0.06] hover:text-white"
                aria-label={`Remove ${entry.name}`}
              >
                <IconX size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* General access */}
      <div className="mt-5 flex items-center gap-2 text-sm font-bold text-white/75">
        <IconUsers size={17} />
        General Access
      </div>
      {/* General access has two states, with no viewer/editor choice: share
         links never grant editing (administrators edit). "Department members"
         is only offered for department resources. */}
      {/* Wide enough that the values ("Anyone with the link") are readable. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">
          <SelectField
            value={share.access || "restricted"}
            options={[
              { value: "restricted", label: "Restricted" },
              { value: "link", label: "Anyone with the link" },
              ...(scope === "department"
                ? [{ value: "department", label: "Department members" }]
                : []),
            ]}
            onChange={(access) => onChange({ ...resource, share: { ...share, access } })}
          />
        </div>
        <div className="w-[8.5rem] shrink-0">
          <SelectField
            value={share.role || "viewer"}
            options={[
              { value: "viewer", label: "Viewer" },
              { value: "editor", label: "Editor" },
            ]}
            onChange={(role) => onChange({ ...resource, share: { ...share, role } })}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-between">
        <button
          type="button"
          onClick={() => {
            if (shareUrl) void navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${copied ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "border-white/[0.08] text-white/65 hover:text-white"}`}
        >
          {copied ? <IconCheck size={15} /> : <IconLink size={15} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button type="button" onClick={onClose} className="btn-pop btn-peach px-4 py-2 text-xs">
          Save
        </button>
      </div>
    </>
  );
}
