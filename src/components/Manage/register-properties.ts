"use client";

/**
 * Custom properties that must animate, registered from script. `--gw-fill` (how
 * far a module card's or option tile's colour has filled) only animates when
 * typed. The production minifier rewrote the stylesheet `@property`'s
 * `initial-value: 0%` to `0`, which is not a <percentage>, so the browser
 * discarded the rule. Registering here avoids CSS tooling; the stylesheet's
 * `@property` stays for environments without script.
 */
const PROPERTIES: PropertyDefinition[] = [
  { name: "--gw-fill", syntax: "<percentage>", inherits: false, initialValue: "0%" },
];

let done = false;

export function registerAnimatedProperties() {
  if (done || typeof window === "undefined") return;
  done = true;
  const css = window.CSS as typeof CSS & {
    registerProperty?: (definition: PropertyDefinition) => void;
  };
  if (typeof css?.registerProperty !== "function") return;
  for (const definition of PROPERTIES) {
    try {
      css.registerProperty(definition);
    } catch {
      // Already registered (by an earlier mount, or a valid `@property` in an
      // unminified build).
    }
  }
}

// On import: before the first card or tile is drawn, not after.
registerAnimatedProperties();
