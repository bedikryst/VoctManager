/**
 * @file Select.tsx
 * @description The panel's select field: an Ethereal trigger over a real,
 * portalled listbox (`@radix-ui/react-select`). The popup is ours, not the
 * operating system's — which is the whole point, since an OS-drawn dropdown was
 * the one place the design language stopped at the component boundary.
 * The content skin is deliberately identical to `DropdownMenu` so the two
 * popovers read as one material.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/Select
 */

import React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { fieldShellVariants } from "@/shared/ui/primitives/fieldShell";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

/**
 * Radix reserves the empty string for "nothing selected", so an item may not
 * carry it. The explicit clear entry rides on a sentinel that is translated
 * back to "" before it ever reaches the caller.
 */
const CLEAR_VALUE = "__select_clear__";

/** Layout and placeholder colour; the surface itself comes from `fieldShell`. */
const TRIGGER_LAYOUT =
  "relative flex items-center justify-between gap-2 data-placeholder:text-ethereal-incense";

/**
 * `sm` is for a control packed into a dense strip — a dock, a toolbar row —
 * where a full field would set the height of everything around it. It is a
 * density, not a hierarchy: nothing about the field means less.
 */
const TRIGGER_SIZE = {
  default: "py-3",
  sm: "py-1.5 text-xs",
} as const;

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  /**
   * Semantic emphasis carried by the item itself — a piece whose casting is
   * short, a slot already complete. Crimson stays alarm-only here as everywhere.
   */
  readonly tone?: "default" | "sage" | "crimson";
}

export interface SelectProps extends VariantProps<typeof fieldShellVariants> {
  readonly options: readonly SelectOption[];
  /** `""` means nothing is selected — the placeholder shows instead. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly label?: string;
  readonly error?: string;
  readonly placeholder?: string;
  readonly leftIcon?: React.ReactNode;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly name?: string;
  readonly id?: string;
  readonly ariaLabel?: string;
  /**
   * Adds an explicit entry that returns the field to "nothing selected". Only
   * for fields where clearing is a real choice — where it is not, a placeholder
   * alone says the same thing without offering an action that means nothing.
   */
  readonly clearLabel?: string;
  /** Vertical density. `sm` for dense strips; see `TRIGGER_SIZE`. */
  readonly size?: keyof typeof TRIGGER_SIZE;
  readonly className?: string;
}

export const Select = ({
  options,
  value,
  onValueChange,
  label,
  error,
  placeholder,
  leftIcon,
  variant,
  disabled,
  required,
  name,
  id,
  ariaLabel,
  clearLabel,
  size = "default",
  className,
}: SelectProps): React.JSX.Element => {
  const internalId = React.useId();
  const selectId = id || internalId;
  const errorId = `${selectId}-error`;
  const hasError = Boolean(error);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <Eyebrow as="label" htmlFor={selectId} color="muted" className="ml-1">
          {label}
        </Eyebrow>
      )}

      <RadixSelect.Root
        // Controlled for the component's whole life, `""` included — Radix reads
        // `""` as "nothing selected" perfectly well. Handing it `undefined`
        // instead made the field flip uncontrolled→controlled the moment a value
        // arrived, and that flip is not cosmetic: Radix answers it by writing the
        // new value into its hidden native <select> and dispatching a `change`.
        // The <option> list is registered one render later, so the assignment
        // finds nothing to match, the event carries `""` — and the field wipes
        // itself, silently, before anyone has touched it.
        value={value}
        onValueChange={(next) => {
          // Same hidden <select>, same failure mode, defended at the exit: an
          // item can never carry `""` (Radix forbids it, and our own clear entry
          // rides a sentinel), so an empty string here never came from a person.
          if (next === "") return;
          onValueChange(next === CLEAR_VALUE ? "" : next);
        }}
        disabled={disabled}
        required={required}
        name={name}
      >
        <RadixSelect.Trigger
          id={selectId}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            fieldShellVariants({ variant, hasError }),
            TRIGGER_LAYOUT,
            TRIGGER_SIZE[size],
            // The icon is hidden on phones, so its inset is only reserved from
            // sm up — same contract as `Input`.
            leftIcon ? "pl-4 sm:pl-11" : "pl-4",
            "pr-4",
            className,
          )}
        >
          {leftIcon && (
            <span
              className="pointer-events-none absolute left-4 hidden text-ethereal-graphite/55 sm:flex"
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
            </span>
          )}

          <span className="min-w-0 flex-1 truncate text-left">
            <RadixSelect.Value placeholder={placeholder} />
          </span>

          <RadixSelect.Icon asChild>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              className={cn(
                "shrink-0",
                // Graphite disappears into the island; the dark field takes the
                // ink of the island itself, which holds through the theme swap.
                variant === "dark"
                  ? "text-ink-on-inverse/60"
                  : "text-ethereal-graphite/60",
              )}
              aria-hidden="true"
            />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={8}
            className={cn(
              "z-popover max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-nested border border-ethereal-incense/15 bg-ethereal-alabaster/95 p-1.5 shadow-glass-ethereal backdrop-blur-ethereal",
              "popover-motion",
            )}
          >
            <RadixSelect.ScrollUpButton className="flex h-5 items-center justify-center text-ethereal-graphite/60">
              <ChevronUp size={14} aria-hidden="true" />
            </RadixSelect.ScrollUpButton>

            <RadixSelect.Viewport className="max-h-72">
              {clearLabel && (
                <SelectItem value={CLEAR_VALUE} label={clearLabel} muted />
              )}
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  tone={option.tone}
                />
              ))}
            </RadixSelect.Viewport>

            <RadixSelect.ScrollDownButton className="flex h-5 items-center justify-center text-ethereal-graphite/60">
              <ChevronDown size={14} aria-hidden="true" />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

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

interface SelectItemProps {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly tone?: SelectOption["tone"];
  readonly muted?: boolean;
}

const ITEM_TONE: Record<NonNullable<SelectOption["tone"]>, string> = {
  default: "text-ethereal-graphite",
  sage: "font-bold text-ethereal-sage",
  crimson: "font-bold text-ethereal-crimson",
};

const SelectItem = ({
  value,
  label,
  disabled,
  tone = "default",
  muted,
}: SelectItemProps): React.JSX.Element => (
  <RadixSelect.Item
    value={value}
    disabled={disabled}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2 outline-none transition-colors",
      "data-highlighted:bg-ethereal-marble/70 data-highlighted:text-ethereal-ink",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      muted ? "text-ethereal-graphite/70 italic" : ITEM_TONE[tone],
    )}
  >
    <RadixSelect.ItemText asChild>
      <Text as="span" size="sm" weight="medium" color="inherit" truncate className="flex-1">
        {label}
      </Text>
    </RadixSelect.ItemText>
    <RadixSelect.ItemIndicator className="shrink-0 text-ethereal-gold">
      <Check size={14} aria-hidden="true" />
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
);
