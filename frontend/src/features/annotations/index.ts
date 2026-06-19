/**
 * @file index.ts
 * @description Public surface of the score-annotations feature.
 * @module features/annotations
 */

export { useScoreAnnotator } from "./useScoreAnnotator";
export type {
  ScoreAnnotatorBindings,
  UseScoreAnnotatorOptions,
} from "./useScoreAnnotator";
export type { ScoreAnnotation } from "./types/annotations.dto";
