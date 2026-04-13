/**
 * @file Home.tsx
 * @description Main landing page orchestrating the scrollytelling experience.
 * Global elements (nav, menu, cursors) have been extracted to App.tsx for seamless page transitions.
 * @architecture Enterprise 2026 Standards
 * @module pages/Home
 * @author Krystian Bugalski
 */

import React, { useRef } from "react";
import { ReactLenis } from "lenis/react";
import { useAppStore } from "@/app/store/useAppStore";

import HeroSection from "@/shared/widgets/landing/HeroSection";
import ExperienceSection from "@/shared/widgets/landing/ExperienceSection";
import WhatWeDoSection from "@/shared/widgets/landing/WhatWeDoSection";
import WhatWeSingSection from "@/shared/widgets/landing/WhatWeSingSection";
import TeamSection from "@/shared/widgets/landing/TeamSection";

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
        smoothWheel: true,
      }}
    >
      <div
        className={`bg-[#fdfbf7] text-stone-900 ${!isLoaded ? "overflow-hidden h-screen" : ""}`}
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
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
