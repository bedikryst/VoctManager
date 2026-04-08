/**
 * @file TimelineRehearsalCard.tsx
 * @description Isolated component for rendering a Rehearsal on the Artist Timeline.
 * @module panel/schedule/cards/TimelineRehearsalCard
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  UserMinus,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Music,
  AlignLeft,
} from "lucide-react";
import type { AttendanceStatus } from "../../../shared/types";
import type { ScheduleViewMode, TimelineEvent } from "../types/schedule.dto";
import { useTimelineRehearsalCard } from "../hooks/useTimelineRehearsalCard";
import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "../../../shared/lib/intl";
import { Input } from "../../../shared/ui/Input";
import { Button } from "../../../shared/ui/Button";

interface TimelineRehearsalCardProps {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmitReport: (
    eventId: string,
    projectId: string | number,
    status: AttendanceStatus,
    notes: string,
  ) => Promise<boolean>;
  viewMode: ScheduleViewMode;
}

const STYLE_LABEL =
  "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-1.5 ml-1";

export default function TimelineRehearsalCard({
  event,
  isExpanded,
  onToggle,
  onSubmitReport,
  viewMode,
}: TimelineRehearsalCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    reportingMode,
    setReportingMode,
    isSubmitting,
    currentMaskedStatus,
    reportForm,
    setReportForm,
    isExcusedOrLate,
    handleConfirmPresence,
    handleSubmitReport,
    enableReportingMode,
  } = useTimelineRehearsalCard(event, onSubmitReport, onToggle, isExpanded);

  const getStatusBadge = (status: string | null | undefined) => {
    const masked = status === "EXCUSED" ? "ABSENT" : status;
    switch (masked) {
      case "PRESENT":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 size={12} />{" "}
            {t("schedule.rehearsal.status_present", "Potwierdzona")}
          </span>
        );
      case "LATE":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-orange-50 text-orange-700 rounded border border-orange-200 flex items-center gap-1">
            <Clock size={12} />{" "}
            {t("schedule.rehearsal.status_late", "Spóźnienie")}
          </span>
        );
      case "ABSENT":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-red-50 text-red-700 rounded border border-red-200 flex items-center gap-1">
            <XCircle size={12} />{" "}
            {t("schedule.rehearsal.status_absent", "Nieobecność")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative sm:pl-16 transition-all duration-300 group"
    >
      <div
        className={`hidden sm:block absolute left-4 md:left-[27px] top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-[#f4f2ee] z-10 transition-all duration-500 ${isExcusedOrLate ? "bg-orange-500 border-orange-500" : currentMaskedStatus === "PRESENT" ? "bg-emerald-500 border-emerald-500" : "bg-white border-stone-300 group-hover:border-[#002395]"}`}
      />

      <div
        className={`bg-white/80 backdrop-blur-xl rounded-2xl relative overflow-hidden transition-all duration-300 shadow-[0_4px_15px_rgb(0,0,0,0.02)] border hover:border-[#002395]/30 hover:shadow-[0_8px_25px_rgb(0,0,0,0.04)] w-full flex flex-col ${isExpanded ? "border-[#002395]/30" : "border-stone-200/80"}`}
      >
        <div className="flex flex-col md:flex-row items-stretch">
          <div
            className={`w-full md:w-28 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-dashed border-stone-200/80 transition-colors ${currentMaskedStatus === "PRESENT" ? "bg-emerald-50/50" : isExcusedOrLate ? "bg-stone-50" : "bg-[#002395]/5 group-hover:bg-[#002395]/10"}`}
            onClick={() => {
              if (!reportingMode) onToggle();
            }}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${currentMaskedStatus === "PRESENT" ? "text-emerald-600" : isExcusedOrLate ? "text-stone-400" : "text-[#002395]/60"}`}
            >
              {formatLocalizedDate(event.date_time, { month: "short" })}
            </span>
            <span
              className={`text-3xl font-black leading-none my-0.5 ${currentMaskedStatus === "PRESENT" ? "text-emerald-700" : isExcusedOrLate ? "text-stone-500" : "text-[#002395]"}`}
            >
              {event.date_time.getDate()}
            </span>
            <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
              {formatLocalizedDate(event.date_time, { weekday: "short" })}
            </span>
          </div>

          <div
            className="flex-1 p-4 md:p-5 flex flex-col justify-center cursor-pointer relative"
            onClick={() => {
              if (!reportingMode) onToggle();
            }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[8px] font-bold uppercase tracking-widest rounded border border-stone-200/60 shadow-sm">
                {t("schedule.rehearsal.badge", "Próba")}
              </span>
              {!event.is_mandatory && (
                <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest bg-orange-50 text-orange-600 rounded border border-orange-200 shadow-sm">
                  {t("schedule.rehearsal.optional", "Opcjonalna")}
                </span>
              )}
              {getStatusBadge(event.status)}
            </div>
            <h3
              className={`text-lg md:text-xl font-bold tracking-tight leading-tight truncate max-w-xl ${isExcusedOrLate ? "text-stone-500" : "text-stone-900"}`}
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              {event.title}
            </h3>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] font-bold text-stone-500 uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-[#002395]/60" />{" "}
                {formatLocalizedTime(event.date_time, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                <MapPin size={12} className="text-[#002395]/60 flex-shrink-0" />{" "}
                <span className="truncate">
                  {event.location ||
                    t("schedule.rehearsal.no_location", "Brak")}
                </span>
              </span>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 group-hover:text-[#002395] transition-colors">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          {viewMode === "UPCOMING" && !reportingMode && (
            <div className="w-full md:w-48 p-4 border-t md:border-t-0 md:border-l border-stone-100 bg-stone-50/30 flex flex-row md:flex-col gap-2 justify-center">
              {currentMaskedStatus !== "PRESENT" && (
                <Button
                  variant="primary"
                  onClick={handleConfirmPresence}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  leftIcon={
                    !isSubmitting ? (
                      <Check size={14} aria-hidden="true" />
                    ) : undefined
                  }
                  className="!bg-emerald-500 hover:!bg-emerald-600 flex-1 md:flex-none"
                >
                  <span className="hidden md:inline">
                    {t("schedule.rehearsal.action.confirm_short", "Potwierdź")}
                  </span>
                  <span className="md:hidden">
                    {t(
                      "schedule.rehearsal.action.confirm_long",
                      "Potwierdź Obecność",
                    )}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={enableReportingMode}
                className={`flex-1 md:flex-none ${isExcusedOrLate ? "text-stone-700" : "text-orange-600 hover:text-orange-700 hover:border-orange-300"}`}
                leftIcon={<AlertCircle size={14} aria-hidden="true" />}
              >
                {currentMaskedStatus
                  ? t("schedule.rehearsal.action.edit", "Edytuj")
                  : t(
                      "schedule.rehearsal.action.report_issue",
                      "Zgłoś problem",
                    )}
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {reportingMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-stone-200/60 bg-orange-50/30"
            >
              <form onSubmit={handleSubmitReport} className="p-5 md:p-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-4 flex items-center gap-1.5">
                  <AlertCircle size={14} />{" "}
                  {t(
                    "schedule.rehearsal.form.title",
                    "Formularz nieobecności dla Inspektora",
                  )}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="sm:col-span-1">
                    <label className={STYLE_LABEL}>
                      {t("schedule.rehearsal.form.status_label", "Status *")}
                    </label>
                    <select
                      value={reportForm.status}
                      onChange={(e) =>
                        setReportForm({
                          ...reportForm,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2.5 text-xs text-stone-800 bg-stone-50 border border-stone-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002395]/20 transition-all shadow-inner font-bold appearance-none"
                      disabled={isSubmitting}
                    >
                      <option value="ABSENT">
                        {t(
                          "schedule.rehearsal.form.option_absent",
                          "Nie będę obecny",
                        )}
                      </option>
                      <option value="LATE">
                        {t(
                          "schedule.rehearsal.form.option_late",
                          "Spóźnię się",
                        )}
                      </option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={STYLE_LABEL}>
                      {t(
                        "schedule.rehearsal.form.reason_label",
                        "Powód / Uwagi *",
                      )}
                    </label>
                    <Input
                      required
                      type="text"
                      placeholder={t(
                        "schedule.rehearsal.form.reason_placeholder",
                        "np. Korki, choroba...",
                      )}
                      value={reportForm.notes}
                      onChange={(e: any) =>
                        setReportForm({ ...reportForm, notes: e.target.value })
                      }
                      disabled={isSubmitting}
                      className="bg-stone-50 border border-stone-200/80 font-medium text-xs py-2.5"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setReportingMode(false)}
                    disabled={isSubmitting}
                  >
                    {t("schedule.rehearsal.form.cancel", "Anuluj")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !reportForm.notes.trim()}
                    isLoading={isSubmitting}
                    leftIcon={
                      !isSubmitting ? (
                        <Send size={12} aria-hidden="true" />
                      ) : undefined
                    }
                  >
                    {t("schedule.rehearsal.form.submit", "Wyślij")}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {isExpanded && !reportingMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-stone-200/60 bg-stone-50/40 relative z-0"
            >
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col h-full">
                  <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 flex items-center gap-1.5">
                    <AlignLeft size={14} />{" "}
                    {t("schedule.rehearsal.details.focus_title", "Plan Pracy")}
                  </h4>
                  <div className="bg-white/80 p-4 rounded-2xl border border-stone-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex-1">
                    {event.focus ? (
                      <p className="text-sm text-stone-700 italic leading-relaxed font-serif whitespace-pre-wrap">
                        {event.focus}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-400 italic">
                        {t(
                          "schedule.rehearsal.details.no_focus",
                          "Brak szczegółowego planu dla tej próby.",
                        )}
                      </p>
                    )}
                  </div>
                  {(event.absences || 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold uppercase tracking-widest shadow-sm w-max">
                      <UserMinus size={14} />{" "}
                      {t(
                        "schedule.rehearsal.details.reported_absences",
                        "Zgłoszone nieobecności:",
                      )}{" "}
                      {event.absences}
                    </div>
                  )}
                </div>

                <div className="flex flex-col h-full">
                  <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 flex items-center gap-1.5">
                    <Music size={14} />{" "}
                    {t(
                      "schedule.rehearsal.details.materials_title",
                      "Twoje Nuty",
                    )}
                  </h4>
                  <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex-1 flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-bold text-stone-700 mb-1">
                      {t(
                        "schedule.rehearsal.details.materials_subtitle",
                        "Przygotuj się do próby",
                      )}
                    </p>
                    <p className="text-[10px] text-stone-500 mb-3 px-4">
                      {t(
                        "schedule.rehearsal.details.materials_desc",
                        "Pobierz nuty PDF i przećwicz swoje partie z odtwarzaczem.",
                      )}
                    </p>
                    <Link
                      to="/panel/materials"
                      className="bg-white border border-blue-200 text-[#002395] hover:bg-[#002395] hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 group/mat"
                    >
                      {t(
                        "schedule.rehearsal.details.materials_button",
                        "Materiały",
                      )}{" "}
                      <ArrowRight
                        size={14}
                        className="group-hover/mat:translate-x-1 transition-transform"
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
