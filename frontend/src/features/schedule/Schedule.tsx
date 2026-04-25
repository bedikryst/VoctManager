import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, History, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../app/providers/AuthProvider";
import { useScheduleData } from "./hooks/useScheduleData";
import { TimelineProjectCard } from "./components/TimelineProjectCard";
import { TimelineRehearsalCard } from "./components/TimelineRehearsalCard";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { cn } from "@/shared/lib/utils";

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
          <Text color="muted" size="sm" className="mt-2 ml-1">
            {t(
              "schedule.dashboard.description",
              "Sprawdzaj próby, zgłaszaj nieobecności i śledź plany koncertowe.",
            )}
          </Text>
        </div>

        {/* ── tab switcher — top bar on all screen sizes ───────────────── */}
        <div className="flex items-center gap-1 p-1.5 bg-ethereal-alabaster border border-ethereal-incense/20 rounded-xl shadow-glass-ethereal w-full sm:w-max mb-8">
          {TABS.map(({ id, labelKey, fallback, Icon }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={cn(
                  "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-ethereal-amethyst/15 text-ethereal-amethyst border border-ethereal-amethyst/25 shadow-glass-ethereal"
                    : "text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-ethereal-alabaster/60",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={14} aria-hidden="true" />
                {t(labelKey, fallback)}
              </button>
            );
          })}
        </div>

        {/* ── timeline feed ─────────────────────────────────────────────── */}
        <div className="relative">
          {/* vertical timeline line — desktop only */}
          <div className="absolute left-4.5 md:left-6.5 top-6 bottom-0 w-px bg-linear-to-b from-ethereal-amethyst/25 via-ethereal-incense/12 to-transparent z-0 hidden sm:block pointer-events-none" />

          {isLoading ? (
            <EtherealLoader
              fullHeight={false}
              message={t("schedule.loading", "Pobieranie grafiku...")}
            />
          ) : filteredEvents.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="space-y-4 sm:space-y-5">
                {filteredEvents.map((ev) =>
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
          ) : (
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
      </div>
    </PageTransition>
  );
}
