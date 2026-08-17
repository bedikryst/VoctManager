/**
 * @file AbsenceReportForm.tsx
 * @description Shared absence/lateness report form used by the timeline
 * rehearsal card and the Next Event hero. Pure presentation — state lives in
 * useTimelineRehearsalCard.
 *
 * It answers for one evening or for a run of days. The span half only appears
 * where a `range` was handed in, and it states how many rehearsals it will reach
 * BEFORE the singer sends it: a fortnight away is not the same number as a
 * fortnight of rehearsals, and the difference is the whole point of saying it.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CalendarRange, Send } from "lucide-react";

import type { AttendanceStatus } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { AbsenceRangeFormState } from "../hooks/useTimelineRehearsalCard";

type ReportStatus = Extract<AttendanceStatus, "ABSENT" | "LATE">;

interface AbsenceReportFormProps {
  reportForm: { status: ReportStatus; notes: string };
  setReportForm: (form: { status: ReportStatus; notes: string }) => void;
  isSubmitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  /** Absent where the surface cannot resolve the artist's whole schedule. */
  range?: AbsenceRangeFormState;
}

export const AbsenceReportForm = ({
  reportForm,
  setReportForm,
  isSubmitting,
  onSubmit,
  onCancel,
  range,
}: AbsenceReportFormProps): React.JSX.Element => {
  const { t } = useTranslation();
  const rangeIsOn = range?.isOn ?? false;

  return (
    <form onSubmit={onSubmit} className="p-4 sm:p-6">
      <Eyebrow as="h4" color="crimson" className="mb-4 flex items-center gap-1.5">
        <AlertCircle size={13} aria-hidden="true" />
        {t("schedule.rehearsal.form.title", "Formularz nieobecności dla Inspektora")}
      </Eyebrow>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          variant="glass"
          label={t("schedule.rehearsal.form.status_label", "Status *")}
          value={reportForm.status}
          onValueChange={(value) =>
            setReportForm({
              ...reportForm,
              status: value as ReportStatus,
            })
          }
          // Over a span the answer is fixed: a run of days is an absence, and
          // lateness is a statement about one evening.
          disabled={isSubmitting || rangeIsOn}
          options={[
            {
              value: "ABSENT",
              label: t("schedule.rehearsal.form.option_absent", "Nie będę obecny"),
            },
            {
              value: "LATE",
              label: t("schedule.rehearsal.form.option_late", "Spóźnię się"),
            },
          ]}
        />
        <div className="sm:col-span-2">
          <Eyebrow as="label" color="muted" className="mb-1.5 ml-1 block">
            {t("schedule.rehearsal.form.reason_label", "Powód / Uwagi *")}
          </Eyebrow>
          <Input
            required
            type="text"
            placeholder={t(
              "schedule.rehearsal.form.reason_placeholder",
              "np. Korki, choroba...",
            )}
            value={reportForm.notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setReportForm({ ...reportForm, notes: e.target.value })
            }
            disabled={isSubmitting}
          />
        </div>
      </div>

      {range && (
        <div className="mb-4 rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3.5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={range.isOn}
              disabled={isSubmitting}
              onChange={(e) => range.setIsOn(e.target.checked)}
            />
            <CalendarRange
              size={13}
              className="text-ethereal-gold"
              aria-hidden="true"
            />
            <Eyebrow as="span" color="default">
              {t(
                "schedule.rehearsal.range.toggle",
                "Będzie mnie nie było dłużej",
              )}
            </Eyebrow>
          </label>

          {range.isOn && (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateTimeField
                  variant="glass"
                  label={t("schedule.rehearsal.range.from_label", "Od")}
                  value={range.from}
                  onChange={range.setFrom}
                  defaultTime="00:00"
                  disabled={isSubmitting}
                />
                <DateTimeField
                  variant="glass"
                  label={t("schedule.rehearsal.range.to_label", "Do")}
                  value={range.to}
                  onChange={range.setTo}
                  defaultTime="23:59"
                  anchorValue={range.from}
                  disabled={isSubmitting}
                />
              </div>

              <Text
                size="sm"
                color={range.preview.count > 0 ? "muted" : "crimson"}
                className="mt-2.5 ml-1"
                role="status"
              >
                {range.to === ""
                  ? t(
                      "schedule.rehearsal.range.awaiting_end",
                      "Wskaż dzień powrotu, aby zobaczyć, ilu prób to dotyczy.",
                    )
                  : range.preview.count > 0
                    ? t(
                        "schedule.rehearsal.range.preview",
                        "Zgłoszenie obejmie {{count}} Twoich prób w tym zakresie.",
                        { count: range.preview.count },
                      )
                    : t(
                        "schedule.rehearsal.range.preview_empty",
                        "W tym zakresie nie ma żadnej Twojej próby.",
                      )}
              </Text>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t("schedule.rehearsal.form.cancel", "Anuluj")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !reportForm.notes.trim()}
          isLoading={isSubmitting}
          leftIcon={!isSubmitting ? <Send size={12} aria-hidden="true" /> : undefined}
        >
          {t("schedule.rehearsal.form.submit", "Wyślij")}
        </Button>
      </div>
    </form>
  );
};
