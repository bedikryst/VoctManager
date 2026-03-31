/**
 * @file useProjectDashboard.ts
 * @description Master controller hook for Project Dashboard.
 * Pre-warms the React Query cache with global dictionaries (staleTime: Infinity).
 * Eliminates the need for React Context API.
 * @module panel/projects/hooks/useProjectDashboard
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../utils/api';
import { queryKeys } from '../../../../utils/queryKeys';
import type { Project, Piece, Artist, Collaborator, VoiceLineOption } from '../../../../types';

type FilterStatus = 'ACTIVE' | 'DONE' | 'ALL';

export const useProjectDashboard = () => {
    const queryClient = useQueryClient();

    const [listFilter, setListFilter] = useState<FilterStatus>('ACTIVE'); 
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>('DETAILS'); 
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    
    const editingProjectRef = useRef<Project | null>(null);
    useEffect(() => { editingProjectRef.current = editingProject; }, [editingProject]);

    // WARM-UP CACHE: Ładujemy dane globalne do pamięci podręcznej. 
    // Dzięki temu podkomponenty będą miały do nich natychmiastowy dostęp.
    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get<Project[]>('/api/projects/')).data },
            { queryKey: queryKeys.pieces.all, queryFn: async () => (await api.get<Piece[]>('/api/pieces/')).data, staleTime: Infinity },
            { queryKey: queryKeys.options.voiceLines, queryFn: async () => (await api.get<VoiceLineOption[]>('/api/options/voice-lines/')).data, staleTime: Infinity },
            { queryKey: queryKeys.artists.all, queryFn: async () => (await api.get<Artist[]>('/api/artists/')).data, staleTime: Infinity },
            { queryKey: queryKeys.collaborators.all, queryFn: async () => (await api.get<Collaborator[]>('/api/collaborators/')).data, staleTime: Infinity },
        ]
    });

    const isLoading = results.some((query) => query.isLoading);
    const isError = results.some((query) => query.isError);
    const projects = results[0].data || [];

    useEffect(() => {
        if (isError) toast.error("Błąd synchronizacji", { description: "Słowniki nie zostały pobrane poprawnie." });
    }, [isError]);

    const filteredProjects = useMemo<Project[]>(() => {
        return projects.filter((p: Project) => {
            const status = p.status || 'DRAFT';
            if (listFilter === 'ACTIVE') return status !== 'DONE' && status !== 'CANC';
            if (listFilter === 'DONE') return status === 'DONE' || status === 'CANC';
            return true;
        }).sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
    }, [projects, listFilter]);

    const openPanel = useCallback((project: Project | null = null, tab: string = 'DETAILS'): void => { 
        setEditingProject(project); 
        setActiveTab(tab); 
        setIsPanelOpen(true); 
    }, []);

    const closePanel = useCallback((): void => { 
        setIsPanelOpen(false); 
        setTimeout(() => setEditingProject(null), 300);
    }, []);

    const executeDelete = useCallback(async (): Promise<void> => {
        if (!projectToDelete) return;
        setIsDeleting(true);
        const toastId = toast.loading("Usuwanie projektu...");
        
        try {
            await api.delete(`/api/projects/${projectToDelete}/`);
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            toast.success("Projekt usunięty pomyślnie", { id: toastId });
            if (editingProjectRef.current?.id === projectToDelete) closePanel();
        } catch (err) { 
            toast.error("Błąd usuwania", { id: toastId, description: "Sprawdź powiązania projektu w bazie." });
        } finally {
            setIsDeleting(false);
            setProjectToDelete(null);
        }
    }, [projectToDelete, queryClient, closePanel]);

    return {
        isLoading,
        filteredProjects,
        listFilter,
        setListFilter,
        isPanelOpen,
        activeTab,
        setActiveTab,
        editingProject,
        projectToDelete,
        setProjectToDelete,
        isDeleting,
        openPanel,
        closePanel,
        executeDelete
    };
};