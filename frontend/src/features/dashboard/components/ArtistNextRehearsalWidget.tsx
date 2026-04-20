/**
 * @file ArtistNextRehearsalWidget.tsx
 * @description Isolated widget for managing the next rehearsal attendance.
 * Refactored to Enterprise SaaS 2026 standard: Strict Typing (No 'any') and complete i18n.
 * Powered by Ethereal UI (Sage palette for Rehearsals).
 * @architecture Enterprise SaaS 2026
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
} from "lucide-react";

import { EventCard } from "@/shared/ui/composites/EventCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Heading, Eyebrow } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { cn } from "@/shared/lib/utils";
import { useUpsertScheduleAttendance } from "../../schedule/api/schedule.queries";
import { AbsenceReportForm, type AbsenceFormValues } from "./AbsenceReportForm";
import type { Rehearsal, Attendance } from "@/shared/types";

// Definicja kontraktu danych (DTO) dla wyabstrahowanego widżetu
export interface UpcomingRehearsalDto {
  type: "REHEARSAL";
  date: Date;
  data: Rehearsal;
  title: string;
  absences: number;
  participationId?: string | number;
  attendance?: Attendance;
}

export interface ArtistNextRehearsalWidgetProps {
  rehearsal: UpcomingRehearsalDto;
}

export function ArtistNextRehearsalWidget({
  rehearsal,
}: ArtistNextRehearsalWidgetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const attendanceMutation = useUpsertScheduleAttendance();
  const [reportingRehearsal, setReportingRehearsal] = useState(false);

  if (!rehearsal) return null;

  const currentStatus = rehearsal.attendance?.status;
  const isPresent = currentStatus === "PRESENT";
  const isExcusedOrLate =
    currentStatus === "EXCUSED" ||
    currentStatus === "LATE" ||
    currentStatus === "ABSENT";

  const handleConfirmPresence = async () => {
    if (!rehearsal.participationId) return;

    const toastId = toast.loading(
      t("dashboard.artist.toast_confirming", "Potwierdzanie obecności..."),
    );

    try {
      await attendanceMutation.mutateAsync({
        existingAttendanceId: rehearsal.attendance?.id,
        payload: {
          rehearsal: rehearsal.data.id,
          participation: rehearsal.participationId,
          status: "PRESENT",
          excuse_note: t(
            "dashboard.artist.note_dashboard_confirm",
            "Obecność potwierdzona z Dashboardu",
          ),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success(
        t("dashboard.artist.toast_confirm_success", "Obecność potwierdzona!"),
        { id: toastId },
      );
    } catch (err: unknown) {
      toast.error(t("common.error_saving", "Błąd podczas zapisywania"), {
        id: toastId,
      });
    }
  };

  const onSubmitAbsence = async (data: AbsenceFormValues) => {
    if (!rehearsal.participationId) return;

    const toastId = toast.loading(
      t("dashboard.artist.toast_saving_report", "Zapisywanie zgłoszenia..."),
    );

    try {
      await attendanceMutation.mutateAsync({
        existingAttendanceId: rehearsal.attendance?.id,
        payload: {
          rehearsal: rehearsal.data.id,
          participation: rehearsal.participationId,
          status: data.status,
          excuse_note: data.notes,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      setReportingRehearsal(false);
      toast.success(
        t(
          "dashboard.artist.toast_report_success",
          "Zgłoszenie zostało wysłane",
        ),
        { id: toastId },
      );
    } catch (err: unknown) {
      toast.error(t("common.error_occurred", "Wystąpił błąd"), { id: toastId });
    }
  };

  return (
    <EventCard
      theme="sage"
      backgroundElement={
        <div
          className={cn(
            "absolute inset-0 rounded-[inherit] overflow-hidden -z-10 transition-colors duration-500",
            isPresent
              ? "bg-ethereal-sage/5"
              : isExcusedOrLate
                ? "bg-ethereal-incense/5"
                : "bg-transparent",
          )}
          aria-hidden="true"
        />
      }
      badgesSlot={
        <>
          <Badge variant="outline">
            <Clock size={10} className="mr-1.5" />
            {t("dashboard.artist.badge_rehearsal", "Próba")}
          </Badge>

          <div className="flex items-center gap-2">
            {isPresent && (
              <Badge variant="outline">
                <CheckCircle2 size={10} className="mr-1.5" />
                {t("dashboard.artist.badge_confirmed", "Potwierdzona")}
              </Badge>
            )}
            {(currentStatus === "ABSENT" || currentStatus === "EXCUSED") && (
              <Badge variant="outline">
                <XCircle size={10} className="mr-1.5" />
                {t(
                  "dashboard.artist.badge_absence_reported",
                  "Zgłoszono absencję",
                )}
              </Badge>
            )}
            {currentStatus === "LATE" && (
              <Badge variant="outline">
                <AlertCircle size={10} className="mr-1.5" />
                {t("dashboard.artist.badge_late", "Spóźnienie")}
              </Badge>
            )}
          </div>
        </>
      }
      title={rehearsal.title}
      dateSlot={formatLocalizedDate(
        rehearsal.date,
        { weekday: "long", day: "numeric", month: "long" },
        undefined,
        rehearsal.data.timezone,
      )}
      timeSlot={
        <DualTimeDisplay
          value={rehearsal.date}
          timeZone={rehearsal.data.timezone}
          icon={
            <Clock
              size={13}
              strokeWidth={1.5}
              className="shrink-0 opacity-70 text-ethereal-sage"
              aria-hidden="true"
            />
          }
          typography="sans"
          color="default"
          size="xs"
          weight="medium"
        />
      }
      locationSlot={
        rehearsal.data.location ? (
          <LocationPreview
            locationRef={rehearsal.data.location}
            fallback={t("common.tba", "TBA")}
            variant="minimal"
            className="text-[10px] font-medium uppercase tracking-[0.25em] transition-colors duration-500 hover:text-ethereal-sage"
          />
        ) : undefined
      }
      actionSlot={
        !reportingRehearsal ? (
          <>
            {!isPresent && (
              <button
                onClick={handleConfirmPresence}
                disabled={attendanceMutation.isPending}
                className="flex-1 bg-ethereal-sage/10 border border-ethereal-sage/30 hover:bg-ethereal-sage/20 text-ethereal-sage px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Check size={14} strokeWidth={2.5} />{" "}
                {t(
                  "dashboard.artist.btn_confirm_presence",
                  "Potwierdź Obecność",
                )}
              </button>
            )}
            <button
              onClick={() => setReportingRehearsal(true)}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border shadow-sm active:scale-95",
                isExcusedOrLate
                  ? "border-ethereal-incense/30 bg-white text-ethereal-graphite hover:bg-ethereal-incense/10 hover:text-ethereal-ink"
                  : "border-ethereal-incense/20 bg-white/50 text-ethereal-graphite hover:bg-ethereal-alabaster hover:border-ethereal-incense/40",
              )}
            >
              <AlertCircle size={14} strokeWidth={2} />{" "}
              {currentStatus
                ? t("dashboard.artist.btn_edit_report", "Edytuj zgłoszenie")
                : t("dashboard.artist.btn_report_issue", "Zgłoś problem")}
            </button>
          </>
        ) : undefined
      }
      footerSlot={
        reportingRehearsal ? (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <AbsenceReportForm
                onSubmit={onSubmitAbsence}
                onCancel={() => setReportingRehearsal(false)}
              />
            </motion.div>
          </AnimatePresence>
        ) : undefined
      }
    />
  );
}
