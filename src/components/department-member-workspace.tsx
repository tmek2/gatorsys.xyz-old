"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { DepartmentWorkspace } from "@/components/Manage/department-workspace";
import { WorkspaceHostProvider } from "@/components/Manage/workspace-host";
import {
  belongsToDepartment,
  departmentPermissions,
} from "@/components/Manage/department-workspace-props";
import type { DepartmentProfile } from "@/components/Manage/types";

type Notice = { kind: "saved" | "error"; text: string };

const PORTAL_TABS = new Set([
  "home",
  "roster",
  "resources",
  "activity",
  "leave",
  "infractions",
  "settings",
]);

const TAB_PAYLOAD_FIELDS: Record<string, (keyof PortalData)[]> = {
  home: ["rosters", "announcements", "resources", "canViewResources"],
  roster: ["rosters"],
  resources: ["resources", "applications", "responses", "canViewResources"],
  activity: ["rosters", "activity"],
  leave: ["rosters", "loas", "viewerLoas"],
  infractions: ["rosters", "infractions", "viewerInfractions"],
  settings: [
    "rosters",
    "resources",
    "applications",
    "network",
    "parentRoles",
    "parentChannels",
    "canViewResources",
  ],
};

type PortalData = {
  profiles: DepartmentProfile[];
  rosters: any[];
  announcements: any[];
  resources: any[];
  applications?: any[];
  actionExecutions: any[];
  activity: any;
  responses: any[];
  infractions: any[];
  viewerInfractions: any[];
  loas: any[];
  viewerLoas: any[];
  canViewResources?: boolean;
  parentRoles: any[];
  /** Sent alongside parentRoles; the portal's only source of channels. */
  parentChannels?: any[];
  network: any;
  feature: Record<string, any>;
  viewer?: {
    id?: string;
    name?: string;
    avatar?: string;
    permissions?: string[];
  };
};

/**
 * Member portal for one department: the department workspace (tabs, roster,
 * resources, activity, settings), with every editing surface gated by the
 * viewer's department permissions. Edits save through the member-safe feature
 * endpoint, so department managers do not need Manage Server.
 */
export function DepartmentMemberWorkspace({
  parentId,
  departmentId,
}: {
  parentId: string;
  departmentId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "home";
  const activeTab = PORTAL_TABS.has(requestedTab) ? requestedTab : "home";
  const [data, setData] = useState<PortalData | null>(null);
  const [myDepartments, setMyDepartments] = useState<
    { parentId: string; departmentId: string; name: string; logo_url?: string | null; serverName?: string; viaAdmin?: boolean }[]
  >([]);
  const [error, setError] = useState("");
  const loadedTabs = useRef(new Set<string>());
  /** Monotonic id of the newest load, so older responses can be discarded. */
  const loadTicket = useRef(0);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const setNotice = useCallback((next: Notice | null) => {
    setNoticeState(next);
    clearTimeout(noticeTimer.current);
    if (next) noticeTimer.current = setTimeout(() => setNoticeState(null), 4000);
  }, []);

  // Local optimistic copies of the editable state, layered over the fetch.
  const [feature, setFeature] = useState<Record<string, any>>({});
  const [profile, setProfile] = useState<DepartmentProfile | null>(null);

  // Debounced auto-save of staged feature/profile edits.
  const pendingSave = useRef<{
    feature: Record<string, any>;
    profile: Record<string, any>;
  }>({ feature: {}, profile: {} });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const load = useCallback(async (tab = activeTab) => {
    // Per-tab responses can overlap when the tab changes mid-request (e.g. back
    // navigation restoring ?tab=), so a sequence number makes the older
    // response lose.
    const ticket = ++loadTicket.current;
    const stale = () => ticket !== loadTicket.current;
    let response: Response;
    try {
      response = await fetch(
        `/api/departments/${parentId}/${departmentId}?include=${encodeURIComponent(tab)}`,
        { cache: "no-store" },
      );
    } catch (reason) {
      // A failed tab stays unmarked, so returning to it retries.
      loadedTabs.current.delete(tab);
      throw reason;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      loadedTabs.current.delete(tab);
      throw new Error(
        body.detail || body.message || "Could not load this department",
      );
    }
    if (stale()) return;
    setData((previous) => {
      if (!previous) return body;
      const next = {
        ...previous,
        profiles: body.profiles || previous.profiles,
        viewer: body.viewer || previous.viewer,
        feature: body.feature || previous.feature,
      } as PortalData;
      for (const field of TAB_PAYLOAD_FIELDS[tab] || []) {
        if (field in body) (next as any)[field] = body[field];
      }
      return next;
    });
    // Keeps `feature` and `profile` when a tab's payload does not carry them
    // (the render gate is `!data || !profile`, so a null profile would show the
    // spinner forever).
    if (body.feature) setFeature(body.feature);
    const nextProfile = body.profiles?.[0];
    if (nextProfile) setProfile(nextProfile);
    loadedTabs.current.add(tab);
  }, [activeTab, departmentId, parentId]);

  useEffect(() => {
    loadedTabs.current.clear();
  }, [departmentId, parentId]);

  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    load().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load this department",
      ),
    );
  }, [activeTab, load]);

  useEffect(() => {
    // Cross-server switcher: every department this user belongs to.
    fetch("/api/departments/mine", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setMyDepartments(body?.departments || []))
      .catch(() => setMyDepartments([]));
  }, []);

  const flushSave = useCallback(async () => {
    const payload = pendingSave.current;
    if (
      !Object.keys(payload.feature).length &&
      !Object.keys(payload.profile).length
    )
      return;
    pendingSave.current = { feature: {}, profile: {} };
    try {
      const response = await fetch(
        `/api/departments/${parentId}/${departmentId}/feature`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || "Could not save");
      setNotice({ kind: "saved", text: "Changes saved" });
    } catch (reason) {
      setNotice({
        kind: "error",
        text: reason instanceof Error ? reason.message : "Could not save",
      });
      await load().catch(() => undefined);
    }
  }, [departmentId, load, parentId, setNotice]);

  const queueSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave(), 900);
  }, [flushSave]);

  const stageFeature = useCallback(
    (key: string, value: any) => {
      setFeature((current) => ({ ...current, [key]: value }));
      pendingSave.current.feature[key] = value;
      queueSave();
    },
    [queueSave],
  );

  const stageProfile = useCallback(
    (next: DepartmentProfile) => {
      setProfile((current) => {
        const editable = [
          "name",
          "description",
          "logo_url",
          "banner_url",
          "accent_color",
          "join_role_id",
          "rank_roles",
        ] as const;
        for (const key of editable) {
          if (
            JSON.stringify((next as any)[key]) !==
            JSON.stringify((current as any)?.[key])
          ) {
            pendingSave.current.profile[key] = (next as any)[key];
          }
        }
        return next;
      });
      queueSave();
    },
    [queueSave],
  );

  /* The parent server's roles and channels, which the workspace falls back to
     when a department has no separate linked server (the common case). The
     department payload carries both lists (`parentRoles`, `parentChannels`). */
  const host = useMemo(
    () => ({
      guildId: parentId,
      meta: data
        ? ({
            guild: {
              id: String(parentId),
              name: data.network?.hubGuildName || "Parent server",
              icon: null,
              memberCount: 0,
              ownerId: "",
            },
            me: { id: "", isAdmin: false, isOwner: false },
            roles: data.parentRoles || [],
            channels: data.parentChannels || [],
            emojis: [],
            modules: {},
          } as any)
        : null,
      setNotice,
      refreshConfig: load,
      portalBase: `/departments/${parentId}/${departmentId}`,
    }),
    [data, departmentId, load, parentId, setNotice],
  );

  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] p-6 text-white">
        <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
          <p className="text-sm font-bold">{error}</p>
          <Link
            href="/servers"
            className="btn-pop btn-peach mt-5 inline-flex px-4 py-2 text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  if (!data || !profile)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <IconLoader2 className="animate-spin text-white/35" />
      </main>
    );
  return (
    <main className="min-h-screen bg-[#080808] px-5 pb-12 pt-8 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <WorkspaceHostProvider value={host}>
          <DepartmentWorkspace
            profile={profile}
            roster={data.rosters?.[0]}
            resources={(data.resources || []).filter((item: any) =>
              belongsToDepartment(item, profile),
            )}
            applications={data.applications || []}
            announcements={(data.announcements || []).filter(
              (item: any) => item.department_id === profile.id,
            )}
            actionExecutions={data.actionExecutions || []}
            viewer={(data.viewer as any) || null}
            network={data.network || null}
            feature={feature}
            activity={data.activity}
            responses={data.responses || []}
            infractions={data.infractions || []}
            viewerInfractions={data.viewerInfractions || []}
            loas={data.loas || []}
            viewerLoas={data.viewerLoas || []}
            canViewResources={data.canViewResources !== false}
            parentRoles={data.parentRoles || []}
            switcherItems={myDepartments.map((item) => ({
              id:
                item.parentId === parentId && item.departmentId === departmentId
                  ? profile.id
                  : `${item.parentId}/${item.departmentId}`,
              name: item.name,
              logo_url: item.logo_url,
              hint: item.viaAdmin
                ? `${item.serverName ? `${item.serverName} · ` : ""}Admin access`
                : item.serverName,
            }))}
            onSwitch={(id) => router.push(`/departments/${id}`)}
            permissions={departmentPermissions(data.viewer as any, false) ?? []}
            onStageFeature={stageFeature}
            onStageProfile={stageProfile}
            onBack={() => router.push("/servers")}
            onRefresh={load}
            onCreateApplication={async () => {
              // Same unified application system as server manage, created
              // through the department-permission-gated portal endpoint.
              const id = crypto.randomUUID();
              const response = await fetch(
                `/api/departments/${parentId}/${departmentId}/appconfig`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    set: {
                      "Applications.applications": [
                        ...(data.applications || []),
                        {
                          id,
                          name: "Untitled Application",
                          description: "",
                          questions: [],
                          enabled: true,
                          department: profile.name,
                          department_id: profile.id,
                          scope: "department",
                        },
                      ],
                    },
                  }),
                },
              );
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                setNotice({
                  kind: "error",
                  text:
                    body.detail ||
                    body.message ||
                    "Could not create the application",
                });
                return;
              }
              router.push(
                `/departments/${parentId}/${departmentId}/application/${id}`,
              );
            }}
            onDeleted={() => router.push("/servers")}
            onGenerateJoinCode={async () => {
              const response = await fetch(
                `/api/manage/${parentId}/departmentjoin`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "generate",
                    department_id: profile.id,
                  }),
                },
              );
              const body = await response.json().catch(() => ({}));
              if (!response.ok)
                throw new Error(
                  body.detail || body.message || "Could not generate code",
                );
              await load();
              return String(body.code || "");
            }}
            onSetJoinCode={async (customCode: string) => {
              const response = await fetch(
                `/api/manage/${parentId}/departmentjoin`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "set_code",
                    department_id: profile.id,
                    code: customCode,
                  }),
                },
              );
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                setNotice({
                  kind: "error",
                  text: body.detail || body.message || "Could not set that code",
                });
                return "";
              }
              await load();
              setNotice({ kind: "saved", text: "Join code updated" });
              return String(body.code || "");
            }}
            initialTab={activeTab}
            onTabChange={(tab) => {
              const next = new URLSearchParams(searchParams.toString());
              if (tab === "home") next.delete("tab");
              else next.set("tab", tab);
              const query = next.toString();
              router.replace(
                `/departments/${parentId}/${departmentId}${query ? `?${query}` : ""}`,
                { scroll: false },
              );
            }}
          />
        </WorkspaceHostProvider>
      </div>
      {notice ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] -translate-x-1/2">
          <p
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur ${notice.kind === "saved" ? "border-[var(--tone-ok-line)] bg-[#101312]/95 text-[var(--tone-ok)]" : "border-[var(--tone-bad-line)] bg-[#131010]/95 text-[var(--tone-bad)]"}`}
          >
            {notice.kind === "saved" ? (
              <IconCheck size={14} />
            ) : (
              <IconX size={14} />
            )}
            {notice.text}
          </p>
        </div>
      ) : null}
    </main>
  );
}
