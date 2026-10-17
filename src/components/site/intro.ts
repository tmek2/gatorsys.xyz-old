/* The site intro without a client boundary: like theme.ts, the script is
   inlined by the root layout (a server component). The intro itself is all CSS;
   this script only decides whether it runs and removes the cover when it is
   over, so it cannot flash, wait on hydration, or fail without React. */

/** One key, one tab. */
export const INTRO_KEY = "gator-intro";

/**
 * How long the cover exists, in ms: the last keyframe lands at 1440; the
 * element is removed at this point.
 */
export const INTRO_MS = 1560;

/* Runs in <head> before the body paints, so the cover is up on the first frame.
   It runs only: - once per tab (`sessionStorage`; localStorage would show it
   once ever); - never under `prefers-reduced-motion`; - never on reloads or
   back/forward restores (sessionStorage covers both), and never for crawlers
   (which do not run scripts; the page underneath is complete).

   Wrapped in try because storage throws in private windows; the catch leaves
   the attribute unset, and the cover is `display: none` until it is set. */
export const INTRO_SCRIPT = `try{
var k=${JSON.stringify(INTRO_KEY)},d=document.documentElement;
if(!sessionStorage.getItem(k)&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
sessionStorage.setItem(k,"1");
d.setAttribute("data-intro","run");
var e=["pointerdown","keydown","wheel","touchstart"],f=function(){d.setAttribute("data-intro","done");e.forEach(function(n){removeEventListener(n,f)})};
e.forEach(function(n){addEventListener(n,f,{passive:true})});
setTimeout(f,${INTRO_MS});
}}catch(e){}`.replace(/\n/g, "");
