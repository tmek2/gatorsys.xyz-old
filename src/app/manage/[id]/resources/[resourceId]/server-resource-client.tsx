"use client";

import { useCallback, useEffect, useState } from "react";
import { absoluteLink, resourceLink } from "@/utils/short-links";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconFileText, IconLoader2 } from "@tabler/icons-react";
import { DepartmentDocumentEditor } from "@/components/Manage/department-document-editor";
import { DepartmentSpreadsheetEditor } from "@/components/Manage/department-spreadsheet-editor";

type Viewer = {
  id?: string | null;
  name?: string | null;
};

export function ServerResourceClient({
  guildId,
  resourceId,
  viewer,
}: {
  guildId: string;
  resourceId: string;
  viewer?: Viewer | null;
}) {
  const router = useRouter();
  const [resource, setResource] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    router.push(`/manage/${guildId}/resources`);
  }, [guildId, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/manage/${guildId}/deptresources`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not load this resource");
      }
      const match = (data.resources || []).find(
        (item: any) =>
          String(item.id) === String(resourceId) &&
          !item.department &&
          ["document", "spreadsheet"].includes(item.kind),
      );
      if (!match) throw new Error("This server resource could not be found.");
      setResource(match);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load this resource",
      );
    } finally {
      setLoading(false);
    }
  }, [guildId, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!resource) return;
    const response = await fetch(`/api/manage/${guildId}/deptresources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", resource }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "Could not save this resource");
    }
    const saved = (data.resources || []).find(
      (item: any) => String(item.id) === String(resource.id),
    );
    if (saved) setResource(saved);
  }

  async function remove() {
    if (!resource) return;
    const response = await fetch(`/api/manage/${guildId}/deptresources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: resource.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "Could not delete this resource");
    }
    router.replace(`/manage/${guildId}/resources`);
  }

  async function presence(typing: boolean) {
    const response = await fetch(`/api/manage/${guildId}/deptresources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "presence",
        id: resourceId,
        typing,
      }),
    });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data.presence || [] : [];
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-white/60">
          <IconLoader2 className="animate-spin text-[var(--accent-peach)]" size={20} />
          Opening your resource…
        </div>
      </div>
    );
  }

  if (!resource || error) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
          <IconFileText
            className="mx-auto text-[var(--accent-peach)]"
            size={32}
            strokeWidth={1.7}
          />
          <h1 className="mt-5 text-xl font-extrabold text-[#f5f2f2]">
            Resource unavailable
          </h1>
          <p className="cool-text mt-2 text-sm leading-6">{error}</p>
          <button
            type="button"
            onClick={close}
            className="gator-control gator-control-primary mx-auto mt-6 h-10 gap-2 px-4 text-sm"
          >
            <IconArrowLeft size={16} />
            Back to resources
          </button>
        </div>
      </div>
    );
  }

  if (resource.kind === "spreadsheet") {
    return (
      <DepartmentSpreadsheetEditor
        resource={resource}
        guildId={guildId}
        viewer={viewer ? { id: viewer.id || undefined, name: viewer.name || undefined } : null}
        onChange={setResource}
        onSave={save}
        onClose={close}
        onDelete={remove}
      />
    );
  }

  return (
    <DepartmentDocumentEditor
      resource={resource}
      guildId={guildId}
      shareUrl={absoluteLink(resourceLink("document", guildId, resource.id), window.location.origin)}
      onChange={setResource}
      onSave={save}
      onClose={close}
      onDelete={remove}
      onPresence={presence}
    />
  );
}
