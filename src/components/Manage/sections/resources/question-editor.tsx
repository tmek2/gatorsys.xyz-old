"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DevelopingImage } from "@/components/motion";
import {
  IconAdjustments,
  IconAdjustmentsHorizontal,
  IconAlignLeft,
  IconCalendar,
  IconCheckbox,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconCopy,
  IconHash,
  IconListCheck,
  IconMail,
  IconPhone,
  IconGripVertical,
  IconCheck,
  IconLink,
  IconPhoto,
  IconPlus,
  IconSelector,
  IconStar,
  IconTrash,
  IconTrophy,
  IconUserSearch,
  IconX,
} from "@tabler/icons-react";
import { createPortal } from "react-dom";
import { NumberField, SelectField, TextField } from "../../fields";
import { ValidationRulesEditor, type ValidationRule } from "../../validation-rules";
import type { ApplicationQuestion } from "../../types";

/* Editing one application question: its type, wording, options, images and validation. */

export const QUESTION_TYPES: {
  value: string;
  label: string;
  description?: string;
}[] = [
  { value: "text_short", label: "Short Answer" },
  { value: "text_paragraph", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "website", label: "Website URL" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "roblox_user_search", label: "Roblox User Search" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "multiple_choice_multi", label: "Checkboxes" },
  { value: "image_selection", label: "Image Selection" },
  { value: "range", label: "Range (1-10)" },
  { value: "rating", label: "Rating Scale" },
  { value: "range_slider", label: "Range Slider" },
  { value: "boolean", label: "Yes / No" },
];

/**
 * The "Add Question" menu, by category. `type` values are what the bot accepts
 * (Dropdown → multiple_choice, Checkboxes → multiple_choice_multi).
 */
export const QUESTION_TYPE_MENU: {
  group: string;
  items: { type: string; label: string; icon: string; display?: string }[];
}[] = [
  {
    group: "Text Inputs",
    items: [
      { type: "text_short", label: "Short Answer", icon: "align" },
      { type: "text_paragraph", label: "Paragraph", icon: "align" },
      { type: "number", label: "Number", icon: "hash" },
    ],
  },
  {
    group: "Choice Inputs",
    items: [
      { type: "multiple_choice", label: "Multiple Choice", icon: "list" },
      { type: "image_selection", label: "Image Selection", icon: "photo" },
      { type: "multiple_choice_multi", label: "Checkboxes", icon: "checkbox" },
      { type: "multiple_choice", label: "Dropdown", icon: "chevron", display: "dropdown" },
    ],
  },
  {
    group: "Special Inputs",
    items: [
      { type: "date", label: "Date", icon: "calendar" },
      { type: "email", label: "Email", icon: "mail" },
      { type: "phone", label: "Phone Number", icon: "phone" },
      { type: "website", label: "Website URL", icon: "link" },
      { type: "roblox_user_search", label: "Roblox User Search", icon: "roblox" },
    ],
  },
  {
    group: "Scale & Range",
    items: [
      { type: "rating", label: "Rating Scale", icon: "star" },
      { type: "time", label: "Time", icon: "clock" },
      { type: "range_slider", label: "Range Slider", icon: "slider" },
    ],
  },
  {
    group: "",
    items: [{ type: "section", label: "Section", icon: "section" }],
  },
];

/** Icon lookup for the grouped question-type menu (mirrors the creator menu). */
const QUESTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  align: <IconAlignLeft size={15} />,
  hash: <IconHash size={15} />,
  list: <IconListCheck size={15} />,
  photo: <IconPhoto size={15} />,
  checkbox: <IconCheckbox size={15} />,
  chevron: <IconChevronDown size={15} />,
  calendar: <IconCalendar size={15} />,
  mail: <IconMail size={15} />,
  phone: <IconPhone size={15} />,
  link: <IconLink size={15} />,
  star: <IconStar size={15} />,
  clock: <IconClock size={15} />,
  slider: <IconAdjustmentsHorizontal size={15} />,
  roblox: <IconUserSearch size={15} />,
};

function QuestionTypeIcon({ icon }: { icon: string }) {
  return <span className="text-white/50">{QUESTION_TYPE_ICONS[icon] || null}</span>;
}

export function cleanId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * A borderless textarea that grows with its content, for section and question
 * descriptions. Markdown is rendered on the form; the editor shows no toolbar.
 */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    resize();
  }, [value, resize]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      onInput={resize}
      // Bare on purpose: the dashboard's !important control rule would
      // otherwise paint it as a filled box.
      data-bare=""
      className={
        className ||
        "w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-white/60 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/25"
      }
    />
  );
}

/** Normalises a question/section's images to an array (max 3), tolerating the
 *  legacy single `image_url` field. */
export function questionImages(question: any): string[] {
  if (Array.isArray(question?.images))
    return question.images.filter(Boolean).slice(0, 3);
  if (question?.image_url) return [String(question.image_url)];
  return [];
}

/**
 * Upload button for question and section images: device uploads stored as data
 * URLs (like the banner uploader), up to three.
 */
function QuestionImageUpload({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const remaining = 3 - images.length;
  function upload(files: FileList | null) {
    const list = Array.from(files || []).slice(0, remaining);
    if (!list.length) return;
    Promise.all(
      list.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(file);
          }),
      ),
    ).then((urls) =>
      onChange([...images, ...urls.filter(Boolean)].slice(0, 3)),
    );
  }
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          upload(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={remaining <= 0}
        aria-label="Upload image"
        title={remaining > 0 ? "Upload image (up to 3)" : "Maximum of 3 images"}
        onClick={() => fileRef.current?.click()}
        className={`rounded p-2 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30 ${images.length ? "text-white" : "text-white/40 hover:text-white"}`}
      >
        <IconPhoto size={16} />
      </button>
    </>
  );
}

/**
 * Editor preview of a question's images: removable, click to zoom in a lightbox
 * like the infraction proof viewer.
 */
function QuestionImages({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  if (!images.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((src, index) => (
        <div
          key={index}
          className="group/img relative h-24 w-24 overflow-hidden rounded-xl border border-white/[0.08]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <DevelopingImage
            key={src}
            src={src}
            alt=""
            onClick={() => setZoom(src)}
            className="h-full w-full cursor-zoom-in object-cover"
          />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onChange(images.filter((_, i) => i !== index))}
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white/90 opacity-0 transition-opacity hover:bg-black group-hover/img:opacity-100"
          >
            <IconX size={12} />
          </button>
        </div>
      ))}
      {zoom && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              className="dialog-backdrop fixed inset-0 z-[250] flex cursor-zoom-out items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
              onClick={() => setZoom(null)}
              aria-label="Close zoomed image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoom}
                alt=""
                className="dialog-pop max-h-full max-w-full rounded-xl object-contain shadow-[0_28px_90px_rgba(0,0,0,.8)]"
              />
            </button>,
            document.body,
          )
        : null}
    </div>
  );
}

export function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
  dragging,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  quizMode = false,
  smoothReorder = false,
}: {
  question: ApplicationQuestion;
  index: number;
  onChange: (next: ApplicationQuestion) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragging: boolean;
  dropPosition: "before" | "after" | null;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, position: "before" | "after") => void;
  onDrop: (position: "before" | "after") => void;
  quizMode?: boolean;
  smoothReorder?: boolean;
}) {
  const isSection = question.type === "section";
  const isChoice =
    question.type === "multiple_choice" ||
    question.type === "multiple_choice_multi";
  // A dropdown is a single-select multiple_choice with a display flag, so it
  // stays bot-compatible while rendering as a real <select> on the form.
  const isDropdown =
    question.type === "multiple_choice" &&
    (question as any).display === "dropdown";
  const isImageChoice = question.type === "image_selection";
  const optionRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const isText = [
    "text_short",
    "text_paragraph",
    "number",
    "email",
    "phone",
    "website",
  ].includes(question.type);

  const options: { value: string; label: string; image_url?: string }[] =
    Array.isArray(question.options)
      ? (question.options as any[]).map((option) =>
          typeof option === "string"
            ? { value: cleanId(option), label: option }
            : {
                value: option.value || cleanId(option.label || ""),
                label: option.label || "",
                ...(option.image_url ? { image_url: option.image_url } : {}),
              },
        )
      : [];

  // Multiple choice / checkbox / dropdown are capped at 15 options.
  const MAX_OPTIONS = 15;
  function setOptions(
    next: { value: string; label: string; image_url?: string }[],
  ) {
    onChange({
      ...question,
      options: next.slice(0, MAX_OPTIONS),
    } as ApplicationQuestion);
  }

  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const validationCount = Array.isArray(question.validation)
    ? question.validation.length
    : 0;

  if (isSection) {
    return (
      <div
        onDragOver={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onDragOver(
            event,
            event.clientY < rect.top + rect.height / 2 ? "before" : "after",
          );
        }}
        onDrop={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onDrop(event.clientY < rect.top + rect.height / 2 ? "before" : "after");
        }}
        className={`card-in relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-[border-color,opacity] ${
          dragging ? "opacity-60" : ""
        }`}
      >
        {dropPosition ? (
          <span
            className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-[var(--accent-peach)] shadow-[0_0_14px_rgb(var(--accent-rgb) / .85)] ${dropPosition === "before" ? "-top-2" : "-bottom-2"}`}
          />
        ) : null}
        <input
          value={question.question}
          maxLength={300}
          placeholder="Section title"
          onChange={(event) =>
            onChange({ ...question, question: event.target.value })
          }
          className="w-full bg-transparent text-2xl font-extrabold text-[#f5f2f2] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/25"
        />
        <div className="my-3 border-t border-white/[0.08]" />
        <AutoTextarea
          value={(question as any).description || ""}
          maxLength={2000}
          placeholder="Your description goes here…"
          onChange={(next) =>
            onChange({ ...question, description: next } as ApplicationQuestion)
          }
        />
        <QuestionImages
          images={questionImages(question)}
          onChange={(next) =>
            onChange({
              ...question,
              images: next,
              image_url: undefined,
            } as ApplicationQuestion)
          }
        />
        <div className="mt-3 flex items-center gap-1">
          <span
            title="Drag to reorder"
            draggable={!smoothReorder}
            data-swapy-handle={smoothReorder ? "" : undefined}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="flex cursor-grab items-center p-2 text-white/25 hover:text-white/60 active:cursor-grabbing"
          >
            <IconGripVertical size={16} />
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-2 text-white/40 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
            aria-label="Remove section"
          >
            <IconTrash size={16} />
          </button>
          <QuestionImageUpload
            images={questionImages(question)}
            onChange={(next) =>
              onChange({
                ...question,
                images: next,
                image_url: undefined,
              } as ApplicationQuestion)
            }
          />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              className="rounded p-2 text-white/35 hover:text-white disabled:opacity-20"
              aria-label="Move up"
            >
              <IconChevronUp size={16} />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              className="rounded p-2 text-white/35 hover:text-white disabled:opacity-20"
              aria-label="Move down"
            >
              <IconChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onDragOver(
          event,
          event.clientY < rect.top + rect.height / 2 ? "before" : "after",
        );
      }}
      onDrop={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onDrop(event.clientY < rect.top + rect.height / 2 ? "before" : "after");
      }}
      className={`card-in relative rounded-xl border bg-white/[0.02] p-4 transition-[border-color,opacity] ${
        dragging
          ? "border-[rgb(var(--accent-rgb)/0.5)] opacity-60"
          : "border-white/[0.08]"
      }`}
    >
      {dropPosition ? (
        <span
          className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-[var(--accent-peach)] shadow-[0_0_14px_rgb(var(--accent-rgb) / .85)] ${dropPosition === "before" ? "-top-2" : "-bottom-2"}`}
        />
      ) : null}
      {/* Top row: drag handle + clickable type pill + reorder controls. */}
      <div className="mb-3 flex items-center gap-2">
        <span
          title="Drag to reorder"
          draggable={!smoothReorder}
          data-swapy-handle={smoothReorder ? "" : undefined}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="flex cursor-grab items-center p-1 text-white/25 transition-colors hover:text-white/60 active:cursor-grabbing"
        >
          <IconGripVertical size={16} />
        </span>
        <span className="relative">
          <button
            type="button"
            onClick={() => setTypeMenuOpen((state) => !state)}
            title="Change question type"
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55 transition-colors hover:bg-white/[0.1] hover:text-white"
          >
            {isDropdown
              ? "Dropdown"
              : QUESTION_TYPES.find((t) => t.value === question.type)?.label ||
                question.type}
            <IconSelector size={12} />
          </button>
          {typeMenuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setTypeMenuOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div className="popup-in absolute left-0 top-9 z-40 max-h-80 w-60 origin-top overflow-y-auto rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                {/* Grouped exactly like the "Add Question" creator menu, minus
                    the Section entry (you can't turn a question into a section). */}
                {QUESTION_TYPE_MENU.filter((group) => group.group).map((group) => (
                  <div key={group.group} className="mb-1 last:mb-0">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                      {group.group}
                    </p>
                    {group.items.map((item) => {
                      const activeItem =
                        item.type === question.type &&
                        (item.display || null) === ((question as any).display || null);
                      return (
                        <button
                          key={`${group.group}-${item.label}`}
                          type="button"
                          onClick={() => {
                            onChange({
                              ...question,
                              type: item.type,
                              display: item.display || undefined,
                            } as ApplicationQuestion);
                            setTypeMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${activeItem ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                        >
                          <QuestionTypeIcon icon={item.icon} />
                          <span className="flex-1">{item.label}</span>
                          {activeItem ? <IconCheck size={14} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            className="rounded p-2 text-white/35 hover:text-white disabled:opacity-20"
            aria-label="Move up"
          >
            <IconChevronUp size={16} />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            className="rounded p-2 text-white/35 hover:text-white disabled:opacity-20"
            aria-label="Move down"
          >
            <IconChevronDown size={16} />
          </button>
        </div>
      </div>
      {/* Title + description (markdown supported silently). */}
      <input
        value={question.question}
        maxLength={300}
        placeholder="Untitled Question"
        aria-label="Question title"
        onChange={(event) =>
          onChange({ ...question, question: event.target.value })
        }
        data-bare=""
        className="w-full bg-transparent text-lg font-bold text-[#f5f2f2] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/40 focus:placeholder:text-white/25"
      />
      <div className="my-2.5 border-t border-white/[0.08]" />
      <AutoTextarea
        value={(question as any).description || ""}
        maxLength={2000}
        placeholder="Question description goes here…"
        onChange={(next) =>
          onChange({ ...question, description: next } as ApplicationQuestion)
        }
      />
      {/* Images sit between the description and the answer, up to three,
          soft-edged squares side by side, removable and zoomable. */}
      <QuestionImages
        images={questionImages(question)}
        onChange={(next) =>
          onChange({
            ...question,
            images: next,
            image_url: undefined,
          } as ApplicationQuestion)
        }
      />
      {/* Action bar: destructive/util buttons on the left, required + the
          validation-rules button (in place of a type dropdown) on the right. */}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-2 text-white/40 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
          aria-label="Remove question"
        >
          <IconTrash size={16} />
        </button>
        {onDuplicate ? (
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Duplicate question"
            title="Duplicate"
          >
            <IconCopy size={16} />
          </button>
        ) : null}
        <QuestionImageUpload
          images={questionImages(question)}
          onChange={(next) =>
            onChange({
              ...question,
              images: next,
              image_url: undefined,
            } as ApplicationQuestion)
          }
        />
        <span className="mx-1 h-5 w-px bg-white/[0.1]" />
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-white/75">
          <input
            type="checkbox"
            checked={question.required !== false}
            onChange={(event) =>
              onChange({ ...question, required: event.target.checked })
            }
            className="h-4 w-4 cursor-pointer rounded border-white/30 bg-transparent accent-white"
          />
          Required
        </label>
        {isText ? (
          <button
            type="button"
            onClick={() => setShowValidation((state) => !state)}
            className={`ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${showValidation || validationCount ? "border-white/25 bg-white/[0.08] text-white" : "border-white/[0.08] text-white/60 hover:text-white"}`}
          >
            <IconAdjustments size={14} />
            Validation{validationCount ? ` · ${validationCount}` : ""}
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
        {isChoice || isImageChoice ? (
          <div className="space-y-1 sm:col-span-2">
            {options.map((option, optionIndex) => (
              <div
                key={optionIndex}
                className="option-in group/option flex items-center gap-3 rounded-xl px-1 py-1"
              >
                {/* Answer-type indicator: radio for select-one, chevron for a
                    dropdown, checkbox for multi, thumbnail for image. */}
                {isDropdown ? (
                  <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center text-white/35">
                    <IconChevronDown size={13} />
                  </span>
                ) : question.type === "multiple_choice" ? (
                  <span className="h-[15px] w-[15px] shrink-0 rounded-full border-[1.5px] border-white/30" />
                ) : question.type === "multiple_choice_multi" ? (
                  <span className="h-[15px] w-[15px] shrink-0 rounded-[4px] border-[1.5px] border-white/30" />
                ) : option.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={option.image_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.08] object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/20 text-white/30">
                    <IconPhoto size={14} />
                  </span>
                )}
                <input
                  ref={(node) => {
                    optionRefs.current[optionIndex] = node;
                  }}
                  value={option.label}
                  maxLength={100}
                  placeholder={`Option ${optionIndex + 1}`}
                  onKeyDown={(event) => {
                    // Enter moves to the next option, creating one if needed
                    // (Google-Forms behaviour).
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (optionIndex === options.length - 1) {
                        if (options.length < MAX_OPTIONS) {
                          setOptions([
                            ...options,
                            { value: `option-${options.length + 1}`, label: "" },
                          ]);
                          requestAnimationFrame(() =>
                            optionRefs.current[optionIndex + 1]?.focus(),
                          );
                        }
                      } else {
                        optionRefs.current[optionIndex + 1]?.focus();
                      }
                    } else if (
                      event.key === "Backspace" &&
                      option.label === "" &&
                      options.length > 1
                    ) {
                      // Backspace on an empty option deletes it.
                      event.preventDefault();
                      setOptions(options.filter((_, i) => i !== optionIndex));
                      requestAnimationFrame(() =>
                        optionRefs.current[Math.max(0, optionIndex - 1)]?.focus(),
                      );
                    }
                  }}
                  onChange={(event) => {
                    const next = [...options];
                    next[optionIndex] = {
                      ...option,
                      label: event.target.value,
                      value:
                        cleanId(event.target.value) ||
                        `option-${optionIndex + 1}`,
                    };
                    setOptions(next);
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm text-[#f5f2f2] outline-none transition-colors placeholder:text-white/25 hover:border-white/[0.08] focus:border-[rgb(var(--accent-rgb)/0.4)] focus:bg-white/[0.02]"
                />
                {isImageChoice ? (
                  <input
                    value={option.image_url || ""}
                    maxLength={500}
                    placeholder="https://image-url"
                    onChange={(event) => {
                      const next = [...options];
                      const image = event.target.value.trim();
                      next[optionIndex] = { ...option };
                      if (image) next[optionIndex].image_url = image;
                      else delete next[optionIndex].image_url;
                      setOptions(next);
                    }}
                    className="w-44 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2 py-2 text-xs text-white/70 outline-none transition-colors placeholder:text-white/25 focus:border-[rgb(var(--accent-rgb)/0.4)]"
                  />
                ) : null}
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() =>
                    setOptions(options.filter((_, i) => i !== optionIndex))
                  }
                  className="shrink-0 rounded p-2 text-white/30 transition-colors hover:text-[var(--tone-bad)]"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
            {/* Google-Forms style: a live "Add option" field. Typing into it
                appends a new option and keeps focus flowing. */}
            {options.length < MAX_OPTIONS ? (
              <div className="flex items-center gap-3 rounded-xl px-1 py-1 opacity-70 focus-within:opacity-100">
                <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center text-white/25">
                  {isDropdown ? <IconChevronDown size={13} /> : <IconPlus size={13} />}
                </span>
                <input
                  value=""
                  placeholder="Add option"
                  onChange={(event) => {
                    const label = event.target.value;
                    if (!label) return;
                    setOptions([
                      ...options,
                      { value: cleanId(label) || `option-${options.length + 1}`, label },
                    ]);
                    requestAnimationFrame(() =>
                      optionRefs.current[options.length]?.focus(),
                    );
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm text-white/50 outline-none transition-colors placeholder:text-white/30 hover:border-white/[0.08] focus:border-white/[0.08]"
                />
              </div>
            ) : (
              <p className="px-2 pt-1 text-[11px] font-medium text-white/45">
                Maximum {MAX_OPTIONS} options reached.
              </p>
            )}
          </div>
        ) : null}
        {question.type === "rating" ? (
          <div className="flex items-center gap-3 sm:col-span-2">
            <span className="cool-text text-xs">Scale points</span>
            <NumberField
              compact
              value={question.max ?? 5}
              min={2}
              max={10}
              onChange={(next) =>
                onChange({ ...question, min: 1, max: next === "" ? 5 : next })
              }
            />
            <span className="cool-text text-xs">numbered boxes shown to applicants</span>
          </div>
        ) : null}
        {question.type === "range_slider" ? (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <span className="cool-text text-xs">Min</span>
            <NumberField
              compact
              value={question.min ?? 1}
              min={0}
              max={100}
              onChange={(next) =>
                onChange({ ...question, min: next === "" ? 1 : next })
              }
            />
            <span className="cool-text text-xs">Max</span>
            <NumberField
              compact
              value={question.max ?? 10}
              min={1}
              max={100}
              onChange={(next) =>
                onChange({ ...question, max: next === "" ? 10 : Math.min(Number(next), 100) })
              }
            />
            <span className="cool-text text-xs">Step</span>
            <NumberField
              compact
              value={(question as any).step ?? 1}
              min={1}
              onChange={(next) =>
                onChange({
                  ...question,
                  step: next === "" ? 1 : next,
                } as ApplicationQuestion)
              }
            />
          </div>
        ) : null}
        {question.type === "range" ? (
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="cool-text text-xs">Min</span>
              <NumberField
                compact
                value={question.min ?? 1}
                min={0}
                max={10}
                onChange={(next) =>
                  onChange({ ...question, min: next === "" ? 1 : next })
                }
              />
              <span className="cool-text text-xs">Max</span>
              <NumberField
                compact
                value={question.max ?? 5}
                min={1}
                max={10}
                onChange={(next) =>
                  onChange({ ...question, max: next === "" ? 5 : next })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                value={(question as any).min_label || ""}
                placeholder="Low label (e.g. Struggle)"
                maxLength={40}
                onChange={(next) =>
                  onChange({ ...question, min_label: next || undefined } as ApplicationQuestion)
                }
              />
              <TextField
                value={(question as any).max_label || ""}
                placeholder="High label (e.g. Excel)"
                maxLength={40}
                onChange={(next) =>
                  onChange({ ...question, max_label: next || undefined } as ApplicationQuestion)
                }
              />
            </div>
          </div>
        ) : null}
        {/* Quiz grading, only for quiz applications and never on section
           headers. Points and the correct answer are what the bot's scoring
           reads (`score_points` / `correct_answer`). */}
        {quizMode && !isSection ? (
          <div className="sm:col-span-2 rounded-xl border border-[var(--accent-peach)]/25 bg-[var(--accent-peach)]/[0.05] p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-peach)]">
              <IconTrophy size={13} />
              Grading
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="cool-text text-xs">Points</span>
              <NumberField
                compact
                value={(question as any).score_points ?? ""}
                min={0}
                max={1000}
                onChange={(next) =>
                  onChange({
                    ...question,
                    score_points: next === "" ? undefined : next,
                  } as ApplicationQuestion)
                }
              />
              <span className="cool-text text-xs">Correct answer</span>
              {isChoice ? (
                <div className="min-w-[180px] flex-1">
                  <SelectField
                    value={(question as any).correct_answer || ""}
                    options={[
                      { value: "", label: "No correct answer" },
                      ...options.map((option) => ({
                        value: option.label,
                        label: option.label || option.value,
                      })),
                    ]}
                    onChange={(next) =>
                      onChange({
                        ...question,
                        correct_answer: next || undefined,
                      } as ApplicationQuestion)
                    }
                  />
                </div>
              ) : (
                <div className="min-w-[180px] flex-1">
                  <TextField
                    value={(question as any).correct_answer || ""}
                    placeholder="Expected answer"
                    maxLength={500}
                    onChange={(next) =>
                      onChange({
                        ...question,
                        correct_answer: next || undefined,
                      } as ApplicationQuestion)
                    }
                  />
                </div>
              )}
            </div>
            {isText ? (
              <label className="mt-3 flex items-center gap-2 text-[12px] text-white/55">
                <input
                  type="checkbox"
                  className="accent-[var(--accent-peach)]"
                  checked={(question as any).match_mode === "similar"}
                  onChange={(event) =>
                    onChange({
                      ...question,
                      match_mode: event.target.checked ? "similar" : "exact",
                    } as ApplicationQuestion)
                  }
                />
                Accept close / similar answers (AI-assisted)
              </label>
            ) : null}
          </div>
        ) : null}
        {/* Validation Rules — revealed by the Validation button; only meaningful
            for free-text / number inputs the applicant types into. */}
        {isText && showValidation ? (
          <div className="sm:col-span-2">
            <ValidationRulesEditor
              rules={
                Array.isArray(question.validation)
                  ? (question.validation as ValidationRule[])
                  : []
              }
              onChange={(next) =>
                onChange({
                  ...question,
                  validation: next.length ? next : undefined,
                } as ApplicationQuestion)
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
