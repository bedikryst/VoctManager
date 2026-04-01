/**
 * @file useCrewForm.ts
 * @description Manages the state, validation, dirty-tracking, and API submission 
 * for the Crew/Collaborator editor form.
 * @module panel/crew/hooks/useCrewForm
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';
import type { Collaborator } from '../../../../types';

export interface CrewFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    company_name: string;
    specialty: string;
}

export const useCrewForm = (
    person: Collaborator | null,
    initialSearchContext: string,
    onClose: () => void
) => {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const initialFormData = useMemo<CrewFormData>(() => {
        let defaultCompany = '';
        let defaultLast = '';
        
        if (!person && initialSearchContext) {
            if (initialSearchContext.includes(' ')) {
                defaultLast = initialSearchContext;
            } else {
                defaultCompany = initialSearchContext;
            }
        }

        return {
            first_name: person?.first_name || '', 
            last_name: person?.last_name || defaultLast,
            email: person?.email || '', 
            phone_number: person?.phone_number || '',
            company_name: person?.company_name || defaultCompany, 
            specialty: person?.specialty || 'OTHER'
        };
    }, [person, initialSearchContext]);

    const [formData, setFormData] = useState<CrewFormData>(initialFormData);

    const isFormDirty = useMemo(() => {
        return JSON.stringify(formData) !== JSON.stringify(initialFormData);
    }, [formData, initialFormData]);

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const toastId = toast.loading(person?.id ? "Aktualizowanie danych..." : "Dodawanie współpracownika...");

        try {
            if (person?.id) {
                await api.patch(`/api/collaborators/${person.id}/`, formData);
                toast.success("Zaktualizowano profil współpracownika.", { id: toastId });
            } else {
                await api.post('/api/collaborators/', formData);
                toast.success("Dodano nową osobę do bazy.", { id: toastId });
            }
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.collaborators.all }); 
            setFormData(formData); 
            onClose(); 
        } catch (err) {
            console.error("[CrewEditor] Form submission failed:", err);
            toast.error("Wystąpił błąd podczas zapisywania danych.", { 
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