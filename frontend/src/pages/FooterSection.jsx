/**
 * @file FooterSection.jsx
 * @description A high-impact editorial footer component featuring a custom magnetic 
 * interaction wrapper for primary CTA elements and foundation details.
 * @author Krystian Bugalski
 */

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * Magnetic Wrapper Component
 * Creates a subtle "pull" effect towards the cursor using Framer Motion springs.
 * @param {React.ReactNode} props.children - The DOM element to be magnetized.
 */
const Magnetic = ({ children }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    
    // Calculate the distance from the cursor to the center of the element
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    
    // Apply a fractional multiplier (0.2) to create a restrained magnetic pull
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;
  
  return (
    <motion.div
      style={{ position: "relative", display: "inline-block" }}
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.div>
  );
};

export default function FooterSection() {
  return (
    <footer id="kontakt" className="bg-stone-100 py-32 md:py-40 px-6 md:px-12 lg:px-24 border-t border-stone-200 relative z-30">
      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-20">
        
        {/* Left Column: Heading and Magnetic CTA */}
        <div className="lg:col-span-7 flex flex-col justify-start">
          <h2 
            className="text-5xl md:text-7xl lg:text-[7rem] leading-[0.9] tracking-tighter text-stone-900 mb-16" 
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Stwórzmy to <br/>
            <span className="italic text-amber-700">razem.</span>
          </h2>
          
          <div>
            <Magnetic>
              <a 
                href="mailto:kontakt@voctensemble.pl" 
                className="inline-block text-2xl md:text-4xl lg:text-5xl tracking-tight text-stone-500 hover:text-stone-900 transition-colors border-b-2 border-transparent hover:border-stone-900 pb-2" 
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                kontakt@voctensemble.pl
              </a>
            </Magnetic>
          </div>
        </div>

        {/* Right Column: Foundation Info and Bank Details */}
        <div className="lg:col-span-5 flex flex-col justify-end space-y-16 lg:pl-12">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 mb-6">
              Wsparcie Fundacji
            </p>
            <p className="text-base font-medium text-stone-600 mb-8 max-w-md leading-relaxed">
              Niezależność artystyczna wymaga mecenatu. Wesprzyj nasze projekty darowizną na cele statutowe i stań się częścią naszej polifonii.
            </p>
            
            <div className="border border-stone-300 p-8 bg-white shadow-sm max-w-md transition-all duration-500 hover:shadow-xl hover:-translate-y-1 group cursor-pointer">
              <p className="text-[9px] uppercase tracking-[0.3em] text-stone-400 mb-4 font-bold">
                Konto Bankowe Fundacji
              </p>
              <p className="text-lg md:text-xl font-medium text-stone-800 tracking-widest group-hover:text-amber-700 transition-colors">
                PL 00 0000 0000 0000 0000 0000
              </p>
            </div>
            
            <Link to="/fundacja" className="inline-flex items-center gap-4 mt-8 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-700 hover:text-stone-900 transition-colors group">
              <span>Więcej o Fundacji</span>
              <span className="transform group-hover:translate-x-2 transition-transform duration-300">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Area: Logos and Legal Info */}
      <div className="max-w-screen-2xl mx-auto border-t border-stone-300 pt-16 mt-32 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12">
        
        <div className="flex flex-wrap gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="w-32 h-16 border border-stone-400 border-dashed flex items-center justify-center">
            <span className="text-[7px] uppercase tracking-widest text-stone-500 text-center">Fundacja Logo</span>
          </div>
          <div className="w-20 h-16 border border-stone-400 border-dashed flex items-center justify-center">
            <span className="text-[7px] uppercase tracking-widest text-stone-500 text-center">Miasto</span>
          </div>
        </div>
        
        <div className="text-left lg:text-right text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 leading-loose">
          <p>© {new Date().getFullYear()} VoctEnsemble.</p>
          <p>Designed & Developed by <span className="text-stone-600 hover:text-amber-700 transition-colors cursor-pointer">Krystian Bugalski</span></p>
        </div>
        
      </div>
    </footer>
  );
}