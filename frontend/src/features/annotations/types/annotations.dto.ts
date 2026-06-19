/**
 * @file annotations.dto.ts
 * @description Wire types for score annotations — the conductor's PDF markup
 * overlay (freehand cues + pinned rehearsal comments). All geometry is stored
 * NORMALIZED to the page box (0..1) so a marking lands in the same musical
 * spot at any zoom, on any screen.
 * @module features/annotations/types
 */

/** Backend `Annotation.annotation_type` codes. MVP draws FH + CM. */
export type AnnotationKind = "FH" | "CM" | "HL" | "ST";

/**
 * `shared` markings are pushed to every chorister cast in a live project that
 * programs the piece; `conductor` markings are the maestro's private cues.
 */
export type AnnotationLayer = "shared" | "conductor";

/** A single freehand point in normalized page space (0..1, 0..1). */
export type NormPoint = readonly [number, number];

/** Freehand pen: one or more strokes; `width` is a fraction of page width. */
export interface FreehandPayload {
  paths: NormPoint[][];
  width: number;
}

/** Pinned text comment anchored at a normalized point. */
export interface CommentPayload {
  x: number;
  y: number;
  text: string;
}

export type AnnotationPayload =
  | FreehandPayload
  | CommentPayload
  | Record<string, unknown>;

export interface ScoreAnnotation {
  id: string;
  edition: string;
  page_number: number;
  annotation_type: AnnotationKind;
  payload: AnnotationPayload;
  color: string;
  layer_name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Create payload — `edition` is injected by the mutation layer. */
export interface NewAnnotation {
  edition: string;
  page_number: number;
  annotation_type: AnnotationKind;
  payload: AnnotationPayload;
  color: string;
  layer_name: string;
}

export const isFreehand = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: FreehandPayload } =>
  a.annotation_type === "FH" &&
  Array.isArray((a.payload as FreehandPayload)?.paths);

export const isComment = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: CommentPayload } =>
  a.annotation_type === "CM" &&
  typeof (a.payload as CommentPayload)?.text === "string";
