/**
 * @file PieceRowExpanded.tsx
 * @description Accordion content rendered below a [PieceRow] when expanded.
 * A quick-glance preview: composer summary, divisi, an ingestion-status chip +
 * "N pól do weryfikacji" counter, in-app score preview (annotations default,
 * download secondary), and tracks. One CTA hands off to the full Piece Card.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRowExpanded
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Download,
  FileText,
  Headphones,
  Mic,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { ComposerCard, EditionStatusBadge } from "@/shared/ui/composites/repertoire";
import { ScoreStandModal } from "@/features/annotations";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { INGESTION_STATUS } from "@/shared/types";
import { hasPdf, getPiecePdfLinks } from "../constants/piecePdfs";
import type { EnrichedPiece } from "../types/archive.dto";
import { usePiece } from "../api/archive.queries";
import { pieceReviewBreakdown } from "./ProvenanceChip";

import { PieceRowTracks } from "./PieceRowTracks";

interface PieceRowExpandedProps {
  readonly piece: EnrichedPiece;
}

export const PieceRowExpanded = ({
  piece,
}: PieceRowExpandedProps): React.JSX.Element => {
  const { t } = useTranslation();
  const composer = piece.composer ?? null;
  const pdfLinks = getPiecePdfLinks(piece);
  const editions = piece.editions ?? [];
  const requirements = piece.voice_requirements_read ?? [];
  const audioCount = piece.tracks?.length ?? 0;
  const [openEditionId, setOpenEditionId] = useState<string | null>(null);

  const cardPath = `/panel/archive-management/${piece.id}`;
  const hasAIContent = Boolean(
    composer?.mbid ||
      composer?.wikidata_qid ||
      composer?.bio ||
      piece.lyrics_ipa ||
      (piece.translations && piece.translations.length > 0) ||
      (piece.program_notes && piece.program_notes.length > 0) ||
      (piece.recordings && piece.recordings.length > 0) ||
      hasPdf(piece),
  );

  // Representative ingestion status: the AWAITING edition leads (it's the one
  // that needs review), then the default, then the first.
  const representativeStatus =
    editions.find((e) => e.ingestion_status === INGESTION_STATUS.AWAITING)
      ?.ingestion_status ??
    editions.find((e) => e.is_default)?.ingestion_status ??
    editions[0]?.ingestion_status ??
    null;

  // Provenance lives only on the piece-detail endpoint — fetch it (cached, and
  // reused by the Piece Card) only for pieces that actually went through the AI.
  // The count comes from the same rollup the Piece Card's meter uses, so the row
  // never promises a backlog the card then reports as clear (it used to count
  // every provenance row, including fields the cockpit has no verify control
  // for — a number the conductor could not drive to zero).
  const { data: detail } = usePiece(editions.length > 0 ? String(piece.id) : null);
  const unverifiedCount = detail ? pieceReviewBreakdown(detail).all.pending : 0;

  const openEdition = pdfLinks.find((p) => p.id === openEditionId) ?? null;

  return (
    <div className="space-y-5 bg-ethereal-parchment/20 px-4 py-5 md:px-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {composer ? (
          <ComposerCard composer={composer} bare />
        ) : (
          <Caption color="muted" className="italic">
            {t("archive.row_expanded.no_composer", "Brak przypisanego kompozytora")}
          </Caption>
        )}

        <div className="space-y-3">
          {/* Divisi summary */}
          {requirements.length > 0 ? (
            <div>
              <Eyebrow color="muted" className="mb-2 block">
                <Mic size={11} className="mr-1 inline" aria-hidden="true" />
                {t("archive.row_expanded.divisi", "Divisi")}
              </Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {requirements.map((requirement) => (
                  <Badge
                    key={requirement.id ?? requirement.voice_line}
                    variant="warning"
                    className="gap-1 py-0.5"
                  >
                    {requirement.voice_line_display ?? requirement.voice_line}
                    <Text as="span" size="xs" className="text-ethereal-gold/70">
                      ×{requirement.quantity}
                    </Text>
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <Caption color="muted">
              {t("archive.row_expanded.no_divisi", "Brak wymagań głosowych — dodaj w karcie utworu.")}
            </Caption>
          )}

          {/* Score preview list — annotations are the default, download secondary */}
          {pdfLinks.length > 0 ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Eyebrow color="muted">
                  <FileText size={11} className="mr-1 inline" aria-hidden="true" />
                  {pdfLinks.length === 1
                    ? t("archive.row_expanded.pdf_one", "Partytura PDF")
                    : t("archive.row_expanded.pdf_many", "Wydania ({{count}})", {
                        count: pdfLinks.length,
                      })}
                </Eyebrow>
                {representativeStatus && (
                  <EditionStatusBadge status={representativeStatus} />
                )}
                {unverifiedCount > 0 && (
                  <Caption color="amethyst">
                    {t(
                      "archive.row_expanded.unverified_count",
                      "{{count}} pól do weryfikacji",
                      { count: unverifiedCount },
                    )}
                  </Caption>
                )}
              </div>
              <ul role="list" className="flex flex-col gap-1.5">
                {pdfLinks.map((pdf) => (
                  <li
                    key={pdf.id}
                    className="flex items-center gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenEditionId(pdf.id)}
                      className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-control border border-ethereal-amethyst/30 bg-ethereal-amethyst/5 px-3 py-1.5 text-xs font-medium text-ethereal-amethyst transition-colors hover:bg-ethereal-amethyst/10"
                    >
                      <FileText size={12} aria-hidden="true" />
                      <span className="truncate">{pdf.label}</span>
                      {pdf.is_default && pdfLinks.length > 1 && (
                        <Text as="span" size="xs" className="text-ethereal-amethyst/60">
                          {t("archive.row_expanded.default_marker", "domyślne")}
                        </Text>
                      )}
                    </button>
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-hairline-strong bg-ethereal-alabaster/70 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
                      aria-label={t("archive.row_expanded.pdf_download", "Pobierz PDF")}
                      title={t("archive.row_expanded.pdf_download", "Pobierz PDF")}
                    >
                      <Download size={13} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Caption color="muted">
              {t(
                "archive.row_expanded.no_pdf",
                "Brak PDF — wgraj plik z głównej strony archiwum.",
              )}
            </Caption>
          )}
        </div>
      </div>

      {/* Audio tracks subsection */}
      <div className="rounded-nested border border-hairline bg-ethereal-alabaster/55 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Eyebrow color="muted" className="inline-flex items-center gap-1.5">
            <Headphones size={11} aria-hidden="true" />
            {audioCount === 0
              ? t("archive.row_expanded.no_audio", "Brak ścieżek MP3")
              : t("archive.row_expanded.audio_count", "Ścieżki ćwiczeniowe ({{count}})", {
                  count: audioCount,
                })}
          </Eyebrow>
        </div>
        <PieceRowTracks piece={piece} />
      </div>

      {/* Footer CTA — one handoff to the full Piece Card */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-3"
      >
        <Button
          asChild
          variant="primary"
          size="sm"
          leftIcon={
            hasAIContent ? (
              <BookOpen size={13} aria-hidden="true" />
            ) : (
              <UploadCloud size={13} aria-hidden="true" />
            )
          }
        >
          <Link to={cardPath}>
            {t("archive.row_expanded.cta_open_card", "Otwórz kartę utworu")}
          </Link>
        </Button>
      </div>

      {!hasAIContent && (
        <Caption color="muted" className="block text-center">
          {t(
            "archive.row_expanded.ai_empty_hint",
            "Utwór wprowadzony ręcznie. Wgraj PDF żeby AI uzupełnił metadane, IPA, tłumaczenia i notkę programową.",
          )}
        </Caption>
      )}

      {/* Quick score stand — annotations default (archive is manager-only). */}
      <ScoreStandModal
        isOpen={openEditionId !== null}
        editionId={openEditionId}
        mode="conductor"
        title={piece.title}
        subtitle={openEdition?.label}
        fileName={openEdition?.label}
        fetchBlob={
          openEditionId
            ? () => MaterialsService.fetchScoreEditionBlob(openEditionId)
            : null
        }
        canExport={openEdition?.canExport ?? true}
        onClose={() => setOpenEditionId(null)}
      />
    </div>
  );
};
