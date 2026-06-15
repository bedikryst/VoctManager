import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
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
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

const TABS = [
  { id: "UPCOMING" as const, labelKey: "schedule.tabs.upcoming", fallback: "Nadchodzące", Icon: CalendarClock },
  { id: "PAST" as const,     labelKey: "schedule.tabs.past",     fallback: "Historia",     Icon: History },
];

export default function Schedule(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    isLoading,
    viewMode,
    setViewMode,
    expandedEventId,
    setExpandedEventId,
    filteredEvents,
    handleAbsenceSubmit,
    artistId,
  } = useScheduleData(user?.artist_profile_id ?? undefined);

  const handleTabChange = (id: "UPCOMING" | "PAST") => {
    setViewMode(id);
    setExpandedEventId(null);
  };

  // The very next event gets the hero spotlight; the timeline lists the rest.
  const heroEvent = viewMode === "UPCOMING" ? (filteredEvents[0] ?? null) : null;
  const timelineEvents = heroEvent ? filteredEvents.slice(1) : filteredEvents;

  return (
    <PageTransition>
      <div className="relative pb-16 max-w-5xl mx-auto px-4 md:px-6">
        {/* ── header ───────────────────────────────────────────────────── */}
        <div className="pt-6 mb-6">
          <PageHeader
            size="standard"
            roleText={t("schedule.dashboard.subtitle", "Osobisty Kalendarz")}
            title={t("schedule.dashboard.title", "Mój")}
            titleHighlight={t("schedule.dashboard.title_highlight", "Harmonogram.")}
          />
          <div className="mt-2 ml-1 flex flex-wrap items-center justify-between gap-2">
            <Text color="muted" size="sm">
              {t(
                "schedule.dashboard.description",
                "Sprawdzaj próby, zgłaszaj nieobecności i śledź plany koncertowe.",
              )}
            </Text>
            <Link
              to="/panel/settings/calendar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1.5 shadow-glass-ethereal transition-all hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
            >
              <CalendarPlus size={12} className="text-ethereal-gold" aria-hidden="true" />
              <Eyebrow color="default">
                {t("schedule.dashboard.subscribe_ics", "Subskrybuj kalendarz")}
              </Eyebrow>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <EtherealLoader
            fullHeight={false}
            message={t("schedule.loading", "Pobieranie grafiku...")}
          />
        ) : (
          <>
            {/* ── next event spotlight ─────────────────────────────────── */}
            {heroEvent && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="mb-8"
              >
                <NextEventHero
                  event={heroEvent}
                  onSubmitReport={handleAbsenceSubmit}
                />
              </motion.div>
            )}

            {/* ── tab switcher ─────────────────────────────────────────── */}
            <SegmentedTabs
              className="mb-8"
              ariaLabel={t("schedule.tabs.aria_label", "Widok kalendarza")}
              items={TABS.map(({ id, labelKey, fallback, Icon }) => ({
                id,
                label: t(labelKey, fallback),
                Icon,
              }))}
              value={viewMode}
              onChange={handleTabChange}
            />

            {/* ── timeline feed ────────────────────────────────────────── */}
            <div className="relative">
              {/* vertical timeline line — desktop only */}
              <div className="absolute left-4.5 md:left-6.5 top-6 bottom-0 w-px bg-linear-to-b from-ethereal-gold/30 via-ethereal-incense/12 to-transparent z-0 hidden sm:block pointer-events-none" />

              {heroEvent && timelineEvents.length > 0 && (
                <Eyebrow color="muted" className="mb-4 ml-1 block sm:pl-14 md:pl-16">
                  {t("schedule.hero.later_divider", "Dalej w kalendarzu")}
                </Eyebrow>
              )}

              {timelineEvents.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-4 sm:space-y-5">
                    {timelineEvents.map((ev) =>
                      ev.type === "PROJECT" ? (
                        <TimelineProjectCard
                          key={ev.id}
                          event={ev}
                          isExpanded={expandedEventId === ev.id}
                          onToggle={() =>
                            setExpandedEventId(expandedEventId === ev.id ? null : ev.id)
                          }
                          artistId={artistId}
                        />
                      ) : (
                        <TimelineRehearsalCard
                          key={ev.id}
                          event={ev}
                          isExpanded={expandedEventId === ev.id}
                          onToggle={() =>
                            setExpandedEventId(expandedEventId === ev.id ? null : ev.id)
                          }
                          onSubmitReport={handleAbsenceSubmit}
                          viewMode={viewMode}
                        />
                      ),
                    )}
                  </div>
                </AnimatePresence>
              ) : heroEvent ? null : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative z-10"
                >
                  <GlassCard
                    padding="lg"
                    isHoverable={false}
                    className="flex flex-col items-center justify-center text-center py-16"
                  >
                    <CalendarHeart
                      size={40}
                      className="text-ethereal-incense/25 mb-4"
                      aria-hidden="true"
                    />
                    <Eyebrow color="muted" className="mb-2">
                      {t("schedule.empty.title", "Brak wpisów w kalendarzu")}
                    </Eyebrow>
                    <Text size="sm" color="muted" className="max-w-xs">
                      {t(
                        "schedule.empty.description",
                        "W tym widoku nie masz przypisanych żadnych spotkań ani koncertów.",
                      )}
                    </Text>
                  </GlassCard>
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
