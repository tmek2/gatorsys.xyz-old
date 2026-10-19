import { MODULE_TOGGLES } from "@/components/Manage/schema";
import { createAccountFixtures } from "./account";
import { createDepartmentFixtures } from "./departments";
import { createManagementFixtures } from "./management";
import type { PreviewGuildBase, PreviewState } from "./types";
import { PREVIEW_USER_ID, PREVIEW_GUILDS } from "./identity";

export { PREVIEW_USER_ID, PREVIEW_GUILDS } from "./identity";

export function createPreviewState(): PreviewState {
  const state: PreviewState = { guilds: {}, account: createAccountFixtures(), sequence: 1000 };
  PREVIEW_GUILDS.forEach((server, index) => {
    const role = (offset: number) => String(BigInt("100000000000010000") + BigInt(index * 100 + offset));
    const channel = (offset: number) => String(BigInt("100000000000020000") + BigInt(index * 100 + offset));
    const modules = Object.fromEntries(MODULE_TOGGLES.map(item => [item.key, true]));
    Object.assign(modules, { Department: true, Shifts: true, Applications: true });
    const base: PreviewGuildBase = {
      id: server.id,
      info: { id: server.id, name: server.name, icon: null, memberCount: server.members, channelCount: 10, roleCount: 5, moduleCount: MODULE_TOGGLES.length, isAdmin: true, isManager: true },
      meta: {
        guild: { id: server.id, name: server.name, icon: null, memberCount: server.members, ownerId: PREVIEW_USER_ID, createdAt: "2024-01-15T12:00:00Z", premiumTier: 2, boostCount: 8 + index },
        me: { id: PREVIEW_USER_ID, isAdmin: true, isOwner: true },
        roles: ["Administrator", "Management", "Staff", "Member", "On duty"].map((name, i) => ({ id: role(i), name, color: ["#f7a8c4", "#86b7fb", "#7bcfa5", null, "#eac66a"][i], position: 5 - i, managed: false })),
        channels: ["general", "announcements", "staff-chat", "staff-logs", "support", "suggestions", "daily-question", "sessions"].map((name, i) => ({ id: channel(i), name, type: "text", parentId: null, position: i })),
        emojis: [], modules,
      },
      config: {
        Modules: { ...modules },
        Logging: { channel_id: channel(3) },
        Infraction: { channel: channel(3), types: ["Warning", "Strike"], reasons: ["Conduct", "Missed quota"] },
        Promo: { channel: channel(1), System: { type: "single", single: { Hierarchy: [role(3), role(2), role(1)] } } },
        LOA: { channel: channel(3), role: role(3) },
        Welcome: { channel_id: channel(0), roles: [role(3)] },
        Suggestions: { channel: channel(5) },
        Shifts: { on_duty_role_ids: [role(4)], manager_role_ids: [role(1)], default_quota_minutes: 180, quota_period_days: 7 },
        Activity: { staff_role_ids: [role(2)], default_period_days: 7 },
        Permissions: { administrator: [role(0)], staff: [role(2)], management: [role(1)] },
        Applications: { applications: [] },
        Department: { profiles: [] },
      },
      members: ["Dev User", "Alex Morgan", "Sam Rivera", "Jordan Lee", "Taylor Reed", "Casey Park"].map((name, i) => ({
        id: i === 0 ? PREVIEW_USER_ID : String(BigInt(PREVIEW_USER_ID) + BigInt(i)),
        name, display_name: name, username: name.toLowerCase().replaceAll(" ", "_"),
        avatar: "/preview/avatar.svg", roles: i === 0 ? [role(0), role(1), role(2)] : [role(i % 2 ? 2 : 1), role(3)],
      })),
    };
    base.meta.channels.push(
      { id: channel(8), name: "Support tickets", type: "category", parentId: null, position: 8 },
      { id: channel(9), name: "On duty", type: "voice", parentId: null, position: 9 },
    );
    const management = createManagementFixtures(base, index);
    const departments = createDepartmentFixtures(base, index);
    departments.resources.push(
      { id: `server-handbook-${index + 1}`, department: "", kind: "document", title: "Community handbook", description: "A sample guide you can edit.", document_html: "<h1>Community handbook</h1><p>This is a fictional community. Try editing this guide, adding a section, or opening its version history.</p>", subdocuments: [], active_document_id: "root", share: { access: "link", role_ids: [], user_ids: [] }, questions: [], spreadsheet_data: [], channel_id: "", updated_at: "2026-01-15T12:00:00Z" },
      { id: `server-planner-${index + 1}`, department: "", kind: "spreadsheet", title: "Event planner", description: "An editable sample planning sheet.", document_html: "", questions: [], spreadsheet_data: [["Event", "Lead", "Status"], ["Welcome evening", "Alex Morgan", "Planned"], ["Community workshop", "Dev User", "In progress"]], share: { access: "link", role_ids: [], user_ids: [] }, channel_id: "", updated_at: "2026-01-15T12:00:00Z" },
    );
    state.guilds[server.id] = { ...base, management, departments };
  });
  return state;
}
