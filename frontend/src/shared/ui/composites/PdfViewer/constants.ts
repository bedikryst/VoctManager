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
/** Vertical space kept for floating chrome so a fit-to-page render clears the nav. */
export const FIT_VERTICAL_RESERVE_MOBILE = 0;
export const FIT_VERTICAL_RESERVE_DESKTOP = -50;

// Gesture tuning — instrument-grade ergonomics for a score on a music stand.
/** Width of the edge tap-to-turn zones, as a fraction of the viewport. */
export const TAP_ZONE_FRACTION = 0.22;
export const TAP_MAX_MOVEMENT_PX = 8;
export const TAP_MAX_DURATION_MS = 500;
export const SWIPE_MIN_DISTANCE_PX = 64;
export const SWIPE_MAX_DURATION_MS = 700;
/** Horizontal delta must dominate vertical by this ratio to read as a swipe. */
export const SWIPE_AXIS_RATIO = 1.8;
/** Above this zoom the page overflows horizontally and drags pan, not turn. */
export const PANNABLE_ZOOM_THRESHOLD = 1.02;
/** Beyond this zoom neighbour prefetch is off — canvases get memory-heavy. */
export const PREFETCH_MAX_ZOOM = 1.5;
export const WHEEL_ZOOM_SENSITIVITY = 0.0022;
/** Trailing quiet period after which a ctrl/⌘+wheel zoom preview commits. */
export const WHEEL_COMMIT_DELAY_MS = 160;
/** Ignore the stray single-finger tail of a pinch as a tap for this long. */
export const PINCH_TAP_SUPPRESS_MS = 350;
/** Preview scale drift below this is treated as "no zoom" and not committed. */
export const MIN_COMMIT_SCALE_DELTA = 0.02;
