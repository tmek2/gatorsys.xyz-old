"use client";

import React, { useState } from "react";
import { IconFolderDown, IconFolderUp, IconSearch } from "@tabler/icons-react";
import { cleanEmbed } from "../embed-editor";
import { useManage } from "../manage-context";
import type { MessageEmbed } from "../types";
import { ContainerBlock } from "./model";

/* Saving a message as a template and loading one. */

/* ── Template library bar ──────────────────────────────────────────────── */

interface TemplateDoc {
  name: string;
  embed?: MessageEmbed;
  layout?: ContainerBlock[];
  color?: string;
  content?: string;
}

/**
 * Save and load bar for the shared template library, under every message
 * editor. Embed mode uses `embed` templates; container mode uses `container`
 * templates (layout and accent).
 */
export function TemplateBar({
  mode,
  embed,
  container,
  onLoadEmbed,
  onLoadContainer,
}: {
  mode: "embed" | "container";
  embed?: MessageEmbed;
  container?: { layout: ContainerBlock[]; color?: string; content?: string };
  onLoadEmbed?: (embed: MessageEmbed) => void;
  onLoadContainer?: (template: { layout: ContainerBlock[]; color?: string }) => void;
}) {
  const { guildId, setNotice } = useManage();
  const [templates, setTemplates] = useState<{
    embeds: TemplateDoc[];
    containers: TemplateDoc[];
  } | null>(null);
  const [name, setName] = useState("");

  async function loadTemplates() {
    if (templates !== null) return;
    try {
      const res = await fetch(`/api/manage/${guildId}/templates`);
      const json = res.ok ? await res.json() : {};
      setTemplates({ embeds: json.embeds || [], containers: json.containers || [] });
    } catch {
      setTemplates({ embeds: [], containers: [] });
    }
  }

  async function saveTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const payload =
        mode === "container"
          ? {
              action: "save",
              type: "container",
              name: trimmed,
              layout: container?.layout || [],
              color: container?.color || "none",
              content: container?.content || "",
            }
          : {
              action: "save",
              type: "embed",
              name: trimmed,
              embed: cleanEmbed(embed || {}) || {},
            };
      const res = await fetch(`/api/manage/${guildId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTemplates({
        embeds: json.embeds || [],
        containers: json.containers || [],
      });
      setName("");
      setNotice({ kind: "saved", text: `Template “${trimmed}” saved` });
    } catch {
      setNotice({ kind: "error", text: "Could not save template" });
    }
  }

  const list = mode === "container" ? templates?.containers : templates?.embeds;
  const [nameFocused, setNameFocused] = useState(false);
  const [loadQuery, setLoadQuery] = React.useState("");
  const loadMatches = (list || []).filter(
    (template) =>
      !loadQuery.trim() ||
      template.name.toLowerCase().includes(loadQuery.trim().toLowerCase()),
  );

  const suggestions = (list || []).filter(
    (template) =>
      !name.trim() ||
      template.name.toLowerCase().includes(name.trim().toLowerCase())
  );

  function loadTemplate(template: TemplateDoc) {
    setName(template.name);
    if (mode === "container") {
      onLoadContainer?.({
        layout: JSON.parse(JSON.stringify(template.layout || [])),
        color: template.color || "none",
      });
    } else {
      onLoadEmbed?.(JSON.parse(JSON.stringify(template.embed || {})));
    }
    setNotice({ kind: "saved", text: `Loaded template “${template.name}”` });
  }

  /* Name and save, or load. Both lists open upward: this sits at the foot of
     the scrolling preview column, which would cut off a list opening downward. */
  return (
    <div className="gw-md-tpl">
      <p className="gw-md-tpl-name">Templates</p>
      <div className="gw-md-tpl-row">
        <div className="gw-md-tpl-field-wrap">
          <input
            value={name}
            maxLength={64}
            placeholder={`Name this ${mode}`}
            aria-label="Template name"
            onChange={(event) => setName(event.target.value)}
            onFocus={() => {
              setNameFocused(true);
              loadTemplates();
            }}
            onBlur={() => window.setTimeout(() => setNameFocused(false), 150)}
            className="gw-md-tpl-field"
            data-bare
          />
          {/* Saved templates of this editor's type autocomplete the name;
              typing something new simply creates a new template. */}
          {nameFocused && suggestions.length > 0 ? (
            <div className="gw-md-tpl-pop gw-menu-panel">
              <div className="gw-menu-list">
                {suggestions.slice(0, 12).map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      loadTemplate(template);
                      setNameFocused(false);
                    }}
                    className="gw-menu-row"
                  >
                    <span className="gw-menu-label">{template.name}</span>
                    <span className="gw-menu-hint">Load</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={saveTemplate}
          title={`Save this ${mode} to your templates`}
          className="gw-md-tpl-btn"
        >
          <IconFolderUp size={15} />
          Save
        </button>
        <details onToggle={loadTemplates} className="gw-md-tpl-load">
          <summary className="gw-md-tpl-btn">
            <IconFolderDown size={15} />
            Load
          </summary>
          <div className="gw-md-tpl-pop gw-menu-panel" data-align="end">
            {/* Everything is listed on open and narrows as you type — the same
                contract as every other picker in the dashboard. */}
            <label className="gw-menu-find" data-edge="top">
              <IconSearch size={15} aria-hidden="true" />
              <input
                autoFocus
                value={loadQuery}
                placeholder={`Find ${mode === "embed" ? "an" : "a"} ${mode} template`}
                aria-label={`Find ${mode === "embed" ? "an" : "a"} ${mode} template`}
                onChange={(event) => setLoadQuery(event.target.value)}
                data-bare
              />
            </label>
            <div className="gw-menu-list">
              {templates === null ? (
                <p className="gw-menu-empty">Loading…</p>
              ) : !loadMatches.length ? (
                <p className="gw-menu-empty">
                  {list && list.length
                    ? "Nothing called that."
                    : `No saved ${mode} templates yet.`}
                </p>
              ) : (
                loadMatches.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => {
                      loadTemplate(template);
                    }}
                    className="gw-menu-row"
                  >
                    <span className="gw-menu-label">{template.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
