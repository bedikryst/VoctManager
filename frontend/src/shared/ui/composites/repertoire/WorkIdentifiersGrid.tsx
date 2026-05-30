/**
 * @file WorkIdentifiersGrid.tsx
 * @description Read-only grid of canonical work identifiers: opus/catalog,
 * key, text source, MusicBrainz Work ID. Used in the AI Review tab as a
 * "what AI found" reference next to the inline editable fields.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/WorkIdentifiersGrid
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { Caption, Text } from "@/shared/ui/primitives/typography";

interface WorkIdentifiersGridProps {
  readonly opus_catalog?: string | null;
  readonly musical_key?: string | null;
  readonly text_source?: string | null;
  readonly mbid_work?: string | null;
}

export const WorkIdentifiersGrid = ({
  opus_catalog,
  musical_key,
  text_source,
  mbid_work,
}: WorkIdentifiersGridProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (!opus_catalog && !musical_key && !text_source && !mbid_work) {
    return null;
  }

  return (
    <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
      {opus_catalog && (
        <div>
          <Caption color="muted" className="block">
            {t("repertoire.identifiers.opus", "Opus / Katalog")}
          </Caption>
          <Text size="sm" weight="semibold">
            {opus_catalog}
          </Text>
        </div>
      )}
      {musical_key && (
        <div>
          <Caption color="muted" className="block">
            {t("repertoire.identifiers.key", "Tonacja")}
          </Caption>
          <Text size="sm" weight="semibold">
            {musical_key}
          </Text>
        </div>
      )}
      {text_source && (
        <div className="sm:col-span-2">
          <Caption color="muted" className="block">
            {t("repertoire.identifiers.text_source", "Źródło tekstu")}
          </Caption>
          <Text size="sm" weight="semibold">
            {text_source}
          </Text>
        </div>
      )}
      {mbid_work && (
        <div className="sm:col-span-2">
          <Caption color="muted" className="block">
            {t("repertoire.identifiers.mbid", "MusicBrainz Work")}
          </Caption>
          <a
            href={`https://musicbrainz.org/work/${mbid_work}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-ethereal-gold hover:underline"
          >
            {mbid_work}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </div>
      )}
    </dl>
  );
};
