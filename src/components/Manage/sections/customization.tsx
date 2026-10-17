"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconPlus, IconUpload } from "@tabler/icons-react";
import { FieldRow, SettingsCard, TextField } from "../fields";
import { useManage } from "../manage-context";
import { SectionHeader } from "../section-header";
import { identityFromProfile, publishBotIdentity, settleBotIdentity } from "../bot-identity";

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
}: {
  label: string;
  hint: string;
  preview: string | null;
  rounded?: boolean;
  /** The picture is on its way up with the save. */
  uploading?: boolean;
  onPick: (dataUrl: string) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const noun = label.toLowerCase();

  async function take(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    onPick(await readImageFile(file));
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
  const { guildId, meta, registerExternalDraft, setExternalDraftDirty } = useManage();
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [resets, setResets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manage/${guildId}/botprofile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.profile) {
          setProfile(json.profile);
          setDisplayName(json.profile.display_name || "");
          setAvatar(json.profile.avatar || null);
          setBanner(json.profile.banner || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [guildId]);

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

  const dirty =
    displayName !== (profile?.display_name || "") ||
    (avatar || null) !== (profile?.avatar || null) ||
    (banner || null) !== (profile?.banner || null) ||
    resets.size > 0;

  function markReset(field: string, clearedPreview: () => void) {
    setResets((current) => new Set(current).add(field));
    clearedPreview();
  }

  /* Saved through the dashboard's save prompt with everything else: an edit
     here raises it, Save writes it, Discard restores the saved profile. */
  async function persist() {
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
      const refreshed = await fetch(`/api/manage/${guildId}/botprofile`).then((r) => r.json());
      if (refreshed?.profile) {
        setProfile(refreshed.profile);
        settleBotIdentity(guildId, identityFromProfile(refreshed.profile));
      }
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

  return (
    <div className="space-y-5">
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
          />
        </div>
      </SettingsCard>
    </div>
  );
}
