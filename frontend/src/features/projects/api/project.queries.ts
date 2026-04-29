/**
 * @file project.queries.ts
 * @description Public React Query API for the Project domain.
 * Keep this barrel stable for feature-level imports while implementation stays split by responsibility.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

export { projectKeys } from "./project.query-keys";
export * from "./project.read.queries";
export * from "./project.project.mutations";
export * from "./project.participation.mutations";
export * from "./project.crew.mutations";
export * from "./project.rehearsal.mutations";
export * from "./project.program.mutations";
export * from "./project.piece-casting.mutations";
export * from "./project.attendance.mutations";
export * from "./project.score-pdf.mutations";
