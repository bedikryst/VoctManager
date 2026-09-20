/**
 * @file useDivisiDraft.ts
 * @description Local draft of a divisi list plus the three mutators
 * [DivisiEditor] expects. Owned by whichever surface edits a divisi before
 * saving it as one act: the manual-create form ([usePieceFormState]) and the
 * bulk layout sheet ([BulkDivisiSheet]).
 * @architecture Enterprise SaaS 2026
 * @module features/archive/hooks/useDivisiDraft
 */

import { useCallback, useState } from "react";

import type { VoiceLine } from "@/shared/types";
import type { VoiceRequirementDTO } from "../types/archive.dto";

export interface DivisiDraft {
  requirements: VoiceRequirementDTO[];
  setRequirements: (v: VoiceRequirementDTO[]) => void;
  adjustRequirement: (index: number, delta: number) => void;
  removeRequirement: (index: number) => void;
  addRequirement: (voiceLine: VoiceLine, editionId?: string | null) => void;
}

export const useDivisiDraft = (
  initial: VoiceRequirementDTO[] = [],
): DivisiDraft => {
  const [requirements, setRequirements] =
    useState<VoiceRequirementDTO[]>(initial);

  const adjustRequirement = useCallback((index: number, delta: number) => {
    setRequirements((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        quantity: Math.max(1, next[index].quantity + delta),
      };
      return next;
    });
  }, []);

  const removeRequirement = useCallback((index: number) => {
    setRequirements((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  // Uniqueness is per LAYER: the same line may exist once piece-wide and once
  // inside an arrangement that overrides it. Only a repeat within one layer is
  // a duplicate.
  const addRequirement = useCallback(
    (voiceLine: VoiceLine, editionId: string | null = null) => {
      setRequirements((prev) =>
        prev.some(
          (r) =>
            r.voice_line === voiceLine && (r.edition ?? null) === editionId,
        )
          ? prev
          : [...prev, { voice_line: voiceLine, quantity: 1, edition: editionId }],
      );
    },
    [],
  );

  return {
    requirements,
    setRequirements,
    adjustRequirement,
    removeRequirement,
    addRequirement,
  };
};
