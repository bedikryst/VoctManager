/**
 * @file DraggableArtist.tsx
 * @description Draggable card representing an artist in the micro-casting Kanban board.
 * Manages its own local state for inline note editing to prevent upper-level re-renders.
 * Fully integrated with i18n for internationalization and accessibility.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/components/DraggableArtist
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Pencil, Loader2 } from "lucide-react";

import type { Artist, PieceCasting } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface DraggableArtistProps {
  participationId: string;
  artist: Artist;
  isOverlay?: boolean;
  casting?: PieceCasting;
  onUpdateNote?: (id: string, note: string) => void;
}

export const DraggableArtist = React.memo(function DraggableArtist({
  participationId,
  artist,
  isOverlay = false,
  casting,
  onUpdateNote,
}: DraggableArtistProps): React.JSX.Element {
  const { t } = useTranslation();
  const draggable = useDraggable({
    id: participationId,
    disabled: isOverlay,
  });
  const { attributes, listeners, setNodeRef, isDragging } = draggable;

  const voiceTypeInitial = artist.voice_type_display?.substring(0, 1) || "?";

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [noteValue, setNoteValue] = useState<string>(casting?.notes || "");

  const isTemp = casting && String(casting.id).startsWith("temp-");

  const handleSaveNote = () => {
    setIsEditing(false);
    const finalNote = noteValue.trim();

    if (casting?.id && finalNote !== (casting.notes || "") && !isTemp) {
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
          "group flex items-center justify-between gap-2 px-2 py-1.5 transition-all",
          isOverlay
            ? "scale-105 rotate-2 border-ethereal-gold/50 shadow-glass-ethereal ring-2 ring-ethereal-gold/20"
            : "hover:border-ethereal-gold/40",
          isDragging && !isOverlay ? "opacity-30" : "",
        )}
      >
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          <div
            {...listeners}
            {...attributes}
            className={cn(
              "cursor-grab p-1 -ml-1 rounded transition-colors active:cursor-grabbing",
              isOverlay
                ? "text-ethereal-gold"
                : "text-ethereal-graphite/40 hover:bg-ethereal-gold/10 hover:text-ethereal-gold",
            )}
            aria-label={t(
              "projects.micro_cast.artist.drag_aria",
              "Przeciągnij {{name}}",
              { name: artist.first_name },
            )}
          >
            <GripVertical size={14} aria-hidden="true" />
          </div>

          <div className="flex shrink-0 max-w-[100px] items-center gap-1 sm:max-w-[140px]">
            <Eyebrow color={isOverlay ? "gold" : "muted"} className="shrink-0">
              ({voiceTypeInitial})
            </Eyebrow>
            <Text
              size="xs"
              weight="bold"
              truncate
              className={
                isOverlay ? "text-ethereal-ink" : "text-ethereal-graphite"
              }
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
                onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
                className="ml-1 w-16 sm:w-20 rounded border border-ethereal-sage/30 bg-ethereal-sage/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ethereal-sage outline-none placeholder:text-ethereal-sage/40 focus:border-ethereal-sage/60 focus:ring-1 focus:ring-ethereal-sage/40"
                placeholder={t(
                  "projects.micro_cast.artist.note_placeholder",
                  "Notatka...",
                )}
              />
            ) : casting.notes ? (
              <button
                onClick={() => !isTemp && setIsEditing(true)}
                disabled={isTemp}
                className={cn(
                  "ml-1 max-w-[60px] truncate rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest transition-colors sm:max-w-[80px]",
                  isTemp
                    ? "border-ethereal-incense/20 bg-ethereal-parchment/50 text-ethereal-graphite/40"
                    : "border-ethereal-sage/30 bg-ethereal-sage/10 text-ethereal-sage hover:bg-ethereal-sage/20",
                )}
                title={casting.notes}
              >
                {casting.notes}
              </button>
            ) : null)}
        </div>

        {casting && !casting.notes && !isEditing && !isOverlay && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(true)}
            disabled={isTemp}
            className={cn(
              "h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
              isTemp
                ? "text-ethereal-graphite/30"
                : "text-ethereal-graphite/60 hover:bg-ethereal-gold/10 hover:text-ethereal-gold",
            )}
            title={t("projects.micro_cast.artist.add_note", "Dodaj notatkę")}
            aria-label={t(
              "projects.micro_cast.artist.add_note",
              "Dodaj notatkę",
            )}
          >
            {isTemp ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Pencil size={12} aria-hidden="true" />
            )}
          </Button>
        )}
      </GlassCard>
    </div>
  );
});
