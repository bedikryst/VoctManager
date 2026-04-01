/**
 * @file useAttendanceMatrix.ts
 * @description Encapsulates optimistic mutations, matrix calculations, and 
 * data caching strategies for the Attendance Matrix. Strictly uses React Query 
 * for data retrieval, completely bypassing legacy Context APIs.
 * @module panel/projects/ProjectEditorPanel/hooks/useAttendanceMatrix
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';
import { useProjectData } from '../../hooks/useProjectData';
import type { Artist, Participation } from '../../../../shared/types';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;

export interface AttendanceRecord {
    id: string | number;
    rehearsal: string;
    participation: string;
    status: AttendanceStatus;
}

export interface EnrichedParticipation extends Participation {
    artistData: Artist;
}

export const STATUS_CYCLE: AttendanceStatus[] = [null, 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export const useAttendanceMatrix = (projectId: string) => {
    const queryClient = useQueryClient();
    
    // FETCH CACHED DICTIONARIES (Instant access via React Query)
    const { 
        rehearsals, 
        participations, 
        artists, 
        isLoading: isProjectDataLoading 
    } = useProjectData(projectId);

    // FETCH MATRIX SPECIFIC DATA
    const { data: fetchedAttendances = [], isLoading: isLoadingAtt } = useQuery<AttendanceRecord[]>({
        queryKey: queryKeys.attendances.byProject(projectId),
        queryFn: async () => (await api.get<AttendanceRecord[]>(`/api/attendances/?rehearsal__project=${projectId}`)).data,
        staleTime: 60000,
        enabled: !!projectId
    });

    const isLoading = isProjectDataLoading || isLoadingAtt;

    const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
    const [mutatingCells, setMutatingCells] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (fetchedAttendances.length > 0) {
            setAttendances(fetchedAttendances);
        }
    }, [fetchedAttendances]);

    const projectRehearsals = useMemo(() => {
        return [...rehearsals].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    }, [rehearsals]);

    const enrichedParticipations = useMemo<EnrichedParticipation[]>(() => {
        if (!artists || artists.length === 0) return [];
        return participations
            .map(p => ({
                ...p,
                artistData: artists.find(a => String(a.id) === String(p.artist)) as Artist
            }))
            .filter(p => p.artistData)
            .sort((a, b) => a.artistData.last_name.localeCompare(b.artistData.last_name));
    }, [participations, artists]);

    const attendanceMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        attendances.forEach(a => map.set(`${a.rehearsal}-${a.participation}`, a));
        return map;
    }, [attendances]);

    const handleToggleStatus = useCallback(async (
        rehearsalId: string | number, 
        participationId: string | number, 
        currentRecord: AttendanceRecord | undefined
    ) => {
        const cellKey = `${rehearsalId}-${participationId}`;

        setMutatingCells(prev => {
            if (prev.has(cellKey)) return prev;
            const next = new Set(prev);
            next.add(cellKey);
            return next;
        });

        const currentStatus = currentRecord?.status || null;
        const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
        const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

        const tempId = currentRecord?.id || `temp-${Date.now()}`;
        const queryKeyTarget = queryKeys.attendances.byProject(projectId);

        const updateStateAndCache = (updater: (prev: AttendanceRecord[]) => AttendanceRecord[]) => {
            setAttendances(prev => {
                const nextState = updater(prev);
                queryClient.setQueryData(queryKeyTarget, nextState);
                return nextState;
            });
        };

        // Optimistic UI Update
        updateStateAndCache(prev => {
            const filtered = prev.filter(a => !(String(a.rehearsal) === String(rehearsalId) && String(a.participation) === String(participationId)));
            if (nextStatus === null) return filtered; 
            return [...filtered, { id: tempId, rehearsal: String(rehearsalId), participation: String(participationId), status: nextStatus }];
        });

        try {
            if (nextStatus === null && currentRecord?.id && !String(currentRecord.id).startsWith('temp')) {
                await api.delete(`/api/attendances/${currentRecord.id}/`);
            } else if (currentRecord?.id && !String(currentRecord.id).startsWith('temp')) {
                await api.patch(`/api/attendances/${currentRecord.id}/`, { status: nextStatus });
            } else {
                const res = await api.post('/api/attendances/', {
                    rehearsal: rehearsalId,
                    participation: participationId,
                    status: nextStatus
                });
                updateStateAndCache(prev => prev.map(a => a.id === tempId ? { ...a, id: res.data.id } : a));
            }
            // Invalidating to ensure server sync across other tabs
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeyTarget }),
                queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.byProject(projectId) }), 
            ]);
        } catch (error) {
            toast.error('Nie udało się zapisać zmiany.', { description: 'Sprawdź połączenie i spróbuj ponownie.' });
            // Rollback on Error
            updateStateAndCache(prev => {
                const filtered = prev.filter(a => a.id !== tempId);
                if (currentRecord) return [...filtered, currentRecord];
                return filtered;
            });
        } finally {
            setMutatingCells(prev => {
                const next = new Set(prev);
                next.delete(cellKey);
                return next;
            });
        }
    }, [projectId, queryClient]);

    return {
        isLoading,
        projectRehearsals,
        enrichedParticipations,
        attendanceMap,
        mutatingCells,
        handleToggleStatus
    };
};