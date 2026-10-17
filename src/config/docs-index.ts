/* What the documentation contains: a copy of `src/content/nav.ts` in the
   gatorsys-docs repo (a separate deployment, so it cannot be imported), limited
   to title, path, description and search keywords. Copied word for word; a page
   added there and not here is simply not findable from the palette. */

import { DOCS_URL } from "./site";

export interface DocsPage {
  title: string;
  /** Path on the docs deployment. `url()` makes it absolute. */
  path: string;
  /** Which tab of the docs it lives under: General, Bot, or Website. */
  product: string;
  description: string;
  /** The docs' own keyword line, so the same query finds the same page. */
  keywords: string;
}

export const DOCS_PAGES: DocsPage[] = [
  {
    title: "Introduction",
    path: "/",
    product: "General",
    description: "What GatorSys is and how the pieces fit together.",
    keywords: "overview what is gatorsys discord management platform",
  },
  {
    title: "Frequent questions",
    path: "/frequent-questions",
    product: "General",
    description: "Frequently asked questions about GatorSys.",
    keywords: "faq questions help dashboard ai support pricing",
  },
  {
    title: "The bot",
    path: "/bot",
    product: "Bot",
    description: "How the Discord bot runs your community.",
    keywords: "bot discord commands overview",
  },
  {
    title: "Setup",
    path: "/bot/setup",
    product: "Bot",
    description: "Configure permissions and modules to get started.",
    keywords: "setup config permissions modules get started onboarding",
  },
  {
    title: "Variables",
    path: "/bot/variables",
    product: "Bot",
    description: "Every placeholder the bot substitutes, by scope.",
    keywords: "variables placeholders author guild roblox tokens substitution",
  },
  {
    title: "Command reference",
    path: "/bot/commands",
    product: "Bot",
    description: "Every slash command the bot ships, grouped by area.",
    keywords:
      "commands slash reference staff sessions giveaway partner package application shift activity duty break leaderboard",
  },
  {
    title: "Permissions",
    path: "/bot/permissions",
    product: "Bot",
    description: "Role-based access for commands and the dashboard.",
    keywords: "permissions staff admin role access",
  },
  {
    title: "Modules",
    path: "/bot/modules",
    product: "Bot",
    description: "Turn features on and off independently.",
    keywords: "modules enable disable toggle features",
  },
  {
    title: "Tickets",
    path: "/bot/tickets",
    product: "Bot",
    description: "Panels, subjects, transcripts, and staff workflow.",
    keywords: "support tickets panels subjects transcripts close claim",
  },
  {
    title: "AI support",
    path: "/bot/ai-support",
    product: "Bot",
    description: "The ticket AI, its knowledge base, and how it learns.",
    keywords: "ai openai chatgpt knowledge base gaps resolved unresolved",
  },
  {
    title: "Infractions",
    path: "/bot/infractions",
    product: "Bot",
    description: "Warn, mute, ban, and track cases with expirations.",
    keywords: "infractions warns bans mutes cases expiration moderation",
  },
  {
    title: "The website",
    path: "/website",
    product: "Website",
    description: "The dashboard and everything that lives on it.",
    keywords: "website dashboard overview",
  },
  {
    title: "Dashboard tabs",
    path: "/website/dashboard",
    product: "Website",
    description: "What every tab in the manage dashboard configures.",
    keywords:
      "dashboard tabs sections manage overview customization permissions logging audit staff modules tickets modmail sessions roblox resources commands templates search shifts activity game logs ai detection paste review",
  },
  {
    title: "Infractions",
    path: "/website/infractions",
    product: "Website",
    description: "Review, edit, and void cases from the dashboard.",
    keywords: "infractions void edit review dashboard moderation",
  },
  {
    title: "Promotions",
    path: "/website/promotions",
    product: "Website",
    description: "Promote and demote with automated hierarchies.",
    keywords: "promotions demotions ranks hierarchy logs",
  },
  {
    title: "Documents",
    path: "/website/documents",
    product: "Website",
    description: "The document editor, spreadsheets, and sharing.",
    keywords: "documents spreadsheets editor a4 sharing",
  },
];

/** Absolute URL for a documentation path. */
export function docsUrl(path: string): string {
  return path === "/" ? DOCS_URL : `${DOCS_URL}${path}`;
}

/* Which documentation page covers a module. Only the six with their own page
   are listed; the rest go to the module catalogue, which has a row for every
   module (`/bot/giveaways` would be a 404). */
export const MODULE_DOCS: Record<string, string> = {
  infractions: "/bot/infractions",
  promotions: "/website/promotions",
  tickets: "/bot/tickets",
  gatorai: "/bot/ai-support",
  customcommands: "/bot/commands",
};

export const MODULE_CATALOGUE = "/bot/modules";
