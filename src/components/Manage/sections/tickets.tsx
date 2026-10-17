"use client";

import React, { useCallback, useEffect, useState } from "react";
import { NumberField } from "../fields";
import { useManage } from "../manage-context";
import { TicketAiBehaviour } from "../ticket-ai-behaviour";
import { ModuleGate, PluginToggleButton } from "../module-gate";
import { ConfigCard, FieldIcon } from "../schema-section";
import { SectionHeader } from "../section-header";
import { Segments, useRememberedView } from "../segments";
import type { TicketPanel } from "../types";
import { EmptyState, SkeletonRows } from "../empty-state";
import { AiContextCard, AiGapsCard } from "./tickets/ai-cards";
import { CreateRow, PanelEditor } from "./tickets/panel-editor";
import { AddButton, TicketGroup } from "./tickets/shared";
import { SubjectEditor } from "./tickets/subject-editor";

type TicketsView = "subjects" | "panels" | "ai";

const TICKETS_VIEWS = ["subjects", "panels", "ai"] as const;

/* The Tickets tab: three views (subjects, panels, and the AI), switched by the
   control at the top, with one subject or panel open at a time. All three stay
   mounted and hidden, because an open subject's unsaved edits are a draft held
   by the page's save prompt.

   The module gate's "Go back" goes to the module list, not `history.back()`
   (which could return to this same gate). */
export function TicketsSection({ onNavigate }: { onNavigate?: (next: string) => void } = {}) {
  const { guildId, value, stage, setNotice } = useManage();
  const [panels, setPanels] = useState<TicketPanel[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [creatingPanel, setCreatingPanel] = useState(false);
  const [view, setView] = useRememberedView<TicketsView>(
    "gator-tickets-view",
    "subjects",
    TICKETS_VIEWS,
  );
  /** The one subject or panel that is open. */
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [gapCount, setGapCount] = useState(0);

  const load = useCallback(() => {
    fetch(`/api/manage/${guildId}/panels`)
      .then((res) => (res.ok ? res.json() : { panels: [] }))
      .then((json) => setPanels(json.panels || []))
      .catch(() => setPanels([]));
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(
    body: Record<string, unknown>,
    { quiet = false }: { quiet?: boolean } = {},
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/ticketpanels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.detail || "Request failed");
      }
      const json = await res.json();
      setPanels(json.panels || []);
      // An edit saved from the page's save prompt is announced by the prompt.
      if (!quiet) setNotice({ kind: "saved", text: "Tickets updated" });
      return true;
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Request failed" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const subjects = (panels || []).filter((panel) => (panel.type || "single") === "single");
  const multiPanels = (panels || []).filter((panel) => panel.type === "multi");
  const inactivity = value("Automations.Inactivity");
  const toggleItem = (key: string) =>
    setOpenItem((current) => (current === key ? null : key));

  return (
    <ModuleGate moduleKey="Tickets" moduleLabel="Tickets" onGoBack={() => onNavigate?.("modules")}>
      <div className="gw-tk-page">
        <SectionHeader
          title="Tickets"
          actions={<PluginToggleButton moduleKey="Tickets" moduleLabel="Tickets" />}
        />

        <Segments<TicketsView>
          className="gw-tk-views"
          label="Tickets"
          value={view}
          onChange={setView}
          options={[
            { value: "subjects", label: "Subjects", count: subjects.length },
            { value: "panels", label: "Panels", count: multiPanels.length },
            { value: "ai", label: "AI", count: gapCount, alert: true },
          ]}
        />

        <div className="gw-tk-view" hidden={view !== "subjects"}>
          <TicketGroup
            title="Subjects"
            say="What a member can open a ticket about."
            action={
              <AddButton open={creatingSubject} onClick={() => setCreatingSubject((v) => !v)}>
                Add subject
              </AddButton>
            }
          >
            <CreateRow
              open={creatingSubject}
              label="Subject name"
              placeholder="Name it, like General Support"
              busy={busy}
              onCreate={async (name) => {
                const ok = await mutate({ action: "create", type: "single", name });
                if (ok) {
                  setCreatingSubject(false);
                  setOpenItem(`single:${name}`);
                }
              }}
            />
            {panels === null ? (
              <div className="gw-tk-loading">
                <SkeletonRows rows={2} label="Loading subjects…" />
              </div>
            ) : subjects.length === 0 ? (
              creatingSubject ? null : (
                <EmptyState
                  variant="row"
                  title="No subjects yet"
                  hint="A subject decides where a ticket goes and who sees it."
                />
              )
            ) : (
              subjects.map((panel) => (
                <SubjectEditor
                  key={`single-${panel.name}`}
                  panel={panel}
                  onMutate={mutate}
                  busy={busy}
                  open={openItem === `single:${panel.name}`}
                  onToggle={() => toggleItem(`single:${panel.name}`)}
                />
              ))
            )}
          </TicketGroup>

          <TicketGroup title="Every ticket">
            <div className="gw-set-slot">
              <ConfigCard
                icon={<FieldIcon type="number" />}
                title="Close when quiet"
                description="After this long with no messages. Empty never closes."
              >
                <div className="gw-tk-minutes">
                  <NumberField
                    value={inactivity == null || inactivity === "" ? "" : Number(inactivity)}
                    min={5}
                    onChange={(next) =>
                      stage("Automations.Inactivity", next === "" ? null : String(next))
                    }
                  />
                  <span className="gw-tk-unit">min</span>
                </div>
              </ConfigCard>
            </div>
          </TicketGroup>
        </div>

        <div className="gw-tk-view" hidden={view !== "panels"}>
          <TicketGroup
            title="Panels"
            say="The message members press to open a ticket."
            action={
              <AddButton open={creatingPanel} onClick={() => setCreatingPanel((v) => !v)}>
                Add panel
              </AddButton>
            }
          >
            <CreateRow
              open={creatingPanel}
              label="Panel name"
              placeholder="Name it, like Support Panel"
              busy={busy}
              onCreate={async (name) => {
                const ok = await mutate({ action: "create", type: "multi", name });
                if (ok) {
                  setCreatingPanel(false);
                  setOpenItem(`multi:${name}`);
                }
              }}
            />
            {panels === null ? (
              <div className="gw-tk-loading">
                <SkeletonRows rows={1} label="Loading panels…" />
              </div>
            ) : multiPanels.length === 0 ? (
              creatingPanel ? null : (
                <EmptyState
                  variant="row"
                  title="No panels yet"
                  hint={
                    subjects.length
                      ? "Make one, pick its subjects, then send it to a channel."
                      : "Add a subject first. A panel is the message that offers them."
                  }
                />
              )
            ) : (
              multiPanels.map((panel) => (
                <PanelEditor
                  key={`multi-${panel.name}`}
                  panel={panel}
                  onMutate={mutate}
                  busy={busy}
                  subjects={subjects}
                  open={openItem === `multi:${panel.name}`}
                  onToggle={() => toggleItem(`multi:${panel.name}`)}
                />
              ))
            )}
          </TicketGroup>
        </div>

        <div className="gw-tk-view" hidden={view !== "ai"}>
          <AiGapsCard onCount={setGapCount} />
          <AiContextCard />
          <TicketAiBehaviour />
        </div>
      </div>
    </ModuleGate>
  );
}
