/**
 * @file ContactPage.tsx
 * @description Public contact page for the VoctEnsemble Foundation — booking, press, and general enquiries.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/ContactPage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function ContactPage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
