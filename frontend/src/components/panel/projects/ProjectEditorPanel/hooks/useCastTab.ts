/**
 * @file useCastTab.ts
 * @description State and mutation controller for the Primary Casting Manager.
 * Safely fetches dictionary data via useProjectData and manages assignment toggle mutations.
 * @module panel/projects/ProjectEditorPanel/hooks/useCastTab
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';
import type { Participation } from '../../../../../types';

export const useCastTab = (projectId: string) => {
    const queryClient = useQueryClient();
    
    const { artists } = useProjectData(projectId);

    const { data: participations = [], isLoading: isFetching } = useQuery<Participation[]>({
        queryKey: queryKeys.participations.byProject(projectId),
        queryFn: async () => (await api.get<Participation[]>(`/api/participations/?project=${projectId}`)).data,
        staleTime: 60000,
        enabled: !!projectId
    });

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [processingId, setProcessingId] = useState<string | number | null>(null);
    const [mobileView, setMobileView] = useState<'AVAILABLE' | 'ASSIGNED'>('AVAILABLE');

    const allArtists = useMemo(() => {
        if (!artists || artists.length === 0) return [];
        let active = artists.filter(a => a.is_active !== false);
        
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            active = active.filter(a => 
                a.first_name.toLowerCase().includes(q) || 
                a.last_name.toLowerCase().includes(q) ||
                a.voice_type_display?.toLowerCase().includes(q)
            );
        }

        return active.sort((a, b) => {
            const voiceCompare = (a.voice_type || '').localeCompare(b.voice_type || '');
            if (voiceCompare !== 0) return voiceCompare;
            return a.last_name.localeCompare(b.last_name);
        });
    }, [artists, searchQuery]);

    const assignedIds = useMemo(() => new Set(participations.map(p => String(p.artist))), [participations]);

    const toggleCasting = async (
        artistId: string | number, 
        isCurrentlyCasted: boolean, 
        participationId?: string | number
    ): Promise<void> => {
        setProcessingId(artistId);

        try {
            if (isCurrentlyCasted && participationId) {
                await api.delete(`/api/participations/${participationId}/`);
                toast.success("Usunięto z obsady");
            } else {
                const existingDeclined = participations.find(p => String(p.artist) === String(artistId) && p.status === 'DEC');
                if (existingDeclined) {
                    await api.patch(`/api/participations/${existingDeclined.id}/`, { status: 'CON' });
                } else {
                    await api.post('/api/participations/', { artist: artistId, project: projectId, status: 'INV' });
                }
                toast.success("Dodano do obsady");
            }
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.participations.byProject(projectId) }); 
        } catch (err) { 
            toast.error("Błąd zapisu", { description: "Wystąpił problem z połączeniem z bazą danych." });
        } finally {
            setProcessingId(null);
        }
    };

    return {
        participations,
        isFetching,
        searchQuery,
        setSearchQuery,
        processingId,
        mobileView,
        setMobileView,
        allArtists,
        assignedIds,
        toggleCasting
    };
};