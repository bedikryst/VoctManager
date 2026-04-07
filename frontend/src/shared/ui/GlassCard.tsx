/**
 * @file GlassCard.tsx
 * @description Core structural component providing standardized glassmorphism,
 * solid, and dark mode (OLED) card variants across the application.
 * @module ui/GlassCard
 */

import React, { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Determines the visual aesthetic of the card */
  variant?: "default" | "premium" | "dark" | "warning" | "solid";
  /** Optional explicit content padding override */
  noPadding?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      variant = "default",
      noPadding = false,
      className = "",
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "rounded-[2rem] overflow-hidden transition-all duration-300 relative group";
    const paddingStyles = noPadding ? "" : "p-6 md:p-8";

    const variants = {
      default:
        "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
      premium:
        "bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)]",
      dark: "bg-[#0a0a0a] border border-stone-800 shadow-[0_20px_40px_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] text-white",
      warning:
        "bg-orange-50/80 backdrop-blur-xl border border-orange-200 shadow-[0_4px_20px_rgba(249,115,22,0.05)]",
      solid:
        "bg-white/95 border border-stone-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${paddingStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
