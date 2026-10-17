"use client";

import React, { useEffect, useState } from "react";
import { SelectField, TextField } from "../../fields";
import { MessageObjectEditor } from "../../config-message";
import { ConfigCard, FieldIcon } from "../../schema-section";
import { Segments } from "../../segments";
import type { TicketPanel } from "../../types";
import {
  EditorProps,
  ItemFooter,
  PANEL_VARIABLES,
  TicketIcon,
  TicketItem,
  usePanelDraft,
} from "./shared";

/* Editing a ticket panel (the message that offers the subjects), and the row that creates one. */

type PanelPage = "setup" | "message";

/** A panel — a message with buttons or a dropdown that opens the subjects
 *  it references. Two pages: what is on it, and what it says. */
export function PanelEditor({
  panel,
  onMutate,
  busy,
  open,
  onToggle,
  subjects,
}: EditorProps & { subjects: TicketPanel[] }) {
  const { current, dirty, set, rename } = usePanelDraft(panel, onMutate);
  const [page, setPage] = useState<PanelPage>("setup");
  const selected: string[] = Array.isArray(current("Panels")) ? current("Panels") : [];
  const selectedSubjects = subjects.filter((subject) => selected.includes(subject.name));
  const displayMode = current("DisplayMode") || "buttons";
  const panelControls = displayMode === "dropdown"
    ? [{
        kind: "select" as const,
        placeholder: current("dropdown_description") || "Select a subject",
        options: selectedSubjects.map((subject) => ({
          label: subject.Button?.label || subject.name,
          description: subject.description || undefined,
          emoji: subject.Button?.emoji || undefined,
        })),
      }]
    : selectedSubjects.map((subject) => ({
        kind: "button" as const,
        label: subject.Button?.label || subject.name,
        emoji: subject.Button?.emoji || undefined,
        style: subject.Button?.style || "Grey",
        disabled: Boolean(subject.Button?.disabled),
      }));

  return (
    <TicketItem
      title={panel.name}
      subtitle={`${selected.length} subject${selected.length === 1 ? "" : "s"} · ${
        displayMode === "dropdown" ? "Dropdown" : "Buttons"
      }`}
      dirty={dirty}
      open={open}
      onToggle={onToggle}
    >
      <Segments<PanelPage>
        className="gw-tk-pages"
        label={`${panel.name} settings`}
        value={page}
        onChange={setPage}
        options={[
          { value: "setup", label: "Setup" },
          { value: "message", label: "Message" },
        ]}
      />

      <div className="gw-tk-page-body" key={page}>
        {page === "setup" ? (
          <div className="gw-tk-list">
            {/* A panel's name is how it is referenced when it is sent, so it
                gets the same treatment as a subject's. */}
            <ConfigCard icon={<TicketIcon kind="text" />} title="Name">
              <input
                value={current("rename") ?? panel.name}
                onChange={(event) => rename(event.target.value)}
                maxLength={64}
                placeholder="Support panel"
                aria-label="Panel name"
                className="gw-field w-full"
              />
            </ConfigCard>
            <ConfigCard icon={<FieldIcon type="select" />} title="Subjects on it">
              {subjects.length === 0 ? (
                <p className="gw-tk-sub-empty">Make a subject first.</p>
              ) : (
                <div className="gw-tk-picks">
                  {subjects.map((subject) => {
                    const on = selected.includes(subject.name);
                    return (
                      <button
                        key={subject.name}
                        type="button"
                        aria-pressed={on}
                        data-on={on ? "true" : undefined}
                        className="gw-tk-pick"
                        onClick={() =>
                          set(
                            "Panels",
                            on
                              ? selected.filter((s) => s !== subject.name)
                              : [...selected, subject.name],
                          )
                        }
                      >
                        {subject.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </ConfigCard>
            <ConfigCard icon={<FieldIcon type="select" />} title="Members pick with">
              <SelectField
                value={displayMode}
                options={[
                  { value: "buttons", label: "Buttons" },
                  { value: "dropdown", label: "A dropdown" },
                ]}
                onChange={(next) => set("DisplayMode", next || "buttons")}
              />
            </ConfigCard>
            {displayMode === "dropdown" ? (
              <ConfigCard icon={<TicketIcon kind="text" />} title="Dropdown placeholder">
                <TextField
                  value={current("dropdown_description") || ""}
                  maxLength={100}
                  placeholder="Select a subject"
                  onChange={(next) => set("dropdown_description", next || null)}
                />
              </ConfigCard>
            ) : null}
          </div>
        ) : (
          <MessageObjectEditor
            module="Tickets"
            value={current("Panel") || {}}
            onChange={(next) => set("Panel", next)}
            variables={PANEL_VARIABLES}
            systemButtons={
              panelControls.length
                ? panelControls
                : [{ kind: "button", label: "Add a subject on Setup", style: "Grey", disabled: true }]
            }
          />
        )}
      </div>

      <ItemFooter
        busy={busy}
        dirty={dirty}
        panelName={panel.name}
        panelType={panel.type === "single" ? "single" : "multi"}
        deleteLabel="Delete panel"
        onDelete={() =>
          onMutate({ action: "delete", type: panel.type || "multi", name: panel.name })
        }
      />
    </TicketItem>
  );
}

/* A name, and Enter. It rolls down under the group's header rather than
   arriving as a card of its own with a labelled field and a button in it. */
export function CreateRow({
  open,
  label,
  placeholder,
  busy,
  onCreate,
}: {
  open: boolean;
  label: string;
  placeholder: string;
  busy: boolean;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const field = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) {
      setName("");
      return;
    }
    // After the roll has started, or the focus scrolls a zero-height box.
    const id = window.setTimeout(() => field.current?.focus({ preventScroll: true }), 140);
    return () => window.clearTimeout(id);
  }, [open]);
  return (
    <div className="gw-set-roll" data-open={open ? "true" : "false"}>
      <div className="gw-set-roll-clip" inert={!open}>
        <form
          className="gw-tk-create"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !name.trim()) return;
            await onCreate(name.trim());
            setName("");
          }}
        >
          <input
            ref={field}
            className="gw-tk-create-field"
            value={name}
            maxLength={48}
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="gw-tk-create-go" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
