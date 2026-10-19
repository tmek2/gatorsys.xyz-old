import { handleAccountRequest } from "./account";
import { handleDepartmentRequest } from "./departments";
import { handleManagementRequest } from "./management";
import { PREVIEW_USER_ID } from "./identity";
import type { PreviewReply, PreviewRequest, PreviewState } from "./types";

const respond = (data: unknown, status = 200): PreviewReply => ({ status, data: structuredClone(data) });
const denied = (message: string, status = 400) => respond({ message, detail: message }, status);
const WRITE_ONLY = new Set([
  "delinfraction", "UpdateInfraction", "dashboard_staffaction", "dashboard_departmentaction",
  "dashboard_departmentjoin", "dashboard_departmentlink", "dashboard_ticketpanels", "dashboard_ticketpanelsend",
  "dashboard_application_submit", "dashboard_application_decision", "dashboard_application_decision_bulk",
  "dashboard_application_publish_staged", "dashboard_application_response_delete", "dashboard_application_ai_scan",
  "dashboard_departmentappdecision", "dashboard_resource_version_restore", "dashboard_sessionpanel", "dashboard_media",
]);

function setPath(target: Record<string, any>, path: string, value: unknown, remove = false) {
  const parts = path.split(".");
  if (!parts.length || parts.some(key => !key || ["__proto__", "constructor", "prototype"].includes(key))) {
    throw new Error("Invalid setting path");
  }
  let cursor = target;
  for (const key of parts.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  if (remove) delete cursor[parts.at(-1)!];
  else cursor[parts.at(-1)!] = structuredClone(value);
}

/** This is the preview's only data service. It has no network implementation. */
export function dispatchPreview(state: PreviewState, input: PreviewRequest): PreviewReply {
  const request: PreviewRequest = { ...input, params: { ...input.params, user: PREVIEW_USER_ID }, body: { ...input.body, user: PREVIEW_USER_ID } };
  if (["GET", "HEAD"].includes(request.method) && WRITE_ONLY.has(request.endpoint)) return denied("This action requires a write request.", 405);
  if (request.endpoint === "dashboard_owner" || request.endpoint === "dashboard_globalcontext") {
    return denied("The test account has server access only.", 403);
  }
  if (request.endpoint === "mutual_servers") {
    const membership = handleDepartmentRequest(state, { ...request, endpoint: "dashboard_mydepartments" });
    const data = membership?.data as { departments?: unknown[] } | undefined;
    return respond({ mutual: Object.values(state.guilds).map(guild => guild.info), departments: data?.departments || [] });
  }
  const guild = state.guilds[request.params.server];
  if (["permissions", "dashboard_meta", "dashboard_config"].includes(request.endpoint)) {
    if (!guild) return denied("This server is not part of the preview.", 404);
    if (request.endpoint === "permissions") return respond({ isAdmin: true, isOwner: true });
    if (request.endpoint === "dashboard_meta") {
      return respond({ ...guild.meta, modules: guild.config.Modules, members: guild.members });
    }
    if (request.method !== "GET") {
      try {
        // Apply atomically: an invalid path cannot leave half a settings save.
        const config = structuredClone(guild.config);
        for (const [path, value] of Object.entries(request.body.set || {})) setPath(config, path, value);
        for (const path of request.body.unset || []) setPath(config, String(path), undefined, true);
        guild.config = config;
        guild.meta.modules = { ...config.Modules };
        guild.info.moduleCount = Object.values(config.Modules || {}).filter(Boolean).length;
        guild.management.audit.unshift({ guild_id: guild.id, actor_id: PREVIEW_USER_ID, actor_name: "Dev User", action: "dashboard.update", module: request.body.module || "configuration", summary: request.body.summary || "Preview settings updated", created_at: new Date().toISOString() });
        guild.management.audit.length = Math.min(guild.management.audit.length, 100);
      } catch {
        return denied("Those preview settings could not be applied.");
      }
    }
    return respond({ config: guild.config });
  }
  try {
    return handleManagementRequest(state, request)
      || handleDepartmentRequest(state, request)
      || handleAccountRequest(state, request)
      || denied("This preview action is not available.", 404);
  } catch (error) {
    console.error("[preview] action failed", request.endpoint, error instanceof Error ? error.message : "Unknown failure");
    return denied("The simulated action could not be completed. Your real data is unaffected.", 500);
  }
}
