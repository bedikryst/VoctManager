/**
 * @file SystemModuleCard.tsx
 * @description Standardised domain card for routing to distinct SaaS modules.
 * Refactored to utilize class-variance-authority for strict style bindings.
 * @module shared/widgets/domain/SystemModuleCard
 */

import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cva, type VariantProps } from "class-variance-authority";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";

const moduleCardVariants = cva(
  "p-5 flex flex-col h-full transition-all duration-300 border",
  {
    variants: {
      colorScheme: {
        brand: "hover:border-brand/30 hover:shadow-md",
        emerald: "hover:border-emerald-500/30 hover:shadow-md",
        stone: "hover:border-stone-400/30 hover:shadow-md",
      },
      glassOpacity: {
        light: "bg-white/40",
        medium: "bg-white/60",
      },
    },
    defaultVariants: {
      colorScheme: "brand",
      glassOpacity: "light",
    },
  },
);

const iconWrapperVariants = cva(
  "w-10 h-10 border rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-colors",
  {
    variants: {
      colorScheme: {
        brand: "bg-white border-stone-200/60 text-brand",
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
        stone: "bg-stone-50 border-stone-200 text-stone-600",
      },
    },
    defaultVariants: {
      colorScheme: "brand",
    },
  },
);

const textVariants = cva("transition-colors", {
  variants: {
    colorScheme: {
      brand: "group-hover/module:text-brand",
      emerald: "group-hover/module:text-emerald-600",
      stone: "group-hover/module:text-stone-800",
    },
  },
  defaultVariants: {
    colorScheme: "brand",
  },
});

interface SystemModuleCardProps extends VariantProps<
  typeof moduleCardVariants
> {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  features?: string[];
  openLabelKey?: string;
}

export const SystemModuleCard = ({
  title,
  description,
  icon,
  path,
  colorScheme,
  glassOpacity,
  features,
  openLabelKey = "common.actions.openModule",
}: SystemModuleCardProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <Link
      to={path}
      className="outline-none group/module block h-full active:scale-[0.99] transition-transform"
      aria-label={t("common.aria.navigateTo", { destination: title })}
    >
      <GlassCard
        variant="solid"
        className={cn(moduleCardVariants({ colorScheme, glassOpacity }))}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(iconWrapperVariants({ colorScheme }))}>{icon}</div>
          <h4
            className={cn(
              "text-sm font-bold text-stone-900 tracking-tight line-clamp-1",
              textVariants({ colorScheme }),
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
                key={`${feature}-${idx}`}
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
              "text-[9px] uppercase tracking-wider font-bold text-stone-400",
              textVariants({ colorScheme }),
            )}
          >
            {t(openLabelKey)}
          </span>
          <ChevronRight
            size={14}
            className={cn(
              "text-stone-400 transform group-hover/module:translate-x-0.5 transition-all",
              textVariants({ colorScheme }),
            )}
            aria-hidden="true"
          />
        </div>
      </GlassCard>
    </Link>
  );
};
