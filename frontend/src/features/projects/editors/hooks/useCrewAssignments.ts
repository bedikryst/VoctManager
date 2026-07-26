/**
 * @file useCrewAssignments.ts
 * @description State and mutation controller for the technical-crew tab.
 * The crew is derived from the ASSIGNMENTS, not from the collaborator
 * dictionary: an assignment whose collaborator record has since been removed
 * still belongs to this project, and resolving the list through the dictionary
 * silently dropped those rows while the header kept counting them — the same
 * defect the divisi board and the cast tab both had to root out.
 * The pool is the other half: collaborators without an assignment here.
 * @module features/projects/editors/hooks/useCrewAssignments
 */

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { foldDiacritics } from "@/shared/lib/text";
import {
  CREW_SPECIALTY_ORDER,
  getCrewSpecialtyOption,
  getCrewSpecialtyOrder,
} from "@/features/crew/constants/crewSpecialties";
import type {
  Collaborator,
  CollaboratorSpecialty,
  CrewAssignment,
  CrewAssignmentStatus,
} from "@/shared/types";
import {
  useCreateCrewAssignment,
  useDeleteCrewAssignment,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useUpdateCrewAssignment,
} from "../../api/project.queries";

/** What both columns show about a collaborator, wherever the record came from. */
interface CrewFacts {
  readonly displayName: string;
  readonly specialty: CollaboratorSpecialty | null;
  /** Localised specialty ("Dźwięk"); empty when the base record is gone. */
  readonly specialtyLabel: string;
  readonly company: string | null;
}

export interface CrewPoolEntry extends CrewFacts {
  readonly collaboratorId: string;
}

export interface CrewMemberEntry extends CrewFacts {
  readonly assignmentId: string;
  readonly collaboratorId: string;
  /** What they do on THIS concert, if the producer wrote it down. */
  readonly role: string;
  readonly status: CrewAssignmentStatus;
  /** No base record behind this assignment — identity is a fallback. */
  readonly isUnresolved: boolean;
}

export interface CrewGroup<TEntry> {
  readonly key: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly entries: readonly TEntry[];
}

export interface UseCrewAssignmentsResult {
  /** Nothing has arrived yet — an empty column would state a fact, not a wait. */
  isLoading: boolean;
  isMutating: boolean;
  crewGroups: readonly CrewGroup<CrewMemberEntry>[];
  poolGroups: readonly CrewGroup<CrewPoolEntry>[];
  crewCount: number;
  poolCount: number;
  /** Bookings the producer has actually nailed down — what the call sheet prints. */
  confirmedCount: number;
  /** True once the base itself is empty, not merely filtered down to nothing. */
  isBaseExhausted: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  processingId: string | null;
  assign: (collaboratorId: string) => Promise<void>;
  remove: (assignmentId: string) => Promise<void>;
  setRole: (assignmentId: string, role: string) => Promise<void>;
  setConfirmed: (assignmentId: string, confirmed: boolean) => Promise<void>;
}

const EMPTY_COLLABORATORS: Collaborator[] = [];
const EMPTY_CREW_ASSIGNMENTS: CrewAssignment[] = [];

/** Specialty order (sound → … → other), then surname — how a crew list is read. */
const bySpecialtyThenName = <TEntry extends CrewFacts>(
  left: TEntry,
  right: TEntry,
): number => {
  const rankDelta =
    getCrewSpecialtyOrder(left.specialty) - getCrewSpecialtyOrder(right.specialty);
  if (rankDelta !== 0) return rankDelta;
  return left.displayName.localeCompare(right.displayName, "pl");
};

/** Buckets an already-ordered list into specialty groups, keeping that order. */
const groupBySpecialty = <TEntry extends CrewFacts>(
  entries: readonly TEntry[],
  t: TFunction,
): CrewGroup<TEntry>[] => {
  const buckets = new Map<string, TEntry[]>();

  for (const entry of entries) {
    const key = entry.specialty ?? "?";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()].map(([key, bucketEntries]) => {
    const isKnown = CREW_SPECIALTY_ORDER.includes(key as CollaboratorSpecialty);
    const option = getCrewSpecialtyOption(
      t,
      isKnown ? (key as CollaboratorSpecialty) : "OTHER",
    );

    return {
      key,
      // An assignment left behind by a deleted collaborator keeps whatever
      // specialty label the payload carried; letting the first entry name the
      // group would otherwise title the no-specialty section after it.
      label: isKnown
        ? option.label
        : t("projects.crew.specialty_unknown", "Bez specjalizacji"),
      Icon: option.icon,
      entries: bucketEntries,
    };
  });
};

export const useCrewAssignments = (
  projectId: string,
): UseCrewAssignmentsResult => {
  const { t } = useTranslation();

  const collaboratorsQuery = useProjectCollaboratorsDictionary();
  const crewAssignmentsQuery = useProjectCrewAssignments(projectId);
  const collaborators = collaboratorsQuery.data ?? EMPTY_COLLABORATORS;
  const crewAssignments = crewAssignmentsQuery.data ?? EMPTY_CREW_ASSIGNMENTS;

  const createCrewAssignmentMutation = useCreateCrewAssignment(projectId);
  const updateCrewAssignmentMutation = useUpdateCrewAssignment(projectId);
  const deleteCrewAssignmentMutation = useDeleteCrewAssignment(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const collaboratorById = useMemo(
    () =>
      new Map(collaborators.map((person) => [String(person.id), person])),
    [collaborators],
  );

  const projectAssignments = useMemo(
    () =>
      crewAssignments.filter(
        (assignment) => String(assignment.project) === String(projectId),
      ),
    [crewAssignments, projectId],
  );

  const assignedIds = useMemo(
    () =>
      new Set(
        projectAssignments.map((assignment) => String(assignment.collaborator)),
      ),
    [projectAssignments],
  );

  const crewEntries = useMemo<CrewMemberEntry[]>(() => {
    const unknownName = t("projects.crew.card.unknown", "Nieznany współpracownik");

    return projectAssignments
      .map((assignment) => {
        const person = collaboratorById.get(String(assignment.collaborator));
        const specialty = person?.specialty ?? null;

        return {
          assignmentId: String(assignment.id),
          collaboratorId: String(assignment.collaborator),
          displayName: person
            ? `${person.first_name} ${person.last_name}`.trim()
            : assignment.collaborator_name?.trim() || unknownName,
          specialty,
          specialtyLabel: specialty
            ? getCrewSpecialtyOption(t, specialty).label
            : (assignment.collaborator_specialty_display ?? ""),
          company: person?.company_name?.trim() || null,
          role: assignment.role_description?.trim() ?? "",
          status: assignment.status,
          isUnresolved: !person,
        };
      })
      .sort(bySpecialtyThenName);
  }, [collaboratorById, projectAssignments, t]);

  /** Everyone bookable and not yet booked — the search is scoped to this list. */
  const poolEntries = useMemo<CrewPoolEntry[]>(
    () =>
      collaborators
        .filter((person) => !assignedIds.has(String(person.id)))
        .map((person) => ({
          collaboratorId: String(person.id),
          displayName: `${person.first_name} ${person.last_name}`.trim(),
          specialty: person.specialty,
          specialtyLabel: getCrewSpecialtyOption(t, person.specialty).label,
          company: person.company_name?.trim() || null,
        }))
        .sort(bySpecialtyThenName),
    [assignedIds, collaborators, t],
  );

  // Searching answers "who can I book?", so it filters the pool alone —
  // filtering both columns hid people who ARE booked and left the two header
  // counters counting different universes while a query was live.
  const filteredPool = useMemo(() => {
    const query = foldDiacritics(searchQuery.trim());
    if (!query) return poolEntries;

    return poolEntries.filter((entry) =>
      foldDiacritics(
        `${entry.displayName} ${entry.specialtyLabel} ${entry.company ?? ""}`,
      ).includes(query),
    );
  }, [poolEntries, searchQuery]);

  const crewGroups = useMemo(
    () => groupBySpecialty(crewEntries, t),
    [crewEntries, t],
  );

  const poolGroups = useMemo(
    () => groupBySpecialty(filteredPool, t),
    [filteredPool, t],
  );

  const confirmedCount = useMemo(
    () => crewEntries.filter((entry) => entry.status === "CON").length,
    [crewEntries],
  );

  const runAssignmentWrite = async (
    key: string,
    write: () => Promise<unknown>,
    fallbackDescription: string,
  ): Promise<void> => {
    setProcessingId(key);

    try {
      await write();
    } catch (error) {
      toastApiError(error, t, { fallbackDescription });
    } finally {
      setProcessingId(null);
    }
  };

  const assign = (collaboratorId: string): Promise<void> =>
    runAssignmentWrite(
      collaboratorId,
      () =>
        createCrewAssignmentMutation.mutateAsync({
          project: projectId,
          collaborator: collaboratorId,
          // The role is written on the assigned row, where the person it
          // describes is already visible; a booking with no role reads as its
          // specialty until then.
          role_description: "",
        }),
      t(
        "projects.crew.toast.assign_error_desc",
        "Nie udało się przypisać członka ekipy do projektu.",
      ),
    );

  const remove = (assignmentId: string): Promise<void> =>
    runAssignmentWrite(
      assignmentId,
      () => deleteCrewAssignmentMutation.mutateAsync(assignmentId),
      t(
        "projects.crew.toast.remove_error_desc",
        "Nie udało się odpiąć członka ekipy z projektu.",
      ),
    );

  const setRole = (assignmentId: string, role: string): Promise<void> =>
    runAssignmentWrite(
      assignmentId,
      () =>
        updateCrewAssignmentMutation.mutateAsync({
          id: assignmentId,
          data: { role_description: role },
        }),
      t(
        "projects.crew.toast.role_error_desc",
        "Nie udało się zapisać roli na tym koncercie.",
      ),
    );

  const setConfirmed = (
    assignmentId: string,
    confirmed: boolean,
  ): Promise<void> =>
    runAssignmentWrite(
      assignmentId,
      () =>
        updateCrewAssignmentMutation.mutateAsync({
          id: assignmentId,
          data: { status: confirmed ? "CON" : "INV" },
        }),
      t(
        "projects.crew.toast.status_error_desc",
        "Nie udało się zmienić statusu rezerwacji.",
      ),
    );

  return {
    isLoading:
      collaboratorsQuery.isLoading || crewAssignmentsQuery.isLoading,
    isMutating:
      createCrewAssignmentMutation.isPending ||
      updateCrewAssignmentMutation.isPending ||
      deleteCrewAssignmentMutation.isPending,
    crewGroups,
    poolGroups,
    crewCount: crewEntries.length,
    poolCount: filteredPool.length,
    confirmedCount,
    isBaseExhausted: poolEntries.length === 0,
    searchQuery,
    setSearchQuery,
    processingId,
    assign,
    remove,
    setRole,
    setConfirmed,
  };
};
