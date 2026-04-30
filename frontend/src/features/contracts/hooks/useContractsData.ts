/**
 * @file useContractsData.ts
 * @description View Controller for the Contracts module.
 * Aggregates and calculates financial data across Projects, Cast, and Crew.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/hooks
 */

import { useEffect, useMemo, useState } from "react";
import { compareProjectDateDesc } from "@/features/projects/lib/projectPresentation";
import { useContractLedgers } from "../api/contracts.queries";
import {
  getCompletionRate,
  getProjectStatusCount,
  parseFeeValue,
  sortContractRecords,
} from "../lib/contractsPresentation";

export const useContractsData = () => {
  // Server State
  const {
    projects,
    participations,
    crewAssignments,
    isLoading,
    isFetching,
    isError,
    refresh,
  } = useContractLedgers();

  // Client State
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const selectableProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => project.status !== "CANC")
        .sort(
          (leftProject, rightProject) =>
            compareProjectDateDesc(
              leftProject.date_time,
              rightProject.date_time,
            ) ||
            leftProject.title.localeCompare(rightProject.title, "pl", {
              sensitivity: "base",
            }),
        ),
    [projects],
  );

  const selectedProject = useMemo(
    () =>
      selectableProjects.find(
        (project) => String(project.id) === selectedProjectId,
      ) ?? null,
    [selectableProjects, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const projectStillExists = selectableProjects.some(
      (project) => String(project.id) === selectedProjectId,
    );

    if (!projectStillExists) {
      setSelectedProjectId("");
    }
  }, [selectableProjects, selectedProjectId]);

  // Derived State: Global Stats (All projects combined)
  const globalStats = useMemo(() => {
    const pricedCast = participations.filter((p) => p.fee != null);
    const pricedCrew = crewAssignments.filter((c) => c.fee != null);

    const totalBudget = [...pricedCast, ...pricedCrew].reduce(
      (sum, item) => sum + (parseFeeValue(item.fee) ?? 0),
      0,
    );

    const totalPriced = pricedCast.length + pricedCrew.length;
    const totalContracts = participations.length + crewAssignments.length;

    return {
      totalBudget,
      totalPriced,
      totalContracts,
      completionRate: getCompletionRate(totalPriced, totalContracts),
      activeProjectsCount: getProjectStatusCount(projects, "ACTIVE"),
      draftProjectsCount: getProjectStatusCount(projects, "DRAFT"),
      archivedProjectsCount: getProjectStatusCount(projects, "DONE"),
      totalProjects: selectableProjects.length,
    };
  }, [crewAssignments, participations, projects, selectableProjects.length]);

  // Derived State: Local Project Data
  const currentCast = useMemo(() => {
    return sortContractRecords(
      participations.filter((participation) => participation.project === selectedProjectId),
      "CAST",
    );
  }, [participations, selectedProjectId]);

  const currentCrew = useMemo(() => {
    return sortContractRecords(
      crewAssignments.filter((assignment) => assignment.project === selectedProjectId),
      "CREW",
    );
  }, [crewAssignments, selectedProjectId]);

  // Derived State: Project Stats
  const projectStats = useMemo(() => {
    const totalContracts = currentCast.length + currentCrew.length;
    const pricedCast = currentCast.filter((p) => p.fee != null);
    const pricedCrew = currentCrew.filter((c) => c.fee != null);

    const pricedContractsCount = pricedCast.length + pricedCrew.length;
    const missingContractsCount = totalContracts - pricedContractsCount;

    const totalBudget = [...pricedCast, ...pricedCrew].reduce(
      (sum, item) => sum + (parseFeeValue(item.fee) ?? 0),
      0,
    );

    return {
      totalContracts,
      pricedContractsCount,
      missingContractsCount,
      totalBudget,
      castCount: currentCast.length,
      crewCount: currentCrew.length,
      completionRate: getCompletionRate(pricedContractsCount, totalContracts),
    };
  }, [currentCast, currentCrew]);

  return {
    isLoading,
    isFetching,
    isError,
    refresh,
    hasAnyLedgerData:
      selectableProjects.length > 0 ||
      participations.length > 0 ||
      crewAssignments.length > 0,
    projects: selectableProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    currentCast,
    currentCrew,
    globalStats,
    projectStats,
  };
};
