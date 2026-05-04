/**
 * @file ExperiencePage.tsx
 * @description Public page showcasing the VoctEnsemble repertoire and musical experience.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/ExperiencePage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function ExperiencePage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
