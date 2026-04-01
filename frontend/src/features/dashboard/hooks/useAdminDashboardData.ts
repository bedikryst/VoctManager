/**
 * @file useAdminDashboardData.ts
 * @description Encapsulates data fetching, telemetric aggregations, and scheduling logic 
 * for the Mission Control Dashboard. Computes global KPIs and upcoming event alerts.
 * @module panel/dashboard/hooks/useAdminDashboardData
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import api from '../../../shared/api/api';
import { queryKeys } from '../../../shared/lib/queryKeys';
import type { Project, Artist, Rehearsal, ProgramItem, Piece } from '../../../types';

export interface EnrichedRehearsal extends Rehearsal {
    absent_count?: number;
    projectTitle?: string;
}

export const useAdminDashboardData = () => {
    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data },
            { queryKey: queryKeys.rehearsals.all, queryFn: async () => (await api.get<EnrichedRehearsal[]>('/api/rehearsals/')).data },
            { queryKey: queryKeys.artists.all, queryFn: async () => (await api.get<Artist[]>('/api/artists/')).data },
            { queryKey: queryKeys.program.all, queryFn: async () => (await api.get<ProgramItem[]>('/api/program-items/')).data },
            { queryKey: queryKeys.pieces.all, queryFn: async () => (await api.get<Piece[]>('/api/pieces/')).data } 
        ]
    });

    const isLoading = results.some(q => q.isLoading);

    const projects = results[0].data || [];
    const rehearsals = results[1].data || [];
    const artists = results[2].data || [];
    const programItems = results[3].data || [];
    const pieces = results[4].data || [];

    const adminStats = useMemo(() => {
        const activeProjects = projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT').length;
        const totalPieces = pieces.length;
        const activeArtistsList = artists.filter(a => a.is_active);
        
        const satb = {
            S: activeArtistsList.filter(a => a.voice_type?.startsWith('S')).length,
            A: activeArtistsList.filter(a => a.voice_type?.startsWith('A') || a.voice_type === 'MEZ').length,
            T: activeArtistsList.filter(a => a.voice_type?.startsWith('T') || a.voice_type === 'CT').length,
            B: activeArtistsList.filter(a => a.voice_type?.startsWith('B')).length,
            Total: activeArtistsList.length
        };

        return { activeProjects, totalPieces, satb };
    }, [projects, pieces, artists]);

    const nextProject = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); 

        const upcoming = projects.filter(p => {
            if (p.status === 'DONE' || p.status === 'CANC') return false;
            if (!p.date_time) return false;
            const projDate = new Date(p.date_time);
            return !isNaN(projDate.getTime()) && projDate >= todayStart;
        });
        
        return upcoming.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0] || null;
    }, [projects]);

    const nextProjectStats = useMemo(() => {
        if (!nextProject) return null;
        const now = new Date();
        const piecesCount = programItems.filter(pi => String(pi.project) === String(nextProject.id)).length;
        const rehearsalsLeft = rehearsals.filter(r => {
            if (String(r.project) !== String(nextProject.id) || !r.date_time) return false;
            const rehDate = new Date(r.date_time);
            return !isNaN(rehDate.getTime()) && rehDate > now;
        }).length;
        return { piecesCount, rehearsalsLeft };
    }, [nextProject, programItems, rehearsals]);

    const nextRehearsal = useMemo(() => {
        const now = new Date();
        const threshold = new Date(now.getTime() - 2 * 60 * 60 * 1000); 

        const futureRehearsals = rehearsals.filter(r => {
            if (!r.date_time) return false;
            const date = new Date(r.date_time);
            return !isNaN(date.getTime()) && date >= threshold;
        }).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

        if (futureRehearsals.length > 0) {
            const next = futureRehearsals[0];
            const project = projects.find(p => String(p.id) === String(next.project));
            return { ...next, projectTitle: project?.title || 'Nieznany projekt' };
        }
        return null;
    }, [rehearsals, projects]);

    return {
        isLoading,
        adminStats,
        nextProject,
        nextProjectStats,
        nextRehearsal
    };
};