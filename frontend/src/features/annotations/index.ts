/**
 * @file index.ts
 * @description Public surface of the score-annotations feature.
 * @module features/annotations
 */

export { useScoreAnnotator } from "./useScoreAnnotator";
export type {
  ScoreAnnotatorBindings,
  ScoreAnnotatorMode,
  UseScoreAnnotatorOptions,
} from "./useScoreAnnotator";
export { ScoreStandModal } from "./components/ScoreStandModal";
export type { ScoreStandModalProps } from "./components/ScoreStandModal";
export type { ScoreAnnotation } from "./types/annotations.dto";
