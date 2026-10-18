"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DevelopingImage } from "@/components/motion";
import { absoluteLink, formLink } from "@/utils/short-links";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconAlignLeft,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconCloudCheck,
  IconCloudUp,
  IconCheckbox,
  IconChevronDown,
  IconClock,
  IconShare,
  IconHash,
  IconLink,
  IconListCheck,
  IconLoader2,
  IconMail,
  IconPencil,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconSection,
  IconStar,
  IconAdjustmentsHorizontal,
  IconTrash,
  IconUpload,
  IconUserPlus,
  IconUserSearch,
  IconX,
} from "@tabler/icons-react";
import {
  ChannelPicker,
  ColorPicker,
  FieldRow,
  NumberField,
  RolePicker,
  SelectField,
  SettingsCard,
  StringListEditor,
  TextAreaField,
  TextField,
  Toggle,
  ToggleField,
} from "./fields";
import { HoverTip } from "./hover-tip";
import { ShareAccessPanel } from "./share-access-panel";
import { MessageObjectEditor, type MessageObjectValue } from "./config-message";
import { ManageProvider, useManage } from "./manage-context";
import { serializeDraft } from "./draft-storage";
import { useApplicationAutosave } from "./use-application-autosave";
import {
  ApplicationResponses,
  cleanId,
  QuestionEditor,
  QUESTION_TYPE_MENU,
} from "./sections/resources";
import type { ApplicationQuestion, GuildApplication } from "./types";
import { useSpringReorder } from "./use-spring-reorder";
import { SkeletonBlock } from "./empty-state";

function AutoGrowDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      maxLength={400}
      rows={1}
      placeholder="Your description goes here…"
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-white/60 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/25"
    />
  );
}

/** A question id guaranteed not to collide with any existing question — the
 *  only reliable way to stop duplicated questions from sharing an answer. */
function uniqueQuestionId(
  existing: ApplicationQuestion[],
  prefix = "question",
): string {
  const taken = new Set(existing.map((q) => q.id));
  let id: string;
  do {
    const rand =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    id = `${prefix}-${rand}`;
  } while (taken.has(id));
  return id;
}

const MENU_ICONS: Record<string, React.ReactNode> = {
  align: <IconAlignLeft size={15} />,
  hash: <IconHash size={15} />,
  list: <IconListCheck size={15} />,
  photo: <IconPhoto size={15} />,
  checkbox: <IconCheckbox size={15} />,
  chevron: <IconChevronDown size={15} />,
  calendar: <IconCalendar size={15} />,
  mail: <IconMail size={15} />,
  phone: <IconPhone size={15} />,
  link: <IconLink size={15} />,
  star: <IconStar size={15} />,
  clock: <IconClock size={15} />,
  slider: <IconAdjustmentsHorizontal size={15} />,
  roblox: <IconUserSearch size={15} />,
  section: <IconSection size={15} />,
};

/**
 * The "Add Question" button at the bottom of the question list. Its categorised
 * menu renders in a portal positioned against the button and clamped to the
 * viewport.
 */
export function AddQuestionMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  const place = React.useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuW = 260;
    const margin = 8;
    const measuredHeight = menuRef.current?.scrollHeight || 430;
    const desiredHeight = Math.min(measuredHeight, window.innerHeight - margin * 2);
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placeAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const available = placeAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(desiredHeight, available));
    // Center under the trigger, then clamp within an 8px viewport margin.
    let left = rect.left + rect.width / 2 - menuW / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
    const unclampedTop = placeAbove
      ? rect.top - maxHeight - margin
      : rect.bottom + margin;
    const top = Math.max(
      margin,
      Math.min(unclampedTop, window.innerHeight - maxHeight - margin),
    );
    setCoords({ left, top, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(event: MouseEvent) {
      if (
        menuRef.current?.contains(event.target as Node) ||
        btnRef.current?.contains(event.target as Node)
      )
        return;
      setOpen(false);
    }
    function onScrollResize() {
      place();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add question"
        title="Add question"
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/15 bg-white/[0.02] px-4 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:border-[rgb(var(--accent-rgb)/0.4)] hover:text-white"
      >
        <IconPlus size={16} />
        Add Question
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                left: coords.left,
                top: coords.top,
                width: 260,
                maxHeight: coords.maxHeight,
              }}
              className="popup-in fixed z-[220] origin-top overflow-y-auto overscroll-contain rounded-xl border border-white/[0.08] bg-[#101010] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            >
              {QUESTION_TYPE_MENU.map((group, gi) => (
                <div
                  key={gi}
                  className={
                    gi > 0 ? "mt-1 border-t border-white/[0.08] pt-1" : ""
                  }
                >
                  {group.group ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                      {group.group}
                    </p>
                  ) : null}
                  {group.items.map((item, ii) => (
                    <button
                      key={ii}
                      type="button"
                      onClick={() => {
                        onAdd(item.type);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-white/75 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                      <span className="text-white/45">
                        {MENU_ICONS[item.icon]}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Full-page application editor: every setting for one application, with a
 * sticky save and preview bar. Opened from the Applications tab; edits stage
 * into the shared config draft.
 */

function EditorInner({
  guildId,
  appId,
  portalBase,
}: {
  guildId: string;
  appId: string;
  /** Set when the editor runs inside the member portal — back links and
   *  submissions load through the department-scoped endpoints instead. */
  portalBase?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    value,
    pending,
    stage,
    save,
    dirty,
    saving,
    loading,
    forbidden,
    error,
    meta,
    refreshConfig,
    setNotice,
  } = useManage();
  const [tab, setTab] = useState<"form" | "settings" | "responses">("form");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bannerDragging, setBannerDragging] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  // Sharing is a modal with its own Escape handling and backdrop.
  const [shareOpen, setShareOpen] = useState(false);

  const applications: GuildApplication[] = useMemo(() => {
    const list = value("Applications.applications");
    return Array.isArray(list) ? list : [];
  }, [value]);
  const app = applications.find((item) => item.id === appId) || null;
  const departmentProfiles: any[] = useMemo(() => {
    const list = value("Department.profiles");
    return Array.isArray(list) ? list : [];
  }, [value]);
  const linkedDepartment = app
    ? departmentProfiles.find(
        (profile) =>
          profile.application_id === app.id ||
          profile.id === (app as any).department_id ||
          profile.name === (app as any).department,
      )
    : null;
  const departmentId = String(
    searchParams.get("department") ||
      (app as any)?.department_id ||
      linkedDepartment?.id ||
      "",
  );
  const departmentMode = Boolean(
    departmentId || (app as any)?.scope === "department",
  );
  const backHref = portalBase
    ? `${portalBase}?tab=resources`
    : departmentMode && departmentId
      ? `/manage/${guildId}/departments?department=${encodeURIComponent(departmentId)}&tab=resources`
      : `/manage/${guildId}/resources`;
  const shareUrl =
    typeof window !== "undefined" && app
      ? absoluteLink(
          formLink(guildId, app.id, (app as any).public_id),
          window.location.origin,
        )
      : "";
  const autosave = useApplicationAutosave({
    dirty,
    paused: loading || saving || !app || deleting,
    revision: serializeDraft(pending),
    save: () => save("Applications"),
  });

  // Delete through the config endpoint directly, clear the save prompt and
  // return to the resources list.
  const configPatchUrl = portalBase
    ? `/api${portalBase}/appconfig`
    : `/api/manage/${guildId}/config`;
  async function deleteApplication() {
    if (!app) return;
    setDeleting(true);
    setConfirmDelete(false);
    const remaining = applications.filter((item) => item.id !== app.id);
    try {
      // Delete the migrated copy first. If cleanup fails, the form remains in
      // settings and can be retried without an autosave bringing it back.
      const cleanup = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: app.id }),
      });
      if (!cleanup.ok) {
        const data = await cleanup.json().catch(() => null);
        throw new Error(data?.detail || data?.message || "The saved form resource could not be deleted. Try again.");
      }
      const response = await fetch(configPatchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set: { "Applications.applications": remaining },
          unset: [],
          module: "Applications",
        }),
      });
      if (!response.ok) throw new Error("delete failed");
      await refreshConfig();
      // Staging the now-saved value clears any pending edit for this key so the
      // save prompt never reappears with the deleted application.
      stage("Applications.applications", remaining);
      router.push(backHref);
    } catch (error) {
      setDeleting(false);
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not delete this application" });
    }
  }

  function readBannerFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) return; // keep config documents small
    const reader = new FileReader();
    reader.onload = () => patch({ banner_url: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  function patch(patchValue: Partial<GuildApplication>) {
    if (!app) return;
    stage(
      "Applications.applications",
      applications.map((item) =>
        item.id === app.id ? { ...item, ...patchValue } : item,
      ),
    );
    // Keep the module flag on so the public form endpoint doesn't 404 —
    // the bot's Discord-side editor sets this on every save too.
    stage("Modules.Applications", true);
  }

  const questions = app?.questions || [];
  const questionReorder = useSpringReorder({
    items: questions,
    getId: (question) => question.id,
    onReorder: (next) => patch({ questions: next }),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-10">
        <SkeletonBlock height="9rem" label="Loading application…" />
        <SkeletonBlock height="9rem" />
        <SkeletonBlock height="9rem" />
      </div>
    );
  }

  if (forbidden || error || !app) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Image
          src="/icon.svg"
          alt=""
          width={52}
          height={57}
          className="opacity-40"
        />
        <h2 className="text-xl font-extrabold text-[#f5f2f2]">
          {forbidden
            ? "No access to this server"
            : error
              ? "Couldn't reach the bot"
              : "Application not found"}
        </h2>
        <Link
          href={backHref}
          className="btn-pop btn-peach h-9 px-4 text-sm leading-9"
        >
          Back to {departmentMode ? "department resources" : "resources"}
        </Link>
      </div>
    );
  }

  return (
    <div className="application-editor-shell min-h-screen pb-28">
      {/* The editor stays on the default colour scheme — the department/app
          theme colour is deliberately kept out of the builder chrome. */}
      {/* Editor top bar */}
      <header className="application-editor-header sticky top-0 z-30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:gap-4 sm:px-5">
          <Link
            href={backHref}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] px-2 py-2 text-[13px] font-semibold text-white/60 transition-colors hover:border-white/20 hover:text-white sm:px-3"
          >
            <IconArrowLeft size={14} />
            <span className="hidden sm:inline">
              {departmentMode ? "Department resources" : "Resources"}
            </span>
          </Link>
          <span className="hidden h-5 w-px bg-white/[0.08] sm:block" />
          <div className="group/title relative flex min-w-0 flex-1 items-center sm:max-w-sm">
            <input
              value={app.name || ""}
              onChange={(event) => patch({ name: event.target.value })}
              aria-label="Application title"
              title="Click to rename"
              className="peer w-full min-w-0 truncate rounded-xl border border-transparent bg-transparent px-2 py-1 pr-7 text-base font-extrabold text-[#f5f2f2] outline-none transition-colors hover:border-white/[0.08] hover:bg-white/[0.02] focus:border-[color-mix(in_srgb,var(--accent-peach)_45%,transparent)] focus:bg-white/[0.02]"
            />
            <IconPencil
              size={13}
              className="pointer-events-none absolute right-2.5 text-white/0 transition-colors group-hover/title:text-white/35 peer-focus:text-white/0"
            />
          </div>
          {/* Save status — a plain inline icon (no box), tucked beside the
              title so the right cluster stays tidy. Site-style hover tooltip. */}
          <HoverTip
            side="bottom"
            align="end"
            className="ml-auto hidden shrink-0 items-center text-white/55 sm:inline-flex"
            label={saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved automatically"}
          >
            <span aria-label={saving ? "Saving" : dirty ? "Unsaved changes" : "Saved"}>
              {saving ? (
                <IconLoader2 size={15} className="animate-spin text-[var(--accent-peach)]" />
              ) : dirty ? (
                <IconCloudUp size={15} className="text-[var(--tone-warn)]" />
              ) : (
                <IconCloudCheck size={15} className="text-[var(--tone-ok)]" />
              )}
            </span>
          </HoverTip>
          {autosave.failed ? (
            <button type="button" onClick={autosave.retry} disabled={saving} className="gw-btn text-xs" role="status">
              Save failed. Retry
            </button>
          ) : null}
          {/* Share opens the same access manager as documents and spreadsheets,
             so a form can be restricted to chosen roles or people. */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent-peach)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_8%,transparent)] px-2 py-2 text-[13px] font-semibold text-[var(--accent-peach)] transition-colors hover:border-[color-mix(in_srgb,var(--accent-peach)_50%,transparent)] sm:px-3"
          >
            <IconShare size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* The tab switcher, centred on its own row under the header. */}
      <div className="application-tabs-row">
        <div className="application-tabs" role="tablist">
          {(["form", "responses", "settings"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className="application-tab"
            >
              {option === "form" ? "Questions" : option}
            </button>
          ))}
        </div>
      </div>

      {shareOpen ? (
        <ApplicationShareModal
          title="Manage Application Access"
          onClose={() => setShareOpen(false)}
        >
          <ShareAccessPanel
            resource={app}
            onChange={(next) => patch(next as Partial<GuildApplication>)}
            guildId={guildId}
            shareUrl={shareUrl}
            kindLabel="application"
            onClose={() => setShareOpen(false)}
          />
        </ApplicationShareModal>
      ) : null}

      {/* The width depends on the tab: a column (`max-w-5xl`) for Form and
         Settings, full width for Responses, which is a two-pane review
         workspace. */}
      <main
        className={`mx-auto space-y-5 px-5 py-6 ${
          tab === "responses" ? "max-w-[110rem]" : "max-w-5xl"
        }`}
      >
        {/* Banner strip — only on the Form tab (it's part of the form's look;
            Responses and Settings don't need it). */}
        <input
          ref={bannerFileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readBannerFile(file);
            event.target.value = "";
          }}
        />

        {tab === "responses" ? (
          <ApplicationResponses
            stagingEnabled={Boolean(app.staging_pipeline)}
            guildId={guildId}
            appId={app.id}
            questions={questions}
            endpoint={
              portalBase
                ? `/api${portalBase}/applicationresponses?application=${encodeURIComponent(app.id)}`
                : undefined
            }
            /* The portal reviews through its own department-gated route, with
               the same Approve and Deny buttons. */
            decisionEndpoint={
              portalBase ? `/api${portalBase}/applicationdecision` : undefined
            }
          />
        ) : null}

        {tab === "form" ? (
          <>
            {/* Application header card — banner, the themed line, then the
                title/description and collected info, all in one card. */}
            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setBannerDragging(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node))
                    setBannerDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setBannerDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) readBannerFile(file);
                }}
                data-over={bannerDragging ? "true" : undefined}
                className={`g-drop relative flex h-32 items-center justify-center ${bannerDragging ? "bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)]" : "bg-white/[0.02]"}`}
              >
                {app.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <DevelopingImage key={app.banner_url} src={app.banner_url} alt="" className="h-full w-full object-cover" />
                ) : null}
                {!bannerDragging ? (
                  <div className="absolute inline-flex items-center gap-2 rounded-xl bg-black/70 px-2 py-2 text-xs font-semibold text-white backdrop-blur">
                    <button
                      type="button"
                      onClick={() => bannerFileRef.current?.click()}
                      title="Upload a banner image (or drop one on this strip)"
                      className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      <IconUpload size={14} />
                      Upload
                    </button>
                    {app.banner_url ? (
                      <button
                        type="button"
                        onClick={() => patch({ banner_url: undefined })}
                        aria-label="Remove banner"
                        className="rounded p-1 text-white/50 hover:text-white"
                      >
                        <IconTrash size={13} />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--accent-peach)]/60 text-xs font-bold text-[var(--accent-peach)]">
                    Drop to set the banner
                  </span>
                )}
              </div>
              <div
                className="h-1.5"
                style={{ backgroundColor: app.accent_color || "#f7a8c4" }}
              />
              <div className="p-5 sm:p-6">
                <input
                  value={app.name}
                  maxLength={80}
                  placeholder="Application title"
                  onChange={(event) => patch({ name: event.target.value })}
                  aria-label="Application title"
                  className="w-full bg-transparent text-2xl font-extrabold text-[#f5f2f2] outline-none placeholder:text-white/25"
                />
                <div className="my-3 border-t border-white/[0.08]" />
                <AutoGrowDescription
                  value={app.description}
                  onChange={(description) => patch({ description })}
                />
                <div className="mt-4 space-y-2 text-sm">
                  {app.require_roblox ? (
                    <p className="flex items-center gap-2 text-white/70">
                      <IconUserPlus size={16} className="text-white/45" />
                      Roblox player information is collected from applicants
                    </p>
                  ) : null}
                  <p
                    className={`flex items-center gap-2 font-semibold ${app.responses_open !== false ? "text-[var(--tone-ok)]" : "text-white/45"}`}
                  >
                    {app.responses_open !== false ? (
                      <IconCheck size={16} />
                    ) : (
                      <IconX size={16} />
                    )}
                    {app.responses_open !== false
                      ? "Accepting Responses"
                      : "Not accepting responses"}
                  </p>
                </div>
              </div>
            </section>

            <SettingsCard
              title="Questions"
              description="Asked in order when a member applies. Drag to reorder."
            >
              {questions.length === 0 ? (
                <p className="cool-text text-sm">
                  No questions yet. Add the first one.
                </p>
              ) : (
                <div ref={questionReorder.containerRef} className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={`question-slot-${index}`}
                      data-swapy-slot={questionReorder.slotId(index)}
                      className="swapy-list-slot"
                    >
                      <div
                        data-swapy-item={questionReorder.itemId(question)}
                        className="swapy-list-item"
                      >
                        <QuestionEditor
                          question={question}
                          index={index}
                          quizMode={Boolean(app.quiz_mode)}
                          smoothReorder
                          dragging={false}
                          dropPosition={null}
                          onDragStart={() => undefined}
                          onDragEnd={() => undefined}
                          onDragOver={() => undefined}
                          onDrop={() => undefined}
                    canMoveUp={index > 0}
                    canMoveDown={index < questions.length - 1}
                    onChange={(next) => {
                      const list = [...questions];
                      list[index] = {
                        ...next,
                        id:
                          next.id ||
                          cleanId(next.question) ||
                          `question-${index + 1}`,
                      };
                      patch({ questions: list });
                    }}
                    onMove={(direction) => {
                      const list = [...questions];
                      const [moved] = list.splice(index, 1);
                      list.splice(index + direction, 0, moved);
                      patch({ questions: list });
                    }}
                    onRemove={() =>
                      patch({
                        questions: questions.filter((_, i) => i !== index),
                      })
                    }
                          onDuplicate={() => {
                      const copy = {
                        ...question,
                        id: uniqueQuestionId(questions),
                      };
                      const list = [...questions];
                      list.splice(index + 1, 0, copy);
                      patch({ questions: list });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* One "Add Question" button that opens a categorized type
                  menu; picking a type appends a question of that type. */}
              <div className="flex justify-center pt-1">
                <AddQuestionMenu
                  onAdd={(type) =>
                    patch({
                      questions: [
                        ...questions,
                        type === "section"
                          ? ({
                              id: uniqueQuestionId(questions, "section"),
                              type: "section",
                              question: "",
                            } as ApplicationQuestion)
                          : {
                              id: uniqueQuestionId(questions),
                              type,
                              question: "",
                              required: true,
                            },
                      ],
                    })
                  }
                />
              </div>
            </SettingsCard>
          </>
        ) : null}

        {tab === "settings" ? (
          <>
            {departmentMode ? (
              <SettingsCard
                title="Department join application"
                description={
                  linkedDepartment
                    ? `Use this form when people request to join ${linkedDepartment.name}. Only one join application can be active for the department.`
                    : "This application is department-scoped. Link it to a department to accept join requests."
                }
              >
                <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--accent-peach)]/20 bg-[color-mix(in_srgb,var(--accent-peach)_5%,transparent)] p-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white/80">
                      Use as the join application
                    </span>
                    <span className="cool-text mt-1 block text-xs">
                      New join requests will open this form before they are submitted.
                    </span>
                  </span>
                  <Toggle
                    checked={Boolean(linkedDepartment?.application_id === app.id)}
                    disabled={!linkedDepartment}
                    onChange={(next) => {
                      if (!linkedDepartment) return;
                      stage(
                        "Department.profiles",
                        departmentProfiles.map((profile) =>
                          profile.id === linkedDepartment.id
                            ? { ...profile, application_id: next ? app.id : null }
                            : profile.application_id === app.id
                              ? { ...profile, application_id: null }
                              : profile,
                        ),
                      );
                      patch({
                        department: linkedDepartment.name,
                        department_id: linkedDepartment.id,
                        scope: "department",
                      } as Partial<GuildApplication>);
                    }}
                  />
                </label>
              </SettingsCard>
            ) : null}

            {/* ── General: how the form accepts submissions ──────────────── */}
            <SettingsCard
              title="General"
              description="How this application accepts and stores submissions."
            >
              <div className="space-y-5">
                <ToggleField
                  label="Accepting responses"
                  description="Members can open and submit this application."
                  checked={app.responses_open !== false}
                  onChange={(next) => patch({ responses_open: next })}
                />
                <ToggleField
                  label="Allow multiple submissions"
                  description="Members may submit again even with a pending response."
                  checked={Boolean(app.allow_multiple)}
                  onChange={(next) => patch({ allow_multiple: next })}
                />
                <ToggleField
                  label="Send applicants a copy of their response"
                  description="DM the applicant a copy of their answers after they submit."
                  checked={Boolean(app.send_copy)}
                  onChange={(next) => patch({ send_copy: next })}
                />
              </div>
              <div className="mt-6 space-y-5 border-t border-white/[0.08] pt-5">
                <FieldRow
                  label="Submission cooldown (hours)"
                  description="Wait time between submissions when multiple are allowed."
                >
                  <NumberField
                    value={app.cooldown_hours ?? ""}
                    min={0}
                    onChange={(next) =>
                      patch({ cooldown_hours: next === "" ? undefined : next })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Max stored responses"
                  description="Oldest responses are pruned past this limit."
                >
                  <NumberField
                    value={app.max_logs ?? ""}
                    min={1}
                    onChange={(next) =>
                      patch({ max_logs: next === "" ? undefined : next })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Submitted message"
                  description="Shown to applicants right after they submit."
                >
                  <TextAreaField
                    rows={2}
                    value={app.submitted_message || ""}
                    maxLength={500}
                    placeholder="Thanks! We review applications within 48 hours."
                    onChange={(next) =>
                      patch({ submitted_message: next || undefined })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Closed message"
                  description="Shown when responses are closed."
                >
                  <TextAreaField
                    rows={2}
                    value={app.closed_message || ""}
                    maxLength={500}
                    placeholder="Applications are closed right now. Check back soon."
                    onChange={(next) =>
                      patch({ closed_message: next || undefined })
                    }
                  />
                </FieldRow>
              </div>
            </SettingsCard>

            {/* ── Requirements: who may apply ────────────────────────────── */}
            <SettingsCard
              title="Requirements"
              description="Gate who can open and submit this application."
            >
              <div className="space-y-5">
                <ToggleField
                  label="Require Discord membership"
                  description="Applicants must be a member of your Discord server to apply."
                  checked={Boolean(app.require_discord_member)}
                  onChange={(next) => patch({ require_discord_member: next })}
                />
                <ToggleField
                  label="Collect Roblox account"
                  description="Applicants must verify their Roblox account before starting."
                  checked={Boolean(app.require_roblox)}
                  onChange={(next) => patch({ require_roblox: next })}
                />
              </div>
              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <FieldRow
                  label="Minimum account age (days)"
                  description="How old an applicant's Discord account must be."
                >
                  <NumberField
                    value={app.min_account_age_days ?? ""}
                    min={0}
                    onChange={(next) =>
                      patch({
                        min_account_age_days: next === "" ? undefined : next,
                      })
                    }
                  />
                </FieldRow>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Appearance"
              description="Branding for the public form. The banner is set on the Form tab."
            >
              <FieldRow label="Theme color" description="Accent used across the public form and this editor.">
                <ColorPicker
                  value={app.accent_color || "#f7a8c4"}
                  onChange={(next) => patch({ accent_color: next })}
                />
              </FieldRow>
            </SettingsCard>

            <SettingsCard
              title="Review"
              description="Where this application's submissions go and who reviews them."
            >
              <div className="mb-5">
                <ToggleField
                  label="Stage responses for review"
                  description="Approved / denied responses wait in a staging phase to be finalised and released at once."
                  checked={Boolean(app.staging_pipeline)}
                  onChange={(next) => patch({ staging_pipeline: next })}
                />
              </div>
              {/* Results channel: decisions can also be posted to a channel the
                 team watches. Off by default. */}
              <div className="grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5">
                <FieldRow
                  inline
                  label="Post results to a channel"
                  description="Announce each decision in a channel as well as DMing the applicant."
                >
                  <Toggle
                    checked={Boolean(app.results_channel_enabled)}
                    onChange={(next) => patch({ results_channel_enabled: next })}
                  />
                </FieldRow>
                {app.results_channel_enabled ? (
                  <FieldRow
                    label="Results channel"
                    description="Where decisions are posted."
                  >
                    <ChannelPicker
                      channels={meta?.channels || []}
                      value={app.results_channel || null}
                      onChange={(next) => patch({ results_channel: next || undefined })}
                    />
                  </FieldRow>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5">
                <FieldRow
                  label="Review channel"
                  description="Submissions are posted here for approve / reject."
                >
                  <ChannelPicker
                    channels={meta?.channels || []}
                    value={
                      app.review_channel_id
                        ? String(app.review_channel_id)
                        : null
                    }
                    onChange={(next) =>
                      patch({
                        review_channel_id: (next as string) || undefined,
                      })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Manager roles"
                  description="Roles allowed to review this application and edit it on the dashboard."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={(app.manager_role_ids || []).map(String)}
                    onChange={(next) => {
                      // Managers are also editors: the two lists are kept in
                      // sync behind one control (back-end checks still read
                      // `editor_roles`).
                      const roles = (next as string[]) || [];
                      patch({ manager_role_ids: roles, editor_roles: roles });
                    }}
                  />
                </FieldRow>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Decisions"
              description="What happens when reviewers approve or deny."
            >
              <div className="grid grid-cols-1 gap-4">
                <FieldRow
                  label="Give roles on approval"
                  description="Granted when the application is approved."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={
                      Array.isArray(app.accept_role_ids)
                        ? app.accept_role_ids.map(String)
                        : app.accept_role_id
                          ? [String(app.accept_role_id)]
                          : []
                    }
                    onChange={(next) =>
                      patch({
                        accept_role_ids: (next as string[]) || [],
                        accept_role_id: undefined,
                      } as Partial<GuildApplication>)
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Remove roles on approval"
                  description="Taken away when the application is approved."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={(app.remove_roles_on_approval || []).map(String)}
                    onChange={(next) =>
                      patch({ remove_roles_on_approval: (next as string[]) || [] } as Partial<GuildApplication>)
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Give roles on denial"
                  description="Granted when the application is denied."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={
                      Array.isArray(app.deny_role_ids)
                        ? app.deny_role_ids.map(String)
                        : app.deny_role_id
                          ? [String(app.deny_role_id)]
                          : []
                    }
                    onChange={(next) =>
                      patch({
                        deny_role_ids: (next as string[]) || [],
                        deny_role_id: undefined,
                      } as Partial<GuildApplication>)
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Remove roles on denial"
                  description="Taken away when the application is denied."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={(app.remove_roles_on_denial || []).map(String)}
                    onChange={(next) =>
                      patch({ remove_roles_on_denial: (next as string[]) || [] } as Partial<GuildApplication>)
                    }
                  />
                </FieldRow>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5">
                {/* The decision DMs, each in a card that opens, with the
                   variables the bot substitutes and a Discord preview. The
                   value stays in the shape `decision_message` reads. */}
                <DecisionMessageCard
                  title="Approved DM"
                  hint="Sent to the applicant when their application is approved."
                  tone="approved"
                  value={asMessageObject(app.accept_message, "Congratulations! Your application was approved.")}
                  onChange={(next) => patch({ accept_message: next as never })}
                />
                <DecisionMessageCard
                  title="Denied DM"
                  hint="Sent to the applicant when their application is denied."
                  tone="denied"
                  value={asMessageObject(app.deny_message, "Thanks for applying. Unfortunately your application was not successful.")}
                  onChange={(next) => patch({ deny_message: next as never })}
                />
              </div>
              <FieldRow
                label="Response presets"
                description="Canned reviewer replies available when processing this application."
              >
                <StringListEditor
                  values={
                    Array.isArray(app.response_presets)
                      ? app.response_presets
                      : []
                  }
                  placeholder="e.g. Great detail, welcome aboard!"
                  addLabel="Add preset"
                  maxItems={25}
                  onChange={(next) => patch({ response_presets: next })}
                />
              </FieldRow>
            </SettingsCard>

            <SettingsCard
              title="Access control"
              description="Decide exactly who can open and submit this application."
            >
              <div className="grid grid-cols-1 gap-4">
                <FieldRow
                  label="Restricted to roles"
                  description="Only these roles can apply. Empty means everyone."
                >
                  <RolePicker
                    roles={meta?.roles || []}
                    multi
                    value={(app.required_roles || []).map(String)}
                    onChange={(next) =>
                      patch({ required_roles: (next as string[]) || [] })
                    }
                  />
                </FieldRow>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FieldRow
                  label="Minimum membership (days)"
                  description="Keeps brand-new members out."
                >
                  <NumberField
                    value={app.min_membership_days ?? ""}
                    min={0}
                    onChange={(next) =>
                      patch({
                        min_membership_days: next === "" ? undefined : next,
                      })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Password protection"
                  description="Applicants must enter this to start."
                >
                  <TextField
                    value={app.password || ""}
                    placeholder="Optional password"
                    onChange={(next) => patch({ password: next || undefined })}
                  />
                </FieldRow>
                <FieldRow
                  label="Required Roblox group"
                  description="Applicants must be in this group ID."
                >
                  <TextField
                    value={app.roblox_group_id || ""}
                    placeholder="Group ID"
                    onChange={(next) =>
                      patch({
                        roblox_group_id: next.replace(/\D/g, "") || undefined,
                      })
                    }
                  />
                </FieldRow>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Quiz and grading"
              description="Turn this form into a quiz with per-question points and automatic grading."
            >
              <div className="divide-y divide-white/[0.05]">
                <div className="pb-3">
                  <FieldRow
                    inline
                    label="Quiz mode"
                    description="Score answers with per-question points."
                  >
                    <Toggle
                      checked={Boolean(app.quiz_mode)}
                      onChange={(next) => patch({ quiz_mode: next })}
                    />
                  </FieldRow>
                </div>
              </div>
              {/* Automatic grading sits with quiz mode, since without a score
                 there is nothing to grade. */}
              {app.quiz_mode ? (
                <div className="pt-1">
                  <FieldRow
                    inline
                    label="Automatic grading"
                    description="Score gradable answers on submission. Off, they wait for a reviewer."
                  >
                    <Toggle
                      checked={app.auto_grade !== false}
                      onChange={(next) => patch({ auto_grade: next })}
                    />
                  </FieldRow>
                </div>
              ) : null}
              {app.quiz_mode ? (
                <div className="grid grid-cols-1 gap-4">
                  <FieldRow
                    label="Results visibility"
                    description="When applicants see their score."
                  >
                    <SelectField
                      value={app.show_results || "after_review"}
                      options={[
                        {
                          value: "immediately",
                          label: "Immediately after submitting",
                        },
                        { value: "after_review", label: "After manual review" },
                        { value: "never", label: "Never" },
                      ]}
                      onChange={(next) =>
                        patch({ show_results: next || "after_review" })
                      }
                    />
                  </FieldRow>
                  <FieldRow
                    label="Passing score"
                    description="Minimum points to pass."
                  >
                    <NumberField
                      value={app.passing_score ?? ""}
                      min={0}
                      onChange={(next) =>
                        patch({ passing_score: next === "" ? undefined : next })
                      }
                    />
                  </FieldRow>
                </div>
              ) : null}
            </SettingsCard>

            <SettingsCard
              title="Cheating detection"
              description="Flags tab-outs and pasted answers to reviewers without invading applicant privacy."
            >
              <FieldRow
                inline
                label="Cheating detection"
                description="Watches for tab-outs and pasted answers and alerts reviewers on flags."
              >
                <Toggle
                  checked={Boolean(
                    app.detect_tab_out || app.detect_paste || app.cheat_alerts,
                  )}
                  onChange={(next) =>
                    patch({
                      detect_tab_out: next,
                      detect_paste: next,
                      cheat_alerts: next,
                    })
                  }
                />
              </FieldRow>
            </SettingsCard>

            {/* Danger zone — destructive actions live at the very bottom. */}
            <section className="rounded-2xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] p-5 sm:p-6">
              <h3 className="text-sm font-extrabold text-[var(--tone-bad)]">Danger zone</h3>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-white/85">
                    Delete this application
                  </p>
                  <p className="cool-text mt-1 text-xs">
                    Removes the form and stops accepting submissions. This can&apos;t
                    be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting || Boolean(portalBase)}
                  title={portalBase ? "Delete this application from the server dashboard." : undefined}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-4 py-2 text-xs font-bold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)] disabled:opacity-50"
                >
                  <IconTrash size={14} />
                  Delete application
                </button>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {confirmDelete
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[240] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setConfirmDelete(false)}
                className="dialog-backdrop absolute inset-0 bg-black/75 backdrop-blur-sm"
              />
              <div className="dialog-pop relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#131415] p-5 shadow-[0_24px_80px_rgba(0,0,0,.7)]">
                <h3 className="text-base font-extrabold text-white/90">
                  Delete “{app.name || "this application"}”?
                </h3>
                <p className="cool-text mt-2 text-sm leading-6">
                  This permanently removes the application and its form. Existing
                  submissions stay in your logs. This can&apos;t be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white/55 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteApplication()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-wash)] px-4 py-2 text-sm font-bold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)]"
                  >
                    <IconTrash size={15} />
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Reads a decision message in either stored shape: older ones are plain
 * strings, read as the content of an otherwise empty message without migrating.
 */
function asMessageObject(
  stored: unknown,
  fallback: string,
): MessageObjectValue {
  if (stored && typeof stored === "object") return stored as MessageObjectValue;
  return { content: typeof stored === "string" && stored ? stored : fallback };
}

/** The variables the bot substitutes on a decision message. Anything not in
 *  this list is left verbatim, so offering more would be a lie. */
const DECISION_VARIABLES = [
  "{application}",
  "{status}",
  "{score}",
  "{max_score}",
  "{minimum}",
  "{reviewer}",
];

/**
 * One decision DM, edited with the same message editor as every other message:
 * it stores the same {content, embed, v2_layout} object, and the bot renders it
 * the same way.
 */
function DecisionMessageCard({
  title,
  hint,
  tone,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  tone: "approved" | "denied";
  value: MessageObjectValue;
  onChange: (next: MessageObjectValue) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="decision-message-card" data-tone={tone} data-open={open}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="decision-message-head"
      >
        <span className="decision-message-dot" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-left">
          <span className="decision-message-title">{title}</span>
          <span className="decision-message-hint">{hint}</span>
        </span>
        <IconChevronDown
          size={16}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="decision-message-body">
            <MessageObjectEditor
              module="Applications"
              value={value}
              onChange={onChange}
              variables={DECISION_VARIABLES}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal shell for the access panel — the editor has no DocumentModal of its
 *  own, and the panel expects to sit inside one. */
function ApplicationShareModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 -z-10 cursor-default"
      />
      {/* Not `manage-content`, which carries the shell's `w-full flex-1`; the
         control styling is applied to `.application-share-modal` directly. */}
      <div className="popup-in application-share-modal w-full max-w-xl rounded-2xl border p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-lg font-bold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-white/45 transition-colors hover:text-white"
          >
            <IconX size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ApplicationEditorPage({
  guildId,
  viewerId,
  appId,
  portalDepartmentId,
}: {
  guildId: string;
  viewerId: string;
  appId: string;
  /**
   * When set, the editor runs in the member portal for this department: config,
   * meta, saves and submissions go through the department-gated endpoints,
   * without Manage Server.
   */
  portalDepartmentId?: string;
}) {
  const portalBase = portalDepartmentId
    ? `/departments/${guildId}/${portalDepartmentId}`
    : undefined;
  const endpoints = portalDepartmentId
    ? {
        meta: `/api${portalBase}/appconfig?scope=meta`,
        config: `/api${portalBase}/appconfig`,
      }
    : undefined;
  return (
    <ManageProvider guildId={guildId} viewerId={viewerId} endpoints={endpoints}>
      <EditorInner guildId={guildId} appId={appId} portalBase={portalBase} />
    </ManageProvider>
  );
}
