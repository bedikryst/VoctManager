/**
 * @file DonatePage.tsx
 * @description Public page for supporting the VoctEnsemble Foundation — patronage options and donation flow.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/DonatePage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function DonatePage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
