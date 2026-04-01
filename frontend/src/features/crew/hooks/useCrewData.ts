/**
 * @file useCrewData.ts
 * @description Encapsulates data fetching, filtering, and modal state management 
 * for the Crew & Collaborators module.
 * @module panel/crew/hooks/useCrewData
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../shared/api/api';
import { queryKeys } from '../../../shared/lib/queryKeys';
import type { Collaborator } from '../../../shared/types';

export const useCrewData = () => {
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [specialtyFilter, setSpecialtyFilter] = useState<string>('');

    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);
    const [initialSearchContext, setInitialSearchContext] = useState<string>('');

    const [personToDelete, setPersonToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const { data: crew = [], isLoading, isError } = useQuery<Collaborator[]>({
        queryKey: queryKeys.collaborators.all,
        queryFn: async () => (await api.get<Collaborator[]>('/api/collaborators/')).data
    });

    const displayCrew = useMemo<Collaborator[]>(() => {
        return crew.filter(c => {
            const matchesSearch = `${c.first_name} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSpecialty = specialtyFilter ? c.specialty === specialtyFilter : true;
            return matchesSearch && matchesSpecialty;
        });
    }, [crew, searchTerm, specialtyFilter]);

    const openPanel = useCallback((person: Collaborator | null = null, searchContext: string = '') => {
        setEditingPerson(person);
        setInitialSearchContext(searchContext);
        setIsPanelOpen(true);
    }, []);

    const closePanel = useCallback(() => {
        setIsPanelOpen(false);
        setTimeout(() => {
            setEditingPerson(null);
            setInitialSearchContext('');
        }, 300);
    }, []);

    const executeDelete = async () => {
        if (!personToDelete) return;
        setIsDeleting(true);
        const toastId = toast.loading("Usuwanie współpracownika...");

        try {
            await api.delete(`/api/collaborators/${personToDelete}/`);
            await queryClient.invalidateQueries({ queryKey: queryKeys.collaborators.all });
            toast.success("Osoba została usunięta z bazy.", { id: toastId });
        } catch (err) { 
            toast.error("Nie można usunąć tej osoby", { 
                id: toastId, 
                description: "Prawdopodobnie jest ona powiązana z istniejącymi projektami. Spróbuj edytować jej dane." 
            }); 
        } finally {
            setIsDeleting(false);
            setPersonToDelete(null);
        }
    };

    return {
        crew,
        isLoading,
        isError,
        displayCrew,
        searchTerm,
        setSearchTerm,
        specialtyFilter,
        setSpecialtyFilter,
        isPanelOpen,
        editingPerson,
        initialSearchContext,
        personToDelete,
        setPersonToDelete,
        isDeleting,
        openPanel,
        closePanel,
        executeDelete
    };
};