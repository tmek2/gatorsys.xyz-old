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

  // A clone would restart every CSS entrance, including staggered option rows.
  // Read the visible frame first, so even a quick selection can leave smoothly.
  const from = [node, ...node.querySelectorAll<HTMLElement>("*")];
  const frames = from.map((element) => {
    const style = getComputedStyle(element);
    return {
      animated: Boolean(style.animationName && style.animationName !== "none"),
      opacity: style.opacity,
      transform: style.transform,
      clipPath: style.clipPath,
    };
  });
  const ghost = node.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.style.pointerEvents = "none";
  const to = [ghost, ...ghost.querySelectorAll<HTMLElement>("*")];
  to.forEach((element, index) => {
    element.removeAttribute("id");
    element.style.animation = "none";
    element.style.transition = "none";
    if (frames[index].animated) {
      element.style.opacity = frames[index].opacity;
      element.style.transform = frames[index].transform;
      element.style.clipPath = frames[index].clipPath;
    }
  });
  host.appendChild(ghost);

  // A copy starts every scroller at the top; put each one back.
  from.forEach((element, index) => {
    to[index].scrollTop = element.scrollTop;
    to[index].scrollLeft = element.scrollLeft;
  });

  const first = { ...keyframes[0] };
  for (const property of ["opacity", "transform", "clipPath"] as const) {
    const current = frames[0][property];
    if (property in first && current && !(property === "clipPath" && current === "none")) {
      first[property] = current;
    }
  }
  const out = ghost.animate([first, ...keyframes.slice(1)], {
    duration: 150,
    easing: "cubic-bezier(0.4, 0, 1, 1)",
    fill: "forwards",
    ...options,
  });
  const done = () => {
    window.clearTimeout(timer);
    ghost.remove();
  };
  const timer = window.setTimeout(done, Number(options.duration ?? 150) + 100);
  out.onfinish = done;
  out.oncancel = done;
  return ghost;
}
