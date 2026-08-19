/**
 * @file NextEventHero.tsx
 * @description Spotlight for the chorister's next event — the answer to
 * "what's next and what do I need right now", with zero expanding.
 *
 * Two variants:
 *  - PROJECT  → dark concert card (call time, dress code, location, prep CTA)
 *  - REHEARSAL → light card with one-tap RSVP and the conductor's focus plan
 *
 * Both escalate as their moment arrives, because this card is the whole surface
 * then: the schedule feed hands the very next event to the spotlight and renders
 * everything *after* it, so on the day of a concert there is no second card to
 * open. When a rehearsal is imminent or running (−2h … +3h) it becomes Rehearsal
 * Mode — tonight's programme with one-tap jumps into the Songbook plus a Web
 * Audio pitch pipe. On the day of a concert it opens the day: where the door is,
 * whom to call, and the run sheet the printed card draws.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlignLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  ListMusic,
  Music2,
  Shirt,
  Sparkles,
  Radio,
} from "lucide-react";

import type { AttendanceStatus, ProgramItem, Project, Rehearsal } from "@/shared/types";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { ProjectService } from "@/features/projects/api/project.service";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { cn } from "@/shared/lib/utils";
import { useNow } from "@/shared/lib/dom/useNow";
import { resolveImminence } from "@/features/logistics/constants/eventImminence";
import { buildProjectDayTimeline } from "@/features/projects/lib/dayTimeline";
import { getEventMomentPresentation } from "@/features/projects/lib/projectPresentation";

import type { AbsenceRangeControls, TimelineEvent } from "../types/schedule.dto";
import { ScheduleService } from "../api/schedule.service";
import { useTimelineRehearsalCard } from "../hooks/useTimelineRehearsalCard";
import { useScheduleProgramItems } from "../api/schedule.queries";
import { useProjectReadiness } from "../hooks/useProjectReadiness";
import { AbsenceReportForm } from "./AbsenceReportForm";
import { ConcertDayPlan, hasConcertDayPlan } from "./ConcertDayPlan";
import { OnSiteFacts, hasOnSiteFacts } from "./OnSiteFacts";
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

/**
 * Takes the caller's clock rather than starting its own: both heroes already
 * hold one to decide which mode they are in, and a card whose countdown and
 * whose mode disagree about what time it is reads worse than a stale one.
 */
const useCountdownLabel = (date: Date, now: Date): string => {
  const { t } = useTranslation();
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
  /** Lets the absence form answer for a run of days, not just this evening. */
  absenceRange?: AbsenceRangeControls;
}

export const NextEventHero = ({
  event,
  onSubmitReport,
  absenceRange,
}: NextEventHeroProps): React.JSX.Element =>
  event.type === "PROJECT" ? (
    <ProjectHero event={event} />
  ) : (
    <RehearsalHero
      event={event}
      onSubmitReport={onSubmitReport}
      absenceRange={absenceRange}
    />
  );

/* ── concert spotlight ────────────────────────────────────────────────── */

const ProjectHero = ({ event }: { event: TimelineEvent }): React.JSX.Element => {
  const { t } = useTranslation();
  const proj = event.rawObj as Project;
  const now = useNow();
  const countdown = useCountdownLabel(event.date_time, now);
  const readiness = useProjectReadiness(event.project_id, true);
  // Both documents below are fetched as the CALLER: the day sheet is written
  // per audience by the server (a manager would get their own production copy,
  // not the singer's), and the score carries the caller's watermark. In a
  // preview they stay on screen — that they exist is the answer — and refuse to
  // open, rather than opening the wrong person's document under the right name.
  const { isPreview } = useArtistPreview();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  // The day the card stops being a countdown and starts being the surface
  // somebody opens while standing outside the church, having forgotten which
  // door it was. The bucket is `resolveImminence`'s, so "today" means the same
  // thing here as on the logistics atlas.
  const isConcertDay = resolveImminence(event.date_time, now) === "TODAY";
  const eventMomentLabel = getEventMomentPresentation(proj.event_kind);
  const eventMoment = t(
    eventMomentLabel.labelKey,
    eventMomentLabel.fallbackLabel,
  );
  const dayEntries = useMemo(() => buildProjectDayTimeline(proj), [proj]);
  const showOnSite = hasOnSiteFacts(proj);
  const showDayPlan = hasConcertDayPlan(dayEntries);
  const fetchScoreBlob = useCallback(
    () => ProjectService.fetchScorePdfBlob(String(proj.id)),
    [proj.id],
  );
  // Written for this reader by the server — their voice, their casting, in
  // their language. It belongs on the spotlight rather than three taps down in
  // the event sheet, because the morning of the concert is when it is opened.
  const fetchDaySheetBlob = useCallback(
    () => ScheduleService.exportDaySheet(proj.id),
    [proj.id],
  );
  const daySheetFileName = `Karta_${proj.title.replace(/\s+/g, "_")}.pdf`;
  const daySheetTitle = t("schedule.day_sheet.title", "Karta dnia");

  return (
    <>
    <GlassCard variant="dark" glow withNoise isHoverable={false} padding="none">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* `pulse` is the panel's one live signal, and this is a state that
              genuinely expires: at midnight the concert is no longer today. */}
          <Badge
            variant="warning"
            pulse={isConcertDay}
            icon={<Sparkles size={11} aria-hidden="true" />}
          >
            {/* The event names itself; "dziś"/"wkrótce" only place it. Written as
                a colon phrase rather than "Najbliższy {{event}}" because Polish
                agrees the adjective with the noun's gender and French its
                article — neither survives one slot filled from a table. */}
            {isConcertDay
              ? t("schedule.hero.event_today", "Dziś: {{event}}", { event: eventMoment })
              : t("schedule.hero.event_upcoming", "Wkrótce: {{event}}", {
                  event: eventMoment,
                })}
          </Badge>
          <Badge variant="incense">{countdown}</Badge>
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
            divider
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
              divider
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

      {/* ── concert day: the card opens the day it is about ──────────── */}
      {isConcertDay && (showOnSite || showDayPlan) && (
        <div className="grid gap-5 border-t border-ethereal-incense/15 bg-ethereal-ink/20 p-4 sm:grid-cols-2 sm:p-6">
          {showOnSite && <OnSiteFacts project={proj} />}
          {showDayPlan && (
            <div className="min-w-0">
              <Eyebrow color="parchment" className="mb-3 block">
                {t("schedule.card.run_sheet_title", "Harmonogram Dnia")}
              </Eyebrow>
              {/* Capped like the rehearsal programme below: a long day must not
                  push the card's own actions off the screen it is opened on.
                  The cap sits on a wrapper, not on the plan — the plan hangs its
                  dots outside its own padding box, and an overflow there would
                  clip them. */}
              <div className="max-h-[50dvh] overflow-y-auto overscroll-contain no-scrollbar">
                <ConcertDayPlan entries={dayEntries} eventKind={proj.event_kind} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ethereal-incense/15 bg-ethereal-ink/30 px-5 py-3 sm:px-6">
        {readiness.hasData ? (
          <ReadinessRing readiness={readiness} to="/panel/materials" surface="dark" />
        ) : (
          <Text size="xs" color="parchment-muted" className="max-w-xs text-ethereal-parchment/70">
            {t(
              "schedule.hero.day_hint",
              "Karta dnia zbiera wszystko o tym dniu: zbiórkę, przebieg i Twoją obsadę.",
            )}
          </Text>
        )}
        <div
          inert={isPreview}
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            isPreview && "opacity-55",
          )}
        >
          {/* The day sheet leads: it is the only one of these written for this
              singer, and the only one that answers "where do I stand, and
              when". */}
          <Button
            variant="secondary"
            size="touch"
            leftIcon={<ClipboardList size={14} aria-hidden="true" />}
            onClick={() => setDaySheetOpen(true)}
            aria-label={t(
              "schedule.day_sheet.open_aria",
              "Otwórz kartę dnia (PDF)",
            )}
          >
            {daySheetTitle}
          </Button>
          {proj.score_pdf && (
            <Button
              variant="secondary"
              size="touch"
              leftIcon={<BookOpen size={14} aria-hidden="true" />}
              onClick={() => setScoreOpen(true)}
            >
              {t("schedule.hero.score_cta", "Partytura")}
            </Button>
          )}
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

    <PdfViewerModal
      isOpen={daySheetOpen}
      title={daySheetTitle}
      subtitle={proj.title}
      fileName={daySheetFileName}
      fetchBlob={fetchDaySheetBlob}
      docKey={`day-sheet-hero-${proj.id}`}
      volatile
      fullView={{
        type: "project-day-sheet",
        id: proj.id,
        hint: {
          title: daySheetTitle,
          subtitle: proj.title,
          fileName: daySheetFileName,
        },
      }}
      onClose={() => setDaySheetOpen(false)}
    />

    {proj.score_pdf && (
      <PdfViewerModal
        isOpen={scoreOpen}
        title={t("schedule.card.score_pdf_modal_title", "Partytura")}
        subtitle={proj.title}
        fileName={`Score_${proj.title.replace(/\s+/g, "_")}.pdf`}
        fetchBlob={fetchScoreBlob}
        docKey={`score-hero-${proj.id}-${proj.updated_at ?? ""}`}
        fullView={{
          type: "project-score",
          id: proj.id,
          hint: {
            title: t("schedule.card.score_pdf_modal_title", "Partytura"),
            subtitle: proj.title,
            fileName: `Score_${proj.title.replace(/\s+/g, "_")}.pdf`,
          },
        }}
        onClose={() => setScoreOpen(false)}
      />
    )}
    </>
  );
};

/* ── rehearsal spotlight + rehearsal mode ─────────────────────────────── */

const RehearsalHero = ({
  event,
  onSubmitReport,
  absenceRange,
}: NextEventHeroProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reh = event.rawObj as Rehearsal;
  const now = useNow();
  const countdown = useCountdownLabel(event.date_time, now);
  const isLive = isRehearsalLive(event, now);
  // See TimelineRehearsalCard: a manager may write anybody's attendance, so a
  // live RSVP here would record the singer's answer for real.
  const { isPreview } = useArtistPreview();
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
    range,
  } = useTimelineRehearsalCard(
    event,
    onSubmitReport,
    () => undefined,
    false,
    absenceRange,
  );

  const { data: programItems = [], isLoading: isProgramLoading } =
    useScheduleProgramItems(event.project_id, isLive);

  // A conductor sees the rehearsal but isn't cast in it — no participation to
  // RSVP against, so the self-attendance controls are withheld.
  const canRsvp = !!event.participationId;

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
          {/* `pulse` is the panel's one live signal and this is the state that
              earns it: a rehearsal actually under way, which stops being true
              within the hour. */}
          {isLive ? (
            <Badge variant="warning" pulse>
              {t("schedule.hero.rehearsal_mode", "Tryb próby")}
            </Badge>
          ) : (
            <Badge variant="brand">
              {t("schedule.hero.next_rehearsal", "Najbliższa próba")}
            </Badge>
          )}
          <Badge variant="outline">{countdown}</Badge>
          {currentMaskedStatus === "PRESENT" && (
            <Badge
              variant="success"
              icon={<CheckCircle2 size={11} aria-hidden="true" />}
            >
              {t("schedule.rehearsal.status_present", "Potwierdzona")}
            </Badge>
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

        {/* RSVP — always one tap away, never behind an accordion. Withheld for
            a conductor (no participation), who keeps the calendar action. */}
        {!reportingMode && (
          <>
          {canRsvp && (
            <div
              inert={isPreview}
              className={cn(
                "mt-4 flex flex-col gap-2 sm:flex-row",
                isPreview && "opacity-55",
              )}
            >
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
          )}
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
              range={range}
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
            <div
              inert={isPreview}
              className={cn(
                "flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain no-scrollbar",
                isPreview && "opacity-55",
              )}
            >
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
