/**
 * @file AttendanceMatrixTab.tsx
 * @description Advanced Attendance Matrix for Directors and Choir Inspectors.
 * Delegates caching and mutation execution to useAttendanceMatrix.
 * Uses aggressive UI memoization to prevent cascading structural re-renders.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/AttendanceMatrixTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Check, X, Clock, ShieldAlert, Users } from "lucide-react";
import {
  useAttendanceMatrix,
  AttendanceRecord,
} from "../hooks/useAttendanceMatrix";

interface AttendanceMatrixTabProps {
  projectId: string;
}

const STATUS_DEF: Record<
  string,
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
        className="w-1.5 h-1.5 rounded-full bg-stone-300"
        aria-hidden="true"
      ></span>
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

const MatrixCell = React.memo(
  ({
    rehearsalId,
    participationId,
    record,
    onToggle,
    isMutating,
  }: {
    rehearsalId: string | number;
    participationId: string | number;
    record?: AttendanceRecord;
    onToggle: (
      rId: string | number,
      pId: string | number,
      rec?: AttendanceRecord,
    ) => void;
    isMutating: boolean;
  }) => {
    const { t } = useTranslation();
    const currentStatus = record?.status || null;
    const config = STATUS_DEF[String(currentStatus)] || STATUS_DEF.null;

    return (
      <td className="p-1 border-b border-l border-stone-200/60 text-center relative group">
        <button
          onClick={() => onToggle(rehearsalId, participationId, record)}
          disabled={isMutating}
          className={`w-7 h-7 mx-auto rounded-md flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-50 disabled:active:scale-100 ${config.color}`}
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
  (prevProps, nextProps) =>
    prevProps.record?.status === nextProps.record?.status &&
    prevProps.isMutating === nextProps.isMutating,
);

MatrixCell.displayName = "MatrixCell";

export default function AttendanceMatrixTab({
  projectId,
}: AttendanceMatrixTabProps): React.JSX.Element {
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
      <div className="flex justify-center items-center h-64">
        <Loader2
          size={32}
          className="animate-spin text-[#002395] opacity-50"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      <div className="bg-white border border-stone-200/60 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2 mb-2">
            <Users className="text-[#002395]" size={20} aria-hidden="true" />
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

        <div className="flex flex-wrap gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
          <div className="w-full text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">
            {t("projects.matrix.legend.title", "Status frekwencji")}
          </div>
          {Object.entries(STATUS_DEF).map(([key, config]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs text-stone-600 font-medium"
            >
              <div
                className={`w-4 h-4 rounded-md flex items-center justify-center ${config.color}`}
                aria-hidden="true"
              >
                {config.icon}
              </div>
              {t(config.labelKey, config.defaultLabel)}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-x-auto scrollbar-hide">
        <table className="w-full text-sm text-left border-collapse min-w-[800px]">
          <thead className="bg-stone-50/80 text-[10px] font-bold uppercase tracking-widest text-stone-500 sticky top-0 z-10 backdrop-blur-xl">
            <tr>
              <th className="p-4 border-b border-stone-200/80 min-w-[220px] sticky left-0 bg-stone-50/95 backdrop-blur-xl z-20 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                {t("projects.matrix.table.rehearsal_date", "Próba / Data")}
              </th>
              {enrichedParticipations.map((part) => (
                <th
                  key={part.id}
                  className="p-4 border-b border-l border-stone-200/80 text-center min-w-[60px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="truncate max-w-[80px] font-bold text-stone-700"
                      title={part.artistData.last_name}
                    >
                      {part.artistData.last_name}
                    </span>
                    <span className="text-[9px] text-stone-400">
                      {part.artistData.first_name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="p-4 border-b border-l border-stone-200/80 text-center min-w-[80px] text-[#002395]">
                {t("projects.matrix.table.rate", "Frekwencja")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {projectRehearsals.length === 0 && (
              <tr>
                <td
                  colSpan={enrichedParticipations.length + 2}
                  className="py-12 text-center text-stone-400 italic text-sm"
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
                    className="py-12 text-center text-stone-400 italic text-sm"
                  >
                    {t(
                      "projects.matrix.empty.cast",
                      "Brak obsady przypisanej do projektu.",
                    )}
                  </td>
                </tr>
              )}

            {projectRehearsals.map((reh) => {
              let presentCount = 0;
              let totalAssigned = 0;

              return (
                <React.Fragment key={reh.id}>
                  {(() => {
                    enrichedParticipations.forEach((part) => {
                      const isInvited =
                        reh.invited_participations?.length === 0 ||
                        reh.invited_participations?.includes(String(part.id));
                      if (!isInvited) return;

                      totalAssigned++;
                      const cellKey = `${reh.id}-${part.id}`;
                      const record = attendanceMap.get(cellKey);
                      if (
                        record?.status === "PRESENT" ||
                        record?.status === "LATE"
                      ) {
                        presentCount++;
                      }
                    });

                    const attendanceRate =
                      totalAssigned > 0
                        ? Math.round((presentCount / totalAssigned) * 100)
                        : 0;

                    return (
                      <tr className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-4 font-medium text-stone-900 sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#002395]">
                              {new Date(reh.date_time).toLocaleDateString(
                                t("common.locale", "pl-PL"),
                                {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                },
                              )}{" "}
                              {new Date(reh.date_time).toLocaleTimeString(
                                t("common.locale", "pl-PL"),
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                            <span className="text-[10px] text-stone-400 font-medium truncate max-w-[200px]">
                              {reh.location} {reh.focus && `• ${reh.focus}`}
                            </span>
                          </div>
                        </td>

                        {enrichedParticipations.map((part) => {
                          const isInvited =
                            reh.invited_participations?.length === 0 ||
                            reh.invited_participations?.includes(
                              String(part.id),
                            );

                          if (!isInvited) {
                            return (
                              <td
                                key={`empty-${reh.id}-${part.id}`}
                                className="p-1 border-b border-l border-stone-200/60 bg-stone-50/50"
                              >
                                <div
                                  className="w-full h-full flex items-center justify-center opacity-20"
                                  title={t(
                                    "projects.matrix.not_invited",
                                    "Nie dotyczy",
                                  )}
                                >
                                  <div
                                    className="w-6 h-px bg-stone-400 rotate-45"
                                    aria-hidden="true"
                                  ></div>
                                </div>
                              </td>
                            );
                          }

                          const cellKey = `${reh.id}-${part.id}`;
                          const record = attendanceMap.get(cellKey);
                          const isMutating = mutatingCells.has(cellKey);

                          return (
                            <MatrixCell
                              key={cellKey}
                              rehearsalId={reh.id}
                              participationId={part.id}
                              record={record}
                              onToggle={handleToggleStatus}
                              isMutating={isMutating}
                            />
                          );
                        })}

                        <td className="p-4 border-b border-l border-stone-200/60 text-center">
                          <span
                            className={`text-[10px] font-bold antialiased tracking-widest px-2.5 py-1.5 rounded-lg border ${
                              attendanceRate >= 80
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                : attendanceRate >= 50
                                  ? "bg-orange-50 border-orange-100 text-orange-700"
                                  : "bg-red-50 border-red-100 text-red-700"
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
}
