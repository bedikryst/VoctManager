/**
 * @file useCrewAssignments.ts
 * @description Encapsulates mutation logic and state management for crew assignments.
 * Extracts dictionary data (collaborators) efficiently from useProjectData cache.
 * @module panel/projects/ProjectEditorPanel/hooks/useCrewAssignments
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';
import type { Collaborator, CrewAssignment } from '../../../../../types';

export const useCrewAssignments = (projectId: string) => {
    const queryClient = useQueryClient();
    
    // FETCH CACHED DATA
    const { crew, crewAssignments, isLoading } = useProjectData(projectId);

    // MUTABLE STATE
    const [selectedCrewId, setSelectedCrewId] = useState<string>('');
    const [roleDesc, setRoleDesc] = useState<string>('');
    const [isMutating, setIsMutating] = useState<boolean>(false);

    // DERIVED STATE
    const projectAssignments = useMemo<CrewAssignment[]>(() => {
        return crewAssignments.filter((a) => String(a.project) === String(projectId));
    }, [crewAssignments, projectId]);

    const assignedCrewIds = useMemo<Set<string>>(() => {
        return new Set(projectAssignments.map((a) => String(a.collaborator)));
    }, [projectAssignments]);

    const availableCrew = useMemo<Collaborator[]>(() => {
        if (!crew || crew.length === 0) return [];
        return crew.filter((c) => !assignedCrewIds.has(String(c.id)));
    }, [crew, assignedCrewIds]);

    const crewMap = useMemo<Map<string, Collaborator>>(() => {
        const map = new Map<string, Collaborator>();
        if (crew) {
            crew.forEach((c) => map.set(String(c.id), c));
        }
        return map;
    }, [crew]);

    // ACTION HANDLERS
    const handleAssign = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!selectedCrewId) return;

        setIsMutating(true);
        const toastId = toast.loading("Przypisywanie członka ekipy...");

        try {
            await api.post('/api/crew-assignments/', { 
                project: projectId, 
                collaborator: selectedCrewId,
                role_description: roleDesc 
            });
            
            setSelectedCrewId('');
            setRoleDesc('');
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.byProject(projectId) });
            toast.success("Członek ekipy przypisany pomyślnie", { id: toastId });
        } catch (err) {
            toast.error("Błąd przypisania", { id: toastId, description: "Nie udało się przypisać członka ekipy do projektu." });
        } finally {
            setIsMutating(false);
        }
    };

    const handleRemove = async (id: string | number): Promise<void> => {
        const toastId = toast.loading("Usuwanie członka ekipy...");
        try { 
            await api.delete(`/api/crew-assignments/${id}/`); 
            await queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.byProject(projectId) });
            toast.success("Usunięto przypisanie z projektu", { id: toastId });
        } catch (err) { 
            toast.error("Błąd usuwania", { id: toastId, description: "Nie udało się odpiąć członka ekipy z projektu." });
        }
    };

    return {
        isLoading,
        isMutating,
        selectedCrewId,
        setSelectedCrewId,
        roleDesc,
        setRoleDesc,
        availableCrew,
        projectAssignments,
        crewMap,
        handleAssign,
        handleRemove
    };
};