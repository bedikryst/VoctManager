import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  UserMinus,
  ArrowRight,
  Check,
  ChevronDown,
  Music,
  AlignLeft,
} from "lucide-react";
import type { AttendanceStatus } from "@/shared/types";
import type { ScheduleViewMode, TimelineEvent } from "../types/schedule.dto";
import { useTimelineRehearsalCard } from "../hooks/useTimelineRehearsalCard";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { cn } from "@/shared/lib/utils";

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

const statusTopBorder = (s: string | null | undefined) => {
  if (s === "PRESENT") return "border-t-ethereal-sage";
  if (s === "LATE" || s === "ABSENT") return s === "LATE" ? "border-t-ethereal-incense" : "border-t-ethereal-crimson";
  return "border-t-ethereal-amethyst/20";
};

export const TimelineRehearsalCard = ({
  event,
  isExpanded,
  onToggle,
  onSubmitReport,
  viewMode,
}: TimelineRehearsalCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const tz = (event.rawObj as { timezone?: string })?.timezone;
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

  const maskedStatus = currentMaskedStatus === "EXCUSED" ? "ABSENT" : currentMaskedStatus;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative sm:pl-14 md:pl-16 group"
    >
      {/* timeline dot — desktop sidebar */}
      <div
        className={cn(
          "hidden sm:block absolute left-3.5 md:left-6 top-5 w-3 h-3 rounded-full border-2 ring-4 ring-ethereal-parchment z-10 transition-all duration-500",
          isExcusedOrLate
            ? "bg-ethereal-incense border-ethereal-incense"
            : maskedStatus === "PRESENT"
              ? "bg-ethereal-sage border-ethereal-sage"
              : "bg-ethereal-marble border-ethereal-incense/40 group-hover:border-ethereal-amethyst",
        )}
      />

      <GlassCard
        variant="ethereal"
        padding="none"
        isHoverable={false}
        className={cn(
          "overflow-hidden transition-all duration-300 border-t-2",
          statusTopBorder(maskedStatus),
          isExpanded ? "border-ethereal-amethyst/25" : "hover:border-ethereal-amethyst/15",
        )}
      >
        {/* ── main row ─────────────────────────────────────────────── */}
        <div
          className="flex items-stretch cursor-pointer"
          onClick={() => { if (!reportingMode) onToggle(); }}
          role="button"
          aria-expanded={isExpanded}
        >
          {/* date column */}
          <div
            className={cn(
              "w-18 sm:w-20 shrink-0 flex flex-col items-center justify-center py-4 border-r border-dashed border-ethereal-incense/15 transition-colors",
              maskedStatus === "PRESENT"
                ? "bg-ethereal-sage/8"
                : isExcusedOrLate
                  ? "bg-ethereal-alabaster/60"
                  : "bg-ethereal-amethyst/5 group-hover:bg-ethereal-amethyst/8",
            )}
          >
            <Eyebrow
              as="span"
              color={maskedStatus === "PRESENT" ? "sage" : isExcusedOrLate ? "muted" : "amethyst"}
            >
              {formatLocalizedDate(event.date_time, { month: "short" }, undefined, tz)}
            </Eyebrow>
            <Heading
              as="span"
              size="3xl"
              weight="black"
              color={maskedStatus === "PRESENT" ? "sage" : isExcusedOrLate ? "graphite" : "amethyst"}
              className="leading-none my-0.5"
            >
              {formatLocalizedDate(event.date_time, { day: "numeric" }, undefined, tz)}
            </Heading>
            <Eyebrow as="span" color="muted">
              {formatLocalizedDate(event.date_time, { weekday: "short" }, undefined, tz)}
            </Eyebrow>
          </div>

          {/* content column */}
          <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-center gap-1.5">
            {/* badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Eyebrow
                as="span"
                className="px-2 py-0.5 bg-ethereal-alabaster border border-ethereal-incense/20 rounded shadow-glass-ethereal"
              >
                {t("schedule.rehearsal.badge", "Próba")}
              </Eyebrow>
              {!event.is_mandatory && (
                <Eyebrow
                  as="span"
                  color="incense"
                  className="px-2 py-0.5 bg-ethereal-incense/10 rounded border border-ethereal-incense/20"
                >
                  {t("schedule.rehearsal.optional", "Opcjonalna")}
                </Eyebrow>
              )}
              {maskedStatus === "PRESENT" && (
                <Eyebrow as="span" color="sage" className="px-2 py-0.5 rounded border flex items-center gap-1 bg-ethereal-sage/10 border-ethereal-sage/20">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  {t("schedule.rehearsal.status_present", "Potwierdzona")}
                </Eyebrow>
              )}
              {maskedStatus === "LATE" && (
                <Eyebrow as="span" color="incense" className="px-2 py-0.5 rounded border flex items-center gap-1 bg-ethereal-incense/10 border-ethereal-incense/20">
                  <Clock size={11} aria-hidden="true" />
                  {t("schedule.rehearsal.status_late", "Spóźnienie")}
                </Eyebrow>
              )}
              {maskedStatus === "ABSENT" && (
                <Eyebrow as="span" color="crimson" className="px-2 py-0.5 rounded border flex items-center gap-1 bg-ethereal-crimson/10 border-ethereal-crimson/20">
                  <XCircle size={11} aria-hidden="true" />
                  {t("schedule.rehearsal.status_absent", "Nieobecność")}
                </Eyebrow>
              )}
            </div>

            {/* title */}
            <Heading
              as="h3"
              size="xl"
              weight="bold"
              color={isExcusedOrLate ? "graphite" : "default"}
              truncate
            >
              {event.title}
            </Heading>

            {/* meta */}
            <div className="flex flex-wrap items-center gap-3 mt-0.5">
              <DualTimeDisplay
                value={event.date_time}
                timeZone={tz}
                icon={<Clock size={11} className="text-ethereal-amethyst/60" aria-hidden="true" />}
                containerClassName="flex items-center gap-1.5"
                primaryTimeClassName="flex items-center gap-1.5"
                localTimeClassName="text-[9px] text-ethereal-graphite/50 font-medium normal-case tracking-normal pl-1.5"
              />
              <LocationPreview
                locationRef={event.location}
                fallback={t("schedule.rehearsal.no_location", "Brak")}
                variant="minimal"
              />
            </div>
          </div>

          {/* chevron */}
          <div className="shrink-0 flex items-center pr-4 text-ethereal-incense/30 group-hover:text-ethereal-amethyst/60 transition-colors">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <ChevronDown size={18} aria-hidden="true" />
            </motion.div>
          </div>
        </div>

        {/* ── action buttons — mobile full-width, desktop sidebar ────── */}
        {viewMode === "UPCOMING" && !reportingMode && (
          <div className="flex gap-2 px-4 pb-4 pt-0 sm:hidden">
            {maskedStatus !== "PRESENT" && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmPresence}
                disabled={isSubmitting}
                isLoading={isSubmitting}
                leftIcon={!isSubmitting ? <Check size={13} aria-hidden="true" /> : undefined}
                className="flex-1 bg-ethereal-sage border-ethereal-sage hover:bg-ethereal-sage/80"
              >
                {t("schedule.rehearsal.action.confirm_long", "Potwierdź Obecność")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={enableReportingMode}
              className={cn(
                "flex-1",
                isExcusedOrLate ? "" : "text-ethereal-crimson hover:border-ethereal-crimson/30",
              )}
              leftIcon={<AlertCircle size={13} aria-hidden="true" />}
            >
              {currentMaskedStatus
                ? t("schedule.rehearsal.action.edit", "Edytuj")
                : t("schedule.rehearsal.action.report_issue", "Zgłoś")}
            </Button>
          </div>
        )}

        <AnimatePresence>
          {/* ── absence reporting form ──────────────────────────────── */}
          {reportingMode && (
            <motion.div
              key="report-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-ethereal-crimson/15 bg-ethereal-crimson/5"
            >
              <form onSubmit={handleSubmitReport} className="p-4 sm:p-6">
                <Eyebrow as="h4" color="crimson" className="mb-4 flex items-center gap-1.5">
                  <AlertCircle size={13} aria-hidden="true" />
                  {t("schedule.rehearsal.form.title", "Formularz nieobecności dla Inspektora")}
                </Eyebrow>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <Select
                    variant="glass"
                    label={t("schedule.rehearsal.form.status_label", "Status *")}
                    value={reportForm.status}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        status: e.target.value as Extract<AttendanceStatus, "ABSENT" | "LATE">,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <option value="ABSENT">{t("schedule.rehearsal.form.option_absent", "Nie będę obecny")}</option>
                    <option value="LATE">{t("schedule.rehearsal.form.option_late", "Spóźnię się")}</option>
                  </Select>
                  <div className="sm:col-span-2">
                    <Eyebrow as="label" color="muted" className="mb-1.5 ml-1 block">
                      {t("schedule.rehearsal.form.reason_label", "Powód / Uwagi *")}
                    </Eyebrow>
                    <Input
                      required
                      type="text"
                      placeholder={t("schedule.rehearsal.form.reason_placeholder", "np. Korki, choroba...")}
                      value={reportForm.notes}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReportForm({ ...reportForm, notes: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
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
                    leftIcon={!isSubmitting ? <Send size={12} aria-hidden="true" /> : undefined}
                  >
                    {t("schedule.rehearsal.form.submit", "Wyślij")}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── expanded details ────────────────────────────────────── */}
          {isExpanded && !reportingMode && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden border-t border-ethereal-incense/15 bg-ethereal-alabaster/20"
            >
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
                {/* focus / work plan */}
                <div className="flex flex-col gap-2">
                  <Eyebrow as="h4" color="muted" className="flex items-center gap-1.5">
                    <AlignLeft size={13} aria-hidden="true" />
                    {t("schedule.rehearsal.details.focus_title", "Plan Pracy")}
                  </Eyebrow>
                  <GlassCard variant="light" padding="sm" isHoverable={false} className="flex-1 rounded-2xl">
                    {event.focus ? (
                      <Text size="sm" color="default" className="italic font-serif whitespace-pre-wrap leading-relaxed">
                        {event.focus}
                      </Text>
                    ) : (
                      <Text size="sm" color="muted" className="italic">
                        {t("schedule.rehearsal.details.no_focus", "Brak szczegółowego planu dla tej próby.")}
                      </Text>
                    )}
                  </GlassCard>
                  {(event.absences ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ethereal-crimson/5 border border-ethereal-crimson/20 shadow-glass-ethereal w-max">
                      <UserMinus size={13} className="text-ethereal-crimson" aria-hidden="true" />
                      <Eyebrow as="span" color="crimson">
                        {t("schedule.rehearsal.details.reported_absences", "Zgłoszone nieobecności:")}{" "}
                        {event.absences}
                      </Eyebrow>
                    </div>
                  )}
                </div>

                {/* materials */}
                <div className="flex flex-col gap-2">
                  <Eyebrow as="h4" color="muted" className="flex items-center gap-1.5">
                    <Music size={13} aria-hidden="true" />
                    {t("schedule.rehearsal.details.materials_title", "Twoje Nuty")}
                  </Eyebrow>
                  <GlassCard
                    variant="solid"
                    padding="sm"
                    isHoverable={false}
                    className="flex-1 flex flex-col justify-center items-center text-center rounded-2xl"
                  >
                    <Text size="sm" weight="bold" color="default" className="mb-1">
                      {t("schedule.rehearsal.details.materials_subtitle", "Przygotuj się do próby")}
                    </Text>
                    <Text size="sm" color="muted" className="mb-3 px-4">
                      {t("schedule.rehearsal.details.materials_desc", "Pobierz nuty PDF i przećwicz swoje partie z odtwarzaczem.")}
                    </Text>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/panel/materials" className="inline-flex items-center gap-2">
                        {t("schedule.rehearsal.details.materials_button", "Materiały")}
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </Button>
                  </GlassCard>
                </div>
              </div>

              {/* desktop action buttons inside expanded — hidden on mobile (bottom row handles it) */}
              {viewMode === "UPCOMING" && (
                <div className="hidden sm:flex gap-2 px-6 pb-5 pt-0 justify-end border-t border-ethereal-incense/10">
                  {maskedStatus !== "PRESENT" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleConfirmPresence}
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      leftIcon={!isSubmitting ? <Check size={13} aria-hidden="true" /> : undefined}
                      className="bg-ethereal-sage border-ethereal-sage hover:bg-ethereal-sage/80"
                    >
                      {t("schedule.rehearsal.action.confirm_short", "Potwierdź")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={enableReportingMode}
                    className={cn(
                      isExcusedOrLate ? "" : "text-ethereal-crimson hover:border-ethereal-crimson/30",
                    )}
                    leftIcon={<AlertCircle size={13} aria-hidden="true" />}
                  >
                    {currentMaskedStatus
                      ? t("schedule.rehearsal.action.edit", "Edytuj")
                      : t("schedule.rehearsal.action.report_issue", "Zgłoś problem")}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};

export default TimelineRehearsalCard;
