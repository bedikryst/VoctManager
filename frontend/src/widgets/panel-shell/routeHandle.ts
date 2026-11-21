/**
 * @file routeHandle.ts
 * @description What a panel route can ask of the dashboard shell through its
 * data-router `handle`. Read by `DashboardLayout` from the matched routes, so a
 * route states its needs where it is declared and the shell has no list of
 * paths to keep in step.
 * @module widgets/panel-shell/routeHandle
 */

import type { UIMatch } from "react-router-dom";

/**
 * `ambient`: the default, the page over the shell's ambient field.
 *
 * `plain`: the route reads as a document: an opaque ground and no ambient
 * field, whose stave would otherwise run through the text of rows that carry
 * no tile of their own. Page padding and the width cap stay.
 *
 * `bleed`: the route is a work surface that paints its own opaque ground
 * from edge to edge. The shell drops the ambient field, the page padding and
 * the width cap, and the route owns its whole geometry: the clearance for the
 * rail on the left and for the nav dock below. The rail, a pinned notes rail
 * and the shell's floating column still sit over it.
 */
export type PanelLayout = "ambient" | "plain" | "bleed";

export interface PanelRouteHandle {
  readonly panelLayout?: Exclude<PanelLayout, "ambient">;
}

export const BLEED_ROUTE_HANDLE: PanelRouteHandle = { panelLayout: "bleed" };
export const PLAIN_ROUTE_HANDLE: PanelRouteHandle = { panelLayout: "plain" };

const isPanelRouteHandle = (handle: unknown): handle is PanelRouteHandle =>
  typeof handle === "object" && handle !== null && "panelLayout" in handle;

/** The layout the deepest matched route asks for. */
export const panelLayoutOf = (matches: readonly UIMatch[]): PanelLayout => {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const { handle } = matches[index];
    if (isPanelRouteHandle(handle) && handle.panelLayout) return handle.panelLayout;
  }
  return "ambient";
};
