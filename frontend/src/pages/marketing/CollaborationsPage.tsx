/**
 * @file CollaborationsPage.tsx
 * @description Public page presenting VoctEnsemble's artistic partnerships and institutional collaborations.
 * @architecture Enterprise SaaS 2026
 * @module pages/marketing/CollaborationsPage
 */

import React from "react";
import { ReactLenis } from "lenis/react";

export default function CollaborationsPage(): React.JSX.Element {
  return (
    <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
      <div
        className="bg-[#fdfbf7] text-stone-900 min-h-screen"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      />
    </ReactLenis>
  );
}
