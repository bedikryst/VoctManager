/**
 * @file CSRFProvider.tsx
 * @description Warms the Django CSRF cookie once on app boot. Fire-and-forget by
 * design: rendering is NEVER blocked on the token fetch. The public marketing
 * surface is read-only at first paint, and every mutation that needs CSRF
 * (donation flow, login) is gated behind user interaction that takes far longer
 * than the bootstrap round-trip — so the cookie is always set in time.
 * @architecture Enterprise SaaS 2026
 * @module app/providers/CSRFProvider
 */

import { useEffect, type ReactNode } from "react";

import api, { type AuthRequestConfig } from "@/shared/api/api";

const csrfRequestConfig: AuthRequestConfig = {
  skipAuthRefresh: true,
  skipAuthRedirect: true,
};

export const CSRFProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => {
  useEffect(() => {
    // Background warm-up — we deliberately do not await or block on this.
    // Blocking previously flashed the panel <EtherealLoader> over the public
    // landing and added a backend round-trip to FCP/LCP on cold (incognito)
    // visits, double-stacking with the marketing <Preloader>.
    void api.get("/api/csrf/", csrfRequestConfig).catch((error: unknown) => {
      console.error("CSRF bootstrap request failed.", error);
    });
  }, []);

  return <>{children}</>;
};
