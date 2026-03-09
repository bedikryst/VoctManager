/**
 * AdminPanel Component
 * @author Krystian Bugalski
 * * Acts as the main container and navigation router for the administrative dashboard.
 * Manages state for the active sub-module (Projects, Artists, Repertoire, Contracts)
 * and passes down necessary authentication tokens.
 */
import { useState } from 'react';
import ManageProjects from './admin/ManageProjects';
import ManageArtists from './admin/ManageArtists';
import ManageRepertoire from './admin/ManageRepertoire';
import Contracts from './admin/Contracts';

export default function AdminPanel({ token, onProjectAdded }) {
  // State controlling the currently active administrative module
  const [adminTab, setAdminTab] = useState('projects');

  return (
    <div className="flex flex-col h-full animate-fade-in">
      
      {/* HORIZONTAL SUB-NAVIGATION TABS */}
      <div className="bg-stone-100 border-b border-stone-200 flex space-x-1 px-4 pt-3 text-sm font-medium">
        <button 
          onClick={() => setAdminTab('projects')} 
          className={`px-4 py-2 rounded-t-sm transition-colors border border-b-0 ${adminTab === 'projects' ? 'bg-white border-stone-200 text-amber-700 shadow-[0_1px_0_white] relative z-10' : 'border-transparent text-stone-600 hover:bg-stone-200/50'}`}
        >
          Koncerty i Obsada
        </button>
        <button 
          onClick={() => setAdminTab('artists')} 
          className={`px-4 py-2 rounded-t-sm transition-colors border border-b-0 ${adminTab === 'artists' ? 'bg-white border-stone-200 text-amber-700 shadow-[0_1px_0_white] relative z-10' : 'border-transparent text-stone-600 hover:bg-stone-200/50'}`}
        >
          Baza Chórzystów
        </button>
        <button 
          onClick={() => setAdminTab('repertoire')} 
          className={`px-4 py-2 rounded-t-sm transition-colors border border-b-0 ${adminTab === 'repertoire' ? 'bg-white border-stone-200 text-amber-700 shadow-[0_1px_0_white] relative z-10' : 'border-transparent text-stone-600 hover:bg-stone-200/50'}`}
        >
          Archiwum Nut i Audio
        </button>
        <button 
          onClick={() => setAdminTab('contracts')} 
          className={`px-4 py-2 rounded-t-sm transition-colors border border-b-0 ${adminTab === 'contracts' ? 'bg-white border-stone-200 text-amber-700 shadow-[0_1px_0_white] relative z-10' : 'border-transparent text-stone-600 hover:bg-stone-200/50'}`}
        >
          Umowy i Finanse
        </button>
      </div>

      {/* DYNAMIC WORKSPACE AREA */}
      <div className="flex-1 p-6 md:p-8 bg-white overflow-y-auto">
        {adminTab === 'projects' && <ManageProjects token={token} onProjectAdded={onProjectAdded} />} 
        {adminTab === 'artists' && <ManageArtists token={token} />} 
        {adminTab === 'repertoire' && <ManageRepertoire token={token} />}
        {adminTab === 'contracts' && <Contracts token={token} />}
      </div>

    </div>
  );
}