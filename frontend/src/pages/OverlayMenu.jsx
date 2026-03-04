/**
 * @file OverlayMenu.jsx
 * @description Fullscreen split-pane navigation menu with staggered typography animations,
 * dynamic background image reveals based on hover states, and keyboard accessibility (ESC to close).
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  { 
    title: 'Zespół', 
    path: '#zespol', 
    img: '/zespol.jpg', 
    desc: 'Poznaj głosy, wizję i struktury, które nas kształtują.' 
  },
  { 
    title: 'Archiwum', 
    path: '/', 
    img: '/wystep.jpg', 
    desc: 'Zapis naszych najważniejszych muzycznych misteriów.' 
  },
  { 
    title: 'Fundacja', 
    path: '/', 
    img: '/nuty.jpg', 
    desc: 'Zostań mecenasem niezależnej sztuki wokalnej.' 
  },
  { 
    title: 'Kontakt', 
    path: '#kontakt', 
    img: '/proba.jpg', 
    desc: 'Porozmawiajmy o wspólnych realizacjach i wizjach.' 
  }
];

// Motion Variants for the main container and individual links
const menuVariants = {
  hidden: { y: '-100%', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } },
  visible: { y: 0, transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }
};

const linkVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: i => ({ 
    y: 0, 
    opacity: 1, 
    transition: { delay: 0.3 + (i * 0.1), duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
  })
};

/**
 * OverlayMenu Component
 * @param {boolean} props.isOpen - Determines if the menu should be rendered and animated in.
 * @param {function} props.setIsOpen - State setter to toggle the menu's visibility.
 */
export default function OverlayMenu({ isOpen, setIsOpen }) {
  const [activeItem, setActiveItem] = useState(menuItems[0]);

  // Handle keyboard accessibility (Close on Escape key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          variants={menuVariants} 
          initial="hidden" 
          animate="visible" 
          exit="hidden"
          className="fixed inset-0 z-[60] flex flex-col lg:flex-row bg-stone-900 text-stone-100 overflow-hidden"
        >
          {/* Close Action Button */}
          <div className="absolute top-8 right-8 md:top-12 md:right-12 z-50">
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-[10px] font-bold uppercase tracking-[0.3em] flex items-center space-x-4 hover:text-amber-600 transition-colors group"
              aria-label="Close navigation menu"
            >
              <span>Zamknij</span>
              <div className="w-12 h-px bg-current group-hover:w-8 transition-all duration-300"></div>
            </button>
          </div>

          {/* Left Pane: Typographic Navigation Links */}
          <div className="w-full lg:w-1/2 h-1/2 lg:h-full flex flex-col justify-between p-8 md:p-16 lg:p-24 relative z-10">
            
            <div className="hidden lg:block text-[10px] font-bold uppercase tracking-[0.4em] text-stone-500">
              Nawigacja
            </div>

            <div className="flex flex-col items-start justify-center space-y-4 lg:space-y-8 flex-1 mt-16 lg:mt-0">
              {menuItems.map((item, i) => (
                <div 
                  key={item.title} 
                  className="overflow-hidden pb-8 pr-12 -mb-8"
                  onMouseEnter={() => setActiveItem(item)}
                >
                  <motion.div custom={i} variants={linkVariants} initial="hidden" animate="visible" exit="hidden">
                    <a 
                      href={item.path}
                      onClick={() => setIsOpen(false)}
                      className="text-5xl md:text-7xl lg:text-[7rem] leading-none tracking-tighter text-stone-300 hover:text-white transition-colors duration-500 inline-block group"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      <span className="inline-block transition-transform duration-500 group-hover:translate-x-4 group-hover:italic group-hover:text-amber-600">
                        {item.title}
                      </span>
                    </a>
                  </motion.div>
                </div>
              ))}
            </div>
            
            {/* Social Links Footer */}
            <div className="flex space-x-8 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-500">
              <a href="https://facebook.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Facebook</a>
              <a href="https://instagram.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Instagram</a>
            </div>
          </div>

          {/* Right Pane: Dynamic Image & Description Reveal */}
          <div className="w-full lg:w-1/2 h-1/2 lg:h-full relative overflow-hidden bg-stone-950">
            {menuItems.map((item) => (
              <div 
                key={item.title}
                className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
                  activeItem.title === item.title ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
                aria-hidden={activeItem.title !== item.title}
              >
                {/* Background Image with subtle scale transition */}
                <div 
                  className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-[10s] ease-out scale-105 bg-stone-800"
                  style={{ 
                    backgroundImage: `url(${item.img})`,
                    transform: activeItem.title === item.title ? 'scale(1)' : 'scale(1.05)'
                  }}
                />
                
                {/* Visual Overlays (Darken & Noise Texture) */}
                <div className="absolute inset-0 bg-stone-900/60 mix-blend-multiply" />
                <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

                {/* Animated Hairline Typography Description */}
                <div className="absolute bottom-12 right-8 md:bottom-24 md:right-16 lg:right-24 flex justify-end w-full overflow-hidden pointer-events-none">
                  <motion.p 
                    initial={{ opacity: 0, x: 150 }}
                    animate={{ 
                      opacity: activeItem.title === item.title ? 1 : 0, 
                      x: activeItem.title === item.title ? 0 : 150 
                    }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.76, 0, 0.24, 1] }}
                    className="text-right text-4xl md:text-6xl lg:text-7xl leading-tight tracking-wide text-stone-100 max-w-xl md:max-w-2xl"
                    style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 100 }}
                  >
                    {item.desc}
                  </motion.p>
                </div>
              </div>
            ))}
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}