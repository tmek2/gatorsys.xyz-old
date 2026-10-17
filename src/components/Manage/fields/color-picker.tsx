"use client";

import React, { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";

/* The colour field: preset swatches, a free picker and a hex input. */

const COLOR_SWATCHES = [
  "#f7a8c4", "#fb7185", "#f97316", "#facc15", "#84cc16",
  "#34d399", "#22d3ee", "#60a5fa", "#818cf8", "#a78bfa",
  "#e879f9", "#f472b6", "#f8fafc", "#94a3b8", "#475569",
];

function normalizedHex(value: string, fallback: string) {
  const next = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(next)) return next.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(next)) return `#${next.toLowerCase()}`;
  return fallback;
}

/** A dashboard-styled color popover based on the COSS popover pattern. */
export function ColorPicker({
  value,
  onChange,
  label = "Choose color",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const safeValue = normalizedHex(value, "#f7a8c4");
  const [draft, setDraft] = useState(safeValue);

  useEffect(() => setDraft(safeValue), [safeValue]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="gw-color-trigger"
          >
            <span className="gw-color-chip" style={{ backgroundColor: safeValue }} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="gw-pop gw-color-pop z-[190] w-64"
        >
          <p className="gw-pop-title">Colour</p>
          {/* Full spectrum picker: any colour is choosable, not just presets. */}
          <div className="gator-colorful mb-3">
            <HexColorPicker
              color={safeValue}
              onChange={(next) => {
                setDraft(next);
                onChange(next);
              }}
            />
          </div>
          <div className="gw-color-swatches">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                aria-pressed={safeValue === swatch}
                onClick={() => onChange(swatch)}
                className="gw-color-swatch"
                style={{ backgroundColor: swatch }}
              >
                {safeValue === swatch ? <IconCheck size={12} stroke={3} /> : null}
              </button>
            ))}
          </div>
          <div className="gw-color-hexrow">
            <input
              value={draft}
              maxLength={7}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                const next = normalizedHex(draft, safeValue);
                setDraft(next);
                onChange(next);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const next = normalizedHex(draft, safeValue);
                setDraft(next);
                onChange(next);
              }}
              aria-label="Custom hex color"
              className="gw-pop-field"
              data-bare
              spellCheck={false}
            />
            <span className="gw-color-now" style={{ backgroundColor: safeValue }} />
          </div>
        </PopoverContent>
      </Popover>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(normalizedHex(value, safeValue))}
        aria-label="Hex color"
        className="gw-field gw-color-hex min-w-0 flex-1"
        spellCheck={false}
      />
    </div>
  );
}
