/**
 * @file TrackUploadManager.tsx
 * @description Component for uploading and managing individual audio rehearsal tracks (MIDI/MP3).
 * Utilizes multipart/form-data for robust binary handling and React Query for localized caching.
 * @module panel/archive/components/TrackUploadManager
 */

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2, UploadCloud, Trash2, AlertCircle, PlayCircle } from 'lucide-react';

import api from '../../../../utils/api';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Button } from '../../../../components/ui/Button';
import type { Track, VoiceLineOption } from '../../../../types';
import { queryKeys } from '../../../../utils/queryKeys';

interface TrackUploadManagerProps {
    pieceId: string | number;
    voiceLines: VoiceLineOption[];
}

export default function TrackUploadManager({ pieceId, voiceLines }: TrackUploadManagerProps): React.JSX.Element {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadVoicePart, setUploadVoicePart] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [trackToDelete, setTrackToDelete] = useState<string | null>(null);

    // Fetching data
    const { data: tracks = [], isLoading } = useQuery<Track[]>({
        queryKey: queryKeys.tracks.byPiece(pieceId),
        queryFn: async () => (await api.get<Track[]>(`/api/tracks/?piece=${pieceId}`)).data
    });

    // ENTERPRISE STANDARD: useMutation for POST requests
    const uploadMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            return api.post('/api/tracks/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },
        onSuccess: () => {
            toast.success(t('archive.tracks.upload_success', "Nagranie zostało dodane pomyślnie."));
            setSelectedFile(null);
            setUploadVoicePart('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            queryClient.invalidateQueries({ queryKey: queryKeys.tracks.byPiece(pieceId) });
        },
        onError: () => {
            toast.error(t('archive.tracks.upload_error', "Błąd wgrywania. Upewnij się, że plik ma odpowiedni format."));
        }
    });

    // ENTERPRISE STANDARD: useMutation for DELETE requests
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/api/tracks/${id}/`),
        onSuccess: () => {
            toast.success(t('archive.tracks.delete_success', "Plik został usunięty z serwera."));
            queryClient.invalidateQueries({ queryKey: queryKeys.tracks.byPiece(pieceId) });
            setTrackToDelete(null);
        },
        onError: () => {
            toast.error(t('archive.tracks.delete_error', "Błąd podczas usuwania nagrania."));
            setTrackToDelete(null);
        }
    });

    const handleUpload = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !uploadVoicePart) return;

        const formData = new FormData();
        formData.append('piece', String(pieceId));
        formData.append('voice_part', uploadVoicePart);
        formData.append('audio_file', selectedFile);

        uploadMutation.mutate(formData);
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
                    <UploadCloud size={14} /> {t('archive.tracks.add_material', 'Dodaj materiał ćwiczeniowy')}
                </h4>
                <form onSubmit={handleUpload} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
                                {t('archive.tracks.voice_part', 'Partia wokalna *')}
                            </label>
                            <select 
                                required
                                value={uploadVoicePart} 
                                onChange={e => setUploadVoicePart(e.target.value)}
                                className="w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold appearance-none"
                                disabled={uploadMutation.isPending}
                            >
                                <option value="">— {t('common.select', 'Wybierz głos')} —</option>
                                <option value="TUTTI">Tutti</option>
                                {voiceLines.map(vl => <option key={vl.value} value={vl.value}>{vl.label}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
                                {t('archive.tracks.file_upload', 'Plik Audio (MP3/WAV/MIDI) *')}
                            </label>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                accept="audio/*,.mid,.midi"
                                required
                                disabled={uploadMutation.isPending}
                                className="w-full text-sm text-stone-600 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-[#002395] file:text-white hover:file:bg-[#001766] transition-all cursor-pointer bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-stone-100">
                        <Button 
                            type="submit" 
                            variant="primary"
                            disabled={uploadMutation.isPending || !selectedFile || !uploadVoicePart}
                            isLoading={uploadMutation.isPending}
                            leftIcon={!uploadMutation.isPending ? <UploadCloud size={16} /> : undefined}
                        >
                            {t('archive.tracks.upload_button', 'Wgraj nagranie')}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Track List */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">
                    {t('archive.tracks.uploaded_tracks', 'Wgrane Ścieżki Audio')} ({tracks.length})
                </h4>
                
                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-stone-400" size={24} /></div>
                ) : tracks.length > 0 ? (
                    tracks.map(track => (
                        <div key={track.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#002395]/30">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] uppercase tracking-widest font-bold antialiased text-[#002395] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2 w-max">
                                    <PlayCircle size={14} aria-hidden="true" /> {track.voice_part_display || track.voice_part}
                                </span>
                            </div>
                            <audio 
                                controls 
                                controlsList="nodownload" 
                                className="w-full md:w-72 h-10 outline-none rounded-lg flex-1" 
                                onPlay={handleAudioPlay}
                            >
                                <source src={track.audio_file} type="audio/mpeg" />
                            </audio>
                            <Button 
                                variant="danger"
                                onClick={() => setTrackToDelete(String(track.id))} 
                                disabled={deleteMutation.isPending}
                                className="self-end md:self-auto px-4 py-2"
                            >
                                <Trash2 size={16} aria-hidden="true" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-stone-400 bg-white/40 border border-dashed border-stone-300/60 rounded-2xl">
                        <AlertCircle size={32} className="mb-3 opacity-30" />
                        <p className="text-[10px] font-bold antialiased uppercase tracking-widest">{t('archive.tracks.no_files', 'Brak plików audio')}</p>
                    </div>
                )}
            </div>

            <ConfirmModal 
                isOpen={!!trackToDelete}
                title={t('archive.tracks.delete_confirm_title', 'Usunąć nagranie z serwera?')}
                description={t('archive.tracks.delete_confirm_desc', 'Plik audio zostanie bezpowrotnie usunięty z bazy danych.')}
                onConfirm={() => trackToDelete && deleteMutation.mutate(trackToDelete)}
                onCancel={() => setTrackToDelete(null)}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
}