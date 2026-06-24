/**
 * @file ComposerRowExpanded.tsx
 * @description Accordion content for a [ComposerRow]. Surfaces the
 * Wikidata-enriched biography + portrait + external IDs, lists pieces
 * attached to this composer, and exposes "Odśwież z MusicBrainz" to
 * re-pull missing canonical fields.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ComposerRowExpanded
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertCircle,
  ExternalLink,
  Library,
  Music,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { Composer, Piece } from "@/shared/types";

import type { ComposerRefreshResult } from "../api/archive.service";
import { usePieces, useRefreshComposerFromMb } from "../api/archive.queries";

interface ComposerRowExpandedProps {
  readonly composer: Composer;
}

export const ComposerRowExpanded = ({
  composer,
}: ComposerRowExpandedProps): React.JSX.Element => {
  const { t } = useTranslation();
  const refresh = useRefreshComposerFromMb();
  const { data: allPieces = [] } = usePieces();
  const [refreshOutcome, setRefreshOutcome] =
    useState<ComposerRefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"fill" | "force" | null>(null);

  const piecesByThis = allPieces.filter(
    (p: Piece) => p.composer?.id === composer.id,
  );

  const handleRefresh = (force: boolean) => {
    setRefreshOutcome(null);
    setRefreshError(null);
    setPendingMode(force ? "force" : "fill");
    refresh.mutate(
      { id: String(composer.id), force },
      {
        onSuccess: (data) => {
          setRefreshOutcome(data);
          if (data.status === "updated") {
            toast.success(
              t(
                "archive.composer_expanded.refresh_success",
                "Uzupełniono {{count}} pól z MusicBrainz / Wikidata.",
                { count: data.fields_filled.length },
              ),
            );
          } else if (data.status === "matched_no_changes") {
            toast.info(
              t(
                "archive.composer_expanded.refresh_no_changes",
                "MusicBrainz nie miał nowych danych do uzupełnienia.",
              ),
            );
          } else {
            toast.warning(
              t(
                "archive.composer_expanded.refresh_no_match",
                "Nie znaleziono tego kompozytora w MusicBrainz ani Wikidata. Sprawdź pisownię imienia i nazwiska.",
              ),
            );
          }
        },
        onError: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : t(
                  "archive.composer_expanded.refresh_error",
                  "Nie udało się pobrać danych.",
                );
          setRefreshError(message);
          toast.error(message);
        },
        onSettled: () => setPendingMode(null),
      },
    );
  };

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="space-y-5 bg-ethereal-parchment/20 px-4 py-5 md:px-6"
    >
      <div className="grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)]">
        {composer.portrait_url ? (
          <img
            src={composer.portrait_url}
            alt={t(
              "archive.composer_expanded.portrait_alt",
              "Portret {{name}}",
              {
                name:
                  composer.full_name ??
                  `${composer.first_name ?? ""} ${composer.last_name}`.trim(),
              },
            )}
            className="h-40 w-40 rounded-2xl border border-ethereal-incense/20 object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-ethereal-incense/30 bg-ethereal-marble/40"
            aria-hidden="true"
          >
            <Sparkles size={28} className="text-ethereal-gold/40" />
          </div>
        )}
        <div className="min-w-0 space-y-3">
          {composer.bio ? (
            <Text
              size="sm"
              color="graphite"
              className="whitespace-pre-wrap leading-relaxed"
            >
              {composer.bio}
            </Text>
          ) : (
            <Caption color="muted" className="italic">
              {t(
                "archive.composer_expanded.no_bio",
                "Brak biografii w bazie. Spróbuj 'Odśwież z MusicBrainz'.",
              )}
            </Caption>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {composer.mbid && (
              <a
                href={`https://musicbrainz.org/artist/${composer.mbid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
              >
                MusicBrainz
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            {composer.wikidata_qid && (
              <a
                href={`https://www.wikidata.org/wiki/${composer.wikidata_qid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
              >
                Wikidata
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            {composer.portrait_license && (
              <Caption color="muted">
                {t(
                  "archive.composer_expanded.portrait_license",
                  "Licencja portretu: {{license}}",
                  { license: composer.portrait_license },
                )}
              </Caption>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRefresh(false)}
              disabled={refresh.isPending}
              isLoading={pendingMode === "fill"}
              leftIcon={
                pendingMode === "fill" ? undefined : (
                  <RefreshCcw size={13} aria-hidden="true" />
                )
              }
            >
              {t(
                "archive.composer_expanded.refresh_btn",
                "Odśwież z MusicBrainz",
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRefresh(true)}
              disabled={refresh.isPending}
              isLoading={pendingMode === "force"}
              title={t(
                "archive.composer_expanded.refresh_force_hint",
                "Pobiera ponownie i nadpisuje dane z MusicBrainz / Wikidata. Ręczne zmiany pozostają nietknięte.",
              )}
            >
              {t(
                "archive.composer_expanded.refresh_force_btn",
                "Pobierz ponownie (nadpisz)",
              )}
            </Button>
          </div>
          {refreshOutcome?.status === "updated" && (
            <Caption color="muted">
              {t(
                "archive.composer_expanded.refresh_filled",
                "Uzupełniono: {{fields}}",
                { fields: refreshOutcome.fields_filled.join(", ") },
              )}
            </Caption>
          )}
          {refreshOutcome?.status === "matched_no_changes" && (
            <Caption color="muted">
              {t(
                "archive.composer_expanded.refresh_matched",
                "Dopasowano kompozytora — wszystkie pola są już uzupełnione.",
              )}
            </Caption>
          )}
          {refreshOutcome?.status === "no_match" && (
            <Caption color="muted" className="flex items-center gap-1">
              <AlertCircle size={11} aria-hidden="true" />
              {t(
                "archive.composer_expanded.refresh_no_match",
                "Nie znaleziono tego kompozytora w MusicBrainz ani Wikidata. Sprawdź pisownię imienia i nazwiska.",
              )}
            </Caption>
          )}
          {refreshError && (
            <Caption color="crimson" className="flex items-center gap-1">
              <AlertCircle size={11} aria-hidden="true" />
              {refreshError}
            </Caption>
          )}
        </div>
      </div>

      {/* Pieces by this composer */}
      <div className="rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/55 p-4">
        <Eyebrow color="muted" size="caption" className="mb-3 inline-flex items-center gap-1.5">
          <Library size={11} aria-hidden="true" />
          {piecesByThis.length === 0
            ? t(
                "archive.composer_expanded.no_pieces",
                "Brak utworów w bibliotece",
              )
            : t(
                "archive.composer_expanded.pieces_count",
                "Utwory w bibliotece ({{count}})",
                { count: piecesByThis.length },
              )}
        </Eyebrow>
        {piecesByThis.length === 0 ? (
          <Caption color="muted" className="italic">
            {t(
              "archive.composer_expanded.orphan_hint",
              "Kompozytor bez utworów — możesz go bezpiecznie usunąć.",
            )}
          </Caption>
        ) : (
          <ul role="list" className="flex flex-col gap-1.5">
            {piecesByThis.map((piece) => (
              <li key={piece.id}>
                <Link
                  to={`/panel/archive-management/${piece.id}/edit`}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster/60 px-3 py-1.5 text-[12px] font-medium text-ethereal-ink transition-colors hover:border-ethereal-gold/35 hover:bg-ethereal-parchment/50"
                >
                  <Music size={11} aria-hidden="true" className="text-ethereal-gold" />
                  <span className="truncate">{piece.title}</span>
                  {piece.composition_year && (
                    <Caption color="muted">· {piece.composition_year}</Caption>
                  )}
                  {piece.voicing && (
                    <Caption color="muted" className="hidden sm:inline">
                      · {piece.voicing}
                    </Caption>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
