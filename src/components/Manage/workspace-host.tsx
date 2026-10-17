"use client";

import { createContext, useContext } from "react";
import type { GuildMeta } from "./types";

/**
 * The surface the department workspace needs from its host (the member portal
 * at /departments/[parent]/[department], backed by the member-safe departments
 * API), so the workspace does not depend on where it runs.
 */
export type WorkspaceHost = {
  guildId: string;
  meta: GuildMeta | null;
  setNotice: (notice: { kind: "saved" | "error"; text: string } | null) => void;
  refreshConfig: () => Promise<void>;
  /** Set in the member portal (`/departments/[parent]/[department]`) so
   *  workspace links stay inside the portal instead of /manage. */
  portalBase?: string | null;
};

const WorkspaceHostContext = createContext<WorkspaceHost | null>(null);

export const WorkspaceHostProvider = WorkspaceHostContext.Provider;

export function useWorkspaceHost(): WorkspaceHost {
  const context = useContext(WorkspaceHostContext);
  if (!context)
    throw new Error(
      "useWorkspaceHost must be used inside a WorkspaceHostProvider",
    );
  return context;
}
