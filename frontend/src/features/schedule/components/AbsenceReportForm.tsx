/**
 * @file AbsenceReportForm.tsx
 * @description Shared absence/lateness report form used by the timeline
 * rehearsal card and the Next Event hero. Pure presentation — state lives in
 * useTimelineRehearsalCard.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Send } from "lucide-react";

import type { AttendanceStatus } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow } from "@/shared/ui/primitives/typography";

type ReportStatus = Extract<AttendanceStatus, "ABSENT" | "LATE">;

interface AbsenceReportFormProps {
  reportForm: { status: ReportStatus; notes: string };
  setReportForm: (form: { status: ReportStatus; notes: string }) => void;
  isSubmitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export const AbsenceReportForm = ({
  reportForm,
  setReportForm,
  isSubmitting,
  onSubmit,
  onCancel,
}: AbsenceReportFormProps): React.JSX.Element => {
  const { t } = useTranslation();

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
          onChange={(e) =>
            setReportForm({
              ...reportForm,
              status: e.target.value as ReportStatus,
            })
          }
          disabled={isSubmitting}
        >
          <option value="ABSENT">
            {t("schedule.rehearsal.form.option_absent", "Nie będę obecny")}
          </option>
          <option value="LATE">
            {t("schedule.rehearsal.form.option_late", "Spóźnię się")}
          </option>
        </Select>
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
