/**
 * @file CastMemberChip.tsx
 * @description One person on the casting board — in the unassigned pool or on a
 * voice line. The grip is the only drag surface, so the two detail edits a
 * casting carries (the starting pitch and a free-text note) can be plain
 * buttons inside the chip instead of a separate editor.
 * Everything here is a draft: edits route through the parent hook and are only
 * persisted by the board's own save.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/CastMemberChip
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, KeyRound, Pencil } from "lucide-react";

import type { PieceCasting } from "@/shared/types";
import type { CastMember } from "../../hooks/useMicroCasting";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface CastMemberChipProps {
  readonly member: CastMember;
  /** Present only on an assigned chip; carries the note and the pitch flag. */
  readonly casting?: PieceCasting;
  readonly isOverlay?: boolean;
  /**
   * Whether an answer state is worth printing. Before publication nobody has
   * been asked, so "awaiting" on all forty chips states the default in the
   * loudest way available and buries the one singer who actually declined.
   */
  readonly showAnswerState?: boolean;
  readonly onUpdateNote?: (castingId: string, note: string) => void;
  readonly onTogglePitch?: (castingId: string) => void;
}

const isPending = (casting?: PieceCasting): boolean =>
  Boolean(casting && String(casting.id).startsWith("temp-"));

/**
 * A 44px target cannot fit inside a row this dense, and these are secondary
 * edits on an already-selected person rather than the screen's primary action —
 * so they take the largest square the chip allows, and grow on a coarse pointer.
 */
const ACTION_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 pointer-coarse:h-9 pointer-coarse:w-9";

export const CastMemberChip = React.memo(function CastMemberChip({
  member,
  casting,
  isOverlay = false,
  showAnswerState = false,
  onUpdateNote,
  onTogglePitch,
}: CastMemberChipProps): React.JSX.Element {
  const { t } = useTranslation();

  // Casting states an intention, not consent: a singer who has not answered yet
  // can be placed on a voice line, which is the only way to build divisi before
  // the project is published. A decline is the one refusal — that seat is empty.
  const isBlocked = !isOverlay && member.status === "DEC";
  const isAwaitingAnswer =
    !isOverlay && showAnswerState && member.status === "INV";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: member.participationId,
    disabled: isOverlay || isBlocked,
  });

  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [noteValue, setNoteValue] = useState<string>(casting?.notes || "");

  // Reflect external changes to the draft note (e.g. after Discard).
  useEffect(() => {
    if (!isEditingNote) {
      setNoteValue(casting?.notes || "");
    }
  }, [casting?.notes, isEditingNote]);

  const voiceInitial = member.voiceLabel.charAt(0).toUpperCase() || "?";
  const pending = isPending(casting);
  const givesPitch = Boolean(casting?.gives_pitch);
  const isEditable = Boolean(casting) && !isOverlay;

  const handleSaveNote = (): void => {
    setIsEditingNote(false);
    const finalNote = noteValue.trim();
    if (casting?.id && finalNote !== (casting.notes || "")) {
      onUpdateNote?.(String(casting.id), finalNote);
    }
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={cn("group/chip w-full", isDragging && !isOverlay && "opacity-30")}
    >
      <div
        className={cn(
          "relative flex w-full items-center gap-2 rounded-control border px-2 py-1.5 transition-colors",
          isBlocked
            ? "border-ethereal-crimson/25 bg-ethereal-crimson/5"
            : "border-hairline-strong bg-ethereal-marble",
          isOverlay
            ? "rotate-1 border-ethereal-gold/50 shadow-glass-ethereal"
            : !isBlocked && "hover:border-ethereal-gold/45",
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

        {/* Compact on a fine pointer — the -my-1 bleeds the hit area into the
            chip's own padding so the row height is unchanged. On touch it grows
            to a ~44px target and the chip grows with it. */}
        <div
          {...(isBlocked ? {} : listeners)}
          {...attributes}
          className={cn(
            "-my-1 -ml-1 flex min-h-8 min-w-6 shrink-0 select-none items-center justify-center rounded-chip transition-colors",
            "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
            isBlocked
              ? "cursor-not-allowed text-ethereal-graphite/25"
              : isOverlay
                ? "cursor-grabbing text-ethereal-gold"
                : "cursor-grab text-ethereal-graphite/35 hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
          )}
          aria-label={t(
            "projects.micro_cast.artist.drag_aria",
            "Przeciągnij {{name}}",
            { name: member.displayName },
          )}
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>

        <span
          className={cn(
            "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-chip border px-1",
            isOverlay
              ? "border-ethereal-gold/40 bg-ethereal-gold/15 text-ethereal-gold"
              : "border-hairline-strong bg-ethereal-alabaster text-ethereal-graphite/70",
          )}
          title={member.voiceLabel}
        >
          <Eyebrow as="span" size="overline-sm" color="inherit">
            {voiceInitial}
          </Eyebrow>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text
            as="span"
            size="sm"
            weight="medium"
            truncate
            color={
              isBlocked
                ? "crimson"
                : member.isUnresolved
                  ? "muted"
                  : "graphite"
            }
            className={member.isUnresolved ? "italic" : undefined}
          >
            {member.displayName}
          </Text>

          {isEditingNote ? (
            <input
              autoFocus
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              onBlur={handleSaveNote}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSaveNote();
                if (event.key === "Escape") {
                  setNoteValue(casting?.notes || "");
                  setIsEditingNote(false);
                }
              }}
              aria-label={t(
                "projects.micro_cast.artist.add_note",
                "Dodaj notatkę",
              )}
              placeholder={t(
                "projects.micro_cast.artist.note_placeholder",
                "np. góra",
              )}
              className="w-full rounded-chip border border-ethereal-gold/40 bg-ethereal-alabaster px-1.5 py-0.5 text-xs text-ethereal-ink outline-none placeholder:text-ethereal-incense focus:border-ethereal-gold/70"
            />
          ) : (
            casting?.notes && (
              <Caption color="muted" className="truncate italic">
                {casting.notes}
              </Caption>
            )
          )}
        </div>

        {isBlocked && (
          <Badge variant="danger" className="shrink-0 px-1.5 py-0.5">
            {t("projects.micro_cast.artist.declined", "Odmowa")}
          </Badge>
        )}
        {isAwaitingAnswer && (
          <Badge variant="outline" className="shrink-0 px-1.5 py-0.5">
            {t("projects.micro_cast.artist.awaiting", "Czeka")}
          </Badge>
        )}

        {isEditable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (casting?.id) onTogglePitch?.(String(casting.id));
              }}
              aria-pressed={givesPitch}
              title={t("projects.micro_cast.artist.gives_pitch", "Podaje ton")}
              aria-label={t(
                "projects.micro_cast.artist.gives_pitch",
                "Podaje ton",
              )}
              className={cn(
                ACTION_CLASS,
                givesPitch
                  ? "bg-ethereal-gold/15 text-ethereal-gold"
                  : "text-ethereal-graphite/35 opacity-0 hover:bg-ethereal-gold/10 hover:text-ethereal-gold focus-visible:opacity-100 group-hover/chip:opacity-100 pointer-coarse:opacity-100",
              )}
            >
              <KeyRound size={13} aria-hidden="true" />
            </button>

            {!isEditingNote && (
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                title={t(
                  "projects.micro_cast.artist.add_note",
                  "Dodaj notatkę",
                )}
                aria-label={t(
                  "projects.micro_cast.artist.add_note",
                  "Dodaj notatkę",
                )}
                className={cn(
                  ACTION_CLASS,
                  "text-ethereal-graphite/35 opacity-0 hover:bg-ethereal-gold/10 hover:text-ethereal-gold focus-visible:opacity-100 group-hover/chip:opacity-100 pointer-coarse:opacity-100",
                )}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
