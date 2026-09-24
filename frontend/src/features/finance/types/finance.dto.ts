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

/** The server's order of categories, which is the kosztorys order. */
export const COST_CATEGORIES: readonly CostCategory[] = [
  "PERSONNEL_ARTISTIC",
  "PERSONNEL_TECHNICAL",
  "VENUE",
  "TRAVEL",
  "ACCOMMODATION",
  "CATERING",
  "MATERIALS",
  "EQUIPMENT",
  "PROMOTION",
  "RECORDING",
  "ADMINISTRATION",
  "OTHER",
];

/** The two sides a fee sits on; a one-off payee states which. */
export type FeeCategory = Extract<
  CostCategory,
  "PERSONNEL_ARTISTIC" | "PERSONNEL_TECHNICAL"
>;

export const FEE_CATEGORIES: readonly FeeCategory[] = [
  "PERSONNEL_ARTISTIC",
  "PERSONNEL_TECHNICAL",
];

/** Every other category is an expense's: a person is always paid as a fee. */
export const EXPENSE_CATEGORIES: readonly CostCategory[] = COST_CATEGORIES.filter(
  (category) => !(FEE_CATEGORIES as readonly CostCategory[]).includes(category),
);

export const isFeeCategory = (category: CostCategory | ""): category is FeeCategory =>
  (FEE_CATEGORIES as readonly string[]).includes(category);

export type PlanUnit =
  | "PERSON"
  | "PIECE"
  | "SERVICE"
  | "HOUR"
  | "DAY"
  | "NIGHT"
  | "KM"
  | "LUMP_SUM";

export const PLAN_UNITS: readonly PlanUnit[] = [
  "PERSON",
  "PIECE",
  "SERVICE",
  "HOUR",
  "DAY",
  "NIGHT",
  "KM",
  "LUMP_SUM",
];

export type ExpenseDocumentType = "INVOICE" | "BILL" | "RECEIPT" | "OTHER";

export const EXPENSE_DOCUMENT_TYPES: readonly ExpenseDocumentType[] = [
  "INVOICE",
  "BILL",
  "RECEIPT",
  "OTHER",
];

/** "I" — koszty realizacji działań; "II" — koszty administracyjne. */
export type PlanSection = "I" | "II";

export type ContractStatus = "ISSUED" | "SIGNED" | "ANNULLED";

export type BudgetStatus = "PLANNING" | "APPROVED" | "CLOSED";

export type LedgerOrigin = "cast" | "crew" | "one_off";

export type WarningSeverity = "work" | "problem";

export type FundingKind =
  | "PUBLIC_GRANT"
  | "PRIVATE_GRANT"
  | "SPONSOR"
  | "DONATIONS"
  | "TICKETS"
  | "OWN_FUNDS"
  | "IN_KIND"
  | "VOLUNTEER_WORK";

export const FUNDING_KINDS: readonly FundingKind[] = [
  "PUBLIC_GRANT",
  "PRIVATE_GRANT",
  "SPONSOR",
  "DONATIONS",
  "TICKETS",
  "OWN_FUNDS",
  "IN_KIND",
  "VOLUNTEER_WORK",
];

export type FundingStatus = "PLANNED" | "APPLIED" | "AWARDED" | "REJECTED" | "SETTLED";

export const FUNDING_STATUSES: readonly FundingStatus[] = [
  "PLANNED",
  "APPLIED",
  "AWARDED",
  "REJECTED",
  "SETTLED",
];

/** The words a document note may interpolate — the server's own list. */
export const DOCUMENT_NOTE_PLACEHOLDERS = [
  "document_number",
  "document_amount",
  "source_amount",
  "source_name",
  "grantor",
  "agreement_number",
  "agreement_date",
  "plan_line",
] as const;

/** One source's share of a plan line or of a cost. */
export interface AllocationDTO {
  readonly funding_id: string;
  readonly amount: DecimalString;
}

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
  /** The plan line the fee is charged to; null is outside the plan. */
  readonly budget_line_id: string | null;
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
  /** The sources the fee is charged to. */
  readonly allocations: readonly AllocationDTO[];
  readonly allocated: DecimalString;
  /** What can be split between sources: the cost, or a volunteer's valuation. */
  readonly allocatable: DecimalString;
  /** What no source covers yet. */
  readonly unallocated: DecimalString;
}

export interface AttachmentDTO {
  readonly id: string;
  readonly original_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly uploaded_at: string;
}

/** A cost that is not a person's fee; its cost is its document's gross. */
export interface ExpenseRowDTO {
  readonly id: string;
  readonly category: CostCategory;
  readonly budget_line_id: string | null;
  readonly vendor_name: string;
  readonly vendor_nip: string;
  readonly document_type: ExpenseDocumentType | "";
  readonly document_number: string;
  readonly document_date: IsoDate | null;
  readonly description: string;
  readonly cost_amount: DecimalString;
  readonly incurred_on: IsoDate;
  readonly due_on: IsoDate | null;
  readonly paid_on: IsoDate | null;
  readonly paid_marked_at: string | null;
  readonly is_paid: boolean;
  readonly note: string;
  readonly attachments: readonly AttachmentDTO[];
  readonly allocations: readonly AllocationDTO[];
  readonly allocated: DecimalString;
  readonly unallocated: DecimalString;
}

/**
 * A kosztorys line in kosztorys order. `number` ("I.3") and `planned_amount`
 * (quantity × unit cost) are the server's; `actual` sums the counted costs
 * charged to the line. `allocations` is the plan's split between sources;
 * `tolerance_pct` the overrun its sources allow, `over_tolerance` whether the
 * actual is past it (which is what raises LINE_OVER_PLAN).
 */
export interface PlanLineDTO {
  readonly id: string;
  readonly number: string;
  readonly section: PlanSection;
  readonly category: CostCategory;
  readonly name: string;
  readonly position: number;
  readonly unit: PlanUnit;
  readonly quantity: DecimalString;
  readonly unit_cost: DecimalString;
  readonly planned_amount: DecimalString;
  readonly note: string;
  readonly actual: DecimalString;
  readonly paid: DecimalString;
  readonly cost_count: number;
  readonly over_plan: boolean;
  readonly allocations: readonly AllocationDTO[];
  readonly allocated: DecimalString;
  readonly unallocated: DecimalString;
  readonly tolerance_pct: DecimalString;
  readonly over_tolerance: boolean;
}

/** A source across every project it funds. */
export interface SourceFiguresDTO {
  readonly project_count: number;
  readonly planned: DecimalString;
  readonly received: DecimalString;
  readonly line_allocated: DecimalString;
  readonly charged: DecimalString;
  /** What it may carry at most: its award (0 once rejected), else what is planned. */
  readonly ceiling: DecimalString | null;
  readonly remaining: DecimalString | null;
  readonly over_awarded: boolean;
  readonly own_share_plan_pct: DecimalString | null;
  readonly own_share_actual_pct: DecimalString | null;
  readonly own_share_below: boolean;
  readonly admin_plan_pct: DecimalString | null;
  readonly admin_actual_pct: DecimalString | null;
  readonly admin_cap_exceeded: boolean;
}

/** A funding source: organisation-level, with its rules and its figures. */
export interface FundingSourceDTO {
  readonly id: string;
  readonly kind: FundingKind;
  readonly name: string;
  readonly grantor: string;
  readonly agreement_number: string;
  readonly agreement_date: IsoDate | null;
  readonly awarded_amount: DecimalString | null;
  readonly status: FundingStatus;
  readonly eligible_from: IsoDate | null;
  readonly eligible_to: IsoDate | null;
  readonly report_due_on: IsoDate | null;
  readonly required_own_share_pct: DecimalString | null;
  readonly admin_cost_cap_pct: DecimalString | null;
  readonly line_tolerance_pct: DecimalString | null;
  readonly document_note_template: string;
  readonly note: string;
  /** False for volunteer work and gifts in kind: they pay no cost. */
  readonly brings_money: boolean;
  readonly figures: SourceFiguresDTO;
}

/**
 * A source on one project. A source of money carries the project's costs up
 * to `charge_limit` (what is planned, or what arrived when that is more); the
 * flags say which limit is passed — the server's SOURCE_OVERALLOCATED.
 */
export interface ProjectFundingDTO {
  readonly id: string;
  readonly source: FundingSourceDTO;
  readonly planned_amount: DecimalString;
  readonly received_amount: DecimalString;
  readonly line_allocated: DecimalString;
  readonly charged: DecimalString;
  readonly charged_count: number;
  readonly charge_limit: DecimalString;
  readonly brings_money: boolean;
  readonly over_plan_allocation: boolean;
  readonly over_charge_limit: boolean;
  readonly overallocated: boolean;
}

/**
 * How the project is covered. Money and contributions in kind are apart:
 * `uncovered` is the counted cost no source of money carries; `plan_uncovered`
 * the plan's part no source is expected to bring (negative when they bring
 * more), null without a plan.
 */
export interface FundingSummaryDTO {
  readonly planned: DecimalString;
  readonly received: DecimalString;
  readonly charged: DecimalString;
  readonly uncovered: DecimalString;
  readonly in_kind_planned: DecimalString;
  readonly in_kind_contributed: DecimalString;
  readonly plan_uncovered: DecimalString | null;
}

export interface CategoryTotalDTO {
  readonly category: CostCategory;
  readonly committed: DecimalString;
  readonly paid: DecimalString;
}

export interface TotalsDTO {
  readonly committed: DecimalString;
  readonly paid: DecimalString;
  readonly outstanding: DecimalString;
}

/**
 * Committed is every counted cost — fees and expenses — outstanding what of it
 * is unpaid; `fees` and `expenses` split both. In-kind is the valuation of
 * volunteer work (never a cost). `planned` is the plan's total, null while the
 * budget has no plan lines; `unplanned` is the cost charged to no line.
 */
export interface BudgetSummaryDTO {
  readonly committed: DecimalString;
  readonly paid: DecimalString;
  readonly outstanding: DecimalString;
  readonly in_kind: DecimalString;
  readonly fees: TotalsDTO;
  readonly expenses: TotalsDTO;
  readonly planned: DecimalString | null;
  readonly unplanned: DecimalString;
  readonly by_category: readonly CategoryTotalDTO[];
  readonly rows: number;
  readonly priced: number;
  readonly unpriced: number;
  readonly paid_count: number;
  readonly orphaned: number;
  readonly volunteers: number;
  readonly expense_count: number;
  readonly lines: number;
}

export interface BudgetWarningDTO {
  readonly code: string;
  readonly severity: WarningSeverity;
  /** Ledger row keys, expense ids, plan line ids or project funding ids —
   * the code says which. */
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
  readonly funding: FundingSummaryDTO;
  readonly warnings: readonly BudgetWarningDTO[];
  readonly ledger: readonly LedgerRowDTO[];
  readonly expenses: readonly ExpenseRowDTO[];
  readonly lines: readonly PlanLineDTO[];
  readonly fundings: readonly ProjectFundingDTO[];
}

/** Who a project report is for: a patron (no person, no single fee) or the board. */
export type ReportAudience = "patron" | "board";

/** The kosztorys as planned, or as it actually came out. */
export type KosztorysVariant = "plan" | "actual";

export type HistorySubjectType =
  | "cost_item"
  | "contract"
  | "budget"
  | "budget_line"
  | "attachment"
  | "project_funding";

/** One act in the budget's append-only history. */
export interface HistoryEventDTO {
  readonly id: string;
  readonly at: string;
  readonly action: string;
  readonly subject_type: HistorySubjectType;
  readonly subject_id: string;
  /** What the act was about, as the record reads now; may be empty. */
  readonly subject_label: string;
  readonly actor_name: string;
  readonly before: Readonly<Record<string, unknown>>;
  readonly after: Readonly<Record<string, unknown>>;
  readonly reason: string;
}

export interface HistoryPageDTO {
  readonly count: number;
  readonly limit: number;
  readonly offset: number;
  readonly results: readonly HistoryEventDTO[];
}

export interface ProjectRollupDTO {
  readonly project: BudgetProjectDTO;
  readonly budget_status: BudgetStatus;
  readonly summary: BudgetSummaryDTO;
  readonly warning_counts: Readonly<Record<WarningSeverity, number>>;
}

export type PayableKind = "FEE" | "EXPENSE";

/**
 * A fee names its payee; an expense its vendor and what it paid for.
 * `paid_on` is set only on the paid list.
 */
export interface PayableDTO {
  readonly cost_item_id: string;
  readonly kind: PayableKind;
  readonly project_id: string;
  readonly project_title: string;
  readonly project_date_time: string;
  readonly payee_name: string;
  readonly payee_role: string;
  readonly vendor_name: string;
  readonly description: string;
  readonly category: CostCategory;
  readonly form: FeeForm | "";
  readonly cost_amount: DecimalString | null;
  readonly incurred_on: IsoDate;
  readonly due_on: IsoDate | null;
  readonly paid_on: IsoDate | null;
}

export type PayableStatus = "unpaid" | "paid";

/**
 * `GET payables/` parameters. The server refuses a key it does not expect
 * (a paid-date bound on `unpaid`, an empty value), so an absent filter is
 * left out, never sent blank.
 */
export interface PayablesQuery {
  readonly status: PayableStatus;
  readonly project?: string;
  readonly kind?: PayableKind;
  readonly paid_from?: IsoDate;
  readonly paid_to?: IsoDate;
  /** A whitelisted key, `-` for descending: `due_on`, `amount`, `payee`, `project`, `paid_on`. */
  readonly ordering?: string;
  readonly limit: number;
  readonly offset: number;
}

/** One page of the payables list; `count` and `total_amount` cover the whole filtered set. */
export interface PayablesPageDTO {
  readonly count: number;
  readonly limit: number;
  readonly offset: number;
  readonly total_amount: DecimalString;
  readonly results: readonly PayableDTO[];
}

/** `POST payables/pay/` — the projects paid on, so each one's budget is refreshed. */
export interface PayPayablesResultDTO {
  readonly count: number;
  readonly project_ids: readonly string[];
}

/** A project a source funds, with that project's figures from it. */
export interface SourceProjectDTO {
  readonly funding_id: string;
  readonly project_id: string;
  readonly project_title: string;
  readonly project_date_time: string;
  readonly budget_status: BudgetStatus;
  readonly planned_amount: DecimalString;
  readonly received_amount: DecimalString;
  readonly line_allocated: DecimalString;
  readonly charged: DecimalString;
}

/** One cost charged to a source — a line of its settlement. */
export interface SourceChargeDTO {
  readonly cost_item_id: string;
  readonly kind: "FEE" | "EXPENSE";
  readonly project_id: string;
  readonly project_title: string;
  readonly payee_name: string;
  readonly vendor_name: string;
  readonly description: string;
  readonly category: CostCategory;
  /** "I.2 Wynajem kościoła", or empty outside the plan. */
  readonly plan_line: string;
  readonly document_number: string;
  readonly incurred_on: IsoDate;
  readonly paid_on: IsoDate | null;
  readonly cost_amount: DecimalString;
  readonly amount: DecimalString;
  readonly eligible: boolean;
}

/** `GET funding-sources/{id}/` — the source's page. */
export interface SourceDetailDTO {
  readonly source: FundingSourceDTO;
  readonly projects: readonly SourceProjectDTO[];
  readonly charges: readonly SourceChargeDTO[];
}

export interface FinanceOverviewDTO {
  readonly projects: readonly ProjectRollupDTO[];
  readonly sources: readonly FundingSourceDTO[];
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

/**
 * Bookkeeping details of one fee; only the fields sent change, in one
 * transaction. `budget_line` null takes the fee out of the plan. The money
 * fields are priced against the amount stored when the edit lands.
 */
export interface CostItemDetailsPayload {
  readonly payee_name?: string;
  readonly payee_role?: string;
  readonly category?: FeeCategory;
  readonly budget_line?: string | null;
  readonly due_on?: IsoDate | null;
  readonly note?: string;
  readonly document_number?: string;
  readonly document_date?: IsoDate | null;
  readonly vendor_nip?: string;
  readonly employer_contributions?: DecimalString | null;
  readonly in_kind_hours?: DecimalString | null;
  readonly in_kind_hourly_rate?: DecimalString | null;
}

export interface PayFeesPayload {
  readonly ids: readonly string[];
  readonly paid_on: IsoDate;
}

export interface BudgetLinePayload {
  readonly category: CostCategory;
  readonly name: string;
  readonly unit: PlanUnit;
  readonly quantity: DecimalString;
  readonly unit_cost: DecimalString;
  readonly note: string;
}

export type BudgetLineUpdatePayload = Partial<BudgetLinePayload>;

export interface ExpensePayload {
  readonly category: CostCategory;
  readonly budget_line: string | null;
  readonly vendor_name: string;
  readonly vendor_nip: string;
  readonly document_type: ExpenseDocumentType;
  readonly document_number: string;
  readonly document_date: IsoDate | null;
  readonly description: string;
  readonly cost_amount: DecimalString;
  readonly due_on: IsoDate | null;
  readonly note: string;
}

/** Only the fields sent change. */
export type ExpenseUpdatePayload = Partial<ExpensePayload>;

export interface FundingSourcePayload {
  readonly kind: FundingKind;
  readonly name: string;
  readonly grantor: string;
  readonly agreement_number: string;
  readonly agreement_date: IsoDate | null;
  readonly awarded_amount: DecimalString | null;
  readonly status: FundingStatus;
  readonly eligible_from: IsoDate | null;
  readonly eligible_to: IsoDate | null;
  readonly report_due_on: IsoDate | null;
  readonly required_own_share_pct: DecimalString | null;
  readonly admin_cost_cap_pct: DecimalString | null;
  readonly line_tolerance_pct: DecimalString | null;
  /** Omitted on create: the server starts every source from its default formula. */
  readonly document_note_template?: string;
  readonly note: string;
}

/** Only the fields sent change. */
export type FundingSourceUpdatePayload = Partial<FundingSourcePayload>;

export interface ProjectFundingPayload {
  readonly source: string;
  readonly planned_amount: DecimalString;
  readonly received_amount: DecimalString;
}

export type ProjectFundingUpdatePayload = Partial<
  Omit<ProjectFundingPayload, "source">
>;

/** Every source a line or a cost is split between, replacing the set. */
export interface AllocationSetPayload {
  readonly allocations: readonly {
    readonly funding: string;
    readonly amount: DecimalString;
  }[];
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
