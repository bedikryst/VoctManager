/**
 * @file ProgramTab.tsx
 * @description The running order and the archive it is drawn from — a picker
 * column beside the work product, the same composition the Obsada tab uses and
 * now the same row language: a flat divided list, a gold ordinal, one line of
 * metadata, and the figure on the right edge.
 * Reordering is a deferred edit committed through the shared `EditorActionBar`;
 * adding, removing and the encore flag write immediately.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/ProgramTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ArrowDownNarrowWide,
  ListOrdered,
  Library,
  Music,
  Search,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  formatEditionLabel,
  getPiecePdfLinks,
} from "@/features/archive/constants/piecePdfs";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import type { SelectOption } from "@/shared/ui/primitives/Select";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import type { ProjectEventKind } from "../../constants/projectDomain";
import { useProgramTab } from "../hooks/useProgramTab";
import { buildPieceMeta } from "../../lib/pieceLabels";
import { DurationCell } from "./components/DurationCell";
import { PickerRow } from "./components/PickerRow";
import { SetlistRow } from "./components/SetlistRow";
import { TabLoadingCard } from "./components/TabLoadingCard";

interface ProgramTabProps {
  projectId: string;
  /** Decides whether the programme is an order of service, and therefore
   *  whether the setlist carries a place in the rite at all. */
  eventKind?: ProjectEventKind;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

const formatTotalDuration = (
  totalSeconds: number,
  t: TFunction,
): string | null => {
  if (totalSeconds <= 0) return null;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return t(
      "projects.program.format.duration_hours",
      "~ {{h}}h {{m}}min muzyki",
      {
        h: hours,
        m: totalMinutes % 60,
      },
    );
  }

  return t("projects.program.format.duration_mins", "~ {{m}} min muzyki", {
    m: totalMinutes,
  });
};

export const ProgramTab = ({
  projectId,
  eventKind,
  onDirtyStateChange,
}: ProgramTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    programItems,
    isLoading,
    isSaving,
    isDirty,
    searchQuery,
    setSearchQuery,
    totalConcertDurationSeconds,
    untimedPieceCount,
    addedPieceIds,
    filteredPieces,
    pieces,
    slotOptions,
    hasLiturgyProblem,
    canSortByLiturgy,
    handleAddPiece,
    handleToggleEncore,
    handleChangeSlot,
    handleChangeEdition,
    handleDeleteItem,
    handleDragEnd,
    handleSortByLiturgy,
    handleCancel,
    handleSaveChanges,
  } = useProgramTab(projectId, eventKind, onDirtyStateChange);

  // The picker's entries carry the server's own words for each moment — the
  // client never names a slot itself, so there is nothing to translate here.
  const slotSelectOptions = React.useMemo<SelectOption[] | undefined>(
    () =>
      slotOptions.length > 0
        ? slotOptions.map((slot) => ({
            value: slot.value,
            label: slot.label,
          }))
        : undefined,
    [slotOptions],
  );

  const pieceById = React.useMemo(
    () => new Map(pieces.map((piece) => [String(piece.id), piece])),
    [pieces],
  );

  /**
   * Which pieces give the producer an arrangement to choose, and what the choice
   * is called. Only a work published more than once has one — a single edition
   * binds itself, and offering a picker with one entry would suggest a decision
   * where there is none.
   *
   * The list arrives from `getPiecePdfLinks` already in the order the server
   * resolves an unpinned item by (default edition first, then most recent), so
   * its head is exactly what auto-selection would bind.
   */
  const editionChoiceByPiece = React.useMemo(() => {
    const choices = new Map<
      string,
      { options: SelectOption[]; autoLabel: string }
    >();

    for (const piece of pieces) {
      const links = getPiecePdfLinks(piece);
      if (links.length < 2) continue;

      choices.set(String(piece.id), {
        options: links.map((link) => ({
          value: link.id,
          label: formatEditionLabel(link),
        })),
        autoLabel: formatEditionLabel(links[0]),
      });
    }

    return choices;
  }, [pieces]);

  const sortableIds = React.useMemo(
    () =>
      programItems.map(
        (item, index) => item.id || `program-item-${item.piece}-${index}`,
      ),
    [programItems],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const totalDurationLabel = formatTotalDuration(
    totalConcertDurationSeconds,
    t,
  );

  if (isLoading) {
    return (
      <TabLoadingCard
        icon={<ListOrdered size={15} aria-hidden="true" />}
        title={t("projects.program.sections.setlist", "Setlista wydarzenia")}
      />
    );
  }

  return (
    <div className="relative grid w-full grid-cols-1 gap-5 pb-24 lg:grid-cols-5 lg:items-start">
      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.program.fab.description",
          "Zmieniono kolejność programu.",
        )}
        onCancel={handleCancel}
        onConfirm={handleSaveChanges}
        isLoading={isSaving}
      />

      {/* ── The running order ─────────────────────────────────────────────── */}
      <SectionCard
        as="h2"
        scroll
        className="max-h-[70dvh] lg:col-span-3"
        bodyClassName="p-0"
        icon={<ListOrdered size={15} aria-hidden="true" />}
        title={t("projects.program.sections.setlist", "Setlista wydarzenia")}
        action={
          /* Offered, never applied on its own: the running order is the
             producer's, and a programme may depart from the rite on purpose.
             The rearrangement lands on the save bar like any other. */
          canSortByLiturgy ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSortByLiturgy}
              leftIcon={<ArrowDownNarrowWide size={14} aria-hidden="true" />}
            >
              {t(
                "projects.program.liturgy.sort_action",
                "Uporządkuj wg liturgii",
              )}
            </Button>
          ) : undefined
        }
        footer={
          programItems.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Eyebrow as="span" color="muted">
                {t("projects.program.footer.pieces", "{{count}} utworów", {
                  count: programItems.length,
                })}
              </Eyebrow>
              {hasLiturgyProblem && (
                <Eyebrow as="span" color="gold">
                  {t(
                    "projects.program.liturgy.out_of_order",
                    "Kolejność odbiega od porządku liturgii",
                  )}
                </Eyebrow>
              )}
              {totalDurationLabel && (
                <span className="inline-flex items-center gap-1.5 text-ethereal-graphite/60">
                  <Music size={12} aria-hidden="true" className="shrink-0" />
                  <Eyebrow as="span" color="inherit">
                    {totalDurationLabel}
                  </Eyebrow>
                </span>
              )}
              {untimedPieceCount > 0 && (
                <Eyebrow as="span" color="gold">
                  {t(
                    "projects.program.footer.untimed",
                    "{{count}} bez podanego czasu",
                    { count: untimedPieceCount },
                  )}
                </Eyebrow>
              )}
            </div>
          ) : undefined
        }
      >
        {programItems.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-hairline">
                {programItems.map((item, index) => {
                  const pieceId = String(item.piece_id || item.piece);
                  const piece = pieceById.get(pieceId);
                  const editionChoice = editionChoiceByPiece.get(pieceId);
                  return (
                    <SetlistRow
                      key={sortableIds[index]}
                      item={item}
                      sortableId={sortableIds[index]}
                      position={index + 1}
                      meta={buildPieceMeta(piece)}
                      durationSeconds={piece?.estimated_duration}
                      slotOptions={slotSelectOptions}
                      onChangeSlot={handleChangeSlot}
                      editionOptions={editionChoice?.options}
                      autoEditionLabel={editionChoice?.autoLabel}
                      onChangeEdition={handleChangeEdition}
                      onToggleEncore={handleToggleEncore}
                      onDelete={handleDeleteItem}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <StatePanel
            variant="inline"
            className="px-5 py-10"
            icon={<Music size={26} aria-hidden="true" />}
            title={t(
              "projects.program.empty.setlist_title",
              "Setlista jest pusta",
            )}
            description={t(
              "projects.program.empty.setlist_desc",
              "Wybierz kompozycje z bazy, aby zbudować program wydarzenia.",
            )}
          />
        )}
      </SectionCard>

      {/* ── The archive to draw from (pinned on desktop) ──────────────────── */}
      <SectionCard
        as="h2"
        scroll
        className="max-h-[70dvh] lg:col-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-9rem)]"
        bodyClassName="p-0 pt-2"
        icon={<Library size={15} aria-hidden="true" />}
        title={t("projects.program.sections.database", "Baza kompozycji")}
        action={<Badge variant="neutral">{filteredPieces.length}</Badge>}
        toolbar={
          <Input
            type="text"
            placeholder={t(
              "projects.program.search.placeholder",
              "Szukaj utworu lub kompozytora...",
            )}
            aria-label={t(
              "projects.program.search.placeholder",
              "Szukaj utworu lub kompozytora...",
            )}
            value={searchQuery || ""}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftIcon={<Search size={16} aria-hidden="true" />}
          />
        }
      >
        {filteredPieces.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {filteredPieces.map((piece, index) => {
              const pieceId = String(piece.id);
              return (
                <PickerRow
                  key={piece.id || `db-piece-${index}`}
                  title={piece.title}
                  meta={buildPieceMeta(piece)}
                  trailing={<DurationCell seconds={piece.estimated_duration} />}
                  isTaken={addedPieceIds.includes(pieceId)}
                  onPick={() => void handleAddPiece(pieceId)}
                  pickLabel={t(
                    "projects.program.actions.add",
                    "Dodaj do programu",
                  )}
                  takenLabel={t(
                    "projects.program.actions.already_added",
                    "Utwór jest już na setliście",
                  )}
                />
              );
            })}
          </ul>
        ) : (
          <StatePanel
            variant="inline"
            className="px-5 py-10"
            icon={<Search size={24} aria-hidden="true" />}
            title={t("projects.program.empty.no_results", "Brak wyników")}
          />
        )}
      </SectionCard>
    </div>
  );
};
