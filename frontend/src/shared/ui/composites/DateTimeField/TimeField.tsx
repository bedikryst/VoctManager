/**
 * @file TimeField.tsx
 * @description A clock on its own, for rows that already know their day — the
 * run sheet, where every point belongs to the concert date above it. No popup:
 * at this size the two segments ARE the control, and opening a panel to set a
 * quarter past would cost more than typing it.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DateTimeField
 */

import React, { useId } from "react";

import { cn } from "@/shared/lib/utils";
import {
  FIELD_SHELL_FOCUS_WITHIN,
  fieldShellVariants,
  type FieldShellVariantProps,
} from "@/shared/ui/primitives/fieldShell";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { TimeSegments } from "./TimeSegments";

export interface TimeFieldProps
  extends Omit<FieldShellVariantProps, "hasError"> {
  /** `HH:mm`, or `""` when nothing is set yet. */
  readonly value: string;
  readonly onChange: (next: string) => void;
  /** Fires when focus leaves the control — the moment a list may re-sort. */
  readonly onBlur?: () => void;
  readonly label?: string;
  readonly ariaLabel?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** The clock a first keystroke starts from on an empty field. */
  readonly fallback?: string;
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
}

export const TimeField = ({
  value,
  onChange,
  onBlur,
  label,
  ariaLabel,
  error,
  required,
  disabled,
  fallback,
  id,
  name,
  variant,
  className,
}: TimeFieldProps): React.JSX.Element => {
  const internalId = useId();
  const fieldId = id ?? internalId;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  return (
    <div
      className="flex w-full flex-col gap-1.5"
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {label && (
        <Eyebrow as="label" htmlFor={fieldId} color="muted" className="ml-1">
          {label}
        </Eyebrow>
      )}

      <div
        className={cn(
          fieldShellVariants({ variant, hasError }),
          FIELD_SHELL_FOCUS_WITHIN,
          "relative flex items-center justify-center px-3 py-3",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <TimeSegments
          hoursId={fieldId}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          fallback={fallback}
        />

        {/* Same mirror-input contract as `DateTimeField` — see its note. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            name={name}
            required
            value={value}
            onChange={() => undefined}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        )}
      </div>

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
};
