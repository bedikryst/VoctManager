/**
 * @file CommitText.tsx
 * @description A typed property that retains its draft until its commit succeeds.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { fieldShellVariants } from "@/shared/ui/primitives/fieldShell";
import { Text } from "@/shared/ui/primitives/typography";

interface CommitTextProps {
  readonly id: string;
  readonly value: string;
  readonly onCommit: (value: string) => Promise<void> | string;
  readonly multiline?: boolean;
  readonly inputMode?: "numeric" | "text";
}

export const CommitText = ({
  id, value, onCommit, multiline = false, inputMode,
}: CommitTextProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const revision = useRef(0);
  const submitted = useRef<number | undefined>(undefined);
  const displayed = draft ?? value;
  const errorId = `${id}-error`;

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
        setError(t("archive.piece_card.field_save_failed"));
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && draft !== null) {
      event.stopPropagation();
      revision.current += 1;
      setDraft(null);
      setError(undefined);
    }
    if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
    }
  };

  const controlProps = {
    id,
    value: displayed,
    placeholder: "—",
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onBlur: commit,
    onKeyDown,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      revision.current += 1;
      setDraft(event.target.value);
      setError(undefined);
    },
    className: cn(
      fieldShellVariants({ variant: "property", hasError: Boolean(error) }),
      PROPERTY_CONTROL_CLASS,
    ),
  };
  const textBlockClass = "col-start-1 row-start-1 whitespace-pre-wrap wrap-anywhere leading-relaxed";

  return (
    <>
      {multiline ? (
        <div className="grid">
          {/* The mirror supplies the height even on browsers without field-sizing. */}
          <div
            aria-hidden="true"
            className={cn(PROPERTY_CONTROL_CLASS, textBlockClass, "invisible border")}
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
    </>
  );
};
