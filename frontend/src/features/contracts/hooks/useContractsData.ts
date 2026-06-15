/**
 * @file useContractsData.ts
 * @description View controller for the settlements cockpit. Joins projects, cast
 * and crew client-side into scope-aware financial summaries (committed / paid /
 * outstanding), per-project rollups for the rail, and a cross-project "payables"
 * feed of everything still owed. No bespoke backend aggregation — it reuses the
 * shared cast/crew/project caches.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/hooks
 */

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/shared/types";
import { compareProjectDateDesc } from "@/features/projects/lib/projectPresentation";
import type { ContractRecordType } from "../api/contracts.service";
import { useContractLedgers } from "../api/contracts.queries";
import {
  getCompletionRate,
  getContractPersonName,
  getProjectStatusCount,
  getSettlementState,
  isBillable,
  isPaid,
  parseFeeValue,
  sortContractRecords,
} from "../lib/contractsPresentation";
import type { ContractRecord } from "../lib/contractsPresentation";

export type LedgerFilter = "all" | "unpriced" | "unpaid";

export interface SettlementSummaryData {
  committed: number; // agreed gross across billable, priced records
  paid: number; // already settled amount
  outstanding: number; // committed - paid
  billableCount: number; // records that should carry a fee (excludes declined)
  pricedCount: number; // billable & priced
  paidCount: number; // billable & priced & settled
  outstandingCount: number; // billable & priced & unpaid
  missingCount: number; // billable & unpriced (blocks the contract)
  pricedRate: number; // pricedCount / billableCount (%)
  paidRate: number; // paidCount / pricedCount (%)
}

export interface ProjectRollup extends SettlementSummaryData {
  project: Project;
  castCount: number;
  crewCount: number;
  totalRecords: number;
}

export interface LedgerEntry {
  id: string;
  type: ContractRecordType;
  record: ContractRecord;
  project: Project;
}

interface TypedRecord {
  record: ContractRecord;
  type: ContractRecordType;
}

const summarize = (entries: TypedRecord[]): SettlementSummaryData => {
  let committed = 0;
  let paid = 0;
  let billableCount = 0;
  let pricedCount = 0;
  let paidCount = 0;
  let outstandingCount = 0;
  let missingCount = 0;

  for (const { record, type } of entries) {
    if (!isBillable(record, type)) {
      continue;
    }
    billableCount += 1;

    const fee = parseFeeValue(record.fee);
    if (fee == null || fee <= 0) {
      missingCount += 1;
      continue;
    }

    pricedCount += 1;
    committed += fee;

    if (isPaid(record)) {
      paidCount += 1;
      paid += fee;
    } else {
      outstandingCount += 1;
    }
  }

  return {
    committed,
    paid,
    outstanding: committed - paid,
    billableCount,
    pricedCount,
    paidCount,
    outstandingCount,
    missingCount,
    pricedRate: getCompletionRate(pricedCount, billableCount),
    paidRate: getCompletionRate(paidCount, pricedCount),
  };
};

export const useContractsData = () => {
  const {
    projects,
    participations,
    crewAssignments,
    isLoading,
    isFetching,
    isError,
    refresh,
  } = useContractLedgers();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  // Cancelled projects never settle; everything else (incl. completed events that
  // may still owe people) belongs in the workspace.
  const selectableProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => project.status !== "CANC")
        .sort(
          (left, right) =>
            compareProjectDateDesc(left.date_time, right.date_time) ||
            left.title.localeCompare(right.title, "pl", {
              sensitivity: "base",
            }),
        ),
    [projects],
  );

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of selectableProjects) {
      map.set(String(project.id), project);
    }
    return map;
  }, [selectableProjects]);

  const selectedProject = useMemo(
    () => projectsById.get(selectedProjectId) ?? null,
    [projectsById, selectedProjectId],
  );

  // Drop a stale selection if the project disappears; reset the ledger filter
  // whenever the active project changes so a filter never silently carries over.
  useEffect(() => {
    if (selectedProjectId && !projectsById.has(selectedProjectId)) {
      setSelectedProjectId("");
    }
  }, [projectsById, selectedProjectId]);

  useEffect(() => {
    setLedgerFilter("all");
  }, [selectedProjectId]);

  // project id -> typed cast/crew records (only for projects in scope)
  const recordsByProject = useMemo(() => {
    const map = new Map<string, TypedRecord[]>();
    const push = (projectId: string, entry: TypedRecord): void => {
      if (!projectsById.has(projectId)) {
        return;
      }
      const bucket = map.get(projectId);
      if (bucket) {
        bucket.push(entry);
      } else {
        map.set(projectId, [entry]);
      }
    };
    for (const participation of participations) {
      push(participation.project, { record: participation, type: "CAST" });
    }
    for (const assignment of crewAssignments) {
      push(assignment.project, { record: assignment, type: "CREW" });
    }
    return map;
  }, [participations, crewAssignments, projectsById]);

  const projectRollups = useMemo<ProjectRollup[]>(() => {
    return selectableProjects
      .map((project) => {
        const entries = recordsByProject.get(String(project.id)) ?? [];
        const castCount = entries.filter((e) => e.type === "CAST").length;
        const crewCount = entries.length - castCount;
        return {
          ...summarize(entries),
          project,
          castCount,
          crewCount,
          totalRecords: entries.length,
        };
      })
      .sort((left, right) => {
        // Money owed first, then the bigger liabilities, then most recent event.
        if (left.outstanding !== right.outstanding) {
          return right.outstanding - left.outstanding;
        }
        if (left.missingCount !== right.missingCount) {
          return right.missingCount - left.missingCount;
        }
        return compareProjectDateDesc(
          left.project.date_time,
          right.project.date_time,
        );
      });
  }, [selectableProjects, recordsByProject]);

  const globalStats = useMemo(() => {
    const allEntries: TypedRecord[] = [];
    for (const bucket of recordsByProject.values()) {
      allEntries.push(...bucket);
    }
    return {
      ...summarize(allEntries),
      totalProjects: selectableProjects.length,
      activeProjectsCount: getProjectStatusCount(selectableProjects, "ACTIVE"),
      draftProjectsCount: getProjectStatusCount(selectableProjects, "DRAFT"),
      archivedProjectsCount: getProjectStatusCount(selectableProjects, "DONE"),
      projectsWithOutstanding: projectRollups.filter((r) => r.outstanding > 0)
        .length,
    };
  }, [recordsByProject, selectableProjects, projectRollups]);

  // Cross-project feed of everything still owed or unpriced — the portfolio view.
  const payables = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];
    for (const [projectId, bucket] of recordsByProject.entries()) {
      const project = projectsById.get(projectId);
      if (!project) {
        continue;
      }
      for (const { record, type } of bucket) {
        const state = getSettlementState(record, type);
        if (state === "unpriced" || state === "unpaid") {
          entries.push({ id: `${type}-${record.id}`, type, record, project });
        }
      }
    }
    return entries.sort((left, right) => {
      const leftState = getSettlementState(left.record, left.type);
      const rightState = getSettlementState(right.record, right.type);
      // Unpriced (blocks contract) ahead of unpaid; then bigger amounts first.
      if (leftState !== rightState) {
        return leftState === "unpriced" ? -1 : 1;
      }
      const leftFee = parseFeeValue(left.record.fee) ?? 0;
      const rightFee = parseFeeValue(right.record.fee) ?? 0;
      return rightFee - leftFee;
    });
  }, [recordsByProject, projectsById]);

  // Full settlement universe (every cast + crew record with its project) for the
  // accounting CSV export — ordered by event date, then person name.
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];
    for (const [projectId, bucket] of recordsByProject.entries()) {
      const project = projectsById.get(projectId);
      if (!project) {
        continue;
      }
      for (const { record, type } of bucket) {
        entries.push({ id: `${type}-${record.id}`, type, record, project });
      }
    }
    return entries.sort(
      (left, right) =>
        compareProjectDateDesc(
          left.project.date_time,
          right.project.date_time,
        ) ||
        getContractPersonName(left.record, left.type).fallback.localeCompare(
          getContractPersonName(right.record, right.type).fallback,
          "pl",
          { sensitivity: "base" },
        ),
    );
  }, [recordsByProject, projectsById]);

  // ---- Selected-project ledger -------------------------------------------
  const projectCast = useMemo(
    () =>
      participations.filter(
        (participation) => participation.project === selectedProjectId,
      ),
    [participations, selectedProjectId],
  );
  const projectCrew = useMemo(
    () =>
      crewAssignments.filter(
        (assignment) => assignment.project === selectedProjectId,
      ),
    [crewAssignments, selectedProjectId],
  );

  const projectStats = useMemo<ProjectRollup | null>(() => {
    if (!selectedProject) {
      return null;
    }
    const entries: TypedRecord[] = [
      ...projectCast.map((record) => ({ record, type: "CAST" as const })),
      ...projectCrew.map((record) => ({ record, type: "CREW" as const })),
    ];
    return {
      ...summarize(entries),
      project: selectedProject,
      castCount: projectCast.length,
      crewCount: projectCrew.length,
      totalRecords: entries.length,
    };
  }, [selectedProject, projectCast, projectCrew]);

  const applyFilter = <T extends ContractRecord>(
    records: T[],
    type: ContractRecordType,
  ): T[] => {
    const filtered =
      ledgerFilter === "all"
        ? records
        : records.filter(
            (record) => getSettlementState(record, type) === ledgerFilter,
          );
    return sortContractRecords(filtered, type);
  };

  const visibleCast = useMemo(
    () => applyFilter(projectCast, "CAST"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectCast, ledgerFilter],
  );
  const visibleCrew = useMemo(
    () => applyFilter(projectCrew, "CREW"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectCrew, ledgerFilter],
  );

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
    scope: selectedProject ? ("project" as const) : ("portfolio" as const),

    ledgerFilter,
    setLedgerFilter,

    globalStats,
    projectStats,
    projectRollups,
    payables,
    allEntries,

    projectCast,
    projectCrew,
    visibleCast,
    visibleCrew,

    activeSummary: (selectedProject ? projectStats : globalStats) as
      | SettlementSummaryData
      | null,
  };
};
