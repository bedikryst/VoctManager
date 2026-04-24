/**
 * @file ProgramTab.tsx
 * @description Setlist Builder with Drag & Drop Reordering and Database search.
 * Implements @dnd-kit for strict accessibility and a Unified Floating Action Bar (FAB).
 * Delegates state and network mutations entirely to useProgramTab.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/ProgramTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListOrdered,
  GripVertical,
  Trash2,
  Save,
  Search,
  Plus,
  CheckCircle2,
  Star,
  Clock,
  Music,
  MicVocal,
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Piece } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useProgramTab } from "../hooks/useProgramTab";
import type { ProgramTabItem } from "../types";

interface ProgramTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

const formatTotalDuration = (
  totalSeconds: number | null | undefined,
  t: TFunction,
): string | null => {
  if (!totalSeconds || totalSeconds === 0) return null;
  const m = Math.floor(totalSeconds / 60);
  const h = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (h > 0)
    return t(
      "projects.program.format.duration_hours",
      "~ {{h}}h {{m}}min muzyki",
      {
        h,
        m: remainingMins,
      },
    );
  return t("projects.program.format.duration_mins", "~ {{m}} min muzyki", {
    m,
  });
};

const formatPieceDuration = (
  totalSeconds: number | null | undefined,
  t: TFunction,
): string | null => {
  if (!totalSeconds) return null;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const minStr =
    m > 0
      ? t("projects.program.format.minutes", "{{m}} min").replace(
          "{{m}}",
          String(m),
        )
      : "";
  const secStr =
    s > 0
      ? t("projects.program.format.seconds", "{{s}} sek").replace(
          "{{s}}",
          String(s),
        )
      : "";
  return `${minStr} ${secStr}`.trim();
};

interface SortablePieceItemProps {
  item: ProgramTabItem;
  index: number;
  pieceObj?: Piece;
  onToggleEncore: (item: ProgramTabItem) => void;
  onDelete: (id: string) => void;
  t: TFunction;
}

function SortablePieceItem({
  item,
  index,
  pieceObj,
  onToggleEncore,
  onDelete,
  t,
}: SortablePieceItemProps): React.JSX.Element {
  const safeId = item.id || `program-item-${item.piece}-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: safeId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className={`group relative flex items-center justify-between overflow-hidden transition-colors hover:border-ethereal-gold/40 ${
          isDragging
            ? "shadow-glass-ethereal-hover ring-2 ring-ethereal-gold/30 scale-[1.02]"
            : ""
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex w-full cursor-grab items-center gap-4 p-4 outline-none active:cursor-grabbing"
          aria-label={t(
            "projects.program.actions.drag_aria",
            "Przeciągnij utwór {{title}}",
            { title: item.piece_title },
          )}
        >
          <GripVertical
            size={16}
            className="shrink-0 text-ethereal-graphite/30 transition-colors group-hover:text-ethereal-gold"
            aria-hidden="true"
          />
          <GlassCard
            variant="light"
            padding="none"
            isHoverable={false}
            className="flex h-8 w-8 shrink-0 items-center justify-center"
          >
            <Text size="xs" weight="bold" color="gold">
              {index + 1}
            </Text>
          </GlassCard>

          <div className="flex min-w-0 flex-col">
            <Text
              size="sm"
              weight="bold"
              color={item.is_encore ? "gold" : "default"}
              truncate
              className={item.is_encore ? "italic" : ""}
            >
              {item.piece_title}
            </Text>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {pieceObj?.voicing && (
                <Badge variant="neutral" icon={<MicVocal size={10} />}>
                  {pieceObj.voicing}
                </Badge>
              )}
              {pieceObj?.estimated_duration && (
                <Badge variant="neutral" icon={<Clock size={10} />}>
                  {formatPieceDuration(pieceObj.estimated_duration, t)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-1.5 self-stretch border-l border-ethereal-incense/20 bg-ethereal-marble/50 px-4 backdrop-blur-sm">
          <Button
            type="button"
            variant={item.is_encore ? "secondary" : "icon"}
            size="sm"
            onClick={() => onToggleEncore(item)}
            leftIcon={
              <Star
                size={14}
                className={item.is_encore ? "fill-ethereal-gold" : ""}
                aria-hidden="true"
              />
            }
            title={
              item.is_encore
                ? t("projects.program.actions.remove_encore", "Usuń jako BIS")
                : t("projects.program.actions.add_encore", "Oznacz jako BIS")
            }
          >
            {item.is_encore ? t("projects.program.badges.encore", "BIS") : ""}
          </Button>
          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={() => onDelete(safeId)}
            title={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
            aria-label={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

export const ProgramTab = ({
  projectId,
  onDirtyStateChange,
}: ProgramTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    programItems,
    isSaving,
    isDirty,
    searchQuery,
    setSearchQuery,
    totalConcertDurationSeconds,
    addedPieceIds,
    filteredPieces,
    pieces,
    handleAddPiece,
    handleToggleEncore,
    handleDeleteItem,
    handleDragEnd,
    handleCancel,
    handleSaveChanges,
  } = useProgramTab(projectId, onDirtyStateChange);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 pb-24 lg:grid-cols-5">
      <AnimatePresence>
        {isDirty && (
          <motion.div
            key="fab-menu"
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-(--z-toast) w-[90%] max-w-md md:bottom-10"
          >
            <GlassCard
              variant="solid"
              padding="sm"
              isHoverable={false}
              className="flex items-center justify-between gap-4 rounded-2xl"
            >
              <div className="ml-2 flex flex-col">
                <Eyebrow color="gold">
                  {t("projects.program.fab.unsaved", "Niezapisane Zmiany")}
                </Eyebrow>
                <Text size="xs" color="muted">
                  {t(
                    "projects.program.fab.description",
                    "Zmodyfikowałeś kolejność programu.",
                  )}
                </Text>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  {t("common.actions.cancel", "Anuluj")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  isLoading={isSaving}
                  leftIcon={
                    !isSaving ? (
                      <Save size={16} aria-hidden="true" />
                    ) : undefined
                  }
                >
                  {t("common.actions.save", "Zapisz")}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:col-span-3">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-ethereal-incense/20 pb-4 sm:flex-row sm:items-end">
          <div className="flex items-center gap-2.5">
            <ListOrdered
              size={16}
              className="text-ethereal-gold"
              aria-hidden="true"
            />
            <Eyebrow color="default">
              {t("projects.program.sections.setlist", "Setlista Wydarzenia")}
            </Eyebrow>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {t("projects.program.badges.tracks_count", "Utworów: {{count}}", {
                count: programItems.length,
              })}
            </Badge>
            {totalConcertDurationSeconds > 0 && (
              <Badge variant="warning" icon={<Clock size={12} />}>
                {formatTotalDuration(totalConcertDurationSeconds, t)}
              </Badge>
            )}
          </div>
        </div>

        {programItems.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={programItems.map(
                (item, index) =>
                  item.id || `program-item-${item.piece}-${index}`,
              )}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {programItems.map((item, index) => {
                  const pieceObj = pieces.find(
                    (p) => String(p.id) === String(item.piece_id || item.piece),
                  );
                  const safeId =
                    item.id || `program-item-${item.piece}-${index}`;
                  return (
                    <SortablePieceItem
                      key={safeId}
                      item={item}
                      index={index}
                      pieceObj={pieceObj}
                      onToggleEncore={handleToggleEncore}
                      onDelete={handleDeleteItem}
                      t={t}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <GlassCard
            variant="ethereal"
            padding="lg"
            isHoverable={false}
            className="flex flex-col items-center justify-center text-center"
          >
            <Music
              size={32}
              className="mb-3 text-ethereal-graphite/30"
              aria-hidden="true"
            />
            <Eyebrow color="muted">
              {t("projects.program.empty.setlist_title", "Setlista jest pusta")}
            </Eyebrow>
            <Text size="xs" color="muted" className="mt-1 max-w-xs">
              {t(
                "projects.program.empty.setlist_desc",
                "Wybierz kompozycje z bazy po prawej stronie, aby zbudować program koncertu.",
              )}
            </Text>
          </GlassCard>
        )}
      </div>

      <GlassCard
        variant="ethereal"
        padding="md"
        isHoverable={false}
        className="flex h-[calc(100vh-18rem)] flex-col lg:col-span-2"
      >
        <div className="mb-5 flex items-center gap-2">
          <Eyebrow color="default">
            {t("projects.program.sections.database", "Baza Kompozycji")}
          </Eyebrow>
        </div>

        <div className="mb-5 shrink-0">
          <Input
            type="text"
            placeholder={t(
              "projects.program.search.placeholder",
              "Szukaj utworu...",
            )}
            value={searchQuery || ""}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftIcon={<Search size={16} aria-hidden="true" />}
          />
        </div>

        <div className=" flex-1 space-y-2 overflow-y-auto pr-2">
          {filteredPieces.length > 0 ? (
            filteredPieces.map((piece, index) => {
              const safePieceId = piece.id || `db-piece-${index}`;
              const isAdded = addedPieceIds.includes(String(piece.id));

              return (
                <GlassCard
                  key={safePieceId}
                  variant={isAdded ? "light" : "solid"}
                  padding="sm"
                  isHoverable={false}
                  className={`flex items-center justify-between transition-colors ${
                    isAdded ? "opacity-60" : "hover:border-ethereal-gold/30"
                  }`}
                >
                  <div className="flex min-w-0 flex-col pr-3">
                    <Text
                      size="sm"
                      weight="bold"
                      color={isAdded ? "muted" : "default"}
                      truncate
                      className={isAdded ? "line-through" : ""}
                    >
                      {piece.title}
                    </Text>
                    {(piece.estimated_duration || piece.voicing) && (
                      <Eyebrow color="muted" className="mt-1 truncate">
                        {piece.estimated_duration
                          ? `${formatPieceDuration(piece.estimated_duration, t)} `
                          : ""}
                        {piece.voicing ? `| ${piece.voicing}` : ""}
                      </Eyebrow>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant={isAdded ? "secondary" : "primary"}
                    size="icon"
                    disabled={isAdded}
                    onClick={() => handleAddPiece(String(piece.id))}
                    title={
                      isAdded
                        ? t(
                            "projects.program.actions.already_added",
                            "Utwór jest już na setliście",
                          )
                        : t("projects.program.actions.add", "Dodaj do programu")
                    }
                    aria-label={t(
                      "projects.program.actions.add",
                      "Dodaj do programu",
                    )}
                  >
                    {isAdded ? (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    ) : (
                      <Plus size={16} aria-hidden="true" />
                    )}
                  </Button>
                </GlassCard>
              );
            })
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <Search
                size={28}
                className="mb-3 text-ethereal-graphite/30"
                aria-hidden="true"
              />
              <Eyebrow color="muted">
                {t("projects.program.empty.no_results", "Brak wyników")}
              </Eyebrow>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
