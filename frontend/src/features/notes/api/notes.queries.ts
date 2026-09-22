/**
 * @file notes.queries.ts
 * @description TanStack Query hooks for the private scratchpad, wired through
 * the existing offline write queue (`app/store/useOfflineStore.ts` +
 * `shared/offline/offlineClient.ts`) rather than a new one — see
 * `docs/specs/manager-notes-2026-09.md`.
 *
 * Two replay behaviours the server was measured doing shape this file:
 *
 *  1. A replayed POST for a note that already exists returns 201 with the
 *     STORED body, silently discarding a changed one. Create and a later body
 *     edit therefore MUST be separate queue entries — `dedupeKey` is
 *     `note:{id}:{field}`, so a body edit and a done toggle never collapse
 *     into each other, but repeated taps on the same toggle do, and neither
 *     ever collapses onto the create.
 *  2. A replayed POST for a note that has since been soft-deleted ALSO
 *     returns 201, for a row `GET /api/notes/` will never list. A 201 is
 *     therefore not a promise that the note is visible — `onSettled` always
 *     invalidates (when online) rather than trusting the mutation response,
 *     so the optimistic row is dropped the moment the list disagrees.
 * @module features/notes/api
 * @architecture Enterprise SaaS 2026
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import { isLikelyOfflineError } from "@/shared/offline/offlineClient";
import { useOfflineStore } from "@/app/store/useOfflineStore";
import { NotesService } from "./notes.service";
import type { Note, NoteCreateDTO } from "../types/notes.dto";

export const notesKeys = {
  all: ["notes"] as const,
};

const NOTES_URL = "/api/notes/";

const truncateLabel = (body: string): string =>
  body.length > 40 ? `${body.slice(0, 40)}…` : body;

interface MutationContext {
  readonly previous?: Note[];
}

/** Skips the reconciling refetch while offline — it would only fail. */
const settleNotes = (queryClient: ReturnType<typeof useQueryClient>) => (): void => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  void queryClient.invalidateQueries({ queryKey: notesKeys.all });
};

export const useNotes = () =>
  useQuery<Note[]>({
    queryKey: notesKeys.all,
    queryFn: NotesService.getNotes,
    ...RECONCILING_REFETCH,
  });

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  const onSettled = settleNotes(queryClient);

  return useMutation<Note, unknown, NoteCreateDTO, MutationContext>({
    mutationFn: (data) => NotesService.createNote(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: notesKeys.all });
      const previous = queryClient.getQueryData<Note[]>(notesKeys.all);
      const optimistic: Note = {
        id: data.id,
        body: data.body,
        is_done: false,
        done_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { previous };
    },
    onError: (error, data, context) => {
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "note",
          method: "POST",
          url: NOTES_URL,
          body: data,
          dedupeKey: `note:${data.id}:create`,
          label: `Notatka: ${truncateLabel(data.body)}`,
        });
        return;
      }
      if (context?.previous) queryClient.setQueryData(notesKeys.all, context.previous);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).map((note) => (note.id === created.id ? created : note)),
      );
    },
    onSettled,
  });
};

export const useUpdateNoteBody = () => {
  const queryClient = useQueryClient();
  const onSettled = settleNotes(queryClient);

  return useMutation<
    Note,
    unknown,
    { id: string; body: string },
    MutationContext
  >({
    mutationFn: ({ id, body }) => NotesService.updateBody(id, { body }),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: notesKeys.all });
      const previous = queryClient.getQueryData<Note[]>(notesKeys.all);
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).map((note) => (note.id === id ? { ...note, body } : note)),
      );
      return { previous };
    },
    onError: (error, { id, body }, context) => {
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "note",
          method: "PATCH",
          url: `${NOTES_URL}${id}/`,
          body: { body },
          dedupeKey: `note:${id}:body`,
          label: `Notatka: ${truncateLabel(body)}`,
        });
        return;
      }
      if (context?.previous) queryClient.setQueryData(notesKeys.all, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).map((note) => (note.id === updated.id ? updated : note)),
      );
    },
    onSettled,
  });
};

/**
 * The body edit as an editor can consume it: an offline write resolves rather
 * than rejects. `useUpdateNoteBody`'s `onError` has already put it in the
 * durable queue and kept the optimistic patch, so letting the promise reject
 * would make `InlineEditable` show a failure — and stay in edit mode — for a
 * change that is saved and will land. A genuine server rejection (a 400 on an
 * empty body, a 404 on someone else's note) still throws, which is the only
 * case whose message is worth showing.
 */
export const useSaveNoteBody = () => {
  const { mutateAsync } = useUpdateNoteBody();

  return useCallback(
    async (id: string, body: string): Promise<void> => {
      try {
        await mutateAsync({ id, body });
      } catch (error) {
        if (!isLikelyOfflineError(error)) throw error;
      }
    },
    [mutateAsync],
  );
};

export const useToggleNoteDone = () => {
  const queryClient = useQueryClient();
  const onSettled = settleNotes(queryClient);

  return useMutation<
    Note,
    unknown,
    { id: string; is_done: boolean; body: string },
    MutationContext
  >({
    mutationFn: ({ id, is_done }) => NotesService.updateDone(id, { is_done }),
    onMutate: async ({ id, is_done }) => {
      await queryClient.cancelQueries({ queryKey: notesKeys.all });
      const previous = queryClient.getQueryData<Note[]>(notesKeys.all);
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).map((note) => (note.id === id ? { ...note, is_done } : note)),
      );
      return { previous };
    },
    onError: (error, { id, is_done, body }, context) => {
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "note",
          method: "PATCH",
          url: `${NOTES_URL}${id}/`,
          body: { is_done },
          dedupeKey: `note:${id}:is_done`,
          label: `Notatka: ${truncateLabel(body)}`,
        });
        return;
      }
      if (context?.previous) queryClient.setQueryData(notesKeys.all, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).map((note) => (note.id === updated.id ? updated : note)),
      );
    },
    onSettled,
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  const onSettled = settleNotes(queryClient);

  return useMutation<void, unknown, { id: string; body: string }, MutationContext>({
    mutationFn: ({ id }) => NotesService.deleteNote(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: notesKeys.all });
      const previous = queryClient.getQueryData<Note[]>(notesKeys.all);
      queryClient.setQueryData<Note[]>(notesKeys.all, (current) =>
        (current ?? []).filter((note) => note.id !== id),
      );
      return { previous };
    },
    onError: (error, { id, body }, context) => {
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "note",
          method: "DELETE",
          url: `${NOTES_URL}${id}/`,
          body: undefined,
          dedupeKey: `note:${id}:delete`,
          label: `Notatka: usunięcie — ${truncateLabel(body)}`,
        });
        return;
      }
      if (context?.previous) queryClient.setQueryData(notesKeys.all, context.previous);
    },
    onSettled,
  });
};
