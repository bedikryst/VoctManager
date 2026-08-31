/**
 * @file EditionThumbnailStrip.tsx
 * @description Visual page-range trimmer for the score-book build cockpit. Renders
 * the resolved edition's pages as a horizontal thumbnail strip so the conductor
 * trims the publisher's front matter by eye — tap a page to start the music there,
 * use the corner control to cut the tail — instead of typing page numbers blind.
 * Pages outside the kept range dim out; the AI-suggested start is flagged.
 * Presentational: the row owns the manifest query, because whether the strip can
 * render at all decides what the row shows in its place.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/EditionThumbnailStrip
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Scissors, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";

import type {
  ScorePackageItem,
  ScorePackageItemPatch,
  ScorePackageThumbnail,
} from "../api/project.service";

interface EditionThumbnailStripProps {
  item: ScorePackageItem;
  thumbnails: readonly ScorePackageThumbnail[];
  onPatch: (patch: Partial<ScorePackageItemPatch>) => void;
}

export function EditionThumbnailStrip({
  item,
  thumbnails,
  onPatch,
}: EditionThumbnailStripProps): React.JSX.Element {
  const { t } = useTranslation();

  const pageCount = thumbnails.length;
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
        {thumbnails.map(({ page, src }) => {
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
                  "block overflow-hidden rounded-chip border transition-all duration-200",
                  isStart
                    ? "border-ethereal-gold ring-2 ring-ethereal-gold/60"
                    : isEnd
                      ? "border-ethereal-ink/40 ring-2 ring-ethereal-ink/25"
                      : "border-hairline-strong hover:border-ethereal-gold/50",
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
                    className={cn(
                      "absolute left-1 top-1 rounded px-1 py-0.5 leading-none",
                      // Gold holds its hue, so its label holds its darkness; the
                      // ink chip is a rung and its label rides the ladder with it.
                      isStart
                        ? "bg-ethereal-gold text-surface-inverse"
                        : "bg-ethereal-ink/70 text-ethereal-alabaster",
                    )}
                  >
                    {isStart
                      ? t("projects.score_package.item.thumb_start", "start")
                      : t("projects.score_package.item.thumb_end", "koniec")}
                  </Caption>
                )}
                {isSuggested && !isStart && (
                  <span
                    className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-ethereal-gold/90 px-1 py-0.5 text-surface-inverse"
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
                    : "border-hairline-strong bg-ethereal-alabaster/85 text-ethereal-graphite/70 opacity-40 hover:text-ethereal-ink group-hover:opacity-100 focus-visible:opacity-100",
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

/** Placeholder while the manifest is in flight, so the trimmer doesn't pop in. */
export function EditionThumbnailSkeleton(): React.JSX.Element {
  return (
    <div className="flex gap-2 overflow-hidden" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-28 w-20 shrink-0 animate-pulse rounded-chip bg-ethereal-ink/5"
        />
      ))}
    </div>
  );
}
