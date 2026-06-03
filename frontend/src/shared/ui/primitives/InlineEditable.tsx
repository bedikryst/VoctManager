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

import { cn } from "@/shared/lib/utils";

type InlineEditableValue = string | number | null;

export interface InlineEditableProps {
  readonly value: InlineEditableValue;
  readonly onSave: (next: string) => Promise<unknown> | void;
  /** Validation hook — return error message string to block save, null to allow. */
  readonly validate?: (next: string) => string | null;
  readonly type?: "text" | "number";
  readonly placeholder?: string;
  readonly ariaLabel: string;
  /** Display variant — adjusts typography and chrome. */
  readonly variant?: "default" | "title" | "subtle";
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
        setError(err instanceof Error ? err.message : "Błąd zapisu");
      } finally {
        setIsSaving(false);
      }
    },
    [exit, onSave, validate, value],
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
        aria-label={`${ariaLabel} (kliknij by edytować)`}
        className={cn(
          "group/edit inline-flex items-baseline gap-1.5 rounded-md py-0.5 text-left transition-colors",
          !disabled && "hover:bg-ethereal-gold/10 hover:text-ethereal-ink cursor-text",
          isEmpty && "text-ethereal-graphite/60 italic",
          variant === "title" && "font-semibold text-base",
          variant === "subtle" && "text-xs text-ethereal-graphite",
          className,
        )}
      >
        <span>{displayText}</span>
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
        className={cn(
          "rounded-md border border-ethereal-gold/40 bg-ethereal-alabaster px-1.5 py-0.5 outline-none transition-colors",
          "focus:border-ethereal-gold focus:ring-1 focus:ring-ethereal-gold/40",
          error && "border-ethereal-crimson/60",
          variant === "title" && "font-semibold text-base",
          variant === "subtle" && "text-xs",
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
        aria-label="Zapisz"
        className="flex h-6 w-6 items-center justify-center rounded-md text-ethereal-sage hover:bg-ethereal-sage/10"
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
        aria-label="Anuluj"
        className="flex h-6 w-6 items-center justify-center rounded-md text-ethereal-graphite hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
      >
        <X size={12} />
      </button>
      {error && (
        <span
          role="alert"
          className="ml-1 text-[10px] font-medium text-ethereal-crimson"
        >
          {error}
        </span>
      )}
    </span>
  );
};
