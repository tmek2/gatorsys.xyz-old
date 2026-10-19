import type { DepartmentProfile } from "../components/Manage/types";
import type { PreviewGuildBase, PreviewMember, PreviewReply, PreviewRequest, PreviewState } from "./types";

type RecordData = Record<string, any>;
type Rank = { id: string; name: string; color: string; role_id: string | null; join_rank?: boolean; permissions: string[] };
type RosterMember = PreviewMember & { rankRoleId: string | null; joinedAt: string; owner: string | null; columns: RecordData };
type Wave = { id: string; number: number; name: string; startsAt: string; endsAt: string | null; endedAt: string | null; shiftType: string; totals: Record<string, number> };
type Shift = { id: string; userId: string; startedAt: string; endedAt: string | null; breaks: { startsAt: string; endsAt: string | null }[] };
type Version = { id: string; title: string; savedBy: string; savedByName: string; savedByAvatar: string | null; savedAt: string; characters: number; rows: number; content: RecordData };

export interface DepartmentRecord {
  profile: DepartmentProfile;
  feature: RecordData;
  members: RosterMember[];
  requests: RecordData[];
  submissions: Record<string, RecordData>;
  announcements: RecordData[];
  waves: Wave[];
  shifts: Shift[];
  promotions: RecordData[];
  loas: RecordData[];
  infractions: RecordData[];
  executions: RecordData[];
}

export interface DepartmentFixtures {
  records: DepartmentRecord[];
  /** One collection serves the resource list, editors, reader and history. */
  resources: RecordData[];
  responses: RecordData[];
  versions: Record<string, Version[]>;
  sheetOps: Record<string, { cursor: number; entries: RecordData[] }>;
}

const VIEWER_ID = "100000000000000001";
const hour = 3_600_000;
const day = 24 * hour;
const copy = <T>(value: T): T => structuredClone(value);
const iso = (time = Date.now()) => new Date(time).toISOString();
const reply = (data: unknown, status = 200): PreviewReply => ({ status, data: copy(data) });
const reject = (detail: string, status = 400) => reply({ detail, message: detail }, status);
const success = (message: string, extra: RecordData = {}) => reply({ message, preview: true, ...extra });
const list = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.map(String))] : [];
const record = (value: unknown): RecordData => value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
const timestamp = (value: unknown): number => value ? Date.parse(String(value)) : NaN;
const bounded = <T>(items: T[], maximum = 100): T[] => items.slice(0, maximum);
const ranksOf = (department: DepartmentRecord): Rank[] => Array.isArray(department.feature.ranks) ? department.feature.ranks : [];
const publicSlugOf = (department: DepartmentRecord): string => String(department.profile.name || department.profile.id)
  .trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || department.profile.id;

function nextId(state: PreviewState, kind: string): string {
  state.sequence += 1;
  return `preview-${kind}-${state.sequence}`;
}

export function createDepartmentFixtures(base: PreviewGuildBase, index: number): DepartmentFixtures {
  const now = Date.now();
  const id = `department-${index + 1}`;
  const name = ["Community Operations", "Event Team", "Member Support"][index % 3];
  const accent = ["#f7a8c4", "#8fb9ff", "#8ad9b2"][index % 3];
  const roles = base.meta.roles.filter((role) => !role.managed);
  const channels = base.meta.channels.filter((channel) => channel.type === "text");
  const rankIds = ["lead", "senior", "member"].map((suffix) => `${id}-${suffix}`);
  const ranks: Rank[] = [
    { id: rankIds[0], name: "Team Lead", color: accent, role_id: roles[0]?.id || null, permissions: ["administrator"] },
    { id: rankIds[1], name: "Senior Member", color: "#8fb9ff", role_id: roles[1]?.id || null, permissions: ["post_shouts", "view_resources", "activity_manager"] },
    { id: rankIds[2], name: "Member", color: "#8ad9b2", role_id: roles[2]?.id || null, join_rank: true, permissions: ["view_resources"] },
  ];
  const viewer = base.members.find((member) => member.id === VIEWER_ID) || base.members[0];
  const members = base.members.slice(0, 6).map((member, position): RosterMember => ({
    ...copy(member), rankRoleId: position === 5 ? null : rankIds[Math.min(2, Math.max(0, position - 1))],
    joinedAt: iso(now - (position + 2) * day), owner: member.id === viewer.id ? "department" : position === 1 ? "co" : null,
    columns: { callsign: `OPS-${position + 10}`, training: position < 4, induction: iso(now - (position + 2) * day).slice(0, 10), availability: "18:00" },
  }));
  const applicant = base.members[6] || {
    id: `10000000000000002${index}`, name: "Jordan Blake", display_name: "Jordan Blake", username: "jordan.blake", avatar: null, roles: [],
  };
  const appId = `${id}-application`;
  const questions = [
    { id: "interest", type: "text_paragraph", question: "Why would you like to join this team?", required: true },
    { id: "availability", type: "multiple_choice", question: "When can you help?", required: true, options: [{ value: "weekdays", label: "Weekdays" }, { value: "weekends", label: "Weekends" }] },
  ];
  const application = { id: appId, name: `${name} application`, title: `${name} application`, description: "Tell us a little about yourself.", questions, enabled: true, responses_open: true, scope: "department", department_id: id, department: name, manager_role_ids: roles[0] ? [roles[0].id] : [], review_channel_id: channels[1]?.id || channels[0]?.id || "" };
  base.config.Applications = { ...(base.config.Applications || {}), applications: [...(base.config.Applications?.applications || []), application] };
  const profile: DepartmentProfile = {
    id, name, description: "Help organize events, welcome members, and keep the community running smoothly.",
    accent_color: accent, command_roles: ranks[0].role_id ? [ranks[0].role_id] : [], rank_roles: ranks.flatMap((rank) => rank.role_id ? [rank.role_id] : []),
    channels: { main: channels[0]?.id, logs: channels[1]?.id || channels[0]?.id, review: channels[1]?.id || channels[0]?.id },
    active: true, join_code: `PREVIEW${index + 1}`, join_role_id: ranks[2].role_id, application_id: null,
    created_by: viewer.id, manager_ids: members[1] ? [members[1].id] : [], parent_guild_id: base.id,
    discord_guild_id: index === 0 ? "100000000000000102" : null,
    vacancies: 12, department_type: "other", source: "website",
  };
  const documentId = `${id}-handbook`;
  const sheetId = `${id}-tracker`;
  const legacyId = `${id}-feedback`;
  const resources: RecordData[] = [
    { id: documentId, department: id, kind: "document", title: "Team handbook", description: "A quick guide to working with the team.", document_html: "<h1>Team handbook</h1><p>Welcome to the team. Use the roster to keep your details current and log your activity when you help out.</p><h2>Before your first session</h2><ul><li>Read the community rules.</li><li>Check the announcements.</li><li>Ask a lead if you need a hand.</li></ul>", subdocuments: [{ id: "sessions", title: "Running a session", html: "<h1>Running a session</h1><p>Check in with the team, agree on a plan, and leave a short handover when you finish.</p>" }, { id: "support", title: "Helping members", html: "<h1>Helping members</h1><p>Listen first, explain the next step clearly, and involve a lead when needed.</p>" }], active_document_id: "root", share: { access: "link", role_ids: [], user_ids: [] }, questions: [], spreadsheet_data: [], channel_id: channels[0]?.id || "", updated_at: iso(now - hour) },
    { id: sheetId, department: id, kind: "spreadsheet", title: "Session tracker", description: "Track upcoming sessions and the people helping out.", spreadsheet_data: [["Session", "Lead", "Status"], ["Welcome evening", members[1]?.name || viewer.name, "Planned"], ["Community workshop", viewer.name, "In progress"]], questions: [], document_html: "", share: { access: "link", role_ids: [], user_ids: [] }, channel_id: "", updated_at: iso(now - 2 * hour) },
    { id: legacyId, department: id, kind: "application", title: "Session feedback", description: "Let the team know how your session went.", questions: copy(questions), document_html: "", spreadsheet_data: [], channel_id: channels[1]?.id || "" },
  ];
  const currentWave: Wave = { id: `${id}-wave-current`, number: 2, name: "This week's activity", startsAt: iso(now - 2 * day), endsAt: iso(now + 5 * day), endedAt: null, shiftType: "", totals: Object.fromEntries(members.map((member, position) => [member.id, (2 + position * 0.6) * 3600])) };
  const previousWave: Wave = { id: `${id}-wave-previous`, number: 1, name: "Last week's activity", startsAt: iso(now - 9 * day), endsAt: iso(now - 2 * day), endedAt: iso(now - 2 * day), shiftType: "", totals: Object.fromEntries(members.map((member, position) => [member.id, (4 + position * 0.5) * 3600])) };
  const department: DepartmentRecord = {
    profile,
    feature: {
      public_page_enabled: true, ranks,
      roster_columns: [{ id: "callsign", name: "Callsign", type: "text", roles: [] }, { id: "training", name: "Training done", type: "checkbox", roles: [] }, { id: "induction", name: "Induction", type: "date", roles: [] }, { id: "availability", name: "Available from", type: "time", roles: [] }, { id: "duty", name: "Activity", type: "shift_activity" }],
      activity: { required_hours: 4, wave_duration_days: 7, inactivity_days: 14, max_on_shift: 12, require_shift_for_actions: false, shift_types: [{ id: "community", name: "Community" }, { id: "event", name: "Event" }] },
      loa: { require_reason: true, require_end_date: true, disallow_shifts: true, cooldown_days: 0, minimum_days: 1, maximum_days: 30 },
      points_system: { stages: [{ name: "Reminder", points: 2, type: "warning" }, { name: "Review", points: 5, type: "suspension" }], auto_termination: false, auto_suspension_days: 2 },
      discord: { main_channel_id: channels[0]?.id || "", log_channel_id: channels[1]?.id || "" },
      cross_role_links: [], actions: [{ id: `${id}-handover`, name: "Session handover", description: "Leave a short note for the next team.", channel_id: channels[0]?.id || "", required_ranks: [], questions: [{ id: "summary", type: "text_paragraph", question: "What should the next team know?", required: true }, { id: "followup", type: "multiple_choice", question: "Is a follow-up needed?", required: false, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }] }],
      pinned_buttons: [{ id: `${id}-pin-handbook`, label: "Team handbook", type: "document", resource_id: documentId }, { id: `${id}-pin-action`, label: "Session handover", type: "action", action_id: `${id}-handover` }], home_sections: [],
    },
    members,
    requests: [{ id: applicant.id, name: applicant.name, username: applicant.username, avatar: applicant.avatar, requestedAt: iso(now - 3 * hour) }],
    submissions: { [applicant.id]: { title: application.name, submittedAt: iso(now - 3 * hour), questions: { interest: questions[0].question, availability: questions[1].question }, answers: { interest: "I enjoy helping new members and organizing community events.", availability: "weekends" } } },
    announcements: [
      { id: `${id}-welcome`, department_id: id, author: viewer.name, author_id: viewer.id, avatar: viewer.avatar, content: "Welcome to this week's activity wave. The team handbook has everything you need to get started.", resource_id: documentId, created_at: iso(now - 6 * hour), visibility: "all", mention_user_ids: [] },
      { id: `${id}-reply`, department_id: id, author: members[1]?.name || viewer.name, author_id: members[1]?.id || viewer.id, avatar: members[1]?.avatar, content: "The next community session is on Saturday. Leave a handover after your shift.", reply_to: `${id}-welcome`, created_at: iso(now - 2 * hour), visibility: "all", mention_user_ids: [] },
      { id: `${id}-scheduled`, department_id: id, author: viewer.name, author_id: viewer.id, avatar: viewer.avatar, content: "A reminder to check your activity before the wave closes.", created_at: iso(now - hour), scheduled_for: iso(now + 3 * day), delivered_at: null, visibility: "all", mention_user_ids: [] },
    ],
    waves: [currentWave, previousWave, { id: `${id}-wave-next`, number: 3, name: "Next week's activity", startsAt: iso(now + 5 * day), endsAt: iso(now + 12 * day), endedAt: null, shiftType: "", totals: {} }],
    shifts: [{ id: `${id}-shift-viewer`, userId: viewer.id, startedAt: iso(now - 35 * 60_000), endedAt: null, breaks: [] }], promotions: [],
    loas: [
      ...(members[4] ? [{ id: `${id}-leave-active`, user_id: members[4].id, user_name: members[4].name, reason: "Away for a few days.", starts_at: iso(now - day), ends_at: iso(now + 2 * day), status: "active" }] : []),
      ...(members[3] ? [{ id: `${id}-leave-pending`, user_id: members[3].id, user_name: members[3].name, reason: "Family plans next week.", starts_at: iso(now + 3 * day), ends_at: iso(now + 5 * day), status: "pending" }] : []),
      ...(members[2] ? [{ id: `${id}-leave-ended`, user_id: members[2].id, user_name: members[2].name, reason: "A short break.", starts_at: iso(now - 8 * day), ends_at: iso(now - 6 * day), status: "ended" }] : []),
    ],
    infractions: members[2] ? [{ id: `${id}-infraction`, department_id: id, member_id: members[2].id, issued_by: viewer.id, issued_by_name: viewer.name, created_at: iso(now - day), points: 2, reason: "Missed a scheduled session without leaving a note.", proof: [], expires_at: iso(now + 29 * day) }] : [],
    executions: [],
  };
  base.config.Department = { ...(base.config.Department || {}), profiles: [...(base.config.Department?.profiles || []), copy(profile)] };
  return {
    records: [department], resources,
    responses: [null, "approved"].map((status, position) => ({ id: `${id}-feedback-${position}`, resource_id: legacyId, department: id, user_id: applicant.id, user_name: applicant.name, username: applicant.username, avatar: applicant.avatar, title: "Session feedback", answers: { interest: "The welcome session was easy to follow and the team answered my questions.", availability: "weekends" }, status, created_at: iso(now - (position + 1) * day) })),
    versions: { [documentId]: [{ id: `${id}-version-initial`, title: "Team handbook", savedBy: viewer.id, savedByName: viewer.name, savedByAvatar: viewer.avatar, savedAt: iso(now - day), characters: 45, rows: 0, content: { title: "Team handbook", document_html: "<h1>Team handbook</h1><p>Welcome to the team.</p>", subdocuments: [], active_document_id: "root" } }] },
    sheetOps: {},
  };
}

function viewerFor(guild: PreviewGuildBase, user?: string): PreviewMember {
  return guild.members.find((member) => member.id === (user || VIEWER_ID)) || guild.members[0];
}

/** Public form submissions and review screens share management.responses. */
export function registerDepartmentSubmission(state: PreviewState, guildId: string, application: RecordData, response: RecordData): void {
  const guild = state.guilds[guildId];
  const department = guild?.departments.records.find((item) => [item.profile.id, item.profile.name].includes(String(application.department_id || application.department || "")));
  if (!guild || !department) return;
  const userId = String(response.userId || response.user_id || "");
  if (!userId) return;
  const member = guild.members.find((item) => item.id === userId);
  if (!department.members.some((item) => item.id === userId) && !department.requests.some((item) => item.id === userId)) {
    department.requests = bounded([{ id: userId, name: response.userName || member?.name || "Applicant", username: response.userHandle || member?.username || "applicant", avatar: response.userAvatar || member?.avatar || null, requestedAt: response.createdAt || iso() }, ...department.requests]);
  }
  department.submissions[userId] = {
    title: application.name || application.title,
    submittedAt: response.createdAt || response.created_at || iso(),
    questions: Object.fromEntries((application.questions || []).map((question: RecordData) => [question.id, question.question])),
    answers: copy(record(response.answers)), integrity: copy(record(response.integrity)),
  };
}

export function recordDepartmentApplication(state: PreviewState, guildId: string, response: RecordData): void {
  const application = state.guilds[guildId]?.config.Applications?.applications?.find((item: RecordData) => item.id === response.applicationId);
  if (application) registerDepartmentSubmission(state, guildId, application, response);
}

export function decideDepartmentApplication(state: PreviewState, guildId: string, response: RecordData, approved: boolean): void {
  const guild = state.guilds[guildId];
  const application = guild?.config.Applications?.applications?.find((item: RecordData) => item.id === response.applicationId)
    || guild?.departments.resources.find((item) => item.id === response.resource_id && item.kind === "application");
  const department = guild?.departments.records.find((item) => [item.profile.id, item.profile.name].includes(String(application?.department_id || application?.department || "")));
  if (!guild || !department) return;
  const userId = String(response.userId || response.user_id || "");
  if (approved && userId && !department.members.some((item) => item.id === userId)) {
    const request = department.requests.find((item) => item.id === userId);
    const member = guild.members.find((item) => item.id === userId);
    department.members.push({ id: userId, name: response.userName || request?.name || member?.name || "Applicant", display_name: response.userName || member?.display_name || "Applicant", username: response.userHandle || request?.username || member?.username || "applicant", avatar: response.userAvatar || request?.avatar || member?.avatar || null, roles: member?.roles || [], rankRoleId: ranksOf(department).find((rank) => rank.join_rank)?.id || null, joinedAt: iso(), owner: null, columns: {} });
  }
  department.requests = department.requests.filter((item) => item.id !== userId);
}

function syncProfiles(state: PreviewState, guildId: string): void {
  const guild = state.guilds[guildId];
  guild.config.Department = { ...(guild.config.Department || {}), profiles: guild.departments.records.map((item) => copy(item.profile)) };
}

function configPatch(config: RecordData, path: string, value: unknown, remove = false): void {
  const keys = path.split(".");
  if (keys.some((key) => !key || ["__proto__", "prototype", "constructor"].includes(key))) throw new Error("Invalid setting path");
  let target = config;
  for (const key of keys.slice(0, -1)) target = target[key] = record(target[key]);
  if (remove) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = copy(value);
}

function activeLeave(department: DepartmentRecord, userId: string, now: number): boolean {
  return department.loas.some((leave) => leave.user_id === userId && leave.status === "active" && timestamp(leave.starts_at) <= now && (!leave.ends_at || timestamp(leave.ends_at) > now));
}

function shiftSeconds(shift: Shift, now: number, wave?: Wave): number {
  const start = Math.max(timestamp(shift.startedAt), wave ? timestamp(wave.startsAt) : -Infinity);
  const end = Math.min(shift.endedAt ? timestamp(shift.endedAt) : now, wave?.endsAt ? timestamp(wave.endsAt) : Infinity, wave?.endedAt ? timestamp(wave.endedAt) : Infinity);
  const breaks = shift.breaks.reduce((total, pause) => total + Math.max(0, Math.min(end, pause.endsAt ? timestamp(pause.endsAt) : now) - Math.max(start, timestamp(pause.startsAt))), 0);
  return Math.max(0, Math.floor((end - start - breaks) / 1000));
}

function waveProjection(department: DepartmentRecord, wave: Wave, now: number): Wave {
  const totals = { ...wave.totals };
  for (const shift of department.shifts) totals[shift.userId] = (totals[shift.userId] || 0) + shiftSeconds(shift, now, wave);
  return { ...wave, totals };
}

function setRank(department: DepartmentRecord, ids: string[], rankId: string) {
  for (const member of department.members) if (ids.includes(member.id)) member.rankRoleId = rankId;
}

function settle(department: DepartmentRecord, now: number) {
  for (const wave of department.waves) if (!wave.endedAt && wave.endsAt && timestamp(wave.endsAt) <= now) wave.endedAt = wave.endsAt;
  for (const leave of department.loas) if (leave.status === "active" && leave.ends_at && timestamp(leave.ends_at) <= now) leave.status = "ended";
  for (const post of department.announcements) if (post.scheduled_for && !post.delivered_at && timestamp(post.scheduled_for) <= now) post.delivered_at = post.scheduled_for;
  for (const promotion of department.promotions) {
    if (!promotion.applied && timestamp(promotion.scheduled_for) <= now) {
      setRank(department, promotion.member_ids, promotion.to_rank_id);
      promotion.applied = true;
    }
  }
}

function networkProjection(state: PreviewState, guild: PreviewGuildBase, department: DepartmentRecord) {
  const linkedId = department.profile.discord_guild_id;
  const linked = linkedId ? state.guilds[linkedId] : undefined;
  return { mode: linked ? "hub" : "standalone", hubGuildId: guild.id, hubGuildName: guild.meta.guild.name,
    linked: linked ? [{ id: linked.id, name: linked.meta.guild.name, icon: linked.meta.guild.icon, memberCount: linked.meta.guild.memberCount, reachable: true, editable: true, profiles: linked.departments.records.map((item) => item.profile), roles: linked.meta.roles, channels: linked.meta.channels }] : [] };
}

export function departmentPayload(state: PreviewState, guildId: string, departmentId?: string, user = VIEWER_ID, now = Date.now()): RecordData | undefined {
  const guild = state.guilds[guildId];
  if (!guild) return undefined;
  const selected = departmentId ? guild.departments.records.filter((item) => item.profile.id === departmentId) : guild.departments.records;
  if (!selected.length) return departmentId ? undefined : { profiles: [], rosters: [], resources: [], announcements: [] };
  for (const department of selected) settle(department, now);
  const department = selected[0];
  const viewer = viewerFor(guild, user);
  const currentWave = department.waves.find((wave) => timestamp(wave.startsAt) <= now && !wave.endedAt);
  const waves = department.waves.filter((wave) => timestamp(wave.startsAt) <= now).map((wave) => waveProjection(department, wave, now));
  const activeShifts = department.shifts.filter((shift) => !shift.endedAt).map((shift) => ({ shiftId: shift.id, userId: shift.userId, userName: guild.members.find((member) => member.id === shift.userId)?.name || shift.userId, startedAt: shift.startedAt, seconds: shiftSeconds(shift, now), onBreak: shift.breaks.some((pause) => !pause.endsAt) }));
  const roster = (item: DepartmentRecord) => ({
    id: item.profile.id, members: item.members.length, onLoa: item.members.filter((member) => activeLeave(item, member.id, now)).length,
    ranks: ranksOf(item).map((rank) => ({ roleId: rank.id, name: rank.name, members: item.members.filter((member) => member.rankRoleId === rank.id).length })),
    memberRows: item.members.map((member) => ({ ...member, avatar: member.avatar || "", rankName: ranksOf(item).find((rank) => rank.id === member.rankRoleId)?.name || "Unranked", onLoa: activeLeave(item, member.id, now), activitySeconds: currentWave ? waveProjection(item, currentWave, now).totals[member.id] || 0 : 0, points: item.infractions.filter((entry) => entry.member_id === member.id && (!entry.expires_at || timestamp(entry.expires_at) > now)).reduce((sum, entry) => sum + Number(entry.points || 0), 0) })),
    membershipRequests: item.requests,
  });
  const belongs = (item: RecordData) => selected.some(({ profile }) => [profile.id, profile.name].includes(String(item.department_id || item.department || "")));
  return {
    profiles: selected.map((item) => item.profile), rosters: selected.map(roster), resources: guild.departments.resources.filter(belongs),
    applications: (guild.config.Applications?.applications || []).filter(belongs), announcements: selected.flatMap((item) => item.announcements).sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at)),
    actionExecutions: selected.flatMap((item) => item.executions), responses: guild.departments.responses.filter(belongs),
    activity: { waves, scheduledWaves: department.waves.filter((wave) => timestamp(wave.startsAt) > now && !wave.endedAt), wave: currentWave ? waveProjection(department, currentWave, now) : null, activeShifts, viewer: { seconds: currentWave ? waveProjection(department, currentWave, now).totals[viewer.id] || 0 : 0, activeShift: activeShifts.find((shift) => shift.userId === viewer.id) || null } },
    infractions: department.infractions, viewerInfractions: department.infractions.filter((entry) => entry.member_id === viewer.id),
    loas: department.loas, viewerLoas: department.loas.filter((entry) => entry.user_id === viewer.id), canViewResources: true,
    feature: department.feature, parentRoles: guild.meta.roles, parentChannels: guild.meta.channels, network: networkProjection(state, guild, department),
    viewer: { ...viewer, avatar: viewer.avatar || "", joinedAt: department.members.find((member) => member.id === viewer.id)?.joinedAt || null, permissions: ["administrator"], departmentOwnerId: department.profile.created_by, isDepartmentOwner: department.profile.created_by === viewer.id, isDepartmentCoOwner: department.profile.manager_ids?.includes(viewer.id) || false },
  };
}

function audit(state: PreviewState, guildId: string, action: string, summary: string, user = VIEWER_ID) {
  const guild = state.guilds[guildId];
  const viewer = viewerFor(guild, user);
  guild.management.audit.unshift({ guild_id: guildId, actor_id: viewer.id, actor_name: viewer.name, actor_avatar: viewer.avatar, action, module: "Departments", summary, created_at: iso(), status: "success", preview: true });
  guild.management.audit = bounded(guild.management.audit, 150);
}

function versionContent(resource: RecordData): RecordData {
  const keys = ["title", "description", "document_html", "subdocuments", "active_document_id", "spreadsheet_data", "spreadsheet_snapshot"];
  return Object.fromEntries(keys.filter((key) => key in resource).map((key) => [key, copy(resource[key])]));
}

function saveVersion(state: PreviewState, guildId: string, resource: RecordData, user?: string) {
  const guild = state.guilds[guildId];
  const viewer = viewerFor(guild, user);
  const content = versionContent(resource);
  const versions = guild.departments.versions[resource.id] || [];
  const version: Version = { id: nextId(state, "version"), title: String(resource.title || "Untitled"), savedBy: viewer.id, savedByName: viewer.name, savedByAvatar: viewer.avatar, savedAt: iso(), characters: String(resource.document_html || "").replace(/<[^>]*>/g, "").length, rows: Array.isArray(resource.spreadsheet_data) ? resource.spreadsheet_data.length : 0, content };
  guild.departments.versions[resource.id] = bounded([version, ...versions], 12);
}

function resourceRequest(state: PreviewState, request: PreviewRequest): PreviewReply | undefined {
  const { endpoint, method, params, body } = request;
  const guild = state.guilds[params.server];
  if (!guild) return reject("That preview server was not found.", 404);
  const fixtures = guild.departments;
  const resourceId = String(params.resource || body.resource || body.resource_id || body.id || "");
  const resource = fixtures.resources.find((item) => item.id === resourceId);
  if (endpoint === "dashboard_deptdocument") {
    if (!resource || !["document", "spreadsheet"].includes(resource.kind)) return reject("That resource was not found.", 404);
    const department = fixtures.records.find((item) => [item.profile.id, item.profile.name].includes(String(resource.department_id || resource.department)));
    return reply({ resource, siblings: fixtures.resources.filter((item) => item.department === resource.department && ["document", "spreadsheet"].includes(item.kind)), department: department?.profile || null, can_edit: false });
  }
  if (endpoint === "dashboard_resource_versions") return resource ? reply({ versions: (fixtures.versions[resource.id] || []).map(({ content: _content, ...metadata }) => metadata) }) : reject("That resource was not found.", 404);
  if (endpoint === "dashboard_resource_version_restore") {
    const version = (fixtures.versions[resourceId] || []).find((item) => item.id === body.version);
    if (!resource || !version) return reject("That saved version was not found.", 404);
    saveVersion(state, guild.id, resource, body.user);
    for (const key of Object.keys(versionContent(resource))) delete resource[key];
    Object.assign(resource, copy(version.content), { updated_at: iso() });
    audit(state, guild.id, "resource_restore", `Restored ${resource.title}.`, body.user);
    return success("Saved version restored in this preview.", { resource });
  }
  if (endpoint === "dashboard_deptsheetops") {
    if (!resource || resource.kind !== "spreadsheet") return reject("That spreadsheet was not found.", 404);
    const stream = fixtures.sheetOps[resource.id] || { cursor: 0, entries: [] };
    return reply({ cursor: stream.cursor, ops: stream.entries.filter((entry) => entry.cursor > Number(params.since || 0) && entry.client_id !== params.client), presences: [] });
  }
  if (endpoint !== "dashboard_deptresources") return undefined;
  if (method === "GET") return reply({ resources: fixtures.resources });
  if (body.action === "save") {
    const incoming = record(body.resource);
    if (!incoming.id || !["document", "spreadsheet", "application"].includes(incoming.kind)) return reject("Choose a valid resource type and id.");
    const owner = String(incoming.department_id || incoming.department || "");
    if (owner && !fixtures.records.some((item) => [item.profile.id, item.profile.name].includes(owner))) return reject("That department was not found.", 404);
    const existing = fixtures.resources.find((item) => item.id === incoming.id);
    if (existing && JSON.stringify(versionContent(existing)) !== JSON.stringify(versionContent(incoming))) saveVersion(state, guild.id, existing, body.user);
    const saved = { ...copy(incoming), updated_at: iso() };
    if (existing) {
      for (const key of Object.keys(existing)) delete existing[key];
      Object.assign(existing, saved);
    }
    else fixtures.resources = bounded([saved, ...fixtures.resources]);
    audit(state, guild.id, "resource_save", `Saved ${incoming.title || "resource"}.`, body.user);
    return success("Resource saved in this preview.", { resource: existing || saved, resources: fixtures.resources });
  }
  if (body.action === "review") {
    const response = fixtures.responses.find((item) => item.id === String(body.id));
    if (!response) return reject("That response was not found.", 404);
    if (!["approved", "denied", "pending", "accepted", "rejected"].includes(String(body.status))) return reject("Choose a valid review status.");
    Object.assign(response, { status: body.status === "pending" ? null : body.status, review_note: String(body.note || ""), reviewed_at: iso(), reviewed_by: body.user || VIEWER_ID, reviewed_by_name: viewerFor(guild, body.user).name });
    if (response.join_request && ["approved", "denied"].includes(String(body.status))) decideDepartmentApplication(state, guild.id, response, body.status === "approved");
    audit(state, guild.id, "resource_review", "Reviewed a department response.", body.user);
    return success("Response reviewed in this preview.", { response });
  }
  if (!resource) return reject("That resource was not found.", 404);
  if (body.action === "delete") {
    fixtures.resources = fixtures.resources.filter((item) => item.id !== resource.id);
    delete fixtures.versions[resource.id]; delete fixtures.sheetOps[resource.id];
    fixtures.responses = fixtures.responses.filter((item) => item.resource_id !== resource.id);
    audit(state, guild.id, "resource_delete", `Deleted ${resource.title}.`, body.user);
    return success("Resource deleted from this preview.", { resources: fixtures.resources });
  }
  if (body.action === "presence") return reply({ presence: [], presences: [] });
  if (body.action === "submit") {
    if (resource.kind !== "application") return reject("This resource is not a form.");
    const answers = record(body.answers);
    if ((resource.questions || []).some((question: RecordData) => question.required && !String(answers[question.id] ?? "").trim())) return reject("Answer all required questions.");
    const viewer = viewerFor(guild, body.user);
    const submission = { id: nextId(state, "response"), resource_id: resource.id, department: resource.department, user_id: viewer.id, user_name: viewer.name, username: viewer.username, avatar: viewer.avatar, title: resource.title, answers: copy(answers), integrity: copy(record(body.integrity)), status: null, created_at: iso() };
    const department = fixtures.records.find((item) => item.profile.application_id === resource.id || item.feature.join_application_id === resource.id);
    if (department) {
      Object.assign(submission, { join_request: true });
      registerDepartmentSubmission(state, guild.id, resource, submission);
    }
    fixtures.responses = bounded([submission, ...fixtures.responses]);
    audit(state, guild.id, "resource_submit", `Submitted ${resource.title}.`, body.user);
    return success("Response submitted in this preview.", { response: submission });
  }
  return reject("This resource action is not available in the preview.");
}

function departmentAction(state: PreviewState, request: PreviewRequest, department: DepartmentRecord): PreviewReply {
  const { params, body } = request;
  const guild = state.guilds[params.server];
  const now = Date.now();
  settle(department, now);
  const viewer = viewerFor(guild, body.user);
  const action = String(body.action || "");
  const memberIds = list(body.member_ids);
  const rank = ranksOf(department).find((item) => item.id === body.role_id || item.id === body.to_rank_id);
  const missingMember = memberIds.some((id) => !department.members.some((member) => member.id === id));
  const result = (message: string, extra: RecordData = {}) => { syncProfiles(state, guild.id); audit(state, guild.id, action, message, body.user); return success(`${message} (Preview only.)`, extra); };

  if (["shift_start", "shift_break", "shift_end"].includes(action)) {
    const shift = department.shifts.find((item) => item.userId === viewer.id && !item.endedAt);
    if (action === "shift_start") {
      if (shift) return reject("You are already on shift.", 409);
      if (department.feature.loa?.disallow_shifts && activeLeave(department, viewer.id, now)) return reject("End your leave before starting a shift.");
      const maximum = Number(department.feature.activity?.max_on_shift || 0);
      if (maximum && department.shifts.filter((item) => !item.endedAt).length >= maximum) return reject("The on-shift limit has been reached.");
      department.shifts = bounded([{ id: nextId(state, "shift"), userId: viewer.id, startedAt: iso(now), endedAt: null, breaks: [] }, ...department.shifts], 200);
      return result("Shift started");
    }
    if (!shift) return reject("Start a shift first.", 409);
    const pause = shift.breaks.find((item) => !item.endsAt);
    if (action === "shift_break") {
      if (pause) pause.endsAt = iso(now); else shift.breaks.push({ startsAt: iso(now), endsAt: null });
      return result(pause ? "Shift resumed" : "Break started");
    }
    if (pause) pause.endsAt = iso(now);
    shift.endedAt = iso(now);
    return result("Shift ended");
  }
  if (action === "announcement_post") {
    const content = String(body.content || "").trim();
    if (!content) return reject("Write an announcement first.");
    if (body.scheduled_for && (!Number.isFinite(timestamp(body.scheduled_for)) || timestamp(body.scheduled_for) <= now)) return reject("Choose a future announcement time.");
    if (body.resource_id && !guild.departments.resources.some((item) => item.id === body.resource_id)) return reject("That resource was not found.", 404);
    const announcement = { id: nextId(state, "announcement"), department_id: department.profile.id, author: viewer.name, author_id: viewer.id, avatar: viewer.avatar, content, attachment: body.attachment ? copy(body.attachment) : undefined, resource_id: body.resource_id || null, visibility: body.visibility || "all", visibility_role_ids: list(body.visibility_role_ids), visibility_user_ids: list(body.visibility_user_ids), mention_user_ids: list(body.mention_user_ids), reply_to: body.reply_to || null, scheduled_for: body.scheduled_for || null, delivered_at: body.scheduled_for ? null : iso(now), created_at: iso(now) };
    department.announcements = bounded([announcement, ...department.announcements]);
    return result(body.scheduled_for ? "Announcement scheduled" : "Announcement posted", { announcement, dm: { targets: 0, sent: 0, preview: true } });
  }
  if (action === "announcement_delete") {
    if (!department.announcements.some((item) => item.id === body.id)) return reject("That announcement was not found.", 404);
    department.announcements = department.announcements.filter((item) => item.id !== body.id);
    return result("Announcement deleted");
  }
  if (action === "membership_accept" || action === "membership_deny") {
    const applicant = department.requests.find((item) => item.id === String(body.member_id));
    if (!applicant) return reject("That request was not found.", 404);
    if (action === "membership_accept" && !department.members.some((member) => member.id === applicant.id)) {
      const joinRank = ranksOf(department).find((item) => item.join_rank);
      department.members.push({ id: applicant.id, name: applicant.name, display_name: applicant.name, username: applicant.username, avatar: applicant.avatar, roles: [], rankRoleId: joinRank?.id || null, joinedAt: iso(now), owner: null, columns: {} });
    }
    department.requests = department.requests.filter((item) => item.id !== applicant.id);
    return result(action === "membership_accept" ? "Member accepted" : "Request declined");
  }
  if (action === "membership_leave") {
    department.members = department.members.filter((member) => member.id !== viewer.id);
    department.requests = department.requests.filter((member) => member.id !== viewer.id);
    for (const shift of department.shifts) if (shift.userId === viewer.id && !shift.endedAt) shift.endedAt = iso(now);
    return result("You left this department");
  }
  if (["rank", "remove", "promotion_create", "owner_update", "infract"].includes(action)) {
    if (!memberIds.length || missingMember) return reject("Choose existing department members.");
    if ((action === "rank" || action === "promotion_create") && !rank) return reject("Choose an existing department rank.");
    if (action === "rank") { setRank(department, memberIds, rank!.id); return result("Member rank updated"); }
    if (action === "remove") {
      if (memberIds.includes(department.profile.created_by || "")) return reject("The department owner cannot be removed.");
      department.members = department.members.filter((member) => !memberIds.includes(member.id));
      for (const shift of department.shifts) if (memberIds.includes(shift.userId) && !shift.endedAt) shift.endedAt = iso(now);
      return result("Members removed");
    }
    if (action === "owner_update") {
      const owners = new Set(department.profile.manager_ids || []);
      for (const memberId of memberIds) body.enabled ? owners.add(memberId) : owners.delete(memberId);
      department.profile.manager_ids = [...owners];
      for (const member of department.members) if (member.owner !== "department" && memberIds.includes(member.id)) member.owner = body.enabled ? "co" : null;
      return result("Co-owner access updated");
    }
    if (action === "promotion_create") {
      if (!["promote", "demote"].includes(String(body.kind))) return reject("Choose a promotion or demotion.");
      if (body.scheduled_for && (!Number.isFinite(timestamp(body.scheduled_for)) || timestamp(body.scheduled_for) <= now)) return reject("Choose a future promotion time.");
      if (body.scheduled_for) department.promotions = bounded([{ ...copy(body), id: nextId(state, "promotion"), applied: false }, ...department.promotions]);
      else setRank(department, memberIds, rank!.id);
      if (body.create_shout) department.announcements = bounded([{ id: nextId(state, "announcement"), department_id: department.profile.id, author: viewer.name, author_id: viewer.id, content: String(body.shout_message || `${memberIds.length} member${memberIds.length === 1 ? "" : "s"} moved to ${rank!.name}.`), created_at: iso(now), scheduled_for: body.scheduled_for || null, mention_user_ids: memberIds, visibility: "all" }, ...department.announcements]);
      return result(body.scheduled_for ? "Rank change scheduled" : "Member rank updated");
    }
    const points = Number(body.points || 0);
    const expiry = Number(body.expires_in_days || 0);
    if (!String(body.reason || "").trim() || !Number.isFinite(points) || points < 0 || !Number.isFinite(expiry) || expiry < 0) return reject("Enter a reason and valid nonnegative points and expiry.");
    department.infractions = bounded([...memberIds.map((memberId) => ({ id: nextId(state, "infraction"), department_id: department.profile.id, member_id: memberId, issued_by: viewer.id, issued_by_name: viewer.name, reason: String(body.reason).trim(), points, proof: Array.isArray(body.proof) ? copy(body.proof) : [], created_at: iso(now), expires_at: expiry ? iso(now + expiry * day) : null })), ...department.infractions]);
    return result("Infraction recorded");
  }
  if (action === "roster_cell") {
    const member = department.members.find((item) => item.id === String(body.member_id));
    const column = (department.feature.roster_columns || []).find((item: RecordData) => item.id === body.column_id);
    if (!member || !column) return reject("That member or column was not found.", 404);
    if (column.type === "shift_activity") return reject("Activity is calculated from shifts.");
    member.columns[column.id] = column.type === "checkbox" ? Boolean(body.value) : String(body.value ?? "");
    return result("Roster cell saved");
  }
  if (action === "infraction_delete") {
    if (!department.infractions.some((item) => item.id === body.infraction_id)) return reject("That infraction was not found.", 404);
    department.infractions = department.infractions.filter((item) => item.id !== body.infraction_id);
    return result("Infraction deleted");
  }
  if (action === "loa_request") {
    const settings = department.feature.loa || {};
    if (department.loas.some((item) => item.user_id === viewer.id && ["pending", "active"].includes(item.status))) return reject("You already have an open leave request.", 409);
    if (settings.require_reason && !String(body.reason || "").trim()) return reject("Enter a leave reason.");
    const start = timestamp(body.starts_at);
    const end = body.ends_at ? timestamp(body.ends_at) : null;
    if (!Number.isFinite(start) || (settings.require_end_date && end === null) || (end !== null && (!Number.isFinite(end) || end <= start))) return reject("Choose valid leave dates.");
    const duration = end === null ? null : (end - start) / day;
    if (duration !== null && ((settings.minimum_days && duration < Number(settings.minimum_days)) || (settings.maximum_days && duration > Number(settings.maximum_days)))) return reject("Choose dates within the configured leave duration.");
    department.loas = bounded([{ id: nextId(state, "leave"), user_id: viewer.id, user_name: viewer.name, reason: String(body.reason || "").trim(), starts_at: iso(start), ends_at: end === null ? null : iso(end), status: "pending" }, ...department.loas]);
    return result("Leave request submitted");
  }
  if (action === "loa_review" || action === "loa_end") {
    const leave = department.loas.find((item) => item.id === body.id);
    if (!leave) return reject("That leave request was not found.", 404);
    leave.status = action === "loa_end" ? "ended" : body.approve ? "active" : "denied";
    if (action === "loa_end") leave.ended_at = iso(now);
    return result(action === "loa_end" ? "Leave ended" : "Leave request reviewed");
  }
  if (["wave_start", "wave_schedule", "wave_update"].includes(action)) {
    const existing = department.waves.find((item) => item.id === body.wave_id);
    if (action === "wave_update" && !existing) return reject("That wave was not found.", 404);
    const start = action === "wave_start" ? now : body.starts_at ? timestamp(body.starts_at) : existing ? timestamp(existing.startsAt) : NaN;
    const end = body.ends_at ? timestamp(body.ends_at) : null;
    if (!String(body.name || "").trim() || !Number.isFinite(start) || (end !== null && (!Number.isFinite(end) || end <= start)) || (action === "wave_schedule" && start <= now)) return reject("Give the wave a name and valid start/end dates.");
    if (department.waves.some((wave) => wave.id !== existing?.id && !wave.endedAt && start < (wave.endsAt ? timestamp(wave.endsAt) : Infinity) && (end ?? Infinity) > timestamp(wave.startsAt))) return reject("Activity waves cannot overlap.", 409);
    const values = { name: String(body.name).trim(), startsAt: iso(start), endsAt: end === null ? null : iso(end), shiftType: String(body.shift_type || "") };
    if (existing) Object.assign(existing, values);
    else department.waves = bounded([{ ...values, id: nextId(state, "wave"), number: Math.max(0, ...department.waves.map((wave) => wave.number)) + 1, endedAt: null, totals: {} }, ...department.waves], 30);
    return result(action === "wave_start" ? "Activity wave started" : "Activity wave saved");
  }
  if (action === "wave_end" || action === "wave_cancel") {
    const wave = department.waves.find((item) => item.id === body.wave_id);
    if (!wave) return reject("That wave was not found.", 404);
    if (action === "wave_cancel") {
      if (timestamp(wave.startsAt) <= now) return reject("Only scheduled waves can be cancelled.");
      department.waves = department.waves.filter((item) => item.id !== wave.id);
    } else { wave.endedAt = iso(now); wave.endsAt = iso(now); }
    return result(action === "wave_cancel" ? "Scheduled wave cancelled" : "Activity wave ended");
  }
  if (action === "waves_reset") { department.waves = []; department.shifts = []; return result("Activity history reset"); }
  if (action === "execute") {
    const definition = (department.feature.actions || []).find((item: RecordData) => item.id === body.action_id);
    if (!definition) return reject("That action was not found.", 404);
    const answers = record(body.answers);
    if ((definition.questions || []).some((question: RecordData) => question.required && !String(answers[question.id] ?? "").trim())) return reject("Answer all required questions.");
    department.executions = bounded([{ id: nextId(state, "execution"), action_id: definition.id, action_name: definition.name, user_id: viewer.id, user_name: viewer.name, answers: copy(answers), created_at: iso(now), preview: true }, ...department.executions]);
    return result("Action completed locally; no message was sent");
  }
  if (action === "department_delete") {
    guild.departments.records = guild.departments.records.filter((item) => item !== department);
    guild.departments.resources = guild.departments.resources.filter((item) => ![department.profile.id, department.profile.name].includes(String(item.department_id || item.department)));
    guild.config.Applications.applications = (guild.config.Applications?.applications || []).filter((item: RecordData) => item.department_id !== department.profile.id);
    return result("Department deleted");
  }
  return reject("This department action is not available in the preview.");
}

function joinRequest(state: PreviewState, request: PreviewRequest): PreviewReply {
  const { endpoint, params, body } = request;
  const code = String(params.code || body.code || "").trim().toUpperCase();
  const guild = Object.values(state.guilds).find((item) => item.departments.records.some((department) => department.profile.join_code?.toUpperCase() === code));
  const department = guild?.departments.records.find((item) => item.profile.join_code?.toUpperCase() === code);
  if (!guild || !department) return reject("That preview join code was not found.", 404);
  const viewer = viewerFor(guild, params.user || body.user);
  const isMember = department.members.some((member) => member.id === viewer.id);
  const requested = department.requests.some((member) => member.id === viewer.id);
  const gatedId = department.profile.application_id || department.feature.join_application_id;
  const standardApplication = (guild.config.Applications?.applications || []).find((item: RecordData) => item.id === gatedId);
  const application = standardApplication || guild.departments.resources.find((item) => item.id === gatedId && item.kind === "application");
  if (endpoint === "dashboard_departmentjoinpreview") return reply({ state: isMember ? "member" : requested ? "requested" : "available", applicationGated: Boolean(application), department: { ...department.profile, serverId: guild.id, serverName: guild.meta.guild.name, serverIcon: guild.meta.guild.icon, memberCount: department.members.length } });
  if (body.action && body.action !== "join") return reject("This join action is not available in the preview.");
  if (isMember) return success("You already belong to this department.", { state: "member", department: department.profile.name, role: ranksOf(department).find((rank) => rank.join_rank)?.name || "Member" });
  if (requested) return reply({ state: "requested", department: department.profile.name });
  if (application) return reply({ state: "application_required", server_id: guild.id, department_id: department.profile.id, department: department.profile.name, application: { ...application, title: application.title || application.name, source: standardApplication ? "standard" : "legacy" } });
  department.requests = bounded([{ id: viewer.id, name: viewer.name, username: viewer.username, avatar: viewer.avatar, requestedAt: iso() }, ...department.requests]);
  audit(state, guild.id, "membership_request", "Requested department membership.", viewer.id);
  return reply({ state: "requested", department: department.profile.name });
}

const RESOURCE_ENDPOINTS = new Set(["dashboard_deptresources", "dashboard_deptdocument", "dashboard_resource_versions", "dashboard_resource_version_restore", "dashboard_deptsheetops"]);
const DEPARTMENT_ENDPOINTS = new Set(["dashboard_departments", "dashboard_departmentfeature", "dashboard_departmentappconfig", "dashboard_departmentaction", "dashboard_departmentjoin", "dashboard_departmentjoinpreview", "dashboard_mydepartments", "dashboard_departmentpublic", "dashboard_departmentlink", "dashboard_departmentprofiles", "dashboard_member_submission", "dashboard_membersubmission"]);

/** Called with the current visitor's state; this module never owns a store or makes a network request. */
export function handleDepartmentRequest(state: PreviewState, request: PreviewRequest): PreviewReply | undefined {
  const { endpoint, params, body, method } = request;
  if (RESOURCE_ENDPOINTS.has(endpoint)) return resourceRequest(state, request);
  if (!DEPARTMENT_ENDPOINTS.has(endpoint)) return undefined;
  if (endpoint === "dashboard_departmentjoinpreview" || (endpoint === "dashboard_departmentjoin" && body.code && !["generate", "set_code"].includes(body.action))) return joinRequest(state, request);
  if (endpoint === "dashboard_mydepartments") return reply({ departments: Object.values(state.guilds).flatMap((guild) => guild.departments.records.filter((department) => department.members.some((member) => member.id === (params.user || VIEWER_ID))).map(({ profile, members }) => ({ parentId: guild.id, departmentId: profile.id, name: profile.name, logo_url: profile.logo_url || null, serverName: guild.meta.guild.name, viaAdmin: true, id: profile.id, parentGuildId: guild.id, discordGuildId: profile.discord_guild_id || guild.id, description: profile.description || "", icon: profile.logo_url || null, memberCount: members.length, permissions: ["administrator"] }))) });
  const guild = state.guilds[params.server];
  if (!guild) return reject("That preview server was not found.", 404);
  const fixtures = guild.departments;
  const departmentId = String(params.department || body.department_id || body.department || "");
  const department = departmentId ? fixtures.records.find((item) => item.profile.id === departmentId || (endpoint === "dashboard_departmentpublic" && (item.feature.public_page?.slug === departmentId || publicSlugOf(item) === departmentId))) : fixtures.records[0];

  if (endpoint === "dashboard_departmentaction" && body.action === "spreadsheet_op") {
    const resource = fixtures.resources.find((item) => item.id === body.resource_id && item.kind === "spreadsheet");
    if (!resource) return reject("That spreadsheet was not found.", 404);
    if (!body.client_id || !Array.isArray(body.ops) || body.ops.some((op: RecordData) => typeof op.id !== "string" || !op.params || typeof op.params !== "object")) return reject("Provide valid spreadsheet operations.");
    const stream = fixtures.sheetOps[resource.id] ||= { cursor: 0, entries: [] };
    stream.cursor += 1;
    stream.entries = bounded([...stream.entries, { cursor: stream.cursor, client_id: String(body.client_id), ops: copy(body.ops.slice(0, 100)) }].reverse(), 200).reverse();
    return reply({ cursor: stream.cursor });
  }
  if (endpoint === "dashboard_departmentlink" && body.action === "unlink") {
    const target = fixtures.records.find((item) => item.profile.discord_guild_id === body.guild_id);
    if (!target) return reject("That linked server was not found.", 404);
    target.profile.discord_guild_id = null;
    syncProfiles(state, guild.id);
    audit(state, guild.id, "department_unlink", "Unlinked the department server.", body.user);
    return success("Server unlinked in this preview.");
  }
  if (endpoint === "dashboard_departmentprofiles") return reject("Department creation is not available in this preview.");
  if (endpoint === "dashboard_departments") {
    const payload = departmentPayload(state, guild.id, departmentId || undefined, params.user);
    return payload ? reply(payload) : reject("That department was not found.", 404);
  }
  if (!department) return reject("That department was not found.", 404);
  if (endpoint === "dashboard_departmentappconfig") {
    if (method === "GET") return reply({ config: guild.config, meta: guild.meta });
    try {
      const config = copy(guild.config);
      for (const [path, value] of Object.entries(record(body.set))) configPatch(config, path, value);
      if (Array.isArray(body.unset)) for (const path of body.unset) configPatch(config, String(path), undefined, true);
      const incoming = Array.isArray(body.applications) ? body.applications : config.Applications?.applications;
      if (Array.isArray(incoming)) {
        const belongs = (item: RecordData) => [department.profile.id, department.profile.name].includes(String(item.department_id || item.department || ""));
        config.Applications = { ...(config.Applications || {}), applications: [...(guild.config.Applications?.applications || []).filter((item: RecordData) => !belongs(item)), ...incoming.filter(belongs)] };
      }
      const profiles = Array.isArray(body.profiles) ? body.profiles : config.Department?.profiles;
      const profile = Array.isArray(profiles) ? profiles.find((item: RecordData) => item.id === department.profile.id) : undefined;
      if (profile) Object.assign(department.profile, copy(profile));
      guild.config = config;
      syncProfiles(state, guild.id);
      audit(state, guild.id, "department_application_settings", "Saved department application settings.", body.user);
      return reply({ config: guild.config, meta: guild.meta });
    } catch {
      return reject("Those application settings could not be saved.");
    }
  }
  if (endpoint === "dashboard_member_submission" || endpoint === "dashboard_membersubmission") {
    const submission = department.submissions[params.member];
    return reply(submission ? { found: true, submission } : { found: false });
  }
  if (endpoint === "dashboard_departmentpublic") {
    if (!department.feature.public_page_enabled) return reject("This department has no public page.", 404);
    const payload = departmentPayload(state, guild.id, department.profile.id)!;
    return reply({ department: { ...department.profile, memberCount: department.members.length }, ranks: ranksOf(department).map((rank) => ({ ...rank, members: department.members.filter((member) => member.rankRoleId === rank.id).length })), leadership: department.members.filter((member) => member.owner).map((member) => ({ name: member.name, avatar: member.avatar })), announcements: department.announcements.filter((post) => (!post.scheduled_for || post.delivered_at) && (!post.visibility || post.visibility === "all")).slice(0, 5), documents: payload.resources.filter((resource: RecordData) => ["document", "spreadsheet"].includes(resource.kind) && resource.share?.access === "link"), activity: { newMembers30d: department.members.filter((member) => timestamp(member.joinedAt) > Date.now() - 30 * day).length }, join: { code: department.profile.join_code, applicationGated: Boolean(department.profile.application_id || department.feature.join_application_id) } });
  }
  if (endpoint === "dashboard_departmentfeature") {
    if (method !== "POST" && method !== "PATCH") return reject("Use a save request for department settings.", 405);
    Object.assign(department.feature, copy(record(body.feature)));
    const editable = new Set(["name", "description", "logo_url", "banner_url", "accent_color", "join_role_id", "rank_roles", "application_id"]);
    for (const [key, value] of Object.entries(record(body.profile))) if (editable.has(key)) (department.profile as RecordData)[key] = copy(value);
    syncProfiles(state, guild.id);
    audit(state, guild.id, "department_settings", "Saved department settings.", body.user);
    return success("Department settings saved.", { feature: department.feature, profile: department.profile });
  }
  if (endpoint === "dashboard_departmentjoin") {
    if (!["generate", "set_code"].includes(String(body.action))) return reject("This join-code action is not available in the preview.");
    const code = body.action === "generate" ? `TEST${nextId(state, "code").replace(/\D/g, "")}` : String(body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3,16}$/.test(code)) return reject("Use 3 to 16 letters or numbers for the join code.");
    if (Object.values(state.guilds).some((item) => item.departments.records.some((other) => other !== department && other.profile.join_code === code))) return reject("That preview code is already in use.", 409);
    department.profile.join_code = code;
    syncProfiles(state, guild.id);
    audit(state, guild.id, "department_code", "Changed the department join code.", body.user);
    return success("Join code updated.", { code });
  }
  if (endpoint === "dashboard_departmentaction") return departmentAction(state, request, department);
  return reject("This department request is not available in the preview.");
}
