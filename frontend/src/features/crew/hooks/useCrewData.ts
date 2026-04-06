/**
 * @file useCrewData.ts
 * @description Encapsulates filtering, editor state, and deletion flow for the Crew domain.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Collaborator } from '../../../shared/types';
import { useCrewMembers, useDeleteCrewMember } from '../api/crew.queries';

export const useCrewData = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('');

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);
    const [initialSearchContext, setInitialSearchContext] = useState('');

    const [personToDelete, setPersonToDelete] = useState<string | null>(null);
    const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: crew = [], isLoading, isError } = useCrewMembers();
    const deleteMutation = useDeleteCrewMember();

    const displayCrew = useMemo(() => {
        return crew.filter((person) => {
            const matchesSearch = `${person.first_name} ${person.last_name} ${person.company_name || ''}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
            const matchesSpecialty = specialtyFilter ? person.specialty === specialtyFilter : true;

            return matchesSearch && matchesSpecialty;
        });
    }, [crew, searchTerm, specialtyFilter]);

    const openPanel = useCallback((person: Collaborator | null = null, searchContext: string = '') => {
        if (closeResetTimeoutRef.current) {
            clearTimeout(closeResetTimeoutRef.current);
            closeResetTimeoutRef.current = null;
        }

        setEditingPerson(person);
        setInitialSearchContext(searchContext);
        setIsPanelOpen(true);
    }, []);

    const closePanel = useCallback(() => {
        setIsPanelOpen(false);

        if (closeResetTimeoutRef.current) {
            clearTimeout(closeResetTimeoutRef.current);
        }

        closeResetTimeoutRef.current = setTimeout(() => {
            setEditingPerson(null);
            setInitialSearchContext('');
            closeResetTimeoutRef.current = null;
        }, 300);
    }, []);

    useEffect(() => {
        return () => {
            if (closeResetTimeoutRef.current) {
                clearTimeout(closeResetTimeoutRef.current);
            }
        };
    }, []);

    const executeDelete = async () => {
        if (!personToDelete) {
            return;
        }

        const toastId = toast.loading("Usuwanie współpracownika...");

        try {
            await deleteMutation.mutateAsync(personToDelete);
            toast.success("Osoba została usunięta z bazy.", { id: toastId });
        } catch (error) {
            toast.error("Nie można usunąć tej osoby", {
                id: toastId,
                description: "Prawdopodobnie jest ona powiązana z istniejącymi projektami. Spróbuj edytować jej dane.",
            });
        } finally {
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
        isDeleting: deleteMutation.isPending,
        openPanel,
        closePanel,
        executeDelete,
    };
};
