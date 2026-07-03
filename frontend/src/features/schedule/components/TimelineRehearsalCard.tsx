import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
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
import { AbsenceReportForm } from "./AbsenceReportForm";
import { AddToCalendar } from "./AddToCalendar";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
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

// A left accent strip in the status colour gives the (deliberately plainer)
// rehearsal card a clear identity and at-a-glance state, alongside the textual
// status badge (colour is never the only signal).
const statusAccent = (s: string | null | undefined) => {
  if (s === "PRESENT") return "border-l-ethereal-sage";
  if (s === "LATE") return "border-l-ethereal-incense";
  if (s === "ABSENT") return "border-l-ethereal-crimson";
  return "border-l-ethereal-gold/40";
};

interface RehearsalActionsProps {
  maskedStatus: string | null | undefined;
  currentMaskedStatus: string | null | undefined;
  isSubmitting: boolean;
  // The handlers need the click event (they stopPropagation under the card's
  // stretched toggle), so they take a MouseEvent — not a bare `() => void`.
  onConfirm: (event: React.MouseEvent) => void;
  onReport: (event: React.MouseEvent) => void;
  /** Mobile: full-width stacked, long label. Desktop: hug, short label. */
  fullWidth?: boolean;
}

// Single source of truth for the RSVP pair — placed full-width at the foot of
// the collapsed card on touch, and hugging-right inside the expanded panel on
// desktop. One definition, so the two placements can never drift apart.
const RehearsalActions = ({
  maskedStatus,
  currentMaskedStatus,
  isSubmitting,
  onConfirm,
  onReport,
  fullWidth = false,
}: RehearsalActionsProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <>
      {maskedStatus !== "PRESENT" && (
        <Button
          variant="primary"
          size="touch"
          onClick={onConfirm}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          leftIcon={!isSubmitting ? <Check size={13} aria-hidden="true" /> : undefined}
          className={cn(
            "bg-ethereal-sage border-ethereal-sage hover:bg-ethereal-sage/80",
            fullWidth && "w-full",
          )}
        >
          {fullWidth
            ? t("schedule.rehearsal.action.confirm_long", "Potwierdź Obecność")
            : t("schedule.rehearsal.action.confirm_short", "Potwierdź")}
        </Button>
      )}
      <Button
        variant="outline"
        size="touch"
        onClick={onReport}
        leftIcon={<AlertCircle size={13} aria-hidden="true" />}
        className={cn(
          fullWidth && "w-full",
          maskedStatus === "ABSENT" &&
            "text-ethereal-crimson hover:border-ethereal-crimson/30",
        )}
      >
        {currentMaskedStatus
          ? t("schedule.rehearsal.action.edit", "Edytuj")
          : t("schedule.rehearsal.action.report_issue", "Zgłoś problem")}
      </Button>
    </>
  );
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

  const maskedStatus = currentMaskedStatus;
  // A conductor sees the rehearsal but isn't cast in it — no participation to
  // RSVP against, so the self-attendance controls are withheld.
  const canRsvp = !!event.participationId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group relative"
    >
      <GlassCard
        variant="ethereal"
        padding="none"
        isHoverable={false}
        className={cn(
          "overflow-hidden border-l-[3px] transition-all duration-300",
          statusAccent(maskedStatus),
          isExpanded
            ? "ring-1 ring-ethereal-gold/25"
            : "hover:ring-1 hover:ring-ethereal-gold/15",
        )}
      >
        {/* ── main row ─────────────────────────────────────────────── */}
        <div className="relative flex items-stretch rounded-xl">
          {/* stretched click-layer (real <button>, sits under the location
              badge) — toggles the inline detail without nesting controls */}
          <button
            type="button"
            onClick={() => { if (!reportingMode) onToggle(); }}
            aria-expanded={isExpanded}
            aria-label={t("schedule.rehearsal.toggle_detail", "Pokaż szczegóły próby: {{title}}", {
              title: event.title,
            })}
            className="absolute inset-0 z-[1] cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
          />
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
              className="line-clamp-2"
            >
              {event.title}
            </Heading>

            {/* meta */}
            <div className="flex flex-wrap items-center gap-3 mt-0.5">
              <DualTimeDisplay
                value={event.date_time}
                timeZone={tz}
                icon={<Clock size={13} className="text-ethereal-gold" aria-hidden="true" />}
                containerClassName="flex items-center gap-1.5"
                primaryTimeClassName="flex items-center gap-1.5 font-semibold text-ethereal-ink"
                localTimeClassName="text-[10px] text-ethereal-graphite/50 font-medium normal-case tracking-normal pl-1.5"
              />
              <span className="relative z-[2] flex min-w-0 max-w-full">
                <LocationPreview
                  locationRef={event.location}
                  fallback={t("schedule.rehearsal.no_location", "Brak")}
                  variant="minimal"
                />
              </span>
            </div>
          </div>

          {/* chevron (decorative — stretched button owns the toggle) */}
          <div className="shrink-0 flex items-center pr-4">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-full bg-ethereal-ink/[0.04] p-1.5 text-ethereal-incense/40 transition-colors group-hover:bg-ethereal-gold/10 group-hover:text-ethereal-gold"
            >
              <ChevronDown size={16} aria-hidden="true" />
            </motion.div>
          </div>
        </div>

        {/* ── action buttons — mobile: stacked full-width (no clipping),
             desktop: sidebar inside the expanded panel ─────────────────── */}
        {viewMode === "UPCOMING" && canRsvp && !reportingMode && (
          <div className="flex flex-col gap-2 px-4 pb-4 pt-0 sm:hidden">
            <RehearsalActions
              fullWidth
              maskedStatus={maskedStatus}
              currentMaskedStatus={currentMaskedStatus}
              isSubmitting={isSubmitting}
              onConfirm={handleConfirmPresence}
              onReport={enableReportingMode}
            />
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
              <AbsenceReportForm
                reportForm={reportForm}
                setReportForm={setReportForm}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmitReport}
                onCancel={() => setReportingMode(false)}
              />
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
                      <Text size="base" color="default" className="italic font-serif whitespace-pre-wrap leading-relaxed">
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

              {viewMode === "UPCOMING" && (
                <div className="px-4 sm:px-6 pb-4">
                  <AddToCalendar event={event} tone="light" />
                </div>
              )}

              {/* desktop action buttons inside expanded — hidden on mobile (bottom row handles it) */}
              {viewMode === "UPCOMING" && canRsvp && (
                <div className="hidden sm:flex gap-2 px-6 pb-5 pt-0 justify-end border-t border-ethereal-incense/10">
                  <RehearsalActions
                    maskedStatus={maskedStatus}
                    currentMaskedStatus={currentMaskedStatus}
                    isSubmitting={isSubmitting}
                    onConfirm={handleConfirmPresence}
                    onReport={enableReportingMode}
                  />
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
