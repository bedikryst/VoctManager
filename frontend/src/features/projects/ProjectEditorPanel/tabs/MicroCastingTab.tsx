/**
 * @file MicroCastingTab.tsx
 * @description Advanced Kanban Board for Divisi and Micro-casting orchestration.
 * Completely delegates complex drag-and-drop state, caching, and optimistic mutations
 * to the useMicroCasting hook. Exclusively handles presentation and DnD routing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/MicroCastingTab
 */

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  AlertCircle,
  CheckCircle2,
  Users,
  MicVocal,
  PlayCircleIcon,
  ListOrdered,
} from "lucide-react";

import { useMicroCasting } from "../hooks/useMicroCasting";
import { getPrimaryReferenceRecording } from "@/features/archive/constants/referenceRecordings";
import { DraggableArtist } from "./components/DraggableArtist";
import { DroppableBucket } from "./components/DroppableBucket";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Select } from "@/shared/ui/primitives/Select";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

interface MicroCastingTabProps {
  projectId: string;
}

export const MicroCastingTab = ({
  projectId,
}: MicroCastingTabProps): React.JSX.Element => {
  const { t } = useTranslation();

  const VOICE_GROUPS = [
    { label: t("projects.micro_cast.voices.sopranos", "Soprany"), filter: "S" },
    { label: t("projects.micro_cast.voices.altos", "Alty"), filter: "A" },
    { label: t("projects.micro_cast.voices.tenors", "Tenory"), filter: "T" },
    { label: t("projects.micro_cast.voices.basses", "Basy"), filter: "B" },
  ];

  const {
    program,
    voiceLines,
    pieces,
    selectedPieceId,
    setSelectedPieceId,
    localCastings,
    activeDragId,
    artistMap,
    pieceStatuses,
    projectParticipations,
    handleUpdateNote,
    handleDragStart,
    handleDragEnd,
  } = useMicroCasting(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedPiece = pieces.find((p) => String(p.id) === selectedPieceId);
  const referenceUrl = selectedPiece
    ? getPrimaryReferenceRecording(selectedPiece)
    : null;
  const requirements = selectedPiece?.voice_requirements || [];

  const unassignedParticipations = projectParticipations.filter(
    (part) =>
      !localCastings.some((c) => String(c.participation) === String(part.id)),
  );

  const renderBucket = (
    bucketId: string,
    title: string,
    requirementCount: number | null,
  ) => {
    const bucketCastings = localCastings.filter(
      (c) => c.voice_line === bucketId,
    );
    const deficit =
      requirementCount !== null
        ? requirementCount - bucketCastings.length
        : null;

    return (
      <DroppableBucket key={bucketId} id={bucketId} title={title}>
        <div className="mb-3 flex items-center justify-between border-b border-ethereal-incense/20 pb-2">
          <Eyebrow color="muted">{title}</Eyebrow>
          <div className="flex gap-1.5">
            <Badge variant="neutral">{bucketCastings.length}</Badge>
            {requirementCount !== null && deficit !== null && deficit > 0 && (
              <Badge
                variant="danger"
                title={t("projects.micro_cast.status.deficit", "Braki: ")}
              >
                -{deficit}
              </Badge>
            )}
            {requirementCount !== null && deficit !== null && deficit <= 0 && (
              <Badge variant="success" icon={<CheckCircle2 size={12} />}>
                {""}
              </Badge>
            )}
          </div>
        </div>

        <div className="min-h-15 space-y-2">
          {bucketCastings.map((casting) => {
            const artist = artistMap.get(String(casting.participation));
            if (!artist) return null;
            return (
              <DraggableArtist
                key={casting.id}
                participationId={String(casting.participation)}
                artist={artist}
                casting={casting}
                onUpdateNote={handleUpdateNote}
              />
            );
          })}
          {bucketCastings.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-ethereal-incense/20 bg-ethereal-parchment/40 py-4 text-center opacity-60">
              <Eyebrow color="muted">
                {requirementCount === null
                  ? t(
                      "projects.micro_cast.empty.section",
                      "Brak przypisań w tej sekcji",
                    )
                  : t("projects.micro_cast.status.free", "Wolny Wakat")}
              </Eyebrow>
            </div>
          )}
        </div>
      </DroppableBucket>
    );
  };

  return (
    <div className="mx-auto flex h-full w-full min-h-0 flex-1 max-w-7xl flex-col overflow-hidden pb-2">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <StaggeredBentoContainer className="grid h-full min-h-0 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-12">
          {/* LEFT SIDEBAR: Proportions 4/12, Column Wrapping */}
          <StaggeredBentoItem className="col-span-1 flex min-h-0 flex-col gap-6 overflow-hidden lg:col-span-4 xl:col-span-3">
            {/* Top Widget - Piece Selection */}
            <GlassCard
              variant="ethereal"
              padding="md"
              isHoverable={false}
              className="flex shrink-0 flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <MicVocal
                    className="text-ethereal-gold"
                    size={20}
                    aria-hidden="true"
                  />
                  <Heading as="h2" size="xl" weight="medium">
                    {t(
                      "projects.micro_cast.header.title",
                      "Divisi",
                    )}
                  </Heading>
                </div>
                <Text size="sm" color="muted">
                  {t(
                    "projects.micro_cast.header.subtitle",
                    "Wybierz utwór do castingu, a następnie przeciągaj wokalistów.",
                  )}
                </Text>
              </div>

              <div className="w-full">
                <Select
                  label={t(
                    "projects.micro_cast.select_piece",
                    "Wybierz utwór z programu",
                  )}
                  value={selectedPieceId || ""}
                  onChange={(event) => setSelectedPieceId(event.target.value)}
                >
                  {program.length === 0 && (
                    <option value="">
                      {t("projects.micro_cast.empty.pieces", "Brak utworów")}
                    </option>
                  )}
                  {program.length > 0 && (
                    <optgroup
                      label={t(
                        "projects.micro_cast.label.pieces_in_program",
                        "Utwory w programie",
                      )}
                    >
                      {[...program]
                        .sort((a, b) => a.order - b.order)
                        .map((item, index) => {
                          const piece = pieces.find(
                            (p) => String(p.id) === String(item.piece),
                          );
                          const status = pieceStatuses[String(item.piece)];

                          let optionColorClass = "text-ethereal-graphite";
                          if (status === "OK")
                            optionColorClass = "font-bold text-ethereal-sage";
                          if (status === "DEFICIT")
                            optionColorClass = "font-bold text-ethereal-crimson";

                          return (
                            <option
                              key={
                                item.id || `microcast-opt-${item.piece}-${index}`
                              }
                              value={item.piece}
                              className={optionColorClass}
                            >
                              {index + 1}. {item.piece_title || piece?.title}
                            </option>
                          );
                        })}
                    </optgroup>
                  )}
                </Select>
              </div>
            </GlassCard>

            {/* Bottom Widget - Unassigned (Takes remaining height) */}
            <GlassCard
              variant="ethereal"
              padding="md"
              isHoverable={false}
              className="flex-1 min-h-0 overflow-hidden border-ethereal-gold/20 bg-ethereal-parchment/30"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-4 flex flex-none items-center justify-between border-b border-ethereal-incense/20 pb-3">
                  <div className="flex items-center gap-1.5">
                    <Users
                      size={14}
                      className="text-ethereal-gold"
                      aria-hidden="true"
                    />
                    <Eyebrow color="muted">
                      {t(
                        "projects.micro_cast.sections.unassigned",
                        "Nieprzypisani",
                      )}
                    </Eyebrow>
                  </div>
                  <Badge variant="warning">{unassignedParticipations.length}</Badge>
                </div>

                <DroppableBucket
                  id="UNASSIGNED"
                  title={t(
                    "projects.micro_cast.sections.unassigned",
                    "Nieprzypisani",
                  )}
                  className="ethereal-scroll -mr-2 flex-1 min-h-0 overflow-y-auto pr-2 [scrollbar-gutter:stable]"
                >
                  <div className="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
                    {unassignedParticipations.map((part) => {
                      const artist = artistMap.get(String(part.id));
                      if (!artist) return null;
                      return (
                        <DraggableArtist
                          key={part.id}
                          participationId={String(part.id)}
                          artist={artist}
                        />
                      );
                    })}
                    {unassignedParticipations.length === 0 && (
                      <div className="col-span-full py-8 text-center opacity-60">
                        <CheckCircle2
                          size={32}
                          className="mx-auto mb-2 text-ethereal-sage"
                          aria-hidden="true"
                        />
                        <Eyebrow color="muted">
                          {t(
                            "projects.micro_cast.empty.unassigned",
                            "Wszyscy zostali przypisani do ról.",
                          )}
                        </Eyebrow>
                      </div>
                    )}
                  </div>
                </DroppableBucket>
              </div>
            </GlassCard>
          </StaggeredBentoItem>

          {/* MAIN SECTION: Divisi / Casting Buckets */}
          <StaggeredBentoItem className="col-span-1 flex min-h-0 flex-col overflow-hidden lg:col-span-8 xl:col-span-9">
            <GlassCard
              variant="ethereal"
              padding="md"
              isHoverable={false}
              className="flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-6 flex flex-none items-center justify-between border-b border-ethereal-incense/20 pb-4">
                  <div className="flex items-center gap-3">
                    <GlassCard
                      variant="light"
                      padding="none"
                      isHoverable={false}
                      className="flex h-10 w-10 items-center justify-center"
                    >
                      <ListOrdered
                        size={18}
                        className="text-ethereal-gold"
                        aria-hidden="true"
                      />
                    </GlassCard>
                    <div>
                      <Text size="sm" weight="bold">
                        {selectedPiece?.title ||
                          t("projects.micro_cast.empty.pieces", "Brak utworu")}
                      </Text>
                      <Eyebrow color="muted">
                        {selectedPiece?.composer_full_name ||
                          selectedPiece?.composer_name ||
                          ""}
                      </Eyebrow>
                    </div>
                  </div>

                  {referenceUrl && (
                    <a
                      href={referenceUrl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-ethereal-sage/30 bg-ethereal-sage/10 px-4 py-2 text-ethereal-sage shadow-glass-ethereal transition-colors hover:bg-ethereal-sage/20"
                    >
                      <PlayCircleIcon size={14} aria-hidden="true" />
                      <Eyebrow color="inherit" className="hidden sm:inline">
                        {t(
                          "projects.micro_cast.buttons.play_reference",
                          "Odtwórz: {{platform}}",
                          { platform: referenceUrl.label },
                        )}
                      </Eyebrow>
                    </a>
                  )}
                </div>

                <div className="ethereal-scroll -mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  {requirements.length === 0 ? (
                    <div className="space-y-8 pb-4">
                      <GlassCard
                        variant="outline"
                        padding="sm"
                        isHoverable={false}
                        className="mb-6 flex items-center gap-2 border-ethereal-gold/30 bg-ethereal-gold/10"
                      >
                        <AlertCircle
                          size={16}
                          className="text-ethereal-gold"
                          aria-hidden="true"
                        />
                        <Text size="xs" color="graphite" weight="medium">
                          {t(
                            "projects.micro_cast.empty.no_requirements",
                            "Brak zdefiniowanych wymagań głosowych dla tego utworu w bazie repertuarowej. Używamy trybu dowolnego przypisania (Divisi).",
                          )}
                        </Text>
                      </GlassCard>

                      {VOICE_GROUPS.map((group) => (
                        <div
                          key={group.label}
                          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
                        >
                          <div className="border-b border-ethereal-incense/20 pb-2 md:col-span-2 xl:col-span-4">
                            <Eyebrow color="gold">{group.label}</Eyebrow>
                          </div>
                          {voiceLines
                            .filter((vl) => String(vl.value).startsWith(group.filter))
                            .map((vl) =>
                              renderBucket(
                                String(vl.value),
                                vl.label || String(vl.value),
                                null,
                              ),
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 pb-4 md:grid-cols-2 xl:grid-cols-4">
                      {requirements.map((req) => {
                        const displayLabel = (
                          req as typeof req & { voice_line_display?: string }
                        ).voice_line_display;
                        return renderBucket(
                          req.voice_line,
                          displayLabel || req.voice_line,
                          req.quantity,
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        {createPortal(
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.38, 1)",
            }}
          >
            {(() => {
              if (!activeDragId) return null;
              const dragArtist = artistMap.get(activeDragId);
              if (!dragArtist) return null;

              return (
                <DraggableArtist
                  participationId={activeDragId}
                  artist={dragArtist}
                  isOverlay={true}
                  casting={localCastings.find(
                    (c) => String(c.participation) === activeDragId,
                  )}
                />
              );
            })()}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );
};
