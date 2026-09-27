/**
 * @file VocalRangeSettingsRow.tsx
 * @description The way back to the vocal-range screen: a quiet row in the
 * Profile pane showing the proposal as last sent and when, which reopens the
 * screen with those values. An account with no singing voice opens the trial
 * run instead. The row exists only while the rollout flag covers the account.
 * @module features/vocal-range/components/VocalRangeSettingsRow
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, AudioLines } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { notationForLanguage } from "@/shared/lib/music/pitchNotation";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { VocalRangeText } from "@/shared/ui/instruments/PitchName";
import { Text } from "@/shared/ui/primitives/typography";

import { singingVoiceOf } from "../constants/voices";
import { draftFromProposal } from "../lib/rangeDraft";
import { VocalRangeScreen } from "./VocalRangeScreen";

export const VocalRangeSettingsRow = (): React.JSX.Element | null => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (user?.profile?.vocal_range_prompt_enabled !== true) return null;

  const isTrial = singingVoiceOf(user.voice_type) === null;
  const proposal = isTrial ? null : user.vocal_range_proposal;
  const proposedAt = proposal?.proposed_at ?? null;

  const summary =
    proposal && proposedAt ? (
      <>
        <VocalRangeText
          range={draftFromProposal(proposal)}
          notation={notationForLanguage(i18n.language)}
        />
        {" · "}
        {formatLocalizedDate(
          proposedAt,
          { day: "numeric", month: "numeric", year: "numeric" },
          i18n.language,
          user.profile?.timezone,
        )}
      </>
    ) : isTrial ? (
      t("vocal_range.trial.notice", "Tryb próbny: nic nie zostanie zapisane")
    ) : (
      t("vocal_range.settings_row.empty", "Jeszcze nie podano")
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-nested border border-hairline px-4 py-3 text-left transition-colors hover:border-ethereal-gold/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
      >
        <AudioLines className="h-4 w-4 shrink-0 text-ethereal-gold" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <Text as="span" size="sm" weight="semibold">
            {t("vocal_range.settings_row.title", "Moja skala głosu")}
          </Text>
          <Text as="span" size="sm" color="muted">
            {summary}
          </Text>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-ethereal-graphite/50 transition-colors group-hover:text-ethereal-gold"
          aria-hidden="true"
        />
      </button>
      <VocalRangeScreen open={open} mode="revisit" onClose={() => setOpen(false)} />
    </>
  );
};
