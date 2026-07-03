/**
 * @file annotations.queries.ts
 * @description React Query hooks for score annotations. Create / update / delete
 * patch the per-edition cache optimistically so a pen stroke, edited note or
 * erased mark answers the conductor's hand with zero latency, rolling back on
 * server rejection.
 * @module features/annotations/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AnnotationsService } from "./annotations.service";
import type {
  AnnotationPatch,
  NewAnnotation,
  ScoreAnnotation,
} from "../types/annotations.dto";

export const annotationKeys = {
  all: ["annotations"] as const,
  byEdition: (editionId: string) =>
    [...annotationKeys.all, editionId] as const,
};

export const useScoreAnnotations = (editionId: string | null) =>
  useQuery({
    queryKey: annotationKeys.byEdition(editionId ?? "none"),
    queryFn: () => AnnotationsService.list(editionId as string),
    enabled: !!editionId,
    staleTime: 1000 * 30,
  });

let tempCounter = 0;
const nextTempId = (): string => `temp-${Date.now()}-${tempCounter++}`;

interface AnnotationMutationOptions {
  /**
   * Which cached rows a `clear` wipes optimistically. Must mirror the server's
   * role-aware clear scope (managers: shared+conductor; choristers: their own
   * personal layer) or the optimistic cache would drop marks that survive.
   */
  isCleared?: (annotation: ScoreAnnotation) => boolean;
}

/**
 * Create / update / delete mutations scoped to one edition's cache. Returned
 * handlers reconcile against the server response (create swaps the temp row,
 * update merges fields, delete is idempotent).
 */
export const useAnnotationMutations = (
  editionId: string | null,
  options?: AnnotationMutationOptions,
) => {
  const queryClient = useQueryClient();
  const key = annotationKeys.byEdition(editionId ?? "none");
  const isCleared = options?.isCleared ?? (() => true);

  const create = useMutation({
    mutationFn: (payload: NewAnnotation) => AnnotationsService.create(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot =
        queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      const optimistic: ScoreAnnotation = {
        ...payload,
        id: nextTempId(),
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ScoreAnnotation[]>(key, [
        ...snapshot,
        optimistic,
      ]);
      return { snapshot, tempId: optimistic.id };
    },
    onError: (_err, _payload, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
    onSuccess: (created, _payload, context) => {
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((a) =>
          a.id === context?.tempId ? created : a,
        ),
      );
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AnnotationPatch }) =>
      AnnotationsService.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot =
        queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((a) =>
          a.id === id
            ? { ...a, ...patch, updated_at: new Date().toISOString() }
            : a,
        ),
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((a) => (a.id === updated.id ? updated : a)),
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => AnnotationsService.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot =
        queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(
        key,
        snapshot.filter((a) => a.id !== id),
      );
      return { snapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
  });

  const clear = useMutation({
    mutationFn: () => AnnotationsService.clear(editionId as string),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot =
        queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(
        key,
        snapshot.filter((a) => !isCleared(a)),
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
  });

  return { create, update, remove, clear };
};
