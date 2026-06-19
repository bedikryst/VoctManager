import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  CalendarHeart,
  History,
  CalendarClock,
  CalendarPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../app/providers/AuthProvider";
import { useScheduleData } from "./hooks/useScheduleData";
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
import { StaggeredBentoItem } from "@/shared/ui/composites/StaggeredBento";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { useNow } from "@/shared/lib/dom/useNow";

const TABS = [
  { id: "UPCOMING" as const, labelKey: "schedule.tabs.upcoming", fallback: "Nadchodzące", Icon: CalendarClock },
  { id: "PAST" as const,     labelKey: "schedule.tabs.past",     fallback: "Historia",     Icon: History },
];

// Local vertical-stagger container — StaggeredBento's own container is a CSS
// grid (2/3-up on wide screens). The schedule reads as a single focused feed,
// so we drive the same entrance stagger over a plain flex column and reuse the
// shared item for visual parity. (Items resolve "hidden"/"show" by propagation.)
const feedVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export default function Schedule(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const now = useNow(60_000);
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
    artistId,
  } = useScheduleData(user?.artist_profile_id ?? undefined);

  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

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

  const scrollToDay = (key: string) => {
    setActiveDayKey(key);
    const heroKey = heroEvent ? dayKey(heroEvent.date_time) : null;
    const targetId = heroKey === key ? "schedule-hero" : `schedule-day-${key}`;
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const subscribeLink = (
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
        <motion.div
          variants={feedVariants}
          initial="hidden"
          animate="show"
          className="flex min-w-0 flex-col gap-5"
        >
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
                        {group.events.map((ev) =>
                          ev.type === "PROJECT" ? (
                            <TimelineProjectCard
                              key={ev.id}
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
                              key={ev.id}
                              event={ev}
                              isExpanded={expandedEventId === ev.id}
                              onToggle={() =>
                                setExpandedEventId(
                                  expandedEventId === ev.id ? null : ev.id,
                                )
                              }
                              onSubmitReport={handleAbsenceSubmit}
                              viewMode={viewMode}
                            />
                          ),
                        )}
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
        </motion.div>
      </div>
    </PageTransition>
    </MotionConfig>
  );
}
