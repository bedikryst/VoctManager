/**
 * @file useTimelineProjectCard.ts
 * @description Encapsulates lazy-loaded data fetching and PDF generation 
 * for the Timeline Project Card component.
 * @module panel/schedule/hooks/useTimelineProjectCard
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';

export const useTimelineProjectCard = (projectId: string | number, projectTitle: string, isExpanded: boolean) => {
    const [activeSubTab, setActiveSubTab] = useState<'LOGISTICS' | 'SETLIST'>('LOGISTICS');
    const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    const { data: programItems = [], isLoading: isProgramLoading } = useQuery({
        queryKey: queryKeys.program.byProject(projectId),
        queryFn: async () => (await api.get(`/api/program-items/?project=${projectId}`)).data,
        enabled: isExpanded && activeSubTab === 'SETLIST'
    });

    const { data: castings = [], isLoading: isCastingsLoading } = useQuery({
        queryKey: [...queryKeys.pieceCastings.byProject(projectId), { piece: expandedPieceId }],
        queryFn: async () => (await api.get(`/api/piece-castings/?piece=${expandedPieceId}&participation__project=${projectId}`)).data,
        enabled: !!expandedPieceId
    });

    const handleDownloadCallSheet = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDownloading(true);
        const toastId = toast.loading("Generowanie dokumentu Call-Sheet...");

        try {
            const response = await api.get(`/api/projects/${projectId}/export_call_sheet/`, { 
                responseType: 'blob' 
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `CallSheet_${projectTitle.replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            
            toast.success("Plik został pobrany", { id: toastId });
        } catch (error) {
            toast.error("Błąd generowania", { id: toastId, description: "Nie udało się pobrać pliku." });
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        activeSubTab,
        setActiveSubTab,
        expandedPieceId,
        setExpandedPieceId,
        isDownloading,
        programItems,
        isProgramLoading,
        castings,
        isCastingsLoading,
        handleDownloadCallSheet
    };
};