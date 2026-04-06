/**
 * @file rehearsals.queries.ts
 * @description React Query hooks for the Rehearsals domain.
 */

import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { RehearsalsService } from './rehearsals.service';
import type { AttendanceUpsertDTO } from '../types/rehearsals.dto';

const invalidateRehearsalsDomain = async (queryClient: ReturnType<typeof useQueryClient>): Promise<void> => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.attendances.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    ]);
};

export const useRehearsalsWorkspaceData = () => {
    const results = useQueries({
        queries: [
            { queryKey: queryKeys.projects.all, queryFn: RehearsalsService.getProjects },
            { queryKey: queryKeys.rehearsals.all, queryFn: RehearsalsService.getRehearsals },
            { queryKey: queryKeys.participations.all, queryFn: RehearsalsService.getParticipations },
            { queryKey: queryKeys.attendances.all, queryFn: RehearsalsService.getAttendances },
            { queryKey: queryKeys.artists.all, queryFn: RehearsalsService.getArtists },
        ],
    });

    return {
        projects: results[0].data || [],
        rehearsals: results[1].data || [],
        participations: results[2].data || [],
        attendances: results[3].data || [],
        artists: results[4].data || [],
        isLoading: results.some((query) => query.isLoading),
        isError: results.some((query) => query.isError),
    };
};

export const useUpsertAttendanceRecord = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id?: string; data: AttendanceUpsertDTO }) => {
            return id ? RehearsalsService.updateAttendance(id, data) : RehearsalsService.createAttendance(data);
        },
        onSuccess: async () => {
            await invalidateRehearsalsDomain(queryClient);
        },
    });
};

export const useDeleteAttendanceRecord = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => RehearsalsService.deleteAttendance(id),
        onSuccess: async () => {
            await invalidateRehearsalsDomain(queryClient);
        },
    });
};

export const useMarkMissingAttendancesPresent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (entries: Array<{ attendanceId?: string; rehearsalId: string; participationId: string }>) => {
            await Promise.all(
                entries.map((entry) => {
                    const payload: AttendanceUpsertDTO = {
                        rehearsal: entry.rehearsalId,
                        participation: entry.participationId,
                        status: 'PRESENT',
                        minutes_late: null,
                        excuse_note: null,
                    };

                    return entry.attendanceId
                        ? RehearsalsService.updateAttendance(entry.attendanceId, payload)
                        : RehearsalsService.createAttendance(payload);
                }),
            );
        },
        onSuccess: async () => {
            await invalidateRehearsalsDomain(queryClient);
        },
    });
};
