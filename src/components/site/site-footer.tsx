"use client";

/* The site footer, in two shapes: the full footer on pages with a bottom, and a
   single line on the landing. Both read one list of links. */

import { Link } from "next-view-transitions";
import { DOCS_URL, SITE_NAME, SUPPORT_URL } from "@/config/site";
import { IconAt } from "@tabler/icons-react";
import { DiscordLogo } from "@/components/brand-icons";
import { GatorLogo } from "./gator-logo";
import "./footer.css";

/** The author's Discord, carried over from the landing this replaced. */
const AUTHOR = "https://discord.com/users/642749164165267466";

/* The two that have to be reachable from every page on the site. */
export const LEGAL: { label: string; href: string }[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

/* Two headings, because there are two kinds of destination here and no third.
 * Where you work the product, and what you agreed to by using it. */
const COLUMNS: {
  heading: string;
  links: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    heading: SITE_NAME,
    links: [
      { label: "Dashboard", href: "/servers" },
      { label: "Documentation", href: DOCS_URL, external: true },
      { label: "Support", href: SUPPORT_URL, external: true },
    ],
  },
  { heading: "Legal", links: LEGAL },
];

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return external ? (
    <a className="g-foot-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link className="g-foot-link" href={href}>
      {children}
    </Link>
  );
}

/**
 * The full footer: identity on the left, headed columns of destinations on the
 * right.
 */
export function SiteFooter() {
  return (
    <footer className="g-band g-footer">
      <div className="g-foot-top">
        <div className="g-foot-id">
          {/* The lockup and the two accounts, on one line: the mark says who,
              the buttons say where to find them. */}
          <div className="g-foot-lockup">
            <Link className="g-brand g-foot-brand" href="/">
              <GatorLogo size={26} />
              <span className="g-brand-word">{SITE_NAME}</span>
            </Link>
            {/* Two social links, both real. */}
            <span className="g-foot-social">
              <a
                className="g-foot-icon"
                href={AUTHOR}
                target="_blank"
                rel="noreferrer"
                aria-label="The author on Discord"
              >
                <IconAt size={16} stroke={2} />
              </a>
              <a
                className="g-foot-icon"
                href={SUPPORT_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Gator's Discord"
              >
                <DiscordLogo size={16} />
              </a>
            </span>
          </div>

          <p className="g-foot-copy">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>

        <nav className="g-foot-cols" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div className="g-foot-col" key={col.heading}>
              <h2 className="g-foot-head">{col.heading}</h2>
              <ul className="g-foot-list">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink href={l.href} external={l.external}>
                      {l.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/** The same obligations, on one line, for the poster. */
export function FooterLine({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`g-footline ${className ?? ""}`}>
      <span className="g-footline-copy">
        © {new Date().getFullYear()} {SITE_NAME}
      </span>
      <span className="g-footline-links">
        {children}
        {LEGAL.map((l) => (
          <Link className="g-foot-link" key={l.label} href={l.href}>
            {l.label}
          </Link>
        ))}
        <a
          className="g-foot-link"
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
        >
          Support
        </a>
      </span>
    </div>
  );
}
