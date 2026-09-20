import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, BookOpen, Briefcase, CalendarDays, EyeOff, Wand2 } from "lucide-react";

import { ProjectScoreBook } from "@/features/projects/components/ProjectScoreBook";
import { scoreAnnotatorModeFor } from "@/features/annotations";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { PieceRow } from "./PieceRow";
import { OfflineDownloadControl } from "./OfflineDownloadControl";
import { isReadinessWithheld, practisedProgram } from "../lib/readiness";
import type { MaterialsDashboardGroup } from "../types/materials.dto";

interface ProjectMaterialGroupProps {
  group: MaterialsDashboardGroup;
}

export const ProjectMaterialGroup = ({
  group,
}: ProjectMaterialGroupProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isBookOpen, setBookOpen] = useState(false);
  const isArchived = group.project.status === "DONE";
  const hasProgram = group.program.length > 0;

  // Only the music this singer is given counts: an instrumental item on the
  // list has no readiness control, so it cannot be the piece that keeps the
  // ring short of a hundred. A programme of nothing but such items keeps its
  // offline control and simply draws no ring.
  const practised = practisedProgram(group.program);
  const total = practised.length;
  const ready = practised.filter(
    (item) => item.piece.my_readiness === "READY",
  ).length;
  const readyPct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const ringTone =
    readyPct === 100 ? "sage" : readyPct > 0 ? "gold" : "graphite";
  // The ring and its caption follow the withholding — 0/N here would read as
  // "has not touched a single piece", which is a claim nobody made. The rule
  // itself lives in one place, shared with `useProjectReadiness`.
  const readinessWithheld = isReadinessWithheld(group.program);
  // No seat, no readiness to report — and no ring, which would read "0 of N
  // pieces ready" about somebody who was never asked. The absence of a
  // participation is the honest test: a stand-in who also SINGS the programme
  // has one and keeps the ring, and only rows that reach here without one (the
  // podium, a delegation on a programme the reader is not cast in) lose it.
  const hasNoSeat = group.participationId === null;

  return (
    <div className={`space-y-4 ${isArchived ? "opacity-70" : "opacity-100"}`}>
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-ethereal-gold/30">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 shrink-0 p-2 rounded-lg ${
              isArchived ? "bg-ethereal-marble" : "bg-ethereal-gold/10"
            }`}
          >
            <Briefcase
              size={15}
              className={
                isArchived ? "text-ethereal-graphite" : "text-ethereal-gold"
              }
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <Eyebrow
              color={isArchived ? "muted" : "default"}
              className="block truncate"
            >
              {t("materials.project.event", "Wydarzenie:")}{" "}
              {group.project.title}
            </Eyebrow>
            <div className="flex items-center gap-1.5 mt-1">
              <CalendarDays
                size={11}
                className="text-ethereal-graphite shrink-0"
                aria-hidden="true"
              />
              <Eyebrow color="muted">
                {formatLocalizedDate(group.project.date_time)}
              </Eyebrow>
            </div>
          </div>
        </div>

        {isArchived ? (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-ethereal-marble/60 border border-ethereal-marble rounded-lg shadow-glass-solid">
            <Archive
              size={11}
              className="text-ethereal-graphite"
              aria-hidden="true"
            />
            <Eyebrow color="muted">
              {t("materials.project.archived_badge", "Archiwum")}
            </Eyebrow>
          </div>
        ) : hasNoSeat ? (
          // A project run rather than sung: no personal readiness to report, so
          // the completion ring (always 0/N here) would only mislead. Show what
          // this person is to the project instead — the full cast lives on each
          // piece.
          <div className="shrink-0 flex items-center gap-2.5">
            {hasProgram && <OfflineDownloadControl group={group} />}
            <div className="flex items-center gap-1.5 rounded-lg border border-ethereal-gold/30 bg-ethereal-gold/10 px-2.5 py-1 shadow-glass-solid">
              <Wand2
                size={11}
                className="text-ethereal-gold"
                aria-hidden="true"
              />
              <Eyebrow color="gold">
                {group.isConducting
                  ? t("materials.project.conducting_badge", "Prowadzisz")
                  : t("materials.project.standing_in_badge", "Asystent")}
              </Eyebrow>
            </div>
          </div>
        ) : (
          hasProgram && (
            <div className="shrink-0 flex items-center gap-2.5">
              <OfflineDownloadControl group={group} />
              {total === 0 ? null : readinessWithheld ? (
                <Badge
                  variant="neutral"
                  icon={<EyeOff size={11} aria-hidden="true" />}
                  title={t(
                    "materials.project.readiness_withheld_hint",
                    "Gotowość partii to prywatna notatka chórzysty — nie pokazujemy jej nikomu innemu.",
                  )}
                >
                  {t("materials.project.readiness_withheld", "Gotowość ukryta")}
                </Badge>
              ) : (
                <>
                  <Text
                    size="xs"
                    color="muted"
                    className="hidden text-right leading-tight sm:block"
                  >
                    {t("materials.project.readiness_caption", "{{ready}} z {{total}} partii gotowych", {
                      ready,
                      total,
                    })}
                  </Text>
                  <CompletionRing value={readyPct} tone={ringTone} size={44}>
                    <span className="text-[11px] font-bold tabular-nums text-ethereal-ink">
                      {ready}/{total}
                    </span>
                  </CompletionRing>
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* The whole concert in binding order, with the pencil in it. It leads the
          pieces because that is what a singer picks up on the way to a
          rehearsal — the rows below are for working on one piece at a time. */}
      {group.project.has_score_pdf && (
        <>
          <Button
            variant="secondary"
            size="touch"
            leftIcon={<BookOpen size={14} aria-hidden="true" />}
            onClick={() => setBookOpen(true)}
            className="w-full sm:w-auto"
          >
            {t("score_book.open_cta", "Otwórz książkę koncertu")}
          </Button>
          <ProjectScoreBook
            projectId={group.project.id}
            projectTitle={group.project.title}
            isOpen={isBookOpen}
            // The pencil follows the ROLE, not the podium. Standing in front of
            // the choir — whether as the named conductor or as a stand-in — does
            // not make someone a manager. The one exception is a leader whose
            // grant opens the choir's layer, and the book is one stand over the
            // whole programme, so it is armed only when EVERY piece in it is
            // theirs to mark for the choir — a pill the server would refuse on
            // half the pages reads as the app losing marks.
            mode={scoreAnnotatorModeFor({
              isManager: isManager(user),
              mayMarkForChoir:
                group.program.length > 0 &&
                group.program.every((item) => item.piece.may_mark_for_choir),
            })}
            onClose={() => setBookOpen(false)}
          />
        </>
      )}

      <div className="flex flex-col gap-3">
        {group.program.map((item) => (
          <PieceRow
            key={item.piece.id}
            piece={item.piece}
            projectId={group.project.id}
            order={item.order}
            isEncored={item.is_encore}
            isArchived={isArchived}
            hideReadiness={hasNoSeat}
          />
        ))}
      </div>
    </div>
  );
};
