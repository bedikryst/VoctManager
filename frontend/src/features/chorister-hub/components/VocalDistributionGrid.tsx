// chorister-hub/components/VocalDistributionGrid.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, Metric, Eyebrow } from '@/shared/ui/primitives/typography';
import { cn } from '@/shared/lib/utils';
import type { VocalLineEntry } from '../types/chorister-hub.dto';

const VOICE_LINE_ACCENT: Record<string, string> = {
  S1: 'bg-ethereal-amethyst/15 border-ethereal-amethyst/30 text-ethereal-amethyst',
  S2: 'bg-ethereal-amethyst/10 border-ethereal-amethyst/20 text-ethereal-amethyst',
  S3: 'bg-ethereal-amethyst/8 border-ethereal-amethyst/15 text-ethereal-amethyst',
  A1: 'bg-ethereal-sage/15 border-ethereal-sage/30 text-ethereal-sage',
  A2: 'bg-ethereal-sage/10 border-ethereal-sage/20 text-ethereal-sage',
  A3: 'bg-ethereal-sage/8 border-ethereal-sage/15 text-ethereal-sage',
  T1: 'bg-ethereal-gold/15 border-ethereal-gold/30 text-ethereal-gold',
  T2: 'bg-ethereal-gold/10 border-ethereal-gold/20 text-ethereal-gold',
  T3: 'bg-ethereal-gold/8 border-ethereal-gold/15 text-ethereal-gold',
  B1: 'bg-ethereal-ink/10 border-ethereal-ink/20 text-ethereal-ink',
  B2: 'bg-ethereal-ink/8 border-ethereal-ink/15 text-ethereal-ink',
  B3: 'bg-ethereal-ink/6 border-ethereal-ink/12 text-ethereal-ink',
  SOLO: 'bg-ethereal-incense/15 border-ethereal-incense/30 text-ethereal-incense',
  TUTTI: 'bg-ethereal-marble/20 border-ethereal-marble/40 text-ethereal-graphite',
};

const DEFAULT_ACCENT = 'bg-ethereal-graphite/10 border-ethereal-graphite/20 text-ethereal-graphite';

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
        const accentClass = VOICE_LINE_ACCENT[entry.voice_line] ?? DEFAULT_ACCENT;

        return (
          <div key={entry.voice_line} className="flex items-center gap-3">
            <div
              className={cn(
                'flex-shrink-0 w-14 h-7 rounded-lg border flex items-center justify-center',
                accentClass,
              )}
            >
              <Text size="xs" weight="bold" color="inherit" className="font-mono">
                {entry.voice_line}
              </Text>
            </div>

            <div className="flex-1 relative h-2 bg-ethereal-marble/40 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-ethereal-gold/50 transition-all duration-700"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <div className="flex-shrink-0 flex items-center gap-2 min-w-[120px]">
              <Text size="xs" weight="semibold" className="text-ethereal-ink tabular-nums">
                {entry.count}×
              </Text>
              <Text size="xs" color="muted" className="truncate">
                {entry.voice_line_display}
              </Text>
            </div>
          </div>
        );
      })}
    </div>
  );
};
