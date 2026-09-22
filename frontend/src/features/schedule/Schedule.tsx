import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import {
  CalendarHeart,
  History,
  CalendarClock,
  CalendarPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useArtistPreview } from "../../app/providers/ArtistPreviewProvider";
import { cn } from "@/shared/lib/utils";
import { INERT_SURFACE } from "@/shared/ui/primitives/inertSurface";
import { useScheduleData } from "./hooks/useScheduleData";
import { useScheduleSubject } from "./hooks/useScheduleSubject";
import { NextEventHero } from "./components/NextEventHero";
import { TimelineProjectCard } from "./components/TimelineProjectCard";
import { TimelineRehearsalCard } from "./components/TimelineRehearsalCard";
import { SeasonRibbon } from "./components/SeasonRibbon";
import { MyAttendancePanel } from "./components/MyAttendancePanel";
import { dayKey, groupEventsByDay, relativeDayLabel } from "./lib/groupByDay";
import { buildSeasonPulse } from "./lib/seasonPulse";
import { Button } from "@/shared/ui/primitives/Button";
import { DayDivider } from "@/shared/ui/composites/DayDivider";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { useNow } from "@/shared/lib/dom/useNow";

/** Past by the same four-hour grace the two tabs below divide on. */
const PAST_GRACE_MS = 4 * 60 * 60 * 1000;

const TABS = [
  { id: "UPCOMING" as const, labelKey: "schedule.tabs.upcoming", fallback: "Nadchodzące", Icon: CalendarClock },
  { id: "PAST" as const,     labelKey: "schedule.tabs.past",     fallback: "Historia",     Icon: History },
];

export default function Schedule(): React.JSX.Element {
  const { t } = useTranslation();
  const { isPreview } = useArtistPreview();
  const now = useNow(60_000);
  const subject = useScheduleSubject();
  const {
    isLoading,
    viewMode,
    setViewMode,
    expandedEventId,
    setExpandedEventId,
    filteredEvents,
    visibleEvents,
    hasMorePast,
    loadMorePast,
    attendanceStats,
    handleAbsenceSubmit,
    absenceRange,
    artistId,
    allEvents,
  } = useScheduleData(subject);

  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRehearsalId = searchParams.get("rehearsal");
  const pendingScrollId = useRef<string | null>(null);

  const handleTabChange = (id: "UPCOMING" | "PAST") => {
    setViewMode(id);
    setExpandedEventId(null);
    setActiveDayKey(null);
  };

  // The very next event keeps the hero spotlight; everything else is grouped
  // into day buckets so the feed reads like a calendar, not a faux-timeline.
  const heroEvent = viewMode === "UPCOMING" ? (visibleEvents[0] ?? null) : null;
  const timelineEvents = heroEvent ? visibleEvents.slice(1) : visibleEvents;

  const dayGroups = useMemo(
    () => groupEventsByDay(timelineEvents),
    [timelineEvents],
  );
  const seasonDays = useMemo(
    () => (viewMode === "UPCOMING" ? buildSeasonPulse(filteredEvents) : []),
    [filteredEvents, viewMode],
  );

  // A notice about ONE evening lands here as `?rehearsal=<id>`. The season
  // stays on screen — a new or moved date only means something read against
  // the other dates — but the reader is not left hunting the card they were
  // just told about: the right tab opens, the card unfolds, the page scrolls
  // to it. The parameter is spent on arrival, so a tab change afterwards does
  // not drag them back, and a reload does not re-open what they closed.
  useEffect(() => {
    if (isLoading || !requestedRehearsalId) return;

    const target = allEvents.find(
      (candidate) =>
        candidate.type === "REHEARSAL" &&
        String((candidate.rawObj as { id: string }).id) === requestedRehearsalId,
    );
    setSearchParams(
      (prev) => {
        prev.delete("rehearsal");
        return prev;
      },
      { replace: true },
    );
    // Cancelled, or an evening this reader was dropped from: the schedule they
    // already have is the answer, and it is the truthful one.
    if (!target) return;

    setViewMode(
      target.date_time.getTime() < Date.now() - PAST_GRACE_MS
        ? "PAST"
        : "UPCOMING",
    );
    setExpandedEventId(target.id);
    pendingScrollId.current = target.id;
  }, [
    isLoading,
    requestedRehearsalId,
    allEvents,
    setSearchParams,
    setViewMode,
    setExpandedEventId,
  ]);

  // Runs after every render because the card only exists once the tab switch
  // and the expansion have painted; the ref makes every other pass a single
  // comparison. The spotlit evening has no card of its own — it IS the hero.
  useEffect(() => {
    const pending = pendingScrollId.current;
    if (!pending) return;
    const element =
      heroEvent?.id === pending
        ? document.getElementById("schedule-hero")
        : document.getElementById(`schedule-event-${pending}`);
    if (!element) return;
    pendingScrollId.current = null;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const scrollToDay = (key: string) => {
    setActiveDayKey(key);
    const heroKey = heroEvent ? dayKey(heroEvent.date_time) : null;
    const targetId = heroKey === key ? "schedule-hero" : `schedule-day-${key}`;
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The subscription lives in the reader's own settings, and a preview reader is
  // not the person this calendar belongs to — the link stays as evidence that
  // the singer has it, and goes nowhere.
  const subscribeLink = isPreview ? (
    <span
      inert
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1.5 shadow-glass-ethereal",
        INERT_SURFACE,
      )}
    >
      <CalendarPlus size={12} className="text-ethereal-gold" aria-hidden="true" />
      <Eyebrow color="default">
        {t("schedule.dashboard.subscribe_ics", "Subskrybuj kalendarz")}
      </Eyebrow>
    </span>
  ) : (
    <Link
      to="/panel/settings/calendar"
      className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1.5 shadow-glass-ethereal transition-all hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
    >
      <CalendarPlus size={12} className="text-ethereal-gold" aria-hidden="true" />
      <Eyebrow color="default">
        {t("schedule.dashboard.subscribe_ics", "Subskrybuj kalendarz")}
      </Eyebrow>
    </Link>
  );

  return (
    // Honour the OS "reduce motion" setting across the whole feed (cards,
    // ribbon, bottom-sheet via React context) — transforms collapse, opacity
    // crossfades stay. No-op for users who haven't asked for it.
    <MotionConfig reducedMotion="user">
    <PageTransition>
      {/* No own horizontal padding — the app shell already provides the gutter
          (16px mobile / sidebar-aware on desktop). Adding px here double-padded
          the feed to ~32px and made the cards read as a narrow island. */}
      <div className="relative mx-auto max-w-3xl pb-6 pt-6">
        <StaggeredBentoContainer className="flex min-w-0 flex-col gap-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              className="!mb-0"
              roleText={t("schedule.dashboard.subtitle", "Osobisty Kalendarz")}
              title={t("schedule.dashboard.title", "Mój")}
              titleHighlight={t("schedule.dashboard.title_highlight", "Harmonogram.")}
              rightContent={subscribeLink}
            />
          </StaggeredBentoItem>

          {isLoading ? (
            <StaggeredBentoItem>
              <EtherealLoader
                fullHeight={false}
                message={t("schedule.loading", "Pobieranie grafiku...")}
              />
            </StaggeredBentoItem>
          ) : (
            <>
              {/* ── next event spotlight ─────────────────────────────── */}
              {heroEvent && (
                <StaggeredBentoItem id="schedule-hero" className="scroll-mt-20">
                  <NextEventHero
                    event={heroEvent}
                    onSubmitReport={handleAbsenceSubmit}
                    absenceRange={absenceRange}
                  />
                </StaggeredBentoItem>
              )}

              {/* ── sticky tab switcher — a floating pill in the same glass
                   language as the cards (not a full-bleed white strip), so the
                   view control stays reachable without clashing with the feed ── */}
              <SegmentedTabs
                ariaLabel={t("schedule.tabs.aria_label", "Widok kalendarza")}
                items={TABS.map(({ id, labelKey, fallback, Icon }) => ({
                  id,
                  label: t(labelKey, fallback),
                  Icon,
                }))}
                value={viewMode}
                onChange={handleTabChange}
                className="sticky top-2 z-20 bg-ethereal-alabaster/85 shadow-glass-ethereal backdrop-blur-md"
              />

              {/* ── season pulse ribbon (upcoming only) ───────────────── */}
              {seasonDays.length > 0 && (
                <StaggeredBentoItem>
                  <SeasonRibbon
                    days={seasonDays}
                    now={now}
                    activeKey={activeDayKey}
                    onSelect={scrollToDay}
                  />
                </StaggeredBentoItem>
              )}

              {/* ── personal attendance mirror (history only) ─────────── */}
              {viewMode === "PAST" && attendanceStats.rate !== null && (
                <StaggeredBentoItem>
                  <MyAttendancePanel stats={attendanceStats} />
                </StaggeredBentoItem>
              )}

              {/* ── day-grouped feed ──────────────────────────────────── */}
              <StaggeredBentoItem>
                {dayGroups.length > 0 ? (
                  <div className="flex flex-col gap-5">
                    {dayGroups.map((group) => (
                      <div
                        key={group.key}
                        id={`schedule-day-${group.key}`}
                        className="flex scroll-mt-20 flex-col gap-3"
                      >
                        <DayDivider label={relativeDayLabel(group.date, now, t)} />
                        {/* The anchor a notice about one evening scrolls to.
                            It sits on a wrapper rather than the card so the
                            card keeps its own motion root. */}
                        {group.events.map((ev) => (
                          <div
                            key={ev.id}
                            id={`schedule-event-${ev.id}`}
                            className="scroll-mt-20"
                          >
                            {ev.type === "PROJECT" ? (
                              <TimelineProjectCard
                                event={ev}
                                isExpanded={expandedEventId === ev.id}
                                onToggle={() =>
                                  setExpandedEventId(
                                    expandedEventId === ev.id ? null : ev.id,
                                  )
                                }
                                artistId={artistId}
                              />
                            ) : (
                              <TimelineRehearsalCard
                                event={ev}
                                isExpanded={expandedEventId === ev.id}
                                onToggle={() =>
                                  setExpandedEventId(
                                    expandedEventId === ev.id ? null : ev.id,
                                  )
                                }
                                onSubmitReport={handleAbsenceSubmit}
                                absenceRange={absenceRange}
                                viewMode={viewMode}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    {hasMorePast && (
                      <div className="flex justify-center pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadMorePast}
                          leftIcon={<History size={13} aria-hidden="true" />}
                        >
                          {t("schedule.past.load_more", "Pokaż starsze")}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : heroEvent ? null : (
                  <StatePanel
                    icon={<CalendarHeart size={22} aria-hidden="true" />}
                    eyebrow={t("schedule.empty.title", "Brak wpisów w kalendarzu")}
                    title={
                      viewMode === "PAST"
                        ? t("schedule.empty.heading_past", "Pusta historia")
                        : t("schedule.empty.heading_upcoming", "Czysty horyzont")
                    }
                    description={t(
                      "schedule.empty.description",
                      "W tym widoku nie masz przypisanych żadnych spotkań ani koncertów.",
                    )}
                  />
                )}
              </StaggeredBentoItem>
            </>
          )}
        </StaggeredBentoContainer>
      </div>
    </PageTransition>
    </MotionConfig>
  );
}
