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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[11px] uppercase tracking-[0.1em] font-bold antialiased transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:text-ethereal-graphite/40 disabled:bg-ethereal-incense/10 disabled:border-transparent active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-ethereal-ink text-ethereal-marble border border-ethereal-ink shadow-[0_4px_12px_rgba(44,42,40,0.15)] hover:bg-ethereal-ink/90 hover:border-ethereal-gold/60 hover:text-ethereal-gold hover:shadow-[0_8px_20px_rgba(194,168,120,0.25)] disabled:shadow-none",
        secondary:
          "bg-white/50 backdrop-blur-md border border-ethereal-incense/20 text-ethereal-ink shadow-sm hover:border-ethereal-gold/50 hover:bg-white/80 hover:text-ethereal-gold hover:shadow-[0_6px_16px_rgba(194,168,120,0.15)]",
        outline:
          "bg-transparent text-ethereal-graphite border border-ethereal-incense/30 hover:border-ethereal-sage hover:text-ethereal-sage hover:shadow-[0_4px_12px_rgba(143,154,138,0.15)] disabled:bg-transparent",
        ghost:
          "bg-transparent text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-incense/10 shadow-none",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-4 py-2 text-[10px]",
        lg: "px-8 py-3.5 text-[12px]",
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
