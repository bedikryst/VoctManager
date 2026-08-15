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
import { useFeedbackStore } from "@/app/store/useFeedbackStore";

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

  /**
   * Opens the feedback sheet with the fault already described. A crash is the
   * one moment a member is least likely to report unprompted and most likely to
   * be able to describe, so the stack travels with it rather than asking them
   * to paraphrase it. Read off the store directly — this is a class component,
   * and the sheet is mounted by the shell, which survives a panel-level fault.
   */
  private readonly report = (error: unknown) => (): void =>
    useFeedbackStore.getState().openFeedback({
      technicalDetail: describeError(error),
    });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorScreen
        tone="panel"
        isStale={isStaleChunkError(error)}
        onRetry={this.retry}
        onReport={this.report(error)}
        detail={describeError(error)}
      />
    );
  }
}
