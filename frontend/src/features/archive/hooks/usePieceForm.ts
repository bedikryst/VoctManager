/**
 * @file usePieceForm.ts
 * @description Manages internal form state for the Archive Editor. 
 * Formats user input into strict DTOs and delegates persistence to mutation hooks.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useCreatePiece, useUpdatePiece } from '../api/archive.queries';
import type { PieceWriteDTO, VoiceRequirementDTO } from '../types/archive.dto';
import type { Piece } from '../../../shared/types';

export const usePieceForm = (
    piece: Piece | null,
    onClose: () => void
) => {
    // Server Mutations
    const createMutation = useCreatePiece();
    const updateMutation = useUpdatePiece();

    // Complex Initial State Hydration
    const initialFormData = useMemo<Partial<PieceWriteDTO>>(() => {
        return {
            title: piece?.title || '',
            composer: piece?.composer || '',
            arranger: piece?.arranger || '',
            language: piece?.language || '',
            estimated_duration: piece?.estimated_duration || null,
            voicing: piece?.voicing || '',
            description: piece?.description || '',
            lyrics_original: piece?.lyrics_original || '',
            lyrics_translation: piece?.lyrics_translation || '',
            reference_recording_youtube: piece?.reference_recording_youtube || piece?.reference_recording || '',
            reference_recording_spotify: piece?.reference_recording_spotify || '',
            composition_year: piece?.composition_year || null,
            epoch: piece?.epoch || '',
        };
    }, [piece]);

    // Local UI State
    const [formData, setFormData] = useState<Partial<PieceWriteDTO>>(initialFormData);
    const [sheetMusicFile, setSheetMusicFile] = useState<File | null>(null);
    const [voiceRequirements, setVoiceRequirements] = useState<VoiceRequirementDTO[]>(
        piece?.voice_requirements?.map(req => ({ voice_line: req.voice_line, quantity: req.quantity })) || []
    );
    const [isDirty, setIsDirty] = useState(false);

    // Sync form when selected piece changes
    useEffect(() => {
        setFormData(initialFormData);
        setVoiceRequirements(piece?.voice_requirements?.map(req => ({ voice_line: req.voice_line, quantity: req.quantity })) || []);
        setSheetMusicFile(null);
        setIsDirty(false);
    }, [initialFormData, piece]);

    // UI Handlers
    const handleFieldChange = (field: keyof PieceWriteDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const isCreate = !piece?.id;
        const toastId = toast.loading(isCreate ? "Adding piece to archive..." : "Updating piece metadata...");

        // Assemble the strict DTO
        const payload: PieceWriteDTO = {
            title: formData.title as string,
            composer: formData.composer || null,
            arranger: formData.arranger || null,
            language: formData.language || null,
            estimated_duration: formData.estimated_duration ? Number(formData.estimated_duration) : null,
            voicing: formData.voicing || '',
            description: formData.description || '',
            lyrics_original: formData.lyrics_original || null,
            lyrics_translation: formData.lyrics_translation || null,
            reference_recording_youtube: formData.reference_recording_youtube || null,
            reference_recording_spotify: formData.reference_recording_spotify || null,
            composition_year: formData.composition_year ? Number(formData.composition_year) : null,
            epoch: formData.epoch || null,
            voice_requirements: voiceRequirements.length > 0 ? voiceRequirements : undefined,
            sheet_music: sheetMusicFile
        };

        try {
            if (isCreate) {
                await createMutation.mutateAsync(payload);
                toast.success("New piece added successfully.", { id: toastId });
            } else {
                await updateMutation.mutateAsync({ id: piece!.id, data: payload });
                toast.success("Piece updated successfully.", { id: toastId });
            }
            
            setIsDirty(false);
            onClose(); 
        } catch (err: any) {
            toast.error("Operation failed.", { 
                id: toastId,
                description: err?.response?.data?.detail || "Please verify the form fields and try again."
            });
        }
    };

    return {
        formData,
        handleFieldChange,
        sheetMusicFile,
        setSheetMusicFile,
        voiceRequirements,
        setVoiceRequirements,
        isDirty,
        handleFormSubmit,
        isSubmitting: createMutation.isPending || updateMutation.isPending
    };
};