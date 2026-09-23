/**
 * @file finance.dto.ts
 * @description Wire shapes of `/api/finance/`. Amounts travel as decimal
 * strings ("1250.00") in both directions: the server sums in `Decimal`, and a
 * float on the way would lose the grosz before anything was rendered. The
 * client parses them into integer grosze (`lib/money.ts`) only to preview a
 * draft; everything persisted is rendered from the server's own totals.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/types/finance.dto
 */

/** A money amount exactly as the API writes it: `"1250.00"`. */
export type DecimalString = string;

/** A calendar date as the API writes it: `"2026-09-23"`. */
export type IsoDate = string;

export type FeeForm = "DZIELO" | "ZLECENIE" | "INVOICE" | "VOLUNTEER" | "OTHER";

export const FEE_FORMS: readonly FeeForm[] = [
  "DZIELO",
  "ZLECENIE",
  "INVOICE",
  "VOLUNTEER",
  "OTHER",
];

/** The forms the foundation issues a document of its own for. */
export const CONTRACT_FORMS: readonly FeeForm[] = [
  "DZIELO",
  "ZLECENIE",
  "VOLUNTEER",
];

/** The forms whose contract has a bill beside it. */
export const BILLED_FORMS: readonly FeeForm[] = ["DZIELO", "ZLECENIE"];

export type CostCategory =
  | "PERSONNEL_ARTISTIC"
  | "PERSONNEL_TECHNICAL"
  | "VENUE"
  | "TRAVEL"
  | "ACCOMMODATION"
  | "CATERING"
  | "MATERIALS"
  | "EQUIPMENT"
  | "PROMOTION"
  | "RECORDING"
  | "ADMINISTRATION"
  | "OTHER";

/** The two sides a fee sits on; a one-off payee states which. */
export type FeeCategory = Extract<
  CostCategory,
  "PERSONNEL_ARTISTIC" | "PERSONNEL_TECHNICAL"
>;

export type ContractStatus = "ISSUED" | "SIGNED" | "ANNULLED";

export type BudgetStatus = "PLANNING" | "APPROVED" | "CLOSED";

export type LedgerOrigin = "cast" | "crew" | "one_off";

export type WarningSeverity = "work" | "problem";

export interface ContractDTO {
  readonly id: string;
  readonly number: string;
  readonly form: FeeForm;
  readonly amount: DecimalString;
  readonly status: ContractStatus;
  readonly issued_at: string;
  readonly signed_on: IsoDate | null;
  readonly signed_copy_location: string;
  readonly hours_confirmed: DecimalString | null;
}

/**
 * One person the project owes, or may owe, a fee. `key` is the handle the
 * client sends back as the row's ref and the id warnings name it by: the cast
 * seat, the crew assignment, or — for a one-off payee — the cost item.
 * A row with no `cost_item_id` has never been priced; the server computes it
 * from the roster on every read.
 */
export interface LedgerRowDTO {
  readonly key: string;
  readonly origin: LedgerOrigin;
  readonly participation_id: string | null;
  readonly crew_assignment_id: string | null;
  readonly cost_item_id: string | null;
  readonly payee_name: string;
  readonly payee_role: string;
  readonly seat_status: string | null;
  readonly billable: boolean;
  readonly orphaned: boolean;
  readonly counted: boolean;
  readonly is_priced: boolean;
  readonly is_paid: boolean;
  readonly category: CostCategory | "";
  readonly form: FeeForm | "";
  /** The form `default_form_for` picks; null for a one-off payee. */
  readonly default_form: FeeForm | null;
  readonly contract_amount: DecimalString | null;
  readonly employer_contributions: DecimalString | null;
  readonly cost_amount: DecimalString | null;
  readonly in_kind_hours: DecimalString | null;
  readonly in_kind_hourly_rate: DecimalString | null;
  readonly in_kind_value: DecimalString | null;
  readonly incurred_on: IsoDate;
  readonly due_on: IsoDate | null;
  readonly paid_on: IsoDate | null;
  readonly paid_marked_at: string | null;
  readonly document_number: string;
  readonly document_date: IsoDate | null;
  readonly vendor_nip: string;
  readonly note: string;
  /** The live contract (issued or signed); an annulled one is never here. */
  readonly contract: ContractDTO | null;
}

export interface CategoryTotalDTO {
  readonly category: CostCategory;
  readonly committed: DecimalString;
  readonly paid: DecimalString;
}

/**
 * Committed is every counted fee's cost, outstanding what of it is unpaid,
 * in-kind the valuation of volunteer work (never a cost).
 */
export interface BudgetSummaryDTO {
  readonly committed: DecimalString;
  readonly paid: DecimalString;
  readonly outstanding: DecimalString;
  readonly in_kind: DecimalString;
  readonly by_category: readonly CategoryTotalDTO[];
  readonly rows: number;
  readonly priced: number;
  readonly unpriced: number;
  readonly paid_count: number;
  readonly orphaned: number;
  readonly volunteers: number;
}

export interface BudgetWarningDTO {
  readonly code: string;
  readonly severity: WarningSeverity;
  /** Ledger row keys. */
  readonly subject_ids: readonly string[];
  readonly params: Readonly<Record<string, string | number>>;
}

export interface BudgetProjectDTO {
  readonly id: string;
  readonly title: string;
  readonly date_time: string;
  readonly timezone: string;
  readonly status: string;
}

export interface BudgetStateDTO {
  readonly id: string;
  readonly status: BudgetStatus;
  readonly approved_at: string | null;
  readonly closed_at: string | null;
  readonly internal_note: string;
  readonly patron_summary: string;
}

/** `GET projects/{id}/budget/`, and the answer to every ledger write. */
export interface ProjectBudgetDTO {
  readonly project: BudgetProjectDTO;
  readonly budget: BudgetStateDTO | null;
  readonly summary: BudgetSummaryDTO;
  readonly warnings: readonly BudgetWarningDTO[];
  readonly ledger: readonly LedgerRowDTO[];
}

export interface ProjectRollupDTO {
  readonly project: BudgetProjectDTO;
  readonly budget_status: BudgetStatus;
  readonly summary: BudgetSummaryDTO;
  readonly warning_counts: Readonly<Record<WarningSeverity, number>>;
}

export interface PayableDTO {
  readonly cost_item_id: string;
  readonly project_id: string;
  readonly project_title: string;
  readonly project_date_time: string;
  readonly payee_name: string;
  readonly payee_role: string;
  readonly category: CostCategory;
  readonly form: FeeForm | "";
  readonly cost_amount: DecimalString | null;
  readonly incurred_on: IsoDate;
  readonly due_on: IsoDate | null;
}

export interface FinanceOverviewDTO {
  readonly projects: readonly ProjectRollupDTO[];
  readonly payables: {
    readonly count: number;
    readonly limit: number;
    readonly offset: number;
    readonly results: readonly PayableDTO[];
  };
}

// ── Writes ────────────────────────────────────────────────────────────────

export type FeeRef =
  | { readonly participation: string }
  | { readonly crew_assignment: string }
  | { readonly cost_item: string };

/**
 * One row of a pricing batch. `contract_amount` is always sent (null clears
 * the price); the optional money fields are touched only when present.
 */
export interface FeeItemPayload {
  readonly ref: FeeRef;
  readonly contract_amount: DecimalString | null;
  readonly form?: FeeForm;
  readonly employer_contributions?: DecimalString | null;
  readonly in_kind_hours?: DecimalString | null;
  readonly in_kind_hourly_rate?: DecimalString | null;
}

export interface FeeBatchPayload {
  readonly standard_rate?: {
    readonly cast?: DecimalString;
    readonly crew?: DecimalString;
  };
  readonly items: readonly FeeItemPayload[];
}

export interface OneOffFeePayload {
  readonly payee_name: string;
  readonly payee_role: string;
  readonly category: FeeCategory;
  readonly form: FeeForm;
  readonly contract_amount: DecimalString | null;
}

/** Bookkeeping details of one item; only the fields sent change. */
export interface CostItemDetailsPayload {
  readonly payee_name?: string;
  readonly payee_role?: string;
  readonly category?: FeeCategory;
  readonly due_on?: IsoDate | null;
  readonly note?: string;
  readonly document_number?: string;
  readonly document_date?: IsoDate | null;
  readonly vendor_nip?: string;
}

export interface PayFeesPayload {
  readonly ids: readonly string[];
  readonly paid_on: IsoDate;
}

export interface SignContractPayload {
  readonly signed_on: IsoDate;
  readonly signed_copy_location: string;
}

export interface ContractsZipStatusDTO {
  readonly state: string;
  readonly count?: number;
  readonly file_url?: string;
  readonly error_code?: string;
}
