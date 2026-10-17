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
    "The terms governing access to the Gator website and Discord application.",
};

const sections = [
  {
    title: "Acceptance",
    content: (
      <p>
        By inviting Gator, signing in to the dashboard, or using any Gator
        feature, you agree to these Terms of Service and the Privacy Policy. If
        you do not agree, do not use the service and remove Gator from servers
        you control.
      </p>
    ),
  },
  {
    title: "Eligibility",
    content: (
      <p>
        You must be at least 13 years old, meet Discord's minimum age for your
        country, and be legally able to accept these terms. If you use Gator for
        an organization or community, you confirm that you have authority to act
        for it.
      </p>
    ),
  },
  {
    title: "Discord and Server Access",
    content: (
      <>
        <p>
          Gator depends on Discord and requires a valid Discord account.
          Discord's own terms, policies, permissions, outages, and API changes
          also apply and may affect availability.
        </p>
        <p>
          You may configure or manage only servers where you have appropriate
          authority. You are responsible for assigning roles, permissions,
          retention settings, and staff access that fit your community.
        </p>
      </>
    ),
  },
  {
    title: "Acceptable Use",
    content: (
      <ul>
        <li>
          Do not use Gator for illegal, deceptive, abusive, or harmful activity.
        </li>
        <li>
          Do not bypass permissions, security controls, rate limits, or access
          restrictions.
        </li>
        <li>
          Do not use the service to harass users, distribute prohibited content,
          or violate Discord policies.
        </li>
        <li>
          Do not upload malware, interfere with service operation, scrape data,
          or attempt unauthorized access.
        </li>
        <li>
          Do not misrepresent Gator, resell access without permission, or use
          Discord data for advertising or profiling.
        </li>
      </ul>
    ),
  },
  {
    title: "Your Content and Responsibilities",
    content: (
      <p>
        You retain responsibility for information, configurations, messages, and
        records submitted through your community. You confirm that you have the
        rights and permissions needed to process that content and instruct Gator
        to perform requested actions. You are responsible for reviewing
        automated actions and maintaining appropriate staff oversight.
      </p>
    ),
  },
  {
    title: "Service Availability",
    content: (
      <p>
        We may add, change, limit, pause, or discontinue features to maintain
        security, comply with platform rules, or improve the service. We do not
        guarantee uninterrupted availability, permanent storage, or
        compatibility with every Discord change. Keep independent records where
        your community requires them.
      </p>
    ),
  },
  {
    title: "Ownership",
    content: (
      <p>
        Gator's software, branding, design, and original service content remain
        the property of the service operator and its licensors. These terms
        grant only a limited, revocable, non-transferable right to use the
        service as provided. Discord and third-party names and materials remain
        owned by their respective holders.
      </p>
    ),
  },
  {
    title: "Suspension and Termination",
    content: (
      <p>
        Access may be limited or terminated when these terms, Discord policies,
        or applicable law are violated; when use creates security or operational
        risk; or when required by Discord or lawful authority. You may stop
        using Gator at any time by removing it from your server and signing out
        of the dashboard.
      </p>
    ),
  },
  {
    title: "Disclaimers and Liability",
    content: (
      <p>
        Gator is provided on an "as available" basis to the fullest extent
        permitted by law. We do not make warranties about uninterrupted
        operation, fitness for a particular purpose, or error-free moderation
        outcomes. To the fullest extent permitted by law, the service operator
        is not liable for indirect, incidental, special, consequential, or
        lost-profit damages arising from use of the service. Rights that cannot
        legally be excluded remain unaffected.
      </p>
    ),
  },
  {
    title: "Changes and Contact",
    content: (
      <p>
        We may update these terms as Gator changes. Continuing to use the
        service after an updated version becomes effective means you accept the
        revised terms. Material changes will be communicated through the website
        or support community when appropriate.
      </p>
    ),
  },
];

/* The header shows who is signed in, so the legal pages pass the session
   (`LegalPage` defaults `user` to null). */
async function viewer() {
  return viewerFromSession(await auth());
}

export default async function TermsPage() {
  return (
    <LegalPage
      user={await viewer()}
      title="Terms of Service"
      kind="terms"
      effective="Effective 5 July 2026"
      changes={[
        {
          date: "15 September 2026",
          summary:
            "Renamed to Terms of Service. No change to the terms.",
        },
        {
          date: "5 July 2026",
          summary: "Effective date of the terms published on this site.",
        },
      ]}
      summary="The rules for using Gator's website, dashboard, and Discord bot."
      sections={sections}
    />
  );
}
