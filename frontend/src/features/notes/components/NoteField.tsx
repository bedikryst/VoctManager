/**
 * @file NoteField.tsx
 * @description The scratchpad's one text field. The composer at the top of the
 * panel and the editor inside an expanded row are the same control, so a note
 * is written and rewritten in the same box, at the same size.
 *
 * It is exactly as tall as what it holds, at rest and while it is typed into.
 * The height comes from a mirror span sharing one CSS grid cell with the
 * textarea — same type, same padding, same wrapping, plus a trailing
 * zero-width space so a final newline does not collapse — rather than from
 * `scrollHeight`, which forces a layout pass per keystroke. (`copydesk` grows
 * its desk field the same way. The two are separate because each declares its
 * own type and padding, and it is that pair, field against mirror, that must
 * not drift.)
 *
 * `NOTE_TEXT` is the scale, and it is deliberately the FIELD's scale rather
 * than the body scale: reading size is writing size here, or every edit starts
 * with the text resizing under the caret. It cannot go below 16px on a touch
 * device — iOS magnifies the whole app the instant focus lands in a smaller
 * field and a standalone PWA never zooms back out (see `FIELD_TEXT_SCALE`), so
 * the compact step returns only behind `fine-pointer`.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { forwardRef } from "react";

import { cn } from "@/shared/lib/utils";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";

/**
 * One literal, worn by the field, by its mirror and by the row that prints the
 * same text outside a field: a size class in one place and a leading class in
 * another is exactly the pair `tailwind-merge` reorders.
 */
export const NOTE_TEXT = `${FIELD_TEXT_SCALE.sm} leading-snug`;

/**
 * A zero-width space, appended to the MIRROR only. Without it a value ending in
 * a newline measures one line short and the box stops growing exactly when the
 * caret moves to the line it should have made room for. Built from its code
 * point rather than typed: an invisible character in source is one the next
 * editor deletes by accident and nobody sees leave.
 */
const CARET_GUARD = String.fromCharCode(0x200b);

/**
 * Where growth stops and the field starts scrolling instead — about eight lines
 * in the rail. A pasted wall of text must not push the list it belongs to off
 * the panel. The cap sits on the MIRROR: capping the textarea would leave the
 * grid row tall and the box floating inside it.
 */
const MAX_FIELD_HEIGHT = "max-h-40";

export interface NoteFieldProps {
  readonly value: string;
  readonly onValueChange: (next: string) => void;
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly hasError?: boolean;
  readonly disabled?: boolean;
  /** Composer only — sits in the field's left inset, from `sm:` up. */
  readonly leftIcon?: React.ReactNode;
}

export const NoteField = forwardRef<HTMLTextAreaElement, NoteFieldProps>(
  (
    {
      value,
      onValueChange,
      onKeyDown,
      onBlur,
      placeholder,
      ariaLabel,
      hasError = false,
      disabled = false,
      leftIcon,
    },
    ref,
  ): React.JSX.Element => {
    // Resolved once and applied to both boxes. The icon inset only exists from
    // `sm:`, where the icon itself does — on a phone that padding would be a
    // dead margin on the narrowest field in the app.
    const padding = leftIcon ? "py-2.5 pr-4 pl-4 sm:pl-10" : "px-3 py-2";

    return (
      <div className="relative grid">
        {leftIcon && (
          <div
            className="pointer-events-none absolute left-3 top-2.5 z-10 hidden text-ethereal-graphite/55 sm:block"
            aria-hidden="true"
          >
            {leftIcon}
          </div>
        )}

        <span
          aria-hidden="true"
          className={cn(
            "invisible col-start-1 row-start-1 overflow-hidden whitespace-pre-wrap wrap-break-word",
            MAX_FIELD_HEIGHT,
            NOTE_TEXT,
            padding,
          )}
        >
          {`${value}${CARET_GUARD}`}
        </span>

        <textarea
          ref={ref}
          value={value}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn(
            fieldShellVariants({ variant: "glass", hasError }),
            // The shell transitions ALL properties and this field's height is
            // its grid row's, so every new line would animate for 300ms behind
            // the caret that made it. Colour is what the transition was for.
            "col-start-1 row-start-1 resize-none overflow-y-auto transition-colors",
            NOTE_TEXT,
            padding,
          )}
        />
      </div>
    );
  },
);

NoteField.displayName = "NoteField";
