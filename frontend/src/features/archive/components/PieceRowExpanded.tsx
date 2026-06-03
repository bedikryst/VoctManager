/**
 * @file PieceRowExpanded.tsx
 * @description Accordion content rendered below a [PieceRow] when expanded.
 * Surfaces the data the conductor most often wants to glance at without
 * committing to a full editor: composer summary, divisi, PDFs, AI status,
 * tracks. Heavy AI verification flows live behind the "Tryb weryfikacji"
 * CTA → dedicated route.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRowExpanded
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  FileDown,
  Headphones,
  Mic,
  Pencil,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { ComposerCard } from "@/shared/ui/composites/repertoire";
import { hasPdf, getPiecePdfLinks } from "../constants/piecePdfs";
import type { EnrichedPiece } from "../types/archive.dto";

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
  const requirements = piece.voice_requirements_read ?? [];
  const audioCount = piece.tracks?.length ?? 0;
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
              <Eyebrow color="muted" size="caption" className="mb-2 block">
                <Mic size={11} className="mr-1 inline" aria-hidden="true" />
                {t("archive.row_expanded.divisi", "Divisi")}
              </Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {requirements.map((requirement) => (
                  <span
                    key={requirement.id ?? requirement.voice_line}
                    className="inline-flex items-baseline gap-1 rounded-md border border-ethereal-gold/25 bg-ethereal-gold/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-gold"
                  >
                    {requirement.voice_line_display ?? requirement.voice_line}
                    <span className="text-ethereal-gold/70">×{requirement.quantity}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <Caption color="muted">
              {t("archive.row_expanded.no_divisi", "Brak wymagań głosowych — dodaj w trybie weryfikacji.")}
            </Caption>
          )}

          {/* PDF download list */}
          {pdfLinks.length > 0 ? (
            <div>
              <Eyebrow color="muted" size="caption" className="mb-2 block">
                <FileDown size={11} className="mr-1 inline" aria-hidden="true" />
                {pdfLinks.length === 1
                  ? t("archive.row_expanded.pdf_one", "Partytura PDF")
                  : t("archive.row_expanded.pdf_many", "Wydania ({{count}})", {
                      count: pdfLinks.length,
                    })}
              </Eyebrow>
              <ul role="list" className="flex flex-col gap-1.5">
                {pdfLinks.map((pdf) => (
                  <li key={pdf.id}>
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-ethereal-amethyst/30 bg-ethereal-amethyst/5 px-3 py-1.5 text-[12px] font-medium text-ethereal-amethyst transition-colors hover:bg-ethereal-amethyst/10"
                    >
                      <FileDown size={12} aria-hidden="true" />
                      <span className="truncate">{pdf.label}</span>
                      {pdf.is_default && pdfLinks.length > 1 && (
                        <span className="text-[10px] text-ethereal-amethyst/60">
                          {t("archive.row_expanded.default_marker", "domyślne")}
                        </span>
                      )}
                      <ExternalLink size={10} aria-hidden="true" />
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
      <div className="rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/55 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Eyebrow color="muted" size="caption" className="inline-flex items-center gap-1.5">
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

      {/* Footer CTAs — focused-workflow handoff */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex flex-wrap items-center justify-end gap-2 border-t border-ethereal-incense/15 pt-3"
      >
        <Button asChild variant="outline" size="sm">
          <Link to={`/panel/archive-management/${piece.id}/edit`}>
            <Pencil size={13} aria-hidden="true" className="mr-1.5" />
            {t("archive.row_expanded.cta_edit", "Pełna edycja")}
          </Link>
        </Button>
        {hasAIContent ? (
          <Button asChild variant="primary" size="sm">
            <Link to={`/panel/archive-management/${piece.id}/review`}>
              <Sparkles size={13} aria-hidden="true" className="mr-1.5" />
              {t("archive.row_expanded.cta_review", "Tryb weryfikacji AI")}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="primary" size="sm">
            <Link to={`/panel/archive-management/${piece.id}/review`}>
              <UploadCloud size={13} aria-hidden="true" className="mr-1.5" />
              {t(
                "archive.row_expanded.cta_review_empty",
                "Otwórz tryb weryfikacji",
              )}
            </Link>
          </Button>
        )}
      </div>

      {!hasAIContent && (
        <Caption color="muted" className="block text-center">
          {t(
            "archive.row_expanded.ai_empty_hint",
            "Utwór wprowadzony ręcznie. Wgraj PDF żeby AI uzupełnił metadane, IPA, tłumaczenia i notkę programową.",
          )}
        </Caption>
      )}
    </div>
  );
};
