/**
 * @file ProgramTab.tsx
 * @description Setlist builder with drag & drop reordering and a piece-database search.
 * Defers reorder commits via dirty-state tracking surfaced through the shared `EditorActionBar`.
 * Two consistent solid panels: the ordered setlist (left) and a sticky composition database
 * (right). Row actions are always visible — never hover-gated — so the encore/remove controls
 * stay reachable on touch. Each row carries the composer so a title is never ambiguous.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/ProgramTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ListOrdered,
  GripVertical,
  Trash2,
  Search,
  Plus,
  CheckCircle2,
  Star,
  Clock,
  Music,
  Library,
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
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
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

/** Composer display name for a piece, tolerant of the partial AI-enriched shape. */
const getComposerName = (piece?: Piece): string | null => {
  const composer = piece?.composer;
  if (!composer) return null;
  const fromParts = [composer.first_name, composer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composer.full_name?.trim() || fromParts || null;
};

/** Joins the secondary meta line (composer · voicing · duration), skipping blanks. */
const buildMetaLine = (piece: Piece | undefined, t: TFunction): string => {
  const parts = [
    getComposerName(piece),
    piece?.voicing?.trim() || null,
    formatPieceDuration(piece?.estimated_duration, t),
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
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

  const meta = buildMetaLine(pieceObj, t);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
          isDragging
            ? "border-ethereal-gold/40 bg-ethereal-marble shadow-glass-ethereal-hover"
            : item.is_encore
              ? "border-ethereal-amethyst/25 bg-ethereal-amethyst/5"
              : "border-ethereal-ink/6 bg-ethereal-marble hover:border-ethereal-gold/30",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex shrink-0 cursor-grab items-center gap-2 self-stretch outline-none active:cursor-grabbing"
          aria-label={t(
            "projects.program.actions.drag_aria",
            "Przeciągnij utwór {{title}}",
            { title: item.piece_title },
          )}
        >
          <GripVertical
            size={14}
            className="text-ethereal-graphite/30 transition-colors group-hover:text-ethereal-gold"
            aria-hidden="true"
          />
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-ethereal-ink/8 bg-ethereal-alabaster text-[10px] font-bold tabular-nums text-ethereal-gold">
            {index + 1}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <Text
              size="sm"
              weight="semibold"
              color={item.is_encore ? "amethyst" : "default"}
              truncate
              className={item.is_encore ? "italic" : ""}
            >
              {item.piece_title}
            </Text>
            {item.is_encore && (
              <Badge variant="amethyst">
                {t("projects.program.badges.encore", "BIS")}
              </Badge>
            )}
          </div>
          {meta && (
            <Text as="span" size="xs" color="muted" truncate className="mt-0.5">
              {meta}
            </Text>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={() => onToggleEncore(item)}
            className={cn(
              "h-8 w-8",
              item.is_encore
                ? "text-ethereal-amethyst"
                : "text-ethereal-graphite/40 hover:text-ethereal-amethyst",
            )}
            title={
              item.is_encore
                ? t("projects.program.actions.remove_encore", "Usuń jako BIS")
                : t("projects.program.actions.add_encore", "Oznacz jako BIS")
            }
            aria-label={
              item.is_encore
                ? t("projects.program.actions.remove_encore", "Usuń jako BIS")
                : t("projects.program.actions.add_encore", "Oznacz jako BIS")
            }
          >
            <Star
              size={14}
              className={item.is_encore ? "fill-ethereal-amethyst" : ""}
              aria-hidden="true"
            />
          </Button>
          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={() => onDelete(safeId)}
            className="h-8 w-8 text-ethereal-graphite/40 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
            title={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
            aria-label={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
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
    <div className="relative grid w-full grid-cols-1 gap-5 pb-24 lg:grid-cols-5 lg:items-start">
      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.program.fab.description",
          "Zmodyfikowałeś kolejność programu.",
        )}
        onCancel={handleCancel}
        onConfirm={handleSaveChanges}
        isLoading={isSaving}
      />

      {/* ── Setlist ───────────────────────────────────────────────────────── */}
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className="flex max-h-[70dvh] flex-col lg:col-span-3"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ListOrdered size={15} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h2" color="graphite">
              {t("projects.program.sections.setlist", "Setlista wydarzenia")}
            </Eyebrow>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {t("projects.program.badges.tracks_count", "Utworów: {{count}}", {
                count: programItems.length,
              })}
            </Badge>
            {totalConcertDurationSeconds > 0 && (
              <Badge variant="brand" icon={<Clock size={12} aria-hidden="true" />}>
                {formatTotalDuration(totalConcertDurationSeconds, t)}
              </Badge>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                <div className="space-y-2">
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
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Music size={28} className="text-ethereal-incense/30" aria-hidden="true" />
              <Eyebrow color="muted">
                {t("projects.program.empty.setlist_title", "Setlista jest pusta")}
              </Eyebrow>
              <Text size="sm" color="muted" className="max-w-xs">
                {t(
                  "projects.program.empty.setlist_desc",
                  "Wybierz kompozycje z bazy obok, aby zbudować program koncertu.",
                )}
              </Text>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Composition database (sticky on desktop) ──────────────────────── */}
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className="flex max-h-[70dvh] flex-col lg:col-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-9rem)]"
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-ethereal-ink/6 px-5 py-3.5">
          <Library size={15} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h2" color="graphite">
            {t("projects.program.sections.database", "Baza kompozycji")}
          </Eyebrow>
        </header>

        <div className="shrink-0 px-5 pt-4">
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

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5 pt-4">
          {filteredPieces.length > 0 ? (
            filteredPieces.map((piece, index) => {
              const safePieceId = piece.id || `db-piece-${index}`;
              const isAdded = addedPieceIds.includes(String(piece.id));
              const meta = buildMetaLine(piece, t);

              return (
                <div
                  key={safePieceId}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
                    isAdded
                      ? "border-ethereal-ink/6 bg-ethereal-alabaster/40 opacity-60"
                      : "border-ethereal-ink/6 bg-ethereal-marble hover:border-ethereal-gold/30",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Text
                      size="sm"
                      weight="semibold"
                      color={isAdded ? "muted" : "default"}
                      truncate
                      className={isAdded ? "line-through" : ""}
                    >
                      {piece.title}
                    </Text>
                    {meta && (
                      <Text as="span" size="xs" color="muted" truncate className="mt-0.5">
                        {meta}
                      </Text>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant={isAdded ? "ghost" : "secondary"}
                    size="icon"
                    disabled={isAdded}
                    onClick={() => handleAddPiece(String(piece.id))}
                    className="h-8 w-8 shrink-0"
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
                      <CheckCircle2 size={15} aria-hidden="true" />
                    ) : (
                      <Plus size={15} aria-hidden="true" />
                    )}
                  </Button>
                </div>
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
