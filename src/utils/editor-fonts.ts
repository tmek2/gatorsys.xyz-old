/**
 * Font families offered in the document and spreadsheet editors. Web fonts load
 * via a Google Fonts <link> in the root layout; the rest are system families.
 * `value` is the CSS font-family string.
 */
export const EDITOR_FONTS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
];
