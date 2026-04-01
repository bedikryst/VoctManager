/**
 * @file useArtistData.ts
 * @description Encapsulates data fetching, filtering, KPI calculations (ensemble balance), 
 * and modal state management for the HR / Roster module.
 * @module hooks/useArtistData
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../shared/api/api';
import type { Artist } from '../../../types';

export interface VoiceTypeOption {
    value: string;
    label: string;
}

export const useArtistData = () => {
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [voiceFilter, setVoiceFilter] = useState<string>('');

    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
    const [initialSearchContext, setInitialSearchContext] = useState<string>('');

    const [artistToToggle, setArtistToToggle] = useState<{ id: string, willBeActive: boolean } | null>(null);
    const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

    const results = useQueries({
        queries: [
            { queryKey: ['artists'], queryFn: async () => (await api.get<Artist[]>('/api/artists/')).data },
            { queryKey: ['voiceTypes'], queryFn: async () => (await api.get<VoiceTypeOption[]>('/api/options/voice-types/')).data }
        ]
    });

    const isLoading = results.some(query => query.isLoading);
    const isError = results.some(query => query.isError);

    const artists = results[0].data || [];
    const voiceTypes = results[1].data || [];

    const activeArtists = useMemo(() => artists.filter(a => a.is_active), [artists]);
    
    const ensembleBalance = useMemo(() => {
        return {
            S: activeArtists.filter(a => a.voice_type?.startsWith('S')).length,
            A: activeArtists.filter(a => a.voice_type?.startsWith('A') || a.voice_type === 'MEZ').length,
            T: activeArtists.filter(a => a.voice_type?.startsWith('T') || a.voice_type === 'CT').length,
            B: activeArtists.filter(a => a.voice_type?.startsWith('B')).length,
            Total: activeArtists.length
        };
    }, [activeArtists]);

    const displayArtists = useMemo(() => {
        return artists.filter(a => {
            const matchesSearch = `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesVoice = voiceFilter ? (a.voice_type === voiceFilter || a.voice_type?.startsWith(voiceFilter)) : true;
            return matchesSearch && matchesVoice;
        });
    }, [artists, searchTerm, voiceFilter]);

    const openPanel = useCallback((artist: Artist | null = null, initialNameContext: string = '') => {
        setEditingArtist(artist);
        setInitialSearchContext(initialNameContext);
        setIsPanelOpen(true);
    }, []);

    const closePanel = useCallback(() => {
        setIsPanelOpen(false);
        setTimeout(() => {
            setEditingArtist(null);
            setInitialSearchContext('');
        }, 300);
    }, []);

    const handleToggleRequest = useCallback((id: string, willBeActive: boolean) => {
        setArtistToToggle({ id, willBeActive });
    }, []);

    const executeStatusToggle = async () => {
        if (!artistToToggle) return;
        setIsTogglingStatus(true);
        const toastId = toast.loading(artistToToggle.willBeActive ? "Aktywowanie konta..." : "Archiwizowanie artysty...");

        try {
            await api.patch(`/api/artists/${artistToToggle.id}/`, { is_active: artistToToggle.willBeActive });
            await queryClient.invalidateQueries({ queryKey: ['artists'] });
            toast.success(artistToToggle.willBeActive ? "Konto artysty aktywowane" : "Artysta zarchiwizowany", { id: toastId });
        } catch (err) { 
            toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zmienić statusu artysty." });
        } finally {
            setIsTogglingStatus(false);
            setArtistToToggle(null);
        }
    };

    return {
        isLoading,
        isError,
        voiceTypes,
        searchTerm,
        setSearchTerm,
        voiceFilter,
        setVoiceFilter,
        ensembleBalance,
        displayArtists,
        isPanelOpen,
        editingArtist,
        initialSearchContext,
        artistToToggle,
        setArtistToToggle,
        isTogglingStatus,
        openPanel,
        closePanel,
        handleToggleRequest,
        executeStatusToggle
    };
};