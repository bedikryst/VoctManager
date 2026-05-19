/**
 * @file score-compiler.queries.ts
 * @description TanStack Query hooks for the Score Package Compiler.
 * In-progress editions auto-poll every 3 seconds so the conductor sees
 * status transitions live without a refresh.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/api/score-compiler.queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ScoreCompilerService } from "./score-compiler.service";
import {
  isIngestionInProgress,
  type PiecePatchDTO,
  type ScoreEditionDetailDTO,
  type ScoreEditionListDTO,
  type ScoreEditionPatchDTO,
  type ScoreEditionUploadDTO,
} from "../types/score-compiler.dto";

export const scoreCompilerKeys = {
  editions: {
    all: ["score-editions"] as const,
    details: (id: string) => ["score-editions", id] as const,
  },
};

const STALE_LIST_MS = 5_000;
const POLL_IN_PROGRESS_MS = 3_000;

// ===========================================================================
// Queries
// ===========================================================================

export const useScoreEditions = () =>
  useQuery({
    queryKey: scoreCompilerKeys.editions.all,
    queryFn: ScoreCompilerService.list,
    staleTime: STALE_LIST_MS,
    refetchInterval: (query) => {
      // If any edition is still mid-pipeline, poll the list endpoint;
      // otherwise stop polling until the user does something.
      const data = query.state.data as ScoreEditionListDTO[] | undefined;
      if (!data) return false;
      const anyInProgress = data.some((e) => isIngestionInProgress(e.ingestion_status));
      return anyInProgress ? POLL_IN_PROGRESS_MS : false;
    },
  });

export const useScoreEdition = (id: string | null) =>
  useQuery({
    queryKey: id ? scoreCompilerKeys.editions.details(id) : ["score-editions", "none"],
    queryFn: () => ScoreCompilerService.retrieve(id!),
    enabled: !!id,
    // Conductor is staring at this modal; window-focus refetches would
    // (a) pull a fresh edition every time they alt-tab to MusicBrainz to
    // verify a fact, and (b) compete with the dirty-aware form-sync logic
    // in ConductorReviewModal. The progress polling below covers
    // in-progress refresh needs.
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as ScoreEditionDetailDTO | undefined;
      if (!data) return false;
      return isIngestionInProgress(data.ingestion_status) ? POLL_IN_PROGRESS_MS : false;
    },
  });

// ===========================================================================
// Mutations — all invalidate the list; detail-affecting ones also update by ID
// ===========================================================================

export const useUploadScoreEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dto,
      onProgress,
    }: {
      dto: ScoreEditionUploadDTO;
      onProgress?: (loaded: number, total: number) => void;
    }) => ScoreCompilerService.upload(dto, onProgress),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all });
      qc.setQueryData(scoreCompilerKeys.editions.details(data.id), data);
    },
  });
};

export const usePatchScoreEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ScoreEditionPatchDTO }) =>
      ScoreCompilerService.patch(id, dto),
    onMutate: async ({ id, dto }) => {
      // Optimistic update on the detail cache — CLAUDE.md mandates this for mutations.
      await qc.cancelQueries({ queryKey: scoreCompilerKeys.editions.details(id) });
      const previous = qc.getQueryData<ScoreEditionDetailDTO>(
        scoreCompilerKeys.editions.details(id),
      );
      if (previous) {
        qc.setQueryData<ScoreEditionDetailDTO>(scoreCompilerKeys.editions.details(id), {
          ...previous,
          ...dto,
        });
      }
      return { previous };
    },
    onError: (_err, { id }, context) => {
      // Roll back on failure.
      if (context?.previous) {
        qc.setQueryData(scoreCompilerKeys.editions.details(id), context.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all });
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.details(id) });
    },
  });
};

export const useDeleteScoreEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ScoreCompilerService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all }),
  });
};

export const useApproveScoreEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ScoreCompilerService.approve(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all });
      qc.setQueryData(scoreCompilerKeys.editions.details(data.id), data);
    },
  });
};

export const useReingestScoreEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      ScoreCompilerService.reingest(id, force),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all });
      qc.setQueryData(scoreCompilerKeys.editions.details(data.id), data);
    },
  });
};

/**
 * Patch the embedded Piece of the currently-reviewed ScoreEdition.
 * Optimistically merges the patch into the cached edition detail so the
 * conductor sees their edits land instantly; rolls back on server error.
 *
 * `editionId` is the cache key — the actual PATCH targets the Piece by id.
 */
export const usePatchPiece = (editionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pieceId, dto }: { pieceId: string; dto: PiecePatchDTO }) =>
      ScoreCompilerService.patchPiece(pieceId, dto),
    onMutate: async ({ dto }) => {
      const key = scoreCompilerKeys.editions.details(editionId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ScoreEditionDetailDTO>(key);
      if (previous?.piece) {
        qc.setQueryData<ScoreEditionDetailDTO>(key, {
          ...previous,
          piece: { ...previous.piece, ...dto },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(
          scoreCompilerKeys.editions.details(editionId),
          context.previous,
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: scoreCompilerKeys.editions.details(editionId),
      });
      qc.invalidateQueries({ queryKey: scoreCompilerKeys.editions.all });
    },
  });
};
