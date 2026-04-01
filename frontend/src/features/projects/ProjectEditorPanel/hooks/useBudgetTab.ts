/**
 * @file useBudgetTab.ts
 * @description Encapsulates dirty-state tracking, financial KPI calculations, 
 * and bulk-save mutations for the Project Budgeting module.
 * Safely consumes structural cached data via useProjectData.
 * @module panel/projects/ProjectEditorPanel/hooks/useBudgetTab
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';

type FeeMutation = { type: 'cast' | 'crew', value: string };

export const useBudgetTab = (projectId: string) => {
    const queryClient = useQueryClient();
    
    // Zaciągamy dane ze zoptymalizowanego cache'u (brak strzałów do API, brak Contextu)
    const { 
        participations, crewAssignments, artists, crew, isLoading 
    } = useProjectData(projectId);

    // --- Mutable Local State (Dirty Tracking) ---
    const [dirtyFees, setDirtyFees] = useState<Record<string, FeeMutation>>({});
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const handleFeeChange = (id: string, value: string, type: 'cast' | 'crew') => {
        setDirtyFees(prev => ({ ...prev, [id]: { type, value } }));
    };

    const handleReset = () => {
        setDirtyFees({});
    };

    const handleBulkSave = async () => {
        const keys = Object.keys(dirtyFees);
        if (keys.length === 0) return;

        setIsSaving(true);
        const toastId = toast.loading(`Zapisywanie budżetu (${keys.length} modyfikacji)...`);

        try {
            const promises = keys.map(id => {
                const mutation = dirtyFees[id];
                const numericVal = mutation.value === '' ? null : parseFloat(mutation.value);
                const endpoint = mutation.type === 'cast' ? `/api/participations/${id}/` : `/api/crew-assignments/${id}/`;
                return api.patch(endpoint, { fee: numericVal });
            });

            await Promise.all(promises);
            
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.participations.byProject(projectId) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.byProject(projectId) })
            ]);
            
            setDirtyFees({});
            toast.success("Budżet zaktualizowany pomyślnie.", { id: toastId });
        } catch (err) {
            toast.error("Błąd zapisu", { id: toastId, description: "Nie udało się zapisać wszystkich stawek. Spróbuj ponownie." });
        } finally {
            setIsSaving(false);
        }
    };

    const isDirty = Object.keys(dirtyFees).length > 0;

    // --- Enriched Financial Datasets ---
    const enrichedCast = useMemo(() => {
        if (!artists || artists.length === 0) return [];
        return participations
            .map(p => ({ ...p, artistData: artists.find(a => String(a.id) === String(p.artist)) }))
            .filter(p => p.artistData && p.status !== 'DEC')
            .sort((a, b) => a.artistData!.last_name.localeCompare(b.artistData!.last_name));
    }, [participations, artists]);

    const enrichedCrew = useMemo(() => {
        if (!crew || crew.length === 0) return [];
        return crewAssignments
            .map(c => ({ ...c, crewData: crew.find(col => String(col.id) === String(c.collaborator)) }))
            .filter(c => c.crewData)
            .sort((a, b) => a.crewData!.last_name.localeCompare(b.crewData!.last_name));
    }, [crewAssignments, crew]);

    // --- KPI Calculations ---
    const kpi = useMemo(() => {
        let castTotal = 0;
        let crewTotal = 0;
        let missingCount = 0;

        enrichedCast.forEach(p => {
            const currentVal = dirtyFees[String(p.id)] ? dirtyFees[String(p.id)].value : String(p.fee || '');
            if (!currentVal) missingCount++;
            else castTotal += parseFloat(currentVal);
        });

        enrichedCrew.forEach(c => {
            const currentVal = dirtyFees[String(c.id)] ? dirtyFees[String(c.id)].value : String(c.fee || '');
            if (!currentVal) missingCount++;
            else crewTotal += parseFloat(currentVal);
        });

        return { castTotal, crewTotal, missingCount, grandTotal: castTotal + crewTotal };
    }, [enrichedCast, enrichedCrew, dirtyFees]);

    return {
        isLoading,
        isSaving,
        isDirty,
        enrichedCast,
        enrichedCrew,
        dirtyFees,
        kpi,
        handleFeeChange,
        handleReset,
        handleBulkSave
    };
};