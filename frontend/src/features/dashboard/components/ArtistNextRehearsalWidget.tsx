/**
 * @file ArtistNextRehearsalWidget.tsx
 * @description Isolated widget for managing the next rehearsal attendance.
 * Uses shared UI components and fixes tooltip clipping.
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

import { GlassCard } from "../../../shared/ui/GlassCard";
import { Badge } from "../../../shared/ui/Badge";
import { DualTimeDisplay } from "../../../shared/ui/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { formatLocalizedDate } from "../../../shared/lib/intl";
import { cn } from "../../../shared/lib/utils";
import { useUpsertScheduleAttendance } from "../../schedule/api/schedule.queries";
import { AbsenceReportForm, type AbsenceFormValues } from "./AbsenceReportForm";

export function ArtistNextRehearsalWidget({ rehearsal }: { rehearsal: any }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const attendanceMutation = useUpsertScheduleAttendance();
  const [reportingRehearsal, setReportingRehearsal] = useState(false);

  const currentStatus = rehearsal?.attendance?.status;
  const isPresent = currentStatus === "PRESENT";
  const isExcusedOrLate =
    currentStatus === "EXCUSED" ||
    currentStatus === "LATE" ||
    currentStatus === "ABSENT";

  const handleConfirmPresence = async () => {
    if (!rehearsal || !rehearsal.participationId) return;
    const toastId = toast.loading("Potwierdzanie obecności...");
    try {
      await attendanceMutation.mutateAsync({
        existingAttendanceId: rehearsal.attendance?.id,
        payload: {
          rehearsal: rehearsal.data.id,
          participation: rehearsal.participationId,
          status: "PRESENT",
          excuse_note: "Obecność potwierdzona z Dashboardu",
        },
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success("Obecność potwierdzona!", { id: toastId });
    } catch (err: unknown) {
      toast.error("Błąd podczas zapisywania", { id: toastId });
    }
  };

  const onSubmitAbsence = async (data: AbsenceFormValues) => {
    if (!rehearsal || !rehearsal.participationId) return;
    const toastId = toast.loading("Zapisywanie zgłoszenia...");
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
      toast.success("Zgłoszenie zostało wysłane", { id: toastId });
    } catch (err: unknown) {
      toast.error("Wystąpił błąd", { id: toastId });
    }
  };

  return (
    <GlassCard
      variant="solid"
      className="flex flex-col h-full transition-all duration-300 relative z-10 !overflow-visible"
    >
      {/* Tło izolowane na warstwie -z-10 zapobiega ucinaniu dymków przez kontener nadrzędny */}
      <div
        className={cn(
          "absolute inset-0 rounded-[inherit] overflow-hidden -z-10 transition-colors duration-300",
          isPresent
            ? "bg-emerald-50/30"
            : isExcusedOrLate
              ? "bg-orange-50/20"
              : "bg-white/40",
        )}
      />

      <div className="p-6 flex-1 rounded-t-[inherit]">
        <div className="flex items-center justify-between mb-4">
          <Badge
            variant="neutral"
            icon={<Clock size={12} className="text-stone-400" />}
          >
            Próba
          </Badge>

          {isPresent && (
            <Badge variant="success" icon={<CheckCircle2 size={12} />}>
              Potwierdzona
            </Badge>
          )}
          {(currentStatus === "ABSENT" || currentStatus === "EXCUSED") && (
            <Badge variant="danger" icon={<XCircle size={12} />}>
              Zgłoszono absencję
            </Badge>
          )}
          {currentStatus === "LATE" && (
            <Badge variant="warning" icon={<AlertCircle size={12} />}>
              Spóźnienie
            </Badge>
          )}
        </div>

        <h3
          className="text-2xl font-bold tracking-tight mb-4 leading-tight text-stone-900"
          style={{ fontFamily: "'Cormorant', serif" }}
        >
          {rehearsal.title}
        </h3>

        <div className="flex flex-col gap-2 text-[11px] font-bold text-stone-600 mb-6 relative z-50">
          <span className="flex items-center gap-2">
            <Calendar size={14} className="text-[#002395]/60" />{" "}
            {formatLocalizedDate(
              rehearsal.date,
              { weekday: "long", day: "numeric", month: "long" },
              undefined,
              rehearsal.data.timezone,
            )}
          </span>
          <DualTimeDisplay
            value={rehearsal.date}
            timeZone={rehearsal.data.timezone}
            icon={
              <Clock
                size={14}
                className="text-[#002395]/60"
                aria-hidden="true"
              />
            }
            localTimeClassName="text-[10px] text-stone-400 font-medium pl-6"
          />
          {rehearsal.data.location && (
            <div className="flex items-center gap-2 pl-0.5 z-[100]">
              <LocationPreview
                locationRef={rehearsal.data.location}
                fallback="TBA"
              />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-stone-200/60 bg-stone-50/80 p-4 rounded-b-[inherit]">
        {!reportingRehearsal ? (
          <div className="flex flex-col sm:flex-row gap-2 relative z-10">
            {!isPresent && (
              <button
                onClick={handleConfirmPresence}
                disabled={attendanceMutation.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <Check size={14} /> Potwierdź Obecność
              </button>
            )}
            <button
              onClick={() => setReportingRehearsal(true)}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border bg-white shadow-sm active:scale-95",
                isExcusedOrLate
                  ? "border-stone-200 text-stone-600 hover:bg-stone-100"
                  : "border-orange-200 text-orange-600 hover:bg-orange-50",
              )}
            >
              <AlertCircle size={14} />{" "}
              {currentStatus ? "Edytuj zgłoszenie" : "Zgłoś problem"}
            </button>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
            >
              <AbsenceReportForm
                onSubmit={onSubmitAbsence}
                onCancel={() => setReportingRehearsal(false)}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </GlassCard>
  );
}
