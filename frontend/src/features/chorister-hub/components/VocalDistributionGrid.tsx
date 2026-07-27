/**
 * @file VocalDistributionGrid.tsx
 * @description How often this singer has been cast on each voice line across
 * completed projects — a labelled bar per line, longest-first by count.
 * @module features/chorister-hub/components
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, Eyebrow } from '@/shared/ui/primitives/typography';
import { Badge } from '@/shared/ui/primitives/Badge';
import { ACCENT_BADGE, type EtherealAccent } from '@/shared/ui/primitives/accents';
import { getSectionPresentation } from '@/features/artists/constants/voiceSections';
import type { VocalLineEntry } from '../types/chorister-hub.dto';

/**
 * `SOLO` and `TUTTI` are the only lines that are not a section: they say how
 * many people sing the part, not which part it is, so they take neutrals rather
 * than borrowing a voice's colour. Everything else resolves through
 * `voiceSections.ts` on its leading letter.
 *
 * This file used to carry its own fourteen-entry table, and it disagreed with
 * that SSOT on two of the four voices — alto came out sage, bass came out ink —
 * so a chorister's own card coloured their section differently from the roster
 * and the balance strip showing the same taxonomy. It also ran a private alpha
 * ramp down each divisi number (S1 at /15, S2 at /10, S3 at /8), which is three
 * shades for a distinction the label already makes: S3 is not less soprano than
 * S1. And `SOLO` shared soprano's colour outright.
 */
const NON_SECTION_ACCENT: Record<string, EtherealAccent> = {
  SOLO: 'amethyst',
  TUTTI: 'graphite',
};

const accentOf = (voiceLine: string): EtherealAccent => {
  const nonSection = NON_SECTION_ACCENT[voiceLine.toUpperCase()];
  if (nonSection) return nonSection;
  return getSectionPresentation(voiceLine)?.accent ?? 'graphite';
};

interface VocalDistributionGridProps {
  distribution: VocalLineEntry[];
  maxCount: number;
}

export const VocalDistributionGrid = ({
  distribution,
  maxCount,
}: VocalDistributionGridProps): React.JSX.Element => {
  const { t } = useTranslation();

  if (distribution.length === 0) {
    return (
      <Text size="sm" color="muted" className="text-center py-6">
        {t('chorister_hub.identity.no_casting_data', 'No casting data for completed projects.')}
      </Text>
    );
  }

  return (
    <div className="space-y-2.5">
      <Eyebrow color="muted" className="mb-3">
        {t('chorister_hub.identity.vocal_distribution', 'Voice Line Distribution')}
      </Eyebrow>
      {distribution.map((entry) => {
        const barWidth = maxCount > 0 ? Math.round((entry.count / maxCount) * 100) : 0;

        return (
          <div key={entry.voice_line} className="flex items-center gap-3">
            {/* Fixed width so every bar starts on the same x — a chart needs its
                keys to align, which is the one thing the chip does not own. The
                padding goes with it: `TUTTI` is the longest code and has to fit
                the same box as `S1`. */}
            <Badge
              variant={ACCENT_BADGE[accentOf(entry.voice_line)]}
              className="w-14 shrink-0 justify-center px-0"
            >
              {entry.voice_line}
            </Badge>

            <div className="flex-1 relative h-2 bg-ethereal-marble/40 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-ethereal-gold/50 transition-all duration-700"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 w-16 sm:w-32">
              <Text size="xs" weight="semibold" className="text-ethereal-ink tabular-nums">
                {entry.count}×
              </Text>
              <Text size="xs" color="muted" className="hidden truncate sm:block">
                {entry.voice_line_display}
              </Text>
            </div>
          </div>
        );
      })}
    </div>
  );
};
