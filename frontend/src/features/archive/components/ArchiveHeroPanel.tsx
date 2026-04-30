/**
 * @file ArchiveHeroPanel.tsx
 * @description Compact hero surface for the archive dashboard.
 * Keeps the primary archive story concise while exposing high-value overview signals.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { FileText, Filter, Library, Users } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";

interface ArchiveHeroPanelProps {
  pdfCoverage: number;
  audioCoverage: number;
  uniqueComposers: number;
  uniqueVoicings: number;
  withReferenceLinks: number;
}

interface OverviewPillProps {
  label: string;
  value: string | number;
}

function OverviewPill({
  label,
  value,
}: OverviewPillProps): React.JSX.Element {
  return (
    <div className="rounded-[1.75rem] border border-ethereal-incense/15 bg-ethereal-alabaster/35 px-5 py-4 backdrop-blur-sm">
      <Eyebrow>{label}</Eyebrow>
      <Heading as="p" size="2xl" className="mt-2">
        {value}
      </Heading>
    </div>
  );
}

export function ArchiveHeroPanel({
  pdfCoverage,
  audioCoverage,
  uniqueComposers,
  uniqueVoicings,
  withReferenceLinks,
}: ArchiveHeroPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="light"
      padding="lg"
      isHoverable={false}
      className="border border-ethereal-incense/15"
      backgroundElement={
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-ethereal-gold/20 via-ethereal-parchment/10 to-transparent blur-[120px]"
          aria-hidden="true"
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          <Badge variant="glass" icon={<Library size={12} />}>
            {t("archive.hero.badge", "Operacje Archiwum")}
          </Badge>

          <div className="space-y-2.5">
            <Heading as="h2" size="4xl">
              {t(
                "archive.hero.title",
                "Biblioteka repertuaru, nut i audio.",
              )}
            </Heading>
            <Text color="graphite" className="max-w-xl">
              {t(
                "archive.hero.description",
                "Jeden operacyjny widok do zarządzania katalogiem utworów, materiałami i referencjami wykonawczymi.",
              )}
            </Text>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Badge variant="brand" icon={<Users size={12} />}>
              {t("archive.hero.stats.composers", "{{count}} kompozytorów", {
                count: uniqueComposers,
              })}
            </Badge>
            <Badge variant="glass" icon={<Filter size={12} />}>
              {t("archive.hero.stats.voicings", "{{count}} profili obsady", {
                count: uniqueVoicings,
              })}
            </Badge>
            <Badge variant="warning" icon={<FileText size={12} />}>
              {t(
                "archive.hero.stats.references",
                "{{count}} utworów z referencjami",
                { count: withReferenceLinks },
              )}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <OverviewPill label="Pokrycie PDF" value={`${pdfCoverage}%`} />
          <OverviewPill label="Utwory z audio" value={`${audioCoverage}%`} />
        </div>
      </div>
    </GlassCard>
  );
}
