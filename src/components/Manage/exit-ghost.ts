"use client";

/**
 * Lets something leave after React has removed it. Popups mounted as `{open ?
 * <Panel/> : null}` disappear the frame they close. Called from a layout
 * effect's cleanup (while the node is still in the document), this leaves an
 * inert copy in place, plays the exit on it, and removes it. Under reduced
 * motion it is removed instantly. Returns the copy, for exits that move more
 * than one part (a sheet sliding while its scrim fades).
 */
export function exitGhost(
  node: HTMLElement | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions = {},
  /**
   * Where the copy goes: its own parent by default, so positioning relative to
   * that parent still holds.
   */
  host: HTMLElement | null = node?.parentElement ?? null,
): HTMLElement | null {
  if (!node || !host || !node.isConnected || typeof node.animate !== "function") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;

  const ghost = node.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.removeAttribute("id");
  ghost.style.pointerEvents = "none";
  host.appendChild(ghost);

  // A copy starts every scroller at the top; put each one back.
  const from = node.querySelectorAll<HTMLElement>("*");
  const to = ghost.querySelectorAll<HTMLElement>("*");
  from.forEach((element, index) => {
    if (element.scrollTop && to[index]) to[index].scrollTop = element.scrollTop;
  });

  const out = ghost.animate(keyframes, {
    duration: 150,
    easing: "cubic-bezier(0.4, 0, 1, 1)",
    fill: "forwards",
    ...options,
  });
  const done = () => ghost.remove();
  out.onfinish = done;
  out.oncancel = done;
  return ghost;
}
