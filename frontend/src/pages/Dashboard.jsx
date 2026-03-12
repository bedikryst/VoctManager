/**
 * Dashboard Page
 * @author Krystian Bugalski
 * * The core authenticated layout of the VoctManager application.
 * Manages JWT authentication (login/logout), fetches global state (Projects, Pieces, User Profile),
 * and acts as a central router for switching between user views and the Admin Panel.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from './Login';
import ProjectList from '../components/dashboard/ProjectList';
import ProjectDetails from '../components/dashboard/ProjectDetails';
import ArchiveList from '../components/dashboard/ArchiveList';
import AdminPanel from '../components/dashboard/AdminPanel';

// Securely fetch the API URL from environment variables to support Prod/Dev deployments
const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  // Authentication States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Global Data States
  const [artistInfo, setArtistInfo] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pieces, setPieces] = useState([]);
  
  // UI Routing States
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) throw new Error('Nieprawidłowy identyfikator lub hasło.');
      
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setIsLoggedIn(true);
    } catch (err) { 
      setError(err.message); 
    }
  };

  const handleLogout = () => {
    // Clear tokens and sensitive global state from memory and browser storage
    localStorage.clear();
    setIsLoggedIn(false);
    setArtistInfo(null); 
    setProjects([]); 
    setPieces([]);
    setSelectedProject(null); 
    setUsername(''); 
    setPassword('');
    // Redirect user to the public landing page
    navigate('/');
  };

  // Initial Data Hydration: Fires only once after a successful login
  useEffect(() => {
    if (isLoggedIn) {
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 
        'Content-Type': 'application/json' 
      };
      
      fetch(`${API_URL}/api/artists/me/`, { headers })
        .then(res => {
          if (!res.ok) throw new Error("Brak profilu artysty");
          return res.json();
        })
        .then(data => setArtistInfo(data)) 
        .catch(err => console.error("Profile fetch error:", err));
        
      fetch(`${API_URL}/api/projects/`, { headers })
        .then(res => res.json())
        .then(data => setProjects(data))
        .catch(err => console.error("Projects fetch error:", err));
        
      fetch(`${API_URL}/api/pieces/`, { headers })
        .then(res => res.json())
        .then(data => setPieces(data))
        .catch(err => console.error("Pieces fetch error:", err));
    }
  }, [isLoggedIn]);

  // Guard clause: Render login screen if the user is unauthenticated
  if (!isLoggedIn) {
    return (
      <Login 
        username={username} setUsername={setUsername} 
        password={password} setPassword={setPassword} 
        error={error} onLogin={handleLogin} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800 selection:bg-amber-200">
      
      {/* ENTERPRISE TOP-BAR */}
      <header className="bg-stone-900 text-stone-100 py-3 px-6 flex justify-between items-center shadow-md z-20 relative">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-serif tracking-widest text-stone-100">
            Voct<span className="text-amber-500 font-bold">Manager</span>
          </span>
          {artistInfo?.is_admin && (
            <span className="hidden md:inline-block text-[10px] uppercase tracking-widest font-bold bg-stone-800 border border-stone-600 text-stone-300 px-2 py-0.5 rounded-sm">
              Admin Workspace
            </span>
          )}
        </div>
        <div className="flex items-center space-x-6 text-sm font-medium">
          {artistInfo ? (
            <span className="hidden md:block">
              {artistInfo.first_name} {artistInfo.last_name} <span className="text-stone-400">({artistInfo.voice_part_display})</span>
            </span>
          ) : (
            <span className="text-stone-400">Autoryzacja...</span>
          )}
          <button 
            onClick={handleLogout} 
            className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-white transition-colors border-l border-stone-700 pl-6"
          >
            Zakończ sesję
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HORIZONTAL TAB NAVIGATION (Hidden when a specific project is open) */}
        {!selectedProject && (
          <div className="flex space-x-6 border-b border-stone-200 mb-8">
            <button 
              onClick={() => setActiveTab('projects')}
              className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'projects' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              Projekty i Koncerty
            </button>
            {artistInfo?.is_admin && ( 
              <button 
                onClick={() => setActiveTab('archive')}
                className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'archive' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
              >
                Archiwum Nut
              </button>
            )}
            {artistInfo?.is_admin && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ml-auto ${activeTab === 'admin' ? 'border-stone-800 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
              >
                ⚙️ Panel Administracyjny
              </button>
            )}
          </div>
        )}

        {/* CONTENT CONTAINER (Brutalist style, no heavy shadows) */}
        <div className="bg-white border border-stone-200 shadow-sm rounded-sm min-h-[70vh]">
          {selectedProject ? (
            <ProjectDetails 
              project={selectedProject} 
              pieces={pieces} 
              user={artistInfo} 
              onBack={() => setSelectedProject(null)} 
            />
          ) : activeTab === 'projects' && (
            <ProjectList projects={projects} onSelectProject={setSelectedProject} />
          )} 
          {activeTab === 'archive' && artistInfo?.is_admin && (
            <ArchiveList pieces={pieces} user={artistInfo} />
          )} 
          {activeTab === 'admin' && artistInfo?.is_admin && (
            <AdminPanel 
              token={localStorage.getItem('access_token')} 
              onProjectAdded={() => {
                fetch(`${API_URL}/api/projects/`, { 
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } 
                })
                .then(res => res.json())
                .then(data => setProjects(data));
              }}
            />
          )}
        </div>

      </main>
    </div>
  );
}