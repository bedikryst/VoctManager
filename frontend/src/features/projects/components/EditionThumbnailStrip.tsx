/**
 * @file EditionThumbnailStrip.tsx
 * @description Visual page-range trimmer for the score-book build cockpit. Renders
 * the resolved edition's pages as a horizontal thumbnail strip so the conductor
 * trims the publisher's front matter by eye — tap a page to start the music there,
 * use the corner control to cut the tail — instead of typing page numbers blind.
 * Pages outside the kept range dim out; the AI-suggested start is flagged. The
 * strip degrades to nothing (the manual page inputs remain) when the host has no
 * rasteriser or the item has no readable edition, so it is purely additive.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/EditionThumbnailStrip
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Scissors, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";

import { useScorePackageThumbnails } from "../api/project.score-package";
import type {
  ScorePackageItem,
  ScorePackageItemPatch,
} from "../api/project.service";

interface EditionThumbnailStripProps {
  projectId: string;
  item: ScorePackageItem;
  /** Fetch only when the row is expanded — a long programme stays cheap. */
  enabled: boolean;
  onPatch: (patch: Partial<ScorePackageItemPatch>) => void;
}

const SKELETON_TILES = [0, 1, 2, 3, 4] as const;

export function EditionThumbnailStrip({
  projectId,
  item,
  enabled,
  onPatch,
}: EditionThumbnailStripProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data, isLoading } = useScorePackageThumbnails(
    projectId,
    item.id,
    item.selected_edition_id,
    enabled,
  );

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {SKELETON_TILES.map((i) => (
          <div
            key={i}
            className="h-28 w-20 shrink-0 animate-pulse rounded-md bg-ethereal-ink/5"
          />
        ))}
      </div>
    );
  }

  // No rasteriser on this host, or no readable edition — fall back silently to the
  // manual page-number inputs that sit above this strip.
  if (!data || !data.available || data.thumbnails.length === 0) {
    return null;
  }

  const pageCount = data.thumbnails.length;
  const effectiveStart = item.pdf_page_start ?? 1;
  const effectiveEnd = item.pdf_page_end ?? pageCount;

  // Tapping a page sets the music start; tapping the current start again clears it
  // back to "from the first page". Page 1 is stored as null (the natural edge).
  const setStart = (page: number): void => {
    if (page === effectiveStart) {
      onPatch({ pdf_page_start: null });
      return;
    }
    onPatch({ pdf_page_start: page === 1 ? null : page });
  };

  // The corner control trims the tail; tapping the current end clears it back to
  // "to the last page". The last page is stored as null (the natural edge).
  const setEnd = (page: number): void => {
    if (page === item.pdf_page_end) {
      onPatch({ pdf_page_end: null });
      return;
    }
    onPatch({ pdf_page_end: page === pageCount ? null : page });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Caption color="muted">
        {t(
          "projects.score_package.item.thumbnails_hint",
          "Kliknij stronę, od której zaczynają się nuty — przytniesz opis wydawcy.",
        )}
      </Caption>
      <ul className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {data.thumbnails.map(({ page, src }) => {
          const isKept = page >= effectiveStart && page <= effectiveEnd;
          const isStart = page === effectiveStart;
          const isEnd = item.pdf_page_end != null && page === item.pdf_page_end;
          const isSuggested = item.suggested_start === page;
          return (
            <li key={page} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => setStart(page)}
                aria-pressed={isStart}
                aria-label={t(
                  "projects.score_package.item.thumb_set_start",
                  "Zacznij nuty od strony {{n}}",
                  { n: page },
                )}
                className={cn(
                  "block overflow-hidden rounded-md border transition-all duration-200",
                  isStart
                    ? "border-ethereal-gold ring-2 ring-ethereal-gold/60"
                    : isEnd
                      ? "border-ethereal-ink/40 ring-2 ring-ethereal-ink/25"
                      : "border-ethereal-ink/10 hover:border-ethereal-gold/50",
                  !isKept && "opacity-35 grayscale",
                )}
              >
                <img
                  src={src}
                  alt={t("projects.score_package.item.thumb_alt", "Strona {{n}}", {
                    n: page,
                  })}
                  loading="lazy"
                  decoding="async"
                  className="block w-20 bg-ethereal-marble"
                />
                {(isStart || isEnd) && (
                  <Caption
                    as="span"
                    size="xs"
                    weight="semibold"
                    color="alabaster"
                    className={cn(
                      "absolute left-1 top-1 rounded px-1 py-0.5 leading-none",
                      isStart ? "bg-ethereal-gold" : "bg-ethereal-ink/70",
                    )}
                  >
                    {isStart
                      ? t("projects.score_package.item.thumb_start", "start")
                      : t("projects.score_package.item.thumb_end", "koniec")}
                  </Caption>
                )}
                {isSuggested && !isStart && (
                  <span
                    className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-ethereal-gold/90 px-1 py-0.5 text-ethereal-alabaster"
                    title={t(
                      "projects.score_package.item.thumb_suggested",
                      "AI: tu zaczynają się nuty",
                    )}
                  >
                    <Sparkles size={9} aria-hidden="true" />
                  </span>
                )}
                <Caption
                  as="span"
                  size="xs"
                  color="graphite"
                  className="absolute bottom-0 right-0 rounded-tl bg-ethereal-alabaster/85 px-1 leading-tight"
                >
                  {page}
                </Caption>
              </button>
              <button
                type="button"
                onClick={() => setEnd(page)}
                aria-pressed={isEnd}
                aria-label={t(
                  "projects.score_package.item.thumb_set_end",
                  "Ustaw stronę {{n}} jako koniec utworu",
                  { n: page },
                )}
                title={t(
                  "projects.score_package.item.thumb_set_end",
                  "Ustaw stronę {{n}} jako koniec utworu",
                  { n: page },
                )}
                className={cn(
                  "absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                  // Quiet by default so the strip isn't a wall of scissors; rises on
                  // hover/focus. Stays visible (not display:none) so touch can reach it.
                  isEnd
                    ? "border-ethereal-ink/40 bg-ethereal-ink/70 text-ethereal-alabaster"
                    : "border-ethereal-ink/10 bg-ethereal-alabaster/85 text-ethereal-graphite/70 opacity-40 hover:text-ethereal-ink group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <Scissors size={11} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
