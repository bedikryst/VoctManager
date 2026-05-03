/**
 * @file useCrewAssignments.ts
 * @description Encapsulates mutation logic and state management for crew assignments.
 * Extracts dictionaries from project queries and delegates writes to the Project domain layer.
 * @module panel/projects/ProjectEditorPanel/hooks/useCrewAssignments
 */

import {
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type { Collaborator, CrewAssignment } from "@/shared/types";
import {
  useCreateCrewAssignment,
  useDeleteCrewAssignment,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
} from "../../api/project.queries";

export interface UseCrewAssignmentsResult {
  isMutating: boolean;
  selectedCrewId: string;
  setSelectedCrewId: Dispatch<SetStateAction<string>>;
  roleDesc: string;
  setRoleDesc: Dispatch<SetStateAction<string>>;
  availableCrew: Collaborator[];
  projectAssignments: CrewAssignment[];
  crewMap: Map<string, Collaborator>;
  handleAssign: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleRemove: (id: string) => Promise<void>;
}

export const useCrewAssignments = (
  projectId: string,
): UseCrewAssignmentsResult => {
  const { t } = useTranslation();

  const collaboratorsQuery = useProjectCollaboratorsDictionary();
  const crewAssignmentsQuery = useProjectCrewAssignments(projectId);
  const collaborators: Collaborator[] = collaboratorsQuery.data ?? [];
  const crewAssignments: CrewAssignment[] = crewAssignmentsQuery.data ?? [];

  const createCrewAssignmentMutation = useCreateCrewAssignment(projectId);
  const deleteCrewAssignmentMutation = useDeleteCrewAssignment(projectId);

  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [roleDesc, setRoleDesc] = useState("");

  const projectAssignments = useMemo<CrewAssignment[]>(
    () =>
      crewAssignments.filter(
        (assignment) => String(assignment.project) === String(projectId),
      ),
    [crewAssignments, projectId],
  );

  const assignedCrewIds = useMemo(
    () =>
      new Set(
        projectAssignments.map((assignment) => String(assignment.collaborator)),
      ),
    [projectAssignments],
  );

  const availableCrew = useMemo(
    () =>
      collaborators.filter(
        (collaborator) => !assignedCrewIds.has(String(collaborator.id)),
      ),
    [assignedCrewIds, collaborators],
  );

  const crewMap = useMemo(
    () =>
      new Map(
        collaborators.map((collaborator) => [
          String(collaborator.id),
          collaborator,
        ]),
      ),
    [collaborators],
  );

  const handleAssign = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!selectedCrewId) {
      return;
    }

    const toastId = toast.loading(
      t("projects.crew.toast.assigning", "Przypisywanie członka ekipy..."),
    );

    try {
      await createCrewAssignmentMutation.mutateAsync({
        project: projectId,
        collaborator: selectedCrewId,
        role_description: roleDesc,
      });

      setSelectedCrewId("");
      setRoleDesc("");

      toast.success(
        t(
          "projects.crew.toast.assign_success",
          "Członek ekipy przypisany pomyślnie",
        ),
        { id: toastId },
      );
    } catch {
      toast.error(t("projects.crew.toast.assign_error", "Błąd przypisania"), {
        id: toastId,
        description: t(
          "projects.crew.toast.assign_error_desc",
          "Nie udało się przypisać członka ekipy do projektu.",
        ),
      });
    }
  };

  const handleRemove = async (id: string): Promise<void> => {
    const toastId = toast.loading(
      t("projects.crew.toast.removing", "Usuwanie członka ekipy..."),
    );

    try {
      await deleteCrewAssignmentMutation.mutateAsync(id);
      toast.success(
        t(
          "projects.crew.toast.remove_success",
          "Usunięto przypisanie z projektu",
        ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.actions.delete_error", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "projects.crew.toast.remove_error_desc",
          "Nie udało się odpiąć członka ekipy z projektu.",
        ),
      });
    }
  };

  return {
    isMutating:
      createCrewAssignmentMutation.isPending ||
      deleteCrewAssignmentMutation.isPending,
    selectedCrewId,
    setSelectedCrewId,
    roleDesc,
    setRoleDesc,
    availableCrew,
    projectAssignments,
    crewMap,
    handleAssign,
    handleRemove,
  };
};
