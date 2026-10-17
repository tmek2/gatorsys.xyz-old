export function getSiteUrl() {
  const explicitUrl =
    process.env.SITE ||
    process.env.DASHBOARD_PUBLIC_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL;

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
