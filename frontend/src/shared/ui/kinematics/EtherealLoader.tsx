/**
 * @file EtherealLoader.tsx
 * @description Centralized Ethereal UI loading state with organic kinematics.
 * @module shared/ui/kinematics/EtherealLoader
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

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
    "Synchronizing Aura...",
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
        {/* Ethereal Breathing Animation */}
        <div className="absolute w-24 h-24 bg-ethereal-gold/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute w-12 h-12 border border-ethereal-gold/30 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
        <div className="w-2 h-2 bg-ethereal-gold rounded-full shadow-[0_0_10px_rgba(194,168,120,0.8)]" />
      </div>
      <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-ethereal-graphite animate-pulse">
        {message || defaultMessage}
      </span>
    </div>
  );
}
