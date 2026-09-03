/**
 * @file QueueField.tsx
 * @description One field of one page in one language, with everything waiting
 * on it — which is sometimes two people's words for the same sentence.
 *
 * Competing proposals are the case this row exists to get right. §6b keeps them
 * both on purpose, because auto-resolving a clash between two editors would
 * discard somebody's evening in silence, and the editor's own surface names the
 * other person without showing their wording (a draft displayed as text invites
 * revising a sentence the site has never carried). Reading both is this screen's
 * job, and so is saying the thing the reviewer cannot see: accepting one does
 * NOT close the other.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/QueueField
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

import { ProposalVerdict } from "./ProposalVerdict";
import { LOCALE_MARKS } from "../lib/localeView";
import type { QueueEntry } from "../lib/queue";

interface QueueFieldProps {
  readonly entry: QueueEntry;
  readonly onDecide: (
    proposalId: string,
    status: "ACCEPTED" | "REJECTED",
    value?: string,
  ) => void;
  /** The proposal whose verdict is in flight, if any. */
  readonly pendingId: string | null;
}

export const QueueField = ({
  entry,
  onDecide,
  pendingId,
}: QueueFieldProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { segment, open } = entry;

  return (
    <li className="flex flex-col gap-2 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {/* The label is the key contract's, in Polish in every language of the
            desk: it names a slot in the repository, and the reviewer is about to
            go and look for it. */}
        <Eyebrow size="overline-sm" color="muted">
          {`${segment.label || segment.key} · ${LOCALE_MARKS[segment.locale]}`}
        </Eyebrow>
        {/* The machine name, because the next thing this reviewer reads is a
            `git diff` and this is what addresses the line in it. */}
        <Caption color="muted" className="truncate font-mono">
          {segment.key}
        </Caption>
      </div>

      {open.length > 1 && (
        <Caption color="gold">
          {t("copy_desk.queue.competing", {
            count: open.length,
            defaultValue:
              "{{count}} propozycje do jednego pola. Przyjęcie jednej nie odrzuca drugiej — rozstrzygnij obie.",
          })}
        </Caption>
      )}

      <div className="flex flex-col divide-y divide-hairline">
        {open.map((proposal) => (
          <div key={proposal.id} className="py-2 first:pt-0 last:pb-0">
            <ProposalVerdict
              segment={segment}
              proposal={proposal}
              onDecide={onDecide}
              isPending={pendingId === proposal.id}
            />
          </div>
        ))}
      </div>
    </li>
  );
};
