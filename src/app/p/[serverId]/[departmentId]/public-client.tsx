"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import Link from "next/link";
import {
  IconBook2,
  IconBuildingCommunity,
  IconChevronRight,
  IconLoader2,
  IconSpeakerphone,
  IconStar,
  IconTable,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { JoinConfirmClient } from "@/app/departments/join/[code]/join-confirm";
import { DepartmentJoinForm } from "@/app/departments/join/department-join-form";

/** "3 days ago"-style label for feed timestamps. */
function timeAgo(value?: string | null): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Public recruitment page for a department: identity, rank overview, and
 *  link-shared documents. Same visual language as the dashboard. */
export function PublicDepartmentClient({
  serverId,
  departmentId,
  viewer,
}: {
  serverId: string;
  departmentId: string;
  viewer?: { id: string; name: string; image?: string | null } | null;
}) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinApplication, setJoinApplication] = useState(false);
  const [showStickyApply, setShowStickyApply] = useState(false);

  // Surface a persistent Apply bar once the hero CTA scrolls out of view.
  useEffect(() => {
    const onScroll = () => setShowStickyApply(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!joinOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [joinOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/p/${serverId}/${departmentId}`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.detail || body.message || "This department has no public page",
          );
        if (!cancelled) setData(body);
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "This department has no public page",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId, serverId]);

  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] p-6 text-white">
        <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
          <IconBuildingCommunity size={22} className="mx-auto text-white/25" />
          <p className="mt-3 text-sm font-bold">{error}</p>
          <Link
            href="/"
            className="btn-pop btn-peach mt-5 inline-flex px-4 py-2 text-sm"
          >
            Go home
          </Link>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <IconLoader2 className="animate-spin text-white/35" />
      </main>
    );

  const department = data.department || {};
  const accent = department.accent_color || "#f7a8c4";
  const announcements = (data.announcements || []) as Array<{
    id: string;
    author?: string;
    avatar?: string | null;
    content?: string;
    created_at?: string;
  }>;
  const leadership = (data.leadership || []) as Array<{
    name: string;
    avatar?: string | null;
  }>;
  const newMembers30d = Number(data.activity?.newMembers30d || 0);
  const joinHref = data.join?.code
    ? `/servers?join=${encodeURIComponent(data.join.code)}`
    : "/servers?join=1";
  return (
    <main
      className="min-h-screen bg-[#080808] text-white"
      style={{ "--accent-peach": accent } as CSSProperties}
    >
      <div
        className=""
        style={{
          backgroundImage: `radial-gradient(circle at 20% 0%, color-mix(in srgb, ${accent} 18%, transparent), transparent 55%), linear-gradient(160deg,#1a1a1a,#0c0c0c)`,
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-5 py-10 text-center sm:flex-row sm:items-center sm:py-12 sm:text-left sm:px-8">
          {department.logo_url ? (
            <img
              src={department.logo_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-2xl border border-white/[0.08] object-cover shadow-2xl"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]">
              <IconBuildingCommunity size={34} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
              {department.name}
            </h1>
            <p className="cool-text mx-auto mt-2 max-w-2xl text-pretty text-sm leading-6 sm:mx-0">
              {department.description || "A department on Gator."}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/70">
                <IconUsers size={13} />
                {department.memberCount || 0} member
                {(department.memberCount || 0) === 1 ? "" : "s"}
              </span>
              {department.serverName ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/70">
                  {department.serverIcon ? (
                    <img
                      src={department.serverIcon}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : null}
                  {department.serverName}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              data.join?.code ? setJoinOpen(true) : (window.location.href = joinHref)
            }
            className="btn-pop btn-peach inline-flex h-11 w-full items-center justify-center gap-2 px-5 text-sm sm:w-auto"
          >
            {data.join?.applicationGated ? "Apply to join" : "Join with a code"}
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>
      {/* Stats band — quick at-a-glance numbers. */}
      <div className="border-y border-white/[0.08] bg-white/[0.01]">
        <div className="mx-auto grid grid-cols-2 max-w-5xl divide-x divide-white/[0.06] px-5 sm:grid-cols-4 sm:px-8">
          {[
            { label: "Members", value: department.memberCount || 0 },
            { label: "Ranks", value: (data.ranks || []).length },
            { label: "Resources", value: (data.documents || []).length },
            { label: "Joined this month", value: newMembers30d },
          ].map((stat) => (
            <div key={stat.label} className="py-5 text-center">
              <p className="text-2xl font-extrabold text-[var(--accent-peach)] sm:text-3xl">
                {stat.value}
              </p>
              <p className="cool-text mt-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl gap-5 px-5 pb-28 pt-8 sm:px-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
            Rank ladder
          </h2>
          <div className="mt-3 space-y-2">
            {(() => {
              const ranks = data.ranks || [];
              const maxMembers = Math.max(1, ...ranks.map((r: any) => r.members || 0));
              return ranks.map((rank: any, index: number) => (
                <div key={index} className="rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: rank.color || "var(--accent-peach)" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/75">
                      {rank.name}
                    </span>
                    <span className="cool-text text-xs tabular-nums">{rank.members}</span>
                  </div>
                  {/* Proportional bar so the roster shape reads at a glance. */}
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.round(((rank.members || 0) / maxMembers) * 100)}%`,
                        backgroundColor: rank.color || "var(--accent-peach)",
                        opacity: 0.75,
                      }}
                    />
                  </div>
                </div>
              ));
            })()}
            {!(data.ranks || []).length ? (
              <p className="cool-text py-4 text-center text-sm">
                No ranks published.
              </p>
            ) : null}
          </div>
          {leadership.length ? (
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
                <IconStar size={14} />
                Leadership
              </h2>
              <ul className="mt-3 space-y-3">
                {leadership.map((leader, index) => (
                  <li key={`${leader.name}-${index}`} className="flex items-center gap-3">
                    {leader.avatar ? (
                      <img
                        src={discordAvatarUrl(leader.avatar) || ""}
                        alt=""
                        className="h-7 w-7 rounded-full border border-white/[0.08] object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-white/60">
                        {(leader.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                      {leader.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        <section>
          {announcements.length ? (
            <div className="mb-8">
              <h2 className="flex items-center gap-2 px-1 text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
                <IconSpeakerphone size={14} />
                Latest announcements
              </h2>
              <div className="list-stagger mt-3 space-y-3">
                {announcements.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-4"
                  >
                    <div className="flex items-center gap-3">
                      {item.avatar ? (
                        <img
                          src={discordAvatarUrl(item.avatar) || ""}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent-peach)_16%,transparent)] text-[10px] font-bold text-[var(--accent-peach)]">
                          {(item.author || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-white/85">
                        {item.author || "Department"}
                      </span>
                      <span className="cool-text ml-auto shrink-0 text-xs">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                    <p className="cool-text mt-3 whitespace-pre-wrap text-sm leading-6">
                      {item.content}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {newMembers30d > 0 ? (
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent-peach)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)] px-4 py-3">
              <IconTrendingUp size={18} className="shrink-0 text-[var(--accent-peach)]" />
              <p className="text-sm text-white/80">
                <span className="font-bold text-[var(--accent-peach)]">
                  {newMembers30d} member{newMembers30d === 1 ? "" : "s"}
                </span>{" "}
                joined in the last 30 days.
              </p>
            </div>
          ) : null}
          <h2 className="px-1 text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
            Public documents &amp; sheets
          </h2>
          <div className="list-stagger mt-3 grid gap-3 md:grid-cols-2">
            {(data.documents || []).map((doc: any) => {
              const isSheet = doc.kind === "spreadsheet";
              return (
                <Link
                  key={doc.id}
                  href={`/docs/shared/${serverId}/${doc.id}`}
                  className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121212] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16]"
                >
                  <div className="h-16 border-b border-[var(--accent-peach)]/70 bg-[linear-gradient(145deg,#232323,#141414)]" />
                  <div className="p-4">
                    {isSheet ? (
                      <IconTable size={17} className="text-[var(--accent-peach)]" />
                    ) : (
                      <IconBook2 size={17} className="text-[var(--accent-peach)]" />
                    )}
                    <p className="mt-4 text-sm font-bold text-white/85">
                      {doc.title}
                    </p>
                    <p className="cool-text mt-1 line-clamp-2 text-xs">
                      {doc.description ||
                        (isSheet ? "Department spreadsheet" : "Department document")}
                    </p>
                  </div>
                </Link>
              );
            })}
            {!(data.documents || []).length ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] py-10 text-center md:col-span-2">
                <p className="cool-text text-sm">
                  No public documents have been shared yet.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {/* Persistent apply bar once the hero CTA scrolls away. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[120] border-t border-white/[0.08] bg-[#0c0c0c]/95 backdrop-blur transition-transform duration-300 ${
          showStickyApply && !joinOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div
          className="safe-bottom mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 pt-3 sm:px-8"
          style={{ ["--safe-bottom-gap" as string]: "0.75rem" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white/90">{department.name}</p>
            <p className="cool-text truncate text-xs">
              {department.memberCount || 0} member{(department.memberCount || 0) === 1 ? "" : "s"}
              {department.serverName ? ` · ${department.serverName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              data.join?.code ? setJoinOpen(true) : (window.location.href = joinHref)
            }
            className="btn-pop btn-peach inline-flex h-10 shrink-0 items-center gap-2 px-5 text-sm"
          >
            {data.join?.applicationGated ? "Apply to join" : "Join with a code"}
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>
      {joinOpen && data.join?.code ? (
        <div role="dialog" aria-modal="true" aria-label="Join department" className="fixed inset-0 z-[180] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" onClick={() => setJoinOpen(false)} aria-label="Close join dialog" />
          <div className="relative z-10 w-full max-w-lg">
            {joinApplication ? (
              <DepartmentJoinForm
                embedded
                initialCode={data.join.code}
                autoSubmit
                viewer={viewer}
                onClose={() => {
                  setJoinApplication(false);
                  setJoinOpen(false);
                }}
              />
            ) : (
              <JoinConfirmClient
                code={data.join.code}
                embedded
                onClose={() => setJoinOpen(false)}
                onApplicationRequired={() => setJoinApplication(true)}
              />
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
