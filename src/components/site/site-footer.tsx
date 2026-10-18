"use client";

import { Link } from "next-view-transitions";
import { DOCS_URL, SITE_NAME, SUPPORT_URL } from "@/config/site";
import { AppLogo } from "./app-logo";
import "./footer.css";

export const LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const LINKS = [
  { label: "Dashboard", href: "/servers" },
  { label: "Documentation", href: DOCS_URL },
  { label: "Support", href: SUPPORT_URL },
];

const COLUMNS = [
  { heading: SITE_NAME, links: LINKS },
  { heading: "Legal", links: LEGAL },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return href.startsWith("http") ? (
    <a className="g-foot-link" href={href} target="_blank" rel="noreferrer">{children}</a>
  ) : <Link className="g-foot-link" href={href}>{children}</Link>;
}

export function SiteFooter() {
  return (
    <footer className="g-band g-footer">
      <div className="g-foot-top">
        <div className="g-foot-id">
          <Link className="g-brand g-foot-brand" href="/">
            <AppLogo size={26} />
            <span className="g-brand-word">{SITE_NAME}</span>
          </Link>
          <p className="g-foot-copy">© {new Date().getFullYear()} {SITE_NAME}</p>
        </div>
        <nav className="g-foot-cols" aria-label="Footer">
          {COLUMNS.map(column => (
            <div className="g-foot-col" key={column.heading}>
              <h2 className="g-foot-head">{column.heading}</h2>
              <ul className="g-foot-list">
                {column.links.map(link => <li key={link.label}><FooterLink href={link.href}>{link.label}</FooterLink></li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function FooterLine({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`g-footline ${className ?? ""}`}>
      <span className="g-footline-copy">© {new Date().getFullYear()} {SITE_NAME}</span>
      <span className="g-footline-links">
        {children}
        {[...LEGAL, { label: "Support", href: SUPPORT_URL }].map(link => (
          <FooterLink key={link.label} href={link.href}>{link.label}</FooterLink>
        ))}
      </span>
    </div>
  );
}
