"use client";

import React, { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { useOptionalManage } from "../manage-context";

/* Small controls shared by the button editors: colour swatches, and the saved templates, panels and applications a button can point at. */

const ROW_BUTTON_COLORS = [
  { value: "Grey", label: "Grey" },
  { value: "Blue", label: "Blurple" },
  { value: "Green", label: "Green" },
  { value: "Red", label: "Red" },
];

const ROW_COLOR_CLASSES: Record<string, string> = {
  Grey: "bg-[#525252]",
  Blue: "bg-[#5865f2]",
  Green: "bg-[#248046]",
  Red: "bg-[#da373c]",
};

/**
 * Stored targets a container button can point at, fetched once per editor, so
 * templates, panels and applications are picked from dropdowns instead of typed
 * as ids.
 */
export interface ButtonTargets {
  forms: string[];
  messages: string[];
  embeds: string[];
  panels: string[];
  ticketPanels: Record<string, any>[];
  applications: { id: string; name: string }[];
}

export function useButtonTargets(): ButtonTargets {
  // Optional: the automation canvas mounts this chain on its own route without
  // a `ManageProvider`. Without a config there are just no saved panels or
  // templates to offer.
  const manage = useOptionalManage();
  const guildId = manage?.guildId ?? "";
  const value = manage?.value ?? (() => undefined);
  const [fetched, setFetched] = useState<{
    forms: string[];
    messages: string[];
    embeds: string[];
    panels: string[];
    ticketPanels: Record<string, any>[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/manage/${guildId}/templates`).then((res) => (res.ok ? res.json() : {})) as Promise<any>,
      fetch(`/api/manage/${guildId}/panels`).then((res) => (res.ok ? res.json() : {})) as Promise<any>,
    ])
      .then(([templates, panels]) => {
        if (cancelled) return;
        setFetched({
          forms: (templates.forms || [])
            .map((template: any) => String(template?.name || ""))
            .filter(Boolean),
          // Message templates saved from the Commands & Templates tab live in
          // the same store; surface them so message rows can pick them.
          messages: (templates.messages || [])
            .map((template: any) => String(template?.name || ""))
            .filter(Boolean),
          embeds: (templates.embeds || [])
            .map((template: any) => String(template?.name || ""))
            .filter(Boolean),
          panels: (panels.panels || [])
            .map((panel: any) => String(panel?.name || ""))
            .filter(Boolean),
          ticketPanels: (panels.panels || []).filter(
            (panel: any) => (panel?.type || "single") === "single",
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setFetched({ forms: [], messages: [], embeds: [], panels: [], ticketPanels: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const applications = Array.isArray(value("Applications.applications"))
    ? value("Applications.applications")
        .map((app: any) => ({ id: String(app?.id || ""), name: String(app?.name || app?.id || "") }))
        .filter((app: { id: string }) => app.id)
    : [];

  return {
    forms: fetched?.forms || [],
    messages: fetched?.messages || [],
    embeds: fetched?.embeds || [],
    panels: fetched?.panels || [],
    ticketPanels: fetched?.ticketPanels || [],
    applications,
  };
}

/** Discord's four button styles, picked by colour. */
export function ButtonColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const current = value || "Grey";
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Button colour">
      {ROW_BUTTON_COLORS.map((option) => {
        const selected = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform ${
              ROW_COLOR_CLASSES[option.value]
            } ${
              selected
                ? // Ringed, because "the vivid one" is not distinguishable among
                // four saturated swatches.
                  "scale-105 ring-2 ring-white/85 ring-offset-2 ring-offset-[#131415]"
                : "opacity-60 hover:scale-105 hover:opacity-100"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)]`}
          >
            {selected ? <IconCheck size={13} className="text-white" /> : null}
          </button>
        );
      })}
    </div>
  );
}
