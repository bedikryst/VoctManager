/**
 * @file PieceMovements.tsx
 * @description Editable movement rows with links to the score's page anchors.
 * A page number belongs to the edition whose analysis read it
 * (`starts_on_edition`): the link turns the score on screen when that edition
 * is there, and otherwise names the edition it brings up. A page with no known
 * edition, or one whose edition is gone, offers no link.
 */

import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { Movement, Piece } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { useCreateMovement, useDeleteMovement } from "../api/archive.queries";
import { formatEditionLabel, type PiecePdfLink } from "../constants/piecePdfs";
import { CommitText } from "./CommitText";
import { usePieceFieldReview } from "./PieceFieldReview";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import type { PieceAutosave } from "./usePieceAutosave";

interface PieceMovementsProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
  readonly score?: {
    /** The edition on screen. */
    readonly editionId: string;
    /** Every edition with a PDF, for pages read from another one. */
    readonly editions: readonly PiecePdfLink[];
    readonly show: (editionId: string, page: number) => void;
  };
}

const PageLink = ({ score, editionId, page }: {
  score: NonNullable<PieceMovementsProps["score"]>;
  editionId: string | null | undefined;
  page: number | null | undefined;
}) => {
  const { t } = useTranslation();
  if (typeof page !== "number" || page < 1 || !editionId) return null;
  const isOnScreen = editionId === score.editionId;
  const edition = isOnScreen ? null : score.editions.find((link) => link.id === editionId);
  if (!isOnScreen && !edition) return null;
  const editionLabel = edition ? formatEditionLabel(edition) : "";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      casing="sentence"
      className="min-h-8 max-w-56 px-2"
      aria-label={edition
        ? t("archive.piece_card.go_to_page_in_edition", { page, edition: editionLabel })
        : t("archive.review.go_to_page", { page })}
      title={edition ? editionLabel : undefined}
      onClick={() => score.show(editionId, page)}
    >
      <span className="truncate">
        {edition
          ? t("archive.piece_card.page_in_edition", { page, edition: editionLabel })
          : `${t("archive.review.page_short")} ${page}`}
      </span>
    </Button>
  );
};

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
  const { marker, action } = usePieceFieldReview({ piece, autosave, field: "title", objectId: id, label: titleLabel, controlId: titleId });
  const save = (field: "title" | "tempo_marking", next: string) =>
    autosave.saveField({ kind: "movement", object_id: id, field }, next);

  return (
    // From 1024 px every row lays out on the list's columns, so a long page
    // link in one row cannot push its tempo out of line with the others.
    <li className="relative flex flex-wrap items-start gap-x-2 border-t border-hairline py-2 lg:col-span-4 lg:grid lg:grid-cols-subgrid">
      {marker}
      <div className="pt-2">
        <Text size="sm" color="muted" className="tabular-nums">{order}.</Text>
      </div>
      <div className="min-w-40 flex-1">
        <CommitText id={titleId} ariaLabel={titleLabel} value={movement.title} draftField={autosave.track("title", titleLabel, id)} onCommit={(next) => {
          if (!next) return t("archive.piece_card.movement_title_required");
          return next.length <= 200 ? save("title", next) : t("archive.piece_card.field_too_long");
        }} />
      </div>
      <div className="w-24 lg:w-auto">
        <CommitText id={tempoId} ariaLabel={tempoLabel} value={movement.tempo_marking ?? ""} draftField={autosave.track("tempo_marking", tempoLabel, id)} onCommit={(next) =>
          next.length <= 80 ? save("tempo_marking", next) : t("archive.piece_card.field_too_long")
        } />
      </div>
      <div className="flex flex-wrap items-center gap-1 pt-0.5 lg:ml-auto lg:justify-end">
        {score && <PageLink score={score} editionId={movement.starts_on_edition} page={page} />}
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
        <ol className="border-b border-hairline lg:grid lg:grid-cols-[auto_minmax(0,1fr)_6rem_auto] lg:gap-x-2">
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
