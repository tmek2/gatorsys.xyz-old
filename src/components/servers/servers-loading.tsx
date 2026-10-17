import "@/app/servers/servers.css";
import "@/components/site/skeleton.css";

/* The servers page while loading: the real hero with its real words (they do
   not depend on data), with only the count and the cards drawn as placeholders,
   at the cards' size and columns, so nothing moves when they arrive. */
export function ServersLoading({ user }: { user: any }) {
  return (
    <div className="servers-hero" aria-busy="true">
      <p className="sr-only" role="status">
        Loading {user?.name ? `${user.name}'s` : "your"} servers
      </p>
      <div className="servers-hero-top">
        <div className="servers-hero-title">
          <h1>
            Pick a <span>server.</span>
            <span className="servers-count skel-dot" />
          </h1>
        </div>
        <div className="servers-list-tools">
          <span className="skel-bar skel-pill" style={{ width: "13.5rem" }} />
          <span className="skel-dot skel-round" />
          <span className="skel-bar skel-pill" style={{ width: "6.5rem" }} />
        </div>
      </div>

      <div className="servers-hero-list">
        <div className="skel-columns">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <div className="skel-card" key={card}>
              <span className="skel-dot skel-icon" />
              <span className="skel-bar" style={{ width: "62%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
