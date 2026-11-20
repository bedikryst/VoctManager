/**
 * @file voiceBar.ts
 * @description The divisi of the piece card as layers of voice tokens, and the
 * edits the bar makes to the full requirement list.
 *
 * The piece PATCH replaces every layer at once: the server deletes the piece's
 * requirement rows and writes the list it is sent. Every edit here therefore
 * returns the whole list, never one layer's slice.
 * @module features/archive/piece-card/voiceBar
 */

import { voiceFamilyOf } from "@/shared/lib/voiceFamilies";
import type { Piece, VoiceLine } from "@/shared/types";
import type { VoiceRequirementDTO } from "../types/archive.dto";

export type Requirements = readonly VoiceRequirementDTO[];

export interface VoiceLayer {
  /** `null` is the piece-wide layer. */
  readonly editionId: string | null;
  readonly lines: Requirements;
  readonly total: number;
}

export interface VoiceLayout {
  /** Layers carry edition labels only where there is something to tell apart. */
  readonly labelled: boolean;
  readonly layers: readonly VoiceLayer[];
  /** Editions in the bar's order that sing the piece-wide layer. */
  readonly inheriting: readonly string[];
}

const layerOf = (requirement: VoiceRequirementDTO): string | null => requirement.edition ?? null;

/**
 * The read rows in the write shape. A soft-deleted edition leaves its divisi
 * rows behind, and the PATCH refuses a list that names an edition the piece no
 * longer has, so those rows are dropped here; the next write removes them.
 */
export const writableRequirements = (
  piece: Pick<Piece, "editions" | "voice_requirements_read">,
): VoiceRequirementDTO[] => {
  const live = new Set((piece.editions ?? []).map((edition) => edition.id));
  return (piece.voice_requirements_read ?? [])
    .filter((row) => !row.edition || live.has(row.edition))
    .map((row) => ({ voice_line: row.voice_line, quantity: row.quantity, edition: row.edition ?? null }));
};

export const sameRequirements = (a: Requirements, b: Requirements): boolean => {
  const key = (r: VoiceRequirementDTO) => `${layerOf(r) ?? ""}|${r.voice_line}|${r.quantity}`;
  if (a.length !== b.length) return false;
  const keys = new Set(b.map(key));
  return a.every((r) => keys.has(key(r)));
};

/**
 * Layers in the order the reader expects: the piece-wide one first, then each
 * edition (in `editionIds` order) that declares its own lines or that the
 * reader has just opened. A piece with fewer than two editions and no edition
 * layer has one unlabelled bar. Lines follow score order (`lineOrder`).
 */
export const voiceLayout = (
  requirements: Requirements,
  editionIds: readonly string[],
  lineOrder: readonly string[],
  opened: ReadonlySet<string> = new Set(),
): VoiceLayout => {
  const rank = (line: string) => {
    const index = lineOrder.indexOf(line);
    return index < 0 ? lineOrder.length : index;
  };
  const layer = (editionId: string | null): VoiceLayer => {
    const lines = requirements
      .filter((r) => layerOf(r) === editionId)
      .sort((a, b) => rank(a.voice_line) - rank(b.voice_line));
    return { editionId, lines, total: lines.reduce((sum, r) => sum + r.quantity, 0) };
  };

  const own = editionIds.filter((id) => opened.has(id) || requirements.some((r) => layerOf(r) === id));
  const labelled = editionIds.length >= 2 || own.length > 0;
  return {
    labelled,
    layers: [layer(null), ...(labelled ? own.map(layer) : [])],
    inheriting: labelled ? editionIds.filter((id) => !own.includes(id)) : [],
  };
};

/**
 * The token's short name: an S/A/T/B/V line by its code, without the index
 * while it is the only line of its family in the layer (`S`, or `S1 · S2`).
 * Other lines have no customary letter; `null` tells the caller to use the
 * line's name.
 */
export const voiceToken = (line: string, layerLines: readonly string[]): string | null => {
  const family = voiceFamilyOf(line);
  if (!/^[SATBV]$/.test(family)) return null;
  const members = layerLines.filter((other) => voiceFamilyOf(other) === family);
  return members.length === 1 ? family : line;
};

const sameLine = (editionId: string | null, line: string) =>
  (r: VoiceRequirementDTO) => layerOf(r) === editionId && r.voice_line === line;

export const addLine = (requirements: Requirements, editionId: string | null, line: VoiceLine): VoiceRequirementDTO[] =>
  requirements.some(sameLine(editionId, line))
    ? [...requirements]
    : [...requirements, { voice_line: line, quantity: 1, edition: editionId }];

export const setQuantity = (
  requirements: Requirements,
  editionId: string | null,
  line: string,
  quantity: number,
): VoiceRequirementDTO[] => {
  const match = sameLine(editionId, line);
  return requirements.map((r) => (match(r) ? { ...r, quantity: Math.max(1, Math.round(quantity)) } : r));
};

export const removeLine = (requirements: Requirements, editionId: string | null, line: string): VoiceRequirementDTO[] => {
  const match = sameLine(editionId, line);
  return requirements.filter((r) => !match(r));
};

/**
 * An edition's own divisi starts from the piece-wide lines: its layer replaces
 * the shared one outright, so the usual edit is a difference of one or two
 * lines, not a list typed from nothing.
 */
export const startEditionLayer = (requirements: Requirements, editionId: string): VoiceRequirementDTO[] => [
  ...requirements.filter((r) => layerOf(r) !== editionId),
  ...requirements
    .filter((r) => layerOf(r) === null)
    .map((r) => ({ voice_line: r.voice_line, quantity: r.quantity, edition: editionId })),
];
