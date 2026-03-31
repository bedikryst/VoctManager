/**
 * @file useRehearsalsData.ts
 * @description Encapsulates data fetching, relational mapping, and KPI calculation 
 * for the Attendance and Rehearsal management module.
 * @module hooks/useRehearsalsData
 */

import { useState, useMemo, useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../utils/api';
import { queryKeys } from '../../../../utils/queryKeys';
import type { Project, Rehearsal, Participation, Attendance, Artist } from '../../../../types';

export const useRehearsalsData = () => {
    const queryClient = useQueryClient();

    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
    const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data },
            { queryKey: queryKeys.rehearsals.all, queryFn: async () => (await api.get<Rehearsal[]>('/api/rehearsals/')).data },
            { queryKey: queryKeys.participations.all, queryFn: async () => (await api.get<Participation[]>('/api/participations/')).data },
            { queryKey: queryKeys.attendances.all, queryFn: async () => (await api.get<Attendance[]>('/api/attendances/')).data },
            { queryKey: queryKeys.artists.all, queryFn: async () => (await api.get<Artist[]>('/api/artists/')).data }
        ]
    });

    const isLoading = results.some(q => q.isLoading);
    const isError = results.some(q => q.isError);

    const projects = (results[0].data || []) as Project[];
    const rehearsals = (results[1].data || []) as Rehearsal[];
    const participations = (results[2].data || []) as Participation[];
    const attendances = (results[3].data || []) as Attendance[];
    const artists = (results[4].data || []) as Artist[];

    // Smart Context Resolution
    useEffect(() => {
        if (!selectedProjectId && projects.length > 0) {
            const now = new Date();
            const activeProjects = projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
            const upcoming = activeProjects
                .filter(p => new Date(p.date_time) >= new Date(now.getTime() - 24 * 60 * 60 * 1000))
                .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

            if (upcoming.length > 0) {
                setSelectedProjectId(String(upcoming[0].id));
            } else {
                const past = [...projects].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
                if (past.length > 0) setSelectedProjectId(String(past[0].id));
            }
        }
    }, [projects, selectedProjectId]);

    const artistMap = useMemo<Map<string, Artist>>(() => {
        const map = new Map<string, Artist>();
        artists.forEach(a => map.set(String(a.id), a));
        return map;
    }, [artists]);

    const projectRehearsals = useMemo(() => {
        if (!selectedProjectId) return [];
        return rehearsals
            .filter(r => String(r.project) === String(selectedProjectId))
            .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    }, [rehearsals, selectedProjectId]);

    const projectParticipations = useMemo(() => {
        if (!selectedProjectId) return [];
        return participations.filter(p => String(p.project) === String(selectedProjectId) && p.status !== 'DEC');
    }, [participations, selectedProjectId]);

    // Auto-select initial rehearsal context
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
            : projectParticipations; 
        
        return relevantParts.sort((a, b) => {
            const nameA = artistMap.get(String(a.artist))?.last_name || '';
            const nameB = artistMap.get(String(b.artist))?.last_name || '';
            return nameA.localeCompare(nameB);
        });
    }, [activeRehearsal, projectParticipations, artistMap]);

    const attendanceMap = useMemo<Map<string, Attendance>>(() => {
        const map = new Map<string, Attendance>();
        if (activeRehearsal) {
            attendances
                .filter(a => String(a.rehearsal) === String(activeRehearsal.id))
                .forEach(a => map.set(String(a.participation), a));
        }
        return map;
    }, [attendances, activeRehearsal]);

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
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
        
        return { present, late, absent, excused, none, total, completionRate, rate };
    }, [invitedParticipations, attendanceMap]);

    const handleMarkAllPresent = async (): Promise<void> => {
        if (!activeRehearsalId || invitedParticipations.length === 0) return;
        
        setIsMarkingAll(true);
        const toastId = toast.loading("Zbiorcze zaznaczanie obecności...");

        try {
            const promises = invitedParticipations.map(part => {
                const existing = attendanceMap.get(String(part.id));
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
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.attendances.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
            ]);
            
            toast.success(`Uzupełniono luki jako "Obecny".`, { id: toastId });
        } catch (err) {
            toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zapisać masowej obecności." });
        } finally {
            setIsMarkingAll(false);
        }
    };

    return {
        isLoading,
        isError,
        projects,
        selectedProjectId,
        setSelectedProjectId,
        projectRehearsals,
        activeRehearsalId,
        setActiveRehearsalId,
        activeRehearsal,
        invitedParticipations,
        artistMap,
        attendanceMap,
        stats,
        isMarkingAll,
        handleMarkAllPresent
    };
};