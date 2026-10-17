/* The appearance setting without a client boundary: the pre-paint script is
   inlined by the root layout (a server component), so it lives here rather than
   in the client toggle, which re-exports it. */

export type Theme = "light" | "dark" | "auto";

/** The one key. Shared by the toggle and by the script below. */
export const THEME_KEY = "gator-theme";

/* Runs before the first paint and before React, so the page never shows the
   wrong appearance first. It writes both light and dark (dark is the default,
   but an explicit dark choice on a light device must be written or the media
   query wins); Auto is no attribute. Wrapped in try because storage throws in
   private windows. */
/* On /manage, Auto is written down instead of left absent: the dashboard's
   older stylesheets only know `[data-theme="light"]` and
   `:not([data-theme="light"])`, so an absent attribute on a light-mode device
   mixed light tokens with dark surfaces. The toggle's own state is in storage
   and still reads Auto; `useResolvedAuto` keeps the attribute in step with the
   device and the toggle. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var r=document.documentElement;if(t==="light"||t==="dark")r.setAttribute("data-theme",t);else if(location.pathname.indexOf("/manage")===0){r.setAttribute("data-theme",matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");r.setAttribute("data-theme-auto","")}}catch(e){}`;

/**
 * Keeps a resolved Auto in step with the device on pages that resolve it.
 * Returns a teardown that clears the attribute again (Auto everywhere else), so
 * leaving /manage does not carry a pinned appearance.
 */
export function resolveAutoTheme(): () => void {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const stored = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };
  /* Makes the attribute match the setting every time: explicit choices are
     written too, and the "this was Auto" marker exists only while the setting
     is Auto (a stale marker once made light mode switch itself off on server
     switches). */
  const resolve = () => {
    const choice = stored();
    if (choice === "light" || choice === "dark") {
      root.removeAttribute("data-theme-auto");
      if (root.getAttribute("data-theme") !== choice) root.setAttribute("data-theme", choice);
      return;
    }
    const want = media.matches ? "light" : "dark";
    if (root.getAttribute("data-theme") !== want) root.setAttribute("data-theme", want);
    if (!root.hasAttribute("data-theme-auto")) root.setAttribute("data-theme-auto", "");
  };
  resolve();
  media.addEventListener("change", resolve);
  // Any attribute change is re-checked against storage; `resolve` only writes
  // when the value differs, so its own write settles the loop.
  const watcher = new MutationObserver(resolve);
  watcher.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", resolve);
    watcher.disconnect();
    // Only a resolved Auto is taken back to "absent", and only if the setting
    // is still Auto right now -- never on the strength of the marker alone.
    const choice = stored();
    if (choice !== "light" && choice !== "dark") {
      root.removeAttribute("data-theme-auto");
      root.removeAttribute("data-theme");
    }
  };
}
