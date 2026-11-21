/**
 * @file CommitText.tsx
 * @description A typed property that retains its draft until its commit succeeds.
 * `multiline` is a growing text block where Enter starts a new line and
 * Ctrl+Enter commits. `wraps` is a one-line value that wraps instead of being
 * clipped: it grows like the block, but Enter commits and a pasted line break
 * becomes a space.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { fieldShellVariants } from "@/shared/ui/primitives/fieldShell";
import { Text } from "@/shared/ui/primitives/typography";
import type { DraftField } from "./usePieceAutosave";

interface CommitTextProps {
  readonly id: string;
  readonly value: string;
  readonly draftField: DraftField;
  readonly onCommit: (value: string) => Promise<void> | string;
  readonly multiline?: boolean;
  readonly wraps?: boolean;
  readonly inputMode?: "numeric" | "text" | "url";
  readonly className?: string;
  readonly readOnly?: boolean;
  readonly ariaLabel?: string;
}

export const CommitText = ({
  id, value, draftField, onCommit, multiline = false, wraps = false, inputMode, className, readOnly, ariaLabel,
}: CommitTextProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const revision = useRef(0);
  const submitted = useRef<number | undefined>(undefined);
  const displayed = draft ?? value;
  const errorId = `${id}-error`;
  const { key, label, setDraft: reportDraft } = draftField;

  useEffect(() => () => reportDraft(key, null), [key, reportDraft]);

  const discard = () => {
    revision.current += 1;
    setDraft(null);
    setError(undefined);
    reportDraft(key, null);
  };

  const commit = () => {
    if (draft === null || submitted.current === revision.current) return;
    const next = draft.trim();
    const result = onCommit(next);
    if (typeof result === "string") {
      setError(result);
      return;
    }

    setError(undefined);
    const currentRevision = revision.current;
    submitted.current = currentRevision;
    void result.then(
      () => {
        if (revision.current === currentRevision) setDraft(null);
      },
      () => {
        if (revision.current !== currentRevision) return;
        submitted.current = undefined;
        setError(multiline
          ? t("archive.piece_card.text_save_failed")
          : t("archive.piece_card.field_save_failed"));
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && draft !== null) {
      event.stopPropagation();
      discard();
    }
    if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
    }
  };

  const controlProps = {
    id,
    value: displayed,
    readOnly,
    placeholder: "—",
    "aria-label": ariaLabel,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onBlur: commit,
    onKeyDown,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      revision.current += 1;
      setDraft(wraps ? event.target.value.replace(/\r?\n/g, " ") : event.target.value);
      setError(undefined);
      reportDraft(key, { id, label, discard });
    },
    className: cn(
      fieldShellVariants({ variant: "property", hasError: Boolean(error) }),
      PROPERTY_CONTROL_CLASS,
      className,
    ),
  };
  // A wrapping value keeps a one-line row's height (24 px line, 6 px padding).
  const textBlockClass = cn(
    "col-start-1 row-start-1 whitespace-pre-wrap wrap-anywhere",
    wraps ? "leading-6" : "leading-relaxed",
  );

  return (
    <div className="min-w-0" data-commit-draft={draft === null ? undefined : ""}>
      {multiline || wraps ? (
        <div className="grid">
          {/* The mirror supplies the height even on browsers without field-sizing. */}
          <div
            aria-hidden="true"
            className={cn(PROPERTY_CONTROL_CLASS, className, textBlockClass, "invisible border")}
          >
            {`${displayed}\u00a0`}
          </div>
          <textarea
            {...controlProps}
            rows={1}
            className={cn(controlProps.className, textBlockClass, "resize-none overflow-hidden")}
          />
        </div>
      ) : (
        <input {...controlProps} type="text" inputMode={inputMode} />
      )}
      {error && (
        <Text id={errorId} as="p" role="alert" size="sm" color="crimson" className="px-2 pb-1">
          {error}
        </Text>
      )}
    </div>
  );
};
