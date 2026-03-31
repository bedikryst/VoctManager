/**
 * @file useDetailsForm.ts
 * @description Encapsulates dirty-state tracking, payload construction, 
 * and optimistic form mutations for the Project Details tab.
 * @module panel/projects/ProjectEditorPanel/hooks/useDetailsForm
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import type { Project, RunSheetItem } from '../../../../../types';

export interface ProjectFormData {
    title: string;
    date_time: string;
    call_time: string;
    location: string;
    dress_code_male: string;   
    dress_code_female: string;  
    spotify_playlist_url: string; 
    description: string;
}

const toLocalISOString = (dateString?: string | null): string => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export const useDetailsForm = (project: Project | null, onSuccess: (updatedProject?: Project) => void) => {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const initialFormData = useMemo<ProjectFormData>(() => ({
        title: project?.title || '', 
        date_time: project?.date_time ? toLocalISOString(project.date_time) : '',
        call_time: project?.call_time ? toLocalISOString(project.call_time) : '',
        location: project?.location || '',
        dress_code_male: project?.dress_code_male || '',       
        dress_code_female: project?.dress_code_female || '',   
        spotify_playlist_url: project?.spotify_playlist_url || '', 
        description: project?.description || ''
    }), [project]);

    const initialRunSheet = useMemo<RunSheetItem[]>(() => project?.run_sheet || [], [project]);

    const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
    const [runSheet, setRunSheet] = useState<RunSheetItem[]>(initialRunSheet);

    useEffect(() => {
        setFormData(initialFormData);
        setRunSheet(initialRunSheet);
    }, [initialFormData, initialRunSheet]);

    const sortedRunSheet = useMemo(() => {
        return [...runSheet].sort((a, b) => a.time.localeCompare(b.time));
    }, [runSheet]);

    const isDirty = useMemo(() => {
        const isFormChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
        const isRunSheetChanged = JSON.stringify(sortedRunSheet) !== JSON.stringify(initialRunSheet);
        return isFormChanged || isRunSheetChanged;
    }, [formData, initialFormData, sortedRunSheet, initialRunSheet]);

    const handleAddRunSheetItem = useCallback((): void => {
        setRunSheet((prev) => [
            ...prev, 
            { id: crypto.randomUUID(), time: '', title: '', description: '' }
        ]);
    }, []);

    const handleUpdateRunSheetItem = useCallback((id: string | number, field: keyof RunSheetItem, value: string): void => {
        setRunSheet((prev) => prev.map((item) => 
            String(item.id) === String(id) ? { ...item, [field]: value } : item
        ));
    }, []);

    const handleRemoveRunSheetItem = useCallback((id: string | number): void => {
        setRunSheet((prev) => prev.filter((item) => String(item.id) !== String(id)));
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!isDirty) return;

        setIsSubmitting(true);
        const actionLabel = project?.id ? "Aktualizowanie projektu..." : "Tworzenie projektu...";
        const toastId = toast.loading(actionLabel);

        try {
            const payload = { 
                title: formData.title,
                date_time: formData.date_time,
                call_time: formData.call_time || null,
                location: formData.location || null,
                dress_code_male: formData.dress_code_male || null,
                dress_code_female: formData.dress_code_female || null,
                spotify_playlist_url: formData.spotify_playlist_url || null,
                description: formData.description || null,
                run_sheet: sortedRunSheet 
            };

            let res;
            
            if (project?.id) {
                res = await api.patch(`/api/projects/${project.id}/`, payload);
                toast.success("Zaktualizowano projekt i harmonogram", { id: toastId });
            } else {
                res = await api.post('/api/projects/', payload);
                toast.success("Utworzono nowy projekt z harmonogramem", { id: toastId });
            }
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            
            onSuccess(res.data);
        } catch (err: any) {
            const errorMessage = err.response?.data 
                ? Object.values(err.response.data).flat().join(' | ') 
                : "Wystąpił problem podczas zapisywania danych.";
                
            toast.error("Błąd zapisu", { id: toastId, description: errorMessage });
            console.error("[DetailsTab] API Rejection Payload:", err.response?.data);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        formData,
        setFormData,
        sortedRunSheet,
        isDirty,
        isSubmitting,
        handleAddRunSheetItem,
        handleUpdateRunSheetItem,
        handleRemoveRunSheetItem,
        handleSubmit
    };
};