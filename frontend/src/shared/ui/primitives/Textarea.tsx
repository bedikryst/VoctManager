/**
 * @file Textarea.tsx
 * @description Enterprise-grade multi-line input aligned with the Ethereal design system.
 * @module shared/ui/primitives/Textarea
 */

import React, { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

const textareaVariants = cva(
  "w-full rounded-xl text-sm text-ethereal-ink placeholder:text-ethereal-graphite/50 transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
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

export interface TextareaProps
  extends
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "variant">,
    VariantProps<typeof textareaVariants> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, variant, className, id, ...props }, ref) => {
    const internalId = useId();
    const textareaId = id || internalId;
    const errorId = `${textareaId}-error`;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <Eyebrow
            as="label"
            htmlFor={textareaId}
            color="muted"
            className="ml-1"
          >
            {label}
          </Eyebrow>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            textareaVariants({ variant, hasError, className }),
            "px-4 py-3",
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";
