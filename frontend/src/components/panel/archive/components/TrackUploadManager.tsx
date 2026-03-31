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
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Trash2, AlertCircle, PlayCircle } from 'lucide-react';

import api from '../../../../utils/api';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import type { Track, VoiceLineOption } from '../../../../types';
import { queryKeys } from '../../../../utils/queryKeys';

// --- Safe Data Extractor ---
const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

interface TrackUploadManagerProps {
  pieceId: string | number;
  voiceLines: VoiceLineOption[];
}

const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function TrackUploadManager({ pieceId, voiceLines }: TrackUploadManagerProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadVoicePart, setUploadVoicePart] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const { data: rawTracks, isLoading } = useQuery({
    queryKey: queryKeys.tracks.byPiece(pieceId),
    queryFn: async () => {
      const res = await api.get(`/api/tracks/?piece=${pieceId}`);
      return extractData(res.data); // <-- NAPRAWIONY BŁĄD PAGINACJI
    }
  });

  const tracks = rawTracks || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadVoicePart) return;

    setIsUploading(true);
    const toastId = toast.loading("Wgrywanie pliku audio...");

    const formData = new FormData();
    formData.append('piece', String(pieceId));
    formData.append('voice_part', uploadVoicePart);
    formData.append('audio_file', selectedFile);

    try {
      await api.post('/api/tracks/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("Nagranie zostało dodane pomyślnie.", { id: toastId });
      setSelectedFile(null);
      setUploadVoicePart('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      await queryClient.invalidateQueries({ queryKey: queryKeys.tracks.byPiece(pieceId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all });
    } catch (err) {
      toast.error("Błąd wgrywania", { id: toastId, description: "Upewnij się, że plik ma odpowiedni format (MP3/WAV/MIDI)." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTrack = async () => {
    if (!trackToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie pliku...");

    try {
      await api.delete(`/api/tracks/${trackToDelete}/`);
      toast.success("Plik został usunięty z serwera.", { id: toastId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tracks.byPiece(pieceId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all });
    } catch (err) {
      toast.error("Błąd usuwania", { id: toastId });
    } finally {
      setIsDeleting(false);
      setTrackToDelete(null);
    }
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const target = e.currentTarget;
    document.querySelectorAll('audio').forEach(audioEl => {
      if (audioEl !== target) audioEl.pause();
    });
  };

  return (
    <div className="space-y-10">
      
      {/* Upload Form */}
      <div className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-sm relative">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] mb-5 flex items-center gap-2 border-b border-stone-200/60 pb-2">
            <UploadCloud size={14} /> Dodaj materiał ćwiczeniowy
        </h4>
        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">Partia wokalna *</label>
              <select 
                required
                value={uploadVoicePart} 
                onChange={e => setUploadVoicePart(e.target.value)}
                className={`${STYLE_GLASS_INPUT} font-bold text-stone-700 appearance-none`}
                disabled={isUploading}
              >
                <option value="">— Wybierz głos —</option>
                <option value="TUTTI">Cały Zespół (Tutti)</option>
                {voiceLines.map(vl => <option key={vl.value} value={vl.value}>{vl.label}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">Plik Audio (MP3/WAV/MIDI) *</label>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*,.mid,.midi"
                required
                disabled={isUploading}
                className="w-full text-sm text-stone-600 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-[#002395] file:text-white hover:file:bg-[#001766] transition-all cursor-pointer bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button 
              type="submit" 
              disabled={isUploading || !selectedFile || !uploadVoicePart}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white px-8 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Wgraj nagranie
            </button>
          </div>
        </form>
      </div>

      {/* Track List */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">
            Wgrane Ścieżki Audio ({tracks.length})
        </h4>
        
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-stone-400" size={24} /></div>
        ) : tracks.length > 0 ? (
            tracks.map(track => (
            <div key={track.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#002395]/30 hover:shadow-md">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold antialiased text-[#002395] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2 w-max">
                        <PlayCircle size={14} aria-hidden="true" /> {track.voice_part_display || track.voice_part}
                    </span>
                </div>
                <audio 
                    controls 
                    controlsList="nodownload" 
                    className="w-full md:w-72 h-10 outline-none rounded-lg flex-1" 
                    preload="none"
                    onPlay={handleAudioPlay}
                >
                    <source src={track.audio_file} type="audio/mpeg" />
                </audio>
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
        title="Usunąć nagranie z serwera?"
        description="Plik audio zostanie bezpowrotnie usunięty z bazy danych, a chórzyści utracą do niego dostęp."
        onConfirm={handleDeleteTrack}
        onCancel={() => setTrackToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}