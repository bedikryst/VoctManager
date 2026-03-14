/**
 * Login Component
 * @author Krystian Bugalski
 * * Authentication gateway for the VoctManager enterprise system.
 * Uses controlled inputs to capture credentials and passes them 
 * to the parent component for JWT authentication.
 */
export default function Login({ username, setUsername, password, setPassword, error, onLogin }) {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 selection:bg-amber-600 selection:text-white font-sans">
      <div className="bg-white p-10 md:p-14 border border-stone-200 shadow-2xl max-w-md w-full relative">
        
        {/* Dekoracyjny pasek na górze okna nawiązujący do brutalistycznego stylu */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-stone-900"></div>

        <div className="text-center mb-12 mt-2">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tighter text-stone-900">
            <span className="italic">Voct</span>Manager
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500 font-bold mt-4">
            Panel Dostępu Personelu
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-[10px] font-bold uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <form onSubmit={onLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
              Identyfikator (Login)
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all"
              placeholder="np. kbugalski"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
              Hasło Zabezpieczające
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-[10px] uppercase tracking-[0.2em] py-4 transition-all mt-4 border border-stone-900 hover:shadow-lg"
          >
            Autoryzuj Dostęp
          </button>
        </form>

        <div className="mt-10 text-center border-t border-stone-100 pt-8">
           <a href="/" className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors inline-flex items-center space-x-2 group">
              <span className="transform group-hover:-translate-x-1 transition-transform">←</span>
              <span>Strona Główna</span>
           </a>
        </div>
        
      </div>
    </div>
  );
}