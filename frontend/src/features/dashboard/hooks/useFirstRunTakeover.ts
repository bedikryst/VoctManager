/**
 * @file useFirstRunTakeover.ts
 * @description Which full-screen first-run moment owns the screen, if any: the
 * chorister's one-time welcome, then the vocal-range prompt. Everything else
 * that could claim the whole screen or the member's attention (the invitation
 * modal, the delegation briefing, the install pill) reads this and waits, so
 * two takeovers never stack.
 *
 * "welcome" is a non-manager whose `welcome_seen_at` is unset, and only on the
 * panel's home route, because that is where the welcome is mounted (it greets
 * by the vocative the home dashboard loads). A new singer who opens the app
 * elsewhere, from a push deep link say, gets the rest of the panel as usual and
 * meets the welcome on reaching home; nothing waits for a moment that is not on
 * screen. A manager's first run is the inline season concierge, which takes
 * nothing over.
 * @module features/dashboard/hooks/useFirstRunTakeover
 */

import { useMatch } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { useVocalRangePromptDue } from "@/features/vocal-range/hooks/useVocalRangePromptDue";

/** The panel's home, where `DashboardHome` renders the artist dashboard and,
 *  with it, the welcome. Must match the index route in `App.tsx`. */
const PANEL_HOME_ROUTE = "/panel";

export type FirstRunTakeover = "welcome" | "vocal-range" | null;

export const useFirstRunTakeover = (): FirstRunTakeover => {
  const { user } = useAuth();
  const vocalRangeDue = useVocalRangePromptDue();
  const onHome = useMatch(PANEL_HOME_ROUTE) !== null;

  if (!user) return null;
  if (!isManager(user) && (user.profile?.welcome_seen_at ?? null) === null) {
    return onHome ? "welcome" : null;
  }
  return vocalRangeDue ? "vocal-range" : null;
};
