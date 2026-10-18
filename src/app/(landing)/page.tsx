import { auth } from "~/auth";
import { LandingPage } from "@/components/site/landing";
import { viewerFromSession } from "@/utils/viewer";
import "../globals.css";

export default async function Home() {
  const session = await auth();
  /* `viewerFromSession`, not `session?.user`: a session with stale Discord
     tokens still has a name and avatar, but every gated page turns it away. */
  const user = viewerFromSession(session);
  return <LandingPage user={user} />;
}
