/**
 * @file FoundationPage.tsx
 * @description Public page describing the VoctEnsemble Foundation — mission, governance, and legal identity.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/FoundationPage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function FoundationPage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
