/**
 * @file MicroCastingTab.tsx
 * @description The divisi board: the programme as a worklist on the left, the
 * people still to place under it, and the voice lines of the open piece on the
 * right. Drag and drop edits a local draft; mutations only fire on an explicit
 * save through the shared `EditorActionBar`, and switching pieces while the
 * draft is dirty is gated behind a confirmation.
 * The pool stays pinned beside the board rather than under it, so a long piece
 * can be scrolled while the people to place remain a short drag away.
 * Both the pool and every voice line read in the order the Cast tab arranged
 * each section — the board shows the choir as it stands, not as it was dragged.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/MicroCastingTab
 */

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Info,
  ListChecks,
  ListOrdered,
  MicVocal,
  PlayCircleIcon,
  Search,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import type { PieceCasting, Project } from "@/shared/types";

import { useMicroCasting, type CastMember } from "../hooks/useMicroCasting";
import { PROJECT_STATUS } from "../../constants/projectDomain";
import { byCastOrder } from "../../lib/castOrder";
import {
  VOICE_FAMILY_ORDER,
  voiceFamilyOf,
  voiceFamilyRank,
  type VoiceFamilyId,
} from "../../lib/voiceFamilies";
import { foldDiacritics } from "@/shared/lib/text";
import { getPrimaryReferenceRecording } from "@/features/archive/constants/referenceRecordings";
import { CastMemberChip } from "./components/CastMemberChip";
import { DivisiBucket } from "./components/DivisiBucket";
import { DroppableBucket } from "./components/DroppableBucket";
import {
  ProgramCastingRail,
  type ProgramCastingRailItem,
} from "./components/ProgramCastingRail";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { TabLoadingCard } from "./components/TabLoadingCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

interface MicroCastingTabProps {
  readonly project: Project;
  readonly onDirtyStateChange?: (isDirty: boolean) => void;
}

interface PoolGroup {
  readonly key: string;
  readonly label: string;
  readonly members: CastMember[];
}

/** Below this the pool is one glance and a search field is just another control. */
const POOL_SEARCH_THRESHOLD = 6;

export const MicroCastingTab = ({
  project,
  onDirtyStateChange,
}: MicroCastingTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const projectId = String(project.id);

  // Before publication nobody has been asked anything, so an answer state on
  // every chip would state the default forty times over.
  const isDraft = project.status === PROJECT_STATUS.DRAFT;
  const showAnswerState = !isDraft;

  const {
    program,
    voiceLines,
    pieces,
    selectedPieceId,
    selectedRequirements: requirements,
    localCastings,
    activeDragId,
    members,
    memberMap,
    pieceProgress,
    isLoading,
    isDirty,
    isSaving,
    pendingCounts,
    pieceFill,
    programFill,
    fillPieceFromLineUp,
    fillProgramFromLineUp,
    pendingPieceSwitch,
    requestSelectPiece,
    confirmPieceSwitch,
    cancelPieceSwitch,
    handleUpdateNote,
    handleTogglePitch,
    handleDragStart,
    handleDragEnd,
    saveChanges,
    discardChanges,
  } = useMicroCasting(projectId);

  const [poolQuery, setPoolQuery] = useState<string>("");
  const [isProgramFillOpen, setIsProgramFillOpen] = useState(false);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  // Split mouse and touch into separate sensors so each gets the activation
  // constraint its input model needs. A single PointerSensor cannot both let a
  // finger scroll the list AND pick up a card — on touch the browser claims the
  // gesture as a scroll before dnd-kit ever activates.
  // - Mouse: drag after an 8px move (small enough that note-button clicks still register).
  // - Touch: press-and-hold ~180ms to lift; a quick swipe (>8px before the delay)
  //   stays a scroll. Once the drag is live, dnd-kit preventDefaults touchmove,
  //   so the page no longer scrolls underneath the card being dragged.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedPiece = pieces.find((p) => String(p.id) === selectedPieceId);
  const referenceUrl = selectedPiece
    ? getPrimaryReferenceRecording(selectedPiece)
    : null;
  const progress = selectedPieceId ? pieceProgress[selectedPieceId] : undefined;

  const handleFillPiece = (): void => {
    const result = fillPieceFromLineUp();
    toast.success(
      t("projects.micro_cast.toast.fill_piece", "Obsadzono ze składu", {
        count: result.seats.length,
      }),
      {
        description:
          result.skipped.length > 0
            ? t(
                "projects.micro_cast.toast.fill_skipped",
                "Bez jednoznacznej linii: {{count}} — ustaw ich miejsce w składzie na zakładce Obsada.",
                { count: result.skipped.length },
              )
            : undefined,
      },
    );
  };

  const handleFillProgram = async (): Promise<void> => {
    const plan = await fillProgramFromLineUp();
    setIsProgramFillOpen(false);
    if (!plan) return;

    toast.success(
      t("projects.micro_cast.toast.fill_program", "Program obsadzony", {
        count: plan.pieces,
      }),
      {
        description: t(
          "projects.micro_cast.toast.fill_program_desc",
          "Nowe miejsca: {{seats}}.",
          { seats: plan.seats },
        ),
      },
    );
  };

  // Priced before it is offered, and stated as a ledger rather than a sentence:
  // two counts that both need Polish agreement read worse than they count.
  const programFillDescription = [
    t(
      "projects.micro_cast.program_fill.summary",
      "Nowe miejsca: {{seats}} · Utwory: {{pieces}}. Wyliczone ze składu wydarzenia; miejsca już obsadzone zostają bez zmian.",
      { seats: programFill.seats, pieces: programFill.pieces },
    ),
    programFill.unresolved > 0
      ? t(
          "projects.micro_cast.program_fill.unresolved",
          "Bez jednoznacznej linii: {{count}} — te osoby zostaną pominięte.",
          { count: programFill.unresolved },
        )
      : "",
    !isDraft
      ? t(
          "projects.micro_cast.program_fill.announced",
          "Projekt nie jest już szkicem — obsada trafi do kolejki ogłoszeń.",
        )
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const railItems = useMemo<ProgramCastingRailItem[]>(
    () =>
      [...program]
        .sort((a, b) => a.order - b.order)
        .map((item, index) => {
          const pieceId = String(item.piece);
          const piece = pieces.find((p) => String(p.id) === pieceId);
          return {
            pieceId,
            position: index + 1,
            title: item.piece_title || piece?.title || "",
            progress: pieceProgress[pieceId] ?? {
              required: 0,
              filled: 0,
              missing: 0,
              hasRequirements: false,
            },
          };
        }),
    [program, pieces, pieceProgress],
  );

  // Keep divisi lines of the same family adjacent (S1, S2, A1, A2, …) instead of
  // letting the raw requirement order scatter them across the grid.
  const sortedRequirements = useMemo(
    () =>
      [...requirements].sort((left, right) => {
        const rankDelta =
          voiceFamilyRank(left.voice_line) - voiceFamilyRank(right.voice_line);
        if (rankDelta !== 0) return rankDelta;
        return left.voice_line.localeCompare(right.voice_line, undefined, {
          numeric: true,
        });
      }),
    [requirements],
  );

  const assignedIds = useMemo(
    () =>
      new Set(localCastings.map((casting) => String(casting.participation))),
    [localCastings],
  );

  const unassignedMembers = useMemo(
    () => members.filter((member) => !assignedIds.has(member.participationId)),
    [members, assignedIds],
  );

  const poolGroups = useMemo<PoolGroup[]>(() => {
    const needle = foldDiacritics(poolQuery.trim());
    const visible = needle
      ? unassignedMembers.filter((member) =>
          foldDiacritics(member.displayName).includes(needle),
        )
      : unassignedMembers;

    const unknownVoice = t(
      "projects.micro_cast.voices.unknown",
      "Głos nieokreślony",
    );

    // `members` already arrives in the order the Cast tab arranged it, so a
    // sequential walk is the whole grouping.
    return visible.reduce<PoolGroup[]>((groups, member) => {
      const key = member.voiceType ?? "UNKNOWN";
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.members.push(member);
        return groups;
      }
      groups.push({
        key,
        label: member.voiceLabel || unknownVoice,
        members: [member],
      });
      return groups;
    }, []);
  }, [unassignedMembers, poolQuery, t]);

  const freeModeGroups = useMemo(
    () =>
      VOICE_FAMILY_ORDER.map((family) => ({
        family,
        lines: voiceLines.filter(
          (line) => voiceFamilyOf(String(line.value)) === family,
        ),
      })).filter((group) => group.lines.length > 0),
    [voiceLines],
  );

  const familyLabels: Record<VoiceFamilyId, string> = {
    S: t("projects.micro_cast.voices.sopranos", "Soprany"),
    A: t("projects.micro_cast.voices.altos", "Alty"),
    T: t("projects.micro_cast.voices.tenors", "Tenory"),
    B: t("projects.micro_cast.voices.basses", "Basy"),
    V: t("projects.micro_cast.voices.untyped", "Głosy nieokreślone"),
    ROLE: t("projects.micro_cast.voices.special", "Linie specjalne"),
  };

  /**
   * One voice line's seats, read top to bottom in the order the Cast tab
   * arranged the section — the same order the singers see in their songbook and
   * on the printed sheet. Without it a line listed people in the order they were
   * dragged onto it, which is the order of the conductor's afternoon rather than
   * anything about the choir.
   *
   * A seat whose member is missing keeps its place: `DivisiBucket` drops those
   * rows, and sorting them to the end here would only move a hole around.
   */
  const castingsFor = (voiceLine: string): PieceCasting[] =>
    localCastings
      .filter((casting) => casting.voice_line === voiceLine)
      .sort((left, right) => {
        const leftMember = memberMap.get(String(left.participation));
        const rightMember = memberMap.get(String(right.participation));
        if (!leftMember || !rightMember) return 0;
        return byCastOrder(leftMember, rightMember);
      });

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

  if (isLoading) {
    return (
      <TabLoadingCard
        icon={<MicVocal size={15} aria-hidden="true" />}
        title={t("projects.micro_cast.board.title", "Obsada utworu")}
      />
    );
  }

  if (program.length === 0) {
    return (
      <SectionCard
        as="h2"
        icon={<MicVocal size={15} aria-hidden="true" />}
        title={t("projects.micro_cast.board.title", "Obsada utworu")}
      >
        <StatePanel
          variant="inline"
          className="py-10"
          icon={<ListOrdered size={24} aria-hidden="true" />}
          title={t("projects.micro_cast.empty.pieces", "Program jest pusty")}
          description={t(
            "projects.micro_cast.empty.pieces_desc",
            "Divisi rozdziela głosy w konkretnym utworze — najpierw ułóż program.",
          )}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="../program">
                {t("projects.micro_cast.empty.pieces_action", "Otwórz program")}
              </Link>
            </Button>
          }
        />
      </SectionCard>
    );
  }

  const composer = selectedPiece?.composer;
  const composerLabel = composer
    ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
    : "";

  return (
    <div className="flex w-full flex-col pb-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <StaggeredBentoContainer className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* ── Programme + the people still to place ─────────────────────── */}
          <StaggeredBentoItem className="col-span-1 flex flex-col gap-6 lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3">
            <ProgramCastingRail
              items={railItems}
              selectedPieceId={selectedPieceId}
              onSelect={requestSelectPiece}
            />

            <SectionCard
              as="h2"
              scroll
              className="max-h-[42dvh]"
              bodyClassName="p-0"
              icon={<Users size={15} aria-hidden="true" />}
              title={t(
                "projects.micro_cast.sections.unassigned",
                "Nieprzypisani",
              )}
              action={
                <Badge variant="neutral">{unassignedMembers.length}</Badge>
              }
              toolbar={
                unassignedMembers.length > POOL_SEARCH_THRESHOLD ? (
                  <Input
                    type="text"
                    value={poolQuery}
                    onChange={(event) => setPoolQuery(event.target.value)}
                    leftIcon={<Search size={16} aria-hidden="true" />}
                    placeholder={t(
                      "projects.micro_cast.search.placeholder",
                      "Szukaj osoby...",
                    )}
                    aria-label={t(
                      "projects.micro_cast.search.placeholder",
                      "Szukaj osoby...",
                    )}
                  />
                ) : undefined
              }
            >
              <DroppableBucket
                id="UNASSIGNED"
                title={t(
                  "projects.micro_cast.sections.unassigned",
                  "Nieprzypisani",
                )}
                className="min-h-full"
              >
                {poolGroups.map((group) => (
                  <section key={group.key}>
                    <div className="sticky top-0 z-10 border-b border-hairline bg-ethereal-alabaster/92 px-4 py-1.5 backdrop-blur-sm">
                      <Eyebrow size="overline-sm" color="muted">
                        {group.label}
                      </Eyebrow>
                    </div>
                    <div className="flex flex-col gap-1.5 px-3 py-2.5">
                      {group.members.map((member) => (
                        <CastMemberChip
                          key={member.participationId}
                          member={member}
                          showAnswerState={showAnswerState}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {poolGroups.length === 0 && (
                  <StatePanel
                    variant="inline"
                    className="px-5 py-8"
                    icon={<Users size={22} aria-hidden="true" />}
                    title={
                      poolQuery.trim()
                        ? t(
                            "projects.micro_cast.empty.no_matches",
                            "Brak wyników",
                          )
                        : t(
                            "projects.micro_cast.empty.unassigned",
                            "Wszyscy są przypisani",
                          )
                    }
                  />
                )}
              </DroppableBucket>
            </SectionCard>
          </StaggeredBentoItem>

          {/* ── The open piece ────────────────────────────────────────────── */}
          <StaggeredBentoItem className="col-span-1 lg:col-span-8 xl:col-span-9">
            <SectionCard
              as="h2"
              scroll
              className="max-h-[78dvh]"
              icon={<MicVocal size={15} aria-hidden="true" />}
              title={t("projects.micro_cast.board.title", "Obsada utworu")}
              action={
                progress?.hasRequirements ? (
                  <div className="flex items-baseline gap-2">
                    <Eyebrow size="overline-sm" color="muted">
                      {t("projects.micro_cast.board.cast_label", "Obsadzone")}
                    </Eyebrow>
                    <Text
                      as="span"
                      size="base"
                      weight="medium"
                      color={progress.missing === 0 ? "sage" : "gold"}
                      className="tabular-nums"
                    >
                      {progress.filled}/{progress.required}
                    </Text>
                  </div>
                ) : (
                  <Badge variant="neutral">
                    {t("projects.micro_cast.board.free_mode", "Tryb dowolny")}
                  </Badge>
                )
              }
              toolbar={
                selectedPiece ? (
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
                    <div className="min-w-0">
                      <Heading as="h3" size="lg" weight="normal" truncate>
                        {selectedPiece.title}
                      </Heading>
                      {composerLabel && (
                        <Eyebrow
                          size="overline-sm"
                          color="muted"
                          className="mt-1 block"
                        >
                          {composerLabel}
                        </Eyebrow>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Wand2 size={12} aria-hidden="true" />}
                        onClick={handleFillPiece}
                        disabled={pieceFill.seats.length === 0 || isSaving}
                        title={t(
                          "projects.micro_cast.buttons.fill_piece_hint",
                          "Sadza każdego wolnego śpiewaka na jego linii ze składu wydarzenia. Pomija tych, dla których wybór nie jest jednoznaczny.",
                        )}
                      >
                        {t(
                          "projects.micro_cast.buttons.fill_piece",
                          "Uzupełnij ten utwór",
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<ListChecks size={12} aria-hidden="true" />}
                        onClick={() => setIsProgramFillOpen(true)}
                        disabled={programFill.seats === 0 || isDirty || isSaving}
                        title={
                          isDirty
                            ? t(
                                "projects.micro_cast.buttons.fill_program_dirty",
                                "Najpierw zapisz lub odrzuć zmiany w tym utworze.",
                              )
                            : t(
                                "projects.micro_cast.buttons.fill_program_hint",
                                "Ta sama reguła zastosowana do każdego utworu w programie.",
                              )
                        }
                      >
                        {t(
                          "projects.micro_cast.buttons.fill_program",
                          "Uzupełnij program",
                        )}
                      </Button>
                      {referenceUrl && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
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
                  </div>
                ) : undefined
              }
            >
              {requirements.length === 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-nested border border-hairline bg-ethereal-alabaster/60 px-3 py-2">
                    <Info
                      size={14}
                      className="shrink-0 text-ethereal-graphite/40"
                      aria-hidden="true"
                    />
                    <Caption color="muted" className="min-w-0 flex-1">
                      {t(
                        "projects.micro_cast.board.free_mode_hint",
                        "Ten utwór nie ma zapisanych wymagań głosowych — przypisz śpiewaków do dowolnych linii.",
                      )}
                    </Caption>
                    {selectedPieceId && (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to={`/panel/archive-management/${selectedPieceId}`}
                        >
                          {t(
                            "projects.micro_cast.board.define_requirements",
                            "Uzupełnij wymagania",
                          )}
                        </Link>
                      </Button>
                    )}
                  </div>

                  {freeModeGroups.map((group) => (
                    <section key={group.family} className="flex flex-col gap-3">
                      <div className="border-b border-hairline-strong pb-1.5">
                        <Eyebrow color="gold">
                          {familyLabels[group.family]}
                        </Eyebrow>
                      </div>
                      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.lines.map((line) => (
                          <DivisiBucket
                            key={String(line.value)}
                            voiceLine={String(line.value)}
                            title={line.label || String(line.value)}
                            requirement={null}
                            castings={castingsFor(String(line.value))}
                            memberMap={memberMap}
                            showAnswerState={showAnswerState}
                            onUpdateNote={handleUpdateNote}
                            onTogglePitch={handleTogglePitch}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sortedRequirements.map((requirement) => (
                    <DivisiBucket
                      key={requirement.voice_line}
                      voiceLine={requirement.voice_line}
                      title={
                        requirement.voice_line_display || requirement.voice_line
                      }
                      requirement={requirement.quantity}
                      castings={castingsFor(requirement.voice_line)}
                      memberMap={memberMap}
                      showAnswerState={showAnswerState}
                      onUpdateNote={handleUpdateNote}
                      onTogglePitch={handleTogglePitch}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
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
              const dragged = memberMap.get(activeDragId);
              if (!dragged) return null;

              return (
                <CastMemberChip
                  member={dragged}
                  isOverlay
                  casting={localCastings.find(
                    (casting) => String(casting.participation) === activeDragId,
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
          "Casting utworu: {{piece}}",
          { piece: selectedPiece?.title ?? "" },
        )}
        metrics={pendingMetrics.length > 0 ? <>{pendingMetrics}</> : undefined}
        onCancel={discardChanges}
        onConfirm={saveChanges}
        cancelText={t("common.actions.discard", "Odrzuć")}
        confirmText={t("projects.micro_cast.action_bar.save", "Zapisz casting")}
        isLoading={isSaving}
      />

      <ConfirmModal
        isOpen={isProgramFillOpen}
        title={t(
          "projects.micro_cast.program_fill.title",
          "Uzupełnić obsadę całego programu?",
        )}
        description={programFillDescription}
        confirmText={t("projects.micro_cast.program_fill.confirm", "Uzupełnij")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        onConfirm={() => void handleFillProgram()}
        onCancel={() => setIsProgramFillOpen(false)}
        isLoading={isSaving}
        isDestructive={false}
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
