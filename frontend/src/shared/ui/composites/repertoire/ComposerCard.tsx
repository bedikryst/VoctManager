/**
 * @file ComposerCard.tsx
 * @description Composer biographical card. Shows portrait, lifespan,
 * nationality/period, short bio, plus MusicBrainz + Wikidata deep links
 * when the composer was enriched via the AI ingestion pipeline.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/ComposerCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Sparkles } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import type { Composer } from "@/shared/types";

interface ComposerCardProps {
  readonly composer: Composer;
  readonly bare?: boolean;
}

const composerDisplayName = (composer: Composer): string =>
  `${composer.first_name ?? ""} ${composer.last_name}`.trim();

const ExternalChip = ({
  href,
  label,
}: {
  href: string;
  label: string;
}): React.JSX.Element => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
  >
    {label}
    <ExternalLink size={11} aria-hidden="true" />
  </a>
);

export const ComposerCard = ({
  composer,
  bare = false,
}: ComposerCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [portraitFailed, setPortraitFailed] = useState(false);
  const showPortrait = Boolean(composer.portrait_url) && !portraitFailed;
  const fullName = composer.full_name ?? composerDisplayName(composer);
  const lifespan = [composer.birth_year, composer.death_year]
    .filter(Boolean)
    .join("–");

  const body = (
    <div className="flex items-start gap-4">
      {showPortrait ? (
        <img
          src={composer.portrait_url}
          alt={t("repertoire.composer.portrait_alt", "Portret {{name}}", {
            name: fullName,
          })}
          className="h-20 w-20 shrink-0 rounded-2xl border border-ethereal-incense/20 object-cover"
          loading="lazy"
          onError={() => setPortraitFailed(true)}
        />
      ) : (
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-ethereal-incense/25 bg-ethereal-marble/60"
          aria-hidden="true"
        >
          <Sparkles size={22} className="text-ethereal-gold/60" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Heading as="h3" size="lg" weight="medium">
          {fullName}
        </Heading>
        <Caption color="muted" className="block">
          {[lifespan, composer.nationality, composer.period]
            .filter(Boolean)
            .join(" · ")}
        </Caption>
        {composer.bio && (
          <Text size="sm" color="graphite" className="mt-2 line-clamp-4">
            {composer.bio}
          </Text>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {composer.mbid && (
            <ExternalChip
              href={`https://musicbrainz.org/artist/${composer.mbid}`}
              label="MusicBrainz"
            />
          )}
          {composer.wikidata_qid && (
            <ExternalChip
              href={`https://www.wikidata.org/wiki/${composer.wikidata_qid}`}
              label="Wikidata"
            />
          )}
        </div>
      </div>
    </div>
  );

  if (bare) return body;

  return (
    <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
      <Eyebrow color="muted" size="caption" className="mb-3 block">
        {t(
          "repertoire.composer.section",
          "Kompozytor (źródło: MusicBrainz + Wikidata)",
        )}
      </Eyebrow>
      {body}
    </GlassCard>
  );
};
