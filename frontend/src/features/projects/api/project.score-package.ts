/**
 * @file project.score-package.ts
 * @description React Query state + mutations for the concert score-book generator.
 * Polls while the async build is queued/running, persists per-item cockpit
 * overrides with optimistic UI, and surfaces the result for download.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toastApiError } from "@/shared/api/errors";

import { projectKeys } from "./project.query-keys";
import { ProjectService } from "./project.service";
import type {
  ScorePackageConfig,
  ScorePackageItem,
  ScorePackageItemPatch,
  ScorePackageState,
} from "./project.service";

const ACTIVE_STATUSES: ReadonlySet<ScorePackageState["status"]> = new Set([
  "QUED",
  "BLDG",
]);

/** Read the build state, polling every 2.5s while an assembly is queued or building. */
export const useScorePackageState = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.scorePackage.byProject(projectId),
    queryFn: () => ProjectService.getScorePackageState(projectId),
    enabled: Boolean(projectId) && enabled,
    refetchInterval: (query) =>
      ACTIVE_STATUSES.has(query.state.data?.status ?? "IDLE") ? 2500 : false,
  });

/**
 * Page thumbnails of an item's resolved edition, for visual page-range trimming.
 * The bytes are immutable per edition (server caches by content hash), so the
 * query never goes stale; it is fetched lazily — only when the row is expanded —
 * and excluded from localStorage persistence (`meta.persist: false`) so the heavy
 * base64 strip never bloats the offline cache.
 */
export const useScorePackageThumbnails = (
  projectId: string,
  itemId: string,
  editionId: string | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: projectKeys.scorePackage.thumbnails(projectId, itemId, editionId),
    queryFn: () => ProjectService.fetchScorePackageThumbnails(projectId, itemId),
    enabled: Boolean(projectId) && Boolean(itemId) && enabled,
    staleTime: Infinity,
    meta: { persist: false },
  });

/** Queue a (re)assembly; the returned QUEUED state immediately resumes polling. */
export const useGenerateScorePackage = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config?: Partial<ScorePackageConfig>) =>
      ProjectService.generateScorePackage(projectId, config),
    onSuccess: (state) => {
      queryClient.setQueryData(
        projectKeys.scorePackage.byProject(projectId),
        state,
      );
    },
  });
};

/** Persist a global layout setting with optimistic UI + rollback. */
export const useUpdateScorePackageConfig = (projectId: string) => {
  const queryClient = useQueryClient();
  const key = projectKeys.scorePackage.byProject(projectId);

  return useMutation({
    mutationFn: (patch: Partial<ScorePackageConfig>) =>
      ProjectService.updateScorePackageConfig(projectId, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ScorePackageState>(key);
      if (previous) {
        queryClient.setQueryData<ScorePackageState>(key, {
          ...previous,
          config: { ...previous.config, ...patch },
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      // The optimistic toggle just snapped back; tell the user why instead of
      // leaving them with a control that silently reverted.
      toastApiError(error);
    },
    onSuccess: (state) => {
      queryClient.setQueryData(key, state);
    },
  });
};

interface ItemMutationArgs {
  itemId: string;
  patch: Partial<ScorePackageItemPatch>;
}

/** Merge the directly-edited fields onto an item so controls feel instant;
 * server-derived fields (readiness, resolved edition) are corrected on success. */
const applyOptimisticPatch = (
  item: ScorePackageItem,
  patch: Partial<ScorePackageItemPatch>,
): ScorePackageItem => {
  const { score_edition_id, ...rest } = patch;
  const next: ScorePackageItem = { ...item, ...rest };
  if ("score_edition_id" in patch) {
    next.explicit_edition_id = score_edition_id ?? null;
  }
  return next;
};

/** Persist one program item's cockpit overrides with optimistic UI + rollback. */
export const useUpdateScorePackageItem = (projectId: string) => {
  const queryClient = useQueryClient();
  const key = projectKeys.scorePackage.byProject(projectId);

  return useMutation({
    mutationFn: ({ itemId, patch }: ItemMutationArgs) =>
      ProjectService.updateScorePackageItem(projectId, itemId, patch),
    onMutate: async ({ itemId, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ScorePackageState>(key);
      if (previous) {
        queryClient.setQueryData<ScorePackageState>(key, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === itemId ? applyOptimisticPatch(item, patch) : item,
          ),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      // Surface the server's validation reason (bad page range, foreign edition)
      // — otherwise the field just reverts and the cockpit looks broken.
      toastApiError(error);
    },
    onSuccess: (state) => {
      queryClient.setQueryData(key, state);
    },
  });
};
