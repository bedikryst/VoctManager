/**
 * @file NextEventHero.tsx
 * @description Spotlight for the chorister's next event — the answer to
 * "what's next and what do I need right now", with zero expanding.
 *
 * Two variants:
 *  - PROJECT  → dark concert card (call time, dress code, location, prep CTA)
 *  - REHEARSAL → light card with one-tap RSVP and the conductor's focus plan
 *
 * When a rehearsal is imminent or running (−2h … +3h) the card escalates into
 * Rehearsal Mode: tonight's programme with one-tap jumps into the Songbook
 * piece pages plus a Web Audio pitch pipe.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlignLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ListMusic,
  Music2,
  Shirt,
  Sparkles,
  Radio,
} from "lucide-react";

import type { AttendanceStatus, ProgramItem, Project, Rehearsal } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { cn } from "@/shared/lib/utils";
import { useNow } from "@/shared/lib/dom/useNow";

import type { TimelineEvent } from "../types/schedule.dto";
import { useTimelineRehearsalCard } from "../hooks/useTimelineRehearsalCard";
import { useScheduleProgramItems } from "../api/schedule.queries";
import { useProjectReadiness } from "../hooks/useProjectReadiness";
import { AbsenceReportForm } from "./AbsenceReportForm";
import { ReadinessRing } from "./ReadinessRing";
import { AddToCalendar } from "./AddToCalendar";

const REHEARSAL_MODE_BEFORE_MS = 2 * 60 * 60 * 1000;
const REHEARSAL_MODE_AFTER_MS = 3 * 60 * 60 * 1000;

export const isRehearsalLive = (event: TimelineEvent, now: Date): boolean => {
  if (event.type !== "REHEARSAL") return false;
  const start = event.date_time.getTime();
  return (
    now.getTime() >= start - REHEARSAL_MODE_BEFORE_MS &&
    now.getTime() <= start + REHEARSAL_MODE_AFTER_MS
  );
};

const useCountdownLabel = (date: Date): string => {
  const { t } = useTranslation();
  const now = useNow();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return t("schedule.hero.countdown.now", "Trwa teraz");
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60)
    return t("schedule.hero.countdown.minutes", "Za {{count}} min", {
      count: minutes,
    });
  const hours = Math.round(minutes / 60);
  if (hours < 24)
    return t("schedule.hero.countdown.hours", "Za {{count}} godz.", {
      count: hours,
    });
  const days = Math.round(hours / 24);
  if (days === 1) return t("schedule.hero.countdown.tomorrow", "Jutro");
  return t("schedule.hero.countdown.days", "Za {{count}} dni", { count: days });
};

interface NextEventHeroProps {
  event: TimelineEvent;
  onSubmitReport: (
    eventId: string,
    projectId: string | number,
    status: AttendanceStatus,
    notes: string,
  ) => Promise<boolean>;
}

export const NextEventHero = ({
  event,
  onSubmitReport,
}: NextEventHeroProps): React.JSX.Element =>
  event.type === "PROJECT" ? (
    <ProjectHero event={event} />
  ) : (
    <RehearsalHero event={event} onSubmitReport={onSubmitReport} />
  );

/* ── concert spotlight ────────────────────────────────────────────────── */

const ProjectHero = ({ event }: { event: TimelineEvent }): React.JSX.Element => {
  const { t } = useTranslation();
  const proj = event.rawObj as Project;
  const countdown = useCountdownLabel(event.date_time);
  const readiness = useProjectReadiness(event.project_id, true);

  return (
    <GlassCard variant="dark" glow withNoise isHoverable={false} padding="none">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow
            as="span"
            color="gold"
            className="flex items-center gap-1.5 rounded-md border border-ethereal-gold/40 bg-ethereal-gold/15 px-2.5 py-1"
          >
            <Sparkles size={11} aria-hidden="true" />
            {t("schedule.hero.next_concert", "Najbliższy koncert")}
          </Eyebrow>
          <Eyebrow
            as="span"
            color="parchment"
            className="rounded-md border border-ethereal-incense/40 bg-ethereal-incense/20 px-2.5 py-1"
          >
            {countdown}
          </Eyebrow>
        </div>

        <Heading
          as="h2"
          size="3xl"
          weight="bold"
          color="white"
          className="mt-3 text-2xl leading-tight sm:text-3xl"
        >
          {event.title}
        </Heading>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DualTimeDisplay
            value={event.date_time}
            timeZone={proj.timezone}
            icon={<Clock size={11} aria-hidden="true" />}
            variant="dark"
            containerClassName="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ethereal-incense/20 text-ethereal-parchment border border-ethereal-incense/40"
            primaryTimeClassName="flex items-center gap-1.5 font-medium"
            localTimeClassName="text-[10px] text-ethereal-parchment/70 border-l border-ethereal-incense/50 pl-1.5"
          />
          {proj.call_time && (
            <DualTimeDisplay
              value={proj.call_time}
              timeZone={proj.timezone}
              label={t("schedule.card.call_time", "Zbiórka: ")}
              icon={<Clock size={11} aria-hidden="true" />}
              variant="dark"
              containerClassName="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ethereal-gold/20 text-ethereal-parchment border border-ethereal-gold/40"
              primaryTimeClassName="flex items-center gap-1.5 font-medium"
              localTimeClassName="text-[10px] text-ethereal-parchment/70 border-l border-ethereal-gold/40 pl-1.5"
            />
          )}
          <LocationPreview
            locationRef={event.location}
            fallback={t("schedule.card.no_location", "Brak lok.")}
            variant="badge"
            className="text-ethereal-parchment/80 border-ethereal-incense/30 bg-ethereal-incense/10"
          />
        </div>

        {(proj.dress_code_female || proj.dress_code_male) && (
          <div className="mt-4 rounded-2xl border border-ethereal-incense/20 bg-ethereal-incense/10 p-3.5">
            <Eyebrow color="parchment" className="mb-1.5 flex items-center gap-1.5">
              <Shirt size={12} aria-hidden="true" />
              {t("schedule.card.dress_code_title", "Szczegóły ubioru")}
            </Eyebrow>
            <div className="space-y-0.5">
              {proj.dress_code_female && (
                <Text size="sm" color="white">
                  <Text as="span" color="parchment-muted" className="mr-2">
                    {t("schedule.card.dress_code_women", "Panie:")}
                  </Text>
                  {proj.dress_code_female}
                </Text>
              )}
              {proj.dress_code_male && (
                <Text size="sm" color="white">
                  <Text as="span" color="parchment-muted" className="mr-2">
                    {t("schedule.card.dress_code_men", "Panowie:")}
                  </Text>
                  {proj.dress_code_male}
                </Text>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ethereal-incense/15 bg-ethereal-ink/30 px-5 py-3 sm:px-6">
        {readiness.hasData ? (
          <ReadinessRing readiness={readiness} to="/panel/materials" surface="dark" />
        ) : (
          <Text size="xs" color="parchment-muted" className="max-w-xs text-ethereal-parchment/70">
            {t(
              "schedule.hero.concert_hint",
              "Szczegóły dnia koncertu znajdziesz na karcie wydarzenia poniżej.",
            )}
          </Text>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <AddToCalendar event={event} tone="dark" />
          {!readiness.hasData && (
            <Button variant="secondary" size="touch" asChild>
              <Link to="/panel/materials" className="inline-flex items-center gap-2">
                {t("schedule.hero.prepare_cta", "Śpiewnik")}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

/* ── rehearsal spotlight + rehearsal mode ─────────────────────────────── */

const RehearsalHero = ({
  event,
  onSubmitReport,
}: NextEventHeroProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reh = event.rawObj as Rehearsal;
  const now = useNow();
  const countdown = useCountdownLabel(event.date_time);
  const isLive = isRehearsalLive(event, now);
  const [isPitchPipeOpen, setIsPitchPipeOpen] = useState(false);

  const {
    reportingMode,
    setReportingMode,
    isSubmitting,
    currentMaskedStatus,
    reportForm,
    setReportForm,
    handleConfirmPresence,
    handleSubmitReport,
    enableReportingMode,
  } = useTimelineRehearsalCard(event, onSubmitReport, () => undefined, false);

  const { data: programItems = [], isLoading: isProgramLoading } =
    useScheduleProgramItems(event.project_id, isLive);

  return (
    <GlassCard
      variant="ethereal"
      isHoverable={false}
      padding="none"
      className={cn(
        "border-t-2",
        isLive ? "border-t-ethereal-gold" : "border-t-ethereal-incense/40",
      )}
    >
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? (
            <Eyebrow
              as="span"
              color="gold"
              className="flex items-center gap-1.5 rounded-md border border-ethereal-gold/30 bg-ethereal-gold/10 px-2.5 py-1"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ethereal-gold opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ethereal-gold" />
              </span>
              {t("schedule.hero.rehearsal_mode", "Tryb próby")}
            </Eyebrow>
          ) : (
            <Eyebrow
              as="span"
              color="default"
              className="rounded-md border border-ethereal-ink/10 bg-ethereal-ink/[0.04] px-2.5 py-1"
            >
              {t("schedule.hero.next_rehearsal", "Najbliższa próba")}
            </Eyebrow>
          )}
          <Eyebrow
            as="span"
            color="muted"
            className="rounded-md border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1 shadow-glass-ethereal"
          >
            {countdown}
          </Eyebrow>
          {currentMaskedStatus === "PRESENT" && (
            <Eyebrow
              as="span"
              color="sage"
              className="flex items-center gap-1 rounded-md border border-ethereal-sage/20 bg-ethereal-sage/10 px-2.5 py-1"
            >
              <CheckCircle2 size={11} aria-hidden="true" />
              {t("schedule.rehearsal.status_present", "Potwierdzona")}
            </Eyebrow>
          )}
        </div>

        <Heading as="h2" size="2xl" weight="bold" className="mt-3 leading-tight">
          {event.title}
        </Heading>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <DualTimeDisplay
            value={event.date_time}
            timeZone={reh.timezone}
            icon={<Clock size={11} className="text-ethereal-gold/70" aria-hidden="true" />}
            containerClassName="flex items-center gap-1.5"
            primaryTimeClassName="flex items-center gap-1.5"
            localTimeClassName="text-[10px] text-ethereal-graphite/50 font-medium normal-case tracking-normal pl-1.5"
          />
          <LocationPreview
            locationRef={event.location}
            fallback={t("schedule.rehearsal.no_location", "Brak")}
            variant="minimal"
          />
        </div>

        {event.focus && (
          <div className="mt-4 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 p-3.5">
            <Eyebrow color="muted" className="mb-1.5 flex items-center gap-1.5">
              <AlignLeft size={12} aria-hidden="true" />
              {t("schedule.rehearsal.details.focus_title", "Plan Pracy")}
            </Eyebrow>
            <Text size="md" className="whitespace-pre-wrap font-serif italic leading-relaxed">
              {event.focus}
            </Text>
          </div>
        )}

        {/* RSVP — always one tap away, never behind an accordion */}
        {!reportingMode && (
          <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {currentMaskedStatus !== "PRESENT" && (
              <Button
                variant="primary"
                size="touch"
                onClick={handleConfirmPresence}
                disabled={isSubmitting}
                isLoading={isSubmitting}
                leftIcon={!isSubmitting ? <Check size={13} aria-hidden="true" /> : undefined}
                className="w-full bg-ethereal-sage border-ethereal-sage hover:bg-ethereal-sage/80 sm:w-auto"
              >
                {t("schedule.rehearsal.action.confirm_long", "Potwierdź Obecność")}
              </Button>
            )}
            <Button
              variant="outline"
              size="touch"
              onClick={enableReportingMode}
              leftIcon={<AlertCircle size={13} aria-hidden="true" />}
              className={cn(
                "w-full sm:w-auto",
                // crimson reflects an *actual* reported absence — never a
                // default affordance (Ethereal: crimson = alarm only).
                currentMaskedStatus === "ABSENT" &&
                  "text-ethereal-crimson hover:border-ethereal-crimson/30",
              )}
            >
              {currentMaskedStatus
                ? t("schedule.rehearsal.action.edit", "Edytuj")
                : t("schedule.rehearsal.action.report_issue", "Zgłoś problem")}
            </Button>
          </div>
          <div className="mt-2">
            <AddToCalendar event={event} tone="light" />
          </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {reportingMode && (
          <motion.div
            key="hero-report-form"
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
      </AnimatePresence>

      {/* ── rehearsal mode: tonight's programme + pitch pipe ─────────── */}
      {isLive && (
        <div className="border-t border-ethereal-incense/15 bg-ethereal-parchment/30 p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Eyebrow color="muted" className="flex items-center gap-1.5">
              <ListMusic size={13} aria-hidden="true" />
              {t("schedule.hero.tonight_program", "Repertuar projektu")}
            </Eyebrow>
            <Button
              variant={isPitchPipeOpen ? "primary" : "outline"}
              size="sm"
              onClick={() => setIsPitchPipeOpen((prev) => !prev)}
              leftIcon={<Radio size={13} aria-hidden="true" />}
            >
              {t("schedule.pitch_pipe.title", "Kamerton")}
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {isPitchPipeOpen && (
              <motion.div
                key="pitch-pipe"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <PitchPipe className="mb-3" />
              </motion.div>
            )}
          </AnimatePresence>

          {isProgramLoading ? (
            <Text size="sm" color="muted" className="italic">
              {t("schedule.hero.program_loading", "Wczytywanie repertuaru...")}
            </Text>
          ) : programItems.length > 0 ? (
            <div className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain no-scrollbar">
              {[...programItems]
                .sort((a: ProgramItem, b: ProgramItem) => a.order - b.order)
                .map((item: ProgramItem) => (
                  <Link
                    key={item.id}
                    to={`/panel/materials/${event.project_id}/${item.piece}`}
                    className="flex items-center gap-3 rounded-xl border border-ethereal-marble bg-ethereal-alabaster px-3.5 py-2.5 shadow-glass-solid transition-all hover:border-ethereal-gold/40 hover:bg-ethereal-marble/40 active:scale-[0.99]"
                  >
                    <Eyebrow as="span" color="muted" className="w-5 shrink-0 text-center">
                      {item.order}.
                    </Eyebrow>
                    <Music2 size={13} className="shrink-0 text-ethereal-sage" aria-hidden="true" />
                    <Text size="sm" weight="semibold" truncate className="flex-1">
                      {item.piece_title ||
                        t("schedule.hero.untitled_piece", "Utwór")}
                    </Text>
                    <ChevronRight
                      size={15}
                      className="shrink-0 text-ethereal-graphite/35"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
            </div>
          ) : (
            <Text size="sm" color="muted" className="italic">
              {t("schedule.card.no_program", "Repertuar nie został jeszcze ustalony.")}
            </Text>
          )}
        </div>
      )}
    </GlassCard>
  );
};
