"use client";

import React from "react";
import { IconBraces } from "@tabler/icons-react";
import { messageFromDiscord, messageToDiscord } from "./discord-json";
import type { CustomMessage, MessageEmbed } from "./types";

/**
 * Import and export a message as Discord's own JSON, for every message editor.
 * The translation is in discord-json.ts; this is the box.
 *
 * The text follows the message (after a discard, an added block, a loaded
 * template), except while it holds typed edits not yet applied; typing wins
 * over syncing. Otherwise the box would show, and Apply would write back, an
 * older message than the one on screen.
 */
export function DiscordJsonBox({
  value,
  onApply,
}: {
  value: CustomMessage & { embeds?: MessageEmbed[] };
  onApply: (next: CustomMessage & { embeds?: MessageEmbed[] }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [applied, setApplied] = React.useState(false);
  /** True once the box has been typed in and not yet applied or reverted. */
  const [edited, setEdited] = React.useState(false);

  const current = React.useMemo(
    () => JSON.stringify(messageToDiscord(value), null, 2),
    [value],
  );

  // Follows the message whenever the draft changes, unless there is unapplied
  // typing in the box.
  React.useEffect(() => {
    if (!open || edited) return;
    setText(current);
    setError("");
  }, [current, open, edited]);

  function apply() {
    try {
      const parsed = messageFromDiscord(JSON.parse(text));
      if (!parsed) throw new Error("empty");
      onApply(parsed);
      setError("");
      setEdited(false);
      setApplied(true);
      window.setTimeout(() => setApplied(false), 1600);
    } catch {
      setError(
        "Paste one Discord message JSON object with content, embeds, or both.",
      );
    }
  }

  return (
    <div className="gw-md-json" data-open={open ? "true" : undefined}>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setText(current);
            setEdited(false);
            setError("");
          }
        }}
        aria-expanded={open}
        className="gw-md-json-head"
      >
        <IconBraces size={15} aria-hidden="true" />
        <span>Message JSON</span>
        <span className="gw-md-json-say">Import from Discohook, or copy it out</span>
        {edited ? <span className="gw-md-json-tag">Not applied</span> : null}
      </button>
      {open ? (
        <div className="gw-md-json-body">
          <p className="gw-md-json-note">
            The same shape a webhook takes, so it pastes straight in from
            Discohook or out to anywhere else. Nothing changes until you press
            Apply.
          </p>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              // Stop following the message: this is now somebody's work in
              // progress, and a draft change must not overwrite it.
              setEdited(event.target.value !== current);
            }}
            rows={8}
            spellCheck={false}
            aria-label="Message JSON"
            className="gw-field w-full resize-y font-mono text-xs leading-relaxed"
          />
          {error ? <p className="gw-md-json-error">{error}</p> : null}
          <div className="gw-md-json-acts">
            {edited ? (
              <button
                type="button"
                onClick={() => {
                  setText(current);
                  setEdited(false);
                  setError("");
                }}
                className="gw-btn gw-md-json-revert"
                data-kind="ghost"
              >
                Revert to the message
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
              className="gw-btn"
              data-kind="ghost"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!edited}
              title={
                edited
                  ? undefined
                  : "This is already the message on screen. Edit the JSON to apply something different."
              }
              className="gw-btn"
              data-kind="accent"
            >
              {applied ? "Applied" : "Apply JSON"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
