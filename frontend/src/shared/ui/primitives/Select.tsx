/**
 * @file Select.tsx
 * @description Enterprise-grade select field aligned with the Ethereal design system.
 * Wraps a native <select> for accessibility while enforcing ethereal tokens.
 * @module shared/ui/primitives/Select
 */

import React, { SelectHTMLAttributes, forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

const selectVariants = cva(
  "w-full appearance-none rounded-xl text-sm text-ethereal-ink transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        glass:
          "bg-ethereal-alabaster/60 backdrop-blur-md border border-ethereal-incense/20 shadow-glass-ethereal focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
        solid:
          "bg-ethereal-marble border border-ethereal-ink/10 shadow-glass-solid focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
        ghost:
          "bg-transparent border border-transparent hover:bg-ethereal-incense/10 focus:bg-ethereal-marble focus:border-ethereal-incense/30",
      },
      hasError: {
        true: "border-ethereal-crimson bg-ethereal-crimson-light/20 text-ethereal-crimson focus:border-ethereal-crimson focus:ring-ethereal-crimson/20",
      },
    },
    defaultVariants: {
      variant: "glass",
      hasError: false,
    },
  },
);

export interface SelectProps
  extends
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "variant">,
    VariantProps<typeof selectVariants> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, variant, leftIcon, className, id, children, ...props },
    ref,
  ) => {
    const internalId = useId();
    const selectId = id || internalId;
    const errorId = `${selectId}-error`;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <Eyebrow
            as="label"
            htmlFor={selectId}
            color="muted"
            className="ml-1"
          >
            {label}
          </Eyebrow>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className="pointer-events-none absolute left-4 flex items-center justify-center text-ethereal-graphite/60"
              aria-hidden="true"
            >
              {React.isValidElement(leftIcon)
                ? React.cloneElement(
                    leftIcon as React.ReactElement<{
                      size?: number;
                      strokeWidth?: number;
                    }>,
                    { size: 16, strokeWidth: 1.5 },
                  )
                : leftIcon}
            </div>
          )}

          <select
            id={selectId}
            ref={ref}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              selectVariants({ variant, hasError, className }),
              leftIcon ? "pl-11" : "px-4",
              "pr-10 py-3",
            )}
            {...props}
          >
            {children}
          </select>

          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-4 text-ethereal-graphite/60"
            aria-hidden="true"
          />
        </div>

        {hasError && (
          <span
            id={errorId}
            role="alert"
            className="ml-1 text-[10px] font-medium text-ethereal-crimson"
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
