/**
 * @file video.ts
 * @description Video sources for the landing — single source of truth. Self-hosted MP4
 *  only — GDPR hard rule: no YouTube/Vimeo embeds (an outbound link is fine, an iframe
 *  is not). All files live in web/public/video/ (gitignored — uploaded out-of-band to
 *  the build host, same regime as src/assets/photos). Per-concert fragments
 *  (/video/landing-<koncert>.mp4) are wired in paths.ts `video` fields.
 * @architecture Astro islands 2026
 * @module data/landing/video
 */

export interface VideoSource {
  /** Public URL of a self-hosted MP4 (H.264 + AAC, +faststart), served from web/public. */
  readonly src: string;
  /** Mono caption line rendered under the frame and in the lightbox. */
  readonly caption: string;
}

/** Hero CTA "Zobacz i usłysz" → lightbox: the full ~5 min concert video (dark room only). */
export const MODAL_VIDEO: VideoSource = {
  src: "/video/landing-modal.mp4",
  caption: "Wybrane fragmenty koncertu \"Kontemplacja Wcielenia\" · VoctEnsemble 2024",
};

/**
 * In-flow Vox moment (movement II): currently the SAME file as the lightbox — one upload,
 * shared browser cache, and a shared resume position (resumeStore keys by src: stop in the
 * modal, pick up in the Vox frame). Point it at a dedicated calm cut when one lands.
 */
export const VOX_VIDEO: VideoSource = MODAL_VIDEO;
