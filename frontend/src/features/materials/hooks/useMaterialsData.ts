/**
 * @file useMaterialsData.ts
 * @description Encapsulates data fetching, enrichment, and memoized grouping 
 * for the Artist Rehearsal Materials module.
 * @module hooks/useMaterialsData
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import api from '../../../shared/api/api';
import { queryKeys } from '../../../shared/lib/queryKeys';
import type { 
    Project, Piece, Track, PieceCasting, 
    Participation, Composer, ProgramItem 
} from '../../../shared/types';

export interface EnrichedPiece extends Piece {
    composerData: Composer | null;
    myCasting: PieceCasting | null;
    allCastings: PieceCasting[];
    tracks: Track[];
}

export interface ProjectMaterialGroup {
    project: Project;
    participation: Participation;
    pieces: EnrichedPiece[];
}

export const useMaterialsData = (userId?: string | number, searchQuery: string = '') => {
    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data, enabled: !!userId },
            { queryKey: queryKeys.participations.byArtist(userId!), queryFn: async () => (await api.get<Participation[]>(`/api/participations/?artist=${userId}`)).data, enabled: !!userId },
            { queryKey: queryKeys.program.all, queryFn: async () => (await api.get<ProgramItem[]>('/api/program-items/')).data, enabled: !!userId },
            { queryKey: queryKeys.pieceCastings.all, queryFn: async () => (await api.get<PieceCasting[]>('/api/piece-castings/')).data, enabled: !!userId },
            { queryKey: queryKeys.pieces.all, queryFn: async () => (await api.get<Piece[]>('/api/pieces/')).data, enabled: !!userId },
            { queryKey: queryKeys.composers.all, queryFn: async () => (await api.get<Composer[]>('/api/composers/')).data, enabled: !!userId },
            { queryKey: ['archiveTracks', 'all'], queryFn: async () => (await api.get<Track[]>('/api/tracks/')).data, enabled: !!userId }
        ]
    });

    const isLoading = results.some(q => q.isLoading);
    const isError = results.some(q => q.isError);

    const rawData = useMemo(() => ({
        projects: (results[0].data || []) as Project[],
        myParticipations: (results[1].data || []) as Participation[],
        programItems: (results[2].data || []) as ProgramItem[],
        pieceCastings: (results[3].data || []) as PieceCasting[],
        pieces: (results[4].data || []) as Piece[],
        composers: (results[5].data || []) as Composer[],
        tracks: (results[6].data || []) as Track[]
    }), [results]);

    const groupedMaterials = useMemo<ProjectMaterialGroup[]>(() => {
        if (!userId || rawData.myParticipations.length === 0) return [];

        const activeParticipations = rawData.myParticipations.filter(p => p.status !== 'DEC');
        const myProjectIds = activeParticipations.map(p => String(p.project));
        const myProjects = rawData.projects.filter(p => myProjectIds.includes(String(p.id)) && p.status !== 'CANC');

        const groups = myProjects.map(project => {
            const participation = activeParticipations.find(p => String(p.project) === String(project.id))!;
            
            const projectProgram = rawData.programItems
                .filter(pi => String(pi.project) === String(project.id))
                .sort((a, b) => a.order - b.order);
            
            const enrichedPieces = projectProgram.map(pi => {
                const piece = rawData.pieces.find(p => String(p.id) === String(pi.piece));
                if (!piece) return null;
                
                const composerData = rawData.composers.find(c => String(c.id) === String(piece.composer)) || null;
                
                const allCastingsForPiece = rawData.pieceCastings.filter(c => 
                    String(c.piece) === String(piece.id) && String((c as any).project_id) === String(project.id)
                );
                
                const myCasting = allCastingsForPiece.find(c => String(c.participation) === String(participation.id)) || null;
                
                let pieceTracks = rawData.tracks.filter(t => String(t.piece) === String(piece.id));
                if (myCasting) {
                    pieceTracks = pieceTracks.sort((a, b) => {
                        const aIsMine = a.voice_part === myCasting.voice_line;
                        const bIsMine = b.voice_part === myCasting.voice_line;
                        return aIsMine === bIsMine ? 0 : (aIsMine ? -1 : 1);
                    });
                }

                return { 
                    ...piece, 
                    composerData, 
                    myCasting, 
                    allCastings: allCastingsForPiece, 
                    tracks: pieceTracks 
                } as EnrichedPiece;
            }).filter(Boolean) as EnrichedPiece[];

            return { project, participation, pieces: enrichedPieces };
        });

        return groups.sort((a, b) => {
            if (a.project.status !== 'DONE' && b.project.status === 'DONE') return -1;
            if (a.project.status === 'DONE' && b.project.status !== 'DONE') return 1;
            return new Date(a.project.date_time).getTime() - new Date(b.project.date_time).getTime();
        });
    }, [rawData, userId]);

    const filteredGroups = useMemo<ProjectMaterialGroup[]>(() => {
        if (!searchQuery) return groupedMaterials;
        const term = searchQuery.toLowerCase();

        return groupedMaterials.map(group => {
            const filteredPieces = group.pieces.filter(piece => 
                piece.title.toLowerCase().includes(term) || 
                (piece.composerData?.last_name || '').toLowerCase().includes(term)
            );
            return { ...group, pieces: filteredPieces };
        }).filter(group => group.pieces.length > 0);
    }, [groupedMaterials, searchQuery]);

    return { isLoading, isError, filteredGroups };
};