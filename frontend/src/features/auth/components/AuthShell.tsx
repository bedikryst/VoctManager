/**
 * @file AuthShell.tsx
 * @description Shared "threshold" chrome for the unauthenticated zone (login,
 * activation). Lays the ambient Nave-of-Light field, the back-to-home link and
 * the language switcher, restores native cursors (`admin-mode`) and centres the
 * page's card composition. Both auth screens share this so they read as one
 * cohesive vestibule before the panel. PageTransition is applied by the router,
 * so this shell deliberately does not re-wrap it.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthShell
 */

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { AuthLanguageSwitcher } from "@features/auth/components/AuthLanguageSwitcher";

interface AuthShellProps {
  readonly children: React.ReactNode;
  readonly backLabel: string;
  readonly backTo?: string;
}

export const AuthShell = ({
  children,
  backLabel,
  backTo = "/",
}: AuthShellProps): React.JSX.Element => {
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden selection:bg-ethereal-gold/30">
      <EtherealBackground />

      {/* A soft shaft of light from above — "Nawa światła" made literal:
          brightest at the wordmark, fading down across the card, so the eye is
          drawn down the vertical axis instead of floating on a flat wash. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[960px] w-[760px] -translate-x-1/2 -translate-y-[20%] rounded-[50%] bg-[radial-gradient(50%_50%_at_50%_30%,rgba(255,250,238,0.95)_0%,rgba(255,250,238,0.4)_42%,transparent_70%)] blur-2xl"
        aria-hidden="true"
      />

      {/* Chiaroscuro vignette — let the edges recede so the lit centre and the
          card read with real depth instead of floating on a flat field. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(120%_110%_at_50%_38%,transparent_52%,rgba(46,38,26,0.14)_100%)]"
        aria-hidden="true"
      />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-6 sm:px-8 sm:py-8">
        <Link
          to={backTo}
          className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/70 transition-colors hover:text-ethereal-gold"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          <span>{backLabel}</span>
        </Link>

        <AuthLanguageSwitcher />
      </header>

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-24 sm:px-8">
        {children}
      </main>
    </div>
  );
};
