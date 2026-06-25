/**
 * @file annotations.dto.ts
 * @description Wire types for score annotations — the conductor's PDF markup
 * overlay (freehand ink, highlighter, pinned/inline rehearsal notes). All
 * geometry is stored NORMALIZED to the page box (0..1) so a marking lands in the
 * same musical spot at any zoom, on any screen. Shapes mirror the server-side
 * validator in `archive.serializers.AnnotationSerializer`.
 * @module features/annotations/types
 */

/** Backend `Annotation.annotation_type` codes. FH ink · HL highlighter · CM note · ST reserved. */
export type AnnotationKind = "FH" | "CM" | "HL" | "ST";

/**
 * `shared` markings are pushed to every chorister cast in a live project that
 * programs the piece; `conductor` markings are the maestro's private cues.
 */
export type AnnotationLayer = "shared" | "conductor";

/** How a text note renders: a clickable `pin`, or the words drawn `inline` on the page. */
export type NoteDisplay = "pin" | "inline";

/** A single freehand point in normalized page space (0..1, 0..1). */
export type NormPoint = readonly [number, number];

/**
 * Freehand ink (FH) and highlighter (HL) share this shape: one or more strokes,
 * `width` a fraction of page width. The kind decides how it renders (opaque ink
 * vs. translucent marker).
 */
export interface FreehandPayload {
  paths: NormPoint[][];
  width: number;
}

/** Text note anchored at a normalized point; `display` chooses pin vs inline. */
export interface CommentPayload {
  x: number;
  y: number;
  text: string;
  display?: NoteDisplay;
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

/** Patchable subset for editing an existing marking (note text / display / layer). */
export interface AnnotationPatch {
  payload?: AnnotationPayload;
  color?: string;
  layer_name?: string;
}

export const isFreehand = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: FreehandPayload } =>
  a.annotation_type === "FH" &&
  Array.isArray((a.payload as FreehandPayload)?.paths);

export const isHighlight = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: FreehandPayload } =>
  a.annotation_type === "HL" &&
  Array.isArray((a.payload as FreehandPayload)?.paths);

export const isComment = (
  a: ScoreAnnotation,
): a is ScoreAnnotation & { payload: CommentPayload } =>
  a.annotation_type === "CM" &&
  typeof (a.payload as CommentPayload)?.text === "string";
