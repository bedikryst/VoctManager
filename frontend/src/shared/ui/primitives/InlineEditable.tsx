/**
 * @file InlineEditable.tsx
 * @description Inline-editable text/number primitive. Renders as display
 * text with a pencil icon on hover; clicking either the text or the
 * pencil swaps to an input. Enter saves, Escape cancels, blur saves by
 * default. Caller owns the persistence (`onSave` returns Promise).
 *
 * Designed for fast quick-fix interactions where opening a full editor
 * would be excessive — fixing a typo in a piece title, bumping the
 * composition year, etc.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/InlineEditable
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";
import { Caption, Text } from "@/shared/ui/primitives/typography";

type InlineEditableValue = string | number | null;

export type InlineEditableVariant = "default" | "title" | "subtle" | "display";

/**
 * Typography the inner `Text` has to carry on its own element.
 *
 * `Text` writes `font-sans` and `font-normal` onto the span it renders, and a
 * declaration on the span beats anything inherited from the button around it.
 * So family and weight cannot travel in the button's class list the way size
 * and colour do — a `font-serif`/`font-semibold` there resolves to nothing at
 * all, with no build or lint error to show for it. They go through props here
 * instead, and `InlineEditable.test.ts` holds that shut.
 */
export const inlineEditableTextProps = (
  variant: InlineEditableVariant,
): { weight?: "semibold"; className?: string } => {
  switch (variant) {
    case "display":
      return { weight: "semibold", className: "font-serif" };
    case "title":
      return { weight: "semibold" };
    default:
      return {};
  }
};

export interface InlineEditableProps {
  readonly value: InlineEditableValue;
  readonly onSave: (next: string) => Promise<unknown> | void;
  /** Validation hook — return error message string to block save, null to allow. */
  readonly validate?: (next: string) => string | null;
  readonly type?: "text" | "number";
  readonly placeholder?: string;
  readonly ariaLabel: string;
  /**
   * Display variant — adjusts typography and chrome. `display` is `title` in the
   * serif: for a row whose subject is a named work or event, so the list sets it
   * in the same voice the detail view's `Heading` does. A person's name is not
   * one of those — people stay in the sans, in every view.
   *
   * Its much larger step is not decoration. Cormorant's x-height is 0.386em
   * against the sans's 0.546, so `text-2xl` here lands at roughly the optical
   * size of 17px of sans — a step above the `title` variant's 16px, not three.
   * Any smaller and the name reads smaller than the metadata beneath it.
   */
  readonly variant?: InlineEditableVariant;
  readonly disabled?: boolean;
  /** When true, the empty input shows the placeholder dimmed instead of "—". */
  readonly emptyDisplay?: string;
  readonly className?: string;
}

export const InlineEditable = ({
  value,
  onSave,
  validate,
  type = "text",
  placeholder,
  ariaLabel,
  variant = "default",
  disabled = false,
  emptyDisplay,
  className,
}: InlineEditableProps): React.JSX.Element => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isEditing) {
      setDraft(value == null ? "" : String(value));
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const exit = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setDraft(value == null ? "" : String(value));
    exit();
  }, [value, exit]);

  const commit = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      const original = value == null ? "" : String(value);
      if (trimmed === original) {
        exit();
        return;
      }
      if (validate) {
        const errorMessage = validate(trimmed);
        if (errorMessage !== null) {
          setError(errorMessage);
          return;
        }
      }
      setError(null);
      setIsSaving(true);
      try {
        await onSave(trimmed);
        exit();
      } catch (err) {
        // `err.message` on a rejected request is the transport's own sentence
        // ("Request failed with status code 400"), in the transport's own
        // language. The toolkit picks the words; a raw message is always
        // truthy, so passing it through is how a fallback key goes unreachable.
        setError(resolveErrorCopy(parseApiError(err), t).detail);
      } finally {
        setIsSaving(false);
      }
    },
    [exit, onSave, t, validate, value],
  );

  const displayText = value == null || value === "" ? emptyDisplay ?? "—" : String(value);
  const isEmpty = value == null || value === "";

  if (!isEditing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setIsEditing(true);
        }}
        aria-label={t("common.inline_edit.open", {
          defaultValue: "{{label}} (kliknij, aby edytować)",
          label: ariaLabel,
        })}
        className={cn(
          "group/edit inline-flex items-baseline gap-1.5 rounded-chip py-0.5 text-left transition-colors",
          !disabled && "hover:bg-ethereal-gold/10 hover:text-ethereal-ink cursor-text",
          isEmpty && "text-ethereal-graphite/60 italic",
          variant === "title" && "text-base",
          variant === "display" && "text-2xl tracking-tight",
          variant === "subtle" && "text-xs text-ethereal-graphite",
          className,
        )}
      >
        {/* `size`/`color` stay unset: the wrapping button owns them through the
            `variant` axis, so the label reads at whatever scale it sits in.
            Family and weight cannot travel that way — see
            `inlineEditableTextProps`. */}
        <Text as="span" size={null} color="inherit" {...inlineEditableTextProps(variant)}>
          {displayText}
        </Text>
        <Pencil
          size={11}
          aria-hidden="true"
          className="shrink-0 opacity-0 transition-opacity group-hover/edit:opacity-60"
        />
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(draft);
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        onBlur={(event) => {
          const next = event.relatedTarget as HTMLElement | null;
          if (next?.dataset.inlineEditAction) return;
          void commit(draft);
        }}
        disabled={isSaving}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        // The surface comes from the shell like every other field in the
        // product (D4) — this was the last hand-rolled copy of the gold
        // hairline and the focus ring, and it had drifted to a 1px ring on a
        // chip radius. Only layout and the local type scale are added here.
        className={cn(
          fieldShellVariants({ variant: "glass", hasError: Boolean(error) }),
          "w-auto rounded-chip px-1.5 py-0.5",
          variant === "title" && "font-semibold text-base",
          variant === "display" && "font-serif font-semibold text-2xl tracking-tight",
          variant === "subtle" && FIELD_TEXT_SCALE.xs,
          className,
        )}
        style={{ width: `${Math.max(draft.length + 2, 8)}ch` }}
      />
      <button
        type="button"
        data-inline-edit-action="save"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => void commit(draft)}
        disabled={isSaving}
        aria-label={t("common.actions.save")}
        className="flex h-6 w-6 items-center justify-center rounded-chip text-ethereal-sage hover:bg-ethereal-sage/10"
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Check size={12} />
        )}
      </button>
      <button
        type="button"
        data-inline-edit-action="cancel"
        onMouseDown={(event) => event.preventDefault()}
        onClick={cancel}
        disabled={isSaving}
        aria-label={t("common.actions.cancel")}
        // Discarding a draft is not destruction — the alarm colour belongs to
        // the one thing on the screen that is actually wrong, which here is the
        // validation message below.
        className="flex h-6 w-6 items-center justify-center rounded-chip text-ethereal-graphite hover:bg-ethereal-incense/10 hover:text-ethereal-ink"
      >
        <X size={12} />
      </button>
      {error && (
        <Caption role="alert" color="crimson" className="ml-1 font-medium">
          {error}
        </Caption>
      )}
    </span>
  );
};
