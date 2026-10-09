/**
 * @file LeadSheet.tsx
 * @description One evening, for whoever is standing in front of the choir when
 * it is not a manager. The work plan, the time, the room, and the register.
 *
 * A route rather than a sheet over the schedule: this is worked on for an hour
 * with a tablet on a music stand, it wants the whole screen, and it has to
 * survive a reload and a link sent in a message. The address is under
 * `/panel/schedule/` because that is where the person was standing when they
 * were asked — a stand-in has no manager workspace to come from.
 *
 * The card below is `RehearsalInspector`, the conductor's own surface,
 * unchanged — its "Plan · Obecność" switch, its default by the moment and the
 * pitch pipe on the plan included. The only thing withheld is what a delegation does not carry: a span
 * excusal and the cast editor, both of which are decisions about a singer's
 * standing in the choir rather than a record of who turned up. Two things are
 * added: the topic line — the leader has no rehearsal form, so what the
 * evening is about is edited in place, under the date, where the cast will
 * read it — and the debrief, written once the evening has started, which is
 * how the leader hands it back to the conductor: the plan's rows ticked off
 * on the plan itself, then the words. The plan is read here at stand size.
 * When the server says this reader may plan the evening (`may_plan`: the
 * assistant conductor announced for it under a planning grant, the project's
 * conductor, a manager), the manager's own editor is one tap away ("Edytuj
 * plan") and opens by itself only on an empty plan for an evening still
 * ahead; a non-manager's send goes to the called singers at once. At the
 * music stand nobody should be one stray drag from reordering the evening.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals
 */

import React, { useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarOff } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { toastApiError } from "@/shared/api/errors";
import { useUnsavedChangesWarning } from "@/shared/lib/dom/useUnsavedChangesWarning";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { useMarkMissingAttendancesPresent } from "./api/rehearsals.queries";
import { useUpdateLeadSheet } from "./api/leadSheet.queries";
import { useMarkPlanItem } from "./api/plan.queries";
import { useLeadSheetData } from "./hooks/useLeadSheetData";
import { RehearsalInspector } from "./components/RehearsalInspector";

export default function LeadSheet(): React.JSX.Element {
  const { t } = useTranslation();
  const { rehearsalId } = useParams<{ rehearsalId: string }>();
  const {
    isLoading,
    isError,
    leadSheet,
    cast,
    artistMap,
    attendanceMap,
    voiceGroups,
    stats,
  } = useLeadSheetData(rehearsalId);

  // Two view preferences, held here rather than in the data hook: they are how
  // THIS reader wants the roster drawn, and nothing on the wire cares.
  const [isRollCall, setIsRollCall] = useState(true);
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);
  const markMissing = useMarkMissingAttendancesPresent();
  const updateSheet = useUpdateLeadSheet(rehearsalId);
  const markPlanItem = useMarkPlanItem(rehearsalId ?? "");
  const { user } = useAuth();

  // A planner's unsaved draft never leaves with the page: the back link, a
  // link to another evening's sheet (another path) and closing the tab all
  // ask first, in the words the workspace asks with.
  const [isPlanDirty, setIsPlanDirty] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isPlanDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useUnsavedChangesWarning(isPlanDirty);

  // The debrief's first step: which rows of the plan were done. Same gate as
  // the debrief on the server, so a reader let in to run the evening may tick.
  const markPlan = (itemId: string, done: boolean): Promise<unknown> =>
    markPlanItem.mutateAsync({ itemId, done });

  // Both editors show the server's refusal in place, so the mutations reject
  // rather than toast; a stale grant answers with the same 404 the whole page
  // would, and the next refetch turns the page into the refusal.
  const saveFocus = (focus: string): Promise<unknown> =>
    updateSheet.mutateAsync({ focus });
  const saveDebrief = (debrief: string): Promise<unknown> =>
    updateSheet.mutateAsync({ debrief });

  // The header says whose evening this is. Nobody announced = the page reads
  // as it always has ("Prowadzisz"), because the reader was let in to run it.
  // Somebody ELSE announced = the reader is covering the register of an
  // evening that is not theirs, and the page must not tell them otherwise.
  const ledBy = leadSheet?.led_by ?? null;
  const someoneElseLeads =
    ledBy !== null && ledBy.artist_id !== String(user?.artist_profile_id ?? "");

  const backLink = (
    <Link
      to="/panel/schedule"
      className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1.5 shadow-glass-ethereal transition-all hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
    >
      <ArrowLeft size={12} className="text-ethereal-gold" aria-hidden="true" />
      <Eyebrow color="default">
        {t("rehearsals.lead.back", "Harmonogram")}
      </Eyebrow>
    </Link>
  );

  const handleMarkAllPresent = async (): Promise<void> => {
    if (!rehearsalId || cast.length === 0) return;

    const entries = cast.flatMap((seat) => {
      const existing = attendanceMap.get(String(seat.id));
      if (existing?.status) return [];
      return [
        {
          attendanceId: existing ? String(existing.id) : undefined,
          rehearsalId: String(rehearsalId),
          participationId: String(seat.id),
        },
      ];
    });
    if (entries.length === 0) return;

    const toastId = toast.loading(
      t("rehearsals.toast.bulk_marking", "Zbiorcze zaznaczanie obecności..."),
    );
    try {
      await markMissing.mutateAsync(entries);
      toast.success(
        t("rehearsals.toast.bulk_success", "Uzupełniono luki jako 'Obecny'."),
        { id: toastId },
      );
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "rehearsals.toast.bulk_error_desc",
          "Nie udało się zapisać masowej obecności.",
        ),
      });
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageTransition>
        <div className="relative mx-auto max-w-5xl pb-6 pt-6">
          <StaggeredBentoContainer className="flex min-w-0 flex-col gap-5">
            <StaggeredBentoItem>
              <PageHeader
                size="standard"
                className="!mb-0"
                roleText={
                  leadSheet?.project.title ??
                  t("rehearsals.lead.role", "Asystent dyrygenta")
                }
                title={
                  someoneElseLeads
                    ? t("rehearsals.lead.covering_title", "Prowadzi")
                    : t("rehearsals.lead.title", "Prowadzisz")
                }
                titleHighlight={
                  someoneElseLeads && ledBy
                    ? `${ledBy.name}.`
                    : t("rehearsals.lead.title_highlight", "próbę.")
                }
                rightContent={backLink}
              />
            </StaggeredBentoItem>

            {isLoading ? (
              <StaggeredBentoItem>
                <EtherealLoader
                  fullHeight={false}
                  message={t("rehearsals.lead.loading", "Otwieram listę...")}
                />
              </StaggeredBentoItem>
            ) : isError || !leadSheet ? (
              <StaggeredBentoItem>
                {/* One refusal for both halves of the same answer: the evening
                    never existed, or it is no longer yours to run. The server
                    does not distinguish them on purpose, and neither does this
                    — a revoked delegation must not confirm that a rehearsal is
                    there. */}
                <StatePanel
                  variant="inline"
                  className="py-14"
                  icon={<CalendarOff size={22} aria-hidden="true" />}
                  title={t(
                    "rehearsals.lead.gone.title",
                    "Ta próba nie jest już Twoja",
                  )}
                  description={t(
                    "rehearsals.lead.gone.description",
                    "Nie jesteś już asystentem w tym projekcie albo próby już nie ma. Zapytaj menedżera, jeśli to pomyłka.",
                  )}
                  actions={
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/panel/schedule">
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t("rehearsals.lead.back", "Harmonogram")}
                      </Link>
                    </Button>
                  }
                />
              </StaggeredBentoItem>
            ) : (
              <StaggeredBentoItem>
                {/* Keyed by the evening, as in the manager's workspace: a link
                    to another evening re-decides the pane and closes the
                    pitch pipe rather than carrying them over. */}
                <RehearsalInspector
                  key={String(leadSheet.rehearsal.id)}
                  rehearsal={leadSheet.rehearsal}
                  voiceGroups={voiceGroups}
                  invitedCount={cast.length}
                  artistMap={artistMap}
                  attendanceMap={attendanceMap}
                  stats={stats}
                  isRollCall={isRollCall}
                  onToggleRollCall={() => setIsRollCall((prev) => !prev)}
                  showOnlyUnmarked={showOnlyUnmarked}
                  onToggleOnlyUnmarked={() =>
                    setShowOnlyUnmarked((prev) => !prev)
                  }
                  isMarkingAll={markMissing.isPending}
                  onMarkAllPresent={handleMarkAllPresent}
                  allowManagerActions={leadSheet.is_manager}
                  canEditPlan={leadSheet.may_plan}
                  planAtStand
                  onSaveFocus={saveFocus}
                  onSaveDebrief={saveDebrief}
                  onMarkPlanItem={markPlan}
                  onPlanDirtyChange={setIsPlanDirty}
                />
              </StaggeredBentoItem>
            )}
          </StaggeredBentoContainer>
        </div>
      </PageTransition>

      <ConfirmModal
        isOpen={blocker.state === "blocked"}
        title={t("rehearsals.plan.discard.title", "Zamknąć bez zapisywania?")}
        description={t(
          "rehearsals.plan.discard.desc",
          "Zmiany w planie tej próby nie zostały zapisane i przepadną.",
        )}
        confirmText={t("rehearsals.plan.discard.confirm", "Odrzuć zmiany")}
        cancelText={t("rehearsals.plan.discard.keep", "Wróć do planu")}
        isDestructive={true}
        onConfirm={() => {
          setIsPlanDirty(false);
          if (blocker.state === "blocked") blocker.proceed();
        }}
        onCancel={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
      />
    </MotionConfig>
  );
}
