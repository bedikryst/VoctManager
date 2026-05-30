/**
 * @file RecordingsList.tsx
 * @description Reference recordings (Spotify, YouTube, Apple Music) for one
 * Piece. Used in the AI Review tab and the artist materials card.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/RecordingsList
 */

import React from "react";

import { Caption, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { ExternalLink, Sparkles } from "lucide-react";
import type { Recording } from "@/shared/types";

interface RecordingsListProps {
  readonly recordings: readonly Recording[];
  /** Single column on the materials card, two columns inside the wider review surface. */
  readonly columns?: 1 | 2;
}

const sourceTone = (source: Recording["source"]): string => {
  switch (source) {
    case "SPF":
      return "border-ethereal-sage/40 bg-ethereal-sage/10 text-ethereal-sage";
    case "YTB":
      return "border-ethereal-crimson/40 bg-ethereal-crimson/10 text-ethereal-crimson";
    default:
      return "border-ethereal-incense/30 bg-ethereal-marble/70 text-ethereal-graphite";
  }
};

export const RecordingsList = ({
  recordings,
  columns = 2,
}: RecordingsListProps): React.JSX.Element | null => {
  if (recordings.length === 0) return null;

  // Featured first, then preserve server order.
  const ordered = [...recordings].sort(
    (a, b) => Number(b.is_featured) - Number(a.is_featured),
  );

  return (
    <ul
      role="list"
      className={cn(
        "grid grid-cols-1 gap-2",
        columns === 2 && "md:grid-cols-2",
      )}
    >
      {ordered.map((recording) => (
        <li key={recording.id}>
          <a
            href={recording.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 px-4 py-3 transition-colors hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/40"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                sourceTone(recording.source),
              )}
              aria-hidden="true"
            >
              <Sparkles size={14} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <Text size="sm" weight="semibold" truncate className="block">
                {recording.performer ||
                  recording.source_display ||
                  recording.source}
              </Text>
              <Caption color="muted">
                {recording.source_display || recording.source}
                {recording.year ? ` · ${recording.year}` : ""}
                {recording.is_featured ? " · featured" : ""}
              </Caption>
            </div>
            <ExternalLink
              size={14}
              className="text-ethereal-graphite/60"
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
};
