/**
 * @file useArtistForm.ts
 * @description Encapsulates complex form state, dirty tracking, and API payload construction 
 * for the Artist Editor Panel. Prevents accidental data loss during active editing.
 * @module panel/artists/hooks/useArtistForm
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import type { Artist } from '../../../../types';

interface VoiceTypeOption {
    value: string;
    label: string;
}

export interface ArtistFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    voice_type: string;
    is_active: boolean;
    sight_reading_skill: string;
    vocal_range_bottom: string;
    vocal_range_top: string;
}

export const useArtistForm = (
    artist: Artist | null,
    voiceTypes: VoiceTypeOption[],
    initialSearchContext: string,
    onClose: () => void
) => {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const initialFormData = useMemo<ArtistFormData>(() => {
        let defaultFirst = '';
        let defaultLast = '';
        
        if (!artist && initialSearchContext) {
            const parts = initialSearchContext.trim().split(' ');
            defaultFirst = parts[0] || '';
            defaultLast = parts.slice(1).join(' ') || '';
        }

        return {
            first_name: artist?.first_name || defaultFirst, 
            last_name: artist?.last_name || defaultLast,
            email: artist?.email || '', 
            phone_number: artist?.phone_number || '',
            voice_type: artist?.voice_type || (voiceTypes.length > 0 ? voiceTypes[0].value : 'SOP'), 
            is_active: artist?.is_active ?? true,
            sight_reading_skill: artist?.sight_reading_skill ? String(artist.sight_reading_skill) : '',
            vocal_range_bottom: artist?.vocal_range_bottom || '', 
            vocal_range_top: artist?.vocal_range_top || ''
        };
    }, [artist, voiceTypes, initialSearchContext]);

    const [formData, setFormData] = useState<ArtistFormData>(initialFormData);

    const isFormDirty = useMemo(() => {
        return JSON.stringify(formData) !== JSON.stringify(initialFormData);
    }, [formData, initialFormData]);

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const toastId = toast.loading(artist?.id ? "Aktualizowanie profilu..." : "Tworzenie konta artysty...");

        const payload: Partial<Artist> = { 
            ...formData,
            sight_reading_skill: formData.sight_reading_skill ? parseInt(formData.sight_reading_skill, 10) : null
        };

        try {
            if (artist?.id) {
                await api.patch(`/api/artists/${artist.id}/`, payload);
                toast.success("Zaktualizowano profil artysty.", { id: toastId });
            } else {
                await api.post('/api/artists/', payload);
                toast.success("Dodano artystę. Konto wygenerowane!", { id: toastId });
            }
            
            await queryClient.invalidateQueries({ queryKey: ['artists'] }); 
            setFormData(formData); 
            onClose(); 
        } catch (err) {
            console.error("[ArtistEditor] Form submission failed:", err);
            const errorObj = err as Record<string, unknown>;
            const isEmailTaken = (errorObj?.response as any)?.data?.email;
            
            toast.error(isEmailTaken ? "Ten adres e-mail jest już zajęty." : "Wystąpił błąd zapisu.", { 
                id: toastId,
                description: "Sprawdź poprawność danych i spróbuj ponownie."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        formData,
        setFormData,
        initialFormData,
        isFormDirty,
        isSubmitting,
        handleSubmit
    };
};