/**
 * @file Textarea.tsx
 * @description The multi-line field: `fieldShell`'s surface plus this
 * primitive's own layout (label, padding, resize handle, error copy). It sits
 * in the same forms as `Input`, and draws from the same shell so the two cannot
 * read as two materials.
 * @module shared/ui/primitives/Textarea
 */

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";
import {
  fieldShellVariants,
  type FieldShellVariantProps,
} from "@/shared/ui/primitives/fieldShell";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface TextareaFieldClassesArgs extends FieldShellVariantProps {
  readonly className?: string;
}

/**
 * The class list the `<textarea>` element itself wears — see
 * `inputFieldClasses` for why this is exported and why `className` merges last.
 */
export const textareaFieldClasses = ({
  variant,
  hasError,
  className,
}: TextareaFieldClassesArgs): string =>
  cn(fieldShellVariants({ variant, hasError }), "resize-y px-4 py-3", className);

export interface TextareaProps
  extends
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "variant">,
    FieldShellVariantProps {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, variant, hasError: hasErrorFlag, className, id, ...props },
    ref,
  ) => {
    const internalId = useId();
    const textareaId = id || internalId;
    const errorId = `${textareaId}-error`;
    const hasError = Boolean(error) || Boolean(hasErrorFlag);

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
          aria-describedby={error ? errorId : undefined}
          className={textareaFieldClasses({ variant, hasError, className })}
          {...props}
        />

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

Textarea.displayName = "Textarea";
