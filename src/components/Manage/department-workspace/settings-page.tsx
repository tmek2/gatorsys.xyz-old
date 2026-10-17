"use client";

import React, { useState } from "react";
import { DevelopingImage } from "@/components/motion";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconLink,
  IconListCheck,
  IconPlus,
  IconRefresh,
  IconServer,
  IconTrash,
} from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import {
  ChannelPicker,
  ColorPicker,
  FieldRow,
  MultiSelectField,
  RolePicker,
  SelectField,
  SettingsCard,
  TextAreaField,
  TextField,
  Toggle,
} from "../fields";
import { MemberAvatar } from "../member-avatar";
import type { ApplicationQuestion } from "../types";
import type {
  DepartmentProfile,
  DepartmentRoster,
  DepartmentViewer,
  LinkedDepartmentServer,
  ManagedChannel,
  ManagedRole,
} from "../types";
import { ActionEditorModal } from "./actions";
import { Feature, Subnav, inputClass } from "./shared";

/* The Settings tab. */

function departmentPublicSlug(profile: DepartmentProfile) {
  return (
    String(profile.name || profile.id)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || profile.id
  );
}

export function SettingsPage({
  profile,
  feature,
  code,
  onCode,
  onSetCode,
  onStage,
  onProfile,
  resources,
  onRefresh,
  linkedServer,
  roles,
  channels,
  parentRoles = [],
  roster,
  viewer,
  onDeleted,
}: {
  profile: DepartmentProfile;
  feature: Feature;
  code: string;
  onCode: () => Promise<void>;
  onSetCode?: (code: string) => Promise<void>;
  onStage: (key: string, value: any) => void;
  onProfile: (profile: DepartmentProfile) => void;
  resources: any[];
  onRefresh: () => Promise<void>;
  linkedServer: LinkedDepartmentServer | null;
  roles: ManagedRole[];
  channels: ManagedChannel[];
  parentRoles?: ManagedRole[];
  roster?: DepartmentRoster;
  viewer?: DepartmentViewer | null;
  onDeleted?: () => void;
}) {
  const { meta, guildId, setNotice, refreshConfig } = useWorkspaceHost();
  const [unlinkWarning, setUnlinkWarning] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState<null | "waves_reset" | "department_delete">(null);
  const [dangerText, setDangerText] = useState("");
  const ownerId = String(profile.created_by || viewer?.departmentOwnerId || "");
  const coOwnerIds = (profile.manager_ids || [])
    .map(String)
    .filter((id) => id && id !== ownerId);
  const [coOwnerCandidates, setCoOwnerCandidates] = useState<string[]>([]);
  const [ownerBusy, setOwnerBusy] = useState(false);
  async function updateCoOwner(memberIds: string[], enabled: boolean) {
    if (!memberIds.length) return;
    setOwnerBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "owner_update",
          department_id: profile.id,
          member_ids: memberIds,
          enabled,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Could not update co-owner");
      setNotice({ kind: "saved", text: data.message || "Co-owner updated" });
      setCoOwnerCandidates([]);
      await refreshConfig();
      await onRefresh();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not update co-owner",
      });
    } finally {
      setOwnerBusy(false);
    }
  }
  async function runDanger(action: "waves_reset" | "department_delete") {
    setDangerBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, department_id: profile.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Action failed");
      setNotice({ kind: "saved", text: data.message || "Done" });
      setDangerConfirm(null);
      setDangerText("");
      if (action === "department_delete") {
        await refreshConfig();
        onDeleted?.();
      } else {
        await onRefresh();
      }
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed",
      });
    } finally {
      setDangerBusy(false);
    }
  }
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinLinkCopied, setJoinLinkCopied] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [customCodeBusy, setCustomCodeBusy] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const publicSlug = departmentPublicSlug(profile);
  const [sub, setSub] = useState("General Settings");
  const [actionOpen, setActionOpen] = useState(false);
  /** The action being edited, or null when creating a new one. */
  const [actionEditingId, setActionEditingId] = useState<string | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState<any>({
    label: "",
    type: "link",
    url: "",
    action_id: null,
    resource_id: null,
  });
  const [actionDraft, setActionDraft] = useState({
    name: "",
    description: "",
    channel_id: "",
    required_ranks: [] as string[],
    questions: [] as ApplicationQuestion[],
  });
  const pinned = feature.pinned_buttons || [];
  const discord = feature.discord || {};
  const departmentRanks: ManagedRole[] = (feature.ranks || []).map(
    (rank: any) => ({
      id: String(rank.id),
      name: rank.name || "Untitled rank",
      color: rank.color || null,
    }),
  );
  return (
    <div className="space-y-4">
      <Subnav
        items={[
          "General Settings",
          "Discord Integration",
          "Roster Settings",
          "Actions",
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === "General Settings" ? (
        <>
          <SettingsCard
            title="Department Name"
            description="The name displayed throughout Gator."
          >
            <TextField
              value={profile.name}
              maxLength={80}
              onChange={(name) => onProfile({ ...profile, name })}
            />
          </SettingsCard>
          <SettingsCard
            title="Description"
            description="Shown under the department name across the dashboard."
          >
            <TextAreaField
              value={(profile as any).description || ""}
              onChange={(description) =>
                onProfile({ ...profile, description } as any)
              }
              rows={3}
              placeholder="What this department is responsible for"
            />
          </SettingsCard>
          <SettingsCard
            title="Highlight Color"
            description="The accent color used for highlights across this department."
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full max-w-xs">
                <ColorPicker
                  value={(profile as any).accent_color || "#f7a8c4"}
                  onChange={(accent_color) =>
                    onProfile({ ...profile, accent_color } as any)
                  }
                  label="Choose department highlight color"
                />
              </div>
              {(profile as any).accent_color ? (
                <button
                  type="button"
                  onClick={() =>
                    onProfile({ ...profile, accent_color: null } as any)
                  }
                  className="text-xs font-semibold text-white/45 hover:text-white"
                >
                  Reset to default
                </button>
              ) : null}
              <span className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] px-3 py-1 text-[11px] font-bold text-[var(--accent-peach)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-peach)]" />
                Preview
              </span>
            </div>
          </SettingsCard>
          {viewer?.isDepartmentOwner ? (
            <SettingsCard
              title="Department Co-owners"
              description="Co-owners receive full department management access, but only you can delete or deactivate the department."
            >
              <div className="space-y-2">
                {coOwnerIds.map((id) => {
                  const member = roster?.memberRows?.find(
                    (item) => String(item.id) === id,
                  );
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
                      {member?.avatar ? (
                        <MemberAvatar src={member.avatar} name={member.name} className="h-8 w-8" />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-white/[0.06]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/80">
                          {member?.name || id}
                        </p>
                        <p className="cool-text truncate text-[11px]">
                          {member?.username ? `@${member.username}` : "Department co-owner"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={ownerBusy}
                        onClick={() => void updateCoOwner([id], false)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)] disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {!coOwnerIds.length ? (
                  <p className="cool-text py-2 text-sm">No co-owners assigned.</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <MultiSelectField
                    value={coOwnerCandidates}
                    onChange={setCoOwnerCandidates}
                    placeholder="Select department members"
                    options={(roster?.memberRows || [])
                    .filter(
                      (member) =>
                        !member.owner &&
                        String(member.id) !== ownerId &&
                        !coOwnerIds.includes(String(member.id)),
                    )
                    .map((member) => ({
                      value: String(member.id),
                      label: member.name,
                      description: member.username
                        ? `@${member.username}`
                        : undefined,
                      icon: member.avatar ? (
                        <img
                          src={discordAvatarUrl(member.avatar) || ""}
                          alt=""
                          className="h-6 w-6 rounded-xl object-cover"
                        />
                      ) : undefined,
                    }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={!coOwnerCandidates.length || ownerBusy}
                  onClick={() => void updateCoOwner(coOwnerCandidates, true)}
                  className="btn-pop btn-peach shrink-0 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Add{coOwnerCandidates.length ? ` ${coOwnerCandidates.length}` : ""} co-owner{coOwnerCandidates.length === 1 ? "" : "s"}
                </button>
              </div>
            </SettingsCard>
          ) : null}
          <SettingsCard
            title="Department Icon"
            description="The icon displayed throughout the department."
          >
            <div className="flex items-center gap-3">
              {profile.logo_url ? (
                <DevelopingImage
                  key={profile.logo_url}
                  src={profile.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/[0.04]" />
              )}
              <label className="btn-pop btn-peach cursor-pointer px-4 py-2 text-xs">
                Upload icon
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      setNotice({
                        kind: "error",
                        text: "Choose a department icon smaller than 1 MB",
                      });
                      event.currentTarget.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      onProfile({
                        ...profile,
                        logo_url: String(reader.result || ""),
                      });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          </SettingsCard>
          <SettingsCard
            title="Pinned Buttons"
            description="Pin forms, documents, actions, and links to the department Home page."
            actions={
              <button
                type="button"
                onClick={() => setPinnedOpen(true)}
                className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs"
              >
                <IconPlus size={14} />
                Create new
              </button>
            }
          >
            <div className="space-y-3">
              {pinned.map((button: any, index: number) => (
                <div
                  key={button.id}
                  className="grid gap-2 rounded-xl border border-white/[0.08] p-3 md:grid-cols-[1fr_180px_1fr_auto]"
                >
                  <input
                    value={button.label}
                    onChange={(event) =>
                      onStage(
                        "pinned_buttons",
                        pinned.map((item: any, i: number) =>
                          i === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                  <SelectField
                    value={button.type}
                    onChange={(value) =>
                      onStage(
                        "pinned_buttons",
                        pinned.map((item: any, i: number) =>
                          i === index
                            ? { ...item, type: value || "link" }
                            : item,
                        ),
                      )
                    }
                    options={[
                      { value: "link", label: "Link" },
                      { value: "form", label: "Gator Form" },
                      { value: "document", label: "Gator Document" },
                      { value: "action", label: "Gator Action" },
                    ]}
                  />
                  {button.type === "action" ? (
                    <SelectField
                      value={button.action_id || null}
                      onChange={(action_id) =>
                        onStage(
                          "pinned_buttons",
                          pinned.map((item: any, i: number) =>
                            i === index ? { ...item, action_id } : item,
                          ),
                        )
                      }
                      options={(feature.actions || []).map((item: any) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      placeholder="Select an action"
                    />
                  ) : button.type === "form" || button.type === "document" ? (
                    <SelectField
                      value={button.resource_id || null}
                      onChange={(resource_id) =>
                        onStage(
                          "pinned_buttons",
                          pinned.map((item: any, i: number) =>
                            i === index ? { ...item, resource_id } : item,
                          ),
                        )
                      }
                      options={resources
                        .filter((item) =>
                          button.type === "form"
                            ? item.kind === "application"
                            : item.kind === "document",
                        )
                        .map((item) => ({ value: item.id, label: item.title }))}
                      placeholder="Select a resource"
                    />
                  ) : (
                    <input
                      value={button.url || ""}
                      onChange={(event) =>
                        onStage(
                          "pinned_buttons",
                          pinned.map((item: any, i: number) =>
                            i === index
                              ? { ...item, url: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="https://"
                      className={inputClass}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onStage(
                        "pinned_buttons",
                        pinned.filter((_: any, i: number) => i !== index),
                      )
                    }
                    className="p-2 text-white/30 hover:text-[var(--tone-bad)]"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          </SettingsCard>
          {pinnedOpen
            ? createPortal(
                <div className="gator-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                    onClick={() => setPinnedOpen(false)}
                    aria-label="Close"
                  />
                  <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
                    <h3 className="text-lg font-extrabold text-white">
                      Create pinned button
                    </h3>
                    <p className="cool-text mt-1 text-sm">
                      Add a named shortcut to the department Home page.
                    </p>
                    <div className="mt-5 space-y-4">
                      <FieldRow label="Button label">
                        <TextField
                          value={pinnedDraft.label}
                          onChange={(label) =>
                            setPinnedDraft({ ...pinnedDraft, label })
                          }
                          placeholder="Arrest logs"
                        />
                      </FieldRow>
                      <FieldRow label="Type">
                        <SelectField
                          value={pinnedDraft.type}
                          onChange={(type) =>
                            setPinnedDraft({
                              ...pinnedDraft,
                              type: type || "link",
                              action_id: null,
                              resource_id: null,
                            })
                          }
                          options={[
                            { value: "link", label: "Link" },
                            { value: "form", label: "Gator Form" },
                            { value: "document", label: "Gator Document" },
                            { value: "action", label: "Gator Action" },
                          ]}
                        />
                      </FieldRow>
                      {pinnedDraft.type === "action" ? (
                        <FieldRow label="Action">
                          <SelectField
                            value={pinnedDraft.action_id}
                            onChange={(action_id) =>
                              setPinnedDraft({ ...pinnedDraft, action_id })
                            }
                            options={(feature.actions || []).map(
                              (item: any) => ({
                                value: item.id,
                                label: item.name,
                              }),
                            )}
                            placeholder="Select an action"
                          />
                        </FieldRow>
                      ) : pinnedDraft.type === "form" ||
                        pinnedDraft.type === "document" ? (
                        <FieldRow label="Resource">
                          <SelectField
                            value={pinnedDraft.resource_id}
                            onChange={(resource_id) =>
                              setPinnedDraft({ ...pinnedDraft, resource_id })
                            }
                            options={resources
                              .filter((item) =>
                                pinnedDraft.type === "form"
                                  ? item.kind === "application"
                                  : item.kind === "document",
                              )
                              .map((item) => ({
                                value: item.id,
                                label: item.title,
                              }))}
                            placeholder="Select a resource"
                          />
                        </FieldRow>
                      ) : (
                        <FieldRow label="URL">
                          <TextField
                            value={pinnedDraft.url}
                            onChange={(url) =>
                              setPinnedDraft({ ...pinnedDraft, url })
                            }
                            placeholder="https://"
                          />
                        </FieldRow>
                      )}
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPinnedOpen(false)}
                        className="px-3 py-2 text-sm text-white/55"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!pinnedDraft.label.trim()}
                        onClick={() => {
                          onStage("pinned_buttons", [
                            ...pinned,
                            { id: crypto.randomUUID(), ...pinnedDraft },
                          ]);
                          setPinnedDraft({
                            label: "",
                            type: "link",
                            url: "",
                            action_id: null,
                            resource_id: null,
                          });
                          setPinnedOpen(false);
                        }}
                        className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-35"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          <SettingsCard
            title="Join Code"
            description="Your department's unique join code used for member invites."
          >
            {/* Masked code with a reveal toggle. */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
              <button
                type="button"
                onClick={() => setShowJoinCode((value) => !value)}
                aria-label={showJoinCode ? "Hide code" : "Show code"}
                className="rounded-lg p-1 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {showJoinCode ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
              <span className="font-mono text-sm font-bold tracking-[0.22em] text-white">
                {code ? (showJoinCode ? code : "•".repeat(Math.min(code.length, 8))) : "Not generated"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!code}
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                  setCodeCopied(true);
                  window.setTimeout(() => setCodeCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${codeCopied ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "border-white/[0.08] text-white/70 hover:border-white/20 hover:text-white"}`}
              >
                {codeCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {codeCopied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                disabled={!code}
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${window.location.origin}/departments/join/${code}`,
                  );
                  setJoinLinkCopied(true);
                  window.setTimeout(() => setJoinLinkCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${joinLinkCopied ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "border-white/[0.08] text-white/70 hover:border-white/20 hover:text-white"}`}
              >
                {joinLinkCopied ? <IconCheck size={14} /> : <IconLink size={14} />}
                {joinLinkCopied ? "Copied!" : "Copy Join Link"}
              </button>
              <button
                type="button"
                onClick={onCode}
                className="btn-pop inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/20 hover:text-white"
              >
                <IconRefresh size={14} />
                Regenerate
              </button>
            </div>
            {onSetCode ? (
              <div className="mt-4 border-t border-white/[0.08] pt-3">
                <p className="text-sm font-bold text-white/85">Custom Join Code</p>
                <p className="cool-text mt-1 text-xs">
                  Set a custom, memorable join code for your department (e.g. your department name).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={customCode}
                    maxLength={20}
                    onChange={(event) =>
                      setCustomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    placeholder="e.g., FHP"
                    className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 font-mono text-xs uppercase tracking-[0.14em] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25"
                  />
                  <button
                    type="button"
                    disabled={customCode.trim().length < 3 || customCodeBusy}
                    onClick={async () => {
                      setCustomCodeBusy(true);
                      try {
                        await onSetCode(customCode.trim());
                        setCustomCode("");
                      } finally {
                        setCustomCodeBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                  >
                    Set Custom Code
                  </button>
                </div>
                <p className="cool-text mt-2 text-[11px]">
                  Custom codes are 3 to 20 letters or numbers and must be unique (first come, first served).
                </p>
              </div>
            ) : null}
          </SettingsCard>
          <SettingsCard
            title="Public Department Page"
            description="An opt-in public page with your roster summary and link-shared documents. Great for recruitment."
          >
            <label className="flex items-center gap-3">
              <Toggle
                checked={Boolean(feature.public_page_enabled)}
                onChange={(value) => onStage("public_page_enabled", value)}
              />
              <span className="text-sm text-white/70">
                {feature.public_page_enabled
                  ? "Public page is enabled"
                  : "Public page is disabled"}
              </span>
            </label>
            {feature.public_page_enabled ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-[11px] text-white/50">
                  {typeof window === "undefined"
                    ? ""
                    : `${window.location.origin}/p/${guildId}/${publicSlug}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/p/${guildId}/${publicSlug}`,
                    );
                    setPublicLinkCopied(true);
                    window.setTimeout(() => setPublicLinkCopied(false), 2000);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${publicLinkCopied ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "border-white/[0.08] text-white/65 hover:text-white"}`}
                >
                  {publicLinkCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {publicLinkCopied ? "Copied!" : "Copy"}
                </button>
                <a
                  href={`/p/${guildId}/${publicSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/65 hover:text-white"
                >
                  <IconExternalLink size={14} />
                  Open
                </a>
              </div>
            ) : null}
          </SettingsCard>
          <SettingsCard
            title="Danger Zone"
            description="These actions can permanently affect department data."
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDangerConfirm("waves_reset")}
                className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
              >
                Reset activity waves
              </button>
              {viewer?.isDepartmentOwner ? (
                <button
                  type="button"
                  onClick={() => setDangerConfirm("department_delete")}
                  className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
                >
                  Delete department
                </button>
              ) : null}
            </div>
            {dangerConfirm ? (
              <div className="mt-4 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] p-4">
                <p className="text-sm font-bold text-[var(--tone-bad)]">
                  {dangerConfirm === "waves_reset"
                    ? "Reset all activity waves?"
                    : `Delete ${profile.name} permanently?`}
                </p>
                <p className="cool-text mt-1 text-xs leading-5">
                  {dangerConfirm === "waves_reset"
                    ? "Every activity wave and every recorded shift will be deleted. Members, resources, and announcements are not affected."
                    : "The roster, ranks, announcements, resources, shifts, and settings of this department will be permanently deleted. This cannot be undone."}
                </p>
                {dangerConfirm === "department_delete" ? (
                  <input
                    value={dangerText}
                    onChange={(event) => setDangerText(event.target.value)}
                    placeholder={`Type "${profile.name}" to confirm`}
                    className={`${inputClass} mt-3`}
                  />
                ) : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDangerConfirm(null);
                      setDangerText("");
                    }}
                    className="px-3 py-2 text-xs text-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      dangerBusy ||
                      (dangerConfirm === "department_delete" &&
                        dangerText.trim() !== profile.name)
                    }
                    onClick={() => void runDanger(dangerConfirm)}
                    className="rounded-xl bg-[var(--tone-bad)] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {dangerBusy
                      ? "Working…"
                      : dangerConfirm === "waves_reset"
                        ? "Reset waves"
                        : "Delete department"}
                  </button>
                </div>
              </div>
            ) : null}
          </SettingsCard>
        </>
      ) : null}
      {sub === "Discord Integration" ? (
        <>
          <SettingsCard
            title="Linked Discord Server"
            description="Department channels, role automation, and member updates use this server."
          >
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-4">
              {linkedServer?.icon ? (
                <img
                  src={linkedServer.icon}
                  alt=""
                  className="h-12 w-12 rounded-2xl border border-white/[0.08] object-cover shadow-lg"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[var(--accent-peach)]">
                  <IconServer size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-extrabold text-white/80">
                    {linkedServer?.name || meta?.guild.name || "Parent server"}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${linkedServer?.reachable !== false ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"}`}
                  >
                    {linkedServer?.reachable !== false
                      ? "Connected"
                      : "Unavailable"}
                  </span>
                </div>
                <p className="cool-text mt-1 text-xs">
                  {linkedServer
                    ? "This department uses its linked Discord server."
                    : "No separate server is linked, so this department uses the parent server."}
                </p>
              </div>
              {linkedServer && profile.discord_guild_id ? (
                <button
                  type="button"
                  onClick={() => setUnlinkWarning(true)}
                  className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)]"
                >
                  Unlink
                </button>
              ) : null}
            </div>
            <div className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.08] bg-white/[0.02]">
              {[
                ["Department members", `${roster?.members ?? 0}`],
                ["Department ranks", `${(feature.ranks || []).length}`],
                ["Resources", `${resources.length}`],
                ["Pending requests", `${(roster?.membershipRequests || []).length}`],
                ["Server ID", String(linkedServer?.id || meta?.guild.id || "Not linked")],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="cool-text text-xs">{label}</span>
                  <span className="truncate pl-4 text-xs font-bold text-white/75">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {unlinkWarning ? (
              <div className="mt-4 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] p-4">
                <p className="text-sm font-bold text-[var(--tone-bad)]">
                  This cannot be undone
                </p>
                <p className="cool-text mt-1 text-xs">
                  All linked Discord channels and roles will be reset.
                  Department announcements, resources, applications, documents,
                  and history will remain.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setUnlinkWarning(false)}
                    className="px-3 py-2 text-xs text-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const response = await fetch(
                        `/api/manage/${guildId}/departmentlink`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "unlink",
                            guild_id: profile.discord_guild_id,
                          }),
                        },
                      );
                      const data = await response.json();
                      if (!response.ok) {
                        setNotice({
                          kind: "error",
                          text: data.detail || "Could not unlink server",
                        });
                        return;
                      }
                      setUnlinkWarning(false);
                      await Promise.all([refreshConfig(), onRefresh()]);
                      setNotice({
                        kind: "saved",
                        text: "Discord server unlinked; linked roles and channels were reset",
                      });
                    }}
                    className="rounded-xl bg-[var(--tone-bad)] px-3 py-2 text-xs font-bold text-white"
                  >
                    Unlink and reset Discord links
                  </button>
                </div>
              </div>
            ) : null}
          </SettingsCard>
          <SettingsCard
            title="Channel Configuration"
            description="Choose where department events are sent."
          >
            <div className="space-y-4">
              {[
                ["shouts_channel_id", "Shouts channel"],
                ["shift_logs_channel_id", "Shift logs channel"],
                ["audit_logs_channel_id", "Audit logs channel"],
                ["leave_channel_id", "Leave of absence channel"],
                ["activity_channel_id", "Activity end wave channel"],
              ].map(([key, label]) => (
                <FieldRow key={key} label={label}>
                  <ChannelPicker
                    channels={channels}
                    value={discord[key] ? String(discord[key]) : null}
                    onChange={(value) =>
                      onStage("discord", { ...discord, [key]: value })
                    }
                  />
                </FieldRow>
              ))}
            </div>
          </SettingsCard>
          <SettingsCard
            title="Role & Nickname Automation"
            description="Apply Discord roles and nickname prefixes during shifts and leave."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["on_shift_role_id", "On shift role"],
                ["on_break_role_id", "On break role"],
                ["loa_role_id", "LOA role"],
              ].map(([key, label]) => (
                <FieldRow key={key} label={label}>
                  <RolePicker
                    roles={roles}
                    value={discord[key] ? String(discord[key]) : null}
                    onChange={(value) =>
                      onStage("discord", { ...discord, [key]: value })
                    }
                  />
                </FieldRow>
              ))}
              <FieldRow label="On shift nickname prefix">
                <TextField
                  value={discord.on_shift_nickname || ""}
                  onChange={(value) =>
                    onStage("discord", { ...discord, on_shift_nickname: value })
                  }
                />
              </FieldRow>
              <FieldRow label="On LOA nickname prefix">
                <TextField
                  value={discord.loa_nickname || ""}
                  onChange={(value) =>
                    onStage("discord", { ...discord, loa_nickname: value })
                  }
                />
              </FieldRow>
            </div>
          </SettingsCard>
        </>
      ) : null}
      {sub === "Role Linking" ? (
        <SettingsCard
          title="Discord role linking"
          description={
            linkedServer
              ? `Link roles between ${meta?.guild.name || "the main server"} and ${linkedServer.name || "the linked server"}. When a trigger role is given in the main server, the mapped roles are applied in the department server.`
              : "Link this department to its own Discord server first. Role linking maps roles between the main server and the department server."
          }
          actions={
            <button
              type="button"
              onClick={() =>
                onStage("cross_role_links", [
                  ...(feature.cross_role_links || []),
                  {
                    id: crypto.randomUUID(),
                    trigger_guild_id: guildId,
                    target_guild_id: linkedServer?.id || guildId,
                    trigger_role_ids: [],
                    target_role_ids: [],
                  },
                ])
              }
              className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs"
            >
              <IconPlus size={14} />
              New mapping
            </button>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {(feature.cross_role_links || []).map((mapping: any, index: number) => (
              <div
                key={mapping.id || index}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[rgb(var(--accent-rgb)/.1)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent-peach)]">
                    Mapping
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onStage(
                        "cross_role_links",
                        (feature.cross_role_links || []).filter(
                          (_: any, i: number) => i !== index,
                        ),
                      )
                    }
                    className="rounded-xl p-2 text-white/30 hover:text-[var(--tone-bad)]"
                    aria-label="Delete mapping"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
                <p className="mt-3 text-sm font-bold text-white/80">
                  When one of these roles are given…
                </p>
                <div className="mt-2 space-y-2">
                  <SelectField
                    value={String(mapping.trigger_guild_id || guildId)}
                    options={[
                      {
                        value: guildId,
                        label: meta?.guild.name || "Parent server",
                        description: "Parent server",
                      },
                      ...(linkedServer?.id
                        ? [{
                            value: String(linkedServer.id),
                            label: linkedServer.name || "Linked server",
                            description: "Department server",
                          }]
                        : []),
                    ]}
                    onChange={(value) =>
                      onStage(
                        "cross_role_links",
                        (feature.cross_role_links || []).map(
                          (item: any, i: number) =>
                            i === index
                              ? {
                                  ...item,
                                  trigger_guild_id: value || guildId,
                                  trigger_role_ids: [],
                                }
                              : item,
                        ),
                      )
                    }
                    placeholder="Choose trigger server"
                  />
                  <RolePicker
                    roles={
                      String(mapping.trigger_guild_id || guildId) ===
                      String(linkedServer?.id || "")
                        ? linkedServer?.roles || []
                        : parentRoles
                    }
                    multi
                    value={mapping.trigger_role_ids || []}
                    onChange={(value) =>
                      onStage(
                        "cross_role_links",
                        (feature.cross_role_links || []).map(
                          (item: any, i: number) =>
                            i === index
                              ? { ...item, trigger_role_ids: value as string[] }
                              : item,
                        ),
                      )
                    }
                    placeholder="Add trigger role"
                  />
                </div>
                <p className="mt-4 text-sm font-bold text-white/80">…apply these roles</p>
                <div className="mt-2 space-y-2">
                  <SelectField
                    value={String(
                      mapping.target_guild_id || linkedServer?.id || guildId,
                    )}
                    options={[
                      {
                        value: guildId,
                        label: meta?.guild.name || "Parent server",
                        description: "Parent server",
                      },
                      ...(linkedServer?.id
                        ? [{
                            value: String(linkedServer.id),
                            label: linkedServer.name || "Linked server",
                            description: "Department server",
                          }]
                        : []),
                    ]}
                    onChange={(value) =>
                      onStage(
                        "cross_role_links",
                        (feature.cross_role_links || []).map(
                          (item: any, i: number) =>
                            i === index
                              ? {
                                  ...item,
                                  target_guild_id:
                                    value || linkedServer?.id || guildId,
                                  target_role_ids: [],
                                }
                              : item,
                        ),
                      )
                    }
                    placeholder="Choose target server"
                  />
                  <RolePicker
                    roles={
                      String(
                        mapping.target_guild_id || linkedServer?.id || guildId,
                      ) === String(linkedServer?.id || "")
                        ? linkedServer?.roles || []
                        : parentRoles
                    }
                    multi
                    value={mapping.target_role_ids || []}
                    onChange={(value) =>
                      onStage(
                        "cross_role_links",
                        (feature.cross_role_links || []).map(
                          (item: any, i: number) =>
                            i === index
                              ? { ...item, target_role_ids: value as string[] }
                              : item,
                        ),
                      )
                    }
                    placeholder="Add target role"
                  />
                </div>
              </div>
            ))}
            {!(feature.cross_role_links || []).length ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] py-10 text-center lg:col-span-2">
                <IconLink size={22} className="mx-auto text-white/20" />
                <p className="cool-text mt-2 text-sm">
                  No role mappings yet. Create one to sync roles between servers.
                </p>
              </div>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}
      {sub === "Roster Settings" ? (
        <>
          <SettingsCard
            title="Roster behavior"
            description="Configure automatic member handling."
          >
            <label className="flex items-center gap-3">
              <Toggle
                checked={Boolean(feature.discord_autokick)}
                onChange={(value) => onStage("discord_autokick", value)}
              />
              <span>
                <span className="block text-sm font-semibold text-white/75">
                  Discord autokick
                </span>
                <span className="cool-text text-xs">
                  Remove members from the department when they leave its linked
                  Discord server.
                </span>
              </span>
            </label>
          </SettingsCard>
        </>
      ) : null}
      {sub === "Actions" ? (
        <>
          <SettingsCard
            title="Department Actions"
            description="Create permission-controlled forms and actions members can run from Home."
            actions={
              <button
                type="button"
                onClick={() => setActionOpen(true)}
                className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs"
              >
                <IconPlus size={14} />
                Create action
              </button>
            }
          >
            <div className="mt-4 space-y-2">
              {/* The row opens the action for editing. */}
              {(feature.actions || []).map((action: any) => (
                <div
                  key={action.id}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.08] transition-colors hover:border-white/[0.16]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActionDraft({
                        name: action.name || "",
                        description: action.description || "",
                        channel_id: action.channel_id || "",
                        required_ranks: action.required_ranks || [],
                        questions: action.questions || [],
                      });
                      setActionEditingId(action.id);
                      setActionOpen(true);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                  >
                    <IconListCheck
                      size={17}
                      className="shrink-0 text-[var(--accent-peach)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white/75">
                        {action.name}
                      </span>
                      <span className="cool-text block truncate text-xs">
                        {action.description || "Department action"}
                      </span>
                    </span>
                    <span className="cool-text ml-auto shrink-0 pl-3 text-[11px] opacity-0 transition-opacity group-hover:opacity-100">
                      Edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onStage(
                        "actions",
                        feature.actions.filter(
                          (item: any) => item.id !== action.id,
                        ),
                      )
                    }
                    aria-label={`Delete ${action.name || "action"}`}
                    className="mr-3 shrink-0 text-white/25 hover:text-[var(--tone-bad)]"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
            </div>
          </SettingsCard>
          {actionOpen ? (
            <ActionEditorModal
              draft={actionDraft}
              setDraft={setActionDraft}
              roles={departmentRanks}
              channels={channels}
              editing={Boolean(actionEditingId)}
              onClose={() => {
                setActionOpen(false);
                setActionEditingId(null);
              }}
              onCreate={() => {
                const existing = feature.actions || [];
                onStage(
                  "actions",
                  actionEditingId
                    ? existing.map((item: any) =>
                        item.id === actionEditingId
                          ? { ...item, ...actionDraft }
                          : item,
                      )
                    : [...existing, { id: crypto.randomUUID(), ...actionDraft }],
                );
                setActionDraft({
                  name: "",
                  description: "",
                  channel_id: "",
                  required_ranks: [],
                  questions: [],
                });
                setActionEditingId(null);
                setActionOpen(false);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
