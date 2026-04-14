/**
 * @file SystemModuleStrip.tsx
 * @description Ultra-compact horizontal navigation primitive.
 * Layout: [Icon] | [Title / Features Stack].
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/domain/SystemModuleStrip
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";

export interface SystemModuleStripProps {
  title: string;
  icon: React.ReactNode;
  iconBgClass?: string;
  path: string;
  features?: string[];
}

export const SystemModuleStrip = ({
  title,
  icon,
  iconBgClass,
  path,
  features = [],
}: SystemModuleStripProps): React.JSX.Element => {
  return (
    <Link
      to={path}
      className="outline-none group block w-full rounded-[1.5rem] focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
    >
      <GlassCard
        variant="ethereal"
        padding="none"
        className="transition-all duration-700 ease-out group-hover:bg-white/50 group-hover:border-ethereal-gold/40 group-hover:shadow-[0_8px_24px_rgba(194,168,120,0.1)]"
      >
        <div className="flex items-center pl-6 gap-4 p-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md transition-transform duration-700 group-hover:scale-105",
              iconBgClass ||
                "border-ethereal-incense/20 bg-ethereal-incense/10 text-ethereal-incense",
            )}
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <h3 className="font-serif text-lg font-medium tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold truncate">
              {title}
            </h3>
            {features.length > 0 && (
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ethereal-graphite/50 truncate transition-colors duration-500 group-hover:text-ethereal-graphite/80">
                {features.join(" • ")}
              </p>
            )}
          </div>

          <div className="shrink-0 opacity-0 -translate-x-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 pr-2">
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="text-ethereal-gold"
            />
          </div>
        </div>
      </GlassCard>
    </Link>
  );
};

SystemModuleStrip.displayName = "SystemModuleStrip";
