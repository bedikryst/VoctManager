/**
 * @file Input.tsx
 * @description The single-line field: `fieldShell`'s surface plus this
 * primitive's own layout (label, icon insets, error copy). Optimised for
 * react-hook-form and Zod validation schemas.
 * @module shared/ui/primitives/Input
 */

import React, { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/shared/lib/utils";
import {
  fieldShellVariants,
  type FieldShellVariantProps,
} from "@/shared/ui/primitives/fieldShell";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface InputFieldClassesArgs extends FieldShellVariantProps {
  readonly hasLeftIcon?: boolean;
  readonly hasRightElement?: boolean;
  readonly className?: string;
}

/**
 * The class list the `<input>` element itself wears. Exported so the resolved
 * surface can be asserted against `fieldShell` in a test instead of compared by
 * eye — `cn()` is where a drift would actually show up.
 *
 * `className` is merged LAST, so a caller's layout wins over the primitive's
 * padding (the same contract as `Select`). A padding passed in is a padding
 * applied.
 */
export const inputFieldClasses = ({
  variant,
  hasError,
  hasLeftIcon,
  hasRightElement,
  className,
}: InputFieldClassesArgs): string =>
  cn(
    fieldShellVariants({ variant, hasError }),
    // Icon padding only from sm+, since the icon itself is hidden on phones.
    hasLeftIcon ? "pl-4 sm:pl-10" : "pl-4",
    hasRightElement ? "pr-12" : "pr-4",
    "py-3",
    className,
  );

export interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "variant">,
    FieldShellVariantProps {
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
    {
      label,
      error,
      variant,
      hasError: hasErrorFlag,
      leftIcon,
      rightElement,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const internalId = useId();
    const inputId = id || internalId;
    const errorId = `${inputId}-error`;
    // A caller either hands over the message or just says the field is wrong —
    // a form whose error copy lives beside the field (the auth screens) uses the
    // flag, and it has to tint the field like a message would.
    const hasError = Boolean(error) || Boolean(hasErrorFlag);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <Eyebrow as="label" htmlFor={inputId} color="muted" className="ml-1">
            {label}
          </Eyebrow>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className={cn(
                // Hidden on phones — the icon ate ~24px of an already narrow
                // field and the value clipped; the padding is reclaimed below.
                // z-10: the dark variant's backdrop-blur makes the field a
                // stacking context, and since the icon precedes it in the DOM
                // the field's background would paint OVER it. pointer-events-none
                // keeps click-to-focus.
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
            aria-describedby={error ? errorId : undefined}
            className={inputFieldClasses({
              variant,
              hasError,
              hasLeftIcon: Boolean(leftIcon),
              hasRightElement: Boolean(rightElement),
              className,
            })}
            {...props}
          />

          {rightElement && (
            <Eyebrow
              as="div"
              size="overline-sm"
              className="absolute right-6 flex items-center justify-center"
              aria-hidden="true"
            >
              {rightElement}
            </Eyebrow>
          )}
        </div>

        {error && (
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

Input.displayName = "Input";
