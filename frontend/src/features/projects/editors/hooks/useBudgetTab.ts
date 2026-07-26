/**
 * @file useBudgetTab.ts
 * @description Draft state, cost arithmetic and the batched save for the budget
 * ledger. Two things shape everything here:
 *  - a SETTLED fee is a fact, not a draft. It is excluded from every write path
 *    (the server refuses to bulk-rewrite it for the same reason) and reported
 *    separately, so the tab can answer "what is still owed" and not merely
 *    "what does this cost".
 *  - the standard rate goes through the server's own bulk endpoint rather than
 *    forty PATCHes, and is applied BEFORE the individual edits so a per-person
 *    exception typed in the same draft survives it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useBudgetTab
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { toastApiError } from "@/shared/api/errors";
import { getCrewSpecialtyOption } from "@/features/crew/constants/crewSpecialties";
import type {
  Artist,
  Collaborator,
  CrewAssignment,
  Participation,
} from "@/shared/types";
import {
  useApplyBulkCastFee,
  useApplyBulkCrewFee,
  useProjectArtistsDictionary,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useProjectParticipations,
  useUpdateCrewAssignment,
  useUpdateParticipation,
} from "../../api/project.queries";
import { parseFee, sanitizeAmountInput, toFeePayload } from "../../lib/money";
import type { FeeMutation } from "../types";

export type LedgerSide = "cast" | "crew";

/** One line of the ledger, whichever roster it came from. */
export interface LedgerEntry {
  readonly id: string;
  readonly side: LedgerSide;
  readonly name: string;
  /** Voice type for a singer, role or specialty for a collaborator. */
  readonly meta: string;
  /** The persisted fee, before any draft edit. */
  readonly fee: number | null;
  /** Money already paid out. The row states it and stops being editable. */
  readonly isSettled: boolean;
}

export interface LedgerSection {
  readonly side: LedgerSide;
  readonly entries: readonly LedgerEntry[];
  readonly total: number;
  readonly settledCount: number;
  readonly missingCount: number;
}

export interface BudgetKpi {
  readonly castTotal: number;
  readonly crewTotal: number;
  readonly grandTotal: number;
  /** Of the grand total, what is already out the door. */
  readonly settledTotal: number;
  readonly outstandingTotal: number;
  /** Billable positions still carrying no price — the total understates by these. */
  readonly missingCount: number;
}

export interface UseBudgetTabResult {
  /** Nothing has arrived yet — a zero total would state a fact, not a wait. */
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  cast: LedgerSection;
  crew: LedgerSection;
  kpi: BudgetKpi;
  /** What one row shows and whether it is part of the pending save. */
  rowState: (entry: LedgerEntry) => { value: string; isPending: boolean };
  /** The standard rate typed for a side, "" when none is pending. */
  standardRateOf: (side: LedgerSide) => string;
  /** How many rows a standard rate would actually reprice on each side. */
  repriceableCount: (side: LedgerSide) => number;
  handleFeeChange: (id: string, value: string) => void;
  handleStandardRate: (side: LedgerSide, value: string) => void;
  handleReset: () => void;
  handleBulkSave: () => Promise<void>;
}

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_COLLABORATORS: Collaborator[] = [];
const EMPTY_CREW_ASSIGNMENTS: CrewAssignment[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];

/**
 * Unpriced positions float to the top — that is the work still to do. Ordering
 * reads the SERVER value, never the draft, so a row does not jump out from
 * under the cursor the moment its first digit is typed.
 */
const byWorkThenName = (left: LedgerEntry, right: LedgerEntry): number => {
  const leftMissing = left.fee === null;
  const rightMissing = right.fee === null;
  if (leftMissing !== rightMissing) return leftMissing ? -1 : 1;
  return left.name.localeCompare(right.name, "pl");
};

const summarize = (
  side: LedgerSide,
  entries: readonly LedgerEntry[],
  draftValueOf: (entry: LedgerEntry) => string,
): LedgerSection => {
  let total = 0;
  let settledCount = 0;
  let missingCount = 0;

  for (const entry of entries) {
    if (entry.isSettled) settledCount += 1;

    const value = parseFee(draftValueOf(entry));
    if (value === null) missingCount += 1;
    else total += value;
  }

  return { side, entries, total, settledCount, missingCount };
};

export const useBudgetTab = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseBudgetTabResult => {
  const { t } = useTranslation();

  const participationsQuery = useProjectParticipations(projectId);
  const crewAssignmentsQuery = useProjectCrewAssignments(projectId);
  const artistsQuery = useProjectArtistsDictionary();
  const collaboratorsQuery = useProjectCollaboratorsDictionary();
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;
  const crewAssignments = crewAssignmentsQuery.data ?? EMPTY_CREW_ASSIGNMENTS;
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const collaborators = collaboratorsQuery.data ?? EMPTY_COLLABORATORS;

  const updateParticipationMutation = useUpdateParticipation(projectId);
  const updateCrewAssignmentMutation = useUpdateCrewAssignment(projectId);
  const applyBulkCastFee = useApplyBulkCastFee(projectId);
  const applyBulkCrewFee = useApplyBulkCrewFee(projectId);

  const [dirtyFees, setDirtyFees] = useState<Record<string, FeeMutation>>({});
  const [standardRates, setStandardRates] = useState<
    Partial<Record<LedgerSide, string>>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      Object.keys(dirtyFees).length > 0 ||
      Object.values(standardRates).some((rate) => rate !== undefined),
    [dirtyFees, standardRates],
  );

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const castEntries = useMemo<LedgerEntry[]>(() => {
    const artistById = new Map(
      artists.map((artist) => [String(artist.id), artist]),
    );
    const unknownName = t("projects.cast.card.unknown", "Nieznany uczestnik");

    return participations
      .filter(
        (participation) =>
          participation.status === "CON" || participation.status === "INV",
      )
      .map((participation) => {
        const artist = artistById.get(String(participation.artist));

        return {
          id: String(participation.id),
          side: "cast" as const,
          // Derived from the participation, never from a dictionary lookup that
          // drops what it cannot resolve: an archived singer still has a fee to
          // settle, and dropping the row while counting it in the header is the
          // desync the cast and divisi tabs both had to root out.
          name: artist
            ? `${artist.first_name} ${artist.last_name}`.trim()
            : participation.artist_name?.trim() || unknownName,
          meta: artist?.voice_type
            ? t(
                `dashboard.layout.roles.${artist.voice_type}`,
                artist.voice_type_display ?? artist.voice_type,
              )
            : (participation.artist_voice_type_display ?? ""),
          fee: parseFee(participation.fee),
          isSettled: Boolean(participation.is_paid),
        };
      })
      .sort(byWorkThenName);
  }, [artists, participations, t]);

  const crewEntries = useMemo<LedgerEntry[]>(() => {
    const collaboratorById = new Map(
      collaborators.map((person) => [String(person.id), person]),
    );
    const unknownName = t(
      "projects.crew.card.unknown",
      "Nieznany współpracownik",
    );

    return crewAssignments
      .map((assignment) => {
        const person = collaboratorById.get(String(assignment.collaborator));
        const specialtyLabel = person
          ? getCrewSpecialtyOption(t, person.specialty).label
          : (assignment.collaborator_specialty_display ?? "");

        return {
          id: String(assignment.id),
          side: "crew" as const,
          name: person
            ? `${person.first_name} ${person.last_name}`.trim()
            : assignment.collaborator_name?.trim() || unknownName,
          meta: assignment.role_description?.trim() || specialtyLabel,
          fee: parseFee(assignment.fee),
          isSettled: Boolean(assignment.is_paid),
        };
      })
      .sort(byWorkThenName);
  }, [collaborators, crewAssignments, t]);

  /**
   * What a row currently reads. Precedence: an individual edit, then the
   * standard rate pending for that side, then what is stored. A settled row
   * never takes either — it is money already paid.
   */
  const draftValueOf = useMemo(
    () =>
      (entry: LedgerEntry): string => {
        const edited = dirtyFees[entry.id];
        if (edited) return edited.value;
        if (entry.isSettled) return entry.fee === null ? "" : String(entry.fee);

        const standard = standardRates[entry.side];
        if (standard !== undefined) return standard;

        return entry.fee === null ? "" : String(entry.fee);
      },
    [dirtyFees, standardRates],
  );

  const cast = useMemo(
    () => summarize("cast", castEntries, draftValueOf),
    [castEntries, draftValueOf],
  );

  const crew = useMemo(
    () => summarize("crew", crewEntries, draftValueOf),
    [crewEntries, draftValueOf],
  );

  const kpi = useMemo<BudgetKpi>(() => {
    let settledTotal = 0;

    for (const entry of [...castEntries, ...crewEntries]) {
      if (entry.isSettled && entry.fee !== null) settledTotal += entry.fee;
    }

    const grandTotal = cast.total + crew.total;

    return {
      castTotal: cast.total,
      crewTotal: crew.total,
      grandTotal,
      settledTotal,
      outstandingTotal: Math.max(grandTotal - settledTotal, 0),
      missingCount: cast.missingCount + crew.missingCount,
    };
  }, [cast, castEntries, crew, crewEntries]);

  const rowState = (
    entry: LedgerEntry,
  ): { value: string; isPending: boolean } => {
    const value = draftValueOf(entry);
    const stored = entry.fee === null ? "" : String(entry.fee);
    return { value, isPending: parseFee(value) !== parseFee(stored) };
  };

  const standardRateOf = (side: LedgerSide): string => standardRates[side] ?? "";

  const repriceableCount = (side: LedgerSide): number =>
    (side === "cast" ? castEntries : crewEntries).filter(
      (entry) => !entry.isSettled,
    ).length;

  const handleFeeChange = (id: string, value: string): void => {
    const entry =
      castEntries.find((candidate) => candidate.id === id) ??
      crewEntries.find((candidate) => candidate.id === id);
    if (!entry || entry.isSettled) return;

    setDirtyFees((previous) => ({
      ...previous,
      [id]: { type: entry.side, value: sanitizeAmountInput(value) },
    }));
  };

  const handleStandardRate = (side: LedgerSide, rawValue: string): void => {
    const value = sanitizeAmountInput(rawValue);
    const isCleared = value.trim() === "";

    setStandardRates((previous) => {
      const next = { ...previous };
      // Cleared means "no standard rate pending", not "a standard rate of
      // nothing" — otherwise emptying the field leaves the save bar open with
      // an instruction the server would refuse anyway.
      if (isCleared) delete next[side];
      else next[side] = value;
      return next;
    });

    // A standard rate is a decision about the whole side, so it drops the
    // per-person exceptions typed before it. One typed afterwards still wins:
    // the save order is bulk first, individual second.
    if (!isCleared) {
      setDirtyFees((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([, mutation]) => mutation.type !== side,
          ),
        ),
      );
    }
  };

  const handleReset = (): void => {
    setDirtyFees({});
    setStandardRates({});
  };

  const handleBulkSave = async (): Promise<void> => {
    if (!isDirty) return;

    setIsSaving(true);

    const toastId = toast.loading(
      t("projects.budget.toast.saving", "Zapisywanie budżetu..."),
    );

    try {
      // Ordered, not parallel: the bulk statement rewrites the whole side, so an
      // individual exception has to land after it or it is silently overwritten.
      const castRate = parseFee(standardRates.cast ?? "");
      if (standardRates.cast !== undefined && castRate !== null) {
        await applyBulkCastFee.mutateAsync(castRate);
      }

      const crewRate = parseFee(standardRates.crew ?? "");
      if (standardRates.crew !== undefined && crewRate !== null) {
        await applyBulkCrewFee.mutateAsync(crewRate);
      }

      await Promise.all(
        Object.entries(dirtyFees).map(([id, mutation]) => {
          const fee = toFeePayload(mutation.value);

          if (mutation.type === "cast") {
            return updateParticipationMutation.mutateAsync({
              id,
              data: { fee },
            });
          }

          return updateCrewAssignmentMutation.mutateAsync({
            id,
            data: { fee },
          });
        }),
      );

      handleReset();

      toast.success(
        t(
          "projects.budget.toast.save_success",
          "Zapisano stawki i przeliczono budżet",
        ),
        { id: toastId },
      );
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "projects.budget.toast.save_error_desc",
          "Nie udało się zapisać wszystkich stawek.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isLoading:
      participationsQuery.isLoading ||
      crewAssignmentsQuery.isLoading ||
      artistsQuery.isLoading ||
      collaboratorsQuery.isLoading,
    isSaving,
    isDirty,
    cast,
    crew,
    kpi,
    rowState,
    standardRateOf,
    repriceableCount,
    handleFeeChange,
    handleStandardRate,
    handleReset,
    handleBulkSave,
  };
};
