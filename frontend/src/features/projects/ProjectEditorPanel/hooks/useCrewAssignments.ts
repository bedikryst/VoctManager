/**
 * @file useCrewAssignments.ts
 * @description Encapsulates mutation logic and state management for crew assignments.
 * Extracts dictionaries from project queries and delegates writes to the Project domain layer.
 * @module panel/projects/ProjectEditorPanel/hooks/useCrewAssignments
 */

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Collaborator, CrewAssignment } from "@/shared/types";
import {
  useCreateCrewAssignment,
  useDeleteCrewAssignment,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

export const useCrewAssignments = (projectId: string) => {
  const { t } = useTranslation();
  const { crew, crewAssignments, isLoading } = useProjectData(projectId);

  const createCrewAssignmentMutation = useCreateCrewAssignment(projectId);
  const deleteCrewAssignmentMutation = useDeleteCrewAssignment(projectId);

  const [selectedCrewId, setSelectedCrewId] = useState<string>("");
  const [roleDesc, setRoleDesc] = useState<string>("");

  const projectAssignments = useMemo<CrewAssignment[]>(
    () =>
      crewAssignments.filter(
        (assignment) => String(assignment.project) === String(projectId),
      ),
    [crewAssignments, projectId],
  );

  const assignedCrewIds = useMemo<Set<string>>(
    () =>
      new Set(
        projectAssignments.map((assignment) => String(assignment.collaborator)),
      ),
    [projectAssignments],
  );

  const availableCrew = useMemo<Collaborator[]>(() => {
    if (!crew || crew.length === 0) {
      return [];
    }
    return crew.filter(
      (collaborator) => !assignedCrewIds.has(String(collaborator.id)),
    );
  }, [crew, assignedCrewIds]);

  const crewMap = useMemo<Map<string, Collaborator>>(() => {
    const map = new Map<string, Collaborator>();
    crew.forEach((collaborator) =>
      map.set(String(collaborator.id), collaborator),
    );
    return map;
  }, [crew]);

  const handleAssign = async (
    event: React.FormEvent<HTMLFormElement>,
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
    isLoading,
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
