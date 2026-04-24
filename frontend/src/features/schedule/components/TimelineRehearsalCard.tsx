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
  ChevronUp,
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

  const getStatusBadge = (status: string | null | undefined) => {
    const masked = status === "EXCUSED" ? "ABSENT" : status;
    switch (masked) {
      case "PRESENT":
        return (
          <Eyebrow
            as="span"
            color="sage"
            className="px-2 py-0.5 bg-ethereal-sage/10 rounded border border-ethereal-sage/20 flex items-center gap-1"
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            {t("schedule.rehearsal.status_present", "Potwierdzona")}
          </Eyebrow>
        );
      case "LATE":
        return (
          <Eyebrow
            as="span"
            color="incense"
            className="px-2 py-0.5 bg-ethereal-incense/10 rounded border border-ethereal-incense/20 flex items-center gap-1"
          >
            <Clock size={12} aria-hidden="true" />
            {t("schedule.rehearsal.status_late", "Spóźnienie")}
          </Eyebrow>
        );
      case "ABSENT":
        return (
          <Eyebrow
            as="span"
            color="crimson"
            className="px-2 py-0.5 bg-ethereal-crimson/10 rounded border border-ethereal-crimson/20 flex items-center gap-1"
          >
            <XCircle size={12} aria-hidden="true" />
            {t("schedule.rehearsal.status_absent", "Nieobecność")}
          </Eyebrow>
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
        className={cn(
          "hidden sm:block absolute left-4 md:left-6.75 top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-ethereal-parchment z-10 transition-all duration-500",
          isExcusedOrLate
            ? "bg-ethereal-incense border-ethereal-incense"
            : currentMaskedStatus === "PRESENT"
              ? "bg-ethereal-sage border-ethereal-sage"
              : "bg-ethereal-marble border-ethereal-incense/40 group-hover:border-ethereal-amethyst",
        )}
      />

      <GlassCard
        variant="ethereal"
        padding="none"
        isHoverable={false}
        className={cn(
          "transition-all duration-300",
          isExpanded
            ? "border-ethereal-amethyst/30"
            : "hover:border-ethereal-amethyst/20",
        )}
      >
        <div className="flex flex-col md:flex-row items-stretch">
          <div
            className={cn(
              "w-full md:w-28 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-dashed border-ethereal-incense/20 transition-colors cursor-pointer",
              currentMaskedStatus === "PRESENT"
                ? "bg-ethereal-sage/5"
                : isExcusedOrLate
                  ? "bg-ethereal-alabaster"
                  : "bg-ethereal-amethyst/5 group-hover:bg-ethereal-amethyst/10",
            )}
            onClick={() => {
              if (!reportingMode) onToggle();
            }}
          >
            <Eyebrow
              as="span"
              color={
                currentMaskedStatus === "PRESENT"
                  ? "sage"
                  : isExcusedOrLate
                    ? "muted"
                    : "amethyst"
              }
            >
              {formatLocalizedDate(
                event.date_time,
                { month: "short" },
                undefined,
                tz,
              )}
            </Eyebrow>
            <Heading
              as="span"
              size="3xl"
              weight="black"
              color={
                currentMaskedStatus === "PRESENT"
                  ? "sage"
                  : isExcusedOrLate
                    ? "graphite"
                    : "amethyst"
              }
              className="leading-none my-0.5"
            >
              {formatLocalizedDate(
                event.date_time,
                { day: "numeric" },
                undefined,
                tz,
              )}
            </Heading>
            <Eyebrow as="span" color="muted" className="mt-0.5">
              {formatLocalizedDate(
                event.date_time,
                { weekday: "short" },
                undefined,
                tz,
              )}
            </Eyebrow>
          </div>

          <div
            className="flex-1 p-4 md:p-5 flex flex-col justify-center cursor-pointer relative"
            onClick={() => {
              if (!reportingMode) onToggle();
            }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
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
                  className="px-2 py-0.5 bg-ethereal-incense/10 rounded border border-ethereal-incense/20 shadow-glass-ethereal"
                >
                  {t("schedule.rehearsal.optional", "Opcjonalna")}
                </Eyebrow>
              )}
              {getStatusBadge(event.status)}
            </div>
            <Heading
              as="h3"
              size="xl"
              weight="bold"
              color={isExcusedOrLate ? "graphite" : "default"}
              truncate
              className="max-w-xl"
            >
              {event.title}
            </Heading>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <DualTimeDisplay
                value={event.date_time}
                timeZone={tz}
                icon={
                  <Clock
                    size={12}
                    className="text-ethereal-amethyst/60"
                    aria-hidden="true"
                  />
                }
                containerClassName="flex items-center gap-1.5"
                primaryTimeClassName="flex items-center gap-1.5"
                localTimeClassName="text-[9px] text-ethereal-graphite/50 font-medium normal-case tracking-normal pl-2"
              />
              <LocationPreview
                locationRef={event.location}
                fallback={t("schedule.rehearsal.no_location", "Brak")}
                variant="minimal"
              />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ethereal-incense/40 group-hover:text-ethereal-amethyst transition-colors">
              {isExpanded ? (
                <ChevronUp size={20} aria-hidden="true" />
              ) : (
                <ChevronDown size={20} aria-hidden="true" />
              )}
            </div>
          </div>

          {viewMode === "UPCOMING" && !reportingMode && (
            <div className="w-full md:w-48 p-4 border-t md:border-t-0 md:border-l border-ethereal-incense/15 bg-ethereal-alabaster/30 flex flex-row md:flex-col gap-2 justify-center">
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
                  className="flex-1 md:flex-none bg-ethereal-sage border-ethereal-sage hover:bg-ethereal-sage/80"
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
                className={cn(
                  "flex-1 md:flex-none",
                  isExcusedOrLate
                    ? ""
                    : "text-ethereal-crimson hover:text-ethereal-crimson hover:border-ethereal-crimson/30",
                )}
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
              className="border-t border-ethereal-crimson/15 bg-ethereal-crimson/5"
            >
              <form onSubmit={handleSubmitReport} className="p-5 md:p-6">
                <Eyebrow
                  as="h4"
                  color="crimson"
                  className="mb-4 flex items-center gap-1.5"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {t(
                    "schedule.rehearsal.form.title",
                    "Formularz nieobecności dla Inspektora",
                  )}
                </Eyebrow>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="sm:col-span-1">
                    <Select
                      variant="glass"
                      label={t(
                        "schedule.rehearsal.form.status_label",
                        "Status *",
                      )}
                      value={reportForm.status}
                      onChange={(e) =>
                        setReportForm({
                          ...reportForm,
                          status: e.target.value as Extract<
                            AttendanceStatus,
                            "ABSENT" | "LATE"
                          >,
                        })
                      }
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
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Eyebrow as="label" color="muted" className="mb-1.5 ml-1 block">
                      {t(
                        "schedule.rehearsal.form.reason_label",
                        "Powód / Uwagi *",
                      )}
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
              className="border-t border-ethereal-incense/15 bg-ethereal-alabaster/20 relative z-0"
            >
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col h-full">
                  <Eyebrow
                    as="h4"
                    color="muted"
                    className="mb-3 flex items-center gap-1.5"
                  >
                    <AlignLeft size={14} aria-hidden="true" />
                    {t("schedule.rehearsal.details.focus_title", "Plan Pracy")}
                  </Eyebrow>
                  <GlassCard
                    variant="light"
                    padding="sm"
                    isHoverable={false}
                    className="flex-1 rounded-2xl"
                  >
                    {event.focus ? (
                      <Text
                        size="sm"
                        color="default"
                        className="italic font-serif whitespace-pre-wrap leading-relaxed"
                      >
                        {event.focus}
                      </Text>
                    ) : (
                      <Text size="sm" color="muted" className="italic">
                        {t(
                          "schedule.rehearsal.details.no_focus",
                          "Brak szczegółowego planu dla tej próby.",
                        )}
                      </Text>
                    )}
                  </GlassCard>
                  {(event.absences || 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ethereal-crimson/5 border border-ethereal-crimson/20 shadow-glass-ethereal w-max">
                      <UserMinus
                        size={14}
                        className="text-ethereal-crimson"
                        aria-hidden="true"
                      />
                      <Eyebrow as="span" color="crimson">
                        {t(
                          "schedule.rehearsal.details.reported_absences",
                          "Zgłoszone nieobecności:",
                        )}{" "}
                        {event.absences}
                      </Eyebrow>
                    </div>
                  )}
                </div>

                <div className="flex flex-col h-full">
                  <Eyebrow
                    as="h4"
                    color="muted"
                    className="mb-3 flex items-center gap-1.5"
                  >
                    <Music size={14} aria-hidden="true" />
                    {t(
                      "schedule.rehearsal.details.materials_title",
                      "Twoje Nuty",
                    )}
                  </Eyebrow>
                  <GlassCard
                    variant="solid"
                    padding="sm"
                    isHoverable={false}
                    className="flex-1 flex flex-col justify-center items-center text-center rounded-2xl"
                  >
                    <Text size="sm" weight="bold" color="default" className="mb-1">
                      {t(
                        "schedule.rehearsal.details.materials_subtitle",
                        "Przygotuj się do próby",
                      )}
                    </Text>
                    <Text size="sm" color="muted" className="mb-3 px-4">
                      {t(
                        "schedule.rehearsal.details.materials_desc",
                        "Pobierz nuty PDF i przećwicz swoje partie z odtwarzaczem.",
                      )}
                    </Text>
                    <Button variant="secondary" size="sm" asChild>
                      <Link
                        to="/panel/materials"
                        className="inline-flex items-center gap-2"
                      >
                        {t(
                          "schedule.rehearsal.details.materials_button",
                          "Materiały",
                        )}
                        <ArrowRight
                          size={14}
                          className="transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};

export default TimelineRehearsalCard;
