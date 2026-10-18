"use client";

import React from "react";
import { PresenceList, useListKeys } from "@/components/motion";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { NumberField, OptionCard, SelectField, TextAreaField, TextField } from "../../fields";
import { ConfigCard } from "../../schema-section";
import { MULTI_PICK, PanelQuestion, TicketIcon } from "./shared";

/* The questions a subject asks before its ticket opens. */

/** The form a member fills in before a ticket opens. */
export function FormEditor({
  questions,
  formTitle,
  set,
}: {
  questions: PanelQuestion[];
  formTitle: string;
  set: (field: string, value: any) => void;
}) {
  const questionKeys = useListKeys(questions);
  return (
    <div className="gw-tk-sub">
      <div className="gw-tk-sub-head">
        <p className="gw-tk-sub-name">Up to 5 questions</p>
        <button
          type="button"
          className="gw-tk-add"
          disabled={questions.length >= 5}
          onClick={() =>
            set("Questions", [
              ...questions,
              { label: "", kind: "text", placeholder: "", required: true },
            ])
          }
        >
          <IconPlus className="gw-tk-add-plus" size={14} stroke={2.4} aria-hidden="true" />
          <span>Add question</span>
        </button>
      </div>
      <div className="gw-tk-list">
        <ConfigCard icon={<TicketIcon kind="text" />} title="Form title">
          <TextField
            value={formTitle}
            maxLength={45}
            placeholder="Optional"
            onChange={(next) => set("FormTitle", next || null)}
          />
        </ConfigCard>
      </div>
      <div className="gw-tk-questions">
        {questions.length === 0 ? (
          <p className="gw-tk-sub-empty">No questions, so tickets open straight away.</p>
        ) : (
          <PresenceList
            items={questions}
            keys={questionKeys}
            className="space-y-3"
            render={(question, index) => {
              // Everything a Discord modal field can be told: one line or many,
              // a length range, and whether it may be blank (the bot already
              // reads min/max).
              const patch = (changes: Partial<PanelQuestion>) => {
                const nextQuestions = [...questions];
                nextQuestions[index] = { ...question, ...changes };
                set("Questions", nextQuestions);
              };
              const kind = question.kind || "text";
              const isDisplay = kind === "display";
              const isSelect = kind === "select";
              const isCheckbox = kind === "checkbox";
              const isText = !isDisplay && !isSelect && !isCheckbox;
              const isParagraph = question.style === "paragraph";
              // What the type picker shows. Paragraph is a text question with a
              // style, and Checkboxes is a dropdown with more than one pick, so
              // `kind` alone is not enough.
              const typeValue =
                kind === "text" && isParagraph
                  ? "paragraph-kind"
                  : kind === "select" && Number(question.max_values) > 1
                    ? "checkboxes-kind"
                    : kind;
              // Discord's own ceiling per modal field.
              const limit = isParagraph ? 4000 : 1000;
              const maxValue =
                typeof question.max === "number" ? question.max : "";
              const minValue =
                typeof question.min === "number" ? question.min : "";
              const rangeInvalid =
                isText &&
                typeof minValue === "number" &&
                typeof maxValue === "number" &&
                minValue > maxValue;
              const options = question.options || [];
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-bold text-white/50">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <TextField
                        value={question.label}
                        maxLength={45}
                        placeholder={isDisplay ? "Heading (optional)" : "Question"}
                        onChange={(next) => patch({ label: next })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "Questions",
                          questions.filter((_, i) => i !== index),
                        )
                      }
                      className="shrink-0 text-white/35 hover:text-[var(--tone-bad)]"
                      aria-label="Remove question"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>

                  {/* The question's component type: Discord modals accept
                     dropdowns, a checkbox and read-only text as well as text
                     boxes. */}
                  <div className="mt-2">
                    <SelectField
                      value={typeValue}
                      options={[
                        {
                          label: "Short answer",
                          value: "text",
                          description: "One line of text",
                        },
                        {
                          label: "Paragraph",
                          value: "paragraph-kind",
                          description: "A multi-line text box",
                        },
                        {
                          label: "Dropdown",
                          value: "select",
                          description: "Pick one from options you define",
                        },
                        // "Checkboxes" is a dropdown that accepts several
                        // picks: Discord's Checkbox is a single tick with no
                        // options.
                        {
                          label: "Checkboxes",
                          value: "checkboxes-kind",
                          description: "Pick several from options you define",
                        },
                        {
                          label: "Checkbox",
                          value: "checkbox",
                          description: "A single yes / no tick, no options",
                        },
                        {
                          label: "Text block",
                          value: "display",
                          description: "Read-only note, asks nothing",
                        },
                      ]}
                      onChange={(next) => {
                        // "Paragraph" is a text question with a style, not
                        // a separate kind — the bot only knows four.
                        if (next === "paragraph-kind") {
                          patch({ kind: "text", style: "paragraph" });
                        } else if (next === "checkboxes-kind") {
                          // `max_values` follows the option count rather than
                          // being pinned to today's number.
                          patch({
                            kind: "select",
                            max_values: MULTI_PICK,
                            min_values: question.required === false ? 0 : 1,
                          });
                        } else if (next === "text") {
                          patch({
                            kind: "text",
                            style: "short",
                            max:
                              typeof question.max === "number"
                                ? Math.min(question.max, 1000)
                                : question.max,
                          });
                        } else if (next === "select") {
                          patch({
                            kind: "select",
                            max_values: 1,
                            min_values: question.required === false ? 0 : 1,
                          });
                        } else {
                          patch({ kind: (next || "text") as PanelQuestion["kind"] });
                        }
                      }}
                    />
                  </div>

                  {isDisplay ? (
                    <div className="mt-2">
                      <TextAreaField
                        value={question.content || ""}
                        rows={3}
                        maxLength={4000}
                        placeholder="The text above the fields: a rule, a warning, what to have ready…"
                        onChange={(next) => patch({ content: next })}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="mt-2">
                        <TextField
                          value={question.description || ""}
                          maxLength={100}
                          placeholder="Helper text under the label (optional)"
                          onChange={(next) => patch({ description: next })}
                        />
                      </div>
                      {isText || isSelect ? (
                        <div className="mt-2">
                          <TextField
                            value={question.placeholder || ""}
                            maxLength={100}
                            placeholder="Placeholder (optional)"
                            onChange={(next) => patch({ placeholder: next })}
                          />
                        </div>
                      ) : null}
                    </>
                  )}

                  {isSelect ? (
                    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                          Options <span className="cool-text normal-case">(max 25)</span>
                        </p>
                        <button
                          type="button"
                          disabled={options.length >= 25}
                          onClick={() =>
                            patch({ options: [...options, { label: "", description: "" }] })
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/70 hover:text-white disabled:opacity-40"
                        >
                          <IconPlus size={11} />
                          Add option
                        </button>
                      </div>
                      {options.length === 0 ? (
                        // The add button in the empty state too, where people
                        // look for it.
                        <div className="rounded-xl border border-dashed border-white/[0.08] p-3 text-center">
                          <p className="cool-text text-[12px]">
                            A dropdown with no options cannot be shown, so this question is
                            skipped until you add one.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              patch({ options: [...options, { label: "", description: "" }] })
                            }
                            className="gator-control gator-control-primary mt-3 inline-flex h-9 items-center gap-2 px-4 text-xs"
                          >
                            <IconPlus size={13} />
                            Add the first option
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* The add-option control sits at the bottom of the
                             list. */}
                          {options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <TextField
                                  value={option.label || ""}
                                  maxLength={100}
                                  placeholder="Option"
                                  onChange={(next) => {
                                    const nextOptions = [...options];
                                    nextOptions[optionIndex] = { ...option, label: next };
                                    patch({ options: nextOptions });
                                  }}
                                />
                              </div>
                              <div className="hidden min-w-0 flex-1 sm:block">
                                <TextField
                                  value={option.description || ""}
                                  maxLength={100}
                                  placeholder="Description (optional)"
                                  onChange={(next) => {
                                    const nextOptions = [...options];
                                    nextOptions[optionIndex] = { ...option, description: next };
                                    patch({ options: nextOptions });
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  patch({
                                    options: options.filter((_, i) => i !== optionIndex),
                                  })
                                }
                                className="shrink-0 text-white/30 hover:text-[var(--tone-bad)]"
                                aria-label="Remove option"
                              >
                                <IconTrash size={13} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            disabled={options.length >= 25}
                            onClick={() =>
                              patch({ options: [...options, { label: "", description: "" }] })
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-2 text-xs font-semibold text-white/55 transition-colors hover:border-white/25 hover:text-white/85 disabled:opacity-40"
                          >
                            <IconPlus size={13} />
                            {options.length >= 25
                              ? "Discord allows 25 options"
                              : "Add option"}
                          </button>
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <NumberField
                          value={
                            typeof question.min_values === "number" ? question.min_values : ""
                          }
                          min={0}
                          max={Math.max(1, options.length)}
                          placeholder="Min picks"
                          onChange={(next) =>
                            patch({ min_values: next === "" ? undefined : next })
                          }
                        />
                        <NumberField
                          value={
                            typeof question.max_values === "number" ? question.max_values : ""
                          }
                          min={1}
                          max={Math.max(1, options.length)}
                          placeholder="Max picks"
                          onChange={(next) =>
                            patch({ max_values: next === "" ? undefined : next })
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {isText ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                      <NumberField
                        value={minValue}
                        min={0}
                        max={limit}
                        placeholder="Min length"
                        onChange={(next) =>
                          patch({ min: next === "" ? undefined : next })
                        }
                      />
                      <NumberField
                        value={maxValue}
                        min={1}
                        max={limit}
                        placeholder="Max length"
                        onChange={(next) =>
                          patch({ max: next === "" ? undefined : next })
                        }
                      />
                      <div className="col-span-2 sm:col-span-1">
                        <OptionCard
                          compact
                          label="Required"
                          checked={question.required !== false}
                          onChange={(next) => patch({ required: next })}
                        />
                      </div>
                    </div>
                  ) : null}

                  {isCheckbox ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <OptionCard
                        compact
                        label="Ticked by default"
                        checked={Boolean(question.default)}
                        onChange={(next) => patch({ default: next })}
                      />
                      <OptionCard
                        compact
                        label="Required"
                        checked={question.required !== false}
                        onChange={(next) => patch({ required: next })}
                      />
                    </div>
                  ) : null}

                  {isSelect ? (
                    <div className="mt-2">
                      <OptionCard
                        compact
                        label="Required"
                        checked={question.required !== false}
                        onChange={(next) => patch({ required: next })}
                      />
                    </div>
                  ) : null}

                  {rangeInvalid ? (
                    <p className="mt-2 text-[11px] font-semibold text-[var(--tone-bad)]">
                      Minimum is above the maximum, so Discord will refuse
                      this field.
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
