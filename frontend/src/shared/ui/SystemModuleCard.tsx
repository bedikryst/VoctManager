/**
 * @file SystemModuleCard.tsx
 * @description Standardized generic card for routing to different system modules.
 * Resolves Dashboard code duplication.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "../lib/utils";

interface SystemModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  iconBgClass?: string;
  titleColorClass?: string;
  hoverClass?: string;
  features?: string[];
  openLabel?: string;
}

export function SystemModuleCard({
  title,
  description,
  icon,
  path,
  iconBgClass = "bg-white border-stone-200/60",
  titleColorClass = "group-hover/module:text-[#002395]",
  hoverClass = "hover:border-[#002395]/30 hover:shadow-md",
  features,
  openLabel = "Otwórz Moduł",
}: SystemModuleCardProps): React.JSX.Element {
  return (
    <Link
      to={path}
      className="outline-none group/module block h-full active:scale-[0.99] transition-transform"
    >
      <GlassCard
        variant="solid"
        className={cn(
          "p-5 flex flex-col h-full bg-white/40 transition-all duration-300",
          hoverClass,
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 border rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-colors",
              iconBgClass,
            )}
          >
            {icon}
          </div>
          <h4
            className={cn(
              "text-sm font-bold text-stone-900 tracking-tight transition-colors line-clamp-1",
              titleColorClass,
            )}
          >
            {title}
          </h4>
        </div>
        <p className="text-[11px] text-stone-500 font-medium leading-snug mb-6 line-clamp-2">
          {description}
        </p>

        {features && features.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {features.map((feature, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-stone-100 text-stone-500 text-[8px] font-bold uppercase tracking-widest rounded border border-stone-200/40"
              >
                {feature}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 mt-auto group-hover/module:border-stone-300/60 transition-colors">
          <span
            className={cn(
              "text-[9px] uppercase tracking-wider font-bold text-stone-400 transition-colors",
              titleColorClass,
            )}
          >
            {openLabel}
          </span>
          <ChevronRight
            size={14}
            className={cn(
              "text-stone-400 transform group-hover/module:translate-x-0.5 transition-all",
              titleColorClass,
            )}
          />
        </div>
      </GlassCard>
    </Link>
  );
}
