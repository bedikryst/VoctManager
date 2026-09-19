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
 *
 * The writes live here too — the evening's plan before, the debrief after —
 * because they are the only things on the sheet a leader may change, and the
 * server answers each with the sheet.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/api";
import {
  PERSONAL_READMODEL_KEYS,
  RECONCILING_REFETCH,
} from "@/shared/api/queryPolicy";

import type { LeadSheet } from "../types/leadSheet.dto";
import { rehearsalKeys } from "./rehearsals.queries";

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

/**
 * One field per call: the server routes the plan to the cast's change diff and
 * the debrief to the managers, and a patch naming neither is refused.
 */
export type LeadSheetPatch = { focus: string } | { debrief: string };

/**
 * The leader's writes on the evening: what it is about, and how it went. The
 * server answers with the whole sheet, which lands in the cache directly —
 * nothing to refetch for the page itself. The schedule and the rehearsal lists
 * carry the same `focus` and `debrief` on their own cards, so they are
 * invalidated rather than patched: the cast reads the plan from three surfaces
 * and the manager reads the debrief in the workspace, and all must agree.
 */
export const useUpdateLeadSheet = (rehearsalId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: LeadSheetPatch): Promise<LeadSheet> => {
      const response = await api.patch<LeadSheet>(
        `/api/rehearsals/${rehearsalId}/lead-sheet/`,
        patch,
      );
      return response.data;
    },
    onSuccess: (sheet) => {
      if (!rehearsalId) return;
      queryClient.setQueryData(leadSheetKeys.byRehearsal(rehearsalId), sheet);
      void queryClient.invalidateQueries({
        queryKey: PERSONAL_READMODEL_KEYS.scheduleDashboard,
      });
      void queryClient.invalidateQueries({
        queryKey: rehearsalKeys.rehearsals.all,
      });
    },
  });
};
