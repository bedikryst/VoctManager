/**
 * @file ArtistManagement.jsx
 * @description HR & Roster Management Module.
 * ENTERPRISE FEATURES: Real-time SATB Ensemble Balance Analytics, live search/filtering,
 * and contextual exposure of critical vocal metrics (e.g., Sight-reading capabilities).
 * UI UPGRADE 2026: Implements Soft UI/Glassmorphism, Semantic Color-Coding for SATB, 
 * antialiased micro-typography, and high-fidelity interaction states.
 * @module hr/ArtistManagement
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, X, UserPlus, Mail, Phone, 
  Loader2, CheckCircle2, ChevronDown, ChevronUp, Mic, Star, Activity, Search, Filter, Users
} from 'lucide-react';
import api from '../../utils/api';

export default function ArtistManagement() {
  const [artists, setArtists] = useState([]);
  const [voiceTypes, setVoiceTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceFilter, setVoiceFilter] = useState('');

  // Accordion State
  const [expandedArtistId, setExpandedArtistId] = useState(null);

  // Slide-over Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone_number: '',
    voice_type: 'SOP', is_active: true, sight_reading_skill: '',
    vocal_range_bottom: '', vocal_range_top: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [artistsRes, voiceTypesRes] = await Promise.all([
        api.get('/api/artists/'),
        api.get('/api/options/voice-types/') 
      ]);
      setArtists(Array.isArray(artistsRes.data) ? artistsRes.data : []);
      setVoiceTypes(Array.isArray(voiceTypesRes.data) ? voiceTypesRes.data : []);
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- Semantic Color Mapping for SATB ---
  const getVoiceColorConfig = (voiceType) => {
      if (!voiceType) return { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
      if (voiceType.startsWith('S')) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
      if (voiceType.startsWith('A') || voiceType === 'MEZ') return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
      if (voiceType.startsWith('T') || voiceType === 'CT') return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
      if (voiceType.startsWith('B')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      return { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
  };

  // Derived State for Real-time Analytics
  const activeArtists = artists.filter(a => a.is_active);
  
  const ensembleBalance = useMemo(() => {
      return {
          S: activeArtists.filter(a => a.voice_type?.startsWith('S')).length,
          A: activeArtists.filter(a => a.voice_type?.startsWith('A') || a.voice_type === 'MEZ').length,
          T: activeArtists.filter(a => a.voice_type?.startsWith('T') || a.voice_type === 'CT').length,
          B: activeArtists.filter(a => a.voice_type?.startsWith('B')).length,
          Total: activeArtists.length
      };
  }, [activeArtists]);

  const displayArtists = useMemo(() => {
      return artists.filter(a => {
          const matchesSearch = `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesVoice = voiceFilter ? a.voice_type === voiceFilter : true;
          return matchesSearch && matchesVoice;
      });
  }, [artists, searchTerm, voiceFilter]);

  // Action Handlers
  const toggleExpand = (id) => setExpandedArtistId(prev => prev === id ? null : id);

  const openPanel = (artist = null) => {
    setStatusMsg({ type: '', text: '' });
    if (artist) {
      setEditingId(artist.id);
      setFormData({
        first_name: artist.first_name || '', last_name: artist.last_name || '',
        email: artist.email || '', phone_number: artist.phone_number || '',
        voice_type: artist.voice_type || 'SOP', is_active: artist.is_active ?? true,
        sight_reading_skill: artist.sight_reading_skill || '',
        vocal_range_bottom: artist.vocal_range_bottom || '', vocal_range_top: artist.vocal_range_top || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        first_name: '', last_name: '', email: '', phone_number: '', 
        voice_type: voiceTypes.length > 0 ? voiceTypes[0].value : 'SOP', 
        is_active: true, sight_reading_skill: '', vocal_range_bottom: '', vocal_range_top: ''
      });
    }
    setIsPanelOpen(true);
    document.body.style.overflow = 'hidden'; 
  };

  const closePanel = () => {
      setIsPanelOpen(false);
      document.body.style.overflow = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    const payload = { ...formData };
    payload.sight_reading_skill = payload.sight_reading_skill ? parseInt(payload.sight_reading_skill) : null;

    try {
      if (editingId) {
        await api.patch(`/api/artists/${editingId}/`, payload);
        setStatusMsg({ type: 'success', text: 'Zaktualizowano profil artysty.' });
      } else {
        await api.post('/api/artists/', payload);
        setStatusMsg({ type: 'success', text: 'Dodano artystę. Konto wygenerowane!' });
      }
      fetchData(); 
      setTimeout(() => { closePanel(); setIsSubmitting(false); }, 1500);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.email ? 'Ten adres e-mail jest już zajęty.' : 'Wystąpił błąd podczas zapisywania.' });
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id, currentStatus) => {
    if (!window.confirm(`Czy na pewno chcesz ${currentStatus ? 'zarchiwizować' : 'aktywować'} tego artystę?`)) return;
    try {
      await api.patch(`/api/artists/${id}/`, { is_active: !currentStatus });
      fetchData();
    } catch (err) { console.error("Failed to toggle status:", err); }
  };

  const renderStars = (level) => {
    if (!level) return <span className="text-stone-300 italic text-[9px] font-bold antialiased uppercase tracking-widest">A vista: Brak</span>;
    return (
      <div className="flex gap-1 items-center" title={`Czytanie a vista: ${level}/5`}>
        <span className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400 mr-1.5 hidden sm:inline-block">A vista:</span>
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} size={12} className={star <= level ? "text-amber-400 fill-amber-400" : "text-stone-200"} />
        ))}
      </div>
    );
  };

  // Shared UI Styles
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-[2rem]";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-6xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Users size={12} className="text-[#002395]" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Zasoby Ludzkie
                          </p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Zarządzanie <span className="italic text-[#002395]">Zespołem</span>.
                      </h1>
                  </div>
                  <button onClick={() => openPanel()} className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95">
                      <UserPlus size={16} /> Dodaj Artystę
                  </button>
              </div>
          </motion.div>
      </header>

      {/* --- ENSEMBLE BALANCE WIDGET (COLOR-CODED) --- */}
      <div className="inline-flex flex-wrap items-center gap-2.5 p-2.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl w-full sm:w-auto mb-2">
          <div className="px-5 py-2.5 bg-rose-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-rose-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-rose-500 uppercase tracking-widest">Soprany</span>
              <span className="text-xl font-black text-rose-700 leading-none mt-1.5">{ensembleBalance.S}</span>
          </div>
          <div className="px-5 py-2.5 bg-purple-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-purple-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-purple-500 uppercase tracking-widest">Alty</span>
              <span className="text-xl font-black text-purple-700 leading-none mt-1.5">{ensembleBalance.A}</span>
          </div>
          <div className="px-5 py-2.5 bg-sky-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-sky-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-sky-500 uppercase tracking-widest">Tenory</span>
              <span className="text-xl font-black text-sky-700 leading-none mt-1.5">{ensembleBalance.T}</span>
          </div>
          <div className="px-5 py-2.5 bg-emerald-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-emerald-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-emerald-500 uppercase tracking-widest">Basy</span>
              <span className="text-xl font-black text-emerald-700 leading-none mt-1.5">{ensembleBalance.B}</span>
          </div>
          <div className="px-6 py-2.5 ml-2 border-l border-stone-200/50 flex flex-col items-center justify-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">Tutti</span>
              <span className="text-xl font-black text-stone-800 leading-none mt-1.5">{ensembleBalance.Total}</span>
          </div>
      </div>

      {/* --- SEARCH & FILTER BAR --- */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" />
              </div>
              <input 
                  type="text" 
                  placeholder="Szukaj po nazwisku..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={glassInputStyle}
              />
          </div>
          <div className="relative w-full sm:w-72 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" />
              </div>
              <select 
                  value={voiceFilter} 
                  onChange={e => setVoiceFilter(e.target.value)}
                  className={`${glassInputStyle} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszystkie głosy</option>
                  {voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
              </select>
          </div>
      </div>

      {/* --- ARTIST CARDS (ACCORDION) --- */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-stone-100/50 rounded-[2rem] w-full border border-white/50"></div>)}
          </div>
        ) : displayArtists.length > 0 ? displayArtists.map((artist) => {
          const isExpanded = expandedArtistId === artist.id;
          const initials = `${artist.first_name?.charAt(0) || ''}${artist.last_name?.charAt(0) || ''}`.toUpperCase();
          const vColor = getVoiceColorConfig(artist.voice_type); // Semantic Colors

          return (
            <div key={artist.id} className={`${glassCardStyle} transition-all duration-300 ${!artist.is_active ? 'opacity-60 grayscale hover:grayscale-0 bg-stone-50/30' : isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}>
              
              {/* Core Card Details */}
              <div 
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer relative z-10 hover:bg-white/40 transition-colors"
                onClick={() => toggleExpand(artist.id)}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold tracking-widest text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border ${artist.is_active ? 'bg-white border-stone-100 text-[#002395]' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-3 tracking-tight">
                      {artist.first_name} {artist.last_name}
                      {!artist.is_active && <span className="px-2 py-1 bg-stone-200 text-stone-600 text-[8px] antialiased uppercase tracking-widest font-bold rounded-md border border-stone-300 shadow-sm">Archiwum</span>}
                    </h3>
                    <div className="flex items-center gap-4 mt-1.5">
                        {/* COLOR CODED VOICE BADGE */}
                        <span className={`px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${artist.is_active ? `${vColor.bg} ${vColor.text} ${vColor.border}` : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                          {artist.voice_type_display}
                        </span>
                        
                        {/* Instant visual access to sight-reading capability */}
                        {artist.is_active && renderStars(artist.sight_reading_skill)}
                    </div>
                  </div>
                </div>

                <div className="text-stone-400 self-end md:self-auto hidden sm:block bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
                  {isExpanded ? <ChevronUp size={20} className="text-[#002395]" /> : <ChevronDown size={20} />}
                </div>
              </div>

              {/* Expanded Accordion Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-stone-50/40 border-t border-white/60 overflow-hidden relative z-0"
                  >
                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                      
                      {/* Contact Info */}
                      <div>
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Dane Kontaktowe</h4>
                        <div className="space-y-4 text-sm text-stone-700 font-medium">
                          <p className="flex items-center gap-3">
                            <Mail size={16} className="text-stone-400" />
                            <a href={`mailto:${artist.email}`} className="hover:text-[#002395] transition-colors">{artist.email}</a>
                          </p>
                          <p className="flex items-center gap-3">
                            <Phone size={16} className="text-stone-400" />
                            {artist.phone_number ? (
                              <a href={`tel:${artist.phone_number}`} className="hover:text-[#002395] transition-colors">{artist.phone_number}</a>
                            ) : <span className="text-stone-400 italic text-[11px] font-normal">Brak telefonu</span>}
                          </p>
                           <p className="text-[9px] font-bold antialiased text-stone-500 uppercase tracking-widest mt-5 bg-white/60 px-3 py-2 rounded-lg border border-stone-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] inline-block">
                            Konto: {artist.username ? `@${artist.username}` 
                              : (artist.user && typeof artist.user === 'object' && artist.user.username) ? `@${artist.user.username}`
                              : (artist.user) ? `Aktywne (ID: ${artist.user})` : 'Brak konta'}
                          </p>
                        </div>
                      </div>

                      {/* Vocal Profile Range */}
                      <div>
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Profil Wokalny</h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 flex items-center gap-2 mb-2"><Activity size={14}/> Skala Głosu</p>
                            <p className={`text-sm font-bold bg-white border inline-block px-4 py-2 rounded-xl shadow-sm ${vColor.border} ${vColor.text}`}>
                              {(artist.vocal_range_bottom || artist.vocal_range_top) 
                                ? `${artist.vocal_range_bottom || '?'}  —  ${artist.vocal_range_top || '?'}`
                                : <span className="text-stone-400 italic font-normal text-[10px] uppercase tracking-widest">Brak danych</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Administrative Actions */}
                      <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 border-stone-200/60 pt-6 md:pt-0">
                        <button onClick={(e) => { e.stopPropagation(); openPanel(artist); }} className="w-full py-3.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                          <Edit2 size={14} /> Edytuj Profil
                        </button>
                        
                        <button onClick={(e) => { e.stopPropagation(); handleDeactivate(artist.id, artist.is_active); }} className={`w-full py-3.5 bg-white border text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 ${artist.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'}`}>
                          {artist.is_active ? <><Trash2 size={14} /> Zarchiwizuj</> : <><CheckCircle2 size={14} /> Aktywuj Konto</>}
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          );
        }) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} p-16 flex flex-col items-center justify-center text-center`}>
             <Search size={48} className="text-stone-300 mb-4 opacity-50" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
            <span className="text-xs text-stone-400 max-w-sm">Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.</span>
          </motion.div>
        )}
      </div>

      {/* --- SLIDE-OVER PANEL --- */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel} className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-40"
            />
            
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
            >
              <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
                <h3 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
                  {editingId ? 'Edycja Profilu' : 'Nowy Artysta'}
                </h3>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-2.5 rounded-2xl active:scale-95">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                
                <form id="artist-form" onSubmit={handleSubmit} className="space-y-8 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative">
                  
                  {statusMsg.text && (
                    <div className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest mb-6 border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
                      {statusMsg.text}
                    </div>
                  )}
                  
                  {/* Basic Info */}
                  <div className="space-y-5">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Dane Podstawowe</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={labelStyle}>Imię *</label>
                        <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={`${glassInputStyle} font-bold`} />
                      </div>
                      <div>
                        <label className={labelStyle}>Nazwisko *</label>
                        <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={`${glassInputStyle} font-bold`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={labelStyle}>E-mail *</label>
                        <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={glassInputStyle} />
                      </div>
                      <div>
                        <label className={labelStyle}>Telefon</label>
                        <input type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className={glassInputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* Vocal Profile */}
                  <div className="space-y-5 pt-4">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Profil Wokalny</h4>
                    
                    <div>
                      <label className={labelStyle}>Rodzaj Głosu *</label>
                      <select value={formData.voice_type} onChange={e => setFormData({...formData, voice_type: e.target.value})} className={`${glassInputStyle} font-bold appearance-none`}>
                        {voiceTypes.length > 0 ? voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>) : <option value="SOP">Ładowanie...</option>}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={labelStyle} title="Najniższy dźwięk">Skala (Dół)</label>
                        <input type="text" placeholder="np. G2" value={formData.vocal_range_bottom} onChange={e => setFormData({...formData, vocal_range_bottom: e.target.value})} className={`${glassInputStyle} text-center font-bold text-[#002395]`} />
                      </div>
                      <div>
                        <label className={labelStyle} title="Najwyższy dźwięk">Skala (Góra)</label>
                        <input type="text" placeholder="np. C5" value={formData.vocal_range_top} onChange={e => setFormData({...formData, vocal_range_top: e.target.value})} className={`${glassInputStyle} text-center font-bold text-[#002395]`} />
                      </div>
                    </div>

                    <div>
                      <label className={labelStyle}>Czytanie a vista (Ocena)</label>
                      <select value={formData.sight_reading_skill} onChange={e => setFormData({...formData, sight_reading_skill: e.target.value})} className={`${glassInputStyle} font-bold appearance-none`}>
                        <option value="">-- Brak oceny --</option>
                        {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num} Gwiazdki</option>)}
                      </select>
                    </div>
                  </div>

                  {/* System Account Flag */}
                  <div className="pt-6 border-t border-stone-200/60">
                     <label className="flex items-center gap-4 p-4 border border-stone-200/80 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer hover:border-[#002395]/40 transition-colors">
                      <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-[#002395] focus:ring-[#002395]/20 border-stone-300 rounded-md cursor-pointer" />
                      <div>
                        <span className="block text-sm font-bold text-stone-800">Aktywny dostęp do platformy</span>
                        <span className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mt-1">Zablokuje logowanie w przypadku odznaczenia.</span>
                      </div>
                    </label>
                  </div>

                  {/* Form Action Button */}
                  <div className="pt-6">
                    <button 
                      type="submit" disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-widest font-bold antialiased py-4 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Zapisz Profil Artysty
                    </button>
                  </div>

                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}