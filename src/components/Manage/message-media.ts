"use client";

/**
 * A picture from the user's computer, turned into a link a message can use:
 * Discord fetches embed images by URL, so the bot stores the file
 * (`dashboard_media`) and returns a permanent link. Shrunk first (requests are
 * limited to 4.5MB and Discord shows embed images at 400px): wider than 1600px
 * is scaled down, and anything still too large is re-encoded as WebP. GIFs are
 * sent as they are, since redrawing would keep only one frame.
 */

const MAX_EDGE = 1600;
const MAX_BYTES = 2_900_000;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Profile pictures are uploaded without resizing; reject unsafe or oversized files first. */
export function validateProfileImage(file: { type: string; size: number }): void {
  if (!TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, GIF or WebP picture.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That picture is over 8 MB. Try a smaller one.");
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That picture could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif") {
    if (file.size > MAX_BYTES) throw new Error("That GIF is over 3 MB. Try a smaller one.");
    return file;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That picture could not be read.");
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" && file.size <= MAX_BYTES ? "image/png" : "image/webp";
  for (const quality of [0.88, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("That picture is too large, even shrunk. Try a smaller one.");
}

/** Upload a picture for a message; resolves to the link to put in it. */
export async function uploadMessageImage(guildId: string, file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, GIF or WebP picture.");
  const image = await readAsDataUrl(await shrink(file));
  const response = await fetch(`/api/manage/${guildId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.url) {
    throw new Error(json?.detail || json?.message || "The picture could not be uploaded.");
  }
  return String(json.url);
}

/** The first picture in a drop or a paste, if there is one. */
export function pictureFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.files)) if (TYPES.includes(item.type)) return item;
  return null;
}
