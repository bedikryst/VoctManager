/**
 * @file Rehearsals.tsx
 * @description Centrum Obecności — the conductor's rehearsal command centre.
 * Composes the cross-project pulse, a context navigator (project + rehearsals),
 * and a switchable workspace: "Odprawa" for taking/reading attendance and
 * "Frekwencja" for reliability analytics. Scheduling/CRUD lives in the project
 * hub; this surface is purely operational + analytical.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ListChecks, MousePointerClick, TrendingUp } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useLocationResolver } from "@/features/logistics/hooks/useLocationResolver";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/composites/StaggeredBento";

import { useRehearsalsData, type RehearsalView } from "./hooks/useRehearsalsData";
import { useRehearsalAnalytics } from "./hooks/useRehearsalAnalytics";
import { RehearsalPulseBar } from "./components/RehearsalPulseBar";
import { RehearsalRail } from "./components/RehearsalRail";
import { RehearsalInspector } from "./components/RehearsalInspector";
import { ReliabilityBoard } from "./components/ReliabilityBoard";

export default function Rehearsals(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    view,
    setView,
    isRollCall,
    setIsRollCall,
    showOnlyUnmarked,
    setShowOnlyUnmarked,
    projectTab,
    setProjectTab,
    displayProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    projectRehearsals,
    rehearsalTallies,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    invitedParticipations,
    voiceGroups,
    projectParticipations,
    artistMap,
    attendanceMap,
    attendanceIndex,
    stats,
    pulse,
    goToRehearsal,
    isMarkingAll,
    handleMarkAllPresent,
  } = useRehearsalsData();

  const { getLocationName } = useLocationResolver();

  // Selecting a rehearsal anywhere (rail row, trend bar) lands in roll-call.
  const openRehearsal = (rehearsalId: string): void => {
    setActiveRehearsalId(rehearsalId);
    setView("ROLL_CALL");
  };

  const analytics = useRehearsalAnalytics(
    projectRehearsals,
    projectParticipations,
    attendanceIndex,
    artistMap,
  );

  useEffect(() => {
    if (isError)
      toast.error(t("rehearsals.toast.sync_error_title", "Błąd synchronizacji"), {
        description: t("rehearsals.toast.sync_error_desc", "Nie udało się załadować danych."),
      });
  }, [isError, t]);

  if (isLoading && displayProjects.length === 0) {
    return <EtherealLoader />;
  }

  const VIEWS: Array<{ id: RehearsalView; label: string; icon: React.ReactNode }> = [
    {
      id: "ROLL_CALL",
      label: t("rehearsals.views.roll_call", "Odprawa"),
      icon: <ListChecks size={14} aria-hidden="true" />,
    },
    {
      id: "RELIABILITY",
      label: t("rehearsals.views.reliability", "Frekwencja"),
      icon: <TrendingUp size={14} aria-hidden="true" />,
    },
  ];

  const viewSwitch = (
    <div
      role="tablist"
      aria-label={t("rehearsals.views.label", "Widok")}
      className="flex w-full gap-1 rounded-2xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-1 md:w-auto"
    >
      {VIEWS.map((item) => {
        const isActive = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(item.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors md:flex-none",
              isActive
                ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                : "text-ethereal-graphite hover:text-ethereal-ink",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-5 pb-24 pt-6">
        <StaggeredBentoContainer className="!flex min-w-0 flex-col gap-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("rehearsals.dashboard.subtitle", "Moduł Dyrygenta")}
              title={t("rehearsals.dashboard.title", "Dziennik")}
              titleHighlight={t("rehearsals.dashboard.title_highlight", "Obecności")}
              rightContent={viewSwitch}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <RehearsalPulseBar
              pulse={pulse}
              onOpenNext={() =>
                pulse.next &&
                goToRehearsal(pulse.next.project.id, pulse.next.rehearsal.id)
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem className="min-w-0">
            {/* min-w-0 on the grid + its items lets an over-wide child (e.g. the
                dense roster) be clipped by the cards' own overflow-hidden instead
                of forcing the whole single-column grid past the viewport. */}
            <div className="grid min-w-0 gap-5 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
                <RehearsalRail
                  projectTab={projectTab}
                  onProjectTab={setProjectTab}
                  displayProjects={displayProjects}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={setSelectedProjectId}
                  projectRehearsals={projectRehearsals}
                  rehearsalTallies={rehearsalTallies}
                  activeRehearsalId={activeRehearsalId}
                  onSelectRehearsal={openRehearsal}
                  getLocationName={getLocationName}
                />
              </div>

              <div className="min-w-0 lg:col-span-8">
                {view === "RELIABILITY" ? (
                  <ReliabilityBoard
                    analytics={analytics}
                    projectTitle={selectedProject?.title ?? ""}
                    onOpenRehearsal={openRehearsal}
                  />
                ) : activeRehearsal ? (
                  <RehearsalInspector
                    rehearsal={activeRehearsal}
                    voiceGroups={voiceGroups}
                    invitedCount={invitedParticipations.length}
                    artistMap={artistMap}
                    attendanceMap={attendanceMap}
                    stats={stats}
                    isRollCall={isRollCall}
                    onToggleRollCall={() => setIsRollCall(!isRollCall)}
                    showOnlyUnmarked={showOnlyUnmarked}
                    onToggleOnlyUnmarked={() => setShowOnlyUnmarked(!showOnlyUnmarked)}
                    isMarkingAll={isMarkingAll}
                    onMarkAllPresent={handleMarkAllPresent}
                  />
                ) : (
                  <StatePanel
                    icon={<MousePointerClick size={22} aria-hidden="true" />}
                    title={
                      selectedProjectId
                        ? t("rehearsals.empty.pick_rehearsal_title", "Wybierz próbę")
                        : t("rehearsals.empty.pick_project_title", "Wybierz projekt")
                    }
                    description={
                      selectedProjectId
                        ? t(
                            "rehearsals.empty.pick_rehearsal_desc",
                            "Wskaż próbę z listy po lewej, aby rozpocząć odprawę i odnotować obecność.",
                          )
                        : t(
                            "rehearsals.empty.pick_project_desc",
                            "Wybierz projekt z listy po lewej, aby zobaczyć jego próby.",
                          )
                    }
                  />
                )}
              </div>
            </div>
          </StaggeredBentoItem>
        </StaggeredBentoContainer>
      </div>
    </PageTransition>
  );
}
