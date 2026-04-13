/**
 * @file usePieceForm.ts
 * @description Manages internal form state for the Archive editor.
 * Bridges complex UI interactions with strict archive DTO contracts.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useCreatePiece, useUpdatePiece } from "../api/archive.queries";
import type {
  PieceWriteDTO,
  VoiceRequirementDTO,
  EnrichedPiece,
} from "../types/archive.dto";
import type { Composer } from "@/shared/types";

export type SubmitAction = "SAVE_AND_ADD" | "SAVE_AND_CLOSE";

export interface PieceFormState extends Omit<
  Partial<PieceWriteDTO>,
  "composition_year" | "estimated_duration"
> {
  composition_year?: string | number | null;
  durationMins?: string;
  durationSecs?: string;
}

export const usePieceForm = (
  piece: EnrichedPiece | null,
  composers: Composer[],
  initialSearchContext: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
  onSuccess?: (updatedPiece: any, actionType: SubmitAction) => void,
) => {
  const { t } = useTranslation();
  const createMutation = useCreatePiece();
  const updateMutation = useUpdatePiece();

  const [submitAction, setSubmitAction] =
    useState<SubmitAction>("SAVE_AND_CLOSE");

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
  const [requirements, setRequirements] = useState<VoiceRequirementDTO[]>(
    piece?.voice_requirements?.map((requirement) => ({
      voice_line: requirement.voice_line,
      quantity: requirement.quantity,
    })) || [],
  );

  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [newComposerData, setNewComposerData] = useState({
    first_name: "",
    last_name: "",
    birth_year: "",
    death_year: "",
  });

  const initialComposerSearch = piece?.composer
    ? `${piece.composer.last_name} ${piece.composer.first_name || ""}`.trim()
    : "";
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

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    setFormData(initialFormData);
    setRequirements(
      piece?.voice_requirements?.map((requirement) => ({
        voice_line: requirement.voice_line,
        quantity: requirement.quantity,
      })) || [],
    );
    setSelectedFile(null);
    setIsDirty(false);
    setIsAddingComposer(false);
    setCompSearchTerm(
      piece?.composer
        ? `${piece.composer.last_name} ${piece.composer.first_name || ""}`.trim()
        : "",
    );
  }, [initialFormData, piece]);

  const handleRequirementChange = (index: number, delta: number) => {
    const nextRequirements = [...requirements];
    nextRequirements[index].quantity = Math.max(
      1,
      nextRequirements[index].quantity + delta,
    );
    setRequirements(nextRequirements);
    setIsDirty(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const isCreate = !piece?.id;
    const toastId = toast.loading(
      isCreate
        ? t("archive.form.toast.creating", "Dodawanie utworu do archiwum...")
        : t("archive.form.toast.updating", "Aktualizowanie metadanych..."),
    );

    if (isAddingComposer) {
      toast.error(
        t("archive.form.toast.constraint_title", "Ograniczenie systemowe"),
        {
          id: toastId,
          description: t(
            "archive.form.toast.constraint_desc",
            "Dodawanie kompozytorów w locie wymaga osobnego endpointu. Wybierz kompozytora z listy.",
          ),
        },
      );
      return;
    }

    const calculatedDuration =
      parseInt(formData.durationMins || "0", 10) * 60 +
      parseInt(formData.durationSecs || "0", 10);

    const payload: PieceWriteDTO = {
      title: formData.title as string,
      composer: formData.composer || undefined,
      arranger: formData.arranger || undefined,
      language: formData.language || undefined,
      estimated_duration:
        calculatedDuration > 0 ? calculatedDuration : undefined,
      voicing: formData.voicing || undefined,
      description: formData.description || undefined,
      lyrics_original: formData.lyrics_original || undefined,
      lyrics_translation: formData.lyrics_translation || undefined,
      reference_recording_youtube:
        formData.reference_recording_youtube || undefined,
      reference_recording_spotify:
        formData.reference_recording_spotify || undefined,
      composition_year: formData.composition_year
        ? Number(formData.composition_year)
        : null,
      epoch: formData.epoch || undefined,
      voice_requirements: requirements.length > 0 ? requirements : undefined,
      sheet_music: selectedFile || undefined,
    };

    try {
      if (isCreate) {
        const newPiece = await createMutation.mutateAsync(payload);
        toast.success(
          t("archive.form.toast.create_success", "Utwór dodany pomyślnie."),
          { id: toastId },
        );
        if (onSuccess) {
          onSuccess(newPiece, submitAction);
        }
      } else {
        const updatedPiece = await updateMutation.mutateAsync({
          id: piece!.id,
          data: payload,
        });
        toast.success(
          t("archive.form.toast.update_success", "Zmiany zostały zapisane."),
          { id: toastId },
        );
        if (onSuccess) {
          onSuccess(updatedPiece, submitAction);
        }
      }
      setIsDirty(false);
    } catch (error: any) {
      toast.error(t("archive.form.toast.save_error_title", "Błąd zapisu."), {
        id: toastId,
        description:
          error?.response?.data?.detail ||
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
    isSubmitting: createMutation.isPending || updateMutation.isPending,
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
