/**
 * @file TrackUploadManager.jsx
 * @description Component for uploading and managing individual audio rehearsal tracks (MIDI/MP3).
 * Utilizes multipart/form-data for robust binary handling.
 * UI UPGRADE 2026: Glassmorphism container, custom-styled file inputs, and antialiased typography.
 * @module archive/TrackUploadManager
 * @author Krystian Bugalski
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, UploadCloud, Trash2, AlertCircle, PlayCircle } from 'lucide-react';
import api from '../../../utils/api';

export default function TrackUploadManager({ pieceId, fetchGlobal, voiceLines }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [voicePart, setVoicePart] = useState(voiceLines.length > 0 ? voiceLines[0].value : 'S1');
  const [audioFile, setAudioFile] = useState(null);

  const fetchTracks = async () => {
    try {
      const res = await api.get(`/api/tracks/`);
      const filtered = Array.isArray(res.data) ? res.data.filter(t => t.piece === pieceId) : [];
      setTracks(filtered);
    } catch (err) {
      console.error("Failed to load tracks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    fetchTracks(); 
  }, [pieceId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioFile) return;
    setIsUploading(true);

    const payload = new FormData();
    payload.append('piece', pieceId);
    payload.append('voice_part', voicePart);
    payload.append('audio_file', audioFile);

    try {
      await api.post('/api/tracks/', payload, { headers: { 'Content-Type': 'multipart/form-data' }});
      
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      await fetchTracks();
      fetchGlobal(); 
    } catch (err) { 
      alert("Failed to upload the audio file. Please check constraints and format."); 
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Na pewno usunąć to nagranie z archiwum?")) return;
    try {
      await api.delete(`/api/tracks/${id}/`);
      await fetchTracks();
      fetchGlobal(); 
    } catch (err) { 
      console.error("Deletion failed:", err); 
    }
  };

  const handleAudioPlay = (e) => {
    document.querySelectorAll('audio').forEach(audioEl => { 
      if (audioEl !== e.target) audioEl.pause(); 
    });
  };

  // Shared UI Stylings
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* --- UPLOAD FORM WIDGET --- */}
      <form onSubmit={handleUpload} className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col md:flex-row gap-5 items-end">
        <div className="w-full md:w-1/3">
          <label className={labelStyle}>Target Voice Line *</label>
          <select value={voicePart} onChange={e => setVoicePart(e.target.value)} className={glassInputStyle}>
            {voiceLines.length > 0 ? (
                voiceLines.map(vl => <option key={vl.value} value={vl.value}>{vl.label}</option>)
            ) : (
                <option value="S1">Ładowanie...</option>
            )}
          </select>
        </div>
        
        <div className="flex-1 w-full">
          <label className={labelStyle}>Audio File (MP3/MIDI) *</label>
          <input 
            type="file" required accept="audio/*" ref={fileInputRef} onChange={e => setAudioFile(e.target.files[0])}
            className="w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-[#002395] file:shadow-sm hover:file:bg-blue-50 hover:file:text-[#001766] cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
          />
        </div>
        
        <button type="submit" disabled={isUploading || !audioFile} className="w-full md:w-auto h-[46px] px-8 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase font-bold antialiased tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none flex items-center justify-center gap-2 flex-shrink-0 active:scale-95">
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Upload
        </button>
      </form>

      {/* --- ACTIVE TRACKS LIST --- */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 flex items-center gap-2 mb-4 ml-1">
            Wgrane Ścieżki Dźwiękowe
        </h4>

        {isLoading ? <Loader2 className="animate-spin text-stone-400 mx-auto my-8" /> : 
         tracks.length > 0 ? tracks.map(track => (
          <div key={track.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-xl border border-stone-200/60 shadow-sm gap-4 hover:bg-white transition-colors">
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 text-emerald-700 font-bold antialiased text-[10px] uppercase tracking-widest min-w-[100px] text-center shadow-sm flex items-center justify-center gap-2">
                <PlayCircle size={14}/> {track.voice_part_display}
              </div>
              <audio controls controlsList="nodownload" className="h-9 w-full sm:w-64 outline-none rounded-lg" onPlay={handleAudioPlay}>
                <source src={track.audio_file} type="audio/mpeg" />
              </audio>
            </div>
            
            <button onClick={() => handleDelete(track.id)} className="text-stone-400 hover:text-red-600 p-2.5 transition-all self-end md:self-auto bg-white rounded-lg border border-stone-200/60 hover:bg-red-50 hover:border-red-200 shadow-sm active:scale-95">
              <Trash2 size={16}/>
            </button>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 bg-white/40 border border-dashed border-stone-300/60 rounded-2xl">
            <AlertCircle size={32} className="mb-3 opacity-30" />
            <p className="text-[10px] font-bold antialiased uppercase tracking-widest">Brak plików audio</p>
            <p className="text-xs mt-1 max-w-xs text-center leading-relaxed">Skorzystaj z formularza powyżej, aby dodać materiały ćwiczeniowe dla poszczególnych głosów.</p>
          </div>
        )}
      </div>
    </div>
  );
}