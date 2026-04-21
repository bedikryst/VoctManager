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

interface AttendanceMatrixTabProps {
  projectId: string;
}

const STATUS_DEF: Record<
  NonNullable<AttendanceStatus> | "null",
  {
    labelKey: string;
    defaultLabel: string;
    color: string;
    icon: React.ReactNode;
  }
> = {
  null: {
    labelKey: "projects.matrix.status.none",
    defaultLabel: "Brak wpisu",
    color:
      "bg-stone-50 hover:bg-stone-100 text-stone-200 border border-stone-200/60",
    icon: (
      <span
        className="h-1.5 w-1.5 rounded-full bg-stone-300"
        aria-hidden="true"
      />
    ),
  },
  PRESENT: {
    labelKey: "projects.matrix.status.present",
    defaultLabel: "Obecny",
    color:
      "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)]",
    icon: <Check size={14} strokeWidth={3} aria-hidden="true" />,
  },
  LATE: {
    labelKey: "projects.matrix.status.late",
    defaultLabel: "Spóźnienie",
    color:
      "bg-orange-400 hover:bg-orange-500 text-white shadow-[0_2px_10px_rgba(251,146,60,0.3)]",
    icon: <Clock size={14} strokeWidth={3} aria-hidden="true" />,
  },
  ABSENT: {
    labelKey: "projects.matrix.status.absent",
    defaultLabel: "Nieobecny",
    color:
      "bg-red-500 hover:bg-red-600 text-white shadow-[0_2px_10px_rgba(239,68,68,0.3)]",
    icon: <X size={14} strokeWidth={3} aria-hidden="true" />,
  },
  EXCUSED: {
    labelKey: "projects.matrix.status.excused",
    defaultLabel: "Zwolniony",
    color:
      "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_2px_10px_rgba(168,85,247,0.3)]",
    icon: <ShieldAlert size={14} strokeWidth={3} aria-hidden="true" />,
  },
};

type StatusKey = NonNullable<AttendanceStatus> | "null";

const isStatusKey = (key: string): key is StatusKey => key in STATUS_DEF;

const MatrixCell = React.memo(
  ({
    rehearsalId,
    participationId,
    record,
    onToggle,
    isMutating,
  }: {
    rehearsalId: string;
    participationId: string;
    record: AttendanceRecord | undefined;
    onToggle: (
      rehearsalId: string,
      participationId: string,
      record: AttendanceRecord | undefined,
    ) => void;
    isMutating: boolean;
  }) => {
    const { t } = useTranslation();
    const currentStatus = record?.status || null;
    const rawKey = String(currentStatus);
    const config = isStatusKey(rawKey) ? STATUS_DEF[rawKey] : STATUS_DEF.null;

    return (
      <td className="relative border-b border-l border-stone-200/60 p-1 text-center group">
        <button
          onClick={() => onToggle(rehearsalId, participationId, record)}
          disabled={isMutating}
          className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 active:scale-90 disabled:opacity-50 disabled:active:scale-100 ${config.color}`}
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
        <Loader2
          size={32}
          className="animate-spin text-brand opacity-50"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-stone-200/60 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold tracking-tight text-stone-900">
            <Users className="text-brand" size={20} aria-hidden="true" />
            {t(
              "projects.matrix.header.title",
              "Macierz Obecności i Frekwencji",
            )}
          </h2>
          <p className="text-sm text-stone-500">
            {t(
              "projects.matrix.header.subtitle",
              "Szybkie oznaczanie frekwencji na próbach. Zarządzaj statusem klikając w kafelki pod nazwiskiem.",
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 rounded-xl border border-stone-100 bg-stone-50 p-3">
          <div className="mb-1 w-full text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("projects.matrix.legend.title", "Status frekwencji")}
          </div>
          {Object.entries(STATUS_DEF).map(([key, config]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-600"
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded-md ${config.color}`}
                aria-hidden="true"
              >
                {config.icon}
              </div>
              {t(config.labelKey, config.defaultLabel)}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white shadow-sm scrollbar-hide">
        <table className="min-w-[800px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-stone-50/80 text-[10px] font-bold uppercase tracking-widest text-stone-500 backdrop-blur-xl">
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-stone-200/80 bg-stone-50/95 p-4 shadow-[1px_0_0_rgba(0,0,0,0.05)] backdrop-blur-xl">
                {t("projects.matrix.table.rehearsal_date", "Próba / Data")}
              </th>
              {enrichedParticipations.map((participation) => (
                <th
                  key={participation.id}
                  className="min-w-[60px] border-b border-l border-stone-200/80 p-4 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="max-w-[80px] truncate font-bold text-stone-700"
                      title={participation.artistData.last_name}
                    >
                      {participation.artistData.last_name}
                    </span>
                    <span className="text-[9px] text-stone-400">
                      {participation.artistData.first_name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="min-w-[80px] border-b border-l border-stone-200/80 p-4 text-center text-brand">
                {t("projects.matrix.table.rate", "Frekwencja")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {projectRehearsals.length === 0 && (
              <tr>
                <td
                  colSpan={enrichedParticipations.length + 2}
                  className="py-12 text-center text-sm italic text-stone-400"
                >
                  {t(
                    "projects.matrix.empty.rehearsals",
                    "Brak zaplanowanych prób w tym projekcie.",
                  )}
                </td>
              </tr>
            )}

            {projectRehearsals.length > 0 &&
              enrichedParticipations.length === 0 && (
                <tr>
                  <td
                    colSpan={projectRehearsals.length + 2}
                    className="py-12 text-center text-sm italic text-stone-400"
                  >
                    {t(
                      "projects.matrix.empty.cast",
                      "Brak obsady przypisanej do projektu.",
                    )}
                  </td>
                </tr>
              )}

            {projectRehearsals.map((rehearsal) => {
              let presentCount = 0;
              let totalAssigned = 0;
              const rehearsalLocationLabel = getLocationLabel(rehearsal.location);

              return (
                <React.Fragment key={rehearsal.id}>
                  {(() => {
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

                    return (
                      <tr className="group transition-colors hover:bg-blue-50/30">
                        <td className="sticky left-0 z-10 bg-white p-4 font-medium text-stone-900 shadow-[1px_0_0_rgba(0,0,0,0.05)] transition-colors group-hover:bg-blue-50/30">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-brand">
                              {formatLocalizedDate(rehearsal.date_time, {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                              })}{" "}
                              {formatLocalizedTime(rehearsal.date_time, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="max-w-[200px] truncate text-[10px] font-medium text-stone-400">
                              {rehearsalLocationLabel}
                              {rehearsal.focus ? ` • ${rehearsal.focus}` : ""}
                            </span>
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
                                className="border-b border-l border-stone-200/60 bg-stone-50/50 p-1"
                              >
                                <div
                                  className="flex h-full w-full items-center justify-center opacity-20"
                                  title={t(
                                    "projects.matrix.not_invited",
                                    "Nie dotyczy",
                                  )}
                                >
                                  <div
                                    className="h-px w-6 rotate-45 bg-stone-400"
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

                        <td className="border-b border-l border-stone-200/60 p-4 text-center">
                          <span
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-widest ${
                              attendanceRate >= 80
                                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                : attendanceRate >= 50
                                  ? "border-orange-100 bg-orange-50 text-orange-700"
                                  : "border-red-100 bg-red-50 text-red-700"
                            }`}
                          >
                            {attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
