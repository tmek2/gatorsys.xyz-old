import { STAFF_MODULE_ALIASES } from "./schema";

/**
 * Whether a module is on. Missing means off everywhere, as in the bot
 * (`enabled_module_names` reads `bool(modules.get(key))`).
 */
export function isModuleEnabled(
  value: (path: string) => unknown,
  moduleKey: string,
): boolean {
  if (moduleKey === "Staff") {
    // Staff was split across several legacy flags; any one of them counts.
    return (
      Boolean(value("Modules.Staff")) ||
      STAFF_MODULE_ALIASES.some((alias) => Boolean(value(`Modules.${alias}`)))
    );
  }
  if (moduleKey === "GatorAI") {
    // GatorAI predates the Modules map and has its own enabled flag: a stored
    // Modules value wins; otherwise the assistant's own setting decides, as the
    // bot resolves it.
    const stored = value("Modules.GatorAI");
    if (stored !== undefined && stored !== null) return Boolean(stored);
    return value("GatorAI.enabled") !== false;
  }
  return Boolean(value(`Modules.${moduleKey}`));
}
