/**
 * @file useTimelineRehearsalCard.ts
 * @description Encapsulates presence confirmation logic, status masking, 
 * and reporting form state for individual rehearsal timeline cards.
 * @module panel/schedule/hooks/useTimelineRehearsalCard
 */

import { useState, useEffect } from 'react';
import type { TimelineEvent } from './useScheduleData';

export const useTimelineRehearsalCard = (
    event: TimelineEvent, 
    onSubmitReport: (eventId: string, projectId: string | number, status: string, notes: string) => Promise<boolean>,
    onToggle: () => void,
    isExpanded: boolean
) => {
    const [reportingMode, setReportingMode] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    
    // Status Masking: Treats 'EXCUSED' as 'ABSENT' for the artist view
    const currentMaskedStatus = event.status === 'EXCUSED' ? 'ABSENT' : event.status;
    
    const [reportForm, setReportForm] = useState({ 
        status: (currentMaskedStatus === 'ABSENT' || currentMaskedStatus === 'LATE') ? currentMaskedStatus : 'ABSENT', 
        notes: event.excuse_note || '' 
    });

    useEffect(() => {
        const masked = event.status === 'EXCUSED' ? 'ABSENT' : event.status;
        setReportForm({
            status: (masked === 'ABSENT' || masked === 'LATE') ? masked : 'ABSENT',
            notes: event.excuse_note || ''
        });
    }, [event.status, event.excuse_note]);

    const isExcusedOrLate = currentMaskedStatus === 'ABSENT' || currentMaskedStatus === 'LATE';

    const handleConfirmPresence = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSubmitting(true);
        await onSubmitReport(event.rawObj.id, event.project_id, 'PRESENT', 'Obecność potwierdzona');
        setIsSubmitting(false);
        setReportingMode(false);
    };

    const handleSubmitReport = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmitReport(event.rawObj.id, event.project_id, reportForm.status, reportForm.notes);
        setIsSubmitting(false);
        if (success) {
            setReportingMode(false);
        }
    };

    const enableReportingMode = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        setReportingMode(true); 
        if (isExpanded) onToggle();
    };

    return {
        reportingMode,
        setReportingMode,
        isSubmitting,
        currentMaskedStatus,
        reportForm,
        setReportForm,
        isExcusedOrLate,
        handleConfirmPresence,
        handleSubmitReport,
        enableReportingMode
    };
};