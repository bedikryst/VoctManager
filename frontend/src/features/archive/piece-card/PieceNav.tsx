/**
 * @file PieceNav.tsx
 * @description Previous and next piece, with the open piece's place between
 * them. The count stands between the chevrons, so the pair never reads as the
 * way back, whose arrow points the same way; in review it names the queue.
 * At either end of the list its chevron stays, disabled, so the group keeps
 * its width as the manager steps through.
 * @module features/archive/piece-card/PieceNav
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { Piece } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import type { PieceSequence } from "./pieceSequence";

interface PieceNavProps {
  readonly sequence: PieceSequence;
  readonly pathTo: (piece: Piece) => string;
  /** The phone's top bar: the bare count, the queue named to screen readers only. */
  readonly isCompact?: boolean;
  readonly className?: string;
}

interface StepProps {
  readonly target: Piece | null;
  readonly pathTo: (piece: Piece) => string;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const Step = ({ target, pathTo, label, icon }: StepProps): React.JSX.Element =>
  target ? (
    <Button asChild variant="icon" size="icon" aria-label={label} title={label}>
      <Link to={pathTo(target)}>{icon}</Link>
    </Button>
  ) : (
    <Button variant="icon" size="icon" aria-label={label} disabled>
      {icon}
    </Button>
  );

export const PieceNav = ({
  sequence,
  pathTo,
  isCompact = false,
  className,
}: PieceNavProps): React.JSX.Element => {
  const { t } = useTranslation();
  const inReview = sequence.list === "review";
  const counts = { index: sequence.position, total: sequence.total };
  const position = inReview
    ? t("archive.piece_card.nav.position_review", counts)
    : t("archive.piece_card.nav.position", counts);

  return (
    <div
      role="group"
      aria-label={inReview ? t("archive.piece_card.nav.aria_review") : t("archive.piece_card.nav.aria")}
      className={cn("flex shrink-0 items-center", className)}
    >
      <Step
        target={sequence.previous}
        pathTo={pathTo}
        label={inReview ? t("archive.piece_card.nav.previous_review") : t("archive.piece_card.nav.previous")}
        icon={<ChevronLeft size={20} aria-hidden="true" />}
      />
      {isCompact ? (
        <>
          <Text as="span" size="sm" color="graphite" aria-hidden="true" className="whitespace-nowrap tabular-nums">
            {t("archive.piece_card.nav.position_compact", counts)}
          </Text>
          <span className="sr-only">{position}</span>
        </>
      ) : (
        <Text as="span" size="sm" color="graphite" className="whitespace-nowrap px-1 tabular-nums">
          {position}
        </Text>
      )}
      <Step
        target={sequence.next}
        pathTo={pathTo}
        label={inReview ? t("archive.piece_card.nav.next_review") : t("archive.piece_card.nav.next")}
        icon={<ChevronRight size={20} aria-hidden="true" />}
      />
    </div>
  );
};
