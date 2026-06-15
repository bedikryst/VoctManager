/**
 * @file PiecePage.tsx
 * @description Route-based piece detail (/panel/materials/:projectId/:pieceId).
 * Replaces the old accordion-in-accordion card: score, voice mixer, readiness,
 * conductor guidelines, lyrics and divisi each get a first-class section that
 * works one-handed on a phone. Deep-linkable from schedule and rehearsal mode.
 */
import React from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  KeyRound,
  Lock,
  Music2,
  Timer,
  User,
  Youtube,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Emphasis,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { getReferenceRecordingLinks } from "@/features/archive/constants/referenceRecordings";
import { getPiecePdfLinks } from "@/features/archive/constants/piecePdfs";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import { useMaterialsData } from "./hooks/useMaterialsData";
import { useSetPieceReadiness } from "./api/materials.queries";
import { ReadinessControl } from "./components/ReadinessControl";
import { PieceLyricsViewer } from "./components/PieceLyricsViewer";
import { PieceDivisiRoster } from "./components/PieceDivisiRoster";
import { VoiceMixerPanel } from "./player/VoiceMixerPanel";
import type { MaterialsReadinessStatus } from "./types/materials.dto";

const SectionLabel = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="mb-2.5 flex items-center gap-2">
    <span className="text-ethereal-gold" aria-hidden="true">
      {icon}
    </span>
    <Eyebrow color="muted">{children}</Eyebrow>
  </div>
);

export default function PiecePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projectId, pieceId } = useParams<{
    projectId: string;
    pieceId: string;
  }>();

  const { isLoading, filteredGroups } = useMaterialsData("", !!user);
  const readinessMutation = useSetPieceReadiness();

  if (isLoading) {
    return (
      <PageTransition>
        <EtherealLoader
          message={t("materials.dashboard.syncing", "Synchronizacja biblioteki...")}
        />
      </PageTransition>
    );
  }

  const group = filteredGroups.find((g) => g.project.id === projectId);
  const programItem = group?.program.find((item) => item.piece.id === pieceId);

  if (!group || !programItem) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl px-4 pt-10 md:px-6">
          <StatePanel
            icon={<Music2 size={26} aria-hidden="true" />}
            title={t("materials.piece_page.not_found_title", "Nie znaleziono utworu")}
            description={t(
              "materials.piece_page.not_found_desc",
              "Ten utwór nie jest już dostępny w Twoim śpiewniku lub link jest nieaktualny.",
            )}
            actions={
              <Button variant="secondary" asChild>
                <Link to="/panel/materials">
                  {t("materials.piece_page.back_to_songbook", "Wróć do śpiewnika")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  const { piece } = programItem;
  const isArchived = group.project.status === "DONE";
  const pdfLinks = getPiecePdfLinks({ editions: piece.editions });
  const referenceLinks = getReferenceRecordingLinks({
    recordings: piece.recordings,
  });

  const composerName = piece.composer
    ? `${piece.composer.first_name || ""} ${piece.composer.last_name}`.trim()
    : t("materials.piece.traditional", "Tradycyjny / Nieznany");
  const composerYears = piece.composer?.birth_year
    ? `${piece.composer.birth_year}–${piece.composer.death_year || ""}`
    : "";

  const handleReadinessChange = (status: MaterialsReadinessStatus) => {
    readinessMutation.mutate(
      { participationId: group.participationId, pieceId: piece.id, status },
      {
        onError: () =>
          toast.error(
            t("materials.readiness.save_error", "Nie udało się zapisać gotowości."),
          ),
      },
    );
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl cursor-default space-y-5 px-4 pb-28 md:px-6">
        {/* ── breadcrumb / context ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-5">
          <Link
            to="/panel/materials"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-ethereal-graphite transition-colors hover:bg-ethereal-marble/40 hover:text-ethereal-ink"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <Eyebrow color="muted">
              {t("materials.piece_page.back_short", "Śpiewnik")}
            </Eyebrow>
          </Link>
          <Eyebrow color="muted" className="truncate">
            {group.project.title} ·{" "}
            {formatLocalizedDate(group.project.date_time)}
          </Eyebrow>
        </div>

        {/* ── header ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-start gap-3">
            <div
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ethereal-marble bg-ethereal-alabaster shadow-glass-solid"
              aria-hidden="true"
            >
              <Heading size="xl" weight="medium">
                {String(programItem.order)}
              </Heading>
            </div>
            <div className="min-w-0">
              <Heading as="h1" size="3xl" weight="medium" className="leading-tight">
                {piece.title}
              </Heading>
              <Text color="graphite" size="sm" className="mt-1">
                {composerName}
                {composerYears && (
                  <Text as="span" size="sm" color="muted">
                    {" "}
                    ({composerYears})
                  </Text>
                )}
              </Text>
            </div>
          </div>

          {/* meta chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {piece.musical_key && (
              <Eyebrow
                as="span"
                color="default"
                className="flex items-center gap-1 rounded border border-ethereal-marble bg-ethereal-alabaster px-2 py-0.5 shadow-glass-solid"
              >
                <KeyRound size={10} aria-hidden="true" />
                {piece.musical_key}
              </Eyebrow>
            )}
            {piece.epoch && (
              <Eyebrow
                as="span"
                color="muted"
                className="rounded border border-ethereal-marble bg-ethereal-alabaster px-2 py-0.5 shadow-glass-solid"
              >
                {piece.epoch}
              </Eyebrow>
            )}
            {piece.estimated_duration != null && piece.estimated_duration > 0 && (
              <Eyebrow
                as="span"
                color="muted"
                className="flex items-center gap-1 rounded border border-ethereal-marble bg-ethereal-alabaster px-2 py-0.5 shadow-glass-solid"
              >
                <Timer size={10} aria-hidden="true" />
                {t("materials.piece_page.duration_min", "{{count}} min", {
                  count: Math.round(piece.estimated_duration / 60) || 1,
                })}
              </Eyebrow>
            )}
            {programItem.is_encore && (
              <Eyebrow
                as="span"
                color="incense"
                className="rounded border border-ethereal-incense/25 bg-ethereal-incense/10 px-2 py-0.5"
              >
                {t("materials.piece.encore_badge", "Bis")}
              </Eyebrow>
            )}
          </div>
        </div>

        {isArchived ? (
          <StatePanel
            icon={<Lock size={26} aria-hidden="true" />}
            title={t("materials.piece.access_locked_title", "Dostęp Zablokowany")}
            description={t(
              "materials.piece.access_locked_desc",
              "Projekt został zakończony. Materiały ćwiczeniowe nie są już dostępne ze względu na ochronę własności intelektualnej.",
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* ── main column ──────────────────────────────────────── */}
            <div className="space-y-5 lg:col-span-3">
              {/* score PDFs */}
              <div>
                <SectionLabel icon={<FileText size={13} />}>
                  {t("materials.piece_page.score_section", "Nuty")}
                </SectionLabel>
                {pdfLinks.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {pdfLinks.map((pdf, idx) => (
                      <a
                        key={pdf.id}
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-glass-solid transition-all active:scale-[0.98] ${
                          idx === 0
                            ? "bg-ethereal-sage hover:bg-ethereal-sage/90"
                            : "border border-ethereal-marble bg-ethereal-alabaster hover:bg-ethereal-marble/50"
                        }`}
                      >
                        <Download
                          size={15}
                          className={idx === 0 ? "text-white" : "text-ethereal-graphite"}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <Eyebrow
                            color={idx === 0 ? "white" : "default"}
                            className="block truncate"
                          >
                            {idx === 0
                              ? t("materials.piece.download_pdf", "Pobierz Partyturę (PDF)")
                              : pdf.label}
                          </Eyebrow>
                          {idx === 0 && (
                            <Text size="xs" color="parchment-muted" className="mt-0.5 block truncate">
                              {pdf.label}
                            </Text>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-ethereal-marble bg-ethereal-marble/40 px-5 py-3">
                    <FileText size={15} className="text-ethereal-graphite" aria-hidden="true" />
                    <Eyebrow color="muted">
                      {t("materials.piece.no_pdf", "Nuty niedostępne")}
                    </Eyebrow>
                  </div>
                )}
              </div>

              {/* voice mixer */}
              {piece.tracks.length > 0 && (
                <div>
                  <SectionLabel icon={<Music2 size={13} />}>
                    {t("materials.piece_page.mixer_section", "Mikser głosów")}
                  </SectionLabel>
                  <VoiceMixerPanel piece={piece} projectId={group.project.id} />
                  <Text size="xs" color="muted" className="mt-2 px-1">
                    {t(
                      "materials.piece_page.mixer_hint",
                      "Wycisz lub podgłośnij dowolny głos — ćwicz swoją partię na tle całego chóru.",
                    )}
                  </Text>
                </div>
              )}

              {/* reference recordings */}
              {referenceLinks.length > 0 && (
                <div>
                  <SectionLabel icon={<Youtube size={13} />}>
                    {t("materials.piece_page.reference_section", "Nagrania referencyjne")}
                  </SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {referenceLinks.map((ref, idx) => (
                      <a
                        key={`${ref.platform}-${idx}`}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-ethereal-marble bg-ethereal-alabaster px-4 py-2.5 shadow-glass-solid transition-all hover:bg-ethereal-marble/50 active:scale-95"
                        title={
                          ref.performer
                            ? `${ref.performer}${ref.year ? ` · ${ref.year}` : ""}`
                            : undefined
                        }
                      >
                        {ref.platform === "youtube" ? (
                          <Youtube size={14} className="text-ethereal-crimson" aria-hidden="true" />
                        ) : (
                          <Music2 size={14} className="text-ethereal-sage" aria-hidden="true" />
                        )}
                        <Eyebrow color="default">
                          {ref.is_featured
                            ? t(
                                "materials.piece.listen_reference_featured",
                                "Najlepsze · {{label}}",
                                { label: ref.label },
                              )
                            : ref.performer
                              ? `${ref.label} · ${ref.performer}`
                              : ref.label}
                        </Eyebrow>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* lyrics, IPA, translations, program notes */}
              <PieceLyricsViewer
                originalLyrics={piece.lyrics_original}
                lyricsIpa={piece.lyrics_ipa}
                translations={piece.translations}
                programNotes={piece.program_notes}
              />
            </div>

            {/* ── side column ──────────────────────────────────────── */}
            <div className="space-y-5 lg:col-span-2">
              {/* readiness self-report */}
              <div>
                <SectionLabel icon={<User size={13} />}>
                  {t("materials.piece_page.readiness_section", "Twoja gotowość")}
                </SectionLabel>
                <ReadinessControl
                  value={piece.my_readiness}
                  onChange={handleReadinessChange}
                  disabled={readinessMutation.isPending}
                />
                <Text size="xs" color="muted" className="mt-2 px-1">
                  {t(
                    "materials.piece_page.readiness_hint",
                    "Dyrygent widzi zbiorczą gotowość zespołu i planuje pracę na próbach.",
                  )}
                </Text>
              </div>

              {/* my guidelines */}
              {piece.my_casting && (
                <GlassCard variant="ethereal" className="bg-ethereal-sage/5" isHoverable={false}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ethereal-marble bg-ethereal-alabaster text-ethereal-incense shadow-glass-solid">
                      <User size={14} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <Eyebrow color="incense">
                        {t("materials.piece.your_guidelines", "Twoje wytyczne")}
                      </Eyebrow>
                      <Text size="sm">
                        <Emphasis>{t("materials.piece.part", "Partia:")}</Emphasis>{" "}
                        {piece.my_casting.voice_line_display || piece.my_casting.voice_line}
                      </Text>
                    </div>
                  </div>
                  {piece.my_casting.gives_pitch && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-ethereal-gold/25 bg-ethereal-gold/10 px-3 py-2">
                      <KeyRound size={13} className="text-ethereal-gold" aria-hidden="true" />
                      <Eyebrow color="gold">
                        {t("materials.piece_page.gives_pitch", "Ty podajesz ton")}
                      </Eyebrow>
                    </div>
                  )}
                  {piece.my_casting.notes ? (
                    <div className="rounded-lg border border-ethereal-marble/60 bg-ethereal-marble/40 p-3">
                      <Text size="sm" color="graphite" className="italic">
                        &quot;{piece.my_casting.notes}&quot;
                      </Text>
                    </div>
                  ) : (
                    <Text size="sm" color="graphite" className="italic opacity-70">
                      {t("materials.piece.no_notes", "Dyrygent nie dodał specjalnych uwag.")}
                    </Text>
                  )}
                </GlassCard>
              )}

              {/* divisi */}
              <PieceDivisiRoster castings={piece.castings} />
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
