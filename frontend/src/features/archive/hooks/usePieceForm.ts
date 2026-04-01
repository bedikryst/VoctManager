/**
 * @file usePieceForm.ts
 * @description Encapsulates complex form state, dirty tracking, inline composer creation, 
 * and API payload construction (including nested writes) for the Piece Details Form.
 * @module panel/archive/hooks/usePieceForm
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../../shared/api/api';
import { queryKeys } from '../../../../shared/lib/queryKeys';
import type { Piece, Composer } from '../../../../types';

export type SubmitAction = 'SAVE_AND_ADD' | 'SAVE_AND_CLOSE';

export interface PieceFormData {
    title: string;
    composer: string;
    arranger: string;
    language: string;
    composition_year: string;
    epoch: string;
    voicing: string;
    durationMins: string;
    durationSecs: string;
    reference_recording_youtube: string;
    reference_recording_spotify: string;
    lyrics_original: string;
    lyrics_translation: string;
    description: string;
}

export interface RequirementState {
    voice_line: string;
    voice_line_display?: string;
    quantity: number;
}

export const usePieceForm = (
    piece: Piece | null, 
    composers: Composer[], 
    initialSearchContext: string,
    onDirtyStateChange?: (isDirty: boolean) => void,
    onSuccess?: (updatedPiece: Piece, actionType: SubmitAction) => void
) => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitAction, setSubmitAction] = useState<SubmitAction>('SAVE_AND_CLOSE');

    const [isAddingComposer, setIsAddingComposer] = useState<boolean>(false);
    const [newComposerData, setNewComposerData] = useState({ first_name: '', last_name: '', birth_year: '', death_year: '' });
    const [compSearchTerm, setCompSearchTerm] = useState<string>('');
    const [isCompDropdownOpen, setIsCompDropdownOpen] = useState<boolean>(false);

    const initialMinutes = piece?.estimated_duration ? Math.floor(piece.estimated_duration / 60).toString() : '';
    const initialSeconds = piece?.estimated_duration ? (piece.estimated_duration % 60).toString() : '';

    const initialFormData = useMemo<PieceFormData>(() => ({
        title: piece?.title || initialSearchContext || '',
        composer: piece?.composer ? String(typeof piece.composer === 'object' ? (piece.composer as any).id : piece.composer) : '', 
        arranger: piece?.arranger || '',
        language: piece?.language || '',
        composition_year: piece?.composition_year ? String(piece.composition_year) : '',
        epoch: piece?.epoch || '',
        voicing: piece?.voicing || '',
        durationMins: initialMinutes,
        durationSecs: initialSeconds,
        reference_recording_youtube: piece?.reference_recording_youtube || (piece as any)?.reference_recording || '',
        reference_recording_spotify: piece?.reference_recording_spotify || '',
        lyrics_original: piece?.lyrics_original || '',
        lyrics_translation: piece?.lyrics_translation || '',
        description: piece?.description || ''
    }), [piece, initialMinutes, initialSeconds, initialSearchContext]);

    const [formData, setFormData] = useState<PieceFormData>(initialFormData);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const initialRequirements = useMemo(() => 
        piece?.voice_requirements?.map(r => ({ voice_line: r.voice_line, quantity: r.quantity, voice_line_display: (r as any).voice_line_display })) || [],
    [piece]);
    const [requirements, setRequirements] = useState<RequirementState[]>(initialRequirements);

    // Dirty State Tracker
    const isDirty = useMemo(() => {
        const isFormChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
        const areReqsChanged = JSON.stringify(requirements) !== JSON.stringify(initialRequirements);
        const isFileChanged = selectedFile !== null;
        const isComposerAddingActive = isAddingComposer && (newComposerData.first_name !== '' || newComposerData.last_name !== '');
        
        return isFormChanged || areReqsChanged || isFileChanged || isComposerAddingActive;
    }, [formData, initialFormData, requirements, initialRequirements, selectedFile, isAddingComposer, newComposerData]);

    useEffect(() => {
        if (onDirtyStateChange) onDirtyStateChange(isDirty);
    }, [isDirty, onDirtyStateChange]);

    useEffect(() => {
        if (!isAddingComposer) {
            if (formData.composer) {
                const comp = composers.find(c => String(c.id) === String(formData.composer));
                setCompSearchTerm(comp ? `${comp.first_name || ''} ${comp.last_name}`.trim() : '');
            } else {
                setCompSearchTerm('');
            }
        }
    }, [formData.composer, composers, isAddingComposer]);

    const filteredComposers = useMemo<Composer[]>(() => {
        if (!compSearchTerm) return composers;
        return composers.filter(c => `${c.first_name || ''} ${c.last_name}`.toLowerCase().includes(compSearchTerm.toLowerCase()));
    }, [composers, compSearchTerm]);

    const handleRequirementChange = (index: number, delta: number) => {
        const newReqs = [...requirements];
        newReqs[index].quantity = Math.max(1, newReqs[index].quantity + delta);
        setRequirements(newReqs);
    };

    const appendField = (payload: FormData, key: string, value: string | number | null) => {
        payload.append(key, value === null ? '' : String(value));
    };

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        let finalComposerId = formData.composer;

        // Inline Composer Creation
        if (isAddingComposer) {
            if (!newComposerData.last_name) {
                toast.error('Nazwisko kompozytora jest wymagane!');
                setIsSubmitting(false); 
                return;
            }
            
            const duplicate = composers.find(c => 
                c.last_name.trim().toLowerCase() === newComposerData.last_name.trim().toLowerCase() && 
                (c.first_name || '').trim().toLowerCase() === newComposerData.first_name.trim().toLowerCase()
            );
            
            if (duplicate) {
                toast.warning(`Kompozytor ${duplicate.first_name || ''} ${duplicate.last_name} już istnieje. Wyszukaj go na liście.`);
                setIsSubmitting(false); 
                return;
            }

            const compToastId = toast.loading("Dodawanie kompozytora do bazy...");
            try {
                const compPayload = { 
                    ...newComposerData, 
                    birth_year: newComposerData.birth_year ? parseInt(newComposerData.birth_year, 10) : null, 
                    death_year: newComposerData.death_year ? parseInt(newComposerData.death_year, 10) : null 
                };
                const compRes = await api.post('/api/composers/', compPayload);
                finalComposerId = compRes.data.id;
                
                await queryClient.invalidateQueries({ queryKey: queryKeys.composers.all });
                toast.success("Zapisano kompozytora", { id: compToastId });
            } catch (err) {
                toast.error("Błąd tworzenia kompozytora", { id: compToastId });
                setIsSubmitting(false); 
                return;
            }
        }

        const toastId = toast.loading(piece?.id ? "Aktualizowanie utworu..." : "Zapisywanie nowego utworu...");

        const payload = new FormData();
        appendField(payload, 'title', formData.title.trim());
        appendField(payload, 'composer', finalComposerId || null);
        appendField(payload, 'arranger', formData.arranger.trim() || null);
        appendField(payload, 'language', formData.language.trim() || null);
        appendField(payload, 'composition_year', formData.composition_year || null);
        appendField(payload, 'epoch', formData.epoch || null);
        appendField(payload, 'voicing', formData.voicing.trim());
        appendField(payload, 'reference_recording_youtube', formData.reference_recording_youtube.trim() || null);
        appendField(payload, 'reference_recording_spotify', formData.reference_recording_spotify.trim() || null);
        appendField(payload, 'lyrics_original', formData.lyrics_original.trim() || null);
        appendField(payload, 'lyrics_translation', formData.lyrics_translation.trim() || null);
        appendField(payload, 'description', formData.description.trim());
        
        const totalSeconds = (parseInt(formData.durationMins || '0', 10) * 60) + parseInt(formData.durationSecs || '0', 10);
        appendField(payload, 'estimated_duration', totalSeconds > 0 ? totalSeconds : null);

        if (selectedFile) payload.append('sheet_music', selectedFile);

        const requirementsPayload = requirements.map(req => ({ voice_line: req.voice_line, quantity: req.quantity }));
        payload.append('requirements_data', JSON.stringify(requirementsPayload));

        try {
            const res = piece?.id 
                ? await api.patch(`/api/pieces/${piece.id}/`, payload, { headers: { 'Content-Type': 'multipart/form-data' }})
                : await api.post('/api/pieces/', payload, { headers: { 'Content-Type': 'multipart/form-data' }});
            
            await queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all });
            toast.success(piece?.id ? 'Zaktualizowano dane utworu.' : 'Utwór dodany do archiwum!', { id: toastId });
            
            if (onDirtyStateChange) onDirtyStateChange(false);

            if (submitAction === 'SAVE_AND_ADD') {
                setFormData({
                    title: '', composer: '', arranger: '', language: '', composition_year: '',
                    epoch: '', voicing: '', durationMins: '', durationSecs: '', reference_recording_youtube: '',
                    reference_recording_spotify: '', lyrics_original: '', lyrics_translation: '', description: ''
                });
                setRequirements([]);
                setSelectedFile(null);
                setCompSearchTerm('');
                setIsAddingComposer(false);
                setNewComposerData({ first_name: '', last_name: '', birth_year: '', death_year: '' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }

            if (onSuccess) onSuccess(res.data, submitAction);
            
        } catch (err) {
            toast.error("Wystąpił błąd podczas zapisu", { id: toastId, description: "Sprawdź poprawność danych i połączenie." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        formData, setFormData, requirements, setRequirements, selectedFile, setSelectedFile, fileInputRef,
        isSubmitting, submitAction, setSubmitAction, handleSubmit,
        isAddingComposer, setIsAddingComposer, newComposerData, setNewComposerData,
        compSearchTerm, setCompSearchTerm, isCompDropdownOpen, setIsCompDropdownOpen, filteredComposers,
        handleRequirementChange
    };
};