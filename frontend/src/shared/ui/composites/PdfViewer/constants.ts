export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.25;
export const COMPACT_VIEWPORT_THRESHOLD = 640;
export const MOBILE_MIN_PAGE_WIDTH = 260;
export const DESKTOP_MIN_PAGE_WIDTH = 320;
export const DESKTOP_PAGE_WIDTH_CAP = 1080;
/** A4 portrait (height / width) — the fit-to-page guess until the real page loads. */
export const DEFAULT_PAGE_ASPECT = 1.414;

/**
 * Fitting the WHOLE page to the shorter side is right for a tablet held
 * upright and wrong everywhere else: a portrait A4 dropped into a landscape
 * screen answers to the height, so it uses barely a third of the width and the
 * music ends up half the size the device could show. These govern the way out.
 */
/**
 * Fraction of the page height that must be on screen in the partial-page fit.
 * A page is then seen in two windows, `[0, f]` and `[1 − f, 1]`, and a system
 * survives the turn only if one window holds it whole. At ½ the windows merely
 * touch, so every system across the middle is cut on both screens; on a page of
 * three systems the middle one spans roughly 36–64% of the height, which ⅔
 * clears with a few percent to spare and 60% does not.
 */
export const PARTIAL_PAGE_FRACTION = 2 / 3;
/**
 * How much bigger the partial fit has to render before `auto` picks it over the
 * whole page. Below this the reader would be turning twice as often for nothing.
 */
export const AUTO_PARTIAL_GAIN_RATIO = 1.15;
/**
 * Slice of the previous screen kept by each turn when the rest of a page is
 * longer than one screen (see `planScrollTurn`) — a system split across the
 * fold must not vanish between two screens.
 */
export const FIT_SCROLL_OVERLAP_PX = 28;
/** Scroll distance below which the viewport counts as parked at an edge. */
export const SCROLL_EDGE_TOLERANCE_PX = 4;
/** Vertical space kept for floating chrome so a fit-to-page render clears the nav. */
export const FIT_VERTICAL_RESERVE_MOBILE = 0;
export const FIT_VERTICAL_RESERVE_DESKTOP = -50;
/**
 * Performance mode floats no chrome at all, so the page is entitled to the
 * whole box — reserving anything there is what leaves a stand-mounted tablet
 * reading a postage stamp inside a black frame.
 */
export const FIT_VERTICAL_RESERVE_IMMERSIVE = 0;

// Gesture tuning — instrument-grade ergonomics for a score on a music stand.
/**
 * Width of each edge tap-to-turn band, as a fraction of the visible page.
 * Turning is the frequent act and leaving performance mode the rare one, so
 * the exit keeps only the middle third of the paper.
 */
export const TAP_ZONE_FRACTION = 1 / 3;
export const TAP_MAX_MOVEMENT_PX = 8;
export const TAP_MAX_DURATION_MS = 500;
export const SWIPE_MIN_DISTANCE_PX = 64;
export const SWIPE_MAX_DURATION_MS = 700;
/** Horizontal delta must dominate vertical by this ratio to read as a swipe. */
export const SWIPE_AXIS_RATIO = 1.8;
/**
 * Horizontal slack (px) below which the page counts as "fits on screen": there
 * is nothing to pan, so a swipe can only have meant a page turn. A genuinely
 * wider-than-screen page turns from its scroll edge instead.
 */
export const SWIPE_EDGE_TOLERANCE_PX = 4;
/** Beyond this zoom neighbour prefetch is off — canvases get memory-heavy. */
export const PREFETCH_MAX_ZOOM = 1.5;
export const WHEEL_ZOOM_SENSITIVITY = 0.0022;
/** Trailing quiet period after which a ctrl/⌘+wheel zoom preview commits. */
export const WHEEL_COMMIT_DELAY_MS = 160;
/** Ignore the stray single-finger tail of a pinch as a tap for this long. */
export const PINCH_TAP_SUPPRESS_MS = 350;
/** Preview scale drift below this is treated as "no zoom" and not committed. */
export const MIN_COMMIT_SCALE_DELTA = 0.02;
