/**
 * @file CrewManagement.jsx
 * @description External Collaborators & Crew Management Module.
 * Provides CRUD operations for production staff (sound engineers, lighting, logistics).
 * ENTERPRISE UPGRADE 2026: Fully integrated Glassmorphism UI, Editorial Headers, 
 * antialiased micro-typography, and seamless Slide-over form interactions.
 * @module admin/CrewManagement
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, X, Search, Filter, Wrench, 
  Mail, Phone, Briefcase, Loader2, CheckCircle2 
} from 'lucide-react';
import api from '../../utils/api';

const SPECIALTY_CHOICES = [
  { value: 'SOUND', label: 'Reżyseria Dźwięku' },
  { value: 'LIGHT', label: 'Reżyseria Świateł' },
  { value: 'VISUALS', label: 'Sztuka Wizualna' },
  { value: 'INSTRUMENT', label: 'Instrumentalista' },
  { value: 'LOGISTICS', label: 'Logistyka' },
  { value: 'OTHER', label: 'Inne' }
];

export default function CrewManagement() {
  const [crew, setCrew] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  // Slide-over Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone_number: '',
    company_name: '', specialty: 'OTHER'
  });

  const fetchCrew = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/collaborators/');
      setCrew(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch crew data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCrew(); }, []);

  const displayCrew = useMemo(() => {
      return crew.filter(c => {
          const matchesSearch = `${c.first_name} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesSpecialty = specialtyFilter ? c.specialty === specialtyFilter : true;
          return matchesSearch && matchesSpecialty;
      });
  }, [crew, searchTerm, specialtyFilter]);

  const openPanel = (person = null) => {
    setStatusMsg({ type: '', text: '' });
    if (person) {
      setEditingId(person.id);
      setFormData({
        first_name: person.first_name || '', last_name: person.last_name || '',
        email: person.email || '', phone_number: person.phone_number || '',
        company_name: person.company_name || '', specialty: person.specialty || 'OTHER'
      });
    } else {
      setEditingId(null);
      setFormData({
        first_name: '', last_name: '', email: '', phone_number: '', 
        company_name: '', specialty: 'OTHER'
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

    try {
      if (editingId) {
        await api.patch(`/api/collaborators/${editingId}/`, formData);
        setStatusMsg({ type: 'success', text: 'Zaktualizowano profil współpracownika.' });
      } else {
        await api.post('/api/collaborators/', formData);
        setStatusMsg({ type: 'success', text: 'Dodano nową osobę do bazy.' });
      }
      fetchCrew(); 
      setTimeout(() => { closePanel(); setIsSubmitting(false); }, 1500);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Wystąpił błąd podczas zapisywania danych.' });
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę osobę z bazy? Zniknie ona z historii projektów.")) return;
    try {
      await api.delete(`/api/collaborators/${id}/`);
      fetchCrew();
    } catch (err) { 
        alert("Nie można usunąć tej osoby, ponieważ jest powiązana z istniejącymi projektami. Spróbuj edytować jej dane."); 
    }
  };

  const getSpecialtyLabel = (val) => SPECIALTY_CHOICES.find(s => s.value === val)?.label || 'Inne';

  // --- UI Shared Styles ---
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
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
                          <Wrench size={12} className="text-[#002395]" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Logistyka
                          </p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Ekipa <span className="italic text-[#002395]">Techniczna</span>.
                      </h1>
                  </div>
                  <button onClick={() => openPanel()} className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95">
                      <Plus size={16} /> Dodaj Osobę / Firmę
                  </button>
              </div>
          </motion.div>
      </header>

      {/* --- SEARCH & FILTER BAR --- */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" />
              </div>
              <input 
                  type="text" placeholder="Szukaj po nazwisku lub firmie..." 
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className={glassInputStyle}
              />
          </div>
          <div className="relative w-full sm:w-72 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" />
              </div>
              <select 
                  value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
                  className={`${glassInputStyle} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszystkie specjalizacje</option>
                  {SPECIALTY_CHOICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
          </div>
      </div>

      {/* --- GRID VIEWS --- */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-stone-100/50 border border-white/50 rounded-2xl w-full"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {displayCrew.length > 0 ? displayCrew.map((person) => (
              <motion.div 
                key={person.id} layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`${glassCardStyle} p-6 flex flex-col justify-between hover:border-[#002395]/20 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group`}
              >
                {/* Opcjonalny znak wodny narzędzia dla klimatu */}
                <div className="absolute -right-4 -top-4 text-[#002395] opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <Wrench size={100} strokeWidth={1} />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white text-stone-600 border border-stone-100 flex items-center justify-center shadow-sm font-bold tracking-widest text-xs flex-shrink-0">
                        {person.first_name[0]}{person.last_name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-900 text-lg leading-tight tracking-tight">{person.first_name} {person.last_name}</h3>
                        <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-2 py-1 rounded-md border border-blue-100 mt-1.5 inline-block shadow-sm">
                          {getSpecialtyLabel(person.specialty)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-600 mb-6 font-medium">
                    {person.company_name && (
                        <p className="flex items-center gap-2.5"><Briefcase size={14} className="text-stone-400"/> <span className="font-bold text-stone-800 tracking-tight">{person.company_name}</span></p>
                    )}
                    <p className="flex items-center gap-2.5"><Mail size={14} className="text-stone-400"/> {person.email || <span className="italic text-stone-400 font-normal">Brak e-mail</span>}</p>
                    <p className="flex items-center gap-2.5"><Phone size={14} className="text-stone-400"/> {person.phone_number || <span className="italic text-stone-400 font-normal">Brak telefonu</span>}</p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
                  <button onClick={() => openPanel(person)} className="flex-1 py-2.5 bg-white border border-stone-200/80 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                    <Edit2 size={14} /> Edytuj
                  </button>
                  <button onClick={() => handleDelete(person.id)} className="p-3 bg-white border border-stone-200/80 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-95" title="Usuń z bazy">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            )) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} col-span-full p-16 text-center flex flex-col items-center justify-center`}>
                <Wrench size={48} className="text-stone-300 mb-4 opacity-50" />
                <span className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak współpracowników</span>
                <span className="text-xs text-stone-400 max-w-sm">Zmień filtry lub dodaj nową osobę / firmę do bazy.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
              className="fixed inset-y-0 right-0 w-full max-w-md bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
            >
              <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
                <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                  {editingId ? 'Edycja Danych' : 'Nowy Współpracownik'}
                </h3>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 transition-colors p-2.5 bg-white rounded-xl border border-stone-200/60 shadow-sm active:scale-95"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-stone-50/50">
                
                <form id="crew-form" onSubmit={handleSubmit} className="space-y-6 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative">
                  
                  {statusMsg.text && (
                    <div className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest mb-6 border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
                      {statusMsg.text}
                    </div>
                  )}
                  
                  <div className="space-y-5">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Osoba Kontaktowa</h4>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={labelStyle}>Imię *</label>
                        <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={`${glassInputStyle} font-bold`} />
                      </div>
                      <div>
                        <label className={labelStyle}>Nazwisko *</label>
                        <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={`${glassInputStyle} font-bold`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={labelStyle}>E-mail</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={glassInputStyle} />
                      </div>
                      <div>
                        <label className={labelStyle}>Telefon</label>
                        <input type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className={glassInputStyle} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 pt-4 border-t border-stone-200/60">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Profil Działalności</h4>
                    
                    <div>
                      <label className={labelStyle}>Specjalizacja *</label>
                      <select value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className={`${glassInputStyle} font-bold text-stone-700 appearance-none`}>
                        {SPECIALTY_CHOICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className={labelStyle}>Firma / Marka (Opcjonalnie)</label>
                      <input type="text" placeholder="np. SoundTech Pro Sp. z o.o." value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className={`${glassInputStyle} font-bold`} />
                    </div>
                  </div>
                  
                  <div className="pt-6">
                    <button 
                      type="submit" disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-widest font-bold antialiased py-4 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Zapisz do bazy
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