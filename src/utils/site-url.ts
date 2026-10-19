export function getSiteUrl() {
  // Metadata only: preview data reads use the local dispatcher, never this URL.
  return "http://localhost:3000";
}
