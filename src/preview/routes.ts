import type { PreviewRequest } from "./types";

const manageEndpoints: Record<string, string> = {
  aicontext: "dashboard_aicontext", aigaps: "dashboard_aigaps",
  applicationaiscan: "dashboard_application_ai_scan", applicationdecision: "dashboard_application_decision",
  applicationdecisionbulk: "dashboard_application_decision_bulk", applicationpublishstaged: "dashboard_application_publish_staged",
  applicationresponsedelete: "dashboard_application_response_delete", applicationresponses: "dashboard_application_responses",
  audit: "dashboard_audit", automations: "dashboard_automations", autoresponders: "dashboard_autoresponders",
  botprofile: "dashboard_botprofile", config: "dashboard_config", connectionroles: "dashboard_connectionroles",
  customcommandai: "dashboard_customcommand_ai", customcommands: "dashboard_customcommands",
  departmentaction: "dashboard_departmentaction", departmentjoin: "dashboard_departmentjoin",
  departmentlink: "dashboard_departmentlink", departmentprofiles: "dashboard_departmentprofiles",
  departments: "dashboard_departments", deptresources: "dashboard_deptresources", deptsheetops: "dashboard_deptsheetops",
  gatorai: "dashboard_gatorai", "infraction-types": "dashboard_infractiontypes", media: "dashboard_media",
  membersubmission: "dashboard_membersubmission", messages: "dashboard_messages", meta: "dashboard_meta", panels: "dashboard_panels",
  prcserver: "dashboard_prcserver", qotd: "dashboard_qotd", resourceversionrestore: "dashboard_resource_version_restore",
  resourceversions: "dashboard_resource_versions", sessionpanel: "dashboard_sessionpanel", staff: "dashboard_staff",
  staffaction: "dashboard_staffaction", templates: "dashboard_templates", ticketpanels: "dashboard_ticketpanels",
  ticketpanelsend: "dashboard_ticketpanelsend",
};

export interface MappedPreviewRequest {
  request: PreviewRequest;
  project?: "department-meta" | "department-config" | "guild";
}

/** Website routes keep their public shapes while sharing the same local bot
 * adapter as server-rendered pages. Unknown routes fail closed. */
export function mapPreviewRoute(pathname: string, method: string, query: URLSearchParams, body: Record<string, any>): MappedPreviewRequest | null {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "api") return null;
  const params = Object.fromEntries(query);
  const request: PreviewRequest = { endpoint: "", method, params, body };
  if (parts[1] === "manage" && parts.length === 4) {
    request.endpoint = manageEndpoints[parts[3]];
    params.server = parts[2];
    if (parts[3] === "staff" && params.member) request.endpoint = "dashboard_staffmember";
  } else if (parts[1] === "mutual") request.endpoint = "mutual_servers";
  else if (parts[1] === "account" && parts[2] === "roblox") request.endpoint = "dashboard_roblox_identity";
  else if (parts[1] === "roblox") request.endpoint = parts[2] === "search" ? "preview_roblox_search" : "preview_roblox_user";
  else if (parts[1] === "application" && parts.length === 4) {
    params.server = parts[2]; params.application = parts[3];
    request.endpoint = method === "GET" ? "dashboard_application_public" : "dashboard_application_submit";
    request.body = { ...body, application: parts[3] };
  } else if (parts[1] === "departments") {
    if (parts[2] === "mine") request.endpoint = "dashboard_mydepartments";
    else if (parts[2] === "join") {
      request.endpoint = parts[3] === "preview" ? "dashboard_departmentjoinpreview" : "dashboard_departmentjoin";
      params.server = "0";
    } else if (parts.length >= 4) {
      params.server = parts[2]; params.department = parts[3];
      request.body = { ...body, department: parts[3], department_id: parts[3] };
      const action = parts[4];
      if (!action) request.endpoint = "dashboard_departments";
      else if (action === "feature") request.endpoint = "dashboard_departmentfeature";
      else if (action === "doc") { request.endpoint = "dashboard_deptdocument"; params.resource = parts[5]; }
      else if (action === "applicationresponses") request.endpoint = "dashboard_departmentappresponses";
      else if (action === "applicationdecision") request.endpoint = "dashboard_departmentappdecision";
      else if (action === "appconfig") {
        request.endpoint = "dashboard_departmentappconfig";
        return { request, project: method === "GET" && params.scope === "meta" ? "department-meta" : "department-config" };
      }
    }
  } else if (parts[1] === "docs" && parts[2] === "shared") {
    request.endpoint = "dashboard_deptdocument"; params.server = parts[3]; params.resource = parts[4];
  } else if (parts[1] === "p") {
    request.endpoint = "dashboard_departmentpublic"; params.server = parts[2]; params.department = parts[3];
  } else if (parts[1] === "infractions") {
    params.server = parts[2]; params.id = parts[3];
    request.endpoint = !parts[3] ? "infractions" : parts[4] === "update" ? "UpdateInfraction" : parts[4] === "delete" ? "delinfraction" : "infraction";
  } else if (parts[1] === "transcript") { request.endpoint = "transcript"; params.id = parts[2]; }
  else if (parts[1] === "guild") {
    request.endpoint = "mutual_servers";
    return { request, project: "guild" };
  } else if (parts[1] === "owner") request.endpoint = parts[2] === "context" ? "dashboard_globalcontext" : "dashboard_owner";
  return request.endpoint ? { request } : null;
}

export function projectPreviewReply(project: MappedPreviewRequest["project"], data: any) {
  if (project === "department-meta") return data.meta || {};
  if (project === "department-config") return { config: data.config || {} };
  if (project === "guild") return { mutualGuilds: data.mutual || [] };
  return data;
}
