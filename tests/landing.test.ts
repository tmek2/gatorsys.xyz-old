import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { SHOTS } from "../src/components/site/mac/shots.ts";

/**
 * The landing: one screen and one window. The hero is sticky and never leaves;
 * the About is a window parked at the bottom of it that rises as you scroll. No
 * /about route, and nothing on the page runs on a timer.
 */

const root = path.resolve(import.meta.dirname, "..");
const L = "src/components/site";
const M = `${L}/mac`;

async function source(relativePath: string) {
  return (await readFile(path.join(root, relativePath), "utf8")).replace(/\r\n/g, "\n");
}

async function missing(relativePath: string) {
  try {
    await stat(path.join(root, relativePath));
    return false;
  } catch {
    return true;
  }
}

async function landingSources(): Promise<{ file: string; text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for (const dir of [L, M]) {
    for (const n of await readdir(path.join(root, dir))) {
      if (!/\.(tsx?|css)$/.test(n)) continue;
      out.push({ file: `${dir}/${n}`, text: await source(`${dir}/${n}`) });
    }
  }
  return out;
}

/* --------------------------------------------------------------- the ring */

test("the ring and its route are gone, not merely hidden", async () => {
  for (const gone of [
    `${L}/neuform`,
    `${L}/about-view.tsx`,
    `${L}/about.css`,
    "src/app/about/page.tsx",
  ]) {
    assert.ok(await missing(gone), `${gone} is still here`);
  }

  for (const { file, text } of await landingSources()) {
    assert.ok(!/<iframe/.test(text), `${file} still embeds a frame`);
    assert.ok(!/srcDoc|sandbox=/.test(text), `${file} still builds a sandbox`);
    /* The dot field is the one canvas allowed, by name: it draws only while the
       pointer is over the page. */
    assert.ok(
      !/<canvas/.test(text) || file.endsWith("dot-field.tsx"),
      `${file} still draws a canvas`,
    );
    assert.ok(
      !/(href|push)\(?=?["'`]\/about/.test(text),
      `${file} still links to the removed route`,
    );
  }
});

test("nothing on the landing runs on a timer", async () => {
  // Nothing animates on its own: what is here answers the scroll or the pointer
  // and then stops. (The confetti's loop belongs to the library and ends by
  // itself.)
  for (const gone of [`${L}/gator-mascot.tsx`, `${L}/counting-number.tsx`]) {
    assert.ok(await missing(gone), `${gone} animates on a timer and is unused`);
  }
  /* Five files answer input with a frame loop, and all five stop: the dot field
     settles after the pointer leaves, the wheel smoother stops when the page
     catches up, the wall's reorder asks for two frames per change, the glide
     ends on arrival or on any input, and the tilt settles within a fifth of a
     second. Nothing runs on an idle page. */
  /* The command palette asks for a single frame, not a loop: `scrollIntoView`
     in the commit that mounts the sheet forces a whole-page layout (19.3ms
     traced), and one frame later the same call is free. Cancelled on cleanup. */
  const loops = [
    "command-palette.tsx",
    "dot-field.tsx",
    "glide.ts",
    "smooth-scroll.tsx",
    "tilt.ts",
    "use-reorder.ts",
    "wall-grid.tsx",
  ];
  for (const { file, text } of await landingSources()) {
    assert.ok(
      !/requestAnimationFrame/.test(text) ||
        loops.some((f) => file.endsWith(f)),
      `${file} runs an animation frame loop`,
    );
    assert.ok(!/setInterval/.test(text), `${file} runs an interval`);
  }
  const palette = await source(`${L}/command-palette.tsx`);
  assert.match(palette, /const id = requestAnimationFrame\(\(\) => \{/);
  assert.match(palette, /return \(\) => cancelAnimationFrame\(id\);/);
  assert.doesNotMatch(
    palette,
    /requestAnimationFrame\(\s*step/,
    "the palette is running a loop rather than asking for one frame",
  );

  const smooth = await source(`${L}/smooth-scroll.tsx`);
  assert.match(smooth, /const arrived = Math\.abs\(gap\) < SETTLE/);
  assert.match(smooth, /if \(arrived \|\| current === seen\)/);
  assert.match(smooth, /cancelAnimationFrame\(frame\)/);
});

test("a wheel notch glides, and nothing else is touched", async () => {
  const smooth = await source(`${L}/smooth-scroll.tsx`);
  const landing = await source(`${L}/landing.tsx`);

  assert.match(landing, /<SmoothScroll \/>/);

  /* The rise ends at 85% of the scroll, so the window reaches `transform: none`
     before the last pixel. A composited layer under a fractional scale
     rasterises its text soft. */
  const mac = await source(`${M}/mac.css`);
  assert.match(mac, /animation-range: 0% 85%/);
  assert.doesNotMatch(mac, /animation-range: 0% 100%/);

  /* Only a real wheel notch is smoothed; a trackpad already sends a decaying
     stream, and smoothing it again makes the page feel behind the hand. */
  assert.match(smooth, /if \(event\.deltaMode !== 0\) return/);
  assert.match(smooth, /!Number\.isInteger\(event\.deltaY\) \|\| Math\.abs\(event\.deltaY\) < NOTCH/);

  // A wheel over a box with its own scrollbar and room left belongs to that box.
  assert.match(smooth, /const claimed = /);
  assert.match(smooth, /auto\|scroll/);
  assert.match(smooth, /el\.scrollHeight > el\.clientHeight \+ 1/);

  /* It scrolls the real document, so the scrollbar, the anchors and the
     window's scroll-driven rise all still read the same number. */
  assert.match(smooth, /top: current \+ \(Math\.abs\(move\) < 1 \? Math\.sign\(gap\) : move\)/);
  assert.match(smooth, /behavior: "instant"/);
  assert.ok(
    !/style\.transform|translate3?d?\(/.test(smooth),
    "the page is being moved rather than scrolled",
  );

  /* It lands exactly on the target and can always reach the bottom. The
     window's rise is bound to the scroll, so stopping short leaves it at a
     fractional scale with soft text. Three causes are handled:

     - stopping wherever the easing fell under half a pixel;
     - the browser rounding sub-pixel steps away, stalling the loop;
     - `innerHeight` being a pixel off the real limit. */
  assert.match(smooth, /window\.scrollTo\(\{ top: target, behavior: "instant" \}\)/);
  assert.match(smooth, /root\.scrollHeight - root\.clientHeight/);
  assert.match(smooth, /Math\.abs\(move\) < 1 \? Math\.sign\(gap\) : move/);

  /* rAF's timestamp can be earlier than the `performance.now()` that scheduled
     it; a negative dt would send the first step backwards, which the loop reads
     as "the page has run out". Clamped to 1..50ms. */
  assert.match(smooth, /Math\.min\(Math\.max\(now - last, 1\), 50\)/);

  // Frame-rate independent, or it is twice as fast on a 120Hz screen.
  assert.match(smooth, /Math\.pow\(1 - EASE, dt \/ 16\.667\)/);
  // And somebody who asked for no motion gets the browser's own scroll.
  assert.match(smooth, /prefers-reduced-motion: reduce\)"\)\.matches\) return/);
});

/* --------------------------------------------------------------- the rise */

test("the window rises on the scroll, with one transform and no listener", async () => {
  const css = await source(`${M}/mac.css`);

  // Laid out where it ends and pushed down to where it starts, so nothing
  // inside reflows. The window and the grip over it share these lines, so they
  // cannot drift apart.
  const head = ".g-mac,\n.g-mac-grip {";
  const frame = css.slice(css.indexOf(head), css.indexOf("}", css.indexOf(head)));
  assert.ok(frame.length > 0, "the window and its grip no longer share a frame");
  assert.match(frame, /position: fixed/);
  assert.match(frame, /transform-origin: 50% 0/);
  assert.match(frame, /transform: translateY\(calc\(100svh/);

  // The scroll is the animation where the browser can do that, and a two-state
  // transition on the same curve where it cannot.
  assert.match(css, /@supports \(animation-timeline: scroll\(\)\)/);
  assert.match(css, /animation-timeline: scroll\(root block\)/);
  assert.match(frame, /transition: transform \d+ms var\(--mac-ease\)/);
});

test("a window that looks like it is there can be pressed", async () => {
  const css = await source(`${M}/mac.css`);
  const finder = await source(`${M}/finder.tsx`);
  const landing = await source(`${L}/landing.tsx`);
  const smooth = await source(`${L}/smooth-scroll.tsx`);

  /* The grip follows the window as it rises, so the whole visible window can be
     pressed, not only a strip at the bottom of the first screen. */
  assert.match(finder, /className="g-mac-grip"/, "the grip does not follow the window");
  assert.doesNotMatch(landing, /className="g-mac-grip"/, "the grip is back in the hero");
  assert.match(finder, /inert=\{!open\}/);
  /* The second one: the first is the frame it shares with the window. */
  const own = css.indexOf(".g-mac-grip {", css.indexOf(".g-mac-grip {") + 1);
  const grip = css.slice(own, css.indexOf("}", own));
  assert.match(grip, /z-index: 7/, "the grip is behind the window it stands in for");
  assert.match(css, /\.g-mac-grip\[data-open="true"\]/, "it never stands in front of the real thing");

  /* The runway has two resting places (parked and up) and nothing between them. */
  assert.match(smooth, /scrollend/, "the page can still come to rest mid-rise");
  assert.doesNotMatch(
    smooth,
    /addEventListener\(\s*["']scroll["']/,
    "the rest rule grew a scroll listener",
  );
  /* No CSS scroll snapping: the wheel is eased by programmatic scrolls, and the
     browser re-snaps after each one, dragging every step back. */
  const landingCss = await source(`${L}/landing.css`);
  assert.doesNotMatch(landingCss, /scroll-snap-type/, "snapping fights the wheel easing");
});

test("the page travels on the site's own curve, not the browser's", async () => {
  const glide = await source(`${L}/glide.ts`);
  const landing = await source(`${L}/landing.tsx`);
  const smooth = await source(`${L}/smooth-scroll.tsx`);

  /* The rise is scrubbed by the scroll, so the scroll's curve is the window's
     curve. Everything that scrolls the page to a destination (the handle, the
     window, the resting rule) goes through `glide`, not `behavior: "smooth"`,
     which differs per browser and has a fixed duration. */
  for (const caller of [landing, smooth]) {
    assert.match(caller, /glide\(/, "something still scrolls by hand");
  }

  /* A scroll curve, not the sheet curve: the sheet curve puts 78% of the
     distance in the first quarter (the page jumps, then creeps). This one
     accelerates, cruises and settles, peaking at 1.8x its average speed. */
  assert.match(glide, /\[0\.45, 0, 0\.55, 1\]/);
  assert.doesNotMatch(
    glide,
    /\[0\.32, 0\.72, 0, 1\]/,
    "the page scrolls on the sheet curve again",
  );
  const tokens = await source(`${L}/tokens.css`);
  assert.match(tokens, /--g-ease-sheet: cubic-bezier\(0\.32, 0\.72, 0, 1\)/);

  // Longer journeys take longer, between a floor and a ceiling.
  assert.match(glide, /Math\.min\(LONGEST, Math\.max\(SHORTEST/);

  /* And it gives way to the wheel, a touch, a key or a press. */
  for (const away of ["wheel", "touchstart", "keydown", "pointerdown"]) {
    assert.match(glide, new RegExp(`"${away}"`), `a ${away} cannot stop it`);
  }
  assert.match(glide, /export function stopGlide/);
  assert.match(smooth, /stopGlide\(\)/, "a notch does not take the page back");

  /* It lands exactly on the target, for the same reason as the wheel smoother:
     a journey a pixel short leaves the window at a fractional scale with soft
     text. */
  assert.match(glide, /top: t === 1 \? end :/);
  // And somebody who asked for no motion is moved, not animated.
  assert.match(glide, /prefers-reduced-motion: reduce/);
  assert.match(glide, /behavior: "instant"/);
});

test("the parked window reads as a window in the background", async () => {
  const css = await source(`${M}/mac.css`);
  const finder = await source(`${M}/finder.tsx`);
  const landingCss = await source(`${L}/landing.css`);

  /* The parked window is dimmed, as desktops dim the window you are not in, and
     comes to full strength as it rises, so a window on its way looks different
     from one that has arrived. */
  assert.match(finder, /className="g-mac-shade"/);
  const shade = css.slice(
    css.indexOf(".g-mac-shade {"),
    css.indexOf("}", css.indexOf(".g-mac-shade {")),
  );
  assert.match(shade, /position: absolute/);
  assert.match(shade, /pointer-events: none/);
  /* The shade is the page's own ground, so it holds in both appearances. */
  assert.match(shade, /background: var\(--g-ground\)/);
  assert.match(css, /\.g-mac\[data-open="true"\] \.g-mac-shade \{\s*opacity: 0;/);

  /* It clears over exactly the stretch the hero clears over, so the two cross:
     one dissolve rather than two fades that happen to overlap. */
  const range = /animation-range: 24% 66%/;
  assert.match(css, range, "the shade no longer clears with the hero");
  assert.match(landingCss, range, "the hero no longer clears with the shade");

  // And it is not a story anybody who turned motion down asked to be told.
  assert.match(
    css.slice(css.indexOf(".g-mac-shade")),
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.g-mac-shade \{\s*display: none;/,
  );
});

test("looking arrived and being arrived are the same moment", async () => {
  const css = await source(`${M}/mac.css`);
  const finder = await source(`${M}/finder.tsx`);

  /* The rise and the observer that makes the window live end at the same point.
     When they differed (85% and 88%) the window sat finished and sharp but did
     not answer, right when someone was most likely to try it. */
  const rise = css.match(/animation-range: 0% (\d+)%/);
  const live = finder.match(/rootMargin: "0px 0px -(\d+)% 0px"/);
  assert.ok(rise, "the rise no longer states where it ends");
  assert.ok(live, "the sentinel no longer states where it fires");
  assert.equal(
    rise![1],
    live![1],
    "the window becomes usable somewhere other than where it stops moving",
  );
});

test("one curve carries the whole tilt", async () => {
  const tilt = await source(`${L}/tilt.css`);
  const hook = await source(`${L}/tilt.ts`);
  const button = await source(`${L}/ripple-button.css`);

  /* Registered custom properties are parsed once instead of re-tokenised on
     each of the hook's per-frame writes, and their neutral `initial-value`
     turns the whole effect off on touch, under reduced motion and on the server
     without a branch. */
  for (const prop of ["--tilt-x", "--tilt-y", "--tilt-px", "--tilt-py", "--rim-x", "--rim-y"]) {
    assert.match(
      tilt,
      new RegExp(`@property ${prop} \\{[^}]*inherits: true`),
      `${prop} is not registered, or does not inherit`,
    );
  }
  /* `inherits: true` is required: the washes are drawn in `::after`, which
     reads its element's value only for inherited properties. The loop above
     checks all six registrations. */
  assert.equal((tilt.match(/@property --/g) ?? []).length, 6);

  /* Nothing times the tilt in CSS. A transition restarted by every event
     renders positions on the event clock, not the frame clock, so even motion
     advances at an uneven rate. The frame loop drives all six values instead. */
  for (const own of [button]) {
    assert.doesNotMatch(own, /transition:\n?\s*transform \d+ms/);
    assert.doesNotMatch(
      own,
      /--tilt-x \d|--tilt-x var/,
      "the tilt is being timed in CSS again, on top of the frame loop",
    );
  }
  /* Two time constants: following is tight (a lag over a tenth of a second
     reads as rubbery), letting go is several times longer. */
  assert.match(hook, /const TAU_TRACK = (\d+);/);
  assert.match(hook, /const TAU_REST = (\d+);/);
  const track_tau = Number(hook.match(/const TAU_TRACK = (\d+);/)![1]);
  const rest_tau = Number(hook.match(/const TAU_REST = (\d+);/)![1]);
  assert.ok(track_tau <= 60, `following at ${track_tau}ms reads as a delay`);
  assert.ok(rest_tau > track_tau * 2, "it lets go as fast as it follows");
  // Frame-rate independent, or it is twice as fast on a 120Hz screen.
  assert.match(hook, /1 - Math\.exp\(-delta \/ tau\)/);
  // And it stops: held, or still moving, and otherwise gone.
  assert.match(hook, /if \(surface\.held \|\| !arrived\)/);
  assert.match(hook, /cancelAnimationFrame\(frame\.current\)/);

  /* The box is measured when the pointer arrives, not on every move: measuring
     right after writing six properties forced a layout per event (up to sixteen
     a frame on a 1000Hz mouse). */
  assert.match(hook, /const FRESH = \d+;/);
  assert.match(hook, /event\.timeStamp - surface\.at > FRESH/);
  const track = hook.slice(hook.indexOf("const track = useCallback"));
  assert.equal(
    (track.match(/getBoundingClientRect/g) ?? []).length,
    1,
    "the box is measured more than once per arrival",
  );
});

test("the field's canvas is one pixel per pixel", async () => {
  const field = await source(`${L}/dot-field.tsx`);

  /* Device pixel ratio capped at 1: the field's cost is its backing-store area,
     and a 2x store is four times the window. Dropped frames in a pointer sweep
     went from 23 to 0 (1512x982 2x) and 63 to 12 (1920x1080 2x).

     Not below 1: 0.75 measured slower, because a canvas that is not a whole
     number of device pixels per CSS pixel is resampled on the way to the
     screen. */
  assert.match(field, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\)/);
  assert.doesNotMatch(field, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
});

test("the field is live and even either side of the window", async () => {
  const field = await source(`${L}/dot-field.tsx`);
  const landing = await source(`${L}/landing.tsx`);
  const css = await source(`${L}/landing.css`);

  /* The field keeps running while the window is up: the window is inset by
     `--mac-side`, leaving a strip of field down both sides that is still in
     view. */
  assert.doesNotMatch(field, /paused\?: boolean/);
  assert.doesNotMatch(field, /!still && !paused/);
  assert.doesNotMatch(landing, /<DotField[^>]*paused=/);

  /* The fade is centred, so both strips beside a centred window get the same
     amount of dots. */
  assert.match(css, /--g-dot-fade: 92% 74% 50% 44% 18% 82%;/);
});

test("the canvas behind the page is the page's own ground", async () => {
  const globals = await source("src/app/globals.css");

  /* The ground is painted on the root element too, so the scrollbar strip and
     overscroll area match the page instead of showing near-black or near-white.
     The root, not the body: a body background only reaches the canvas when the
     root has none. */
  assert.match(globals, /html:has\(\.g-root\) \{\s*background: var\(--g-ground\);/);
});

test("an avatar's initial goes once there is a picture over it", async () => {
  const avatar = await source("src/components/user-avatar.tsx");

  /* The initial is shown only until the icon loads: Discord icons are often
     transparent PNGs, and the letter would show through the logo. */
  assert.match(avatar, /src && !failed && loaded \? null : \(/);

  /* Kept as which src they describe, not as booleans an effect resets: refs run
     before effects, so a mount effect clearing `loaded` undid the cached-image
     check. */
  assert.match(avatar, /const loaded = !!src && shown === src;/);
  assert.match(avatar, /const failed = !!src && broken === src;/);
  assert.doesNotMatch(avatar, /useEffect/);
  // A cached image is complete before React can attach `onLoad`, which then
  // never fires; the node itself answers both cases.
  assert.match(avatar, /node\?\.complete && node\.naturalWidth > 0/);
});

test("the account page's buttons are the site's buttons", async () => {
  const overview = await source("src/components/account/account-overview.tsx");
  const sheet = await source("src/components/account/account-servers.tsx");
  const css = await source("src/app/account/account.css");

  /* These use the shared ripple button, not a private copy of its numbers. */
  for (const [name, file] of [["overview", overview], ["sheet", sheet]]) {
    assert.doesNotMatch(file, /<button[^>]*className="account-button"/s, name);
    assert.doesNotMatch(file, /<Link[^>]*className="account-button"/s, name);
    assert.match(file, /<RippleButton/, name);
    assert.match(file, /<RippleButtonRipples \/>/, name);
  }

  /* And what is left on the class is only what this page adds. */
  assert.doesNotMatch(css, /\.account-button \{[^}]*border-radius/s);
  assert.doesNotMatch(css, /\.account-button:active/);

  /* The touch size moved to the button, where every button on the site gets
     it, instead of being remembered per page. */
  const ripple = await source(`${L}/ripple-button.css`);
  assert.match(ripple, /@media \(pointer: coarse\) \{[^}]*data-size="default"/s);
});

test("the More link is a control at the end of what it follows", async () => {
  const css = await source("src/app/account/account.css");

  /* "More" is a real button with an edge, not bare text indented to the value
     column. */
  assert.doesNotMatch(css, /\.account-facts-more \{[^}]*margin-left: calc\(11\.5rem/s);
  /* Under the facts, at the start of the line, and the site's one button
     (account-overview.tsx makes it a RippleButton): it is placed here and
     styled nowhere else. */
  assert.match(css, /\.account-facts-more \{[^}]*justify-self: start;/s);
  assert.match(css, /\.account-facts-more \{[^}]*align-self: start;/s);
  assert.doesNotMatch(css, /\.account-facts-more \{[^}]*(border|background|color):/s);
  // The rows' link style is for the rows, not for a button inside one.
  assert.doesNotMatch(css, /\.account-rows a[ :,{]/);
  assert.match(css, /\.account-rows > li > a \{/);
});

test("the dot field has no edge to see", async () => {
  const field = await source(`${L}/dot-field.tsx`);
  /* Comments stripped, for the assertions below that ban something their own
     comment has to name (as in `ui-regressions.test.ts`). */
  const code = field
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  /* Smoothstep falloff: a linear falloff has a kink at the radius, visible as a
     rim of dots jerking into motion. */
  assert.match(field, /function ease\(t: number\) \{\s*return t \* t \* \(3 - 2 \* t\);/);
  assert.match(field, /ease\(1 - distance \/ RADIUS\) \* strength/);
  assert.doesNotMatch(field, /near = \(1 - distance/);

  /* Two surfaces, and the live one does not grow with the window. A canvas
     whose contents change is re-composited whole, so a single window-sized
     canvas costs its area however little is drawn. With a fixed-size live
     square on top of a static resting layer, dropped frames are 0 at every size
     tested. */
  assert.match(field, /function paintRest\(\)/);
  assert.match(field, /function paintLive\(\)/);
  assert.match(field, /const LIVE = /);
  assert.match(field, /liveCanvas\.width = Math\.round\(LIVE \* ratio\)/);
  assert.match(field, /<canvas ref=\{restRef\} className="g-dots-rest" \/>/);
  assert.match(field, /<canvas ref=\{liveRef\} className="g-dots-live" \/>/);

  /* The live square hides the resting dots it covers by filling itself with the
     ground colour, read from the first ancestor that paints one
     (`--servers-paper` on the picker, `--g-ground` elsewhere). */
  assert.match(field, /live\.fillStyle = ground;/);
  assert.match(field, /function behind\(\)/);

  /* Its edge sits a whole number of pixels from the dots: a half-pixel offset
     makes the compositor resample the layer and rasterises dots differently
     from the resting grid. */
  assert.match(field, /const EDGE = \d+;/);
  assert.doesNotMatch(code, /GAP \/ 2/);

  /* The fade is computed per dot, by the same arithmetic for both surfaces, so
     the two always agree (`1 - keep` is what a `destination-out` gradient
     withholds). */
  assert.match(field, /getPropertyValue\("--g-dot-fade"\)/);
  assert.match(field, /function keep\(dotX: number, dotY: number\)/);
  assert.doesNotMatch(code, /destination-out/);
  for (const caller of [
    `${L}/landing.css`,
    `${L}/legal.css`,
    `${L}/intro.css`,
    "src/app/account/account.css",
  ]) {
    const css = await source(caller);
    assert.match(css, /--g-dot-fade: [\d.]+% [\d.]+% [\d.]+% [\d.]+% [\d.]+% [\d.]+%;/, caller);
    assert.doesNotMatch(
      css,
      /\.(g-hero-field|g-legal-field|g-intro-field|account-field) \{[^}]*mask-image/,
      `${caller} masks the field again`,
    );
  }

  /* The loop stops once it has arrived, even with the pointer resting on the
     page, unless a pebble is still rippling. "Did anything move" cannot be the
     rule: the first frame after waking has no movement yet. */
  assert.match(field, /const arrived = Math\.abs\(want - strength\) <= 0\.0005;/);
  assert.match(field, /else if \(moved \|\| arrived \|\| rippling\) paintLive\(\);/);
  assert.match(field, /if \(!arrived \|\| rippling\) frame = requestAnimationFrame\(step\);/);
  // And a ripple ends: old pebbles are dropped each frame, once their last
  // ring has run, and the patch they disturbed is put back at rest.
  assert.match(field, /while \(drops\.length && now - drops\[0\]\.at >= KEPT_MS\) drops\.shift\(\);/);
  assert.match(field, /if \(rippling \|\| patch\) paintRipples\(\);/);
  /* The rings are drawn into the resting grid, not only the square that
     follows the pointer, so they spread past it and end in a circle. */
  assert.match(field, /dots\(rest, x0, y0, x1, y1, 0, 0, false, true\);/);

  /* The pointer position is used directly, not chased: an exponential follow
     lags a time constant behind (46% of a 320px move on the first frame).
     Averaging the frame's own pointer events, a few lines above, removes the
     jitter without the lag. */
  assert.match(field, /\n {6}x = toX;\n {6}y = toY;/);
  assert.doesNotMatch(
    field,
    /TAU_POINTER/,
    "the field is chasing the pointer again",
  );
  assert.match(field, /const TAU_STRENGTH/);
});

test("scroll position is never read through a scroll listener", async () => {
  /* Nothing on this page reads the scroll to decide where something goes; that
     is what scroll timelines are for. Three files read the scroll and move
     nothing but the page, and none has a scroll listener:

     - the wheel smoother, which reads the position to decide where to scroll
       next while catching up;
     - the wall's drag, which reads it once to cancel a scroll offset;
     - the glide, which reads it while travelling to a destination. */
  const readsScroll = ["glide.ts", "smooth-scroll.tsx", "wall-grid.tsx"];
  for (const { file, text } of await landingSources()) {
    assert.ok(
      !/addEventListener\(\s*["']scroll["']/.test(text),
      `${file} listens to scroll directly`,
    );
    assert.ok(
      !/window\.scrollY/.test(text) ||
        readsScroll.some((f) => file.endsWith(f)),
      `${file} reads window.scrollY`,
    );
  }
  const smooth = await source(`${L}/smooth-scroll.tsx`);
  assert.ok(
    !/\.style\.|setAttribute|classList/.test(smooth),
    "the wheel smoother is moving something as well as scrolling",
  );
});

test("openness is a fact, not only a picture", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${M}/mac.css`);

  // One observer, no listener, and it drives the things CSS cannot: focus,
  // the wheel, and what a screen reader is told.
  assert.match(finder, /new IntersectionObserver/);
  assert.match(finder, /inert=\{!open\}/);
  assert.match(css, /\.g-mac\[data-open="false"\] \.g-mac-pane/);

  /* The buttons move the scroll, not the window, so the two never disagree
     about where the window is. They go through `glide`, the one place that
     scrolls to a destination and so the one place that sets the rise's curve. */
  const landing = await source(`${L}/landing.tsx`);
  assert.match(landing, /glide\(/);
  assert.doesNotMatch(
    landing,
    /window\.scrollTo\(/,
    "the page is scrolled by hand again, on the browser's curve",
  );
  assert.match(await source(`${L}/glide.ts`), /window\.scrollTo\(/);
  assert.match(finder, /onRequestClose/);
});

/* ------------------------------------------------------------ the chrome */

test("the window is a workspace, not a Mac window", async () => {
  const css = await source(`${M}/mac.css`);
  const tokens = await source(`${L}/tokens.css`);
  const at = (selector: string) =>
    css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));

  /* A window frame, without macOS's own chrome measurements. */
  assert.match(css.slice(css.indexOf(".g-mac,")), /border-radius: 10px/);
  /* One band of chrome, not two (a tab strip plus a toolbar came to 88px before
     saying anything). */
  assert.match(at(".g-win-bar {"), /height: 48px/);
  assert.doesNotMatch(css, /\.g-mac-tabs/, "the chrome is back on two rows");
  /* Nothing is drawn between the groups: in one row, the groups are set apart
     by distance, as Safari does. */
  assert.doesNotMatch(
    css,
    /\.g-bar-zone \+ \.g-bar-zone \{\s*box-shadow: inset 1px 0 0/,
    "the bar is sectioned into cells again",
  );

  /* Open places are tabs, with the window's controls at the far end. At most
     six, because a seventh starts eliding labels. */
  const finderSrc = await source(`${M}/finder.tsx`);
  assert.match(finderSrc, /const MAX_TABS = 6;/);
  assert.match(finderSrc, /className="g-bar-zone g-tab-strip"/);
  assert.match(finderSrc, /tabs\.length < MAX_TABS/);
  assert.match(css, /\.g-tab\[data-on="true"\] \{/);
  // The active tab names the place, not the title bar.
  assert.doesNotMatch(finderSrc, /className="g-win-title"/);
  assert.match(at(".g-mac-body {"), /grid-template-columns: 220px/);

  // A navigation row: small radius, compact height, and a floor of 32px.
  assert.match(at(".g-side-row {"), /height: 32px/);
  assert.match(at(".g-side-row {"), /border-radius: 6px/);
  assert.match(at(".g-side-row {"), /padding-inline: 8px/);

  // Apple's traffic-light colours are gone, and so is the cluster.
  for (const light of [
    /#ff5f57/,
    /#febc2e/,
    /#28c840/,
    /\.g-lights/,
    /\.g-light\b/,
  ]) {
    assert.doesNotMatch(css, light, "the traffic lights are still drawn");
  }

  /* The chrome uses the site's font, not the system UI face (SF Pro on a Mac). */
  assert.doesNotMatch(css, /--mac-chrome: -apple-system/);
  assert.match(css, /--mac-chrome:\s*var\(--font-ui\)/);

  /* Near-black surfaces with a real hairline round each one; on a ground this
     dark, the edge separates better than tone. */
  assert.match(tokens, /--mac-raise:/);
  assert.match(tokens, /--mac-hair: rgba\(255, 255, 255, 0\.07\)/);

  const sheet = await source(`${M}/sheet.css`);
  assert.match(sheet, /--font-ui/);
  assert.match(css, /--font-ui/);
});

test("the toolbar holds the controls a Finder toolbar holds", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${M}/mac.css`);
  const at = (selector: string) =>
    css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));

  /* Back and forward are two bare glyphs with a soft squircle on hover, not a
     capsule with a divider. */
  assert.doesNotMatch(css, /\.g-mac-steps button \+ button/);
  assert.match(at(".g-mac-steps button {"), /border-radius: 8px/);
  assert.match(css, /\.g-mac-steps button:hover:not\(:disabled\) \{/);

  /* The trailing half holds the view switch and a search field for the wall. */
  assert.match(finder, /className="g-mac-seg"/);
  assert.match(finder, /className="g-mac-search"/);
  /* No recessed track with a raised pill: that is a platform control. */
  assert.doesNotMatch(css, /\.g-mac-seg-pill/);
  assert.doesNotMatch(finder, /g-mac-seg-pill/);
  assert.match(css, /\.g-mac-seg button\[data-on="true"\] \{/);

  // The switcher switches something: the wall has a list view as well as icons.
  assert.match(finder, /className="g-list-row"/);
  assert.match(css, /\.g-list-head,/);

  // Command-F is the shortcut every Finder window answers.
  assert.match(finder, /metaKey \|\| event\.ctrlKey/);
});

test("the window's own controls are labelled buttons", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const note = await source(`${M}/notepad.tsx`);
  const css = await source(`${M}/mac.css`);

  /* No traffic lights; the window controls are a quiet cluster of glyphs at the
     trailing end. */
  for (const text of [finder, note]) {
    assert.doesNotMatch(text, /g-light/, "a traffic light is still in the markup");
    assert.match(text, /className="g-win-act/);
  }

  // Every one of them is a real button and says what it does.
  const cluster = finder.slice(
    finder.indexOf('className="g-bar-zone g-win-acts"'),
    finder.indexOf("</span>", finder.indexOf("g-win-act-close")),
  );
  const buttons = cluster.split("<button").slice(1);
  assert.equal(buttons.length, 3, "the window lost a control");
  for (const block of buttons) {
    assert.match(block, /className="g-win-act/);
    assert.match(block, /type="button"/);
    assert.match(block, /aria-label=/);
  }
  // Close is the one that is destructive, so it is the one that takes danger.
  assert.match(finder, /g-win-act g-win-act-close/);
  assert.match(note, /g-win-act g-win-act-close/);
  assert.match(css, /\.g-win-act-close:hover \{/);
  assert.match(css, /--mac-danger:/);
});

/* ------------------------------------------------------------- the folders */

test("the folders are real modules, a chosen few of them", async () => {
  const modules = await source(`${L}/modules.ts`);

  const inventory = new Set(
    [...modules.matchAll(/^        key: "([a-z_]+)",$/gm)].map((m) => m[1]),
  );
  assert.ok(inventory.size >= 25, `expected the real module count, got ${inventory.size}`);

  const wall = modules.slice(
    modules.indexOf("export const FOLDERS"),
    modules.indexOf("export const FOLDER_KEYS"),
  );
  const keys = [...wall.matchAll(/^    key: "([a-z_]+)",$/gm)].map((m) => m[1]);

  assert.ok(keys.length >= 8, "the wall needs enough folders to be a wall");
  assert.ok(
    keys.length < inventory.size,
    "the wall is the interesting ones, not the inventory",
  );
  for (const key of keys) {
    assert.ok(inventory.has(key), `the wall invents a module: ${key}`);
  }

  // Every folder is its own hue, or the wall is unreadable at icon size.
  const hues = [...wall.matchAll(/hue: "(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  assert.equal(hues.length, keys.length, "a folder has no colour");
  assert.equal(new Set(hues).size, hues.length, "two folders share a colour");

  // And the ones left off the wall are still named somewhere.
  assert.match(modules, /export const REST =/);
  const finder = await source(`${M}/finder.tsx`);
  assert.match(finder, /REST\.length/, "the rest are not accounted for");
});

test("the sixteen in the drawer are tiles, not a spreadsheet", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${M}/mac.css`);
  const glyphs = await source(`${M}/module-glyphs.tsx`);

  /* Not a four-column table with hairlines under every row, which reads as a
     spreadsheet beside a wall of cards. */
  assert.doesNotMatch(css, /grid-template-columns: 15ch/);
  assert.match(css, /\.g-drawer-tile \{/);
  assert.match(css, /\.g-drawer-grid \{/);
  const tile = css.slice(
    css.indexOf(".g-drawer-tile {"),
    css.indexOf(".g-drawer-glyph"),
  );
  assert.match(
    tile,
    /border: 1px solid var\(--mac-hair\)/,
    "the tiles have no edge",
  );
  assert.match(
    tile,
    /border-radius: 8px/,
    "the corner does not match the wall's",
  );

  /* A glyph each, so the names do not read as identical rows. */
  assert.match(finder, /g-drawer-glyph/);
  for (const key of [
    "suspensions",
    "quota",
    "modmail",
    "giveaways",
    "forums",
  ]) {
    assert.match(
      glyphs,
      new RegExp(`\\b${key}: Icon`),
      `${key} has no glyph of its own`,
    );
  }

  /* No hue and no ghost mark here, so these do not compete with the wall's ten
     colours. */
  const glyph = css.slice(
    css.indexOf(".g-drawer-glyph {"),
    css.indexOf(".g-drawer-name"),
  );
  assert.doesNotMatch(glyph, /var\(--hue\)/, "the drawer has grown a palette");
});

test("a tab is joined to the window, and can be carried along the strip", async () => {
  const css = await source(`${M}/mac.css`);
  const tokens = await source(`${L}/tokens.css`);
  const drag = await source(`${M}/tab-drag.ts`);
  const finder = await source(`${M}/finder.tsx`);

  /* The tab strip is a recess cut into the bar, so the active tab can wear the
     bar's colour and be lighter than something. (The chrome and pane share a
     ground, so a pane-coloured tab would be invisible.) */
  /* The strip is not sunk below the bar; the active tab's outline gives the
     separation (14.8 against 3.7 L*). */
  assert.doesNotMatch(tokens, /--mac-sink:/);
  const strip = css.slice(css.indexOf(".g-tab-strip {"), css.indexOf("}", css.indexOf(".g-tab-strip {")));
  assert.doesNotMatch(strip, /background:/, "the tab strip is a sunken panel again");
  assert.match(strip, /align-items: flex-end/, "the tabs float instead of standing on the edge");
  const on = css.slice(css.indexOf('.g-tab[data-on="true"] {'), css.indexOf("}", css.indexOf('.g-tab[data-on="true"] {')));
  assert.match(on, /background: var\(--mac-bar\)/);
  /* No curved shapes joining the tab to the strip: lit, they read as hooks
     hanging off the tab. */
  assert.doesNotMatch(css, /\.g-tab\[data-on="true"\]::before/);
  assert.doesNotMatch(
    css,
    /var\(--mac-tab-rim\) 9px 10px/,
    "the fillets are being lit again",
  );

  /* The outline is drawn in three pieces, not `inset 0 0 0 1px`, which would
     also draw the fourth side across the join the tab exists to hide. The fill
     alone sits too close to the strip on near-black. */
  assert.match(tokens, /--mac-tab-rim:/);
  /* 40px of the band's 48: a browser leaves six or eight pixels above a tab. */
  assert.match(css, /\.g-tab \{[\s\S]{0,700}height: 40px/);
  assert.match(on, /inset 0 1px 0 var\(--mac-tab-rim\)/);
  assert.match(on, /inset 1px 0 0 var\(--mac-tab-rim\)/);
  assert.match(on, /inset -1px 0 0 var\(--mac-tab-rim\)/);
  assert.doesNotMatch(
    on,
    /inset 0 -1px 0 var\(|inset 0 0 0 1px var\(/,
    "the outline is being drawn across the bottom, over the join",
  );
  /* Both appearances define one; on paper it is barely there, since the fill
     already does the work. */
  assert.equal(
    (tokens.match(/--mac-tab-rim:/g) || []).length,
    3,
    "one appearance is missing the tab outline",
  );

  /* Tabs are dragged with their own gesture, not Swapy: Swapy moves the DOM
     itself, which is only safe while React's tree never changes shape, and the
     tab strip gains and loses tabs. */
  assert.match(drag, /useTabDrag/);
  assert.ok(
    !/from "swapy"|swapy-draggable-card/.test(drag),
    "the strip is being arranged by two things at once",
  );
  /* Nothing is reordered until the drag ends: the others slide on a transform
     and layout never moves, so no FLIP pass is needed. */
  assert.match(drag, /onReorder\(held\.from, held\.to\)/);

  /* The landing lane is decided by the carried tab's leading edge against each
     lane's middle (left edge going left, right edge going right). Middle
     against middle made the first slot unreachable whenever the carried tab was
     wider. */
  assert.match(drag, /rightEdge > centre\(held\.lanes\[landed \+ 1\]\)/);
  assert.match(drag, /leftEdge < centre\(held\.lanes\[landed - 1\]\)/);
  assert.doesNotMatch(
    drag,
    /const middle = lane\.left \+ lane\.width \/ 2 \+ carried/,
    "the landing rule is comparing middles again",
  );
  /* A carried tab can reach either end of the row, but not the add button. */
  assert.match(drag, /left: lanes\[0\]\.left,/);

  /* On release it animates only the few pixels between where it was dropped and
     its new slot. Resetting the transform in the same commit as the reorder
     animated it from far off the left edge. */
  assert.match(drag, /settling\.current = \{/);
  assert.match(drag, /from: lane\.left \+ held\.dx - landsAt,/);
  assert.match(drag, /transform: `translateX\(\$\{held\.from\}px\)`/);
  // Before the paint that follows the reorder, or the tab is drawn at its new
  // slot first and then moved.
  assert.match(drag, /const useLayoutRun =/);
  assert.match(finder, /drag\.shift\(tab\.id\)/);
  assert.match(finder, /drag\.dragged\(\)/, "a dragged tab is also switched to");
});

test("a card cannot be dragged off the wall, and a label cannot be sliced", async () => {
  const wall = await source(`${M}/wall-grid.tsx`);
  const tip = await source(`${L}/hover-tip.tsx`);
  const tipCss = await source(`${L}/hover-tip.css`);
  const themeCss = await source(`${L}/theme-toggle.css`);

  assert.match(wall, /boundedPosition/);
  assert.match(wall, /createPortal/);
  assert.match(wall, /bounds.right - 12/);
  assert.match(wall, /g.w/);

  /* The header's tooltips are drawn at the end of the document: the header sits
     in a sticky element, so no stacking order can lift a label above the window
     just below it. */
  assert.match(tip, /createPortal/);
  assert.match(tipCss, /\.g-tip \{[^}]*position: fixed/);
  assert.match(themeCss, /\.g-theme-tip \{[^}]*position: fixed/);
  /* A click focuses a control as readily as a Tab does, and answering that
     left the label open until the focus moved somewhere else. */
  assert.match(tip, /:focus-visible/);
});

test("a folder is a card, and nothing on the wall is an icon in a box", async () => {
  const folder = await source(`${M}/folder-tile.tsx`);
  const css = await source(`${M}/mac.css`);
  const sheetCss = await source(`${M}/sheet.css`);
  const iosCss = await source(`${M}/ios.css`);

  /* No icon grid: neither macOS folders nor tiles with a glyph inside. A box
     round an icon is a box doing the icon's job. */
  const gone = [
    /g-folder-back/,
    /g-folder-flap/,
    /g-folder-sheet/,
    /g-folder-art/,
    /g-ftile/,
  ];
  for (const pattern of gone) {
    for (const [name, text] of [
      ["mac.css", css],
      ["sheet.css", sheetCss],
      ["ios.css", iosCss],
      ["folder-tile.tsx", folder],
    ] as const) {
      assert.doesNotMatch(text, pattern, `${name} still draws the old folder`);
    }
  }

  /* The card: a near-black panel, one real hairline and a small radius (about
     10px). */
  const card = css.slice(css.indexOf(".g-fcard {"), css.indexOf(".g-fcard:hover"));
  assert.match(card, /border: 1px solid var\(--mac-hair\)/);
  assert.match(card, /border-radius: 10px/, "the card is not square enough");
  assert.match(card, /background: var\(--mac-raise\)/);
  /* The content sits at the foot and the mark sits in the space that leaves,
     which is what lets a card be tall without looking empty. */
  assert.match(card, /justify-content: flex-end/);

  /* Hover and selected are two steps: the edge takes a hint of the folder's
     colour under the pointer, and takes it fully on the open one. */
  assert.match(css, /\.g-fcard:hover,\n\.g-fcard:focus-visible \{/);
  assert.match(css, /\.g-fcard\[data-selected="true"\] \{/);

  /* The same mark again, oversized and faint in the corner. Neutral, so ten
     large marks do not form a second wall. */
  assert.match(folder, /g-fcard-ghost/);
  const ghost = css.slice(
    css.indexOf(".g-fcard-ghost {"),
    css.indexOf(".g-fcard-name"),
  );
  assert.match(ghost, /position: absolute/);
  assert.match(ghost, /color: var\(--mac-label\)/);
  assert.match(ghost, /opacity: 0\.0/, "the ghost is not a ghost");

  // The card carries what somebody is on the wall to find out, not one word.
  assert.match(folder, /g-fcard-name/);
  assert.match(folder, /g-fcard-say/);
});

test("every folder carries its own glyph, from the set the site already uses", async () => {
  const glyphs = await source(`${M}/module-glyphs.tsx`);
  const modules = await source(`${L}/modules.ts`);

  /* Each module has its own drawn icon, so colour is not the only way to tell
     them apart (it fails for colour blindness and at phone size). */
  assert.match(glyphs, /from "@tabler\/icons-react"/, "the icons are hand-drawn");

  // Every folder on the wall has one, so nothing falls back to four panes.
  const wall = modules.slice(
    modules.indexOf("export const FOLDERS"),
    modules.indexOf("export const FOLDER_KEYS"),
  );
  const keys = [...wall.matchAll(/^    key: "([a-z_]+)",$/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 10, "the wall lost its folders");
  for (const key of keys) {
    assert.match(
      glyphs,
      new RegExp(`^  ${key}: Icon`, "m"),
      `${key} has no glyph of its own`,
    );
  }
});

/* -------------------------------------------------------------- the files */

test("a module sheet says more than its own label", async () => {
  const modules = await source(`${L}/modules.ts`);
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${M}/mac.css`);

  // Each folder shows the job as it looks without Gator (`without`), so the
  // sheet can set it beside the job with Gator (`with`). No kicker, heading and
  // three bullets.
  const wall = modules.slice(
    modules.indexOf("export const FOLDERS"),
    modules.indexOf("export const FOLDER_KEYS"),
  );
  const keys = [...wall.matchAll(/^    key: "([a-z_]+)",$/gm)].length;
  const withouts = [...wall.matchAll(/^    without:/gm)].length;
  const withs = [...wall.matchAll(/^    with:/gm)].length;
  assert.equal(withouts, keys, "a folder has no 'before' line");
  assert.equal(withs, keys, "a folder has no 'after' line");

  /* The sheet is its own component and stylesheet, because the Mac window and
     the phone both draw it. */
  const sheet = await source(`${M}/module-sheet.tsx`);
  const sheetCss = await source(`${M}/sheet.css`);
  assert.ok(!/g-sheet-head/.test(finder), "the finder still owns the sheet");
  assert.ok(!/g-compare/.test(css), "mac.css still owns the old comparison");

  // Both halves are written. The module's dashboard description stays on the
  // sheet as the specification underneath, not as the first sentence.
  assert.match(sheet, /folder\.with/);
  /* No `g-sheet-spec`: it repeated the three things the group above had just
     listed. */
  assert.doesNotMatch(sheet, /g-sheet-spec/);

  for (const part of ["Before", "After", "What you get"]) {
    assert.ok(sheet.includes(part), `the sheet has no "${part}"`);
  }
  // The folder comes with you into the sheet, so opening one reads as arriving
  // somewhere rather than as a paragraph being swapped out.
  /* The mark sits beside the name, so the title has an anchor. */
  assert.match(sheet, /<FolderArt moduleKey=\{folder\.key\} \/>/);
  assert.doesNotMatch(sheet, /g-sheet-crumb/);
  assert.match(sheetCss, /\.g-sheet-mark \{/);
  /* The group is a chip on the title's line, not a tracked uppercase line above
     it. */
  assert.match(sheet, /<span className="g-sheet-kicker">\{m\.group\}<\/span>/);
  assert.match(sheetCss, /\.g-sheet-kicker \{[\s\S]{0,320}border-radius: 6px/);
  /* Always a way onward: two buttons under the list, not a bordered group of
     three rows that took a third of the sheet. */
  assert.match(sheet, /className="g-sheet-near"/);
  assert.match(sheet, /\]\.slice\(0, 2\);/, "more neighbours than anybody follows");
  assert.doesNotMatch(sheet, /g-group-near/);
  assert.match(sheetCss, /\.g-sheet-near \{/);

  /* Folder copy names the feature, the work it replaces and what a visitor
     gets, without reading its own feature list back (a `without` and a `with`
     that are the same sentence twice). So the test checks the writing: every
     folder says all four things, none uses filler product-page words, and the
     before line may be about a person. */
  for (const filler of [
    "seamless",
    "powerful",
    "robust",
    "streamline",
    "all-in-one",
    "leverage",
    "effortless",
    "daily operations",
    "focused workspace",
  ]) {
    assert.ok(
      !wall.toLowerCase().includes(filler),
      `folder copy reaches for filler: ${filler}`,
    );
  }
  const explains = [...wall.matchAll(/^    explain:/gm)].length;
  assert.equal(explains, keys, "a folder has no paragraph of its own");
  const pitches = [...wall.matchAll(/^    pitch:/gm)].length;
  assert.equal(pitches, keys, "a folder has no one-line pitch");
  assert.match(sheet, /Free, and on in about a minute\./);
});

test("a folder's inside is built out of Apple's one container shape", async () => {
  const sheet = await source(`${M}/module-sheet.tsx`);
  const css = await source(`${M}/sheet.css`);
  const at = (selector: string) =>
    css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));

  /* Every detail view is built from three parts only: a small caption, a
     rounded container, and rows separated by hairlines inset from the leading
     edge. One of each is what lets the sheet scan in one pass. */
  const boxes = [...sheet.matchAll(/className="g-group-box/g)].length;
  assert.ok(boxes >= 2, "the sheet is not made of grouped lists");
  /* The action closes the sheet (name, difference, what you get, then the
     invitation), as text you click rather than a filled capsule. */
  assert.doesNotMatch(sheet, /g-group-act/);
  assert.match(sheet, /className="g-sheet-foot"/);
  assert.match(sheet, /className="g-sheet-go"/);
  // The head carries the name and the case for it, and stops there.
  const sheetHead = sheet.slice(
    sheet.indexOf('<header className="g-sheet-head">'),
    sheet.indexOf("</header>"),
  );
  assert.doesNotMatch(
    sheetHead,
    /g-sheet-go/,
    "the action is back above the case for it",
  );
  assert.ok(
    sheet.indexOf('className="g-sheet-foot"') >
      sheet.indexOf('aria-label="What you get"'),
    "the invitation still comes before what you get",
  );
  assert.doesNotMatch(sheet, /RippleButton/, "the filled button is back");
  const go = css.slice(
    css.indexOf(".g-sheet-go {"),
    css.indexOf(".g-sheet-go svg"),
  );
  assert.match(go, /color: var\(--hue\)/);
  assert.doesNotMatch(go, /background/, "the link is a filled button again");
  assert.match(at(".g-group-box {"), /border-radius: var\(--g-r-container\)/);

  /* The separator starts where the row's text starts, not at the container
     edge, so a list reads as rows rather than stripes. */
  assert.match(css, /\.g-row \+ \.g-row::before/);
  assert.match(css, /left: var\(--sheet-lead\)/);

  /* Every row's leading element sits in the same 29px well, so text in every
     list starts at the same x as the separator (`--sheet-lead`). */
  assert.match(at(".g-sheet {"), /--sheet-well: 29px/);

  /* The lead is derived from the two numbers it depends on rather than
     restated, so the separator and the text cannot drift apart again. */
  assert.match(
    at(".g-sheet {"),
    /--sheet-lead: calc\(var\(--sheet-inset\) \+ var\(--sheet-well\) \+ var\(--sheet-gap\)\)/,
  );
  assert.ok(
    !/--sheet-lead: \d/.test(css),
    "the lead is a literal again, so it can drift from the well it describes",
  );

  /* The head is one column on the same left edge as the groups below (mark and
     group, then title, then pitch), closed by a hairline. */
  const head = at(".g-sheet-head {");
  /* Two columns, and the first is the mark rather than a 92px well: `auto`
     takes the glyph's own width, so nothing is indented past a box. */
  assert.match(head, /grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(head, /border-bottom: 1px solid var\(--sheet-sep\)/);
  assert.match(head, /padding-bottom/);
  // The mark is naked and it is the folder's own colour.
  assert.match(at(".g-sheet-mark {"), /color: var\(--hue\)/);
  assert.doesNotMatch(
    at(".g-sheet-mark {"),
    /background/,
    "the mark is in a box",
  );
  // The words keep a measure; the rule under them runs the width of the pane.
  assert.match(css, /\.g-sheet-say > \* \{\s*max-width: 64ch/);

  /* In two columns the captionless group sits a line high on purpose: levelling
     the columns made the sheet read as a table. The columns are a reading
     order, not a grid. */
  assert.ok(
    !/:has\(> \.g-group-cap\)/.test(css),
    "the captionless group is being levelled with the captioned ones again",
  );
  assert.ok(!/--sheet-cap\b/.test(css), "the caption reserve is back");

  /* No filled button: the action is text in the folder's colour on the title's
     line, and the arrow (not the label) moves, so the line never reflows. */
  assert.doesNotMatch(sheet, /g-tint-button/);
  assert.doesNotMatch(sheet, /g-sheet-cta/);
  assert.doesNotMatch(
    css,
    /\.g-sheet-cta[.:{]/,
    "the filled button's styles remain",
  );
  assert.match(at(".g-sheet-go svg {"), /transition: transform/);

  // 44pt rows, which is also the tap floor: the two constraints are one.
  assert.match(at(".g-row {"), /min-height: 52px/);
});

test("the hero is the line, and the line fills the screen", async () => {
  const landing = await source(`${L}/landing.tsx`);
  const css = await source(`${L}/landing.css`);
  const mac = await source(`${M}/mac.css`);

  // Nothing is capped to a column: the headline reaches the far gutter on its
  // own, so it is sized off the viewport.
  const hero = css.slice(css.indexOf(".g-hero {"), css.indexOf("}", css.indexOf(".g-hero {")));
  assert.ok(!/max-width: \d+px/.test(hero), "the hero is capped to a column");
  const h1 = css.slice(css.indexOf(".g-hero-h1 {"), css.indexOf("}", css.indexOf(".g-hero-h1 {")));
  assert.match(h1, /font-size: clamp\([^)]*vw/);

  // Tried and removed: a badge over the headline and a specification strip down
  // the right edge.
  for (const gone of ["g-eyebrow", "g-spec"]) {
    assert.ok(!landing.includes(gone), `${gone} is back in the markup`);
    assert.ok(!css.includes(gone), `${gone} is back in the stylesheet`);
  }

  /* On a phone the reading path starts directly under the navigation, and the
     headline gets a phone-sized scale rather than the desktop minimum. */
  const phoneStart = css.indexOf("/* The hero's own rhythm");
  const phone = css.slice(phoneStart, css.indexOf("/* --------------------------------------------------------- the phone menu", phoneStart));
  assert.match(phone, /\.g-hero \{[\s\S]*justify-content: flex-start/);
  assert.match(phone, /padding-top: clamp\(76px, 10vh, 88px\)/);
  assert.match(phone, /\.g-hero-h1 \{[\s\S]*font-size: clamp\(2\.75rem, 11\.25vw, 3\.2rem\)/);
  assert.match(phone, /\.g-hero-lede \{[\s\S]*font-size: 16px/);
  /* The utility cluster belongs to the window, not the screen. Lifting it by
     `100dvh - 735px` floated it up to 211px away from the window on tall
     phones; the slack goes to the sheet instead. */
  assert.doesNotMatch(
    css,
    /--g-phone-utility-lift/,
    "the handle is measured against the screen again rather than the window",
  );
  const narrow = css.slice(css.indexOf("@media (max-width: 640px) {"));
  assert.match(narrow, /\.g-raise \{[\s\S]*bottom: calc\(var\(--mac-peek\) \+ 14px\)/);
  assert.match(narrow, /\.g-footline \{[\s\S]*bottom: calc\(var\(--mac-peek\) \+ 72px\)/);
  assert.match(mac, /--mac-peek: clamp\(72px, calc\(100svh - 590px\), 320px\)/);
});

test("the legal files summarise the documents and never replace them", async () => {
  const content = await source(`${M}/content.ts`);

  // The files carry the real policy section headings and link to the real
  // document; a friendlier paraphrase served as the policy would be a
  // liability.
  for (const heading of [
    "Information We Collect",
    "Retention and Deletion",
    "Acceptable Use",
    "Disclaimers and Liability",
  ]) {
    assert.ok(content.includes(heading), `the summary drops "${heading}"`);
  }
  assert.match(content, /href: "\/privacy"/);
  assert.match(content, /href: "\/terms"/);
  assert.match(content, /authoritative version/);

  const privacy = await source("src/app/privacy/page.tsx");
  const terms = await source("src/app/terms/page.tsx");
  for (const heading of ["Information We Collect", "Retention and Deletion"]) {
    assert.ok(privacy.includes(heading), `the policy no longer has "${heading}"`);
  }
  for (const heading of ["Acceptable Use", "Disclaimers and Liability"]) {
    assert.ok(terms.includes(heading), `the terms no longer have "${heading}"`);
  }
});

test("the runway ends where the window does", async () => {
  const css = await source(`${L}/landing.css`);
  const mac = await source(`${M}/mac.css`);
  const landing = await source(`${L}/landing.tsx`);

  /* A screen of runway: much less, and each wheel notch is a fifth of the
     journey, so the window looks redrawn rather than moving. */
  const page = css.slice(css.indexOf(".g-page {"), css.indexOf("}", css.indexOf(".g-page {")));
  assert.match(page, /height: 200svh/);

  /* The rise ends at 85%, not 100%. Ending at 100% leaves the window at a
     fractional scale (soft text) everywhere except the page's last pixel. The
     cost is a notch of scroll at the foot that moves nothing. */
  assert.match(mac, /animation-range: 0% 85%/);

  // And the hero leaves with the rise rather than snapping to zero when a flag
  // flips partway through it.
  assert.match(css, /@keyframes g-hero-clear/);

  // And with the window up, the hero behind it is not still catching the
  // pointer through the gap around it.
  assert.match(landing, /inert=\{open\}/);
  assert.match(css, /\.g-poster\[data-open="true"\] \.g-hero \{/);
});

test("the footer carries its own styles", async () => {
  const footer = await source(`${L}/site-footer.tsx`);
  const css = await source(`${L}/footer.css`);

  // The footer has its own stylesheet, so every page that renders it is styled.
  assert.match(footer, /import "\.\/footer\.css"/);
  assert.match(css, /\.g-footer \{/);
  assert.match(css, /\.g-foot-copy \{/);
  assert.match(css, /padding-inline: var\(--g-gutter\)/);
});

test("one gutter holds every page off the edge", async () => {
  const tokens = await source(`${L}/tokens.css`);
  assert.match(tokens, /--g-gutter:/);

  // The nav, the hero, the legal pages, the account page and the footer each
  // had their own, so the left edge of a page moved as you scrolled down it.
  for (const f of [
    `${L}/landing.css`,
    `${L}/legal.css`,
    `${L}/footer.css`,
    "src/app/account/account.css",
  ]) {
    const css = await source(f);
    assert.match(css, /var\(--g-gutter\)/, `${f} does not use the gutter`);
    assert.ok(
      !/--gutter:/.test(css),
      `${f} still declares a gutter of its own`,
    );
  }
});

test("a legal page can be navigated and got out of", async () => {
  const page = await source("src/components/legal-page.tsx");
  const css = await source(`${L}/legal.css`);
  const nav = await source(`${L}/site-nav.tsx`);

  // The anchors are the headings. `#section-4` says nothing and breaks the
  // moment a section is inserted above it.
  assert.match(page, /function slugOf/);
  const markup = page.slice(page.indexOf("export function LegalPage"));
  assert.ok(!/#section-/.test(markup), "the anchors are counters again");
  assert.match(markup, /id=\{slugs\[index\]\}/);

  // The contents list says where you are, and it takes the last section in
  // the band rather than the first, which left it one heading behind.
  assert.match(page, /new IntersectionObserver/);
  assert.match(page, /for \(let i = slugs\.length - 1/);
  assert.match(css, /\.g-legal-toc a\[data-current="true"\]/);

  // Following a heading replaces the address rather than pushing an entry, so
  // Back leaves the page in one press. Back is told where home is.
  assert.match(page, /history\.replaceState/);
  assert.match(page, /backHref="\/"/);
  assert.match(nav, /backHref/);
});

test("the privacy policy and the terms are reachable from the front page", async () => {
  const footer = await source(`${L}/site-footer.tsx`);
  const landing = await source(`${L}/landing.tsx`);
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${L}/landing.css`);

  assert.match(footer, /href: "\/privacy"/);
  assert.match(footer, /href: "\/terms"/);
  assert.match(landing, /<FooterLine \/>/);
  assert.doesNotMatch(landing, /Play intro|SiteIntro/);
  assert.match(finder, /Legal/, "the window has no legal section");

  const line = css.slice(
    css.indexOf(".g-footline {"),
    css.indexOf("}", css.indexOf(".g-footline {")),
  );
  assert.match(line, /bottom: calc\(var\(--mac-peek\)/);
});

/* ---------------------------------------------------------- the two actions */

test("the ripple survives a keyboard, and a reduced-motion setting turns it off", async () => {
  const button = await source(`${L}/ripple-button.tsx`);
  const css = await source(`${L}/landing.css`);

  // The reference centres the ripple on the pointer, so an Enter press
  // produces nothing at all.
  assert.match(button, /onKeyUp/);
  assert.match(button, /"Enter"/);
  assert.match(button, /prefers-reduced-motion/);

  /* Keyed by a counter, not `Date.now()`, so two clicks in the same millisecond
     make two ripples. Comments are stripped first because the file's comment
     names `Date.now()`. */
  const ripple = button
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Date\.now\(\)/.test(ripple), "ripples are keyed by the clock");
  assert.match(ripple, /seq\.current \+= 1/);
  assert.match(ripple, /key: seq\.current/);

  /* One stylesheet owns the ripple; a second copy in `landing.css` won the
     cascade on some buttons and made the ripple invisible on the accent. */
  const own = await source(`${L}/ripple-button.css`);
  assert.match(own, /@keyframes gRipple/);
  assert.doesNotMatch(css, /@keyframes g-rippling/);
  assert.doesNotMatch(css, /\.g-ripple-wave \{/);

  /* Drawn in the label's own colour, which always contrasts with the fill it
     sits on. */
  assert.match(own, /--ripple: currentColor;/);

  /* No glow: one hairline of specular light and a 2% scale on hover. The scale
     goes through `--pop` because the tilt needs the same `transform` property
     (next test). */
  assert.doesNotMatch(css, /rgba\(247, 168, 196, 0\.\d+\)/);
  assert.match(own, /--pop: var\(--ripple-hover\);/);
  assert.match(own, /--pop: var\(--ripple-press\);/);
  assert.match(own, /var\(--duration/);
});

test("the surface tips toward the pointer, and only for a mouse", async () => {
  const button = await source(`${L}/tilt.ts`);
  const own = await source(`${L}/ripple-button.css`);

  // Buttons tilt six degrees; the hook takes the angle so a bigger surface can tilt less.
  assert.match(await source(`${L}/ripple-button.tsx`), /useTilt\(6\)/);

  /* One composed transform: two `transform` declarations cannot both apply, so
     a separate hover `scale()` would delete the rotation. */
  assert.match(
    own,
    /transform: perspective\([^)]*\) rotateX\(var\(--tilt-x\)\)/,
  );
  assert.match(own, /rotateY\(var\(--tilt-y\)\)\n?\s*scale\(var\(--pop\)\)/);
  assert.doesNotMatch(own, /:hover[^{]*\{[^}]*transform: scale/);

  /* Neutral at rest, which is what makes the whole thing collapse to nothing
     on a touch screen and on the server without a branch anywhere. */
  const base = own.slice(
    own.indexOf(".g-ripple {"),
    own.indexOf("/* The pop."),
  );
  for (const zero of [
    "--tilt-x: 0deg;",
    "--tilt-y: 0deg;",
    "--rim-x: 0px;",
    "--pop: 1;",
  ]) {
    assert.ok(base.includes(zero), `the tilt does not rest at ${zero}`);
  }

  /* The shading both lightens and darkens: either alone vanishes on one of the
     appearances. */
  assert.match(own, /rgba\(255, 255, 255, 0\.16\)/);
  assert.match(own, /rgba\(0, 0, 0, 0\.11\)/);
  assert.match(own, /inset var\(--rim-x\) var\(--rim-y\)/);
  assert.match(own, /inset calc\(var\(--rim-x\) \* -1\)/);

  /* Ghost has no fill, so a wash on it is a blob floating on the page. */
  assert.match(
    own,
    /\.g-ripple\[data-variant="ghost"\]::after \{\s*display: none;/,
  );

  /* Mouse only, and off under reduced motion. */
  assert.match(button, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(button, /prefers-reduced-motion: reduce/);
  assert.match(button, /event\.pointerType !== "mouse"/);

  /* Written straight onto the node. Routing a pointer move through React state
     re-renders every button in the row on every frame. */
  assert.match(button, /style\.setProperty\("--tilt-x"/);
  assert.doesNotMatch(button, /useState[^)]*tilt/i);

  /* On leave it returns to flat, position included, so the shading fades out
     evenly. Both callers wire it, or a surface stays tipped. */
  const rest = button.slice(button.indexOf("const rest = useCallback"));
  assert.match(rest, /"--tilt-px", "50%"/);
  for (const caller of [`${L}/ripple-button.tsx`]) {
    const text = await source(caller);
    assert.match(text, /onPointerMove=/, `${caller} never starts the tilt`);
    assert.match(text, /onPointerLeave=/, `${caller} never lets it go`);
    assert.match(text, /tilt\.rest\(event\)/, `${caller} does not reset`);
  }
});

test("two ways in have clear primary and secondary button treatments", async () => {
  const landing = await source(`${L}/landing.tsx`);
  const css = await source(`${L}/landing.css`);

  /* Dashboard is the same sized, responsive control as the primary action,
     with a destination glyph and a quieter secondary treatment. */
  assert.doesNotMatch(landing, /className="g-underline"/);
  assert.match(landing, /className="g-open"/);
  assert.match(landing, /href="\/servers"/);
  assert.match(landing, /<RippleButton/);
  assert.match(landing, /IconLayoutDashboard/);
  assert.match(
    landing,
    /className="g-open"[\s\S]{0,160}variant="secondary"[\s\S]{0,80}size="lg"/,
  );

  /* It has its own edge and neutral fill, never the primary pink. */
  const open = css.slice(
    css.indexOf(".g-open {"),
    css.indexOf("}", css.indexOf(".g-open {")),
  );
  assert.match(
    open,
    /background: var\(--g-fill-2\)/,
    "the second way in is an outline again",
  );
  /* Both use the same button proportions (8px corner, 24 by 12 padding, 14px at
     600) and are asserted against each other, so the pair always matches. */
  const filled = css.slice(
    css.indexOf(".g-add {"),
    css.indexOf("}", css.indexOf(".g-add {")),
  );
  for (const [name, rule] of [
    ["the filled one", filled],
    ["the second way in", open],
  ] as const) {
    assert.match(rule, /border-radius: 8px/, `${name} is a different corner`);
    assert.match(rule, /padding: 12px 24px/, `${name} is a different size`);
    assert.match(rule, /font-size: 14px/, `${name} is a different size`);
    assert.match(rule, /font-weight: 600/, `${name} is a different weight`);
    assert.match(rule, /border: 1px solid/, `${name} is a different height`);
  }
  assert.ok(
    !/background:\s*var\(--g-accent\)/.test(open),
    "there are two filled buttons now",
  );

  const add = css.slice(
    css.indexOf(".g-add {"),
    css.indexOf("}", css.indexOf(".g-add {")),
  );
  assert.match(add, /background: var\(--g-accent\)/);
  assert.match(add, /color: var\(--g-on-accent\)/);

  /* The claim carries the accent; in plain ink the headline reads as one white
     wall. */
  const free = css.slice(
    css.indexOf(".g-hero-free {"),
    css.indexOf("}", css.indexOf(".g-hero-free {")),
  );
  assert.match(free, /color: var\(--g-accent-display/);
  assert.doesNotMatch(
    free,
    /text-decoration/,
    "the rule is back as well as the colour",
  );
  /* And it is the phrase, not the full stop at the end of it: the confetti
     comes out of the middle of what is being claimed. */
  assert.match(
    landing,
    /<ConfettiWord className="g-hero-free">For free\.<\/ConfettiWord>/,
  );
});

test("the hero keeps the description and actions aligned without a divider or statistics", async () => {
  const landing = await source(`${L}/landing.tsx`);
  const css = await source(`${L}/landing.css`);

  /* Copy and actions share a centred row, with the actions pinned to the far
     edge rather than positioned by the removed statistics. */
  const foot = css.slice(
    css.indexOf(".g-hero-foot {"),
    css.indexOf("}", css.indexOf(".g-hero-foot {")),
  );
  assert.match(foot, /grid-template-columns: minmax\(0, 52ch\) auto/);
  assert.match(foot, /align-items: center/);
  const actions = css.slice(
    css.indexOf(".g-hero-actions {"),
    css.indexOf("}", css.indexOf(".g-hero-actions {")),
  );
  assert.match(actions, /justify-self: end/);
  /* And below the width where the two halves fit on one line, they stack. */
  const narrow = css.slice(css.indexOf("@media (max-width: 900px)"));
  assert.match(
    narrow,
    /\.g-hero-foot \{\s*grid-template-columns: minmax\(0, 1fr\)/,
  );

  /* The headline is the list and the claim; the sentence under it says what
     Gator delivers and what makes it different, plainly, so it can stand next
     to the module copy. Five modules named and the rest counted, tied to
     `MODULE_COUNT`. */
  assert.match(landing, /A better server starts /);
  assert.match(landing, /with Gator\. /);
  assert.match(landing, /For free\./);
  /* Read off the element rather than the file: the note above it in the source
     quotes the sentence it replaced, which is the point of the note. */
  const ledeAt = landing.indexOf('<p className="g-hero-lede">');
  const lede = landing.slice(ledeAt, landing.indexOf("</p>", ledeAt));
  assert.match(lede, /Sessions, shifts, tickets, infractions, leaves, and twenty-one/);
  assert.match(lede, /more\. Free, and run from one dashboard\./);
  assert.doesNotMatch(lede, /delivers a variety of/, "the frame is back");
  assert.doesNotMatch(lede, /ranging from/, "the frame is back");
  const { MODULE_COUNT } = await import("../src/components/site/modules.ts");
  assert.equal(
    MODULE_COUNT,
    26,
    "the wall changed size and the hero still counts twenty-one of them",
  );
  assert.doesNotMatch(landing, /daily operations/, "the filler line is back");
  assert.doesNotMatch(
    landing,
    /three bots and a spreadsheet/,
    "the line about other people's bots is back",
  );
  assert.doesNotMatch(landing, /outgrew a pinned message/);
  assert.doesNotMatch(landing, /Run sessions, record infractions/);

  /* And the words a product page reaches for when it has nothing to say. */
  for (const filler of [
    "daily operations",
    "focused workspace",
    "enable what you need",
    "everything from one bot",
    "all-in-one",
    "streamline",
    "powerful",
    "seamless",
  ]) {
    assert.ok(
      !landing.toLowerCase().includes(filler),
      `the hero reaches for filler: ${filler}`,
    );
  }

  assert.doesNotMatch(foot, /border-top/);
  assert.doesNotMatch(landing, /className="g-hero-facts"/);
  assert.doesNotMatch(landing, /servers today/);
});

test("the confetti is polite", async () => {
  const word = await source(`${L}/confetti-word.tsx`);

  assert.match(word, /prefers-reduced-motion/, "it fires through reduced motion");
  assert.match(word, /COOLDOWN/, "it can be retriggered without limit");
  assert.match(word, /await import\("canvas-confetti"\)/, "the library is not deferred");
  assert.match(word, /pointerType === "touch"/, "a touch screen cannot hover");
  // It owns its canvas and takes it with it.
  assert.match(word, /document\.body\.appendChild/);
  assert.match(word, /canvas\.current\?\.remove\(\)/);
});

/* -------------------------------------------------------------- the shell */

test("the header is the one the landing already had", async () => {
  const nav = await source(`${L}/site-nav.tsx`);
  const landing = await source(`${L}/landing.tsx`);
  const css = await source(`${L}/landing.css`);

  assert.match(landing, /<SiteNav user=\{user\} leading="brand" \/>/);
  assert.match(nav, /Documentation/);
  assert.match(nav, /Dashboard/);
  assert.match(nav, /Support/);
  assert.match(nav, /g-profile/, "the profile chip is gone");

  // It does not grow on hover, which was the point of it.
  assert.ok(!/\.g-profile:hover[^}]*width/.test(css), "the chip expands on hover");

  // Sticky, so scrolling the window up never takes the header away.
  const sticky = css.slice(css.indexOf(".g-hero-sticky {"), css.indexOf("}", css.indexOf(".g-hero-sticky {")));
  assert.match(sticky, /position: sticky/);
  assert.match(sticky, /height: 100svh/);
});

test("the landing is flat: no loader, no custom cursor, no doodles", async () => {
  const banned = [
    "site-loader",
    "cursor-bubble",
    "cursors.css",
    "doodle-sticker",
    "transition-scribble",
    "particle-vortex",
  ];
  for (const { file, text } of await landingSources()) {
    for (const b of banned) {
      assert.ok(!text.includes(b), `${file} still reaches for ${b}`);
    }
  }
  const stack = ["src/app"];
  const found: string[] = [];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of await readdir(path.join(root, dir), {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) stack.push(`${dir}/${entry.name}`);
      else if (entry.name === "loading.tsx") found.push(`${dir}/${entry.name}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `loading screens still present: ${found.join(", ")}`,
  );
});

test("one face sets the whole site, display line and body", async () => {
  const globals = await source("src/app/globals.css");
  assert.match(globals, /--font-ui: var\(--font-rethink\)/);
  assert.match(globals, /--font-body:\s*var\(--font-rethink\)/);
  assert.match(globals, /--font-display:\s*var\(--font-rethink\)/);

  const layout = await source("src/app/layout.tsx");
  assert.match(layout, /Rethink_Sans\(/);
  // Still loaded, for the editors' font menus and the Gallery Heading.
  assert.match(layout, /Merriweather\(/);
  assert.match(layout, /Nunito\(/);

  const css = await source(`${L}/landing.css`);
  const h1 = css.slice(css.indexOf(".g-hero-h1 {"), css.indexOf("}", css.indexOf(".g-hero-h1 {")));
  assert.match(h1, /var\(--font-ui\)/);
});

test("the module list is the dashboard's, not a guess", async () => {
  const modules = await source(`${L}/modules.ts`);
  const schema = await source("src/components/Manage/schema.ts");

  // Taken from MODULE_TOGGLES, the list the dashboard and /config both use, so
  // the landing cannot list a module that does not exist or miss one that does.
  const names = [...modules.matchAll(/^        name: "([^"]+)",$/gm)].map((m) => m[1]);
  assert.ok(names.length >= 24, `expected the real module count, got ${names.length}`);
  assert.ok(!names.includes("Training"), "Training has no toggle behind it");

  for (const name of ["Shifts", "Player Punishments", "GatorAI", "ERLC"]) {
    assert.ok(names.includes(name), `the list is missing ${name}`);
    assert.ok(schema.includes(`label: "${name}"`), `${name} is not in the schema`);
  }

  // Every module carries the dashboard's own line about it, verbatim.
  for (const m of modules.matchAll(/name: "[^"]+",\n        purpose:?\s*\n?\s*"([^"]+)"/g)) {
    assert.ok(m[1].length > 20, `a purpose is too thin: ${m[1]}`);
  }
});

test("the landing stylesheets stay out of a cascade layer", async () => {
  for (const f of [`${L}/landing.css`, `${M}/mac.css`]) {
    const css = await source(f);
    assert.ok(
      !/^@layer gator \{/m.test(css),
      `${f} is layered; Tailwind's unlayered preflight would outrank it`,
    );
  }
});

test("Astryx is themed by its tokens and confined to the landing", async () => {
  const theme = await source(`${L}/astryx-theme.css`);
  assert.match(theme, /@import "@astryxdesign\/core\/astryx\.css"/);
  assert.match(theme, /--color-accent:\s*var\(--g-accent\)/);
  assert.match(theme, /--color-on-accent:\s*var\(--g-on-accent\)/);
  assert.match(theme, /\.g-root\[data-astryx-theme="neutral"\]/);
  assert.match(theme, /revert-layer/);
});

test("the alligator is one real vector, used everywhere", async () => {
  const svg = await source("public/brand/gator.svg");
  assert.ok(!svg.includes("base64"), "the mark must stay a real outline");
  assert.match(svg, /fill="currentColor"/);
  assert.ok(svg.length < 20000);

  // One drawing of the animal, used at every size: the header, the window's
  // title bar, and the favicon it is generated from.
  const logo = await source(`${L}/gator-logo.tsx`);
  assert.match(logo, /<path d="[^"]{200,}"/);
  const uses = (await landingSources()).filter((f) => /GatorLogo/.test(f.text));
  assert.ok(uses.length >= 2, "the mark is only used in one place");
});

test("there are two appearances and three settings", async () => {
  const tokens = await source(`${L}/tokens.css`);
  const theme = await source(`${L}/theme.ts`);
  const toggle = await source(`${L}/theme-toggle.tsx`);
  const nav = await source(`${L}/site-nav.tsx`);
  const layout = await source("src/app/layout.tsx");

  // An explicit choice beats the device, and no choice defers to it. So the
  // light palette is written twice: grouping the two selectors would let the
  // media query win over the attribute.
  assert.match(tokens, /:root\[data-theme="light"\]/);
  assert.match(tokens, /:root:not\(\[data-theme\]\)/);
  assert.match(tokens, /color-scheme: dark/);
  assert.match(tokens, /color-scheme: light/);

  // Auto is the absence of the attribute, not a third palette.
  assert.match(toggle, /removeAttribute\("data-theme"\)/);

  // Stamped before paint, so the chosen appearance never flashes the other
  // first. It lives outside the client module so the root layout can inline it.
  assert.match(theme, /THEME_SCRIPT/);
  assert.ok(!/"use client"/.test(theme), "the script pulls in a client module");
  assert.match(layout, /THEME_SCRIPT/);

  assert.match(nav, /<ThemeToggle/);

  /* One control you press that cycles through all three modes (a two-state
     switch would drop Auto). It shows the current mode and where the next press
     goes. */
  assert.match(toggle, /const ORDER: Theme\[\] = \["light", "dark", "auto"\]/);
  assert.match(toggle, /ORDER\[\(ORDER\.indexOf\(theme\) \+ 1\) % ORDER\.length\]/);
  assert.match(toggle, /g-theme-tip-now/);
  assert.match(toggle, /g-theme-tip-next/);
  assert.match(toggle, /aria-label=/);
});

/* ------------------------------------------- the header, and what is in it */

test("the header morphs on the scroll rather than on a threshold", async () => {
  const nav = await source(`${L}/site-nav.tsx`);
  const css = await source(`${L}/landing.css`);
  const servers = await source("src/app/servers/page.tsx");

  // Opt-in: right on the picker (the longest scroll), wrong on the landing,
  // where the header sits over the hero.
  assert.match(nav, /float\?: boolean;/);
  assert.match(servers, /<SiteNav[\s\S]{0,200}float\n/);
  assert.doesNotMatch(servers, /className="g-nav-solid"[\s\S]{0,80}float/);

  /* Driven by a scroll timeline, not a listener toggling a class at a threshold
     (which flickers on a trackpad flick or arrives late). */
  assert.ok(!/addEventListener\(\s*["']scroll["']/.test(nav));
  assert.ok(!/window\.scrollY/.test(nav));
  assert.match(css, /@keyframes g-nav-draw-in/);
  assert.match(css, /@keyframes g-nav-pill/);
  assert.match(css, /animation-timeline: scroll\(root block\)/);

  /* Guarded: `animation` with no duration and no timeline runs instantly, so an
     unsupporting browser would show the pill from the start. Without support it
     gets the plain bar. */
  const guard = css.slice(css.indexOf("@supports (animation-timeline: scroll())"));
  assert.match(guard, /\.g-nav\[data-float="true"\] \{[^}]*animation: g-nav-draw-in/);

  /* The bar is a layer inside the header: a sticky element cannot be narrowed
     and rounded without losing its stickiness. */
  assert.match(nav, /<div className="g-nav-bar">/);
  assert.match(css, /\.g-nav-bar \{/);

  // Wide. It still has to hold a wordmark, three links and three tools.
  assert.match(css, /calc\(\(100vw - 1200px\) \/ 2\)/);

  /* The surface is its own layer so it can fade while the geometry moves;
     fading `background-color` from `transparent` fades from transparent black
     and greys the pill in light mode. */
  assert.match(css, /\.g-nav\[data-float="true"\] \.g-nav-bar::before \{/);
  assert.match(css, /@keyframes g-nav-surface/);
});

test("the palette knows what the site actually contains", async () => {
  const palette = await source(`${L}/command-palette.tsx`);
  const index = await source("src/config/docs-index.ts");
  const nav = await source(`${L}/site-nav.tsx`);

  /* The palette carries every docs page, with the docs' own descriptions and
     keywords, so a query that finds a page there finds it here. */
  assert.match(index, /export const DOCS_PAGES: DocsPage\[\]/);
  assert.match(index, /keywords: string;/);
  assert.match(palette, /DOCS_PAGES\.map/);
  assert.match(palette, /MODULES\.map/);

  /* Every module row goes to a page that exists: its own page, or the
     catalogue, which has a row per module. */
  assert.match(palette, /MODULE_DOCS\[module\.key\] \?\? MODULE_CATALOGUE/);

  /* Ranked, not filtered. `includes()` on a joined string puts "Modules" above
     "Message Quota" for "mod", because it sorts by nothing at all. */
  assert.match(palette, /function score\(entry: PaletteEntry, term: string\): number/);
  assert.match(palette, /if \(title === term\) return 1000/);
  assert.match(palette, /if \(title\.startsWith\(term\)\) return 800/);

  /* Grouping reorders the ranking, so the cursor follows the order rows are
     drawn in. */
  assert.match(palette, /rows: rows\.map\(\(entry\) => \(\{ entry, seat: seat\+\+ \}\)\)/);
  assert.match(palette, /const hit = ordered\[cursor\]/);

  // Openable from anywhere, and closable from the field.
  assert.match(palette, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(palette, /event\.key === "Escape"/);

  /* In a portal: the header has its own stacking context, so a dialog inside it
     cannot reliably cover the page. The host is read directly (not stored after
     an effect) so the field exists on the frame it takes focus. */
  assert.match(palette, /createPortal\(/);
  assert.match(palette, /if \(typeof document === "undefined"\) return null;/);
  assert.ok(!/useEffect\(\(\) => setHost\(document\.body\), \[\]\)/.test(palette));

  // Left of the appearance block, grouped with it and the profile chip.
  assert.match(nav, /<div className="g-nav-tools">\s*\n\s*<CommandPalette/);
});

test("the appearance arrives from the control that changed it", async () => {
  const toggle = await source(`${L}/theme-toggle.tsx`);
  const css = await source(`${L}/theme-toggle.css`);

  /* The switch runs inside a view transition (as in Animate UI's theme
     toggler), opening as a circle from the button rather than from a window
     edge. */
  assert.match(toggle, /document\.startViewTransition/);
  assert.match(toggle, /flushSync\(change\)/);
  assert.match(toggle, /circle\(0px at \$\{x\}px \$\{y\}px\)/);
  assert.match(toggle, /pseudoElement: "::view-transition-new\(root\)"/);

  // The radius has to reach the furthest corner from wherever it started, or
  // the old appearance is still showing in one of them when it stops.
  assert.match(toggle, /Math\.hypot\(\s*Math\.max\(x, window\.innerWidth - x\)/);

  /* Without view transitions, under reduced motion, or if the transition fails,
     the appearance still changes, and the attribute is cleaned up. */
  assert.match(toggle, /typeof document\.startViewTransition !== "function"/);
  assert.match(toggle, /prefers-reduced-motion/);
  assert.match(toggle, /transition\.finished\.then\(done, done\)/);

  /* The rule that removes the default cross-fade is scoped to the wipe; route
     changes use the same pseudo-elements. */
  assert.match(css, /:root\[data-wipe="true"\]::view-transition-new\(root\)/);
  assert.ok(
    !/^::view-transition/m.test(css),
    "the cross-fade is turned off for every view transition, not just this one",
  );
});

test("a legal page says how much of it is left", async () => {
  const page = await source("src/components/legal-page.tsx");
  const css = await source(`${L}/legal.css`);

  /* A progress bar for where you are in the document; the contents list says
     what is in it. */
  assert.match(page, /className="g-legal-progress"/);
  assert.match(css, /@keyframes g-legal-read/);
  assert.match(css, /animation-timeline: scroll\(root block\)/);

  // No listener and no state; without scroll timelines it shows nothing rather
  // than something wrong.
  assert.ok(!/addEventListener\(\s*["']scroll["']/.test(page));
  assert.match(css, /\.g-legal-progress \{[^}]*transform: scaleX\(0\);/);
});

test("a phone gets the Files app, not the Mac window made smaller", async () => {
  const ios = await source(`${L}/mac/ios.css`);
  const files = await source(`${L}/mac/files.tsx`);
  const finder = await source(`${L}/mac/finder.tsx`);
  const landing = await source(`${L}/landing.tsx`);

  assert.match(landing, /mac\/ios\.css/, "the phone sheet is never loaded");

  /* On a phone the Mac window is not restyled, it is not drawn: the phone has
     its own iOS-style component. */
  assert.match(ios, /\.g-mac-desktop \{\s*display: none/);
  assert.match(finder, /<IosFiles/);
  assert.match(finder, /className="g-mac-desktop"/);

  /* A phone has a navigation stack (push and pop, no forward), not a Finder's
     history. */
  // Read past the prose: the file explains why there is no forward stack, and
  // the explanation is not the thing being checked.
  const code = files.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/future/.test(code), "the phone still carries a forward stack");
  assert.ok(!/aria-label="Forward"/.test(code), "the phone still has a forward button");
  assert.match(files, /const \[stack, setStack\]/);
  assert.ok(
    !/g-mac-steps button:last-child/.test(ios),
    "the phone is still hiding the Mac's forward button rather than not having one",
  );

  /* iOS push: the new screen slides in from the trailing edge while the one
     underneath moves a quarter out and dims, which shows that back leads
     somewhere already seen. */
  assert.match(ios, /\.g-ios\[data-pushed="true"\] \.g-ios-root \{\s*transform: translateX\(-25%\)/);
  assert.match(ios, /\.g-ios-root::after/);

  /* The large title lives inside the scroller and collapses into the bar's
     small title as it scrolls away, as in iOS. */
  assert.match(files, /className="g-ios-large-title"/);
  assert.match(files, /setCollapsed/);
  assert.match(ios, /\.g-ios-nav\[data-collapsed="true"\] \.g-ios-inline-title/);
  // And it is an observer, like everything else on this page: the standing
  // rule is that no scroll position is ever read in JavaScript.
  assert.match(files, /new IntersectionObserver/);

  /* A document opens in a sheet, not a second window: up from the bottom edge,
     stopping short of the top, with a grabber saying it can be pulled down. */
  assert.match(files, /className="g-ios-grabber"/);
  assert.match(ios, /\.g-ios-sheet \{/);
  assert.match(ios, /max-height: calc\(100% - 34px\)/);

  // Apple's metrics: a 44pt navigation bar, a 49pt tab bar, a 36pt search
  // field, a 32pt segmented control, and 44pt rows.
  const at = (selector: string) =>
    ios.slice(ios.indexOf(selector), ios.indexOf("}", ios.indexOf(selector)));
  assert.match(at(".g-ios-bar {"), /height: 44px/);
  assert.match(ios, /height: calc\(49px \+ env\(safe-area-inset-bottom/);
  assert.match(at(".g-ios-search {"), /height: 36px/);
  assert.match(at(".g-ios-seg {"), /height: 32px/);
  assert.match(at(".g-ios-row {"), /min-height: 44px/);
  assert.match(at(".g-ios-grabber {"), /width: 36px/);

  /* The separator starts where the row's text starts, which is the detail that
     makes a grouped list read as rows rather than as stripes. */
  assert.match(ios, /\.g-ios-row \+ \.g-ios-row::before/);
  assert.match(ios, /left: var\(--ios-lead\)/);

  /* Search covers both lists, since someone typing "modmail" does not know
     which list it is in. */
  assert.match(files, /placeholder="Search modules"/);
  assert.match(files, /REST\.filter/);

  /* Three tabs on a phone; the two destinations that leave the app move to the
     bar's ellipsis, as iOS does with secondary actions. */
  const tabs = [...files.matchAll(/^  \{ key: "/gm)].length;
  assert.ok(tabs <= 3, `${tabs} tabs is more than a phone's width has room for`);
  assert.match(files, /EllipsisCircle/);

  /* A tap opens; double-click is a pointer gesture with no phone equivalent. */
  assert.ok(!/onDoubleClick/.test(files), "the phone still wants a double tap");
  assert.ok(
    !/g-hint-touch/.test(finder),
    "the Mac window is still switching a hint for a device that no longer sees it",
  );
});

test("a plain text file is reflowed for a phone, and the copy allows it", async () => {
  const files = await source(`${M}/files.tsx`);
  const content = await source(`${M}/content.ts`);

  /* The documents are hard-wrapped at about 64 characters for the Mac window;
     on a phone they are re-flowed, or every line would soft-wrap again into a
     long line and a two-word orphan. */
  assert.match(files, /function reflow/);
  assert.match(files, /reflow\(file\.lines\)/);
  // The Mac window has the width, and there the hard wrap is the point.
  const notepad = await source(`${M}/notepad.tsx`);
  assert.ok(!/reflow/.test(notepad), "the Mac window is reflowing text it has room for");

  /* Un-wrapping rule: a line continues the one above only if the one above was
     full. A short line is a heading or a paragraph's end.

     The rule is only safe because the copy keeps a wide gap around the
     threshold (headings under 22 characters, wrapped lines over 54), so the gap
     is what this test checks. Only lines followed by more prose matter; a line
     before a blank or an indent may be any length. */
  const threshold = Number(files.match(/const FULL_LINE = (\d+)/)?.[1]);
  assert.ok(threshold >= 40, "the un-wrap threshold is gone or implausible");
  const heading = 30;

  const lines = [...content.matchAll(/^  "(.*)",$/gm)].map((m) => m[1]);
  assert.ok(lines.length > 40, "the documents are not where this thinks");
  let checked = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (!line || /^\s/.test(line)) continue;
    if (!next || next.trim() === "" || /^\s/.test(next)) continue;
    checked += 1;
    assert.ok(
      line.length < heading || line.length >= threshold,
      `"${line}" is ${line.length} characters: too long to be read as a heading and too short to be read as a wrap, so the line under it may or may not be welded on`,
    );
  }
  assert.ok(checked > 8, "nothing in the documents was actually examined");
});

test("the phone's header has somewhere to go", async () => {
  const menu = await source(`${L}/nav-menu.tsx`);
  const nav = await source(`${L}/site-nav.tsx`);
  const css = await source(`${L}/landing.css`);

  /* Below 900px the header's links are hidden, so the menu has to carry them;
     otherwise a phone cannot reach the docs or dashboard from the header. */
  assert.match(nav, /<NavMenu user=\{user\} \/>/);
  assert.match(
    menu,
    /Line3Horizontal/,
    "the menu button is not the three lines",
  );
  for (const place of ["Documentation", "Dashboard", "Support"]) {
    assert.ok(menu.includes(place), `the menu cannot reach ${place}`);
  }

  /* The menu absorbs the controls beside it: only search stays in the bar, and
     the rest move into the sheet with a name each. */
  const phone = css.slice(
    css.indexOf("@media (max-width: 900px) {\n  .g-burger"),
  );
  /* Hide the wrapper, not the control inside: a hidden control in a visible
     wrapper is still a zero-width flex item that costs a gap on each side. */
  for (const gone of ["> .g-theme", "> .g-tip-host"]) {
    assert.ok(
      phone.includes(`.g-nav-tools ${gone}`),
      `${gone} is left in the row as a gap with nothing in it`,
    );
  }
  for (const inner of [
    ".g-nav-tools .g-theme-block",
    ".g-nav-tools .g-profile",
  ]) {
    assert.ok(
      !phone.includes(`${inner},`) && !phone.includes(`${inner} {`),
      `${inner} hides the control and leaves its wrapper spacing the row`,
    );
  }
  assert.match(menu, /useAppearance/, "appearance did not move into the sheet");
  assert.match(menu, /g-action-face/, "the account row has no face");
  // Three states, one press to each, and Auto named rather than inferred.
  assert.match(css, /\.g-action-seg\[data-at="2"\]/);

  /* The burger exists only where the links do not. */
  assert.match(css, /\.g-burger \{\s*display: none/);
  assert.match(
    css,
    /@media \(max-width: 900px\) \{\s*\.g-burger \{\s*display: grid/,
  );

  /* It opens from the bottom edge, where a thumb can reach every row. */
  assert.match(css, /\.g-action-sheet \{/);
  assert.match(css, /justify-content: flex-end/);

  /* No Cancel button: this is a menu of places, dismissed by tapping off it.
     The scrim carries the label instead. */
  assert.ok(!/g-action-cancel/.test(menu), "the Cancel capsule is back");
  assert.ok(
    !/g-action-cancel/.test(css),
    "the Cancel capsule's rules are back",
  );
  assert.match(
    menu,
    /className="g-sheet-scrim"[\s\S]{0,140}aria-label="Close menu"/,
  );

  /* It leaves the way it arrived: the exit is the entrance reversed, and the
     unmount waits for it. */
  assert.match(menu, /setClosing/);
  assert.match(menu, /onAnimationEnd/);
  assert.match(css, /\.g-sheet-layer\[data-closing="true"\] \.g-action-sheet/);

  /* The exit has its own keyframes, not the entrance in `reverse`: changing
     only `animation-direction` continues the running animation, no second
     `animationend` fires, and the sheet stays mounted with its scrim blocking
     the page. */
  const exit = css.slice(
    css.indexOf('.g-sheet-layer[data-closing="true"] .g-action-sheet'),
  );
  assert.match(exit, /animation: g-sheet-fall/);
  assert.ok(
    !/animation:[^;]*reverse/.test(exit.slice(0, 200)),
    "the exit is the entrance reversed, which never fires animationend",
  );
  assert.match(css, /@keyframes g-sheet-fall/);

  // And a floor under the event, because a leaked scrim is an unclickable site.
  assert.match(menu, /setTimeout\(finished/);

  // A dialog, and one that gives focus back to the button that opened it.
  assert.match(menu, /role="dialog"/);
  assert.match(menu, /aria-modal="true"/);
  assert.match(menu, /button\.current\?\.focus\(\)/);
  assert.match(menu, /event\.key === "Escape"/);
});

test("focus draws a ring without reshaping what it is around", async () => {
  const tokens = await source(`${L}/tokens.css`);
  const rule = tokens.slice(
    tokens.indexOf(".g-root :where(a, button, [tabindex]):focus-visible"),
    tokens.indexOf("}", tokens.indexOf(".g-root :where(a, button, [tabindex]):focus-visible")),
  );

  /* The focus rule sets only the outline. A `border-radius` there squared off
     every capsule on focus; an outline already follows the element's own
     radius. */
  assert.match(rule, /outline: 2px solid var\(--g-accent\)/);
  assert.ok(
    !/border-radius/.test(rule),
    "the focus ring is reshaping the control it is drawn around",
  );
});

test("the display accent is the fill corrected for its surround, not a second pink", async () => {
  const tokens = await source(`${L}/tokens.css`);

  /* Two tokens with different numbers so they read as one colour: the same pink
     as open type on pale paper and as a compact fill around a dark label does
     not look alike (simultaneous contrast). The display token is the fill at
     the same hue and saturation, darker. */
  const light = tokens.slice(tokens.indexOf(':root[data-theme="light"]'));
  const fill = /--g-accent: (#[0-9a-f]{6});/.exec(light);
  const display = /--g-accent-display: (#[0-9a-f]{6});/.exec(light);
  assert.ok(fill && display, "the light palette lost one of the two pinks");

  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [fr, fg, fb] = rgb(fill![1]);
  const [dr, dg, db] = rgb(display![1]);

  /* Deeper, or the correction is going the wrong way. */
  const lightness = (r: number, g: number, b: number) =>
    (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  assert.ok(
    lightness(dr, dg, db) < lightness(fr, fg, fb),
    "the display accent is no deeper than the fill, so the paper still eats it",
  );

  /* Same pink, though: off the accent's hue and it stops being a correction
     and starts being the second colour the whole exercise was about. */
  const hue = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const span = max - Math.min(r, g, b);
    if (span === 0) return 0;
    const h =
      max === r
        ? (g - b) / span
        : max === g
          ? 2 + (b - r) / span
          : 4 + (r - g) / span;
    return (((h * 60) % 360) + 360) % 360;
  };
  assert.ok(
    Math.abs(hue(dr, dg, db) - hue(fr, fg, fb)) < 3,
    "the display accent drifted off the fill's hue",
  );
});

test("the light appearance's dots are visible on paper", async () => {
  const dots = await source(`${L}/dot-field.css`);
  const field = await source(`${L}/dot-field.tsx`);

  /* One colour in both appearances (the accent), with far more alpha on paper:
     the pink is 10.6:1 on the dark ground and 2.04:1 on paper. */
  assert.match(field, /getPropertyValue\("--g-accent"\)/);

  /* Read from the canvas element, not `:root`: `--g-dot-alpha` is declared on
     `.g-dots`, so reading the root always fell back to the default. */
  assert.match(field, /getComputedStyle\(host\)/);
  assert.doesNotMatch(
    field,
    /getComputedStyle\(document\.documentElement\)/,
    "the dot alpha is being read off an element that never carries it",
  );

  const alphas = [...dots.matchAll(/--g-dot-alpha: ([\d.]+);/g)].map((m) =>
    Number(m[1]),
  );
  assert.equal(alphas.length, 3, "the dot alpha is no longer stated three times");
  const [dark, explicit, byScheme] = alphas;
  assert.equal(
    explicit,
    byScheme,
    "the two light copies disagree, so a device set to dark gets the wrong one",
  );
  /* Light needs clearly more alpha than dark: a dark dot on paper is a
     decrement and cannot carry what a light dot on near-black carries as an
     increment. */
  assert.ok(
    explicit > dark * 1.6,
    `the light dots are at ${explicit} against a 2.04:1 pink and will not read`,
  );
  /* The dark base stays at or below about 0.34: the pointer's glow multiplies
     it, and a higher base clips the brightest dots into a flat disc. */
  assert.ok(dark <= 0.34, `a base of ${dark} clips under the glow`);

  /* A deeper ink than the accent for the dots on paper. Contrast ratio models
     text legibility; for a sparse texture what matches the eye is the local
     increment against the surround, and the brand pink tops out too low. */
  assert.match(dots, /--g-dot-ink: #a8345d;/);
  assert.match(field, /getPropertyValue\("--g-dot-ink"\)/);
  assert.ok(
    field.indexOf('getPropertyValue("--g-dot-ink")') <
      field.indexOf('getPropertyValue("--g-accent")'),
    "the accent is being read before the appearance's own dot ink",
  );

  /* Headroom for the pointer, which multiplies this base rather than
     replacing it. At 1.0 there is nothing left to light. */
  assert.ok(explicit < 1, "the dots are opaque, so the pointer cannot light them");
});

test("nothing on the Apple surfaces is under AA", async () => {
  const sheet = await source(`${M}/sheet.css`);
  const tokens = await source(`${L}/tokens.css`);

  /* No label sits on a folder hue: the hue is used as text on the sheet's own
     ground, where it is the foreground. (White on the raw hues measured as low
     as 2.47:1.) */
  assert.ok(
    !/color: #fff;/.test(sheet),
    "something on the sheet is back on white text over a folder hue",
  );
  assert.doesNotMatch(sheet, /\.g-tint-button[.:{]/, "the tint button is back");
  /* The light chrome's dim label is a solid colour, not ink at an alpha,
     measured against the surfaces it actually sits on. */
  assert.match(tokens, /--mac-label-dim: #7d5c5c/);
  assert.match(tokens, /--g-ink-faint: #919191/);
});

test("the window's chrome is one icon family, and it is the site's", async () => {
  const sf = await source(`${M}/sf.tsx`);
  const finder = await source(`${M}/finder.tsx`);

  /* The window's icons are Tabler, the same set as the nav, the dashboard and
     the server picker. */
  assert.match(finder, /from "@tabler\/icons-react"/);
  assert.doesNotMatch(finder, /from "\.\/sf"/, "the chrome is back on SF Symbols");

  /* sf.tsx stays, because the phone is still an iOS reconstruction and those
     are its marks. It is one family with one grid and one stroke rule. */
  assert.match(sf, /strokeLinecap="round"/);
  assert.match(sf, /strokeLinejoin="round"/);
  assert.match(sf, /weight = 1\.8/);
  assert.match(sf, /viewBox="0 0 24 24"/);
  for (const glyph of [
    "ChevronRight",
    "ChevronLeft",
    "DocTextFill",
    "MagnifyingGlass",
    "XmarkCircleFill",
    "CheckmarkCircleFill",
  ]) {
    assert.ok(sf.includes(`export const ${glyph}`), `sf.tsx has no ${glyph}`);
  }
});

test("nothing on the landing asks a thumb to hit something small", async () => {
  const css = await source(`${L}/landing.css`);
  const ripple = await source(`${L}/ripple-button.css`);

  /* Hit targets on a phone get a floor height: several controls measured 18 to
     33pt before. */
  const phone = css.slice(
    css.indexOf("@media (pointer: coarse) and (max-width: 900px)"),
  );
  assert.ok(phone, "the landing has no phone pass at all");
  for (const control of [
    ".g-find",
    ".g-theme-block",
    ".g-signin",
    ".g-brand",
    ".g-open",
  ]) {
    assert.ok(
      phone.includes(control),
      `${control} is still a desktop size on a phone`,
    );
  }

  // The buttons themselves grow rather than shrink where there is no pointer
  // -- to a phone's size, not past it.
  assert.match(ripple, /@media \(pointer: coarse\)/);
  const coarse = ripple.slice(ripple.indexOf("@media (pointer: coarse)"));
  assert.match(coarse, /min-height: 36px/);
  assert.doesNotMatch(coarse, /min-height: 50px/);
  assert.match(coarse, /\.g-ripple\[data-size="default"\] \{\s*min-height: 42px/);
  // The header's squares are drawn at 36 and hit at 44.
  assert.match(phone, /\.g-find::after,\s*\.g-theme-block::after \{[^}]*inset: -4px;/);

  /* And both actions take the width of the column. Side by side on a 393pt
     screen the filled one was 160pt with the other squeezed beside it. */
  assert.match(
    css,
    /\.g-hero-actions \.g-add,\s*\.g-hero-actions \.g-open \{\s*width: 100%/,
  );
});

test("the account page is on the same design as everything else", async () => {
  const page = await source("src/app/account/page.tsx");
  const css = await source("src/app/account/account.css");
  const overview = await source("src/components/account/account-overview.tsx");

  /* The account page uses the site's own header pill, dot field and raised
     cards, like every other page. */
  assert.match(page, /<SiteNav[\s\S]{0,240}\bfloat\b/);
  assert.match(page, /<DotField className="account-field"/);
  assert.doesNotMatch(
    css,
    /background-image: radial-gradient\(var\(--g-accent\)/,
  );

  /* The account page follows a settings layout: a plain title, two columns of
     hairline sheets, each a header band over rows divided by hairlines. */
  const sheet = css.slice(
    css.indexOf(".account-card {"),
    css.indexOf("}", css.indexOf(".account-card {")),
  );
  assert.match(sheet, /background: var\(--g-raise\)/);
  assert.match(sheet, /border: 1px solid var\(--mac-hairline/);
  assert.match(sheet, /border-radius: 12px/);
  assert.match(css, /\.account-card-head \{[^}]*border-bottom: 1px solid/);
  assert.match(css, /\.account-rows > li \+ li \{\s*border-top: 1px solid/);
  assert.match(css, /\.account-card-eyebrow \{[^}]*text-transform: uppercase/);

  /* One button style on these flat sheets: a hairline on a low fill. */
  assert.doesNotMatch(css, /\.account-ghost-button/);
  assert.doesNotMatch(overview, /account-ghost-button/);
  assert.doesNotMatch(overview, /navigator\.clipboard/);
  assert.match(css, /\.account-button \{/);

  /* Discord and Roblox are one sheet each, under their own name. */
  assert.match(overview, />Discord<\/h2>/);
  assert.match(overview, />Roblox<\/h2>/);
  assert.doesNotMatch(overview, /Connected services/);

  // A thumb can reach everything, and the columns stack.
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /\.account-grid \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(min-width: 1000px\)[\s\S]{0,120}22rem minmax\(0, 1fr\)/);
});

test("the account page's cards are the picker's cards", async () => {
  const overview = await source("src/components/account/account-overview.tsx");
  const css = await source("src/app/account/account.css");
  const tokens = await source(`${L}/tokens.css`);
  const servers = await source("src/app/servers/servers.css");

  /* The material tokens are global, not declared in `servers.css`: pages that
     used them through fallbacks got a flat fill with almost no shadow. */
  for (const token of [
    "--mac-vibrancy",
    "--mac-glass",
    "--mac-hairline",
    "--mac-sheen",
    "--mac-lift",
    "--mac-lift-high",
    "--mac-inset",
  ]) {
    assert.match(
      tokens,
      new RegExp(`\\n\\s*${token}:`),
      `${token} is not a site token`,
    );
  }
  assert.doesNotMatch(
    servers,
    /^\s*--mac-/m,
    "the material is declared in two places again",
  );

  // Light has its own, written twice like the rest of the palette so an
  // explicit choice beats a device that asked for the other one.
  const light = tokens.slice(tokens.indexOf(':root[data-theme="light"] {'));
  assert.match(light, /--mac-hairline: rgba\(90, 40, 55/);
  const auto = tokens.slice(
    tokens.indexOf("@media (prefers-color-scheme: light)"),
  );
  assert.match(auto, /--mac-hairline: rgba\(90, 40, 55/);

  assert.match(overview, /className="account-card"/);
  assert.match(overview, /className="account-rows/);
  assert.match(overview, /Your data/);
  assert.match(css, /\.account-card-head/);
  assert.match(css, /var\(--g-line\)/);
});

test("the browser tab says Gator, and the window's tabs say where they are", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const layout = await source("src/app/layout.tsx");

  /* Every tab title is just "Gator" (as `app/layout.tsx` sets); pages keep
     their own descriptions for search results and link previews. */
  assert.match(layout, /title: SITE_NAME,/);
  for (const page of [
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/account/page.tsx",
  ]) {
    const text = await source(page);
    assert.match(text, /title: SITE_NAME,/);
    assert.doesNotMatch(text, /title: "[^"]*\| Gator"/, `${page} names itself`);
    assert.match(text, /description:/, `${page} lost its description`);
  }

  /* The window's own tabs still name the place they hold: they are tabs in a
     file browser, not the browser's tab. */
  const naming = finder.slice(
    finder.indexOf("function nameOf("),
    finder.indexOf("/** Going where you already are"),
  );
  assert.match(naming, /label: place\.note\.name/);
  assert.match(naming, /label: folder\?\.label \?\? "Folder"/);
  assert.match(naming, /label: "Modules"/);
});

test("small controls are bigger than they look, and figures line up", async () => {
  const hit = await source("src/styles/hit-target.css");
  const globals = await source("src/app/globals.css");

  /* Small controls get an invisible larger hit area from a `::before`, which is
     out of flow, so nothing moves or changes size. Verified by hit-testing
     points just outside each control. */
  assert.match(globals, /@import "\.\.\/styles\/hit-target\.css";/);
  assert.match(hit, /\.sv-pin::before/);
  assert.match(hit, /\.g-legal-permalink::before/);
  assert.match(hit, /inset: -6px;/);

  /* Two limits: stacked rows take at most half the gap between them (the footer
     links get six pixels), and the bar's right cluster gets four (at six, the
     avatar's target overlapped the appearance toggle). */
  assert.match(hit, /\.g-foot-link::before \{\s*inset: -6px -8px;/);
  assert.match(
    hit,
    /\.g-find::before,\s*\.g-theme-block::before,\s*\.g-profile::before \{\s*inset: -6px -4px;/,
  );
  /* And a control that clips its own overflow cannot hold the pseudo-element
     at all, so the department kebab's wrapper carries the target instead. */
  assert.match(hit, /\.servers-department-card > div:last-child::before/);

  /* Tabular figures wherever numbers stack in a column, so every row's number
     lines up; proportional figures elsewhere. */
  assert.match(hit, /font-variant-numeric: tabular-nums;/);
  for (const sel of [
    "\\.sv-sub",
    "\\.servers-department-count",
    "\\.account-who-id",
  ]) {
    assert.match(hit, new RegExp(sel + ",|" + sel + " \\{"));
  }
});

test("everything with the keyboard can be seen to have it", async () => {
  const servers = await source("src/app/servers/servers.css");
  const content = await source("src/components/servers-content.tsx");

  /* The filter field shows a focus ring at every width; its `:focus-within`
     rule used to sit only inside the phone block. */
  const base = servers.slice(servers.indexOf(".servers-filter-field {\n  display: flex;"));
  assert.match(base, /\.servers-filter-field:focus-within \{\s*border-color: var\(--g-accent-line\)/);

  /* Escape closes it, like every other surface on the site, and focus returns
     to the control that opened it. */
  assert.match(content, /if \(event\.key !== "Escape"\) return;/);
  assert.match(content, /kebabRef\.current\?\.focus\(\);/);
  assert.match(content, /ref=\{kebabRef\}/);
});

test("each tab in the window keeps its own history", async () => {
  const finder = await source(`${M}/finder.tsx`);

  /* Each tab has its own back and forward trail, as in a browser. A single
     shared trail made back in one tab walk through another tab's visits. */
  assert.match(finder, /interface Tab extends Trail \{/);
  assert.match(finder, /useState<Tab\[\]>\(\[\{ id: 1, \.\.\.START \}\]\)/);
  /* Switching tabs is picking up a different history, not a step in anybody's,
     so it does not push onto a trail. */
  assert.doesNotMatch(finder, /const land = useCallback/, "arriving in a tab is navigation again");
  assert.doesNotMatch(finder, /\bland\(tab\.place\)|\bland\(HOME\)|\bland\(next\.place\)/);

  /* Every caller of `setTrail` lists it as a dependency: the closure captures
     the active tab, so a `go` with empty dependencies wrote every later tab's
     navigation into tab one. */
  for (const name of ["go", "back", "forward", "pick"]) {
    const at = finder.indexOf(`const ${name} = useCallback(`);
    assert.ok(at > 0, `${name} is gone`);
    const body = finder.slice(at, finder.indexOf("}, [", at) + 40);
    assert.match(body, /\}, \[setTrail\]\)/, `${name} is pinned to the first tab`);
  }

  /* No effect copying the window's place into the active tab on every render;
     the tab holds it. */
  assert.doesNotMatch(finder, /\{ \.\.\.tab, place: here \}/);
});

test("every page's field is the same field", async () => {
  const servers = await source("src/app/servers/servers.css");
  const account = await source("src/app/account/account.css");
  const owner = await source("src/app/owner/owner.css");
  const legal = await source(`${L}/legal.css`);

  /* Every page's dot field is veiled from the centre, not the top edge: veils
     centred on the top faded the dots to nothing a third of the way down, and a
     background with nothing left to react reads as lagging. */
  for (const [name, css] of [["servers", servers], ["account", account], ["owner", owner], ["legal", legal]]) {
    assert.match(
      css,
      /--g-dot-fade: 92% 74% 50% 44% 18% 82%;/,
      `${name} is fading from an edge again`,
    );
  }

  /* The picker's field is veiled by the canvas too, not masked by the
     compositor. */
  assert.doesNotMatch(servers, /\.servers-field \{[^}]*mask-image/);

  /* The legal field uses the full alpha: the dots are a 21px grid of 3px marks
     and do not affect reading the text. */
  assert.doesNotMatch(legal, /\.g-legal-field \{[^}]*--g-dot-alpha: 0\.1/);
});

test("the data overview answers the question it asks", async () => {
  const privacy = await source("src/app/privacy/page.tsx");
  const css = await source(`${L}/legal.css`);

  /* Retention periods are stated where the code fixes them (the 20-minute
     cache, the fallback copy), not as "as long as needed". */
  assert.match(privacy, /cached for 20 minutes/);
  assert.match(privacy, /fallback copy kept for a\s*\n?\s*day/);
  assert.match(privacy, /No fixed period\./);
  for (const hedge of [
    /as needed for sign-in and responsive loading/,
    /as needed for the purposes described in this policy/,
    /no fixed period is stated/,
  ]) {
    assert.doesNotMatch(privacy, hedge, "the hedging is back in the table");
  }

  /* One block per kind of information, read down, with the label beside each
     line and the same three questions in the same order in every block. A
     four-column table of sentences made you match a phrase to a heading a
     screen away. It is also the shape the account page uses. */
  assert.doesNotMatch(privacy, /<table>/, "the overview is a grid again");
  assert.doesNotMatch(privacy, /<colgroup>/);
  assert.match(privacy, /<div className="g-legal-data">/);
  assert.match(privacy, /<section className="g-legal-datum"/);
  assert.match(privacy, /<dt>What it is for<\/dt>/);
  assert.match(privacy, /<dt>How long<\/dt>/);
  assert.match(privacy, /<dt>What you can do<\/dt>/);
  assert.match(css, /\.g-legal-datum dl > div \{[^}]*grid-template-columns: 8\.5rem/);
  /* On a phone the label goes above its answer. */
  assert.match(
    css,
    /@media \(max-width: 640px\) \{\s*\.g-legal-datum dl > div \{\s*grid-template-columns: minmax\(0, 1fr\)/,
  );
});

test("the intro is short, first-visit only, and never blocks reduced motion", async () => {
  const intro = await source(`${L}/intro.ts`);
  const component = await source(`${L}/site-intro.tsx`);
  const layout = await source("src/app/layout.tsx");
  assert.match(layout, /INTRO_SCRIPT/);
  assert.match(layout, /<SiteIntro \/>/);
  assert.match(intro, /sessionStorage/);
  assert.match(intro, /prefers-reduced-motion: reduce/);
  assert.match(intro, /INTRO_MS = 1560/);
  assert.match(intro, /setTimeout/);
  assert.match(intro, /pointerdown.*keydown.*wheel.*touchstart/);
  assert.match(intro, /removeEventListener/);
  assert.doesNotMatch(component, /Play intro|BootTerminal/);
});

test("the folder wall has no entrance", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const folder = await source(`${M}/folder-tile.tsx`);
  const css = await source(`${M}/mac.css`);

  /* No entrance animation on the folder wall: the folders are simply there. (On
     mount it played behind an unopened window; on visibility it replayed on
     every scroll; once, it was still something to wait through.) */
  assert.doesNotMatch(css, /g-wall-deal|g-list-deal/);
  assert.doesNotMatch(css, /data-deal/);
  assert.doesNotMatch(finder, /setDeal|data-deal/);
  assert.doesNotMatch(folder, /--i/);
  assert.doesNotMatch(finder, /key=\{`wall-/);
});

test("the header morphs over a distance somebody can see", async () => {
  const css = await source(`${L}/landing.css`);
  const tokens = await source(`${L}/tokens.css`);

  /* The header's morph uses a curve, not `linear` over 120px, which finished
     inside a single wheel notch. Scroll-driven animations take timing functions
     like timed ones. */
  const morph = css.slice(css.indexOf("@supports (animation-timeline: scroll())"));
  assert.match(morph, /animation: g-nav-draw-in var\(--g-ease-sheet\) both/);
  assert.match(morph, /animation: g-nav-pill var\(--g-ease-sheet\) both/);
  assert.match(morph, /animation-range: 0 300px/);
  assert.doesNotMatch(morph.slice(0, morph.indexOf("}\n}")), /animation-range: 0 120px/);

  // The curve is a token, shared by two stylesheets.
  assert.match(tokens, /--g-ease-sheet: cubic-bezier\(0\.32, 0\.72, 0, 1\);/);
});

test("a folder shows the difference rather than describing it", async () => {
  const sheet = await source(`${M}/module-sheet.tsx`);
  const cmp = await source(`${M}/compare.tsx`);
  const scene = await source(`${M}/discord-scene.tsx`);
  const css = await source(`${M}/sheet.css`);

  /* Two rows of prose asked you to hold the first sentence in your head while
     you read the second. A wipe holds it for you. */
  assert.match(sheet, /<Compare/);
  assert.match(sheet, /<DiscordBefore/);
  assert.match(sheet, /<DiscordAfter/);
  assert.doesNotMatch(sheet, /className="g-row g-row-before"/);

  /* Under the picture, the module in plain words, said once. The before and
     after sentences are the picture's descriptions, for anyone who cannot see
     it. */
  assert.match(sheet, /<p className="g-shot-say">\{folder\.explain\}<\/p>/);
  assert.doesNotMatch(sheet, /g-shot-was/);
  assert.match(sheet, /label=\{folder\.without\}/);
  assert.match(sheet, /label=\{folder\.with\}/);
  /* The drawings carry one accent per side, not the folder's own hue (ten hues
     side by side read as a paint chart). */
  assert.doesNotMatch(sheet, /hue=\{folder\.hue\}/);

  /* One pointer path with capture, so the drag survives leaving the element
     and works for touch and pen as well as a mouse. */
  assert.match(cmp, /setPointerCapture/);
  assert.match(cmp, /onPointerDown|onPointerMove/);
  assert.doesNotMatch(cmp, /onTouchStart/, "a second, parallel input path");
  // And a keyboard, which the reference has no way of being operated with.
  assert.match(cmp, /role="slider"/);
  assert.match(cmp, /ArrowLeft/);
  assert.match(cmp, /aria-valuenow/);

  /* No particle engine and no glow on the seam: nothing on this site casts
     light onto anything else. */
  // The prose above the code names what it replaced; the code must not.
  const cmpCode = cmp.slice(cmp.indexOf("import {"));
  assert.doesNotMatch(cmpCode, /tsparticles|SparklesCore/);
  assert.match(
    css,
    /\.g-cmp-seam \{[\s\S]{0,220}background: var\(--g-accent\)/,
  );
  /* One hairline in the brand pink on the seam. The positive assertion matters;
     negative checks on colour names keep matching comments. */
  assert.doesNotMatch(css, /g-cmp-seam \{[^}]*box-shadow/);

  /* Message bodies are grey bars in drawings and screenshots alike, so a
     picture reads at any size and never puts words in anyone's mouth.

     Both halves of a pair share one geometry, or the wipe reads as two
     pictures. A drawing is 640x420 by default; a capture keeps its own shape. */
  assert.match(scene, /const W = 640/);
  assert.match(scene, /function Win\(/);
  assert.match(css, /aspect-ratio: var\(--shot-ratio, 640 \/ 420\)/);

  /* Each module's scene owns its own objects (a thumbtack for sessions, a bin
     for punishments, a stopwatch for shifts, a scrollbar for departments), so
     the ten pictures are different pictures. */
  for (const glyph of [
    "Pin",
    "Env",
    "Watch",
    "Mag",
    "Chev",
    "Doc",
    "Pencil",
    "Bin",
    "Cursor",
    "Check",
    "Spark",
  ]) {
    assert.match(
      scene,
      new RegExp(`const ${glyph} = \\(`),
      `${glyph} is not drawn any more`,
    );
  }
  assert.ok(
    !/server rail|channel list/i.test(scene.split("*/")[1] ?? ""),
    "the Discord chrome is back",
  );
  assert.doesNotMatch(scene, /<Hash /, "the channel header is back");

  /* One accent per side: red for the before, pink for the after. */
  assert.match(scene, /const RED = "#e4626a"/);
  assert.match(scene, /const PINK = "#f7a8c4"/);
  assert.doesNotMatch(
    scene,
    /hue\?: string/,
    "the drawings take a colour from outside again",
  );
  assert.doesNotMatch(
    sheet,
    /<DiscordAfter[\s\S]{0,160}hue=/,
    "the sheet is tinting the drawing again",
  );

  /* The settled half shows who did the work the way Discord does: a round
     avatar, the name, then the blurple app tag with its check. */
  assert.match(scene, /import \{ GatorLogo \} from "\.\.\/gator-logo"/);
  assert.match(scene, /<GatorLogo size=\{22\} \/>/);
  assert.match(scene, /Gator\s*<\/text>/);
  assert.match(scene, /APP\s*<\/text>/);
  assert.match(scene, /const BLURPLE = "#5865f2"/);
  assert.doesNotMatch(scene, /BOT\s*<\/text>/, "the pink BOT pill is back");
  assert.match(scene, /<Win on=\{false\}>/);
  assert.match(scene, /<Win on>/);
});

/** A PNG's or a GIF's real size, read off the header rather than trusted. */
async function pixels(relativePath: string) {
  const bytes = await readFile(path.join(root, relativePath));
  if (bytes.subarray(1, 4).toString("ascii") === "PNG") {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 3).toString("ascii") === "GIF") {
    return { w: bytes.readUInt16LE(6), h: bytes.readUInt16LE(8) };
  }
  // An extended WebP (animated ones are): 24-bit width and height, less one.
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(12, 16).toString("ascii") === "VP8X") {
    return { w: 1 + bytes.readUIntLE(24, 3), h: 1 + bytes.readUIntLE(27, 3) };
  }
  throw new Error(`${relativePath} is not a PNG, a GIF or an extended WebP`);
}

test("a module with a real screenshot shows the screenshot", async () => {
  const shots = await source(`${M}/shots.ts`);
  const scene = await source(`${M}/discord-scene.tsx`);
  const sheet = await source(`${M}/module-sheet.tsx`);
  const css = await source(`${M}/sheet.css`);

  /* Where a capture of the real thing exists it wins; the drawing stays for
     modules without one. */
  assert.match(scene, /const shot = shotFor\(scene\)/);
  /* Captures come in both appearances, so a light page shows a light Discord. */
  assert.match(scene, /pairFor\(shot, appearance\)\.before/);
  assert.match(scene, /pairFor\(shot, appearance\)\.after/);
  assert.match(scene, /const appearance = useAppearance\(\)/);
  assert.match(scene, /<Win on=\{false\}>/, "the drawing has stopped being the fallback");
  assert.ok(Object.keys(SHOTS).length > 0, "nothing is listed");

  /* Every file named in the manifest exists: TypeScript accepts any string, and
     a typo would only show when someone opens that folder. */
  for (const [key, shot] of Object.entries(SHOTS)) {
    const frames = [shot.before, shot.after];
    if (shot.light) frames.push(shot.light.before, shot.light.after);
    for (const frame of frames) {
      for (const file of [frame.src, frame.still].filter(Boolean) as string[]) {
        assert.ok(!(await missing(`public${file}`)), `${key}: ${file} is listed and not there`);
      }
    }
    /* A moving picture needs a still in both appearances, since a GIF cannot be
       paused (reduced motion is answered by fetching a different file). */
    for (const frame of frames) {
      if (/\.(gif|webp)$/.test(frame.src)) {
        assert.ok(frame.still, `${key}: ${frame.src} moves and has no still`);
      }
    }
  }

  /* Both images of a pair have the declared ratio, so the seam wipes one
     rectangle and nothing jumps. Checked against the actual files. */
  for (const [key, shot] of Object.entries(SHOTS)) {
    const [w, h] = shot.ratio.split("/").map((n) => Number(n.trim()));
    assert.ok(w > 0 && h > 0, `${key}: ${shot.ratio} is not a ratio`);
    for (const frame of [shot.before, shot.after]) {
      for (const file of [frame.src, frame.still].filter(Boolean) as string[]) {
        const size = await pixels(`public${file}`);
        assert.equal(
          (size.w / size.h).toFixed(3),
          (w / h).toFixed(3),
          `${key}: ${file} is ${size.w}x${size.h}, which is not ${shot.ratio}`,
        );
      }
    }
  }

  /* Anything that moves carries a still of its first frame, chosen by a media
     query before the GIF is fetched. A `useEffect` would be too late: the
     browser would already have the GIF. */
  for (const [key, shot] of Object.entries(SHOTS)) {
    for (const frame of [shot.before, shot.after]) {
      if (/\.(gif|webp)$/.test(frame.src)) {
        assert.ok(frame.still, `${key}: ${frame.src} moves and has no still`);
      }
    }
  }
  /* And they move as animated WebP, not GIF: the same frames at about a
     quarter of the weight, 7 MB of GIFs down to under 2. */
  for (const [key, shot] of Object.entries(SHOTS)) {
    for (const frame of [shot.before, shot.after]) {
      assert.ok(!frame.src.endsWith(".gif"), `${key}: ${frame.src} is a GIF again`);
    }
  }
  assert.match(scene, /media="\(prefers-reduced-motion: reduce\)"/);
  assert.match(css, /\.g-shot-pic \{\s*display: contents;/);

  /* The picture sits inside a drag control, so native image drag is off; it
     would take the gesture and strand the seam. */
  assert.match(scene, /draggable=\{false\}/);
  assert.match(css, /-webkit-user-drag: none/);

  /* The frame takes its shape from the sheet, so a capture is never cropped to
     the drawings' rectangle. */
  assert.match(sheet, /"--shot-ratio" as string\]: shot\.ratio/);

  /* And the weight is on the way in, not on the way to the landing: these are
     megabyte files that only the folder they belong to ever needs. */
  assert.match(scene, /loading="lazy"/);
  assert.match(scene, /decoding="async"/);
});

test("the footer is a colophon, not a business card", async () => {
  const foot = await source(`${L}/site-footer.tsx`);
  const css = await source(`${L}/footer.css`);

  /* Two headed columns (product and small print), so a footer lookup takes a
     glance. */
  assert.match(foot, /className="g-foot-col"/);
  assert.match(css, /\.g-foot-col \{/);
  const headings = [...foot.matchAll(/heading: ([^,;\n]+),/g)].map((m) => m[1]);
  assert.deepEqual(headings, ["SITE_NAME", '"Legal"']);
  assert.match(foot, /<h2 className="g-foot-head">/, "the headings are links again");

  // Identity at one end, destinations at the other.
  assert.match(css, /\.g-foot-top \{[\s\S]{0,260}justify-content: space-between/);

  // The mark and the two social accounts are one lockup.
  assert.match(foot, /className="g-foot-lockup"[\s\S]{0,900}g-foot-social/);
  assert.match(foot, /<IconAt size=\{16\} stroke=\{2\} \/>/);
  assert.match(foot, /<DiscordLogo size=\{16\} \/>/);

  /* No colophon (the oversized faint wordmark under the footer), and none of
     the tokens, cropping and layout rules it needed. */
  assert.doesNotMatch(foot, /g-foot-ghost/);
  assert.doesNotMatch(css, /g-foot-ghost|--foot-ghost|--foot-crop/);
  assert.doesNotMatch(css, /\.g-footer \{[\s\S]{0,200}overflow: clip/);
  assert.doesNotMatch(css, /\.g-footer \{[\s\S]{0,200}display: flow-root/);
  // Padding fills the space instead.
  assert.match(css, /padding-block: clamp\(44px, 6vh, 72px\) clamp\(/);

  // Under the fold the halves stack, and every link clears a thumb.
  assert.match(css, /@media \(max-width: 700px\)[\s\S]{0,200}flex-direction: column/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]{0,300}min-height: 40px/);
  // The icons are drawn at 36 with the target reaching past them.
  assert.match(css, /\.g-foot-icon::after \{[^}]*inset: -4px;/);
});

test("an empty dashboard is an invitation, and its button is never hidden", async () => {
  const box = await source("src/components/servers/empty-box.tsx");
  const css = await source("src/components/servers/empty-box.css");
  const content = await source("src/components/servers-content.tsx");

  // An empty dashboard shows an invitation, not an error. A real error still
  // gets the plain report.
  assert.match(content, /<EmptyBox inviteUrl=\{inviteUrl\} \/>/);
  assert.match(
    content,
    /error \? \(\s*<NoServersFound\s+title="Unable to Load Servers"/,
  );

  /* The button is visible without hovering, so it works on a phone and from a
     keyboard. */
  /* Anchored on the rule's own first declaration: `.g-box-cta {` also appears
     as the tail of a selector list it shares with the slips. */
  const at = css.indexOf(".g-box-cta {\n  position: relative;");
  const cta = css.slice(at, css.indexOf("}", at));
  assert.match(cta, /transform: translate3d\(0, -26px, 0\)/);
  assert.doesNotMatch(cta, /opacity: 0/, "the action is hidden until hover");

  // Focus opens it too, or the button can be tabbed to while still behind the
  // lid — a focus ring on something half covered.
  assert.match(css, /\.g-box-stage:focus-within \.g-box-cta/);

  // And with no hover to wait for, everything rests where the hover would have
  // put it.
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}translate3d\(0, -70px, 0\)/,
  );

  // The slips are decoration and say so; only the button is a control.
  assert.match(box, /aria-hidden="true"/);
  assert.match(box, /<RippleButton/);
});

test("a text file is a window in the appearance you are in", async () => {
  const css = await source(`${M}/mac.css`);

  /* The text window reads its colours from tokens, so it follows the appearance
     setting. */
  for (const token of [
    "--note-paper",
    "--note-bar",
    "--note-ink",
    "--note-status",
    "--note-link",
    "--note-edge",
  ]) {
    assert.match(css, new RegExp(`\\n  ${token}: `), `${token} is not a token`);
  }
  assert.match(css, /:root\[data-theme="light"\] \{[\s\S]{0,700}--note-paper: #fbfbfa/);
  assert.match(css, /@media \(prefers-color-scheme: light\)[\s\S]{0,900}--note-paper: #fbfbfa/);
  // And the rules read them rather than restating a colour.
  assert.match(css, /\.g-note \{[\s\S]{0,400}background: var\(--note-paper\)/);
  assert.match(css, /color: var\(--note-ink\)/);
  assert.doesNotMatch(css, /background: #fbfbfa/);
  assert.doesNotMatch(css, /color: #1c1c1e/);
});

test("the link preview is generated, not a picture somebody drew once", async () => {
  const og = await source("src/app/opengraph-image.tsx");
  const layout = await source("src/app/layout.tsx");

  /* The share image is generated from the same constants as the page
     (`next/og`), so its tagline and module count never go stale like a
     checked-in PNG. */
  assert.match(og, /import \{ ImageResponse \} from "next\/og"/);
  assert.match(og, /MODULE_COUNT/);
  assert.match(og, /export const size = \{ width: 1200, height: 630 \}/);
  assert.match(og, /export const alt =/);

  /* It says what the page says. The headline is the hero's, word for word,
     so a new headline is a failing test until the card is given it too. */
  const hero = await source("src/components/site/landing.tsx");
  const said = (name: string) => og.match(new RegExp(`const ${name} = "([^"]+)";`))?.[1];
  const lead = said("LEAD");
  const rest = said("REST");
  const claim = said("CLAIM");
  assert.ok(lead && rest && claim, "the card has no headline of its own");
  assert.ok(hero.includes(`{"${lead} "}`), `the hero no longer opens "${lead}"`);
  assert.ok(hero.includes(`{"${rest} "}`), `the hero no longer says "${rest}"`);
  assert.ok(hero.includes(`<ConfettiWord className="g-hero-free">${claim}</ConfettiWord>`), "the claim moved");

  /* In the site's face: Satori draws its fallback unless it is handed one,
     which is what the last card was set in. */
  assert.match(og, /family=Rethink\+Sans:wght@\$\{weight\}&text=/);
  assert.match(og, /\{ \.\.\.size, fonts \}/);
  // And a failed font fetch draws the card anyway rather than failing a build.
  assert.match(og, /catch \(error\) \{[\s\S]{0,120}return undefined;/);

  /* The window the page scrolls into, rising off the bottom edge: its tab,
     its sidebar and the first row of the wall, drawn from the wall's data. */
  assert.match(og, /FOLDERS\.find\(\(f\) => f\.key === key\)/);
  assert.match(og, /const ROW = \["sessions", "punishments", "infractions", "promotions"\]/);
  const folders = await source(`${L}/modules.ts`);
  for (const key of ["sessions", "punishments", "infractions", "promotions"]) {
    assert.match(folders, new RegExp(`key: "${key}",\\n    label:`), `${key} is no longer a folder on the wall`);
  }
  // No pills, and dots that are actually drawn: the gradient version was
  // silently nothing.
  assert.doesNotMatch(og, /borderRadius: 999/);
  assert.doesNotMatch(og, /radial-gradient/);
  assert.match(og, /<pattern id="dots" width="21" height="21"/);

  // And nothing names a file, or it would override the generated one.
  assert.doesNotMatch(layout, /og-card/);
  assert.ok(await missing("public/og-card.png"), "the stale card is still shipped");
});

test("the accent is the same pink in both appearances", async () => {
  const tokens = await source(`${L}/tokens.css`);

  /* Two accent tokens in light mode: the accent, a rose deep enough to read
     as pink on cream, and `--g-accent-ink`, the same family darkened until
     text in it passes contrast. */
  assert.doesNotMatch(tokens, /#c22f6e;/);
  /* The paler brand pink (#df8592, 2.04:1 on the cream ground) washed into
     the paper: a module that was on and a selected pill looked the same as
     off. The accent is now at least 3:1 on the ground and both raised
     surfaces; text uses `--g-accent-ink` (4.9:1 or better). */
  assert.doesNotMatch(tokens, /--g-accent: #df8592;/);
  assert.match(tokens, /--g-accent: #d94f7c;/);
  assert.match(tokens, /--g-accent-ink: #a8345d;/);
  assert.match(tokens, /--g-accent-ink: #f7a8c4;/, "dark has no ink variant");

  // Written twice, like the rest of the light palette, so an explicit light
  // choice on a dark device still beats the device's own preference.
  assert.equal(tokens.match(/--g-accent: #d94f7c;/g)?.length, 2);
  assert.equal(tokens.match(/--g-accent-ink: #a8345d;/g)?.length, 2);
  // The dashboard's Tailwind accent follows, on auto as well as explicit.
  const globals = await source("src/app/globals.css");
  assert.equal(globals.match(/--accent-rgb: 217 79 124;/g)?.length, 2);

  /* Running text that used the accent uses the ink. A file that no longer has
     text in the accent passes. */
  for (const file of [
    `${L}/legal.css`,
    `${L}/footer.css`,
    "src/app/servers/servers.css",
    "src/components/servers/server-card.css",
  ]) {
    const text = await source(file);
    /* Text in the accent means `color:`. An accent fill (a pressed pin, a
       filled button) pairs with `--g-on-accent` instead. */
    if (!/(?<![-\w])color:\s*var\(--g-accent\)/.test(text)) continue;
    assert.match(text, /var\(--g-accent-ink\)/, `${file} still reads in the brand pink`);
  }
});

test("nothing takes its colours from outside the palette", async () => {
  // The sign-in button and avatar are the site's own, not Astryx's, whose
  // colours came out near-white on near-white in light mode.
  const nav = await source(`${L}/site-nav.tsx`);
  assert.ok(
    !/@astryxdesign/.test(nav),
    "the header is back on Astryx components",
  );
  assert.match(nav, /className="g-signin"/);

  // Every white film over black is a token, so it can flip with the palette
  // instead of vanishing on paper.
  for (const f of [
    `${L}/landing.css`,
    `${M}/mac.css`,
    "src/app/account/account.css",
  ]) {
    const css = await source(f);
    /* Films assigned to custom properties are palette entries (redeclared for
       light beside them); a film written straight into a rule cannot flip, and
       that is what this catches. Declaration lines are removed before the scan. */
    const rules = css
      .split("\n")
      .filter((line) => !/^\s*--[a-z-]+:/.test(line))
      .join("\n");
    const films = [...rules.matchAll(/rgba\(255, 255, 255, 0\.0?\d+\)/g)]
      .map((m) => m[0])
      .filter((v) => !/0\.2[0-9]|0\.3[0-9]/.test(v));
    assert.deepEqual(films, [], `${f} still paints a fixed white film`);
  }
});

test("the server picker wears the site's skin", async () => {
  const page = await source("src/app/servers/page.tsx");
  const content = await source("src/components/servers-content.tsx");
  const css = await source("src/app/servers/servers.css");

  assert.match(page, /import \{ SiteNav \}/);
  assert.match(page, /<SiteFooter/);
  assert.ok(!/Landing\/footer"/.test(page), "still on the old footer");
  assert.ok(!/cursors\.css/.test(page), "still importing the custom cursors");
  assert.ok(!/ServersMotion/.test(page), "the cursor layer is back");

  // The sticker doodles went with the rest of the old landing.
  assert.ok(!/DoodleSticker/.test(content), "the doodles are back");

  // Its four colour tokens point at the site's rather than at fixed hexes,
  // which is what makes it follow the appearance toggle.
  assert.match(css, /--servers-paper: var\(--g-ground\)/);
  assert.match(css, /--servers-ink: var\(--g-ink\)/);
  assert.match(css, /--servers-wine: var\(--g-accent\)/);
  assert.match(css, /padding-inline: var\(--g-gutter\)/);

  // The surfaces are redrawn for the light palette, not only re-tokened.
  assert.match(css, /the restyle/);
});


test("every page that is not the landing gets a header in flow", async () => {
  const css = await source(`${L}/landing.css`);

  // `.g-nav-solid` (a header in flow, content below it) exists for the legal
  // pages, account pages and picker.
  assert.match(css, /\.g-nav-solid \{/);
  const rule = css.slice(css.indexOf(".g-nav-solid {"), css.indexOf("}", css.indexOf(".g-nav-solid {")));
  assert.match(rule, /position: sticky/);

  /* Every page except the landing uses the floating pill. `.g-nav-solid`
     remains as the fallback any page can ask for. */
  for (const f of [
    "src/components/legal-page.tsx",
    "src/app/servers/page.tsx",
    "src/app/account/page.tsx",
  ]) {
    const page = await source(f);
    assert.match(page, /<SiteNav[\s\S]{0,240}\bfloat\b/, `${f} does not float`);
    assert.match(page, /site\/landing\.css/, `${f} never loads the rule`);
  }
});

test("light is beige and blush, not white and grey", async () => {
  const tokens = await source(`${L}/tokens.css`);
  const light = tokens.slice(tokens.indexOf(':root[data-theme="light"]'));

  // Neutral grey under a pink accent reads as a light mode nobody finished.
  assert.ok(!/--g-ground: #ffffff/.test(light), "the ground is pure white");
  assert.ok(!/--g-raise: #ffffff/.test(light), "the raised surface is pure white");
  /* Light palette from Pantone: 12-0815 TCX Vanilla Custard is the ground and
     16-1615 TCX Flamingo Plume the accent. The ink is a deep wine in the
     accent's family. Surfaces are the vanilla lifted toward white, and films
     are the ink at low alpha, so cards sit on the paper rather than greying it. */
  assert.match(light, /--g-ground: #f3dfc1/);
  assert.match(light, /--g-ink: #4a2431/);
  assert.match(light, /--g-fill: rgba\(74, 36, 49/);
  assert.match(light, /--g-line: rgba\(74, 36, 49/);
  // The three ink steps keep real distance between them rather than collapsing
  // onto one another once the palette got warmer and lower-contrast.
  assert.match(light, /--g-ink-dim: #6f4d51/);
  assert.match(light, /--g-ink-faint: #7d5c5c/);
});

test("motion is optional everywhere", async () => {
  for (const f of [`${L}/ripple-button.tsx`, `${L}/confetti-word.tsx`]) {
    const text = await source(f);
    assert.match(text, /prefers-reduced-motion/, `${f}`);
  }
  const css = await source(`${M}/mac.css`);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const landing = await source(`${L}/landing.css`);
  assert.match(landing, /@media \(prefers-reduced-motion: reduce\)/);
});

test("no em-dash reaches the page", async () => {
  // The em-dash is the most recognisable tell in generated copy, so none of it
  // ships in anything a reader sees.
  for (const { file, text } of await landingSources()) {
    for (const m of text.matchAll(/"([^"\n]*[—–][^"\n]*)"/g)) {
      assert.fail(`${file} ships a dash in visible copy: ${m[1]}`);
    }
  }
  const content = await source(`${M}/content.ts`);
  for (const m of content.matchAll(/"([^"\n]*[—–][^"\n]*)"/g)) {
    assert.fail(`content.ts ships a dash: ${m[1]}`);
  }
  const social = await source("src/app/opengraph-image.tsx");
  assert.match(social, /export const alt = `\$\{LEAD\} \$\{REST\} \$\{CLAIM\} /);
  assert.doesNotMatch(social, /export const alt = `[^`]*[\u2014\u2013]/);
});

test("the text window has a way out, and does not cost the page to open", async () => {
  const note = await source(`${M}/notepad.tsx`);
  const css = await source(`${M}/mac.css`);

  /* No `backdrop-filter` on the desk: inside a scroll-timeline window it made
     the window a backdrop root, re-blurred on every scroll tick and every
     dot-field frame. */
  const desk = css.slice(css.indexOf(".g-note-desk {"), css.indexOf("}", css.indexOf(".g-note-desk {")));
  assert.ok(!/backdrop-filter/.test(desk), "the desk is blurring its backdrop again");

  /* Closing is a state with its own animation; the parent hears about it when
     the animation ends. */
  assert.match(css, /@keyframes g-note-out/);
  assert.match(css, /\.g-note-layer\[data-closing\] \.g-note \{/);
  assert.match(note, /const EXIT_MS = 170/);
  assert.match(css, /animation: g-note-out 170ms/);
  assert.match(note, /setTimeout\(onClose, EXIT_MS\)/);
  // Every way out goes through the same door.
  assert.ok(!/onClick=\{onClose\}/.test(note), "one of the closes skips the animation");
  assert.match(note, /if \(event\.key === "Escape"\) requestClose\(\)/);
  // Except the one for somebody who asked for no motion, which closes at once.
  assert.match(note, /prefers-reduced-motion: reduce[\s\S]{0,80}onClose\(\)/);

  /* The drag offset is two custom properties, because a keyframe overrides a
     transform written on the element and a moved window snapped back on its way
     out. */
  assert.match(note, /\["--nx" as string\]/);
  assert.doesNotMatch(note, /transform: `translate/);
  assert.match(css, /@keyframes g-note-in[\s\S]{0,160}translate\(var\(--nx/);
});


test("a module opens with one native button activation", async () => {
  const folder = await source(`${M}/folder-tile.tsx`);
  const css = await source(`${M}/mac.css`);
  assert.match(folder, /<button/);
  assert.match(folder, /type="button"/);
  assert.match(folder, /onClick=/);
  assert.match(folder, /onOpen\(\);/);
  assert.doesNotMatch(folder, /onDoubleClick|onPointerUp/);
  assert.match(folder, /event.detail !== 0 && dragged/);
  assert.match(folder, /Hold to rearrange/);
  assert.match(css, /\.g-fcard:focus-visible/);
});

test("the module wall holds before dragging and supports cancellation", async () => {
  const wall = await source(`${M}/wall-grid.tsx`);
  assert.match(wall, /const HOLD_MS = 260/);
  assert.match(wall, /setPointerCapture/);
  assert.match(wall, /onPointerCancel/);
  assert.match(wall, /onLostPointerCapture/);
  assert.match(wall, /g.original/);
  assert.match(wall, /e.altKey/);
  assert.match(wall, /cancelAnimationFrame/);
  assert.doesNotMatch(wall, /from "swapy"/);
});

test("the landing has no intro replay control", async () => {
  const landing = await source(`${L}/landing.tsx`);
  const layout = await source("src/app/layout.tsx");
  const intro = await source(`${L}/site-intro.tsx`);
  assert.match(layout, /INTRO_SCRIPT|<SiteIntro/);
  assert.doesNotMatch(landing, /Play intro|SiteIntro/);
  assert.doesNotMatch(intro, /Play intro/);
});

test("a department card is the server card, on the servers' own track", async () => {
  const content = await source("src/components/servers-content.tsx");
  const css = await source("src/app/servers/servers.css");

  /* The department card has the same shape and the same numbers as the server
     cards above it. The numbers live in `tokens.css` and both cards read them. */
  const tokens = await source("src/components/site/tokens.css");
  assert.match(tokens, /--card-band: 54px/);
  assert.match(tokens, /--card-tile: 40px/);
  assert.match(tokens, /--card-inset: 12px/);
  assert.match(css, /\.servers-department-art \{[^}]*height: var\(--card-band\)/);
  assert.match(
    css,
    /\.servers-department-icon \{[\s\S]{0,400}bottom: calc\(var\(--card-tile\) \/ -2\);[\s\S]{0,600}box-shadow: 0 0 0 3px var\(--g-raise\)/,
  );
  assert.match(css, /\.servers-department-icon \{[\s\S]{0,400}left: var\(--card-inset\)/);
  /* The server-name pill sits on the right of the band: on the left it touched
     the tile's ring. On the right there is room at every width. */
  assert.match(css, /\.servers-department-server \{[\s\S]{0,900}right: 40px/);
  assert.doesNotMatch(
    css,
    /\.servers-department-server \{[\s\S]{0,900}\n  left:/,
    "the pill is back above the tile",
  );
  assert.match(
    css,
    /\.servers-department-body \{[\s\S]{0,400}padding: calc\(var\(--card-tile\) \/ 2 \+ 9px\) var\(--card-inset\) var\(--card-inset\)/,
  );
  /* The tally is a caption under the name, not floated to the foot of a
     stretched card. */
  assert.match(
    css,
    /\.servers-department-count \{[^}]*margin-top: 9px/,
  );
  assert.doesNotMatch(
    css,
    /\.servers-department-count \{[^}]*margin-top: auto/,
    "the tally is floating to the foot of a stretched card again",
  );
  assert.match(css, /\.servers-grid \{[\s\S]{0,400}align-items: start/);
  assert.match(css, /\.servers-department-card \{[^}]*border-radius: 12px/);
  assert.ok(
    content.indexOf('className="servers-department-art"') <
      content.indexOf('className="servers-department-icon"'),
    "the band is above the icon",
  );

  /* No older versions of this card's rules: two used `!important`, which later
     rules could not outrank. */
  for (const dead of [
    /\.servers-department-art \{[^}]*display: flex !important/,
    /\.servers-department-art \{[^}]*height: auto !important/,
    /\.servers-department-art \{[^}]*padding-right: 34px !important/,
    /\.servers-department-icon \{[^}]*position: static !important/,
    /\.servers-department-body \{[^}]*padding: 0 !important/,
    /\.servers-department-card \{[^}]*min-height: 11rem/,
  ]) {
    assert.doesNotMatch(css, dead);
  }

  /* The options menu is a child of this card, so the card cannot clip. Only the
     band clips, with its own 11px corners inside the card's 1px border. */
  assert.match(css, /\.servers-department-card \{[\s\S]{0,800}overflow: visible/);
  assert.doesNotMatch(
    css,
    /\.servers-department-card \{[\s\S]{0,800}overflow: hidden/,
    "the card clips its own menu again",
  );
  assert.match(css, /\.servers-department-art \{[\s\S]{0,800}border-radius: 11px 11px 0 0/);

  /* `align-items` is the horizontal axis once this row becomes a column, so
     both branches state it. */
  assert.match(
    css,
    /@media \(max-width: 640px\) \{\s*\.servers-section-heading-row \{\s*align-items: flex-start/,
  );
  assert.match(
    css,
    /@media \(min-width: 641px\) \{\s*\.servers-section-heading-row \{\s*align-items: flex-end/,
  );

  /* The kebab is the pin, on the other card: the mark itself, no disc. */
  const kebab = css.slice(css.indexOf(".servers-department-menu-button {"));
  assert.doesNotMatch(kebab, /border-radius: 50%/, "the kebab is in a disc again");
  assert.doesNotMatch(kebab, /backdrop-filter/, "the kebab is in a disc again");
  assert.match(kebab, /border-radius: 6px !important/);
  assert.doesNotMatch(kebab, /border-radius: 0 !important/, "the bevel is back");

  /* Departments use the servers' track, so both sections of the page line up. */
  assert.doesNotMatch(css, /\.servers-grid \{[^}]*auto-fit/);
  assert.match(
    css,
    /@media \(min-width: 1280px\) \{\s*\.servers-window-grid,\s*\.servers-grid \{/,
  );
});

test("a server card is ERM's guild card", async () => {
  const card = await source("src/components/server-card.tsx");
  const css = await source("src/components/servers/server-card.css");
  const servers = await source("src/app/servers/servers.css");

  /* The layout follows the reference card: a banner with the card's ground
     faded over it, the icon hung off it with a ring, the name, the member
     count, and a button across the foot as the way in. */
  assert.match(card, /className="sv-frame"/);
  assert.match(card, /className="sv-band"/);
  assert.match(card, /className="sv-band-art"/);
  /* Read from `tokens.css`, so the department card on the same page has the
     same shape. */
  assert.match(css, /--sv-band: var\(--card-band\)/);
  assert.match(css, /--sv-tile: var\(--card-tile\)/);
  assert.match(css, /--sv-inset: var\(--card-inset\)/);
  assert.match(
    css,
    /\.sv-band\[data-art="true"\]::after \{[^}]*linear-gradient\(to top, var\(--g-raise\)/,
  );
  /* A card without artwork fades its band into the body the same way, with no
     hard edge. */
  assert.match(
    css,
    /\.sv-band \{[\s\S]{0,240}background: linear-gradient\(to top, var\(--g-raise\)/,
  );
  assert.match(css, /\.sv-tile \{[^}]*box-shadow: 0 0 0 var\(--sv-ring\) var\(--g-raise\)/);
  assert.match(css, /\.sv-body \{[^}]*margin-top: calc\(var\(--sv-tile\) \/ -2\)/);
  assert.ok(
    card.indexOf('className="sv-band"') < card.indexOf('className="sv-tile"'),
    "the banner is below the icon",
  );

  /* The foot is one control tall and the member count and the way in cross-fade
     inside it. Reserving space drew an empty band on every card; opening on
     hover animated layout and shook the whole column. */
  assert.match(card, /className="sv-actions"/);
  assert.match(card, /className="sv-go"/);
  assert.match(card, /className="sv-foot"/);
  assert.match(css, /\.sv-foot \{[\s\S]{0,400}min-height: var\(--sv-go\);/);
  /* One distance and one duration for both halves of the exchange. */
  assert.match(css, /--sv-roll: \d+px;/);
  assert.match(css, /--sv-swap: \d+ms;/);
  assert.match(css, /transform var\(--sv-swap\)/);
  /* The only delay is on the hover rule (the handover), so letting go waits for
     nothing. */
  assert.match(
    css,
    /\.sv-frame:hover \.sv-go,[\s\S]{0,1400}transition-delay: \d+ms, 0s, 0s, 0s;/,
  );
  assert.match(css, /\.sv-actions \{[\s\S]{0,400}position: absolute;\s*inset: 0;/);
  /* No length may differ between the two states; that would bring the layout
     shift back. */
  const actions = css.slice(
    css.indexOf("\n.sv-actions {"),
    css.indexOf("\n.sv-go {"),
  );
  assert.doesNotMatch(actions, /height:/, "the row has a height of its own again");
  assert.doesNotMatch(actions, /padding-top:/);
  assert.doesNotMatch(actions, /margin-top:/);
  assert.match(css, /\.sv-go \{[^}]*opacity: 0;/);
  assert.match(
    css,
    /\.sv-frame:hover \.sv-go,[\s\S]{0,120}opacity: 1;\s*transform: none;/,
  );
  /* And the count steps aside for it rather than being covered by it. */
  assert.match(
    css,
    /\.sv-frame:hover \.sv-sub,[\s\S]{0,120}opacity: 0;/,
  );
  /* On touch both are simply shown: a touch browser keeps `:hover` on the last
     tapped card, which would leave the swap stuck. */
  assert.match(
    css,
    /@media \(hover: none\), \(pointer: coarse\)[\s\S]{0,1200}\.sv-actions \{[^}]*position: static;/,
  );

  /* The whole card opens the server by clicking its own link, so prefetch,
     pending state and transition are kept. Its own controls (the pin) answer
     for themselves. */
  assert.match(card, /onClick=\{\(event\) => \{[\s\S]{0,200}closest\("a, button"\)/);
  assert.match(card, /way\.current\?\.click\(\)/);
  assert.match(card, /ref=\{way\}/);

  /* On touch the row is open and its height comes through the variable:
     `.sv-frame:hover .sv-actions` outranks `.sv-actions`, and restating the
     height there cut off the button after a tap. */
  assert.match(
    css,
    /@media \(hover: none\), \(pointer: coarse\)[\s\S]{0,800}--sv-go: 38px;/,
  );
  assert.doesNotMatch(
    css,
    /@media \(hover: none\), \(pointer: coarse\)[\s\S]{0,900}height: calc\(38px \+ 10px\)/,
    "the touch row states its own height again",
  );

  /* The picker deals cards into real columns, not grid cells, so a card's
     height change moves only the cards under it. */
  const content = await source("src/components/servers-content.tsx");
  assert.match(content, /dealIntoColumns/);
  assert.match(content, /className="servers-window-column"/);
  assert.match(servers, /\.servers-window-grid \{[\s\S]{0,400}align-items: start/);
  assert.match(servers, /\.servers-window-column \{[\s\S]{0,200}flex-direction: column/);
  assert.match(card, /Manage\s*\n\s*<IconArrowUpRight/);
  assert.match(card, /Opening…/);

  /* One count, and it is the one about the server rather than about the bot.
     "N modules on" sat beside it once. */
  assert.match(card, /memberCount === 1 \? "member" : "members"/);
  assert.doesNotMatch(card, /moduleCount === 1 \? "module" : "modules"/);

  /* One surface and one border on the card, not a panel inside a frame. */
  assert.doesNotMatch(card, /className="sv-panel"/, "the inner sheet is back");
  assert.doesNotMatch(css, /\.sv-panel \{/, "the inner sheet is back");

  // And it carries nothing that needs a row of its own.
  assert.doesNotMatch(card, /className="sv-id"/, "the id row is back");
  assert.doesNotMatch(card, /CopyButton/, "the copy button is back on the card");

  /* The pin sits in the banner's corner, so it never covers the server's icon. */
  assert.match(css, /\.sv-pin \{[^}]*top: 6px/);
  assert.match(css, /\.sv-pin \{[^}]*right: 6px/);
  assert.doesNotMatch(css, /\.sv-pin \{[^}]*left: /, "the pin is back over the tile");

  /* No disc behind the pin: an outline on the glyph keeps it legible over
     artwork. */
  const pin = css.slice(css.indexOf(".sv-pin {"), css.indexOf(".sv-spin"));
  assert.doesNotMatch(pin, /border-radius: 50%/, "the pin is in a disc again");
  assert.doesNotMatch(pin, /backdrop-filter/, "the pin is in a disc again");
  assert.match(css, /\.sv-pin \{[^}]*background: none/);
  assert.match(css, /\.sv-frame\[data-art="true"\] \.sv-pin \{[^}]*drop-shadow/);

  /* Four across on a wide window, two on a tablet, one on a phone, using the
     layout's breakpoints. */
  assert.match(servers, /@media \(min-width: 1280px\)[\s\S]{0,140}repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(servers, /@media \(min-width: 640px\)[\s\S]{0,140}repeat\(2, minmax\(0, 1fr\)\)/);
});

test("the pinned filter moves the cards rather than cutting to a new list", async () => {
  const reflow = await source("src/components/servers/reflow.ts");
  const content = await source("src/components/servers-content.tsx");
  const card = await source("src/components/server-card.tsx");

  /* Filtering animates all three changes. The cards that stay move with FLIP
     (measured before, laid out by React, animated from where they were). */
  assert.match(reflow, /export function positions/);
  assert.match(reflow, /export function settle/);
  assert.match(content, /const before = positions\(node\);/);
  assert.match(content, /if \(node\) settle\(node, was\.before\);/);

  /* Measured in document coordinates, not the viewport: filtering shortens the
     page, which drags the scroll offset, and viewport readings would be off by
     that amount. */
  assert.match(reflow, /box\.left \+ window\.scrollX/);
  assert.match(reflow, /box\.top \+ window\.scrollY/);
  assert.match(reflow, /const dx = was\.x - now\.x;/);
  assert.match(reflow, /const dy = was\.y - now\.y;/);

  /* The list's height animates too, so the footer, page height and scroll
     offset do not jump in one frame. */
  assert.match(reflow, /export function grow/);
  assert.match(reflow, /export function height/);
  assert.match(content, /if \(box\) grow\(box, was\.tall, was\.top\);/);
  assert.match(content, /ref=\{listBox\}/);
  assert.match(reflow, /style\.overflow = "clip"/);
  assert.doesNotMatch(
    reflow,
    /overflow = "hidden"/,
    "clipping the box with `hidden` gives it a scrollbar of its own",
  );
  /* The height and scroll offset are restored before paint, and scroll
     anchoring is off for the duration, since clamping and anchoring both move
     the page mid-animation. `scrollTo` with `behavior: "instant"` is used
     because `scrollTop` assignments read back the clamped value at that moment. */
  assert.match(reflow, /root\.scrollTo\(\{ top, behavior: "instant" \}\)/);
  assert.match(reflow, /overflowAnchor = "none"/);

  /* The box moves on the page-scroll curve from `glide.ts`, not the card curve,
     which lurches at page size. */
  const glide = await source("src/components/site/glide.ts");
  assert.match(glide, /export const carry = \{/);
  assert.match(reflow, /import \{ carry \} from "@\/components\/site\/glide"/);
  assert.match(reflow, /duration: carry\.time\(to - from\)/);
  assert.match(reflow, /easing: carry\.css/);
  /* It runs once the new list is in the document; a frame callback after
     `setPinnedOnly` sometimes measured the old list. */
  assert.match(
    content,
    /useLayoutEffect\(\(\) => \{[\s\S]{0,400}settle\(node, was\.before\)/,
  );
  assert.doesNotMatch(
    content,
    /requestAnimationFrame\([\s\S]{0,120}settle\(/,
    "the flip is racing React again",
  );

  /* The leaving cards finish before the state changes, because they are the
     nodes React is about to remove. */
  assert.match(
    content,
    /leave\(going\)\.then\(\(\) => \{\s*moved\.current = \{ before, tall, top \};\s*setPinnedOnly\(next\);/,
  );
  /* Leaving cards contract (scale and opacity only) rather than fade, so the
     space closing a moment later reads as part of the same gesture. */
  assert.match(reflow, /\{ opacity: 0, transform: "scale\(0\.94\)" \}/);
  /* No stagger on the way out: every card leaves at the same instant. */
  assert.doesNotMatch(reflow, /LEAVE_STEP/, "the leavers are queueing again");
  assert.match(reflow, /const ENTER_STEP/);

  /* The box decides, so showing all cards again after the empty "Pinned" state
     animates too. */
  assert.match(content, /const before = node \? positions\(node\) : new Map\(\)/);

  /* The site's own curve and pace, the same as the refresh re-entry, and
     nothing animated that the compositor cannot do on its own. */
  assert.match(reflow, /cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.doesNotMatch(reflow, /filter:/, "the reflow grew a filter to animate");

  /* No dust effect, and no dependency for it: nothing else on the site moves
     like that. */
  const manifest = await source("package.json");
  assert.doesNotMatch(manifest, /html-to-image|html2canvas/);
  assert.doesNotMatch(content, /disintegrate|snap\(/);
  assert.doesNotMatch(reflow, /getContext|drawArrays|feTurbulence/);

  /* Which still needs the cards to say which server they are. */
  assert.match(card, /data-server-id=\{id\}/);

  // Nobody who asked for less motion gets any of it.
  assert.match(reflow, /prefers-reduced-motion: reduce/);
  assert.match(content, /if \(!box \|\| !motionAllowed\(\)\)/);
  assert.match(content, /if \(!node \|\| !box \|\| !motionAllowed\(\)\)/);
  assert.match(content, /if \(next === pinnedOnly\) return;/);
});

test("the round control is cut bigger than the square ones beside it", async () => {
  const css = await source("src/components/site/landing.css");
  const toggle = await source("src/components/site/theme-toggle.css");

  /* The circle is drawn slightly larger than the square controls beside it so
     it looks the same size: a 32px square with a 9px radius covers 954px², and
     the circle with that area is 34.86px across. */
  assert.match(toggle, /\.g-theme-block \{[^}]*width: 32px/);
  assert.match(css, /\.g-profile \{[\s\S]{0,1200}width: 35px;\s*height: 35px;/);
  assert.doesNotMatch(
    css,
    /\.g-profile \{[\s\S]{0,1200}width: 32px/,
    "the avatar is back in the square's own box",
  );

  /* `box-sizing: border-box`, like the controls beside it, so the width means
     the drawn size. */
  assert.match(css, /\.g-profile \{[\s\S]{0,1200}box-sizing: border-box;/);
});

test("the landing window is built like the dashboard it shows", async () => {
  const finder = await source(`${M}/finder.tsx`);
  const css = await source(`${M}/mac.css`);

  /* It dresses like the dashboard: the grey window, with the tab standing on
     the bar. */
  assert.doesNotMatch(css, /--g-mac-ground: #030303;/);
  assert.doesNotMatch(css, /\.g-mac \.g-mac-pane \{\s*border: 1px solid var\(--g-mac-rim\)/);
  assert.doesNotMatch(css, /\.g-mac \.g-tab\[data-on="true"\]::after/);
  // In the neutral greys the dashboard uses, which are the shared tokens.
  const tokens = await source(`${L}/tokens.css`);
  assert.match(tokens, /--mac-bar: #0e0e0e;/);
  assert.match(tokens, /--mac-raise: #131313;/);
  assert.match(tokens, /--mac-label: #e8e6e3;\s*--mac-label-dim: #9e9c99;/);
  assert.doesNotMatch(tokens, /--mac-label: #dbdee1;/);
  // The highlight is placed against the sidebar, not the whole window.
  assert.match(css, /\.g-mac \.g-mac-side \{\s*position: relative;/);
  // The sidebar's caption is in sentence case.
  assert.match(css, /\.g-mac \.g-mac-side h2 \{[\s\S]{0,120}text-transform: none;/);

  /* One highlight slides to the active row, measured from the row itself so it
     follows search and resize. */
  assert.match(finder, /<span className="g-side-blob" aria-hidden="true" \/>/);
  assert.match(finder, /nav\.style\.setProperty\("--blob-y", `\$\{row\.offsetTop\}px`\);/);
  assert.match(finder, /nav\.dataset\.lit = "false";/);
  assert.match(finder, /new ResizeObserver\(place\)/);
  assert.match(css, /\.g-side-blob \{[\s\S]{0,300}transform: translate3d\(0, var\(--blob-y, 0px\), 0\);/);
  assert.match(css, /\.g-mac \.g-side-row\[data-current="true"\] \{\s*background: transparent;/);
  // And the mark sits in the window's head, as it sits in the dashboard's.
  assert.match(finder, /<span className="g-mac-brand" aria-hidden="true">/);
});
