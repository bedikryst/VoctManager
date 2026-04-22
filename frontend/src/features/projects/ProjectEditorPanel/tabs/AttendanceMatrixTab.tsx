/**
 * @file AttendanceMatrixTab.tsx
 * @description Advanced attendance matrix for directors and managers.
 * Delegates caching and mutation execution to useAttendanceMatrix and keeps location labels type-safe.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/AttendanceMatrixTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, Loader2, ShieldAlert, Users, X } from "lucide-react";

import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "@/shared/lib/time/intl";
import { getLocationLabel } from "../../lib/projectPresentation";
import {
  useAttendanceMatrix,
  type AttendanceRecord,
  type AttendanceStatus,
} from "../hooks/useAttendanceMatrix";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

interface AttendanceMatrixTabProps {
  projectId: string;
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
      "bg-ethereal-parchment/50 hover:bg-ethereal-parchment text-ethereal-graphite/40 border border-ethereal-incense/20",
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
  isMutating: boolean;
}

const MatrixCell = React.memo(
  ({
    rehearsalId,
    participationId,
    record,
    onToggle,
    isMutating,
  }: MatrixCellProps) => {
    const { t } = useTranslation();
    const currentStatus = record?.status || null;
    const rawKey = String(currentStatus);
    const config = isStatusKey(rawKey) ? STATUS_DEF[rawKey] : STATUS_DEF.null;

    return (
      <td className="group relative border-b border-l border-ethereal-incense/20 p-1 text-center">
        <button
          onClick={() => onToggle(rehearsalId, participationId, record)}
          disabled={isMutating}
          className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 active:scale-90 disabled:opacity-50 disabled:active:scale-100 ${config.swatchClass}`}
          title={t(config.labelKey, config.defaultLabel)}
          aria-label={t(config.labelKey, config.defaultLabel)}
        >
          {isMutating ? (
            <Loader2
              size={12}
              className="animate-spin opacity-50"
              aria-hidden="true"
            />
          ) : (
            config.icon
          )}
        </button>
      </td>
    );
  },
  (previousProps, nextProps) =>
    previousProps.record?.status === nextProps.record?.status &&
    previousProps.isMutating === nextProps.isMutating,
);

MatrixCell.displayName = "MatrixCell";

export const AttendanceMatrixTab = ({
  projectId,
}: AttendanceMatrixTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    isLoading,
    projectRehearsals,
    enrichedParticipations,
    attendanceMap,
    mutatingCells,
    handleToggleStatus,
  } = useAttendanceMatrix(projectId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <EtherealLoader />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <GlassCard
        variant="ethereal"
        padding="md"
        isHoverable={false}
        className="flex flex-col justify-between gap-6 md:flex-row md:items-center"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Users
              className="text-ethereal-gold"
              size={20}
              aria-hidden="true"
            />
            <Heading as="h2" size="xl" weight="medium">
              {t(
                "projects.matrix.header.title",
                "Macierz Obecności i Frekwencji",
              )}
            </Heading>
          </div>
          <Text size="sm" color="muted">
            {t(
              "projects.matrix.header.subtitle",
              "Szybkie oznaczanie frekwencji na próbach. Zarządzaj statusem klikając w kafelki pod nazwiskiem.",
            )}
          </Text>
        </div>

        <GlassCard
          variant="light"
          padding="sm"
          isHoverable={false}
          className="flex flex-wrap gap-3"
        >
          <div className="mb-1 w-full">
            <Eyebrow color="muted">
              {t("projects.matrix.legend.title", "Status frekwencji")}
            </Eyebrow>
          </div>
          {Object.entries(STATUS_DEF).map(([key, config]) => (
            <div
              key={key}
              className="flex items-center gap-1.5"
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded-md ${config.swatchClass}`}
                aria-hidden="true"
              >
                {config.icon}
              </div>
              <Text size="xs" color="graphite" weight="medium">
                {t(config.labelKey, config.defaultLabel)}
              </Text>
            </div>
          ))}
        </GlassCard>
      </GlassCard>

      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className="overflow-x-auto no-scrollbar"
      >
        <table className="w-full min-w-200 border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ethereal-parchment/80 backdrop-blur-ethereal">
            <tr>
              <th className="sticky left-0 z-20 min-w-55 border-b border-ethereal-incense/20 bg-ethereal-parchment/95 p-4 backdrop-blur-ethereal">
                <Eyebrow color="muted">
                  {t(
                    "projects.matrix.table.rehearsal_date",
                    "Próba / Data",
                  )}
                </Eyebrow>
              </th>
              {enrichedParticipations.map((participation) => (
                <th
                  key={participation.id}
                  className="min-w-15 border-b border-l border-ethereal-incense/20 p-4 text-center"
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
              <th className="min-w-20 border-b border-l border-ethereal-incense/20 p-4 text-center">
                <Eyebrow color="gold">
                  {t("projects.matrix.table.rate", "Frekwencja")}
                </Eyebrow>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ethereal-incense/10">
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
              const rehearsalLocationLabel = getLocationLabel(rehearsal.location);

              enrichedParticipations.forEach((participation) => {
                const isInvited =
                  rehearsal.invited_participations?.length === 0 ||
                  rehearsal.invited_participations?.includes(
                    String(participation.id),
                  );

                if (!isInvited) {
                  return;
                }

                totalAssigned += 1;

                const cellKey = `${rehearsal.id}-${participation.id}`;
                const record = attendanceMap.get(cellKey);
                if (
                  record?.status === "PRESENT" ||
                  record?.status === "LATE"
                ) {
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
                  <td className="sticky left-0 z-10 bg-ethereal-marble p-4 transition-colors group-hover:bg-ethereal-gold/5">
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
                      <Text
                        size="xs"
                        color="muted"
                        truncate
                        className="max-w-50"
                      >
                        {rehearsalLocationLabel}
                        {rehearsal.focus ? ` • ${rehearsal.focus}` : ""}
                      </Text>
                    </div>
                  </td>

                  {enrichedParticipations.map((participation) => {
                    const isInvited =
                      rehearsal.invited_participations?.length === 0 ||
                      rehearsal.invited_participations?.includes(
                        String(participation.id),
                      );

                    if (!isInvited) {
                      return (
                        <td
                          key={`empty-${rehearsal.id}-${participation.id}`}
                          className="border-b border-l border-ethereal-incense/20 bg-ethereal-parchment/40 p-1"
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
                    const isMutating = mutatingCells.has(cellKey);

                    return (
                      <MatrixCell
                        key={cellKey}
                        rehearsalId={rehearsal.id}
                        participationId={participation.id}
                        record={record}
                        onToggle={handleToggleStatus}
                        isMutating={isMutating}
                      />
                    );
                  })}

                  <td className="border-b border-l border-ethereal-incense/20 p-4 text-center">
                    <span
                      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-widest ${rateClass}`}
                    >
                      {attendanceRate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
};
