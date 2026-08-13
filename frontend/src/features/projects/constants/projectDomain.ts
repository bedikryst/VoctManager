/**
 * @file projectDomain.ts
 * @description Centralized domain constants for the Project module.
 * Ensures type safety and eliminates "magic strings" across the application.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/constants
 */

export const PROJECT_TABS = {
  DETAILS: "DETAILS",
  REHEARSALS: "REHEARSALS",
  MATRIX: "MATRIX",
  CAST: "CAST",
  PROGRAM: "PROGRAM",
  MICRO_CAST: "MICRO_CAST",
  CREW: "CREW",
  BUDGET: "BUDGET",
} as const;

export type ProjectTabId = keyof typeof PROJECT_TABS;

export const PROJECT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  DONE: "DONE",
  CANCELLED: "CANC",
} as const;

export type ProjectStatus =
  (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const PROJECT_FILTER = {
  ACTIVE: "ACTIVE",
  // Unpublished projects. They also remain under ACTIVE — a draft is genuinely
  // in preparation — so this is a lens on the same list, not a separate bucket.
  DRAFT: "DRAFT",
  DONE: "DONE",
  ALL: "ALL",
} as const;

export type ProjectFilterId =
  (typeof PROJECT_FILTER)[keyof typeof PROJECT_FILTER];

// Two documents with irreconcilable readers: the day card is executed minutes
// before the downbeat, the report is inspected at a desk weeks out. The backend
// keys them by `DocumentKind`; the URLs kept their historic names.
export const PROJECT_EXPORT = {
  CALL_SHEET: "export_call_sheet",
  DAY_CARD: "export_day_sheet",
  ZAIKS: "export_zaiks",
  DTP: "export_dtp",
} as const;

export type ProjectExportId =
  (typeof PROJECT_EXPORT)[keyof typeof PROJECT_EXPORT];
