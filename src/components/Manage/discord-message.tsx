"use client";

import React from "react";
import { createPortal } from "react-dom";
import { IconLink, IconPhotoPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { DevelopingImage, usePresence } from "@/components/motion";
import { useBotIdentity } from "./bot-identity";
import { PreviewText, isImageToken, renderableImageUrl, trackFocus } from "./embed-editor";
import { InsertMenu } from "./insert-menu";
import { MarkdownToolbar } from "./markdown-toolbar";
import { useOptionalManage } from "./manage-context";
import { pictureFrom, uploadMessageImage } from "./message-media";
import "./discord-surface.css";

/* The parts every message editor and preview is built from, on the Discord
   surface (discord-surface.css). */

/** A message in a channel, signed by the bot as it appears in this server. */
export function DiscordFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const manage = useOptionalManage();
  const identity = useBotIdentity(manage?.guildId);
  return (
    <div className={`dc dc-chat ${className}`} data-discord-preview>
      <div className="dc-message">
        <div className="dc-gutter">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={identity.avatar}
            className="dc-avatar g-develop"
            src={identity.avatar}
            alt=""
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="dc-body">
          <div className="dc-meta">
            <span className="dc-username">{identity.name}</span>
            <span className="dc-app-badge">App</span>
            <span className="dc-time">Today at 4:20 PM</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * A run of text in a message, edited where it is read. At rest it is rendered
 * (markdown, mentions, sample values for variables); pressing it puts the caret
 * at the same place in the raw text, in a field that inherits the text's
 * styling and has no box. Empty, it shows a faint placeholder in its own size
 * and weight.
 */
export function InlineText({
  value,
  onChange,
  open,
  onOpen,
  onClose,
  placeholder,
  multiline = false,
  limit,
  className = "",
  focusOnOpen = true,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  placeholder: string;
  multiline?: boolean;
  limit?: number;
  className?: string;
  /** False for the second field of a part (a field's value under its name):
   *  the first takes the caret. */
  focusOnOpen?: boolean;
}) {
  const field = React.useRef<HTMLTextAreaElement>(null);
  const fit = React.useCallback(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${node.scrollHeight}px`;
  }, []);
  React.useLayoutEffect(() => {
    if (!open) return;
    fit();
    const node = field.current;
    if (focusOnOpen && node && document.activeElement !== node) {
      node.focus({ preventScroll: true });
      const end = node.value.length;
      node.setSelectionRange(end, end);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(fit, [value, fit]);

  /* One element, open or not, so the wash can animate between the two states. */
  const shut = open
    ? {}
    : {
        role: "button",
        tabIndex: 0,
        "aria-label": value ? undefined : placeholder,
        onClick: onOpen,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        },
      };
  return (
    <div
      className={`dc-inline ${className}`}
      data-open={open ? "true" : undefined}
      data-empty={!open && !value ? "true" : undefined}
      {...shut}
    >
      {open ? (
        <>
          <textarea
            ref={field}
            className="dc-inline-field"
            value={value}
            rows={1}
            maxLength={limit}
            placeholder={placeholder}
            aria-label={placeholder}
            // It is the text, not a field: no ring, no fill, no box.
            data-bare
            // Variables and emoji codes are not words; checking them only
            // underlines them in red.
            spellCheck={!/[{<]/.test(value)}
            onFocus={onOpen}
            onChange={(event) => {
              onChange(multiline ? event.target.value : event.target.value.replace(/\n/g, " "));
            }}
            onKeyDown={(event) => {
              // The `{` list is the editor's; while it is open it has taken Enter,
              // Tab and Escape before they get here.
              if (event.key === "Escape" || (event.key === "Enter" && !multiline)) {
                event.preventDefault();
                onClose();
              }
            }}
          />
          {limit && value.length > limit * 0.8 ? (
            <span className="dc-inline-count" data-tone={value.length >= limit ? "bad" : undefined}>
              {value.length}/{limit}
            </span>
          ) : null}
        </>
      ) : value ? (
        <PreviewText text={value} />
      ) : (
        <span className="dc-inline-empty">{placeholder}</span>
      )}
    </div>
  );
}

/**
 * A picture in a message: dropped, chosen or linked, and changed in place.
 * Empty, it is a slot that takes a dropped or chosen file, which is shrunk,
 * uploaded and its link written into the message. Filled, a strip over its
 * corner replaces, links or removes it. A picture Discord fills in at send time
 * (a member's avatar) is drawn as a plate with the variable's name.
 */
export function ImageSlot({
  value,
  onChange,
  onLink,
  label,
  size = "image",
  imgClassName = "",
  className = "",
}: {
  value?: string;
  onChange: (next: string | undefined) => void;
  /** Open the part's link field. */
  onLink: () => void;
  label: string;
  size?: "image" | "thumb";
  imgClassName?: string;
  className?: string;
}) {
  const manage = useOptionalManage();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const picker = React.useRef<HTMLInputElement>(null);

  const take = async (file: File | null) => {
    if (!file || !manage?.guildId) return;
    const local = URL.createObjectURL(file);
    setBusy(local);
    try {
      onChange(await uploadMessageImage(manage.guildId, file));
    } catch (error) {
      manage.setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "The picture could not be uploaded.",
      });
    } finally {
      URL.revokeObjectURL(local);
      setBusy(null);
    }
  };
  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      void take(pictureFrom(event.dataTransfer));
    },
  };
  const input = (
    <input
      ref={picker}
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      hidden
      onChange={(event) => {
        void take(event.target.files?.[0] ?? null);
        event.target.value = "";
      }}
    />
  );

  const shown = busy || value;
  if (!shown) {
    return (
      <>
        <button
          type="button"
          className={`dc-imgdrop ${className}`}
          data-size={size}
          data-over={over ? "true" : undefined}
          onClick={() => picker.current?.click()}
          {...dropProps}
        >
          {size === "thumb" ? null : <IconPhotoPlus size={16} aria-hidden="true" />}
          {over ? "Drop it here" : size === "thumb" ? label : `Add ${label.toLowerCase()}`}
        </button>
        {input}
      </>
    );
  }

  const token = !busy && isImageToken(value);
  const src = busy || renderableImageUrl(value) || undefined;
  return (
    <span
      className={`dc-imgslot ${className}`}
      data-busy={busy ? "true" : undefined}
      data-size={size}
      {...dropProps}
    >
      {token || !src ? (
        <span className={`dc-img-token ${imgClassName}`}>{value}</span>
      ) : (
        <DevelopingImage
          key={src}
          src={src}
          alt=""
          className={imgClassName}
          referrerPolicy="no-referrer"
          draggable={false}
        />
      )}
      <span className="dc-imgtools">
        <button type="button" aria-label={`Upload a new ${label.toLowerCase()}`} title="Upload" onClick={() => picker.current?.click()}>
          <IconUpload size={15} />
        </button>
        <button type="button" aria-label={`${label} link`} title="Link" onClick={onLink}>
          <IconLink size={15} />
        </button>
        <button type="button" data-tone="bad" aria-label={`Remove the ${label.toLowerCase()}`} title="Remove" onClick={() => onChange(undefined)}>
          <IconTrash size={15} />
        </button>
      </span>
      {input}
    </span>
  );
}

/**
 * A part's tools, rolled open under it and shut again. Kept mounted for the
 * roll so the space opens and closes on the sheet curve and the message moves
 * with it; not interactive while shutting.
 */
export function PartRoll({ open, children }: { open: boolean; children: React.ReactNode }) {
  const presence = usePresence(open, { duration: 300 });
  if (!presence.mounted) return null;
  return (
    <div className="gw-cv-roll" data-state={presence.state}>
      <div className="gw-cv-roll-clip" inert={!open}>
        {children}
      </div>
    </div>
  );
}

/** A part's dashboard controls, opened under it while it is being edited. */
export function PartTools({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`gw-cv-tools ${className}`} data-md-keep>
      {children}
    </div>
  );
}

/** A link or picture address, labelled above, in the dashboard's own field. */
export function LinkField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  picture = false,
}: {
  label: string;
  value?: string;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** A picture's address: pasting an image here -- a screenshot, a copied
   *  picture -- uploads it and fills the link in, rather than pasting nothing. */
  picture?: boolean;
}) {
  const id = React.useId();
  const manage = useOptionalManage();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="gw-cv-field">
      <label className="gw-cv-label" htmlFor={id}>
        {label}
        {picture ? <span className="gw-cv-label-note">or paste a picture</span> : null}
      </label>
      <input
        id={id}
        className="gw-field w-full"
        value={busy ? "" : value || ""}
        placeholder={busy ? "Uploading…" : placeholder ?? "https://… or a {variable}"}
        disabled={busy}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value.trim() ? event.target.value : undefined)}
        onPaste={(event) => {
          if (!picture || !manage?.guildId) return;
          const file = pictureFrom(event.clipboardData);
          if (!file) return;
          event.preventDefault();
          setBusy(true);
          uploadMessageImage(manage.guildId, file)
            .then((url) => onChange(url))
            .catch((error) =>
              manage.setNotice({
                kind: "error",
                text: error instanceof Error ? error.message : "The picture could not be uploaded.",
              }),
            )
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

/* ── the editor on a phone ──

   On a phone the message is a preview you tap, not a place you type: tiny
   inline fields under the keyboard were unusable, and iOS zooms into any field
   under 16px. A tap opens the part in a sheet: its text in a full-width 16px
   field, its other controls, and the formatting and insert buttons along the
   sheet's foot. The preview above updates as you type. */

export function usePhone(query = "(max-width: 640px)") {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return phone;
}

/** How much of the layout viewport the on-screen keyboard is covering. */
function useKeyboardCover(active: boolean) {
  const [cover, setCover] = React.useState(0);
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () =>
      setCover(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return cover;
}

/**
 * The sheet a part opens into on a phone. Portalled into the editor's own
 * element (not <body>), so the `{` list and insert menu, which listen inside
 * the editor, work in it.
 */
export function PartSheet({
  host,
  open,
  title,
  onClose,
  children,
}: {
  host: HTMLElement | null;
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const presence = usePresence(open, { duration: 260 });
  const sheet = React.useRef<HTMLDivElement | null>(null);
  const cover = useKeyboardCover(presence.mounted);
  // Kept for the exit: the title and the fields stay on the sheet as it goes.
  const [shownTitle, setShownTitle] = React.useState(title);
  React.useEffect(() => {
    if (open) setShownTitle(title);
  }, [open, title]);
  /* While a sheet is up, the save prompt and dock step aside (they sit outside
     the window's layer and would cover the sheet's buttons). */
  React.useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.setAttribute("data-psheet", "open");
    return () => root.removeAttribute("data-psheet");
  }, [open]);
  React.useEffect(() => {
    if (!presence.mounted) return;
    trackFocus(sheet.current);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presence.mounted, onClose]);
  if (!presence.mounted || !host) return null;
  return createPortal(
    <div
      className="gw-psheet-layer"
      data-state={presence.state}
      style={{ ["--kb" as string]: `${cover}px` }}
    >
      <button type="button" className="gw-psheet-scrim" aria-label="Done" tabIndex={-1} onClick={onClose} />
      <div className="gw-psheet" ref={sheet} role="dialog" aria-label={shownTitle} data-md-keep>
        <div className="gw-psheet-head">
          <span className="gw-psheet-grab" aria-hidden="true" />
          <p className="gw-psheet-title">{shownTitle}</p>
          <button type="button" className="gw-psheet-done" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="gw-psheet-body">{children}</div>
        <div className="gw-psheet-tools">
          <MarkdownToolbar containerRef={sheet} className="gw-psheet-format" />
          <span className="gw-psheet-insert">
            <InsertMenu containerRef={sheet} />
          </span>
        </div>
      </div>
    </div>,
    host,
  );
}

/** A part's words, in the sheet: the width of the screen, at sixteen pixels. */
export function SheetField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  limit,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  limit?: number;
  autoFocus?: boolean;
}) {
  const id = React.useId();
  const field = React.useRef<HTMLTextAreaElement>(null);
  const fit = React.useCallback(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, window.innerHeight * 0.34)}px`;
  }, []);
  React.useLayoutEffect(fit, [value, fit]);
  React.useEffect(() => {
    if (!autoFocus) return;
    const node = field.current;
    if (!node) return;
    // After the sheet has started up, so the keyboard and the sheet arrive
    // together rather than the keyboard shoving an unfinished sheet.
    const id = window.setTimeout(() => {
      node.focus({ preventScroll: true });
      const end = node.value.length;
      node.setSelectionRange(end, end);
    }, 120);
    return () => window.clearTimeout(id);
  }, [autoFocus]);
  return (
    <div className="gw-psheet-field">
      <label className="gw-cv-label" htmlFor={id}>
        {label}
        {limit && value.length > limit * 0.8 ? (
          <span className="gw-cv-label-note" data-tone={value.length >= limit ? "bad" : undefined}>
            {value.length}/{limit}
          </span>
        ) : null}
      </label>
      <textarea
        ref={field}
        id={id}
        className="gw-psheet-input"
        value={value}
        rows={1}
        maxLength={limit}
        placeholder={placeholder}
        spellCheck
        data-bare
        onChange={(event) => onChange(multiline ? event.target.value : event.target.value.replace(/\n/g, " "))}
      />
    </div>
  );
}
