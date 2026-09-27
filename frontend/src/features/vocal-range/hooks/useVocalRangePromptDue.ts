/**
 * @file useVocalRangePromptDue.ts
 * @description Whether the vocal-range prompt should take the screen now. It is
 * pending for a singer covered by the rollout flag who has never sent a
 * proposal, and due once the one-time welcome is behind them. The trigger is
 * the panel being open, not the login: a PWA session lasts weeks.
 *
 * It stays away inside a manager's preview of somebody else's view, and while
 * "Later" holds.
 * @module features/vocal-range/hooks/useVocalRangePromptDue
 */

import { useMatch } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { ARTIST_PREVIEW_ROUTE } from "@/app/providers/ArtistPreviewProvider";
import type { AuthUser } from "@/shared/auth/auth.types";

import { singingVoiceOf } from "../constants/voices";
import { useVocalRangePromptSnoozed } from "../lib/vocalRangeSession";

/**
 * The prompt is owed to this account, the welcome aside: the welcome reads this
 * to know whether to hand the scene over rather than fade it out.
 */
export const isVocalRangePromptPending = (user: AuthUser | null): boolean => {
  if (!user) return false;
  const proposal = user.vocal_range_proposal;
  return (
    user.profile?.vocal_range_prompt_enabled === true &&
    singingVoiceOf(user.voice_type) !== null &&
    proposal != null &&
    proposal.proposed_at === null
  );
};

export const useVocalRangePromptDue = (): boolean => {
  const { user } = useAuth();
  const snoozed = useVocalRangePromptSnoozed();
  const inPreview = useMatch(ARTIST_PREVIEW_ROUTE) !== null;

  if (!user || snoozed || inPreview) return false;
  return (
    (user.profile?.welcome_seen_at ?? null) !== null &&
    isVocalRangePromptPending(user)
  );
};
