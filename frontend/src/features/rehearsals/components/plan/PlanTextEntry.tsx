/**
 * @file PlanTextEntry.tsx
 * @description "Wpisz listą": the plan typed as the text conductors already
 * write, one point per line, and read into rows by `lib/planText`. The
 * preview under the field is live and marks what every line became — the
 * programme piece it matched or a new point, a break, the clock, the minutes
 * and the note — so nothing lands in the plan that the conductor has not
 * seen. A line left with nothing to name it by is shown struck through and
 * skipped. The rows go in above the reserve, in the typed order; the draft
 * stays unsaved until the editor's own save.
 *
 * Opens empty from the add tray, or filled with the rehearsal's topic when
 * the topic is really a list (the editor's empty state). Ctrl/⌘+Enter adds,
 * Escape closes.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/PlanTextEntry
 */

import React, { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Coffee } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { parsePlanText, type PlanTextPiece, type PlanTextRow } from "../../lib/planText";

interface PlanTextEntryProps {
  readonly initialText?: string;
  readonly program: readonly PlanTextPiece[];
  readonly onInsert: (rows: readonly PlanTextRow[]) => void;
  readonly onCancel: () => void;
  readonly className?: string;
}

export const PlanTextEntry = ({
  initialText = "",
  program,
  onInsert,
  onCancel,
  className,
}: PlanTextEntryProps): React.JSX.Element => {
  const { t } = useTranslation();
  const fieldId = useId();
  const hintId = useId();
  const [text, setText] = useState(initialText);
  const lines = useMemo(() => parsePlanText(text, program), [text, program]);
  const rows = useMemo(
    () => lines.flatMap((line) => (line.row ? [line.row] : [])),
    [lines],
  );

  const insert = (): void => {
    if (rows.length > 0) onInsert(rows);
  };

  return (
    <div className={cn("flex flex-col gap-3 px-5 py-4", className)}>
      <div className="flex flex-col gap-1">
        <Eyebrow as="label" htmlFor={fieldId} color="graphite">
          {t("rehearsals.plan.text.title", "Wpisz plan listą")}
        </Eyebrow>
        <Caption id={hintId} color="muted">
          {t(
            "rehearsals.plan.text.hint",
            "Jeden punkt w wierszu. Godzina (18:30) i minuty (10') są opcjonalne; notatkę dopisz w nawiasie albo po myślniku.",
          )}
        </Caption>
      </div>

      <Textarea
        id={fieldId}
        autoFocus
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            insert();
          } else if (event.key === "Escape") {
            // Marked handled, so the project's sheet around the editor stays
            // open: Escape closes the entry, never the sheet with the lines.
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder={t(
          "rehearsals.plan.text.placeholder",
          "1. Rozśpiewanie 15'\n2. 18:30 Lark (fragm.)\n3. Laudes creaturarum – od t. 40\n4. Przerwa 10'",
        )}
        aria-describedby={hintId}
      />

      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Caption color="muted">
            {t("rehearsals.plan.text.preview", "Tak to trafi do planu")}
          </Caption>
          <ol className="divide-y divide-hairline rounded-nested border border-hairline">
            {lines.map((line, index) => (
              <li
                // The lines have no identity of their own; the order is the key.
                key={index}
                className="flex items-baseline gap-3 px-3 py-1.5"
              >
                {line.row ? (
                  <PreviewRow row={line.row} />
                ) : (
                  <>
                    <Text
                      as="span"
                      size="sm"
                      color="muted"
                      className="min-w-0 flex-1 truncate line-through"
                    >
                      {line.source}
                    </Text>
                    <Caption color="muted" className="shrink-0">
                      {t("rehearsals.plan.text.skipped", "pominięty: brak nazwy")}
                    </Caption>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("common.actions.cancel", "Anuluj")}
        </Button>
        <Button variant="primary" size="sm" onClick={insert} disabled={rows.length === 0}>
          {t("rehearsals.plan.text.insert", "Dodaj {{count}} punktów", { count: rows.length })}
        </Button>
      </div>
    </div>
  );
};

/** One line as the plan will hold it: clock, title and its source, note, minutes. */
const PreviewRow = ({ row }: { row: PlanTextRow }): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <>
      <Text
        as="span"
        size="sm"
        weight="semibold"
        className="w-11 shrink-0 text-right tabular-nums"
      >
        {row.startsAt ?? ""}
      </Text>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          {row.isBreak && (
            <Coffee size={12} className="shrink-0 text-ethereal-graphite/50" aria-hidden="true" />
          )}
          <Text
            as="span"
            size={row.piece !== null ? "md" : "sm"}
            weight={row.isBreak ? "normal" : "medium"}
            color={row.isBreak ? "muted" : "default"}
            className={cn("truncate", row.piece !== null && "font-serif")}
          >
            {row.title}
          </Text>
          {row.piece !== null ? (
            <Caption color="gold" className="inline-flex shrink-0 items-center gap-0.5">
              <Check size={11} aria-hidden="true" />
              {t("rehearsals.plan.text.matched", "z programu")}
            </Caption>
          ) : (
            !row.isBreak && (
              <Caption color="muted" className="shrink-0">
                {t("rehearsals.plan.text.free", "nowy punkt")}
              </Caption>
            )
          )}
        </span>
        {row.note && (
          <Text as="span" size="sm" color="graphite" className="truncate italic">
            {row.note}
          </Text>
        )}
      </span>
      {row.minutes !== null && (
        <Caption color="muted" className="shrink-0 tabular-nums">
          {t("rehearsals.plan.block.length", "{{minutes}} min", { minutes: row.minutes })}
        </Caption>
      )}
    </>
  );
};
