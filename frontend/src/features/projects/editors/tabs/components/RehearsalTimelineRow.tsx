/**
 * @file RehearsalTimelineRow.tsx
 * @description One stop on the project's rehearsal runway: a calendar stamp that
 * anchors the row, the clock, and the session's own facts underneath it. The
 * concert renders through the same component so it closes the list it belongs to
 * — which is also what makes a rehearsal scheduled after the concert legible as
 * a mistake, without any copy having to point it out.
 * The date used to be a chip sitting in a line of four other chips of identical
 * weight; nothing in the row could be scanned. The stamp is the only element
 * allowed to shout here.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/RehearsalTimelineRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Trash2, Users } from "lucide-react";

import type { RehearsalTimelineEntry } from "../../hooks/useRehearsalsTab";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Metric, Text } from "@/shared/ui/primitives/typography";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";

interface RehearsalTimelineRowProps {
  readonly entry: RehearsalTimelineEntry;
  /** Total people on the project — the yardstick for "is this tutti?". */
  readonly castSize: number;
  /** First still-upcoming stop: carries the gold rail, nothing else does. */
  readonly isNext: boolean;
  /** This row is the one the compose form is currently bound to. */
  readonly isEditing: boolean;
  readonly isPast: boolean;
  readonly concertTitle: string;
  /** What the closing row is called — resolved by the tab, which knows the kind. */
  readonly eventMoment: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

export const RehearsalTimelineRow = ({
  entry,
  castSize,
  isNext,
  isEditing,
  isPast,
  concertTitle,
  eventMoment,
  onEdit,
  onDelete,
}: RehearsalTimelineRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { rehearsal } = entry;
  const isConcert = rehearsal === null;

  const dayNumber = formatLocalizedDate(
    entry.at,
    { day: "numeric" },
    undefined,
    entry.timezone,
  );
  const monthLabel = formatLocalizedDate(
    entry.at,
    { month: "short" },
    undefined,
    entry.timezone,
  );

  const invitedCount = rehearsal?.invited_participations?.length ?? 0;
  const isTutti = invitedCount === 0 || invitedCount === castSize;

  return (
    <li
      className={cn(
        "relative flex gap-4 py-4 pl-5 pr-3 transition-colors",
        isPast && "opacity-70",
        isConcert && "bg-ethereal-gold/5",
        isEditing && "bg-ethereal-amethyst/6",
      )}
    >
      {(isNext || isEditing) && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-0.75",
            isEditing ? "bg-ethereal-amethyst/70" : "bg-ethereal-gold",
          )}
        />
      )}

      <div
        className={cn(
          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-nested border",
          isEditing
            ? "border-ethereal-amethyst/45 bg-ethereal-amethyst/10"
            : isConcert
              ? "border-ethereal-gold/50 bg-ethereal-gold/12"
              : isNext
                ? "border-ethereal-gold/45 bg-ethereal-marble"
                : "border-hairline-strong bg-ethereal-marble",
        )}
      >
        <Metric as="span" size="xl" className="leading-none">
          {dayNumber}
        </Metric>
        <Eyebrow
          as="span"
          size="overline-sm"
          color={isConcert ? "gold" : "muted"}
          className="mt-1"
        >
          {monthLabel}
        </Eyebrow>
      </div>

      {isConcert ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Eyebrow color="gold">{eventMoment}</Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Text size="base" weight="medium" className="min-w-0 truncate">
              {concertTitle}
            </Text>
            <DualTimeDisplay
              value={entry.at}
              timeZone={entry.timezone}
              orientation="row"
              spacing="compact"
              size="base"
              weight="medium"
              color="muted"
              local="paired"
            />
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DualTimeDisplay
              value={entry.at}
              endValue={rehearsal.end_date_time}
              timeZone={entry.timezone}
              orientation="row"
              spacing="compact"
              size="md"
              weight="medium"
              local="paired"
            />
            {!rehearsal.is_mandatory && (
              <Badge variant="neutral">
                {t("projects.rehearsals.status.optional", "Opcjonalna")}
              </Badge>
            )}
          </div>

          {/* No pin here: `LocationPreview` brings its own, and the two together
              printed a doubled marker in front of every venue name. */}
          {rehearsal.location ? (
            <LocationPreview
              locationRef={rehearsal.location}
              variant="minimal"
              className="justify-start"
            />
          ) : (
            <Text size="sm" color="muted">
              {t("common.labels.not_available", "Brak danych")}
            </Text>
          )}

          {rehearsal.focus?.trim() && (
            <Text size="sm" color="graphite" className="text-pretty italic">
              {rehearsal.focus}
            </Text>
          )}

          {/* Who is called is metadata, not status: it sits at the weight of the
              venue it belongs beside. As a green success chip on every row it
              only competed with the facts. */}
          <div className="flex items-center gap-1.5">
            <Users
              size={12}
              className="shrink-0 text-ethereal-graphite/40"
              aria-hidden="true"
            />
            <Caption color="muted">
              {isTutti
                ? t("projects.rehearsals.status.tutti", "Tutti")
                : t("projects.rehearsals.status.invited", "Wezwanych: {{count}}", {
                    count: invitedCount,
                  })}
            </Caption>
          </div>
        </div>
      )}

      {!isConcert && (
        <div className="flex shrink-0 items-start gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            title={t("projects.rehearsals.actions.edit", "Edytuj próbę")}
            aria-label={t("projects.rehearsals.actions.edit", "Edytuj próbę")}
            className="text-ethereal-graphite/50"
          >
            <Edit2 size={15} aria-hidden="true" />
          </Button>
          {/* Crimson on hover only. Eight rows of permanently red bins read as
              eight alarms, and crimson is reserved for something being wrong. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title={t("projects.rehearsals.actions.delete", "Usuń próbę")}
            aria-label={t("projects.rehearsals.actions.delete", "Usuń próbę")}
            className="text-ethereal-graphite/50 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
          >
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        </div>
      )}
    </li>
  );
};
