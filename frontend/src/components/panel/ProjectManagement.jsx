/**
 * @file ProjectManagement.jsx
 * @description Master Module for Concert & Event Creation.
 * Features a tabbed slide-over interface allowing administrators to create 
 * a project, schedule its rehearsals, and cast artists seamlessly in one place.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Calendar, MapPin, Users, X, Loader2, CheckCircle2, 
  Trash2, Briefcase, Clock, Settings, UserPlus
} from 'lucide-react';
import api from '../../utils/api';

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Slide-over Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DETAILS'); // 'DETAILS' | 'REHEARSALS' | 'CAST'
  const [editingProject, setEditingProject] = useState(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/projects/');
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openPanel = (project = null) => {
    setEditingProject(project);
    setActiveTab('DETAILS'); // Zawsze startujemy od szczegółów
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setEditingProject(null);
  };

  // Bezpieczne usuwanie projektu (Soft Delete w backendzie)
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten projekt? (Spowoduje to ukrycie wszystkich powiązanych umów i prób)")) return;
    try {
      await api.delete(`/api/projects/${id}/`);
      fetchProjects();
      if (editingProject?.id === id) closePanel();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Nie udało się usunąć projektu. Prawdopodobnie posiada zablokowane powiązania.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-stone-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-800">Kreator Wydarzeń</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mt-1">
            Zarządzaj projektami, próbami i obsadą
          </p>
        </div>
        
        <button 
          onClick={() => openPanel()}
          className="flex items-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-sm transition-colors shadow-sm"
        >
          <Plus size={16} /> Nowy Projekt
        </button>
      </div>

      {/* PROJECTS LIST */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-xl w-full"></div>)}
          </div>
        ) : projects.length > 0 ? projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-stone-300 transition-colors">
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-md bg-stone-50 border border-stone-100 flex flex-col items-center justify-center flex-shrink-0 text-[#002395]">
                <span className="text-[10px] font-bold uppercase">{new Date(project.start_date).toLocaleString('pl-PL', { month: 'short' })}</span>
                <span className="text-lg font-black leading-none">{new Date(project.start_date).getDate()}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                  {project.title}
                </h3>
                <div className="flex flex-wrap gap-3 mt-1 text-xs font-medium text-stone-500">
                  {project.location && <span className="flex items-center gap-1"><MapPin size={12}/> {project.location}</span>}
                  <span className="flex items-center gap-1"><Users size={12}/> Obsada: {project.cast?.length || 0} os.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-stone-100 md:border-none pt-4 md:pt-0">
              <button onClick={() => openPanel(project)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors">
                <Settings size={14} /> Zarządzaj
              </button>
              <button onClick={() => handleDelete(project.id)} className="p-2 bg-white border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-sm transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )) : (
          <div className="p-8 text-center text-stone-500 border border-dashed border-stone-300 rounded-xl bg-stone-50">
            Brak projektów. Kliknij "Nowy Projekt", aby rozpocząć.
          </div>
        )}
      </div>

      {/* MULTI-TAB SLIDE-OVER PANEL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel} className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40"
            />
            
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-stone-200"
            >
              {/* Panel Header */}
              <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-stone-800">
                    {editingProject ? editingProject.title : 'Nowy Projekt Koncertowy'}
                  </h3>
                  {editingProject && (
                    <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mt-1">
                      ID Projektu: {editingProject.id}
                    </p>
                  )}
                </div>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 transition-colors p-2">
                  <X size={24} />
                </button>
              </div>

              {/* TABS NAVIGATION (Visible only if project exists) */}
              {editingProject && (
                <div className="flex border-b border-stone-200 bg-white px-6">
                  <button onClick={() => setActiveTab('DETAILS')} className={`py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'DETAILS' ? 'border-[#002395] text-[#002395]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                    <Briefcase size={16} /> Szczegóły
                  </button>
                  <button onClick={() => setActiveTab('REHEARSALS')} className={`py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'REHEARSALS' ? 'border-[#002395] text-[#002395]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                    <Calendar size={16} /> Próby
                  </button>
                  <button onClick={() => setActiveTab('CAST')} className={`py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'CAST' ? 'border-[#002395] text-[#002395]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                    <Users size={16} /> Obsada (Casting)
                  </button>
                </div>
              )}

              {/* PANEL CONTENT AREA */}
              <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
                {activeTab === 'DETAILS' && (
                  <ProjectDetailsForm 
                    project={editingProject} 
                    onSuccess={(updatedProject) => {
                      setEditingProject(updatedProject);
                      fetchProjects();
                    }} 
                  />
                )}
                {activeTab === 'REHEARSALS' && editingProject && (
                  <ProjectRehearsalsManager projectId={editingProject.id} />
                )}
                {activeTab === 'CAST' && editingProject && (
                  <ProjectCastManager projectId={editingProject.id} />
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: 1. Project Details Form
// ==========================================
function ProjectDetailsForm({ project, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    title: project?.title || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    call_time: project?.call_time ? new Date(project.call_time).toISOString().slice(0, 16) : '',
    location: project?.location || '',
    dress_code: project?.dress_code || '',
    description: project?.description || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const payload = { ...formData };
      if (!payload.call_time) payload.call_time = null;

      let res;
      if (project?.id) {
        res = await api.patch(`/api/projects/${project.id}/`, payload);
        setStatusMsg({ type: 'success', text: 'Zaktualizowano dane projektu.' });
      } else {
        res = await api.post('/api/projects/', payload);
        setStatusMsg({ type: 'success', text: 'Projekt utworzony! Zakładki Prób i Obsady zostały odblokowane.' });
      }
      
      onSuccess(res.data);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Wystąpił błąd podczas zapisywania.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg border border-stone-200 shadow-sm">
      {statusMsg.text && (
        <div className={`p-4 rounded-sm text-xs font-bold uppercase tracking-wider mb-4 border ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {statusMsg.text}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Tytuł Projektu *</label>
        <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Data rozpoczęcia *</label>
          <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Data zakończenia *</label>
          <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Call Time (Zbiórka)</label>
          <input type="datetime-local" value={formData.call_time} onChange={e => setFormData({...formData, call_time: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Lokalizacja</label>
          <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" placeholder="np. Filharmonia Narodowa" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Dress Code</label>
        <input type="text" value={formData.dress_code} onChange={e => setFormData({...formData, dress_code: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" placeholder="np. Black Tie" />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Opis / Uwagi Logistyczne</label>
        <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none resize-none"></textarea>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-3 px-5 rounded-sm transition-colors shadow-sm">
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        Zapisz Szczegóły
      </button>
    </form>
  );
}

// ==========================================
// SUB-COMPONENT: 2. Rehearsals Manager
// ==========================================
function ProjectRehearsalsManager({ projectId }) {
  const [rehearsals, setRehearsals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New Rehearsal Form State
  const [formData, setFormData] = useState({ date_time: '', location: '', focus: '' });

  const fetchRehearsals = async () => {
    try {
      const res = await api.get(`/api/rehearsals/?project=${projectId}`);
      // Django API currently returns all rehearsals, so we filter locally just in case. 
      // Ideally, the backend ViewSet should support filtering by project query param.
      const filtered = Array.isArray(res.data) ? res.data.filter(r => r.project === projectId) : [];
      setRehearsals(filtered.sort((a,b) => new Date(a.date_time) - new Date(b.date_time)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRehearsals(); }, [projectId]);

  const handleAddRehearsal = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/rehearsals/', { ...formData, project: projectId });
      setFormData({ date_time: '', location: '', focus: '' });
      fetchRehearsals();
    } catch (err) { console.error(err); alert("Błąd dodawania próby."); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć tę próbę? (Usunie to też obecności)")) return;
    try {
      await api.delete(`/api/rehearsals/${id}/`);
      fetchRehearsals();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      {/* ADD FORM */}
      <form onSubmit={handleAddRehearsal} className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Data i Godzina *</label>
          <input type="datetime-local" required value={formData.date_time} onChange={e => setFormData({...formData, date_time: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Sala prób *</label>
          <input type="text" required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
        <button type="submit" className="w-full md:w-auto h-[38px] px-5 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors">
          Dodaj Próbę
        </button>
      </form>

      {/* LIST */}
      <div className="space-y-2">
        {isLoading ? <Loader2 className="animate-spin text-stone-400 mx-auto" /> : 
         rehearsals.length > 0 ? rehearsals.map(reh => (
          <div key={reh.id} className="flex justify-between items-center bg-white p-4 rounded-md border border-stone-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-stone-50 px-3 py-1.5 rounded border border-stone-100 text-[#002395] font-bold text-sm">
                {new Date(reh.date_time).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm font-medium text-stone-700 flex items-center gap-2">
                <MapPin size={14} className="text-stone-400" /> {reh.location}
              </div>
            </div>
            <button onClick={() => handleDelete(reh.id)} className="text-stone-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>
          </div>
        )) : (
          <p className="text-center text-sm text-stone-500 italic py-4">Brak zaplanowanych prób. Dodaj pierwszą powyżej.</p>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: 3. Cast Manager (HR Link)
// ==========================================
function ProjectCastManager({ projectId }) {
  const [allArtists, setAllArtists] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [artistsRes, partRes] = await Promise.all([
        api.get('/api/artists/'),
        api.get('/api/participations/')
      ]);
      setAllArtists(Array.isArray(artistsRes.data) ? artistsRes.data.filter(a => a.is_active) : []);
      setParticipations(Array.isArray(partRes.data) ? partRes.data.filter(p => p.project === projectId) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const toggleCasting = async (artistId, isCurrentlyCasted, participationId) => {
    try {
      if (isCurrentlyCasted && participationId) {
        // Remove from cast
        await api.delete(`/api/participations/${participationId}/`);
      } else {
        // Add to cast (generates contract implicitly)
        await api.post('/api/participations/', { artist: artistId, project: projectId, status: 'INV' });
      }
      fetchData(); // Refresh lists
    } catch (err) {
      console.error("Casting error:", err);
      alert("Nie udało się zaktualizować obsady.");
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-stone-400" /></div>;

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">Dostępni Chórzyści</h4>
        <span className="text-[10px] uppercase font-bold text-[#002395] bg-blue-50 px-2 py-1 rounded border border-blue-200">
          W obsadzie: {participations.length}
        </span>
      </div>
      
      <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
        {allArtists.map(artist => {
          // Check if the artist has a participation record for this project
          const participation = participations.find(p => p.artist === artist.id);
          const isCasted = !!participation;

          return (
            <div key={artist.id} className={`flex items-center justify-between p-4 hover:bg-stone-50 transition-colors ${isCasted ? 'bg-blue-50/30' : ''}`}>
              <div>
                <p className="font-bold text-stone-900 text-sm">{artist.first_name} {artist.last_name}</p>
                <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">{artist.voice_type_display}</p>
              </div>
              
              <button 
                onClick={() => toggleCasting(artist.id, isCasted, participation?.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] uppercase font-bold tracking-widest transition-all border ${
                  isCasted 
                  ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' 
                  : 'bg-stone-900 border-stone-900 text-white hover:bg-[#002395] hover:border-[#002395]'
                }`}
              >
                {isCasted ? (
                  <><X size={14} /> Usuń z projektu</>
                ) : (
                  <><UserPlus size={14} /> Dodaj do obsady</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}