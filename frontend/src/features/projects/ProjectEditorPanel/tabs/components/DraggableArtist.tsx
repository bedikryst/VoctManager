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
import type { Artist, PieceCasting } from "../../../../../shared/types";

interface DraggableArtistProps {
  participationId: string;
  artist: Artist;
  isOverlay?: boolean;
  casting?: PieceCasting;
  onUpdateNote?: (id: string, note: string) => void;
}

export function DraggableArtist({
  participationId,
  artist,
  isOverlay = false,
  casting,
  onUpdateNote,
}: DraggableArtistProps): React.JSX.Element {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: participationId,
  });

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
    <div
      ref={setNodeRef}
      className={`group px-2 py-1.5 text-[10px] font-bold antialiased uppercase tracking-wider rounded-xl flex items-center justify-between gap-2 transition-all 
                ${
                  isOverlay
                    ? "bg-[#002395] text-white shadow-2xl scale-105 rotate-2 border border-[#001766]"
                    : "bg-white border border-stone-200/80 text-stone-700 shadow-sm hover:border-[#002395]/40"
                } 
                ${isDragging && !isOverlay ? "opacity-30" : ""}
            `}
    >
      <div className="flex items-center gap-1.5 overflow-hidden flex-1">
        <div
          {...listeners}
          {...attributes}
          className={`cursor-grab active:cursor-grabbing p-1 -mr-2 -ml-1 rounded transition-colors ${
            isOverlay
              ? "text-white/70"
              : "text-stone-300 hover:text-[#002395] hover:bg-stone-100/50"
          }`}
          aria-label={t(
            "projects.micro_cast.artist.drag_aria",
            "Przeciągnij {{name}}",
            { name: artist.first_name },
          )}
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>

        <span className="truncate max-w-[100px] sm:max-w-[140px] flex-shrink-0">
          <span className={isOverlay ? "text-white/80" : "text-stone-400"}>
            ({voiceTypeInitial})
          </span>{" "}
          {artist.first_name} {artist.last_name}
        </span>

        {casting &&
          !isOverlay &&
          (isEditing ? (
            <input
              autoFocus
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={handleSaveNote}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
              className="w-16 sm:w-20 px-1.5 py-0.5 text-[9px] bg-blue-50 text-[#002395] border border-blue-200 rounded outline-none focus:ring-1 focus:ring-[#002395] ml-1 placeholder-blue-300"
              placeholder={t(
                "projects.micro_cast.artist.note_placeholder",
                "Notatka...",
              )}
            />
          ) : casting.notes ? (
            <button
              onClick={() => !isTemp && setIsEditing(true)}
              disabled={isTemp}
              className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold truncate max-w-[60px] sm:max-w-[80px] transition-colors
                                ${
                                  isTemp
                                    ? "bg-stone-100 text-stone-400"
                                    : "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200"
                                }
                            `}
              title={casting.notes}
            >
              {casting.notes}
            </button>
          ) : null)}
      </div>

      {casting && !casting.notes && !isEditing && !isOverlay && (
        <button
          onClick={() => setIsEditing(true)}
          disabled={isTemp}
          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${
            isTemp
              ? "text-stone-300"
              : "text-stone-400 hover:text-[#002395] hover:bg-stone-100"
          }`}
          title={t("projects.micro_cast.artist.add_note", "Dodaj notatkę")}
        >
          {isTemp ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Pencil size={12} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
