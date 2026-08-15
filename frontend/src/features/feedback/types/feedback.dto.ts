/**
 * @file feedback.dto.ts
 * @description Wire contract for in-app feedback. Mirrors `core.FeedbackReport`
 * and the serializer's context whitelist.
 * @module features/feedback/types/feedback.dto
 */

/** The reporter's own classification. Values match `core.models.FeedbackKind`. */
export type FeedbackKind = "BUG" | "CONFUSING" | "IDEA" | "PRAISE";

/** Client environment snapshot. Keys must exist in the backend whitelist. */
export interface FeedbackContext {
  user_agent: string;
  platform: string;
  viewport: string;
  screen: string;
  pixel_ratio: string;
  locale: string;
  timezone: string;
  display_mode: string;
  connection: string;
  online: boolean;
  app_version: string;
  captured_at: string;
  last_error?: string;
}

export interface FeedbackReportPayload {
  kind: FeedbackKind;
  body: string;
  route: string;
  context: FeedbackContext;
}
