/**
 * @file schedule.service.ts
 * @description Pure HTTP service for the Schedule domain.
 */

import api from '../../../shared/api/api';
import type {
    Attendance,
    PieceCasting,
    ProgramItem,
    Project,
    Participation,
    Rehearsal,
} from '../../../shared/types';
import type { ScheduleAttendanceReportDTO } from '../types/schedule.dto';

export const ScheduleService = {
    getRehearsals: async (): Promise<Rehearsal[]> => {
        const response = await api.get<Rehearsal[]>('/api/rehearsals/');
        return response.data;
    },

    getProjects: async (): Promise<Project[]> => {
        const response = await api.get<Project[]>('/api/projects/');
        return response.data;
    },

    getParticipationsByArtist: async (artistId: string | number): Promise<Participation[]> => {
        const response = await api.get<Participation[]>(`/api/participations/?artist=${artistId}`);
        return response.data;
    },

    getAttendancesByArtist: async (artistId: string | number): Promise<Attendance[]> => {
        const response = await api.get<Attendance[]>(`/api/attendances/?participation__artist=${artistId}`);
        return response.data;
    },

    getProgramItemsByProject: async (projectId: string | number): Promise<ProgramItem[]> => {
        const response = await api.get<ProgramItem[]>(`/api/program-items/?project=${projectId}`);
        return response.data;
    },

    getPieceCastingsByProjectPiece: async (
        projectId: string | number,
        pieceId: string | null,
    ): Promise<PieceCasting[]> => {
        if (!pieceId) {
            return [];
        }

        const response = await api.get<PieceCasting[]>(
            `/api/piece-castings/?piece=${pieceId}&participation__project=${projectId}`,
        );
        return response.data;
    },

    saveAttendanceReport: async (
        existingAttendanceId: string | undefined,
        payload: ScheduleAttendanceReportDTO,
    ): Promise<Attendance> => {
        if (existingAttendanceId) {
            const response = await api.patch<Attendance>(`/api/attendances/${existingAttendanceId}/`, payload);
            return response.data;
        }

        const response = await api.post<Attendance>('/api/attendances/', payload);
        return response.data;
    },

    exportCallSheet: async (projectId: string | number): Promise<Blob> => {
        const response = await api.get(`/api/projects/${projectId}/export_call_sheet/`, {
            responseType: 'blob',
        });

        return response.data as Blob;
    },
};
