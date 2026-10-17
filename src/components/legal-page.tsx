"use client";

/* The privacy policy and terms: the frame around the documents. - Anchors are
   derived from the headings (`#retention-and-deletion`), not counters. - The
   contents list shows where you are. - Heading links replace the history entry
   rather than pushing one, and Back is told where home is, so Back leaves the
   page instead of walking through the hashes. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { SiteNav, type LandingUser } from "@/components/site/site-nav";
import { DotField } from "@/components/site/dot-field";
import { SiteFooter } from "@/components/site/site-footer";
import { SUPPORT_URL } from "@/config/site";
import "@/components/site/tokens.css";
import "@/components/site/astryx-theme.css";
import "@/components/site/landing.css";
import "@/components/site/legal.css";

type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  title: string;
  summary: string;
  effective: string;
  kind: "privacy" | "terms";
  overview?: ReactNode;
  changes: { date: string; summary: string }[];
  sections: LegalSection[];
  user?: LandingUser | null;
};

/** The heading, as an address. Stable against a section being inserted above. */
function slugOf(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalPage({
  title,
  summary,
  effective,
  kind,
  overview,
  changes,
  sections,
  user = null,
}: LegalPageProps) {
  const [contentsOpen, setContentsOpen] = useState(false);
  const slugs = sections.map((section) => slugOf(section.title));
  const [current, setCurrent] = useState(slugs[0]);
  const doc = useRef<HTMLElement | null>(null);
  const tail = useRef<HTMLDivElement | null>(null);

  /* The current section, without reading the scroll position: each section
     reports against a band just under the header, and the last one in the band
     wins (a band tall enough to catch a heading reliably still holds the tail
     of the previous section). */
  useEffect(() => {
    const root = doc.current;
    if (!root) return;
    const seen = new Map<string, boolean>();
    /* Whether the document has ended, separately from the band: the last
       sections can never reach the band (the history and footer below hold the
       page up), so once the end of the last section is in view, that is where
       the reader is. */
    let ended = false;

    const choose = () => {
      if (ended) {
        setCurrent(slugs[slugs.length - 1]);
        return;
      }
      for (let i = slugs.length - 1; i >= 0; i -= 1) {
        if (seen.get(slugs[i])) {
          setCurrent(slugs[i]);
          return;
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.isIntersecting);
        }
        choose();
      },
      { rootMargin: "-92px 0px -70% 0px", threshold: 0 },
    );
    root.querySelectorAll("section[id]").forEach((node) => io.observe(node));

    /* The marker at the end of the document (not the page foot, which has the
       history and footer below it). */
    const end = new IntersectionObserver(
      ([entry]) => {
        ended = entry.isIntersecting;
        choose();
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0 },
    );
    if (tail.current) end.observe(tail.current);

    return () => {
      io.disconnect();
      end.disconnect();
    };
    // The section list is fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="g-root g-legal" data-astryx-theme="neutral">
      <DotField className="g-legal-field" />

      {/* The same bar the picker has: a legal page is a long document you
          scroll, which is exactly what the floating pill is for. */}
      <SiteNav user={user} leading="back" backHref="/" float />

      {/* Reading progress, tied to the scroll in the stylesheet (no listener, no
         state). */}
      <span className="g-legal-progress" aria-hidden="true" />

      <main className="g-legal-main">
        <header className="g-legal-head">
          <nav className="g-legal-switch" aria-label="Legal documents">
            <a
              href="/privacy"
              aria-current={kind === "privacy" ? "page" : undefined}
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              aria-current={kind === "terms" ? "page" : undefined}
            >
              Terms of Service
            </a>
          </nav>
          <p className="g-legal-date">{effective}</p>
          <h1 className="g-legal-title">{title}</h1>
          <p className="g-legal-summary">{summary}</p>
          <div className="g-legal-actions">
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
              {kind === "privacy"
                ? "Make a privacy request"
                : "Contact Gator support"}{" "}
              ↗
            </a>
            <button type="button" onClick={() => window.print()}>
              Print document
            </button>
          </div>
        </header>

        {overview ? (
          <section className="g-legal-overview" aria-label="Document overview">
            {overview}
          </section>
        ) : null}
        <div className="g-legal-body">
          {/* The contents, pinned. On a document this long, knowing what is in
              it is most of knowing whether to read it. */}
          <nav className="g-legal-toc" aria-label={`${title} sections`}>
            <h2>Contents</h2>
            <button
              className="g-legal-toc-toggle"
              type="button"
              aria-expanded={contentsOpen}
              aria-controls="legal-contents"
              onClick={() => setContentsOpen((v) => !v)}
            >
              On this page{" "}
              <span aria-hidden="true">{contentsOpen ? "−" : "+"}</span>
            </button>
            <ol id="legal-contents" data-open={contentsOpen}>
              {sections.map((section, index) => {
                const slug = slugs[index];
                return (
                  <li key={slug}>
                    <a
                      href={`#${slug}`}
                      aria-current={current === slug ? "true" : undefined}
                      data-current={current === slug ? "true" : "false"}
                      onClick={(event) => {
                        /* Scrolls there and replaces the address instead of
                           pushing an entry, so headings do not pile up in the
                           history. */
                        event.preventDefault();
                        const target = document.getElementById(slug);
                        if (!target) return;
                        flushSync(() => setContentsOpen(false));
                        target.focus({ preventScroll: true });
                        target.scrollIntoView({
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                          block: "start",
                        });
                        window.history.replaceState(null, "", `#${slug}`);
                        setCurrent(slug);
                      }}
                    >
                      <span className="g-toc-n">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {section.title}
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>

          <article className="g-legal-doc" ref={doc}>
            {sections.map((section, index) => (
              <section
                key={slugs[index]}
                id={slugs[index]}
                className="g-legal-section"
                tabIndex={-1}
              >
                <h2>
                  <span className="g-legal-n" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                  <a
                    className="g-legal-permalink"
                    href={`#${slugs[index]}`}
                    aria-label={`Link to ${section.title}`}
                  >
                    #
                  </a>
                </h2>
                <div className="g-legal-copy">{section.content}</div>
              </section>
            ))}

            {/* Where the document stops. See the note on the observer. */}
            <div className="g-legal-tail" ref={tail} aria-hidden="true" />

            <details className="g-legal-history">
              <summary>Document history</summary>
              <ul>
                {changes.map((change) => (
                  <li key={change.date}>
                    <time>{change.date}</time>
                    <p>{change.summary}</p>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
