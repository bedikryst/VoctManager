/**
 * @file RouteErrorBoundary.tsx
 * @description App-wide `errorElement` for the data router. Anything that throws
 * while rendering a route — including a render fault deep in the shell, like the
 * notification-cache crash this app shipped before — bubbles here instead of to
 * the framework's raw developer error page. Renders the Ethereal fault surface
 * full-screen and reframes a stale-deploy chunk failure as "reload for the new
 * version".
 * @module app/router/RouteErrorBoundary
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";

import { ErrorScreen } from "@/shared/ui/feedback/ErrorScreen";
import { isStaleChunkError, describeError } from "@/shared/lib/errors";

export default function RouteErrorBoundary(): React.JSX.Element {
  const error = useRouteError();

  useEffect(() => {
    // Surface the root cause for telemetry (hidden source maps map this back to
    // real frames). A route response (e.g. a 404) is expected control flow, not
    // a fault worth shouting about.
    if (!isRouteErrorResponse(error)) {
      console.error("[RouteErrorBoundary] uncaught route error:", error);
    }
  }, [error]);

  const stale = isStaleChunkError(error);

  return (
    <ErrorScreen
      tone="fullscreen"
      isStale={stale}
      detail={describeError(error)}
    />
  );
}
