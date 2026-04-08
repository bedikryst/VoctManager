/**
 * @file projectDomain.ts
 * @description Centralized domain constants for the Project module.
 * Ensures type safety and eliminates "magic strings" across the application.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/constants
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
  DONE: "DONE",
  ALL: "ALL",
} as const;

export type ProjectFilterId =
  (typeof PROJECT_FILTER)[keyof typeof PROJECT_FILTER];

export const PROJECT_EXPORT = {
  CALL_SHEET: "export_call_sheet",
  ZAIKS: "export_zaiks",
  DTP: "export_dtp",
} as const;

export type ProjectExportId =
  (typeof PROJECT_EXPORT)[keyof typeof PROJECT_EXPORT];
