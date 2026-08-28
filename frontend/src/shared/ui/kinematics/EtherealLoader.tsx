/**
 * @file EtherealLoader.tsx
 * @description Centralized Ethereal UI loading state with organic kinematics.
 * @module shared/ui/kinematics/EtherealLoader
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

export interface EtherealLoaderProps {
  message?: string;
  className?: string;
  fullHeight?: boolean;
}

export function EtherealLoader({
  message,
  className,
  fullHeight = true,
}: EtherealLoaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const defaultMessage = t(
    "shared.loader.authorizing",
    "Synchronizacja nut...",
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-8",
        fullHeight ? "h-[70vh]" : "h-full py-12",
        className,
      )}
      aria-busy="true"
    >
      <div className="relative flex items-center justify-center">
        {/* Both marks animate opacity and transform ONLY, which is what keeps
            them affordable on the one screen that is up while a route chunk is
            still downloading and parsing. The halo's blur is static: the layer
            is rasterized once and the keyframes vary its alpha, so the filter is
            never recomputed. Animating the blur RADIUS here would be stage 1's
            defect — that is the line, not the pulse itself. */}
        <div className="absolute w-24 h-24 bg-ethereal-gold/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute w-12 h-12 border border-ethereal-gold/30 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
        <div className="w-2 h-2 bg-ethereal-gold rounded-full shadow-[0_0_10px_rgba(194,168,120,0.8)]" />
      </div>
      {/* The mark carries the motion; the word carries the message. Pulsing the
          text too said "working" a third time and dimmed the only readable
          thing on the screen while it did. */}
      <Eyebrow size="overline-sm" color="graphite">
        {message || defaultMessage}
      </Eyebrow>
    </div>
  );
}
