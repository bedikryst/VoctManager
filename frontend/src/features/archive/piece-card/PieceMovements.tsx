/**
 * @file PieceMovements.tsx
 * @description Editable movement rows with links to the score's page anchors.
 */

import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { Movement, Piece } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { useCreateMovement, useDeleteMovement } from "../api/archive.queries";
import { CommitText } from "./CommitText";
import { usePieceFieldReview } from "./PieceFieldReview";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import type { PieceAutosave } from "./usePieceAutosave";

interface PieceMovementsProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
  readonly score?: {
    readonly editionId: string;
    readonly goToPage: (page: number) => void;
  };
}

const MovementRow = ({ piece, autosave, score, movement }: PieceMovementsProps & { movement: Movement }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const tempoId = useId();
  const remove = useDeleteMovement();
  const pieceId = String(piece.id);
  const id = movement.id;
  const order = movement.order_index + 1;
  const page = movement.starts_on_page;
  const titleLabel = t("archive.piece_card.movement_title_numbered", { number: order });
  const tempoLabel = t("archive.review.tempo");
  const { marker, action } = usePieceFieldReview({ piece, autosave, field: "title", objectId: id, label: titleLabel });
  const save = (field: "title" | "tempo_marking", next: string) =>
    autosave.saveField({ kind: "movement", object_id: id, field }, next);

  return (
    <li className="flex flex-wrap items-start gap-x-2 border-t border-hairline py-2">
      <div className="relative pt-2">
        <div className="absolute right-full mt-1 pe-0.5">{marker}</div>
        <Text size="sm" color="muted" className="tabular-nums">{order}.</Text>
      </div>
      <div className="min-w-40 flex-1">
        <CommitText id={titleId} ariaLabel={titleLabel} value={movement.title} draftField={autosave.track("title", titleLabel, id)} onCommit={(next) => {
          if (!next) return t("archive.piece_card.movement_title_required");
          return next.length <= 200 ? save("title", next) : t("archive.piece_card.field_too_long");
        }} />
      </div>
      <div className="w-24">
        <CommitText id={tempoId} ariaLabel={tempoLabel} value={movement.tempo_marking ?? ""} draftField={autosave.track("tempo_marking", tempoLabel, id)} onCommit={(next) =>
          next.length <= 80 ? save("tempo_marking", next) : t("archive.piece_card.field_too_long")
        } />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1 pt-0.5">
        {score && typeof page === "number" && page > 0 && movement.starts_on_edition === score.editionId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            casing="sentence"
            className="min-h-8 px-2"
            aria-label={t("archive.review.go_to_page", { page })}
            onClick={() => score.goToPage(page)}
          >
            {t("archive.review.page_short")} {page}
          </Button>
        )}
        {action}
        <RecordRemove label={t("archive.review.delete_movement")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
      </div>
    </li>
  );
};

export const PieceMovements = ({ piece, autosave, score }: PieceMovementsProps) => {
  const { t } = useTranslation();
  const create = useCreateMovement();
  const movements = piece.movements ?? [];
  const createMovement = (data: FormData) => {
    const title = formText(data, "title");
    if (!title) return t("archive.piece_card.movement_title_required");
    return () => create.mutateAsync({
      piece: String(piece.id),
      order_index: movements.reduce((last, movement) => Math.max(last, movement.order_index), -1) + 1,
      title,
      tempo_marking: formText(data, "tempo_marking"),
    });
  };
  return (
    <div className="space-y-1">
      {movements.length > 0 && (
        <ol className="border-b border-hairline">
          {movements.map((movement) => <MovementRow key={movement.id} {...{ piece, autosave, score, movement }} />)}
        </ol>
      )}
      <RecordAdd label={t("archive.piece_card.add_movement")} draftKey="new_movement" autosave={autosave} onSubmit={createMovement}>
        <Input name="title" label={t("archive.review.movement_title")} variant="property" required maxLength={200} autoFocus />
        <Input name="tempo_marking" label={t("archive.review.tempo")} variant="property" maxLength={80} />
      </RecordAdd>
    </div>
  );
};
