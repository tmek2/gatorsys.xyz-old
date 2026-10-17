"use client";

/**
 * Last-resort boundary: if the root layout or a provider throws, Next renders
 * this instead of a blank document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" style={{ backgroundColor: "#030303", colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#030303",
          color: "#f5f2f2",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <img
            src="/gator-logo.png"
            alt=""
            width={44}
            height={44}
            style={{ opacity: 0.5, margin: "0 auto 20px" }}
          />
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 20px" }}>
            We hit an unexpected error loading this page. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: "1px solid rgba(255,255,255,0.82)",
              background: "#eeeeee",
              color: "#090909",
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "10px 20px",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
