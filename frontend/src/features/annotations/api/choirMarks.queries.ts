/**
 * @file choirMarks.queries.ts
 * @description The two manager gestures over the choir's marks as a whole, as
 * opposed to the per-mark writes in `annotations.queries.ts`:
 *
 * - **Powiadom chór** (project-scoped): which pieces carry choir marks the cast
 *   has not been told about, and the press that tells them. The choir is never
 *   told on its own, so this is the only door.
 * - **Odłóż uwagi** (edition-scoped): put last season's marks away without
 *   erasing them, list the sets put away, and bring one back.
 *
 * Both are online-only. Neither goes through the offline queue: a notice sent
 * late, or a set-aside replayed after the conductor drew on, would each do the
 * wrong thing to the room it reaches.
 * @module features/annotations/api
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { AnnotationsService } from "./annotations.service";
import { annotationKeys } from "./annotations.queries";
import { choirMarkKeys } from "./choirMarkKeys";

/**
 * What "Powiadom chór" would send now. `enabled` belongs to the caller, who
 * knows whether the reader may press it: the server answers 403 to anyone else.
 */
export const useMarksNews = (projectId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: choirMarkKeys.newsFor(projectId ?? "none"),
    queryFn: () => AnnotationsService.marksNews(projectId as string),
    enabled: enabled && !!projectId,
    ...RECONCILING_REFETCH,
  });

export const useNotifyChoir = (projectId: string | null) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => AnnotationsService.notifyChoir(projectId as string),
    onSuccess: ({ recipients }) => {
      toast.success(t("annotations.notify.sent", { count: recipients }));
    },
    onError: (error) => {
      toastApiError(error, t);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: choirMarkKeys.newsFor(projectId ?? "none"),
      }),
  });
};

/** The sets put aside on one edition. Managers only; `enabled` is theirs to pass. */
export const useSetAsideSets = (editionId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: choirMarkKeys.setAside(editionId ?? "none"),
    queryFn: () => AnnotationsService.setAsideSets(editionId as string),
    enabled: enabled && !!editionId,
    ...RECONCILING_REFETCH,
  });

/**
 * Set aside and restore. Either one changes what is on the page, so the
 * edition's list is re-read rather than patched: the server alone knows which
 * rows a set holds. Every project's news is re-read too, because a restored set
 * is news to the choir.
 */
export const useSetAsideMutations = (editionId: string | null) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reread = async (): Promise<void> => {
    if (!editionId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: annotationKeys.byEdition(editionId) }),
      queryClient.invalidateQueries({ queryKey: choirMarkKeys.setAside(editionId) }),
      queryClient.invalidateQueries({ queryKey: choirMarkKeys.news }),
    ]);
  };

  const setAside = useMutation({
    mutationFn: () => AnnotationsService.setAside(editionId as string),
    onSuccess: ({ count }) => {
      toast.success(t("annotations.set_aside.done", { count }));
    },
    onError: (error) => {
      toastApiError(error, t);
    },
    onSettled: reread,
  });

  const restoreSet = useMutation({
    mutationFn: (archivedAt: string) =>
      AnnotationsService.restoreSet(editionId as string, archivedAt),
    onSuccess: (count) => {
      toast.success(t("annotations.set_aside.restored", { count }));
    },
    onError: (error) => {
      toastApiError(error, t);
    },
    onSettled: reread,
  });

  return { setAside, restoreSet };
};
