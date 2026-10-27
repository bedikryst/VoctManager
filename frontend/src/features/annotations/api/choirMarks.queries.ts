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
 * wrong thing to the room it reaches. So their buttons are disabled offline,
 * and the writes run with `networkMode: "always"`: a press that meets no
 * network fails there and then, instead of pausing to fire on reconnect.
 * @module features/annotations/api
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { parseApiError, toastApiError } from "@/shared/api/errors";
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

/**
 * The press. Two refusals have words of their own: 429 is the cooldown, which
 * the button already shows, and 503 means the notice could not be handed on —
 * the server put its window back, so the same press may simply be repeated.
 * Every answer re-reads the news, which is what the button is drawn from.
 */
export const useNotifyChoir = (projectId: string | null) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => AnnotationsService.notifyChoir(projectId as string),
    networkMode: "always",
    onSuccess: ({ recipients }) => {
      toast.success(t("annotations.notify.sent", { count: recipients }));
    },
    onError: (error) => {
      const { status } = parseApiError(error);
      if (status === 503) {
        toast.error(t("annotations.notify.unavailable"));
        return;
      }
      if (status === 429) {
        toast.error(t("annotations.notify.cooling_down"));
        return;
      }
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

interface RestoreVariables {
  editionId: string;
  archivedAt: string;
}

/**
 * Set aside and restore. Either one changes what is on the page, so the
 * edition's list is re-read rather than patched: the server alone knows which
 * rows a set holds. Every project's news is re-read too, because a restored set
 * is news to the choir.
 *
 * The edition is a variable of each press, not of the hook: in the concert book
 * the reader can turn into the next piece while a set-aside is in flight, and
 * the re-read and `onReplaced` must reach the piece the press was made on.
 * `onReplaced` runs once the server has swapped that edition's marks.
 */
export const useSetAsideMutations = ({
  onReplaced,
}: {
  onReplaced?: (editionId: string) => void;
} = {}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reread = async (editionId: string): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: annotationKeys.byEdition(editionId) }),
      queryClient.invalidateQueries({ queryKey: choirMarkKeys.setAside(editionId) }),
      queryClient.invalidateQueries({ queryKey: choirMarkKeys.news }),
    ]);
  };

  const setAside = useMutation({
    mutationFn: (editionId: string) => AnnotationsService.setAside(editionId),
    networkMode: "always",
    onSuccess: ({ count }, editionId) => {
      onReplaced?.(editionId);
      toast.success(t("annotations.set_aside.done", { count }));
    },
    onError: (error) => {
      toastApiError(error, t);
    },
    onSettled: (_data, _error, editionId) => reread(editionId),
  });

  const restoreSet = useMutation({
    mutationFn: ({ editionId, archivedAt }: RestoreVariables) =>
      AnnotationsService.restoreSet(editionId, archivedAt),
    networkMode: "always",
    onSuccess: (count, { editionId }) => {
      onReplaced?.(editionId);
      toast.success(t("annotations.set_aside.restored", { count }));
    },
    onError: (error) => {
      toastApiError(error, t);
    },
    onSettled: (_data, _error, { editionId }) => reread(editionId),
  });

  return { setAside, restoreSet };
};
