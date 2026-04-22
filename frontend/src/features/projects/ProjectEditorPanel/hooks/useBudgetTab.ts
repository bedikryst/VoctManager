/**
 * @file useBudgetTab.ts
 * @description Encapsulates dirty-state tracking, financial KPI calculations,
 * and bulk-save mutations for the Project Budgeting module.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useBudgetTab
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  useProjectArtistsDictionary,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useProjectParticipations,
  useUpdateCrewAssignment,
  useUpdateParticipation,
} from "../../api/project.queries";

import type {
  EnrichedCrewAssignment,
  EnrichedParticipation,
  FeeMutation,
} from "../types";

export interface BudgetKpi {
  castTotal: number;
  crewTotal: number;
  missingCount: number;
  grandTotal: number;
}

export interface UseBudgetTabResult {
  isSaving: boolean;
  isDirty: boolean;
  enrichedCast: EnrichedParticipation[];
  enrichedCrew: EnrichedCrewAssignment[];
  dirtyFees: Record<string, FeeMutation>;
  kpi: BudgetKpi;
  handleFeeChange: (id: string, value: string, type: "cast" | "crew") => void;
  handleReset: () => void;
  handleBulkSave: () => Promise<void>;
}

export const useBudgetTab = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseBudgetTabResult => {
  const { t } = useTranslation();

  const { data: participations } = useProjectParticipations(projectId);
  const { data: crewAssignments } = useProjectCrewAssignments(projectId);
  const { data: artists } = useProjectArtistsDictionary();
  const { data: collaborators } = useProjectCollaboratorsDictionary();

  const updateParticipationMutation = useUpdateParticipation(projectId);
  const updateCrewAssignmentMutation = useUpdateCrewAssignment(projectId);

  const [dirtyFees, setDirtyFees] = useState<Record<string, FeeMutation>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => Object.keys(dirtyFees).length > 0, [dirtyFees]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const enrichedCast = useMemo<EnrichedParticipation[]>(
    () =>
      participations
        .filter(
          (participation) =>
            participation.status === "CON" || participation.status === "INV",
        )
        .map((participation) => ({
          ...participation,
          artistData: artists.find(
            (artist) => String(artist.id) === String(participation.artist),
          ),
        }))
        .filter(
          (participation): participation is EnrichedParticipation =>
            participation.artistData !== undefined,
        )
        .sort((left, right) =>
          left.artistData.last_name.localeCompare(right.artistData.last_name),
        ),
    [artists, participations],
  );

  const enrichedCrew = useMemo<EnrichedCrewAssignment[]>(
    () =>
      crewAssignments
        .map((assignment) => ({
          ...assignment,
          crewData: collaborators.find(
            (collaborator) =>
              String(collaborator.id) === String(assignment.collaborator),
          ),
        }))
        .filter(
          (assignment): assignment is EnrichedCrewAssignment =>
            assignment.crewData !== undefined,
        )
        .sort((left, right) =>
          left.crewData.last_name.localeCompare(right.crewData.last_name),
        ),
    [collaborators, crewAssignments],
  );

  const kpi = useMemo<BudgetKpi>(() => {
    let castTotal = 0;
    let crewTotal = 0;
    let missingCount = 0;

    enrichedCast.forEach((participation) => {
      const currentValue =
        dirtyFees[String(participation.id)]?.value ??
        (participation.fee !== null && participation.fee !== undefined
          ? String(participation.fee)
          : "");

      if (!currentValue) {
        missingCount += 1;
        return;
      }

      castTotal += Number.parseFloat(currentValue) || 0;
    });

    enrichedCrew.forEach((assignment) => {
      const currentValue =
        dirtyFees[String(assignment.id)]?.value ??
        (assignment.fee !== null && assignment.fee !== undefined
          ? String(assignment.fee)
          : "");

      if (!currentValue) {
        missingCount += 1;
        return;
      }

      crewTotal += Number.parseFloat(currentValue) || 0;
    });

    return {
      castTotal,
      crewTotal,
      missingCount,
      grandTotal: castTotal + crewTotal,
    };
  }, [dirtyFees, enrichedCast, enrichedCrew]);

  const handleFeeChange = (
    id: string,
    value: string,
    type: "cast" | "crew",
  ): void => {
    setDirtyFees((previous) => ({ ...previous, [id]: { type, value } }));
  };

  const handleReset = (): void => {
    setDirtyFees({});
  };

  const handleBulkSave = async (): Promise<void> => {
    if (!isDirty) {
      return;
    }

    setIsSaving(true);

    const toastId = toast.loading(
      t("projects.budget.toast.saving", "Zapisywanie budĹĽetu..."),
    );

    try {
      await Promise.all(
        Object.entries(dirtyFees).map(([id, mutation]) => {
          const numericValue =
            mutation.value === "" ? null : Number.parseFloat(mutation.value);

          if (mutation.type === "cast") {
            return updateParticipationMutation.mutateAsync({
              id,
              data: { fee: numericValue },
            });
          }

          return updateCrewAssignmentMutation.mutateAsync({
            id,
            data: { fee: numericValue },
          });
        }),
      );

      setDirtyFees({});

      toast.success(
        t(
          "projects.budget.toast.save_success",
          "Zapisano stawki i przeliczono budĹĽet",
        ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "BĹ‚Ä…d zapisu"), {
        id: toastId,
        description: t(
          "projects.budget.toast.save_error_desc",
          "Nie udaĹ‚o siÄ™ zapisaÄ‡ wszystkich stawek.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
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
