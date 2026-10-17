"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { absoluteLink, resourceLink } from "@/utils/short-links";
import {
  IconCheck,
  IconCloudCheck,
  IconCloudUp,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconShare,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { VersionHistory } from "@/components/Manage/version-history";
import { ShareAccessPanel } from "./share-access-panel";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-hyper-link/lib/index.css";
import "@univerjs/preset-sheets-thread-comment/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";

const DEFAULT_ROWS = 100;
const DEFAULT_COLUMNS = 26;
// Univer CommandType.MUTATION — the atomic, snapshot-saved changes we sync for
// live collaboration (selections/scroll are OPERATIONs and never relayed).
const MUTATION = 2;

// Univer renders with darkMode off so cell fills stay exactly as picked: a
// white Excel-style sheet with visible gridlines and the accent, inside Gator's
// chrome.
function applyGatorSheetStyle(snapshot: any) {
  if (!snapshot?.sheets) return snapshot;
  for (const sheet of Object.values<any>(snapshot.sheets)) {
    sheet.showGridlines = 1;
  }
  return snapshot;
}

function workbookFromResource(resource: any) {
  if (resource.spreadsheet_snapshot?.sheets)
    return applyGatorSheetStyle(structuredClone(resource.spreadsheet_snapshot));
  const rows = Array.isArray(resource.spreadsheet_data) ? resource.spreadsheet_data : [];
  const cellData: Record<number, Record<number, { v: string }>> = {};
  rows.forEach((row: unknown, rowIndex: number) => {
    if (!Array.isArray(row)) return;
    row.forEach((value, columnIndex) => {
      if (value === undefined || value === null || value === "") return;
      cellData[rowIndex] ||= {};
      cellData[rowIndex][columnIndex] = { v: String(value) };
    });
  });
  return applyGatorSheetStyle({
    id: resource.id || crypto.randomUUID(),
    name: resource.title || "Untitled Spreadsheet",
    appVersion: "0.25.1",
    locale: "enUS",
    styles: {},
    sheetOrder: ["sheet-1"],
    sheets: {
      "sheet-1": {
        id: "sheet-1",
        name: "Sheet 1",
        rowCount: Math.max(DEFAULT_ROWS, rows.length),
        columnCount: Math.max(DEFAULT_COLUMNS, ...rows.map((row: unknown) => Array.isArray(row) ? row.length : 0)),
        cellData,
      },
    },
  });
}

// Only the primary (accent and selection) scale is themed; everything else
// keeps Univer's default light scale. darkMode stays off so fills are never
// inverted.
const GATOR_SHEET_THEME = {
  primary: {
    50: "#fff4f2",
    100: "#ffe4df",
    200: "#ffcfc7",
    300: "#f7a8c4",
    400: "#ff9b9f",
    500: "#f7a8c4",
    600: "#f0759b",
    700: "#c94d6b",
    800: "#a53d58",
    900: "#713043",
  },
} as const;

function gridFromWorkbook(snapshot: any): string[][] {
  const sheetId = snapshot?.sheetOrder?.[0];
  const sheet = snapshot?.sheets?.[sheetId] || Object.values(snapshot?.sheets || {})[0] as any;
  if (!sheet) return [];
  const usedRows = Object.keys(sheet.cellData || {}).map(Number);
  const height = usedRows.length ? Math.max(...usedRows) + 1 : 0;
  return Array.from({ length: height }, (_, row) => {
    const cells = sheet.cellData?.[row] || {};
    const usedColumns = Object.keys(cells).map(Number);
    const width = usedColumns.length ? Math.max(...usedColumns) + 1 : 0;
    return Array.from({ length: width }, (_, column) => String(cells[column]?.v ?? cells[column]?.f ?? ""));
  });
}

function parseCsv(text: string) {
  return text.split(/\r?\n/).filter((line) => line.length).map((line) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(current); current = ""; }
      else current += char;
    }
    values.push(current);
    return values;
  });
}

function downloadCsv(title: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title || "spreadsheet"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DepartmentSpreadsheetEditor({
  resource,
  onChange,
  onSave,
  onClose,
  onDelete,
  guildId,
  viewer,
}: {
  resource: any;
  onChange: (next: any) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  onDelete: () => Promise<void>;
  /** Guild + viewer power the live-collaboration relay. */
  guildId?: string;
  viewer?: { id?: string; name?: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<any>(null);
  const workbookRef = useRef<any>(null);
  const resourceRef = useRef(resource);
  const savedRef = useRef(JSON.stringify(resource));
  const snapshotRef = useRef(JSON.stringify(workbookFromResource(resource)));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collaborators, setCollaborators] = useState<{ client_id: string; name: string }[]>([]);
  // Follows the site's theme and updates live when it changes.
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.theme !== "light",
  );
  const [shareOpen, setShareOpen] = useState(false);
  resourceRef.current = resource;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : absoluteLink(resourceLink("document", guildId, resource.id), window.location.origin);

  // Live collaboration state: this editor is one client; local mutations are
  // relayed and remote ones re-applied (skipping our own).
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const applyingRemote = useRef(false);
  const cursorRef = useRef(0);
  const pendingOps = useRef<{ id: string; params: any }[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Idle timer for the snapshot: reset on every local edit, fires once the
   *  typing stops. */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentId = resource?.department;
  const viewerName = viewer?.name || "";
  const collabReady = Boolean(guildId && departmentId && resource?.id);

  // Keep the spreadsheet theme in lock-step with the site theme toggle.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const sync = () => setDark(root.dataset.theme !== "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let cleanup = () => undefined;
    void (async () => {
      try {
        const [
          { createUniver, LocaleType, mergeLocales },
          { UniverSheetsCorePreset },
          locale,
          themes,
          { UniverSheetsDataValidationPreset },
          dvLocale,
          { UniverSheetsFilterPreset },
          filterLocale,
          { UniverSheetsSortPreset },
          sortLocale,
          { UniverSheetsNotePreset },
          noteLocale,
          { UniverSheetsHyperLinkPreset },
          linkLocale,
          { UniverSheetsThreadCommentPreset },
          commentLocale,
          { UniverSheetsConditionalFormattingPreset },
          cfLocale,
        ] = await Promise.all([
          import("@univerjs/presets"),
          import("@univerjs/preset-sheets-core"),
          import("@univerjs/preset-sheets-core/locales/en-US"),
          import("@univerjs/themes"),
          import("@univerjs/preset-sheets-data-validation"),
          import("@univerjs/preset-sheets-data-validation/locales/en-US"),
          import("@univerjs/preset-sheets-filter"),
          import("@univerjs/preset-sheets-filter/locales/en-US"),
          import("@univerjs/preset-sheets-sort"),
          import("@univerjs/preset-sheets-sort/locales/en-US"),
          import("@univerjs/preset-sheets-note"),
          import("@univerjs/preset-sheets-note/locales/en-US"),
          import("@univerjs/preset-sheets-hyper-link"),
          import("@univerjs/preset-sheets-hyper-link/locales/en-US"),
          import("@univerjs/preset-sheets-thread-comment"),
          import("@univerjs/preset-sheets-thread-comment/locales/en-US"),
          import("@univerjs/preset-sheets-conditional-formatting"),
          import("@univerjs/preset-sheets-conditional-formatting/locales/en-US"),
        ]);
        if (disposed || !containerRef.current) return;
        const defaultTheme = (themes as any).defaultTheme || {};
        const unwrap = (mod: any) => mod?.default || mod;
        const { univer, univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(
              unwrap(locale),
              unwrap(dvLocale),
              unwrap(filterLocale),
              unwrap(sortLocale),
              unwrap(noteLocale),
              unwrap(linkLocale),
              unwrap(commentLocale),
              unwrap(cfLocale),
            ),
          },
          darkMode: dark,
          theme: { ...defaultTheme, ...GATOR_SHEET_THEME } as any,
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
              header: true,
              toolbar: true,
              formulaBar: true,
              contextMenu: true,
              footer: { sheetBar: true, statisticBar: true },
            }),
            UniverSheetsDataValidationPreset(),
            UniverSheetsFilterPreset(),
            UniverSheetsSortPreset(),
            UniverSheetsNotePreset(),
            UniverSheetsHyperLinkPreset(),
            UniverSheetsThreadCommentPreset(),
            UniverSheetsConditionalFormattingPreset(),
          ],
        } as any);
        const workbook = univerAPI.createWorkbook(workbookFromResource(resourceRef.current));
        apiRef.current = univerAPI;
        workbookRef.current = workbook;
        // Saves when typing stops, and only for this person's edits.
        // `CommandExecuted` fires for every Univer command (selection, scroll,
        // menus) and for remote ops replayed from the 1.4s poll; saving those
        // created an endless save loop between two editors. The guard is read
        // when the event arrives, because `applyingRemote` is cleared
        // synchronously right after the replay.
        const isLocalEdit = (event?: any) => {
          if (applyingRemote.current) return false;
          if (!event) return true; // SheetValueChanged / SheetNameChanged
          return event.type === MUTATION && !event?.options?.fromCollab;
        };
        const sync = (event?: any) => {
          if (!isLocalEdit(event)) return;
          // Coalesced on idle, since snapshotting a large sheet per frame is
          // expensive.
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            saveTimer.current = null;
            const snapshot = workbook.save();
            const serialized = JSON.stringify(snapshot);
            if (serialized === snapshotRef.current) return;
            snapshotRef.current = serialized;
            onChange({ ...resourceRef.current, spreadsheet_snapshot: snapshot, spreadsheet_data: gridFromWorkbook(snapshot) });
          }, 700);
        };
        // Relay local data mutations to the other editors (batched).
        const relay = (event: any) => {
          if (!collabReady || applyingRemote.current) return;
          if (event?.type !== MUTATION || event?.options?.fromCollab) return;
          if (!event?.id) return;
          pendingOps.current.push({ id: event.id, params: event.params });
          if (flushTimer.current) return;
          flushTimer.current = setTimeout(() => {
            const ops = pendingOps.current;
            pendingOps.current = [];
            flushTimer.current = null;
            if (!ops.length) return;
            void fetch(`/api/manage/${guildId}/departmentaction`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "spreadsheet_op",
                department_id: departmentId,
                resource_id: resource.id,
                client_id: clientId,
                ops,
              }),
            }).catch(() => undefined);
          }, 250);
        };
        const events = [
          univerAPI.addEvent(univerAPI.Event.SheetValueChanged, sync),
          univerAPI.addEvent(univerAPI.Event.SheetNameChanged, sync),
          univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event: any) => {
            relay(event);
            sync(event);
          }),
        ];
        cleanup = () => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          if (flushTimer.current) clearTimeout(flushTimer.current);
          events.forEach((event: any) => event?.dispose?.());
          univer.dispose();
        };
        setReady(true);
        // Univer measures its container at init; if layout had not settled, the
        // grid renders at zero height. Nudges a re-measure over the next couple
        // of frames.
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
          requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "The spreadsheet editor could not start.");
      }
    })();
    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id, dark]);

  // Poll for remote mutations + presence and apply them (skipping our own).
  useEffect(() => {
    if (!collabReady) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/manage/${guildId}/deptsheetops?resource=${encodeURIComponent(resource.id)}&since=${cursorRef.current}&client=${clientId}&name=${encodeURIComponent(viewerName)}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const body = await response.json();
          const batches: any[] = body.ops || [];
          const api = apiRef.current;
          for (const batch of batches) {
            if (batch.client_id === clientId || !Array.isArray(batch.ops) || !api) continue;
            applyingRemote.current = true;
            try {
              for (const op of batch.ops) {
                if (op?.id) api.syncExecuteCommand(op.id, op.params, { fromCollab: true });
              }
            } catch {
              /* a malformed op must never break the session */
            }
            // Held one more frame: Univer dispatches some command events
            // asynchronously, and anything landing after the flag drops would
            // be saved as a local edit.
            await new Promise((resolve) => requestAnimationFrame(resolve));
            applyingRemote.current = false;
          }
          if (typeof body.cursor === "number") cursorRef.current = body.cursor;
          if (Array.isArray(body.presences))
            setCollaborators(
              body.presences.map((entry: any) => ({
                client_id: String(entry.client_id || ""),
                name: String(entry.name || "Member"),
              })),
            );
        }
      } catch {
        /* transient — try again next tick */
      }
      if (active) timer = setTimeout(poll, 1400);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabReady, guildId, resource.id, clientId, viewerName]);

  useEffect(() => {
    if (JSON.stringify(resource) === savedRef.current) return;
    setSaveState("dirty");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      const snapshot = JSON.stringify(resourceRef.current);
      try {
        await onSave();
        savedRef.current = snapshot;
        setSaveState(JSON.stringify(resourceRef.current) === snapshot ? "saved" : "dirty");
      } catch {
        setSaveState("dirty");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [onSave, resource]);

  async function importCsv(file: File) {
    const values = parseCsv(await file.text());
    const sheet = apiRef.current?.getActiveWorkbook()?.getActiveSheet();
    if (!sheet || !values.length) return;
    sheet.getRangeByIndexes(0, 0, values.length, Math.max(...values.map((row: string[]) => row.length))).setValues(values);
  }

  async function closeEditor() {
    if (saveState !== "saved") await onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[170] flex flex-col bg-[#0e0e0e] text-white">
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.currentTarget.value = ""; }} />
      {/* Gator's own chrome: slim identity bar with quiet pill actions —
          the sheet itself sits in a framed, rounded workspace below. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[#131313] px-4">
        {/* The spreadsheet icon itself returns to resources (like documents). */}
        <button
          type="button"
          onClick={() => void closeEditor()}
          aria-label="Back to dashboard"
          className="group relative shrink-0 rounded-xl p-1 text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <IconFileSpreadsheet size={28} />
          <span className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl group-hover:block">
            Back to dashboard
          </span>
        </button>
        <input value={resource.title || ""} onChange={(event) => onChange({ ...resourceRef.current, title: event.target.value })} className="min-w-0 max-w-sm flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm font-bold text-white/85 outline-none transition-colors hover:border-white/[0.08] focus:border-[var(--accent-peach)]/40" aria-label="Spreadsheet title" />
        {collaborators.length ? (
          <div className="mr-1 flex items-center -space-x-2" aria-label="People editing now">
            {collaborators.slice(0, 4).map((person) => (
              <span
                key={person.client_id}
                title={`${person.name} is editing`}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0e0e0e] bg-[var(--accent-peach)]/20 text-[11px] font-bold text-[var(--accent-peach)]"
              >
                {person.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            ))}
            {collaborators.length > 4 ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0e0e0e] bg-white/10 text-[10px] font-bold text-white/70">
                +{collaborators.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
        <span
          className={`${collaborators.length ? "" : "ml-auto"} flex shrink-0 items-center gap-1 p-1 text-white/45`}
          title={saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved automatically" : "Unsaved"}
          aria-label={saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Unsaved"}
        >
          {saveState === "saving" ? <IconLoader2 size={18} className="animate-spin text-[var(--accent-peach)]" /> : saveState === "saved" ? <IconCloudCheck size={18} className="text-[var(--tone-ok)]" /> : <IconCloudUp size={18} className="text-[var(--tone-warn)]" />}
          {/* On phones the icon is easy to miss, so show a short status word too. */}
          <span className="text-[11px] font-semibold md:hidden">{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Unsaved"}</span>
        </span>
        {guildId && resource.id ? (
          <VersionHistory
            guildId={guildId}
            resourceId={String(resource.id)}
            kind="spreadsheet"
            onRestored={(restored) => onChange({ ...resource, ...restored })}
          />
        ) : null}
        <button type="button" onClick={() => setShareOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"><IconShare size={15} /><span className="max-md:hidden">Share</span></button>
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"><IconUpload size={15} /><span className="max-md:hidden">Import</span></button>
        <button type="button" onClick={() => downloadCsv(resource.title, gridFromWorkbook(workbookRef.current?.save?.() || workbookFromResource(resourceRef.current)))} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"><IconDownload size={15} /><span className="max-md:hidden">Export</span></button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-xl p-2 text-white/35 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]" aria-label="Delete spreadsheet"><IconTrash size={16} /></button>
        <button type="button" onClick={() => void closeEditor()} className="rounded-xl p-2 text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white" aria-label="Close"><IconX size={17} /></button>
      </header>
      <div className="gator-spreadsheet relative mx-3 mb-3 min-h-[60vh] flex-1 overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,.45)]">
        {!ready && !loadError ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#161616]"><IconLoader2 className="animate-spin text-[var(--accent-peach)]" size={24} /></div> : null}
        {loadError ? <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#161616] px-6 text-center"><p className="font-bold text-white/80">Spreadsheet editor unavailable</p><p className="max-w-lg text-sm text-white/45">{loadError}</p></div> : null}
        <div ref={containerRef} className={`gator-univer h-full w-full [&_.univer-app]:font-[var(--font-inter)] ${dark ? "gator-univer-dark" : ""}`} />
      </div>
      {shareOpen ? (
        <div className="gator-overlay fixed inset-0 z-[240] flex items-center justify-center p-4">
          <button type="button" className="dialog-backdrop absolute inset-0 bg-black/75" onClick={() => setShareOpen(false)} aria-label="Close" />
          <div className="dialog-pop relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#131415] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">Manage Spreadsheet Access</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="rounded-xl p-2 text-white/30 hover:bg-white/[0.04] hover:text-white" aria-label="Close"><IconX size={16} /></button>
            </div>
            <div className="mt-4">
              <ShareAccessPanel
                scope="department"
                resource={resource}
                onChange={(next) => onChange({ ...next })}
                guildId={guildId}
                shareUrl={shareUrl}
                kindLabel="spreadsheet"
                onClose={() => setShareOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? <div className="gator-overlay fixed inset-0 z-[240] flex items-center justify-center p-4"><button type="button" className="dialog-backdrop absolute inset-0 bg-black/75" onClick={() => setConfirmDelete(false)} aria-label="Cancel" /><div className="dialog-pop relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#131415] p-5"><h3 className="font-extrabold">Delete spreadsheet?</h3><p className="mt-2 text-sm text-white/50">This removes the spreadsheet and its saved data.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-white/55">Cancel</button><button type="button" onClick={async () => { await onDelete(); setConfirmDelete(false); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tone-bad-wash)] px-3 py-2 text-sm font-bold text-[var(--tone-bad)]"><IconCheck size={15} />Delete</button></div></div></div> : null}
    </div>
  );
}
