/**
 * @file NewPieceDialog.tsx
 * @description A new piece, by its title alone, over the library. The piece
 * card is the one editor a piece has: "Utwórz" creates the piece and opens its
 * card, which asks for a score and saves every other field itself.
 *
 * While the title is typed, the pieces the library already holds under a
 * similar title are listed under the field, each opening its own card, so a
 * duplicate is seen before it is made. Similar means one title holds the other
 * from the start of a word, with case, diacritics and punctuation folded away:
 * "ave verum" finds "Ave verum corpus", "verum" finds it too, and so does
 * "Ave verum corpus KV 618"; "ria" does not find "Gloria".
 * @module features/archive/components/NewPieceDialog
 */

import React, { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";

import { toastApiError } from "@/shared/api/errors";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { foldDiacritics } from "@/shared/lib/text";
import type { Piece } from "@/shared/types";
import { RecordList, RecordRow } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";

import { useCreatePiece, usePieces } from "../api/archive.queries";
import { pieceCardPath } from "../constants/libraryScope";
import { pieceComposerName } from "./PieceRow";

/** `Piece.title`'s column width on the server. */
const TITLE_MAX_LENGTH = 200;

/** A folded title shorter than this matches too much of a library to help. */
const MIN_MATCH_LENGTH = 3;

/** The closest matches listed; the line above them counts all of them. */
const MAX_LISTED = 5;

/** Words only, folded and single-spaced, padded so a match can anchor on a word start. */
const matchKey = (title: string): string =>
  ` ${foldDiacritics(title).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/**
 * Pieces whose title is the typed one, starts with it, holds it from a word
 * start, or is itself held whole inside it, in that order of closeness. The
 * typed title's last word may be half-written, so it matches a word's start
 * rather than the whole word.
 */
const findSimilar = (pieces: readonly Piece[], typed: string): Piece[] => {
  const key = matchKey(typed);
  const partial = key.trimEnd();
  if (partial.trim().length < MIN_MATCH_LENGTH) return [];

  const ranked: { piece: Piece; rank: number }[] = [];
  for (const piece of pieces) {
    const held = matchKey(piece.title);
    const rank =
      held === key
        ? 0
        : held.startsWith(partial)
          ? 1
          : held.includes(partial)
            ? 2
            : held.trim().length >= MIN_MATCH_LENGTH && key.includes(held)
              ? 3
              : null;
    if (rank !== null) ranked.push({ piece, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.piece.title.localeCompare(b.piece.title))
    .map(({ piece }) => piece);
};

interface NewPieceDialogProps {
  /** Already in the field on open: the library's search, when it found nothing. */
  readonly initialTitle?: string;
  readonly onClose: () => void;
}

export const NewPieceDialog = ({
  initialTitle = "",
  onClose,
}: NewPieceDialogProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: pieces = [] } = usePieces();
  const { mutateAsync: createPiece, isPending } = useCreatePiece();
  const [title, setTitle] = useState(initialTitle);

  const typed = useDeferredValue(title);
  const similar = useMemo(() => findSimilar(pieces, typed), [pieces, typed]);
  const listed = similar.slice(0, MAX_LISTED);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isPending) return;
    try {
      const piece = await createPiece({ title: trimmed });
      navigate(pieceCardPath(piece.id, null));
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("archive.new_piece.error", "Nie udało się utworzyć utworu."),
      });
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-focus-trap bg-surface-inverse/70" />
        {/* Anchored at the top, not centred: the similar titles grow the
            dialog while the manager types, and a centred one would move the
            field under the cursor up with every match. Both side insets plus
            auto margins centre it under its width cap and keep a gutter on a
            phone. */}
        <Dialog.Content className="fixed inset-x-4 top-1/5 z-focus-trap mx-auto max-h-3/4 max-w-md overflow-y-auto rounded-nested border border-hairline-strong bg-ethereal-alabaster p-5 shadow-glass-solid">
          <BodyScrollLock />
          <Dialog.Title asChild>
            <Text as="h2" size="lg" weight="semibold">
              {t("archive.new_piece.title", "Nowy utwór")}
            </Text>
          </Dialog.Title>
          <Dialog.Description asChild>
            <Text as="p" size="sm" color="graphite" className="mt-1">
              {t("archive.new_piece.hint", "Resztę danych uzupełnisz na karcie utworu.")}
            </Text>
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <div className="flex flex-col gap-2">
              <Input
                name="title"
                label={t("archive.new_piece.title_label", "Tytuł")}
                labelCasing="sentence"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                autoComplete="off"
                required
                disabled={isPending}
              />
              {/* Always in the tree, so the count is announced as it changes. */}
              <Text as="p" size="sm" color="graphite" role="status">
                {similar.length > 0
                  ? t("archive.new_piece.similar", "W bibliotece jest już {{count}} podobnych tytułów", {
                      count: similar.length,
                    })
                  : null}
              </Text>
              {listed.length > 0 && (
                <RecordList label={t("archive.new_piece.similar_aria", "Podobne tytuły w bibliotece")}>
                  {listed.map((piece) => (
                    <RecordRow
                      key={piece.id}
                      open={{ to: pieceCardPath(piece.id, null) }}
                      title={piece.title}
                      voice="work"
                      facts={[
                        pieceComposerName(piece),
                        piece.composition_year ? String(piece.composition_year) : null,
                      ]}
                    />
                  ))}
                </RecordList>
              )}
              {similar.length > listed.length && (
                <Text as="p" size="sm" color="muted">
                  {t("archive.new_piece.more", "i jeszcze {{count}}", {
                    count: similar.length - listed.length,
                  })}
                </Text>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" casing="sentence" disabled={isPending} onClick={onClose}>
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                casing="sentence"
                isLoading={isPending}
                disabled={!title.trim()}
              >
                {t("archive.new_piece.submit", "Utwórz")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
