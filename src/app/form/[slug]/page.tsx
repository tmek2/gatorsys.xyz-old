import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { decodeShortId, isPublicFormId } from "@/utils/short-links";
import { auth } from "~/auth";
import { botDashboardGet } from "@/utils/manage-api";
import { getCached, setCached } from "@/utils/redis";
import { NO_INDEX } from "@/utils/no-index";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { viewerFromSession } from "@/utils/viewer";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import {
  ApplicationForm,
  ApplicationSignInGate,
} from "@/components/application-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Turns a `/form/<…>` segment into the guild and application it names. A minted
 * public id costs one call to the bot's resolver; a packed pair resolves
 * locally.
 *
 * Cached per request (the page and `generateMetadata` both need it) and in
 * Redis for a long time, because a public id is minted once and never
 * reassigned, and this is the site's most-visited page.
 */
const RESOLVED_SLUG_TTL_SECONDS = 86_400;

const resolveSlug = cache(
  async (slug: string): Promise<[string, string] | null> => {
    if (isPublicFormId(slug)) {
      const cacheKey = `form:slug:v1:${slug}`;
      // Only hits are cached. A miss usually means the application has not been
      // saved through the bot yet, and caching it would keep a working link
      // broken for a day.
      const cached = await getCached<[string, string]>(cacheKey);
      if (Array.isArray(cached) && cached.length === 2) return cached;
      try {
        const res = await botDashboardGet("dashboard_application_by_public_id", {
          public: slug,
        });
        if (!res.ok) return null;
        const json = await res.json();
        const guildId = String(json?.guild || "");
        const appId = String(json?.application || "");
        if (!guildId || !appId) return null;
        await setCached(cacheKey, [guildId, appId], RESOLVED_SLUG_TTL_SECONDS);
        return [guildId, appId];
      } catch {
        return null;
      }
    }
    const parts = decodeShortId(slug, 2);
    return parts ? [parts[0], parts[1]] : null;
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Metadata built in one place so `robots` (no indexing: application forms are
  // reachable by link only) cannot be missed on any branch.
  const named = await applicationName(await params);
  return {
    title: named || "Apply",
    description: named ? `Apply to ${named}.` : undefined,
    robots: NO_INDEX,
  };
}

/** The application's name, or null on any path that cannot produce one. */
async function applicationName(
  params: { slug: string },
): Promise<string | null> {
  const parts = await resolveSlug(params.slug);
  if (!parts) return null;
  const [guildId, appId] = parts;
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    const res = await botDashboardGet("dashboard_application_public", {
      server: guildId,
      user: session.user.id,
      application: appId,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.application?.name || null;
  } catch {
    return null;
  }
}

/**
 * `/form/<id>`: a server application at a short link. The segment is either the
 * application's minted public id (digits, resolved through the bot) or the
 * older packed pair (resolved with no lookup). The old
 * `/application/<guild>/<app>` shape redirects here.
 */
export default async function ApplicationRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parts = await resolveSlug((await params).slug);
  if (!parts) notFound();
  const [guildId, appId] = parts;
  const session = await auth();

  // `?case=` comes from the appeal button on an infraction DM and is submitted
  // with the form, so the reviewer sees which case is being appealed.
  const rawCase = (await searchParams)?.case;
  const caseId = (Array.isArray(rawCase) ? rawCase[0] : rawCase)?.trim() || null;

  return (
    /* The site's header and footer and its ground (so it follows the chosen
       appearance), with a column for the form between them, as on /servers
       and /account. */
    <main className="g-root app-respond-page flex min-h-screen flex-col" data-astryx-theme="neutral">
      <SiteNav user={viewerFromSession(session)} float />
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-24 sm:px-8 lg:px-12">
        <div className="pt-8">
          {session?.user?.id ? (
            <ApplicationForm
              guildId={guildId}
              appId={appId}
              caseId={caseId}
              viewer={{
                id: String(session.user.id),
                name: session.user.name || "Discord user",
                image: session.user.image,
              }}
            />
          ) : (
            <ApplicationSignInGate guildId={guildId} appId={appId} />
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
