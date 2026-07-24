/**
 * @file artist.queries.ts
 * @description React Query hooks for Server State management.
 * Handles caching, background fetching, and optimistic updates.
 * Synchronized with the global Query Key Factory.
 * @architecture Enterprise SaaS 2026
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArtistService } from "./artist.service";
import { parseApiError } from "@/shared/api/errors";
import type { ArtistCreateDTO, ArtistUpdateDTO } from "../types/artist.dto";

export const artistKeys = {
  artists: {
    all: ["artists"] as const,
    // The archive-inclusive roster is a different result set, so it gets its own
    // key rather than overwriting the active list every other surface reads.
    // Nested under `all` so a single invalidation still refreshes both.
    withArchived: ["artists", "with-archived"] as const,
    details: (id: string | number) => ["artists", String(id)] as const,
    dossier: (id: string | number) =>
      ["artists", String(id), "dossier"] as const,
  },
};

export const useArtists = (includeArchived = false) => {
  return useQuery({
    queryKey: includeArchived
      ? artistKeys.artists.withArchived
      : artistKeys.artists.all,
    queryFn: includeArchived
      ? ArtistService.getAllIncludingArchived
      : ArtistService.getAll,
    staleTime: 1000 * 60 * 5,
  });
};

export const useArtistDossier = (id: string | null) => {
  return useQuery({
    queryKey: artistKeys.artists.dossier(id ?? "none"),
    queryFn: () => ArtistService.getDossier(id as string),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
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

/**
 * Re-sends the account-activation invite to an artist who never activated.
 * A successful resend stamps a fresh `activation_email_sent_at` server-side, so
 * we refetch the roster to surface that new send time on the card. The
 * `account_already_active` rejection is refetched too: it means the artist
 * activated in the gap since the roster was fetched, so our cached
 * `account_activated` is stale — refetching flips the card "pending" → "active".
 */
export const useResendActivation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArtistService.resendActivation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
    },
    onError: (error) => {
      if (parseApiError(error).code === "account_already_active") {
        queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
      }
    },
  });
};

export interface BulkToggleResult {
  total: number;
  failed: number;
}

/**
 * Archives or restores many artists in one gesture. Runs the per-artist calls in
 * parallel, tolerates partial failure (allSettled), and invalidates the roster
 * once at the end rather than per-item.
 */
export const useBulkToggleArtistStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      isActive,
    }: {
      ids: string[];
      isActive: boolean;
    }): Promise<BulkToggleResult> => {
      const results = await Promise.allSettled(
        ids.map((id) => ArtistService.toggleStatus(id, isActive)),
      );
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      return { total: ids.length, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistKeys.artists.all });
    },
  });
};
