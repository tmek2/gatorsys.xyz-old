"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAlertTriangle, IconPlus, IconTrash } from "@tabler/icons-react";
import { ChannelPicker, OptionCard, OptionCards, Reveal, RolePicker, SelectField, Stepper } from "./fields";
import { configValuesEqual, useManage } from "./manage-context";
import { ConfigCard, FieldIcon } from "./schema-section";

type EscalationRoute = { panel: string; channel_id: string | number };

type AiActions = {
  allow_close?: boolean;
  allow_notify?: boolean;
  notify_channel_ids?: (string | number)[];
  ping_role_ids?: (string | number)[];
};

/**
 * What GatorAI does inside a ticket when it cannot finish the job. Lives with
 * Tickets because that is where it applies; the GatorAI page keeps what is
 * about the assistant everywhere. Both write to the same record and save
 * through the dashboard's save prompt.
 */
export function TicketAiBehaviour() {
  const { guildId, registerExternalDraft, setExternalDraftDirty, meta } = useManage();
  // Ticket subjects are picked, not typed: a mistyped panel name would silently
  // never match and escalations would go to the default channel.
  const [panels, setPanels] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manage/${guildId}/panels`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((body: { panels?: { name?: string }[] }) => {
        if (cancelled) return;
        setPanels(
          (body.panels || [])
            .map((panel: any) => String(panel?.name || "").trim())
            .filter(Boolean),
        );
      })
      .catch(() => {
        if (!cancelled) setPanels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);
  const [saved, setSaved] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/${guildId}/gatorai`, {
        cache: "no-store",
      });
      const json = res.ok ? await res.json() : null;
      if (json?.settings) {
        setSaved(json.settings);
        setDraft(json.settings);
      }
    } catch {
      /* The card simply does not render if the bot is unreachable. */
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  // Compared against what is stored, so undoing an edit dismisses the save
  // prompt rather than leaving it asking to save something unchanged.
  const dirty = useMemo(
    () => Boolean(saved && draft) && !configValuesEqual(saved, draft),
    [saved, draft],
  );

  useEffect(() => {
    return registerExternalDraft("gatorai-tickets", {
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
        if (json.settings) {
          setSaved(json.settings);
          setDraft(json.settings);
        }
        return true;
      },
      discard: () => setDraft(savedRef.current),
      label: "the tickets' AI settings",
    });
  }, [guildId, registerExternalDraft]);

  useEffect(() => {
    setExternalDraftDirty("gatorai-tickets", dirty);
  }, [dirty, setExternalDraftDirty]);

  const routes: EscalationRoute[] = Array.isArray(draft?.escalation_routes)
    ? (draft.escalation_routes as EscalationRoute[])
    : [];
  const setRoutes = useCallback((next: EscalationRoute[]) => {
    setDraft((current) =>
      current ? { ...current, escalation_routes: next } : current,
    );
  }, []);
  const patchRoute = useCallback(
    (index: number, patch: Partial<EscalationRoute>) => {
      setDraft((current) => {
        if (!current) return current;
        const list = Array.isArray(current.escalation_routes)
          ? [...(current.escalation_routes as EscalationRoute[])]
          : [];
        list[index] = { ...list[index], ...patch };
        return { ...current, escalation_routes: list };
      });
    },
    [],
  );

  // What the assistant is allowed to *do*, as opposed to say. Off unless a
  // server switches it on: silence is not consent to a bot that closes tickets.
  const actions: AiActions = (draft?.actions as AiActions) || {};
  const patchActions = useCallback((patch: AiActions) => {
    setDraft((current) =>
      current
        ? { ...current, actions: { ...((current.actions as AiActions) || {}), ...patch } }
        : current,
    );
  }, []);

  if (!draft) return null;

  const turns = Number(draft.escalate_after_turns) || 3;

  /* Rows with a name each, like the rest of the tab. */
  return (
    <>
      <section className="gw-set gw-tk">
        <div className="gw-set-panel">
          <div className="gw-set-head" data-static="true">
            <span className="gw-set-head-copy">
              <span className="gw-set-head-name">Handing over</span>
              <span className="gw-set-head-say">
                When the AI can&rsquo;t sort a ticket out, it passes it to staff.
              </span>
            </span>
          </div>
          <div className="gw-set-slot">
            {/* A turn counts only when the assistant did nothing and the member
               said nothing new; the note says what resets it. */}
            <ConfigCard
              icon={<FieldIcon type="number" />}
              title="Hand over after"
              description="Replies without progress before staff take over."
              trailing={
                <Stepper
                  label="Replies before handing over"
                  min={1}
                  max={10}
                  unit={["reply", "replies"]}
                  value={turns}
                  onChange={(next) =>
                    setDraft((current) =>
                      current ? { ...current, escalate_after_turns: next } : current,
                    )
                  }
                />
              }
            />
          </div>
          <div className="gw-set-slot" data-options="true">
            <OptionCards>
              <OptionCard
                label="Write a summary for staff"
                description="What they want, what is settled, what was tried."
                checked={Boolean(draft.escalation_summary)}
                onChange={(next) =>
                  setDraft((current) =>
                    current ? { ...current, escalation_summary: next } : current,
                  )
                }
              />
            </OptionCards>
          </div>
          <div className="gw-set-slot">
            <ConfigCard icon={<FieldIcon type="channel" />} title="Handover channel">
              <ChannelPicker
                channels={meta?.channels || []}
                value={
                  draft.escalation_channel_id ? String(draft.escalation_channel_id) : null
                }
                onChange={(next) =>
                  setDraft((current) =>
                    current
                      ? { ...current, escalation_channel_id: (next as string) || null }
                      : current,
                  )
                }
              />
              {/* With no escalation channel, the bot posts the handover in the
                 ticket itself, which is a fallback; the warning sits under the
                 field that fixes it. */}
              {!draft.escalation_channel_id && !routes.length ? (
                <p className="gw-tk-warn">
                  <IconAlertTriangle size={14} aria-hidden="true" />
                  <span>
                    None set, so handovers are posted in the ticket itself, where
                    only staff already in it will see them.
                  </span>
                </p>
              ) : null}
            </ConfigCard>
          </div>
          {/* Handover routes per subject, so different kinds of request reach
             different staff. */}
          <div className="gw-set-slot" data-wide="true">
            <ConfigCard
              icon={<FieldIcon type="channel" />}
              title="A different channel for a subject"
            >
              <div className="gw-tk-routes">
                {routes.map((route, index) => {
                  // A subject already routed is not offered again: the bot
                  // keeps the first route, so a second would do nothing.
                  const taken = new Set(
                    routes.filter((_, i) => i !== index).map((r) => r.panel),
                  );
                  const options = panels
                    .filter((name) => name === route.panel || !taken.has(name))
                    .map((name) => ({ label: name, value: name }));
                  return (
                    <div key={index} className="gw-tk-route">
                      <SelectField
                        value={route.panel}
                        options={options}
                        placeholder="Subject"
                        onChange={(next) => patchRoute(index, { panel: next || "" })}
                      />
                      <ChannelPicker
                        channels={meta?.channels || []}
                        value={route.channel_id ? String(route.channel_id) : null}
                        onChange={(next) =>
                          patchRoute(index, { channel_id: (next as string) || "" })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setRoutes(routes.filter((_, i) => i !== index))}
                        className="gw-tk-route-x"
                        aria-label={`Remove route for ${route.panel || "this subject"}`}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="gw-tk-add"
                  disabled={routes.length >= panels.length}
                  onClick={() => setRoutes([...routes, { panel: "", channel_id: "" }])}
                >
                  <IconPlus className="gw-tk-add-plus" size={14} stroke={2.4} aria-hidden="true" />
                  <span>Route a subject</span>
                </button>
              </div>
            </ConfigCard>
          </div>
        </div>
      </section>

      {/* What the assistant may do. Everything is off until switched on, and
         each permission names the exact channels or roles it may use. The rules
         themselves go in the AI knowledge ("when someone asks for a fast pass,
         alert HR in #staff-alerts, then wait for a human"); this is what those
         rules can reach. Anything else, it answers and hands over. */}
      <section className="gw-set gw-tk">
        <div className="gw-set-panel">
          <div className="gw-set-head" data-static="true">
            <span className="gw-set-head-copy">
              <span className="gw-set-head-name">What it can do</span>
              <span className="gw-set-head-say">
                Things the AI is allowed to do in a ticket. If one is off, it asks staff instead.
              </span>
            </span>
          </div>
          <div className="gw-set-slot" data-options="true">
            <OptionCards>
              {/* It always sends its reply first. */}
              <OptionCard
                label="Close tickets"
                description="When the problem is solved, or when your AI knowledge says to."
                checked={Boolean(actions.allow_close)}
                onChange={(next) => patchActions({ allow_close: next })}
              />
              <OptionCard
                label="Post in other channels"
                description="Like pinging HR in a staff channel."
                checked={Boolean(actions.allow_notify)}
                onChange={(next) => patchActions({ allow_notify: next })}
              />
            </OptionCards>
          </div>
          {/* Only these. Empty posts nowhere -- the switch is permission to
              use this list, not permission to pick a channel. */}
          {/* Rolled open with the switch, rather than appearing under it. */}
          <Reveal when={Boolean(actions.allow_notify)}>
            <div className="gw-set-slot">
              <ConfigCard
                icon={<FieldIcon type="channels" />}
                title="Channels it can post in"
              >
                <ChannelPicker
                  channels={meta?.channels || []}
                  multi
                  value={(actions.notify_channel_ids || []).map(String)}
                  onChange={(next) =>
                    patchActions({ notify_channel_ids: (next as string[]) || [] })
                  }
                />
              </ConfigCard>
            </div>
          </Reveal>
          <div className="gw-set-slot">
            <ConfigCard
              icon={<FieldIcon type="roles" />}
              title="Roles it can ping"
              description="It never pings @everyone."
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={(actions.ping_role_ids || []).map(String)}
                onChange={(next) => patchActions({ ping_role_ids: (next as string[]) || [] })}
              />
            </ConfigCard>
          </div>
        </div>
      </section>
    </>
  );
}
