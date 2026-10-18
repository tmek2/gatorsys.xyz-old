import type { Metadata } from "next";

import { auth } from "~/auth";
import { viewerFromSession } from "@/utils/viewer";
import { LegalPage } from "@/components/legal-page";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  /* The tab title is just the site name (no page suffixes, per app/layout.tsx);
     the description is this page's own, for search results and link previews. */
  title: SITE_NAME,
  description:
    "How Bot handles information used by the website and Discord application.",
};

const sections = [
  {
    title: "Information We Collect",
    content: (
      <>
        <p>
          When you sign in with Discord, Bot receives the account details
          needed to identify you, such as your Discord user ID, username, and
          avatar. We also receive the list of servers Discord makes available to
          your account so we can show the communities you can manage.
        </p>
        <p>
          When Bot is used in a server, it may process server IDs, roles,
          channels, permission settings, moderation records, infractions, ticket
          and transcript content, staff activity, and configuration choices
          required for enabled features.
        </p>
        <p>
          We also process limited technical information, including session
          cookies, short-lived cached server lists, request logs, and error
          details needed to keep the service secure and reliable.
        </p>
      </>
    ),
  },
  {
    title: "How We Use Information",
    content: (
      <ul>
        <li>
          Authenticate your Discord account and verify server permissions.
        </li>
        <li>
          Provide moderation, staff management, ticketing, transcript, and
          configuration features.
        </li>
        <li>
          Protect Bot and connected communities from abuse or unauthorized
          access.
        </li>
        <li>
          Diagnose failures, answer support requests, and improve service
          reliability.
        </li>
        <li>Meet legal obligations and enforce our Terms of Service.</li>
      </ul>
    ),
  },
  {
    title: "Sharing and Service Providers",
    content: (
      <>
        <p>
          Bot does not sell Discord API data or use it for advertising.
          Information is shared only when needed with Discord, hosting,
          database, caching, and infrastructure providers that operate the
          service; when a server administrator directs an action; or when
          disclosure is required by law or necessary to protect users and the
          service.
        </p>
        <p>
          Service providers may process information only to deliver their
          contracted services and are expected to protect it appropriately.
        </p>
      </>
    ),
  },
  {
    title: "Retention and Deletion",
    content: (
      <>
        <p>
          Session and cache data is kept only as long as needed for sign-in and
          responsive page loading. Server settings and operational records are
          retained while they are needed for enabled features, audit history,
          safety, or legal obligations.
        </p>
        <p>
          A user or authorized server administrator may request access,
          correction, or deletion through Bot support. We will verify the
          request and remove eligible information unless retention is required
          for security, dispute resolution, or legal compliance. Removing Bot
          from a server stops new server data from being collected through that
          installation.
        </p>
      </>
    ),
  },
  {
    title: "Cookies and Authentication",
    content: (
      <p>
        The website uses essential cookies and encrypted session information to
        keep you signed in, protect authenticated routes, and remember the
        account associated with a request. Bot does not use advertising
        cookies.
      </p>
    ),
  },
  {
    title: "Security and International Processing",
    content: (
      <p>
        We use access controls, encrypted connections, restricted credentials,
        and reasonable operational safeguards. No online service can guarantee
        absolute security. Infrastructure providers may process information in
        countries other than your own, subject to their safeguards and
        applicable law.
      </p>
    ),
  },
  {
    title: "Age Requirements",
    content: (
      <p>
        Bot is not directed to children under 13. You must also meet the
        minimum age required to use Discord in your country. If we learn that
        information was collected from someone who does not meet those
        requirements, we will take reasonable steps to delete it.
      </p>
    ),
  },
  {
    title: "Your Choices and Rights",
    content: (
      <p>
        Depending on where you live, you may have rights to access, correct,
        delete, restrict, or object to processing of personal information, and
        to receive a portable copy. You can disconnect the application through
        Discord, sign out of the website, or contact support to make a verified
        request.
      </p>
    ),
  },
  {
    title: "Policy Updates",
    content: (
      <p>
        We may update this policy when Bot changes or when legal requirements
        change. The effective date at the top of this page identifies the
        current version. Material changes will be communicated through the
        website or support community when appropriate.
      </p>
    ),
  },
];

/* The header shows who is signed in, so the legal pages pass the session
   (`LegalPage` defaults `user` to null). */
async function viewer() {
  return viewerFromSession(await auth());
}

export default async function PrivacyPage() {
  return (
    <LegalPage
      user={await viewer()}
      title="Privacy Policy"
      kind="privacy"
      effective="Effective 5 July 2026"
      changes={[
        {
          date: "15 September 2026",
          summary:
            "Navigation and a data overview. No change to the policy.",
        },
        {
          date: "5 July 2026",
          summary: "Effective date of the policy published on this site.",
        },
      ]}
      overview={
        <>
          <details className="g-legal-data-details">
            <summary>Data overview</summary>
            {/* Three kinds of information Bot holds, one block each, read down
               with each label beside its line and the same three questions in
               the same order (the account page uses the same shape). */}
            <div className="g-legal-data">
              {[
                {
                  what: "Your Discord identity and server list",
                  for: "Signing you in, and working out which servers you can manage.",
                  long: "Your sign-in lasts until you sign out. The server list is cached for 20 minutes, with a fallback copy kept for a day.",
                  can: "Sign out, or disconnect Bot in Discord",
                  href: "#your-choices-and-rights",
                },
                {
                  what: "Server settings, and what the switched-on modules record",
                  for: "Running those features: infractions, tickets and transcripts, shifts, staff activity.",
                  long: "Until someone asks for it to be deleted. Nothing here expires on its own, and removing Bot from a server stops new records without clearing the old ones.",
                  can: "Ask support to export, correct or delete it",
                  href: "#retention-and-deletion",
                },
                {
                  what: "Cookies, request logs and errors",
                  for: "Keeping you signed in, and finding faults.",
                  long: "No fixed period.",
                  can: "Sign out to drop the cookie",
                  href: "#cookies-and-authentication",
                },
              ].map((row) => (
                <section className="g-legal-datum" key={row.what}>
                  <h3>{row.what}</h3>
                  <dl>
                    <div>
                      <dt>What it is for</dt>
                      <dd>{row.for}</dd>
                    </div>
                    <div>
                      <dt>How long</dt>
                      <dd>{row.long}</dd>
                    </div>
                    <div>
                      <dt>What you can do</dt>
                      <dd>
                        <a href={row.href}>{row.can}</a>
                      </dd>
                    </div>
                  </dl>
                </section>
              ))}
            </div>
          </details>
        </>
      }
      summary="How Bot handles account, server, and service data."
      sections={sections}
    />
  );
}
