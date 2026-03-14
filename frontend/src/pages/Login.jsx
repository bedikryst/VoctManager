/**
 * @file Login.jsx
 * @description Authentication screen for VoctManager Dashboard.
 * Interacts with AuthContext to retrieve JWTs and manages smart redirection.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
      document.body.classList.add('admin-mode');
      return () => document.body.classList.remove('admin-mode');
  }, []);

  // Smart redirect: send user back to the page they initially requested, or default to /panel
  const from = location.state?.from?.pathname || "/panel";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(username, password);

    if (result.success) {
      // replace: true prevents the login page from staying in the browser history stack
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#002395] selection:text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
      
      <div className="absolute top-8 left-8">
        <Link to="/" className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium text-stone-500 hover:text-[#002395] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Powrót na stronę główną</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-medium text-stone-900 mb-2" style={{ fontFamily: "'Cormorant', serif" }}>
            Voct<span className="italic text-[#002395]">Manager</span>
          </h2>
          <p className="mt-2 text-sm text-stone-500 font-light tracking-wide uppercase">
            Panel Administracyjny & Kadrowy
          </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow-xl shadow-stone-200/50 sm:rounded-xl border border-stone-100 sm:px-10 relative overflow-hidden">
          
          {/* Subtle decorative top border */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#002395] to-blue-400" />

          <form className="space-y-6 mt-2" onSubmit={handleSubmit}>
            
            <div>
              <label htmlFor="username" className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
                Nazwa Użytkownika
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={isSubmitting}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 border border-stone-300 rounded-md shadow-sm placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#002395] focus:border-[#002395] sm:text-sm font-medium transition-all disabled:bg-stone-50 disabled:text-stone-400"
                  placeholder="np. jkowalski"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
                Hasło
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 border border-stone-300 rounded-md shadow-sm placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#002395] focus:border-[#002395] sm:text-sm font-medium transition-all disabled:bg-stone-50 disabled:text-stone-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message with ARIA Live Region for Accessibility */}
            <div aria-live="polite">
                {error && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md"
                >
                    <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700 font-medium">
                        {error}
                        </p>
                    </div>
                    </div>
                </motion.div>
                )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !username || !password}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-xs uppercase tracking-widest font-bold text-white bg-stone-900 hover:bg-[#002395] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#002395] transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed group"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Autoryzacja...
                  </span>
                ) : (
                  'Zaloguj się'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-stone-400 uppercase tracking-widest">
              Zabezpieczone przez JWT Auth
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}