import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Archive, CalendarClock, ListChecks, Music, Search } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useMaterialsData } from "./hooks/useMaterialsData";
import { ProjectMaterialGroup } from "./components/ProjectMaterialGroup";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { Input } from "@/shared/ui/primitives/Input";
import { cn } from "@/shared/lib/utils";
import type { MaterialsDashboardGroup } from "./types/materials.dto";

type MaterialsView = "upcoming" | "archive";

export const Materials = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [view, setView] = useState<MaterialsView>("upcoming");
  const [onlyUnpracticed, setOnlyUnpracticed] = useState<boolean>(false);

  const { isLoading, isError, filteredGroups } = useMaterialsData(
    searchQuery,
    !!user,
  );

  const { upcoming, archived } = useMemo(
    () => ({
      upcoming: filteredGroups.filter((g) => g.project.status !== "DONE"),
      archived: filteredGroups.filter((g) => g.project.status === "DONE"),
    }),
    [filteredGroups],
  );

  const displayedGroups = useMemo<MaterialsDashboardGroup[]>(() => {
    const base = view === "upcoming" ? upcoming : archived;
    if (!onlyUnpracticed || view !== "upcoming") return base;
    return base
      .map((group) => ({
        ...group,
        program: group.program.filter(
          (item) => item.piece.my_readiness !== "READY",
        ),
      }))
      .filter((group) => group.program.length > 0);
  }, [view, upcoming, archived, onlyUnpracticed]);

  useEffect(() => {
    if (isError) {
      toast.error(
        t("materials.dashboard.sync_error_title", "Błąd synchronizacji"),
        {
          description: t(
            "materials.dashboard.sync_error_desc",
            "Nie udało się załadować materiałów. Odśwież stronę.",
          ),
        },
      );
    }
  }, [isError, t]);

  if (isLoading) {
    return (
      <PageTransition>
        <EtherealLoader
          message={t(
            "materials.dashboard.syncing",
            "Synchronizacja biblioteki...",
          )}
        />
      </PageTransition>
    );
  }

  const tabs = [
    {
      id: "upcoming" as const,
      label: t("materials.dashboard.tab_upcoming", "Nadchodzące ({{count}})", {
        count: upcoming.length,
      }),
      Icon: CalendarClock,
    },
    {
      id: "archive" as const,
      label: t("materials.dashboard.tab_archive", "Archiwum ({{count}})", {
        count: archived.length,
      }),
      Icon: Archive,
    },
  ];

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto pb-24 cursor-default space-y-6">
        <div className="pt-6">
          <PageHeader
            roleText={t("materials.dashboard.subtitle", "Strefa Artysty")}
            title={t("materials.dashboard.title", "Mój")}
            titleHighlight={t("materials.dashboard.title_highlight", "Śpiewnik.")}
          />
          <Text color="graphite" className="mt-3 max-w-lg">
            {t(
              "materials.dashboard.description",
              "Nuty, mikser głosów i Twoje partie — wszystko, czego potrzebujesz do przygotowań.",
            )}
          </Text>
        </div>

        <div className="space-y-3">
          <Input
            leftIcon={<Search size={16} />}
            type="search"
            placeholder={t(
              "materials.dashboard.search_placeholder",
              "Szukaj utworu lub kompozytora...",
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedTabs
              items={tabs}
              value={view}
              onChange={setView}
              ariaLabel={t("materials.dashboard.view_aria", "Widok materiałów")}
            />

            {view === "upcoming" && (
              <button
                type="button"
                onClick={() => setOnlyUnpracticed((prev) => !prev)}
                aria-pressed={onlyUnpracticed}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 transition-all active:scale-95",
                  onlyUnpracticed
                    ? "border-ethereal-gold/40 bg-ethereal-gold/12 text-ethereal-gold"
                    : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink",
                )}
              >
                <ListChecks size={14} aria-hidden="true" />
                <Eyebrow color="inherit">
                  {t("materials.dashboard.filter_unpracticed", "Do przećwiczenia")}
                </Eyebrow>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <AnimatePresence mode="popLayout">
            {displayedGroups.length > 0 ? (
              displayedGroups.map((group, i) => (
                <motion.div
                  key={group.project.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: 0.38,
                    ease: [0.16, 1, 0.3, 1] as const,
                    delay: i * 0.04,
                  }}
                >
                  <ProjectMaterialGroup group={group} />
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
              >
                <GlassCard
                  variant="ethereal"
                  className="py-16 px-8"
                  contentClassName="items-center text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-ethereal-alabaster border border-ethereal-marble flex items-center justify-center mb-6 shadow-glass-solid">
                    <Music
                      size={32}
                      className="text-ethereal-graphite opacity-50"
                      aria-hidden="true"
                    />
                  </div>
                  <Eyebrow color="default" className="mb-3">
                    {view === "archive"
                      ? t(
                          "materials.dashboard.empty_archive_title",
                          "Archiwum jest puste",
                        )
                      : onlyUnpracticed
                        ? t(
                            "materials.dashboard.empty_unpracticed_title",
                            "Wszystko przećwiczone",
                          )
                        : t(
                            "materials.dashboard.empty_title",
                            "Brak przypisanych materiałów",
                          )}
                  </Eyebrow>
                  <Text color="graphite" className="max-w-sm">
                    {view === "archive"
                      ? t(
                          "materials.dashboard.empty_archive_desc",
                          "Tu trafią materiały z zakończonych już koncertów.",
                        )
                      : onlyUnpracticed
                        ? t(
                            "materials.dashboard.empty_unpracticed_desc",
                            "Świetna robota — oznaczyłeś każdą partię jako gotową.",
                          )
                        : t(
                            "materials.dashboard.empty_desc",
                            "W tej chwili nie masz nadchodzących projektów lub dyrygent nie zatwierdził jeszcze żadnego programu koncertu.",
                          )}
                  </Text>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
};
