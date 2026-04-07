/**
 * @file archive.queries.ts
 * @description React Query hooks for the Archive domain Server State management.
 * Handles caching, background fetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveService } from "./archive.service";
import type { PieceWriteDTO } from "../types/archive.dto";

export const ARCHIVE_QUERY_KEYS = {
  pieces: ["archive", "pieces"] as const,
  composers: ["archive", "composers"] as const,
};

export const usePieces = () => {
  return useQuery({
    queryKey: ARCHIVE_QUERY_KEYS.pieces,
    queryFn: ArchiveService.getPieces,
    staleTime: 1000 * 60 * 5,
  });
};

export const useComposers = () => {
  return useQuery({
    queryKey: ARCHIVE_QUERY_KEYS.composers,
    queryFn: ArchiveService.getComposers,
    staleTime: 1000 * 60 * 60, // Composers rarely change
  });
};

export const useCreatePiece = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PieceWriteDTO) => ArchiveService.createPiece(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEYS.pieces });
    },
  });
};

export const useUpdatePiece = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PieceWriteDTO> }) =>
      ArchiveService.updatePiece(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEYS.pieces });
    },
  });
};

export const useDeletePiece = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.deletePiece(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEYS.pieces });
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
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEYS.pieces }); // Odświeża utwory i ich podpięte tracki
    },
  });
};

export const useDeleteTrack = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => ArchiveService.deleteTrack(trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEYS.pieces });
    },
  });
};

export const useTracks = (pieceId: string | number) => {
  return useQuery({
    queryKey: [...ARCHIVE_QUERY_KEYS.pieces, "tracks", pieceId],
    queryFn: () => ArchiveService.getTracksByPiece(pieceId),
  });
};
