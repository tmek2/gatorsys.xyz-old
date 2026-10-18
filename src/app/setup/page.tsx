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
          <h2>1. Install and configure</h2>
          <p>Use Node.js 22.6 or newer. Install the dependencies, copy <code>.env.example</code> to <code>.env.local</code>, and fill in the required values described in that file.</p>
          <pre><code>{"npm ci\n# Copy .env.example to .env.local\nnpm run check:env\nnpm run dev"}</code></pre>
          <p>Open <code>http://localhost:3000</code>. Keep your local environment file out of Git.</p>
        </section>
        <section id="discord">
          <h2>2. Connect your Discord application</h2>
          <p>Set <code>DISCORD_CLIENT_ID</code> and <code>DISCORD_CLIENT_SECRET</code> using your application's OAuth2 settings. These are application credentials, not a bot token.</p>
          <p>Register this exact development callback URL:</p>
          <pre><code>http://localhost:3000/api/auth/callback/discord</code></pre>
          <p>For deployment, also register <code>https://YOUR_DOMAIN/api/auth/callback/discord</code> and set <code>AUTH_URL</code> and <code>SITE</code> to that origin. Generate a private <code>AUTH_SECRET</code> using the command in <code>.env.example</code>.</p>
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
          <p>Your installation's support and documentation links are configured with <code>NEXT_PUBLIC_SUPPORT_URL</code> and <code>NEXT_PUBLIC_DOCS_URL</code>. When they are empty, this local guide is used.</p>
          <p>The README covers common sign-in errors, API connection failures, production deployment, and the separate offline preview branch.</p>
          <pre><code>{"npm test\nnpm run test:interactions\nnpm run typecheck\nnpm run build\nnpm start"}</code></pre>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
