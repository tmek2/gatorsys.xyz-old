export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  accentColor?: string | null;
  owner: boolean;
  permissions: string;
}

export interface MutualGuildsResponse {
  mutual: MutualGuild[];
  departments?: DepartmentMembership[];
}

export interface DepartmentMembership {
  id: string;
  parentGuildId: string;
  discordGuildId: string;
  name: string;
  description: string;
  icon: string | null;
  memberCount: number;
  permissions: string[];
}

export interface MutualGuild {
  id: string;
  name: string;
  icon: string | null;
  /** Facts the bot sends with every guild. */
  memberCount?: number;
  channelCount?: number;
  roleCount?: number;
  /**
   * How many modules the server has on, from the bot's canonical list.
   * Optional: older bots do not send it, and leaving the line out beats
   * printing zero.
   */
  moduleCount?: number;
  /** The server's own banner, or Discord's invite splash as a second choice. */
  banner?: string | null;
  splash?: string | null;
  isAdmin?: boolean;
  isManager?: boolean;
}

export interface InfractionResponse {
  id: string;
  // Add other infraction fields as needed
}
