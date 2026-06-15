/**
 * @file contractsPresentation.ts
 * @description Presentation helpers for the contracts workspace.
 * Centralizes fee parsing, formatting, status metadata, and stable sorting.
 * @architecture Enterprise SaaS 2026
 */

import type { Project } from "@/shared/types";
import type {
  EnrichedCrewAssignment,
  EnrichedParticipation,
} from "../types/contracts.dto";

export type ContractRecord = EnrichedParticipation | EnrichedCrewAssignment;
export type ContractRecordType = "CAST" | "CREW";
export type ContractStatusTone = "active" | "upcoming" | "archived" | "danger";
export type ProjectStatusTone = "active" | "upcoming" | "archived" | "danger";

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("pl-PL");

const normalizeText = (value: string | undefined | null): string =>
  (value ?? "").trim();

export const parseFeeValue = (
  value: string | number | null | undefined,
): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value.replace(",", ".").trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const formatContractCurrency = (
  value: string | number | null | undefined,
): string => currencyFormatter.format(parseFeeValue(value) ?? 0);

export const formatInteger = (value: number): string =>
  integerFormatter.format(value);

export const isFeeMissing = (
  value: string | number | null | undefined,
): boolean => {
  const parsedValue = parseFeeValue(value);
  return parsedValue == null || parsedValue <= 0;
};

export const getCompletionRate = (completed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
};

export const isPaid = (record: ContractRecord): boolean =>
  Boolean(record.is_paid);

/**
 * Whether a record represents money actually owed. Declined cast members are not
 * billable (they withdrew), so they are excluded from budget / outstanding math
 * even if a fee was entered before they declined. Crew has no decline state.
 */
export const isBillable = (
  record: ContractRecord,
  type: ContractRecordType,
): boolean => (type === "CAST" ? record.status !== "DEC" : true);

/**
 * Settlement lifecycle of a single ledger record, used both for row styling and
 * for ordering the ledger so action items float to the top.
 *  - `unpriced`  billable but has no fee yet → blocks the contract PDF
 *  - `unpaid`    billable, priced, money still owed
 *  - `paid`      fully settled
 *  - `inactive`  not billable (declined) → ignored by budget / outstanding
 */
export type SettlementState = "unpriced" | "unpaid" | "paid" | "inactive";

export const getSettlementState = (
  record: ContractRecord,
  type: ContractRecordType,
): SettlementState => {
  if (!isBillable(record, type)) {
    return "inactive";
  }
  if (isFeeMissing(record.fee)) {
    return "unpriced";
  }
  return isPaid(record) ? "paid" : "unpaid";
};

const SETTLEMENT_RANK: Record<SettlementState, number> = {
  unpriced: 0,
  unpaid: 1,
  paid: 2,
  inactive: 3,
};

export const areFeesEqual = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean => {
  const normalizedLeft = parseFeeValue(left);
  const normalizedRight = parseFeeValue(right);

  if (normalizedLeft == null && normalizedRight == null) {
    return true;
  }

  if (normalizedLeft == null || normalizedRight == null) {
    return false;
  }

  return Math.abs(normalizedLeft - normalizedRight) < 0.001;
};

export const getContractPersonName = (
  record: ContractRecord,
  type: ContractRecordType,
): { translationKey: string; fallback: string } =>
  type === "CAST"
    ? normalizeText((record as EnrichedParticipation).artist_name)
      ? { translationKey: "", fallback: normalizeText((record as EnrichedParticipation).artist_name) }
      : { translationKey: "contracts.unknown_artist", fallback: "Nieznany artysta" }
    : normalizeText((record as EnrichedCrewAssignment).collaborator_name)
      ? { translationKey: "", fallback: normalizeText((record as EnrichedCrewAssignment).collaborator_name) }
      : { translationKey: "contracts.unknown_collaborator", fallback: "Nieznany współpracownik" };

export const getContractRoleLabel = (
  record: ContractRecord,
  type: ContractRecordType,
): { translationKey: string; fallback: string } =>
  type === "CAST"
    ? normalizeText(
        (record as EnrichedParticipation).artist_voice_type_display,
      )
      ? { translationKey: "", fallback: normalizeText((record as EnrichedParticipation).artist_voice_type_display) }
      : { translationKey: "contracts.unknown_voice", fallback: "Nieznany głos" }
    : normalizeText(
        (record as EnrichedCrewAssignment).collaborator_specialty_display,
      )
      ? { translationKey: "", fallback: normalizeText((record as EnrichedCrewAssignment).collaborator_specialty_display) }
      : { translationKey: "contracts.unknown_specialty", fallback: "Nieznana specjalność" };

export const getContractStatusMeta = (
  record: ContractRecord,
): { translationKey: string; fallback: string; tone: ContractStatusTone } => {
  switch (record.status) {
    case "CON":
      return { translationKey: "contracts.status.confirmed", fallback: "Potwierdzony", tone: "active" };
    case "DEC":
      return { translationKey: "contracts.status.declined", fallback: "Odrzucony", tone: "danger" };
    case "INV":
    default:
      return { translationKey: "contracts.status.pending", fallback: "Oczekujący na odpowiedź", tone: "upcoming" };
  }
};

export const getProjectStatusMeta = (
  projectStatus: Project["status"] | undefined,
): { translationKey: string; fallback: string; tone: ProjectStatusTone } => {
  switch (projectStatus) {
    case "ACTIVE":
      return { translationKey: "contracts.project_status.active", fallback: "Aktywny", tone: "active" };
    case "DONE":
      return { translationKey: "contracts.project_status.archived", fallback: "Zarchiwizowany", tone: "archived" };
    case "CANC":
      return { translationKey: "contracts.project_status.cancelled", fallback: "Anulowany", tone: "danger" };
    case "DRAFT":
    default:
      return { translationKey: "contracts.project_status.draft", fallback: "Draft", tone: "upcoming" };
  }
};

export const getProjectStatusCount = (
  projects: Project[],
  status: Project["status"],
): number => projects.filter((project) => project.status === status).length;

export const sortContractRecords = <T extends ContractRecord>(
  records: T[],
  type: ContractRecordType,
): T[] =>
  [...records].sort((leftRecord, rightRecord) => {
    const leftRank = SETTLEMENT_RANK[getSettlementState(leftRecord, type)];
    const rightRank = SETTLEMENT_RANK[getSettlementState(rightRecord, type)];

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return getContractPersonName(leftRecord, type).fallback.localeCompare(
      getContractPersonName(rightRecord, type).fallback,
      "pl",
      { sensitivity: "base" },
    );
  });
