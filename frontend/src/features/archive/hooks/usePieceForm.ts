/**
 * @file usePieceForm.ts
 * @description Manages archive piece form state, dirty detection, and dependent write flows.
 * Restores inline composer creation by orchestrating the existing composers endpoint before piece persistence.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useEffect, useMemo, useRef } from "react";
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

const normalizeComposerDraft = (
  value: ComposerDraftState,
): ComposerDraftState => ({
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
  composer: value.composer || "",
  arranger: value.arranger || "",
  language: value.language || "",
  durationMins: value.durationMins || "",
  durationSecs: value.durationSecs || "",
  voicing: value.voicing || "",
  description: value.description || "",
  lyrics_original: value.lyrics_original || "",
  lyrics_translation: value.lyrics_translation || "",
  reference_recording_youtube: value.reference_recording_youtube || "",
  reference_recording_spotify: value.reference_recording_spotify || "",
  composition_year:
    value.composition_year === null || value.composition_year === undefined
      ? ""
      : String(value.composition_year),
  epoch: value.epoch || "",
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

  const [submitAction, setSubmitAction] =
    useState<SubmitAction>("SAVE_AND_CLOSE");

  const initialComposerSearch = useMemo(
    () =>
      piece?.composer
        ? `${piece.composer.last_name} ${piece.composer.first_name || ""}`.trim()
        : "",
    [piece],
  );

  const initialRequirements = useMemo<VoiceRequirementDTO[]>(
    () =>
      piece?.voice_requirements?.map((requirement) => ({
        voice_line: requirement.voice_line,
        quantity: requirement.quantity,
      })) || [],
    [piece],
  );

  const initialFormData = useMemo<PieceFormState>(() => {
    const totalSeconds = piece?.estimated_duration || 0;
    const mins =
      totalSeconds > 0 ? Math.floor(totalSeconds / 60).toString() : "";
    const secs = totalSeconds > 0 ? (totalSeconds % 60).toString() : "";

    return {
      title: piece?.title || initialSearchContext || "",
      composer: piece?.composer?.id || "",
      arranger: piece?.arranger || "",
      language: piece?.language || "",
      durationMins: mins,
      durationSecs: secs,
      voicing: piece?.voicing || "",
      description: piece?.description || "",
      lyrics_original: piece?.lyrics_original || "",
      lyrics_translation: piece?.lyrics_translation || "",
      reference_recording_youtube:
        piece?.reference_recording_youtube || piece?.reference_recording || "",
      reference_recording_spotify: piece?.reference_recording_spotify || "",
      composition_year: piece?.composition_year || "",
      epoch: piece?.epoch || "",
    };
  }, [piece, initialSearchContext]);

  const [formData, setFormData] = useState<PieceFormState>(initialFormData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [requirements, setRequirements] =
    useState<VoiceRequirementDTO[]>(initialRequirements);
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [newComposerData, setNewComposerData] =
    useState<ComposerDraftState>(EMPTY_COMPOSER_DRAFT);
  const [compSearchTerm, setCompSearchTerm] = useState(initialComposerSearch);
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);

  const filteredComposers = useMemo(() => {
    if (!compSearchTerm) {
      return composers;
    }

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
        selectedFile: null,
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
        selectedFile: selectedFile
          ? {
              name: selectedFile.name,
              size: selectedFile.size,
              lastModified: selectedFile.lastModified,
            }
          : null,
        isAddingComposer,
        newComposerData: normalizeComposerDraft(newComposerData),
      }),
    [formData, requirements, selectedFile, isAddingComposer, newComposerData],
  );

  const isDirty = currentSnapshot !== initialSnapshot;

  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    setFormData(initialFormData);
    setRequirements(initialRequirements);
    setSelectedFile(null);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);
    setCompSearchTerm(initialComposerSearch);
    setIsCompDropdownOpen(false);
    setSubmitAction("SAVE_AND_CLOSE");
  }, [initialFormData, initialRequirements, initialComposerSearch]);

  const handleRequirementChange = (index: number, delta: number) => {
    const nextRequirements = [...requirements];
    nextRequirements[index].quantity = Math.max(
      1,
      nextRequirements[index].quantity + delta,
    );
    setRequirements(nextRequirements);
  };

  const resetCreateFlow = () => {
    setFormData({
      title: initialSearchContext,
      composer: "",
      arranger: "",
      language: "",
      durationMins: "",
      durationSecs: "",
      voicing: "",
      description: "",
      lyrics_original: "",
      lyrics_translation: "",
      reference_recording_youtube: "",
      reference_recording_spotify: "",
      composition_year: "",
      epoch: "",
    });
    setRequirements([]);
    setSelectedFile(null);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);
    setCompSearchTerm("");
    setIsCompDropdownOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createComposerIfNeeded = async (): Promise<string | undefined> => {
    if (!isAddingComposer) {
      return formData.composer || undefined;
    }

    const composerDraft = normalizeComposerDraft(newComposerData);

    if (!composerDraft.last_name) {
      throw new Error(
        t(
          "archive.form.toast.composer_required",
          "Nazwisko kompozytora jest wymagane.",
        ),
      );
    }

    const composerPayload: ComposerWriteDTO = {
      last_name: composerDraft.last_name,
      first_name: composerDraft.first_name || undefined,
      birth_year: composerDraft.birth_year || undefined,
      death_year: composerDraft.death_year || undefined,
    };

    const createdComposer =
      await createComposerMutation.mutateAsync(composerPayload);
    const createdComposerLabel =
      `${createdComposer.last_name} ${createdComposer.first_name || ""}`.trim();

    setFormData((currentValue) => ({
      ...currentValue,
      composer: createdComposer.id,
    }));
    setCompSearchTerm(createdComposerLabel);
    setIsAddingComposer(false);
    setNewComposerData(EMPTY_COMPOSER_DRAFT);

    return createdComposer.id;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const isCreate = !piece?.id;
    const toastId = toast.loading(
      isCreate
        ? t("archive.form.toast.creating", "Dodawanie utworu do archiwum...")
        : t("archive.form.toast.updating", "Aktualizowanie metadanych..."),
    );

    const calculatedDuration =
      parseInt(formData.durationMins || "0", 10) * 60 +
      parseInt(formData.durationSecs || "0", 10);

    try {
      const composerId = await createComposerIfNeeded();

      const payload: PieceWriteDTO = {
        title: formData.title as string,
        composer: composerId || "",
        arranger: formData.arranger || "",
        language: formData.language || "",
        estimated_duration:
          calculatedDuration > 0 ? calculatedDuration : null,
        voicing: formData.voicing || "",
        description: formData.description || "",
        lyrics_original: formData.lyrics_original || "",
        lyrics_translation: formData.lyrics_translation || "",
        reference_recording_youtube:
          formData.reference_recording_youtube || "",
        reference_recording_spotify:
          formData.reference_recording_spotify || "",
        composition_year: formData.composition_year
          ? Number(formData.composition_year)
          : null,
        epoch: formData.epoch || "",
        voice_requirements: requirements.length > 0 ? requirements : undefined,
        sheet_music: selectedFile || undefined,
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
          id: piece!.id,
          data: payload,
        });
        toast.success(
          t("archive.form.toast.update_success", "Zmiany zostały zapisane."),
          { id: toastId },
        );
        onSuccess?.(updatedPiece as EnrichedPiece, submitAction);
      }
    } catch (error: any) {
      toast.error(t("archive.form.toast.save_error_title", "Błąd zapisu."), {
        id: toastId,
        description:
          error?.response?.data?.detail ||
          error?.message ||
          t(
            "archive.form.toast.save_error_desc",
            "Sprawdź poprawność danych i spróbuj ponownie.",
          ),
      });
    }
  };

  return {
    formData,
    setFormData,
    requirements,
    setRequirements,
    selectedFile,
    setSelectedFile,
    fileInputRef,
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
