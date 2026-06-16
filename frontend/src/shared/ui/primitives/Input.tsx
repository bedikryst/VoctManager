/**
 * @file Input.tsx
 * @description Enterprise-grade input field with integrated label and error handling.
 * Optimised for react-hook-form and Zod validation schemas. Uses Ethereal Theme tokens.
 * @module shared/ui/primitives/Input
 */

import React, { InputHTMLAttributes, forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl text-sm transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        glass:
          "bg-ethereal-marble/90 backdrop-blur-md border border-ethereal-gold/35 text-ethereal-ink shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] placeholder:text-ethereal-incense focus:bg-ethereal-marble focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/55",
        dark: "bg-ethereal-ink/80 backdrop-blur-xl border border-ethereal-gold/20 text-ethereal-alabaster shadow-2xl placeholder:text-ethereal-incense focus:bg-ethereal-ink focus:border-ethereal-gold/60 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/40",
        ghost:
          "bg-transparent border-transparent text-ethereal-ink placeholder:text-ethereal-incense hover:bg-ethereal-parchment/40 focus:bg-ethereal-marble/80 focus:border-ethereal-gold/30",
      },
      hasError: {
        true: "border-ethereal-crimson bg-ethereal-crimson/5 focus:border-ethereal-crimson focus:ring-ethereal-crimson/20 text-ethereal-ink placeholder:text-ethereal-crimson/70",
      },
    },
    defaultVariants: {
      variant: "glass",
      hasError: false,
    },
  },
);

export interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "variant">,
    VariantProps<typeof inputVariants> {
  /** Text label displayed above the input */
  label?: string;
  /** Error message derived from validation schema */
  error?: string;
  /** Optional icon rendered on the left flank */
  leftIcon?: React.ReactNode;
  /** Optional element (e.g., unit, currency) on the right flank */
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, variant, leftIcon, rightElement, className, id, ...props },
    ref,
  ) => {
    const internalId = useId();
    const inputId = id || internalId;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="ml-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite antialiased"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className={cn(
                // Hidden on phones — the icon ate ~24px of an already narrow
                // field and the value clipped; the padding is reclaimed below.
                // z-10: the field's backdrop-blur makes it a stacking context, and
                // since the icon precedes it in the DOM the field's (near-opaque)
                // background paints OVER the icon and hides it — z-10 lifts the
                // icon back on top. pointer-events-none keeps click-to-focus.
                "pointer-events-none absolute left-3 z-10 hidden items-center justify-center sm:flex",
                // Incense reads on the dark variant but is too faint on the light
                // fills; graphite gives the icon real contrast on desktop.
                variant === "dark"
                  ? "text-ethereal-incense"
                  : "text-ethereal-graphite/55",
              )}
              aria-hidden="true"
            >
              {React.isValidElement(leftIcon)
                ? React.cloneElement(
                    leftIcon as React.ReactElement<{
                      size?: number;
                      strokeWidth?: number;
                    }>,
                    { size: 18, strokeWidth: 1.5 },
                  )
                : leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              inputVariants({ variant, hasError, className }),
              // Icon padding only from sm+, since the icon itself is hidden on phones.
              leftIcon ? "pl-4 sm:pl-10" : "pl-4",
              rightElement ? "pr-12" : "pr-4",
              "py-3",
            )}
            {...props}
          />

          {rightElement && (
            <div
              className="absolute right-6 flex items-center justify-center text-[10px] font-bold text-ethereal-incense uppercase tracking-tighter"
              aria-hidden="true"
            >
              {rightElement}
            </div>
          )}
        </div>

        {hasError && (
          <span
            id={errorId}
            role="alert"
            className="ml-1 animate-in fade-in slide-in-from-top-1 text-[10px] font-medium text-ethereal-crimson duration-300"
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
