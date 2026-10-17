"use client";

import React, { useEffect, useRef, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { EDITOR_FONTS } from "@/utils/editor-fonts";
import CharacterCount from "@tiptap/extension-character-count";
import {
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconClearFormatting,
  IconMinus,
  IconPlus,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconBook2,
  IconBulb,
  IconCheck,
  IconChevronDown,
  IconCloudCheck,
  IconCloudUp,
  IconCode,
  IconCopy,
  IconDownload,
  IconFile,
  IconPencil,
  IconFilePlus,
  IconHelp,
  IconHighlight,
  IconHistory,
  IconItalic,
  IconLetterA,
  IconLink,
  IconList,
  IconListNumbers,
  IconLoader2,
  IconPhoto,
  IconPrinter,
  IconQuote,
  IconSearch,
  IconShare,
  IconStrikethrough,
  IconTable,
  IconTrash,
  IconUnderline,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { VersionHistory } from "@/components/Manage/version-history";
import { FieldRow, TextField } from "./fields";
import { ShareAccessPanel } from "./share-access-panel";

type SubDocument = { id: string; title: string; html: string };

const menuButton =
  "rounded-xl px-3 py-2 text-xs font-semibold text-white/65 hover:bg-white/[0.06] hover:text-white";
const toolButton =
  "flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white";
const toolButtonActive =
  "flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-peach)_16%,transparent)] text-[var(--accent-peach)]";

const TEXT_COLORS = [
  "#f5f2f2",
  "#9aa0ac",
  "#f7a8c4",
  "#f87171",
  "#fbbf24",
  "#4ade80",
  "#60a5fa",
  "#c084fc",
];
const HIGHLIGHT_COLORS = [
  "#7c5a55",
  "#7a4a4a",
  "#7a6a3a",
  "#3f6a4a",
  "#3a567a",
  "#5d477a",
];

/** The document body's base size — the "+ / −" size stepper counts from here. */
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;

/**
 * A minimal font-size mark: StarterKit has none, so a `fontSize` attribute is
 * added to the existing `textStyle` mark (the span Color and FontFamily already
 * use).
 */
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, any>) =>
              attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

/**
 * Word-style document editor on Tiptap (ProseMirror, the engine umodoc/editor
 * uses): marks toggle reliably, formatting does not leak into the next line,
 * and every toolbar option maps to a real schema command (not the deprecated
 * execCommand).
 */
export function DepartmentDocumentEditor({
  resource,
  shareUrl,
  guildId,
  onChange,
  onSave,
  onClose,
  onDelete,
  onPresence,
}: {
  resource: any;
  /** Canonical URL of this document (share link). */
  shareUrl?: string;
  /** Guild id — powers the share access role picker. */
  guildId?: string;
  onChange: (next: any) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onPresence?: (typing: boolean) => Promise<any[]>;
}) {
  const documentLink = shareUrl || (typeof window === "undefined" ? "" : window.location.href);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string>(resource.active_document_id || "root");
  const [menu, setMenu] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // The outline starts open on desktop but collapsed on phones, where it would
  // otherwise cover the whole editor.
  const [outline, setOutline] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">(
    "saved",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const presenceRef = useRef(onPresence);
  presenceRef.current = onPresence;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flashToast(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [link, setLink] = useState("");
  const subdocuments: SubDocument[] = Array.isArray(resource.subdocuments)
    ? resource.subdocuments
    : [];
  const active = activeId === "root"
    ? { id: "root", title: resource.title, html: resource.document_html || "" }
    : subdocuments.find((item) => item.id === activeId) || {
        id: "root",
        title: resource.title,
        html: resource.document_html || "",
      };

  const resourceRef = useRef(resource);
  resourceRef.current = resource;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  function patchDocument(patch: Partial<SubDocument>) {
    const currentId = activeIdRef.current;
    const current = resourceRef.current;
    if (currentId === "root") {
      onChange({
        ...current,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.html !== undefined ? { document_html: patch.html } : {}),
        active_document_id: "root",
      });
      return;
    }
    onChange({
      ...current,
      active_document_id: currentId,
      subdocuments: (Array.isArray(current.subdocuments) ? current.subdocuments : []).map(
        (item: SubDocument) =>
          item.id === currentId ? { ...item, ...patch } : item,
      ),
    });
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      CharacterCount,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "Start writing. Select text to format it",
      }),
    ],
    content: active.html || "",
    editorProps: {
      attributes: {
        class:
          "gator-doc mx-auto w-full max-w-[816px] rounded-md border border-white/[0.08] bg-[#1c1c1c] px-16 py-14 max-md:px-6 max-md:py-8 text-[15px] leading-[1.75] text-white/80 shadow-[0_26px_80px_rgba(0,0,0,.38)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] selection:bg-[rgb(var(--accent-rgb)/.28)]",
      },
    },
    onUpdate: ({ editor: instance }) => {
      typingRef.current = true;
      if (presenceRef.current)
        void presenceRef.current(true).then(setCollaborators).catch(() => undefined);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        typingRef.current = false;
        if (presenceRef.current)
          void presenceRef.current(false).then(setCollaborators).catch(() => undefined);
      }, 900);
      patchDocument({ html: instance.getHTML() });
    },
  });
  // Toolbar active states re-render on every selection change.
  const [, setSelectionTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setSelectionTick((tick) => tick + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);


  useEffect(() => {
    if (!presenceRef.current) return;
    let mounted = true;
    const update = async () => {
      try {
        const people = await presenceRef.current?.(typingRef.current);
        if (mounted) setCollaborators(people || []);
      } catch {
        /* presence must never interrupt editing */
      }
    };
    void update();
    const interval = window.setInterval(() => void update(), 1500);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [resource.id]);

  // Load the newly selected page into the editor (never during typing —
  // only when the page identity changes).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() !== (active.html || "")) {
      editor.commands.setContent(active.html || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, editor]);

  // ── Autosave ──────────────────────────────────────────────────────────
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const lastSavedRef = useRef(JSON.stringify(resource));

  async function saveNow() {
    const snapshot = JSON.stringify(resourceRef.current);
    if (snapshot === lastSavedRef.current) return;
    setSaveState("saving");
    try {
      await onSaveRef.current();
      lastSavedRef.current = snapshot;
      setSaveState(
        JSON.stringify(resourceRef.current) === snapshot ? "saved" : "dirty",
      );
    } catch {
      setSaveState("dirty");
    }
  }

  useEffect(() => {
    if (JSON.stringify(resource) === lastSavedRef.current) return;
    setSaveState((state) => (state === "saving" ? state : "dirty"));
    const timer = setTimeout(() => void saveNow(), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  // Safety net: some edits (table cells, colour marks) can land without
  // triggering the debounced save above. A light periodic flush saves anything
  // outstanding (a no-op when the snapshot already matches).
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (JSON.stringify(resourceRef.current) !== lastSavedRef.current) {
        void saveNow();
      }
    }, 4000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush unsaved work when the tab is hidden or the page is left.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClose() {
    if (JSON.stringify(resourceRef.current) !== lastSavedRef.current)
      await saveNow();
    onClose();
  }

  function chain() {
    return editor?.chain().focus();
  }

  function download(filename: string, type: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addSubdocument() {
    const item = { id: crypto.randomUUID(), title: "Untitled Sub Document", html: "" };
    onChange({ ...resource, subdocuments: [...subdocuments, item], active_document_id: item.id });
    setActiveId(item.id);
    setMenu(null);
  }

  // Inline rename on the sidebar tab itself (via right-click → Rename).
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function renameDocument(id: string, title: string) {
    const clean = title.trim() || "Untitled";
    if (id === "root") {
      onChange({ ...resource, title: clean });
      return;
    }
    onChange({
      ...resource,
      subdocuments: subdocuments.map((item) =>
        item.id === id ? { ...item, title: clean } : item,
      ),
    });
  }

  function duplicateSubdocument(source: SubDocument) {
    const item = {
      id: crypto.randomUUID(),
      title: `${source.title} (copy)`,
      html: source.html,
    };
    onChange({
      ...resource,
      subdocuments: [...subdocuments, item],
      active_document_id: item.id,
    });
    setActiveId(item.id);
  }

  function deleteSubdocument(id: string) {
    onChange({
      ...resource,
      subdocuments: subdocuments.filter((item) => item.id !== id),
      active_document_id: activeId === id ? "root" : activeId,
    });
    if (activeId === id) setActiveId("root");
  }

  // ── Custom context menus (Word/Google Docs-style, not the browser menu) ─
  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    items: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean; separator?: boolean }[];
  }>(null);
  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [contextMenu]);

  async function pasteFromClipboard(asPlainText: boolean) {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (asPlainText) {
        chain()?.insertContent(text).run();
      } else {
        chain()
          ?.insertContent(
            text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
          )
          .run();
      }
    } catch {
      flashToast("Press Ctrl+V to paste. The browser blocked pasting from the menu.");
    }
  }

  async function copySelection(cut: boolean) {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const text = editor.state.doc.textBetween(from, to, "\n");
    try {
      await navigator.clipboard.writeText(text);
      if (cut) chain()?.deleteSelection().run();
    } catch {
      flashToast(`Press Ctrl+${cut ? "X" : "C"}. The browser blocked ${cut ? "cutting" : "copying"} from the menu.`);
    }
  }

  function insertTable() {
    chain()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  function insertHint() {
    chain()
      ?.insertContent(
        '<blockquote data-hint="true"><p><strong>Hint</strong></p><p>Write helpful information here.</p></blockquote><p></p>',
      )
      .run();
  }

  function openPageContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    setContextMenu({
      ...point,
      items: [
        { label: "Cut", icon: <IconX size={15} />, action: () => void copySelection(true) },
        { label: "Copy", icon: <IconCopy size={15} />, action: () => void copySelection(false) },
        { label: "Paste", icon: <IconDownload size={15} />, action: () => void pasteFromClipboard(false) },
        { label: "Paste as plain text", icon: <IconDownload size={15} />, action: () => void pasteFromClipboard(true) },
        { label: "Select all", icon: <IconCheck size={15} />, action: () => chain()?.selectAll().run(), separator: true },
        { label: "Insert image", icon: <IconPhoto size={15} />, action: () => imageRef.current?.click() },
        { label: "Insert link", icon: <IconLink size={15} />, action: () => setLinkOpen(true) },
        { label: "Insert table", icon: <IconTable size={15} />, action: insertTable },
        { label: "Insert divider", icon: <IconList size={15} />, action: () => chain()?.setHorizontalRule().run() },
        { label: "Clear formatting", icon: <IconX size={15} />, action: () => chain()?.unsetAllMarks().clearNodes().run(), separator: true },
      ],
    });
  }

  function openSubdocumentContextMenu(
    event: React.MouseEvent,
    item: { id: string; title: string },
  ) {
    event.preventDefault();
    const point = clampMenuPoint(event.clientX, event.clientY);
    const sub = subdocuments.find((entry) => entry.id === item.id) || null;
    setContextMenu({
      ...point,
      items: [
        {
          label: "Open",
          icon: <IconBook2 size={15} />,
          action: () => {
            setActiveId(item.id);
            onChange({ ...resource, active_document_id: item.id });
          },
        },
        {
          label: "Rename",
          icon: <IconFile size={15} />,
          action: () => setRenamingId(item.id),
        },
        ...(sub
          ? [
              {
                label: "Duplicate",
                icon: <IconCopy size={15} />,
                action: () => duplicateSubdocument(sub),
              },
              {
                label: "Delete",
                icon: <IconTrash size={15} />,
                danger: true,
                action: () => deleteSubdocument(item.id),
              },
            ]
          : []),
      ],
    });
  }

  const menus: Record<string, { label: string; icon: React.ReactNode; action: () => void; danger?: boolean }[]> = {
    File: [
      { label: "New", icon: <IconFilePlus size={15} />, action: () => { chain()?.clearContent().run(); setMenu(null); } },
      { label: "Make a copy", icon: <IconCopy size={15} />, action: addSubdocument },
      { label: "Print", icon: <IconPrinter size={15} />, action: () => { window.print(); setMenu(null); } },
      { label: "Download as plain text", icon: <IconDownload size={15} />, action: () => { download(`${active.title}.txt`, "text/plain", editor?.getText() || ""); setMenu(null); } },
      { label: "Download as HTML", icon: <IconDownload size={15} />, action: () => { download(`${active.title}.html`, "text/html", editor?.getHTML() || active.html); setMenu(null); } },
      { label: "Share", icon: <IconUsers size={15} />, action: () => { setShareOpen(true); setMenu(null); } },
      { label: "Copy doc link", icon: <IconLink size={15} />, action: () => { void navigator.clipboard.writeText(documentLink); setMenu(null); flashToast("Document link copied to clipboard"); } },
      { label: "New Sub Document", icon: <IconFilePlus size={15} />, action: addSubdocument },
      { label: "Rename", icon: <IconFile size={15} />, action: () => { titleRef.current?.focus(); titleRef.current?.select(); setMenu(null); } },
      { label: "Version history", icon: <IconHistory size={15} />, action: () => { setInfo("Version history begins after the first save. Every saved revision is kept with its editor and time."); setMenu(null); } },
      { label: "Access logs", icon: <IconList size={15} />, action: () => { setInfo("No document access has been recorded in this editing session."); setMenu(null); } },
      { label: "Delete document", icon: <IconTrash size={15} />, danger: true, action: () => { setConfirmDeleteDoc(true); setMenu(null); } },
    ],
    Edit: [
      { label: "Undo", icon: <IconArrowBackUp size={15} />, action: () => chain()?.undo().run() },
      { label: "Redo", icon: <IconArrowForwardUp size={15} />, action: () => chain()?.redo().run() },
      { label: "Select all", icon: <IconCheck size={15} />, action: () => chain()?.selectAll().run() },
      { label: "Clear formatting", icon: <IconX size={15} />, action: () => chain()?.unsetAllMarks().clearNodes().run() },
      { label: "Find and replace", icon: <IconSearch size={15} />, action: () => { setFindOpen(true); setMenu(null); } },
      { label: "Word count", icon: <IconListNumbers size={15} />, action: () => { const count = (editor?.storage as any)?.characterCount?.words?.() ?? (editor?.getText() || "").trim().split(/\s+/).filter(Boolean).length; setInfo(`${count} words in ${active.title}.`); setMenu(null); } },
      { label: outline ? "Hide outline" : "Show outline", icon: <IconList size={15} />, action: () => { setOutline(!outline); setMenu(null); } },
      { label: resource.disable_copying ? "Allow copying for viewers" : "Disable copying for viewers", icon: <IconCopy size={15} />, action: () => { onChange({ ...resource, disable_copying: !resource.disable_copying }); setMenu(null); } },
    ],
    Insert: [
      { label: "Insert Image", icon: <IconPhoto size={15} />, action: () => { imageRef.current?.click(); setMenu(null); } },
      { label: "Table", icon: <IconTable size={15} />, action: () => { insertTable(); setMenu(null); } },
      { label: "Insert Link", icon: <IconLink size={15} />, action: () => { setLinkOpen(true); setMenu(null); } },
      { label: "Insert Divider", icon: <IconList size={15} />, action: () => { chain()?.setHorizontalRule().run(); setMenu(null); } },
      { label: "Insert Hint", icon: <IconBulb size={15} />, action: () => { insertHint(); setMenu(null); } },
    ],
    Help: [
      { label: "Documentation", icon: <IconBook2 size={15} />, action: () => window.open("https://docs.gatorsys.xyz", "_blank") },
      { label: "Give Feedback", icon: <IconHelp size={15} />, action: () => window.open("/support", "_blank") },
    ],
  };

  type ToolMark = {
    key: string;
    icon: React.ReactNode;
    isActive: (instance: Editor) => boolean;
    run: () => void;
  };
  const textMarks: ToolMark[] = [
    { key: "bold", icon: <IconBold size={17} />, isActive: (i) => i.isActive("bold"), run: () => chain()?.toggleBold().run() },
    { key: "italic", icon: <IconItalic size={17} />, isActive: (i) => i.isActive("italic"), run: () => chain()?.toggleItalic().run() },
    { key: "underline", icon: <IconUnderline size={17} />, isActive: (i) => i.isActive("underline"), run: () => chain()?.toggleUnderline().run() },
    { key: "strike", icon: <IconStrikethrough size={17} />, isActive: (i) => i.isActive("strike"), run: () => chain()?.toggleStrike().run() },
    { key: "code", icon: <IconCode size={17} />, isActive: (i) => i.isActive("codeBlock"), run: () => chain()?.toggleCodeBlock().run() },
  ];
  const listMarks: ToolMark[] = [
    { key: "quote", icon: <IconQuote size={17} />, isActive: (i) => i.isActive("blockquote"), run: () => chain()?.toggleBlockquote().run() },
    { key: "ordered", icon: <IconListNumbers size={17} />, isActive: (i) => i.isActive("orderedList"), run: () => chain()?.toggleOrderedList().run() },
    { key: "bullet", icon: <IconList size={17} />, isActive: (i) => i.isActive("bulletList"), run: () => chain()?.toggleBulletList().run() },
  ];
  const alignMarks: ToolMark[] = [
    { key: "left", icon: <IconAlignLeft size={17} />, isActive: (i) => i.isActive({ textAlign: "left" }), run: () => chain()?.setTextAlign("left").run() },
    { key: "center", icon: <IconAlignCenter size={17} />, isActive: (i) => i.isActive({ textAlign: "center" }), run: () => chain()?.setTextAlign("center").run() },
    { key: "right", icon: <IconAlignRight size={17} />, isActive: (i) => i.isActive({ textAlign: "right" }), run: () => chain()?.setTextAlign("right").run() },
    { key: "justify", icon: <IconAlignJustified size={17} />, isActive: (i) => i.isActive({ textAlign: "justify" }), run: () => chain()?.setTextAlign("justify").run() },
  ];

  const rawFontSize = editor?.getAttributes("textStyle")?.fontSize;
  const parsedFontSize = rawFontSize ? parseInt(String(rawFontSize), 10) : DEFAULT_FONT_SIZE;
  const currentFontSize = Number.isFinite(parsedFontSize) ? parsedFontSize : DEFAULT_FONT_SIZE;
  function applyFontSize(size: number) {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(size)));
    const c = chain() as any;
    if (!c) return;
    if (clamped === DEFAULT_FONT_SIZE) c.unsetFontSize().run();
    else c.setFontSize(`${clamped}px`).run();
  }

  // Reflect the active font size on the editor root so the caret on an empty
  // line grows/shrinks with it (like Docs), not just once you start typing.
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.setProperty("--caret-fs", `${currentFontSize}px`);
  }, [editor, currentFontSize]);

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[#131415] text-white">
      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => chain()?.setImage({ src: String(reader.result || "") }).run();
        reader.readAsDataURL(file);
      }} />
      <header className="border-b border-white/[0.08] bg-[#131313] px-4 pt-3">
        <div className="flex items-start gap-3">
          {/* The document icon itself returns to resources (Word/Docs style). */}
          <button
            type="button"
            onClick={() => void handleClose()}
            aria-label="Back to dashboard"
            className="group relative mt-1 shrink-0 rounded-xl p-1 text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <IconFile size={32} />
            <span className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl group-hover:block">
              Back to dashboard
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="group/title relative inline-flex max-w-sm items-center">
              <input
                ref={titleRef}
                value={active.title}
                onChange={(event) => patchDocument({ title: event.target.value })}
                className="peer w-full rounded-lg bg-transparent px-2 py-1 pr-7 text-sm font-bold text-white/85 outline-none transition-colors hover:bg-white/[0.04] focus:bg-white/[0.04]"
                aria-label="Document title"
                title="Click to rename"
              />
              <IconPencil
                size={13}
                className="pointer-events-none absolute right-2 text-white/0 transition-colors group-hover/title:text-white/35 peer-focus:text-white/0"
              />
            </div>
            <div className="relative mt-1 flex items-center gap-1">
              {menu ? (
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenu(null)}
                  className="fixed inset-0 z-20 cursor-default"
                />
              ) : null}
              {Object.keys(menus).map((name) => (
                <div key={name} className="relative">
                  <button type="button" onClick={() => setMenu(menu === name ? null : name)} className={`relative z-30 ${menuButton} ${menu === name ? "bg-white/[0.06] text-white" : ""}`}>{name}</button>
                  {menu === name ? (
                    <div className="absolute left-0 top-9 z-30 min-w-72 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                      {menus[name].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.action();
                            // Every menu action dismisses the menu, matching
                            // Word/Docs; actions that already close it no-op.
                            setMenu(null);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${item.danger ? "text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)]" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {collaborators.length ? (
            <div className="mr-1 flex items-center gap-2" title={collaborators.map((person) => `${person.name}${person.typing ? " is typing" : ""}`).join(", ")}>
              <div className="flex items-center -space-x-2">
                {collaborators.slice(0, 4).map((person) => (
                  person.avatar ? <img key={person.user_id} src={discordAvatarUrl(person.avatar) || ""} alt={person.name || "Editor"} className={`h-7 w-7 rounded-full border-2 border-[#131313] object-cover ${person.typing ? "ring-2 ring-[var(--accent-peach)]" : ""}`} /> : <span key={person.user_id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#131313] bg-white/[0.08] text-[10px] font-bold">{String(person.name || "?").slice(0, 1)}</span>
                ))}
              </div>
              {collaborators.some((person) => person.typing) ? <span className="text-[10px] font-semibold text-[var(--accent-peach)]">Typing…</span> : null}
            </div>
          ) : null}
          {/* Save state, matching the spreadsheet header exactly. */}
          <button
            type="button"
            onClick={() => void saveNow()}
            className={`${collaborators.length ? "" : "ml-auto"} flex shrink-0 items-center gap-1 p-1 text-white/45 transition-colors hover:text-white`}
            title={saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved automatically" : "Unsaved changes"}
            aria-label={saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Unsaved changes"}
          >
            {saveState === "saving" ? <IconLoader2 size={18} className="animate-spin text-[var(--accent-peach)]" /> : saveState === "saved" ? <IconCloudCheck size={18} className="text-[var(--tone-ok)]" /> : <IconCloudUp size={18} className="text-[var(--tone-warn)]" />}
            {/* On phones the icon alone is easy to miss — show a short status. */}
            <span className="text-[11px] font-semibold md:hidden">{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Unsaved"}</span>
          </button>
          {guildId && resource.id ? (
            <VersionHistory
              guildId={guildId}
              resourceId={String(resource.id)}
              kind="document"
              // Restoring replaces content only, fed back through the editor's
              // own onChange so the document and outline both update.
              onRestored={(restored) => {
                onChange({ ...resourceRef.current, ...restored });
                setActiveId(String((restored as any).active_document_id || "root"));
              }}
            />
          ) : null}
          <button type="button" onClick={() => setShareOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"><IconShare size={15} /><span className="max-md:hidden">Share</span></button>
          <button type="button" onClick={() => void handleClose()} className="rounded-xl p-2 text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white" aria-label="Close"><IconX size={17} /></button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2 py-2">
          <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.undo().run(); }} className={toolButton} title="Undo"><IconArrowBackUp size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.redo().run(); }} className={toolButton} title="Redo"><IconArrowForwardUp size={17} /></button>
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {textMarks.map((mark) => (
            <button
              key={mark.key}
              type="button"
              onMouseDown={(event) => { event.preventDefault(); mark.run(); }}
              className={editor && mark.isActive(editor) ? toolButtonActive : toolButton}
              title={mark.key}
            >
              {mark.icon}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {[1, 2, 3].map((level) => (
            <button
              key={level}
              type="button"
              onMouseDown={(event) => { event.preventDefault(); chain()?.toggleHeading({ level: level as 1 | 2 | 3 }).run(); }}
              className={`${editor?.isActive("heading", { level }) ? toolButtonActive : toolButton} text-xs font-bold`}
              title={`Heading ${level}`}
            >
              H{level}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {/* Text colour + highlight — umodoc-style colour controls. */}
          <span className="relative">
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setColorMenu(colorMenu === "text" ? null : "text"); }} className={colorMenu === "text" ? toolButtonActive : toolButton} title="Text colour"><IconLetterA size={17} /></button>
            {colorMenu === "text" ? (
              <span className="absolute left-0 top-10 z-40 flex gap-2 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                {TEXT_COLORS.map((value) => (
                  <button key={value} type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.setColor(value).run(); setColorMenu(null); }} className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: value }} aria-label={`Text colour ${value}`} />
                ))}
                <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.unsetColor().run(); setColorMenu(null); }} className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white/60" aria-label="Reset colour"><IconX size={11} /></button>
              </span>
            ) : null}
          </span>
          <span className="relative">
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setColorMenu(colorMenu === "highlight" ? null : "highlight"); }} className={colorMenu === "highlight" || editor?.isActive("highlight") ? toolButtonActive : toolButton} title="Highlight"><IconHighlight size={17} /></button>
            {colorMenu === "highlight" ? (
              <span className="absolute left-0 top-10 z-40 flex gap-2 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                {HIGHLIGHT_COLORS.map((value) => (
                  <button key={value} type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.toggleHighlight({ color: value }).run(); setColorMenu(null); }} className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: value }} aria-label={`Highlight ${value}`} />
                ))}
                <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.unsetHighlight().run(); setColorMenu(null); }} className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white/60" aria-label="Remove highlight"><IconX size={11} /></button>
              </span>
            ) : null}
          </span>
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {/* Font family — a styled dropdown that matches the app chrome (sits in
              the middle of the toolbar, like the reference). */}
          <FontDropdown
            value={editor?.getAttributes("textStyle")?.fontFamily || ""}
            onChange={(value) => {
              const c = chain() as any;
              if (!c) return;
              if (value) c.setFontFamily(value).run();
              else c.unsetFontFamily().run();
            }}
          />
          {/* Font size stepper — − / value / +. */}
          <span className="ml-1 flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-1">
            <button type="button" onMouseDown={(event) => { event.preventDefault(); applyFontSize(currentFontSize - 1); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white" title="Decrease font size"><IconMinus size={15} /></button>
            {/* Type a size directly, or use the steppers. */}
            <input
              key={currentFontSize}
              type="text"
              inputMode="numeric"
              defaultValue={currentFontSize}
              aria-label="Font size"
              title="Font size"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const next = parseInt(event.currentTarget.value, 10);
                  if (Number.isFinite(next)) applyFontSize(next);
                  event.currentTarget.blur();
                }
              }}
              onBlur={(event) => {
                const next = parseInt(event.currentTarget.value, 10);
                if (Number.isFinite(next)) applyFontSize(next);
              }}
              className="w-8 rounded-lg bg-transparent text-center text-xs font-bold tabular-nums text-white/80 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] focus:bg-white/[0.06]"
            />
            <button type="button" onMouseDown={(event) => { event.preventDefault(); applyFontSize(currentFontSize + 1); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white" title="Increase font size"><IconPlus size={15} /></button>
          </span>
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {listMarks.map((mark) => (
            <button key={mark.key} type="button" onMouseDown={(event) => { event.preventDefault(); mark.run(); }} className={editor && mark.isActive(editor) ? toolButtonActive : toolButton} title={mark.key}>{mark.icon}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          {alignMarks.map((mark) => (
            <button key={mark.key} type="button" onMouseDown={(event) => { event.preventDefault(); mark.run(); }} className={editor && mark.isActive(editor) ? toolButtonActive : toolButton} title={mark.key}>{mark.icon}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/[0.08]" />
          <button type="button" onMouseDown={(event) => { event.preventDefault(); setLinkOpen(true); }} className={editor?.isActive("link") ? toolButtonActive : toolButton} title="Insert link"><IconLink size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); imageRef.current?.click(); }} className={toolButton} title="Insert image"><IconPhoto size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); insertTable(); }} className={editor?.isActive("table") ? toolButtonActive : toolButton} title="Insert table"><IconTable size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.setHorizontalRule().run(); }} className={toolButton} title="Insert divider"><IconList size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); insertHint(); }} className={toolButton} title="Insert hint"><IconBulb size={17} /></button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); chain()?.unsetAllMarks().clearNodes().run(); }} className={toolButton} title="Clear formatting"><IconClearFormatting size={17} /></button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {outline ? (
          <>
            {/* On phones the outline floats over the page as a dismissable
                drawer instead of squeezing the editor into a sliver. */}
            <button
              type="button"
              aria-label="Close outline"
              onClick={() => setOutline(false)}
              className="absolute inset-0 z-20 bg-black/50 md:hidden"
            />
            <aside className="absolute inset-y-0 left-0 z-30 w-72 max-w-[82vw] shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#131415] p-4 md:static md:z-auto md:max-w-none">
            {[{ id: "root", title: resource.title }, ...subdocuments].map((item) =>
              renamingId === item.id ? (
                <input
                  key={item.id}
                  autoFocus
                  defaultValue={item.title}
                  onFocus={(event) => event.target.select()}
                  onBlur={(event) => {
                    renameDocument(item.id, event.target.value);
                    setRenamingId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      renameDocument(item.id, event.currentTarget.value);
                      setRenamingId(null);
                    } else if (event.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  className="mb-1 w-full rounded-xl border border-[var(--accent-peach)]/45 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)]"
                  aria-label="Rename document"
                />
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveId(item.id); onChange({ ...resource, active_document_id: item.id }); }}
                  onDoubleClick={() => setRenamingId(item.id)}
                  onContextMenu={(event) => openSubdocumentContextMenu(event, item)}
                  className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm transition-colors ${activeId === item.id ? "bg-white/[0.06] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
                >
                  {item.title}
                </button>
              ),
            )}
            <button type="button" onClick={addSubdocument} className="mt-2 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--accent-peach)]"><IconFilePlus size={15} />New sub document</button>
          </aside>
          </>
        ) : null}
        <main
          className="min-w-0 flex-1 overflow-y-auto bg-[#161616] px-5 py-7 max-md:px-4 max-md:py-5"
          onContextMenu={openPageContextMenu}
        >
          <EditorContent editor={editor} />
        </main>
      </div>
      {confirmDeleteDoc ? (
        <DocumentModal title="Delete document?" onClose={() => setConfirmDeleteDoc(false)}>
          <p className="text-sm leading-6 text-white/60">
            This permanently deletes “{active.title || "this document"}” and its
            saved contents. This can&apos;t be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteDoc(false)}
              className="px-3 py-2 text-sm text-white/55 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmDeleteDoc(false);
                await onDelete();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--tone-bad-wash)] px-3 py-2 text-sm font-bold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
            >
              <IconTrash size={15} />
              Delete document
            </button>
          </div>
        </DocumentModal>
      ) : null}
      {shareOpen ? (
        <DocumentModal title="Manage Document Access" onClose={() => setShareOpen(false)}>
          <ShareAccessPanel
                scope="department"
            resource={resource}
            onChange={onChange}
            guildId={guildId}
            shareUrl={documentLink}
            kindLabel="document"
            onClose={() => setShareOpen(false)}
          />
        </DocumentModal>
      ) : null}
      {findOpen ? <DocumentModal title="Find and replace" onClose={() => setFindOpen(false)}><div className="space-y-3"><FieldRow label="Find"><TextField value={find} onChange={setFind} /></FieldRow><FieldRow label="Replace with"><TextField value={replace} onChange={setReplace} /></FieldRow></div><div className="mt-5 flex justify-end"><button type="button" onClick={() => { if (!find || !editor) return; const html = editor.getHTML().split(find).join(replace); editor.commands.setContent(html); patchDocument({ html }); setFindOpen(false); }} className="btn-pop btn-peach px-4 py-2 text-xs">Replace all</button></div></DocumentModal> : null}
      {linkOpen ? <DocumentModal title="Insert link" onClose={() => setLinkOpen(false)}><FieldRow label="URL"><TextField value={link} onChange={setLink} placeholder="https://" /></FieldRow><div className="mt-5 flex justify-end"><button type="button" onClick={() => { if (link) chain()?.extendMarkRange("link").setLink({ href: link }).run(); setLink(""); setLinkOpen(false); }} className="btn-pop btn-peach px-4 py-2 text-xs">Insert link</button></div></DocumentModal> : null}
      {info ? <DocumentModal title="Document information" onClose={() => setInfo(null)}><p className="text-sm leading-6 text-white/60">{info}</p></DocumentModal> : null}
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[235] w-56 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {contextMenu.items.map((item) => (
            <React.Fragment key={item.label}>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  item.action();
                  setContextMenu(null);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${item.danger ? "text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)]" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
              {item.separator ? (
                <div className="mx-2 my-1 border-t border-white/[0.08]" />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[240] -translate-x-1/2 rounded-xl border border-[var(--tone-ok-line)] bg-[#101312]/95 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--tone-ok)]">
            <IconCheck size={14} />
            {toast}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Keep a context menu on screen near the pointer. */
function clampMenuPoint(x: number, y: number) {
  return {
    x: Math.min(x, (typeof window === "undefined" ? x : window.innerWidth) - 240),
    y: Math.min(y, (typeof window === "undefined" ? y : window.innerHeight) - 320),
  };
}

/** Styled font-family dropdown — matches the app chrome instead of the native
 *  <select>, and previews each family in its own typeface. */
function FontDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const current = EDITOR_FONTS.find((font) => font.value === value) || EDITOR_FONTS[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(event) => { event.preventDefault(); setOpen((state) => !state); }}
        className="flex h-8 min-w-[120px] items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 transition-colors hover:border-white/20"
        title="Font"
        aria-label="Font family"
      >
        <span className="truncate" style={{ fontFamily: current.value || undefined }}>{current.label}</span>
        <IconChevronDown size={14} className="shrink-0 text-white/40" />
      </button>
      {open ? (
        <div className="absolute left-0 top-10 z-40 max-h-72 w-52 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          {EDITOR_FONTS.map((font) => (
            <button
              key={font.label}
              type="button"
              onMouseDown={(event) => { event.preventDefault(); onChange(font.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${font.value === value ? "bg-white/[0.06] text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}
              style={{ fontFamily: font.value || undefined }}
            >
              <span className="truncate">{font.label}</span>
              {font.value === value ? <IconCheck size={14} className="shrink-0 text-[var(--accent-peach)]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocumentModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="gator-overlay fixed inset-0 z-[230] flex items-center justify-center p-4"><button type="button" className="dialog-backdrop absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-label="Close" /><div className="dialog-pop relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#131415] p-5 shadow-[0_24px_80px_rgba(0,0,0,.7)]"><div className="mb-5 flex items-center justify-between"><h3 className="text-base font-extrabold text-white/85">{title}</h3><button type="button" onClick={onClose} className="p-2 text-white/35 hover:text-white"><IconX size={17} /></button></div>{children}</div></div>;
}
