/**
 * @file usePieceForm.ts
 * @description Manages complex internal form state for the Archive Editor.
 * Bridges the gap between the advanced UI (composer dropdowns, dynamic requirements)
 * and strict API data contracts.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useCreatePiece, useUpdatePiece } from "../api/archive.queries";
import type {
  PieceWriteDTO,
  VoiceRequirementDTO,
  EnrichedPiece,
} from "../types/archive.dto";
import type { Composer } from "../../../shared/types";

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
  // 1. Server Mutations
  const createMutation = useCreatePiece();
  const updateMutation = useUpdatePiece();

  // 2. Core Actions
  const [submitAction, setSubmitAction] =
    useState<SubmitAction>("SAVE_AND_CLOSE");

  // 3. Initial Form Hydration
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

  // 4. Local UI State
  const [formData, setFormData] = useState<PieceFormState>(initialFormData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [requirements, setRequirements] = useState<VoiceRequirementDTO[]>(
    piece?.voice_requirements?.map((req) => ({
      voice_line: req.voice_line,
      quantity: req.quantity,
    })) || [],
  );

  // 5. Composer Search & Dropdown State
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [newComposerData, setNewComposerData] = useState({
    first_name: "",
    last_name: "",
    birth_year: "",
    death_year: "",
  });

  // Auto-fill the search box if we are editing an existing piece
  const initialCompSearch = piece?.composer
    ? `${piece.composer.last_name} ${piece.composer.first_name || ""}`.trim()
    : "";
  const [compSearchTerm, setCompSearchTerm] = useState(initialCompSearch);
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);

  const filteredComposers = useMemo(() => {
    if (!compSearchTerm) return composers;
    return composers.filter((c) =>
      `${c.first_name || ""} ${c.last_name}`
        .toLowerCase()
        .includes(compSearchTerm.toLowerCase()),
    );
  }, [composers, compSearchTerm]);

  // 6. Dirty State Tracking
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (onDirtyStateChange) onDirtyStateChange(isDirty);
  }, [isDirty, onDirtyStateChange]);

  // Reset state when the selected piece changes
  useEffect(() => {
    setFormData(initialFormData);
    setRequirements(
      piece?.voice_requirements?.map((req) => ({
        voice_line: req.voice_line,
        quantity: req.quantity,
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

  // 7. Input Handlers
  const handleRequirementChange = (index: number, delta: number) => {
    const newReqs = [...requirements];
    newReqs[index].quantity = Math.max(1, newReqs[index].quantity + delta);
    setRequirements(newReqs);
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isCreate = !piece?.id;
    const toastId = toast.loading(
      isCreate
        ? "Dodawanie utworu do archiwum..."
        : "Aktualizowanie metadanych...",
    );

    if (isAddingComposer) {
      toast.error("Ograniczenie systemowe", {
        id: toastId,
        description:
          "Dodawanie kompozytorów w locie wymaga osobnego endpointu. Wybierz kompozytora z listy.",
      });
      return;
    }
    const calculatedDuration =
      parseInt(formData.durationMins || "0") * 60 +
      parseInt(formData.durationSecs || "0");

    // Assemble strict DTO
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
        toast.success("Utwór dodany pomyślnie.", { id: toastId });
        if (onSuccess) onSuccess(newPiece, submitAction);
      } else {
        const updatedPiece = await updateMutation.mutateAsync({
          id: piece!.id,
          data: payload,
        });
        toast.success("Zmiany zostały zapisane.", { id: toastId });
        if (onSuccess) onSuccess(updatedPiece, submitAction);
      }
      setIsDirty(false);
    } catch (err: any) {
      toast.error("Błąd zapisu.", {
        id: toastId,
        description:
          err?.response?.data?.detail ||
          "Sprawdź poprawność danych i spróbuj ponownie.",
      });
    }
  };

  return {
    // Form Data & Files
    formData,
    setFormData,
    requirements,
    setRequirements,
    selectedFile,
    setSelectedFile,
    fileInputRef,

    // Submission State
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    submitAction,
    setSubmitAction,
    handleSubmit,

    // Composer UI State
    isAddingComposer,
    setIsAddingComposer,
    newComposerData,
    setNewComposerData,
    compSearchTerm,
    setCompSearchTerm,
    isCompDropdownOpen,
    setIsCompDropdownOpen,
    filteredComposers,

    // Helpers
    handleRequirementChange,
  };
};
