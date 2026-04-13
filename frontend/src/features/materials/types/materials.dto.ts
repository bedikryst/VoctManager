/**
 * @file materials.dto.ts
 * @description Feature-local DTOs and view models for the Materials domain.
 */

import type {
  Composer,
  Participation,
  Piece,
  PieceCasting,
  Project,
  Track,
} from "@/shared/types";

export interface EnrichedPiece extends Piece {
  composerData: Composer | null;
  myCasting: PieceCasting | null;
  allCastings: PieceCasting[];
  tracks: Track[];
}

export interface ProjectMaterialGroup {
  project: Project;
  participation: Participation;
  pieces: EnrichedPiece[];
}
