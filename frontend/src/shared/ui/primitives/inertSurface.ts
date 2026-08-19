/**
 * @file inertSurface.ts
 * @description How a control looks when it is present and does nothing.
 *
 * One dimming level, stated once. A screen that shows what SOMEBODY ELSE sees
 * — the manager-side member preview — keeps every control in its place and
 * takes the life out of it, so the reader can still answer "does that person
 * have this button". Scattered across a dozen call sites that treatment drifts
 * into three opacities, and a row dimmed twice (card and buttons) sinks below
 * legibility while the row next to it stays bright.
 *
 * Pair it with the `inert` attribute, never with it alone: this constant is the
 * look, `inert` is the death — it takes the subtree out of hit-testing, out of
 * the tab order and out of the accessibility tree at once, which no class can.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/inertSurface
 */

/**
 * The resting look of an inert control. Deliberately opacity alone: the shape,
 * the colour and the label are the answer being given, and only the invitation
 * to press has to go.
 */
export const INERT_SURFACE = "opacity-55";
