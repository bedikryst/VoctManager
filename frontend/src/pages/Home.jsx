/**
 * @file Home.jsx
 * @description Main landing page orchestrating the scrollytelling experience.
 * Now vastly simplified, as global elements (nav, menu, cursors) have been 
 * extracted to App.jsx for seamless page transitions.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { ReactLenis } from 'lenis/react';
import { useAppStore } from '../store/useAppStore';

// --- COMPONENTS ---
import HeroSection from '../components/home/HeroSection'; 
import ExperienceSection from '../components/home/ExperienceSection';
import WhatWeDoSection from '../components/home/WhatWeDoSection';
import WhatWeSingSection from '../components/home/WhatWeSingSection';
import TeamSection from '../components/home/TeamSection';

export default function Home() {
  const isLoaded = useAppStore((state) => state.isLoaded);
  const lenisRef = useRef(null);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <ReactLenis 
      ref={lenisRef}
      root 
      options={{ 
        lerp: 0.05, 
        smoothWheel: true, 
        smoothTouch: false,
        syncTouch: false,
      }} 
    > 
      <div className={`bg-[#fdfbf7] text-stone-900 ${!isLoaded ? 'overflow-hidden h-screen' : ''}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
        
        {/* --- SEKCJE STRONY GŁÓWNEJ --- */}
        <div className="relative z-0">
          <HeroSection />
        </div>
        <div className="relative z-10 -mt-[50vh]">
          <ExperienceSection />
        </div>
        <WhatWeDoSection />
        <WhatWeSingSection />
        <TeamSection />
        
      </div>
    </ReactLenis>
  );
}