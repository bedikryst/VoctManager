/**
 * @file ArtistManagement.jsx
 * @description HR & Roster Management Module.
 * Allows administrators to perform CRUD operations on the ensemble's roster.
 * Features a modern slide-over panel for data entry and seamless API integration.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, UserPlus, Mail, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';

// Enums matching the Django backend choices
const VOICE_TYPES = [
  { value: 'SOP', label: 'Sopran' },
  { value: 'MEZ', label: 'Mezzosopran' },
  { value: 'ALT', label: 'Alt' },
  { value: 'CT', label: 'Kontratenor' },
  { value: 'TEN', label: 'Tenor' },
  { value: 'BAR', label: 'Baryton' },
  { value: 'BAS', label: 'Bas' },
  { value: 'DIR', label: 'Dyrygent/Kierownik' }
];

export default function ArtistManagement() {
  const [artists, setArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Slide-over Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    voice_type: 'SOP',
    is_active: true
  });

  // 1. Fetch Roster Data
  const fetchArtists = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/artists/');
      setArtists(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch artists:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
  }, []);

  // 2. Open Panel for Create or Edit
  const openPanel = (artist = null) => {
    setStatusMsg({ type: '', text: '' });
    if (artist) {
      setEditingId(artist.id);
      setFormData({
        first_name: artist.first_name,
        last_name: artist.last_name,
        email: artist.email,
        phone_number: artist.phone_number || '',
        voice_type: artist.voice_type,
        is_active: artist.is_active
      });
    } else {
      setEditingId(null);
      setFormData({
        first_name: '', last_name: '', email: '', phone_number: '', voice_type: 'SOP', is_active: true
      });
    }
    setIsPanelOpen(true);
  };

  const closePanel = () => setIsPanelOpen(false);

  // 3. Handle Form Submission (POST or PATCH)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    try {
      if (editingId) {
        await api.patch(`/api/artists/${editingId}/`, formData);
        setStatusMsg({ type: 'success', text: 'Zaktualizowano profil artysty.' });
      } else {
        await api.post('/api/artists/', formData);
        setStatusMsg({ type: 'success', text: 'Dodano artystę. Konto zostało wygenerowane automatycznie!' });
      }
      
      fetchArtists(); // Refresh the table
      setTimeout(() => {
        closePanel();
        setIsSubmitting(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setStatusMsg({ 
        type: 'error', 
        text: err.response?.data?.email ? 'Ten adres e-mail jest już zajęty.' : 'Wystąpił błąd podczas zapisywania.' 
      });
      setIsSubmitting(false);
    }
  };

  // 4. Soft Delete (Deactivate) instead of hard delete for safety
  const handleDeactivate = async (id, currentStatus) => {
    if (!window.confirm(`Czy na pewno chcesz ${currentStatus ? 'dezaktywować' : 'aktywować'} tego artystę?`)) return;
    try {
      await api.patch(`/api/artists/${id}/`, { is_active: !currentStatus });
      fetchArtists();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-stone-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-800">Zarządzanie Zespołem</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mt-1">
            Aktywnych artystów: {artists.filter(a => a.is_active).length}
          </p>
        </div>
        
        <button 
          onClick={() => openPanel()}
          className="flex items-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-sm transition-colors shadow-sm"
        >
          <UserPlus size={16} /> Dodaj artystę
        </button>
      </div>

      {/* ROSTER TABLE */}
      <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-[10px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-6 py-4">Artysta</th>
                <th className="px-6 py-4">Głos</th>
                <th className="px-6 py-4 hidden md:table-cell">Kontakt</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#002395]" /></td>
                </tr>
              ) : artists.length > 0 ? artists.map((artist) => (
                <tr key={artist.id} className={`hover:bg-stone-50 transition-colors ${!artist.is_active ? 'opacity-50 grayscale' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-stone-900">{artist.first_name} {artist.last_name}</div>
                    <div className="text-[10px] uppercase text-stone-400">@{artist.user ? artist.user.username : 'Brak konta'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-700">
                    {artist.voice_type_display}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-xs"><Mail size={12} className="text-stone-400"/> {artist.email}</div>
                    {artist.phone_number && <div className="flex items-center gap-2 text-xs mt-1"><Phone size={12} className="text-stone-400"/> {artist.phone_number}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold rounded-sm border ${artist.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                      {artist.is_active ? 'Aktywny' : 'Zarchiwizowany'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openPanel(artist)} className="p-2 text-stone-400 hover:text-[#002395] transition-colors bg-white border border-stone-200 rounded-sm hover:border-[#002395]">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeactivate(artist.id, artist.is_active)} className={`p-2 transition-colors bg-white border border-stone-200 rounded-sm ${artist.is_active ? 'text-stone-400 hover:text-red-600 hover:border-red-600 hover:bg-red-50' : 'text-stone-400 hover:text-green-600 hover:border-green-600 hover:bg-green-50'}`}>
                      {artist.is_active ? <Trash2 size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-stone-500 italic">Brak artystów w bazie.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLIDE-OVER PANEL (Creation / Editing Form) */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40"
            />
            
            {/* Panel */}
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-stone-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
                <h3 className="font-serif text-xl font-bold text-stone-800">
                  {editingId ? 'Edycja Artysty' : 'Nowy Artysta'}
                </h3>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 transition-colors p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                
                {statusMsg.text && (
                  <div className={`p-4 rounded-sm text-xs font-bold uppercase tracking-wider mb-6 border ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {statusMsg.text}
                  </div>
                )}

                <form id="artist-form" onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Imię *</label>
                      <input 
                        type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] focus:ring-1 focus:ring-[#002395] outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Nazwisko *</label>
                      <input 
                        type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] focus:ring-1 focus:ring-[#002395] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">E-mail *</label>
                    <input 
                      type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] focus:ring-1 focus:ring-[#002395] outline-none transition-all"
                    />
                    {!editingId && <p className="text-[10px] text-stone-400 mt-1">Na ten adres zostanie utworzone konto systemowe.</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Telefon</label>
                    <input 
                      type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] focus:ring-1 focus:ring-[#002395] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Rodzaj Głosu *</label>
                    <select 
                      value={formData.voice_type} onChange={e => setFormData({...formData, voice_type: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] focus:ring-1 focus:ring-[#002395] outline-none transition-all"
                    >
                      {VOICE_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                    </select>
                  </div>

                  <label className="flex items-center gap-3 p-4 border border-stone-200 rounded-sm bg-stone-50 cursor-pointer hover:border-stone-300 transition-colors">
                    <input 
                      type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 text-[#002395] focus:ring-[#002395] border-stone-300 rounded-sm"
                    />
                    <div>
                      <span className="block text-xs font-bold text-stone-800">Konto Aktywne</span>
                      <span className="block text-[10px] text-stone-500">Pozwala użytkownikowi na logowanie do panelu.</span>
                    </div>
                  </label>
                </form>
              </div>

              <div className="p-6 border-t border-stone-100 bg-stone-50">
                <button 
                  type="submit" form="artist-form" disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-[#002395] disabled:bg-stone-400 text-white text-[10px] uppercase tracking-widest font-bold py-3 px-5 rounded-sm transition-colors shadow-sm"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Zapisz zmiany
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}