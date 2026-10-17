"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border text-sm font-semibold tracking-[-0.01em] outline-none transition duration-200 ease-premium focus-visible:ring-2 focus-visible:ring-[var(--accent-peach)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090a] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 data-[loading]:select-none data-[loading]:text-transparent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[color-mix(in_srgb,var(--accent-peach)_70%,transparent)] bg-[var(--accent-peach)] text-[#211517] hover:bg-[var(--accent-peach-strong)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border-[var(--gator-border-strong)] bg-[var(--gator-surface)] text-[var(--gator-text)] hover:border-[color-mix(in_srgb,var(--accent-peach)_34%,var(--gator-border-strong))] hover:bg-[var(--gator-surface-raised)]",
        displayOutline: "border border-input bg-background shadow-sm pointer-events-none",
        secondary: "border-[var(--gator-border-strong)] bg-[var(--gator-surface)] text-[var(--gator-text)] hover:border-white/25 hover:bg-[var(--gator-surface-raised)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-11 rounded-[10px] px-6",
        icon: "size-10 p-0",
        iconxx: "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled,
  ...props
}: ButtonProps): React.ReactElement {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render
    ? undefined
    : "button";
  const defaultProps = {
    children: (
      <>
        {children}
        {loading ? (
          <Spinner
            className="pointer-events-none absolute"
            data-slot="button-loading-indicator"
          />
        ) : null}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: Boolean(loading || disabled),
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
