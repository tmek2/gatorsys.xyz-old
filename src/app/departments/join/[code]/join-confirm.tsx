"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconCheck,
  IconLoader2,
  IconSearch,
  IconUsers,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { getDiscordSignInUrl } from "@/utils/discord-links";

export function JoinConfirmClient({
  code,
  embedded = false,
  onClose,
  onReset,
  onApplicationRequired,
}: {
  code: string;
  embedded?: boolean;
  onClose?: () => void;
  onReset?: () => void;
  onApplicationRequired?: () => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/departments/join/preview?code=${encodeURIComponent(code)}`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          window.location.href = getDiscordSignInUrl(
            `/servers?join=${encodeURIComponent(code)}`,
          );
          return;
        }
        if (!response.ok)
          throw new Error(body.detail || body.message || "That join code is invalid");
        if (!cancelled) setPreview(body);
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "That join code is invalid",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function confirmJoin() {
    setBusy(true);
    try {
      const response = await fetch("/api/departments/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase(), action: "join" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || "Could not join");
      if (body.state === "application_required") {
        if (embedded && onApplicationRequired) {
          onApplicationRequired();
        } else {
          router.push(
            `/servers?join=${encodeURIComponent(code)}&apply=1`,
          );
        }
        return;
      }
      if (body.state === "requested") {
        setResult(
          `Request sent! A ${body.department} manager needs to accept you before you appear on the roster.`,
        );
        return;
      }
      router.push(
        `/departments/${preview?.department?.serverId}/${encodeURIComponent(preview?.department?.id || "")}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  const department = preview?.department;
  return (
    <div className={embedded ? "w-full" : "mx-auto flex min-h-screen max-w-lg items-center px-4 pb-16 pt-28"}>
      <section className="glass-panel w-full rounded-2xl p-6 sm:p-8">
        {embedded ? (
          <button type="button" onClick={onClose} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white">
            <IconX size={14} /> Close
          </button>
        ) : (
          <Link
            href="/servers"
            className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white"
          >
            <IconArrowLeft size={14} /> Back to dashboard
          </Link>
        )}
        {error ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-white/40">
              <IconSearch size={22} />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-white">Not found</h3>
            <p className="cool-text mt-1 max-w-xs text-sm">
              Check that your join code is correct, then try again.
            </p>
            {embedded ? (
              <button
                type="button"
                onClick={onReset}
                className="btn-pop btn-peach mt-5 inline-flex px-4 py-2 text-sm"
              >
                Try again
              </button>
            ) : (
              <Link
                href="/servers?join=1"
                className="btn-pop btn-peach mt-5 inline-flex px-4 py-2 text-sm"
              >
                Try again
              </Link>
            )}
          </div>
        ) : !department ? (
          <div className="flex justify-center py-14">
            <IconLoader2 size={22} className="animate-spin text-white/35" />
          </div>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-[#f5f2f2]">
              {preview.state === "member"
                ? "You're already in this department"
                : "Is this your department?"}
            </h1>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111]">
              <div className="relative h-24 border-b border-[var(--accent-peach)]/70 bg-[radial-gradient(circle_at_15%_0%,rgb(var(--accent-rgb) / .2),transparent_55%),linear-gradient(145deg,#212121,#121212)]">
                {department.serverName ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/40 px-3 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
                    {department.serverIcon ? (
                      <img src={department.serverIcon} alt="" className="h-3.5 w-3.5 rounded-full" />
                    ) : null}
                    {department.serverName}
                  </span>
                ) : null}
                <span className="absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c] text-[var(--accent-peach)] shadow-xl">
                  {department.logo_url ? (
                    <img src={department.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <IconBuildingCommunity size={24} />
                  )}
                </span>
              </div>
              <div className="p-4 pt-8">
                <h2 className="text-base font-extrabold text-white">{department.name}</h2>
                <p className="cool-text mt-1 line-clamp-2 text-xs">
                  {department.description || "A department on Gator."}
                </p>
                <p className="cool-text mt-3 inline-flex items-center gap-2 text-xs">
                  <IconUsers size={13} />
                  {department.memberCount || 0} member
                  {(department.memberCount || 0) === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {result ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-[rgb(var(--accent-rgb)/0.25)] bg-[rgb(var(--accent-rgb)/0.06)] px-4 py-3 text-xs font-semibold text-[#ffd0cb]">
                <IconCheck size={14} className="mt-1 shrink-0" />
                {result}
              </p>
            ) : preview.state === "member" ? (
              <Link
                href={`/departments/${department.serverId}/${encodeURIComponent(department.id)}`}
                className="btn-pop btn-peach mt-5 flex h-11 w-full items-center justify-center text-sm"
              >
                Open {department.name}
              </Link>
            ) : preview.state === "requested" ? (
              <p className="cool-text mt-4 rounded-xl border border-white/[0.08] px-4 py-3 text-xs">
                Your membership request is waiting for a manager to accept it.
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmJoin()}
                className="btn-pop btn-peach mt-5 flex h-11 w-full items-center justify-center text-sm disabled:opacity-40"
              >
                {busy ? (
                  <IconLoader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <IconUsersGroup size={16} className="mr-2" />
                )}
                {preview.applicationGated ? "Continue to application" : `Join ${department.name}`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
