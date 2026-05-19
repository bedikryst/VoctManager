/**
 * @file ArchiveAIContextTab.tsx
 * @description Read-only surface inside the Archive editor that renders the
 * AI-extracted + externally-enriched repertoire context for a single Piece:
 * composer biography (with MB/Wikidata links), opus + key + text source,
 * movements, IPA, translations, program notes, recordings. Editing for these
 * fields lives in the Score Compiler review modal — this tab is a viewer
 * with a deep-link back to that flow.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveAIContextTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  FileDown,
  Languages,
  Music2,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import type { Piece, Recording } from "@/shared/types";
import { getPiecePdfLinks } from "../constants/piecePdfs";

interface ArchiveAIContextTabProps {
  readonly piece: Piece;
}

const SectionDivider = ({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}): React.JSX.Element => (
  <div className="mb-3 mt-8 flex items-center gap-3 first:mt-0">
    {icon && (
      <span className="text-ethereal-gold" aria-hidden="true">
        {icon}
      </span>
    )}
    <Eyebrow color="muted" size="caption">
      {label}
    </Eyebrow>
    <div
      className="h-px flex-1 bg-gradient-to-r from-ethereal-incense/30 to-transparent"
      aria-hidden="true"
    />
  </div>
);

const RecordingLink = ({
  recording,
}: {
  recording: Recording;
}): React.JSX.Element => (
  <li>
    <a
      href={recording.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 px-4 py-3 transition-colors hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/40"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ethereal-incense/30 bg-ethereal-marble/70 text-ethereal-graphite"
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
);

export const ArchiveAIContextTab = ({
  piece,
}: ArchiveAIContextTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const composer = piece.composer ?? null;
  const lifespan = [composer?.birth_year, composer?.death_year]
    .filter(Boolean)
    .join("–");
  const pdfLinks = getPiecePdfLinks(piece);
  const editions = (piece.editions ?? []).filter((e) => Boolean(e.pdf_file));
  const hasAnything =
    composer?.mbid ||
    composer?.wikidata_qid ||
    composer?.bio ||
    composer?.portrait_url ||
    editions.length > 0 ||
    (piece.movements && piece.movements.length > 0) ||
    piece.lyrics_ipa ||
    (piece.translations && piece.translations.length > 0) ||
    (piece.program_notes && piece.program_notes.length > 0) ||
    (piece.recordings && piece.recordings.length > 0);

  if (!hasAnything) {
    return (
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Sparkles
            size={24}
            className="text-ethereal-gold/60"
            aria-hidden="true"
          />
          <Heading as="h3" size="lg" weight="medium">
            {t(
              "archive.ai_context.empty_title",
              "Brak danych z Score Package Compiler",
            )}
          </Heading>
          <Text color="muted" size="sm" className="max-w-md">
            {t(
              "archive.ai_context.empty_body",
              "Ten utwór został dodany ręcznie. Możesz wgrać PDF do Score Package Compilera, by AI uzupełnił metadane, tłumaczenia, IPA i notkę programową.",
            )}
          </Text>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/panel/score-compiler">
              {t(
                "archive.ai_context.open_compiler",
                "Otwórz Score Package Compiler",
              )}
            </Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      {composer && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.composer_section",
              "Kompozytor (MusicBrainz + Wikidata)",
            )}
          />
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {composer.portrait_url ? (
              <img
                src={composer.portrait_url}
                alt={t(
                  "archive.ai_context.portrait_alt",
                  "Portret {{name}}",
                  {
                    name:
                      composer.full_name ??
                      `${composer.first_name ?? ""} ${composer.last_name}`.trim(),
                  },
                )}
                className="h-24 w-24 shrink-0 rounded-2xl border border-ethereal-incense/20 object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-ethereal-incense/25 bg-ethereal-marble/60"
                aria-hidden="true"
              >
                <Sparkles size={24} className="text-ethereal-gold/60" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Heading as="h3" size="lg" weight="medium">
                {composer.full_name ??
                  `${composer.first_name ?? ""} ${composer.last_name}`.trim()}
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
                  <a
                    href={`https://musicbrainz.org/artist/${composer.mbid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
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
                    className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
                  >
                    Wikidata
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Canonical identifiers + AI scalars */}
      {(piece.opus_catalog ||
        piece.musical_key ||
        piece.text_source ||
        piece.mbid_work) && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.work_section",
              "Identyfikatory utworu",
            )}
          />
          <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
            {piece.opus_catalog && (
              <div>
                <Caption color="muted" className="block">
                  Opus / Katalog
                </Caption>
                <Text size="sm" weight="semibold">
                  {piece.opus_catalog}
                </Text>
              </div>
            )}
            {piece.musical_key && (
              <div>
                <Caption color="muted" className="block">
                  Tonacja
                </Caption>
                <Text size="sm" weight="semibold">
                  {piece.musical_key}
                </Text>
              </div>
            )}
            {piece.text_source && (
              <div className="sm:col-span-2">
                <Caption color="muted" className="block">
                  Źródło tekstu
                </Caption>
                <Text size="sm" weight="semibold">
                  {piece.text_source}
                </Text>
              </div>
            )}
            {piece.mbid_work && (
              <div className="sm:col-span-2">
                <Caption color="muted" className="block">
                  MusicBrainz Work
                </Caption>
                <a
                  href={`https://musicbrainz.org/work/${piece.mbid_work}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-ethereal-gold hover:underline"
                >
                  {piece.mbid_work}
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
            )}
          </dl>
        </GlassCard>
      )}

      {/* Editions (PDF files) */}
      {pdfLinks.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.editions",
              "Wydania nutowe ({{count}})",
              { count: pdfLinks.length },
            )}
            icon={<FileDown size={14} aria-hidden="true" />}
          />
          <ul role="list" className="flex flex-col gap-2">
            {pdfLinks.map((pdf) => (
              <li key={pdf.id}>
                <a
                  href={pdf.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 px-4 py-3 transition-colors hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/40"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
                    aria-hidden="true"
                  >
                    <FileDown size={14} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Text
                      size="sm"
                      weight="semibold"
                      truncate
                      className="block"
                    >
                      {pdf.label}
                    </Text>
                    <Caption color="muted">
                      {[
                        pdf.is_default
                          ? t(
                              "archive.ai_context.edition_default",
                              "domyślne",
                            )
                          : null,
                        pdf.is_legacy
                          ? t(
                              "archive.ai_context.edition_legacy",
                              "legacy (sheet_music)",
                            )
                          : null,
                        pdf.publisher,
                        pdf.edition_year ? String(pdf.edition_year) : null,
                        pdf.page_count
                          ? t(
                              "archive.ai_context.pages_count",
                              "{{count}} stron",
                              { count: pdf.page_count },
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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
        </GlassCard>
      )}

      {/* Movements */}
      {piece.movements && piece.movements.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.movements",
              "Części ({{count}})",
              { count: piece.movements.length },
            )}
            icon={<Music2 size={14} aria-hidden="true" />}
          />
          <ul role="list" className="flex flex-col gap-2">
            {[...piece.movements]
              .sort((a, b) => a.order_index - b.order_index)
              .map((mv) => (
                <li
                  key={mv.id}
                  className="flex items-baseline gap-3 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster/55 px-4 py-2"
                >
                  <Eyebrow color="muted" size="caption">
                    {String(mv.order_index + 1).padStart(2, "0")}
                  </Eyebrow>
                  <Text size="sm" weight="medium" className="flex-1">
                    {mv.title}
                  </Text>
                  {mv.tempo_marking && (
                    <Caption color="muted" className="italic">
                      {mv.tempo_marking}
                    </Caption>
                  )}
                </li>
              ))}
          </ul>
        </GlassCard>
      )}

      {/* IPA + Translations */}
      {(piece.lyrics_ipa ||
        (piece.translations && piece.translations.length > 0)) && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.lyrics_section",
              "Wymowa i tłumaczenia",
            )}
            icon={<Languages size={14} aria-hidden="true" />}
          />
          <div className="flex flex-col gap-4">
            {piece.lyrics_ipa && (
              <article className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
                <Eyebrow color="muted" size="caption">
                  IPA · wymowa
                </Eyebrow>
                <pre className="mt-2 whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-ethereal-ink">
                  {piece.lyrics_ipa}
                </pre>
              </article>
            )}
            {(piece.translations ?? []).map((tr) => (
              <article
                key={tr.id}
                className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
              >
                <div className="flex items-baseline justify-between">
                  <Eyebrow color="muted" size="caption">
                    {t(
                      "archive.ai_context.translation_label",
                      "Tłumaczenie · {{lang}}",
                      { lang: tr.target_language.toUpperCase() },
                    )}
                  </Eyebrow>
                  {tr.is_singable && (
                    <Caption color="muted">
                      {t("archive.ai_context.singable", "śpiewalne")}
                    </Caption>
                  )}
                </div>
                <Text
                  size="sm"
                  className="mt-2 whitespace-pre-wrap leading-relaxed"
                >
                  {tr.text}
                </Text>
              </article>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Program notes */}
      {piece.program_notes && piece.program_notes.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.program_note",
              "Notka programowa",
            )}
            icon={<ScrollText size={14} aria-hidden="true" />}
          />
          {piece.program_notes.map((note) => (
            <article
              key={note.id}
              className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
            >
              <div className="flex items-baseline justify-between">
                <Eyebrow color="muted" size="caption">
                  {note.language.toUpperCase()} · {note.target_tone}
                </Eyebrow>
                {note.is_approved && (
                  <Caption color="muted">
                    {t("archive.ai_context.approved", "zatwierdzona")}
                  </Caption>
                )}
              </div>
              <Text
                size="sm"
                className="mt-2 whitespace-pre-wrap leading-relaxed"
              >
                {note.content}
              </Text>
            </article>
          ))}
        </GlassCard>
      )}

      {/* Recordings */}
      {piece.recordings && piece.recordings.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.ai_context.recordings",
              "Nagrania referencyjne ({{count}})",
              { count: piece.recordings.length },
            )}
            icon={<Sparkles size={14} aria-hidden="true" />}
          />
          <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {piece.recordings.map((rec) => (
              <RecordingLink key={rec.id} recording={rec} />
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Deep-link back to the Score Compiler */}
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to="/panel/score-compiler">
            {t(
              "archive.ai_context.open_compiler_btn",
              "Edytuj w Score Compilerze",
            )}
          </Link>
        </Button>
      </div>
    </div>
  );
};
