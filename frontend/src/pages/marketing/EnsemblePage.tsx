/**
 * @file EnsemblePage.tsx
 * @description Public page presenting the VoctEnsemble vocal ensemble — history, identity, and artistic mission.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/EnsemblePage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function EnsemblePage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
