/**
 * @file useSubmitVocalRange.ts
 * @description Sends the singer's proposal. The session user is not refreshed
 * here: the screen shows its own confirmation first, and refreshing would end
 * the prompt under it, so the screen refreshes when the singer leaves.
 * @module features/vocal-range/hooks/useSubmitVocalRange
 */

import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import type { VocalRangeSubmission } from "@/shared/lib/music/rangeDraft";

import { vocalRangeService } from "../api/vocalRange.service";

export const useSubmitVocalRange = (): UseMutationResult<
  void,
  unknown,
  VocalRangeSubmission
> =>
  useMutation<void, unknown, VocalRangeSubmission>({
    mutationFn: vocalRangeService.submit,
  });
