/**
 * @file FinanceShell.tsx
 * @description The finance workspace's own shell — a takeover, like the copy
 * desk: entering `/panel/finance` replaces the panel's chrome outright. The
 * person it is built for is a board member who opens Voct only to do finance,
 * so the workspace carries its own navigation between its sections and one
 * clear way back to Voct, and nothing else of the panel — no command palette,
 * no notification bell, no notes.
 *
 * From `lg` up the sections sit in a sticky left column with the way back, the
 * title, the account and logout; below it, a sticky header carries the way back
 * and the sections as a horizontal strip.
 *
 * The shell owns the one overview request and hands it to every section through
 * the Outlet context, so switching sections never re-asks. A section's chunk
 * suspends INSIDE the frame: the way out stays on screen while a route loads.
 *
 * There is no nav dock here, so the shell zeroes `--nav-dock-h` (and the two
 * gaps derived from it) on the root for as long as it is mounted. The gaps are
 * computed where they are declared, so overriding the dock height alone would
 * leave every portalled `bottom-dock` bar floating over a dock that is not
 * there.
 * @architecture Enterprise SaaS 2026
 * @module widgets/finance-shell/FinanceShell
 */

import React, { Suspense, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileDown, FolderKanban, HandCoins, Landmark, LogOut } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { PanelErrorBoundary } from "@/app/router/PanelErrorBoundary";
import { FeedbackDock } from "@/features/feedback/components/FeedbackDock";
import { useFinanceOverview } from "@/features/finance/api/finance.queries";
import { BudgetLoadError } from "@/features/finance/components/BudgetLoadError";
import { hasCosts } from "@/features/finance/lib/portfolio";
import type { FinanceOutletContext } from "@/features/finance/workspace/financeOutlet";
import { useBottomBarHeight } from "@/shared/lib/dom/useBottomBarSlot";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { RouteTabs, type RouteTabItem } from "@/shared/ui/composites/RouteTabs";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

const FINANCE_BASE = "/panel/finance";

/** The dock clearance a takeover without a dock owes every bottom-anchored bar. */
const NO_DOCK_PROPERTIES: Readonly<Record<string, string>> = {
  "--nav-dock-h": "0px",
  "--bottom-dock-gap": "2.5rem",
  "--floating-dock-gap": "2.5rem",
};

export const FinanceShell = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const overview = useFinanceOverview(0);
  const dockBarHeight = useBottomBarHeight();

  // `body:not(.admin-mode) *` hides the cursor outright; every full-screen
  // route tree sets it for itself.
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(NO_DOCK_PROPERTIES)) {
      root.setProperty(name, value);
    }
    return () => {
      for (const name of Object.keys(NO_DOCK_PROPERTIES)) root.removeProperty(name);
    };
  }, []);

  const data = overview.data;
  const sections: RouteTabItem[] = [
    {
      to: `${FINANCE_BASE}/payables`,
      label: t("finance.workspace.nav.payables", "Do zapłaty"),
      icon: <HandCoins size={14} aria-hidden="true" />,
      count: data?.payables.count,
    },
    {
      to: `${FINANCE_BASE}/sources`,
      label: t("finance.workspace.nav.sources", "Źródła"),
      icon: <Landmark size={14} aria-hidden="true" />,
      count: data?.sources.length,
    },
    {
      to: `${FINANCE_BASE}/projects`,
      label: t("finance.workspace.nav.projects", "Projekty"),
      icon: <FolderKanban size={14} aria-hidden="true" />,
      count: data?.projects.filter(hasCosts).length,
    },
    {
      to: `${FINANCE_BASE}/exports`,
      label: t("finance.workspace.nav.exports", "Eksporty"),
      icon: <FileDown size={14} aria-hidden="true" />,
    },
  ];
  const navAria = t("finance.workspace.nav.aria", "Sekcje finansów");

  const backToVoct = (
    <Button
      variant="ghost"
      size="sm"
      asChild
      leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
    >
      <Link to="/panel">{t("finance.workspace.back_to_panel", "Voct")}</Link>
    </Button>
  );

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent font-sans text-ethereal-ink antialiased lg:flex-row">
      <EtherealBackground />

      {/* Below `lg`: the way back and the sections, pinned to the top. Blurred
          rather than solid, like the copy desk's rail, so the ambient wash
          passes through instead of printing a lid across the page. */}
      <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-2.5 border-b border-hairline bg-ethereal-canvas/92 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] backdrop-blur-md sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          {backToVoct}
          <Eyebrow as="h1" color="muted">
            {t("finance.portfolio.title", "Finanse")}
          </Eyebrow>
        </div>
        <RouteTabs items={sections} ariaLabel={navAria} className="max-w-full" />
      </header>

      {/* From `lg`: the workspace's own column, sticky for the length of the
          page, with the account at its foot — the only door to settings and
          logout a takeover leaves. */}
      <aside className="sticky top-0 z-20 hidden h-dvh w-72 shrink-0 flex-col gap-8 border-r border-hairline bg-ethereal-canvas/92 px-5 pb-6 pt-6 backdrop-blur-md lg:flex">
        <div className="self-start">{backToVoct}</div>
        <div className="flex flex-col gap-1 px-1">
          <Eyebrow color="muted">{t("finance.portfolio.role", "Fundacja")}</Eyebrow>
          <Heading as="h1" size="3xl">
            {t("finance.portfolio.title", "Finanse")}
          </Heading>
        </div>
        <RouteTabs items={sections} ariaLabel={navAria} orientation="vertical" />
        <div className="mt-auto flex items-center gap-2 border-t border-hairline pt-4">
          <Link
            to="/panel/settings"
            aria-label={t("dashboard.layout.actions.settings")}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-control p-1.5 transition-colors hover:bg-ethereal-ink/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
          >
            <Avatar
              src={user?.profile?.avatar_thumb_url ?? null}
              name={fullName}
              size="sm"
              shape="rounded"
            />
            <Text as="span" size="sm" weight="medium" truncate>
              {fullName}
            </Text>
          </Link>
          <Button
            variant="icon"
            size="icon"
            onClick={logout}
            aria-label={t("dashboard.layout.actions.logout")}
            title={t("dashboard.layout.actions.logout")}
          >
            <LogOut size={16} aria-hidden="true" />
          </Button>
        </div>
      </aside>

      <main
        id="main-content"
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5 sm:px-6 lg:px-8 lg:pt-8"
      >
        <div className="mx-auto flex w-full max-w-360 flex-1 flex-col">
          {/* Data first: an overview already in hand survives a refetch that
              fails. The error panel is for having nothing to show. */}
          {data ? (
            <PanelErrorBoundary resetKey={pathname}>
              <Suspense fallback={<EtherealLoader fullHeight={false} />}>
                <Outlet context={{ overview: data } satisfies FinanceOutletContext} />
              </Suspense>
            </PanelErrorBoundary>
          ) : overview.isLoading ? (
            <EtherealLoader message={t("finance.portfolio.loading", "Wczytuję rozliczenia…")} />
          ) : (
            <div className="mx-auto w-full max-w-xl py-12">
              <BudgetLoadError onRetry={() => void overview.refetch()} />
            </div>
          )}
        </div>
      </main>

      {/* The feedback button, alone in the ambient column the panel shell
          keeps for it; it rides above any contextual bar the same way. */}
      <div
        className="pointer-events-none floating-dock fixed inset-x-0 z-40 flex flex-col items-center gap-2"
        style={{ "--dock-bar-h": `${dockBarHeight}px` } as React.CSSProperties}
      >
        <FeedbackDock />
      </div>
    </div>
  );
};

FinanceShell.displayName = "FinanceShell";
