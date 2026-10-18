"use client";

import React from "react";
import { IconArrowLeft, IconPower } from "@tabler/icons-react";
import { RippleButton } from "@/components/site/ripple-button";
import { useManage } from "./manage-context";
import { isModuleEnabled } from "./module-status";
import { NAV_GROUPS } from "./nav-groups";

/** The module's mark from the rail, drawn large for the card's corner. */
function moduleMark(moduleKey: string): React.ReactNode {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => entry.moduleKey === moduleKey);
    if (item && React.isValidElement(item.icon)) {
      return React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 112 });
    }
  }
  return null;
}

/**
 * Gate for sections whose module is off: the settings render dimmed and inert
 * behind a centred card offering to turn it on.
 */
export function ModuleGate({
  moduleKey,
  moduleLabel,
  onGoBack,
  children,
}: {
  moduleKey: string;
  moduleLabel: string;
  onGoBack: () => void;
  children: React.ReactNode;
}) {
  const { value, commit } = useManage();
  // Shared with the sidebar, so a tab and the page behind it always agree.
  const enabled = isModuleEnabled(value, moduleKey);
  const [busy, setBusy] = React.useState(false);

  /* Turned on from here, the settings come into focus out of the blur. A tab
     opened with the module already on simply renders. */
  const wasOff = React.useRef(!enabled);
  const [thaw, setThaw] = React.useState(false);
  React.useEffect(() => {
    if (enabled && wasOff.current) {
      setThaw(true);
      const id = window.setTimeout(() => setThaw(false), 700);
      wasOff.current = false;
      return () => window.clearTimeout(id);
    }
    if (!enabled) wasOff.current = true;
  }, [enabled]);

  const card = (leaving: boolean) => (
    <div className="gw-gate-layer" data-leaving={leaving ? "true" : undefined}>
      <div className="gw-gate" data-busy={busy ? "true" : undefined}>
        <span className="gw-gate-mark" aria-hidden="true">
          {moduleMark(moduleKey)}
        </span>
        <h3 className="gw-gate-title">{moduleLabel} is off</h3>
        {/* The settings are visible behind the card, so one short line is
           enough. */}
        <p className="gw-gate-say">Turn it on to change these settings.</p>
        <div className="gw-gate-acts">
          <RippleButton variant="outline" onClick={onGoBack} className="gw-gate-back" tabIndex={leaving ? -1 : undefined}>
            <IconArrowLeft size={16} aria-hidden="true" />
            Go back
          </RippleButton>
          <RippleButton
            variant="default"
            disabled={busy || leaving}
            onClick={() => {
              setBusy(true);
              void Promise.resolve(commit({ [`Modules.${moduleKey}`]: true }, "Modules")).finally(() =>
                setBusy(false),
              );
            }}
            className="gw-gate-go"
          >
            {busy ? <span className="gw-save-spin" aria-hidden="true" /> : <IconPower size={16} aria-hidden="true" />}
            {busy ? "Turning on" : "Turn it on"}
          </RippleButton>
        </div>
      </div>
    </div>
  );
  /* Turned on from here, the card dissolves while the settings come into
     focus behind it. */
  if (enabled) {
    return thaw ? (
      <div className="relative">
        <div className="gw-gate-thaw">{children}</div>
        {card(true)}
      </div>
    ) : (
      <>{children}</>
    );
  }
  return (
    <div className="relative">
      <div aria-hidden inert className="gw-gate-behind pointer-events-none select-none">
        {children}
      </div>
      {card(false)}
    </div>
  );
}

/** Top-right off switch shown on enabled module sections. */
export function PluginToggleButton({
  moduleKey,
  moduleLabel,
}: {
  moduleKey: string;
  moduleLabel: string;
}) {
  const { value, commit } = useManage();
  const enabled = Boolean(value(`Modules.${moduleKey}`));
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void commit({ [`Modules.${moduleKey}`]: false }, "Modules");
      }}
      aria-label={`Turn off ${moduleLabel}`}
      title={`Turn off ${moduleLabel}`}
      className="gw-power"
    >
      <IconPower size={17} stroke={2} aria-hidden="true" />
      {/* The same words the module card uses. On a phone, the mark alone. */}
      <span className="gw-power-label">Turn off</span>
    </button>
  );
}
