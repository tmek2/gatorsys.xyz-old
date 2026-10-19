import type { GuildConfig, GuildMeta } from "@/components/Manage/types";
import type { MutualGuild } from "@/types/discord";
import type { AccountFixtures } from "./account";
import type { DepartmentFixtures } from "./departments";
import type { ManagementFixtures } from "./management";

export interface PreviewMember {
  id: string;
  name: string;
  username: string;
  display_name: string;
  avatar: string | null;
  roles: string[];
}

export interface PreviewGuildBase {
  id: string;
  info: MutualGuild;
  meta: GuildMeta;
  config: GuildConfig;
  members: PreviewMember[];
}

export interface PreviewGuild extends PreviewGuildBase {
  management: ManagementFixtures;
  departments: DepartmentFixtures;
}

export interface PreviewState {
  guilds: Record<string, PreviewGuild>;
  account: AccountFixtures;
  sequence: number;
}

export interface PreviewRequest {
  endpoint: string;
  method: string;
  params: Record<string, string>;
  body: Record<string, any>;
}

export interface PreviewReply {
  status?: number;
  data: unknown;
}
