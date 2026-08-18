/**
 * @file eventLabel.ts
 * @description What one row of the atlas's schedule is called. `LogisticsEvent.type`
 * separates a project from a rehearsal and nothing more — it is a discriminator,
 * not a name — so a project row is named for what the ensemble is actually singing
 * at, from the same table the run sheet and the printed day card read.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/lib/eventLabel
 */

import {
  getEventMomentPresentation,
  type LabelPresentation,
} from "@/features/projects/lib/projectPresentation";

import type { LogisticsEvent } from "../hooks/useLogisticsEvents";

/** A rehearsal is a rehearsal whatever it prepares; a project names its kind. */
export const getLogisticsEventPresentation = (
  event: Pick<LogisticsEvent, "type" | "eventKind">,
): LabelPresentation =>
  event.type === "CONCERT"
    ? getEventMomentPresentation(event.eventKind)
    : { labelKey: "logistics.event.rehearsal", fallbackLabel: "Próba" };
