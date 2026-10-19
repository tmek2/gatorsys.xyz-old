import { SITE_NAME } from "@/config/site";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "./setup.css";

export const metadata = { title: SITE_NAME, description: "Install and connect your community dashboard." };

export default function SetupPage() {
  return (
    <div className="g-root setup-page">
      <SiteNav user={null} leading="back" backHref="/" />
      <main className="setup-guide">
        <h1>Set up your dashboard</h1>
        <p>This website connects to a separately running bot. You need your own Discord application and a compatible bot dashboard API to use the live dashboard.</p>
        <section id="install">
          <h2>1. Configure your host</h2>
          <p>Use a Next.js host or Node.js 22.6 or newer. Add the settings from <code>.env.example</code> in your host's Environment Variables panel, or copy it to <code>.env</code> in the repository root and replace its values.</p>
          <pre><code>{"npm ci\nnpm run check:env\nnpm run build\nnpm start"}</code></pre>
          <p>Serve your public domain over HTTPS. Keep the filled environment file out of Git. The README lists every replacement value and the hosting settings.</p>
        </section>
        <section id="discord">
          <h2>2. Connect your Discord application</h2>
          <p>Set <code>DISCORD_CLIENT_ID</code> and <code>DISCORD_CLIENT_SECRET</code> using your application's OAuth2 settings. These are application credentials, not a bot token.</p>
          <p>Register this callback using your actual website domain:</p>
          <pre><code>https://YOUR_DOMAIN/api/auth/callback/discord</code></pre>
          <p>Set <code>AUTH_URL</code> and <code>SITE</code> to that same HTTPS origin. Generate a private <code>AUTH_SECRET</code> using the command in <code>.env.example</code>.</p>
          <p>The Add bot button uses <code>NEXT_PUBLIC_DISCORD_CLIENT_ID</code>, usually the same application ID. Public environment values are included in the browser build; rebuild after changing them.</p>
        </section>
        <section id="bot">
          <h2>3. Connect the bot API</h2>
          <p>Set <code>PROD_API_URL</code> to your bot's dashboard API base URL and <code>API_AUTH</code> to its matching dashboard credential. Neither value is a Discord bot token. A generic Discord bot without these API endpoints cannot serve this dashboard.</p>
          <p>The connected bot checks each user's permissions. A successful Discord sign-in alone does not grant server access. See the repository's <code>docs/bot-api.md</code> for the expected request contract.</p>
          <p><code>REDIS_URL</code> is optional. Leaving it empty disables server caching.</p>
        </section>
        <section id="support">
          <h2>Help and deployment</h2>
          <p>Your installation's support and documentation links are configured with <code>NEXT_PUBLIC_SUPPORT_URL</code> and <code>NEXT_PUBLIC_DOCS_URL</code>. When they are empty, this website's guide is used.</p>
          <p>The README explains deployment, the file structure, names and branding, and the separate test preview branch.</p>
          <pre><code>{"npm test\nnpm run test:interactions\nnpm run typecheck\nnpm run build\nnpm start"}</code></pre>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
