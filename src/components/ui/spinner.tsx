import { IconLoader2 } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <IconLoader2
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
      data-slot="spinner"
    />
  );
}

