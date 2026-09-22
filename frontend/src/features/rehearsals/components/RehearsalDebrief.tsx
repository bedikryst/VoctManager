/**
 * @file RehearsalDebrief.tsx
 * @description "Po próbie": the evening handed back by whoever stood in front
 * of the choir, and read by the conductor where the rehearsal lives. It opens
 * with the plan's rows as a checklist, pre-ticked as the plan was meant —
 * "Odznacz, czego nie zrobiliście" — because the plan is what usually
 * happened, and a debrief nobody writes must not read as "nothing was
 * done". Written after the fact and never live (the conductor conducts, the
 * assistant leads; nobody ticks rows mid-rehearsal). Breaks are not in it;
 * the reserve sits under its own rule, unticked. The sentences follow. One block, two faces — an
 * editor when the caller passes the write callbacks and the rehearsal has
 * started, the record otherwise. The author and the time sit under the text
 * on both faces, because "whose words" is the first thing a manager decides
 * on opening it.
 *
 * The editor is a plain textarea with a save button rather than an inline
 * field: a debrief is a paragraph typed on a tablet after the choir has left,
 * not a line corrected in passing, and it wants a visible commit.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalDebrief
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import type { Rehearsal, RehearsalPlanItem } from "@/shared/types";

interface RehearsalDebriefProps {
  rehearsal: Rehearsal;
  /**
   * Saves the text. Present → the block is an editor, once the rehearsal has
   * started; absent → the block shows what was written, and nothing at all
   * when nothing was.
   */
  onSave?: (debrief: string) => Promise<unknown>;
  /**
   * Ticks one plan row off (or back on). Present → the plan's rows are live
   * checkboxes once the rehearsal has started; absent → the ticks are read.
   * Same gate as the debrief on the server: a manager, or the roll-call holder.
   */
  onMarkPlanItem?: (itemId: string, done: boolean) => Promise<unknown>;
}

const DEBRIEF_MAX = 4000;

/**
 * What a checkbox proposes before anyone taps: the server's verdict, else
 * the plan itself — a main row done, a reserve row not. `done` is still null
 * while the evening runs, and the checklist can be opened then.
 */
const proposedDone = (row: RehearsalPlanItem): boolean => row.done ?? !row.is_reserve;

/**
 * The plan's rows as a checklist. A tap answers at once from a local
 * override, which the server's own verdict then replaces when the read model
 * catches up — a tablet after the rehearsal is not the place to wait on a
 * round-trip per row. The record face shows only what the server states.
 */
const PlanChecklist = ({
  rows,
  onMark,
}: {
  rows: readonly RehearsalPlanItem[];
  onMark?: (itemId: string, done: boolean) => Promise<unknown>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Once the server says what a tap said, the override has done its job.
  useEffect(() => {
    setPending((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of rows) {
        const wanted = next[row.id];
        if (wanted !== undefined && wanted === proposedDone(row)) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [rows]);

  const handleToggle = async (row: RehearsalPlanItem, done: boolean): Promise<void> => {
    if (!onMark) return;
    setPending((current) => ({ ...current, [row.id]: done }));
    try {
      await onMark(row.id, done);
    } catch (error) {
      setPending((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.done_error", "Nie udało się odhaczyć punktu."),
      });
    }
  };

  const firstReserve = rows.findIndex((row) => row.is_reserve);

  return (
    <div className="flex flex-col gap-1.5">
      <Caption color="muted">
        {onMark
          ? t("rehearsals.plan.debrief.prompt", "Odznacz, czego nie zrobiliście")
          : t("rehearsals.plan.debrief.done_label", "Przerobione")}
      </Caption>
      <ul className="flex flex-col">
        {rows.map((row, index) => {
          const isDone = onMark
            ? (pending[row.id] ?? proposedDone(row))
            : row.done === true;
          const reserveRule =
            index === firstReserve ? (
              <Eyebrow color="gold" className="mt-2 block px-1">
                {t("rehearsals.plan.reserve.title", "Jeśli starczy czasu")}
              </Eyebrow>
            ) : null;
          const label = (
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              {row.clock && (
                <Text as="span" size="sm" color="muted" className="shrink-0 tabular-nums">
                  {row.clock}
                </Text>
              )}
              <Text
                as="span"
                size={row.piece !== null ? "md" : "base"}
                className={cn(
                  "min-w-0",
                  row.piece !== null && "font-serif",
                  isDone && "line-through decoration-ethereal-graphite/40",
                )}
              >
                {row.title}
              </Text>
              {row.note && (
                <Text as="span" size="sm" color="graphite" className="min-w-0 truncate italic">
                  {row.note}
                </Text>
              )}
            </span>
          );
          return (
            <li key={row.id}>
              {reserveRule}
              {onMark ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-control px-1 py-1.5 transition-colors hover:bg-ethereal-ink/3 pointer-coarse:py-2.5">
                  <Checkbox
                    checked={isDone}
                    size="md"
                    onChange={(event) => void handleToggle(row, event.target.checked)}
                  />
                  {label}
                </label>
              ) : (
                <div className="flex items-center gap-3 px-1 py-1.5">
                  <Checkbox checked={isDone} size="md" disabled readOnly />
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** "Kasia Nowak · 19 września, 21:14" — or nothing, when never written. */
const Stamp = ({ rehearsal }: { rehearsal: Rehearsal }): React.JSX.Element | null => {
  const { i18n } = useTranslation();
  if (!rehearsal.debrief_at) return null;
  const when = formatLocalizedDateTime(
    rehearsal.debrief_at,
    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
    i18n.language,
    rehearsal.timezone,
  );
  return (
    <Caption color="muted">
      {[rehearsal.debrief_by_name, when].filter(Boolean).join(" · ")}
    </Caption>
  );
};

/**
 * Keyed by the caller on the rehearsal and its stamp, so a save remounts the
 * draft from the server's answer and a switch of evening never carries a
 * half-typed paragraph across.
 */
const DebriefEditor = ({
  rehearsal,
  onSave,
}: {
  rehearsal: Rehearsal;
  onSave: (debrief: string) => Promise<unknown>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const saved = rehearsal.debrief ?? "";
  const [draft, setDraft] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = draft.trim() !== saved;

  const handleSave = async (): Promise<void> => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft.trim());
      toast.success(t("rehearsals.lead.debrief.saved", "Zapisano. Dyrygent dostał znać."));
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "rehearsals.lead.debrief.save_error",
          "Nie udało się zapisać podsumowania.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        maxLength={DEBRIEF_MAX}
        aria-label={t("rehearsals.lead.debrief.title", "Po próbie")}
        placeholder={t(
          "rehearsals.lead.debrief.placeholder",
          "Kilka zdań dla dyrygenta: co stoi, co do powtórki, kogo brakowało.",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stamp rehearsal={rehearsal} />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          isLoading={isSaving}
          className="ml-auto"
        >
          {saved
            ? t("rehearsals.lead.debrief.update", "Zapisz zmiany")
            : t("rehearsals.lead.debrief.submit", "Wyślij dyrygentowi")}
        </Button>
      </div>
    </div>
  );
};

export const RehearsalDebrief = ({
  rehearsal,
  onSave,
  onMarkPlanItem,
}: RehearsalDebriefProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  const canEdit = Boolean(onSave) && hasStarted;
  const written = (rehearsal.debrief ?? "").trim();
  // The checklist exists once the evening has started and there is a plan to
  // tick; before that the plan is read at the head of the card, not here. A
  // break is never done or undone, so it is not on the list.
  const planRows = hasStarted ? (rehearsal.plan ?? []).filter((row) => !row.is_break) : [];
  const hasChecklist = planRows.length > 0;

  if (!canEdit && !written && !hasChecklist) return null;

  return (
    <section className="border-t border-hairline p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <NotebookPen size={12} className="text-ethereal-gold/70" aria-hidden="true" />
        <Eyebrow as="h3" color="graphite">
          {t("rehearsals.lead.debrief.title", "Po próbie")}
        </Eyebrow>
      </div>
      {hasChecklist && (
        <div className="mb-4">
          <PlanChecklist rows={planRows} onMark={onMarkPlanItem} />
        </div>
      )}
      {canEdit && onSave ? (
        <DebriefEditor
          key={`${rehearsal.id}:${rehearsal.debrief_at ?? ""}`}
          rehearsal={rehearsal}
          onSave={onSave}
        />
      ) : (
        written && (
          <div className="flex flex-col gap-2">
            <Text size="md" className="whitespace-pre-wrap">
              {written}
            </Text>
            <Stamp rehearsal={rehearsal} />
          </div>
        )
      )}
    </section>
  );
};
