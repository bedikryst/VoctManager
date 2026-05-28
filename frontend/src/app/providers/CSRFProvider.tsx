/**
 * @file CSRFProvider.tsx
 * @description Warms the Django CSRF cookie once on app boot. Fire-and-forget by
 * design: rendering is never blocked on the token fetch. Auth mutations are
 * gated behind user interaction that takes longer than the bootstrap round-trip,
 * so the cookie is available without delaying the panel shell.
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
    // Background warm-up; the panel shell must not wait for this request.
    void api.get("/api/csrf/", csrfRequestConfig).catch((error: unknown) => {
      console.error("CSRF bootstrap request failed.", error);
    });
  }, []);

  return <>{children}</>;
};
