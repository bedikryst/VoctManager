import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../app/providers/AuthProvider";
import { useScheduleData } from "./hooks/useScheduleData";
import TimelineProjectCard from "./components/TimelineProjectCard";
import TimelineRehearsalCard from "./components/TimelineRehearsalCard";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

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

  const tabs: Array<{ id: "UPCOMING" | "PAST"; label: string }> = [
    { id: "UPCOMING", label: t("schedule.tabs.upcoming", "Nadchodzące") },
    { id: "PAST", label: t("schedule.tabs.past", "Historia") },
  ];

  return (
    <PageTransition>
      <div className="relative pb-24 max-w-4xl mx-auto px-4 sm:px-0">
        <div className="pt-6 mb-4">
          <PageHeader
            size="standard"
            roleText={t("schedule.dashboard.subtitle", "Osobisty Kalendarz")}
            title={t("schedule.dashboard.title", "Mój")}
            titleHighlight={t(
              "schedule.dashboard.title_highlight",
              "Harmonogram.",
            )}
          />
          <Text color="muted" size="sm" className="mt-2 ml-1">
            {t(
              "schedule.dashboard.description",
              "Sprawdzaj próby, zgłaszaj nieobecności i śledź plany koncertowe.",
            )}
          </Text>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center gap-1 p-1.5 bg-ethereal-alabaster border border-ethereal-incense/20 rounded-xl shadow-glass-ethereal overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={viewMode === tab.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode(tab.id);
                  setExpandedEventId(null);
                }}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="absolute left-4.75 md:left-7.75 top-6 bottom-0 w-0.5 bg-linear-to-b from-ethereal-amethyst/20 via-ethereal-incense/15 to-transparent z-0 hidden sm:block" />

          {isLoading ? (
            <EtherealLoader
              fullHeight={false}
              message={t("schedule.loading", "Pobieranie grafiku...")}
            />
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {filteredEvents.map((ev) =>
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
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative z-10"
            >
              <GlassCard
                padding="lg"
                isHoverable={false}
                className="flex flex-col items-center justify-center text-center"
              >
                <CalendarHeart
                  size={48}
                  className="text-ethereal-incense/30 mb-4"
                  aria-hidden="true"
                />
                <Eyebrow color="muted" className="mb-2">
                  {t("schedule.empty.title", "Brak wpisów w kalendarzu")}
                </Eyebrow>
                <Text size="sm" color="muted" className="max-w-sm">
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
