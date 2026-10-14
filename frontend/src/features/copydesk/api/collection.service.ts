/**
 * @file collection.service.ts
 * @description Transport for the collection desk. Unlike the copy desk it writes
 * live data: a save reaches the public vault on the next uncached read of the
 * progress endpoint, with no review and no deploy in between.
 * @module features/copydesk/api/collection.service
 */

import api from "@/shared/api/api";
import type { CollectionDesk, CollectionWrite } from "../types/collection.dto";

export const COLLECTION_ENDPOINT = "/api/payments/collection/";

export const CollectionService = {
  getDesk: async (): Promise<CollectionDesk> => {
    const { data } = await api.get<CollectionDesk>(COLLECTION_ENDPOINT);
    return data;
  },

  /** Answers with the whole desk as it now stands, so the cache is replaced, not patched. */
  save: async (payload: CollectionWrite): Promise<CollectionDesk> => {
    const { data } = await api.patch<CollectionDesk>(
      COLLECTION_ENDPOINT,
      payload,
    );
    return data;
  },
};
