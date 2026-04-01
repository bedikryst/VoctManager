/**
 * @file useArchiveData.ts
 * @description Encapsulates data fetching, enrichment, filtering, and mutations 
 * for the Sheet Music Archive module.
 * @module hooks/useArchiveData
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../shared/api/api';
import { queryKeys } from '../../../shared/lib/queryKeys';
import type { Piece, Composer, VoiceLineOption } from '../../../shared/types';

export interface EnrichedPiece extends Piece {
    composerData: Composer | null;
}

export const useArchiveData = () => {
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [composerFilter, setComposerFilter] = useState<string>('');
    const [epochFilter, setEpochFilter] = useState<string>(''); 
    const [pieceToDelete, setPieceToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const results = useQueries({
        queries: [
            { queryKey: queryKeys.pieces.all, queryFn: async () => (await api.get<Piece[]>('/api/pieces/')).data },
            { queryKey: queryKeys.composers.all, queryFn: async () => (await api.get<Composer[]>('/api/composers/')).data },
            { queryKey: queryKeys.options.voiceLines, queryFn: async () => (await api.get<VoiceLineOption[]>('/api/options/voice-lines/')).data }
        ]
    });

    const isLoading = results.some(query => query.isLoading);
    const isError = results.some(query => query.isError);

    const pieces = (results[0].data || []) as Piece[];
    const composers = (results[1].data || []) as Composer[];
    const voiceLines = (results[2].data || []) as VoiceLineOption[];

    const composerMap = useMemo<Map<string, Composer>>(() => {
        const map = new Map<string, Composer>();
        composers.forEach(c => map.set(String(c.id), c));
        return map;
    }, [composers]);

    const libraryStats = useMemo(() => {
        const totalPieces = pieces.length;
        const withPdf = pieces.filter(p => p.sheet_music).length;
        const totalAudio = pieces.reduce((acc, piece) => acc + (piece.tracks?.length || 0), 0);
        return { totalPieces, withPdf, totalAudio };
    }, [pieces]);

    const displayPieces = useMemo<EnrichedPiece[]>(() => {
        return pieces.filter(p => {
            const searchMatch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
            const compId = typeof p.composer === 'object' ? (p.composer as any)?.id : p.composer;
            const composerMatch = composerFilter ? String(compId) === String(composerFilter) : true;
            const epochMatch = epochFilter ? p.epoch === epochFilter : true;
            
            return searchMatch && composerMatch && epochMatch;
        }).map(p => {
            const compId = typeof p.composer === 'object' ? (p.composer as any)?.id : p.composer;
            return { ...p, composerData: composerMap.get(String(compId)) || null };
        });
    }, [pieces, searchTerm, composerFilter, epochFilter, composerMap]);

    const executeDelete = useCallback(async (onSuccess?: () => void) => {
        if (!pieceToDelete) return;
        setIsDeleting(true);
        const toastId = toast.loading("Usuwanie utworu...");

        try {
            await api.delete(`/api/pieces/${pieceToDelete}/`);
            await queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all });
            
            if (onSuccess) onSuccess();
            toast.success("Utwór usunięty z bazy", { id: toastId });
        } catch (err) { 
            toast.error("Błąd usuwania", { id: toastId, description: "Utwór może być przypisany do setlisty projektu." }); 
        } finally {
            setIsDeleting(false);
            setPieceToDelete(null);
        }
    }, [pieceToDelete, queryClient]);

    return {
        isLoading,
        isError,
        composers,
        voiceLines,
        libraryStats,
        displayPieces,
        searchTerm,
        setSearchTerm,
        composerFilter,
        setComposerFilter,
        epochFilter,
        setEpochFilter,
        pieceToDelete,
        setPieceToDelete,
        isDeleting,
        executeDelete
    };
};