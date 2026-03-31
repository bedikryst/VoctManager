/**
 * @file useContractsData.ts
 * @description Encapsulates data fetching, contextual resolution, and data enrichment 
 * for the HR & Payroll module. Uses TanStack Query for optimal caching.
 * @module hooks/useContractsData
 */

import { useState, useMemo, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import api from '../../../../utils/api';
import { queryKeys } from '../../../../utils/queryKeys';
import type { Project, Participation, CrewAssignment, Collaborator } from '../../../../types';

export interface EnrichedParticipation extends Participation {
    artist_name?: string;
    artist_voice_type_display?: string;
}

export interface EnrichedCrewAssignment extends CrewAssignment {
    artist_name?: string;
    artist_voice_type_display?: string;
}

export const useContractsData = () => {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data },
            { queryKey: queryKeys.participations.all, queryFn: async () => (await api.get<Participation[]>('/api/participations/')).data },
            { queryKey: queryKeys.crewAssignments.all, queryFn: async () => (await api.get<CrewAssignment[]>('/api/crew-assignments/')).data },
            { queryKey: queryKeys.collaborators.all, queryFn: async () => (await api.get<Collaborator[]>('/api/collaborators/')).data }
        ]
    });

    const isLoading = results.some(q => q.isLoading);

    const projects = (results[0].data || []) as Project[];
    const rawParticipations = (results[1].data || []) as Participation[];
    const rawCrewAssignments = (results[2].data || []) as CrewAssignment[];
    const rawCollaborators = (results[3].data || []) as Collaborator[];

    // Smart Context Resolution: Auto-selects the most relevant project on initial load
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

    const currentCast = useMemo<EnrichedParticipation[]>(() => {
        if (!selectedProjectId) return [];
        return rawParticipations
            .filter(p => String(p.project) === String(selectedProjectId) && p.status !== 'DEC')
            .sort((a, b) => ((a as any).artist_name || '').localeCompare((b as any).artist_name || '')) as EnrichedParticipation[];
    }, [rawParticipations, selectedProjectId]);

    const currentCrew = useMemo<EnrichedCrewAssignment[]>(() => {
        if (!selectedProjectId) return [];
        return rawCrewAssignments
            .filter(c => String(c.project) === String(selectedProjectId))
            .map(assignment => {
                const person = rawCollaborators.find(c => String(c.id) === String(assignment.collaborator));
                return {
                    ...assignment,
                    artist_name: person ? `${person.first_name} ${person.last_name}` : 'Unknown',
                    artist_voice_type_display: assignment.role_description || person?.specialty || 'Crew'
                } as EnrichedCrewAssignment;
            });
    }, [rawCrewAssignments, rawCollaborators, selectedProjectId]);

    const globalStats = useMemo(() => {
        const totalPartFee = rawParticipations.reduce((sum, p) => sum + (parseFloat(String(p.fee)) || 0), 0);
        const totalCrewFee = rawCrewAssignments.reduce((sum, c) => sum + (parseFloat(String(c.fee)) || 0), 0);
        return {
            totalBudget: totalPartFee + totalCrewFee,
            totalContracts: rawParticipations.length + rawCrewAssignments.length,
            totalPriced: rawParticipations.filter(p => parseFloat(String(p.fee)) > 0).length + 
                         rawCrewAssignments.filter(c => parseFloat(String(c.fee)) > 0).length
        };
    }, [rawParticipations, rawCrewAssignments]);

    const projectStats = useMemo(() => {
        const allContracts = [...currentCast, ...currentCrew];
        const budget = allContracts.reduce((sum, p) => sum + (parseFloat(String(p.fee)) || 0), 0);
        const pricedCount = allContracts.filter(p => parseFloat(String(p.fee)) > 0).length;
        return {
            totalBudget: budget,
            totalContracts: allContracts.length,
            pricedContractsCount: pricedCount,
            missingContractsCount: allContracts.length - pricedCount
        };
    }, [currentCast, currentCrew]);

    return {
        isLoading,
        projects,
        selectedProjectId,
        setSelectedProjectId,
        currentCast,
        currentCrew,
        globalStats,
        projectStats
    };
};