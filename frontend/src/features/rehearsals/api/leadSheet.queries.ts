/**
 * @file leadSheet.queries.ts
 * @description The evening a stand-in was handed: who is expected, and who is
 * here. One server-joined read for the register itself; the ticks ride on the
 * flat `["attendances"]` cache every other rehearsal surface writes through, so
 * a tap is optimistic here for exactly the reason it is optimistic there.
 *
 * Two queries rather than one because they change on different clocks. The cast
 * is settled days ahead and is dead weight to refetch after every tap; the roll
 * call is rewritten forty times in ten minutes. Folding the register into the
 * read model would have made each tick re-fetch the choir.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/api
 */

import { useQuery } from "@tanstack/react-query";

import api from "@/shared/api/api";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import type { LeadSheet } from "../types/leadSheet.dto";

export const leadSheetKeys = {
  all: ["leadSheet"] as const,
  byRehearsal: (rehearsalId: string) => ["leadSheet", rehearsalId] as const,
};

/**
 * The evening, or nothing. A 404 here is the honest answer for an id that is not
 * this reader's to run — the server says nothing about whether it exists — so it
 * is NOT retried: a stand-in whose grant was revoked mid-rehearsal should see
 * the refusal once, not four times over eight seconds.
 */
export const useLeadSheet = (rehearsalId: string | undefined) =>
  useQuery({
    queryKey: leadSheetKeys.byRehearsal(rehearsalId ?? "none"),
    queryFn: async (): Promise<LeadSheet> => {
      const response = await api.get<LeadSheet>(
        `/api/rehearsals/${rehearsalId}/lead-sheet/`,
      );
      return response.data;
    },
    enabled: Boolean(rehearsalId),
    retry: false,
    ...RECONCILING_REFETCH,
  });
