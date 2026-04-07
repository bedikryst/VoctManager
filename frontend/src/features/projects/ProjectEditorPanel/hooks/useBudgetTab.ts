/**
 * @file useBudgetTab.ts
 * @description Encapsulates dirty-state tracking, financial KPI calculations,
 * and bulk-save mutations for the Project Budgeting module.
 * Strictly synchronizes unsaved changes with the parent panel.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useBudgetTab
 */

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { queryKeys } from "../../../../shared/lib/queryKeys";
import { ProjectService } from "../../api/project.service";
import { useProjectData } from "../../hooks/useProjectData";

type FeeMutation = { type: "cast" | "crew"; value: string };

export const useBudgetTab = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { participations, crewAssignments, artists, crew, isLoading } =
    useProjectData(projectId);

  const [dirtyFees, setDirtyFees] = useState<Record<string, FeeMutation>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isDirty = useMemo(() => Object.keys(dirtyFees).length > 0, [dirtyFees]);

  // Synchronize internal dirty state with the parent orchestrator
  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  const handleFeeChange = (
    id: string,
    value: string,
    type: "cast" | "crew",
  ) => {
    setDirtyFees((previous) => ({ ...previous, [id]: { type, value } }));
  };

  const handleReset = () => {
    setDirtyFees({});
  };

  const enrichedCast = useMemo(() => {
    return participations
      .filter((p) => p.status === "CON" || p.status === "INV")
      .map((participation) => ({
        ...participation,
        artistData: artists.find((a) => a.id === participation.artist),
      }))
      .filter((p) => p.artistData)
      .sort((left, right) =>
        left.artistData!.last_name.localeCompare(right.artistData!.last_name),
      );
  }, [participations, artists]);

  const enrichedCrew = useMemo(() => {
    return crewAssignments
      .map((assignment) => ({
        ...assignment,
        crewData: crew.find((c) => c.id === assignment.collaborator),
      }))
      .filter((assignment) => assignment.crewData)
      .sort((left, right) =>
        left.crewData!.last_name.localeCompare(right.crewData!.last_name),
      );
  }, [crewAssignments, crew]);

  const kpi = useMemo(() => {
    let castTotal = 0;
    let crewTotal = 0;
    let missingCount = 0;

    enrichedCast.forEach((participation) => {
      const currentValue = dirtyFees[participation.id]
        ? dirtyFees[participation.id].value
        : participation.fee !== null && participation.fee !== undefined
          ? String(participation.fee)
          : "";

      if (!currentValue) {
        missingCount++;
      } else {
        castTotal += parseFloat(currentValue) || 0;
      }
    });

    enrichedCrew.forEach((assignment) => {
      const currentValue = dirtyFees[assignment.id]
        ? dirtyFees[assignment.id].value
        : assignment.fee !== null && assignment.fee !== undefined
          ? String(assignment.fee)
          : "";

      if (!currentValue) {
        missingCount++;
      } else {
        crewTotal += parseFloat(currentValue) || 0;
      }
    });

    return {
      castTotal,
      crewTotal,
      missingCount,
      grandTotal: castTotal + crewTotal,
    };
  }, [enrichedCast, enrichedCrew, dirtyFees]);

  const handleBulkSave = async () => {
    if (!isDirty) return;

    setIsSaving(true);
    const toastId = toast.loading(
      t("projects.budget.toast.saving", "Zapisywanie budżetu..."),
    );

    try {
      const mutationIds = Object.keys(dirtyFees);
      await Promise.all(
        mutationIds.map((id) => {
          const mutation = dirtyFees[id];
          const numericValue =
            mutation.value === "" ? null : parseFloat(mutation.value);

          if (mutation.type === "cast") {
            return ProjectService.updateParticipation(id, {
              fee: numericValue,
            });
          } else {
            return ProjectService.updateCrewAssignment(id, {
              fee: numericValue,
            });
          }
        }),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.participations.byProject(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.crewAssignments.byProject(projectId),
        }),
      ]);

      setDirtyFees({});
      toast.success(
        t(
          "projects.budget.toast.save_success",
          "Zapisano stawki i przeliczono budżet",
        ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.budget.toast.save_error_desc",
          "Nie udało się zapisać wszystkich stawek.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isLoading,
    isSaving,
    isDirty,
    enrichedCast,
    enrichedCrew,
    dirtyFees,
    kpi,
    handleFeeChange,
    handleReset,
    handleBulkSave,
  };
};
