/**
 * @file SegmentCell.tsx
 * @description One field of the page in one language: the text itself, and
 * everything the editor needs to know about it — but only when there is
 * something to know.
 *
 * The text is a `<textarea>` at rest, not a paragraph that swaps into one. A
 * page holds seventy-odd fields and the swap would cost a measurement, a focus
 * hand-off and a reflow on every click; the ghost field shell already draws
 * nothing until the pointer or the caret arrives, which is the same read for
 * none of the machinery. The field itself is `GrowingTextarea`, which owns the
 * mirror that gives it its height.
 *
 * What the cell says at rest is: the text. No chip, no border, no toggle — the
 * corpus is 1 281 rows and a resting state that decorates itself is 1 281
 * things to look past. The original, the comment field and the withdrawal
 * appear once the editor has written something, and the chips only where a
 * fact exists (a settled verdict, a Polish that has moved, somebody else at the
 * same paragraph).
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/SegmentCell
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus, Undo2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  FIELD_TEXT_SCALE,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { GrowingTextarea } from "./GrowingTextarea";
import { LOCALE_MARKS } from "../lib/localeView";
import {
  currentValue,
  hasNewWording,
  type CopyDeskCell,
} from "../lib/proposals";
import type { CopyDeskProposalWrite } from "../types/copydesk.dto";

/**
 * How long the field waits after the last keystroke before it saves.
 *
 * Long enough that a sentence is written rather than transmitted letter by
 * letter, short enough that looking away for a moment has already saved it.
 * Nothing depends on it being right: the field also flushes on blur and on
 * unmount, so the worst a longer wait could cost is one round trip.
 */
const AUTOSAVE_DELAY_MS = 900;

interface SegmentCellProps {
  readonly cell: CopyDeskCell;
  /** Print the language mark: pointless when only one column is on screen. */
  readonly withMark: boolean;
  readonly onSave: (payload: CopyDeskProposalWrite) => void;
  readonly onWithdraw: (proposalId: string) => void;
}

export const SegmentCell = ({
  cell,
  withMark,
  onSave,
  onWithdraw,
}: SegmentCellProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { segment, mine, others, settled, awaiting } = cell;

  const savedValue = currentValue(cell);
  const savedComment = mine?.comment ?? "";

  const [value, setValue] = useState(savedValue);
  const [comment, setComment] = useState(savedComment);
  const [isCommenting, setIsCommenting] = useState(false);
  const [showsOriginal, setShowsOriginal] = useState(false);

  const pending = useRef<CopyDeskProposalWrite | null>(null);
  const timer = useRef<number | null>(null);

  // The server's answer is adopted only while nothing is in flight from here.
  // A refetch lands on every window focus, and an editor who alt-tabs mid
  // sentence must not come back to the paragraph they were replacing.
  useEffect(() => {
    if (pending.current) return;
    setValue(savedValue);
    setComment(savedComment);
  }, [savedValue, savedComment]);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const payload = pending.current;
    if (!payload) return;
    pending.current = null;
    onSave(payload);
  }, [onSave]);

  // Flushed on the way out, so leaving the page, switching the locale view or
  // closing the tab mid-word does not drop the word.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(() => () => flushRef.current(), []);

  const queue = useCallback(
    (nextValue: string, nextComment: string) => {
      if (nextValue === savedValue && nextComment === savedComment) {
        // Back to what the server already holds — including the case of typing
        // a change and undoing it. Nothing to say.
        pending.current = null;
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
          timer.current = null;
        }
        return;
      }
      pending.current = {
        segment_id: segment.id,
        value: nextValue,
        comment: nextComment,
      };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(), AUTOSAVE_DELAY_MS);
    },
    [flush, savedComment, savedValue, segment.id],
  );

  const isTouched = mine !== null;
  // Said while it is still being typed, not after the save: `apply-copy` refuses
  // an empty value outright, because writing `""` into a YAML scalar deletes the
  // field rather than clearing it.
  const isEmptied = value.trim() === "" && segment.value.trim() !== "";
  const showsFooter = isTouched || isCommenting || showsOriginal;

  return (
    <div className="flex min-w-0 gap-2">
      {withMark && (
        <Eyebrow
          size="overline-sm"
          color={hasNewWording(cell) ? "gold" : "muted"}
          className="w-6 shrink-0 pt-2"
        >
          {LOCALE_MARKS[segment.locale]}
        </Eyebrow>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <GrowingTextarea
          value={value}
          lang={segment.locale}
          ariaLabel={`${segment.label} · ${LOCALE_MARKS[segment.locale]}`}
          onValueChange={(next) => {
            setValue(next);
            queue(next, comment);
          }}
          onBlur={flush}
          className={cn(hasNewWording(cell) && "bg-ethereal-gold/6")}
        />

        {isEmptied && (
          <Caption color="gold" className="px-2.5">
            {t(
              "copy_desk.editor.emptied",
              "Puste pole zostanie odrzucone — wyczyszczenie kasuje pole z serwisu, a nie opróżnia go. Cofnij, jeśli nie o to chodziło.",
            )}
          </Caption>
        )}

        {(settled || segment.is_stale || others.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1.5">
            {segment.is_stale && (
              // Gold: a translation whose source has moved is work waiting, not
              // something broken.
              <Badge variant="warning">
                {t("copy_desk.editor.stale", "Polski się zmienił")}
              </Badge>
            )}
            {settled?.status === "ACCEPTED" && (
              <Badge variant="success">
                {t("copy_desk.editor.accepted", "Przyjęte")}
              </Badge>
            )}
            {settled?.status === "REJECTED" && (
              <Badge variant="neutral">
                {t("copy_desk.editor.rejected", "Odrzucone")}
              </Badge>
            )}
            {others.map((proposal) => (
              <Caption key={proposal.id} color="graphite">
                {t("copy_desk.editor.other_author", {
                  name: proposal.author_name,
                  defaultValue: "{{name}} też tu pisze",
                })}
              </Caption>
            ))}
          </div>
        )}

        {/* The decided sentence, while it is still only decided. Gold rather
            than the parchment of "Na serwisie": this is not what the site says,
            it is what the site will say once the patch is written out. */}
        {awaiting && (
          <div className="rounded-nested border border-ethereal-gold/25 bg-ethereal-gold/6 px-2.5 py-2">
            <Eyebrow size="overline-sm" color="gold">
              {t(
                "copy_desk.editor.awaiting",
                "Przyjęte — czeka na wpisanie do repozytorium",
              )}
            </Eyebrow>
            <Text
              size="sm"
              color="graphite"
              lang={segment.locale}
              className="whitespace-pre-wrap"
            >
              {awaiting.value}
            </Text>
          </div>
        )}

        {showsFooter && (
          <div className="flex flex-wrap items-center gap-1 px-1">
            {hasNewWording(cell) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowsOriginal((shown) => !shown)}
              >
                {showsOriginal
                  ? t("copy_desk.editor.hide_original", "Ukryj oryginał")
                  : t("copy_desk.editor.show_original", "Oryginał")}
              </Button>
            )}
            {!isCommenting && comment === "" && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<MessageSquarePlus size={13} aria-hidden="true" />}
                onClick={() => setIsCommenting(true)}
              >
                {t("copy_desk.editor.add_comment", "Uwaga")}
              </Button>
            )}
            {mine && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Undo2 size={13} aria-hidden="true" />}
                onClick={() => {
                  pending.current = null;
                  onWithdraw(mine.id);
                }}
              >
                {t("copy_desk.editor.withdraw", "Cofnij")}
              </Button>
            )}
          </div>
        )}

        {showsOriginal && (
          <div className="rounded-nested border border-hairline bg-ethereal-parchment/50 px-2.5 py-2">
            <Eyebrow size="overline-sm" color="muted">
              {t("copy_desk.editor.original", "Na serwisie")}
            </Eyebrow>
            <Text size="sm" color="graphite" className="whitespace-pre-wrap">
              {segment.value}
            </Text>
          </div>
        )}

        {(isCommenting || comment !== "") && (
          <input
            value={comment}
            placeholder={t(
              "copy_desk.editor.comment_placeholder",
              "Uwaga dla wydawcy…",
            )}
            aria-label={t("copy_desk.editor.comment_label", "Uwaga do pola")}
            onChange={(event) => {
              setComment(event.target.value);
              queue(value, event.target.value);
            }}
            onBlur={flush}
            className={cn(
              fieldShellVariants({ variant: "ghost" }),
              FIELD_TEXT_SCALE.xs,
              "px-2.5 py-1 italic",
            )}
          />
        )}
      </div>
    </div>
  );
};
