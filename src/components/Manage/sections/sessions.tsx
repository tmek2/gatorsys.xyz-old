"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconKey, IconSend } from "@tabler/icons-react";
import {
  ChannelPicker,
  ColorPicker,
  FieldRow,
  NumberField,
  OptionCard,
  OptionCards,
  Reveal,
  RolePicker,
  SelectField,
  SettingsCard,
  TextAreaField,
  TextField,
  Toggle,
} from "../fields";
import { Segments } from "../segments";
import { DiscordPreview, trackFocus, VariableChips } from "../embed-editor";
import {
  ContainerBlocksEditor,
  ContainerPreview,
  LegacyButtonRowsEditor,
  TemplateBar,
  AccentSwatches,
  injectLegacyModuleButton,
  type ContainerBlock,
  type ContainerRowButton,
} from "../message-design";
import { DiscordJsonBox } from "../discord-json-box";
// The ER:LC connection panel, shared with the ER:LC tab.
import { ErlcStatus } from "../erlc-status";
import { applyMessageShape } from "../discord-json";
import { InsertMenu } from "../insert-menu";
import { useManage } from "../manage-context";
import { PluginToggleButton } from "../module-gate";
import { ConfigCard, FieldIcon, GroupHeader } from "../schema-section";
import { SectionHeader } from "../section-header";

/** Small tinted icon for the Sessions config cards. */
function SessionIcon({ kind }: { kind: "channel" | "role" | "text" }) {
  /* The bare glyph for the field type, as on the schema tabs. */
  return <FieldIcon type={kind === "text" ? "text" : kind} />;
}
import type { CustomMessage, MessageEmbed } from "../types";

const SESSION_VARIABLES = [
  "{server_name}",
  "{server_code}",
  "{server_owner}",
  "{quick_join_url}",
  "{ping.role}",
  "{votes}",
  "{votes_needed}",
  "{votes_remaining}",
  "{voters}",
  "{players}",
  "{max_players}",
  "{staff}",
  "{queue}",
  "{user_display}",
  "{user_avatar}",
  "{time.relative}",
];

const SESSION_MESSAGES: { key: string; tab: string; label: string; hint: string }[] = [
  { key: "panel", tab: "Panel", label: "Session panel", hint: "The live session panel with status and control buttons." },
  { key: "start", tab: "Startup", label: "Session start", hint: "Announces a session starting." },
  { key: "shutdown", tab: "Shutdown", label: "Session shutdown", hint: "Announces the server closing." },
  { key: "boost", tab: "Boost", label: "Session boost", hint: "Asks for more players." },
  { key: "poll", tab: "Vote", label: "Session poll", hint: "The vote message before a session." },
  { key: "join", tab: "Join", label: "Join message", hint: "Sent when quick-join is used." },
  { key: "full", tab: "Full", label: "Session full", hint: "Posted when the server fills up." },
];

/** One message at a time behind a pill switcher instead of a long scroll. */
function SessionMessagesTabs() {
  const [active, setActive] = useState(SESSION_MESSAGES[0].key);
  const current = SESSION_MESSAGES.find((message) => message.key === active) || SESSION_MESSAGES[0];
  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {SESSION_MESSAGES.map((message) => (
          <button
            key={message.key}
            type="button"
            onClick={() => setActive(message.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              active === message.key
                ? "bg-[#f5f2f2] text-[#111]"
                : "text-white/55 hover:text-white"
            }`}
          >
            {message.tab}
          </button>
        ))}
      </div>
      <SessionMessageCard
        key={current.key}
        messageKey={current.key}
        label={current.label}
        hint={current.hint}
      />
    </div>
  );
}

/** Sessions embeds store author/footer as plain strings — adapt for EmbedForm. */
function toFormEmbed(embed: Record<string, any> | undefined): MessageEmbed {
  const source = embed || {};
  return {
    title: source.title,
    description: source.description,
    color: typeof source.color === "string" ? source.color.replace(/^#/, "") : source.color,
    image: source.image,
    thumbnail: source.thumbnail,
    author: source.author ? { name: source.author, icon_url: source.author_icon } : undefined,
    footer: source.footer ? { text: source.footer } : undefined,
    fields: source.fields,
  };
}

function fromFormEmbed(embed: MessageEmbed): Record<string, any> {
  const output: Record<string, any> = {};
  if (embed.title?.trim()) output.title = embed.title;
  if (embed.description?.trim()) output.description = embed.description;
  if (typeof embed.color === "string" && embed.color.trim())
    output.color = `#${embed.color.replace(/^#/, "")}`;
  if (embed.image?.trim()) output.image = embed.image;
  if (embed.thumbnail?.trim()) output.thumbnail = embed.thumbnail;
  if (embed.author?.name?.trim()) {
    output.author = embed.author.name;
    if (embed.author.icon_url?.trim()) output.author_icon = embed.author.icon_url;
  }
  if (embed.footer?.text?.trim()) output.footer = embed.footer.text;
  if (embed.fields?.length) output.fields = embed.fields;
  return output;
}

function SessionMessageCard({ messageKey, label, hint }: { messageKey: string; label: string; hint: string }) {
  const { value, stage } = useManage();
  const path = `Sessions.messages.${messageKey}`;
  const current = value(path) || {};
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    trackFocus(containerRef.current);
  });

  const formEmbed = toFormEmbed(current.embed);
  const components: ContainerRowButton[] = Array.isArray(current.components)
    ? current.components
    : [];
  const mode: "embed" | "container" = current.render_mode === "v2" ? "container" : "embed";
  const rawBlocks: ContainerBlock[] = Array.isArray(current.v2_layout) ? current.v2_layout : [];
  const sessionSystemButtons = [{ label: "Session buttons" }];
  // Show placements made via /config (stored as v2_button_after) as a placeholder.
  const blocks = injectLegacyModuleButton(
    rawBlocks,
    sessionSystemButtons,
    current.v2_button_after,
    Boolean(current.v2_button_inline),
  );
  function writeSessionLayout(next: ContainerBlock[]) {
    // `v2_explicit_layout` on every write, so the layout says whether its
    // containers are its own.
    const changes: Record<string, any> = { v2_layout: next, v2_explicit_layout: true };
    const placeholder = next.find((block) => block.type === "system_button");
    if (placeholder) {
      changes.v2_button_after = undefined;
      changes.v2_button_inline = Boolean(placeholder.inline) || undefined;
    }
    patch(changes);
  }

  function patch(next: Record<string, any>) {
    stage(path, { ...current, ...next });
  }

  return (
    <SettingsCard
      title={label}
      description={hint}
      actions={
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {(["embed", "container"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => patch({ render_mode: option === "container" ? "v2" : "legacy" })}
              className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                mode === option
                  ? "bg-[rgb(var(--accent-rgb)/0.15)] text-[#f5f2f2]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" ref={containerRef}>
        {mode === "container" ? (
          <>
            <div className="space-y-4">
              <FieldRow label="Accent color">
                <AccentSwatches
                  value={current.v2_color || "none"}
                  onChange={(next) => patch({ v2_color: next || "none" })}
                />
              </FieldRow>
              <ContainerBlocksEditor
                blocks={blocks}
                explicitLayout={Boolean(current.v2_explicit_layout)}
                insertMenu={<InsertMenu containerRef={containerRef} />}
                onChange={writeSessionLayout}
                systemButtons={sessionSystemButtons}
              />
            </div>
            <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
              <ContainerPreview blocks={blocks} color={current.v2_color || "none"} content={current.content} systemButtons={sessionSystemButtons} explicitLayout={Boolean(current.v2_explicit_layout)} />
              <div>
                <div className="mb-2 flex items-center gap-2">
                <p className="cool-text text-[11px]">
                  Variables: click one to drop it into the field you were typing in.
                </p>
              </div>
                <VariableChips variables={SESSION_VARIABLES} containerRef={containerRef} />
              </div>
              <TemplateBar
                mode="container"
                container={{ layout: blocks, color: current.v2_color || "none", content: current.content }}
                onLoadContainer={(template) =>
                  patch({
                    v2_layout: template.layout,
                    v2_color: template.color || "none",
                    v2_explicit_layout: true,
                  })
                }
              />
              <SessionMessageJson current={current} stage={stage} path={path} />
            </div>
          </>
        ) : (
        <>
        <div className="space-y-4">
          <FieldRow label="Content" description="Plain text above the embed. Supports {ping.role}.">
            <TextAreaField
              rows={2}
              value={current.content || ""}
              trailing={<InsertMenu containerRef={containerRef} />}
              onChange={(next) => patch({ content: next })}
            />
          </FieldRow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldRow label="Title">
              <TextField
                value={formEmbed.title || ""}
                maxLength={256}
                onChange={(next) => patch({ embed: fromFormEmbed({ ...formEmbed, title: next }) })}
              />
            </FieldRow>
            <FieldRow label="Color">
              <ColorPicker
                value={`#${String(formEmbed.color || "2b2d31").replace(/^#/, "")}`}
                label="Choose session embed color"
                onChange={(next) =>
                  patch({ embed: fromFormEmbed({ ...formEmbed, color: next.slice(1) }) })
                }
              />
            </FieldRow>
          </div>
          <FieldRow label="Description">
            <TextAreaField
              rows={5}
              value={formEmbed.description || ""}
              trailing={<InsertMenu containerRef={containerRef} />}
              onChange={(next) => patch({ embed: fromFormEmbed({ ...formEmbed, description: next }) })}
            />
          </FieldRow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldRow label="Image URL">
              <TextField
                value={formEmbed.image || ""}
                placeholder="https://…"
                onChange={(next) => patch({ embed: fromFormEmbed({ ...formEmbed, image: next }) })}
              />
            </FieldRow>
            <FieldRow label="Author" description="e.g. @{user_display}">
              <TextField
                value={formEmbed.author?.name || ""}
                onChange={(next) =>
                  patch({
                    embed: fromFormEmbed({
                      ...formEmbed,
                      author: { name: next, icon_url: formEmbed.author?.icon_url },
                    }),
                  })
                }
              />
            </FieldRow>
          </div>
          <FieldRow
            label="Button rows"
            description="Saved Discord row positions and button actions are loaded exactly as configured."
          >
            <LegacyButtonRowsEditor
              components={components}
              onChange={(nextComponents) =>
                patch({ components: nextComponents })
              }
            />
          </FieldRow>
        </div>
        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <DiscordPreview
            message={{ content: current.content, embed: formEmbed }}
            buttons={components}
          />
          <div>
            <div className="mb-2 flex items-center gap-2">
                <p className="cool-text text-[11px]">
                  Variables: click one to drop it into the field you were typing in.
                </p>
              </div>
            <VariableChips variables={SESSION_VARIABLES} containerRef={containerRef} />
          </div>
          <TemplateBar
            mode="embed"
            embed={formEmbed}
            onLoadEmbed={(embed) => patch({ embed: fromFormEmbed(embed) })}
          />
          <SessionMessageJson current={current} stage={stage} path={path} />
        </div>
        </>
        )}
      </div>
    </SettingsCard>
  );
}

/**
 * Import and export this session message as Discord's JSON, like every message
 * editor. `applyMessageShape` replaces the message keys (a pasted embed clears
 * an existing container layout) and leaves the session's other fields alone. A
 * session stores its embed flat (`author` and `footer` as strings, a separate
 * `author_icon`, a `#`-prefixed colour), so `toFormEmbed` and `fromFormEmbed`
 * translate on both edges, as the form does.
 */
function SessionMessageJson({
  current,
  stage,
  path,
}: {
  current: Record<string, any>;
  stage: (path: string, value: any) => void;
  path: string;
}) {
  const asMessage = {
    ...current,
    embed: current.embed ? toFormEmbed(current.embed) : undefined,
  } as CustomMessage;
  return (
    <DiscordJsonBox
      value={asMessage}
      onApply={(next) => {
        const message: Record<string, any> = { ...next };
        // A session renders one embed, so a paste carrying several keeps the
        // first rather than storing a list nothing reads.
        delete message.embeds;
        if (next.embed) message.embed = fromFormEmbed(next.embed);
        stage(path, applyMessageShape(current, message));
      }}
    />
  );
}

export function SessionsSection({ onNavigate }: { onNavigate?: (next: string) => void }) {
  const { guildId, meta, value, stage, commit, setNotice } = useManage();
  const enabled = Boolean(value("Modules.Sessions"));
  const hasPrcKey = Boolean(value("Integrations.PRC.has_key")) || Boolean(value("Integrations.PRC.key"));
  const [tab, setTab] = useState<"settings" | "messages">("settings");
  const [panelChannel, setPanelChannel] = useState<string | null>(null);
  const [sendingPanel, setSendingPanel] = useState(false);

  const s = (path: string) => value(`Sessions.${path}`);

  async function sendPanel() {
    if (!panelChannel) return;
    setSendingPanel(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/sessionpanel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: panelChannel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || "Could not send the panel");
      }
      setNotice({ kind: "saved", text: "Sessions panel sent" });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not send the panel",
      });
    } finally {
      setSendingPanel(false);
    }
  }

  if (!hasPrcKey) {
    return (
      <div className="relative min-h-[400px]">
        <div className="pointer-events-none select-none opacity-30 blur-[1px]">
          <SectionHeader title="Sessions" />
        </div>
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-14">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101010] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#f5f2f2]">
              <IconKey size={18} className="text-[var(--accent-peach)]" />
              ER:LC key required
            </h3>
            <p className="cool-text mt-2 text-sm leading-relaxed">
              Sessions run on live ER:LC data, so you need to connect your PRC
              server key before Sessions can be enabled.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.("overview")}
                className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-white/70 hover:text-white"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.("prc")}
                className="btn-pop btn-peach h-9 px-4 text-sm"
              >
                Connect PRC key
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="relative min-h-[400px]">
        <div className="pointer-events-none select-none opacity-30 blur-[1px]">
          <SectionHeader title="Sessions" />
        </div>
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-14">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101010] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <h3 className="text-lg font-extrabold text-[#f5f2f2]">Enable Sessions?</h3>
            <p className="cool-text mt-2 text-sm leading-relaxed">
              Sessions is currently disabled. Enable it to access and configure
              these settings.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.("modules")}
                className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-white/70 hover:text-white"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  void commit({ "Modules.Sessions": true }, "Modules");
                }}
                className="btn-pop btn-peach h-9 px-4 text-sm"
              >
                Enable Sessions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Sessions"
        actions={<PluginToggleButton moduleKey="Sessions" moduleLabel="Sessions" />}
      />

      {/* The page's two views, in the same control every page uses. */}
      <Segments<"settings" | "messages">
        className="gw-page-views"
        label="Sessions"
        value={tab}
        onChange={setTab}
        options={[
          { value: "settings", label: "Settings" },
          { value: "messages", label: "Messages" },
        ]}
      />

      {tab === "settings" ? (
        <>
          <ErlcStatus />
          <SettingsCard
            title="Session panel"
            description="Post the live session panel to a channel. Re-sending moves it and keeps it updating in the new spot."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <ChannelPicker
                  channels={meta?.channels || []}
                  value={panelChannel}
                  placeholder="Pick a channel for the panel"
                  onChange={(next) => setPanelChannel((next as string) || null)}
                />
              </div>
              <button
                type="button"
                disabled={!panelChannel || sendingPanel}
                onClick={sendPanel}
                className="btn-pop btn-peach inline-flex h-10 shrink-0 items-center gap-2 px-4 text-sm disabled:opacity-50"
              >
                <IconSend size={15} />
                {sendingPanel ? "Sending…" : "Send panel"}
              </button>
            </div>
          </SettingsCard>

          <section>
            <GroupHeader title="Delivery" description="Where sessions post and who runs them." />
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <ConfigCard icon={<SessionIcon kind="channel" />} title="Sessions channel" description="Where session messages are posted.">
                <ChannelPicker
                  channels={meta?.channels || []}
                  value={s("channel_id") ? String(s("channel_id")) : null}
                  onChange={(next) => stage("Sessions.channel_id", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="channel" />} title="Log channel" description="Session actions are logged here.">
                <ChannelPicker
                  channels={meta?.channels || []}
                  value={s("logs.channel_id") ? String(s("logs.channel_id")) : null}
                  onChange={(next) => stage("Sessions.logs.channel_id", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="role" />} title="Ping role" description="Pinged on session messages via {ping.role}.">
                <RolePicker
                  roles={meta?.roles || []}
                  value={s("ping_role_id") ? String(s("ping_role_id")) : null}
                  onChange={(next) => stage("Sessions.ping_role_id", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="role" />} title="Toggle role" description="Members can self-toggle this role for pings.">
                <RolePicker
                  roles={meta?.roles || []}
                  value={s("toggle_role_id") ? String(s("toggle_role_id")) : null}
                  onChange={(next) => stage("Sessions.toggle_role_id", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="role" />} title="Required role" description="Needed to vote and join sessions.">
                <RolePicker
                  roles={meta?.roles || []}
                  value={s("required_role_id") ? String(s("required_role_id")) : null}
                  onChange={(next) => stage("Sessions.required_role_id", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="role" />} title="Management roles" description="Can start, boost, and shut down sessions.">
                <RolePicker
                  roles={meta?.roles || []}
                  multi
                  value={Array.isArray(s("management_role_ids")) ? s("management_role_ids").map(String) : []}
                  onChange={(next) => stage("Sessions.management_role_ids", next)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="text" />} title="Server owner username" description="Shown on session panels as the host.">
                <TextField
                  value={s("owner_username") ? String(s("owner_username")) : ""}
                  onChange={(next) => stage("Sessions.owner_username", next || null)}
                />
              </ConfigCard>
              <ConfigCard icon={<SessionIcon kind="text" />} title="Quick join URL" description="The ER:LC join link used by the Quick join button.">
                <TextField
                  value={s("quick_join_url") ? String(s("quick_join_url")) : ""}
                  placeholder="https://policeroleplay.community/join/…"
                  onChange={(next) => stage("Sessions.quick_join_url", next || null)}
                />
              </ConfigCard>
            </div>
          </section>

          <SettingsCard title="Poll" description="How session votes work.">
            <div className="grid grid-cols-1 gap-4">
              <FieldRow label="Vote goal mode">
                <SelectField
                  value={s("poll.mode") || "ask"}
                  options={[
                    { value: "ask", label: "Ask each time" },
                    { value: "fixed", label: "Fixed goal" },
                  ]}
                  onChange={(next) => stage("Sessions.poll.mode", next || "ask", "ask")}
                />
              </FieldRow>
              {/* Only a fixed goal has a number. */}
              <Reveal when={(s("poll.mode") || "ask") === "fixed"}>
                <FieldRow label="Fixed votes needed">
                  <NumberField
                    value={s("poll.fixed_votes_needed") != null ? Number(s("poll.fixed_votes_needed")) : ""}
                    min={1}
                    onChange={(next) => stage("Sessions.poll.fixed_votes_needed", next === "" ? null : next)}
                  />
                </FieldRow>
              </Reveal>
              {/* The two switches side by side as option cards. */}
              <OptionCards>
                <OptionCard
                  label="Auto start on goal"
                  description="Start the session the moment the vote reaches its goal."
                  checked={Boolean(s("poll.auto_start"))}
                  onChange={(next) => stage("Sessions.poll.auto_start", next)}
                />
                <OptionCard
                  label="Goal alert"
                  description="Ping a role in a channel when the goal is reached."
                  checked={Boolean(s("poll.goal_alert.enabled"))}
                  onChange={(next) => stage("Sessions.poll.goal_alert.enabled", next)}
                />
              </OptionCards>
              <Reveal when={Boolean(s("poll.goal_alert.enabled"))}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldRow label="Alert channel">
                    <ChannelPicker
                      channels={meta?.channels || []}
                      value={s("poll.goal_alert.channel_id") ? String(s("poll.goal_alert.channel_id")) : null}
                      onChange={(next) => stage("Sessions.poll.goal_alert.channel_id", next)}
                    />
                  </FieldRow>
                  <FieldRow label="Alert role">
                    <RolePicker
                      roles={meta?.roles || []}
                      value={s("poll.goal_alert.role_id") ? String(s("poll.goal_alert.role_id")) : null}
                      onChange={(next) => stage("Sessions.poll.goal_alert.role_id", next)}
                    />
                  </FieldRow>
                </div>
              </Reveal>
            </div>
          </SettingsCard>

          <SettingsCard title="In-game messages" description="Automatic ER:LC chat messages.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <FieldRow label="Player join message" inline>
                  <Toggle
                    checked={Boolean(s("game_messages.join.enabled"))}
                    onChange={(next) => stage("Sessions.game_messages.join.enabled", next)}
                  />
                </FieldRow>
                <Reveal when={Boolean(s("game_messages.join.enabled"))}>
                  <TextField
                    value={s("game_messages.join.message") ? String(s("game_messages.join.message")) : ""}
                    placeholder="Welcome to the server."
                    onChange={(next) => stage("Sessions.game_messages.join.message", next)}
                  />
                </Reveal>
              </div>
              <div className="space-y-3">
                <FieldRow label="Shutdown message" inline>
                  <Toggle
                    checked={Boolean(s("game_messages.shutdown.enabled"))}
                    onChange={(next) => stage("Sessions.game_messages.shutdown.enabled", next)}
                  />
                </FieldRow>
                <Reveal when={Boolean(s("game_messages.shutdown.enabled"))}>
                  <div className="space-y-3">
                    <TextField
                      value={s("game_messages.shutdown.message") ? String(s("game_messages.shutdown.message")) : ""}
                      placeholder="The server is shutting down."
                      onChange={(next) => stage("Sessions.game_messages.shutdown.message", next)}
                    />
                    <OptionCard
                      label="Kick everyone afterwards"
                      checked={Boolean(s("game_messages.shutdown.kick_all"))}
                      onChange={(next) => stage("Sessions.game_messages.shutdown.kick_all", next)}
                    />
                    <Reveal when={Boolean(s("game_messages.shutdown.kick_all"))}>
                      <FieldRow label="After" description="Seconds after the message." inline>
                        <NumberField
                          compact
                          value={s("game_messages.shutdown.kick_delay_seconds") != null ? Number(s("game_messages.shutdown.kick_delay_seconds")) : ""}
                          min={0}
                          onChange={(next) => stage("Sessions.game_messages.shutdown.kick_delay_seconds", next === "" ? null : next)}
                        />
                      </FieldRow>
                    </Reveal>
                  </div>
                </Reveal>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Button labels" description="Text on the session panel buttons. {current}/{needed} work on the vote button.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["vote_label", "Vote button"],
                ["view_voters_label", "View voters"],
                ["role_label", "Session role"],
                ["status_online_label", "Status: online"],
                ["status_offline_label", "Status: offline"],
                ["status_full_label", "Status: full"],
                ["status_unknown_label", "Status: unknown"],
              ].map(([key, label]) => (
                <FieldRow key={key} label={label}>
                  <TextField
                    value={s(`buttons.${key}`) ? String(s(`buttons.${key}`)) : ""}
                    maxLength={80}
                    onChange={(next) => stage(`Sessions.buttons.${key}`, next || null)}
                  />
                </FieldRow>
              ))}
            </div>
          </SettingsCard>
        </>
      ) : (
        <SessionMessagesTabs />
      )}
    </div>
  );
}
