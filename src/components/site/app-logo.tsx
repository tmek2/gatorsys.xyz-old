import { SITE_NAME } from "@/config/site";

export function AppLogo({ size = 28, className, title = SITE_NAME }: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      role={title ? "img" : undefined} aria-label={title || undefined}
      aria-hidden={title ? undefined : true} className={className}>
      <path d="M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10-3h8v11h-8z" />
    </svg>
  );
}
