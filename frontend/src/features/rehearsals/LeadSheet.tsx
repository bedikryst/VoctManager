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
 * The roster below is `RehearsalInspector`, the conductor's own surface,
 * unchanged. The only thing withheld is what a delegation does not carry: a span
 * excusal and the cast editor, both of which are decisions about a singer's
 * standing in the choir rather than a record of who turned up. Two things are
 * added: the plan — the leader has no rehearsal form, so what the evening is
 * about is edited in place, under the date, where the cast will read it — and
 * the debrief, written once the evening has started, which is how the leader
 * hands it back to the conductor.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals
 */

import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarOff } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { toastApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography";
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
  const { user } = useAuth();

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
                  t("rehearsals.lead.role", "Lider projektu")
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
                    "Nie jesteś już liderem tego projektu albo próby już nie ma. Zapytaj menedżera, jeśli to pomyłka.",
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
                <RehearsalInspector
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
                  onSaveFocus={saveFocus}
                  onSaveDebrief={saveDebrief}
                />
              </StaggeredBentoItem>
            )}
          </StaggeredBentoContainer>
        </div>
      </PageTransition>
    </MotionConfig>
  );
}
