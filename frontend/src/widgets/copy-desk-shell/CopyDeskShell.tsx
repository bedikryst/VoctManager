/**
 * @file CopyDeskShell.tsx
 * @description The copy desk's own shell — the second layout in the app, and a
 * takeover rather than a tab.
 *
 * Entering `/redakcja` replaces the panel's chrome outright: no sidebar, no nav
 * dock, no command palette, no ambient dock. What remains is the ground the
 * panel is painted on and one rail carrying the two ways out of a room with no
 * other doors — a step back one level, and the panel itself. The desk composes
 * the panel's primitives; it does not compete with the panel's furniture, and
 * it does not invent furniture of its own.
 *
 * One responsibility beyond the frame, and it belongs to the shell because it is
 * true of the whole route tree: **the gate.** One request answers "may this
 * account be here at all", and the 403 it can return IS the refusal screen. Both
 * pages below then read that same cache entry instead of asking again. A refusal
 * still renders inside the rail, so the way out is never something the reader
 * has to find.
 *
 * What the shell deliberately does NOT do is stamp anything. Reading marks are
 * per page and per reader (`CopyScopeVisit`), and a shell-wide stamp written on
 * the way out is the defect they replaced: it declared the whole corpus read
 * because somebody opened one page of it.
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/copy-desk-shell/CopyDeskShell
 */

import React, { Suspense, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

import { useCopyDeskContents } from "@/features/copydesk/api/copydesk.queries";
import { CopyDeskAccessRefusal } from "@/features/copydesk/components/CopyDeskAccessRefusal";
import { SittingClosure } from "@/features/copydesk/components/SittingClosure";
import { useCopyDeskSitting } from "@/features/copydesk/model/sittingStore";
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
  const { pathname } = useLocation();
  const { data: contents, isLoading, error, refetch } = useCopyDeskContents();
  const resetSitting = useCopyDeskSitting((state) => state.resetSitting);

  // The sitting is this visit and nothing longer: what it has written, whether
  // a digest has been raised for it, and how it is being read. Leaving the desk
  // ends it — the proposals themselves are on the server either way.
  useEffect(() => resetSitting, [resetSitting]);

  // `body:not(.admin-mode) *` hides the cursor outright — the rule belongs to
  // the public zone the panel app used to carry, and any full-screen route that
  // forgets it is a screen with nothing to point at. The panel shell and the
  // auth shell each set it for their own tree; this is the third.
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  const isDeskIndex = pathname.replace(/\/$/, "") === "/redakcja";

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent font-sans text-ethereal-ink antialiased">
      <EtherealBackground />

      {/* The affordances §3 allows the takeover, and they stay reachable: a desk
          you have to scroll to the top of to leave is a room with the door
          behind the furniture. `position: sticky` only delivers that while the
          page itself is the scrollport — `panel.css` keeps the body out of that
          role, and this is the surface that proves it.

          The left link steps back one level: from a page of text the way out an
          editor wants is the contents list.

          The rail is also where "I have finished" lives, for the reason it is
          not a submit — it belongs to the sitting, not to any one page, and a
          control that scrolled away with the paragraph it happened to sit under
          would be an offer nobody found. */}
      {/* Opaque enough to READ over, and blurred rather than solid: the ambient
          layer's wash is at its strongest under exactly this band, so a flat
          fill would print a lid across the top of the nave. The blur passes the
          gradient through and destroys the body text travelling beneath it. */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-ethereal-canvas/92 px-4 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] backdrop-blur-md sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
        >
          {isDeskIndex ? (
            <Link to="/panel">{t("copy_desk.back_to_panel", "Panel")}</Link>
          ) : (
            <Link to="/redakcja">{t("copy_desk.review.back", "Spis treści")}</Link>
          )}
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          <SittingClosure />
          {/* The step back is one level, which leaves the panel two clicks away
              from the text an editor actually works in — and the desk is a
              takeover, so nothing else on screen leads out of it. The way out
              therefore gets its own place, opposite the step back, and only
              where it is not already the step back. On the index the rail's
              left link IS this, so the slot names the room instead. */}
          {isDeskIndex ? (
            <Eyebrow color="muted" className="hidden sm:inline">
              {t("copy_desk.eyebrow", "Redakcja")}
            </Eyebrow>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              asChild
              leftIcon={<LayoutDashboard size={14} aria-hidden="true" />}
            >
              <Link to="/panel">{t("copy_desk.back_to_panel", "Panel")}</Link>
            </Button>
          )}
        </div>
      </header>

      <main
        className="relative z-10 mx-auto flex w-full max-w-440 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-6"
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
