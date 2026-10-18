"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import type {
  DepartmentMembership,
  MutualGuild,
  MutualGuildsResponse,
} from "@/types/discord";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconBuildingCommunity,
  IconArrowRight,
  IconDotsVertical,
  IconFolder,
  IconHome,
  IconLogout,
  IconSearch,
  IconSettings,
  IconTicket,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import ServerCard from "@/components/server-card";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";
import { SUPPORT_URL } from "@/config/site";
import {
  readPinned,
  togglePinned,
} from "@/components/servers/pinned-communities";
import {
  grow,
  height,
  leave,
  motionAllowed,
  positions,
  settle,
} from "@/components/servers/reflow";
import type { Spot } from "@/components/servers/reflow";
import { NoServersFound } from "@/components/no-servers";
import { EmptyBox } from "@/components/servers/empty-box";
import { ServersActions } from "@/components/servers-actions";
import { JoinConfirmClient } from "@/app/departments/join/[code]/join-confirm";
import { DepartmentJoinForm } from "@/app/departments/join/department-join-form";

type ServersContentProps = {
  initialServers: MutualGuild[];
  initialDepartments: DepartmentMembership[];
  initialError: string | null;
  inviteUrl: string;
  user: {
    id: string;
    image?: string | null;
    name: string;
  };
};

/** The department tabs a card's menu links to, and what each one is called. */
const DEPARTMENT_TABS = [
  { tab: "home", label: "Overview", icon: IconHome },
  { tab: "roster", label: "Roster", icon: IconUsers },
  { tab: "resources", label: "Resources", icon: IconFolder },
] as const;

/* How many columns the picker shows, from the same breakpoints as the CSS,
   because cards are dealt into real columns in the markup.
   `useSyncExternalStore` so there is a server snapshot (this decides what
   renders). */
const COLUMN_STEPS = [
  { query: "(min-width: 1280px)", columns: 4 },
  { query: "(min-width: 1024px)", columns: 3 },
  { query: "(min-width: 640px)", columns: 2 },
];

function readColumns() {
  if (typeof window === "undefined" || !window.matchMedia) return 4;
  const step = COLUMN_STEPS.find(({ query }) => window.matchMedia(query).matches);
  return step ? step.columns : 1;
}

function subscribeToColumns(notify: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const lists = COLUMN_STEPS.map(({ query }) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", notify));
  return () => lists.forEach((list) => list.removeEventListener("change", notify));
}

/**
 * Cards dealt across the columns in turn, so the first row still reads in list
 * order. Columns rather than grid cells: a grid row shares one height, so a
 * card that grows would move its whole row and everything below.
 */
function dealIntoColumns<T>(items: T[], columns: number): T[][] {
  const lanes: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  items.forEach((item, index) => lanes[index % lanes.length].push(item));
  return lanes;
}

const refreshError =
  "We couldn't refresh your Discord servers right now. Your current list is still available.";

export function ServersContent({
  initialServers,
  initialDepartments,
  initialError,
  inviteUrl,
  user,
}: ServersContentProps) {
  const [servers, setServers] = useState(initialServers);
  const [departments, setDepartments] = useState(initialDepartments);
  const [error, setError] = useState<string | null>(initialError);
  const [filter, setFilter] = useState("");
  const [pins, setPins] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [pinNotice, setPinNotice] = useState("");
  const pinKey = `gator:pinned:${user.id}`;

  /* Cards animate in on refresh and on first arrival (the Suspense placeholder
     has the same shapes, so without this nothing visibly happens). Driven by a
     counter through the Web Animations API rather than by re-keying the grid,
     which would remount every card and refetch its images. */
  const [refreshed, setRefreshed] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  /* The box around the list, which the rest of the page sits under. Separate
     from the grid because the grid can be absent (an empty pinned filter) and
     that change also needs a height to animate. */
  const listBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = grid.current;
    if (!node || typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const runs = Array.from(node.querySelectorAll<HTMLElement>(".sv-frame")).map(
      (card, index) =>
        card.animate(
          [
            { opacity: 0, transform: "translateY(7px) scale(0.985)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 300,
            /* Capped, so a picker of twenty does not take two seconds to
               finish telling you it reloaded. */
            delay: Math.min(index, 7) * 32,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "backwards",
          },
        ),
    );
    return () => runs.forEach((run) => run.cancel());
  }, [refreshed]);
  useEffect(() => {
    try {
      setPins(readPinned(localStorage.getItem(pinKey)));
    } catch {
      setPins([]);
    }
  }, [pinKey]);
  /* Filtering to pinned and back animates all three parts: leaving cards go,
     staying cards move to their new places, arriving cards appear. Leaving
     cards finish before the state changes, because React is about to remove
     them. */
  function showPinnedOnly(next: boolean) {
    // Pressing the filter you are already on is not a change to animate.
    if (next === pinnedOnly) return;
    const node = grid.current;
    const box = listBox.current;
    if (!box || !motionAllowed()) {
      setPinnedOnly(next);
      return;
    }
    /* The grid may be absent (switching to or from an empty pinned list), and
       the change should still animate. */
    const before = node ? positions(node) : new Map();
    const tall = height(box);
    const top = document.documentElement.scrollTop;
    const going =
      next && node
        ? Array.from(node.querySelectorAll<HTMLElement>(".sv-frame")).filter(
            (card) => !pins.includes(card.dataset.serverId || ""),
          )
        : [];

    void leave(going).then(() => {
      moved.current = { before, tall, top };
      setPinnedOnly(next);
    });
  }

  /* Surviving cards move once the new list is in the document: a layout effect
     runs after the DOM update and before paint, which FLIP needs (a
     requestAnimationFrame after setState can run before React commits). */
  const moved = useRef<{
    before: Map<string, Spot>;
    tall: number;
    top: number;
  } | null>(null);
  useLayoutEffect(() => {
    const was = moved.current;
    moved.current = null;
    if (!was) return;
    const node = grid.current;
    const box = listBox.current;
    if (node) settle(node, was.before);
    /* The page below closes up on the same timing instead of jumping. */
    if (box) grow(box, was.tall, was.top);
    /* Both of the things that reorder the list: the filter, and a pin. */
  }, [pinnedOnly, pins]);

  /* Pinning moves a card to the front (the list is pinned-first), so the card
     and the ones it passes animate with the same FLIP as the filter. Unpinning
     while filtered to pinned removes the card with the leaving animation. */
  function pin(id: string) {
    const next = togglePinned(pins, id);
    const node = grid.current;

    const remember = () => {
      try {
        localStorage.setItem(pinKey, JSON.stringify(next));
        setPinNotice("");
      } catch {
        setPinNotice(
          "Pins are available for this visit. Browser storage is unavailable.",
        );
      }
    };

    const box = listBox.current;
    if (!node || !box || !motionAllowed()) {
      setPins(next);
      remember();
      return;
    }

    /* Measured before anything animates (`leave` adds transforms). */
    const before = positions(node);
    const tall = height(box);
    const top = document.documentElement.scrollTop;
    const going =
      pinnedOnly && !next.includes(id)
        ? Array.from(node.querySelectorAll<HTMLElement>(".sv-frame")).filter(
            (card) => card.dataset.serverId === id,
          )
        : [];

    void leave(going).then(() => {
      moved.current = { before, tall, top };
      setPins(next);
    });
    remember();
  }
  const columnCount = useSyncExternalStore(
    subscribeToColumns,
    readColumns,
    () => 4,
  );
  const filterQuery = filter.trim().toLowerCase();


  const visibleServers = servers
    .filter(
      (server) =>
        (!filterQuery || server.name.toLowerCase().includes(filterQuery)) &&
        (!pinnedOnly || pins.includes(server.id)),
    )
    .sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
  const router = useRouter();
  const searchParams = useSearchParams();
  // Join links land here (?join=CODE) and open the confirmation as a form
  // over the dashboard instead of a separate page.
  const [joinCode, setJoinCode] = useState(() => {
    const requested = searchParams?.get("join") || "";
    return requested === "1" ? "" : requested;
  });
  const [joinOpen, setJoinOpen] = useState(() =>
    Boolean(searchParams?.get("join")),
  );
  const [joinDraft, setJoinDraft] = useState("");
  const [joinApplication, setJoinApplication] = useState(
    () => searchParams?.get("apply") === "1",
  );
  /* Only once there is something to be wrong about. An empty field is not a
     mistake, it is a field nobody has typed in yet. */
  const joinDialog = useRef<HTMLDivElement>(null);
  const tooShort = joinDraft.trim().length > 0 && joinDraft.trim().length < 3;
  useEffect(() => {
    if (!joinOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement as HTMLElement | null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeJoin();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        joinDialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),a[href],select,textarea,[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !joinDialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !joinDialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      opener?.focus({ preventScroll: true });
    };
  }, [joinOpen]);
  function closeJoin() {
    setJoinOpen(false);
    setJoinCode("");
    setJoinDraft("");
    setJoinApplication(false);
    if (searchParams?.get("join")) router.replace("/servers");
  }

  async function refreshServers() {
    try {
      const response = await fetch("/api/mutual?refresh=1", {
        cache: "no-store",
      });
      const data = (await response.json()) as MutualGuildsResponse & {
        error?: string;
      };

      if (!response.ok || !Array.isArray(data.mutual)) {
        throw new Error(data.error || "Failed to refresh servers");
      }

      setServers(data.mutual);
      setDepartments(data.departments || []);
      setError(null);
      setRefreshed((count) => count + 1);
    } catch (refreshFailure) {
      console.error("Error refreshing servers:", refreshFailure);
      setError(refreshError);
      /* Rethrown so the refresh button reports the failure where the user is
         looking. */
      throw refreshFailure;
    }
  }

  return (
    <>
      {/* A page header: the heading and the controls for the list below it. */}
      <section className="servers-hero">
        <div className="servers-hero-top">
          <div className="servers-hero-title">
            <h1>
              Pick a <span>server.</span>
              {servers.length > 0 ? (
                <span className="servers-count">{servers.length}</span>
              ) : null}
            </h1>
            {/* No line under the heading; the count beside it says enough. */}
          </div>
          {/* The filter chips share the heading's line with search and refresh. */}
          {servers.length > 0 ? (
            <div
              className="servers-collection-tools"
              role="group"
              aria-label="Show communities"
            >
              <button
                type="button"
                aria-pressed={!pinnedOnly}
                onClick={() => showPinnedOnly(false)}
              >
                All servers
              </button>
              <button
                type="button"
                aria-pressed={pinnedOnly}
                onClick={() => showPinnedOnly(true)}
              >
                Pinned{" "}
                <span>
                  {servers.filter((server) => pins.includes(server.id)).length}
                </span>
              </button>
            </div>
          ) : null}
          {servers.length > 0 ? (
            <div className="servers-list-tools">
              {servers.length > 0 ? (
                <label className="servers-filter-field">
                  <IconSearch size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    /* "Search" fits the field; the aria-label carries the rest. */
                    placeholder="Search"
                    aria-label="Filter servers by name"
                    className="servers-filter"
                  />
                </label>
              ) : null}
              <ServersActions
                inviteUrl={inviteUrl}
                onRefresh={refreshServers}
              />
            </div>
          ) : null}
        </div>

        {/* The servers sit inside the hero, so the prompt and the choices are on
           screen together. */}
        {servers.length > 0 ? (
          <div
            className="servers-hero-list"
            aria-label="Your servers"
            ref={listBox}
          >
            {pinNotice && (
              <p role="status" className="servers-pin-notice">
                {pinNotice}
              </p>
            )}
            {visibleServers.length > 0 ? (
              <div className="servers-window-grid" ref={grid}>
                {dealIntoColumns(visibleServers, columnCount).map(
                  (lane, index) => (
                    <div className="servers-window-column" key={index}>
                      {lane.map((server) => (
                        <ServerCard
                          key={server.id}
                          pinned={pins.includes(server.id)}
                          onPin={() => pin(server.id)}
                          name={server.name}
                          iconUrl={server.icon}
                          bannerUrl={server.banner}
                          splashUrl={server.splash}
                          id={server.id}
                          memberCount={server.memberCount}
                          moduleCount={server.moduleCount}
                        />
                      ))}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="servers-filter-empty">
                {filter.trim()
                  ? `No server matches “${filter.trim()}”.`
                  : "No pinned servers yet. Pin a community from All servers."}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {error && servers.length > 0 ? (
        <p role="status" className="servers-error">
          {error}
        </p>
      ) : null}

      {servers.length === 0 ? (
        <section className="servers-list-section" aria-label="Your servers">
          <div className="servers-empty-wrap">
            {/* An empty list is the first minute of using the product, so it
               invites the one action that changes it. A real error still gets a
               plain report. */}
            {error ? (
              <NoServersFound
                title="Unable to Load Servers"
                description={error}
              />
            ) : (
              <EmptyBox inviteUrl={inviteUrl} />
            )}
          </div>
        </section>
      ) : null}
      {departments.length ? (
        <section className="servers-departments">
          <div className="servers-section-heading servers-section-heading-row">
            <div>
              <h2>Departments</h2>
              <p>Bot departments you are in.</p>
            </div>
            <RippleButton
              onClick={() => setJoinOpen(true)}
              variant="outline"
              size="sm"
            >
              <IconTicket size={14} />
              Join with a code
              <RippleButtonRipples />
            </RippleButton>
          </div>
          <div className="servers-grid">
            {departments.map((department) => (
              <DepartmentCard
                key={`${department.parentGuildId}:${department.id}`}
                department={department}
                onLeft={(left) =>
                  setDepartments((current: any[]) =>
                    current.filter(
                      (item) =>
                        !(
                          item.id === left.id &&
                          item.parentGuildId === left.parentGuildId
                        ),
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}
      {/* Two cards side by side at the foot, each action next to what it does. */}
      <section className="servers-utility" aria-label="Community help">
        {!departments.length && (
          <button type="button" onClick={() => setJoinOpen(true)}>
            <IconTicket size={16} /> Join a department with a code
          </button>
        )}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
          Need a hand? Bot support <IconArrowRight size={14} />
        </a>
      </section>
      {joinOpen ? (
        <div
          ref={joinDialog}
          role="dialog"
          aria-modal="true"
          aria-label="Join a department"
          className="dialog-backdrop fixed inset-0 z-[180] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={closeJoin}
            aria-label="Close join dialog"
          />
          <div className="dialog-pop relative z-10 w-full max-w-lg">
            {joinApplication && joinCode ? (
              <DepartmentJoinForm
                embedded
                initialCode={joinCode}
                autoSubmit
                onClose={closeJoin}
                viewer={user}
              />
            ) : joinCode ? (
              <JoinConfirmClient
                code={joinCode}
                embedded
                onClose={closeJoin}
                onReset={() => {
                  setJoinCode("");
                  setJoinDraft("");
                }}
                onApplicationRequired={() => setJoinApplication(true)}
              />
            ) : (
              <section className="servers-join-dialog">
                {/* A title bar and a stack, like every sheet on the site. */}
                <header className="servers-dialog-heading">
                  <h2>Join a Department</h2>
                  <RippleButton
                    onClick={closeJoin}
                    className="servers-dialog-close"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close"
                  >
                    <IconX size={17} />
                    <RippleButtonRipples />
                  </RippleButton>
                </header>
                <div className="servers-dialog-body">
                  <p className="servers-dialog-say">
                    The code a department gave you.
                  </p>
                  <label className="servers-dialog-field">
                    {/* No asterisk. There is one field and it is the sheet, so
                        marking it required says nothing. */}
                    <span className="servers-dialog-label">Join code</span>
                    <input
                      value={joinDraft}
                      autoFocus
                      maxLength={20}
                      placeholder="LSPD"
                      aria-invalid={tooShort || undefined}
                      aria-describedby={tooShort ? "join-code-note" : undefined}
                      onChange={(event) =>
                        setJoinDraft(event.target.value.toUpperCase())
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          joinDraft.trim().length >= 3
                        )
                          setJoinCode(joinDraft.trim());
                      }}
                      className="servers-code-input"
                      data-invalid={tooShort || undefined}
                    />
                    {tooShort ? (
                      <span className="servers-dialog-note" id="join-code-note">
                        Join codes are at least three characters.
                      </span>
                    ) : null}
                  </label>
                  <RippleButton
                    disabled={joinDraft.trim().length < 3}
                    onClick={() => setJoinCode(joinDraft.trim())}
                    className="servers-cta servers-cta-wide"
                  >
                    Join
                    <RippleButtonRipples />
                  </RippleButton>
                </div>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function DepartmentCard({
  department,
  onLeft,
}: {
  department: any;
  onLeft: (department: any) => void;
}) {
  /* Shut, open, or closing. Three states so the menu stays mounted while it
     animates out, then removes itself when its animation ends. */
  const [menu, setMenu] = useState<"shut" | "open" | "going">("shut");
  const menuOpen = menu === "open";
  // Two steps, because leaving drops your rank and your roster row and there
  // is no undo — the bot marks the membership inactive and stamps `left_at`.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  async function leaveDepartment() {
    setLeaving(true);
    setLeaveError("");
    try {
      const response = await fetch(
        `/api/manage/${department.parentGuildId}/departmentaction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "membership_leave",
            department_id: department.id,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not leave this department");
      }
      onLeft(department);
    } catch (error) {
      setLeaveError(
        error instanceof Error
          ? error.message
          : "Could not leave this department",
      );
      setLeaving(false);
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu("going");
    };
    /* Escape closes it, returning focus to the button that opened it. */
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setMenu("going");
      kebabRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menuOpen]);

  /* Removed when its exit animation ends, with a fallback timer in case
     `animationend` never arrives. */
  useEffect(() => {
    if (menu !== "going") return;
    const drop = () => {
      setMenu("shut");
      setConfirmLeave(false);
    };
    const timer = window.setTimeout(drop, 420);
    return () => window.clearTimeout(timer);
  }, [menu]);
  const canManage = (department.permissions || []).some((permission: string) =>
    ["administrator", "manage_members", "manage_resources"].includes(
      permission,
    ),
  );
  const accent = department.accentColor || department.accent_color || "#f7a8c4";
  return (
    <article
      className="servers-department-card group"
      /* The card is what gets raised while its menu is open — see the note in
         servers.css. Raising the menu alone could not work. */
      data-menu-open={menu === "shut" ? "false" : "true"}
    >
      <Link
        href={`/departments/${department.parentGuildId}/${encodeURIComponent(department.id)}`}
        className="block"
      >
        <div
          className="servers-department-art"
          style={
            {
              "--department-accent": accent,
            } as CSSProperties
          }
        >
          {department.serverName ? (
            <span className="servers-department-server">
              {department.serverIcon ? (
                <img
                  src={department.serverIcon}
                  alt=""
                  className="h-3.5 w-3.5 rounded-full"
                />
              ) : null}
              <span className="truncate">{department.serverName}</span>
            </span>
          ) : null}
          <span className="servers-department-icon">
            {department.icon ? (
              <img
                src={department.icon}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <IconBuildingCommunity size={22} />
            )}
          </span>
        </div>
        <div className="servers-department-body">
          <h3>{department.name}</h3>
          {department.description ? <p>{department.description}</p> : null}
          <p className="servers-department-count">
            {department.memberCount || 0} department member
            {(department.memberCount || 0) === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
      <div ref={menuRef} className="absolute bottom-3 right-3 z-20">
        <RippleButton
          ref={kebabRef}
          onClick={() => setMenu(menuOpen ? "going" : "open")}
          className="servers-department-menu-button"
          /* A glyph on its own, so the variant for a glyph on its own --
             which is also the one that draws no bevel behind it. */
          variant="ghost"
          size="icon-sm"
          aria-label="Department options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <IconDotsVertical size={17} />
          <RippleButtonRipples />
        </RippleButton>
        {menu !== "shut" ? (
          <div
            className="servers-department-menu"
            data-state={menuOpen ? "open" : "closed"}
            role="menu"
            onAnimationEnd={(event) => {
              // Its own animation, not one of a row inside it.
              if (event.target !== event.currentTarget) return;
              if (menu === "going") {
                setMenu("shut");
                setConfirmLeave(false);
              }
            }}
          >
            {/* Written labels, not the query values sent. */}
            {/* Every row has its glyph. */}
            {DEPARTMENT_TABS.map(({ tab, label, icon: Glyph }) => (
              <Link
                key={tab}
                href={`/departments/${department.parentGuildId}/${encodeURIComponent(department.id)}?tab=${tab}`}
                className="servers-department-menu-item"
                role="menuitem"
                onClick={() => setMenu("going")}
              >
                <Glyph size={13} />
                {label}
              </Link>
            ))}
            {/* One divider, between the three views and the actions. */}
            <div className="h-px" />
            {canManage ? (
              <Link
                href={`/manage/${department.parentGuildId}/departments?department=${encodeURIComponent(department.id)}`}
                className="servers-department-menu-item servers-department-manage"
              >
                <IconSettings size={13} />
                Manage department
              </Link>
            ) : null}
            {/* Leave department (the bot accepts `membership_leave`). */}
            {confirmLeave ? (
              <button
                type="button"
                disabled={leaving}
                onClick={leaveDepartment}
                className="servers-department-menu-item servers-department-leave-confirm"
              >
                <IconLogout size={13} />
                {leaving ? "Leaving…" : `Leave ${department.name}?`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="servers-department-menu-item servers-department-leave"
              >
                <IconLogout size={13} />
                Leave department
              </button>
            )}
            {leaveError ? (
              <p className="servers-department-leave-error" role="alert">
                {leaveError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
