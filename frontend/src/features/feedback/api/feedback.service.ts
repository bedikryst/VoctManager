/**
 * @file feedback.service.ts
 * @description Transport for in-app feedback. One endpoint, one direction —
 * members write reports, they do not read them back.
 * @module features/feedback/api/feedback.service
 */

import api from "@/shared/api/api";
import type { FeedbackReportPayload } from "../types/feedback.dto";

export const FEEDBACK_ENDPOINT = "/api/feedback/";

export const FeedbackService = {
  submit: async (payload: FeedbackReportPayload): Promise<void> => {
    await api.post(FEEDBACK_ENDPOINT, payload);
  },
};
