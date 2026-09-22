/**
 * @file plan.queries.ts
 * @description React Query hooks for one rehearsal's plan: the editor's read,
 * the whole-list save, the per-row done tick and the announcement. Saving is
 * silent on the server and stays silent here — no toast says "the cast was
 * told", because it was not; `useAnnouncePlan` is the one act that tells them.
 * Every write settles by invalidating the rehearsal lists, the lead sheet and
 * the schedule dashboard, since all three embed the plan.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/api/plan.queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PERSONAL_READMODEL_KEYS } from "@/shared/api/queryPolicy";
import type { RehearsalPlanItem } from "@/shared/types";
import { leadSheetKeys } from "./leadSheet.queries";
import { rehearsalKeys } from "./rehearsals.queries";
import { RehearsalsService } from "./rehearsals.service";
import type { RehearsalPlanDTO, RehearsalPlanRead } from "../types/rehearsalPlan.dto";

const PLAN_STALE_TIME = 1000 * 30;

export const useRehearsalPlan = (rehearsalId: string | undefined) =>
  useQuery({
    queryKey: rehearsalKeys.rehearsals.plan(rehearsalId ?? "none"),
    queryFn: () => RehearsalsService.getPlan(rehearsalId ?? ""),
    enabled: Boolean(rehearsalId),
    staleTime: PLAN_STALE_TIME,
  });

/** The surfaces that embed the plan and must re-read after any plan write. */
const settlePlanReaders = async (
  queryClient: ReturnType<typeof useQueryClient>,
  rehearsalId: string,
): Promise<void> => {
  // `["rehearsals"]` is the root of the project hub's per-project lists too.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: rehearsalKeys.rehearsals.all }),
    queryClient.invalidateQueries({ queryKey: leadSheetKeys.byRehearsal(rehearsalId) }),
    queryClient.invalidateQueries({ queryKey: PERSONAL_READMODEL_KEYS.scheduleDashboard }),
  ]);
};

export const useSaveRehearsalPlan = (rehearsalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RehearsalPlanDTO) => RehearsalsService.savePlan(rehearsalId, data),
    onSuccess: (saved) => {
      queryClient.setQueryData<RehearsalPlanRead>(
        rehearsalKeys.rehearsals.plan(rehearsalId),
        saved,
      );
    },
    onSettled: () => settlePlanReaders(queryClient, rehearsalId),
  });
};

/**
 * The same whole-list save for a surface that writes to several evenings'
 * plans from one place (the project grid): the rehearsal travels with the
 * call. The promise settles only after the readers have re-read, so a caller
 * awaiting it sees the list as the server now has it.
 */
export const useSaveAnyRehearsalPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rehearsalId, data }: { rehearsalId: string; data: RehearsalPlanDTO }) =>
      RehearsalsService.savePlan(rehearsalId, data),
    onSuccess: (saved, { rehearsalId }) => {
      queryClient.setQueryData<RehearsalPlanRead>(
        rehearsalKeys.rehearsals.plan(rehearsalId),
        saved,
      );
    },
    onSettled: (_saved, _error, { rehearsalId }) => settlePlanReaders(queryClient, rehearsalId),
  });
};

/**
 * Writes the debrief's verdict on one row, always explicitly. Optimistic on
 * the plan query, so a checklist on a tablet answers on the tap: `done` is
 * what every surface reads, and the stamps mirror the server's rule that a
 * row holds at most one of them. The rehearsal lists reconcile on settle.
 */
export const useMarkPlanItem = (rehearsalId: string) => {
  const queryClient = useQueryClient();
  const planKey = rehearsalKeys.rehearsals.plan(rehearsalId);
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      RehearsalsService.markPlanItem(rehearsalId, itemId, done),
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: planKey });
      const previous = queryClient.getQueryData<RehearsalPlanRead>(planKey);
      if (previous) {
        const stamp = new Date().toISOString();
        queryClient.setQueryData<RehearsalPlanRead>(planKey, {
          ...previous,
          rows: previous.rows.map((row) =>
            row.id === itemId
              ? {
                  ...row,
                  done,
                  done_at: done ? stamp : null,
                  skipped_at: done ? null : stamp,
                }
              : row,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(planKey, context.previous);
    },
    onSuccess: (item: RehearsalPlanItem) => {
      queryClient.setQueryData<RehearsalPlanRead>(planKey, (current) =>
        current
          ? { ...current, rows: current.rows.map((row) => (row.id === item.id ? item : row)) }
          : current,
      );
    },
    onSettled: () => settlePlanReaders(queryClient, rehearsalId),
  });
};

export const useAnnouncePlan = (rehearsalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => RehearsalsService.announcePlan(rehearsalId),
    onSuccess: (announced) => {
      queryClient.setQueryData<RehearsalPlanRead>(
        rehearsalKeys.rehearsals.plan(rehearsalId),
        (current) =>
          current ? { ...current, plan_announced_at: announced.plan_announced_at } : current,
      );
    },
    onSettled: () => settlePlanReaders(queryClient, rehearsalId),
  });
};
