"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconClipboardList,
  IconClock,
  IconCopy,
  IconDots,
  IconFileText,
  IconLock,
  IconUserPlus,
  IconTable,
  IconCheck,
  IconLoader2,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { TextAreaField, TextField, PortalMenu, usePopover } from "../fields";
import { useManage } from "../manage-context";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { SectionHeader } from "../section-header";
import { NewResourceMenu, type NewResourceKind } from "../new-resource-menu";
import type { GuildApplication } from "../types";
import { EmptyState, SkeletonBlock } from "../empty-state";
import { cleanId } from "./resources/question-editor";

/**
 * Resources: the application builder. Edits `Applications.applications` in the
 * same Config document as the bot's /config → Templates → Applications, so
 * applications built here work in Discord immediately.
 */

/* The parts' public names, so importers keep using this path. */
export { ApplicationResponses } from "./resources/application-responses";
export { QUESTION_TYPE_MENU, QuestionEditor, cleanId } from "./resources/question-editor";

/**
 * How many resources one server may build: one ceiling across documents and
 * forms (separate limits would let a server hold many times more). It exists to
 * keep a workspace usable, not to ration.
 */
export const RESOURCE_LIMIT = 25;

/**
 * The per-card overflow menu. It sits over a card that is itself a link, so
 * every handler stops propagation (otherwise Duplicate would also navigate
 * away).
 */
/**
 * A document's opening as separate lines for its thumbnail. `document_html` is
 * the whole page, so only the start is split on block-level tags; the first
 * line is shown as a heading.
 */
function documentLines(document: any): string[] {
  const html = String(document?.document_html || "");
  const source = html.trim()
    ? html
    : `<p>${String(document?.description || "")}</p>`;
  return source
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 9)
    .map((line) => line.slice(0, 140));
}

/**
 * A spreadsheet's shape: the first few rows and columns as bars, since the
 * values are unreadable at this size.
 */
function SpreadsheetMiniMap({ rows }: { rows: unknown }) {
  const grid: unknown[][] = Array.isArray(rows) ? (rows as unknown[][]) : [];
  if (grid.length === 0) {
    return <span className="resource-preview-empty">Empty spreadsheet</span>;
  }
  const columns = Math.min(
    6,
    Math.max(...grid.slice(0, 8).map((row) => (Array.isArray(row) ? row.length : 1)), 1),
  );
  return (
    <span className="resource-preview-sheet" aria-hidden="true">
      {grid.slice(0, 7).map((row, rowIndex) => (
        <span key={rowIndex} className="resource-preview-sheet-row">
          {Array.from({ length: columns }).map((_, cell) => (
            <span
              key={cell}
              className={`resource-preview-sheet-cell ${
                rowIndex === 0 ? "is-head" : ""
              }`}
              style={{
                opacity:
                  Array.isArray(row) && String(row[cell] ?? "").trim() ? 1 : 0.28,
              }}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/* Two plain verbs, without descriptions. */
function ResourceCardMenu({
  onDuplicate,
  onDelete,
  busy,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <span ref={ref} className="resource-item-menu" onClick={stop}>
      <button
        type="button"
        aria-label="Resource actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={(event) => {
          stop(event);
          setOpen(!open);
        }}
        className="resource-item-menu-trigger"
      >
        {busy ? (
          <IconLoader2 size={15} className="animate-spin" />
        ) : (
          <IconDots size={15} />
        )}
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="card-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="card-menu-item"
              onClick={(event) => {
                stop(event);
                setOpen(false);
                onDuplicate();
              }}
            >
              <IconCopy size={15} />
              Duplicate
            </button>
            <span className="card-menu-rule" />
            <button
              type="button"
              role="menuitem"
              className="card-menu-item card-menu-item-danger"
              onClick={(event) => {
                stop(event);
                setOpen(false);
                onDelete();
              }}
            >
              <IconTrash size={15} />
              Delete
            </button>
          </div>
        </PortalMenu>
      ) : null}
    </span>
  );
}

export function ResourcesSection() {
  const { guildId, value, commit, setNotice } = useManage();

  const [serverResources, setServerResources] = useState<any[]>([]);

  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingResource, setCreatingResource] =
    useState<NewResourceKind | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [newApp, setNewApp] = useState({ id: "", name: "", description: "" });

  const allApplications: GuildApplication[] = useMemo(() => {
    const list = value("Applications.applications");
    return Array.isArray(list) ? list : [];
  }, [value]);
  const applications = useMemo(
    () =>
      allApplications.filter(
        (application) =>
          application.scope !== "department" &&
          !application.department_id &&
          !application.department,
      ),
    [allApplications],
  );

  const documents = useMemo(
    () =>
      serverResources.filter(
        (resource) =>
          !resource.department &&
          ["document", "spreadsheet"].includes(resource.kind),
      ),
    [serverResources],
  );

  const loadServerResources = useCallback(async () => {
    setResourceLoading(true);
    setResourceError(null);
    try {
      const response = await fetch(`/api/manage/${guildId}/deptresources`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.resources))
        throw new Error(data.detail || "Could not load this server's resources.");
      setServerResources(data.resources);
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : "Could not load this server's resources.");
    } finally {
      setResourceLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    void loadServerResources();
  }, [loadServerResources]);

  const resourceCount = applications.length + documents.length;

  /** Copies are named "X (copy)" so the two can be told apart in the grid. */
  function copyName(name: string) {
    return `${name} (copy)`.slice(0, 90);
  }

  async function duplicateResource(
    kind: "application" | "document",
    id: string,
  ) {
    if (resourceCount >= RESOURCE_LIMIT) {
      setNotice({
        kind: "error",
        text: `This server is at the limit of ${RESOURCE_LIMIT} resources.`,
      });
      return;
    }
    setDuplicating(id);
    try {
      if (kind === "application") {
        const source = applications.find((app) => app.id === id);
        if (!source) return;
        // Deep-copied. A shallow copy hands both forms the same `questions`
        // array, so editing one silently edits the other.
        const clone = JSON.parse(JSON.stringify(source)) as GuildApplication;
        const base = cleanId(copyName(source.name || source.id)) || "application";
        let nextId = base;
        let n = 2;
        while (applications.some((app) => app.id === nextId)) nextId = `${base}-${n++}`;
        clone.id = nextId;
        clone.name = copyName(source.name || source.id);
        // Responses stay with the original form; a copy starts empty.
        delete (clone as Record<string, unknown>).responses;
        if (!await saveApps([...applications, clone])) return;
        setNotice({ kind: "saved", text: `Duplicated ${source.name || source.id}.` });
        return;
      }

      if (kind === "document") {
        const source = serverResources.find((item) => item.id === id);
        if (!source) return;
        const clone = {
          ...JSON.parse(JSON.stringify(source)),
          id: crypto.randomUUID(),
          title: copyName(source.title || "Untitled"),
        };
        const response = await fetch(`/api/manage/${guildId}/deptresources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", resource: clone }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not duplicate");
        setServerResources(data.resources || []);
        setNotice({ kind: "saved", text: `Duplicated ${source.title}.` });
        return;
      }

    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not duplicate",
      });
    } finally {
      setDuplicating(null);
    }
  }

  /**
   * Removes one item of any kind, always behind a confirmation (none of them
   * can be recovered from here).
   */
  function confirmDelete(
    kind: "application" | "document",
    id: string,
    label: string,
  ) {
    setConfirm({
      title: `Delete ${label}?`,
      body:
        kind === "application"
          ? "The form goes, and so does every response submitted to it."
          : "The document and its version history go with it.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => void deleteResource(kind, id, label),
    });
  }

  async function deleteResource(
    kind: "application" | "document",
    id: string,
    label: string,
  ) {
    setDuplicating(id);
    try {
      if (kind === "application") {
        if (!await saveApps(applications.filter((app) => app.id !== id))) return;
        setNotice({ kind: "saved", text: `Deleted ${label}.` });
        return;
      }

      const response = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not delete");
      setServerResources(data.resources || []);
      setNotice({ kind: "saved", text: `Deleted ${label}.` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not delete",
      });
    } finally {
      setDuplicating(null);
    }
  }

  async function createDocument(kind: "document" | "spreadsheet" = "document") {
    if (creatingResource) return;
    const resource = {
      id: crypto.randomUUID(),
      department: "",
      kind,
      title: kind === "spreadsheet" ? "Untitled Spreadsheet" : "Untitled Document",
      description: "",
      document_html: "",
      spreadsheet_data: [],
      subdocuments: [],
      active_document_id: "root",
    };
    setCreatingResource(kind);
    try {
      const response = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", resource }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `Could not create ${kind}`);
      }
      setServerResources(data.resources || []);
      window.location.assign(`/manage/${guildId}/resources/${resource.id}`);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : `Could not create ${kind}`,
      });
      setCreatingResource(null);
    }
  }

  /**
   * One entry point for everything the `+ New` menu offers; each kind lands in
   * its own group on the page. Folders and gators are listed but not built yet,
   * and say so when chosen.
   */
  async function createResource(kind: NewResourceKind) {
    // One ceiling across all kinds, checked before anything is created; the
    // message says what is full.
    if (resourceCount >= RESOURCE_LIMIT) {
      setNotice({
        kind: "error",
        text: `This server is at the limit of ${RESOURCE_LIMIT} resources. Delete something before adding another.`,
      });
      return;
    }
    if (kind === "document" || kind === "spreadsheet") {
      await createDocument(kind);
      return;
    }
    if (kind === "application") {
      setCreating(true);
      return;
    }
    setNotice({
      kind: "error",
      text:
        kind === "folder"
          ? "Folders are coming. Resources are a flat list for now."
          : "Create a department to organize this server.",
    });
  }

  // No filter tabs: the workspace shows everything this server has built on one
  // page.
  const resourceHero = (
    <div className="resource-workspace-hero">
      <SectionHeader
        title="Resources"
        actions={
          <span className="flex items-center gap-3">
            {/* Quiet until it matters. A counter on an empty workspace is a
                limit announcing itself before anybody has met it. */}
            {resourceCount >= RESOURCE_LIMIT - 5 ? (
              <span
                className={`text-[12px] font-semibold tabular-nums ${
                  resourceCount >= RESOURCE_LIMIT
                    ? "text-[var(--tone-bad)]"
                    : "text-white/40"
                }`}
              >
                {resourceCount}/{RESOURCE_LIMIT}
              </span>
            ) : null}
            <NewResourceMenu
              busyKind={creatingResource}
              onCreate={createResource}
              disabled={resourceCount >= RESOURCE_LIMIT || resourceLoading || Boolean(resourceError)}
            />
          </span>
        }
      />
    </div>
  );

  function saveApps(next: GuildApplication[]): Promise<boolean> {
    const departmentApplications = allApplications.filter(
      (application) =>
        application.scope === "department" ||
        Boolean(application.department_id || application.department),
    );
    // The bot's public form 404s unless the module flag is on; Discord-side
    // saves set it too, so mirror that here.
    return commit({
      "Applications.applications": [...next, ...departmentApplications],
      "Modules.Applications": true,
    }, "Resources");
  }

  /**
   * One empty state for the whole workspace, shown only when there is nothing
   * in it.
   */
  const workspaceEmpty = resourceCount === 0;

  return (
    <div className="space-y-6">
      {resourceHero}

      {resourceLoading ? (
        // Applications come from the config draft and documents from their own
        // fetch; one skeleton covers both so the page does not appear
        // half-loaded.
        <SkeletonBlock height="10rem" label="Loading gator…" />
      ) : resourceError ? (
        <div role="alert" className="gw-set rounded-xl p-5">
          <p>{resourceError}</p>
          <button type="button" className="gw-btn mt-3" onClick={() => void loadServerResources()}>Retry loading resources</button>
        </div>
      ) : workspaceEmpty ? (
        <EmptyState
          title="Nothing built yet"
          doodle="folder"
          hint="Start one from New."
        />
      ) : (
        // One grid with no group headers; every card names its own kind. Fixed
        // kind order rather than sorted, because applications have no timestamp
        // and a mixed sort would shuffle.
        <div className="resource-grid">
          {applications.map((app) => (
            <div key={`application-${app.id}`} className="resource-item card-in">
              <ResourceCardMenu
                busy={duplicating === app.id}
                onDuplicate={() => void duplicateResource("application", app.id)}
                onDelete={() =>
                  confirmDelete("application", app.id, app.name || app.id)
                }
              />
              {/* The card shows a preview of the thing, so you can tell which
                 one it is. */}
              <Link
                href={`/manage/${guildId}/applications/${app.id}`}
                className="resource-preview resource-preview-application"
                style={{
                  ["--preview-accent" as string]: app.accent_color || "#f7a8c4",
                }}
              >
                <span className="resource-preview-inner">
                  <span className="resource-preview-rule" />
                  <span className="resource-preview-title">
                    {app.name || app.id}
                  </span>
                  <span className="resource-preview-underline" />
                  {app.require_roblox ? (
                    <span className="resource-preview-note">
                      <IconUserPlus size={13} />
                      Roblox player information is collected
                    </span>
                  ) : null}
                  <span
                    className={`resource-preview-note ${
                      app.responses_open === false
                        ? "resource-preview-note-off"
                        : "resource-preview-note-on"
                    }`}
                  >
                    {app.responses_open === false ? (
                      <>
                        <IconLock size={13} />
                        Closed to responses
                      </>
                    ) : (
                      <>
                        <IconCheck size={13} />
                        Accepting responses
                      </>
                    )}
                  </span>
                </span>
              </Link>
              <Link
                href={`/manage/${guildId}/applications/${app.id}`}
                className="resource-item-head"
              >
                <span className="resource-item-icon">
                  <IconClipboardList size={19} />
                </span>
                <span className="min-w-0">
                  <span className="resource-item-title">
                    {app.name || app.id}
                  </span>
                  <span className="resource-item-sub">
                    <IconClock size={12} />
                    {(app.questions || []).length} question
                    {(app.questions || []).length === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            </div>
          ))}

          {documents.map((document) => (
            <div key={`document-${document.id}`} className="resource-item card-in">
              <ResourceCardMenu
                busy={duplicating === document.id}
                onDuplicate={() =>
                  void duplicateResource("document", document.id)
                }
                onDelete={() =>
                  confirmDelete(
                    "document",
                    document.id,
                    document.title || "this document",
                  )
                }
              />
            <Link
              href={`/manage/${guildId}/resources/${document.id}`}
              className="resource-item-link"
            >
              <span className="resource-preview resource-preview-document">
                <span className="resource-preview-inner">
                  {/* A preview of the page itself (descriptions are usually
                     blank). */}
                  {document.kind === "spreadsheet" ? (
                    <SpreadsheetMiniMap rows={document.spreadsheet_data} />
                  ) : (
                    (() => {
                      const lines = documentLines(document);
                      if (lines.length === 0) {
                        return (
                          <span className="resource-preview-empty">
                            Empty document
                          </span>
                        );
                      }
                      const [heading, ...body] = lines;
                      return (
                        <span className="resource-preview-page">
                          <span className="resource-preview-page-head">
                            {heading}
                          </span>
                          {body.map((line, index) => (
                            <span
                              key={index}
                              className="resource-preview-page-line"
                            >
                              {line}
                            </span>
                          ))}
                        </span>
                      );
                    })()
                  )}
                </span>
              </span>
              <span className="resource-item-head">
                <span className="resource-item-icon">
                  {document.kind === "spreadsheet" ? (
                    <IconTable size={19} />
                  ) : (
                    <IconFileText size={19} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="resource-item-title">{document.title}</span>
                  <span className="resource-item-sub">
                    <IconClock size={12} />
                    {document.kind === "spreadsheet"
                      ? "Spreadsheet"
                      : "Document"}
                    {document.department ? ` · ${document.department}` : ""}
                  </span>
                </span>
              </span>
            </Link>
            </div>
          ))}
        </div>
      )}

      {creating ? (
        <div className="gator-overlay fixed inset-0 z-[110] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              setCreating(false);
              setNewApp({ id: "", name: "", description: "" });
            }}
            className="dialog-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="dialog-pop relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <h3 className="text-base font-extrabold text-[#f5f2f2]">
              New application
            </h3>
            <p className="cool-text mt-1 text-[13px]">
              Give it a title and a short description to get started.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-white/80">
                  Title
                </label>
                <TextField
                  value={newApp.name}
                  placeholder="Staff Application"
                  maxLength={80}
                  onChange={(next) => setNewApp({ ...newApp, name: next })}
                />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-white/80">
                  Description
                </label>
                <TextAreaField
                  rows={3}
                  value={newApp.description}
                  maxLength={2000}
                  placeholder="What is this application for?"
                  onChange={(next) =>
                    setNewApp({ ...newApp, description: next })
                  }
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewApp({ id: "", name: "", description: "" });
                }}
                className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newApp.name.trim() || Boolean(creatingResource)}
                onClick={async () => {
                  if (creatingResource) return;
                  const base = cleanId(newApp.name) || "application";
                  let id = base;
                  let n = 2;
                  while (applications.some((app) => app.id === id))
                    id = `${base}-${n++}`;
                  setCreatingResource("application");
                  const saved = await saveApps([
                    ...applications,
                    {
                      id,
                      name: newApp.name.trim(),
                      description: newApp.description.trim(),
                      emoji: "",
                      questions: [],
                    },
                  ]);
                  setCreatingResource(null);
                  if (!saved) return;
                  setNewApp({ id: "", name: "", description: "" });
                  setCreating(false);
                  window.location.href = `/manage/${guildId}/applications/${id}`;
                }}
                className="btn-pop btn-peach h-9 px-4 text-sm disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
