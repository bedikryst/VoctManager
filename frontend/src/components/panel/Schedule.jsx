/**
 * @file Schedule.jsx
 * @description Artist Schedule & Timeline Module.
 * Provides a read-only, chronologically sorted timeline of upcoming rehearsals
 * and concerts specifically assigned to the authenticated artist.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Briefcase, Music, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

export default function Schedule() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        // Backend filters these endpoints automatically based on the logged-in user
        const [projectsRes, rehearsalsRes] = await Promise.all([
          api.get('/api/projects/'),
          api.get('/api/rehearsals/')
        ]);

        const projects = Array.isArray(projectsRes.data) ? projectsRes.data : [];
        const rehearsals = Array.isArray(rehearsalsRes.data) ? rehearsalsRes.data : [];

        // 1. Format Projects into Timeline Events
        const formattedProjects = projects.map(proj => ({
          id: `proj-${proj.id}`,
          type: 'PROJECT',
          title: proj.title,
          date: new Date(proj.start_date),
          location: proj.location || 'Lokalizacja wkrótce',
          time: proj.call_time ? new Date(proj.call_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : null,
          details: proj.dress_code ? `Dress code: ${proj.dress_code}` : 'Koncert / Wydarzenie główne',
          project_id: proj.id
        }));

        // 2. Format Rehearsals into Timeline Events
        // Filter rehearsals to only include those belonging to the user's projects
        const userProjectIds = projects.map(p => p.id);
        const userRehearsals = rehearsals.filter(r => userProjectIds.includes(r.project));

        const formattedRehearsals = userRehearsals.map(reh => {
          const parentProject = projects.find(p => p.id === reh.project);
          return {
            id: `reh-${reh.id}`,
            type: 'REHEARSAL',
            title: `Próba: ${parentProject?.title || 'Projekt'}`,
            date: new Date(reh.date_time),
            location: reh.location,
            time: new Date(reh.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
            details: reh.focus || 'Próba ogólna',
            project_id: reh.project
          };
        });

        // 3. Merge, Sort Chronologically, and filter out past events (optional, but good for UX)
        const now = new Date();
        // Reset time to midnight for accurate day comparison
        now.setHours(0, 0, 0, 0); 

        const combinedTimeline = [...formattedProjects, ...formattedRehearsals]
          .filter(event => event.date >= now) // Hide past events
          .sort((a, b) => a.date - b.date);

        setTimelineEvents(combinedTimeline);
      } catch (err) {
        console.error("Błąd ładowania harmonogramu:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 pt-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-xl w-full"></div>)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in cursor-default">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-800">Mój Harmonogram</h2>
          <p className="text-xs font-medium text-stone-500 mt-1">Najbliższe próby i koncerty</p>
        </div>
      </div>

      {/* TIMELINE LIST */}
      <div className="relative border-l-2 border-stone-200 ml-4 md:ml-6 space-y-8 pb-12">
        {timelineEvents.length > 0 ? timelineEvents.map((event, index) => {
          const isProject = event.type === 'PROJECT';
          
          return (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-6 md:pl-8"
            >
              {/* Timeline Dot / Icon */}
              <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-[#fdfbf7] flex items-center justify-center shadow-sm ${
                isProject ? 'bg-[#002395] text-white' : 'bg-white text-stone-400'
              }`}>
                {isProject ? <Briefcase size={14} /> : <Music size={14} />}
              </div>

              {/* Event Card */}
              <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${
                isProject ? 'bg-white border-[#002395]/20' : 'bg-white border-stone-200 hover:border-stone-300'
              }`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Date Badge (Mobile top, Desktop left) */}
                  <div className="flex flex-col items-center justify-center bg-stone-50 border border-stone-100 rounded-lg p-3 w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      {event.date.toLocaleString('pl-PL', { month: 'short' })}
                    </span>
                    <span className={`text-2xl font-black leading-none ${isProject ? 'text-[#002395]' : 'text-stone-700'}`}>
                      {event.date.getDate()}
                    </span>
                  </div>

                  {/* Event Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${
                        isProject ? 'bg-blue-50 text-[#002395]' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {isProject ? 'Koncert / Wydarzenie' : 'Próba'}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-stone-900 mb-2" style={{ fontFamily: "'Cormorant', serif" }}>
                      {event.title}
                    </h3>
                    
                    <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs font-medium text-stone-600">
                      {event.time && (
                        <span className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded-md">
                          <Clock size={14} className={isProject ? "text-[#002395]" : "text-stone-400"} /> 
                          {isProject ? `Zbiórka: ${event.time}` : event.time}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded-md">
                        <MapPin size={14} className={isProject ? "text-[#002395]" : "text-stone-400"} /> 
                        {event.location}
                      </span>
                    </div>

                    <p className="text-sm text-stone-500 mt-3 font-light">
                      {event.details}
                    </p>
                  </div>

                </div>
              </div>
            </motion.div>
          );
        }) : (
          <div className="pl-6">
            <div className="p-8 text-center text-stone-500 border border-dashed border-stone-300 rounded-xl bg-stone-50 flex flex-col items-center justify-center">
              <Calendar size={32} className="text-stone-300 mb-3" />
              <p className="font-medium text-sm text-stone-700">Twój harmonogram jest pusty.</p>
              <p className="text-xs mt-1">Obecnie nie masz przypisanych żadnych nadchodzących prób ani wydarzeń.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}