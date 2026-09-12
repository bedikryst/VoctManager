/**
 * @file layers.ts
 * @description Which layer a mark belongs to, answered once.
 *
 * `layer_name` is a free string on the wire (ad-hoc names like
 * `rehearsal-2026-05-18` are still possible), so every reader has to fold it
 * onto one of the four the panel knows. That fold lived in two components and
 * they agreed only by accident: both ended in `: "shared"`, which means a layer
 * neither had heard of was drawn as the CHOIR's — the one bucket where being
 * wrong publishes something. One function, and the fallback is stated once.
 * @module features/annotations/lib
 */

import type { AnnotationLayer, ScoreAnnotation } from "../types/annotations.dto";

/**
 * The layer this mark is rendered and counted as.
 *
 * An unrecognised name reads as `shared` because that is how the server treats
 * it for a manager (everything that is not somebody's `personal` is theirs to
 * see) — and because these marks only ever reach a reader the server already
 * decided may have them. The fold decides presentation, never access.
 */
export const layerOf = (a: ScoreAnnotation): AnnotationLayer => {
  switch (a.layer_name) {
    case "conductor":
      return "conductor";
    case "leader":
      return "leader";
    case "personal":
      return "personal";
    default:
      return "shared";
  }
};

/** Layers that are addressed to SOMEBODY IN PARTICULAR rather than the choir —
 *  drawn with the private treatment, and never described as "from the conductor"
 *  to the whole ensemble. */
export const isPrivateLayer = (a: ScoreAnnotation): boolean =>
  layerOf(a) !== "shared";
