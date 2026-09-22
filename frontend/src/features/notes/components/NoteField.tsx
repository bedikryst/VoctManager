/**
 * @file NoteField.tsx
 * @description The scratchpad's one text engine, in two surfaces. The composer
 * at the top of the panel is `boxed`: it wears the field shell itself. The
 * editor inside an expanded row is `bare`: text and nothing else, because the
 * ROW is its shell — a note is rewritten in the very place it was read, and
 * neither the box nor a single glyph moves on the way into the editor.
 *
 * It is exactly as tall as what it holds, at rest and while it is typed into.
 * The height comes from a mirror span sharing one CSS grid cell with the
 * textarea — same type, same padding, same border, same wrapping, plus a
 * trailing zero-width space so a final newline does not collapse — rather than
 * from `scrollHeight`, which forces a layout pass per keystroke. (`copydesk`
 * grows its desk field the same way. The two are separate because each declares
 * its own type and box, and it is that pair, field against mirror, that must
 * not drift: a mirror even 2px shorter than the textarea leaves every line
 * scrolled by those 2px, and the scrollbar that then appears narrows the text
 * and wraps it onto one more line than the mirror counted.)
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
 * How the body wraps, everywhere it is set. A textarea breaks an unbroken run —
 * a pasted link — at the edge; a paragraph lets it overflow. Reading and
 * editing must break the same way, or opening the editor re-flows the note.
 */
export const NOTE_WRAP = "whitespace-pre-wrap wrap-break-word";

/**
 * A zero-width space, appended to the MIRROR only. Without it a value ending in
 * a newline measures one line short and the box stops growing exactly when the
 * caret moves to the line it should have made room for. Built from its code
 * point rather than typed: an invisible character in source is one the next
 * editor deletes by accident and nobody sees leave.
 */
const CARET_GUARD = String.fromCharCode(0x200b);

/**
 * Where the COMPOSER stops growing and starts scrolling — about eight lines. It
 * sits above the list, and a pasted wall of text must not push the notes off
 * the panel. The row editor has no cap: the list around it scrolls, and a cap
 * would make a note shorter to edit than it was to read. The cap sits on the
 * MIRROR: capping the textarea would leave the grid row tall and the box
 * floating inside it.
 */
const COMPOSER_MAX_HEIGHT = "max-h-40";

/** The inset the text sits at, per surface, applied to the textarea and the mirror alike. */
const PADDING = {
  boxed: "py-2.5 pr-4 pl-4",
  boxedWithIcon: "py-2.5 pr-4 pl-4 sm:pl-10",
  bare: "",
} as const;

/**
 * The boxed mirror's stand-in for the shell's hairline. That border is part of
 * the textarea's height (`border-box`), so a mirror without one measures every
 * value 2px short. Mirror only: on the textarea, `border-transparent` would
 * out-merge the shell's gold.
 */
const MIRROR_SHELL_BORDER = "border border-transparent";

export interface NoteFieldProps {
  readonly value: string;
  readonly onValueChange: (next: string) => void;
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly hasError?: boolean;
  /**
   * `boxed` wears the field shell (the composer). `bare` is text only, for a
   * caller that draws the shell around it (the row editor).
   */
  readonly surface?: "boxed" | "bare";
  /** Boxed only — sits in the field's left inset, from `sm:` up. */
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
      surface = "boxed",
      leftIcon,
    },
    ref,
  ): React.JSX.Element => {
    const isBoxed = surface === "boxed";
    const showIcon = isBoxed && leftIcon !== undefined;
    // The icon inset only exists from `sm:`, where the icon itself does — on a
    // phone that padding would be a dead margin on the narrowest field in the
    // app.
    const padding = !isBoxed
      ? PADDING.bare
      : showIcon
        ? PADDING.boxedWithIcon
        : PADDING.boxed;

    return (
      <div className="relative grid">
        {showIcon && (
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
            "invisible col-start-1 row-start-1 overflow-hidden",
            NOTE_WRAP,
            isBoxed && cn(COMPOSER_MAX_HEIGHT, MIRROR_SHELL_BORDER),
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
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn(
            isBoxed
              ? cn(
                  fieldShellVariants({ variant: "glass", hasError }),
                  // The shell transitions ALL properties and this field's
                  // height is its grid row's, so every new line would animate
                  // for 300ms behind the caret that made it. Colour is what the
                  // transition was for.
                  "overflow-y-auto transition-colors",
                )
              : // Preflight already strips the control to nothing — no border,
                // no padding, transparent fill. What is left to say is the ink
                // and that the caller's shell, not this element, shows focus.
                "overflow-hidden text-ethereal-ink outline-none",
            "col-start-1 row-start-1 resize-none",
            NOTE_WRAP,
            NOTE_TEXT,
            padding,
          )}
        />
      </div>
    );
  },
);

NoteField.displayName = "NoteField";
