/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Employs rapid Set lookups for audience targeting and synchronizes with global caches.
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
 */

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';
import type { Rehearsal, Artist } from '../../../../../types';

export interface RehearsalFormData {
    date_time: string;
    location: string;
    focus: string;
    is_mandatory: boolean;
}

export type TargetType = 'TUTTI' | 'SECTIONAL' | 'CUSTOM';

export const useRehearsalsTab = (projectId: string) => {
    const queryClient = useQueryClient();
    
    const { artists, participations, rehearsals, isLoading: isContextLoading } = useProjectData(projectId);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [rehearsalToDelete, setRehearsalToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const [formData, setFormData] = useState<RehearsalFormData>({ 
        date_time: '', 
        location: '', 
        focus: '',
        is_mandatory: true
    });

    const [targetType, setTargetType] = useState<TargetType>('TUTTI');
    const [selectedSections, setSelectedSections] = useState<string[]>([]); 
    const [customParticipants, setCustomParticipants] = useState<string[]>([]); 

    const projectRehearsals = useMemo<Rehearsal[]>(() => {
        return [...rehearsals]
            .filter((r) => String(r.project) === String(projectId))
            .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    }, [rehearsals, projectId]);

    const projectParticipations = useMemo(() => {
        return participations.filter((p) => String(p.project) === String(projectId));
    }, [participations, projectId]);

    const artistMap = useMemo<Map<string, Artist>>(() => {
        const map = new Map<string, Artist>();
        if (artists) {
            artists.forEach((a) => map.set(String(a.id), a));
        }
        return map;
    }, [artists]);

    const resolveInvitedParticipants = useCallback((): string[] => {
        if (targetType === 'TUTTI') {
            return projectParticipations.map((p) => String(p.id));
        } 
        if (targetType === 'SECTIONAL') {
            return projectParticipations.filter((p) => {
                const artist = artistMap.get(String(p.artist));
                if (!artist || !artist.voice_type) return false;
                return selectedSections.some((sec) => artist.voice_type?.startsWith(sec));
            }).map((p) => String(p.id));
        }
        return customParticipants; 
    }, [targetType, projectParticipations, artistMap, selectedSections, customParticipants]);

    const handleAdd = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        
        const invitedList = resolveInvitedParticipants();
        if (invitedList.length === 0) {
            toast.warning("Wybierz przynajmniej jedną osobę lub sekcję na próbę!");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Zapisywanie próby w kalendarzu...");

        try {
            const payload = { 
                ...formData, 
                project: projectId, 
                date_time: new Date(formData.date_time).toISOString(),
                invited_participations: invitedList 
            };
            
            await api.post('/api/rehearsals/', payload);
            
            setFormData({ date_time: '', location: '', focus: '', is_mandatory: true }); 
            setTargetType('TUTTI');
            setSelectedSections([]);
            setCustomParticipants([]);
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.byProject(projectId) });
            toast.success("Próba zapisana pomyślnie", { id: toastId });
        } catch (err) { 
            toast.error("Błąd zapisu", { 
                id: toastId, 
                description: "Wystąpił problem z zapisem do bazy. Sprawdź formularz i połączenie." 
            }); 
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (id: string | number): void => {
        setRehearsalToDelete(String(id));
    };

    const executeDelete = async (): Promise<void> => {
        if (!rehearsalToDelete) return;

        setIsDeleting(true);
        const toastId = toast.loading("Usuwanie próby...");

        try { 
            await api.delete(`/api/rehearsals/${rehearsalToDelete}/`); 
            await queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.byProject(projectId) });
            toast.success("Próba została usunięta", { id: toastId });
        } catch (err) {
            toast.error("Błąd usuwania", { 
                id: toastId, 
                description: "Nie udało się usunąć próby. Serwer odrzucił żądanie." 
            });
        } finally {
            setIsDeleting(false);
            setRehearsalToDelete(null);
        }
    };

    const toggleSection = (sec: string): void => {
        setSelectedSections((prev) => 
            prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
        );
    };

    const toggleCustomParticipant = (id: string): void => {
        setCustomParticipants((prev) => 
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
    };

    return {
        isLoading: isContextLoading,
        isSubmitting,
        rehearsalToDelete,
        setRehearsalToDelete,
        isDeleting,
        formData,
        setFormData,
        targetType,
        setTargetType,
        selectedSections,
        customParticipants,
        projectRehearsals,
        projectParticipations,
        artistMap,
        handleAdd,
        handleDeleteClick,
        executeDelete,
        toggleSection,
        toggleCustomParticipant
    };
};