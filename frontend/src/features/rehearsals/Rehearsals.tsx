/**
 * @file Rehearsals.tsx
 * @description "Próby i obecność" — one name across the nav, the title and
 * the page, whose eyebrow names the project in view instead of a third name.
 * The conductor's rehearsal command centre: the cross-project pulse, a context
 * navigator (project + rehearsals; a compact evening picker on a phone), and a
 * switchable workspace — "Próba", the evening's card with its own
 * "Plan · Obecność" switch, and "Frekwencja" for reliability analytics.
 * Scheduling/CRUD lives in the project hub; this surface is purely
 * operational + analytical.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  MousePointerClick,
  TrendingUp,
  WifiOff,
} from "lucide-react";

import { useLocationResolver } from "@/features/logistics/hooks/useLocationResolver";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { useMarkPlanItem } from "./api/plan.queries";
import { useUpdateRehearsalFocus } from "./api/rehearsals.queries";
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
    nowMs,
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
    openRehearsal,
    activeRehearsal,
    setIsPlanDirty,
    isLeavePromptOpen,
    discardPlanAndMove,
    keepPlan,
    invitedParticipations,
    voiceGroups,
    projectParticipations,
    artistMap,
    attendanceMap,
    attendanceIndex,
    stats,
    pulse,
    isMarkingAll,
    handleMarkAllPresent,
  } = useRehearsalsData();

  const { getLocationName } = useLocationResolver();

  // Ticking the plan's rows is the debrief's first step, and the manager may
  // take it here even though the debrief text is the leader's to write.
  const markPlanItem = useMarkPlanItem(activeRehearsalId ?? "");
  const markPlan = (itemId: string, done: boolean): Promise<unknown> =>
    markPlanItem.mutateAsync({ itemId, done });

  // The topic line is a headline, written where it is read; the form keeps
  // it too, for the evening's other facts.
  const updateFocus = useUpdateRehearsalFocus(activeRehearsalId ?? "");
  const saveFocus = (focus: string): Promise<unknown> => updateFocus.mutateAsync(focus);

  const analytics = useRehearsalAnalytics(
    projectRehearsals,
    projectParticipations,
    attendanceIndex,
    artistMap,
    nowMs,
  );

  useEffect(() => {
    if (isError)
      toast.error(t("rehearsals.toast.sync_error_title", "Błąd synchronizacji"), {
        description: t("rehearsals.toast.sync_error_desc", "Nie udało się załadować danych."),
      });
  }, [isError, t]);

  // The workspace joins six queries; while any of them is still cold the rail
  // has no rehearsals to list and the inspector has no roster, and the empty
  // states would report that as fact. `isLoading` is only true when something
  // genuinely has no data yet, so a warm cache never sees this gate.
  if (isLoading) {
    return <EtherealLoader />;
  }

  if (isError && displayProjects.length === 0) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl pt-10">
          <StatePanel
            tone="danger"
            icon={<WifiOff size={22} aria-hidden="true" />}
            title={t("rehearsals.error.title", "Nie udało się wczytać dziennika")}
            description={t(
              "rehearsals.error.desc",
              "Dane obecności nie odpowiedziały. Sprawdź połączenie i odśwież stronę.",
            )}
          />
        </div>
      </PageTransition>
    );
  }

  const VIEWS: SegmentedTabItem<RehearsalView>[] = [
    // The evening's card holds the plan as well as the roll call, so the view
    // is named for the evening.
    {
      id: "ROLL_CALL",
      label: t("rehearsals.views.roll_call", "Próba"),
      Icon: CalendarClock,
    },
    {
      id: "RELIABILITY",
      label: t("rehearsals.views.reliability", "Frekwencja"),
      Icon: TrendingUp,
    },
  ];

  const viewSwitch = (
    <SegmentedTabs
      items={VIEWS}
      value={view}
      onChange={setView}
      ariaLabel={t("rehearsals.views.label", "Widok")}
    />
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-5 pb-24 pt-6">
        <StaggeredBentoContainer className="flex min-w-0 flex-col gap-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={selectedProject?.title}
              title={t("rehearsals.dashboard.title", "Próby")}
              titleHighlight={t("rehearsals.dashboard.title_highlight", "i obecność")}
              rightContent={viewSwitch}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <RehearsalPulseBar pulse={pulse} nowMs={nowMs} />
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
                  nowMs={nowMs}
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
                  // Keyed by the evening: nothing the card holds — a plan
                  // draft, the open pitch pipe, the pane — carries over to the
                  // next one, and the next one picks its pane by its moment.
                  <RehearsalInspector
                    key={String(activeRehearsal.id)}
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
                    onSaveFocus={saveFocus}
                    canEditPlan
                    onMarkPlanItem={markPlan}
                    onPlanDirtyChange={setIsPlanDirty}
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
                            "Wskaż próbę z listy po lewej, aby odnotować obecność.",
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

      <ConfirmModal
        isOpen={isLeavePromptOpen}
        title={t("rehearsals.plan.discard.title", "Zamknąć bez zapisywania?")}
        description={t(
          "rehearsals.plan.discard.desc",
          "Zmiany w planie tej próby nie zostały zapisane i przepadną.",
        )}
        confirmText={t("rehearsals.plan.discard.confirm", "Odrzuć zmiany")}
        cancelText={t("rehearsals.plan.discard.keep", "Wróć do planu")}
        isDestructive={true}
        onConfirm={discardPlanAndMove}
        onCancel={keepPlan}
      />
    </PageTransition>
  );
}
