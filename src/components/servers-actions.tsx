"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCheck as Check,
  IconDots as MoreHorizontal,
  IconRefresh as RefreshCw,
  IconSend as Send,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";

type ServersActionsProps = {
  inviteUrl: string;
  onRefresh: () => Promise<void>;
};

/** How long the button says it worked before going back to offering to. */
const SETTLED_MS = 1800;

export function ServersActions({ inviteUrl, onRefresh }: ServersActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [settled, setSettled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function refreshServers() {
    if (isPending) return;

    if (timer.current) clearTimeout(timer.current);
    setSettled(false);
    setIsPending(true);
    try {
      await onRefresh();
      /* The refresh button reports its own outcome: on a phone the cards are
         below the fold, so their re-entry is not visible. */
      setSettled(true);
      timer.current = setTimeout(() => setSettled(false), SETTLED_MS);
    } catch {
      /* The page puts up the message; this only has to not claim success. */
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="servers-actions">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <RippleButton
            aria-label="More server actions"
            variant="outline"
            size="icon"
          >
            <MoreHorizontal className="h-4 w-4" />
            <RippleButtonRipples />
          </RippleButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="servers-actions-menu"
        >
          <DropdownMenuItem
            className="servers-actions-item"
            onSelect={() => window.open(inviteUrl, "_blank", "noopener,noreferrer")}
          >
            <Send className="h-4 w-4" />
            Invite Bot
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RippleButton
        className="servers-cta"
        onClick={refreshServers}
        disabled={isPending}
        data-settled={settled ? "true" : undefined}
      >
        {settled ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        )}
        {/* Announced, for anyone who cannot see the tick and whose list is off
           screen. */}
        <span aria-live="polite">
          {isPending ? "Refreshing" : settled ? "Updated" : "Refresh"}
        </span>
        <RippleButtonRipples />
      </RippleButton>
    </div>
  );
}
