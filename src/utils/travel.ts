"use client";

/**
 * How long the screen may stay frozen waiting for the next page. A view
 * transition holds rendering until its update finishes, so past this the trip
 * goes on without the animation instead of looking stuck.
 */
const HOLD_MS = 900;

/**
 * Goes to another page as one movement: the navigation runs
 * inside a view transition, animated by the rules keyed on
 * `:root[data-leaving="<kind>"]` in globals.css. It waits for the next page's
 * own shell (`arrived`), not its data. Pages are warmed beforehand with
 * `warmTrip`, so the wait is usually a frame or two.
 */
export function travel(
  router: { push: (href: string) => void },
  href: string,
  kind: string,
  arrived: () => boolean,
) {
  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    router.push(href);
    return;
  }
  const root = document.documentElement;
  root.setAttribute("data-leaving", kind);
  const path = href.split("?")[0];
  let transition: ViewTransition | null = null;
  transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        router.push(href);
        // Polled on a timer, not a frame: rendering is held while this
        // promise is pending, and frame callbacks are held with it.
        const started = Date.now();
        const check = () => {
          if (window.location.pathname === path && arrived()) return resolve();
          if (Date.now() - started > HOLD_MS) {
            transition?.skipTransition();
            return resolve();
          }
          window.setTimeout(check, 16);
        };
        window.setTimeout(check, 16);
      }),
  );
  const done = () => root.removeAttribute("data-leaving");
  transition.finished.then(done, done);
}

/**
 * Fetches a page a trip goes to before it is pressed: once the
 * browser is idle, and again when the pointer reaches the way there. In
 * production this loads the page's data and code, so the trip's view
 * transition does not wait on the network.
 */
export function warmTrip(router: { prefetch: (href: string) => void }, href: string) {
  try {
    router.prefetch(href);
  } catch {}
}

/** A click that asked for a new tab or window, which is the browser's to handle. */
export function wantsNewTab(event: React.MouseEvent) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
