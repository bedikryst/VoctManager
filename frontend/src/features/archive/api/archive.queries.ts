/**
 * @file archive.queries.ts
 * @description TanStack Query hooks for the unified Archive domain.
 * One feature, one cache namespace. Edition mutations invalidate the pieces
 * list so newly-resolved pieces appear (and per-edition status badges live
 * in sync) without ever needing a manual refresh.
 *
 * In-progress edition list polls every 3s so the upload zone in Archive
 * shows AI extraction phases ticking through (EXTR → ENRI → GENR → AWAI).
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ArchiveService,
  type ActiveIngestion,
  type ScoreEditionDetail,
} from "./archive.service";
import {
  isIngestionInProgress,
  type Piece,
} from "@/shared/types";
import type {
  ComposerWriteDTO,
  PiecePatchDTO,
  PieceWriteDTO,
  ScoreEditionPatchDTO,
  ScoreEditionUploadDTO,
} from "../types/archive.dto";

export const archiveKeys = {
  pieces: {
    all: ["pieces"] as const,
    details: (id: string | number) => ["pieces", String(id)] as const,
  },
  composers: {
    all: ["composers"] as const,
  },
  tracks: {
    all: ["tracks"] as const,
    byPiece: (pieceId: string | number) =>
      ["tracks", { piece: String(pieceId) }] as const,
  },
  editions: {
    detail: (id: string) => ["editions", id] as const,
  },
};

const POLL_IN_PROGRESS_MS = 3_000;

// ===========================================================================
// Pieces
// ===========================================================================

const anyPieceIngesting = (pieces: Piece[] | undefined): boolean =>
  !!pieces?.some((p) =>
    p.editions?.some((e) => isIngestionInProgress(e.ingestion_status)),
  );

export const usePieces = () =>
  useQuery({
    queryKey: archiveKeys.pieces.all,
    queryFn: ArchiveService.getPieces,
    staleTime: 1000 * 60 * 5,
    refetchInterval: (query) =>
      anyPieceIngesting(query.state.data as Piece[] | undefined)
        ? POLL_IN_PROGRESS_MS
        : false,
  });

/**
 * Single-piece fetch for the dedicated review route. Polls when any edition
 * of this piece is still mid-pipeline so the conductor sees AI status flip
 * to AWAITING the moment it's ready to verify.
 */
export const usePiece = (id: string | null) =>
  useQuery({
    queryKey: id ? archiveKeys.pieces.details(id) : ["pieces", "none"],
    queryFn: () => ArchiveService.getPiece(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data as Piece | undefined;
      const anyInProgress = data?.editions?.some(
        (e) =>
          e.ingestion_status === "PEND" ||
          e.ingestion_status === "EXTR" ||
          e.ingestion_status === "ENRI" ||
          e.ingestion_status === "GENR",
      );
      return anyInProgress ? POLL_IN_PROGRESS_MS : false;
    },
  });

export const useComposers = () =>
  useQuery({
    queryKey: archiveKeys.composers.all,
    queryFn: ArchiveService.getComposers,
    staleTime: 1000 * 60 * 60,
  });

export const useCreatePiece = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PieceWriteDTO) => ArchiveService.createPiece(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useCreateComposer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ComposerWriteDTO) => ArchiveService.createComposer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.composers.all });
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

/**
 * Patch a Composer. Optimistically updates the composers list cache so
 * inline pencil edits land instantly; rolls back on server error and
 * invalidates pieces (composer info embeds in PieceSerializer responses).
 */
export const useUpdateComposer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof ArchiveService.updateComposer>[1];
    }) => ArchiveService.updateComposer(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: archiveKeys.composers.all });
      const previous = qc.getQueryData(archiveKeys.composers.all);
      qc.setQueryData<unknown>(archiveKeys.composers.all, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((c) =>
          (c as { id: string }).id === id ? { ...c, ...data } : c,
        );
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(archiveKeys.composers.all, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.composers.all });
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useDeleteComposer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.deleteComposer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.composers.all });
    },
  });
};

export const useMergeComposers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      targetId,
    }: {
      sourceId: string;
      targetId: string;
    }) => ArchiveService.mergeComposer(sourceId, targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.composers.all });
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useRefreshComposerFromMb = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.refreshComposerFromMb(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.composers.all });
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

/**
 * Update piece metadata. Optimistically merges the patch into the cached
 * pieces list so the conductor sees changes land instantly; rolls back on
 * server error.
 */
export const useUpdatePiece = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: PiecePatchDTO | PieceWriteDTO;
    }) => ArchiveService.updatePiece(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: archiveKeys.pieces.all });
      const previous = qc.getQueryData<Piece[]>(archiveKeys.pieces.all);
      if (previous) {
        qc.setQueryData<Piece[]>(
          archiveKeys.pieces.all,
          previous.map((p) =>
            String(p.id) === String(id) ? { ...p, ...data } : p,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(archiveKeys.pieces.all, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useDeletePiece = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.deletePiece(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      qc.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

// ===========================================================================
// Tracks
// ===========================================================================

export const useTracks = (pieceId: string | number) =>
  useQuery({
    queryKey: archiveKeys.tracks.byPiece(pieceId),
    queryFn: () => ArchiveService.getTracksByPiece(pieceId),
  });

export const useUploadTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pieceId,
      voiceLine,
      file,
    }: {
      pieceId: string | number;
      voiceLine: string;
      file: File;
    }) => ArchiveService.uploadTrack(pieceId, voiceLine, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      qc.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

export const useDeleteTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => ArchiveService.deleteTrack(trackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      qc.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

// ===========================================================================
// Score editions (PDF upload + AI workflow)
// ===========================================================================

/**
 * Upload a PDF, dispatch the AI pipeline server-side, optimistically
 * surface the new edition on the pieces list. After upload returns, the
 * list polling above keeps the per-edition ingestion_status fresh until
 * each edition reaches AWAITING / READY / FAILED.
 */
export const useUploadEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dto,
      onProgress,
    }: {
      dto: ScoreEditionUploadDTO;
      onProgress?: (loaded: number, total: number) => void;
    }) => ArchiveService.uploadEdition(dto, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      // Surface the new ingestion in the persistent "AI w toku" panel at once.
      qc.invalidateQueries({ queryKey: ["editions", "active"] });
    },
  });
};

/**
 * Every in-flight ingestion across the archive, polled. This is the durable,
 * refresh-proof source for the "AI w toku" panel: a freshly uploaded edition
 * isn't attached to a Piece until the resolver step, so it never appears in the
 * pieces list while processing, and a reload wipes the client-side upload row.
 * Polls faster while something is active, slower when idle.
 */
export const useActiveIngestions = () =>
  useQuery({
    queryKey: ["editions", "active"],
    queryFn: ArchiveService.getActiveEditions,
    refetchInterval: (query) => {
      const data = query.state.data as ActiveIngestion[] | undefined;
      return data && data.length > 0 ? 2000 : 5000;
    },
  });

export const usePatchEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ScoreEditionPatchDTO }) =>
      ArchiveService.patchEdition(id, dto),
    onMutate: async ({ id, dto }) => {
      await qc.cancelQueries({ queryKey: archiveKeys.pieces.all });
      const previous = qc.getQueryData<Piece[]>(archiveKeys.pieces.all);
      if (previous) {
        qc.setQueryData<Piece[]>(
          archiveKeys.pieces.all,
          previous.map((piece) => ({
            ...piece,
            editions: (piece.editions ?? []).map((e) =>
              String(e.id) === String(id) ? { ...e, ...dto } : e,
            ),
          })),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(archiveKeys.pieces.all, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useDeleteEdition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.deleteEdition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: archiveKeys.pieces.all }),
  });
};

export const useApproveEdition = () => {
  const qc = useQueryClient();
  return useMutation<ScoreEditionDetail, Error, string>({
    mutationFn: (id) => ArchiveService.approveEdition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: archiveKeys.pieces.all }),
  });
};

/**
 * Poll a single edition's ingestion state. Drives the live "what is the AI
 * doing?" line in the upload zone the moment a PDF is sent — without waiting for
 * the edition to be resolved onto a Piece and surface in the pieces list (which,
 * for a brand-new upload, only happens several seconds in, after the
 * MusicBrainz/Wikidata step). Stops polling once terminal (AWAI / RDY / FAIL).
 */
export const useEditionIngestion = (id: string | null) =>
  useQuery({
    queryKey: id ? archiveKeys.editions.detail(id) : ["editions", "none"],
    queryFn: () => ArchiveService.getEdition(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data as ScoreEditionDetail | undefined;
      if (!data) return POLL_IN_PROGRESS_MS;
      return isIngestionInProgress(data.ingestion_status)
        ? POLL_IN_PROGRESS_MS
        : false;
    },
  });

/** Unified live ingestion snapshot, sourced from SSE (or the poll fallback). */
export interface LiveIngestion {
  ingestion_status: import("@/shared/types").IngestionStatusCode;
  ingestion_progress: import("@/shared/types").IngestionProgressCode;
  ingestion_error: string;
  ingestion_cost_cents: number;
  ingestion_cost_cents_lifetime: number;
  page_count: number | null;
  piece_id: string | null;
}

const SSE_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Real-time ingestion progress for one edition, over Server-Sent Events.
 *
 * The browser holds a single open connection to the async Django endpoint and
 * receives a push the instant the worker writes a new step / cost / status —
 * including the "AI service busy, retrying" state during a 529 overload, so a
 * long-but-legitimate pause never looks like a freeze. The cookie JWT rides
 * along automatically (`withCredentials`). If SSE is unavailable (old browser,
 * proxy strips it), it transparently falls back to the 3s poll.
 *
 * Returns the latest snapshot, or null until the first event arrives.
 */
export const useLiveIngestion = (id: string | null): LiveIngestion | null => {
  const qc = useQueryClient();
  const [snapshot, setSnapshot] = useState<LiveIngestion | null>(null);
  const [streamFailed, setStreamFailed] = useState(false);

  useEffect(() => {
    setSnapshot(null);
    setStreamFailed(false);
    if (!id || typeof EventSource === "undefined") {
      if (id) setStreamFailed(true);
      return;
    }

    const es = new EventSource(
      `${SSE_BASE}/api/archive/editions/${id}/events/`,
      { withCredentials: true },
    );
    let gotData = false;

    const apply = (event: MessageEvent): void => {
      try {
        setSnapshot(JSON.parse(event.data) as LiveIngestion);
        gotData = true;
      } catch {
        /* ignore malformed frame */
      }
    };
    const finish = (): void => {
      es.close();
      // The resolved piece (and its new edition) now appears in the list.
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    };

    es.addEventListener("progress", apply as EventListener);
    es.addEventListener("done", ((e: MessageEvent) => {
      apply(e);
      finish();
    }) as EventListener);
    es.addEventListener("gone", finish);
    es.addEventListener("timeout", finish);
    es.onerror = (): void => {
      // Native EventSource auto-reconnects (the server re-primes current state
      // on reconnect). Only fall back to polling if we never received anything
      // — i.e. the endpoint is unreachable or auth was rejected.
      if (!gotData) setStreamFailed(true);
    };

    return () => es.close();
  }, [id, qc]);

  // Poll fallback — enabled only when SSE could not deliver.
  const poll = useEditionIngestion(streamFailed && id ? id : null);

  if (snapshot) return snapshot;
  if (streamFailed && poll.data) {
    const d = poll.data;
    return {
      ingestion_status: d.ingestion_status,
      ingestion_progress: d.ingestion_progress ?? "",
      ingestion_error: d.ingestion_error ?? "",
      ingestion_cost_cents: d.ingestion_cost_cents ?? 0,
      ingestion_cost_cents_lifetime: d.ingestion_cost_cents_lifetime ?? 0,
      page_count: d.page_count ?? null,
      piece_id: null,
    };
  }
  return null;
};

export const useReingestEdition = () => {
  const qc = useQueryClient();
  return useMutation<
    ScoreEditionDetail,
    Error,
    { id: string; force?: boolean }
  >({
    mutationFn: ({ id, force = false }) =>
      ArchiveService.reingestEdition(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: archiveKeys.pieces.all }),
  });
};
