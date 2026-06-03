/**
 * @file MicroCastingTab.tsx
 * @description Divisi & micro-casting Kanban with deferred persistence.
 * Drag and drop edits a local draft. Mutations only fire on explicit Save through
 * the shared `EditorActionBar`. Piece-switching is gated behind a confirmation
 * dialog whenever the draft is dirty.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/MicroCastingTab
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  AlertCircle,
  CheckCircle2,
  Users,
  PlayCircleIcon,
  ListOrdered,
} from "lucide-react";

import type { VoiceRequirement } from "@/shared/types";

import { useMicroCasting } from "../hooks/useMicroCasting";
import { getPrimaryReferenceRecording } from "@/features/archive/constants/referenceRecordings";
import { DraggableArtist } from "./components/DraggableArtist";
import { DroppableBucket } from "./components/DroppableBucket";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { cn } from "@/shared/lib/utils";

interface MicroCastingTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

export const MicroCastingTab = ({
  projectId,
  onDirtyStateChange,
}: MicroCastingTabProps): React.JSX.Element => {
  const { t } = useTranslation();

  const VOICE_GROUPS = [
    { label: t("projects.micro_cast.voices.sopranos", "Soprany"), filter: "S" },
    {
      label: t("projects.micro_cast.voices.mezzos", "Mezzosoprany"),
      filter: "M",
    },
    { label: t("projects.micro_cast.voices.altos", "Alty"), filter: "A" },
    {
      label: t("projects.micro_cast.voices.countertenors", "Kontratenory"),
      filter: "C",
    },
    { label: t("projects.micro_cast.voices.tenors", "Tenory"), filter: "T" },
    {
      label: t("projects.micro_cast.voices.baritones", "Barytony"),
      filter: "BAR",
    },
    { label: t("projects.micro_cast.voices.basses", "Basy"), filter: "B" },
  ];

  const {
    program,
    voiceLines,
    pieces,
    selectedPieceId,
    localCastings,
    activeDragId,
    artistMap,
    participationStatusMap,
    pieceStatuses,
    projectParticipations,
    isDirty,
    isSaving,
    pendingCounts,
    pendingPieceSwitch,
    requestSelectPiece,
    confirmPieceSwitch,
    cancelPieceSwitch,
    handleUpdateNote,
    handleDragStart,
    handleDragEnd,
    saveChanges,
    discardChanges,
  } = useMicroCasting(projectId);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

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
  const requirements: VoiceRequirement[] =
    selectedPiece?.voice_requirements_read || [];

  // Keep divisi lines of the same voice family adjacent (S1, S2, A1, A2, …)
  // instead of letting the raw requirement order scatter them across the grid.
  const familyRank = (voiceLine: string): number => {
    const upper = voiceLine.toUpperCase();
    const index = VOICE_GROUPS.findIndex((group) =>
      upper.startsWith(group.filter),
    );
    return index === -1 ? VOICE_GROUPS.length : index;
  };
  const sortedRequirements = [...requirements].sort((left, right) => {
    const rankDelta = familyRank(left.voice_line) - familyRank(right.voice_line);
    if (rankDelta !== 0) return rankDelta;
    return left.voice_line.localeCompare(right.voice_line, undefined, {
      numeric: true,
    });
  });

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

    const filled = bucketCastings.length;
    const isExact = deficit !== null && deficit === 0;
    const isOver = deficit !== null && deficit < 0;
    const hasDeficit = deficit !== null && deficit > 0;

    return (
      <DroppableBucket key={bucketId} id={bucketId} title={title}>
        <div
          className={cn(
            "flex h-full flex-col gap-1.5 rounded-2xl border p-2.5 transition-colors",
            hasDeficit
              ? "border-ethereal-crimson/20 bg-ethereal-crimson/3"
              : isOver
                ? "border-ethereal-gold/30 bg-ethereal-gold/5"
                : isExact
                  ? "border-ethereal-sage/25 bg-ethereal-sage/4"
                  : "border-ethereal-ink/6 bg-ethereal-alabaster/50",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-ethereal-ink">
              {title}
            </span>
            {requirementCount !== null ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 text-[11px] font-bold tabular-nums",
                  isExact
                    ? "text-ethereal-sage"
                    : isOver
                      ? "text-ethereal-gold"
                      : "text-ethereal-crimson",
                )}
              >
                {isExact && <CheckCircle2 size={12} aria-hidden="true" />}
                {filled}/{requirementCount}
              </span>
            ) : (
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-ethereal-graphite/55">
                {filled}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            {bucketCastings.map((casting) => {
              const artist = artistMap.get(String(casting.participation));
              if (!artist) return null;
              return (
                <DraggableArtist
                  key={casting.id}
                  participationId={String(casting.participation)}
                  artist={artist}
                  participationStatus={participationStatusMap.get(
                    String(casting.participation),
                  )}
                  casting={casting}
                  onUpdateNote={handleUpdateNote}
                />
              );
            })}

            {hasDeficit && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-ethereal-crimson/20 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-ethereal-crimson/45">
                {t("projects.micro_cast.status.drop_here", "Upuść tu")}
              </div>
            )}

            {filled === 0 && requirementCount === null && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-ethereal-ink/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-ethereal-graphite/35">
                {t("projects.micro_cast.status.free", "Wolny wakat")}
              </div>
            )}
          </div>
        </div>
      </DroppableBucket>
    );
  };

  const pendingMetrics: React.ReactNode[] = [];
  if (pendingCounts.creates > 0) {
    pendingMetrics.push(
      <Badge key="creates" variant="success">
        +{pendingCounts.creates}
      </Badge>,
    );
  }
  if (pendingCounts.updates > 0) {
    pendingMetrics.push(
      <Badge key="updates" variant="warning">
        ~{pendingCounts.updates}
      </Badge>,
    );
  }
  if (pendingCounts.deletes > 0) {
    pendingMetrics.push(
      <Badge key="deletes" variant="danger">
        −{pendingCounts.deletes}
      </Badge>,
    );
  }

  return (
    <div className="flex w-full flex-col pb-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <StaggeredBentoContainer className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT SIDEBAR — Piece selector + Unassigned pool */}
          <StaggeredBentoItem className="col-span-1 flex flex-col gap-6 lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6">
            <GlassCard
              variant="solid"
              padding="md"
              isHoverable={false}
              className="flex shrink-0 flex-col gap-4"
            >
              <div className="flex items-center gap-2">
                <ListOrdered
                  size={14}
                  className="text-ethereal-gold"
                  aria-hidden="true"
                />
                <Eyebrow color="muted">
                  {t(
                    "projects.micro_cast.label.pieces_in_program",
                    "Utwory w programie",
                  )}
                </Eyebrow>
              </div>

              <Select
                aria-label={t(
                  "projects.micro_cast.select_piece",
                  "Wybierz utwór z programu",
                )}
                value={selectedPieceId || ""}
                onChange={(event) => requestSelectPiece(event.target.value)}
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
                          optionColorClass =
                            "font-bold text-ethereal-crimson";

                        return (
                          <option
                            key={
                              item.id ||
                              `microcast-opt-${item.piece}-${index}`
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

              {selectedPiece && (() => {
                const composer = selectedPiece.composer;
                const composerLabel = composer
                  ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
                  : "";
                return (
                  <div className="flex flex-col items-start gap-2 border-t border-ethereal-incense/15 pt-3">
                    <div className="flex flex-col gap-1">
                      <Text size="sm" weight="bold" className="truncate">
                        {selectedPiece.title}
                      </Text>
                      {composerLabel && (
                        <Eyebrow color="muted">{composerLabel}</Eyebrow>
                      )}
                    </div>
                    {referenceUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-ethereal-sage/30 text-ethereal-sage hover:border-ethereal-sage/50 hover:text-ethereal-sage"
                        leftIcon={
                          <PlayCircleIcon size={12} aria-hidden="true" />
                        }
                      >
                        <a
                          href={referenceUrl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t(
                            "projects.micro_cast.buttons.play_reference",
                            "Odtwórz: {{platform}}",
                            { platform: referenceUrl.label },
                          )}
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })()}
            </GlassCard>

            <GlassCard
              variant="solid"
              padding="md"
              isHoverable={false}
              className="flex max-h-[55dvh] flex-col overflow-hidden border-ethereal-gold/20"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-4 flex flex-none items-center justify-between border-b border-ethereal-incense/15 pb-3">
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
                  <Badge variant="neutral">
                    {unassignedParticipations.length}
                  </Badge>
                </div>

                <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  <DroppableBucket
                    id="UNASSIGNED"
                    title={t(
                      "projects.micro_cast.sections.unassigned",
                      "Nieprzypisani",
                    )}
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
                            participationStatus={participationStatusMap.get(
                              String(part.id),
                            )}
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
              </div>
            </GlassCard>
          </StaggeredBentoItem>

          {/* MAIN — Casting buckets */}
          <StaggeredBentoItem className="col-span-1 flex flex-col lg:col-span-8 xl:col-span-9">
            <GlassCard
              variant="solid"
              padding="md"
              isHoverable={false}
              className="flex max-h-[78dvh] flex-col overflow-hidden"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  {requirements.length === 0 ? (
                    <div className="space-y-6 pb-4">
                      <GlassCard
                        variant="outline"
                        padding="sm"
                        isHoverable={false}
                        className="mb-6 flex items-center gap-2 border-ethereal-gold/30 bg-ethereal-gold/10"
                      >
                        <AlertCircle
                          size={16}
                          className="shrink-0 text-ethereal-gold"
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
                          className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4"
                        >
                          <div className="border-b border-ethereal-ink/8 pb-1.5 md:col-span-2 xl:col-span-4">
                            <Eyebrow color="gold">{group.label}</Eyebrow>
                          </div>
                          {voiceLines
                            .filter((vl) =>
                              String(vl.value).startsWith(group.filter),
                            )
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
                    <div className="grid grid-cols-1 items-start gap-3 pb-4 md:grid-cols-2 xl:grid-cols-4">
                      {sortedRequirements.map((req) => {
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

      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.micro_cast.action_bar.description",
          "Przeciągnięto {{count}} zmian. Zapisz, aby zsynchronizować obsadę.",
          { count: pendingCounts.total },
        )}
        metrics={pendingMetrics.length > 0 ? <>{pendingMetrics}</> : undefined}
        onCancel={discardChanges}
        onConfirm={saveChanges}
        cancelText={t("common.actions.discard", "Odrzuć")}
        confirmText={t(
          "projects.micro_cast.action_bar.save",
          "Zapisz casting",
        )}
        isLoading={isSaving}
      />

      <ConfirmModal
        isOpen={pendingPieceSwitch !== null}
        title={t(
          "projects.micro_cast.piece_switch.title",
          "Niezapisane zmiany castingu",
        )}
        description={t(
          "projects.micro_cast.piece_switch.description",
          "Przełączenie utworu odrzuci wszystkie niezapisane przypisania w tej sekcji. Czy chcesz kontynuować?",
        )}
        confirmText={t(
          "projects.micro_cast.piece_switch.discard",
          "Odrzuć i przełącz",
        )}
        cancelText={t("common.actions.cancel", "Anuluj")}
        onConfirm={confirmPieceSwitch}
        onCancel={cancelPieceSwitch}
        isDestructive
      />
    </div>
  );
};
