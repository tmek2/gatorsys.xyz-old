export interface ManagedRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
  managed: boolean;
}

export type ChannelKind =
  | "text"
  | "announcement"
  | "voice"
  | "stage"
  | "forum"
  | "category"
  | "thread";

export interface ManagedChannel {
  id: string;
  name: string;
  type: ChannelKind;
  parentId: string | null;
  position: number;
}

export interface ManagedEmoji {
  id: string;
  name: string;
  animated: boolean;
  /** "guild" for the server's own emojis, "bot" for the app's emojis. */
  source: "guild" | "bot";
}

export interface GuildMeta {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    ownerId: string | null;
    createdAt: string;
    premiumTier: number;
    boostCount: number;
  };
  me: { id: string; isAdmin: boolean; isOwner: boolean };
  roles: ManagedRole[];
  channels: ManagedChannel[];
  emojis?: ManagedEmoji[];
  modules: Record<string, boolean>;
}

export type GuildConfig = Record<string, any>;

export interface AuditEntry {
  guild_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar?: string | null;
  action: string;
  module: string;
  summary: string;
  command?: string;
  status?: string;
  channel_id?: string | null;
  channel_name?: string | null;
  arguments?: Record<string, string>;
  duration_ms?: number | null;
  error?: string | null;
  interaction_id?: string | null;
  created_at: string;
  metadata?: {
    previous?: string;
    now?: string;
    changes?: string[];
  };
}

export interface AutoResponderAction {
  type: string;
  role_id?: string | number | null;
  reason?: string;
  minutes?: number;
  channel_id?: string | number | null;
  message?: Record<string, any>;
  role_name?: string;
  role_color?: string;
  role_position?: "top" | "bottom";
  nickname?: string;
  seconds?: number;
  emoji?: string;
  thread_name?: string;
  auto_archive_duration?: number;
}

export interface AutoResponderRequirement {
  type: string;
  role_id?: string | number | null;
}

export interface AutoResponder {
  trigger: string;
  response: string;
  similarity?: number;
  actions?: AutoResponderAction[];
  requirements?: AutoResponderRequirement[];
  /** Rich reply (content + embed or container) — preferred over `response`. */
  response_message?: Record<string, any>;
}

export interface ConnectionRole {
  guild: string;
  parent: string;
  child: string;
  name?: string;
}

export interface TicketPanel {
  _id?: string;
  guild: string;
  type?: string;
  name: string;
  [key: string]: any;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number | string;
  thumbnail?: string;
  image?: string;
  /** Makes the title a link, exactly as Discord's `embed.url` does. */
  url?: string;
  /** Renders in the footer line, after the footer text. Either an ISO 8601
   *  instant or the literal `"now"`, which the bot resolves when it sends. */
  timestamp?: string;
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  fields?: EmbedField[];
}

/**
 * Discord's per-field embed limits and the 6000-character total. The API
 * rejects an embed over any of them, so counters, warnings and trimming all
 * read these.
 */
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  author: 256,
  fields: 25,
  total: 6000,
} as const;

/**
 * How much of the 6000-character budget an embed uses, counted as Discord does:
 * title, description, footer, author, and every field name and value.
 */
export function embedCharacterCount(embed: MessageEmbed | undefined): number {
  if (!embed) return 0;
  let total = 0;
  total += (embed.title || "").length;
  total += (embed.description || "").length;
  total += (embed.footer?.text || "").length;
  total += (embed.author?.name || "").length;
  for (const field of embed.fields || []) {
    total += (field.name || "").length + (field.value || "").length;
  }
  return total;
}

export interface CustomMessage {
  content?: string;
  embed?: MessageEmbed;
  components?: any[];
  render_mode?: string;
}

export interface DepartmentProfile {
  accent_color?: string | null;
  id: string;
  name: string;
  callsign_prefix?: string;
  command_roles: string[];
  rank_roles: string[];
  channels: { main?: string; logs?: string; review?: string };
  logo_url?: string;
  banner_url?: string;
  description?: string;
  active: boolean;
  application_id?: string | null;
  accepted_role_id?: string | null;
  trainee_role_ids?: string[];
  vacancies?: number;
  source?: string;
  /** Emoji/icon shown on the department card. */
  icon?: string;
  /** Department category chosen in the create wizard (law/fire/medical/…). */
  department_type?: string;
  /** Guild id of the parent/linked server, or null for this server. */
  parent_guild_id?: string | null;
  /** Discord server linked directly to this department. */
  discord_guild_id?: string | null;
  /** Member-facing dashboard code and the Discord role it grants. */
  join_code?: string;
  join_role_id?: string | null;
  created_by?: string | null;
  manager_ids?: string[];
}

export interface DepartmentRoster {
  id: string;
  members: number;
  onLoa: number;
  ranks: { roleId: string; name: string | null; members: number }[];
  memberRows?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    rankRoleId: string | null;
    rankName: string;
    joinedAt: string | null;
    onLoa: boolean;
    activitySeconds?: number;
    points?: number;
    owner?: "server" | "department" | null;
  }[];
  membershipRequests?: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    requestedAt: string | null;
  }[];
}

export interface DepartmentViewer {
  id: string;
  name: string;
  username: string;
  avatar: string;
  roles: string[];
  joinedAt: string | null;
  permissions?: string[];
  departmentOwnerId?: string | null;
  isDepartmentOwner?: boolean;
  isDepartmentCoOwner?: boolean;
}

export interface LinkedDepartmentServer {
  id: string | null;
  name: string | null;
  icon?: string | null;
  memberCount?: number | null;
  reachable: boolean;
  editable?: boolean;
  profiles?: DepartmentProfile[];
  roles?: ManagedRole[];
  channels?: ManagedChannel[];
}

export interface DepartmentNetwork {
  mode: string | null;
  hubGuildId: string | null;
  hubGuildName: string | null;
  linked: LinkedDepartmentServer[];
  /** On a linked department server: the hub departments bound to it. */
  hubDepartments?: {
    id: string;
    name: string;
    description?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    accent_color?: string | null;
    memberCount?: number;
  }[];
}

export interface CustomCommandOption {
  ix?: number;
  name: string;
  description: string;
  type: string;
  required: boolean;
  choices: string[];
  channel_types: string[];
  user_source: string;
  use_for_send: boolean;
  choice_flows?: Record<string, CustomCommandFlowStep[]>;
  choice_conditions?: Record<string, { required_role_id: string | number }>;
}

export interface CustomCommandFlowStep {
  type: string;
  seconds?: number;
  target?: string;
  content?: string;
  template_name?: string;
  role_id?: string | number | null;
}

export interface CustomCommandDoc {
  name: string;
  Command?: string;
  description?: string;
  category?: string;
  content?: string | null;
  embed?: MessageEmbed;
  command_options?: CustomCommandOption[];
  permissionroles?: string[];
  ping?: string | null;
  target_channel_id?: string | null;
  disabled?: boolean;
  render_mode?: string;
  v2_layout?: any[];
  /** Whether the layout places its own containers, rather than relying on the
   *  implicit wrapper. See `toEditorLayout` in message-design.tsx. */
  v2_explicit_layout?: boolean;
  v2_color?: string;
  components?: any[];
}

export interface ApplicationQuestion {
  id: string;
  question: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  max_length?: number;
  /** Extra validation rules enforced by the bot's apply_validation_rules. */
  validation?: unknown[];
  [key: string]: any;
}

export interface GuildApplication {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  questions: ApplicationQuestion[];
  [key: string]: any;
}
