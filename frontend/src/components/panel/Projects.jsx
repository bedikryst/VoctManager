/**
 * Projects & Concerts Module
 * Author: Krystian Bugalski
 * * Wyświetla listę nadchodzących i minionych projektów.
 * Wykorzystuje zagnieżdżone dane z API (obsada, program) do zaprezentowania
 * pełnego kontekstu logistycznego i artystycznego na jednej karcie.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Shirt, Users, Music, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../utils/api';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/api/projects/');
        setProjects(response.data);
      } catch (err) {
        console.error("Błąd podczas pobierania projektów:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const toggleExpand = (id) => {
    setExpandedProjectId(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return <div className="animate-pulse flex space-x-4 p-8">Ładowanie projektów...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Projekty i Koncerty</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Łącznie: {projects.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {projects.length > 0 ? projects.map((project) => (
          <motion.div 
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
          >
            {/* Nagłówek Karty */}
            <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-medium text-stone-900 mb-2" style={{ fontFamily: "'Cormorant', serif" }}>
                  {project.title}
                </h3>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-stone-500">
                  <span className="flex items-center gap-1.5"><Calendar size={14} className="text-[#002395]" /> {project.start_date}</span>
                  {project.location && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#002395]" /> {project.location}</span>}
                  {project.call_time && <span className="flex items-center gap-1.5"><Clock size={14} className="text-[#002395]" /> Zbiórka: {new Date(project.call_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                </div>
              </div>
              
              <button 
                onClick={() => toggleExpand(project.id)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md text-[10px] uppercase tracking-widest font-bold text-stone-600 transition-colors w-max"
              >
                {expandedProjectId === project.id ? (
                  <>Zwiń szczegóły <ChevronUp size={14} /></>
                ) : (
                  <>Rozwiń szczegóły <ChevronDown size={14} /></>
                )}
              </button>
            </div>

            {/* Rozwijane Szczegóły (Program i Obsada) */}
            {expandedProjectId === project.id && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-6 bg-stone-50 grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                
                {/* SETLISTA (Program) */}
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 pb-2 border-b border-stone-200">
                    <Music size={16} className="text-[#002395]" /> Program Koncertu
                  </h4>
                  {project.program && project.program.length > 0 ? (
                    <ul className="space-y-2">
                      {project.program.sort((a,b) => a.order - b.order).map(item => (
                        <li key={item.piece_id} className="text-sm text-stone-700 flex items-start gap-3">
                          <span className="text-stone-400 font-bold w-4">{item.order}.</span>
                          <span className={item.is_encore ? "italic text-[#002395] font-medium" : ""}>
                            {item.title} {item.is_encore && "(BIS)"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-stone-500 italic">Brak ustalonego programu.</p>
                  )}
                </div>

                {/* OBSADA (Cast) */}
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 pb-2 border-b border-stone-200">
                    <Users size={16} className="text-[#002395]" /> Obsada
                  </h4>
                  {project.cast && project.cast.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {project.cast.map(artist => (
                        <div key={artist.id} className="text-sm text-stone-700 flex items-center justify-between bg-white px-3 py-1.5 rounded-sm border border-stone-200 shadow-sm">
                          <span className="truncate">{artist.first_name} {artist.last_name}</span>
                          <span className="text-[10px] uppercase font-bold text-stone-400">{artist.voice_type_display}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic">Brak przypisanych wykonawców.</p>
                  )}
                </div>

                {/* DRESS CODE & OPIS */}
                {(project.dress_code || project.description) && (
                  <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-stone-200">
                    {project.dress_code && (
                      <p className="text-sm text-stone-700 flex items-center gap-2 mb-2">
                        <Shirt size={14} className="text-stone-400" /> 
                        <span className="font-bold text-[10px] uppercase tracking-widest text-stone-500">Dress Code:</span> {project.dress_code}
                      </p>
                    )}
                    {project.description && (
                      <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                )}

              </motion.div>
            )}
          </motion.div>
        )) : (
          <div className="p-8 text-center text-stone-500 border border-dashed border-stone-300 rounded-xl bg-stone-50">
            Brak projektów do wyświetlenia. Dodaj je w panelu Django.
          </div>
        )}
      </div>
    </div>
  );
}