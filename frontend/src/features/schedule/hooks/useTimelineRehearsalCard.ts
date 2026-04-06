/**
 * @file useTimelineRehearsalCard.ts
 * @description Encapsulates presence confirmation, status masking, and report form state for rehearsal cards.
 */

import { useEffect, useState } from 'react';
import type { AttendanceStatus } from '../../../shared/types';
import type { TimelineEvent } from '../types/schedule.dto';

type ReportStatus = Extract<AttendanceStatus, 'ABSENT' | 'LATE'>;

export const useTimelineRehearsalCard = (
    event: TimelineEvent,
    onSubmitReport: (
        eventId: string,
        projectId: string | number,
        status: AttendanceStatus,
        notes: string,
    ) => Promise<boolean>,
    onToggle: () => void,
    isExpanded: boolean,
) => {
    const [reportingMode, setReportingMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentMaskedStatus = event.status === 'EXCUSED' ? 'ABSENT' : event.status;

    const getDefaultReportStatus = (status: TimelineEvent['status']): ReportStatus => {
        if (status === 'ABSENT' || status === 'LATE') {
            return status;
        }

        return 'ABSENT';
    };

    const [reportForm, setReportForm] = useState<{ status: ReportStatus; notes: string }>({
        status: getDefaultReportStatus(currentMaskedStatus),
        notes: event.excuse_note || '',
    });

    useEffect(() => {
        const maskedStatus = event.status === 'EXCUSED' ? 'ABSENT' : event.status;
        setReportForm({
            status: getDefaultReportStatus(maskedStatus),
            notes: event.excuse_note || '',
        });
    }, [event.status, event.excuse_note]);

    const isExcusedOrLate = currentMaskedStatus === 'ABSENT' || currentMaskedStatus === 'LATE';

    const handleConfirmPresence = async (eventClick: React.MouseEvent) => {
        eventClick.stopPropagation();
        setIsSubmitting(true);
        await onSubmitReport(String(event.rawObj.id), event.project_id, 'PRESENT', 'Obecność potwierdzona');
        setIsSubmitting(false);
        setReportingMode(false);
    };

    const handleSubmitReport = async (formEvent: React.FormEvent) => {
        formEvent.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmitReport(String(event.rawObj.id), event.project_id, reportForm.status, reportForm.notes);
        setIsSubmitting(false);

        if (success) {
            setReportingMode(false);
        }
    };

    const enableReportingMode = (eventClick: React.MouseEvent) => {
        eventClick.stopPropagation();
        setReportingMode(true);

        if (isExpanded) {
            onToggle();
        }
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
        enableReportingMode,
    };
};
