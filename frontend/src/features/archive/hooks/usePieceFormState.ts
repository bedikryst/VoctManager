/**
 * @file usePieceFormState.ts
 * @description Shared RHF + side-state controller for the Piece form used
 * by both [ArchiveNewPiecePage] (create) and [ArchiveEditPiecePage] (edit).
 *
 * Wraps:
 *   - The Zod-validated RHF form (text/numeric fields)
 *   - Composer picker state (existing FK selection OR inline-create draft)
 *   - Divisi requirements list (voice_requirements)
 *
 * Each page handles its own submit (createPiece vs updatePiece). The hook
 * just owns the unified shape so the form body component doesn't care
 * which mode it's in.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/hooks/usePieceFormState
 */

import { useCallback, useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { VoiceLine } from "@/shared/types";
import type { VoiceRequirementDTO } from "../types/archive.dto";

export const pieceFormSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany").max(200),
  arranger: z.string().max(150).default(""),
  language: z.string().max(50).default(""),
  voicing: z.string().max(50).default(""),
  description: z.string().default(""),
  duration_mins: z
    .union([z.coerce.number().int().min(0).max(600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  duration_secs: z
    .union([z.coerce.number().int().min(0).max(59), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  composition_year: z
    .union([z.coerce.number().int().min(500).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  epoch: z.string().max(4).default(""),
  lyrics_original: z.string().default(""),
});

export type PieceFormValues = z.infer<typeof pieceFormSchema>;

export interface InlineComposerDraft {
  first_name: string;
  last_name: string;
  birth_year: string;
  death_year: string;
}

export const EMPTY_COMPOSER_DRAFT: InlineComposerDraft = {
  first_name: "",
  last_name: "",
  birth_year: "",
  death_year: "",
};

export const EMPTY_FORM_DEFAULTS: PieceFormValues = {
  title: "",
  arranger: "",
  language: "",
  voicing: "",
  description: "",
  duration_mins: 0,
  duration_secs: 0,
  composition_year: null,
  epoch: "",
  lyrics_original: "",
};

export interface PieceFormStateInitial {
  values?: Partial<PieceFormValues>;
  composerId?: string;
  requirements?: VoiceRequirementDTO[];
}

export interface PieceFormState {
  form: UseFormReturn<PieceFormValues>;
  composerId: string;
  setComposerId: (id: string) => void;
  isAddingComposer: boolean;
  setIsAddingComposer: (v: boolean) => void;
  composerDraft: InlineComposerDraft;
  setComposerDraft: (v: InlineComposerDraft) => void;
  requirements: VoiceRequirementDTO[];
  setRequirements: (v: VoiceRequirementDTO[]) => void;
  adjustRequirement: (index: number, delta: number) => void;
  removeRequirement: (index: number) => void;
  addRequirement: (voiceLine: VoiceLine) => void;
}

export const usePieceFormState = (
  initial: PieceFormStateInitial = {},
): PieceFormState => {
  const defaults = useMemo<PieceFormValues>(
    () => ({ ...EMPTY_FORM_DEFAULTS, ...(initial.values ?? {}) }),
    [initial.values],
  );

  const form = useForm<PieceFormValues>({
    resolver: zodResolver(pieceFormSchema) as never,
    defaultValues: defaults,
  });

  const [composerId, setComposerId] = useState<string>(initial.composerId ?? "");
  const [isAddingComposer, setIsAddingComposer] = useState<boolean>(false);
  const [composerDraft, setComposerDraft] =
    useState<InlineComposerDraft>(EMPTY_COMPOSER_DRAFT);
  const [requirements, setRequirements] = useState<VoiceRequirementDTO[]>(
    initial.requirements ?? [],
  );

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

  const addRequirement = useCallback((voiceLine: VoiceLine) => {
    setRequirements((prev) =>
      prev.some((r) => r.voice_line === voiceLine)
        ? prev
        : [...prev, { voice_line: voiceLine, quantity: 1 }],
    );
  }, []);

  return {
    form,
    composerId,
    setComposerId,
    isAddingComposer,
    setIsAddingComposer,
    composerDraft,
    setComposerDraft,
    requirements,
    setRequirements,
    adjustRequirement,
    removeRequirement,
    addRequirement,
  };
};
