/**
 * @file DivisiBucket.tsx
 * @description One voice line on the casting board: what it needs, who is on it,
 * and how big the hole is. The surface stays neutral in every state — a line
 * that is still short is ordinary work in progress, not an alarm, and washing
 * the whole box in crimson made the board unreadable long before the deficit
 * itself did. Only the figure and the empty slot carry the state.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DivisiBucket
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import type { PieceCasting } from "@/shared/types";
import type { CastMember } from "../../hooks/useMicroCasting";
import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { CastMemberChip } from "./CastMemberChip";
import { DroppableBucket } from "./DroppableBucket";

interface DivisiBucketProps {
  readonly voiceLine: string;
  readonly title: string;
  /** `null` when the piece declares no requirement — free assignment mode. */
  readonly requirement: number | null;
  readonly castings: readonly PieceCasting[];
  readonly memberMap: Map<string, CastMember>;
  readonly showAnswerState: boolean;
  readonly onUpdateNote: (castingId: string, note: string) => void;
  readonly onTogglePitch: (castingId: string) => void;
}

export const DivisiBucket = ({
  voiceLine,
  title,
  requirement,
  castings,
  memberMap,
  showAnswerState,
  onUpdateNote,
  onTogglePitch,
}: DivisiBucketProps): React.JSX.Element => {
  const { t } = useTranslation();

  // A declined singer occupies the row but does not cover the seat, so the
  // figure and the pool count tell the same story.
  const covered = castings.filter(
    (casting) =>
      memberMap.get(String(casting.participation))?.status !== "DEC",
  ).length;

  const missing = requirement === null ? 0 : Math.max(requirement - covered, 0);
  const over = requirement === null ? 0 : Math.max(covered - requirement, 0);
  const isComplete = requirement !== null && missing === 0 && over === 0;

  return (
    <DroppableBucket id={voiceLine} title={title} className="h-full">
      <div
        className={cn(
          "flex h-full min-h-32 flex-col rounded-nested border bg-ethereal-marble p-3 transition-colors",
          isComplete ? "border-ethereal-sage/30" : "border-hairline-strong",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
          <Eyebrow color="graphite" className="truncate">
            {title}
          </Eyebrow>

          {requirement === null ? (
            <Text
              as="span"
              size="sm"
              weight="medium"
              color="muted"
              className="shrink-0 tabular-nums"
            >
              {covered}
            </Text>
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              {isComplete && (
                <Check
                  size={13}
                  className="text-ethereal-sage"
                  aria-hidden="true"
                />
              )}
              <Text
                as="span"
                size="sm"
                weight="medium"
                color={isComplete ? "sage" : "gold"}
                className="tabular-nums"
              >
                {covered}/{requirement}
              </Text>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 pt-2.5">
          {castings.map((casting) => {
            const member = memberMap.get(String(casting.participation));
            if (!member) return null;
            return (
              <CastMemberChip
                key={casting.id}
                member={member}
                casting={casting}
                showAnswerState={showAnswerState}
                onUpdateNote={onUpdateNote}
                onTogglePitch={onTogglePitch}
              />
            );
          })}

          {missing > 0 && (
            <div className="flex items-center justify-center rounded-control border border-dashed border-ethereal-gold/35 bg-ethereal-gold/5 px-2 py-1.5">
              <Eyebrow size="overline-sm" color="gold">
                {t("projects.micro_cast.status.missing", "Brakuje {{count}}", {
                  count: missing,
                })}
              </Eyebrow>
            </div>
          )}

          {/* An empty line in free mode needs a target, not a caption: the same
              "drop here" repeated down eighteen boxes says nothing. */}
          {requirement === null && castings.length === 0 && (
            <div
              aria-hidden="true"
              className="h-7 rounded-control border border-dashed border-hairline-strong"
            />
          )}
        </div>

        {over > 0 && (
          <Caption color="gold" className="pt-2">
            {t("projects.micro_cast.status.over", "Ponad plan: {{count}}", {
              count: over,
            })}
          </Caption>
        )}
      </div>
    </DroppableBucket>
  );
};
