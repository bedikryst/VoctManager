/**
 * @file Checkbox.tsx
 * @description Themed checkbox primitive. Wraps a visually-hidden native
 * `<input type="checkbox">` (for keyboard + a11y) with a custom visual box
 * that follows Ethereal tokens — gold accent on checked, marble outline
 * on unchecked. Pointer cursor by default; supports indeterminate state.
 *
 * Use this anywhere bulk-select or boolean form fields are needed in the
 * panel UI. Native checkboxes render OS-default white squares that break
 * the design system.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/Checkbox
 */

import React, { forwardRef, useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type Size = "sm" | "md";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Use `indeterminate` to render a `−` marker (e.g. partial parent selection). */
  readonly indeterminate?: boolean;
  readonly size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-4 w-4 rounded",
  md: "h-5 w-5 rounded-md",
};

const iconSize: Record<Size, number> = {
  sm: 11,
  md: 13,
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      indeterminate = false,
      disabled = false,
      size = "sm",
      className,
      onChange,
      ...inputProps
    },
    forwardedRef,
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);

    // Native indeterminate state can only be set via JS, not HTML attribute.
    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const setRef = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef)
        (
          forwardedRef as React.MutableRefObject<HTMLInputElement | null>
        ).current = node;
    };

    const isChecked = Boolean(checked) || indeterminate;

    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center transition-colors",
          sizeClasses[size],
          disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer",
          isChecked
            ? "border-2 border-ethereal-gold bg-ethereal-gold text-white shadow-sm"
            : "border border-ethereal-incense/45 bg-ethereal-alabaster hover:border-ethereal-gold/50 hover:bg-ethereal-gold/5",
          className,
        )}
      >
        <input
          ref={setRef}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={onChange}
          className="absolute inset-0 cursor-inherit appearance-none opacity-0 focus-visible:outline-none"
          {...inputProps}
        />
        {indeterminate ? (
          <Minus
            size={iconSize[size]}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none"
          />
        ) : isChecked ? (
          <Check
            size={iconSize[size]}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none"
          />
        ) : null}
        {/* Focus ring rendered via sibling so it tracks input focus, not the wrapper hover */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -inset-1 rounded-[10px] ring-2 ring-ethereal-gold/40 ring-offset-1 opacity-0 transition-opacity",
            "peer-focus-visible:opacity-100",
          )}
        />
      </span>
    );
  },
);
