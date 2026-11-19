/**
 * @file routeHandle.ts
 * @description What a panel route can ask of the dashboard shell through its
 * data-router `handle`. Read by `DashboardLayout` from the matched routes, so a
 * route states its needs where it is declared and the shell has no list of
 * paths to keep in step.
 * @module widgets/panel-shell/routeHandle
 */

import type { UIMatch } from "react-router-dom";

export interface PanelRouteHandle {
  /**
   * `bleed`: the route is a work surface that paints its own opaque ground
   * from edge to edge. The shell drops the ambient background, the page
   * padding and the width cap, and the route owns its whole geometry: the
   * clearance for the rail on the left and for the nav dock below. The rail,
   * a pinned notes rail and the shell's floating column still sit over it.
   */
  readonly panelLayout?: "bleed";
}

export const BLEED_ROUTE_HANDLE: PanelRouteHandle = { panelLayout: "bleed" };

const isPanelRouteHandle = (handle: unknown): handle is PanelRouteHandle =>
  typeof handle === "object" && handle !== null && "panelLayout" in handle;

/** Whether any matched route asks to bleed. */
export const isBleedRoute = (matches: readonly UIMatch[]): boolean =>
  matches.some(
    (match) => isPanelRouteHandle(match.handle) && match.handle.panelLayout === "bleed",
  );
