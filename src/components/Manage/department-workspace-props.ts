import type {
  DepartmentProfile,
  DepartmentViewer,
} from "./types";

/**
 * Rules for which records belong to a department and what the viewer may do,
 * used to build DepartmentWorkspace's props.
 */

/** Does this record belong to the open department? */
export function belongsToDepartment(
  record: { department?: unknown; department_id?: unknown },
  profile: Pick<DepartmentProfile, "id" | "name">,
): boolean {
  const id = String(profile.id ?? "");
  const name = String(profile.name ?? "");
  const owner = String(record.department_id ?? record.department ?? "");
  return owner === id || (Boolean(name) && owner === name);
}

/**
 * What the viewer may do in this department. The viewer's real permissions win
 * whenever the payload has them; the administrator fallback is only for when
 * there is no viewer record at all (the API would refuse buttons shown in
 * error).
 */
export function departmentPermissions(
  viewer: DepartmentViewer | null | undefined,
  fallbackIsAdmin: boolean,
): string[] | undefined {
  const granted = viewer?.permissions;
  if (Array.isArray(granted) && granted.length) return granted;
  if (viewer) return fallbackIsAdmin ? ["administrator"] : [];
  return undefined;
}
