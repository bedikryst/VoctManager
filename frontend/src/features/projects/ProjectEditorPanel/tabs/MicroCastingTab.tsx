/**
 * @file MicroCastingTab.tsx
 * @description Advanced Kanban Board for Divisi and Micro-casting orchestration.
 * Completely delegates complex drag-and-drop state, caching, and optimistic mutations
 * to the useMicroCasting hook. Exclusively handles presentation and DnD routing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/MicroCastingTab
 */

import React from "react";
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
import { getPrimaryReferenceRecording } from "../../../../shared/lib/referenceRecordings";
import { DraggableArtist } from "./components/DraggableArtist";
import { DroppableBucket } from "./components/DroppableBucket";
import { GlassCard } from "../../../../shared/ui/GlassCard";

interface MicroCastingTabProps {
  projectId: string;
}

export default function MicroCastingTab({
  projectId,
}: MicroCastingTabProps): React.JSX.Element {
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
        <div className="flex items-center justify-between mb-3 border-b border-stone-200/50 pb-2">
          <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
            {title}
          </span>
          <div className="flex gap-1.5">
            <span className="text-[9px] font-bold antialiased text-stone-500 bg-white px-2 py-0.5 rounded-md border border-stone-200 shadow-sm">
              {bucketCastings.length}
            </span>
            {requirementCount !== null && deficit !== null && deficit > 0 && (
              <span
                className="text-[9px] font-bold antialiased text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md shadow-sm"
                title={t("projects.micro_cast.status.deficit", "Braki: ")}
              >
                -{deficit}
              </span>
            )}
            {requirementCount !== null && deficit !== null && deficit <= 0 && (
              <span className="text-[9px] font-bold antialiased text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md shadow-sm">
                <CheckCircle2 size={12} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 min-h-[60px]">
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
            <div className="text-center py-4 border-2 border-dashed border-stone-200/60 rounded-xl bg-stone-50/50 opacity-60">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                {requirementCount === null
                  ? t(
                      "projects.micro_cast.empty.section",
                      "Brak przypisań w tej sekcji",
                    )
                  : t("projects.micro_cast.status.free", "Wolny Wakat")}
              </span>
            </div>
          )}
        </div>
      </DroppableBucket>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 h-full flex flex-col">
      <div className="bg-white border border-stone-200/60 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2 mb-2">
            <MicVocal className="text-[#002395]" size={20} aria-hidden="true" />
            {t("projects.micro_cast.header.title", "Divisi i Mikro-Casting")}
          </h2>
          <p className="text-sm text-stone-500">
            {t(
              "projects.micro_cast.header.subtitle",
              "Przeciągaj wokalistów między sekcjami w ramach wybranego utworu.",
            )}
          </p>
        </div>

        <div className="flex-1 max-w-md">
          <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
            {t("projects.micro_cast.select_piece", "Wybierz utwór do castingu")}
          </label>
          <select
            value={selectedPieceId || ""}
            onChange={(e) => setSelectedPieceId(e.target.value)}
            className="w-full px-4 py-3 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold appearance-none cursor-pointer"
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
                  .map((item) => {
                    const piece = pieces.find(
                      (p) => String(p.id) === String(item.piece),
                    );
                    const status = pieceStatuses[String(item.piece)];
                    let statusSymbol = "";
                    if (status === "OK") statusSymbol = " ✓";
                    if (status === "DEFICIT") statusSymbol = " ⚠️";

                    return (
                      <option key={item.id} value={item.piece}>
                        {item.order}. {item.title || piece?.title}
                        {statusSymbol}
                      </option>
                    );
                  })}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Lewy panel - Baza */}
          <GlassCard className="lg:col-span-1 p-5 flex flex-col bg-stone-50/50 h-full border-[#002395]/10">
            <div className="flex items-center justify-between mb-4 border-b border-stone-200/60 pb-3">
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
                <Users
                  size={14}
                  className="text-[#002395]"
                  aria-hidden="true"
                />
                {t(
                  "projects.micro_cast.sections.unassigned",
                  "Nieprzypisani (Baza Osobowa)",
                )}
              </span>
              <span className="text-[9px] font-bold antialiased text-[#002395] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {unassignedParticipations.length}
              </span>
            </div>

            <DroppableBucket
              id="UNASSIGNED"
              title={t(
                "projects.micro_cast.sections.unassigned",
                "Nieprzypisani",
              )}
              className="flex-1 overflow-y-auto [scrollbar-gutter:stable] pr-2 -mr-2"
            >
              <div className="space-y-2">
                {unassignedParticipations.map((part) => {
                  const artist = artistMap.get(String(part.artist));
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
                  <div className="text-center py-8 opacity-50">
                    <CheckCircle2
                      size={32}
                      className="mx-auto mb-2 text-emerald-500"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">
                      {t(
                        "projects.micro_cast.empty.unassigned",
                        "Wszyscy zostali przypisani do ról w tym utworze.",
                      )}
                    </p>
                  </div>
                )}
              </div>
            </DroppableBucket>
          </GlassCard>

          {/* Główny obszar - Sekcje */}
          <GlassCard className="lg:col-span-3 p-6 flex flex-col h-full bg-white/40">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <ListOrdered
                    size={18}
                    className="text-[#002395]"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {selectedPiece?.title ||
                      t("projects.micro_cast.empty.pieces", "Brak utworu")}
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    {selectedPiece?.composer_full_name ||
                      selectedPiece?.composer_name ||
                      ""}
                  </p>
                </div>
              </div>

              {referenceUrl && (
                <a
                  href={referenceUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors border border-[#1DB954]/20 shadow-sm"
                >
                  <PlayCircleIcon size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {t(
                      "projects.micro_cast.buttons.play_reference",
                      "Odtwórz: {{platform}}",
                      { platform: referenceUrl.label },
                    )}
                  </span>
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] pr-2 -mr-2">
              {requirements.length === 0 ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span className="text-xs font-medium">
                      {t(
                        "projects.micro_cast.empty.no_requirements",
                        "Brak zdefiniowanych wymagań głosowych dla tego utworu w bazie repertuarowej. Używamy trybu dowolnego przypisania (Divisi).",
                      )}
                    </span>
                  </div>

                  {VOICE_GROUPS.map((group) => (
                    <div
                      key={group.label}
                      className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                      <h5 className="md:col-span-3 text-[10px] font-bold uppercase tracking-widest text-[#002395] border-b border-stone-200/50 pb-2">
                        {group.label}
                      </h5>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {requirements.map((req) =>
                    renderBucket(
                      req.voice_line,
                      (req as any).voice_line_display || req.voice_line,
                      req.quantity,
                    ),
                  )}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Drag Overlay */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.38, 1)",
            }}
          >
            {activeDragId && artistMap.has(activeDragId) ? (
              <DraggableArtist
                participationId={activeDragId}
                artist={artistMap.get(activeDragId)!}
                isOverlay={true}
                casting={localCastings.find(
                  (c) => String(c.participation) === activeDragId,
                )}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
