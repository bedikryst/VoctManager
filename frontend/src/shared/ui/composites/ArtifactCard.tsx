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
import { cn } from "@/shared/lib/utils";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Divider } from "@/shared/ui/primitives/Divider";
import { KineticText } from "@/shared/ui/kinematics/KineticText";

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: EtherealEasing, delay: 0.4 },
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
        className="h-full min-h-[400px] w-full rounded-[2.5rem] bg-ethereal-incense/5 animate-pulse"
        aria-busy="true"
      />
    );
  }

  return (
    <GlassCard
      variant="light"
      padding="none"
      className="group flex h-full min-h-[400px] w-full flex-col transition-all duration-[1200ms] ease-[0.16,1,0.3,1] hover:shadow-[0_40px_100px_rgba(166,146,121,0.2)]"
      backgroundElement={
        <div className="pointer-events-none absolute -right-32 -top-32 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-ethereal-gold/15 via-ethereal-incense/5 to-transparent blur-[160px] transition-transform duration-[3000ms] ease-out group-hover:scale-[1.3] group-hover:translate-x-10" />
      }
    >
      {/* 1. SEMANTIC OVERLAY LINK */}
      <Link
        to={to}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 rounded-[2.5rem]"
        aria-label={ariaLabel}
      />

      {/* 2. STATUS BAR */}
      <header className="relative z-10 flex items-center justify-between px-10 pt-10 pointer-events-none">
        <div className="pointer-events-auto">{statusBadgeSlot}</div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-ethereal-incense/10 bg-white/5 backdrop-blur-md transition-all duration-700 group-hover:scale-110 group-hover:border-ethereal-gold/40 group-hover:bg-white/40 group-hover:shadow-[0_0_30px_rgba(194,168,120,0.3)]"
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
            {/* Oczyszczono z surowych klas tekstu - zakładamy, że slot dostarczy Primitives */}
            {metadataSlot}
          </motion.div>
        )}

        <KineticText
          as="h2"
          text={title}
          delay={0.2}
          className="mb-6 max-w-2xl font-serif text-3xl leading-[1.05] tracking-tight text-ethereal-ink xl:text-4xl"
        />

        {subtitleSlot && (
          <motion.div
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
          >
            {subtitleSlot}
          </motion.div>
        )}
      </div>

      {/* 4. ARTIFACT STRATUM (Metrics via MetricBlock) */}
      <div className="relative z-10 grid h-auto md:h-full grid-cols-1 overflow-hidden sm:grid-cols-3 pointer-events-none">
        <Divider variant="fade" position="absolute-top" />

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
