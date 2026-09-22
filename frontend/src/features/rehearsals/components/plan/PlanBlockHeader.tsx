/**
 * @file PlanBlockHeader.tsx
 * @description The head of one time block in the plan editor, drawn inside
 * the block's first row so it travels with that row on a drag. It states the
 * block as facts — the span, its length, and the minutes the rows claim when
 * those differ from the span — and offers the block's call as chips: one per
 * voice family its calling rows offer, plus the players when the rehearsal
 * calls any. A chip is tri-state over the block's rows (all / some / none
 * leave the family out), and a tap SETS the family on every row, each
 * through its own lines: "all" clears it everywhere, anything else excludes
 * it everywhere. Lines ("bez B2") stay per row. Editor only: nothing here
 * reaches the choir, and the header is not a container — a row dragged into
 * the block keeps its own exclusions, and the chip then reads "some".
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/PlanBlockHeader
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import type { VoiceFamilyId } from "@/features/projects/lib/voiceFamilies";
import { useFamilyLabels } from "./VoiceExclusionChips";
import type { BlockCallState, PlanBlockReading, PlanEditor } from "./usePlanEditor";

interface PlanBlockHeaderProps {
  readonly block: PlanBlockReading;
  readonly onSetFamily: PlanEditor["setFamilyOnRows"];
  readonly onSetPlayers: PlanEditor["setPlayersOnRows"];
}

const CHIP_BUTTON =
  "rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

/**
 * One block-wide call. The three states differ in shape as well as tone: a
 * struck label when the whole block leaves the family out, a dashed edge
 * when only some rows do.
 */
const BlockChip = ({
  label,
  state,
  ariaLabel,
  onClick,
}: {
  label: string;
  state: BlockCallState;
  ariaLabel: string;
  onClick: () => void;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={state === "all" ? true : state === "some" ? "mixed" : false}
    aria-label={ariaLabel}
    className={CHIP_BUTTON}
  >
    <Badge
      variant={state === "none" ? "neutral" : "amethyst"}
      className={cn(
        "cursor-pointer",
        state === "all" && "line-through decoration-ethereal-amethyst/60",
        state === "some" && "border-dashed",
        state === "none" && "hover:border-ethereal-gold/40",
      )}
    >
      {label}
    </Badge>
  </button>
);

export const PlanBlockHeader = ({
  block,
  onSetFamily,
  onSetPlayers,
}: PlanBlockHeaderProps): React.JSX.Element => {
  const { t } = useTranslation();
  const familyLabels = useFamilyLabels();

  const span = block.endsAt
    ? t("rehearsals.plan.block.span", "{{start}}–{{end}}", {
        start: block.startsAt,
        end: block.endsAt,
      })
    : t("rehearsals.plan.block.from", "od {{start}}", { start: block.startsAt });
  const showsPlanned = block.planned !== null && block.planned !== block.length;
  const overSpan =
    block.planned !== null && block.length !== null && block.planned > block.length;
  const hasChips = block.families.length > 0 || block.players !== null;

  const setFamily = (family: VoiceFamilyId, state: BlockCallState): void =>
    onSetFamily(block.rowKeys, family, state !== "all");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Eyebrow color="gold" className="tabular-nums">
          {span}
        </Eyebrow>
        {block.length !== null && (
          <Caption color="muted" className="tabular-nums">
            {t("rehearsals.plan.block.length", "{{minutes}} min", { minutes: block.length })}
          </Caption>
        )}
        {showsPlanned && (
          <Caption color={overSpan ? "gold" : "muted"} className="tabular-nums">
            {t("rehearsals.plan.block.planned", "zaplanowano {{minutes}} min", {
              minutes: block.planned,
            })}
          </Caption>
        )}
      </div>

      {hasChips && (
        <div
          role="group"
          aria-label={t("rehearsals.plan.block.calls", "Kogo cały blok nie potrzebuje")}
          className="flex flex-wrap items-center gap-1.5 sm:ml-auto"
        >
          {block.families.map(({ family, excluded }) => (
            <BlockChip
              key={family}
              label={familyLabels[family]}
              state={excluded}
              ariaLabel={t("rehearsals.plan.block.toggle_family", "Wyklucz w całym bloku: {{label}}", {
                label: familyLabels[family],
              })}
              onClick={() => setFamily(family, excluded)}
            />
          ))}
          {block.players !== null && (
            <BlockChip
              label={t("rehearsals.plan.exclude.instrumentalists", "Instrumentaliści")}
              state={block.players}
              ariaLabel={t(
                "rehearsals.plan.block.toggle_instrumentalists",
                "Cały blok bez instrumentalistów",
              )}
              onClick={() => onSetPlayers(block.rowKeys, block.players !== "all")}
            />
          )}
        </div>
      )}
    </div>
  );
};
