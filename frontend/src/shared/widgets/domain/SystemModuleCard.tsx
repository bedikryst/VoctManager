/**
 * @file SystemModuleCard.tsx
 * @description Refined Editorial Card.
 * Indices are now integrated as subtle marginalia to preserve vertical density.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";

export interface SystemModuleCardProps {
  index: number;
  title: string;
  icon: React.ElementType;
  iconBgClass?: string;
  path: string;
  features?: string[];
}

export const SystemModuleCard = ({
  index,
  title,
  icon: Icon,
  iconBgClass,
  path,
  features = [],
}: SystemModuleCardProps): React.JSX.Element => {
  const formattedIndex = index < 10 ? `0${index}` : index.toString();

  return (
    <GlassCard
      variant="ethereal"
      padding="none" // Manual padding control for tighter integration
      className="group relative flex w-full flex-col overflow-hidden transition-all duration-700 ease-[0.16,1,0.3,1] hover:-translate-y-1 hover:border-ethereal-gold/30 hover:bg-white/25 hover:shadow-[0_20px_40px_rgba(194,168,120,0.1)]"
    >
      {/* BACKGROUND WATERMARK - Scaled down for compactness */}
      <div
        className={cn(
          "absolute -right-4 -top-4 z-0 h-24 w-24 transform opacity-[0.03] transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-[0.07]",
          iconBgClass,
        )}
        aria-hidden="true"
      >
        <Icon className="h-full w-full" strokeWidth={0.75} />
      </div>

      <div className="relative z-10 flex flex-col p-6">
        {/* TOP ROW: Index & Metadata */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-ethereal-incense/40 transition-colors duration-500 group-hover:text-ethereal-gold">
            Index // {formattedIndex}
          </span>
          <div className={cn("h-1 w-1 rounded-full opacity-20", iconBgClass)} />
        </div>

        {/* TITLE - Pseudo-Overlay Link remains for A11y */}
        <h3 className="mb-2 font-serif text-xl font-medium tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold">
          <Link
            to={path}
            className="static outline-none before:absolute before:inset-0 before:z-20 focus-visible:before:ring-2 focus-visible:before:ring-ethereal-gold/40"
          >
            {title}
          </Link>
        </h3>

        {/* FEATURES - High Density Inline List */}
        {features.length > 0 && (
          <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite/40 transition-colors duration-500 group-hover:text-ethereal-graphite/60">
            {features.join(" • ")}
          </p>
        )}
      </div>

      {/* ACCENT LINE - Kinetic border effect */}
      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r from-ethereal-gold/0 via-ethereal-gold/40 to-ethereal-gold/0 transition-all duration-1000 group-hover:w-full" />
    </GlassCard>
  );
};
