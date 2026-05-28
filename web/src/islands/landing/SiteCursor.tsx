/**
 * @file SiteCursor.tsx
 * @description Renders the custom cursor element and wires the cursor-follow hook.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/SiteCursor
 */

import { useRef } from "react";

import { useSiteCursor } from "./hooks/useSiteCursor";

export function SiteCursor(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useSiteCursor(ref);
  return <div ref={ref} className="site-cursor" aria-hidden="true" />;
}
