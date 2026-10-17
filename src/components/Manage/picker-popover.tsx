"use client";

import React from "react";
import { IconSearch } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * One "add a thing" menu for the block picker and the flow builder's step
 * picker. It filters as you type, and the search field takes focus on open, so
 * choosing is press and type.
 */

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function PickerPopover({
  trigger,
  title,
  description,
  options,
  onPick,
  searchPlaceholder = "Search…",
  /** Below this many entries a search field is more furniture than help. */
  searchThreshold = 6,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  options: PickerOption[];
  onPick: (value: string) => void;
  searchPlaceholder?: string;
  searchThreshold?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const searchable = options.length >= searchThreshold;

  // Cleared on close rather than on open: a menu that reopens showing the last
  // search, with most of its options missing, reads as a menu that lost them.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) =>
        `${option.label} ${option.hint || ""}`.toLowerCase().includes(needle),
      )
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="gator-picker z-[220]"
      >
        <div className="gator-picker-head">
          <p className="gator-picker-title">{title}</p>
          {description ? (
            <p className="gator-picker-lede">{description}</p>
          ) : null}
          {searchable ? (
            <div className="gator-picker-search">
              <IconSearch size={14} className="shrink-0 text-white/35" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                // One match and a press of Enter is the whole interaction for
                // somebody who knows what they want.
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || matches.length !== 1) return;
                  event.preventDefault();
                  onPick(matches[0].value);
                  setOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
        {matches.length ? (
          <div className="gator-picker-grid">
            {matches.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onPick(option.value);
                  setOpen(false);
                }}
                className="gator-picker-option"
              >
                {option.icon ? (
                  <span className="gator-picker-icon">{option.icon}</span>
                ) : null}
                <span className="min-w-0">
                  <span className="gator-picker-label">{option.label}</span>
                  {option.hint ? (
                    <span className="gator-picker-hint">{option.hint}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="gator-picker-empty">
            Nothing matches “{query.trim()}”.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
