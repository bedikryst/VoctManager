/**
 * @file usePieceForm.ts
 * @description Manual create/edit form state for Piece metadata.
 * Composer inline-creation is orchestrated here (fetch the new composer
 * first, then attach its UUID to the piece payload).
 *
 * PDFs do NOT flow through this hook — they are uploaded as ScoreEditions
 * via the dedicated EditionUploadZone, which dispatches the AI pipeline.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  useCreateComposer,
  useCreatePiece,
  useUpdatePiece,
} from "../api/archive.queries";
import type {
  ComposerWriteDTO,
  PieceWriteDTO,
  VoiceRequirementDTO,
  EnrichedPiece,
} from "../types/archive.dto";
import type { Composer } from "@/shared/types";

export type SubmitAction = "SAVE_AND_ADD" | "SAVE_AND_CLOSE";

export interface PieceFormState
  extends Omit<Partial<PieceWriteDTO>, "composition_year" | "estimated_duration"> {
  composition_year?: string | number | null;
  durationMins?: string;
  durationSecs?: string;
}

interface ComposerDraftState {
  first_name: string;
  last_name: string;
  birth_year: string;
  death_year: string;
}

const EMPTY_COMPOSER_DRAFT: ComposerDraftState = {
  first_name: "",
  last_name: "",
  birth_year: "",
  death_year: "",
};

const normalizeComposerDraft = (value: ComposerDraftState): ComposerDraftState => ({
  first_name: value.first_name.trim(),
  last_name: value.last_name.trim(),
  birth_year: value.birth_year.trim(),
  death_year: value.death_year.trim(),
});

const normalizeRequirements = (
  value: VoiceRequirementDTO[],
): VoiceRequirementDTO[] =>
  value.map((requirement) => ({
    voice_line: requirement.voice_line,
    quantity: requirement.quantity,
  }));

const normalizeFormState = (value: PieceFormState) => ({
  title: value.title || "",
  composer_id: value.composer_id || "",
  arranger: value.arranger || "",
  language: value.language || "",
  durationMins: value.durationMins || "",
  durationSecs: value.durationSecs || "",
  voicing: value.voicing || "",
  description: value.description || "",
  lyrics_original: value.lyrics_original || "",
  composition_year:
    value.composition_year === null || value.composition_year === undefined
      ? ""
      : String(value.composition_year),
  epoch: value.epoch || "",
  opus_catalog: value.opus_catalog || "",
  musical_key: value.musical_key || "",
  text_source: value.text_source || "",
  lyrics_ipa: value.lyrics_ipa || "",
});

export const usePieceForm = (
  piece: EnrichedPiece | null,
  composers: Composer[],
  initialSearchContext: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
  onSuccess?: (updatedPiece: EnrichedPiece, actionType: SubmitAction) => void,
) => {
  const { t } = useTranslation();
  const createComposerMutation = useCreateComposer();
  const createMutation = useCreatePiece();
  const updateMutation = useUpdatePiece();

  const [submitAction, setSubmitAction] = useState<SubmitAction>("SAVE_AND_CLOSE");

  const initialComposerSearch = useMemo(
    () =>
      piece?.composer
        ? `${piece.composer.last_name} ${piece.composer.first_name || ""}`.trim()
        : "",
    [piece],
  );

  const initialRequirements = useMemo<VoiceRequirementDTO[]>(
    () =>
      piece?.voice_requirements_read?.map((requirement) => ({
        voice_line: requirement.voice_line,
        quantity: requirement.quantity,
      })) || [],
    [piece],
  );

  const initialFormData = useMemo<PieceFormState>(() => {
    const totalSeconds = piece?.estimated_duration || 0;
    const mins = totalSeconds > 0 ? Math.floor(totalSeconds / 60).toString() : "";
    const secs = totalSeconds > 0 ? (totalSeconds % 60).toString() : "";

    return {
      title: piece?.title || initialSearchContext || "",
      composer_id: piece?.composer?.id || "",
      arranger: piece?.arranger || "",
      language: piece?.language || "",
      durationMins: mins,
      durationSecs: secs,
      voicing: piece?.voicing || "",
      description: piece?.description || "",
      lyrics_original: piece?.lyrics_original || "",
      composition_year: piece?.composition_year || "",
      epoch: piece?.epoch || "",
      opus_catalog: piece?.opus_catalog || "",
      musical_key: piece?.musical_key || "",
      text_source: piece?.text_source || "",
      lyrics_ipa: piece?.lyrics_ipa || "",
    };
  }, [piece, initialSearchContext]);

  const [formData, setFormData] = useState<PieceFormState>(initialFormData);
  const [requirements, setRequirements] =
    useState<VoiceRequirementDTO[]>(initialRequirements);
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [newComposerData, setNewComposerData] =
    useState<ComposerDraftState>(EMPTY_COMPOSER_DRAFT);
  const [compSearchTerm, setCompSearchTerm] = useState(initialComposerSearch);
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);

  const filteredComposers = useMemo(() => {
    if (!compSearchTerm) return composers;
    return composers.filter((composer) =>
      `${composer.first_name || ""} ${composer.last_name}`
        .toLowerCase()
        .includes(compSearchTerm.toLowerCase()),
    );
  }, [composers, compSearchTerm]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        formData: normalizeFormState(initialFormData),
        requirements: normalizeRequirements(initialRequirements),
        isAddingComposer: false,
        newComposerData: EMPTY_COMPOSER_DRAFT,
      }),
    [initialFormData, initialRequirements],
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        formData: normalizeFormState(formData),
        requirements: normalizeRequirements(requirements),
        isAddingComposer,
        newComposerData: normalizeComposerDraft(newComposerData),
      }),
    [formData, requirements, isAddingComposer, newComposerData],
  );

  const isDirty = currentSnapshot !== initialSnapshot;

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    setFormData(initialFormData);
    setRequirements(initialRequirements);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);
    setCompSearchTerm(initialComposerSearch);
    setIsCompDropdownOpen(false);
    setSubmitAction("SAVE_AND_CLOSE");
  }, [initialFormData, initialRequirements, initialComposerSearch]);

  const handleRequirementChange = (index: number, delta: number) => {
    const next = [...requirements];
    next[index].quantity = Math.max(1, next[index].quantity + delta);
    setRequirements(next);
  };

  const resetCreateFlow = () => {
    setFormData({
      title: initialSearchContext,
      composer_id: "",
      arranger: "",
      language: "",
      durationMins: "",
      durationSecs: "",
      voicing: "",
      description: "",
      lyrics_original: "",
      composition_year: "",
      epoch: "",
      opus_catalog: "",
      musical_key: "",
      text_source: "",
      lyrics_ipa: "",
    });
    setRequirements([]);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);
    setCompSearchTerm("");
    setIsCompDropdownOpen(false);
  };

  const createComposerIfNeeded = async (): Promise<string | undefined> => {
    if (!isAddingComposer) {
      return formData.composer_id || undefined;
    }
    const draft = normalizeComposerDraft(newComposerData);
    if (!draft.last_name) {
      throw new Error(
        t(
          "archive.form.toast.composer_required",
          "Nazwisko kompozytora jest wymagane.",
        ),
      );
    }
    const composerPayload: ComposerWriteDTO = {
      last_name: draft.last_name,
      first_name: draft.first_name || undefined,
      birth_year: draft.birth_year || undefined,
      death_year: draft.death_year || undefined,
    };
    const created = await createComposerMutation.mutateAsync(composerPayload);
    const label = `${created.last_name} ${created.first_name || ""}`.trim();

    setFormData((current) => ({ ...current, composer_id: created.id }));
    setCompSearchTerm(label);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);

    return created.id;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const isCreate = !piece?.id;
    const toastId = toast.loading(
      isCreate
        ? t("archive.form.toast.creating", "Dodawanie utworu do archiwum...")
        : t("archive.form.toast.updating", "Aktualizowanie metadanych..."),
    );

    const durationSeconds =
      parseInt(formData.durationMins || "0", 10) * 60 +
      parseInt(formData.durationSecs || "0", 10);

    try {
      const composerId = await createComposerIfNeeded();

      const payload: PieceWriteDTO = {
        title: formData.title as string,
        composer_id: composerId ?? null,
        arranger: formData.arranger || "",
        language: formData.language || "",
        estimated_duration: durationSeconds > 0 ? durationSeconds : null,
        voicing: formData.voicing || "",
        description: formData.description || "",
        lyrics_original: formData.lyrics_original || "",
        composition_year: formData.composition_year
          ? Number(formData.composition_year)
          : null,
        epoch: formData.epoch || "",
        opus_catalog: formData.opus_catalog || "",
        musical_key: formData.musical_key || "",
        text_source: formData.text_source || "",
        lyrics_ipa: formData.lyrics_ipa || "",
        voice_requirements: requirements.length > 0 ? requirements : undefined,
      };

      if (isCreate) {
        const newPiece = await createMutation.mutateAsync(payload);
        toast.success(
          t("archive.form.toast.create_success", "Utwór dodany pomyślnie."),
          { id: toastId },
        );
        if (submitAction === "SAVE_AND_ADD") {
          resetCreateFlow();
        }
        onSuccess?.(newPiece as EnrichedPiece, submitAction);
      } else {
        const updatedPiece = await updateMutation.mutateAsync({
          id: String(piece!.id),
          data: payload,
        });
        toast.success(
          t("archive.form.toast.update_success", "Zmiany zostały zapisane."),
          { id: toastId },
        );
        onSuccess?.(updatedPiece as EnrichedPiece, submitAction);
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (error as Error)?.message ||
        t(
          "archive.form.toast.save_error_desc",
          "Sprawdź poprawność danych i spróbuj ponownie.",
        );
      toast.error(t("archive.form.toast.save_error_title", "Błąd zapisu."), {
        id: toastId,
        description: message,
      });
    }
  };

  return {
    formData,
    setFormData,
    requirements,
    setRequirements,
    isSubmitting:
      createComposerMutation.isPending ||
      createMutation.isPending ||
      updateMutation.isPending,
    submitAction,
    setSubmitAction,
    handleSubmit,
    isAddingComposer,
    setIsAddingComposer,
    newComposerData,
    setNewComposerData,
    compSearchTerm,
    setCompSearchTerm,
    isCompDropdownOpen,
    setIsCompDropdownOpen,
    filteredComposers,
    handleRequirementChange,
  };
};
