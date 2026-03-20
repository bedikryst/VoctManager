/**
 * @file Home.tsx
 * @description Main landing page orchestrating the scrollytelling experience.
 * Global elements (nav, menu, cursors) have been extracted to App.tsx for seamless page transitions.
 * @architecture Enterprise 2026 Standards
 * @module pages/Home
 * @author Krystian Bugalski
 */

import React, { useRef } from 'react';
import { ReactLenis } from 'lenis/react';
import { useAppStore } from '../store/useAppStore';

import HeroSection from '../components/home/HeroSection'; 
import ExperienceSection from '../components/home/ExperienceSection';
import WhatWeDoSection from '../components/home/WhatWeDoSection';
import WhatWeSingSection from '../components/home/WhatWeSingSection';
import TeamSection from '../components/home/TeamSection';

export default function Home(): React.JSX.Element {
  // Expected to return a boolean indicating readiness
  const isLoaded = useAppStore((state: any) => state.isLoaded);
  const lenisRef = useRef<any>(null);

  return (
    <ReactLenis 
      ref={lenisRef}
      root 
      options={{ 
        lerp: 0.06, 
        smoothWheel: true
      }} 
    > 
      <div className={`bg-[#fdfbf7] text-stone-900 ${!isLoaded ? 'overflow-hidden h-screen' : ''}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
        
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