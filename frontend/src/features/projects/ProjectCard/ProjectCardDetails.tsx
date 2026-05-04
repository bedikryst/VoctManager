/**
 * @file ProjectCardDetails.tsx
 * @description Event narrative and dress code context panel with editorial luxury design.
 * Staggered reveal animations, gender-coded dress code split, and ambient glow accents.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlignLeft, Shirt } from "lucide-react";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface ProjectCardDetailsProps {
  project: Project;
}

const REVEAL_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay,
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

interface DressCodePanelProps {
  label: string;
  value: string;
  pillClass: string;
  delay: number;
}

const DressCodePanel = ({
  label,
  value,
  pillClass,
  delay,
}: DressCodePanelProps): React.JSX.Element => (
  <motion.div
    custom={delay}
    variants={REVEAL_VARIANTS}
    initial="hidden"
    animate="visible"
    className="min-w-0 flex-1 space-y-2.5"
  >
    <div
      className={`inline-flex items-center rounded-full px-3 py-1 ${pillClass}`}
    >
      <Caption weight="bold" className="uppercase tracking-[0.16em]">
        {label}
      </Caption>
    </div>
    <Text weight="medium" className="leading-relaxed">
      {value}
    </Text>
  </motion.div>
);

export function ProjectCardDetails({
  project,
}: ProjectCardDetailsProps): React.JSX.Element {
  const { t } = useTranslation();

  const hasDescription = Boolean(project.description?.trim());
  const hasDressCode = Boolean(
    project.dress_code_female || project.dress_code_male,
  );
  const hasBothDressCodes = Boolean(
    project.dress_code_female && project.dress_code_male,
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Event Description ── */}
      <GlassCard
        variant="light"
        padding="md"
        isHoverable={false}
        withNoise
        className="relative flex-1 border-ethereal-incense/15"
      >
        {/* Ambient corner glow — animates opacity only */}
        <motion.div
          animate={{ opacity: [0.04, 0.12, 0.04] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-ethereal-gold blur-3xl"
          aria-hidden="true"
        />

        {/* Decorative background typemark */}
        <div
          className="pointer-events-none absolute right-4 top-2 select-none text-8xl leading-none text-ethereal-gold/5"
          aria-hidden="true"
        >
          ❝
        </div>

        <SectionHeader
          title={t("projects.details.description_title", "Opis wydarzenia")}
          icon={<AlignLeft size={16} aria-hidden="true" />}
          className="mb-0 pb-4"
        />

        {hasDescription ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative pl-4"
          >
            {/* Vertical gold accent bar */}
            <div
              className="absolute left-0 top-0 h-full w-0.5 rounded-full bg-gradient-to-b from-ethereal-gold/40 via-ethereal-gold/15 to-transparent"
              aria-hidden="true"
            />
            <Text className="whitespace-pre-wrap text-pretty leading-relaxed text-ethereal-graphite">
              {project.description}
            </Text>
          </motion.div>
        ) : (
          <Text color="muted" className="italic">
            {t(
              "projects.details.no_description",
              "Nie ma żadnych dodatkowych uwag do tego wydarzenia.",
            )}
          </Text>
        )}
      </GlassCard>

      {/* ── Dress Code ── */}
      <GlassCard
        variant="light"
        padding="md"
        isHoverable={false}
        className="border-ethereal-incense/15"
      >
        <SectionHeader
          title={t("projects.details.dress_code_title", "Dress Code")}
          icon={<Shirt size={16} aria-hidden="true" />}
          className="mb-0 pb-4"
        />

        {hasDressCode ? (
          <div className="flex items-start">
            {project.dress_code_female && (
              <DressCodePanel
                label={t("projects.details.dress_code_female", "Panie")}
                value={project.dress_code_female}
                pillClass="bg-ethereal-amethyst/10 text-ethereal-amethyst"
                delay={0}
              />
            )}

            {hasBothDressCodes && (
              <div
                className="mx-4 mt-1 w-px self-stretch bg-gradient-to-b from-transparent via-ethereal-incense/25 to-transparent"
                aria-hidden="true"
              />
            )}

            {project.dress_code_male && (
              <DressCodePanel
                label={t("projects.details.dress_code_male", "Panowie")}
                value={project.dress_code_male}
                pillClass="bg-ethereal-sage/15 text-ethereal-sage"
                delay={0.08}
              />
            )}
          </div>
        ) : (
          <Text color="muted" className="italic">
            {t(
              "projects.details.no_dress_code",
              "Nie ma wymagań co do ubioru.",
            )}
          </Text>
        )}
      </GlassCard>
    </div>
  );
}
