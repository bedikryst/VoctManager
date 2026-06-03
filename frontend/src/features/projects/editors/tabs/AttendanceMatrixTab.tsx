/**
 * @file AttendanceMatrixTab.tsx
 * @description Attendance matrix for directors. Cells cycle a local draft on click
 * (instant, lag-free) and persist in one batch via the shared EditorActionBar. A capped,
 * scroll-locked grid with a sticky header row and sticky name column keeps a large matrix
 * navigable without running the page off the screen. Changed-but-unsaved cells carry a dot.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/AttendanceMatrixTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, ShieldAlert, X } from "lucide-react";

import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "@/shared/lib/time/intl";
import { cn } from "@/shared/lib/utils";
import { getLocationLabel } from "../../lib/projectPresentation";
import {
  useAttendanceMatrix,
  type AttendanceRecord,
  type AttendanceStatus,
} from "../hooks/useAttendanceMatrix";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

interface AttendanceMatrixTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

interface StatusDefinition {
  labelKey: string;
  defaultLabel: string;
  swatchClass: string;
  icon: React.ReactNode;
}

const STATUS_DEF: Record<NonNullable<AttendanceStatus> | "null", StatusDefinition> = {
  null: {
    labelKey: "projects.matrix.status.none",
    defaultLabel: "Brak wpisu",
    swatchClass:
      "bg-ethereal-parchment/50 hover:bg-ethereal-parchment text-ethereal-graphite/40 border border-ethereal-ink/8",
    icon: (
      <span
        className="h-1.5 w-1.5 rounded-full bg-ethereal-graphite/30"
        aria-hidden="true"
      />
    ),
  },
  PRESENT: {
    labelKey: "projects.matrix.status.present",
    defaultLabel: "Obecny",
    swatchClass:
      "bg-ethereal-sage hover:bg-ethereal-sage/90 text-white shadow-glass-ethereal",
    icon: <Check size={14} strokeWidth={3} aria-hidden="true" />,
  },
  LATE: {
    labelKey: "projects.matrix.status.late",
    defaultLabel: "Spóźnienie",
    swatchClass:
      "bg-ethereal-gold hover:bg-ethereal-gold/90 text-white shadow-glass-ethereal",
    icon: <Clock size={14} strokeWidth={3} aria-hidden="true" />,
  },
  ABSENT: {
    labelKey: "projects.matrix.status.absent",
    defaultLabel: "Nieobecny",
    swatchClass:
      "bg-ethereal-crimson hover:bg-ethereal-crimson/90 text-white shadow-glass-ethereal",
    icon: <X size={14} strokeWidth={3} aria-hidden="true" />,
  },
  EXCUSED: {
    labelKey: "projects.matrix.status.excused",
    defaultLabel: "Zwolniony",
    swatchClass:
      "bg-ethereal-amethyst hover:bg-ethereal-amethyst/90 text-white shadow-glass-ethereal",
    icon: <ShieldAlert size={14} strokeWidth={3} aria-hidden="true" />,
  },
};

type StatusKey = NonNullable<AttendanceStatus> | "null";

const isStatusKey = (key: string): key is StatusKey => key in STATUS_DEF;

interface MatrixCellProps {
  rehearsalId: string;
  participationId: string;
  record: AttendanceRecord | undefined;
  onToggle: (
    rehearsalId: string,
    participationId: string,
    record: AttendanceRecord | undefined,
  ) => void;
  isDirtyCell: boolean;
}

const MatrixCell = React.memo(
  ({
    rehearsalId,
    participationId,
    record,
    onToggle,
    isDirtyCell,
  }: MatrixCellProps) => {
    const { t } = useTranslation();
    const currentStatus = record?.status || null;
    const rawKey = String(currentStatus);
    const config = isStatusKey(rawKey) ? STATUS_DEF[rawKey] : STATUS_DEF.null;

    return (
      <td className="group relative border-b border-l border-ethereal-ink/6 p-1 text-center">
        {isDirtyCell && (
          <span
            className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ethereal-gold shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          onClick={() => onToggle(rehearsalId, participationId, record)}
          className={cn(
            "mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            config.swatchClass,
          )}
          title={t(config.labelKey, config.defaultLabel)}
          aria-label={t(config.labelKey, config.defaultLabel)}
        >
          {config.icon}
        </button>
      </td>
    );
  },
  (previousProps, nextProps) =>
    previousProps.record?.status === nextProps.record?.status &&
    previousProps.isDirtyCell === nextProps.isDirtyCell,
);

MatrixCell.displayName = "MatrixCell";

export const AttendanceMatrixTab = ({
  projectId,
  onDirtyStateChange,
}: AttendanceMatrixTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    projectRehearsals,
    enrichedParticipations,
    attendanceMap,
    dirtyCells,
    isDirty,
    isSaving,
    pendingCounts,
    cycleCell,
    saveChanges,
    discardChanges,
  } = useAttendanceMatrix(projectId, onDirtyStateChange);

  const pendingMetrics: React.ReactNode[] = [];
  if (pendingCounts.creates > 0) {
    pendingMetrics.push(
      <Badge key="creates" variant="success">
        +{pendingCounts.creates}
      </Badge>,
    );
  }
  if (pendingCounts.updates > 0) {
    pendingMetrics.push(
      <Badge key="updates" variant="warning">
        ~{pendingCounts.updates}
      </Badge>,
    );
  }
  if (pendingCounts.deletes > 0) {
    pendingMetrics.push(
      <Badge key="deletes" variant="danger">
        −{pendingCounts.deletes}
      </Badge>,
    );
  }

  return (
    <>
      <StaggeredBentoContainer className="w-full space-y-5 pb-24">
        <StaggeredBentoItem>
          <GlassCard variant="solid" padding="sm" isHoverable={false}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Eyebrow color="muted" className="mr-1">
                {t("projects.matrix.legend.title", "Status frekwencji")}
              </Eyebrow>
              {Object.entries(STATUS_DEF).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-md",
                      config.swatchClass,
                    )}
                    aria-hidden="true"
                  >
                    {config.icon}
                  </div>
                  <Text size="sm" color="graphite" weight="medium">
                    {t(config.labelKey, config.defaultLabel)}
                  </Text>
                </div>
              ))}
            </div>
          </GlassCard>
        </StaggeredBentoItem>

        <StaggeredBentoItem>
          <GlassCard
            variant="solid"
            padding="none"
            isHoverable={false}
            className="max-h-[75dvh] overflow-auto"
          >
            <table className="w-full min-w-200 border-collapse text-left text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 min-w-55 border-b border-ethereal-ink/8 bg-ethereal-marble p-4">
                    <Eyebrow color="muted">
                      {t("projects.matrix.table.rehearsal_date", "Próba / Data")}
                    </Eyebrow>
                  </th>
                  {enrichedParticipations.map((participation) => (
                    <th
                      key={participation.id}
                      className="min-w-15 border-b border-l border-ethereal-ink/6 bg-ethereal-marble p-4 text-center"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Text
                          size="xs"
                          weight="bold"
                          color="graphite"
                          truncate
                          className="max-w-20"
                          title={participation.artistData.last_name}
                        >
                          {participation.artistData.last_name}
                        </Text>
                        <Text size="xs" color="muted">
                          {participation.artistData.first_name}
                        </Text>
                      </div>
                    </th>
                  ))}
                  <th className="min-w-20 border-b border-l border-ethereal-ink/6 bg-ethereal-marble p-4 text-center">
                    <Eyebrow color="gold">
                      {t("projects.matrix.table.rate", "Frekwencja")}
                    </Eyebrow>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ethereal-ink/6">
                {projectRehearsals.length === 0 && (
                  <tr>
                    <td
                      colSpan={enrichedParticipations.length + 2}
                      className="py-12 text-center"
                    >
                      <Text size="sm" color="muted" className="italic">
                        {t(
                          "projects.matrix.empty.rehearsals",
                          "Brak zaplanowanych prób w tym projekcie.",
                        )}
                      </Text>
                    </td>
                  </tr>
                )}

                {projectRehearsals.length > 0 &&
                  enrichedParticipations.length === 0 && (
                    <tr>
                      <td
                        colSpan={projectRehearsals.length + 2}
                        className="py-12 text-center"
                      >
                        <Text size="sm" color="muted" className="italic">
                          {t(
                            "projects.matrix.empty.cast",
                            "Brak obsady przypisanej do projektu.",
                          )}
                        </Text>
                      </td>
                    </tr>
                  )}

                {projectRehearsals.map((rehearsal) => {
                  let presentCount = 0;
                  let totalAssigned = 0;
                  const rehearsalLocationLabel = getLocationLabel(
                    rehearsal.location,
                  );

                  enrichedParticipations.forEach((participation) => {
                    const isInvited =
                      !rehearsal.invited_participations ||
                      rehearsal.invited_participations.length === 0 ||
                      rehearsal.invited_participations.includes(
                        String(participation.id),
                      );

                    if (!isInvited) {
                      return;
                    }

                    totalAssigned += 1;

                    const cellKey = `${rehearsal.id}-${participation.id}`;
                    const record = attendanceMap.get(cellKey);
                    if (record?.status === "PRESENT" || record?.status === "LATE") {
                      presentCount += 1;
                    }
                  });

                  const attendanceRate =
                    totalAssigned > 0
                      ? Math.round((presentCount / totalAssigned) * 100)
                      : 0;

                  const rateClass =
                    attendanceRate >= 80
                      ? "border-ethereal-sage/30 bg-ethereal-sage/10 text-ethereal-sage"
                      : attendanceRate >= 50
                        ? "border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold"
                        : "border-ethereal-crimson/30 bg-ethereal-crimson-light/20 text-ethereal-crimson";

                  return (
                    <tr
                      key={rehearsal.id}
                      className="group transition-colors hover:bg-ethereal-gold/5"
                    >
                      <td className="sticky left-0 z-10 bg-ethereal-marble p-4">
                        <div className="flex flex-col gap-0.5">
                          <Text size="sm" weight="bold" color="gold">
                            {formatLocalizedDate(rehearsal.date_time, {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}{" "}
                            {formatLocalizedTime(rehearsal.date_time, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <Text size="xs" color="muted" truncate className="max-w-50">
                            {rehearsalLocationLabel}
                            {rehearsal.focus ? ` • ${rehearsal.focus}` : ""}
                          </Text>
                        </div>
                      </td>

                      {enrichedParticipations.map((participation) => {
                        const isInvited =
                          !rehearsal.invited_participations ||
                          rehearsal.invited_participations.length === 0 ||
                          rehearsal.invited_participations.includes(
                            String(participation.id),
                          );

                        if (!isInvited) {
                          return (
                            <td
                              key={`empty-${rehearsal.id}-${participation.id}`}
                              className="border-b border-l border-ethereal-ink/6 bg-ethereal-alabaster/50 p-1"
                            >
                              <div
                                className="flex h-full w-full items-center justify-center opacity-20"
                                title={t(
                                  "projects.matrix.not_invited",
                                  "Nie dotyczy",
                                )}
                              >
                                <div
                                  className="h-px w-6 rotate-45 bg-ethereal-graphite/40"
                                  aria-hidden="true"
                                />
                              </div>
                            </td>
                          );
                        }

                        const cellKey = `${rehearsal.id}-${participation.id}`;
                        const record = attendanceMap.get(cellKey);

                        return (
                          <MatrixCell
                            key={cellKey}
                            rehearsalId={rehearsal.id}
                            participationId={participation.id}
                            record={record}
                            onToggle={cycleCell}
                            isDirtyCell={dirtyCells.has(cellKey)}
                          />
                        );
                      })}

                      <td className="border-b border-l border-ethereal-ink/6 p-4 text-center">
                        <Text
                          className={cn(
                            "inline-block rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-widest",
                            rateClass,
                          )}
                        >
                          {attendanceRate}%
                        </Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </StaggeredBentoItem>
      </StaggeredBentoContainer>

      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.matrix.action_bar.description",
          "Zmieniono {{count}} wpisów frekwencji.",
          { count: pendingCounts.total },
        )}
        metrics={pendingMetrics.length > 0 ? <>{pendingMetrics}</> : undefined}
        onCancel={discardChanges}
        onConfirm={saveChanges}
        cancelText={t("common.actions.discard", "Odrzuć")}
        confirmText={t("projects.matrix.action_bar.save", "Zapisz frekwencję")}
        isLoading={isSaving}
      />
    </>
  );
};
