/**
 * @file ProposalVerdict.tsx
 * @description One proposal, as the person who has to settle it reads it: who
 * wrote it, what it does to the text the site is serving, and the three things
 * that can be done about it.
 *
 * "Accept / reject / edit further" is §4's list, and the third is not a fourth
 * state: correcting the wording and accepting is ONE act, so the record holds
 * what was actually written into the repository rather than what was proposed
 * and then quietly altered. The diff always shows the working value — the
 * moment the reviewer touches a word, what they are looking at is what will
 * land in the file.
 *
 * The text swaps into a field on demand here, which is the opposite of the
 * editor's cell (§6h) and for the opposite reason: there the surface is
 * seventy-odd fields whose resting state is editable, while here the resting
 * state is a diff — a reading no textarea can hold — and correcting is the rare
 * path.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/ProposalVerdict
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MessageSquareQuote, PenLine, X } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/time/intl";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { DiffText } from "./DiffText";
import { GrowingTextarea } from "./GrowingTextarea";
import { isNoteOnly } from "../lib/queue";
import type {
  CopyDeskProposal,
  CopyDeskSegment,
} from "../types/copydesk.dto";

interface ProposalVerdictProps {
  readonly segment: CopyDeskSegment;
  readonly proposal: CopyDeskProposal;
  readonly onDecide: (
    proposalId: string,
    status: "ACCEPTED" | "REJECTED",
    value?: string,
  ) => void;
  readonly isPending: boolean;
}

export const ProposalVerdict = ({
  segment,
  proposal,
  onDecide,
  isPending,
}: ProposalVerdictProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();

  // `null` is "as proposed". Keeping the reviewer's correction separate from
  // the proposal is what lets the surface say which of the two is on screen,
  // and lets them put the editor's own wording back.
  const [correction, setCorrection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const value = correction ?? proposal.value;
  const isCorrected = correction !== null && correction !== proposal.value;
  const noteOnly = isNoteOnly(segment, proposal) && !isCorrected;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Text as="span" size="sm" weight="medium">
          {proposal.author_name || t("copy_desk.queue.some_editor", "Redaktor")}
        </Text>
        <Caption color="muted">
          {formatRelativeTime(proposal.updated_at, i18n.language)}
        </Caption>

        {noteOnly && (
          <Badge variant="neutral">
            {t("copy_desk.queue.note_only", "Tylko uwaga")}
          </Badge>
        )}
        {/* Gold, never crimson: a translation written against a Polish that has
            since moved is work waiting, not something broken. It is also the one
            chip here that changes what accepting MEANS — the value would go into
            the repository rendering a sentence the site no longer carries. */}
        {proposal.is_stale && (
          <Badge variant="warning">
            {t("copy_desk.queue.stale", "Polski się zmienił po tej propozycji")}
          </Badge>
        )}
        {isCorrected && (
          <Badge variant="incense">
            {t("copy_desk.queue.corrected", "Twoja poprawka")}
          </Badge>
        )}
      </div>

      {isEditing ? (
        <GrowingTextarea
          value={value}
          lang={segment.locale}
          focusOnMount
          ariaLabel={t("copy_desk.queue.correct_label", "Popraw brzmienie")}
          onValueChange={setCorrection}
        />
      ) : noteOnly ? (
        // Nothing to compare: the editor left a note and touched no words. The
        // text is here because the note is about it, and it reads as what it is
        // — the value the site is serving.
        <Text
          lang={segment.locale}
          color="graphite"
          className="whitespace-pre-wrap wrap-break-word rounded-nested bg-ethereal-parchment/40 px-2.5 py-1.5"
        >
          {segment.value}
        </Text>
      ) : (
        <DiffText
          before={segment.value}
          after={value}
          lang={segment.locale}
        />
      )}

      {proposal.comment && (
        <div className="flex items-start gap-2 px-1">
          <MessageSquareQuote
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ethereal-incense"
          />
          <Text size="sm" color="graphite" className="italic">
            {proposal.comment}
          </Text>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<PenLine size={13} aria-hidden="true" />}
          onClick={() => setIsEditing((editing) => !editing)}
        >
          {isEditing
            ? t("copy_desk.queue.stop_correcting", "Podgląd zmiany")
            : t("copy_desk.queue.correct", "Popraw")}
        </Button>
        {isCorrected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCorrection(null);
              setIsEditing(false);
            }}
          >
            {t("copy_desk.queue.restore_wording", "Wróć do brzmienia autora")}
          </Button>
        )}

        <span className="flex-1" aria-hidden="true" />

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<X size={13} aria-hidden="true" />}
          disabled={isPending}
          onClick={() => onDecide(proposal.id, "REJECTED")}
        >
          {t("copy_desk.queue.reject", "Odrzuć")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Check size={13} aria-hidden="true" />}
          isLoading={isPending}
          onClick={() =>
            onDecide(
              proposal.id,
              "ACCEPTED",
              isCorrected ? value : undefined,
            )
          }
        >
          {isCorrected
            ? t("copy_desk.queue.accept_corrected", "Przyjmij poprawione")
            : t("copy_desk.queue.accept", "Przyjmij")}
        </Button>
      </div>
    </div>
  );
};
