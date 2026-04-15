/**
 * @file Button.tsx
 * @description Enterprise-grade button primitive for VoctEnsemble.
 * Employs strict Ethereal UI tokens. Exports variants for polymorphic usage.
 * @module shared/ui/primitives/Button
 */

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[11px] uppercase tracking-[0.1em] font-bold antialiased transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-ethereal-ink text-white border border-ethereal-ink shadow-[var(--shadow-ethereal-soft)] hover:bg-ethereal-ink/90 hover:border-ethereal-gold/60 hover:text-ethereal-gold",
        secondary:
          "bg-white/50 backdrop-blur-md border border-ethereal-incense/20 text-ethereal-ink shadow-sm hover:border-ethereal-gold/50 hover:bg-white/80 hover:text-ethereal-gold",
        outline:
          "bg-transparent text-ethereal-graphite border border-ethereal-incense/30 hover:border-ethereal-gold hover:text-ethereal-ink hover:bg-white/40",
        ghost:
          "bg-transparent text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-incense/10 shadow-none",
        destructive:
          "bg-red-50 text-red-600 border border-red-900/10 hover:bg-red-100 hover:border-red-900/20",
        icon: "bg-transparent text-ethereal-graphite hover:text-ethereal-gold hover:bg-ethereal-incense/10",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-4 py-2 text-[10px]",
        lg: "px-8 py-3.5 text-[12px]",
        icon: "h-10 w-10 flex items-center justify-center p-0",
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
  asChild?: boolean;
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
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = isLoading || disabled;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isLoading && (
              <Loader2
                size={14}
                strokeWidth={1.5}
                className="animate-spin text-current shrink-0"
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
          </>
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";
