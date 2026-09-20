/**
 * @file project.delegates.ts
 * @description The project's assistant conductors — who may run its rehearsals
 * besides a manager — read, granted, narrowed and ended, plus the one the add
 * form should suggest. The file and the URL keep the model's name
 * (`RehearsalDelegate`); people read it as "Asystent dyrygenta".
 *
 * Deliberately not optimistic. Every other list in this hub updates under the
 * hand because a wrong guess costs a flicker; here a row that appears before the
 * server agreed would tell a conductor he has handed over his markings when he
 * has not. The write is small and rare, so it can afford to wait for the answer.
 *
 * A grant also changes what a DIFFERENT person's browser is allowed to fetch, at
 * URLs this client has no say over — see `invalidateDelegationReach` for the half
 * of that problem this side can actually solve.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/api";
import { toastApiError } from "@/shared/api/errors";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";

/** One live delegation, as the manager's list reads it. */
export interface RehearsalDelegate {
  id: string;
  artist: string;
  artist_name: string;
  artist_voice_display: string;
  can_see_leader_marks: boolean;
  can_take_roll_call: boolean;
  can_open_materials: boolean;
  /** Writes the choir's own layer on this project's music. Off by default. */
  can_mark_for_choir: boolean;
  /** ISO instant, or null for "until the project closes". */
  expires_at: string | null;
  note: string;
  granted_by_name: string;
  created_at: string;
}

export interface DelegateGrantInput {
  artist: string;
  can_see_leader_marks: boolean;
  can_take_roll_call: boolean;
  can_open_materials: boolean;
  can_mark_for_choir: boolean;
  expires_at: string | null;
  note: string;
}

export type DelegateScopePatch = Partial<
  Pick<
    RehearsalDelegate,
    | "can_see_leader_marks"
    | "can_take_roll_call"
    | "can_open_materials"
    | "can_mark_for_choir"
    | "expires_at"
    | "note"
  >
>;

const delegatesUrl = (projectId: string): string =>
  `/api/projects/${projectId}/delegates/`;

export const useProjectDelegates = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.delegates.byProject(projectId),
    queryFn: async (): Promise<RehearsalDelegate[]> => {
      const response = await api.get<RehearsalDelegate[]>(delegatesUrl(projectId));
      return response.data;
    },
    enabled: Boolean(projectId) && enabled,
    ...RECONCILING_REFETCH,
  });

/** `{ artist }` from `GET …/delegates/suggested/`: null when nobody fits. */
interface SuggestedLeaderResponse {
  artist: string | null;
}

/**
 * Who the add form pre-selects: the most recently appointed leader anywhere,
 * unless they already lead this project. A suggestion the manager confirms with
 * a click — reading it grants nothing. Keyed under the delegates list so a
 * grant or a revocation refreshes it with the list.
 */
export const useSuggestedLeader = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.delegates.suggested(projectId),
    queryFn: async (): Promise<string | null> => {
      const response = await api.get<SuggestedLeaderResponse>(
        `${delegatesUrl(projectId)}suggested/`,
      );
      return response.data.artist;
    },
    enabled: Boolean(projectId) && enabled,
    ...RECONCILING_REFETCH,
  });

/**
 * What a grant or a revocation invalidates BESIDES the list itself.
 *
 * The annotation cache is the one that matters. `GET /api/archive/annotations/`
 * is answered per reader, and a delegation changes that answer at a URL nobody
 * navigated to — so a manager who is also reading the score keeps whatever their
 * last fetch returned until something drops it. The stand-in's own copy is a
 * separate problem this client cannot reach; their poll of the mark fingerprint
 * moves when the grant lands, which is what brings the new layer down to them.
 */
const invalidateDelegationReach = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
): void => {
  void queryClient.invalidateQueries({
    queryKey: projectKeys.delegates.byProject(projectId),
  });
  void queryClient.removeQueries({ queryKey: ["annotations"] });
};

export const useGrantDelegate = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DelegateGrantInput): Promise<RehearsalDelegate> => {
      const response = await api.post<RehearsalDelegate>(
        delegatesUrl(projectId),
        input,
      );
      return response.data;
    },
    onError: (error) => toastApiError(error),
    onSuccess: () => invalidateDelegationReach(queryClient, projectId),
  });
};

export const useUpdateDelegate = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: DelegateScopePatch;
    }): Promise<RehearsalDelegate> => {
      const response = await api.patch<RehearsalDelegate>(
        `${delegatesUrl(projectId)}${id}/`,
        patch,
      );
      return response.data;
    },
    onError: (error) => toastApiError(error),
    onSuccess: () => invalidateDelegationReach(queryClient, projectId),
  });
};

export const useRevokeDelegate = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`${delegatesUrl(projectId)}${id}/`);
    },
    onError: (error) => toastApiError(error),
    onSuccess: () => invalidateDelegationReach(queryClient, projectId),
  });
};
