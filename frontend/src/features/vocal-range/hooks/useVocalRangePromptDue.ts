/**
 * @file useVocalRangePromptDue.ts
 * @description Whether the vocal-range prompt should take the screen now. It is
 * pending for a singer covered by the rollout flag who has never sent a
 * proposal, and due once the chorister's one-time welcome is behind them. A
 * manager who also sings, a board member say, never gets that welcome, so
 * nothing holds the prompt back for them. The trigger is the panel being open,
 * not the login: a PWA session lasts weeks.
 *
 * It stays away inside a manager's preview of somebody else's view, and while
 * "Later" holds.
 * @module features/vocal-range/hooks/useVocalRangePromptDue
 */

import { useMatch } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { ARTIST_PREVIEW_ROUTE } from "@/app/providers/ArtistPreviewProvider";
import { singingVoiceOf } from "@/features/artists/constants/voices";
import type { AuthUser } from "@/shared/auth/auth.types";
import { isManager } from "@/shared/auth/rbac";

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
  // `welcome_seen_at` means "the welcome is behind them" only for a chorister.
  // For a manager the same flag is the season concierge's, stamped when they
  // finish it, which a singing board member may never do.
  const welcomeBehind =
    isManager(user) || (user.profile?.welcome_seen_at ?? null) !== null;
  return welcomeBehind && isVocalRangePromptPending(user);
};
