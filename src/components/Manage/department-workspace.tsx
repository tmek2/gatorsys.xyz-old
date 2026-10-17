"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowLeft, IconCheck, IconChevronDown, IconShield } from "@tabler/icons-react";
import { useWorkspaceHost } from "./workspace-host";
import type {
  DepartmentNetwork,
  DepartmentProfile,
  DepartmentRoster,
  DepartmentViewer,
  ManagedRole,
} from "./types";
import { ActionRunModal } from "./department-workspace/actions";
import { ActivityPage } from "./department-workspace/activity-page";
import { HomePage } from "./department-workspace/home-page";
import { InfractionsPage } from "./department-workspace/infractions-page";
import { LeavePage } from "./department-workspace/leave-page";
import { ResourceViewModal } from "./department-workspace/resource-view-modal";
import { ResourcesPage } from "./department-workspace/resources-page";
import { RosterPage } from "./department-workspace/roster-page";
import { SettingsPage } from "./department-workspace/settings-page";
import { Announcement, Feature } from "./department-workspace/shared";

type Tab =
  | "home"
  | "roster"
  | "resources"
  | "activity"
  | "leave"
  | "infractions"
  | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "roster", label: "Roster" },
  { id: "resources", label: "Resources" },
  { id: "activity", label: "Activity" },
  { id: "leave", label: "Leave of Absence" },
  { id: "infractions", label: "Infractions" },
  { id: "settings", label: "Settings" },
];

export function DepartmentWorkspace({
  profile,
  roster,
  resources,
  applications = [],
  announcements,
  actionExecutions: _actionExecutions,
  viewer,
  network,
  feature,
  activity = null,
  responses = [],
  infractions = [],
  viewerInfractions = [],
  loas = [],
  viewerLoas = [],
  canViewResources = true,
  parentRoles = [],
  switcherItems = [],
  onSwitch,
  permissions,
  onStageFeature,
  onStageProfile,
  onBack,
  onRefresh,
  onGenerateJoinCode,
  onSetJoinCode,
  onCreateApplication,
  onDeleted,
  initialTab = "home",
  onTabChange,
}: {
  profile: DepartmentProfile;
  roster?: DepartmentRoster;
  resources: any[];
  applications?: any[];
  announcements: Announcement[];
  actionExecutions: any[];
  viewer: DepartmentViewer | null;
  network: DepartmentNetwork | null;
  feature: Feature;
  activity?: any;
  responses?: any[];
  infractions?: any[];
  viewerInfractions?: any[];
  loas?: any[];
  viewerLoas?: any[];
  canViewResources?: boolean;
  /** Roles of the parent server (for cross-server role mapping). */
  parentRoles?: ManagedRole[];
  /** Departments the viewer can switch to from the header. */
  switcherItems?: { id: string; name: string; logo_url?: string | null; hint?: string }[];
  onSwitch?: (id: string) => void;
  /** Department permissions of the viewer. Omit for full (admin) access. */
  permissions?: string[];
  onStageFeature: (key: string, value: any) => void;
  onStageProfile: (profile: DepartmentProfile) => void;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onGenerateJoinCode: () => Promise<string>;
  onSetJoinCode?: (code: string) => Promise<string>;
  onCreateApplication?: () => Promise<void>;
  onDeleted?: () => void;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}) {
  const { meta, guildId: hostGuildId } = useWorkspaceHost();
  const granted = useMemo(
    () => new Set(permissions ?? ["administrator"]),
    [permissions],
  );
  const can = useCallback(
    (...allowed: string[]) =>
      granted.has("administrator") ||
      allowed.some((permission) => granted.has(permission)),
    [granted],
  );
  const visibleTabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (item.id === "settings") return can();
        if (item.id === "resources") return canViewResources;
        return true;
      }),
    [can, canViewResources],
  );
  const [tab, setTab] = useState<Tab>(
    (TABS.some((item) => item.id === initialTab) ? initialTab : "home") as Tab,
  );
  useEffect(() => {
    const next = TABS.some((item) => item.id === initialTab)
      ? (initialTab as Tab)
      : "home";
    setTab(next);
  }, [initialTab, profile.id]);
  const [code, setCode] = useState(profile.join_code || "");
  const [menu, setMenu] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  const [runningAction, setRunningAction] = useState<any | null>(null);
  const [openResource, setOpenResource] = useState<any | null>(null);
  const linkedServer =
    network?.linked.find(
      (item) => String(item.id) === String(profile.discord_guild_id),
    ) || null;
  /* The channel and role lists come from the resolved linked server, or the
     parent server when none resolves, the same answer the card above uses.
     (Checking only whether the profile has a guild id disagreed with the card
     and left the pickers empty for unlinked departments.) */
  const departmentRoles = linkedServer?.roles || meta?.roles || [];
  const departmentChannels = linkedServer?.channels || meta?.channels || [];
  const websiteRankOptions: ManagedRole[] = (feature.ranks || []).map(
    (rank: any) => ({
      id: String(rank.id),
      name: rank.name || "Untitled rank",
      color: rank.color || null,
    }),
  );
  async function generate() {
    try {
      const next = await onGenerateJoinCode();
      if (next) setCode(next);
    } catch {
      /* notice handled by parent */
    }
  }
  async function setCustomCode(value: string) {
    if (!onSetJoinCode) return;
    const next = await onSetJoinCode(value);
    if (next) setCode(next);
  }
  // A department can theme its highlight; falls back to the app's peach.
  const accent = (profile as any).accent_color || null;
  return (
    <div
      className="space-y-4"
      style={
        accent
          ? ({ "--accent-peach": accent } as React.CSSProperties)
          : undefined
      }
    >
      <div className="department-workspace-hero space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/45 hover:text-white"
        >
          <IconArrowLeft size={16} />
          Departments
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div ref={switcherRef} className="relative flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => switcherItems.length > 1 && setMenu(!menu)}
            className={`flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left ${switcherItems.length > 1 ? "transition-colors hover:bg-white/[0.02]" : "cursor-default"}`}
          >
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--accent-peach)]">
                <IconShield size={21} />
              </span>
            )}
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-2xl font-extrabold text-white">
                <span className="truncate">{profile.name}</span>
                {switcherItems.length > 1 ? (
                  <IconChevronDown
                    size={16}
                    className={`shrink-0 text-white/40 transition-transform ${menu ? "rotate-180" : ""}`}
                  />
                ) : null}
              </span>
              <span className="cool-text block truncate text-[13px]">
                {profile.description ||
                  `${roster?.members || 0} member${(roster?.members || 0) === 1 ? "" : "s"}`}
              </span>
            </span>
          </button>
          {menu && switcherItems.length > 1 ? (
            <div className="absolute left-0 top-full z-40 mt-2 max-h-80 w-72 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
              {switcherItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    if (item.id !== profile.id) onSwitch?.(item.id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${item.id === profile.id ? "bg-white/[0.04]" : "hover:bg-white/[0.035]"}`}
                >
                  {item.logo_url ? (
                    <img src={item.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[var(--accent-peach)]">
                      <IconShield size={14} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white/85">
                      {item.name}
                    </span>
                    {item.hint ? (
                      <span className="cool-text block truncate text-[11px]">{item.hint}</span>
                    ) : null}
                  </span>
                  {item.id === profile.id ? (
                    <IconCheck size={14} className="ml-auto shrink-0 text-[var(--accent-peach)]" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <nav className="glass-panel flex gap-1 overflow-x-auto rounded-2xl p-2">
        {visibleTabs.map((item) => {
          // Managers see a live count of things awaiting them: roster shows
          // pending membership requests, Leave shows pending LOA requests.
          const badge =
            item.id === "roster" && can("manage_members")
              ? (roster?.membershipRequests || []).length
              : item.id === "leave" && can("loa_manager")
                ? loas.filter((entry: any) => entry.status === "pending").length
                : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                onTabChange?.(item.id);
              }}
              className={`relative flex min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition-colors ${tab === item.id ? "border border-white/[0.08] bg-white/[0.045] text-white" : "text-white/40 hover:text-white/70"}`}
            >
              {item.label}
              {badge ? (
                <span className="rounded-full bg-[var(--accent-peach)] px-2 text-[10px] font-bold text-[#1b1010]">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      </div>
      <div key={tab} className="animate-department-step">
        {tab === "home" ? (
          <HomePage
            profile={profile}
            feature={feature}
            viewer={viewer}
            roster={roster}
            announcements={announcements}
            resources={resources}
            activity={activity}
            canPost={can("post_shouts")}
            canModerate={can("manage_shouts")}
            onRefresh={onRefresh}
            onRunAction={(actionId) =>
              setRunningAction(
                (feature.actions || []).find(
                  (item: any) => item.id === actionId,
                ) || null,
              )
            }
            onOpenResource={(resourceId) => {
              const resource = resources.find((item) => item.id === resourceId);
              if (!resource) return;
              // Documents open in the full reader so every document view
              // shares one style; applications open the submit modal.
              if (resource.kind === "document") {
                window.open(
                  `/departments/${hostGuildId}/${profile.id}/doc/${resource.id}`,
                  "_blank",
                  "noopener,noreferrer",
                );
                return;
              }
              setOpenResource(resource);
            }}
            roles={websiteRankOptions}
          />
        ) : null}
        {tab === "roster" ? (
          <RosterPage
            profile={profile}
            roster={roster}
            feature={feature}
            viewerId={viewer?.id}
            can={can}
            onStage={onStageFeature}
            onRefresh={onRefresh}
            onProfile={onStageProfile}
            roles={departmentRoles}
          />
        ) : null}
        {tab === "resources" && canViewResources ? (
          <ResourcesPage
            profile={profile}
            resources={resources}
            applications={applications}
            responses={responses}
            canManage={can("manage_resources")}
            joinApplicationId={String(profile.application_id || feature.join_application_id || "")}
            onSetJoinApplication={(id) => {
              onStageFeature("join_application_id", id);
              onStageProfile({ ...profile, application_id: id || undefined });
            }}
            onRefresh={onRefresh}
            channels={departmentChannels}
            onCreateApplication={onCreateApplication}
            viewer={viewer}
          />
        ) : null}
        {tab === "activity" ? (
          <ActivityPage
            profile={profile}
            feature={feature}
            onStage={onStageFeature}
            activity={activity}
            roster={roster}
            can={can}
            onRefresh={onRefresh}
          />
        ) : null}
        {tab === "leave" ? (
          <LeavePage
            profile={profile}
            roster={roster}
            feature={feature}
            onStage={onStageFeature}
            can={can}
            loas={loas}
            viewerLoas={viewerLoas}
            viewer={viewer}
            onRefresh={onRefresh}
          />
        ) : null}
        {tab === "infractions" ? (
          <InfractionsPage
            profile={profile}
            roster={roster}
            feature={feature}
            records={infractions}
            viewerRecords={viewerInfractions}
            can={can}
            onStage={onStageFeature}
            onRefresh={onRefresh}
          />
        ) : null}
        {tab === "settings" && can() ? (
          <SettingsPage
            profile={profile}
            feature={feature}
            code={code}
            onCode={generate}
            onSetCode={onSetJoinCode ? setCustomCode : undefined}
            onStage={onStageFeature}
            onProfile={onStageProfile}
            resources={resources}
            onRefresh={onRefresh}
            linkedServer={linkedServer}
            roles={departmentRoles}
            channels={departmentChannels}
            parentRoles={parentRoles.length ? parentRoles : meta?.roles || []}
            roster={roster}
            viewer={viewer}
            onDeleted={onDeleted || onBack}
          />
        ) : null}
      </div>
      {runningAction ? (
        <ActionRunModal
          definition={runningAction}
          profileId={profile.id}
          onClose={() => setRunningAction(null)}
          onDone={onRefresh}
        />
      ) : null}
      {openResource ? (
        <ResourceViewModal
          resource={openResource}
          onClose={() => setOpenResource(null)}
        />
      ) : null}
    </div>
  );
}
