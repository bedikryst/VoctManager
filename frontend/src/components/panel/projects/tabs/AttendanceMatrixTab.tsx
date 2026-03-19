/**
 * @file AttendanceMatrixTab.tsx
 * @description Advanced Attendance Matrix for Directors and Choir Inspectors.
 * @architecture
 * Implements a High-Density Data Grid with Optimistic UI mutations (One-Click status cycling).
 * Backed by React Query for declarative data fetching and caching.
 * Incorporates Sonner for graceful error handling during mutation rollbacks.
 * @module project/tabs/AttendanceMatrixTab
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Check, X, Clock, ShieldAlert, Users } from 'lucide-react';

import api from '../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';

// Type Definitions
import type { Rehearsal, Participation, Artist } from '../../../../types';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;

export interface AttendanceRecord {
  id: string | number;
  rehearsal: string;
  participation: string;
  status: AttendanceStatus;
}

interface EnrichedParticipation extends Participation {
  artistData: Artist;
}

interface AttendanceMatrixTabProps {
  projectId: string;
}

interface StatusDefinition {
  value: AttendanceStatus;
  color: string;
  icon: React.ReactNode | null;
  label: string;
}

// --- Static Configurations & Styles ---

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";

const STATUS_CYCLE: StatusDefinition[] = [
    { value: null, color: 'bg-stone-100/50 hover:bg-stone-200/80 border-stone-200/60 text-transparent', icon: null, label: 'Brak' },
    { value: 'PRESENT', color: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <Check size={14} aria-hidden="true"/>, label: 'Obecny' },
    { value: 'ABSENT', color: 'bg-red-500 hover:bg-red-600 border-red-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <X size={14} aria-hidden="true"/>, label: 'Nieobecny' },
    { value: 'LATE', color: 'bg-orange-500 hover:bg-orange-600 border-orange-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <Clock size={12} aria-hidden="true"/>, label: 'Spóźniony' },
    { value: 'EXCUSED', color: 'bg-purple-500 hover:bg-purple-600 border-purple-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <ShieldAlert size={12} aria-hidden="true"/>, label: 'Uspraw.' }
];

/**
 * AttendanceMatrixTab Component
 * @param {AttendanceMatrixTabProps} props
 * @returns {React.JSX.Element}
 */
export default function AttendanceMatrixTab({ projectId }: AttendanceMatrixTabProps): React.JSX.Element {
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  const { rehearsals, participations, artists } = context;

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);

  // --- Derived Data (Memoized) ---
  const projectRehearsals = useMemo<Rehearsal[]>(() => {
      return rehearsals
        .filter((r) => String(r.project) === String(projectId))
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [rehearsals, projectId]);

  const projectParticipations = useMemo<Participation[]>(() => {
      return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  // --- Data Fetching (React Query) ---
  const { data: fetchedAttendances, isLoading: isFetching } = useQuery({
    queryKey: ['attendances', 'project', projectId],
    queryFn: async () => {
      const attRes = await api.get('/api/attendances/');
      const rehearsalIds = projectRehearsals.map((r) => String(r.id));
      
      return Array.isArray(attRes.data) 
        ? attRes.data.filter((a: AttendanceRecord) => rehearsalIds.includes(String(a.rehearsal))) 
        : [];
    },
    enabled: projectRehearsals.length > 0 // Only fetch if there are rehearsals to map against
  });

  // Sync fetched data into local state for immediate Optimistic UI mutations
  useEffect(() => {
    if (fetchedAttendances) {
        setAttendances(fetchedAttendances);
    }
  }, [fetchedAttendances]);

  // --- Roster Grouping ---
  const groupedRoster = useMemo<Record<string, EnrichedParticipation[]>>(() => {
      const groups: Record<string, EnrichedParticipation[]> = { 'Soprany': [], 'Alty': [], 'Tenory': [], 'Basy': [], 'Inne': [] };
      
      projectParticipations.forEach((part) => {
          const artist = artists.find((a) => String(a.id) === String(part.artist));
          if (artist) {
              // Note: Assuming voice_type exists on Artist model based on context, fallback to empty string
              const vt = (artist as any).voice_type || '';
              const enrichedPart: EnrichedParticipation = { ...part, artistData: artist };
              
              if (vt.startsWith('S')) groups['Soprany'].push(enrichedPart);
              else if (vt.startsWith('A') || vt === 'MEZ') groups['Alty'].push(enrichedPart);
              else if (vt.startsWith('T') || vt === 'CT') groups['Tenory'].push(enrichedPart);
              else if (vt.startsWith('B')) groups['Basy'].push(enrichedPart);
              else groups['Inne'].push(enrichedPart);
          }
      });

      Object.keys(groups).forEach((key) => {
          groups[key].sort((a, b) => a.artistData.last_name.localeCompare(b.artistData.last_name));
      });

      return groups;
  }, [projectParticipations, artists]);

  // --- Mutation Handlers (Optimistic UI) ---
  const handleCellClick = async (rehearsalId: string, participationId: string, currentRecord?: AttendanceRecord): Promise<void> => {
      const currentIndex = STATUS_CYCLE.findIndex((s) => s.value === (currentRecord?.status || null));
      const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
      const nextStatus = STATUS_CYCLE[nextIndex].value;

      // 1. Snapshot previous state for rollback
      const previousAttendances = [...attendances];
      let newAttendances = [...attendances];
      
      // 2. Apply Optimistic Update
      if (nextStatus === null && currentRecord) {
          newAttendances = newAttendances.filter((a) => String(a.id) !== String(currentRecord.id));
      } else {
          if (currentRecord) {
              newAttendances = newAttendances.map((a) => String(a.id) === String(currentRecord.id) ? { ...a, status: nextStatus } : a);
          } else {
              // Generate a temporary ID for immediate rendering
              newAttendances.push({ 
                  id: `temp-${Date.now()}`, 
                  rehearsal: rehearsalId, 
                  participation: participationId, 
                  status: nextStatus 
              });
          }
      }
      setAttendances(newAttendances);

      // 3. Execute Network Request
      try {
          if (nextStatus === null && currentRecord) {
              await api.delete(`/api/attendances/${currentRecord.id}/`);
          } else if (nextStatus !== null && currentRecord) {
              await api.patch(`/api/attendances/${currentRecord.id}/`, { status: nextStatus });
          } else if (nextStatus !== null && !currentRecord) {
              const res = await api.post('/api/attendances/', { rehearsal: rehearsalId, participation: participationId, status: nextStatus });
              // Replace temporary ID with actual database ID silently
              setAttendances((prev) => prev.map((a) => 
                String(a.id).startsWith('temp-') && a.rehearsal === rehearsalId && a.participation === participationId 
                ? res.data 
                : a
              ));
          }
      } catch (err) {
          console.error("[AttendanceMatrix] Cell mutation failed, executing rollback:", err);
          setAttendances(previousAttendances); 
          toast.error("Błąd zapisu", {
              description: "Nie udało się zaktualizować statusu obecności. Zmiany zostały cofnięte."
          });
      }
  };

  // --- Render Cycle ---

  if (isFetching && attendances.length === 0) {
      return (
          <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-stone-400" aria-label="Ładowanie danych..." />
          </div>
      );
  }

  if (projectRehearsals.length === 0 || projectParticipations.length === 0) {
      return (
          <div className={`${STYLE_GLASS_CARD} p-12 text-center text-stone-500 flex flex-col items-center justify-center`}>
            <Users size={32} className="mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p className="font-bold antialiased uppercase tracking-widest text-[11px] text-stone-500 mb-2">Brakuje danych do macierzy</p>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">Aby wygenerować dziennik, musisz zdefiniować próby oraz przypisać artystów w module Casting.</p>
          </div>
      );
  }

  return (
    <div className={STYLE_GLASS_CARD}>
      {/* Legend */}
      <div className="bg-stone-50/40 p-5 border-b border-white/60 flex flex-wrap items-center gap-6">
          <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Legenda kliknięć:</span>
          {STATUS_CYCLE.filter((s) => s.value !== null).map((status) => (
              <div key={status.value || 'null'} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shadow-sm ${status.color}`}>
                      {status.icon}
                  </div>
                  <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-600">{status.label}</span>
              </div>
          ))}
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-white/80 backdrop-blur-md p-4 border-b border-r border-stone-200/60 w-48 min-w-[220px] shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                  <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Chórzysta</span>
              </th>
              {projectRehearsals.map((reh) => (
                <th key={reh.id} className="p-3 border-b border-stone-200/60 min-w-[64px] text-center bg-white/40 group relative">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">
                            {new Date(reh.date_time).toLocaleDateString('pl-PL', { month: 'short' })}
                        </span>
                        <span className="text-sm font-bold text-stone-800 leading-none mt-1 tracking-tight">
                            {new Date(reh.date_time).getDate()}
                        </span>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-stone-900/90 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-xl">
                        {new Date(reh.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}<br/>
                        <span className="opacity-75">{reh.location}</span>
                    </div>
                </th>
              ))}
              <th className="p-4 border-b border-l border-stone-200/60 text-center bg-white/40 w-28">
                  <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Frekwencja</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRoster).map(([groupName, groupParticipations]) => {
                if (groupParticipations.length === 0) return null;

                return (
                    <React.Fragment key={groupName}>
                        {/* Voice Group Header */}
                        <tr>
                            <td colSpan={projectRehearsals.length + 2} className="bg-stone-50/50 p-3 border-y border-stone-200/60">
                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] ml-3 flex items-center gap-2">
                                    {groupName} <span className="px-1.5 py-0.5 bg-blue-50 rounded-md opacity-70">{groupParticipations.length}</span>
                                </span>
                            </td>
                        </tr>
                        
                        {/* Participants Rows */}
                        {groupParticipations.map((part) => {
                            const artistRecords = attendances.filter((a) => String(a.participation) === String(part.id));
                            const presents = artistRecords.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
                            const attendanceRate = projectRehearsals.length > 0 ? Math.round((presents / projectRehearsals.length) * 100) : 0;

                            return (
                                <tr key={part.id} className="hover:bg-white/60 transition-colors group">
                                    {/* Fixed Artist Name Column */}
                                    <td className="sticky left-0 z-10 bg-white/80 backdrop-blur-md group-hover:bg-white p-4 border-b border-r border-stone-200/60 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-stone-800 truncate tracking-tight">
                                                {part.artistData.first_name} {part.artistData.last_name}
                                            </span>
                                        </div>
                                    </td>
                                    
                                    {/* Rehearsal Interaction Cells */}
                                    {projectRehearsals.map((reh) => {
                                        const record = attendances.find((a) => String(a.rehearsal) === String(reh.id) && String(a.participation) === String(part.id));
                                        const currentStatusObj = STATUS_CYCLE.find((s) => s.value === (record?.status || null)) || STATUS_CYCLE[0];

                                        return (
                                            <td key={`${part.id}-${reh.id}`} className="p-2 border-b border-stone-100/50 text-center">
                                                <button 
                                                    onClick={() => handleCellClick(String(reh.id), String(part.id), record)}
                                                    className={`w-8 h-8 mx-auto rounded-lg border flex items-center justify-center transition-all transform active:scale-90 shadow-sm ${currentStatusObj.color}`}
                                                    title={currentStatusObj.label}
                                                    aria-label={`Oznacz obecność: ${currentStatusObj.label}`}
                                                >
                                                    {currentStatusObj.icon}
                                                </button>
                                            </td>
                                        );
                                    })}

                                    {/* Attendance Rate Summary */}
                                    <td className="p-4 border-b border-l border-stone-200/60 text-center">
                                        <span className={`text-[10px] font-bold antialiased tracking-widest px-2.5 py-1.5 rounded-lg border ${
                                            attendanceRate >= 80 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                            attendanceRate >= 50 ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-red-50 border-red-100 text-red-700'
                                        }`}>
                                            {attendanceRate}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </React.Fragment>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}