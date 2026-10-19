import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PREVIEW_SESSION } from "@/preview/identity";
import { viewerFromSession } from "@/utils/viewer";
import Link from "next/link";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "./setup.css";

export default function SetupPage() {
  return <div className="g-root setup-page">
    <SiteNav user={viewerFromSession(PREVIEW_SESSION)} leading="back" backHref="/" />
    <main className="setup-guide">
      <h1>Explore the test preview</h1>
      <p>You are signed in as Dev User. The three communities, members, and records are fictional. Nothing here connects to Discord, Roblox, or a live bot.</p>
      <section id="install"><h2>Deploy this preview</h2><p>Use a Node.js host with Node.js 22.6 or newer. No environment file or service credentials are required.</p><pre><code>{"npm ci\nnpm run build\nnpm start"}</code></pre><p>Use one running server for consistent sample edits. Configure your public HTTPS domain in your host's settings. The README explains deployment, the file structure, and where to change names and branding.</p></section>
      <section id="discord"><h2>Try the dashboard</h2><p>Open any test server, change settings, or explore the document, spreadsheet, form and message editors. Saved changes stay inside your preview session.</p><p><Link href="/servers">Choose a test server</Link> or <Link href="/account">view your fictional account</Link>.</p></section>
      <section id="support"><h2>Start again</h2><p>Use Reset preview in the yellow notice to restore the samples. If you closed the notice, choose Test preview at the bottom of the page to show it again.</p><p>Changes live in server memory and reset on restart, after twelve idle hours, or if an old session is evicted. Never enter real personal information or credentials.</p></section>
      <section id="bot"><h2>Connect a real bot</h2><p>Use the main branch for the real website and its connection guide. This branch deliberately runs without OAuth, a database, or live bot actions.</p></section>
    </main><SiteFooter />
  </div>;
}
