/**
 * @file SystemModuleCard.tsx
 * @description Ethereal UI domain card for routing to distinct SaaS modules.
 * Purged of legacy B2B styles. Implements editorial micro-typography,
 * expanded descriptive space, and pure glassmorphism.
 * @module shared/widgets/domain/SystemModuleCard
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";

export interface SystemModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass?: string;
  path: string;
  features?: string[];
  openLabelKey?: string;
}

export const SystemModuleCard = ({
  title,
  description,
  icon,
  iconBgClass,
  path,
  features,
  openLabelKey = "common.actions.openModule",
}: SystemModuleCardProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <Link
      to={path}
      className="outline-none group block h-full"
      aria-label={t("common.aria.navigateTo", { destination: title })}
    >
      <GlassCard
        variant="ethereal"
        className="flex h-full flex-col p-6 md:p-8 transition-colors duration-700 hover:border-white/70"
      >
        {/* Header: Heraldic Iconography & Title */}
        <div className="mb-5 flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-md transition-transform duration-700 group-hover:scale-105",
              iconBgClass ||
                "border-ethereal-incense/20 bg-ethereal-incense/10 text-ethereal-incense",
            )}
          >
            {icon}
          </div>
          <h3 className="font-serif text-[1.65rem] font-medium tracking-wide text-ethereal-ink transition-colors duration-500 group-hover:text-ethereal-gold">
            {title}
          </h3>
        </div>

        {/* Description: Expanded Narrative Space */}
        <div className="flex-grow">
          <p className="mb-8 text-[13px] font-normal leading-[1.8] text-ethereal-graphite/95">
            {description}
          </p>
        </div>

        {/* Features: Editorial Micro-typography */}
        {features && features.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {features.map((feature, idx) => (
              <React.Fragment key={`${feature}-${idx}`}>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/70 transition-colors duration-500 group-hover:text-ethereal-ink">
                  {feature}
                </span>
                {idx < features.length - 1 && (
                  <span
                    className="text-[10px] text-ethereal-gold/40"
                    aria-hidden="true"
                  >
                    •
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Footer Action: The Silent Invitation */}
        <div className="mt-auto flex items-center justify-between border-t border-ethereal-incense/15 pt-4 transition-colors duration-700 group-hover:border-ethereal-gold/30">
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold">
            {t(openLabelKey)}
          </span>
          <ArrowRight
            size={16}
            strokeWidth={1.5}
            className="text-ethereal-incense/50 transition-all duration-700 group-hover:translate-x-1 group-hover:text-ethereal-gold"
            aria-hidden="true"
          />
        </div>
      </GlassCard>
    </Link>
  );
};
