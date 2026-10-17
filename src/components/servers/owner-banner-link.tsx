"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { travel, wantsNewTab, warmTrip } from "@/utils/travel";

/** The picker's way into the owner page, as a trip: the picker sinks back
 *  while the owner page rises in (`data-leaving="owner"` in globals.css). */
export function OwnerBannerLink({ className, children }: { className: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href="/owner"
      className={className}
      onPointerEnter={() => warmTrip(router, "/owner")}
      onFocus={() => warmTrip(router, "/owner")}
      onClick={(event) => {
        if (wantsNewTab(event)) return;
        event.preventDefault();
        travel(router, "/owner", "owner", () => Boolean(document.querySelector(".owner-wrap")));
      }}
    >
      {children}
    </Link>
  );
}
