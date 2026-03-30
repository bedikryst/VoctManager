/**
 * @file Rehearsals.tsx
 * @description Master Attendance Log and Inspector Dashboard.
 * @architecture Enterprise 2026
 * - Employs Two-Way Data Binding via React Query with optimistic UI state rendering.
 * - Implements "Smart Context Resolution" to auto-select the most relevant upcoming project.
 * - Utilizes O(1) Hash Maps for instantaneous relational data matching (Artists, Attendances).
 * - Defers heavy text-input API syncs to `onBlur` events, optimizing network traffic during active typing.
 * @module hr/Rehearsals
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
    Calendar, MapPin, Users, CheckCircle2, 
    AlertCircle, Loader2, CheckSquare, Clock, 
    ShieldAlert, Target, SearchX, Briefcase,
    ChevronDown
} from 'lucide-react';

import api from '../../utils/api';
import type { Project, Rehearsal, Participation, Attendance, Artist } from '../../types';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

const STYLE_PREMIUM_GLASS = "bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] rounded-[2rem]";
const STYLE_DARK_GLASS_INPUT = "w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] font-bold appearance-none cursor-pointer hover:bg-white/10";

export default function Rehearsals(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  const results = useQueries({
    queries: [
      { queryKey: ['reh-projects'], queryFn: async () => (await api.get('/api/projects/')).data },
      { queryKey: ['reh-rehearsals'], queryFn: async () => (await api.get('/api/rehearsals/')).data },
      { queryKey: ['reh-participations'], queryFn: async () => (await api.get('/api/participations/')).data },
      { queryKey: ['reh-attendances'], queryFn: async () => (await api.get('/api/attendances/')).data },
      { queryKey: ['reh-artists'], queryFn: async () => (await api.get('/api/artists/')).data }
    ]
  });

  const isLoading = results.some(q => q.isLoading);
  const isError = results.some(q => q.isError);

  useEffect(() => {
    if (isError) {
      toast.error("Błąd synchronizacji", { description: "Nie udało się załadować danych z serwera." });
    }
  }, [isError]);

  const data = useMemo(() => ({
    projects: extractData(results[0].data) as Project[],
    rehearsals: extractData(results[1].data) as Rehearsal[],
    participations: extractData(results[2].data) as Participation[],
    attendances: extractData(results[3].data) as Attendance[],
    artists: extractData(results[4].data) as Artist[]
  }), [results]);

  // --- SMART CONTEXT RESOLUTION (Auto-Select Project) ---
  useEffect(() => {
      if (!selectedProjectId && data.projects.length > 0) {
          const now = new Date();
          
          // Szukamy aktywnych wydarzeń (w przyszłości)
          const activeProjects = data.projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
          const upcoming = activeProjects
              .filter(p => new Date(p.date_time) >= new Date(now.getTime() - 24 * 60 * 60 * 1000)) // wliczając dzisiejsze
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

          if (upcoming.length > 0) {
              setSelectedProjectId(String(upcoming[0].id));
          } else {
              // Fallback: Jeśli nie ma nadchodzących, wybierz chronologicznie ostatni
              const past = [...data.projects].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
              setSelectedProjectId(String(past[0].id));
          }
      }
  }, [data.projects, selectedProjectId]);

  // --- HASH MAPS & RELATIONS ---
  const artistMap = useMemo<Map<string, Artist>>(() => {
      const map = new Map<string, Artist>();
      data.artists.forEach(a => map.set(String(a.id), a));
      return map;
  }, [data.artists]);

  const projectRehearsals = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.rehearsals
          .filter(r => String(r.project) === String(selectedProjectId))
          .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [data.rehearsals, selectedProjectId]);

  const projectParticipations = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.participations.filter(p => String(p.project) === String(selectedProjectId) && p.status !== 'DEC');
  }, [data.participations, selectedProjectId]);

  // Auto-select first rehearsal if project changes
  useEffect(() => {
      if (projectRehearsals.length > 0 && (!activeRehearsalId || !projectRehearsals.find(r => String(r.id) === activeRehearsalId))) {
          setActiveRehearsalId(String(projectRehearsals[0].id));
      } else if (projectRehearsals.length === 0) {
          setActiveRehearsalId(null);
      }
  }, [projectRehearsals, activeRehearsalId]);

  const activeRehearsal = useMemo(() => {
      return projectRehearsals.find(r => String(r.id) === activeRehearsalId) || null;
  }, [projectRehearsals, activeRehearsalId]);

  const invitedParticipations = useMemo(() => {
      if (!activeRehearsal) return [];
      const invitedIds = activeRehearsal.invited_participations || [];
      const relevantParts = invitedIds.length > 0 
          ? projectParticipations.filter(p => invitedIds.includes(String(p.id)))
          : projectParticipations; // Tutti fallback
      
      return relevantParts.sort((a, b) => {
          const nameA = artistMap.get(String(a.artist))?.last_name || '';
          const nameB = artistMap.get(String(b.artist))?.last_name || '';
          return nameA.localeCompare(nameB);
      });
  }, [activeRehearsal, projectParticipations, artistMap]);

  const attendanceMap = useMemo<Map<string, Attendance>>(() => {
      const map = new Map<string, Attendance>();
      if (activeRehearsal) {
          data.attendances
              .filter(a => String(a.rehearsal) === String(activeRehearsal.id))
              .forEach(a => map.set(String(a.participation), a));
      }
      return map;
  }, [data.attendances, activeRehearsal]);

  const stats = useMemo(() => {
      let present = 0; let late = 0; let absent = 0; let none = 0; let excused = 0;
      invitedParticipations.forEach(p => {
          const att = attendanceMap.get(String(p.id));
          if (!att) none++;
          else if (att.status === 'PRESENT') present++;
          else if (att.status === 'LATE') late++;
          else if (att.status === 'EXCUSED') excused++;
          else absent++;
      });
      const total = invitedParticipations.length;
      const completionRate = total > 0 ? ((total - none) / total) * 100 : 0;
      
      return { present, late, absent, excused, none, total, completionRate };
  }, [invitedParticipations, attendanceMap]);

  // --- MUTATIONS ---
  const handleMarkAllPresent = async (): Promise<void> => {
      if (!activeRehearsalId || invitedParticipations.length === 0) return;
      
      setIsMarkingAll(true);
      const toastId = toast.loading("Zbiorcze zaznaczanie obecności...");

      try {
          const promises = invitedParticipations.map(part => {
              const existing = attendanceMap.get(String(part.id));
              // Update only empty or absent records - respect lates and excusals
              if (existing) {
                  if (existing.status !== 'PRESENT' && existing.status !== 'EXCUSED' && existing.status !== 'LATE') {
                      return api.patch(`/api/attendances/${existing.id}/`, { status: 'PRESENT', minutes_late: null, excuse_note: null });
                  }
                  return Promise.resolve();
              } else {
                  return api.post('/api/attendances/', { rehearsal: activeRehearsalId, participation: part.id, status: 'PRESENT' });
              }
          });

          await Promise.all(promises);
          await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
          toast.success(`Uzupełniono luki jako "Obecny".`, { id: toastId });
      } catch (err) {
          toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zapisać masowej obecności." });
      } finally {
          setIsMarkingAll(false);
      }
  };

  // --- RENDER ---
  if (isLoading && !data.projects.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 size={32} className="animate-spin text-[#002395]/40" />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Ładowanie dziennika...</span>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
      
      {/* HEADER */}
      <header className="relative pt-8 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <CheckSquare size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Moduł Inspektora
                  </p>
              </div>
              <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Dziennik <span className="italic text-[#002395] font-bold">Obecności</span>.
              </h1>
              <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
                  Zarządzaj frekwencją, sprawdzaj usprawiedliwienia i monitoruj zaangażowanie zespołu w czasie rzeczywistym.
              </p>
          </motion.div>
      </header>

      {/* OLED CONTEXT SWITCHER */}
      <div className="bg-[#0a0a0a] p-6 md:p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden group border border-stone-800">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-1000"></div>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 w-full flex flex-col sm:flex-row gap-5 items-center">
            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-300">
                <Briefcase size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400 mb-2 ml-1">
                    Aktywne Wydarzenie (Kontekst Dziennika)
                </label>
                <div className="relative">
                    <select 
                        value={selectedProjectId} 
                        onChange={e => setSelectedProjectId(e.target.value)} 
                        className={STYLE_DARK_GLASS_INPUT}
                    >
                        <option value="" className="text-stone-900">— Wybierz wydarzenie z bazy —</option>
                        {data.projects.filter(p => p.status !== 'CANC').map(p => (
                            <option key={p.id} value={p.id} className="text-stone-900">{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                        <ChevronDown size={18} />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {!selectedProjectId && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`${STYLE_PREMIUM_GLASS} p-16 flex flex-col items-center justify-center text-center mt-8`}>
            <Calendar size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
            <p className="text-[11px] font-bold antialiased text-stone-600 uppercase tracking-widest mb-2">Brak wybranego projektu</p>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">Aby sprawdzić lub uzupełnić dziennik inspektora, wybierz wydarzenie z przełącznika kontekstu powyżej.</p>
        </motion.div>
      )}

      {selectedProjectId && projectRehearsals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* Rehearsal Horizontal Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
              {projectRehearsals.map((reh, idx) => {
                  const isSelected = String(activeRehearsalId) === String(reh.id);
                  return (
                    <button 
                        key={reh.id} 
                        onClick={() => setActiveRehearsalId(String(reh.id))}
                        className={`px-6 py-4 text-[10px] font-bold antialiased uppercase tracking-widest whitespace-nowrap rounded-t-2xl transition-all border-b-2 flex flex-col items-start min-w-[140px] outline-none ${isSelected ? 'border-[#002395] text-[#002395] bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]' : 'border-transparent text-stone-400 hover:text-stone-800 hover:bg-white/50'}`}
                    >
                        <span className="opacity-60 mb-1">Próba {idx + 1}</span>
                        <span className="text-sm">{new Date(reh.date_time).toLocaleDateString('pl-PL', { day: '2-digit', month: 'long' })}</span>
                    </button>
                  );
              })}
            </div>

            {/* Active Rehearsal Metadata & Stats Dashboard */}
            {activeRehearsal && (
                <div className={`${STYLE_PREMIUM_GLASS} p-6 md:p-8 flex flex-col xl:flex-row justify-between gap-8`}>
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-3 py-1.5 bg-[#002395] text-white text-[10px] font-bold antialiased uppercase tracking-widest rounded-lg shadow-sm flex items-center gap-1.5">
                                    <Clock size={12} /> {new Date(activeRehearsal.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!activeRehearsal.is_mandatory && <span className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-lg shadow-sm">Opcjonalna</span>}
                            </div>
                            <p className="text-base font-bold text-stone-800 flex items-center gap-2 mb-2"><MapPin size={16} className="text-[#002395]" aria-hidden="true" /> {activeRehearsal.location || 'Brak lokalizacji'}</p>
                            {activeRehearsal.focus && <p className="text-sm text-stone-500 font-medium flex items-center gap-2"><Target size={16} className="text-[#002395]" aria-hidden="true" /> {activeRehearsal.focus}</p>}
                        </div>
                        
                        {/* Wskaźnik uzupełnienia dziennika */}
                        <div className="mt-6 pt-5 border-t border-stone-100">
                            <div className="flex justify-between items-end mb-2">
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Kompletność dziennika</p>
                                <span className="text-[10px] font-bold text-stone-600">{Math.round(stats.completionRate)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div className="bg-[#002395] h-full rounded-full transition-all duration-500" style={{ width: `${stats.completionRate}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="px-5 py-4 bg-emerald-50/50 border border-emerald-100/80 rounded-2xl flex flex-col items-center min-w-[90px] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                            <span className="text-[9px] font-bold antialiased text-emerald-600 uppercase tracking-[0.15em]">Obecni</span>
                            <span className="text-2xl font-black text-emerald-700 mt-1">{stats.present}</span>
                        </div>
                        <div className="px-5 py-4 bg-purple-50/50 border border-purple-100/80 rounded-2xl flex flex-col items-center min-w-[90px] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                            <span className="text-[9px] font-bold antialiased text-purple-600 uppercase tracking-[0.15em]" title="Usprawiedliwieni">Uspraw.</span>
                            <span className="text-2xl font-black text-purple-700 mt-1">{stats.excused}</span>
                        </div>
                        <div className="px-5 py-4 bg-orange-50/50 border border-orange-100/80 rounded-2xl flex flex-col items-center min-w-[90px] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                            <span className="text-[9px] font-bold antialiased text-orange-600 uppercase tracking-[0.15em]">Spóźnieni</span>
                            <span className="text-2xl font-black text-orange-700 mt-1">{stats.late}</span>
                        </div>
                        <div className="px-5 py-4 bg-red-50/50 border border-red-100/80 rounded-2xl flex flex-col items-center min-w-[90px] shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                            <span className="text-[9px] font-bold antialiased text-red-600 uppercase tracking-[0.15em]">Nieobecni</span>
                            <span className="text-2xl font-black text-red-700 mt-1">{stats.absent}</span>
                        </div>
                        <div className="px-6 py-4 ml-2 border-l border-stone-200/60 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-[0.15em]">Braki wpisów</span>
                            <span className="text-2xl font-black text-stone-800 mt-1">{stats.none} <span className="text-base font-medium text-stone-400">/ {stats.total}</span></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mass Actions */}
            <div className="flex justify-end">
                <button 
                  onClick={handleMarkAllPresent}
                  disabled={isMarkingAll || invitedParticipations.length === 0 || stats.none === 0}
                  className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3.5 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                >
                  {isMarkingAll ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                  Uzupełnij luki ({stats.none}) jako "Obecny"
                </button>
            </div>

            {/* --- ATTENDANCE TABLE --- */}
            {invitedParticipations.length > 0 ? (
                <div className={`${STYLE_PREMIUM_GLASS} overflow-hidden`}>
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left text-sm text-stone-600">
                            <thead className="bg-stone-50/80 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-[0.15em] text-stone-400 border-b border-stone-200/80">
                            <tr>
                                <th className="px-6 py-5 w-1/4">Wykonawca</th>
                                <th className="px-6 py-5 w-48">Działanie / Status</th>
                                <th className="px-6 py-5 hidden sm:table-cell">Dodatkowy Kontekst (Notatki)</th>
                                <th className="px-6 py-5 text-right w-16">Opcje</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100/50">
                            {invitedParticipations.map(part => {
                                const artist = artistMap.get(String(part.artist));
                                if (!artist) return null;
                                return (
                                    <AttendanceRow 
                                        key={part.id} 
                                        participation={part} 
                                        artist={artist} 
                                        rehearsalId={activeRehearsalId!} 
                                        existingRecord={attendanceMap.get(String(part.id))} 
                                    />
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-white/40 border border-dashed border-stone-300/60 rounded-[2rem]">
                    <SearchX size={32} className="text-stone-300 mb-3" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500 mb-1">Brak wezwanych artystów</p>
                    <p className="text-xs text-stone-400">Na tę próbę nie została przydzielona żadna obsada.</p>
                </div>
            )}

        </motion.div>
      )}

      {selectedProjectId && projectRehearsals.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_PREMIUM_GLASS} text-center p-16 flex flex-col items-center justify-center mt-8`}>
            <AlertCircle size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Brak zaplanowanych prób</span>
            <span className="text-xs text-stone-400 max-w-sm leading-relaxed">Przejdź do zakładki "Zarządzanie Projektami", aby zaplanować harmonogram prób do tego projektu.</span>
          </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: ATTENDANCE ROW MANAGER
// ============================================================================

interface AttendanceRowProps {
  participation: Participation;
  artist: Artist;
  rehearsalId: string;
  existingRecord: Attendance | undefined;
}

/**
 * @description Internal component representing a single row in the attendance matrix.
 * Optimizes network requests by deferring text-input syncs to `onBlur` events.
 */
function AttendanceRow({ participation, artist, rehearsalId, existingRecord }: AttendanceRowProps): React.JSX.Element {
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<string>(existingRecord?.status || '');
  const [minutesLate, setMinutesLate] = useState<string>(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
  const [note, setNote] = useState<string>(existingRecord?.excuse_note || '');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
      setStatus(existingRecord?.status || '');
      setMinutesLate(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
      setNote(existingRecord?.excuse_note || '');
  }, [existingRecord]);

  const saveToServer = async (newStatus: string, newMins: string, newNote: string): Promise<void> => {
      setIsSyncing(true);
      try {
          if (!newStatus) {
              if (existingRecord?.id) {
                  await api.delete(`/api/attendances/${existingRecord.id}/`);
                  await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
              }
              setIsSyncing(false);
              return;
          }

          const payload = {
              rehearsal: rehearsalId,
              participation: participation.id,
              status: newStatus,
              minutes_late: newStatus === 'LATE' && newMins ? parseInt(newMins) : null,
              excuse_note: (newStatus === 'EXCUSED' || newStatus === 'ABSENT' || newStatus === 'LATE') ? newNote : null
          };

          if (existingRecord?.id) {
              await api.patch(`/api/attendances/${existingRecord.id}/`, payload);
          } else {
              await api.post('/api/attendances/', payload);
          }
          
          await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
      } catch (e) {
          toast.error(`Błąd zapisu dla: ${artist.last_name}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setStatus(val);
      saveToServer(val, minutesLate, note);
  };

  const handleTextBlur = () => {
      if (status) saveToServer(status, minutesLate, note);
  };

  const rowBgColor = 
      status === 'PRESENT' ? 'bg-emerald-50/20' :
      status === 'LATE' ? 'bg-orange-50/20' :
      status === 'ABSENT' ? 'bg-red-50/20' :
      status === 'EXCUSED' ? 'bg-purple-50/20' : 'bg-transparent';

  return (
    <tr className={`transition-colors group hover:bg-stone-50/80 ${rowBgColor}`}>
      <td className="px-6 py-5">
          <p className="font-bold text-stone-800 tracking-tight">{artist.first_name} {artist.last_name}</p>
          <p className="text-[9px] uppercase font-bold antialiased text-stone-400 tracking-widest mt-1">
            {(artist as any).voice_type_display || artist.voice_type}
          </p>
      </td>
      
      <td className="px-6 py-5">
        <select 
          value={status} 
          onChange={handleStatusChange} 
          disabled={isSyncing}
          className={`w-full px-4 py-3 text-xs font-bold border rounded-xl outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] appearance-none cursor-pointer ${
            status === 'PRESENT' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 focus:ring-emerald-500/20 shadow-[0_2px_10px_rgba(16,185,129,0.1)]' : 
            status === 'LATE' ? 'border-orange-300 text-orange-700 bg-orange-50 focus:ring-orange-500/20 shadow-[0_2px_10px_rgba(249,115,22,0.1)]' : 
            status === 'ABSENT' ? 'border-red-300 text-red-700 bg-red-50 focus:ring-red-500/20 shadow-[0_2px_10px_rgba(239,68,68,0.1)]' : 
            status === 'EXCUSED' ? 'border-purple-300 text-purple-700 bg-purple-50 focus:ring-purple-500/20 shadow-[0_2px_10px_rgba(168,85,247,0.1)]' : 
            'border-stone-200/80 text-stone-500 bg-white/50 focus:ring-[#002395]/20 hover:border-stone-300 hover:bg-white'
          }`}
        >
          <option value="">— Brak Wpisu —</option>
          <option value="PRESENT">Obecny</option>
          <option value="LATE">Spóźnienie</option>
          <option value="ABSENT">Nieobecny (N)</option>
          <option value="EXCUSED">Usprawiedliwiony (U)</option>
        </select>
      </td>
      
      <td className="px-6 py-5 hidden sm:table-cell">
        <AnimatePresence mode="popLayout">
          {status === 'LATE' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-3">
                <Clock size={16} className="text-orange-500" aria-hidden="true" />
                <input 
                    type="number" min="1" placeholder="Ile min?"
                    value={minutesLate} 
                    onChange={(e) => setMinutesLate(e.target.value)}
                    onBlur={handleTextBlur}
                    disabled={isSyncing}
                    className="w-28 text-xs font-bold text-orange-800 px-3 py-3 border border-orange-200/80 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm transition-all"
                />
            </motion.div>
          )}
          {(status === 'EXCUSED' || status === 'ABSENT' || status === 'LATE') && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-3 mt-2 sm:mt-0">
                {(status === 'ABSENT' || status === 'EXCUSED') && <ShieldAlert size={16} className={status === 'EXCUSED' ? 'text-purple-500' : 'text-red-500'} aria-hidden="true" />}
                <input 
                    type="text" placeholder="Dodaj notatkę (opcjonalnie)"
                    value={note} 
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={handleTextBlur}
                    disabled={isSyncing}
                    className={`w-full max-w-[240px] text-xs font-bold px-3 py-3 border rounded-xl outline-none focus:ring-2 bg-white shadow-sm transition-all ${
                        status === 'EXCUSED' ? 'text-purple-800 border-purple-200/80 focus:ring-purple-500/20 focus:border-purple-400' : 
                        status === 'LATE' ? 'text-orange-800 border-orange-200/80 focus:ring-orange-500/20 focus:border-orange-400' :
                        'text-red-800 border-red-200/80 focus:ring-red-500/20 focus:border-red-400'
                    }`}
                />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
      
      <td className="px-6 py-5 text-right">
        <div className="h-5 flex items-center justify-end">
            {isSyncing ? (
                <Loader2 size={16} className="animate-spin text-[#002395]" aria-hidden="true" />
            ) : existingRecord ? (
                <CheckCircle2 size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" aria-description='Zapisano pomyślnie' />
            ) : null}
        </div>
      </td>
    </tr>
  );
}