/**
 * @file RehearsalsWidget.tsx
 * @description Dashboard widget displaying upcoming rehearsals, progress, and absence alerts.
 * Synchronously consumes pre-fetched rehearsal arrays from the React Query cache via useProjectData.
 * Displays dynamic `absent_count` injected by the backend serializers.
 * @module panel/projects/ProjectCard/widgets/RehearsalsWidget
 */

import React, { useMemo } from "react";
import { Calendar, UserMinus } from "lucide-react";

import type { Project, Rehearsal } from "../../../../shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "../../../../shared/ui/GlassCard";

interface RehearsalsWidgetProps {
  project: Project;
  onEdit?: () => void;
}

// Extends the base Rehearsal type safely for annotated backend fields
interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

export default function RehearsalsWidget({
  project,
  onEdit,
}: RehearsalsWidgetProps): React.JSX.Element {
  const {
    rehearsals: projectRehearsals,
    participations: projectParticipations,
  } = useProjectData(String(project.id));

  const sortedRehearsals = useMemo<EnrichedRehearsal[]>(() => {
    return [...projectRehearsals].sort(
      (a, b) =>
        new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );
  }, [projectRehearsals]);

  const pastRehearsals = useMemo<EnrichedRehearsal[]>(() => {
    const now = new Date();
    return sortedRehearsals.filter((r) => new Date(r.date_time) < now);
  }, [sortedRehearsals]);

  const upcomingRehearsals = useMemo<EnrichedRehearsal[]>(() => {
    const now = new Date();
    return sortedRehearsals
      .filter((r) => new Date(r.date_time) >= now)
      .slice(0, 3);
  }, [sortedRehearsals]);

  const progressPercentage: number =
    sortedRehearsals.length > 0
      ? (pastRehearsals.length / sortedRehearsals.length) * 100
      : 0;

  return (
    <GlassCard
      variant="solid"
      onClick={onEdit}
      className={`p-5 flex flex-col justify-between transition-all group min-h-[220px] ${onEdit ? "cursor-pointer hover:border-[#002395]/40 hover:shadow-md" : ""}`}
      role={onEdit ? "button" : "region"}
      aria-label="Manage project rehearsals"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
          <Calendar
            size={16}
            className="text-[#002395] group-hover:scale-110 transition-transform"
            aria-hidden="true"
          />
          Najbliższe Próby
        </h4>
        {onEdit && (
          <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">
            Edytuj
          </button>
        )}
      </div>

      {sortedRehearsals.length > 0 ? (
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <div className="flex justify-between text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">
              <span>Postęp</span>
              <span>
                {pastRehearsals.length} / {sortedRehearsals.length}
              </span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5">
              <div
                className="bg-[#002395] h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <ul className="space-y-3 flex-1 mt-2">
            {upcomingRehearsals.map((reh) => {
              const invitedCount: number =
                reh.invited_participations?.length || 0;
              const isTutti: boolean =
                invitedCount === 0 ||
                invitedCount === projectParticipations.length;
              const absences = reh.absent_count || 0;

              return (
                <li
                  key={reh.id}
                  className="text-[11px] text-stone-600 flex flex-col gap-1 border-b border-stone-50 last:border-0 pb-2 last:pb-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 shadow-sm ${reh.is_mandatory ? "bg-[#002395]" : "bg-orange-400"}`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col">
                        <span>
                          <strong className="text-stone-800">
                            {new Date(reh.date_time).toLocaleDateString(
                              "pl-PL",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </strong>
                          <span className="text-stone-400 ml-1">
                            ({reh.location})
                          </span>
                        </span>
                        {reh.focus && (
                          <span className="text-[10px] text-stone-500 italic line-clamp-1 mt-0.5">
                            {reh.focus}
                          </span>
                        )}

                        {absences > 0 && (
                          <span className="flex items-center gap-1 text-[9px] font-bold antialiased uppercase tracking-widest text-red-500 mt-1">
                            <UserMinus size={10} aria-hidden="true" /> Zgłoszono
                            braki: {absences}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[8px] uppercase tracking-widest font-bold antialiased px-1.5 py-0.5 rounded ${isTutti ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"}`}
                      >
                        {isTutti ? "TUTTI" : "SEKCYJNA"}
                      </span>
                      {!reh.is_mandatory && (
                        <span className="text-[8px] text-orange-600 font-bold antialiased uppercase tracking-widest">
                          Opcjonalna
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic flex-1 flex items-center justify-center py-4">
          Brak zaplanowanych prób.
        </p>
      )}
    </GlassCard>
  );
}
