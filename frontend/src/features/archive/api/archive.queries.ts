/**
 * @file archive.queries.ts
 * @description React Query hooks for the Archive domain server state.
 * Handles caching, invalidation, and write orchestration through global query keys.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ArchiveService } from "./archive.service";
import type { PieceWriteDTO } from "../types/archive.dto";

export const archiveKeys = {
  pieces: {
    all: ["pieces"] as const,
    details: (id: string | number) => ["pieces", String(id)] as const,
  },
  composers: {
    all: ["composers"] as const,
    details: (id: string | number) => ["composers", String(id)] as const,
  },
  tracks: {
    all: ["tracks"] as const,
    byPiece: (pieceId: string | number) =>
      ["tracks", { piece: String(pieceId) }] as const,
  },
};

export const usePieces = () => {
  return useQuery({
    queryKey: archiveKeys.pieces.all,
    queryFn: ArchiveService.getPieces,
    staleTime: 1000 * 60 * 5,
  });
};

export const useComposers = () => {
  return useQuery({
    queryKey: archiveKeys.composers.all,
    queryFn: ArchiveService.getComposers,
    staleTime: 1000 * 60 * 60,
  });
};

export const useCreatePiece = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceWriteDTO) => ArchiveService.createPiece(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useUpdatePiece = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PieceWriteDTO> }) =>
      ArchiveService.updatePiece(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: archiveKeys.pieces.all });
    },
  });
};

export const useDeletePiece = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ArchiveService.deletePiece(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      queryClient.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

export const useUploadTrack = () => {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      queryClient.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

export const useDeleteTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trackId: string) => ArchiveService.deleteTrack(trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: archiveKeys.pieces.all });
      queryClient.invalidateQueries({ queryKey: archiveKeys.tracks.all });
    },
  });
};

export const useTracks = (pieceId: string | number) => {
  return useQuery({
    queryKey: archiveKeys.tracks.byPiece(pieceId),
    queryFn: () => ArchiveService.getTracksByPiece(pieceId),
  });
};
