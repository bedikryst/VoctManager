/**
 * @file project.attendance.mutations.ts
 * @description React Query mutations a manager takes on a project's attendance
 * record outside the roll call: accepting a singer's reported absence from the
 * project's absence list.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastApiError } from "@/shared/api/errors";
import { PERSONAL_READMODEL_KEYS } from "@/shared/api/queryPolicy";

import type { Attendance } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";

interface AcceptAbsenceVariables {
  readonly projectId: string;
  readonly attendance: Attendance;
}

/**
 * Turns a reported absence into an excused one, keeping the singer's note.
 *
 * A POST to the create endpoint, not a PATCH of the row: the create is the
 * upsert the attendance service owns, and only the service tells the singer
 * they are excused. It tells them once — a second manager accepting the same
 * absence writes nothing new and sends nothing.
 */
export const useAcceptAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attendance }: AcceptAbsenceVariables) =>
      ProjectService.createAttendance({
        rehearsal: String(attendance.rehearsal),
        participation: String(attendance.participation),
        status: "EXCUSED",
        minutes_late: null,
        excuse_note: attendance.excuse_note ?? "",
      }),
    onMutate: async ({ projectId, attendance }) => {
      const queryKey = projectKeys.attendances.byProject(projectId);

      await queryClient.cancelQueries({ queryKey });

      const previousAttendances = queryClient.getQueryData<Attendance[]>(queryKey);

      queryClient.setQueryData<Attendance[]>(queryKey, (currentAttendances = []) =>
        currentAttendances.map((record) =>
          String(record.id) === String(attendance.id)
            ? { ...record, status: "EXCUSED" }
            : record,
        ),
      );

      return { previousAttendances };
    },
    onError: (error, { projectId }, context) => {
      toastApiError(error);
      if (context?.previousAttendances) {
        queryClient.setQueryData(
          projectKeys.attendances.byProject(projectId),
          context.previousAttendances,
        );
      }
    },
    onSettled: () => {
      // `attendances.all` prefixes every attendance read: the project's own and
      // the Rehearsals workspace's flat register.
      queryClient.invalidateQueries({ queryKey: projectKeys.attendances.all });
      // The singer's own schedule shows the evening as excused from now on.
      queryClient.invalidateQueries({
        queryKey: PERSONAL_READMODEL_KEYS.scheduleDashboard,
      });
    },
  });
};
