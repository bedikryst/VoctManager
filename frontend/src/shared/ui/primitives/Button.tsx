/**
 * @file Button.tsx
 * @description Enterprise-grade button primitive for VoctEnsemble.
 * Employs strict Ethereal UI tokens. Exports variants for polymorphic usage with Link components.
 * @module shared/ui/primitives/Button
 */

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[10px] uppercase tracking-wider font-bold antialiased transition-all duration-500 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ethereal-gold/50 disabled:pointer-events-none disabled:opacity-40 active:scale-95 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-ethereal-ink text-white hover:bg-ethereal-gold",
        secondary:
          "bg-ethereal-marble border border-ethereal-incense/30 text-ethereal-ink hover:border-ethereal-gold hover:text-ethereal-gold",
        outline:
          "bg-transparent text-ethereal-graphite border border-ethereal-incense/30 hover:border-ethereal-sage hover:text-ethereal-sage",
        ghost:
          "bg-transparent text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-incense/5 shadow-none",
      },
      size: {
        default: "px-5 py-2.5", // Calibrated to SpotlightCard
        sm: "px-4 py-2", // Calibrated to Header Actions
        lg: "px-8 py-3.5 text-[11px]",
        icon: "h-10 w-10",
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
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
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
            size={14}
            strokeWidth={1.5}
            className="animate-spin text-current"
            aria-hidden="true"
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
