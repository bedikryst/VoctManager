/**
 * @file artist.queries.ts
 * @description React Query hooks for Server State management.
 * Handles caching, background fetching, and optimistic updates.
 * Synchronized with the global Query Key Factory.
 * @architecture Enterprise SaaS 2026
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArtistService } from "./artist.service";
import type { ArtistCreateDTO, ArtistUpdateDTO } from "../types/artist.dto";

export const artistKeys = {
  artists: {
    all: ["artists"] as const,
    details: (id: string | number) => ["artists", String(id)] as const,
  },
};

export const useArtists = () => {
  return useQuery({
    queryKey: artistKeys.artists.all,
    queryFn: ArtistService.getAll,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

export const useCreateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ArtistCreateDTO) => ArtistService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
    },
  });
};

export const useUpdateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ArtistUpdateDTO }) =>
      ArtistService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
    },
  });
};

export const useToggleArtistStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ArtistService.toggleStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
    },
  });
};
