"use client";

import React, { useEffect, useRef, useState } from "react";
import { absoluteLink, departmentResourceLink, formLink, resourceLink } from "@/utils/short-links";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { IconBook2, IconCheck, IconClipboard, IconLink, IconTable } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { PreviewText } from "../embed-editor";
import { DepartmentDocumentEditor } from "../department-document-editor";
import { DepartmentSpreadsheetEditor } from "../department-spreadsheet-editor";
import { DEPARTMENT_RESOURCE_OPTIONS, NewResourceMenu } from "../new-resource-menu";
import type { DepartmentProfile, DepartmentViewer, ManagedChannel } from "../types";
import { ApplicationEditorScreen } from "./application-editor-screen";
import { ResourceLibrary } from "./resource-library";
import { timeAgo } from "./shared";

/* The Resources tab. */

/** Outlined crown marking a member who outranks the rank system: the server
 *  owner/admin, the department's owner, or an assigned co-owner (shield). */
/**
 * Renders an application or panel emoji: a custom Discord emoji token
 * (`<:name:id>` / `<a:name:id>`) as its CDN image, a unicode emoji as text,
 * otherwise a fallback icon.
 */
function ResourceEmoji({
  emoji,
  fallback,
}: {
  emoji?: string | null;
  fallback: React.ReactNode;
}) {
  if (!emoji) return <>{fallback}</>;
  const custom = String(emoji).match(/^<(a?):(\w+):(\d+)>$/);
  if (custom)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] ? "gif" : "png"}?size=44`}
        alt=""
        className="h-5 w-5 object-contain"
      />
    );
  return <span>{emoji}</span>;
}

export function ResourcesPage({
  profile,
  resources,
  applications = [],
  responses = [],
  canManage = true,
  joinApplicationId = "",
  onSetJoinApplication,
  onRefresh,
  channels,
  onCreateApplication,
  viewer,
}: {
  profile: DepartmentProfile;
  resources: any[];
  applications?: any[];
  responses?: any[];
  canManage?: boolean;
  joinApplicationId?: string;
  onSetJoinApplication?: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  channels: ManagedChannel[];
  onCreateApplication?: () => Promise<void>;
  viewer?: DepartmentViewer | null;
}) {
  const { guildId, setNotice, portalBase } = useWorkspaceHost();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  // Which option is spinning. The shared menu shows the spinner on the row
  // that was clicked rather than on the trigger, so it has to know which.
  const [creatingKind, setCreatingKind] = useState<string | null>(null);
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null);
  const [deepLinkResponse, setDeepLinkResponse] = useState<string | null>(null);
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<string>>(
    () => new Set(),
  );
  // Application resources not yet migrated to the `applications` list are still
  // shown.
  const migratedApplicationIds = new Set(
    (applications || []).map((app: any) => String(app.id)),
  );
  const contentResources = resources.filter(
    (resource) =>
      (resource.kind !== "application" ||
        !migratedApplicationIds.has(String(resource.id))) &&
      !optimisticallyDeleted.has(String(resource.id)),
  );
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    // Deep links: `?tab=resources&app=X&response=Y` opens that submission (the
    // copyable response link); `?edit=X` opens a document or spreadsheet in the
    // editor (the read-only viewer redirects editors here).
    if (deepLinkHandled.current || !canManage || !contentResources.length) return;
    const editId = searchParams.get("edit");
    if (editId) {
      const editTarget = contentResources.find((item) => item.id === editId);
      if (editTarget) {
        deepLinkHandled.current = true;
        setEditing(editTarget);
        return;
      }
    }
    const appId = searchParams.get("app");
    if (!appId) return;
    deepLinkHandled.current = true;
    const target = contentResources.find((item) => item.id === appId);
    if (!target) return;
    setDeepLinkResponse(searchParams.get("response"));
    setEditing(target);
  }, [canManage, contentResources, searchParams]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const documentUrl = (resource: any) =>
    String(resource.share?.access || "link") === "link"
      ? absoluteLink(resourceLink("document", guildId, resource.id), origin)
      : absoluteLink(departmentResourceLink("document", guildId, profile.id, resource.id), origin);
  async function mutate(
    body: any,
    options: { quiet?: boolean; notice?: string } = {},
  ) {
    const response = await fetch(`/api/manage/${guildId}/deptresources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({
        kind: "error",
        text: data.detail || "Could not update department resources",
      });
      return null;
    }
    if (!options.quiet) {
      await onRefresh();
      setNotice({
        kind: "saved",
        text: options.notice || "Department resources updated",
      });
    }
    return data;
  }
  async function createResource(kind: string) {
    if (kind === "application") {
      // Applications are their own record, not a row in the resource list, so
      // the parent owns creating one.
      if (!onCreateApplication) return;
      setCreatingKind("application");
      setCreating(true);
      await onCreateApplication().finally(() => {
        setCreating(false);
        setCreatingKind(null);
      });
      return;
    }
    if (kind !== "document" && kind !== "spreadsheet") return;
    setCreatingKind(kind);
    setCreating(true);
    const resource = {
      id: crypto.randomUUID(),
      department: profile.id,
      kind,
      // Only these two reach here; an application returns above, because it is
      // its own record rather than a row in this list.
      title: kind === "spreadsheet" ? "Untitled Spreadsheet" : "Untitled Document",
      description: "",
      questions: [],
      document_html: "",
      spreadsheet_data: [],
      channel_id: "",
    };
    const result = await mutate(
      { action: "save", resource },
      { notice: `Blank ${kind} created` },
    );
    setCreating(false);
    setCreatingKind(null);
    if (result) setEditing(resource);
  }
  async function deleteResource(resource: any) {
    const id = String(resource.id);
    setOptimisticallyDeleted((current) => new Set(current).add(id));
    if (String(editing?.id || "") === id) setEditing(null);
    const result = await mutate(
      { action: "delete", id: resource.id },
      { notice: `Deleted ${resource.title}` },
    );
    if (!result) {
      setOptimisticallyDeleted((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setEditing(resource);
      return;
    }
    setOptimisticallyDeleted((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }
  function copyLink(resource: any) {
    void navigator.clipboard.writeText(documentUrl(resource));
    setCopiedResourceId(String(resource.id));
    window.setTimeout(() => setCopiedResourceId(null), 1600);
  }
  if (!canManage)
    return (
      <ResourceLibrary
        profile={profile}
        resources={resources}
        applications={applications}
        initialOpenId={searchParams.get("app")}
        onRefresh={onRefresh}
      />
    );
  return (
    <div className="space-y-4">
      {(
        <>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Resources</h2>
              <p className="cool-text mt-1 text-xs">
                Documents and applications for your department. Open an
                application to review its submissions.
              </p>
            </div>
            <NewResourceMenu
              options={DEPARTMENT_RESOURCE_OPTIONS}
              busyKind={creating ? creatingKind : null}
              onCreate={createResource}
            />
          </div>
          {applications.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {applications.map((application) => (
                <article
                  key={application.id}
                  onClick={() => {
                    window.location.href = portalBase
                      ? `${portalBase}/application/${application.id}`
                      : `/manage/${guildId}/applications/${application.id}?department=${profile.id}`;
                  }}
                  className="group relative flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#131415] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-[0_20px_55px_rgba(0,0,0,.28)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg text-[var(--accent-peach)]">
                    <ResourceEmoji emoji={application.emoji} fallback={<IconClipboard size={17} />} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-5 text-white/85">{application.name || "Untitled Application"}</p>
                    <div className="cool-text line-clamp-1 text-xs leading-5 [&_p]:m-0">
                      <PreviewText text={application.description || "Department application"} />
                    </div>
                  </div>
                  <span className="group/copy relative shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigator.clipboard.writeText(
                          absoluteLink(
                            formLink(guildId, application.id, application.public_id),
                            origin,
                          ),
                        );
                        setCopiedResourceId(String(application.id));
                        window.setTimeout(() => setCopiedResourceId(null), 1600);
                      }}
                      className="rounded-xl p-2 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white"
                      aria-label={`Copy responses link for ${application.name || "this application"}`}
                    >
                      {copiedResourceId === String(application.id) ? (
                        <IconCheck size={15} className="text-[var(--tone-ok)]" />
                      ) : (
                        <IconLink size={15} />
                      )}
                    </button>
                    <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-2 py-1 text-[10px] font-semibold text-white/75 shadow-xl group-hover/copy:block">
                      {copiedResourceId === String(application.id) ? "Copied!" : "Copy responses link"}
                    </span>
                  </span>
                </article>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contentResources.map((resource) => (
              <article
                key={resource.id}
                onClick={() => setEditing(resource)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-[#131415] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-[0_20px_55px_rgba(0,0,0,.28)]"
              >
                <div className="relative h-16 border-b border-[var(--accent-peach)]/80 bg-[linear-gradient(145deg,#232323,#141414)]">
                  <span className="absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#131415] text-[var(--accent-peach)] shadow-[0_6px_18px_rgba(0,0,0,.35)]">
                    {resource.kind === "spreadsheet" ? (
                      <IconTable size={18} />
                    ) : resource.kind === "application" ? (
                      <IconClipboard size={18} />
                    ) : (
                      <IconBook2 size={18} />
                    )}
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-bold text-white/85">
                    {resource.title}
                  </p>
                  <p className="cool-text mt-1 line-clamp-2 text-xs leading-5">
                    {resource.description || "Department resource"}
                  </p>
                  {/* Quiet corner actions with hover tags — the card itself opens the editor. */}
                  <div className="absolute right-3 top-[4.25rem] flex items-center gap-1">
                    {resource.kind === "application" ? (
                      <span className="group/copy relative">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard.writeText(
                              `${origin}/departments/${guildId}/${profile.id}?tab=resources&app=${resource.id}`,
                            );
                            setCopiedResourceId(String(resource.id));
                            window.setTimeout(() => setCopiedResourceId(null), 1600);
                          }}
                          className="rounded-xl p-2 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white"
                          aria-label={`Copy responses link for ${resource.title}`}
                        >
                          {copiedResourceId === String(resource.id) ? (
                            <IconCheck size={15} className="text-[var(--tone-ok)]" />
                          ) : (
                            <IconLink size={15} />
                          )}
                        </button>
                        <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-2 py-1 text-[10px] font-semibold text-white/75 shadow-xl group-hover/copy:block">
                          {copiedResourceId === String(resource.id)
                            ? "Copied!"
                            : "Copy responses link"}
                        </span>
                      </span>
                    ) : null}
                    {resource.kind === "document" ? (
                      <span className="group/copy relative">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            copyLink(resource);
                          }}
                          className="rounded-xl p-2 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white"
                          aria-label={`Copy link to ${resource.title}`}
                        >
                          {copiedResourceId === String(resource.id) ? (
                            <IconCheck size={15} className="text-[var(--tone-ok)]" />
                          ) : (
                            <IconLink size={15} />
                          )}
                        </button>
                        <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-2 py-1 text-[10px] font-semibold text-white/75 shadow-xl group-hover/copy:block">
                          {copiedResourceId === String(resource.id)
                            ? "Copied!"
                            : "Copy document link"}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-peach)]/20 bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
                      {resource.kind === "application"
                        ? `Application · ${(resource.questions || []).length} questions`
                        : resource.kind === "spreadsheet"
                          ? "Spreadsheet"
                          : "Document"}
                    </span>
                    <span className="cool-text text-[10px]">
                      Updated {timeAgo(resource.updated_at || resource.created_at)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
            {!contentResources.length && !applications.length ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center md:col-span-2 xl:col-span-3">
                <p className="text-sm font-bold text-white/70">No resources yet</p>
                <p className="cool-text mt-1 text-xs">
                  Use the Create button to add your first application or document.
                </p>
              </div>
            ) : null}
          </div>
        </>
      )}
      {editing?.kind === "document"
        ? createPortal(
            <div>
            <DepartmentDocumentEditor
              resource={editing}
              shareUrl={documentUrl(editing)}
              onChange={setEditing}
              onSave={async () => {
                const saved = await mutate({ action: "save", resource: editing }, { quiet: true });
                if (!saved) throw new Error("Could not save this document. Try again.");
              }}
              onClose={() => {
                setEditing(null);
                void onRefresh();
              }}
              onDelete={async () => {
                await deleteResource(editing);
              }}
              onPresence={async (typing) => {
                const result = await mutate(
                  { action: "presence", id: editing.id, typing },
                  { quiet: true },
                );
                return result?.presence || [];
              }}
            />
            </div>,
            document.body,
          )
        : editing?.kind === "spreadsheet"
          ? createPortal(
              <div>
              <DepartmentSpreadsheetEditor
                resource={editing}
                guildId={guildId}
                viewer={viewer ? { id: viewer.id, name: viewer.name } : null}
                onChange={setEditing}
                onSave={async () => {
                  const saved = await mutate({ action: "save", resource: editing }, { quiet: true });
                  if (!saved) throw new Error("Could not save this spreadsheet. Try again.");
                }}
                onClose={() => {
                  setEditing(null);
                  void onRefresh();
                }}
                onDelete={async () => {
                  await deleteResource(editing);
                }}
              />
              </div>,
              document.body,
            )
          : editing
          ? createPortal(
              <div>
              <ApplicationEditorScreen
                resource={editing}
                profile={profile}
                channels={channels}
                responses={responses.filter(
                  (item: any) => item.resource_id === editing.id,
                )}
                resources={resources}
                isJoinApplication={joinApplicationId === editing.id}
                onSetJoinApplication={onSetJoinApplication}
                initialResponseId={deepLinkResponse}
                onChange={setEditing}
                onSave={async () => {
                  const result = await mutate(
                    { action: "save", resource: editing },
                    { quiet: true },
                  );
                  return Boolean(result);
                }}
                onClose={() => {
                  setEditing(null);
                  void onRefresh();
                }}
                onDelete={async () => {
                  await mutate(
                    { action: "delete", id: editing.id },
                    { notice: `Deleted ${editing.title}` },
                  );
                  setEditing(null);
                }}
                onRefresh={onRefresh}
              />
              </div>,
              document.body,
            )
        : null}
    </div>
  );
}
