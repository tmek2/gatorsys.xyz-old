"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  IconBook2,
  IconCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconFile,
  IconHelp,
  IconLink,
  IconList,
  IconLoader2,
  IconPrinter,
  IconTable,
} from "@tabler/icons-react";
import { HeaderShell } from "@/components/legacy-header/header-shell";
import { isLive } from "@/utils/viewer";

function parseServerDate(value: any): Date {
  if (
    typeof value === "string" &&
    /T\d/.test(value) &&
    !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
  ) {
    return new Date(`${value}Z`);
  }
  return new Date(value);
}

function timeAgo(value: any): string {
  const date = value ? parseServerDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "recently";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(months / 12)} year${Math.round(months / 12) === 1 ? "" : "s"} ago`;
}

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function spreadsheetCsv(rows: any[][]): string {
  return (rows || [])
    .map((row) =>
      (row || [])
        .map((cell) => {
          const text = String(cell ?? "");
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

/**
 * Read-only document and spreadsheet viewer for members without edit permission
 * (those with it open the full editor). It mirrors the editor chrome under the
 * pinned site nav: the document icon is the return button, with a trimmed File
 * menu and Help.
 */
export function DocumentReader({
  apiPath,
  documentHref,
  editHref,
  parentId,
}: {
  /** Endpoint returning { resource, siblings, department, can_edit }. */
  apiPath: string;
  /** Builds the href for a sibling document id (for navigation). */
  documentHref?: (id: string) => string;
  /** Builds the editor href for a resource id. When provided and the viewer
   *  has edit permission, they're redirected straight into the editor. */
  editHref?: (id: string) => string;
  /** Parent guild id — lets the shared viewer build the editor redirect from
   *  the resolved department when no explicit editHref is passed. */
  parentId?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  /* `isLive`, not the session: the session object carries `authError` when the
     Discord tokens could not be refreshed, and the header should not show a
     face on a site that will bounce the user. */
  const sessionUser = (isLive(session) ? session?.user : undefined) as
    | { id?: string | null; name?: string | null; email?: string | null; image?: string | null }
    | undefined;
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [pageId, setPageId] = useState("root");
  const [menu, setMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(apiPath, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.detail || body.message || "Could not load this document",
          );
        if (!cancelled) setData(body);
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this document",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  const resource = data?.resource;
  const isSpreadsheet = resource?.kind === "spreadsheet";

  // Viewers with edit permission are sent straight to the full editor, using
  // the resolved department and parent id.
  const departmentId = data?.department?.id;
  const resolvedEditHref =
    editHref ||
    (parentId && departmentId
      ? (id: string) =>
          `/departments/${parentId}/${encodeURIComponent(departmentId)}?tab=resources&edit=${id}`
      : undefined);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (data?.can_edit && resource?.id && resolvedEditHref && !redirecting) {
      setRedirecting(true);
      router.replace(resolvedEditHref(resource.id));
    }
  }, [data?.can_edit, resource?.id, resolvedEditHref, redirecting, router]);
  const subdocuments: any[] = useMemo(
    () => (Array.isArray(resource?.subdocuments) ? resource.subdocuments : []),
    [resource],
  );
  const pages = useMemo(
    () => [{ id: "root", title: resource?.title || "Document" }, ...subdocuments],
    [resource, subdocuments],
  );
  const pageIndex = pages.findIndex((page) => page.id === pageId);
  const html =
    pageId === "root"
      ? resource?.document_html || ""
      : subdocuments.find((page) => page.id === pageId)?.html || "";
  const grid: any[][] = Array.isArray(resource?.spreadsheet_data)
    ? resource.spreadsheet_data
    : [];

  function goBack() {
    // Reached from a share link, so "return to dashboard" goes to /servers
    // rather than `router.back()` (which could leave the site).
    router.push("/servers");
  }

  function copyLink() {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setMenu(null);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const fileItems = isSpreadsheet
    ? [
        {
          label: "Make a copy",
          icon: <IconCopy size={15} />,
          action: () =>
            download(`${resource.title || "spreadsheet"} (copy).csv`, "text/csv", spreadsheetCsv(grid)),
        },
        { label: "Print", icon: <IconPrinter size={15} />, action: () => window.print() },
        {
          label: "Download as CSV",
          icon: <IconDownload size={15} />,
          action: () =>
            download(`${resource.title || "spreadsheet"}.csv`, "text/csv", spreadsheetCsv(grid)),
        },
        { label: "Copy link", icon: <IconLink size={15} />, action: copyLink },
      ]
    : [
        {
          label: "Make a copy",
          icon: <IconCopy size={15} />,
          action: () =>
            download(`${resource.title || "document"} (copy).html`, "text/html", html),
        },
        { label: "Print", icon: <IconPrinter size={15} />, action: () => window.print() },
        {
          label: "Download as plain text",
          icon: <IconDownload size={15} />,
          action: () => {
            const el = document.createElement("div");
            el.innerHTML = html;
            download(`${resource?.title || "document"}.txt`, "text/plain", el.innerText || "");
          },
        },
        {
          label: "Download as HTML",
          icon: <IconDownload size={15} />,
          action: () =>
            download(`${resource?.title || "document"}.html`, "text/html", html),
        },
        { label: "Copy doc link", icon: <IconLink size={15} />, action: copyLink },
      ];
  const helpItems = [
    {
      label: "Documentation",
      icon: <IconBook2 size={15} />,
      action: () => window.open("https://docs.gatorsys.xyz", "_blank"),
    },
    {
      label: "Give Feedback",
      icon: <IconHelp size={15} />,
      action: () => window.open("/support", "_blank"),
    },
  ];
  const menus: Record<string, { label: string; icon: React.ReactNode; action: () => void }[]> = {
    File: fileItems,
    Help: helpItems,
  };

  if (error)
    return (
      <>
        <HeaderShell user={sessionUser} pinned />
        <main className="flex min-h-screen items-center justify-center bg-[#080808] p-6 pt-20 text-white">
          <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
            <IconBook2 size={22} className="mx-auto text-white/25" />
            <p className="mt-3 text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={goBack}
              className="btn-pop btn-peach mt-5 inline-flex px-4 py-2 text-sm"
            >
              Go back
            </button>
          </div>
        </main>
      </>
    );
  if (!resource || redirecting)
    return (
      <>
        <HeaderShell user={sessionUser} pinned />
        <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
          <IconLoader2 className="animate-spin text-white/35" />
        </main>
      </>
    );

  const siblings: any[] = Array.isArray(data?.siblings) ? data.siblings : [];
  const activeTitle =
    pageId === "root" ? resource.title : pages[pageIndex]?.title || resource.title;

  return (
    <>
      <HeaderShell user={sessionUser} pinned />
      {/* Sits directly under the pinned site nav (52px tall). Documents stay on
          the default colour scheme — the department theme is kept out. */}
      <div className="min-h-screen bg-[#131415] pt-[52px] text-white">
        {/* Document bar: the icon itself returns to the dashboard. */}
        <header className="border-b border-white/[0.08] bg-[#131313] px-4 py-3">
          <div className="flex items-start gap-3">
            {pages.length > 1 || (siblings.length > 1 && documentHref) ? (
              <button
                type="button"
                onClick={() => setNavOpen((open) => !open)}
                aria-label="Toggle document list"
                className="mt-1 shrink-0 rounded-xl p-2 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
              >
                <IconList size={22} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={goBack}
              aria-label="Return to dashboard"
              className="group relative mt-1 shrink-0 rounded-xl p-1 text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {isSpreadsheet ? <IconTable size={30} /> : <IconFile size={30} />}
              <span className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl group-hover:block">
                Return to dashboard
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white/85">{resource.title}</p>
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
                    <button
                      type="button"
                      onClick={() => setMenu(menu === name ? null : name)}
                      className={`relative z-30 rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${menu === name ? "bg-white/[0.06] text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                    >
                      {name}
                    </button>
                    {menu === name ? (
                      <div className="absolute left-0 top-8 z-30 min-w-64 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                        {menus[name].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              item.action();
                              setMenu(null);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
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
            {copied ? (
              <span className="mt-1 inline-flex items-center gap-2 rounded-xl border border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] px-3 py-1 text-[11px] font-bold text-[var(--tone-ok)]">
                <IconCheck size={13} /> Link copied
              </span>
            ) : null}
          </div>
        </header>

        <div className="relative flex min-h-[calc(100vh-52px-57px)]">
          {/* Sidebar: sibling documents + this document's sub pages. On phones
              it opens as a dismissable drawer via the header toggle. */}
          {pages.length > 1 || (siblings.length > 1 && documentHref) ? (
            <>
              {navOpen ? (
                <button
                  type="button"
                  aria-label="Close list"
                  onClick={() => setNavOpen(false)}
                  className="absolute inset-0 z-20 bg-black/50 md:hidden"
                />
              ) : null}
            <aside
              className={`absolute inset-y-0 left-0 z-30 w-64 max-w-[82vw] shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#131415] p-3 transition-transform md:static md:z-auto md:max-w-none md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              {siblings.length > 1 && documentHref
                ? siblings.map((item) =>
                    item.id === resource.id ? (
                      <span
                        key={item.id}
                        className="mb-1 block truncate rounded-xl bg-white/[0.06] px-3 py-3 text-sm text-white"
                      >
                        {item.title}
                      </span>
                    ) : (
                      <a
                        key={item.id}
                        href={documentHref(item.id)}
                        className="mb-1 block truncate rounded-xl px-3 py-3 text-sm text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
                      >
                        {item.title}
                      </a>
                    ),
                  )
                : null}
              {pages.length > 1 ? (
                <div
                  className={siblings.length > 1 ? "ml-3 mt-1 border-l border-white/[0.08] pl-2" : ""}
                >
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setPageId(page.id)}
                      className={`mb-1 block w-full truncate rounded-xl px-3 py-2 text-left text-xs transition-colors ${pageId === page.id ? "bg-white/[0.06] text-white" : "text-white/50 hover:bg-white/[0.02] hover:text-white"}`}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
            </>
          ) : null}

          <main className="min-w-0 flex-1 overflow-y-auto bg-[#161616] p-6">
            {isSpreadsheet ? (
              (() => {
                // A full sheet surface with A/B/C column headers and row
                // numbers, padded to a comfortable size.
                const usedCols = grid.reduce(
                  (max, row) => Math.max(max, (row || []).length),
                  0,
                );
                const cols = Math.max(usedCols, 12);
                const rows = Math.max(grid.length, 30);
                const colLabel = (index: number) => {
                  let label = "";
                  let n = index;
                  do {
                    label = String.fromCharCode(65 + (n % 26)) + label;
                    n = Math.floor(n / 26) - 1;
                  } while (n >= 0);
                  return label;
                };
                return (
                  <div className="gator-sheetview overflow-auto rounded-xl border">
                    <table className="border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 w-10" />
                          {Array.from({ length: cols }, (_, c) => (
                            <th
                              key={c}
                              className="min-w-24 px-2 py-2 text-center font-semibold"
                            >
                              {colLabel(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: rows }, (_, r) => (
                          <tr key={r}>
                            <td className="sticky left-0 z-10 px-2 py-2 text-center font-semibold gator-sheetview-head">
                              {r + 1}
                            </td>
                            {Array.from({ length: cols }, (_, c) => (
                              <td key={c} className="min-w-24 px-3 py-2">
                                {String(grid[r]?.[c] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            ) : (
              <div className="mx-auto max-w-[860px] py-2">
                {/* The same paper as the editor, with the `.gator-doc`
                   typography, so the view matches the editor. */}
                <div className="gator-doc mx-auto w-full max-w-[816px] rounded-md border border-white/[0.08] bg-[#1c1c1c] px-16 py-14 max-md:px-6 max-md:py-8 text-[15px] leading-[1.75] text-white/80 shadow-[0_26px_80px_rgba(0,0,0,.38)]">
                  {pageId !== "root" ? (
                    <h1>{activeTitle}</h1>
                  ) : null}
                  {resource.description && pageId === "root" ? (
                    <p className="cool-text">{resource.description}</p>
                  ) : null}
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
                <p className="cool-text mt-5 inline-flex items-center gap-2 text-xs">
                  <IconClock size={13} />
                  Updated {timeAgo(resource.updated_at || resource.created_at)}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
