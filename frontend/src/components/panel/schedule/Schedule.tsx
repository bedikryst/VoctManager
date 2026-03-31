/**
 * @file Schedule.tsx
 * @description Main Controller for the Artist Timeline.
 * @architecture Feature-Sliced Design (Enterprise 2026)
 * BUGFIX: Restored strict `?artist=id` query parameters. Preventing catastrophic 
 * data leaks and cross-user mutations for Administrative accounts.
 * @module schedule/Schedule
 * @author Krystian Bugalski
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Loader2, CalendarHeart } from 'lucide-react';

import api from '../../../utils/api';
import type { Project, Rehearsal, Participation, Attendance } from '../../../types';
import TimelineProjectCard from './cards/TimelineProjectCard';
import TimelineRehearsalCard from './cards/TimelineRehearsalCard'; 
import { queryKeys } from '../../../utils/queryKeys';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

export interface TimelineEvent {
  id: string;
  type: 'REHEARSAL' | 'PROJECT';
  rawObj: any;
  date_time: Date;
  title: string;
  location: string | null | undefined;
  focus?: string | null;
  is_mandatory?: boolean;
  status?: string | null;
  excuse_note?: string | null;
  absences?: number; 
  project_id: string | number;
  call_time?: string | null;
  run_sheet?: any[];
  description?: string | null;
}

export default function Schedule(): React.JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const artistId = user?.id;

  const [viewMode, setViewMode] = useState<'UPCOMING' | 'PAST'>('UPCOMING'); 
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const results = useQueries({
    queries: [
      { queryKey: queryKeys.rehearsals.byArtist(artistId!), queryFn: async () => (await api.get(`/api/rehearsals/`)).data, enabled: !!artistId },
      { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get('/api/projects/')).data, enabled: !!artistId },
      { queryKey: queryKeys.participations.byArtist(artistId!), queryFn: async () => (await api.get(`/api/participations/?artist=${artistId}`)).data, enabled: !!artistId },
      { queryKey: queryKeys.attendances.byArtist(artistId!), queryFn: async () => (await api.get(`/api/attendances/?participation__artist=${artistId}`)).data, enabled: !!artistId }
    ]
  });

  const isLoading = results.some(q => q.isLoading);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!artistId || isLoading) return [];

    const rehearsals = extractData(results[0].data) as any[];
    const projects = extractData(results[1].data) as Project[];
    const myParticipations = extractData(results[2].data) as Participation[];
    const attendances = extractData(results[3].data) as Attendance[];

    const events: TimelineEvent[] = [];
    const activeParticipations = myParticipations.filter(p => p.status !== 'DEC');

    rehearsals.forEach(reh => {
      const myPart = activeParticipations.find(p => String(p.project) === String(reh.project));
      if (!myPart) return; 

      const isInvited = !reh.invited_participations || reh.invited_participations.length === 0 || reh.invited_participations.includes(String(myPart.id));
      
      if (isInvited) {
        const project = projects.find(p => String(p.id) === String(reh.project));
        const myAttendance = attendances.find(a => String(a.rehearsal) === String(reh.id) && String(a.participation) === String(myPart.id));

        events.push({
          id: `REH-${reh.id}`,
          type: 'REHEARSAL',
          rawObj: reh,
          date_time: new Date(reh.date_time),
          title: `Próba: ${project?.title || 'Wydarzenie'}`,
          location: reh.location,
          focus: reh.focus,
          is_mandatory: reh.is_mandatory,
          status: myAttendance ? myAttendance.status : null,
          excuse_note: myAttendance ? myAttendance.excuse_note : null,
          absences: reh.absent_count || 0, 
          project_id: reh.project
        });
      }
    });

    projects.forEach(proj => {
      const isParticipating = activeParticipations.some(p => String(p.project) === String(proj.id));
      if (isParticipating && proj.status !== 'CANC') {
        events.push({
          id: `PROJ-${proj.id}`,
          type: 'PROJECT',
          rawObj: proj,
          date_time: new Date(proj.date_time),
          title: proj.title,
          location: proj.location,
          call_time: proj.call_time,
          run_sheet: proj.run_sheet,
          description: proj.description,
          status: null,
          project_id: proj.id
        });
      }
    });

    return events;
  }, [results, artistId, isLoading]);

  const filteredEvents = useMemo(() => {
    const threshold = new Date(new Date().getTime() - 4 * 60 * 60 * 1000); 
    return timelineEvents
      .filter(e => !isNaN(e.date_time.getTime()))
      .filter(e => viewMode === 'UPCOMING' ? e.date_time >= threshold : e.date_time < threshold)
      .sort((a, b) => viewMode === 'UPCOMING' ? a.date_time.getTime() - b.date_time.getTime() : b.date_time.getTime() - a.date_time.getTime());
  }, [timelineEvents, viewMode]);

  const handleAbsenceSubmit = async (eventId: string, projectId: string | number, status: string, notes: string) => {
    const toastId = toast.loading("Wysyłanie zgłoszenia...");
    try {
      const myParticipations = extractData(results[2].data) as Participation[];
      const myPart = myParticipations.find(p => String(p.project) === String(projectId));
      
      // Zabezpieczenie - Admin już nie pobierze cudzej partycypacji przez przypadek
      if (!myPart) throw new Error("Brak przypisania.");

      const payload = {
        rehearsal: eventId,
        participation: myPart.id,
        status: status,
        excuse_note: notes
      };

      const attendances = extractData(results[3].data) as Attendance[];
      const existingAtt = attendances.find(a => String(a.rehearsal) === String(payload.rehearsal) && String(a.participation) === String(payload.participation));

      if (existingAtt?.id) {
        await api.patch(`/api/attendances/${existingAtt.id}/`, payload); 
      } else {
        await api.post('/api/attendances/', payload);
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.attendances.all });
      toast.success("Zgłoszenie zostało zapisane.", { id: toastId });
      return true; 
    } catch (err) {
      toast.error("Błąd zapisu", { id: toastId, description: "Nie udało się zapisać zgłoszenia." });
      return false; 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-24 max-w-4xl mx-auto px-4 sm:px-0">
      
      <header className="relative pt-6 mb-10">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Calendar size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Osobisty Kalendarz</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Mój <span className="italic text-[#002395]">Harmonogram</span>.
              </h1>
              <p className="text-stone-500 mt-2 font-medium tracking-wide text-sm">
                  Sprawdzaj próby, zgłaszaj nieobecności i śledź plany koncertowe.
              </p>
          </motion.div>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide">
            {[{ id: 'UPCOMING', label: 'Nadchodzące' }, { id: 'PAST', label: 'Historia' }].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setViewMode(tab.id as 'UPCOMING' | 'PAST'); setExpandedEventId(null); }} 
                className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${viewMode === tab.id ? 'bg-white text-[#002395] shadow-sm border border-stone-100' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
      </div>

      <div className="relative z-10">
        <div className="absolute left-[19px] md:left-[31px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-[#002395]/20 via-stone-200/50 to-transparent z-0 hidden sm:block"></div>

        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-20">
               <Loader2 size={32} className="animate-spin text-[#002395]/40 mb-4" />
               <span className="text-[10px] uppercase font-bold tracking-widest text-[#002395]/60">Pobieranie grafiku...</span>
           </div>
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((ev) => (
                 ev.type === 'PROJECT' ? (
                    <TimelineProjectCard 
                        key={ev.id} 
                        event={ev} 
                        isExpanded={expandedEventId === ev.id} 
                        onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)} 
                        artistId={artistId}
                    />
                 ) : (
                    <TimelineRehearsalCard 
                        key={ev.id} 
                        event={ev} 
                        isExpanded={expandedEventId === ev.id} 
                        onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)} 
                        onSubmitReport={handleAbsenceSubmit}
                        viewMode={viewMode}
                    />
                 )
              ))}
            </AnimatePresence>
          </div>
        ) : (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/60 border border-stone-200/80 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center shadow-sm relative z-10">
              <CalendarHeart size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wpisów w kalendarzu</span>
              <span className="text-xs text-stone-400 max-w-sm">W tym widoku nie masz przypisanych żadnych spotkań ani koncertów.</span>
           </motion.div>
        )}
      </div>
    </div>
  );
}