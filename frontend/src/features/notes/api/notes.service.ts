/**
 * @file notes.service.ts
 * @description HTTP layer for the private scratchpad. No pagination (retention
 * bounds the list server-side) and no PUT (`backend/core/views.py::NoteViewSet`
 * drops it from `http_method_names`).
 * @module features/notes/api
 * @architecture Enterprise SaaS 2026
 */

import api from "@/shared/api/api";
import type {
  Note,
  NoteBodyPatchDTO,
  NoteCreateDTO,
  NoteDonePatchDTO,
} from "../types/notes.dto";

const NOTES_URL = "/api/notes/";

export const NotesService = {
  getNotes: async (): Promise<Note[]> => {
    const response = await api.get<Note[]>(NOTES_URL);
    return response.data;
  },
  createNote: async (data: NoteCreateDTO): Promise<Note> => {
    const response = await api.post<Note>(NOTES_URL, data);
    return response.data;
  },
  updateBody: async (id: string, data: NoteBodyPatchDTO): Promise<Note> => {
    const response = await api.patch<Note>(`${NOTES_URL}${id}/`, data);
    return response.data;
  },
  updateDone: async (id: string, data: NoteDonePatchDTO): Promise<Note> => {
    const response = await api.patch<Note>(`${NOTES_URL}${id}/`, data);
    return response.data;
  },
  deleteNote: async (id: string): Promise<void> => {
    await api.delete(`${NOTES_URL}${id}/`);
  },
};
