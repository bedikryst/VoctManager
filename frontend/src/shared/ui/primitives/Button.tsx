/**
 * @file Button.tsx
 * @description Enterprise-grade button component. Handles multiple variants,
 * sizes, and automated loading states whilst strictly adhering to WCAG guidelines.
 * Styled to reflect the elegant, minimalist aesthetic of VoctEnsemble.
 * @module shared/ui/primitives/Button
 */

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[10px] uppercase tracking-[0.15em] font-bold antialiased transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:bg-brand-dark hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)]",
        secondary:
          "bg-stone-900 text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:bg-brand",
        outline:
          "border border-stone-200/80 bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm hover:border-brand/40 hover:text-brand",
        danger:
          "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700",
        ghost:
          "bg-transparent text-stone-500 hover:bg-stone-100/80 hover:text-stone-800",
      },
      size: {
        default: "h-12 px-8 py-3.5",
        sm: "h-9 rounded-lg px-4 py-2 text-[9px]",
        lg: "h-14 rounded-2xl px-10 py-4 text-[11px]",
        icon: "h-12 w-12",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Engages the loading state, disabling the button and rendering a spinner */
  isLoading?: boolean;
  /** Optional React node placed before the children */
  leftIcon?: React.ReactNode;
  /** Optional React node placed after the children */
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = isLoading || disabled;

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {isLoading && (
          <Loader2
            size={16}
            className="animate-spin"
            aria-hidden="true"
            data-testid="button-loading-spinner"
          />
        )}
        {!isLoading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <span className="truncate">{children}</span>

        {!isLoading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
