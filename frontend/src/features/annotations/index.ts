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
export { ScoreBookModal } from "./components/ScoreBookModal";
export type { ScoreBookModalProps } from "./components/ScoreBookModal";
export { buildScoreBook, EMPTY_SCORE_BOOK } from "./lib/scoreBook";
export type { BookItem, BookPageFrame, ScoreBook } from "./lib/scoreBook";
export { prefetchEditionAnnotations } from "./api/annotations.prefetch";
export type { ScoreAnnotation } from "./types/annotations.dto";
