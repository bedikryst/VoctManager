/**
 * @file DraggableArtist.tsx
 * @description Draggable artist card for the micro-casting Kanban.
 * Owns its own inline note editing state to avoid re-rendering the entire board.
 * In the deferred-save world, all edits route through `onUpdateNote` to a draft
 * held by the parent hook — no mutation is fired here.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DraggableArtist
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Pencil } from "lucide-react";

import type { Artist, ParticipationStatus, PieceCasting } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface DraggableArtistProps {
  participationId: string;
  artist: Artist;
  participationStatus?: ParticipationStatus;
  isOverlay?: boolean;
  casting?: PieceCasting;
  onUpdateNote?: (id: string, note: string) => void;
}

const isPending = (casting?: PieceCasting): boolean =>
  Boolean(casting && String(casting.id).startsWith("temp-"));

export const DraggableArtist = React.memo(function DraggableArtist({
  participationId,
  artist,
  participationStatus,
  isOverlay = false,
  casting,
  onUpdateNote,
}: DraggableArtistProps): React.JSX.Element {
  const { t } = useTranslation();

  const isBlocked =
    !isOverlay && !!participationStatus && participationStatus !== "CON";

  const draggable = useDraggable({
    id: participationId,
    disabled: isOverlay || isBlocked,
  });
  const { attributes, listeners, setNodeRef, isDragging } = draggable;

  const voiceTypeInitial = artist.voice_type
    ? t(`dashboard.layout.roles.${artist.voice_type}`).substring(0, 1)
    : artist.voice_type_display?.substring(0, 1) || "?";

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [noteValue, setNoteValue] = useState<string>(casting?.notes || "");

  // Reflect external changes to the persisted note (e.g. after Discard).
  useEffect(() => {
    if (!isEditing) {
      setNoteValue(casting?.notes || "");
    }
  }, [casting?.notes, isEditing]);

  const pending = isPending(casting);

  const handleSaveNote = () => {
    setIsEditing(false);
    const finalNote = noteValue.trim();

    if (casting?.id && finalNote !== (casting.notes || "")) {
      onUpdateNote?.(String(casting.id), finalNote);
    }
  };

  return (
    <div ref={isOverlay ? undefined : setNodeRef} className="w-fit max-w-full">
      <GlassCard
        variant={isOverlay ? "solid" : "light"}
        padding="none"
        isHoverable={false}
        className={cn(
          "group relative flex items-center gap-1.5 rounded-xl px-2 py-1 transition-colors",
          isOverlay
            ? "scale-105 rotate-1 border-ethereal-gold/50 shadow-glass-ethereal ring-2 ring-ethereal-gold/20"
            : "hover:border-ethereal-gold/40",
          isDragging && !isOverlay ? "opacity-30" : "",
          participationStatus === "DEC" && !isOverlay
            ? "border-ethereal-crimson/30 bg-ethereal-crimson/5"
            : "",
          participationStatus === "INV" && !isOverlay ? "opacity-60" : "",
          pending && !isOverlay
            ? "ring-1 ring-ethereal-gold/25"
            : "",
        )}
      >
        {pending && !isOverlay && (
          <span
            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-ethereal-gold shadow-[0_0_0_2px_rgba(255,255,255,0.6)]"
            aria-label={t(
              "projects.micro_cast.artist.pending_label",
              "Niezapisane",
            )}
          />
        )}

        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          <div
            {...(isBlocked ? {} : listeners)}
            {...attributes}
            className={cn(
              // Comfortable grab target. Compact on a fine pointer (mouse): the
              // -my-1 bleeds the hit area into the card's own py-1 padding so the
              // row height is unchanged. On a coarse pointer (touch) it grows to
              // a ~44px WCAG-grade target — we deliberately let the card grow to
              // ~44px tall rather than over-pull with negatives, which GlassCard's
              // overflow-hidden would clip straight back to the old size.
              "flex min-h-8 min-w-7 -my-1 -ml-1.5 shrink-0 items-center justify-center rounded-lg transition-colors select-none",
              "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
              isBlocked
                ? "cursor-not-allowed text-ethereal-graphite/25"
                : isOverlay
                  ? "cursor-grab text-ethereal-gold active:cursor-grabbing"
                  : "cursor-grab text-ethereal-graphite/40 hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
            )}
            aria-label={t(
              "projects.micro_cast.artist.drag_aria",
              "Przeciągnij {{name}}",
              { name: artist.first_name },
            )}
          >
            <GripVertical size={14} aria-hidden="true" />
          </div>

          <div className="flex shrink-0 max-w-25 items-center gap-1.5 sm:max-w-35">
            <Text
              className={cn(
                "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-md border px-1 text-[9px] font-bold uppercase tracking-wider",
                isOverlay
                  ? "border-ethereal-gold/40 bg-ethereal-gold/15 text-ethereal-gold"
                  : "border-ethereal-incense/25 bg-ethereal-marble text-ethereal-graphite/70",
              )}
              aria-hidden="true"
            >
              {voiceTypeInitial}
            </Text>
            <Text
              size="xs"
              weight="bold"
              truncate
              className={cn(
                isOverlay
                  ? "text-ethereal-ink"
                  : participationStatus === "DEC"
                    ? "text-ethereal-crimson"
                    : "text-ethereal-graphite",
              )}
            >
              {artist.first_name} {artist.last_name}
            </Text>
          </div>

          {casting &&
            !isOverlay &&
            (isEditing ? (
              <input
                autoFocus
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onBlur={handleSaveNote}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNote();
                  if (e.key === "Escape") {
                    setNoteValue(casting?.notes || "");
                    setIsEditing(false);
                  }
                }}
                className="ml-1 w-16 sm:w-20 rounded-md border border-ethereal-sage/30 bg-ethereal-sage/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ethereal-sage outline-none placeholder:text-ethereal-sage/40 focus:border-ethereal-sage/60 focus:ring-1 focus:ring-ethereal-sage/40"
                placeholder={t(
                  "projects.micro_cast.artist.note_placeholder",
                  "Notatka...",
                )}
              />
            ) : casting.notes ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ml-1 max-w-15 truncate rounded-md border border-ethereal-sage/30 bg-ethereal-sage/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-ethereal-sage transition-colors hover:bg-ethereal-sage/20 sm:max-w-20"
                title={casting.notes}
              >
                {casting.notes}
              </button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="ml-0.5 h-5 w-5 shrink-0 text-ethereal-graphite/35 transition-colors hover:bg-ethereal-gold/10 hover:text-ethereal-gold"
                title={t("projects.micro_cast.artist.add_note", "Dodaj notatkę")}
                aria-label={t(
                  "projects.micro_cast.artist.add_note",
                  "Dodaj notatkę",
                )}
              >
                <Pencil size={12} aria-hidden="true" />
              </Button>
            ))}
        </div>
      </GlassCard>
    </div>
  );
});
