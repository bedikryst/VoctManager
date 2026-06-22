/**
 * @file NotificationItemBoundary.tsx
 * @description Render-isolation for a single notification row. The inbox renders
 * server-driven, schema-evolving metadata; a malformed or legacy payload can throw
 * inside one row. Without isolation that single failure unmounts the whole panel
 * (and the route's error fallback takes over — exactly the crash we just fixed).
 * Here it degrades to a quiet placeholder so the rest of the inbox keeps working.
 * @module features/notifications/components
 * @architecture Enterprise SaaS 2026
 */
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class NotificationItemBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Surface the root cause to telemetry/console without taking the panel down.
    console.error("[NotificationItem] render failed; showing fallback row.", error);
  }

  render(): React.ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
