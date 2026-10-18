"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus, IconUpload } from "@tabler/icons-react";
import { FieldRow, SettingsCard, TextField } from "../fields";
import { useManage } from "../manage-context";
import { SectionHeader } from "../section-header";
import { identityFromProfile, publishBotIdentity, settleBotIdentity } from "../bot-identity";
import { validateProfileImage } from "../message-media";

interface BotProfile {
  display_name: string | null;
  avatar: string | null;
  banner: string | null;
  global_name: string | null;
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * An image you can set: the tile is the control (press or drop a file on it).
 * The new picture develops in from a blur, and a band of light runs across it
 * while it uploads with the save.
 */
function ImageField({
  label,
  hint,
  preview,
  rounded,
  uploading,
  onPick,
  onReset,
  onError,
}: {
  label: string;
  hint: string;
  preview: string | null;
  rounded?: boolean;
  /** The picture is on its way up with the save. */
  uploading?: boolean;
  onPick: (dataUrl: string) => void;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const noun = label.toLowerCase();

  async function take(file: File | null | undefined) {
    if (!file) return;
    try {
      validateProfileImage(file);
      onPick(await readImageFile(file));
    } catch (error) {
      onError(error instanceof Error ? error.message : "That picture could not be read.");
    }
  }

  return (
    <div className="gw-upload">
      <div>
        <p className="gw-set-name">{label}</p>
        <p className="gw-set-note">{hint}</p>
      </div>
      <div className="gw-upload-row">
        <button
          type="button"
          className="gw-upload-tile"
          data-shape={rounded ? "round" : "wide"}
          data-over={over ? "true" : undefined}
          data-busy={uploading ? "true" : undefined}
          aria-label={preview ? `Replace the ${noun}` : `Upload a ${noun}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void take(event.dataTransfer.files?.[0]);
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={preview} src={preview} alt="" className="gw-upload-img" />
          ) : (
            <span className="gw-upload-empty">
              <IconPlus size={18} stroke={2} aria-hidden="true" />
            </span>
          )}
          <span className="gw-upload-veil" aria-hidden="true">
            <IconUpload size={16} stroke={2} />
          </span>
          {/* Once per picture: a ring that blooms off the edge as it lands. */}
          {preview ? <span key={`ring:${preview}`} className="gw-upload-ring" aria-hidden="true" /> : null}
        </button>
        <div className="gw-upload-acts">
          <button type="button" className="gw-upload-go" onClick={() => inputRef.current?.click()}>
            {preview ? "Replace" : "Upload"}
          </button>
          <button type="button" className="gw-upload-reset" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={async (event) => {
          await take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function CustomizationSection() {
  const { guildId, meta, setNotice, registerExternalDraft, setExternalDraftDirty } = useManage();
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [resets, setResets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/manage/${guildId}/botprofile`);
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.profile) throw new Error("Could not load the bot's profile.");
      setProfile(json.profile);
      setDisplayName(json.profile.display_name || "");
      setAvatar(json.profile.avatar || null);
      setBanner(json.profile.banner || null);
    } catch {
      setLoadError("Could not load the bot's saved profile. Retry before editing or saving.");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { void load(); }, [load]);

  /* Every preview on the dashboard signs with this profile, so edits show there
     before saving. Leaving without saving restores the saved one. */
  useEffect(() => {
    if (!profile) return;
    const saved = identityFromProfile(profile);
    publishBotIdentity(guildId, {
      name: displayName.trim() || profile.global_name || saved.name,
      avatar: avatar || identityFromProfile({ ...profile, avatar: null }).avatar,
    });
  }, [guildId, profile, displayName, avatar]);
  useEffect(() => () => publishBotIdentity(guildId, null), [guildId]);

  const dirty = profile !== null && (
    displayName !== (profile.display_name || "") ||
    (avatar || null) !== (profile?.avatar || null) ||
    (banner || null) !== (profile?.banner || null) ||
    resets.size > 0);

  function markReset(field: string, clearedPreview: () => void) {
    setResets((current) => new Set(current).add(field));
    clearedPreview();
  }

  /* Saved through the dashboard's save prompt with everything else: an edit
     here raises it, Save writes it, Discard restores the saved profile. */
  async function persist() {
    if (!profile || loading || loadError || saving) return false;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { reset_fields: Array.from(resets) };
      if (displayName !== (profile?.display_name || "")) payload.display_name = displayName;
      if (avatar && avatar.startsWith("data:")) payload.avatar = avatar;
      if (banner && banner.startsWith("data:")) payload.banner = banner;
      const res = await fetch(`/api/manage/${guildId}/botprofile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || err?.message || "The bot's profile could not be updated");
      }
      setResets(new Set());
      const refresh = await fetch(`/api/manage/${guildId}/botprofile`);
      const refreshed = await refresh.json().catch(() => null);
      if (!refresh.ok || !refreshed?.profile) {
        setLoadError("The profile was saved, but its latest values could not be loaded. Retry before making another change.");
        return false;
      }
      setProfile(refreshed.profile);
      setDisplayName(refreshed.profile.display_name || "");
      setAvatar(refreshed.profile.avatar || null);
      setBanner(refreshed.profile.banner || null);
      settleBotIdentity(guildId, identityFromProfile(refreshed.profile));
      return true;
    } finally {
      setSaving(false);
    }
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const discardRef = useRef<() => void>(() => undefined);
  discardRef.current = () => {
    setDisplayName(profile?.display_name || "");
    setAvatar(profile?.avatar || null);
    setBanner(profile?.banner || null);
    setResets(new Set());
  };
  useEffect(
    () =>
      registerExternalDraft("bot-profile", {
        save: () => persistRef.current(),
        discard: () => discardRef.current(),
        label: "the bot's profile",
      }),
    [registerExternalDraft],
  );
  useEffect(() => {
    setExternalDraftDirty("bot-profile", dirty);
  }, [dirty, setExternalDraftDirty]);

  if (loading || loadError) return (
    <div className="space-y-5">
      <SectionHeader title="Customization" />
      <SettingsCard title="Bot server profile">
        {loading ? <p role="status">Loading profile…</p> : <>
          <p role="alert" className="cool-text text-sm">{loadError}</p>
          <button type="button" className="gw-btn mt-3" onClick={() => void load()}>Retry loading profile</button>
        </>}
      </SettingsCard>
    </div>
  );

  return (
    <div className="space-y-5" inert={saving}>
      <SectionHeader
        title="Customization"
      />

      <SettingsCard
        title="Bot server profile"
        description={`Applies only in ${meta?.guild.name || "this server"}. Discord may take a moment to reflect changes.`}
      >
        <FieldRow
          label="Server nickname"
          description={
            profile?.global_name
              ? `Shown here instead of ${profile.global_name}.`
              : "Shown here instead of the bot's own name."
          }
        >
          <TextField
            value={displayName}
            maxLength={32}
            placeholder={profile?.global_name || "Bot nickname"}
            onChange={(next) => {
              setDisplayName(next);
              setResets((current) => {
                const copy = new Set(current);
                copy.delete("nick");
                return copy;
              });
            }}
          />
        </FieldRow>
        <div className="gw-uploads">
          <ImageField
            label="Avatar"
            hint="Square image (PNG, JPG, GIF, or WEBP), up to 8 MB."
            preview={avatar}
            rounded
            uploading={saving && Boolean(avatar?.startsWith("data:"))}
            onPick={(dataUrl) => {
              setAvatar(dataUrl);
              setResets((current) => {
                const copy = new Set(current);
                copy.delete("avatar");
                return copy;
              });
            }}
            onReset={() => markReset("avatar", () => setAvatar(null))}
            onError={(text) => setNotice({ kind: "error", text })}
          />
          <ImageField
            label="Banner"
            hint="Wide image, up to 8 MB. Requires the bot to have a banner slot."
            preview={banner}
            uploading={saving && Boolean(banner?.startsWith("data:"))}
            onPick={(dataUrl) => {
              setBanner(dataUrl);
              setResets((current) => {
                const copy = new Set(current);
                copy.delete("banner");
                return copy;
              });
            }}
            onReset={() => markReset("banner", () => setBanner(null))}
            onError={(text) => setNotice({ kind: "error", text })}
          />
        </div>
      </SettingsCard>
    </div>
  );
}
