/**
 * @file PiecePage.tsx
 * @description Route-based piece detail (/panel/materials/:projectId/:pieceId).
 * A one-handed practice cockpit, not a document dump: the score opens in-app
 * (gated PdfViewer, audio keeps playing underneath), the voice mixer carries
 * one-tap practice presets, and a pitch pipe pre-highlights the piece's tonic.
 * On a phone the surface is split into Ćwicz / Tekst / Obsada tabs to kill the
 * scroll; from `lg:` up everything fans into two columns. Deep-linkable from
 * schedule and rehearsal mode.
 */
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  KeyRound,
  Languages,
  Lock,
  Music2,
  Timer,
  User,
  Users,
  Youtube,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { ScoreStandModal } from "@/features/annotations";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { PitchPipe, parseMusicalKeyTonic } from "@/shared/ui/instruments/PitchPipe";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Emphasis,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { getReferenceRecordingLinks } from "@/features/archive/constants/referenceRecordings";
import { getArchiveEpochLabel } from "@/features/archive/constants/archiveEpochs";
import {
  getPiecePdfLinks,
  type PiecePdfLink,
} from "@/features/archive/constants/piecePdfs";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import { useMaterialsData } from "./hooks/useMaterialsData";
import { useSetPieceReadiness } from "./api/materials.queries";
import { MaterialsService } from "./api/materials.service";
import { ReadinessControl } from "./components/ReadinessControl";
import { PieceLyricsViewer } from "./components/PieceLyricsViewer";
import { PieceDivisiRoster } from "./components/PieceDivisiRoster";
import { VoiceMixerPanel } from "./player/VoiceMixerPanel";
import { RehearsalDock } from "./player/RehearsalDock";
import type { MaterialsReadinessStatus } from "./types/materials.dto";

type PieceTab = "practice" | "text" | "cast";

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

const pdfFileName = (label: string): string =>
  label.toLowerCase().endsWith(".pdf") ? label : `${label}.pdf`;

export default function PiecePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projectId, pieceId } = useParams<{
    projectId: string;
    pieceId: string;
  }>();

  const { isLoading, filteredGroups } = useMaterialsData("", !!user);
  const readinessMutation = useSetPieceReadiness();
  const [tab, setTab] = useState<PieceTab>("practice");
  const [openEdition, setOpenEdition] = useState<PiecePdfLink | null>(null);

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
        <div className="mx-auto max-w-3xl pt-10">
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
  const suggestedTonic = piece.musical_key
    ? parseMusicalKeyTonic(piece.musical_key)
    : null;
  const myPart =
    piece.my_casting?.voice_line_display || piece.my_casting?.voice_line || null;

  const composerName = piece.composer
    ? `${piece.composer.first_name || ""} ${piece.composer.last_name}`.trim()
    : t("materials.piece.traditional", "Tradycyjny / Nieznany");
  const composerYears = piece.composer?.birth_year
    ? `${piece.composer.birth_year}–${piece.composer.death_year || ""}`
    : "";

  // A conductor views their own project's materials but has no participation to
  // self-report against — the readiness console is a singer-only affordance.
  const canReportReadiness = !group.isConducting && !!group.participationId;

  const handleReadinessChange = (status: MaterialsReadinessStatus) => {
    if (!group.participationId) return;
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

  const TABS = [
    { id: "practice" as const, label: t("materials.piece_page.tab_practice", "Ćwicz"), Icon: Music2 },
    { id: "text" as const, label: t("materials.piece_page.tab_text", "Tekst"), Icon: Languages },
    { id: "cast" as const, label: t("materials.piece_page.tab_cast", "Obsada"), Icon: Users },
  ];

  /** Hidden on mobile when not the active tab; always shown from `lg:` up. */
  const tabVisibility = (owner: PieceTab): string =>
    cn(tab !== owner && "hidden", "lg:block");

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl cursor-default space-y-5 pb-28">
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

          {/* meta chips — my part leads, since it's why the chorister is here */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {myPart && (
              <Eyebrow
                as="span"
                color="sage"
                className="flex items-center gap-1 rounded border border-ethereal-sage/30 bg-ethereal-sage/10 px-2 py-0.5"
              >
                <User size={10} aria-hidden="true" />
                {t("materials.piece_page.my_part_chip", "Twoja partia: {{part}}", {
                  part: myPart,
                })}
              </Eyebrow>
            )}
            {piece.my_casting?.gives_pitch && (
              <Eyebrow
                as="span"
                color="gold"
                className="flex items-center gap-1 rounded border border-ethereal-gold/30 bg-ethereal-gold/10 px-2 py-0.5"
              >
                <KeyRound size={10} aria-hidden="true" />
                {t("materials.piece_page.gives_pitch", "Ty podajesz ton")}
              </Eyebrow>
            )}
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
                {getArchiveEpochLabel(piece.epoch, t)}
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
          <>
            {/* ── score — always reachable, opens in-app over the practice ── */}
            <div>
              <SectionLabel icon={<FileText size={13} />}>
                {t("materials.piece_page.score_section", "Nuty")}
              </SectionLabel>
              {pdfLinks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenEdition(pdfLinks[0])}
                    className="flex items-center gap-3 rounded-xl bg-ethereal-sage px-4 py-3.5 shadow-glass-solid transition-all hover:bg-ethereal-sage/90 active:scale-[0.98]"
                  >
                    <FileText size={16} className="text-white" aria-hidden="true" />
                    <div className="min-w-0 flex-1 text-left">
                      <Eyebrow color="white" className="block truncate">
                        {t("materials.piece.open_score", "Otwórz partyturę")}
                      </Eyebrow>
                      <Text size="xs" color="parchment-muted" className="mt-0.5 block truncate">
                        {pdfLinks[0].label}
                      </Text>
                    </div>
                  </button>
                  {pdfLinks.slice(1).map((pdf) => (
                    <button
                      key={pdf.id}
                      type="button"
                      onClick={() => setOpenEdition(pdf)}
                      className="flex items-center gap-3 rounded-xl border border-ethereal-marble bg-ethereal-alabaster px-4 py-3 shadow-glass-solid transition-all hover:bg-ethereal-marble/50 active:scale-[0.98]"
                    >
                      <FileText size={15} className="text-ethereal-graphite" aria-hidden="true" />
                      <Eyebrow color="default" className="min-w-0 flex-1 truncate text-left">
                        {pdf.label}
                      </Eyebrow>
                    </button>
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

            {/* ── mobile tab switcher (desktop shows every column) ──────── */}
            <div className="lg:hidden">
              <SegmentedTabs
                items={TABS}
                value={tab}
                onChange={setTab}
                ariaLabel={t("materials.piece_page.tabs_aria", "Sekcje utworu")}
              />
            </div>

            <div className="space-y-5 lg:grid lg:grid-cols-5 lg:gap-5 lg:space-y-0">
              {/* ── main column ────────────────────────────────────────── */}
              <div className="space-y-5 lg:col-span-3">
                {/* voice mixer — the practice console */}
                {piece.tracks.length > 0 && (
                  <div className={tabVisibility("practice")}>
                    <SectionLabel icon={<Music2 size={13} />}>
                      {t("materials.piece_page.mixer_section", "Konsola ćwiczeń")}
                    </SectionLabel>
                    <VoiceMixerPanel piece={piece} projectId={group.project.id} />
                    <Text size="xs" color="muted" className="mt-2 px-1">
                      {t(
                        "materials.piece_page.mixer_hint",
                        "Wybierz tryb jednym tapnięciem albo dostrój każdy głos osobno — ćwicz swoją partię na tle całego chóru.",
                      )}
                    </Text>
                  </div>
                )}

                {/* reference recordings */}
                {referenceLinks.length > 0 && (
                  <div className={tabVisibility("practice")}>
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
                <div className={tabVisibility("text")}>
                  <PieceLyricsViewer
                    originalLyrics={piece.lyrics_original}
                    lyricsIpa={piece.lyrics_ipa}
                    translations={piece.translations}
                    programNotes={piece.program_notes}
                    defaultExpanded
                  />
                </div>
              </div>

              {/* ── side column ────────────────────────────────────────── */}
              <div className="space-y-5 lg:col-span-2">
                {/* pitch pipe — get your starting note, tonic pre-highlighted */}
                <div className={tabVisibility("practice")}>
                  <SectionLabel icon={<KeyRound size={13} />}>
                    {t("materials.piece_page.pitch_section", "Kamerton")}
                  </SectionLabel>
                  <PitchPipe suggestedTonic={suggestedTonic} />
                </div>

                {/* readiness self-report — singer-only; a conductor has no
                    participation to report against */}
                {canReportReadiness && (
                  <div className={tabVisibility("practice")}>
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
                )}

                {/* my guidelines */}
                {piece.my_casting && (
                  <GlassCard
                    variant="ethereal"
                    className={cn("bg-ethereal-sage/5", tabVisibility("practice"))}
                    isHoverable={false}
                  >
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
                <div className={tabVisibility("cast")}>
                  <PieceDivisiRoster castings={piece.castings} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Managers write the shared/conductor layers; choristers get their own
          private pencil-mark layer on top of the conductor's shared markings. */}
      <ScoreStandModal
        isOpen={openEdition !== null}
        editionId={openEdition?.id ?? null}
        mode={isManager(user) ? "conductor" : "personal"}
        title={piece.title}
        subtitle={openEdition?.label ?? composerName}
        fileName={openEdition ? pdfFileName(openEdition.label) : undefined}
        fetchBlob={
          openEdition
            ? () => MaterialsService.fetchScoreEditionBlob(openEdition.id)
            : null
        }
        canExport={openEdition?.canExport ?? true}
        extraOverlay={
          /* Rehearsal instrument: starting pitches + practice-player remote,
             available while the score is on the stand. */
          <RehearsalDock
            piece={piece}
            projectId={group.project.id}
            canEditPitches={isManager(user)}
          />
        }
        onClose={() => setOpenEdition(null)}
      />
    </PageTransition>
  );
}
