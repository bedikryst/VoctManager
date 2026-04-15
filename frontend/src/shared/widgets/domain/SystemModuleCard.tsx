/**
 * @file SystemModuleCard.tsx
 * @description Universal Ethereal UI 2026 Navigation Directive.
 * Upgraded to strict SPA routing with react-router-dom Link.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

export interface SystemModuleCardProps {
  id: string;
  title: string;
  path: string;
  romanNumeral: string;
  accentClass: string;
  features?: string[];
  description?: string;
}

export function SystemModuleCard({
  id,
  title,
  path,
  romanNumeral,
  accentClass,
  features = [],
  description,
}: SystemModuleCardProps): React.JSX.Element {
  return (
    <Link
      to={path}
      className="group block h-full w-full outline-none focus-visible:ring-1 focus-visible:ring-ethereal-gold/50 rounded-[2.5rem]"
      aria-labelledby={`directive-title-${id}`}
    >
      <GlassCard
        variant="light"
        withNoise
        glow={true}
        padding="none"
        className="relative flex h-full min-h-[160px] w-full flex-col justify-between overflow-hidden p-6 transition-all duration-1000 ease-[0.16,1,0.3,1] hover:-translate-y-1"
      >
        {/* Roman Numeral Imprint */}
        <div
          className="pointer-events-none absolute -bottom-6 -right-2 -z-10 select-none opacity-[0.03] mix-blend-overlay transition-all duration-1000 group-hover:scale-105 group-hover:opacity-[0.08]"
          aria-hidden="true"
        >
          <span className="font-serif text-[8rem] font-light leading-none tracking-tighter text-ethereal-ink md:text-[10rem]">
            {romanNumeral}
          </span>
        </div>

        {/* Top Stratum */}
        <header className="relative z-10 flex flex-col gap-4">
          <div
            className={`h-[1px] w-8 transition-all duration-700 group-hover:w-16 ${accentClass}`}
            aria-hidden="true"
          />

          {features.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/50 transition-colors duration-500 group-hover:text-ethereal-graphite/80">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span
                    className={`h-1 w-1 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${accentClass}`}
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-[80%] text-[10px] font-medium leading-relaxed tracking-[0.1em] text-ethereal-graphite/60 uppercase">
              {description}
            </p>
          )}
        </header>

        {/* Bottom Stratum */}
        <footer className="relative z-10 mt-8">
          <h3
            id={`directive-title-${id}`}
            className="font-serif text-2xl tracking-tight text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold md:text-3xl"
          >
            {title}
          </h3>
        </footer>
      </GlassCard>
    </Link>
  );
}
