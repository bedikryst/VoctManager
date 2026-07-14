/**
 * @file video.ts
 * @description Video sources for the landing — single source of truth. Self-hosted MP4
 *  only — GDPR hard rule: no YouTube/Vimeo embeds (an outbound link is fine, an iframe
 *  is not). All files live in `src/assets/videos`, so the build emits content-hashed
 *  asset URLs instead of stable public `/video/*.mp4` paths.
 * @architecture Astro islands 2026
 * @module data/landing/video
 */

import { videoAsset } from "../../lib/videos";

export interface VideoSource {
  /** Bundled URL of a self-hosted MP4 (H.264 + AAC, +faststart). */
  readonly src: string;
  /** Mono caption line rendered under the frame and in the lightbox. */
  readonly caption: string;
}

/** Hero CTA "Zobacz i usłysz" → lightbox: the full ~5 min concert video (dark room only). */
export const MODAL_VIDEO: VideoSource = {
  src: videoAsset("landing-modal"),
  caption: "Wybrane fragmenty koncertu \"Kontemplacja Wcielenia\" · VoctEnsemble 2024",
};

/**
 * In-flow Vox moment (movement II): currently the SAME file as the lightbox, so one upload,
 * one browser cache entry, and one per-tab resume position are enough. Point this at a
 * dedicated calm cut when one lands.
 */
export const VOX_VIDEO: VideoSource = MODAL_VIDEO;
