/**
 * @file Textarea.tsx
 * @description Enterprise-grade multi-line input aligned with the Ethereal design system.
 * @module shared/ui/primitives/Textarea
 */

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

const textareaVariants = cva(
  "w-full rounded-control text-sm text-ethereal-ink placeholder:text-ethereal-incense transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
  {
    variants: {
      variant: {
        // Byte-for-byte `Input`'s glass, deliberately: the two primitives sit in
        // the same forms, and a lighter fill under an OUTER shadow next to a
        // marble fill under an INSET one reads as two materials — the same
        // field asked twice in two different products.
        glass:
          "bg-ethereal-marble/90 backdrop-blur-md border border-ethereal-gold/35 shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] focus:bg-ethereal-marble focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/55",
        solid:
          "bg-ethereal-marble border border-hairline-strong shadow-glass-solid focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
        ghost:
          "bg-transparent border border-transparent hover:bg-ethereal-parchment/40 focus:bg-ethereal-marble/80 focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
      },
      // Same recipe as `Input`: the fill stays a tint and the text stays ink,
      // because this is a field being typed into, not a status being reported.
      hasError: {
        true: "border-ethereal-crimson bg-ethereal-crimson/5 focus:border-ethereal-crimson focus:ring-ethereal-crimson/20 placeholder:text-ethereal-crimson/70",
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
          <Text
            as="span"
            id={errorId}
            role="alert"
            size="xs"
            color="crimson"
            className="ml-1 font-medium"
          >
            {error}
          </Text>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
