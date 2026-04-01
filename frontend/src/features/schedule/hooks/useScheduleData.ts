/**
 * @file useScheduleData.ts
 * @description Encapsulates data fetching, timeline event aggregation, 
 * and mutation logic for the Artist Schedule module.
 * Strictly uses ?artist=id query parameters to isolate data access.
 * @module panel/schedule/hooks/useScheduleData
 */

import { useState, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../shared/api/api';
import { queryKeys } from '../../../shared/lib/queryKeys';
import type { Project, Rehearsal, Participation, Attendance } from '../../../types';

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

export const useScheduleData = (artistId?: string | number) => {
    const queryClient = useQueryClient();

    const [viewMode, setViewMode] = useState<'UPCOMING' | 'PAST'>('UPCOMING'); 
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

    const results = useQueries({
        queries: [
            { queryKey: queryKeys.rehearsals.byArtist(artistId!), queryFn: async () => (await api.get<Rehearsal[]>(`/api/rehearsals/`)).data, enabled: !!artistId },
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data, enabled: !!artistId },
            { queryKey: queryKeys.participations.byArtist(artistId!), queryFn: async () => (await api.get<Participation[]>(`/api/participations/?artist=${artistId}`)).data, enabled: !!artistId },
            { queryKey: queryKeys.attendances.byArtist(artistId!), queryFn: async () => (await api.get<Attendance[]>(`/api/attendances/?participation__artist=${artistId}`)).data, enabled: !!artistId }
        ]
    });

    const isLoading = results.some(q => q.isLoading);

    const rehearsals = results[0].data || [];
    const projects = results[1].data || [];
    const myParticipations = results[2].data || [];
    const attendances = results[3].data || [];

    const timelineEvents = useMemo<TimelineEvent[]>(() => {
        if (!artistId || isLoading) return [];

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
                    absences: (reh as any).absent_count || 0, 
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
    }, [artistId, isLoading, rehearsals, projects, myParticipations, attendances]);

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
            const myPart = myParticipations.find(p => String(p.project) === String(projectId));
            
            if (!myPart) throw new Error("Brak przypisania.");

            const payload = {
                rehearsal: eventId,
                participation: myPart.id,
                status: status,
                excuse_note: notes
            };

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

    return {
        isLoading,
        viewMode,
        setViewMode,
        expandedEventId,
        setExpandedEventId,
        filteredEvents,
        handleAbsenceSubmit,
        artistId
    };
};