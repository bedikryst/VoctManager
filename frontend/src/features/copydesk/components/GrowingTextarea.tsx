/**
 * @file GrowingTextarea.tsx
 * @description The desk's text field: a `<textarea>` that is exactly as tall as
 * what it holds, at rest and while it is typed into.
 *
 * Its height comes from a mirror span sharing one CSS grid cell — same type,
 * same padding, same wrapping, plus a trailing U+200B so a final newline does
 * not collapse — rather than from `scrollHeight`. No layout is forced, so a
 * page of seventy fields costs no measurement pass and opening the three
 * language columns does not run two hundred of them.
 *
 * It is one component because both surfaces of the desk type into it: the
 * editor's cell, and the reviewer correcting a wording before accepting it. The
 * type and padding are declared here and nowhere else, because the field and
 * its mirror have to be the same shape or the box is the wrong height — a pair
 * that only agrees by two call sites remembering to pass the same string is a
 * pair that will one day not.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/GrowingTextarea
 */

import React, { useEffect, useRef } from "react";

import { cn } from "@/shared/lib/utils";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";

/**
 * Written as one literal on both elements: a size class in one place and a
 * leading class in another is exactly the pair `tailwind-merge` reorders.
 * Exported so anything printing the same text OUTSIDE a field — the reviewer's
 * diff — sets it identically and the two do not jump when one replaces the other.
 */
export const GROWING_TEXT = `${FIELD_TEXT_SCALE.sm} leading-relaxed`;
export const GROWING_PADDING = "px-2.5 py-1.5";

/**
 * A zero-width space, appended to the MIRROR only. Without it a value ending
 * in a newline measures one line short, and the box stops growing exactly when
 * the caret moves to the line it should have made room for. Built from its code
 * point rather than typed: an invisible character in source is a character the
 * next editor deletes by accident and nobody sees leave.
 */
const CARET_GUARD = String.fromCharCode(0x200b);

interface GrowingTextareaProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly ariaLabel: string;
  /** Language of the CONTENT, for spellcheck and hyphenation. */
  readonly lang?: string;
  /** Tone only — a fill or a ring. Anything affecting metrics belongs above. */
  readonly className?: string;
  /** Take the caret on mount: for a field the reader opened deliberately. */
  readonly focusOnMount?: boolean;
}

export const GrowingTextarea = ({
  value,
  onValueChange,
  onBlur,
  ariaLabel,
  lang,
  className,
  focusOnMount = false,
}: GrowingTextareaProps): React.JSX.Element => {
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusOnMount) return;
    const element = field.current;
    if (!element) return;
    element.focus();
    // The caret lands at the end rather than at the start: the reviewer opened
    // this to adjust a sentence, not to type in front of it.
    element.setSelectionRange(element.value.length, element.value.length);
  }, [focusOnMount]);

  return (
    <div className="grid">
      <span
        aria-hidden="true"
        className={cn(
          "invisible col-start-1 row-start-1 whitespace-pre-wrap wrap-break-word",
          GROWING_TEXT,
          GROWING_PADDING,
        )}
      >
        {`${value}${CARET_GUARD}`}
      </span>
      <textarea
        ref={field}
        value={value}
        rows={1}
        spellCheck
        lang={lang}
        aria-label={ariaLabel}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
        className={cn(
          fieldShellVariants({ variant: "ghost" }),
          // The shell transitions ALL properties, and this field's height is the
          // grid row's: every new line would then animate for 300 ms behind the
          // caret that made it. Colour is what the transition was for.
          "col-start-1 row-start-1 resize-none overflow-hidden transition-colors",
          GROWING_TEXT,
          GROWING_PADDING,
          className,
        )}
      />
    </div>
  );
};
