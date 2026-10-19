import { existsSync } from "node:fs";

// Match Next's precedence, keeping values already supplied by the host first.
const environment = process.env.NODE_ENV || "production";
const files = [`.env.${environment}.local`, ...(environment === "test" ? [] : [".env.local"]), `.env.${environment}`, ".env"];
for (const file of files) if (existsSync(file)) process.loadEnvFile(file);

const problems = [];
const aliases = { AUTH_SECRET: ["NEXTAUTH_SECRET"], AUTH_URL: ["NEXTAUTH_URL"], SITE: ["DASHBOARD_PUBLIC_URL"] };
const configured = (name) => [name, ...(aliases[name] || [])].map(key => process.env[key]?.trim()).find(Boolean);
const required = ["AUTH_SECRET", "AUTH_URL", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "PROD_API_URL", "API_AUTH", "NEXT_PUBLIC_DISCORD_CLIENT_ID"];
for (const name of required) {
  const value = configured(name);
  if (!value) {
    problems.push(`${name} is missing`);
  }
}
for (const name of ["AUTH_URL", "SITE", "PROD_API_URL", "CANONICAL_URL", "NEXT_PUBLIC_SUPPORT_URL", "NEXT_PUBLIC_DOCS_URL"]) {
  const value = configured(name);
  if (!value) continue;
  try {
    const url = new URL(value);
    const publicLink = ["NEXT_PUBLIC_SUPPORT_URL", "NEXT_PUBLIC_DOCS_URL"].includes(name);
    const originOnly = ["AUTH_URL", "SITE", "CANONICAL_URL"].includes(name);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || (!publicLink && (url.search || url.hash)) || (originOnly && url.pathname !== "/")) throw new Error();
  } catch {
    problems.push(`${name} must be an HTTP or HTTPS URL without credentials${["AUTH_URL", "SITE", "CANONICAL_URL"].includes(name) ? ", a page path, query parameters or a fragment" : name.startsWith("NEXT_PUBLIC_") ? "" : ", query parameters or a fragment"}`);
  }
}
for (const name of ["DISCORD_CLIENT_ID", "NEXT_PUBLIC_DISCORD_CLIENT_ID"]) {
  if (process.env[name] && !/^\d+$/.test(process.env[name])) problems.push(`${name} must contain only digits`);
}
if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET must contain at least 32 characters");
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) problems.push("NEXTAUTH_SECRET must contain at least 32 characters");
if (process.env.API_AUTH?.trim().startsWith("#")) problems.push("API_AUTH must be the bot's actual dashboard credential, not a commented placeholder");
if (problems.length) {
  console.error("Configuration needs attention:\n" + problems.map(problem => `- ${problem}`).join("\n"));
  console.error("Set the values in your host's environment settings, or copy .env.example to .env and follow the README. No secret values are printed by this check.");
  process.exitCode = 1;
} else {
  console.log("Required settings are present and URL formats are valid.");
  console.log("This checks configuration only; use a real sign-in to verify Discord and the bot API.");
}
