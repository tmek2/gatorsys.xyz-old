import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const problems = [];
const required = ["AUTH_SECRET", "AUTH_URL", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "PROD_API_URL", "API_AUTH", "NEXT_PUBLIC_DISCORD_CLIENT_ID"];
for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value && !(name === "AUTH_SECRET" && process.env.NEXTAUTH_SECRET?.trim())) {
    problems.push(`${name} is missing`);
  }
}
for (const name of ["AUTH_URL", "SITE", "PROD_API_URL", "CANONICAL_URL", "NEXT_PUBLIC_SUPPORT_URL", "NEXT_PUBLIC_DOCS_URL"]) {
  if (!process.env[name]?.trim()) continue;
  try {
    const url = new URL(process.env[name]);
    const publicLink = ["NEXT_PUBLIC_SUPPORT_URL", "NEXT_PUBLIC_DOCS_URL"].includes(name);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || (!publicLink && (url.search || url.hash))) throw new Error();
  } catch {
    problems.push(`${name} must be an HTTP or HTTPS URL without credentials${name.startsWith("NEXT_PUBLIC_") ? "" : ", query parameters or a fragment"}`);
  }
}
for (const name of ["DISCORD_CLIENT_ID", "NEXT_PUBLIC_DISCORD_CLIENT_ID"]) {
  if (process.env[name] && !/^\d+$/.test(process.env[name])) problems.push(`${name} must contain only digits`);
}
if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET must contain at least 32 characters");
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) problems.push("NEXTAUTH_SECRET must contain at least 32 characters");
if (problems.length) {
  console.error("Configuration needs attention:\n" + problems.map(problem => `- ${problem}`).join("\n"));
  console.error("Copy .env.example to .env.local and follow the README. No secret values are printed by this check.");
  process.exitCode = 1;
} else {
  console.log("Required settings are present and URL formats are valid.");
  console.log("This checks configuration only; use a real sign-in to verify Discord and the bot API.");
}
