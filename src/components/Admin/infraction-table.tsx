"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

/* A server's infractions, searched and opened. A case is prefetched when the
   pointer reaches its row (not every case on mount, which meant one request per
   row). */

interface Person {
  id?: string;
  name: string;
  avatar?: string | null;
}
interface Infraction {
  id: string;
  status?: string;
  created: string | number;
  user: Person;
  author: Person;
  action: { type: string; details: string };
}

export function InfractionTable({
  initialInfractions,
  guildId,
}: {
  initialInfractions: Infraction[];
  guildId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (initialInfractions || []).filter(
        (infraction) =>
          !term ||
          infraction.id.toLowerCase().includes(term) ||
          infraction.user.name.toLowerCase().includes(term) ||
          infraction.author.name.toLowerCase().includes(term) ||
          infraction.action.type.toLowerCase().includes(term) ||
          (infraction.action.details || "").toLowerCase().includes(term),
      ),
    [initialInfractions, term],
  );

  return (
    <div className="gs-cases">
      <label className="gs-search">
        <IconSearch size={16} aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a case, member or reason"
          aria-label="Find a case"
        />
        {term ? (
          <span className="gs-search-count">
            {shown.length} of {initialInfractions.length}
          </span>
        ) : null}
      </label>

      {shown.length ? (
        <div className="gs-case-list" role="list">
          <div className="gs-case-row gs-case-head" aria-hidden="true">
            <span>Case</span>
            <span>Member</span>
            <span>By</span>
            <span>Action</span>
            <span>Reason</span>
            <span>Date</span>
          </div>
          {shown.map((infraction) => (
            <Link
              key={infraction.id}
              role="listitem"
              href={`/panel/${guildId}/${infraction.id}`}
              prefetch={false}
              className="gs-case-row"
              data-status={infraction.status === "active" ? "active" : "closed"}
              onPointerEnter={() => router.prefetch(`/panel/${guildId}/${infraction.id}`)}
            >
              <span className="gs-case-id">{infraction.id}</span>
              <Who person={infraction.user} />
              <Who person={infraction.author} quiet />
              <span className="gs-case-action">{infraction.action.type}</span>
              <span className="gs-case-reason">{infraction.action.details || "No reason given"}</span>
              <span className="gs-case-date">
                {new Date(infraction.created).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="gs-empty">
          {term ? `No case matches “${search.trim()}”.` : "No infractions in this server yet."}
        </p>
      )}
    </div>
  );
}

function Who({ person, quiet = false }: { person: Person; quiet?: boolean }) {
  return (
    <span className="gs-who" data-quiet={quiet ? "true" : undefined}>
      {person.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar} alt="" className="gs-who-pic" />
      ) : (
        <span className="gs-who-pic" aria-hidden="true">
          {(person.name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="gs-who-name">{person.name}</span>
    </span>
  );
}
