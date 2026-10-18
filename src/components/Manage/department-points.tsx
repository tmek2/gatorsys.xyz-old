"use client";

import React, { useMemo, useState } from "react";
import { useListKeys } from "@/components/motion";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconMinus,
  IconPlayerPause,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { SelectField, Toggle } from "./fields";

/**
 * Department infraction points ladder. Stages are evaluated by point threshold;
 * this order is only how they are shown to managers.
 */
export interface PointStage {
  name: string;
  points: number;
  type: "warning" | "suspension" | "termination";
}

export interface PointsSystem {
  stages: PointStage[];
  auto_termination?: boolean;
  auto_suspension_days?: number;
}

const STAGE_TYPES = [
  { value: "warning", label: "Warning Stage" },
  { value: "suspension", label: "Automatic Suspension" },
  { value: "termination", label: "Automatic Termination" },
] as const;

function StageIcon({ type }: { type: PointStage["type"] }) {
  if (type === "termination") {
    return <span className="text-[11px] font-extrabold">3</span>;
  }
  if (type === "suspension") return <IconPlayerPause size={16} stroke={2.2} />;
  return <IconAlertTriangle size={16} stroke={2.2} />;
}

const inputClass =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-[#f5f2f2] outline-none transition-colors placeholder:text-white/25 hover:border-white/[0.14] focus:border-[var(--accent-peach)]/55 focus:bg-white/[0.04]";

export function DepartmentPointsSystem({
  value,
  onChange,
}: {
  value: PointsSystem;
  onChange: (next: PointsSystem) => void;
}) {
  const stages = Array.isArray(value.stages) ? value.stages : [];
  const stageKeys = useListKeys(stages);
  const maximum = Math.max(0, ...stages.map((stage) => Number(stage.points) || 0));
  const [previewPoints, setPreviewPoints] = useState(() =>
    Math.max(0, Math.min(maximum, stages[1]?.points ?? stages[0]?.points ?? 0)),
  );

  const sorted = useMemo(
    () => [...stages].sort((a, b) => (Number(a.points) || 0) - (Number(b.points) || 0)),
    [stages],
  );
  const displayedPoints = Math.max(0, Math.min(previewPoints, maximum || previewPoints));

  function patchStage(index: number, patch: Partial<PointStage>) {
    onChange({
      ...value,
      stages: stages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...patch } : stage,
      ),
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...value, stages: next });
  }

  function addStage() {
    const nextPoints = maximum + (maximum > 0 ? 2 : 1);
    onChange({
      ...value,
      stages: [
        ...stages,
        {
          name: `Stage ${stages.length + 1}`,
          points: nextPoints,
          type: "warning",
        },
      ],
    });
    setPreviewPoints(nextPoints);
  }

  return (
    <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)] xl:gap-8">
      <section aria-labelledby="point-stages-heading" className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p
            id="point-stages-heading"
            className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/45"
          >
            Point stages
          </p>
          <span className="text-[11px] font-medium text-white/45">
            {stages.length} {stages.length === 1 ? "stage" : "stages"}
          </span>
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => (
            <article
              key={stageKeys[index]}
              className="group rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4 transition-colors hover:border-white/[0.08] sm:p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px_auto] sm:items-center">
                <label className="min-w-0">
                  <span className="sr-only">Stage name</span>
                  <input
                    value={stage.name}
                    placeholder="Stage name"
                    onChange={(event) => patchStage(index, { name: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="relative min-w-0">
                  <span className="sr-only">Points required</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stage.points}
                    onChange={(event) =>
                      patchStage(index, {
                        points: event.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(event.target.value))),
                      })
                    }
                    className={`${inputClass} pr-12 tabular-nums`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide text-white/45">
                    pts
                  </span>
                </label>

                <div className="flex items-center justify-end gap-1 sm:justify-start">
                  <button
                    type="button"
                    aria-label={`Move ${stage.name || "stage"} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-xl p-2 text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-20"
                  >
                    <IconArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${stage.name || "stage"} down`}
                    disabled={index === stages.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-xl p-2 text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-20"
                  >
                    <IconArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${stage.name || "stage"}`}
                    onClick={() =>
                      onChange({
                        ...value,
                        stages: stages.filter((_, stageIndex) => stageIndex !== index),
                      })
                    }
                    className="rounded-xl p-2 text-white/30 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <SelectField
                  value={stage.type}
                  onChange={(next) =>
                    next && patchStage(index, { type: next as PointStage["type"] })
                  }
                  options={STAGE_TYPES.map((item) => ({ ...item }))}
                />
              </div>
            </article>
          ))}

          {stages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-8 text-center">
              <p className="text-sm font-semibold text-white/65">No point stages yet</p>
              <p className="cool-text mt-1 text-xs">Create the first threshold for this department.</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={addStage}
            className="btn-pop btn-peach inline-flex h-10 items-center gap-2 px-4 text-sm"
          >
            <IconPlus size={16} />
            Create stage
          </button>
        </div>
      </section>

      <section aria-labelledby="points-configuration-heading" className="min-w-0 space-y-5">
        <p
          id="points-configuration-heading"
          className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/45"
        >
          Configuration &amp; preview
        </p>

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f5f2f2]">Auto-termination</p>
              <p className="cool-text mt-1 text-xs leading-relaxed">
                When a termination threshold is reached, notify server admins and remove the member&apos;s department privileges.
              </p>
            </div>
            <Toggle
              checked={Boolean(value.auto_termination)}
              onChange={(checked) => onChange({ ...value, auto_termination: checked })}
            />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-[#f5f2f2]">Auto-suspension days</span>
            <span className="cool-text mt-1 block text-xs leading-relaxed">
              How long an automatic suspension lasts. Set this to 0 for an indefinite suspension.
            </span>
            <input
              type="number"
              min={0}
              value={value.auto_suspension_days ?? 0}
              onChange={(event) =>
                onChange({
                  ...value,
                  auto_suspension_days:
                    event.target.value === "" ? 0 : Math.max(0, Number(event.target.value)),
                })
              }
              className={`${inputClass} mt-3 tabular-nums`}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#f5f2f2]">Preview</p>
              <p className="cool-text mt-1 text-[11px]">Test how the ladder responds to a point total.</p>
            </div>
            <IconCheck size={17} className="text-white/25" />
          </div>

          {sorted.length ? (
            <>
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-[420px] items-start px-1">
                  {sorted.map((stage, index) => {
                    const reached = displayedPoints >= (Number(stage.points) || 0);
                    return (
                      <React.Fragment key={`${stage.name}-${stage.points}-${index}`}>
                        {index > 0 ? (
                          <span
                            className={`mt-[18px] h-px min-w-8 flex-1 transition-colors ${reached ? "bg-[var(--accent-peach)]/55" : "bg-white/[0.08]"}`}
                          />
                        ) : null}
                        <div className="flex w-[96px] shrink-0 flex-col items-center text-center">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${reached ? "border-[var(--accent-peach)]/65 bg-[color-mix(in_srgb,var(--accent-peach)_18%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] bg-white/[0.035] text-white/35"}`}
                          >
                            <StageIcon type={stage.type} />
                          </span>
                          <span className="mt-2 max-w-[96px] truncate text-[11px] font-bold text-white/75">
                            {stage.name || "Untitled stage"}
                          </span>
                          <span className="mt-1 text-[10px] tabular-nums text-white/50">
                            {stage.points} points
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                <div className="inline-flex h-10 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035]">
                  <button
                    type="button"
                    aria-label="Decrease preview points"
                    onClick={() => setPreviewPoints((current) => Math.max(0, current - 1))}
                    className="flex h-full w-10 items-center justify-center text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <IconMinus size={15} />
                  </button>
                  <span className="min-w-[88px] border-x border-white/[0.08] px-3 text-center text-xs font-semibold tabular-nums text-white/75">
                    Points: {displayedPoints}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase preview points"
                    onClick={() => setPreviewPoints((current) => Math.min(maximum || current + 1, current + 1))}
                    className="flex h-full w-10 items-center justify-center text-[var(--accent-peach)]/70 transition-colors hover:bg-white/[0.04] hover:text-[var(--accent-peach)]"
                  >
                    <IconPlus size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-7 text-center text-xs text-white/35">
              Add a stage to build the preview.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
