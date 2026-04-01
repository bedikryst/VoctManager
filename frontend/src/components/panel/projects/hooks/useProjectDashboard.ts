/**
 * @file useProjectDashboard.ts
 * @description Master Controller hook for the Project Dashboard.
 * Orchestrates local state management, optimistic UI updates, and data fetching.
 * Utilizes React Query for aggressive caching (staleTime: Infinity) to eliminate 
 * the need for a global React Context API structure.
 * @module panel/projects/hooks/useProjectDashboard
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import api from '../../../../utils/api';
import { queryKeys } from '../../../../utils/queryKeys';
import type { Project, Piece, Artist, Collaborator, VoiceLineOption } from '../../../../types';

export type FilterStatus = 'ACTIVE' | 'DONE' | 'ALL';

/**
 * @interface UseProjectDashboardReturn
 * Strict contract defining the API surface exposed to the Dashboard view.
 */
interface UseProjectDashboardReturn {
    isLoading: boolean;
    filteredProjects: Project[];
    listFilter: FilterStatus;
    setListFilter: (filter: FilterStatus) => void;
    isPanelOpen: boolean;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    editingProject: Project | null;
    projectToDelete: string | null;
    setProjectToDelete: (id: string | null) => void;
    isDeleting: boolean;
    openPanel: (project?: Project | null, tab?: string) => void;
    closePanel: () => void;
    executeDelete: () => Promise<void>;
}

export const useProjectDashboard = (): UseProjectDashboardReturn => {
    const queryClient = useQueryClient();

    // --- STATE MANAGEMENT ---
    const [listFilter, setListFilter] = useState<FilterStatus>('ACTIVE'); 
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>('DETAILS'); 
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    
    // Maintain a stable reference to the currently edited project for safe cleanup operations
    const editingProjectRef = useRef<Project | null>(null);
    useEffect(() => { 
        editingProjectRef.current = editingProject; 
    }, [editingProject]);

    // --- DATA FETCHING & CACHE WARM-UP ---
    // Aggressively pre-fetching global dictionaries and resolving them into cache.
    // StaleTime is set to Infinity for static assets to ensure instantaneous rendering for child views.
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

    // --- ERROR HANDLING ---
    useEffect(() => {
        // Note: Hardcoded strings should eventually be extracted to an i18n dictionary.
        if (isError) {
            toast.error("Błąd synchronizacji", { 
                description: "Słowniki nie zostały pobrane poprawnie." 
            });
        }
    }, [isError]);

    // --- COMPUTED STATE ---
    const filteredProjects = useMemo<Project[]>(() => {
        return projects
            .filter((p: Project) => {
                const status = p.status || 'DRAFT';
                if (listFilter === 'ACTIVE') return status !== 'DONE' && status !== 'CANC';
                if (listFilter === 'DONE') return status === 'DONE' || status === 'CANC';
                return true;
            })
            .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
    }, [projects, listFilter]);

    // --- MUTATIONS & ACTIONS ---
    const openPanel = useCallback((project: Project | null = null, tab: string = 'DETAILS'): void => { 
        setEditingProject(project); 
        setActiveTab(tab); 
        setIsPanelOpen(true); 
    }, []);

    const closePanel = useCallback((): void => { 
        setIsPanelOpen(false); 
        // Delaying state reset to allow CSS exit animations to complete smoothly
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
            
            // Auto-close the panel if the user is currently viewing the deleted project
            if (editingProjectRef.current?.id === projectToDelete) {
                closePanel();
            }
        } catch (err) { 
            toast.error("Błąd usuwania", { 
                id: toastId, 
                description: "Sprawdź powiązania projektu w bazie." 
            });
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