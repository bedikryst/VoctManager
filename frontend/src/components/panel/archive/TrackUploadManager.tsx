/**
 * @file TrackUploadManager.tsx
 * @description Component for uploading and managing individual audio rehearsal tracks (MIDI/MP3).
 * @architecture
 * Utilizes multipart/form-data for robust binary handling.
 * Implements React Query for localized data fetching and caching of audio tracks.
 * Replaces native alerts with Sonner toasts and uses ConfirmModal for destructive actions.
 * Extracted styles outside component to optimize memory during file parsing renders.
 * @module archive/TrackUploadManager
 * @author Krystian Bugalski
 */

import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Trash2, AlertCircle, PlayCircle } from 'lucide-react';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import type { Track, VoiceLineOption } from '../../../types';

interface TrackUploadManagerProps {
  pieceId: string | number;
  fetchGlobal: () => Promise<void>;
  voiceLines: VoiceLineOption[];
}

// --- Static Styles ---
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold";
const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

/**
 * TrackUploadManager Component
 * @param {TrackUploadManagerProps} props - Component properties.
 * @returns {React.JSX.Element}
 */
export default function TrackUploadManager({ pieceId, fetchGlobal, voiceLines }: TrackUploadManagerProps): React.JSX.Element {
  
  // --- Local UI & Form State ---
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [voicePart, setVoicePart] = useState<string>(voiceLines.length > 0 ? String(voiceLines[0].value) : 'S1');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion Modal State
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // --- Data Fetching Engine (React Query) ---
  const { data: tracks = [], isLoading, refetch } = useQuery<Track[]>({
    queryKey: ['tracks', pieceId],
    queryFn: async () => {
      const res = await api.get(`/api/tracks/`);
      // Zakładam tu z ostrożności, że filtrowanie po stronie klienta gwarantuje brak błędu w przypadku braku wsparcia query params przez backend
      return Array.isArray(res.data) ? res.data.filter((t: any) => String(t.piece) === String(pieceId)) : [];
    }
  });

  // --- Event Handlers ---

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!audioFile) return;
    
    setIsUploading(true);
    const toastId = toast.loading("Trwa transfer pliku do bazy...");

    const payload = new FormData();
    payload.append('piece', String(pieceId));
    payload.append('voice_part', voicePart);
    payload.append('audio_file', audioFile);

    try {
      await api.post('/api/tracks/', payload, { headers: { 'Content-Type': 'multipart/form-data' }});
      
      // Reset form
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Sync UI
      await refetch();
      await fetchGlobal(); 
      
      toast.success("Plik audio został wgrany i podpięty pod utwór", { id: toastId });
    } catch (err) { 
      console.error("[TrackUploadManager] Upload failed:", err);
      toast.error("Błąd podczas wgrywania", { 
        id: toastId, 
        description: "Sprawdź, czy format pliku jest obsługiwany (MP3/MIDI) oraz czy nie przekracza limitu wagi." 
      }); 
    } finally {
      setIsUploading(false);
    }
  };

  const executeDelete = async (): Promise<void> => {
    if (!trackToDelete) return;

    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie ścieżki audio...");

    try {
      await api.delete(`/api/tracks/${trackToDelete}/`);
      
      await refetch();
      await fetchGlobal(); 
      
      toast.success("Usunięto nagranie", { id: toastId });
    } catch (err) { 
      console.error("[TrackUploadManager] Deletion failed:", err); 
      toast.error("Błąd usuwania", { id: toastId, description: "Nie udało się usunąć nagrania z serwera." });
    } finally {
      setIsDeleting(false);
      setTrackToDelete(null);
    }
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>): void => {
    const target = e.currentTarget;
    document.querySelectorAll('audio').forEach(audioEl => { 
      if (audioEl !== target) audioEl.pause(); 
    });
  };

  // --- Render ---

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* --- UPLOAD FORM WIDGET --- */}
      <form onSubmit={handleUpload} className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col md:flex-row gap-5 items-end">
        <div className="w-full md:w-1/3">
          <label className={STYLE_LABEL}>Docelowa Partia Głosowa *</label>
          <select 
            value={voicePart} 
            onChange={e => setVoicePart(e.target.value)} 
            className={STYLE_GLASS_INPUT}
            disabled={isUploading}
          >
            {voiceLines.length > 0 ? (
                voiceLines.map(vl => <option key={String(vl.value)} value={String(vl.value)}>{vl.label}</option>)
            ) : (
                <option value="S1">Ładowanie...</option>
            )}
          </select>
        </div>
        
        <div className="flex-1 w-full">
          <label className={STYLE_LABEL}>Plik Audio (MP3/MIDI) *</label>
          <input 
            type="file" 
            required 
            accept="audio/*" 
            ref={fileInputRef} 
            onChange={e => setAudioFile(e.target.files ? e.target.files[0] : null)}
            disabled={isUploading}
            className="w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-[#002395] file:shadow-sm hover:file:bg-blue-50 hover:file:text-[#001766] cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isUploading || !audioFile} 
          className="w-full md:w-auto h-[46px] px-8 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase font-bold antialiased tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none flex items-center justify-center gap-2 flex-shrink-0 active:scale-95"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UploadCloud size={16} aria-hidden="true" />}
          Wgraj Plik
        </button>
      </form>

      {/* --- ACTIVE TRACKS LIST --- */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 flex items-center gap-2 mb-4 ml-1">
            Wgrane Ścieżki Dźwiękowe
        </h4>

        {isLoading ? (
            <Loader2 className="animate-spin text-stone-400 mx-auto my-8" aria-hidden="true" />
        ) : tracks.length > 0 ? (
            tracks.map(track => (
            <div key={track.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-xl border border-stone-200/60 shadow-sm gap-4 hover:bg-white transition-colors">
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 text-emerald-700 font-bold antialiased text-[10px] uppercase tracking-widest min-w-[100px] text-center shadow-sm flex items-center justify-center gap-2">
                    <PlayCircle size={14} aria-hidden="true" /> 
                    {/* Fallback do voice_part jeśli voice_part_display nie jest dostępne */}
                    {(track as any).voice_part_display || track.voice_part}
                </div>
                <audio 
                    controls 
                    controlsList="nodownload" 
                    className="h-9 w-full sm:w-64 outline-none rounded-lg" 
                    onPlay={handleAudioPlay}
                >
                    <source src={track.audio_file} type="audio/mpeg" />
                </audio>
                </div>
                
                <button 
                    onClick={() => setTrackToDelete(String(track.id))} 
                    disabled={isDeleting}
                    className="text-stone-400 hover:text-red-600 p-2.5 transition-all self-end md:self-auto bg-white rounded-lg border border-stone-200/60 hover:bg-red-50 hover:border-red-200 shadow-sm active:scale-95 disabled:opacity-50"
                    title="Usuń to nagranie"
                >
                <Trash2 size={16} aria-hidden="true" />
                </button>
            </div>
            ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 bg-white/40 border border-dashed border-stone-300/60 rounded-2xl">
            <AlertCircle size={32} className="mb-3 opacity-30" aria-hidden="true" />
            <p className="text-[10px] font-bold antialiased uppercase tracking-widest">Brak plików audio</p>
            <p className="text-xs mt-1 max-w-xs text-center leading-relaxed">Skorzystaj z formularza powyżej, aby dodać materiały ćwiczeniowe dla poszczególnych głosów.</p>
          </div>
        )}
      </div>

      {/* --- DESTRUCTIVE ACTION MODAL --- */}
      <ConfirmModal 
        isOpen={!!trackToDelete}
        title="Usunąć tę ścieżkę?"
        description="Plik audio zostanie bezpowrotnie usunięty z serwera. Tej operacji nie można cofnąć."
        onConfirm={executeDelete}
        onCancel={() => setTrackToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}