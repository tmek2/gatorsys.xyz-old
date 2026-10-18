"use client";

import React from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import {
  IconChevronDown,
  IconClipboardList,
  IconFileText,
  IconFolder,
  IconLayoutGrid,
  IconLoader2,
  IconPlus,
  IconTable,
} from "@tabler/icons-react";
import { PortalMenu, usePopover } from "./fields";

/**
 * One `+ New` button for the whole workspace, always in the same place, listing
 * everything that can be made (as Melonly does), so the toolbar never changes
 * with the view and a new kind is a row in this file. Each row has a
 * description because "Document", "Form" and "Application" sound alike to a
 * newcomer.
 */

export type NewResourceKind =
  | "document"
  | "spreadsheet"
  | "application"
  | "folder"
  | "workspace";

/**
 * One row in the menu. `kind` is a plain string because several pages use this
 * menu with their own lists; the caller narrows it.
 */
export type NewResourceOption = {
  kind: string;
  label: string;
  description: string;
  icon: TablerIcon;
  badge?: string;
  disabled?: boolean;
};

export const RESOURCE_OPTIONS: NewResourceOption[] = [
  {
    kind: "document",
    label: "Document",
    description: "A rich text page for guides, policies and briefings.",
    icon: IconFileText,
  },
  {
    kind: "spreadsheet",
    label: "Spreadsheet",
    description: "A grid for rosters, trackers and counts.",
    icon: IconTable,
  },
  {
    kind: "application",
    label: "Application",
    description: "A form people fill in, with reviewable responses.",
    icon: IconClipboardList,
  },
  // Listed but not built: disabled, with the reason where the description goes.
  {
    kind: "folder",
    label: "Folder",
    description: "Not built yet. Resources are one flat list for now.",
    icon: IconFolder,
    disabled: true,
  },
  {
    kind: "workspace",
    label: "Bot",
    description: "Not built yet. A server is one gator for now.",
    icon: IconLayoutGrid,
    disabled: true,
  },
];

/**
 * The kinds a department's resource list can hold: the same list, filtered, so
 * a new kind appears everywhere or is excluded on purpose. Gators are excluded:
 * a department is already a separate area with its own resources and access.
 */
export const DEPARTMENT_RESOURCE_OPTIONS: NewResourceOption[] =
  RESOURCE_OPTIONS.filter((option) => option.kind !== "workspace");

export function NewResourceMenu<Kind extends string = NewResourceKind>({
  onCreate,
  busyKind,
  options = RESOURCE_OPTIONS,
  label = "New",
  disabled = false,
}: {
  onCreate: (kind: Kind) => void;
  busyKind?: Kind | null;
  options?: NewResourceOption[];
  label?: string;
  /** The workspace is full. Refused at the trigger rather than per option, so
   *  the menu does not open onto six things you cannot pick. */
  disabled?: boolean;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? "This server is at its resource limit." : undefined}
        className="gator-control gator-control-primary h-10 gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busyKind ? (
          <IconLoader2 size={15} className="animate-spin" />
        ) : (
          <IconPlus size={15} />
        )}
        {label}
        <IconChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="new-resource-menu" role="menu">
            {options.map((option) => {
              const Icon = option.icon;
              const busy = busyKind === option.kind;
              return (
                <button
                  key={option.kind}
                  type="button"
                  role="menuitem"
                  disabled={option.disabled || Boolean(busyKind)}
                  onClick={() => {
                    setOpen(false);
                    onCreate(option.kind as Kind);
                  }}
                  className="new-resource-item"
                >
                  <span className="new-resource-item-icon">
                    {busy ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <Icon size={16} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="new-resource-item-label">
                      {option.label}
                      {option.badge ? (
                        <span className="new-resource-badge">{option.badge}</span>
                      ) : null}
                    </span>
                    <span className="new-resource-item-hint">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}
