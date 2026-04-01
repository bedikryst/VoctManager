/**
 * @file useMicroCasting.ts
 * @description State controller for the Micro-Casting Kanban board.
 * Implements optimistic UI updates for drag-and-drop actions and synchronizes 
 * complex relational data between the program setlist and casting assignments.
 * @module panel/projects/ProjectEditorPanel/hooks/useMicroCasting
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';

import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';
import type { Artist, PieceCasting, VoiceLineOption, ProgramItem } from '../../../../shared/types';

export const useMicroCasting = (projectId: string) => {
    const queryClient = useQueryClient();
    
    // Fetch global dictionaries directly from React Query Cache (No Context API)
    const { artists, pieces, participations } = useProjectData(projectId);

    const { data: voiceLines = [] } = useQuery<VoiceLineOption[]>({
        queryKey: queryKeys.options.voiceLines,
        queryFn: async () => (await api.get<VoiceLineOption[]>('/api/options/voice-lines/')).data,
        staleTime: Infinity
    });

    const { data: program = [] } = useQuery<ProgramItem[]>({
        queryKey: queryKeys.program.byProject(projectId),
        queryFn: async () => {
            const res = await api.get<ProgramItem[]>(`/api/program-items/?project=${projectId}`);
            return res.data.sort((a, b) => a.order - b.order);
        },
        staleTime: 60000
    });

    const { data: pieceCastings = [] } = useQuery<PieceCasting[]>({
        queryKey: queryKeys.pieceCastings.byProject(projectId),
        queryFn: async () => (await api.get<PieceCasting[]>(`/api/piece-castings/?participation__project=${projectId}`)).data,
        staleTime: 60000
    });

    const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
    const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]); 
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const projectParticipations = useMemo(() => {
        return participations.filter((p) => String(p.project) === String(projectId));
    }, [participations, projectId]);

    const artistMap = useMemo(() => {
        const map = new Map<string, Artist>();
        projectParticipations.forEach((p) => {
            const artist = artists.find((a) => String(a.id) === String(p.artist));
            if (artist) map.set(String(p.id), artist);
        });
        return map;
    }, [projectParticipations, artists]);

    useEffect(() => {
        if (program.length > 0 && !selectedPieceId) {
            setSelectedPieceId(String(program[0].piece));
        }
    }, [program, selectedPieceId]);

    const globalCastingsForPiece = useMemo(() => {
        if (!selectedPieceId) return [];
        return pieceCastings.filter((c) => 
            String(c.piece) === String(selectedPieceId) && 
            projectParticipations.some((p) => String(p.id) === String(c.participation))
        );
    }, [pieceCastings, selectedPieceId, projectParticipations]);

    useEffect(() => {
        setLocalCastings(globalCastingsForPiece);
    }, [globalCastingsForPiece]);

    const pieceStatuses = useMemo(() => {
        const statuses: Record<string, 'FREE' | 'OK' | 'DEFICIT'> = {};
        
        program.forEach(item => {
            const pieceId = String(item.piece);
            const pieceObj = pieces.find(p => String(p.id) === pieceId);
            const reqs = pieceObj?.voice_requirements || [];
            
            if (reqs.length === 0) {
                statuses[pieceId] = 'FREE';
            } else {
                let missing = 0;
                reqs.forEach(req => {
                    const assigned = pieceCastings.filter(c => 
                        String(c.piece) === pieceId && c.voice_line === req.voice_line
                    ).length;
                    if (assigned < req.quantity) missing += (req.quantity - assigned);
                });
                statuses[pieceId] = missing > 0 ? 'DEFICIT' : 'OK';
            }
        });
        
        return statuses;
    }, [program, pieces, pieceCastings]);

    const handleUpdateNote = async (castingId: string, newNote: string): Promise<void> => {
        const prevCastings = [...localCastings];
        setLocalCastings(prev => prev.map(c => String(c.id) === castingId ? { ...c, notes: newNote } : c));

        try {
            await api.patch(`/api/piece-castings/${castingId}/`, { notes: newNote });
            await queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
        } catch (err) {
            setLocalCastings(prevCastings);
            toast.error("Błąd zapisu", { description: "Nie udało się zaktualizować notatki." });
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
    };

    const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
        setActiveDragId(null);
        const { over, active } = event;

        if (!over) return; 
        
        const partId = String(active.id); 
        const targetVoiceLine = String(over.id); 
        const existingCasting = localCastings.find((c) => String(c.participation) === partId);

        if (targetVoiceLine !== 'UNASSIGNED' && existingCasting?.voice_line === targetVoiceLine) return;
        if (targetVoiceLine === 'UNASSIGNED' && !existingCasting) return;

        const prevCastings = [...localCastings];
        let newCastings = [...localCastings];

        if (targetVoiceLine === 'UNASSIGNED') {
            newCastings = newCastings.filter((c) => String(c.participation) !== partId);
        } else {
            if (existingCasting) {
                newCastings = newCastings.map((c) => String(c.participation) === partId ? { ...c, voice_line: targetVoiceLine } : c);
            } else {
                newCastings.push({ 
                    id: `temp-${Date.now()}`, 
                    participation: partId, 
                    piece: selectedPieceId as string, 
                    voice_line: targetVoiceLine,
                    gives_pitch: false 
                } as PieceCasting);
            }
        }
        setLocalCastings(newCastings);

        try {
            if (targetVoiceLine === 'UNASSIGNED') {
                if (existingCasting?.id) await api.delete(`/api/piece-castings/${existingCasting.id}/`);
            } else {
                if (existingCasting?.id && !String(existingCasting.id).startsWith('temp-')) {
                    await api.patch(`/api/piece-castings/${existingCasting.id}/`, { voice_line: targetVoiceLine });
                } else {
                    await api.post('/api/piece-castings/', { 
                        participation: partId, 
                        piece: selectedPieceId, 
                        voice_line: targetVoiceLine,
                        gives_pitch: false
                    });
                }
            }
            
            // Enterprise Invalidation: Sync overall project statistics and matrices
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.program.all })
            ]);
            
        } catch (err) { 
            setLocalCastings(prevCastings);
            toast.error("Błąd synchronizacji", { description: "Nie udało się zaktualizować obsady." });
        }
    };

    return {
        program,
        voiceLines,
        pieces,
        selectedPieceId,
        setSelectedPieceId,
        localCastings,
        activeDragId,
        artistMap,
        pieceStatuses,
        projectParticipations,
        handleUpdateNote,
        handleDragStart,
        handleDragEnd
    };
};
