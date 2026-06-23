/**
 * @file PanelErrorBoundary.tsx
 * @description Render-isolation for the panel's routed content. A single view
 * throwing should not strand the user on a blank takeover — the sidebar, nav and
 * notification bell stay alive while the failed view degrades to a contained,
 * recoverable card. Because it sits *inside* the shell (around the `<Outlet>`),
 * it catches the fault before it can bubble to the router's full-screen boundary.
 *
 * Recovery is two-tiered: "retry" re-mounts the subtree in place, and any route
 * change auto-clears the error (via `resetKey`) so navigating away always works
 * even if a retry can't.
 * @module app/router/PanelErrorBoundary
 * @architecture Enterprise SaaS 2026
 */

import React from "react";

import { ErrorScreen } from "@/shared/ui/feedback/ErrorScreen";
import { isStaleChunkError, describeError } from "@/shared/lib/errors";

interface Props {
  children: React.ReactNode;
  /** When this changes (e.g. the pathname), a latched error is cleared. */
  resetKey: string;
}

interface State {
  error: unknown;
}

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: unknown): void {
    console.error("[PanelErrorBoundary] view render failed:", error);
  }

  private readonly retry = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorScreen
        tone="panel"
        isStale={isStaleChunkError(error)}
        onRetry={this.retry}
        detail={describeError(error)}
      />
    );
  }
}
