/**
 * Copies text and reports whether it really landed.
 * `navigator.clipboard?.writeText(text)` hides both a missing API (the optional
 * chain) and a rejection (an unfocused document, a denied permission), so a
 * caller could announce "copied" while the clipboard still held something else.
 * Returns true only for a verified write.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path: an insecure context or an unfocused
      // document rejects here, and execCommand still works in both.
    }
  }

  if (typeof document === "undefined") return false;
  try {
    const holder = document.createElement("textarea");
    holder.value = text;
    holder.setAttribute("readonly", "");
    holder.style.position = "fixed";
    holder.style.top = "0";
    holder.style.left = "-9999px";
    document.body.appendChild(holder);
    holder.select();
    holder.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(holder);
    return copied;
  } catch {
    return false;
  }
}
