/**
 * @file cameraFlight.ts
 * @description Cinematic Google Maps camera choreography shared by every
 * logistics surface (atlas + picker). The native SDK animates `panTo` but snaps
 * zoom/tilt/heading, and naive linear interpolation over a large zoom delta
 * looks like "zoom into the current centre, then teleport to the target" —
 * because at high zoom the residual geographic offset becomes a huge on-screen
 * jump. This module instead flies along the **van Wijk optimal path** ("Smooth
 * and efficient zooming and panning", the same curve Mapbox `flyTo` uses): rise,
 * glide at altitude, descend precisely onto the target. Tilt/heading ride the
 * same eased clock so a 3D dive feels like one gesture. Honours
 * `prefers-reduced-motion` by snapping. Pure + framework-agnostic.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/lib/cameraFlight
 */

export interface CameraTarget {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  tilt?: number;
  heading?: number;
}

export interface FlyOptions {
  /** Override the path-derived flight time (ms). */
  durationMs?: number;
  /** Force-snap (no animation). Defaults to the OS reduced-motion preference. */
  reducedMotion?: boolean;
  /** Fired once the camera settles on the target. */
  onComplete?: () => void;
}

/** Cinematic constants tuned for the parchment atlas. */
export const CINEMATIC = {
  /** Zoom the camera dives to when focusing a single venue. */
  FOCUS_ZOOM: 16.4,
  /**
   * Default 3D dive pitch (degrees) applied automatically on every venue
   * focus — only honoured by vector map ids (raster maps ignore it harmlessly).
   * Moderate so it reads as depth, not disorientation, on a tablet.
   */
  TILT_ANGLE: 45,
  /** Gentle compass offset on the dive so buildings cast depth. */
  TILT_HEADING: 18,
} as const;

// van Wijk path curvature. ρ = √2 is the canonical "nice motion" value (d3).
const RHO = Math.SQRT2;
const RHO2 = 2;
const RHO4 = 4;
const WORLD_SIZE = 256;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

/** Ease that accelerates then settles — gentle start/stop along the arc. */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Heading interpolation along the shortest rotational direction. */
const lerpHeading = (from: number, to: number, t: number): number => {
  const delta = ((to - from) % 360 + 540) % 360 - 180;
  return from + delta * t;
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface CameraState {
  lat: number;
  lng: number;
  zoom: number;
  tilt: number;
  heading: number;
}

/** Push a full camera pose in one repaint (vector) or via setters (raster). */
const applyCamera = (map: google.maps.Map, c: CameraState): void => {
  const center = { lat: c.lat, lng: c.lng };
  if (typeof map.moveCamera === "function") {
    map.moveCamera({ center, zoom: c.zoom, tilt: c.tilt, heading: c.heading });
    return;
  }
  map.setCenter(center);
  map.setZoom(Math.round(c.zoom));
  map.setTilt?.(c.tilt);
  map.setHeading?.(c.heading);
};

const readCamera = (map: google.maps.Map, fallback: CameraTarget): CameraState => {
  const center = map.getCenter();
  return {
    lat: center?.lat() ?? fallback.center?.lat ?? 0,
    lng: center?.lng() ?? fallback.center?.lng ?? 0,
    zoom: map.getZoom() ?? fallback.zoom ?? 4,
    tilt: map.getTilt?.() ?? 0,
    heading: map.getHeading?.() ?? 0,
  };
};

/** A point along the path, in Mercator world units, plus the viewport size. */
type PathPoint = readonly [x: number, y: number, w: number];

/**
 * Builds the van Wijk interpolator between two camera poses expressed as a world
 * point + viewport size. Returns a sampler `i(t)` and the arc length `S` (used to
 * scale the duration). When the centres coincide it degenerates to a clean
 * exponential zoom — which is exactly what the +/- buttons want.
 */
const buildPath = (
  ux0: number,
  uy0: number,
  w0: number,
  ux1: number,
  uy1: number,
  w1: number,
): { sample: (t: number) => PathPoint; length: number } => {
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;

  if (d2 < 1e-10) {
    const ratio = w1 / w0;
    const S = Math.abs(Math.log(ratio)) / RHO;
    return {
      length: S,
      sample: (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.pow(ratio, t)],
    };
  }

  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + RHO4 * d2) / (2 * w0 * RHO2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - RHO4 * d2) / (2 * w1 * RHO2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / RHO;
  const coshr0 = Math.cosh(r0);

  return {
    length: Math.abs(S),
    sample: (t) => {
      const s = t * S;
      const u = (w0 / (RHO2 * d1)) * (coshr0 * Math.tanh(RHO * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(RHO * s + r0)];
    },
  };
};

/** Linear-lerp fallback when the projection is not ready (rare, early frames). */
const flyLinear = (
  map: google.maps.Map,
  start: CameraState,
  end: CameraState,
  duration: number,
  onComplete?: () => void,
): (() => void) => {
  let frame = 0;
  let cancelled = false;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const tick = (now: number): void => {
    if (cancelled) return;
    const e = easeInOutCubic(clamp((now - t0) / duration, 0, 1));
    applyCamera(map, {
      lat: lerp(start.lat, end.lat, e),
      lng: lerp(start.lng, end.lng, e),
      zoom: lerp(start.zoom, end.zoom, e),
      tilt: lerp(start.tilt, end.tilt, e),
      heading: lerpHeading(start.heading, end.heading, e),
    });
    if (e < 1) frame = requestAnimationFrame(tick);
    else onComplete?.();
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
};

/**
 * Fly the camera to `target`, gliding along the van Wijk optimal path. Returns a
 * cancel function — call it before starting a new flight (or on unmount) so
 * competing animations never fight over the same map.
 */
export const flyCameraTo = (
  map: google.maps.Map,
  target: CameraTarget,
  options: FlyOptions = {},
): (() => void) => {
  const start = readCamera(map, target);
  const end: CameraState = {
    lat: target.center?.lat ?? start.lat,
    lng: target.center?.lng ?? start.lng,
    zoom: target.zoom ?? start.zoom,
    tilt: target.tilt ?? start.tilt,
    heading: target.heading ?? start.heading,
  };

  const snap = (): (() => void) => {
    applyCamera(map, end);
    options.onComplete?.();
    return () => {};
  };

  if ((options.reducedMotion ?? prefersReducedMotion()) || options.durationMs === 0) {
    return snap();
  }

  const projection = map.getProjection?.();
  const p0 = projection?.fromLatLngToPoint({ lat: start.lat, lng: start.lng });
  const p1 = projection?.fromLatLngToPoint({ lat: end.lat, lng: end.lng });

  // Without a projection we cannot work in world space — fall back to a lerp.
  if (!projection || !p0 || !p1 || typeof google === "undefined") {
    return flyLinear(map, start, end, options.durationMs ?? 1100, options.onComplete);
  }

  const widthPx = map.getDiv()?.offsetWidth || 800;
  const w0 = widthPx / Math.pow(2, start.zoom);
  const w1 = widthPx / Math.pow(2, end.zoom);

  // Pan the short way around the antimeridian.
  let ux1 = p1.x;
  if (ux1 - p0.x > WORLD_SIZE / 2) ux1 -= WORLD_SIZE;
  else if (ux1 - p0.x < -WORLD_SIZE / 2) ux1 += WORLD_SIZE;

  const path = buildPath(p0.x, p0.y, w0, ux1, p1.y, w1);

  // Degenerate (no real motion): snap.
  if (!Number.isFinite(path.length) || path.length < 1e-4) {
    return snap();
  }

  const duration =
    options.durationMs ?? clamp(600 + path.length * 200, 700, 2300);

  let frame = 0;
  let cancelled = false;
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const tick = (now: number): void => {
    if (cancelled) return;
    const linear = clamp((now - startedAt) / duration, 0, 1);
    const e = easeInOutCubic(linear);
    const [x, y, w] = path.sample(e);

    const wrappedX = ((x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
    const latLng = projection.fromPointToLatLng(new google.maps.Point(wrappedX, y));

    if (latLng) {
      applyCamera(map, {
        lat: latLng.lat(),
        lng: latLng.lng(),
        zoom: Math.log2(widthPx / w),
        tilt: lerp(start.tilt, end.tilt, e),
        heading: lerpHeading(start.heading, end.heading, e),
      });
    }

    if (linear < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      // Land exactly on the target (guards against float drift).
      applyCamera(map, end);
      options.onComplete?.();
    }
  };

  frame = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
};
