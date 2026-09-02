/**
 * @file CopyDeskShell.tsx
 * @description The copy desk's own shell — the second layout in the app, and a
 * takeover rather than a tab.
 *
 * Entering `/redakcja` replaces the panel's chrome outright: no sidebar, no nav
 * dock, no command palette, no ambient dock. What remains is the ground the
 * panel is painted on, one rail naming where the reader is, and a single way
 * back. The desk composes the panel's primitives; it does not compete with the
 * panel's furniture, and it does not invent furniture of its own.
 *
 * Two responsibilities beyond the frame, both of which belong to the shell
 * because they are true of the whole route tree:
 *
 *  - **The gate.** One request answers "may this account be here at all", and
 *    the 403 it can return IS the refusal screen. Both pages below then read
 *    that same cache entry instead of asking again. A refusal still renders
 *    inside the rail, so the way out is never something the reader has to find.
 *  - **The visit stamp.** `copy_desk_seen_at` is what "new since last visit" is
 *    measured from, and it is written when the reader LEAVES — a segment that
 *    appeared since last time has to survive being read, or the counter clears
 *    itself before it has said anything.
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/copy-desk-shell/CopyDeskShell
 */

import React, { Suspense, useEffect, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import { useCopyDeskContents } from "@/features/copydesk/api/copydesk.queries";
import { CopyDeskService } from "@/features/copydesk/api/copydesk.service";
import { CopyDeskAccessRefusal } from "@/features/copydesk/components/CopyDeskAccessRefusal";
import type { CopyDeskContents } from "@/features/copydesk/types/copydesk.dto";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

/** What every page under `/redakcja` is handed, already loaded and gated. */
export interface CopyDeskOutletContext {
  readonly contents: CopyDeskContents;
}

export const CopyDeskShell = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: contents, isLoading, error, refetch } = useCopyDeskContents();

  // `body:not(.admin-mode) *` hides the cursor outright — the rule belongs to
  // the public zone the panel app used to carry, and any full-screen route that
  // forgets it is a screen with nothing to point at. The panel shell and the
  // auth shell each set it for their own tree; this is the third.
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  // Stamped on the way out, and only if the corpus was actually read: a visit
  // that ended at the refusal screen saw nothing to mark as seen. Fire and
  // forget — a stamp that fails is the reader's next visit reporting a slightly
  // longer list, not something to interrupt them with.
  const hasReadCorpus = useRef(false);
  useEffect(() => {
    if (contents) hasReadCorpus.current = true;
  }, [contents]);
  useEffect(
    () => () => {
      if (hasReadCorpus.current) {
        void CopyDeskService.markSeen().catch(() => undefined);
      }
    },
    [],
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent font-sans text-ethereal-ink antialiased">
      <EtherealBackground />

      {/* The one affordance §3 allows the takeover, and it stays reachable: a
          desk you have to scroll to the top of to leave is a room with the door
          behind the furniture. */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-ethereal-canvas/90 px-4 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
        >
          <Link to="/panel">{t("copy_desk.back_to_panel", "Panel")}</Link>
        </Button>
        <Eyebrow color="muted">{t("copy_desk.eyebrow", "Redakcja")}</Eyebrow>
      </header>

      <main
        className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-6"
        id="main-content"
      >
        {/* Data first, and deliberately: with the reconciling tier every mount
            re-asks, so a corpus already in hand must survive a refetch that
            fails on a train. The refusal is for having nothing to show. */}
        {contents ? (
          // The page's chunk suspends INSIDE the rail: a takeover that blanks
          // its own way out while a route loads is a room with no door for as
          // long as the network takes.
          <Suspense fallback={<EtherealLoader fullHeight={false} />}>
            <Outlet context={{ contents } satisfies CopyDeskOutletContext} />
          </Suspense>
        ) : isLoading ? (
          <EtherealLoader
            message={t("copy_desk.loading", "Otwieram redakcję...")}
          />
        ) : (
          <div className="mx-auto w-full max-w-xl py-12">
            <CopyDeskAccessRefusal error={error} onRetry={() => void refetch()} />
          </div>
        )}
      </main>
    </div>
  );
};

CopyDeskShell.displayName = "CopyDeskShell";
