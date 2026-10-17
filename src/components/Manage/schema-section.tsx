"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  IconAlignLeft,
  IconAlertTriangle,
  IconChevronDown,
  IconAt,
  IconCar,
  IconClock,
  IconCloud,
  IconFileText,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLayoutList,
  IconListDetails,
  IconMessage,
  IconMoodSmile,
  IconPlugOff,
  IconServer,
  IconStairsUp,
  IconToggleRight,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import {
  ChannelPicker,
  ColorPicker,
  DurationField,
  OptionCard,
  NumberField,
  RolePicker,
  SelectField,
  StringListEditor,
  TextAreaField,
  TextField,
  Toggle,
} from "./fields";
import { useManage } from "./manage-context";
import { fieldProblem, type ConfigProblem } from "./config-health";
import { ConfigMessageCard } from "./config-message";
import { MessageDesignCard } from "./message-design";
import { ErlcStatus } from "./erlc-status";
import { EmojiPickerButton } from "./emoji-picker";
import { ButtonListEditor, DepartmentLaddersEditor, PunishmentTypesEditor, RankLadderField, RoleQuotaEditor } from "./special-fields";
import { ModuleGate, PluginToggleButton } from "./module-gate";
import { InfractionHierarchyCard } from "./sections/infraction-hierarchy";
import { VariableChips } from "./embed-editor";
import type { FieldDef, FieldGroup, ModuleSchema } from "./schema";
import { fieldAt, findSection } from "./schema";
import { SectionHeader } from "./section-header";

/** Icon + accent per field type, so each config card reads at a glance. */
/**
 * The glyph for each config type, without a coloured box: scanning a long tab
 * by shape is faster than reading labels.
 */
const FIELD_ICONS: Record<string, ReactNode> = {
  channel: <IconMessage size={17} />,
  channels: <IconMessage size={17} />,
  role: <IconAt size={17} />,
  roles: <IconAt size={17} />,
  emoji: <IconMoodSmile size={17} />,
  color: <IconMoodSmile size={17} />,
  number: <IconClock size={17} />,
  duration: <IconClock size={17} />,
  toggle: <IconToggleRight size={17} />,
  text: <IconAlignLeft size={17} />,
  textarea: <IconAlignLeft size={17} />,
  secret: <IconKey size={17} />,
  select: <IconListDetails size={17} />,
  stringlist: <IconLayoutList size={17} />,
  buttons: <IconLayoutList size={17} />,
  punishmenttypes: <IconListDetails size={17} />,
  rolequotas: <IconClock size={17} />,
  departments: <IconListDetails size={17} />,
  ladder: <IconStairsUp size={17} />,
};

/**
 * One config in its own titled container: icon, name, description, and the
 * control below (or inline for toggles).
 */
export function ConfigCard({
  title,
  description,
  children,
  trailing,
  problem,
}: {
  /** Kept for the callers that still pass one; not drawn. */
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  trailing?: ReactNode;
  /** This setting points at a channel or role Discord no longer has. */
  problem?: ConfigProblem | null;
}) {
  /* A setting as a row in its group's panel: what it is on the left, its
     control on the right, hairlines between rows. A control too wide for that
     column (a list editor, a message designer, a textarea) takes the full width
     under the label; `SchemaGroupBlock` decides by field type. */
  /* A row whose only control is a switch at its end is the switch: pressing
     anywhere on it presses the switch, the way the tiles work. */
  const pressable = Boolean(trailing) && !children;
  return (
    <div
      className="gw-set-row"
      /* A field under its name, which the hand-written tabs' panels lay out
         two across. */
      data-field={children ? "true" : undefined}
      data-problem={problem ? "true" : undefined}
      data-press={pressable ? "true" : undefined}
      onClick={
        pressable
          ? (event) => {
              const target = event.target as HTMLElement;
              if (target.closest("button, a, input, textarea, select, [role='switch'], [role='button']")) return;
              event.currentTarget
                .querySelector<HTMLElement>(".gw-set-trailing [role='switch']")
                ?.click();
            }
          : undefined
      }
    >
      <div className="gw-set-lead">
        {/* Only the warning mark here; no type glyph down every row. */}
        {problem ? (
          <span className="field-icon" data-problem="true">
            <IconAlertTriangle size={17} />
          </span>
        ) : null}
        <div className="gw-set-copy">
          <p className="gw-set-name">
            {title}
            {problem ? (
              <span className="gw-set-flag" title={problem.detail}>
                {problem.tag}
              </span>
            ) : null}
          </p>
          {description ? <p className="gw-set-note">{description}</p> : null}
          {problem ? <p className="gw-set-why">{problem.detail}</p> : null}
        </div>
      </div>
      {children ? <div className="gw-set-control">{children}</div> : null}
      {trailing ? <div className="gw-set-trailing">{trailing}</div> : null}
    </div>
  );
}

/**
 * Groups you set once (identity, wording, privacy, a secondary log destination)
 * start closed. Matched on the title because that is what the schema carries.
 */
const ADVANCED =
  /webhook|appearance|privacy|advanced|branding|wording|identity|embed colou?r/i;

/** A flat group header — bold title, optional description, full-width
 *  divider — matching the Overview-style arrangement (no wrapping card). */
export function GroupHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="schema-group-header">
      <div className="schema-group-heading-row">
        <h3 className="text-base font-bold text-[#f5f2f2]">{title}</h3>
        <span className="schema-group-rule" aria-hidden="true" />
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {description ? (
        <p className="cool-text mt-1 text-[13px] leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}


/**
 * One group on a settings tab. Its shape comes from the group: - Led by a
 * toggle with dependent fields: one card that rolls its settings down when the
 * switch is on. - With a `gatedBy` path: the same card, indented under the
 * switch it depends on and stepped back while that switch is off (ER:LC's
 * "Enable advanced tools" gates seven groups). - Anything else: a header and a
 * two-column grid of fields; a one-field group spans the row.
 */
/**
 * Whether a field's `visibleWhen` condition is met. A hook because it reads
 * staged config, so call it unconditionally.
 */
function useFieldFilter() {
  const { value } = useManage();
  return (field: FieldDef) => {
    const condition = field.visibleWhen;
    if (!condition) return true;
    const current = value(condition.path);
    return condition.equals.includes(String(current ?? ""));
  };
}

/**
 * One on/off setting as a tile, and the tile is the switch: press anywhere. On,
 * the colour sweeps in from the leading edge (like a module card on the
 * Overview) and the mark draws a check. Consecutive booleans sit side by side
 * in a grid.
 */
export function OptionTile({
  path,
  label,
  description,
  defaultValue,
  wide = false,
}: {
  path: string;
  label: string;
  description?: string;
  defaultValue?: unknown;
  /** Full width: a group's own master switch, rather than one of several. */
  wide?: boolean;
}) {
  const { value, stage } = useManage();
  const on = Boolean(value(path) ?? defaultValue ?? false);
  return (
    <OptionCard
      checked={on}
      onChange={(next) => stage(path, next)}
      label={label}
      description={description}
      wide={wide}
    />
  );
}

type FieldRun =
  | { kind: "options"; fields: FieldDef[] }
  | { kind: "field"; field: FieldDef };

/** A group's fields, with each run of booleans gathered into one grid. */
function fieldRuns(fields: FieldDef[]): FieldRun[] {
  const runs: FieldRun[] = [];
  for (const field of fields) {
    const last = runs[runs.length - 1];
    if (field.type === "toggle") {
      if (last && last.kind === "options") last.fields.push(field);
      else runs.push({ kind: "options", fields: [field] });
    } else {
      runs.push({ kind: "field", field });
    }
  }
  return runs;
}

/** Whether the switch a field `requires` is on, its own default counted. */
function useRequirement() {
  const { value } = useManage();
  return (field: FieldDef) => {
    if (!field.requires) return true;
    return Boolean(value(field.requires) ?? fieldAt(field.requires)?.defaultValue ?? false);
  };
}

/* Half-width fields with nothing beside them (the last of an odd run) take the
   whole line. */
function aloneFields(runs: FieldRun[]): Set<string> {
  const alone = new Set<string>();
  let run: string[] = [];
  const close = () => {
    if (run.length % 2 === 1) alone.add(run[run.length - 1]);
    run = [];
  };
  for (const item of runs) {
    const half = item.kind === "field" && !item.field.requires && !WIDE_FIELD_TYPES.has(item.field.type);
    if (half) run.push(item.field.path);
    else close();
  }
  close();
  return alone;
}

function FieldRuns({ fields }: { fields: FieldDef[] }) {
  const required = useRequirement();
  const runs = fieldRuns(fields);
  const alone = aloneFields(runs);
  return (
    <>
      {runs.map((run) =>
        run.kind === "field" && run.field.requires ? (
          /* The rows under a switch roll in when it turns on and out when it
             turns off. */
          <div
            key={run.field.path}
            className="gw-set-roll"
            data-requires="true"
            data-open={required(run.field) ? "true" : "false"}
          >
            <div className="gw-set-roll-clip" inert={!required(run.field)}>
              <div
                className="gw-set-slot"
                data-wide={WIDE_FIELD_TYPES.has(run.field.type) ? "true" : undefined}
              >
                <SchemaField field={run.field} />
              </div>
            </div>
          </div>
        ) : run.kind === "options" ? (
          <div
            key={`opts:${run.fields[0].path}`}
            className="gw-set-slot"
            data-options="true"
          >
            <div className="gw-opts" data-count={run.fields.length}>
              {run.fields.map((field) => (
                <OptionTile
                  key={field.path}
                  path={field.path}
                  label={field.label}
                  description={field.description}
                  defaultValue={field.defaultValue}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            key={run.field.path}
            className="gw-set-slot"
            data-wide={WIDE_FIELD_TYPES.has(run.field.type) || alone.has(run.field.path) ? "true" : undefined}
          >
            <SchemaField field={run.field} />
          </div>
        ),
      )}
    </>
  );
}

function SchemaGroupBlock({
  group,
  hideTitle = false,
}: {
  group: FieldGroup;
  /** For a tab that holds one group: the tab already is the heading. */
  hideTitle?: boolean;
}) {
  const { value } = useManage();
  const fieldApplies = useFieldFilter();
  const gateOpen = group.gatedBy ? Boolean(value(group.gatedBy)) : true;
  const shown = group.fields.filter(fieldApplies);

  /* Groups matching `ADVANCED` (set once, rarely reopened) start closed with
     their name and setting count; everything else is open. */
  const [open, setOpen] = useState(
    () => !ADVANCED.test(group.title || ""),
  );
  /* Declared by the group (`lead: true`), not guessed from a leading toggle:
     many groups start with an unrelated toggle. */
  const leadToggle =
    group.lead === true && group.fields[0]?.type === "toggle" && group.fields.length > 1;

  const inner = leadToggle ? (
    <ToggleGroup group={group} />
  ) : (
    <section
      className="gw-set"
    >
      {/* The heading is the panel's first row, inside the same border as its
         settings; pressing it opens and shuts the group. */}
      <div className="gw-set-panel" data-bare={hideTitle ? "true" : undefined}>
        {hideTitle ? (
          group.description ? (
            <p className="gw-set-lede">{group.description}</p>
          ) : null
        ) : (
          <button
            type="button"
            className="gw-set-head"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="gw-set-head-copy">
              <span className="gw-set-head-name">{group.title}</span>
              {group.description ? (
                <span className="gw-set-head-say">{group.description}</span>
              ) : null}
            </span>
            {open ? null : (
              <span className="gw-set-count">
                {shown.length} setting{shown.length === 1 ? "" : "s"}
              </span>
            )}
            <IconChevronDown className="gw-set-chev" size={15} stroke={2.2} />
          </button>
        )}
        {/* The rows stay mounted inside a grid track that animates from `0fr` to
           `1fr` (no measuring), and `inert` keeps the keyboard out of a closed
           group. */}
        {hideTitle ? (
          <FieldRuns fields={shown} />
        ) : (
          <div className="gw-set-roll" data-open={open ? "true" : "false"}>
            <div className="gw-set-roll-clip" inert={!open}>
              <FieldRuns fields={shown} />
            </div>
          </div>
        )}
      </div>
    </section>
  );

  // A run of lead-toggle cards has no heading of its own — each card is named
  // for itself — so the first of the run carries one for the whole run.
  const headed = group.heading ? (
    <>
      <GroupHeader
        title={group.heading.title}
        description={group.heading.description}
      />
      {inner}
    </>
  ) : (
    inner
  );

  if (!group.gatedBy) return headed;
  return (
    <div className="schema-gated" data-open={gateOpen ? "true" : "false"}>
      {headed}
    </div>
  );
}

export function FieldIcon({ type }: { type: string }) {
  return (
    <span className="field-icon">{FIELD_ICONS[type] || FIELD_ICONS.text}</span>
  );
}

function SecretField({ field }: { field: FieldDef }) {
  const { value, stage } = useManage();
  const [show, setShow] = useState(false);
  const hasSaved = Boolean(value(field.path.replace(/\.([^.]+)$/, ".has_$1")));
  const staged = value(field.path);
  return (
    <ConfigCard
      icon={<FieldIcon type="secret" />}
      title={field.label}
      description={
        hasSaved && !staged
          ? `${field.description || ""} A key is saved. Enter a new one to replace it.`.trim()
          : field.description
      }
    >
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={typeof staged === "string" ? staged : ""}
          placeholder={hasSaved ? "••••••••••••" : field.placeholder || "Enter key"}
          onChange={(event) => stage(field.path, event.target.value || undefined)}
          autoComplete="off"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-[#f5f2f2] placeholder:text-white/25 outline-none transition-colors focus:border-[rgb(var(--accent-rgb)/0.45)]"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="shrink-0 rounded-xl p-2 text-white/40 hover:text-white"
          aria-label={show ? "Hide" : "Show"}
        >
          {show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
        </button>
      </div>
    </ConfigCard>
  );
}

/**
 * One schema field on its own, exported so a hand-written section can include
 * schema settings with the standard widgets (verification settings live on the
 * Roblox tab this way).
 */
export function SchemaField({ field }: { field: FieldDef }) {
  const { meta, value, stage } = useManage();
  const current = value(field.path);
  const icon = <FieldIcon type={field.type} />;
  // Only for types whose value is a Discord id: a deleted channel or role
  // silently stops the bot, so it is flagged here.
  const problem = fieldProblem(field.type, current, meta);

  switch (field.type) {
    case "toggle": {
      const checked = Boolean(current ?? field.defaultValue ?? false);
      // Toggle leads on the left (Gator-style), label + description to the
      // right — inside the same card chrome as the other schema fields.
      /* A toggle uses the same row as every other setting, with the switch at
         the end. */
      return (
        <ConfigCard
          icon={icon}
          title={field.label}
          description={field.description}
          trailing={
            <Toggle
              checked={checked}
              onChange={(next) => stage(field.path, next)}
              ariaLabel={field.label}
            />
          }
        />
      );
    }
    case "channel":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <ChannelPicker
            channels={meta?.channels || []}
            types={field.channelTypes || ["text", "announcement"]}
            value={current != null ? String(current) : null}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "channels":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <ChannelPicker
            channels={meta?.channels || []}
            types={field.channelTypes || ["text", "announcement"]}
            multi
            value={Array.isArray(current) ? current.map(String) : []}
            onChange={(next) => stage(field.path, next)}
            placeholder="Select channels"
          />
        </ConfigCard>
      );
    case "role":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <RolePicker
            roles={meta?.roles || []}
            value={current != null ? String(current) : null}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "ladder":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <RankLadderField
            roles={meta?.roles || []}
            value={Array.isArray(current) ? current.map(String) : []}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "roles":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <RolePicker
            roles={meta?.roles || []}
            multi
            value={Array.isArray(current) ? current.map(String) : []}
            onChange={(next) => stage(field.path, next)}
            placeholder="Select roles"
          />
        </ConfigCard>
      );
    case "text":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <TextField
            value={current != null ? String(current) : ""}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            onChange={(next) => stage(field.path, next || null)}
          />
        </ConfigCard>
      );
    case "emoji":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <EmojiPickerButton
            value={current != null ? String(current) : undefined}
            onChange={(next) => stage(field.path, next || null)}
          />
        </ConfigCard>
      );
    case "secret":
      return <SecretField field={field} />;
    case "textarea":
      return (
        <TextAreaConfig
          icon={icon}
          field={field}
          value={current != null ? String(current) : ""}
          onChange={(next) => stage(field.path, next || null)}
        />
      );
    case "number": {
      const numeric =
        current === null || current === undefined || current === ""
          ? ""
          : Number(current);
      // Numeric configs with a duration unit get the preset dropdown; the
      // rest stay a plain number input.
      if (field.durationUnit) {
        return (
          <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
            <DurationField
              unit={field.durationUnit}
              value={current === "" || current == null ? null : Number(current)}
              min={field.min}
              max={field.max}
              onChange={(next) =>
                stage(field.path, next == null ? null : field.asString ? String(next) : next)
              }
            />
          </ConfigCard>
        );
      }
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <NumberField
            value={Number.isNaN(numeric) ? "" : numeric}
            min={field.min}
            max={field.max}
            onChange={(next) =>
              stage(field.path, next === "" ? null : field.asString ? String(next) : next)
            }
          />
        </ConfigCard>
      );
    }
    case "select":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <SelectField
            value={current != null ? String(current) : null}
            options={field.options || []}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "stringlist":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <StringListEditor
            values={Array.isArray(current) ? current.map((item) => String(item)) : []}
            placeholder={field.placeholder}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "buttons":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <ButtonListEditor
            buttons={Array.isArray(current) ? current : []}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "color":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <ColorPicker
            value={current != null ? String(current) : String(field.defaultValue || "#5865f2")}
            label={`Choose ${field.label.toLowerCase()}`}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "punishmenttypes":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <PunishmentTypesEditor
            types={Array.isArray(current) ? current : []}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "rolequotas":
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <RoleQuotaEditor
            quotas={Array.isArray(current) ? current : []}
            roles={meta?.roles || []}
            onChange={(next) => stage(field.path, next)}
          />
        </ConfigCard>
      );
    case "application": {
      /* A picker over this server's forms, instead of a box for an unreadable
         generated id. */
      const forms = value("Applications.applications");
      const options = (Array.isArray(forms) ? forms : [])
        .filter((form: any) => form && typeof form === "object" && form.id)
        .map((form: any) => ({
          value: String(form.id),
          label: String(form.name || "Untitled form"),
        }));
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          {options.length ? (
            <SelectField
              value={current != null ? String(current) : null}
              options={options}
              onChange={(next) => stage(field.path, next)}
            />
          ) : (
            <p className="cool-text text-[13px] leading-relaxed">
              No forms yet. Build one under Resources and it will appear here.
            </p>
          )}
        </ConfigCard>
      );
    }
    case "departments": {
      // The bot stores departments as a list of single-element lists ([[{name,
      // ranks}], ...]) and flattens on read, so this flattens for the editor
      // and re-wraps on save.
      const flatDepartments = Array.isArray(current)
        ? current
            .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
            .filter(
              (entry): entry is { name: string; ranks: (string | number)[] } =>
                Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
            )
        : [];
      return (
        <ConfigCard icon={icon} title={field.label} description={field.description} problem={problem}>
          <DepartmentLaddersEditor
            departments={flatDepartments}
            roles={meta?.roles || []}
            onChange={(next) =>
              stage(field.path, next.map((department) => [department]))
            }
          />
        </ConfigCard>
      );
    }
    default:
      return null;
  }
}

/** Legacy banner kept for custom sections that manage their own gating. */
export function ModuleDisabledBanner({
  moduleLabel,
  onEnable,
}: {
  moduleLabel: string;
  onEnable: () => void;
}) {
  return (
    <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border-dashed px-5 py-4">
      <div className="flex items-center gap-3">
        <IconPlugOff size={18} className="text-white/40" />
        <p className="text-sm text-white/70">
          <span className="font-semibold text-[#f5f2f2]">{moduleLabel}</span> is
          currently disabled.
        </p>
      </div>
      <button type="button" onClick={onEnable} className="btn-pop btn-peach h-8 px-3 text-xs">
        Enable feature
      </button>
    </div>
  );
}

/**
 * A textarea config, with the variable picker when the field declares
 * variables. The chips come from the same list the bot's resolver is tested
 * against.
 */
function TextAreaConfig({
  icon,
  field,
  value,
  onChange,
}: {
  icon: ReactNode;
  field: FieldDef;
  value: string;
  onChange: (next: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={cardRef}>
      <ConfigCard icon={icon} title={field.label} description={field.description}>
        <TextAreaField
          value={value}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          onChange={onChange}
        />
        {field.variables?.length ? (
          <div className="mt-3">
            <VariableChips variables={field.variables} containerRef={cardRef} />
          </div>
        ) : null}
      </ConfigCard>
    </div>
  );
}

/**
 * A group led by a toggle: the same two columns as every group, with the switch
 * as the first row and the settings it gates rolling down beneath it. An off
 * feature is one row.
 */
function ToggleGroup({
  group,
}: {
  group: { title: string; description?: string; fields: FieldDef[] };
}) {
  const { value } = useManage();
  const fieldApplies = useFieldFilter();
  const toggleField = group.fields[0];
  const rest = group.fields.slice(1).filter(fieldApplies);
  const enabled = Boolean(
    value(toggleField.path) ?? toggleField.defaultValue ?? false,
  );

  return (
    <section className="gw-set" data-enabled={enabled ? "true" : "false"}>
      <div className="gw-set-panel">
        <div className="gw-set-head" data-static="true">
          <span className="gw-set-head-copy">
            <span className="gw-set-head-name">{group.title}</span>
            {group.description ? (
              <span className="gw-set-head-say">{group.description}</span>
            ) : null}
          </span>
        </div>

        <div className="gw-set-slot" data-options="true">
          <div className="gw-opts">
            <OptionTile
              path={toggleField.path}
              label={toggleField.label}
              description={toggleField.description}
              defaultValue={toggleField.defaultValue}
              wide
            />
          </div>
        </div>

        {rest.length ? (
          <div className="gw-set-roll" data-open={enabled ? "true" : "false"}>
            <div className="gw-set-roll-clip" inert={!enabled}>
              <FieldRuns fields={rest} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Field types that keep a full row to themselves in the two-column grid. */
const WIDE_FIELD_TYPES = new Set<string>([
  "textarea",
  "stringlist",
  "buttons",
  "departments",
  "punishmenttypes",
  "rolequotas",
]);

/* The ER:LC tabs. "Server" is the connection and what runs on it; Live
   statistics sits beside the "Enable advanced tools" switch that gates it. */
const PRC_TAB_META: Record<string, { icon: React.ReactNode; blurb: string }> = {
  server: { icon: <IconServer size={15} />, blurb: "Key, alerts and automations" },
  weather: { icon: <IconCloud size={15} />, blurb: "In-game weather and clock" },
  "game-logs": { icon: <IconFileText size={15} />, blurb: "Joins, kills and commands" },
  teams: { icon: <IconUsers size={15} />, blurb: "Who can take which team" },
  vehicles: { icon: <IconCar size={15} />, blurb: "Vehicles and liveries by rank" },
  players: { icon: <IconUserCheck size={15} />, blurb: "Welcomes, checks and names" },
};

const PRC_TABS = [
  {
    id: "server",
    label: "Server",
    groups: [
      "Connection",
      "Alerts",
      "Automations",
      "Thresholds",
      "Advanced tools",
      "Live statistics",
    ],
  },
  {
    // Its own tab rather than gated behind "Enable advanced tools", which it
    // does not depend on.
    id: "weather",
    label: "Weather & Time",
    groups: ["Weather and time"],
  },
  {
    id: "game-logs",
    label: "Game Logs",
    groups: [],
  },
  {
    id: "teams",
    label: "Teams",
    groups: ["Team restrictions"],
  },
  {
    id: "vehicles",
    label: "Vehicles & Liveries",
    groups: ["Vehicle & livery restrictions"],
  },
  {
    id: "players",
    label: "Players",
    groups: [
      "Player welcome",
      "Discord membership checks",
      "Username moderation",
    ],
  },
] as const;

function PrcTabbedGroups({ groups }: { groups: FieldGroup[] }) {
  const [activeTab, setActiveTab] = useState<(typeof PRC_TABS)[number]["id"]>(
    "server"
  );
  const current = PRC_TABS.find((tab) => tab.id === activeTab) || PRC_TABS[0];
  const gameLogs = findSection("game-logs");
  /* One highlight that travels to the chosen section, like the main rail. */
  const rail = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const place = () => {
      const on = node.querySelector<HTMLElement>('[data-active="true"]');
      if (!on) return;
      node.style.setProperty("--blob-x", `${on.offsetLeft}px`);
      node.style.setProperty("--blob-y", `${on.offsetTop}px`);
      node.style.setProperty("--blob-w", `${on.offsetWidth}px`);
      node.style.setProperty("--blob-h", `${on.offsetHeight}px`);
      node.dataset.lit = "true";
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(node);
    return () => watch.disconnect();
  }, [activeTab]);
  const visibleGroups = current.groups
    .map((title) => groups.find((group) => group.title === title))
    .filter((group): group is FieldGroup => Boolean(group));

  const panelBody = current.id === "game-logs" ? (
    <div className="prc-merged-module">
      <div className="prc-merged-module-head">
        <div>
          <h3>Game Logs</h3>
          <p>{gameLogs?.description}</p>
        </div>
        <PluginToggleButton moduleKey="Game Logs" moduleLabel="Game Logs" />
      </div>
      {gameLogs ? (
        <ModuleGate
          moduleKey="Game Logs"
          moduleLabel="Game Logs"
          onGoBack={() => setActiveTab("server")}
        >
          <div className="prc-tab-groups">
            {gameLogs.groups.map((group) => (
              <SchemaGroupBlock key={group.title} group={group} />
            ))}
          </div>
        </ModuleGate>
      ) : null}
    </div>
  ) : (
    <div className="prc-tab-groups">
      {/* The live connection status, on the tab about the connection (the key
         field is write-only, so this is the only way to see whether it works). */}
      {visibleGroups.map((group) => (
        <SchemaGroupBlock
          key={group.title}
          group={group}
          // A tab with one group does not repeat that group's heading.
          hideTitle={visibleGroups.length === 1}
        />
      ))}
    </div>
  );

  return (
    /* A rail of sections, each with an icon and a line saying what is in it,
       beside the settings on wide screens so switching sections does not move
       the content. Narrower, it becomes a scroller. */
    <div className="prc-settings">
      {/* Above the sections: every other ER:LC section depends on the
         connection. */}
      <ErlcStatus compact />

      <div className="prc-shell">
        <div className="prc-rail" role="tablist" aria-label="ER:LC settings" ref={rail}>
          <span className="prc-rail-blob" aria-hidden="true" />
          {PRC_TABS.map((tab) => {
            const meta = PRC_TAB_META[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`prc-panel-${tab.id}`}
                className="prc-rail-item"
                data-active={activeTab === tab.id ? "true" : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="prc-rail-icon">{meta?.icon}</span>
                <span className="prc-rail-text">
                  <span className="prc-rail-label">{tab.label}</span>
                  {meta?.blurb ? (
                    <span className="prc-rail-blurb">{meta.blurb}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Keyed, so a new section arrives rather than replacing the old one
            in place. */}
        <div
          key={current.id}
          id={`prc-panel-${current.id}`}
          className="prc-tab-panel"
          role="tabpanel"
        >
          {panelBody}
        </div>
      </div>
    </div>
  );
}

export function SchemaSection({
  section,
  onNavigate,
}: {
  section: ModuleSchema;
  onNavigate?: (next: string) => void;
}) {
  const body = (
    <div className="space-y-5">
      <SectionHeader
        title={section.id === "prc" ? "ERLC" : section.label}
        actions={
          section.moduleKey ? (
            <PluginToggleButton moduleKey={section.moduleKey} moduleLabel={section.label} />
          ) : undefined
        }
      />
      {/* No command list on module tabs; command names belong in the docs. */}
      {section.id === "prc" ? (
        <PrcTabbedGroups groups={section.groups} />
      ) : (
        section.groups.map((group) => (
          <SchemaGroupBlock key={group.title} group={group} />
        ))
      )}
      {/* Infraction types are a string list here, but what each one does
         (whether issuing it demotes, and how far) is shown directly under it. */}
      {section.id === "infractions" ? <InfractionHierarchyCard /> : null}
      {section.message ? (
        <MessageDesignCard
          type={section.message.type}
          title={section.message.title}
          hint={section.message.hint}
          variables={section.message.variables}
          defaults={section.message.defaults}
          previewOverrides={section.message.previewOverrides}
          module={section.label}
        />
      ) : null}
      {(section.configMessages || []).map((message) => (
        <ConfigMessageCard
          key={message.path}
          path={message.path}
          title={message.title}
          hint={message.hint}
          variables={message.variables}
          defaults={message.defaults}
          hideContent={message.hideContent}
          previewOverrides={message.previewOverrides}
          module={section.label}
        />
      ))}
    </div>
  );

  if (!section.moduleKey) return body;
  return (
    <ModuleGate
      moduleKey={section.moduleKey}
      moduleLabel={section.label}
      onGoBack={() => onNavigate?.("modules")}
    >
      {body}
    </ModuleGate>
  );
}
