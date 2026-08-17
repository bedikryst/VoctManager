/**
 * @file AbsenceSpanSheet.tsx
 * @description Excusing one singer for a run of days, from the roll call the
 * manager is already taking. The endpoint has always been theirs; this is its
 * first door on their side of the panel.
 *
 * Two things it must never do quietly. The span reaches across *every*
 * production the singer holds a seat in, not only the one on screen — so the
 * evenings it would touch are listed by name and by production before anything
 * is written. And it can overwrite a roll call already taken, which is a
 * manager's right and nobody else's — so a row that already carries a status
 * says what that status is.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/AbsenceSpanSheet
 */

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { CalendarRange, TriangleAlert } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { toZonedWallClock } from "@/shared/lib/time/timezone";

import {
  useAbsenceSpanPreview,
  useReportAbsenceSpan,
} from "../api/rehearsals.queries";
import type { AbsenceSpanRow, AbsenceSpanStatus } from "../types/rehearsals.dto";
import { ATTENDANCE_STATUS_META } from "../constants/attendanceMeta";

/** Lateness is a statement about one evening; a run of days cannot carry it. */
const SPAN_STATUSES: readonly AbsenceSpanStatus[] = ["EXCUSED", "ABSENT"];

interface AbsenceSpanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Null while the sheet is closing — it stays mounted through its exit. */
  artistId: string | null;
  artistName: string;
  /** The rehearsal the manager opened this from — where the span starts. */
  anchorDate: string;
  anchorTimezone?: string;
}

/** Midnight of the anchor rehearsal's own day: where "from now on" begins. */
const dayStart = (value: string, timeZone?: string): string => {
  const local = toZonedWallClock(new Date(value), timeZone);
  return local ? `${local.slice(0, 10)}T00:00` : "";
};

const SpanRow = ({ row }: { row: AbsenceSpanRow }): React.JSX.Element => {
  const { t } = useTranslation();
  const meta = row.current_status
    ? ATTENDANCE_STATUS_META[row.current_status]
    : null;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0">
      <div className="min-w-0">
        <Text size="sm" weight="semibold" className="block capitalize">
          {formatLocalizedDate(
            row.date_time,
            { weekday: "short", day: "numeric", month: "long" },
            undefined,
            row.timezone,
          )}
        </Text>
        <Caption color="muted" truncate className="block">
          {row.project_title}
        </Caption>
      </div>
      {meta && (
        <Badge variant="outline" className="shrink-0">
          {t(meta.labelKey, meta.fallback)}
        </Badge>
      )}
    </li>
  );
};

export const AbsenceSpanSheet = ({
  isOpen,
  onClose,
  artistId,
  artistName,
  anchorDate,
  anchorTimezone,
}: AbsenceSpanSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => dayStart(anchorDate, anchorTimezone));
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<AbsenceSpanStatus>("EXCUSED");
  const [note, setNote] = useState("");

  // The sheet outlives one singer — it stays mounted so it can animate out — so
  // each opening starts clean rather than on the last person's dates.
  useEffect(() => {
    if (!isOpen) return;
    setFrom(dayStart(anchorDate, anchorTimezone));
    setTo("");
    setStatus("EXCUSED");
    setNote("");
  }, [isOpen, artistId, anchorDate, anchorTimezone]);

  const preview = useAbsenceSpanPreview(isOpen ? artistId : null, from, to);
  const spanMutation = useReportAbsenceSpan();

  const rows = preview.data?.rehearsals;
  const alreadyRecorded = useMemo(
    () => (rows ?? []).filter((row) => row.current_status !== null).length,
    [rows],
  );

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!artistId) return;
    try {
      const result = await spanMutation.mutateAsync({
        artist: artistId,
        starts_at: from,
        ends_at: to,
        status,
        excuse_note: note.trim(),
      });
      toast.success(
        t("rehearsals.span.success", "Zapisano dla {{count}} prób.", {
          count: result.updated,
        }),
      );
      onClose();
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "rehearsals.span.error",
          "Nie udało się zapisać nieobecności w tym zakresie.",
        ),
      });
    }
  };

  const canSubmit =
    !!from && !!to && from <= to && (preview.data?.count ?? 0) > 0;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={artistName}
      subtitle={t("rehearsals.span.title", "Nieobecność w zakresie dni")}
      headerBadge={
        <Badge variant="amethyst" icon={<CalendarRange size={11} />}>
          {t("rehearsals.span.badge", "Wiele prób")}
        </Badge>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateTimeField
            variant="glass"
            label={t("rehearsals.span.from_label", "Od")}
            value={from}
            onChange={setFrom}
            defaultTime="00:00"
            disabled={spanMutation.isPending}
          />
          <DateTimeField
            variant="glass"
            label={t("rehearsals.span.to_label", "Do")}
            value={to}
            onChange={setTo}
            defaultTime="23:59"
            anchorValue={from}
            disabled={spanMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            variant="glass"
            label={t("rehearsals.span.status_label", "Status")}
            value={status}
            onValueChange={(value) => setStatus(value as AbsenceSpanStatus)}
            disabled={spanMutation.isPending}
            /* The roster's own vocabulary, not a second one: a status names the
               record ("Nieobecność"), never the person. */
            options={SPAN_STATUSES.map((value) => ({
              value,
              label: t(
                ATTENDANCE_STATUS_META[value].labelKey,
                ATTENDANCE_STATUS_META[value].fallback,
              ),
            }))}
          />
          <Input
            type="text"
            variant="glass"
            label={t("rehearsals.span.note_label", "Powód (opcjonalnie)")}
            placeholder={t("rehearsals.span.note_placeholder", "np. Choroba")}
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNote(e.target.value)
            }
            disabled={spanMutation.isPending}
          />
        </div>

        {/* The list is the whole point: a span opened from one production can
            reach into another, and only the server knows where this singer sits. */}
        <div className="rounded-nested border border-hairline bg-ethereal-marble/20 p-3.5">
          <Eyebrow color="muted" className="mb-2 block">
            {t("rehearsals.span.covered", "Obejmie próby")}
          </Eyebrow>

          {!to ? (
            <Text size="sm" color="muted">
              {t(
                "rehearsals.span.awaiting_end",
                "Wskaż ostatni dzień nieobecności.",
              )}
            </Text>
          ) : from > to ? (
            // Nothing is being asked of the server here — the query is off — so
            // this branch has to speak for itself. Without it the box would sit
            // on "checking the calendar" for as long as the dates stay crossed.
            <Text size="sm" color="crimson">
              {t(
                "rehearsals.span.range_inverted",
                "Koniec zakresu wypada przed jego początkiem.",
              )}
            </Text>
          ) : preview.isPending ? (
            // A line, not a loader: this box is three rows tall and the answer
            // takes one round trip — a staged loading state would flash.
            <Text size="sm" color="muted">
              {t("rehearsals.span.checking", "Sprawdzam kalendarz...")}
            </Text>
          ) : preview.isError ? (
            <Text size="sm" color="crimson">
              {t(
                "rehearsals.span.preview_error",
                "Nie udało się sprawdzić, ilu prób to dotyczy.",
              )}
            </Text>
          ) : !rows || rows.length === 0 ? (
            <Text size="sm" color="crimson">
              {t(
                "rehearsals.span.preview_empty",
                "W tym zakresie ta osoba nie ma żadnej próby.",
              )}
            </Text>
          ) : (
            <>
              <ul className="mb-1 max-h-56 overflow-y-auto">
                {rows.map((row) => (
                  <SpanRow key={row.id} row={row} />
                ))}
              </ul>
              {alreadyRecorded > 0 && (
                <div className="mt-2 flex items-start gap-2">
                  <TriangleAlert
                    size={13}
                    className="mt-0.5 shrink-0 text-ethereal-crimson"
                    aria-hidden="true"
                  />
                  <Caption color="crimson">
                    {t(
                      "rehearsals.span.overwrites",
                      "{{count}} prób ma już wpis — zostanie nadpisany.",
                      { count: alreadyRecorded },
                    )}
                  </Caption>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={spanMutation.isPending}
          >
            {t("common.actions.cancel", "Anuluj")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit || spanMutation.isPending}
            isLoading={spanMutation.isPending}
          >
            {t("rehearsals.span.submit", "Zapisz nieobecność")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
