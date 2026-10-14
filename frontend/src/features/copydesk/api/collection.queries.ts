/**
 * @file collection.queries.ts
 * @description Cache key, read and save for the collection desk.
 * @module features/copydesk/api/collection.queries
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { MONEY_QUERY_OPTIONS } from "@/shared/api/queryPolicy";
import { CollectionService } from "./collection.service";
import type { CollectionDesk, CollectionWrite } from "../types/collection.dto";

export const collectionKeys = {
  desk: () => ["copydesk", "collection"] as const,
};

/**
 * The money tier: never persisted to the device's snapshot, and reconciled on
 * every mount and focus, because the gateway half moves whenever somebody pays
 * and a colleague may have saved a source in the meantime.
 *
 * `retry: false` for the reason the desk's own gate has it — the failure this
 * meets is a permission (the panel is staff only), and a refusal is final.
 */
export const useCollectionDesk = (): UseQueryResult<CollectionDesk> =>
  useQuery({
    queryKey: collectionKeys.desk(),
    queryFn: CollectionService.getDesk,
    retry: false,
    ...MONEY_QUERY_OPTIONS,
  });

/** The server answers a save with the whole desk, which replaces the cache entry. */
export const useSaveCollection = (): UseMutationResult<
  CollectionDesk,
  Error,
  CollectionWrite
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CollectionService.save,
    onSuccess: (desk) => {
      queryClient.setQueryData(collectionKeys.desk(), desk);
    },
  });
};
