"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  IconBraces,
  IconCalendar,
  IconChevronDown,
  IconCode,
  IconFingerprint,
  IconHash,
  IconLetterT,
  IconList,
  IconMath,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTextSize,
  IconTrash,
  IconTypography,
} from "@tabler/icons-react";
import { PortalMenu } from "./fields";
import { useLineListDraft } from "./use-line-list-draft";

export type ValidationRule = {
  type:
    | "regex"
    | "length"
    | "number_range"
    | "word_count"
    | "unique_characters"
    | "contains"
    | "excludes"
    | "starts_with"
    | "ends_with"
    | "mathematical"
    | "custom_list"
    | "date_range"
    | "minimum_words"
    | "minimum_sentences";
  min?: number | string;
  max?: number | string;
  value?: string;
  values?: string[];
  pattern?: string;
  expression?: string;
  caseSensitive?: boolean;
  caseInsensitive?: boolean;
  message?: string;
};
type RuleType = ValidationRule["type"];
type IconType = React.ComponentType<{
  size?: string | number;
  className?: string;
}>;

const RULES: { type: RuleType; label: string; hint: string; icon: IconType }[] =
  [
    {
      type: "regex",
      label: "Regular Expression",
      hint: "Validate using a custom pattern",
      icon: IconCode,
    },
    {
      type: "length",
      label: "Length Check",
      hint: "Check text length limits",
      icon: IconTextSize,
    },
    {
      type: "number_range",
      label: "Number Range",
      hint: "Validate numeric bounds",
      icon: IconHash,
    },
    {
      type: "word_count",
      label: "Word Count",
      hint: "Check number of words",
      icon: IconTypography,
    },
    {
      type: "unique_characters",
      label: "Unique Characters",
      hint: "Ensure unique character patterns",
      icon: IconFingerprint,
    },
    {
      type: "contains",
      label: "Contains Text",
      hint: "Must include specific text",
      icon: IconSearch,
    },
    {
      type: "excludes",
      label: "Excludes Text",
      hint: "Must not include specific text",
      icon: IconShieldCheck,
    },
    {
      type: "starts_with",
      label: "Starts With",
      hint: "Must begin with specific text",
      icon: IconLetterT,
    },
    {
      type: "ends_with",
      label: "Ends With",
      hint: "Must end with specific text",
      icon: IconLetterT,
    },
    {
      type: "mathematical",
      label: "Mathematical",
      hint: "Must satisfy a mathematical equation",
      icon: IconMath,
    },
    {
      type: "custom_list",
      label: "Custom List",
      hint: "Must match items from a list",
      icon: IconList,
    },
    {
      type: "date_range",
      label: "Date Range",
      hint: "Must fall within date range",
      icon: IconCalendar,
    },
    {
      type: "minimum_words",
      label: "Minimum Words",
      hint: "Require minimum number of words",
      icon: IconTypography,
    },
    {
      type: "minimum_sentences",
      label: "Minimum Sentences",
      hint: "Require minimum number of sentences",
      icon: IconBraces,
    },
  ];

const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-[#f5f2f2] outline-none placeholder:text-white/25 focus:border-[rgb(var(--accent-rgb)/0.45)]";
const asNumber = (raw: string) => (raw === "" ? undefined : Number(raw));

function AllowedAnswersField({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const field = useLineListDraft(values, onChange);
  return <textarea
    className={inputClass}
    rows={3}
    value={field.value}
    placeholder="One allowed answer per line"
    onChange={(event) => field.onChange(event.target.value)}
  />;
}

function RuleFields({
  rule,
  patch,
}: {
  rule: ValidationRule;
  patch: (next: Partial<ValidationRule>) => void;
}) {
  if (
    ["length", "number_range", "word_count", "date_range"].includes(rule.type)
  )
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          type={rule.type === "date_range" ? "date" : "number"}
          className={inputClass}
          value={rule.min ?? ""}
          placeholder="Minimum"
          onChange={(e) =>
            patch({
              min:
                rule.type === "date_range"
                  ? e.target.value
                  : asNumber(e.target.value),
            })
          }
        />
        <input
          type={rule.type === "date_range" ? "date" : "number"}
          className={inputClass}
          value={rule.max ?? ""}
          placeholder="Maximum"
          onChange={(e) =>
            patch({
              max:
                rule.type === "date_range"
                  ? e.target.value
                  : asNumber(e.target.value),
            })
          }
        />
      </div>
    );
  if (
    ["minimum_words", "minimum_sentences", "unique_characters"].includes(
      rule.type,
    )
  )
    return (
      <input
        type="number"
        min={0}
        className={inputClass}
        value={rule.min ?? ""}
        placeholder="Minimum required"
        onChange={(e) => patch({ min: asNumber(e.target.value) })}
      />
    );
  if (rule.type === "regex")
    return (
      <input
        className={`${inputClass} font-mono`}
        value={rule.pattern || ""}
        placeholder="^[A-Za-z0-9 ]+$"
        onChange={(e) => patch({ pattern: e.target.value })}
      />
    );
  if (rule.type === "mathematical")
    return (
      <input
        className={`${inputClass} font-mono`}
        value={rule.expression || ""}
        placeholder=">= 5 or value % 2 == 0"
        onChange={(e) => patch({ expression: e.target.value })}
      />
    );
  if (rule.type === "custom_list")
    return (
      <AllowedAnswersField values={rule.values || []} onChange={(values) => patch({ values })} />
    );
  return (
    <div className="space-y-2">
      <input
        className={inputClass}
        value={rule.value || ""}
        placeholder="Specific text"
        onChange={(e) => patch({ value: e.target.value })}
      />
      <label className="flex items-center gap-2 text-xs text-white/55">
        <input
          type="checkbox"
          checked={Boolean(rule.caseSensitive)}
          onChange={(e) => patch({ caseSensitive: e.target.checked })}
        />
        Case sensitive
      </label>
    </div>
  );
}

function AddMenu({
  onAdd,
  label = "Add Rule",
}: {
  onAdd: (type: RuleType) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white/85 hover:border-white/25"
      >
        <IconPlus size={15} />
        {label}
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="max-h-[min(430px,70vh)] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-2 shadow-[0_24px_70px_rgba(0,0,0,.75)]">
            {RULES.map((def) => {
              const Icon = def.icon;
              return (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => {
                    onAdd(def.type);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.08]"
                >
                  <Icon size={17} className="mt-1 text-white/70" />
                  <span>
                    <span className="block text-sm font-semibold text-white/90">
                      {def.label}
                    </span>
                    <span className="cool-text block text-xs">{def.hint}</span>
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

export function ValidationRulesEditor({
  rules,
  onChange,
}: {
  rules: ValidationRule[];
  onChange: (next: ValidationRule[]) => void;
}) {
  const list = Array.isArray(rules) ? rules : [];
  const [expanded, setExpanded] = useState(list.length > 0);
  const add = (type: RuleType) => onChange([...list, { type }]);
  return (
    <div className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-black/10">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white/85">
          Validation Rules
        </span>
        {list.length ? (
          <span className="rounded bg-white/[0.06] px-2 text-xs text-white/55">
            {list.length}
          </span>
        ) : null}
        <IconChevronDown
          size={15}
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.08] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-white">Validation Rules</h4>
                <p className="cool-text mt-1 text-sm">
                  Add rules to validate user input
                </p>
              </div>
              <AddMenu onAdd={add} />
            </div>
            {!list.length ? (
              <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] p-5 text-center">
                <p className="cool-text mb-3">No validation rules added yet</p>
                <AddMenu onAdd={add} label="Add Your First Rule" />
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((rule, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
                  >
                    <div className="mb-3 flex items-center">
                      <span className="text-sm font-semibold text-white/85">
                        {RULES.find((item) => item.type === rule.type)?.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChange(list.filter((_, i) => i !== index))
                        }
                        className="ml-auto text-white/30 hover:text-[var(--tone-bad)]"
                        aria-label="Remove rule"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                    <RuleFields
                      rule={rule}
                      patch={(next) =>
                        onChange(
                          list.map((item, i) =>
                            i === index ? { ...item, ...next } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={`${inputClass} mt-2`}
                      value={rule.message || ""}
                      placeholder="Custom error message (optional)"
                      onChange={(e) =>
                        onChange(
                          list.map((item, i) =>
                            i === index
                              ? { ...item, message: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
