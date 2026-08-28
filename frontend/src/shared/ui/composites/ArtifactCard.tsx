/**
 * @file ArtifactCard.tsx
 * @description The cinematic centerpiece composite. Domain-agnostic.
 * Features semantic overlay links, group-hover kinematics, and precise artifact stratums.
 * Refactored to eliminate strict typograhic layout violations.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Heading } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";

/**
 * The reveal for this card's slotted content. The card owns the hidden/visible
 * orchestration, so a slot declares only `variants={ARTIFACT_SLOT_REVEAL}` and
 * inherits the state — which is why the variant is exported rather than private:
 * `metadataSlot` is filled by the caller and its children have to speak the
 * same two words.
 *
 * Transform and opacity ONLY. `filter: blur()` is not a compositor property, so
 * an animated blur re-rasterises the layer through a gaussian kernel on every
 * frame — and up to four of these run simultaneously on a phone, which is the
 * whole frame budget for the length of the animation.
 */
export const ARTIFACT_SLOT_REVEAL = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE.buttery },
  },
};

export interface ArtifactMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  accentColor?: "default" | "gold";
}

export interface ArtifactCardProps {
  to: string;
  ariaLabel: string;
  statusBadgeSlot: React.ReactNode;
  metadataSlot?: React.ReactNode;
  title: string;
  subtitleSlot?: React.ReactNode;
  metrics: ArtifactMetric[];
  isLoading?: boolean;
}

export function ArtifactCard({
  to,
  ariaLabel,
  statusBadgeSlot,
  metadataSlot,
  title,
  subtitleSlot,
  metrics,
  isLoading = false,
}: ArtifactCardProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        className="h-full min-h-[400px] w-full rounded-surface bg-ethereal-incense/5 animate-pulse"
        aria-busy="true"
      />
    );
  }

  return (
    <GlassCard
      variant="light"
      padding="none"
      isHoverable={false}
      className="group flex h-full min-h-[400px] w-full flex-col hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover"
      backgroundElement={
        /* The bloom is painted as a radial gradient, not as a hard shape put
           through `blur()`. A 160px kernel over an 800px box is one of the most
           expensive single rasterisations a page can ask for, and the falloff it
           buys is exactly what a gradient draws for free. `closest-side` keeps
           the last stop transparent before the box edge, so there is no seam. */
        <div className="pointer-events-none absolute -right-32 -top-32 h-[800px] w-[800px] bg-[radial-gradient(circle_closest-side,rgba(194,168,120,0.16)_0%,rgba(166,146,121,0.05)_55%,transparent_100%)] transition-transform duration-[3000ms] ease-out group-hover:scale-[1.3] group-hover:translate-x-10" />
      }
    >
      {/* 1. SEMANTIC OVERLAY LINK */}
      <Link
        to={to}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 rounded-surface"
        aria-label={ariaLabel}
      />

      {/* 2. STATUS BAR */}
      <header className="relative z-10 flex items-center justify-between px-10 pt-10 pointer-events-none">
        <div className="pointer-events-auto">{statusBadgeSlot}</div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-ethereal-incense/10 bg-glass-surface/20 backdrop-blur-md transition-[transform,border-color,background-color] duration-700 group-hover:scale-110 group-hover:border-ethereal-gold/40 group-hover:bg-glass-surface group-hover:shadow-glass-outline-hover"
          aria-hidden="true"
        >
          <ArrowUpRight
            size={20}
            strokeWidth={1.2}
            className="text-ethereal-ink transition-transform duration-700 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
          />
        </div>
      </header>

      {/* 3. CORE CONTENT (Cinematic Typography) */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-8 pointer-events-none">
        {metadataSlot && (
          <motion.div
            initial="hidden"
            animate="visible"
            className="mb-4 flex flex-wrap items-center gap-4"
          >
            {metadataSlot}
          </motion.div>
        )}

        <Heading
          as="h2"
          size="4xl"
          weight="normal"
          className="mb-6 max-w-2xl leading-[1.05]"
        >
          {title}
        </Heading>

        {subtitleSlot && (
          <motion.div
            variants={ARTIFACT_SLOT_REVEAL}
            initial="hidden"
            animate="visible"
          >
            {subtitleSlot}
          </motion.div>
        )}
      </div>

      {/* 4. ARTIFACT STRATUM (Metrics via MetricBlock) */}
      <div className="relative z-10 grid h-auto md:h-full grid-cols-3 overflow-hidden pointer-events-none">
        <Divider variant="gradient-fade" position="absolute-top" />

        {metrics.map((metric, index) => (
          <div key={metric.id} className="relative">
            <MetricBlock
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              icon={metric.icon}
              accentColor={metric.accentColor}
              interactiveMode="glass"
              className="h-full"
            />
            {index < metrics.length - 1 && (
              <Divider
                variant="gradient-bottom"
                orientation="vertical"
                position="absolute-right"
                className="hidden sm:block opacity-50"
              />
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
