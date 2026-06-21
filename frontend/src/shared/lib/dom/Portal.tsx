/**
 * @file Portal.tsx
 * @description Renders children into `document.body`, escaping the page's
 * stacking context. Bottom-anchored floating surfaces (save bars, autosave
 * pills, the practice mini-player) MUST use this: rendered inline they live
 * inside the dashboard content's stacking context (`main` is `z-10` and the
 * page-transition wrapper animates transform/opacity, each of which opens a new
 * stacking context). A `position: fixed` child cannot escape that context, so
 * its `z-(--z-toast)` is only "100 within the page bubble" and the fixed bottom
 * nav (a body-level sibling at `z-70`) paints over it — the bar lands *under*
 * the dock and becomes unclickable. Portalling to <body> lifts the bar into the
 * root stacking context where its z-index actually wins. React context still
 * flows through the React tree, so hooks/providers keep working across the seam.
 * @module shared/lib/dom/Portal
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface PortalProps {
  readonly children: React.ReactNode;
}

export const Portal = ({ children }: PortalProps): React.ReactPortal | null => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(children, document.body);
};

Portal.displayName = "Portal";
