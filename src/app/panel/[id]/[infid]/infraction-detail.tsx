"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconMailCheck,
  IconMailX,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { updateInfraction } from "./actions";

/* One case, where the bot's "View case" button lands: two cards, the reason
   edited where it is read, and delete confirms by changing its own label for a
   few seconds instead of a dialog. */

interface Person {
  id?: string;
  name: string;
  avatar?: string | null;
}

export function InfractionDetail({
  infraction: initial,
  guildId,
  infractionId,
}: {
  infraction: {
    status?: string;
    created: string | number;
    notified?: boolean;
    notify_failure?: string;
    user: Person;
    author: Person;
    action: { type: string; details: string; evidence?: string };
  };
  guildId: string;
  infractionId: string;
}) {
  const router = useRouter();
  const [infraction, setInfraction] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(initial.action.details);
  const [action, setAction] = useState(initial.action.type);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const next = { ...infraction, action: { ...infraction.action, type: action.trim(), details: reason.trim() } };
      await updateInfraction(guildId, infractionId, next);
      setInfraction(next);
      setEditing(false);
      router.refresh();
    } catch {
      setProblem("That didn’t save. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setDeleting(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/infractions/${guildId}/${infractionId}/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push(`/panel/${guildId}`);
      router.refresh();
    } catch {
      setProblem("That didn’t delete. Try again in a moment.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  const active = infraction.status === "active";

  return (
    <div className="gs-panel-shell">
      <Link href={`/panel/${guildId}`} className="gs-back">
        <IconArrowLeft size={15} aria-hidden="true" />
        All infractions
      </Link>
      <header className="gs-panel-head">
        <h1 className="gs-panel-title">
          Case <span className="gs-case-id">{infractionId}</span>
        </h1>
        <span className="gs-state" data-active={active ? "true" : undefined}>
          {active ? "Active" : infraction.status ? infraction.status.charAt(0).toUpperCase() + infraction.status.slice(1) : "Closed"}
        </span>
      </header>

      <div className="gs-case-grid">
        <section className="gs-card" aria-label="Who">
          <p className="gs-card-label">Member</p>
          <Person person={infraction.user} large />
          <p className="gs-card-label">Issued by</p>
          <Person person={infraction.author} />
          <p className="gs-line">
            <IconClock size={15} aria-hidden="true" />
            {new Date(infraction.created).toLocaleString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {/* Whether the member was actually told: Discord refuses a DM when the
             member has server DMs turned off. Older cases have no value and
             show nothing. */}
          {infraction.notified === true ? (
            <p className="gs-line">
              <IconMailCheck size={15} aria-hidden="true" />
              They were told by DM
            </p>
          ) : infraction.notified === false ? (
            <p className="gs-line" data-tone="warn">
              <IconMailX size={15} aria-hidden="true" />
              {infraction.notify_failure === "closed"
                ? "Not delivered: their DMs are closed to this server"
                : infraction.notify_failure === "missing"
                  ? "Not delivered: they are no longer in the server"
                  : "Not delivered: Discord refused the message"}
            </p>
          ) : null}
        </section>

        <section className="gs-card" aria-label="What">
          {editing ? (
            <form
              className="gs-edit"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label className="gs-field">
                <span className="gs-card-label">Action</span>
                <input value={action} onChange={(event) => setAction(event.target.value)} maxLength={100} autoFocus />
              </label>
              <label className="gs-field">
                <span className="gs-card-label">Reason</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} />
              </label>
              <div className="gs-acts">
                <button type="submit" className="gs-btn" disabled={saving || !action.trim()}>
                  <IconCheck size={15} aria-hidden="true" />
                  {saving ? "Saving" : "Save"}
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn-quiet"
                  onClick={() => {
                    setEditing(false);
                    setReason(infraction.action.details);
                    setAction(infraction.action.type);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="gs-card-label">Action</p>
              <p className="gs-action">{infraction.action.type}</p>
              <p className="gs-card-label">Reason</p>
              <p className="gs-reason">{infraction.action.details || "No reason given"}</p>
              {infraction.action.evidence ? (
                <>
                  <p className="gs-card-label">Details</p>
                  <p className="gs-reason gs-quiet">{infraction.action.evidence}</p>
                </>
              ) : null}
              <div className="gs-acts">
                <button type="button" className="gs-btn gs-btn-quiet" onClick={() => setEditing(true)}>
                  <IconPencil size={15} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn-danger"
                  data-armed={confirming ? "true" : undefined}
                  disabled={deleting}
                  onClick={() => void remove()}
                >
                  <IconTrash size={15} aria-hidden="true" />
                  {deleting ? "Deleting" : confirming ? "Press again to delete" : "Delete"}
                </button>
              </div>
            </>
          )}
          {problem ? <p className="gs-problem">{problem}</p> : null}
        </section>
      </div>
    </div>
  );
}

function Person({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <div className="gs-person" data-large={large ? "true" : undefined}>
      {person.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar} alt="" className="gs-who-pic" />
      ) : (
        <span className="gs-who-pic" aria-hidden="true">
          {(person.name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="gs-person-copy">
        <span className="gs-person-name">{person.name}</span>
        {person.id ? <span className="gs-person-id">{person.id}</span> : null}
      </span>
    </div>
  );
}
