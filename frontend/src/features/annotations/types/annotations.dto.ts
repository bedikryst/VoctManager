/**
 * @file annotations.dto.ts
 * @description Wire types for score annotations — the conductor's PDF markup
 * overlay (freehand ink, highlighter, pinned/inline rehearsal notes). All
 * geometry is stored NORMALIZED to the page box (0..1) so a marking lands in the
 * same musical spot at any zoom, on any screen. Shapes mirror the server-side
 * validator in `archive.serializers.AnnotationSerializer`.
 * @module features/annotations/types
 */

/** Backend `Annotation.annotation_type` codes. FH ink · HL highlighter · CM note · ST musical stamp. */
export type AnnotationKind = "FH" | "CM" | "HL" | "ST";

/**
 * `shared` markings are pushed to every chorister cast in a live project that
 * programs the piece; `conductor` markings are the maestro's private cues;
 * `leader` markings are the cues he writes for whoever runs a rehearsal in his
 * place, readable by that person and nobody else in the choir; `personal`
 * markings are one user's own pencil marks — scoped server-side to their creator
 * and invisible to everyone else (managers included).
 *
 * `leader` is separate from `conductor` rather than a permission over it because
 * that layer carries what he thinks about the singers: opening it to one of them
 * would open the remarks about their own section.
 */
export type AnnotationLayer = "shared" | "conductor" | "leader" | "personal";

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

/**
 * Text note anchored at a normalized point; `display` chooses pin vs inline.
 * `scale` multiplies the base font size (missing ⇒ 1, legacy notes).
 */
export interface CommentPayload {
  x: number;
  y: number;
  text: string;
  display?: NoteDisplay;
  scale?: number;
}

/**
 * Musical stamp (ST) anchored at a normalized point; `symbol` is a StampDef id.
 * `scale` multiplies the stamp's base size (missing ⇒ 1, legacy stamps).
 */
export interface StampPayload {
  x: number;
  y: number;
  symbol: string;
  scale?: number;
}

export type AnnotationPayload = FreehandPayload | CommentPayload | StampPayload;

/**
 * A mark's kind and the payload that kind carries, as one discriminated pair:
 * narrowing on `annotation_type` types the payload with it. The server
 * validates each payload against its kind, so a row read back always matches;
 * the guards below still check the shape, because a row cached or queued by an
 * older build is read back as it was stored.
 */
export type MarkContent =
  | { annotation_type: "FH"; payload: FreehandPayload }
  | { annotation_type: "HL"; payload: FreehandPayload }
  | { annotation_type: "CM"; payload: CommentPayload }
  | { annotation_type: "ST"; payload: StampPayload };

/** What a writer decides about a new mark; the edition and the identity come later. */
export type MarkDraft = MarkContent & {
  page_number: number;
  color: string;
  layer_name: string;
};

export type ScoreAnnotation = MarkDraft & {
  id: string;
  edition: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /**
   * When the mark last said something new — drawn, restored, its words or
   * symbol changed, or readdressed. A move, resize or recolour leaves it. What
   * a reader is told is new keys on this. Absent on rows cached or queued by a
   * build that predates it; such a row is never new.
   */
  content_at?: string;
};

export type FreehandMark = ScoreAnnotation & { annotation_type: "FH" };
export type HighlightMark = ScoreAnnotation & { annotation_type: "HL" };
export type CommentMark = ScoreAnnotation & { annotation_type: "CM" };
export type StampMark = ScoreAnnotation & { annotation_type: "ST" };
/** Ink and highlighter: one payload, and every rule that draws or moves one. */
export type StrokeMark = FreehandMark | HighlightMark;

/**
 * What the score stand polls while it is open: how many marks this reader may
 * see on the edition, and the newest touch among them. Either moving means the
 * page is out of date — a mark drawn, edited, erased or wiped, by the conductor
 * mid-rehearsal or by this reader on another device.
 */
export interface MarkFingerprint {
  count: number;
  /** ISO timestamp, or null when the edition carries no marks at all. */
  latest: string | null;
  /**
   * How far this reader has looked at the edition's marks: anything whose
   * `content_at` is later is new to them. The server starts it at the first
   * open, so null only for an edition that is gone.
   */
  seen_at: string | null;
}

/**
 * One set of marks a manager put aside on an edition ("Odłóż uwagi"), named by
 * the moment it was put aside — the same moment restores it.
 */
export interface SetAsideSet {
  archived_at: string;
  count: number;
}

/** A programme piece whose choir marks the cast has not been told about. */
export interface MarkedPieceNews {
  piece_id: string;
  title: string;
  composer_name: string;
  /** How many of its choir marks said something new since the last notice. */
  count: number;
}

/** What "Powiadom chór" would send if pressed now. */
export interface MarksNews {
  /** The window's start: the last notice, or the project's creation. */
  since: string;
  notified_at: string | null;
  /** When the cooldown after the last notice ends; null once a press is allowed. */
  next_allowed_at: string | null;
  /** How many people a press would reach. */
  recipients: number;
  pieces: MarkedPieceNews[];
  /**
   * Set by the client, not the wire: how long the cooldown still ran when the
   * server answered, measured on the server's own clock (`next_allowed_at`
   * against the answer's `Date`). Added to when the answer arrived, it places
   * the cooldown's end on this device's clock without trusting that clock to
   * agree with the server's. Null once a press is allowed.
   */
  cooldown_ms: number | null;
}

/** Create payload — `edition` is injected by the mutation layer. */
export type NewAnnotation = MarkDraft & { edition: string };

/**
 * Patchable subset for editing an existing marking (note text / display / layer).
 * A payload in a patch is always of the mark's own kind: no edit changes what a
 * mark is, and the server refuses a payload of another kind.
 */
export interface AnnotationPatch {
  payload?: AnnotationPayload;
  color?: string;
  layer_name?: string;
}

/** A row with an edit applied. The kind stays, so the payload is the row's own. */
export const withPatch = (row: ScoreAnnotation, patch: AnnotationPatch): ScoreAnnotation =>
  ({ ...row, ...patch }) as ScoreAnnotation;

/** A mark's kind and payload, carried together onto a new body. */
export const markContent = (a: MarkContent): MarkContent => {
  switch (a.annotation_type) {
    case "FH":
    case "HL":
      return { annotation_type: a.annotation_type, payload: a.payload };
    case "CM":
      return { annotation_type: "CM", payload: a.payload };
    case "ST":
      return { annotation_type: "ST", payload: a.payload };
  }
};

export const isFreehand = (a: ScoreAnnotation): a is FreehandMark =>
  a.annotation_type === "FH" && Array.isArray(a.payload?.paths);

export const isHighlight = (a: ScoreAnnotation): a is HighlightMark =>
  a.annotation_type === "HL" && Array.isArray(a.payload?.paths);

export const isStroke = (a: ScoreAnnotation): a is StrokeMark =>
  isFreehand(a) || isHighlight(a);

export const isComment = (a: ScoreAnnotation): a is CommentMark =>
  a.annotation_type === "CM" && typeof a.payload?.text === "string";

export const isStamp = (a: ScoreAnnotation): a is StampMark =>
  a.annotation_type === "ST" && typeof a.payload?.symbol === "string";
