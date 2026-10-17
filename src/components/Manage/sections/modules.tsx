"use client";

import React from "react";
import { flushSync } from "react-dom";
import {
  IconActivity,
  IconBan,
  IconBell,
  IconBroadcast,
  IconBuildingBroadcastTower,
  IconCalendarQuestion,
  IconClockHour4,
  IconConfetti,
  IconGavel,
  IconGift,
  IconHeartHandshake,
  IconLink,
  IconMail,
  IconMessage2Bolt,
  IconMessageChatbot,
  IconMessageCircleQuestion,
  IconMessages,
  IconPackage,
  IconSettings,
  IconSitemap,
  IconTargetArrow,
  IconTerminal2,
  IconTicket,
  IconTrendingUp,
  IconUserOff,
  IconUsers,
  IconWaveSine,
} from "@tabler/icons-react";
import { useManage } from "../manage-context";
import { JellyThumb, useJellyThumb } from "@/components/motion";
import { Toggle } from "../fields";
import { MODULE_TOGGLES, STAFF_MODULE_ALIASES } from "../schema";
import { isModuleEnabled } from "../module-status";
import { SectionHeader } from "../section-header";
import { HoverTip } from "../hover-tip";
import { auditByTab, auditConfig } from "../config-audit";

/* One glyph per module, none repeated. */
const MODULE_ICONS: Record<string, React.ReactNode> = {
  infractions: <IconGavel size={20} />,
  Punishments: <IconBan size={20} />,
  promotions: <IconTrendingUp size={20} />,
  suspensions: <IconUserOff size={20} />,
  LOA: <IconWaveSine size={20} />,
  Quota: <IconTargetArrow size={20} />,
  Staff: <IconUsers size={20} />,
  Activity: <IconActivity size={20} />,
  Shifts: <IconClockHour4 size={20} />,
  Tickets: <IconTicket size={20} />,
  Modmail: <IconMail size={20} />,
  suggestions: <IconMessageCircleQuestion size={20} />,
  QOTD: <IconCalendarQuestion size={20} />,
  Welcome: <IconConfetti size={20} />,
  "Auto Responder": <IconMessage2Bolt size={20} />,
  connectionroles: <IconLink size={20} />,
  Giveaways: <IconGift size={20} />,
  Reminder: <IconBell size={20} />,
  Partnerships: <IconHeartHandshake size={20} />,
  Packages: <IconPackage size={20} />,
  Forums: <IconMessages size={20} />,
  PRC: <IconBuildingBroadcastTower size={20} />,
  Sessions: <IconBroadcast size={20} />,
  GatorAI: <IconMessageChatbot size={20} />,
  Department: <IconSitemap size={20} />,
  customcommands: <IconTerminal2 size={20} />,
};

const CATEGORY_ORDER = ["Moderation", "Staff", "Community", "Integrations", "Content"];

function useModuleToggles() {
  const { value, commit, setNotice } = useManage();
  const hasPrcKey =
    Boolean(value("Integrations.PRC.has_key")) || Boolean(value("Integrations.PRC.key"));

  function isEnabled(key: string): boolean {
    return isModuleEnabled(value, key);
  }

  /* Turning a module on or off is written immediately, with an undo toast,
     instead of a save prompt: it costs the right press nothing and the wrong
     one a click. */
  function toggle(key: string, next: boolean, quiet = false) {
    if (key === "Sessions" && next && !hasPrcKey) {
      setNotice({
        kind: "error",
        text: "Sessions needs your ER:LC PRC key first. Add it under ERLC.",
      });
      return;
    }
    const changes: Record<string, boolean> = { [`Modules.${key}`]: next };
    if (key === "Staff") {
      for (const alias of STAFF_MODULE_ALIASES) changes[`Modules.${alias}`] = next;
    }
    const label = MODULE_TOGGLES.find((module) => module.key === key)?.label ?? key;
    // The last one on gets said as what it is.
    const completes =
      next && MODULE_TOGGLES.every((module) => module.key === key || isModuleEnabled(value, module.key));
    void commit(changes, "Modules").then((ok) => {
      if (!ok || quiet) return;
      setNotice({
        kind: "saved",
        text: completes
          ? `${label} is on. That's all ${MODULE_TOGGLES.length}.`
          : `${label} ${next ? "is on" : "is off"}`,
        action: { label: "Undo", run: () => toggle(key, !next, true) },
      });
    });
  }

  return { isEnabled, toggle };
}

function ModuleCard({
  module,
  enabled,
  onToggle,
  onConfigure,
  variant,
  problems = 0,
  setup = 0,
}: {
  module: (typeof MODULE_TOGGLES)[number];
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onConfigure?: () => void;
  variant: "default" | "overview";
  /** Settings on this module's tab that point at a deleted channel or role.
   *  Only meaningful while the module is on. */
  problems?: number;
  /** Channels it posts to that have not been picked yet: the rest of setting
   *  it up, not a fault. */
  setup?: number;
}) {
  const overview = variant === "overview";
  const glyph = MODULE_ICONS[module.key] || <IconSettings size={20} />;

  if (!overview) {
    return (
      <div
        className={`glass-panel flex flex-col gap-3 rounded-2xl p-4 transition-colors ${
          enabled ? "border-[rgb(var(--accent-rgb)/0.22)]" : ""
        }`}
        data-module-key={module.key}
        data-enabled={enabled ? "true" : "false"}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 shrink-0 ${enabled ? "text-[var(--accent-peach)]" : "text-white/45"}`}
            aria-hidden="true"
          >
            {glyph}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#f5f2f2]">{module.label}</h3>
            <p className="cool-text mt-1 text-[12.5px] leading-relaxed">
              {module.description}
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={onToggle}
            ariaLabel={`${enabled ? "Disable" : "Enable"} ${module.label}`}
          />
        </div>
        {enabled && module.sectionId ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfigure}
              className="module-btn module-btn-configure"
            >
              <IconSettings size={14} />
              Configure
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  /* The overview card is the switch: pressing it turns the module on or off,
     and the colour sweeping across or retracting is the state. On hover the
     card previews the press and says it in two words. Settings is the cog in
     the corner. */
  /* Going to a module's settings does not depend on it being on. The gate on
     the page itself says what an off module does. */
  const open = module.sectionId ? onConfigure : undefined;
  /* The hover preview ends once the card is pressed (otherwise a card just
     turned on would stay part-filled until the pointer left), and returns when
     the pointer leaves and comes back. */
  const [settled, setSettled] = React.useState(true);

  return (
    <div
      className="gw-mod"
      data-module-key={module.key}
      data-enabled={enabled ? "true" : "false"}
      data-settled={settled ? undefined : "false"}
      data-needs={enabled && problems ? "true" : undefined}
      data-setup={enabled && !problems && setup ? "true" : undefined}
      onPointerLeave={() => setSettled(true)}
    >
      <span className="gw-mod-fill" aria-hidden="true" />
      <span className="gw-mod-ghost" aria-hidden="true">
        {glyph}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={module.label}
        className="gw-mod-toggle"
        onClick={() => {
          setSettled(false);
          onToggle(!enabled);
        }}
      >
        <span className="gw-mod-head">
          <span className="gw-mod-glyph" aria-hidden="true">
            {glyph}
          </span>
          <h3 className="gw-mod-title">{module.label}</h3>
        </span>
        <p className="gw-mod-say">{module.description}</p>
        <span className="gw-mod-hint" aria-hidden="true">
          {enabled ? "Turn off" : "Turn on"}
        </span>
      </button>

      {open ? (
        /* Broken (a deleted channel or role): the cog shows an amber count and
           the reason in its tooltip. On but not finished (no channel picked
           yet): the cog opens out into "Set up", the next step rather than a
           warning. Either way it is on the control that leads to the fix, not
           the card (which would turn it off). */
        <HoverTip
          side="top"
          align="end"
          className="gw-mod-cog-spot"
          label={
            enabled && problems
              ? `Settings · ${problems} pointing at something deleted`
              : enabled && setup
                ? "Pick where it posts to finish setting it up"
                : "Settings"
          }
        >
          <button
            type="button"
            className="gw-mod-cog"
            onClick={open}
            aria-label={
              enabled && problems
                ? `${module.label} settings, ${problems} to fix`
                : enabled && setup
                  ? `Set up ${module.label}`
                  : `${module.label} settings`
            }
          >
            <IconSettings size={18} stroke={1.8} aria-hidden="true" />
            {enabled && !problems && setup ? (
              <span className="gw-mod-cog-say" aria-hidden="true">
                Set up
              </span>
            ) : null}
            {enabled && problems ? (
              <span className="gw-mod-cog-count" aria-hidden="true">
                {problems}
              </span>
            ) : null}
          </button>
        </HoverTip>
      ) : null}
    </div>
  );
}

/**
 * The module grid grouped by category, shown on the Overview and reused
 * wherever the toggles are needed.
 */
export function ModuleToggleGrid({
  onNavigate,
  variant = "default",
}: {
  onNavigate: (section: string) => void;
  variant?: "default" | "overview";
}) {
  const { isEnabled, toggle } = useModuleToggles();
  const { value, meta } = useManage();
  /* The same audit the status strip counts, cut by section so each card can
     say whether its own module is broken or still being set up. */
  const findings = React.useMemo(() => auditByTab(auditConfig(value, meta)), [value, meta]);
  /* Filter: all, enabled or disabled. */
  const [only, setOnly] = React.useState<"all" | "on" | "off">("all");
  const filterBox = React.useRef<HTMLDivElement | null>(null);
  useJellyThumb(filterBox, only);
  const wall = React.useRef<HTMLDivElement | null>(null);

  /* Filtering runs as a view transition: cards that stay slide to their new
     places, leaving ones shrink away, arriving ones grow in, and category
     headings move with their cards. Only cards on screen take part, because a
     named element is drawn outside its scroller's clip during the transition. */
  const choose = (next: "all" | "on" | "off") => {
    if (next === only) return;
    const root = wall.current;
    if (
      !root ||
      typeof document.startViewTransition !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setOnly(next);
      return;
    }
    const pane = root.closest<HTMLElement>(".gw-pane");
    const phone = window.matchMedia("(max-width: 760px)").matches;
    const view = pane && !phone ? pane.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const ident = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
    const named: HTMLElement[] = [];
    const name = () => {
      root.querySelectorAll<HTMLElement>("[data-module-key], [data-category]").forEach((element) => {
        const box = element.getBoundingClientRect();
        if (box.bottom < view.top || box.top > view.bottom) return;
        element.style.viewTransitionName = element.dataset.moduleKey
          ? `gw-mod-${ident(element.dataset.moduleKey)}`
          : `gw-cat-${ident(element.dataset.category || "")}`;
        named.push(element);
      });
    };
    name();
    const doc = document.documentElement;
    doc.setAttribute("data-filtering", "true");
    const transition = document.startViewTransition(() => {
      flushSync(() => setOnly(next));
      name();
    });
    const done = () => {
      for (const element of named) element.style.viewTransitionName = "";
      doc.removeAttribute("data-filtering");
    };
    transition.finished.then(done, done);
  };

  const counts = React.useMemo(() => {
    const on = MODULE_TOGGLES.filter((module) => isEnabled(module.key)).length;
    return { all: MODULE_TOGGLES.length, on, off: MODULE_TOGGLES.length - on };
  }, [isEnabled]);

  const categories = CATEGORY_ORDER.map((category) => ({
    category,
    modules: MODULE_TOGGLES.filter(
      (module) =>
        module.category === category &&
        (only === "all" ||
          (only === "on" ? isEnabled(module.key) : !isEnabled(module.key))),
    ),
  })).filter((group) => group.modules.length > 0);

  return (
    <div ref={wall} className={variant === "overview" ? "overview-feature-groups" : "space-y-6"}>
      {variant === "overview" ? (
        <div className="gw-filter" role="group" aria-label="Show" ref={filterBox}>
          <JellyThumb />
          {(["all", "on", "off"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="gw-filter-seg"
              data-on={only === key ? "true" : undefined}
              aria-pressed={only === key}
              onClick={() => choose(key)}
            >
              {key === "all" ? "All" : key === "on" ? "Enabled" : "Off"}
              <span className="gw-filter-n">{counts[key]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {categories.map((group) => (
        <section
          key={group.category}
          className={variant === "overview" ? "overview-feature-group" : undefined}
          aria-labelledby={variant === "overview" ? `overview-category-${group.category}` : undefined}
        >
          {variant === "overview" ? (
            <div className="overview-category-heading" data-category={group.category}>
              <h3 id={`overview-category-${group.category}`}>{group.category}</h3>
              <span className="overview-category-rule" aria-hidden="true" />
            </div>
          ) : (
            <h4 className="manage-kicker">{group.category}</h4>
          )}
          <div
            className={
              variant === "overview"
                ? "gw-mods"
                : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            }
          >
            {group.modules.map((module) => (
              <ModuleCard
                key={module.key}
                module={module}
                enabled={isEnabled(module.key)}
                problems={module.sectionId ? findings[module.sectionId]?.gone ?? 0 : 0}
                setup={module.sectionId ? findings[module.sectionId]?.unset ?? 0 : 0}
                onToggle={(next) => toggle(module.key, next)}
                onConfigure={
                  module.sectionId ? () => onNavigate(module.sectionId!) : undefined
                }
                variant={variant}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Standalone modules route, kept for deep links; module toggles live on the
 * Overview.
 */
export function ModulesSection({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Features"
      />
      <ModuleToggleGrid onNavigate={onNavigate} />
    </div>
  );
}
