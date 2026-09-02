/**
 * @file copydesk.queries.ts
 * @description Cache keys and reads for the copy desk.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/api/copydesk.queries
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import { CopyDeskService } from "./copydesk.service";
import type { CopyDeskContents } from "../types/copydesk.dto";

export const copyDeskKeys = {
  root: ["copydesk"] as const,
  contents: () => ["copydesk", "contents"] as const,
};

/**
 * Counts move whenever another editor writes, whenever the reviewer settles
 * something, and whenever `copy:sync` refreshes the mirror — none of which this
 * session can see happen. Short staleness plus the reconciling tier, so a desk
 * left open over a sitting reports the corpus as it now stands.
 */
const CONTENTS_STALE = 60 * 1000;

/**
 * The desk's gate as well as its first read: the shell asks this once, and the
 * 403 it can answer with IS the refusal screen. Both pages then read the same
 * cache entry rather than asking again.
 *
 * `retry: false` because the failure this actually meets is a permission, and a
 * refusal is final — three more attempts change nothing and delay the screen
 * that explains it. A network failure keeps its own recovery (the refetch
 * offered beside the error).
 */
export const useCopyDeskContents = (): UseQueryResult<CopyDeskContents> =>
  useQuery({
    queryKey: copyDeskKeys.contents(),
    queryFn: CopyDeskService.getContents,
    staleTime: CONTENTS_STALE,
    retry: false,
    ...RECONCILING_REFETCH,
  });
